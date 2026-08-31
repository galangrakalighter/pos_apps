import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('history')
export class History {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'uuid', unique: true }) uuid!: string;
  @Column({ name: 'mitra_id', type: 'uuid' }) mitraId!: string;
  @Column({ name: 'id_produk', type: 'bigint' }) productId!: string;
  @Column({ type: 'int' }) terjual!: number;
  @Column({ type: 'numeric', precision: 18, scale: 2 }) harga!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ type: 'text', nullable: true }) keterangan!: string | null;
  @Column({ name: 'synced_at', type: 'timestamptz' }) syncedAt!: Date;
  @Column({ name: 'stock_applied_at', type: 'timestamptz', nullable: true }) stockAppliedAt!: Date | null;
  @Column({ name: 'transaction_uuid', type: 'uuid' }) transactionUuid!: string;
  @Column({ name: 'payment_method', length: 20 }) paymentMethod!: string;
  @Column({ name: 'amount_paid', type: 'numeric', precision: 18, scale: 2 }) amountPaid!: string;
  @Column({ name: 'change_amount', type: 'numeric', precision: 18, scale: 2 }) changeAmount!: string;
  @Column({ name: 'transaction_total', type: 'numeric', precision: 18, scale: 2 }) transactionTotal!: string;
}
