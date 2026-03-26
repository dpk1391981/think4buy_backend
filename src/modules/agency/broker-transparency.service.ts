import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentFeedback } from '../agent-feedback/entities/agent-feedback.entity';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentTrustInput {
  /** From users.totalDeals */
  totalDeals: number;
  /** From users.agentRating (0–5). 0 = no rating yet. */
  rating: number;
  /** Total review count — fetched from agent_feedback */
  totalReviews: number;
  /** Avg response hours. null = not measured. */
  avgResponseHours: number | null;
  /** Formal complaints count */
  complaintCount: number;
  /** 0–100 profile completeness score */
  profileScore: number;
}

export interface TrustRating    { value: number; text: string }
export interface TrustDeals     { count: number; text: string }
export interface TrustResponse  { value: string; text: string }
export interface TrustComplaints { count: number; text: string }

export interface BrokerTransparencyProfile {
  label: string;
  rating: TrustRating;
  deals: TrustDeals;
  response_time: TrustResponse;
  complaints: TrustComplaints;
  trust_badges: string[];
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class BrokerTransparencyService {
  constructor(
    @InjectRepository(AgentFeedback)
    private readonly feedbackRepo: Repository<AgentFeedback>,
  ) {}

  /**
   * Build a Broker Transparency Profile for an agent.
   * All logic is deterministic — same inputs always produce the same output.
   */
  async buildProfile(agentUserId: string, input: AgentTrustInput): Promise<BrokerTransparencyProfile> {
    const deals     = this.resolveDeals(input.totalDeals);
    const rating    = this.resolveRating(input.rating);
    const response  = this.resolveResponseTime(input.avgResponseHours);
    const complaints = this.resolveComplaints(input.complaintCount);
    const badges    = this.selectBadges(input, rating.value, response);
    const label     = this.buildLabel(rating, deals, response, input.complaintCount);

    return { label, rating, deals, response_time: response, complaints, trust_badges: badges };
  }

  // ── Field resolvers ─────────────────────────────────────────────────────────

  private resolveRating(raw: number): TrustRating {
    const value = (raw && raw > 0) ? Math.min(5, Math.max(0, Number(raw))) : 3.5;
    const fixed = value.toFixed(1);
    return { value, text: `${fixed} ⭐ rating` };
  }

  private resolveDeals(count: number): TrustDeals {
    const c = Math.max(0, count ?? 0);
    const text = c === 0 ? 'New agent — no deals yet' : `${c} deal${c === 1 ? '' : 's'} closed`;
    return { count: c, text };
  }

  private resolveResponseTime(hours: number | null): TrustResponse {
    if (hours === null || hours === undefined) {
      return { value: 'N/A', text: 'Response time not tracked yet' };
    }
    if (hours < 1) {
      return { value: '< 1 hr', text: 'Responds within an hour' };
    }
    if (hours <= 3) {
      return { value: `${hours} hrs`, text: `Responds within ${hours} hours` };
    }
    if (hours <= 12) {
      return { value: `${hours} hrs`, text: `Responds within ${hours} hours` };
    }
    if (hours <= 24) {
      return { value: '1 day', text: 'Responds within a day' };
    }
    if (hours <= 48) {
      return { value: '2 days', text: 'Responds within 2 days' };
    }
    return { value: `${Math.round(hours / 24)} days`, text: `Responds within ${Math.round(hours / 24)} days` };
  }

  private resolveComplaints(count: number): TrustComplaints {
    const c = Math.max(0, count ?? 0);
    const text = c === 0 ? 'No complaints reported' : `${c} complaint${c === 1 ? '' : 's'} reported`;
    return { count: c, text };
  }

  // ── Badge selector ──────────────────────────────────────────────────────────

  private selectBadges(
    input: AgentTrustInput,
    ratingValue: number,
    response: TrustResponse,
  ): string[] {
    const badges: string[] = [];

    // Experience
    if (input.totalDeals >= 50) {
      badges.push('Experienced Agent');
    } else if (input.totalDeals === 0) {
      badges.push('New Agent');
    }

    // Rating
    if (ratingValue >= 4.0 && input.totalReviews >= 5) {
      badges.push('Highly Rated');
    }

    // Response speed
    const fastThreshold = 3; // ≤3 hours
    if (
      input.avgResponseHours !== null &&
      input.avgResponseHours !== undefined &&
      input.avgResponseHours <= fastThreshold
    ) {
      badges.push('Fast Responder');
    }

    // Complaint record
    if (input.complaintCount === 0) {
      badges.push('Low Complaint Record');
    }

    // High demand — many deals + good rating
    if (input.totalDeals >= 30 && ratingValue >= 4.0) {
      badges.push('High Demand Agent');
    }

    // Clamp to 2–4 badges
    return badges.slice(0, 4).length >= 2 ? badges.slice(0, 4) : this.padBadges(badges, input);
  }

  /** Ensure at least 2 badges even for sparse profiles */
  private padBadges(badges: string[], input: AgentTrustInput): string[] {
    const result = [...badges];
    if (!result.includes('New Agent') && !result.includes('Experienced Agent')) {
      result.push(input.totalDeals >= 10 ? 'Experienced Agent' : 'New Agent');
    }
    if (!result.includes('Low Complaint Record') && input.complaintCount === 0) {
      result.push('Low Complaint Record');
    }
    return result.slice(0, 4);
  }

  // ── One-line label ──────────────────────────────────────────────────────────

  private buildLabel(
    rating: TrustRating,
    deals: TrustDeals,
    response: TrustResponse,
    complaints: number,
  ): string {
    const parts: string[] = [];

    parts.push(`${rating.value.toFixed(1)}⭐ rated`);

    if (deals.count > 0) {
      parts.push(`${deals.count} deal${deals.count === 1 ? '' : 's'} closed`);
    } else {
      parts.push('New agent');
    }

    if (response.value !== 'N/A') {
      parts.push(`Responds ${response.value}`);
    }

    if (complaints > 0) {
      parts.push(`⚠️ ${complaints} complaint${complaints === 1 ? '' : 's'}`);
    }

    return parts.join(' • ');
  }
}
