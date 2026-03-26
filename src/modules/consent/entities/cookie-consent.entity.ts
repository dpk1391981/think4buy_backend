import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum ConsentSource {
  BANNER   = 'banner',
  MODAL    = 'modal',
  SETTINGS = 'settings',
}

/**
 * Stores the current cookie consent preferences per user or anonymous session.
 * One row per user (upserted). Append-only audit trail is kept via updatedAt.
 *
 * Compliant with India DPDP Act 2023 and GDPR principles:
 * - Records who consented, when, from which source, and which version of the policy.
 * - Essential is always true and non-negotiable.
 * - consentVersion enables re-consent flows when the policy changes.
 */
@Entity('cookie_consents')
@Index(['userId'])
@Index(['sessionId'])
@Index(['createdAt'])
export class CookieConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Null for anonymous (guest) users; populated once user logs in. */
  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  /** Browser session ID (from sessionStorage _asid) — links anonymous consent to analytics. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  sessionId: string | null;

  /** IPv4 or IPv6. Stored for audit / DPDP compliance. Max 45 chars covers IPv6. */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  /** Raw User-Agent string. Stored for compliance audit only. */
  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  // ── Consent flags ────────────────────────────────────────────────────────

  /** Always true — cannot be withdrawn. Login, shortlist, session security. */
  @Column({ type: 'boolean', default: true })
  essential: boolean;

  /**
   * Personalization consent.
   * Covers: saved searches, preferred city/budget/type, property recommendations,
   * saved properties, property alerts.
   */
  @Column({ type: 'boolean', default: false })
  personalization: boolean;

  /**
   * Analytics consent (first-party only — no third-party SDKs integrated).
   * Covers: property_view, search_query, agent_profile_view, smart-search behavior
   * events, property-view dedup tracking, search logs.
   */
  @Column({ type: 'boolean', default: false })
  analytics: boolean;

  /**
   * Marketing consent.
   * Currently no third-party pixels are active.
   * Future use: Meta Pixel, Google Ads remarketing, ad network retargeting.
   */
  @Column({ type: 'boolean', default: false })
  marketing: boolean;

  // ── Audit metadata ───────────────────────────────────────────────────────

  /**
   * Policy version at the time of consent.
   * Increment this (e.g. '1.1', '2.0') whenever the cookie policy changes materially.
   * Frontend re-shows the banner if stored version < current version.
   */
  @Column({ type: 'varchar', length: 10, default: '1.0' })
  consentVersion: string;

  /** Where the user made the decision: banner, modal, or footer settings. */
  @Column({
    type: 'enum',
    enum: ConsentSource,
    default: ConsentSource.BANNER,
  })
  source: ConsentSource;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
