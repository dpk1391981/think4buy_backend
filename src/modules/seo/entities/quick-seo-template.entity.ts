import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('quick_seo_templates')
export class QuickSeoTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 50 })
  categorySlug: string;

  @Column({ length: 300, default: '{category}-in-{city}-{locality}' })
  slugPattern: string;

  @Column({ length: 300, nullable: true })
  citySlugPattern: string;

  @Column({ default: false })
  includeCityPage: boolean;

  @Column({ default: true })
  showInFooter: boolean;

  // ── SEO template fields ───────────────────────────────────────────────────
  @Column({ length: 250, nullable: true })
  h1Title: string;

  @Column({ length: 250, nullable: true })
  metaTitle: string;

  @Column({ length: 500, nullable: true })
  metaDescription: string;

  @Column({ length: 300, nullable: true })
  metaKeywords: string;

  @Column({ length: 500, nullable: true })
  canonicalUrl: string;

  @Column({ type: 'text', nullable: true })
  introContent: string;

  @Column({ type: 'text', nullable: true })
  bottomContent: string;

  @Column({ type: 'json', nullable: true })
  faqJson: { question: string; answer: string }[];

  @Column({ length: 100, default: 'index,follow' })
  robots: string;

  // ── Usage tracking ────────────────────────────────────────────────────────
  @Column({ type: 'int', default: 0 })
  appliedCount: number;

  @Column({ type: 'datetime', nullable: true })
  lastAppliedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
