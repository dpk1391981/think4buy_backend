import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum FilterWidgetType {
  PRICE_RANGE     = 'price_range',
  BEDROOM_SELECT  = 'bedroom_select',
  PROPERTY_TYPE   = 'property_type',
  AREA_RANGE      = 'area_range',
  OPTION_SELECT   = 'option_select',
  AMENITY_PICKER  = 'amenity_picker',
  TEXT_INPUT      = 'text_input',
  TOGGLE_BOOLEAN  = 'toggle_boolean',
}

export interface FilterOption {
  value: string;
  label: string;
}

@Entity('listing_filter_configs')
export class ListingFilterConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** URL query-param key, e.g. "bedrooms", "minPrice", "furnishingStatus" */
  @Column({ length: 80 })
  filterKey: string;

  /** Human label shown in the sidebar */
  @Column({ length: 120 })
  label: string;

  /** Optional icon (emoji or lucide icon name) */
  @Column({ length: 40, nullable: true })
  icon: string | null;

  /** How this filter is rendered */
  @Column({ type: 'enum', enum: FilterWidgetType, default: FilterWidgetType.OPTION_SELECT })
  widgetType: FilterWidgetType;

  /**
   * JSON array of {value, label} for option_select / toggle_boolean.
   * Null for price_range, area_range, bedroom_select, property_type, amenity_picker.
   */
  @Column({ type: 'json', nullable: true })
  optionsJson: FilterOption[] | null;

  /**
   * Category slugs this filter applies to.
   * Empty array = show for ALL categories.
   */
  @Column({ type: 'json', nullable: true })
  categories: string[];

  /** Whether this filter section is expanded by default */
  @Column({ default: false })
  defaultOpen: boolean;

  /** Show in mobile filter drawer */
  @Column({ default: true })
  showOnMobile: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
