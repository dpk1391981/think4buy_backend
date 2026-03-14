import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export enum ArticleCategory {
  NEWS = 'news',
  TIPS = 'tips',
  MARKET = 'market-insights',
  GUIDES = 'guides',
  LEGAL = 'legal',
  INVESTMENT = 'investment',
}

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Core content ──────────────────────────────────────────────────────────

  @Column({ length: 300 })
  title: string;

  @Column({ length: 350, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  excerpt: string;

  @Column({ type: 'longtext' })
  content: string;

  // ── Media ─────────────────────────────────────────────────────────────────

  @Column({ length: 500, nullable: true })
  featuredImage: string;

  @Column({ type: 'json', nullable: true })
  gallery: string[];

  // ── Taxonomy ──────────────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: ArticleCategory, default: ArticleCategory.NEWS })
  category: ArticleCategory;

  @Column({ type: 'json', nullable: true })
  tags: string[];

  // ── Publishing ────────────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: ArticleStatus, default: ArticleStatus.DRAFT })
  status: ArticleStatus;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ type: 'int', nullable: true })
  readTime: number;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date;

  // ── Author ────────────────────────────────────────────────────────────────

  @Column({ nullable: true })
  authorId: string;

  @ManyToOne(() => User, { nullable: true, eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  // ── SEO ───────────────────────────────────────────────────────────────────

  @Column({ length: 200, nullable: true })
  metaTitle: string;

  @Column({ length: 500, nullable: true })
  metaDescription: string;

  @Column({ length: 500, nullable: true })
  metaKeywords: string;

  @Column({ length: 500, nullable: true })
  ogImage: string;

  @Column({ length: 500, nullable: true })
  canonicalUrl: string;

  // ── Timestamps ────────────────────────────────────────────────────────────

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
