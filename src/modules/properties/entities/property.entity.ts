import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PropertyImage } from './property-image.entity';
import { Amenity } from './amenity.entity';
import { Inquiry } from '../../inquiries/entities/inquiry.entity';

export enum PropertyType {
  APARTMENT = 'apartment',
  VILLA = 'villa',
  PLOT = 'plot',
  HOUSE = 'house',
  PENTHOUSE = 'penthouse',
  STUDIO = 'studio',
  COMMERCIAL_OFFICE = 'commercial_office',
  COMMERCIAL_SHOP = 'commercial_shop',
  COMMERCIAL_WAREHOUSE = 'commercial_warehouse',
  PG = 'pg',
  CO_LIVING = 'co_living',
  FACTORY = 'factory',
  LAND = 'land',
  BUILDER_FLOOR = 'builder_floor',
  FARM_HOUSE = 'farm_house',
  SHOWROOM = 'showroom',
  INDUSTRIAL_SHED = 'industrial_shed',
}

export enum PropertyCategory {
  BUY = 'buy',
  RENT = 'rent',
  PG = 'pg',
  COMMERCIAL = 'commercial',
  INDUSTRIAL = 'industrial',
  BUILDER_PROJECT = 'builder_project',
  INVESTMENT = 'investment',
}

export enum ListingUserType {
  OWNER = 'owner',
  AGENT = 'agent',
}

export enum PropertyStatus {
  ACTIVE     = 'active',
  UNDER_DEAL = 'under_deal',
  SOLD       = 'sold',
  RENTED     = 'rented',
  INACTIVE   = 'inactive',
  PENDING    = 'pending',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ListingPlan {
  FREE = 'free',
  BASIC = 'basic',       // paid - higher visibility
  PREMIUM = 'premium',   // paid - featured in search
  FEATURED = 'featured', // paid - homepage + top of results
}

export enum FurnishingStatus {
  FURNISHED = 'furnished',
  SEMI_FURNISHED = 'semi_furnished',
  UNFURNISHED = 'unfurnished',
}

export enum PossessionStatus {
  READY_TO_MOVE = 'ready_to_move',
  UNDER_CONSTRUCTION = 'under_construction',
}

@Entity('properties')
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  title: string;

  @Column({ unique: true, length: 250 })
  slug: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ length: 100 })
  type: string;

  @Column({ length: 100 })
  @Index()
  category: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  price: number;

  @Column({ length: 20, nullable: true })
  priceUnit: string; // per month, per sqft, total

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  area: number;

  @Column({ length: 20, nullable: true })
  areaUnit: string; // sqft, sqmt, acre

  @Column({ type: 'int', nullable: true })
  bedrooms: number;

  @Column({ type: 'int', nullable: true })
  bathrooms: number;

  @Column({ type: 'int', nullable: true })
  balconies: number;

  @Column({ type: 'int', nullable: true })
  totalFloors: number;

  @Column({ type: 'int', nullable: true })
  floorNumber: number;

  @Column({ type: 'int', nullable: true })
  parkingSpots: number;

  @Column({
    type: 'enum',
    enum: FurnishingStatus,
    nullable: true,
  })
  furnishingStatus: FurnishingStatus;

  @Column({
    type: 'enum',
    enum: PossessionStatus,
    default: PossessionStatus.READY_TO_MOVE,
  })
  possessionStatus: PossessionStatus;

  @Column({ nullable: true })
  possessionDate: Date;

  // Location
  @Column({ length: 100 })
  @Index()
  city: string;

  @Column({ length: 100 })
  @Index()
  locality: string;

  @Column({ length: 200, nullable: true })
  society: string;

  @Column({ length: 300, nullable: true })
  address: string;

  @Column({ length: 10, nullable: true })
  pincode: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  // Meta
  @Column({ type: 'enum', enum: PropertyStatus, default: PropertyStatus.ACTIVE })
  @Index()
  status: PropertyStatus;

  @Column({ type: 'datetime', nullable: true })
  statusUpdatedAt: Date;

  @Column({ nullable: true, length: 36 })
  statusUpdatedBy: string;   // userId who last changed status

  @Column({ type: 'text', nullable: true })
  statusNote: string;        // optional note on last status change

  @Column({ default: false })
  isDraft: boolean;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: false })
  isPremium: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: false })
  isNewProject: boolean;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  // ── Engagement counters (refreshed by cron every 30 min) ──────────────────

  /** Views tracked in the last 24 hours (rolling). */
  @Column({ type: 'int', default: 0 })
  viewsLast24h: number;

  /** Views tracked in the last 7 days (rolling). */
  @Column({ type: 'int', default: 0 })
  viewsLast7d: number;

  /** Inquiries in the last 24 hours (rolling). */
  @Column({ type: 'int', default: 0 })
  inquiriesLast24h: number;

  /** Inquiries in the last 7 days (rolling). */
  @Column({ type: 'int', default: 0 })
  inquiriesLast7d: number;

  /** Saves/favourites in the last 7 days (rolling). */
  @Column({ type: 'int', default: 0 })
  savesLast7d: number;

  // ── Pre-computed ranking scores (refreshed every 30 min) ─────────────────

  /** Composite listing score (0–1000). Used for relevance sort in feed. */
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  listingScore: number;

  /** Featured selection score (0–100). Used to rank within featured tab. */
  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0 })
  featuredScore: number;

  /**
   * Price-competitiveness score vs similar listings in same city+type (0–100).
   * Higher = more competitively priced (better deal for buyer).
   */
  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0 })
  dealScore: number;

  // ── Hot Deal / Trending tags (refreshed every 30 min) ─────────────────────

  /** True if this property qualifies as a hot deal based on recent activity. */
  @Column({ default: false })
  isHotDeal: boolean;

  /** True if trending (velocity-based: activity this week >> last week). */
  @Column({ default: false })
  isTrending: boolean;

  /**
   * When the hot/trending tag should automatically expire.
   * NULL = not hot/trending. Cron removes tags once expired.
   */
  @Column({ type: 'datetime', nullable: true })
  hotTagExpiresAt: Date | null;

  // Admin approval
  @Column({ type: 'enum', enum: ApprovalStatus, default: ApprovalStatus.PENDING })
  @Index()
  approvalStatus: ApprovalStatus;

  @Column({ nullable: true, length: 500 })
  rejectionReason: string;

  // Listing plan (paid promotion)
  @Column({ type: 'enum', enum: ListingPlan, default: ListingPlan.FREE })
  listingPlan: ListingPlan;

  @Column({ nullable: true })
  listingExpiresAt: Date;

  @Column({ nullable: true })
  boostExpiresAt: Date;

  @Column({ length: 50, nullable: true })
  reraNumber: string;

  @Column({ length: 100, nullable: true })
  builderName: string;

  // Age of property in years
  @Column({ type: 'int', nullable: true })
  propertyAge: number;

  // SEO
  @Column({ length: 200, nullable: true })
  metaTitle: string;

  @Column({ length: 500, nullable: true })
  metaDescription: string;

  // SEO indexing — false by default to avoid thin-content penalties on individual listings.
  // Admin can flip this to true for premium/high-quality properties worth indexing.
  @Column({ default: false })
  allowIndexing: boolean;

  // Listing user type
  @Column({ type: 'enum', enum: ListingUserType, default: ListingUserType.OWNER })
  listedBy: ListingUserType;

  // Agent & Agency reference (for agent listings)
  @Column({ nullable: true, length: 36 })
  agentId: string;

  @Column({ nullable: true, length: 36 })
  agencyId: string;

  // Brokerage info (for agents)
  @Column({ nullable: true, length: 100 })
  brokerage: string; // e.g., "1 Month", "2%", "Negotiable"

  // Brochure PDF URL — only applicable for builder_project category
  @Column({ nullable: true, length: 500 })
  brochureUrl: string;

  // Industrial-specific extra details stored as JSON
  @Column({ type: 'json', nullable: true })
  extraDetails: Record<string, any>; // { height, powerLoad, hasDock, hasRamp, parkingSpots }

  // Listing purpose within a category (buy or rent) — for commercial/mixed categories
  @Column({ nullable: true, length: 20 })
  listingType: string;

  // State field for location
  @Column({ nullable: true, length: 100 })
  state: string;

  // FK references to structured location tables (nullable, for DB-driven selection)
  @Column({ nullable: true, length: 36 })
  stateId: string;

  @Column({ nullable: true, length: 36 })
  cityId: string;

  @Column({ nullable: true, length: 36 })
  localityId: string;

  @ManyToOne(() => User, (user) => user.properties, { eager: false })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ nullable: true })
  ownerId: string;

  @OneToMany(() => PropertyImage, (image) => image.property, {
    cascade: true,
  })
  images: PropertyImage[];

  @ManyToMany(() => Amenity)
  @JoinTable({ name: 'property_amenities' })
  amenities: Amenity[];

  @OneToMany(() => Inquiry, (inquiry) => inquiry.property)
  inquiries: Inquiry[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
