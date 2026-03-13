import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('seo_configs')
export class SeoConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  key: string; // e.g. 'site_title', 'site_description', 'og_image', 'twitter_handle'

  @Column({ type: 'text', nullable: true })
  value: string;

  @Column({ length: 200, nullable: true })
  label: string;

  @Column({ length: 500, nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
