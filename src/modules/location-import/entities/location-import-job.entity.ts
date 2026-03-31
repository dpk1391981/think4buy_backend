import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

@Entity('location_import_jobs')
export class LocationImportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: ImportJobStatus;

  @Column({ nullable: true })
  fileName: string;

  @Column({ nullable: true })
  fileType: string; // xlsx | xls | csv

  @Column({ nullable: true, type: 'text' })
  filePath: string;

  @Column({ type: 'simple-json', nullable: true })
  options: {
    geocode: boolean;
    forceGeocode: boolean;
    dryRun: boolean;
    fileFilter: string;
  };

  @Column({ default: 0 })
  progress: number; // 0–100

  @Column({ default: 0 })
  totalRows: number;

  @Column({ default: 0 })
  processedRows: number;

  @Column({ default: 0 })
  citiesInserted: number;

  @Column({ default: 0 })
  citiesUpdated: number;

  @Column({ default: 0 })
  localitiesInserted: number;

  @Column({ default: 0 })
  localitiesUpdated: number;

  @Column({ default: 0 })
  localitiesUnchanged: number;

  @Column({ type: 'longtext', nullable: true })
  logOutput: string;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string;

  @Column({ nullable: true, type: 'datetime' })
  startedAt: Date;

  @Column({ nullable: true, type: 'datetime' })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
