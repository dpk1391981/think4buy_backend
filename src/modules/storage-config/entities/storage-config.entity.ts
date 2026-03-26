import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Key-value store for storage & watermark settings.
 * Keys used:
 *   s3_enabled        – '1' | '0'
 *   s3_region         – e.g. 'ap-south-1'
 *   s3_bucket         – bucket name
 *   s3_access_key     – AWS access key ID
 *   s3_secret_key     – AWS secret access key
 *   s3_cdn_url        – optional CDN prefix (e.g. https://cdn.example.com)
 *   watermark_enabled – '1' | '0'
 *   watermark_text    – text to burn into images (e.g. 'think4buysale.com')
 */
@Entity('storage_configs')
export class StorageConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 80 })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
