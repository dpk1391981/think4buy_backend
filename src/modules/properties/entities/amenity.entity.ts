import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum AmenityCategory {
  BASIC = 'basic',
  SOCIETY = 'society',
  SECURITY = 'security',
  RECREATION = 'recreation',
  COMMERCIAL = 'commercial',
}

@Entity('amenities')
export class Amenity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100, nullable: true })
  icon: string;

  @Column({
    type: 'enum',
    enum: AmenityCategory,
    default: AmenityCategory.BASIC,
  })
  category: AmenityCategory;
}
