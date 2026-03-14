/**
 * Agency Seed & Migration Script
 *
 * Steps:
 * 1. Create default agency
 * 2. Create agent profiles for all existing users with role=AGENT
 * 3. Assign all orphan properties (no agent mapping) to a default agent
 * 4. Populate property_agent_map
 *
 * Run: npx ts-node -r tsconfig-paths/register src/database/seeds/seed-agency.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { User, UserRole } from '../../modules/users/entities/user.entity';
import { Property } from '../../modules/properties/entities/property.entity';
import { PropertyImage } from '../../modules/properties/entities/property-image.entity';
import { Amenity } from '../../modules/properties/entities/amenity.entity';
import { Location } from '../../modules/locations/entities/location.entity';
import { Inquiry } from '../../modules/inquiries/entities/inquiry.entity';
import { Agency } from '../../modules/agency/entities/agency.entity';
import { AgentProfile } from '../../modules/agency/entities/agent-profile.entity';
import { PropertyAgentMap } from '../../modules/agency/entities/property-agent-map.entity';
import { AgentLocationMap } from '../../modules/agency/entities/agent-location-map.entity';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'dpk1391981',
  password: process.env.DB_PASSWORD || 'Dpk1391981!',
  database: process.env.DB_NAME || 'realestate_db',
  entities: [User, Property, PropertyImage, Amenity, Location, Inquiry, Agency, AgentProfile, PropertyAgentMap, AgentLocationMap],
  synchronize: true,
});

async function seedAgency() {
  await dataSource.initialize();
  console.log('[Agency Seed] Database connected');

  const agencyRepo = dataSource.getRepository(Agency);
  const agentProfileRepo = dataSource.getRepository(AgentProfile);
  const propertyAgentMapRepo = dataSource.getRepository(PropertyAgentMap);
  const userRepo = dataSource.getRepository(User);
  const propertyRepo = dataSource.getRepository(Property);

  // ── STEP 1: Create default agency ───────────────────────────────────────────
  console.log('[Agency Seed] Step 1: Creating default agency...');
  let defaultAgency = await agencyRepo.findOne({ where: { name: 'Think4BuySale Realty' } });
  if (!defaultAgency) {
    defaultAgency = await agencyRepo.save(
      agencyRepo.create({
        name: 'Think4BuySale Realty',
        description: 'The official agency of Think4BuySale platform',
        contactEmail: 'agency@think4buysale.com',
        isActive: true,
        isVerified: true,
      }),
    );
    console.log(`[Agency Seed] Created default agency: ${defaultAgency.id}`);
  } else {
    console.log(`[Agency Seed] Default agency already exists: ${defaultAgency.id}`);
  }

  // ── STEP 2: Create agent profiles for all AGENT users ───────────────────────
  console.log('[Agency Seed] Step 2: Creating agent profiles for existing agent users...');
  const agentUsers = await userRepo.find({ where: { role: UserRole.AGENT } });
  console.log(`[Agency Seed] Found ${agentUsers.length} agent user(s)`);

  const agentProfileMap = new Map<string, AgentProfile>(); // userId -> profile

  for (const agentUser of agentUsers) {
    let profile = await agentProfileRepo.findOne({ where: { userId: agentUser.id } });
    if (!profile) {
      profile = await agentProfileRepo.save(
        agentProfileRepo.create({
          userId: agentUser.id,
          agencyId: defaultAgency.id,
          experienceYears: agentUser.agentExperience ?? 0,
          licenseNumber: agentUser.agentLicense ?? null,
          bio: agentUser.agentBio ?? null,
          rating: Number(agentUser.agentRating ?? 0),
          totalDeals: agentUser.totalDeals ?? 0,
          tick: agentUser.agentTick ?? 'none',
          isActive: agentUser.isActive,
        }),
      );
      console.log(`[Agency Seed] Created agent profile for user: ${agentUser.email}`);

      // Increment agency agent count
      await agencyRepo.increment({ id: defaultAgency.id }, 'totalAgents', 1);
    } else {
      console.log(`[Agency Seed] Agent profile already exists for: ${agentUser.email}`);
    }
    agentProfileMap.set(agentUser.id, profile);
  }

  // ── STEP 3: Pick or create a default agent for unassigned properties ─────────
  let defaultAgentProfile: AgentProfile | null = null;

  if (agentProfileMap.size > 0) {
    // Use the first available agent as default
    defaultAgentProfile = agentProfileMap.values().next().value;
    console.log(`[Agency Seed] Using agent profile ${defaultAgentProfile.id} as default`);
  } else {
    // No agents exist — create a system agent user
    console.log('[Agency Seed] No agents found — creating system agent...');
    let systemAgent = await userRepo.findOne({ where: { email: 'system.agent@think4buysale.com' } });
    if (!systemAgent) {
      const bcrypt = await import('bcryptjs');
      systemAgent = await userRepo.save(
        userRepo.create({
          name: 'System Agent',
          email: 'system.agent@think4buysale.com',
          password: await bcrypt.hash('SystemAgent@2025!', 10),
          role: UserRole.AGENT,
          isActive: true,
          isVerified: true,
          agentFreeQuota: 9999,
        }),
      );
    }

    defaultAgentProfile = await agentProfileRepo.save(
      agentProfileRepo.create({
        userId: systemAgent.id,
        agencyId: defaultAgency.id,
        isActive: true,
      }),
    );

    await agencyRepo.increment({ id: defaultAgency.id }, 'totalAgents', 1);
    agentProfileMap.set(systemAgent.id, defaultAgentProfile);
    console.log(`[Agency Seed] Created system agent profile: ${defaultAgentProfile.id}`);
  }

  // ── STEP 4: Map all properties to agents ─────────────────────────────────────
  console.log('[Agency Seed] Step 4: Mapping properties to agents...');
  const allProperties = await propertyRepo.find({ select: ['id', 'ownerId'] });
  let mapped = 0;
  let skipped = 0;

  for (const property of allProperties) {
    const existingMap = await propertyAgentMapRepo.findOne({
      where: { propertyId: property.id, isActive: true },
    });

    if (existingMap) {
      skipped++;
      continue;
    }

    // Try to map to the owner's agent profile if they are an agent
    let targetProfile = property.ownerId
      ? agentProfileMap.get(property.ownerId)
      : null;

    // If owner is not an agent, assign to default agent
    if (!targetProfile) {
      targetProfile = defaultAgentProfile;
    }

    await propertyAgentMapRepo.save(
      propertyAgentMapRepo.create({
        propertyId: property.id,
        agentId: targetProfile.id,
        assignedByAdmin: !agentProfileMap.has(property.ownerId ?? ''),
        isActive: true,
      }),
    );

    mapped++;
  }

  // Update totalListings per agent
  for (const [, profile] of agentProfileMap) {
    const count = await propertyAgentMapRepo.count({
      where: { agentId: profile.id, isActive: true },
    });
    await agentProfileRepo.update(profile.id, { totalListings: count });
  }

  // Update default agency listing count
  const agencyListings = await propertyAgentMapRepo
    .createQueryBuilder('map')
    .innerJoin('map.agent', 'agent')
    .where('agent.agencyId = :agencyId', { agencyId: defaultAgency.id })
    .andWhere('map.isActive = :active', { active: true })
    .getCount();
  await agencyRepo.update(defaultAgency.id, { totalListings: agencyListings });

  console.log(`
[Agency Seed] ✅ Complete!
  Default Agency: ${defaultAgency.name} (${defaultAgency.id})
  Agent Profiles Created/Found: ${agentProfileMap.size}
  Properties Mapped: ${mapped}
  Properties Skipped (already mapped): ${skipped}
  Total Properties: ${allProperties.length}
  `);

  await dataSource.destroy();
}

seedAgency().catch((err) => {
  console.error('[Agency Seed] ❌ Error:', err);
  process.exit(1);
});
