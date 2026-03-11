import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ServiceType {
  HOME_LOAN = 'home_loan',
  LEGAL = 'legal',
  INTERIOR = 'interior',
  PACKERS_MOVERS = 'packers_movers',
  VASTU = 'vastu',
  PROPERTY_MANAGEMENT = 'property_management',
  RENTAL_AGREEMENT = 'rental_agreement',
  INSURANCE = 'insurance',
}

@Entity('services_catalog')
export class ServiceCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, length: 100 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 200, nullable: true })
  icon: string;

  @Column({ length: 200, nullable: true })
  bannerImage: string;

  @Column({ type: 'enum', enum: ServiceType })
  type: ServiceType;

  @Column({ length: 500, nullable: true })
  ctaUrl: string;

  @Column({ length: 100, nullable: true })
  ctaText: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  // For future partner integrations (like MagicBricks partners)
  @Column({ length: 200, nullable: true })
  partnerName: string;

  @Column({ length: 500, nullable: true })
  partnerApiUrl: string;

  @Column({ type: 'json', nullable: true })
  config: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
