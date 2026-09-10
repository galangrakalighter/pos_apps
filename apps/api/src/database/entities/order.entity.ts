import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'pending',
  DITERIMA = 'diterima',
  DIKIRIM = 'dikirim',
  SELESAI = 'selesai',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'pemesan_id', type: 'uuid' }) pemesanId!: string;
  @Column({ name: 'pemberi_id', type: 'uuid' }) pemberiId!: string;
  @Column({ type: 'enum', enum: OrderStatus }) status!: OrderStatus;
  @Column({ name: 'total_amount', type: 'numeric', precision: 18, scale: 2 }) totalAmount!: string;
  @Column({ name: 'payment_method', type: 'varchar', length: 10, default: 'tunai' }) paymentMethod!: 'tunai' | 'qris';
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  @Column({ name: 'stock_applied_at', type: 'timestamptz', nullable: true }) stockAppliedAt!: Date | null;
  @OneToMany(() => OrderItem, (item) => item.order) items!: OrderItem[];
}
