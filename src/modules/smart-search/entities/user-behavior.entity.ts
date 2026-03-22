import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

export enum BehaviorEventType {
  VIEW        = 'view',
  LONG_STAY   = 'long_stay',   // stayed > 30s on property page
  WISHLIST    = 'wishlist',
  CONTACT     = 'contact',     // clicked phone / whatsapp
  INQUIRY     = 'inquiry',
  SCROLL_DEEP = 'scroll_deep', // scrolled 70%+
  IMAGE_CLICK = 'image_click',
  SHARE       = 'share',
}

/** Lead score awarded for each event type */
export const BEHAVIOR_SCORES: Record<BehaviorEventType, number> = {
  [BehaviorEventType.VIEW]:        1,
  [BehaviorEventType.LONG_STAY]:   3,
  [BehaviorEventType.WISHLIST]:    5,
  [BehaviorEventType.CONTACT]:    10,
  [BehaviorEventType.INQUIRY]:    10,
  [BehaviorEventType.SCROLL_DEEP]: 2,
  [BehaviorEventType.IMAGE_CLICK]: 1,
  [BehaviorEventType.SHARE]:       2,
};

/** Threshold — if aggregate score >= this value → HOT LEAD */
export const HOT_LEAD_THRESHOLD = 10;

@Entity('user_behavior')
@Index('idx_user_behavior_user', ['userId'])
@Index('idx_user_behavior_property', ['propertyId'])
@Index('idx_user_behavior_session', ['sessionId'])
export class UserBehavior {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Logged-in user ID — null for anonymous */
  @Column({ length: 36, nullable: true })
  @Index()
  userId: string;

  /** Property that triggered the event */
  @Column({ length: 36 })
  @Index()
  propertyId: string;

  @Column({ type: 'enum', enum: BehaviorEventType })
  eventType: BehaviorEventType;

  /** Duration in seconds (for LONG_STAY, VIEW) */
  @Column({ type: 'int', nullable: true })
  duration: number;

  /** Score awarded for this specific event */
  @Column({ type: 'int', default: 0 })
  score: number;

  /** Cumulative score for this user × property (updated on each new event) */
  @Column({ type: 'int', default: 0 })
  cumulativeScore: number;

  /** Session ID for anonymous tracking */
  @Column({ length: 100, nullable: true })
  sessionId: string;

  @Column({ length: 50, nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  createdAt: Date;
}
