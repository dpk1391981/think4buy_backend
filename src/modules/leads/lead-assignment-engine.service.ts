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
   * Returns the best agentId for the given lead context.
   * Returns null if no agent can be found.
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
        const agentIds = maps.map((m) => m.agentId);
        const best = await this.leastLoadedAgent(agentIds);
        if (best) {
          this.logger.debug(`Assigned via property map → agent ${best}`);
          return best;
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
        const agentIds = [...new Set(maps.map((m) => m.agentId))];
        const best = await this.leastLoadedAgent(agentIds);
        if (best) {
          this.logger.debug(`Assigned via city map (${cityId}) → agent ${best}`);
          return best;
        }
      }
    }

    // ── Step 3: Global round-robin (least-loaded agent with any location map) ──
    const allMaps = await this.almRepo
      .createQueryBuilder('alm')
      .select('DISTINCT alm.agentId', 'agentId')
      .getRawMany<{ agentId: string }>();

    if (allMaps.length > 0) {
      const agentIds = allMaps.map((m) => m.agentId);
      const best = await this.leastLoadedAgent(agentIds);
      if (best) {
        this.logger.debug(`Assigned via global round-robin → agent ${best}`);
        return best;
      }
    }

    this.logger.warn('No agent found for auto-assignment');
    return null;
  }

  /**
   * Among the given agentIds, return the one with the fewest active leads.
   */
  private async leastLoadedAgent(agentIds: string[]): Promise<string | null> {
    if (agentIds.length === 0) return null;
    if (agentIds.length === 1) return agentIds[0];

    // Count active leads per agent
    const rows: { agentId: string; cnt: string }[] = await this.leadRepo
      .createQueryBuilder('l')
      .select('l.assignedAgentId', 'agentId')
      .addSelect('COUNT(*)', 'cnt')
      .where('l.assignedAgentId IN (:...ids)', { ids: agentIds })
      .andWhere('l.status NOT IN (:...closed)', {
        closed: ['deal_won', 'deal_lost', 'junk', 'duplicate'],
      })
      .groupBy('l.assignedAgentId')
      .getRawMany();

    const loadMap = new Map<string, number>();
    rows.forEach((r) => loadMap.set(r.agentId, Number(r.cnt)));

    // Return the agent with fewest open leads (default 0 if not in map)
    let best = agentIds[0];
    let bestLoad = loadMap.get(best) ?? 0;
    for (const id of agentIds) {
      const load = loadMap.get(id) ?? 0;
      if (load < bestLoad) {
        best = id;
        bestLoad = load;
      }
    }
    return best;
  }
}
