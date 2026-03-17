import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Property } from './property.entity';

@Entity('property_status_history')
export class PropertyStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'propertyId' })
  property: Property;

  @Column({ nullable: true, length: 50 })
  oldStatus: string;

  @Column({ length: 50 })
  newStatus: string;

  @Column({ nullable: true, length: 36 })
  updatedBy: string; // userId who made the change

  @Column({ nullable: true, length: 50 })
  updatedByRole: string; // 'owner' | 'agent' | 'admin'

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
}
