import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * SEO config for Agent Listing pages by city.
 * e.g. city=noida → "/agents-in-noida" page SEO
 */
@Entity('agent_city_seo')
@Index(['citySlug'], { unique: true })
export class AgentCitySeo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'city_slug', length: 150 })
  citySlug: string; // 'noida', 'new-delhi'

  @Column({ name: 'city_name', length: 150 })
  cityName: string; // 'Noida', 'New Delhi'

  /** URL slug: e.g. agents-in-noida */
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

  @Column({ name: 'og_title', length: 250, nullable: true })
  ogTitle: string;

  @Column({ name: 'og_description', length: 500, nullable: true })
  ogDescription: string;

  @Column({ name: 'og_image', length: 500, nullable: true })
  ogImage: string;

  @Column({ name: 'schema_json', type: 'text', nullable: true })
  schemaJson: string;

  @Column({ length: 100, nullable: true, default: 'index,follow' })
  robots: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
