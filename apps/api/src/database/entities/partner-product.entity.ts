import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('produk_mitra')
export class PartnerProduct {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'mitra_id', type: 'uuid' }) mitraId!: string;
  @Column({ name: 'nama_produk' }) namaProduk!: string;
  @Column({ type: 'int' }) stock!: number;
  @Column({ type: 'numeric', precision: 18, scale: 2 }) harga!: string;
}
