import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('footer_seo_link_groups')
export class FooterSeoLinkGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  title: string;

  @Column({ length: 36, nullable: true })
  cityId: string;

  @Column({ length: 150, nullable: true })
  cityName: string;

  // e.g. 'buy' | 'rent' | 'flats' | 'flats-rent' | 'villas' | 'plots' | 'commercial' | 'office' | 'new-projects' | 'pg'
  @Column({ length: 50, nullable: true })
  category: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('footer_seo_links')
export class FooterSeoLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  groupId: string;

  @ManyToOne(() => FooterSeoLinkGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: FooterSeoLinkGroup;

  @Column({ length: 200 })
  label: string;

  @Column({ length: 500 })
  url: string;

  @Column({ length: 36, nullable: true })
  localityId: string;

  @Column({ length: 150, nullable: true })
  localityName: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  // ── SEO Meta ──────────────────────────────────────────────────────────────
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
