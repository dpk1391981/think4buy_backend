import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ServiceCatalog } from './service-catalog.entity';

export enum ServiceLeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  CLOSED = 'closed',
}

@Entity('service_leads')
@Index('idx_slead_phone', ['phone'])
@Index('idx_slead_service', ['serviceId'])
@Index('idx_slead_status', ['status'])
export class ServiceLead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  @Index()
  serviceId: string;

  @ManyToOne(() => ServiceCatalog, { eager: false, nullable: true })
  @JoinColumn({ name: 'serviceId' })
  service: ServiceCatalog;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 150, nullable: true })
  email: string;

  /** City or state provided by the user */
  @Column({ length: 100, nullable: true })
  location: string;

  /** Service-specific interest, e.g. "2 BHK interior", "₹50L loan" */
  @Column({ length: 255, nullable: true })
  interest: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  /** "web" | "mobile" */
  @Column({ length: 20, default: 'web' })
  source: string;

  @Column({
    type: 'enum',
    enum: ServiceLeadStatus,
    default: ServiceLeadStatus.NEW,
  })
  status: ServiceLeadStatus;

  /** Free-form admin note for follow-up */
  @Column({ type: 'text', nullable: true })
  adminNote: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
