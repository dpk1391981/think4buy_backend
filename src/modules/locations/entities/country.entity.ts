import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { State } from './state.entity';

@Entity('countries')
export class Country {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  name: string;

  @Column({ unique: true, length: 3 })
  code: string; // ISO 3166-1 alpha-2/3: IN, US, AE, UK, AU

  @Column({ nullable: true, length: 10 })
  dialCode: string; // +91, +1, +971

  @Column({ nullable: true, length: 10 })
  flag: string; // emoji flag: 🇮🇳

  @Column({ nullable: true, length: 500 })
  imageUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @OneToMany(() => State, (state) => state.country)
  states: State[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
