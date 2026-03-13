import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { State } from './state.entity';

@Entity('cities')
export class City {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => State, (state) => state.cities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'state_id' })
  state: State;

  @Column({ name: 'state_id' })
  stateId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: 0 })
  propertyCount: number;

  @Column({ nullable: true })
  imageUrl: string;

  // SEO fields
  @Column({ length: 150, nullable: true })
  slug: string; // e.g. 'mumbai', 'bangalore'

  @Column({ length: 200, nullable: true })
  h1: string;

  @Column({ length: 200, nullable: true })
  metaTitle: string;

  @Column({ length: 500, nullable: true })
  metaDescription: string;

  @Column({ length: 300, nullable: true })
  metaKeywords: string;

  @Column({ type: 'text', nullable: true })
  introContent: string;

  @Column({ type: 'text', nullable: true })
  seoContent: string;

  @Column({ type: 'json', nullable: true })
  faqs: { question: string; answer: string }[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
