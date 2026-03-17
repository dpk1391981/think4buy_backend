import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { PropertyAgentMap } from '../agency/entities/property-agent-map.entity';
import { AgentLocationMap } from '../agency/entities/agent-location-map.entity';
import { Lead } from './entities/lead.entity';
import { LeadAssignment, AssignmentType } from './entities/lead-assignment.entity';

/**
 * Auto-assignment priority order:
 *  1. Agents mapped to the specific property (PropertyAgentMap)
 *  2. Agents mapped to the lead's city (AgentLocationMap)
 *  3. Round-robin over all active agents who have any location map
 *
 * Round-robin is approximated by picking the agent with the fewest
 * active leads (least-loaded assignment), which is fairer than
 * strict round-robin and requires no persistent cursor.
 */
@Injectable()
export class LeadAssignmentEngineService {
  private readonly logger = new Logger(LeadAssignmentEngineService.name);

  constructor(
    @InjectRepository(PropertyAgentMap)
    private pamRepo: Repository<PropertyAgentMap>,
    @InjectRepository(AgentLocationMap)
    private almRepo: Repository<AgentLocationMap>,
    @InjectRepository(Lead)
    private leadRepo: Repository<Lead>,
    @InjectRepository(LeadAssignment)
    private assignmentRepo: Repository<LeadAssignment>,
  ) {}

  /**
   * Returns the best agent's **users.id** for the given lead context.
   * Returns null if no agent can be found.
   *
   * NOTE: PropertyAgentMap and AgentLocationMap store agent_profiles.id, not
   * users.id.  All returned values are converted to users.id via
   * resolveUserId() so that leads.assignedAgentId is always a users.id and
   * can be matched against req.user.id in controllers.
   */
  async resolveAgent(params: {
    propertyId?: string;
    cityId?: string;
    city?: string;
  }): Promise<string | null> {
    const { propertyId, cityId } = params;

    // ── Step 1: Agents mapped to this property ────────────────────────────
    if (propertyId) {
      const maps = await this.pamRepo.find({
        where: { propertyId, isActive: true },
        select: ['agentId'],
      });
      if (maps.length > 0) {
        const agentProfileIds = maps.map((m) => m.agentId);
        const best = await this.leastLoadedByProfileId(agentProfileIds);
        if (best) {
          const userId = await this.resolveUserId(best);
          this.logger.debug(`Assigned via property map → agent ${userId}`);
          return userId;
        }
      }
    }

    // ── Step 2: Agents covering this city ─────────────────────────────────
    if (cityId) {
      const maps = await this.almRepo.find({
        where: { cityId },
        select: ['agentId'],
      });
      if (maps.length > 0) {
        const agentProfileIds = [...new Set(maps.map((m) => m.agentId))];
        const best = await this.leastLoadedByProfileId(agentProfileIds);
        if (best) {
          const userId = await this.resolveUserId(best);
          this.logger.debug(`Assigned via city map (${cityId}) → agent ${userId}`);
          return userId;
        }
      }
    }

    // ── Step 3: Global round-robin (least-loaded agent with any location map) ──
    const allMaps = await this.almRepo
      .createQueryBuilder('alm')
      .select('DISTINCT alm.agentId', 'agentId')
      .getRawMany<{ agentId: string }>();

    if (allMaps.length > 0) {
      const agentProfileIds = allMaps.map((m) => m.agentId);
      const best = await this.leastLoadedByProfileId(agentProfileIds);
      if (best) {
        const userId = await this.resolveUserId(best);
        this.logger.debug(`Assigned via global round-robin → agent ${userId}`);
        return userId;
      }
    }

    this.logger.warn('No agent found for auto-assignment');
    return null;
  }

  /**
   * Resolve an agent_profiles.id → users.id.
   * Falls back to the profileId itself if no row is found (safe fallback).
   */
  private async resolveUserId(agentProfileId: string): Promise<string> {
    const rows: any[] = await this.leadRepo.manager.query(
      'SELECT userId FROM agent_profiles WHERE id = ? LIMIT 1',
      [agentProfileId],
    );
    return rows[0]?.userId ?? agentProfileId;
  }

  /**
   * Among the given agent_profile IDs, return the one whose user has the
   * fewest active leads.  We join through agent_profiles to get the userId
   * so the lead-count query uses the same users.id space as the leads table.
   */
  private async leastLoadedByProfileId(agentProfileIds: string[]): Promise<string | null> {
    if (agentProfileIds.length === 0) return null;
    if (agentProfileIds.length === 1) return agentProfileIds[0];

    // Resolve all profile IDs to user IDs in one query
    const profileRows: any[] = await this.leadRepo.manager.query(
      `SELECT id, userId FROM agent_profiles WHERE id IN (${agentProfileIds.map(() => '?').join(',')})`,
      agentProfileIds,
    );
    if (profileRows.length === 0) return agentProfileIds[0];

    const userIds = profileRows.map((r) => r.userId).filter(Boolean);
    if (userIds.length === 0) return agentProfileIds[0];

    // Count open leads per userId
    const rows: { agentId: string; cnt: string }[] = await this.leadRepo
      .createQueryBuilder('l')
      .select('l.assignedAgentId', 'agentId')
      .addSelect('COUNT(*)', 'cnt')
      .where('l.assignedAgentId IN (:...ids)', { ids: userIds })
      .andWhere('l.status NOT IN (:...closed)', {
        closed: ['deal_won', 'deal_lost', 'junk', 'duplicate'],
      })
      .groupBy('l.assignedAgentId')
      .getRawMany();

    const loadMap = new Map<string, number>();
    rows.forEach((r) => loadMap.set(r.agentId, Number(r.cnt)));

    // Find the profile whose user has the fewest open leads
    let bestProfileId = profileRows[0].id;
    let bestLoad = loadMap.get(profileRows[0].userId) ?? 0;
    for (const row of profileRows) {
      const load = loadMap.get(row.userId) ?? 0;
      if (load < bestLoad) {
        bestProfileId = row.id;
        bestLoad = load;
      }
    }
    return bestProfileId;
  }
}
