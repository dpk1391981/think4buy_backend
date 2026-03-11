import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { City } from './city.entity';
import { Country } from './country.entity';

@Entity('states')
export class State {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true, length: 10 })
  code: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  propertyCount: number;

  @Column({ nullable: true, length: 500 })
  imageUrl: string;

  @Column({ nullable: true })
  countryId: string;

  @ManyToOne(() => Country, (country) => country.states, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'countryId' })
  country: Country;

  @OneToMany(() => City, (city) => city.state)
  cities: City[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
