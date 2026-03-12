import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AnalyticsEventType {
  // Property events
  PROPERTY_VIEW      = 'property_view',
  PROPERTY_CLICK     = 'property_click',
  PROPERTY_SAVE      = 'property_save',
  PROPERTY_INQUIRY   = 'property_inquiry',
  // Search events
  SEARCH_QUERY       = 'search_query',
  SEARCH_LOCATION    = 'search_location',
  // Agent events
  AGENT_PROFILE_VIEW = 'agent_profile_view',
  AGENT_CONTACT      = 'agent_contact_click',
  // Project events
  PROJECT_VIEW       = 'project_view',
  PROJECT_INQUIRY    = 'project_inquiry',
  // Location events
  CITY_VIEW          = 'city_view',
  STATE_VIEW         = 'state_view',
  LOCALITY_SEARCH    = 'locality_search',
}

export enum AnalyticsEntityType {
  PROPERTY = 'property',
  AGENT    = 'agent',
  PROJECT  = 'project',
  CITY     = 'city',
  STATE    = 'state',
  SEARCH   = 'search',
}

export enum DeviceType {
  MOBILE  = 'mobile',
  DESKTOP = 'desktop',
  TABLET  = 'tablet',
}

export enum AnalyticsSource {
  HOME_PAGE      = 'home_page',
  SEARCH         = 'search',
  RECOMMENDATION = 'recommendation',
  DIRECT         = 'direct',
  CATEGORY       = 'category',
}

@Entity('analytics_events')
@Index(['eventType', 'createdAt'])
@Index(['entityType', 'entityId', 'createdAt'])
@Index(['country', 'state', 'city', 'createdAt'])
@Index(['createdAt'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  eventType: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  entityType: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  @Index()
  entityId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sessionId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  state: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  city: string;

  @Column({ type: 'varchar', length: 20, nullable: true, default: 'desktop' })
  deviceType: string;

  @Column({ type: 'varchar', length: 30, nullable: true, default: 'direct' })
  source: string;

  // Extra context: search query, filters used, property type searched, etc.
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
