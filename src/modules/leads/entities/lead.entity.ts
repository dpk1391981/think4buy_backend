import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

export enum LeadSource {
  PROPERTY_PAGE = 'property_page',
  VIEW_PHONE = 'view_phone',
  SCHEDULE_VISIT = 'schedule_visit',
  DOWNLOAD_BROCHURE = 'download_brochure',
  CHATBOT = 'chatbot',
  SEO_FORM = 'seo_form',
  FIND_PROPERTY = 'find_property',
  PROPERTY_ALERT = 'property_alert',
  SEARCH = 'search',
  CONTACT_FORM = 'contact_form',
  ENQUIRY = 'enquiry',
  CALL = 'call',
  WHATSAPP = 'whatsapp',
  CAMPAIGN = 'campaign',
  PORTAL_IMPORT = 'portal_import',
  WALKIN = 'walkin',
  MANUAL = 'manual',
}

export enum LeadTemperature {
  HOT = 'hot',
  WARM = 'warm',
  COLD = 'cold',
}

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  FOLLOW_UP = 'follow_up',
  SITE_VISIT_SCHEDULED = 'site_visit_scheduled',
  SITE_VISIT_COMPLETED = 'site_visit_completed',
  NEGOTIATION = 'negotiation',
  DEAL_IN_PROGRESS = 'deal_in_progress',
  DEAL_WON = 'deal_won',
  DEAL_LOST = 'deal_lost',
  DUPLICATE = 'duplicate',
  JUNK = 'junk',
}

export enum LeadPropertyType {
  RESIDENTIAL = 'residential',
  COMMERCIAL = 'commercial',
  PLOT = 'plot',
  RENTAL = 'rental',
}

@Entity('leads')
@Index('idx_lead_dedup', ['contactPhone', 'propertyId', 'createdAt'])
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: LeadSource, default: LeadSource.MANUAL })
  source: LeadSource;

  @Column({ length: 255, nullable: true })
  sourceRef: string;

  @Column({ length: 36, nullable: true })
  @Index()
  propertyId: string;

  @Column({ length: 100 })
  contactName: string;

  @Column({ length: 20 })
  @Index()
  contactPhone: string;

  @Column({ length: 150, nullable: true })
  contactEmail: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ length: 100, nullable: true })
  state: string;

  @Column({ length: 36, nullable: true })
  cityId: string;

  @Column({ type: 'enum', enum: LeadPropertyType, nullable: true })
  propertyType: LeadPropertyType;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  budgetMin: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  budgetMax: number;

  @Column({ length: 100, nullable: true })
  locality: string;

  @Column({ length: 36, nullable: true })
  @Index()
  localityId: string;

  @Column({ length: 20, nullable: true })
  propertyFor: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  areaMin: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  areaMax: number;

  @Column({ length: 20, nullable: true })
  areaUnit: string;

  @Column({ length: 20, nullable: true })
  userType: string;

  @Column({ type: 'text', nullable: true })
  preferredLocalities: string;

  @Column({ type: 'text', nullable: true })
  requirement: string;

  @Column({ type: 'int', default: 0 })
  leadScore: number;

  @Column({ type: 'enum', enum: LeadTemperature, default: LeadTemperature.COLD })
  temperature: LeadTemperature;

  @Column({ type: 'enum', enum: LeadStatus, default: LeadStatus.NEW })
  @Index()
  status: LeadStatus;

  @Column({ length: 36, nullable: true })
  duplicateOfId: string;

  @Column({ length: 36, nullable: true })
  @Index()
  assignedAgentId: string;

  @Column({ length: 36, nullable: true })
  agencyId: string;

  @Column({ type: 'text', nullable: true })
  lostReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // ── Tracking / UTM fields ──────────────────────────────────────────────────
  @Column({ length: 100, nullable: true })
  utmSource: string;

  @Column({ length: 100, nullable: true })
  utmMedium: string;

  @Column({ length: 100, nullable: true })
  utmCampaign: string;

  @Column({ length: 100, nullable: true })
  sessionId: string;

  @Column({ length: 50, nullable: true })
  deviceType: string;

  /** Logged-in user who submitted this lead (links back to buyer account) */
  @Column({ length: 36, nullable: true })
  contactUserId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
