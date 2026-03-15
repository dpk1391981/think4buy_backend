import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index, Unique,
} from 'typeorm';

@Entity('agent_feedback')
@Unique('uq_reviewer_agent', ['reviewerId', 'agentId'])   // one review per user per agent
@Index(['agentId', 'createdAt'])
export class AgentFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The agent being reviewed */
  @Column({ length: 36 })
  @Index()
  agentId: string;

  /** The user leaving the review */
  @Column({ length: 36 })
  reviewerId: string;

  /** Reviewer's display name (snapshot at submission) */
  @Column({ length: 100 })
  reviewerName: string;

  /** 1–5 star rating */
  @Column({ type: 'tinyint', unsigned: true })
  rating: number;

  /** Optional written review */
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
