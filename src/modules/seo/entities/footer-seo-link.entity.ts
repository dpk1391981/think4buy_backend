import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('footer_seo_link_groups')
export class FooterSeoLinkGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('footer_seo_links')
export class FooterSeoLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  groupId: string;

  @ManyToOne(() => FooterSeoLinkGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: FooterSeoLinkGroup;

  @Column({ length: 200 })
  label: string;

  @Column({ length: 500 })
  url: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
