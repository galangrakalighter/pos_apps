import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('produk_mitra')
export class PartnerProduct {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'mitra_id', type: 'uuid' }) mitraId!: string;
  @Column({ name: 'nama_produk' }) namaProduk!: string;
  @Column({ name: 'jenis_produk', type: 'varchar', length: 20, default: 'bahan_baku' }) jenisProduk!: 'bahan_baku' | 'produk_jadi';
  @Column({ type: 'varchar', length: 100, nullable: true }) kategori!: string | null;
  @Column({ name: 'image_url', type: 'text', nullable: true }) imageUrl!: string | null;
  @Column({ name: 'master_produk_id', type: 'bigint', nullable: true }) masterProdukId!: string | null;
  @Column({ type: 'numeric', precision: 18, scale: 3 }) stock!: string;
  @Column({ type: 'numeric', precision: 18, scale: 2 }) harga!: string;
}
