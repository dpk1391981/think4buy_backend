import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { PropCategory } from './prop-category.entity';
import { PropTypeAmenity } from './prop-type-amenity.entity';
import { PropTypeField } from './prop-type-field.entity';

@Entity('prop_types')
export class PropType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100 })
  slug: string;

  @Column({ length: 10, nullable: true })
  icon: string;

  @Column({ default: true })
  status: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  /**
   * If set, this type is an alias for the canonical type with this slug.
   * e.g. "flat" and "builder_floor" may both have aliasOf = "apartment"
   * so searches for any of them return the full group.
   */
  @Column({ length: 100, nullable: true, default: null })
  aliasOf: string | null;

  @ManyToOne(() => PropCategory, (c) => c.propertyTypes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: PropCategory;

  @Column({ length: 36 })
  categoryId: string;

  @OneToMany(() => PropTypeAmenity, (a) => a.propType, { cascade: true })
  typeAmenities: PropTypeAmenity[];

  @OneToMany(() => PropTypeField, (f) => f.propType, { cascade: true })
  fields: PropTypeField[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
