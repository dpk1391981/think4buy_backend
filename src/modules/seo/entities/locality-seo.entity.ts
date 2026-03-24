import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('locality_seo')
@Index(['citySlug', 'localitySlug'], { unique: true })
export class LocalitySeo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'city_slug', length: 150 })
  citySlug: string; // 'gurgaon'

  @Column({ name: 'city_name', length: 150 })
  cityName: string; // 'Gurgaon'

  @Column({ name: 'locality_slug', length: 150 })
  localitySlug: string; // 'sector-56'

  @Column({ name: 'locality_name', length: 150 })
  localityName: string; // 'Sector 56'

  /** URL slug: e.g. properties-in-gurgaon-sector-56 */
  @Column({ unique: true, length: 300 })
  slug: string;

  @Column({ name: 'h1_title', length: 250, nullable: true })
  h1Title: string;

  @Column({ name: 'meta_title', length: 250, nullable: true })
  metaTitle: string;

  @Column({ name: 'meta_description', length: 500, nullable: true })
  metaDescription: string;

  @Column({ name: 'meta_keywords', length: 300, nullable: true })
  metaKeywords: string;

  @Column({ name: 'canonical_url', length: 500, nullable: true })
  canonicalUrl: string;

  @Column({ name: 'intro_content', type: 'text', nullable: true })
  introContent: string;

  @Column({ name: 'bottom_content', type: 'text', nullable: true })
  bottomContent: string;

  @Column({ name: 'faq_json', type: 'json', nullable: true })
  faqJson: { question: string; answer: string }[];

  @Column({ name: 'internal_links', type: 'json', nullable: true })
  internalLinks: { label: string; url: string }[];

  @Column({ length: 100, nullable: true, default: 'index,follow' })
  robots: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
