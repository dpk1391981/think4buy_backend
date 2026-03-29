import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Admin-managed table that drives the search query parser.
 * Each row maps a keyword/regex pattern → property type slug + optional category.
 * Both the FE instant-parser and BE smart-search service load from this table,
 * so adding a new property type here (e.g. "hotel") makes it searchable everywhere.
 */
@Entity('search_keyword_mappings')
export class SearchKeywordMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Regex pattern string (without /…/flags). Example: `hotel[s]?`
   * Matched case-insensitively with \b word boundaries in the parser.
   */
  @Column({ type: 'varchar', length: 255 })
  keyword: string;

  /**
   * PropType slug this keyword maps to (e.g. "hotel", "apartment").
   * Null when the keyword only sets a category.
   */
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'maps_to_type' })
  mapsToType: string | null;

  /**
   * Category slug inferred from this keyword (e.g. "commercial", "pg").
   * When set, overrides the category auto-inference from type group.
   */
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'maps_to_category' })
  mapsToCategory: string | null;

  /** Human-readable label shown in search chips / admin UI. E.g. "Hotel" */
  @Column({ type: 'varchar', length: 100 })
  label: string;

  /**
   * Evaluation order — lower = checked first.
   * Multi-word patterns must have lower sortOrder than single-word fallbacks.
   */
  @Column({ type: 'int', default: 100, name: 'sort_order' })
  sortOrder: number;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
