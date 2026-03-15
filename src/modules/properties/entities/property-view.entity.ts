import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Property } from './property.entity';

@Entity('property_views')
@Index(['propertyId', 'userId', 'viewedAt'])   // dedup check for logged-in
@Index(['propertyId', 'ipAddress', 'viewedAt']) // dedup check for guests
export class PropertyView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'property_id' })
  @Index()
  propertyId: string;

  @Column({ name: 'user_id', nullable: true })
  @Index()
  userId: string | null;

  @Column({ length: 50 })
  @Index()
  ipAddress: string;

  @Column({ length: 512, nullable: true })
  userAgent: string;

  @Column({ length: 100, nullable: true })
  sessionId: string;

  @Column({ length: 50, nullable: true })
  source: string;

  @Column({ length: 512, nullable: true })
  referrer: string;

  @Column({ length: 20, nullable: true })
  deviceType: string;

  @CreateDateColumn({ name: 'viewed_at' })
  @Index()
  viewedAt: Date;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;
}
