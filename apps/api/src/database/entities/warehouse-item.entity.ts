import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('warehouse')
export class WarehouseItem {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ name: 'nama_bumbu' }) namaBumbu!: string;
  @Column({ type: 'int' }) stock!: number;
  @Column() tipe!: string;
  @Column({ type: 'numeric', precision: 18, scale: 2 }) harga!: string;
  @Column({ name: 'image_url', type: 'text', nullable: true }) imageUrl!: string | null;
}
