import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  @Index()
  city: string;

  @Column({ length: 100 })
  state: string;

  @Column({ length: 100, nullable: true })
  locality: string;

  @Column({ length: 10, nullable: true })
  pincode: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  propertyCount: number;
}
