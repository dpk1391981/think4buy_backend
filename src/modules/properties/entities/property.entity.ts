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
  ACTIVE = 'active',
  SOLD = 'sold',
  RENTED = 'rented',
  INACTIVE = 'inactive',
  PENDING = 'pending',
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

  @Column({ type: 'enum', enum: PropertyType })
  type: PropertyType;

  @Column({ type: 'enum', enum: PropertyCategory })
  @Index()
  category: PropertyCategory;

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

  // Industrial-specific extra details stored as JSON
  @Column({ type: 'json', nullable: true })
  extraDetails: Record<string, any>; // { height, powerLoad, hasDock, hasRamp, parkingSpots }

  // State field for location
  @Column({ nullable: true, length: 100 })
  state: string;

  // FK references to structured location tables (nullable, for DB-driven selection)
  @Column({ nullable: true, length: 36 })
  stateId: string;

  @Column({ nullable: true, length: 36 })
  cityId: string;

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
