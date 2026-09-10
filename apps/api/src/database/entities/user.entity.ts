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
  @Column({ name: 'profile_image_url', type: 'text', nullable: true }) profileImageUrl!: string | null;
  @Column({ type: 'varchar', length: 254, nullable: true }) email!: string | null;
}
