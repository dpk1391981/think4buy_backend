import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('search_logs')
@Index('idx_search_logs_user', ['userId'])
@Index('idx_search_logs_created', ['createdAt'])
export class SearchLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Logged-in user ID (null for guests) */
  @Column({ length: 36, nullable: true })
  @Index()
  userId: string;

  /** Raw query string typed by user */
  @Column({ type: 'text' })
  searchQuery: string;

  /** JSON of parsed filters extracted from keyword */
  @Column({ type: 'json', nullable: true })
  parsedFilters: Record<string, any>;

  /** User's latitude at time of search (for geo context) */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  /** User's longitude at time of search */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  /** Number of results returned */
  @Column({ type: 'int', default: 0 })
  resultCount: number;

  /** Session identifier (for grouping anonymous searches) */
  @Column({ length: 100, nullable: true })
  sessionId: string;

  /** Client IP */
  @Column({ length: 50, nullable: true })
  ipAddress: string;

  /** User agent string */
  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}
