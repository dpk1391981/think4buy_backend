import {
  Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column,
} from 'typeorm';
import { PropType } from './prop-type.entity';
import { Amenity } from '../../properties/entities/amenity.entity';

@Entity('prop_type_amenities')
export class PropTypeAmenity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'propTypeId', length: 36 })
  propTypeId: string;

  @ManyToOne(() => PropType, (t) => t.typeAmenities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'propTypeId' })
  propType: PropType;

  @Column({ name: 'amenityId', length: 36 })
  amenityId: string;

  @ManyToOne(() => Amenity, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'amenityId' })
  amenity: Amenity;
}
