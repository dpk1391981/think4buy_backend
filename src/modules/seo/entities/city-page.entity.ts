import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum CityPageType {
  BUY = 'buy',
  RENT = 'rent',
  PG = 'pg',
  COMMERCIAL = 'commercial',
  NEW_PROJECTS = 'new_projects',
}

@Entity('city_seo_pages')
export class CityPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  cityName: string;

  @Column({ length: 36, nullable: true })
  cityId: string;

  @Column({ type: 'enum', enum: CityPageType })
  pageType: CityPageType;

  @Column({ unique: true, length: 300 })
  slug: string; // e.g. buy-property-in-mumbai

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

  @Column({ type: 'json', nullable: true })
  faqs: { question: string; answer: string }[];

  @Column({ type: 'text', nullable: true })
  seoContent: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
