import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ConfigValueType {
  BOOLEAN = 'boolean',
  STRING  = 'string',
  NUMBER  = 'number',
  JSON    = 'json',
}

/**
 * system_configs — DB-backed feature toggle and runtime config store.
 * Cached in Redis for sub-millisecond reads at scale.
 *
 * Key naming convention: SCREAMING_SNAKE_CASE, e.g.
 *   ENABLE_PROPERTY_VIDEO_UPLOAD
 *   ENABLE_DB_REPLICA
 *   MAX_IMAGES_PER_PROPERTY
 */
@Entity('system_configs')
export class SystemConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 100 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'enum', enum: ConfigValueType, default: ConfigValueType.BOOLEAN })
  valueType: ConfigValueType;

  @Column({ length: 500, nullable: true })
  description: string;

  @Column({ default: 'general' })
  group: string;

  @Column({ default: false })
  isSecret: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
