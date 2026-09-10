import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order, OrderStatus } from '../database/entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersGateway } from './orders.gateway';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly gateway: OrdersGateway,
  ) {}

  async create(requesterId: string, dto: CreateOrderDto): Promise<Order> {
    const suppliers: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id::text FROM users
        WHERE "isPusat" = TRUE AND ($1::uuid IS NULL OR id = $1::uuid)
        ORDER BY created_at LIMIT 1`,
      [dto.supplierId ?? null],
    );
    const supplierId = suppliers[0]?.id;
    if (!supplierId) throw new BadRequestException('Akun pusat belum dikonfigurasi');
    if (requesterId === supplierId) {
      throw new BadRequestException('Requester and supplier must be different');
    }
    if (dto.items.length === 0) throw new BadRequestException('Order must contain items');

    const requestedItems = new Map<string, { quantity: number; unit: string }>();
    for (const item of dto.items) {
      if (requestedItems.has(item.warehouseId)) throw new BadRequestException('Bahan baku tidak boleh duplikat dalam satu pesanan');
      requestedItems.set(item.warehouseId, { quantity: item.quantity, unit: item.unit });
    }
    const ids = [...requestedItems.keys()].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);

    const saved = await this.dataSource.transaction(async (manager) => {
      const products: Array<{ id: string; nama_bumbu: string; stock: number; harga: string; satuan: string }> =
        await manager.query(
          `SELECT id::text, nama_bumbu, stock::float8 AS stock, harga::text, satuan
             FROM warehouse
            WHERE id = ANY($1::bigint[]) AND jenis_produk = 'bahan_baku' AND deleted_at IS NULL
            ORDER BY id`,
          [ids],
        );
      if (products.length !== ids.length) throw new BadRequestException('Warehouse item not found');

      const normalized = new Map(products.map((product) => {
        const requested = requestedItems.get(product.id)!;
        const quantity = this.convertUnit(requested.quantity, requested.unit, product.satuan);
        if (quantity === null) throw new BadRequestException(`Satuan ${requested.unit} tidak sesuai untuk ${product.nama_bumbu} (${product.satuan})`);
        if (quantity > product.stock) {
          throw new ConflictException(`Jumlah ${product.nama_bumbu} melebihi stok Gudang Pusat. Stok tersedia ${product.stock} ${product.satuan}`);
        }
        return [product.id, quantity];
      }));
      const totalAmount = products.reduce((sum, product) => sum + Number(product.harga) * normalized.get(product.id)!, 0).toFixed(2);
      const inserted: Array<{ id: string }> = await manager.query(
        `INSERT INTO orders (pemesan_id, pemberi_id, status, total_amount)
         VALUES ($1::uuid, $2::uuid, $3::order_status, $4::numeric)
         RETURNING id::text`,
        [requesterId, supplierId, OrderStatus.PENDING, totalAmount],
      );
      const orderId = inserted[0].id;

      for (const product of products) {
        const requested = requestedItems.get(product.id)!;
        const lineTotal = (Number(product.harga) * normalized.get(product.id)!).toFixed(2);
        await manager.query(
          `INSERT INTO order_items (order_id, warehouse_id, nama_barang, jumlah_pesan, satuan, unit_price, line_total)
           VALUES ($1::bigint, $2::bigint, $3, $4, $5, $6::numeric, $7::numeric)`,
          [orderId, product.id, product.nama_bumbu, requested.quantity, requested.unit, product.harga, lineTotal],
        );
      }

      return manager.findOneOrFail(Order, { where: { id: orderId }, relations: { items: true } });
    });

    // Emit only after commit so consumers never receive a rolled-back order.
    this.gateway.notifyNewOrder(supplierId, saved);
    return saved;
  }

  async incoming(adminId: string): Promise<Array<Order & { requesterUsername: string }>> {
    await this.assertCentralAdmin(adminId);
    const orders = await this.dataSource.getRepository(Order).find({
      where: { pemberiId: adminId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
    if (!orders.length) return [];
    const requesterIds = [...new Set(orders.map((order) => order.pemesanId))];
    const users: Array<{ id: string; username: string }> = await this.dataSource.query(
      `SELECT id::text, username FROM users WHERE id = ANY($1::uuid[])`,
      [requesterIds],
    );
    const usernames = new Map(users.map((user) => [user.id, user.username]));
    return orders.map((order) => ({
      ...order,
      requesterUsername: usernames.get(order.pemesanId) ?? 'Mitra tidak dikenal',
    }));
  }

  async mine(requesterId: string): Promise<Order[]> {
    return this.dataSource.getRepository(Order).find({
      where: { pemesanId: requesterId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(adminId: string, orderId: string, dto: UpdateOrderStatusDto): Promise<Order> {
    await this.assertCentralAdmin(adminId);
    let requesterId = '';
    const saved = await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const locked: Array<{ id: string; pemesan_id: string; pemberi_id: string; status: OrderStatus; stock_applied_at: Date | null }> =
        await manager.query(
          `SELECT id::text, pemesan_id::text, pemberi_id::text, status, stock_applied_at
             FROM orders
            WHERE id = $1::bigint
            FOR UPDATE`,
          [orderId],
        );
      const order = locked[0];
      if (!order) throw new NotFoundException('Order not found');
      if (order.pemberi_id !== adminId) throw new ForbiddenException('Order is not assigned to this central admin');
      requesterId = order.pemesan_id;

      // Retrying the same request is harmless and never decrements stock again.
      if (order.status === dto.status) {
        return manager.findOneOrFail(Order, { where: { id: orderId }, relations: { items: true } });
      }
      const allowedNext: Record<OrderStatus, OrderStatus | null> = {
        [OrderStatus.PENDING]: OrderStatus.DITERIMA,
        [OrderStatus.DITERIMA]: OrderStatus.DIKIRIM,
        [OrderStatus.DIKIRIM]: OrderStatus.SELESAI,
        [OrderStatus.SELESAI]: null,
      };
      if (allowedNext[order.status] !== dto.status) {
        throw new ConflictException(`Invalid transition: ${order.status} -> ${dto.status}`);
      }

      // Ownership of stock moves exactly once when the Mitra confirms completion.
      // The warehouse decrement, partner increment, status update, and idempotency
      // marker share one transaction and therefore cannot partially succeed.
      if (dto.status === OrderStatus.SELESAI) {
        const items: Array<{ warehouse_id: string; nama_barang: string; jumlah_pesan: number; satuan: string }> =
          await manager.query(
            `SELECT oi.warehouse_id::text, oi.nama_barang, oi.jumlah_pesan::float8 AS jumlah_pesan,
                    oi.satuan
               FROM order_items oi
              WHERE oi.order_id = $1::bigint
              ORDER BY oi.warehouse_id
              FOR UPDATE OF oi`,
            [orderId],
          );
        for (const item of items) {
          const warehouseRows: Array<{ id: string; stock: number; unit: string }> = await manager.query(
            `SELECT id::text, stock::float8 AS stock, satuan AS unit
               FROM warehouse
              WHERE id = $1::bigint
              FOR UPDATE`,
            [item.warehouse_id],
          );
          const warehouseItem = warehouseRows[0];
          if (!warehouseItem) throw new NotFoundException(`Bahan baku ${item.nama_barang} tidak ditemukan di Gudang Pusat`);
          const normalizedQuantity = this.convertUnit(item.jumlah_pesan, item.satuan, warehouseItem.unit);
          if (normalizedQuantity === null) throw new ConflictException(`Satuan ${item.nama_barang} tidak kompatibel dengan Gudang Pusat`);
          if (warehouseItem.stock < normalizedQuantity) throw new ConflictException(`Stok ${item.nama_barang} tidak mencukupi`);
          await manager.query(
            `UPDATE warehouse
                SET stock = stock - $1, updated_at = now()
              WHERE id = $2::bigint`,
            [normalizedQuantity, item.warehouse_id],
          );
          await manager.query(
            `INSERT INTO produk_mitra (mitra_id, master_produk_id, nama_produk, jenis_produk, kategori, stock, harga)
             VALUES ($1::uuid, $4::bigint, $2, 'bahan_baku', 'Bahan baku', $3, 0)
             ON CONFLICT ON CONSTRAINT uq_produk_mitra_owner_kind_name
             DO UPDATE SET stock = produk_mitra.stock + EXCLUDED.stock, master_produk_id = EXCLUDED.master_produk_id, updated_at = now()`,
            [requesterId, item.nama_barang, normalizedQuantity, item.warehouse_id],
          );
        }
      }

      const rawChanged: unknown = await manager.query(
        `UPDATE orders
            SET status = $1::order_status,
                updated_at = now(),
                stock_applied_at = CASE WHEN $1::order_status = 'selesai' THEN now() ELSE stock_applied_at END
          WHERE id = $2::bigint AND status = $3::order_status
          RETURNING id::text`,
        [dto.status, orderId, order.status],
      );
      if (this.resultRows<{ id: string }>(rawChanged).length !== 1) {
        throw new ConflictException('Status pesanan telah berubah. Muat ulang lalu coba kembali.');
      }
      return manager.findOneOrFail(Order, { where: { id: orderId }, relations: { items: true } });
    });

    this.gateway.notifyStatusChanged(requesterId, saved);
    return saved;
  }

  private async assertCentralAdmin(userId: string) {
    const rows: Array<{ isPusat: boolean }> = await this.dataSource.query(
      `SELECT "isPusat" AS "isPusat" FROM users WHERE id = $1::uuid`, [userId],
    );
    if (!rows[0]?.isPusat) throw new ForbiddenException('Central admin access required');
  }

  private convertUnit(quantity: number, from: string, to: string): number | null {
    if (from === to) return quantity;
    if (from === 'kilogram' && to === 'gram') return quantity * 1000;
    if (from === 'gram' && to === 'kilogram') return quantity / 1000;
    if (from === 'liter' && to === 'mililiter') return quantity * 1000;
    if (from === 'mililiter' && to === 'liter') return quantity / 1000;
    return null;
  }

  /** Normalize raw UPDATE ... RETURNING results across TypeORM/pg versions. */
  private resultRows<T>(result: unknown): T[] {
    if (!Array.isArray(result)) return [];
    if (result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') return result[0] as T[];
    return result as T[];
  }
}
