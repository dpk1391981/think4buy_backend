import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { PropType } from './prop-type.entity';

@Entity('prop_categories')
export class PropCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100, unique: true })
  slug: string;

  @Column({ length: 10, nullable: true })
  icon: string;

  @Column({ length: 500, nullable: true })
  description: string;

  @Column({ default: true })
  status: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => PropType, (t) => t.category, { cascade: true })
  propertyTypes: PropType[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
