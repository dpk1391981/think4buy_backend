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

@Entity('property_alerts')
export class PropertyAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ length: 150 })
  alertName: string;

  @Column({ nullable: true, length: 50 })
  category: string; // buy | rent | pg | commercial

  @Column({ nullable: true, length: 100 })
  city: string;

  @Column({ nullable: true, length: 150 })
  locality: string;

  @Column({ nullable: true, length: 100 })
  propertyType: string;

  @Column({ nullable: true, type: 'bigint' })
  minPrice: number;

  @Column({ nullable: true, type: 'bigint' })
  maxPrice: number;

  @Column({ nullable: true, type: 'int' })
  bedrooms: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 'daily', length: 20 })
  frequency: string; // instant | daily | weekly

  @Column({ nullable: true, type: 'timestamp' })
  lastTriggeredAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
