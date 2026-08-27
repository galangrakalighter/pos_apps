import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() username!: string;
  @Column() password!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) wilayah!: string | null;
  @Column({ name: 'nama_mitra' }) namaMitra!: string;
  @Column({ name: 'isPusat' }) isPusat!: boolean;
  @Column({ name: 'is_locked' }) isLocked!: boolean;
}
