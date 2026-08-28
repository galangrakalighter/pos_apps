import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'order_id', type: 'bigint' }) orderId!: string;
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: string;
  @Column({ name: 'nama_barang' }) namaBarang!: string;
  @Column({ name: 'jumlah_pesan', type: 'numeric', precision: 18, scale: 3, transformer: { to: (value: number) => value, from: (value: string) => Number(value) } }) jumlahPesan!: number;
  @Column({ name: 'satuan', length: 20 }) satuan!: string;
  @Column({ name: 'unit_price', type: 'numeric', precision: 18, scale: 2 }) unitPrice!: string;
  @Column({ name: 'line_total', type: 'numeric', precision: 18, scale: 2 }) lineTotal!: string;
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;
}
