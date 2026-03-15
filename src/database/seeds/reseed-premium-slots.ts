/**
 * Premium Slots Seed
 *
 * How premium slots work:
 * ─────────────────────
 * • Each city can have up to 6 numbered slots (1–6).
 * • An agent assigned to slot 1 in "mumbai" appears first in the
 *   FeaturedAgentsBanner on every property search for Mumbai.
 * • Slots are time-limited (durationDays). The cron job expires them
 *   automatically; admins can deactivate early from the admin panel.
 * • When the same city+slotNumber is assigned again, the old record
 *   is deactivated and a new one created (upsert behaviour).
 * • Agents pay for slots via subscription / lead credits; admins
 *   assign the slot manually after payment is confirmed.
 *
 * This seed assigns demo agents to slots across 5 cities.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { PremiumSlot } from '../../modules/agency/entities/premium-slot.entity';

const dataSource = new DataSource({
  type: 'mysql',
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'dpk1391981',
  password: process.env.DB_PASSWORD || 'Dpk1391981!',
  database: process.env.DB_NAME     || 'think4buysale',
  entities: [PremiumSlot],
  synchronize: true,
});

async function run() {
  await dataSource.initialize();
  const slotRepo = dataSource.getRepository(PremiumSlot);

  // Fetch all active agents via raw query (avoids User entity relation deps)
  const agents: Array<{ id: string; name: string; phone: string; avatar: string; city: string }> =
    await dataSource.query(
      `SELECT id, name, phone, avatar, city FROM users WHERE role = 'agent' AND isActive = 1 ORDER BY agentRating DESC`
    );

  if (agents.length === 0) {
    console.log('No agents found — run the main seed first.');
    await dataSource.destroy();
    return;
  }

  console.log(`Found ${agents.length} agents`);

  // Clear existing slots
  await slotRepo.query('DELETE FROM premium_slots');
  console.log('Cleared existing premium slots');

  const now = new Date();

  const addDays = (d: Date, days: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
  };

  /**
   * Slot assignment plan:
   * ┌─────────────┬──────┬────────────────────────────────────────┬───────┬──────┐
   * │ City        │ Slot │ Agent (first match by city name)        │ Price │ Days │
   * ├─────────────┼──────┼────────────────────────────────────────┼───────┼──────┤
   * │ mumbai      │  1   │ agent with Mumbai city                  │ 9999  │  60  │
   * │ mumbai      │  2   │ second agent                            │ 7999  │  30  │
   * │ bangalore   │  1   │ agent with Bangalore city               │ 8999  │  45  │
   * │ delhi       │  1   │ any agent                               │ 9999  │  30  │
   * │ delhi       │  2   │ any agent                               │ 7499  │  60  │
   * │ gurgaon     │  1   │ any agent                               │ 6999  │  30  │
   * │ noida       │  1   │ any agent                               │ 5999  │  45  │
   * └─────────────┴──────┴────────────────────────────────────────┴───────┴──────┘
   */

  const cityAgents = (city: string) =>
    agents.filter(a => a.city?.toLowerCase() === city.toLowerCase());
  const anyAgent = (exclude: string[] = []) =>
    agents.find(a => !exclude.includes(a.id));

  const mumbaiAgents  = cityAgents('Mumbai');
  const bangAgents    = cityAgents('Bangalore');

  const plan: Array<{
    city: string; slotNumber: number; agent: typeof agents[0] | undefined;
    price: number; durationDays: number;
  }> = [
    { city: 'mumbai',    slotNumber: 1, agent: mumbaiAgents[0] ?? anyAgent(),             price: 9999, durationDays: 60 },
    { city: 'mumbai',    slotNumber: 2, agent: mumbaiAgents[1] ?? anyAgent([mumbaiAgents[0]?.id ?? '']), price: 7999, durationDays: 30 },
    { city: 'bangalore', slotNumber: 1, agent: bangAgents[0]   ?? anyAgent(),             price: 8999, durationDays: 45 },
    { city: 'delhi',     slotNumber: 1, agent: anyAgent(),                                price: 9999, durationDays: 30 },
    { city: 'delhi',     slotNumber: 2, agent: anyAgent(),                                price: 7499, durationDays: 60 },
    { city: 'gurgaon',   slotNumber: 1, agent: anyAgent(),                                price: 6999, durationDays: 30 },
    { city: 'noida',     slotNumber: 1, agent: anyAgent(),                                price: 5999, durationDays: 45 },
  ];

  for (const row of plan) {
    if (!row.agent) { console.log(`  ⚠ Skipped ${row.city} slot ${row.slotNumber} — no agent`); continue; }

    const startsAt  = now;
    const expiresAt = addDays(now, row.durationDays);

    await slotRepo.save({
      city:        row.city,
      slotNumber:  row.slotNumber,
      agentId:     row.agent.id,
      agentName:   row.agent.name,
      agentPhone:  row.agent.phone ?? null,
      agentAvatar: row.agent.avatar ?? null,
      price:       row.price,
      durationDays: row.durationDays,
      startsAt,
      expiresAt,
      isActive:    true,
      adminNotes:  'Seeded demo slot',
    });

    console.log(
      `  ✓ ${row.city.padEnd(12)} slot ${row.slotNumber} → ${row.agent.name.padEnd(20)} ` +
      `₹${row.price.toLocaleString('en-IN')} / ${row.durationDays}d  expires ${expiresAt.toLocaleDateString('en-IN')}`
    );
  }

  console.log('\nPremium slots seeded!');
  console.log('\nHow it works:');
  console.log('  • Visit /properties?city=Mumbai  → FeaturedAgentsBanner shows slot 1 & 2 agents');
  console.log('  • Visit /property-agents-in-mumbai → full agent directory with sponsored banner');
  console.log('  • Slots expire automatically via hourly cron (agency.service.ts expirePremiumSlots)');
  console.log('  • Assign new slots from Admin → Agencies → Premium Slots');

  await dataSource.destroy();
}

run().catch(e => { console.error(e); process.exit(1); });
