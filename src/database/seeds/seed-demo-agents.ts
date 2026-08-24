/**
 * seed-demo-agents.ts — additive agent seeder
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates agent users + their agency + agent_profile rows. Nothing else.
 *
 * Safe to run against a live database:
 *   · synchronize: false — never alters the schema
 *   · no TRUNCATE, no DELETE — only inserts
 *   · idempotent — an agent whose email already exists is skipped, so re-running
 *     tops up to --count instead of duplicating
 *
 * Usage:
 *   npm run seed:agents                    # 8 agents
 *   npm run seed:agents -- --count=20
 *   npm run seed:agents -- --dry-run       # show what would be created
 *   npm run seed:agents -- --password='Chosen@123'
 *
 * Against a non-local DB_HOST it refuses to run unless CONFIRM=yes is set.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';

import { User, UserRole } from '../../modules/users/entities/user.entity';
import { Agency, AgencyStatus } from '../../modules/agency/entities/agency.entity';
import { AgentProfile } from '../../modules/agency/entities/agent-profile.entity';
import { City } from '../../modules/locations/entities/city.entity';
import { State } from '../../modules/locations/entities/state.entity';

// ─── CLI args ────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const argVal  = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const DRY_RUN = args.includes('--dry-run');
const COUNT   = Math.max(1, Number(argVal('count') ?? 8));
const PASSWORD = argVal('password') ?? `Agent@${randomBytes(4).toString('hex')}`;

const dataSource = new DataSource({
  type:     'mysql',
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'realestate_db',
  entities: [User, Agency, AgentProfile, City, State],
  synchronize: false,
});

// ─── Source data ─────────────────────────────────────────────────────────────

interface AgentSeed {
  name: string; city: string; state: string; company: string;
  licensePrefix: string; experience: number; rating: number; deals: number;
  tick: 'none' | 'verified' | 'bronze' | 'silver' | 'gold';
  speciality: string;
}

const AGENTS: AgentSeed[] = [
  { name: 'Amit Verma',      city: 'Mumbai',    state: 'Maharashtra', company: 'PropElite Realty',    licensePrefix: 'MH-RERA-A', experience: 12, rating: 4.8, deals: 340, tick: 'gold',     speciality: 'Bandra, Juhu and Powai residential' },
  { name: 'Sunita Nair',     city: 'Bangalore', state: 'Karnataka',   company: 'HomeFirst Properties', licensePrefix: 'KA-RERA-B', experience: 8,  rating: 4.6, deals: 215, tick: 'silver',   speciality: 'Whitefield, Koramangala and HSR Layout' },
  { name: 'Vikram Singh',    city: 'Delhi',     state: 'Delhi',       company: 'Capital Estates',      licensePrefix: 'DL-RERA-C', experience: 15, rating: 4.9, deals: 480, tick: 'gold',     speciality: 'Delhi, Gurgaon and Noida luxury villas' },
  { name: 'Deepa Menon',     city: 'Hyderabad', state: 'Telangana',   company: 'Saffron Realty',       licensePrefix: 'TS-RERA-D', experience: 10, rating: 4.7, deals: 298, tick: 'silver',   speciality: 'Gachibowli, Kondapur and HITEC City' },
  { name: 'Rohit Deshmukh',  city: 'Pune',      state: 'Maharashtra', company: 'Sahyadri Homes',       licensePrefix: 'MH-RERA-E', experience: 9,  rating: 4.5, deals: 187, tick: 'bronze',   speciality: 'Baner, Wakad and Hinjewadi apartments' },
  { name: 'Ananya Ghosh',    city: 'Kolkata',   state: 'West Bengal', company: 'Bengal Property Co.',  licensePrefix: 'WB-RERA-F', experience: 7,  rating: 4.4, deals: 142, tick: 'verified', speciality: 'Salt Lake, New Town and Park Street' },
  { name: 'Karthik Iyer',    city: 'Chennai',   state: 'Tamil Nadu',  company: 'Coromandel Realty',    licensePrefix: 'TN-RERA-G', experience: 11, rating: 4.6, deals: 236, tick: 'silver',   speciality: 'OMR, Anna Nagar and Velachery' },
  { name: 'Neha Chauhan',    city: 'Jaipur',    state: 'Rajasthan',   company: 'Pink City Estates',    licensePrefix: 'RJ-RERA-H', experience: 6,  rating: 4.3, deals: 98,  tick: 'verified', speciality: 'Vaishali Nagar, Malviya Nagar and Mansarovar' },
  { name: 'Sanjay Patel',    city: 'Ahmedabad', state: 'Gujarat',     company: 'Sabarmati Homes',      licensePrefix: 'GJ-RERA-I', experience: 13, rating: 4.7, deals: 311, tick: 'gold',     speciality: 'SG Highway, Bopal and Prahlad Nagar' },
  { name: 'Ritu Malhotra',   city: 'Gurgaon',   state: 'Haryana',     company: 'Millennium Realtors',  licensePrefix: 'HR-RERA-J', experience: 14, rating: 4.8, deals: 402, tick: 'gold',     speciality: 'Golf Course Road, Sohna Road and DLF phases' },
  { name: 'Arjun Reddy',     city: 'Noida',     state: 'Uttar Pradesh', company: 'Yamuna Property Hub', licensePrefix: 'UP-RERA-K', experience: 5, rating: 4.2, deals: 76,  tick: 'verified', speciality: 'Sector 62, 137 and 150 apartments' },
  { name: 'Meera Pillai',    city: 'Kochi',     state: 'Kerala',      company: 'Backwater Realty',     licensePrefix: 'KL-RERA-L', experience: 8,  rating: 4.5, deals: 154, tick: 'bronze',   speciality: 'Kakkanad, Edappally and Marine Drive' },
];

const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

/** amit.verma3@agents.think4buysale.in — namespaced so it never collides with a real user */
const emailFor  = (name: string, i: number) => `${slugify(name).replace(/-/g, '.')}${i + 1}@agents.think4buysale.in`;
const phoneFor  = (i: number) => `98${String(76500000 + i).padStart(8, '0')}`;

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);

  console.log('\n  Demo agent seeder');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  Database : ${process.env.DB_NAME || 'realestate_db'} @ ${host}`);
  console.log(`  Target   : ${COUNT} agent(s)${DRY_RUN ? '  [DRY RUN]' : ''}`);
  console.log('  Inserts only — no table is truncated or emptied.\n');

  if (!isLocal && process.env.CONFIRM !== 'yes' && !DRY_RUN) {
    console.error(`  Refusing to write to a non-local host (${host}).`);
    console.error('  Re-run with CONFIRM=yes if that is really what you want.\n');
    process.exit(1);
  }

  await dataSource.initialize();

  const userRepo    = dataSource.getRepository(User);
  const agencyRepo  = dataSource.getRepository(Agency);
  const profileRepo = dataSource.getRepository(AgentProfile);
  const cityRepo    = dataSource.getRepository(City);
  const stateRepo   = dataSource.getRepository(State);

  const cities = await cityRepo.find();
  const states = await stateRepo.find();
  if (!cities.length) {
    console.warn('  ! cities table is empty — cityId/stateId will be left null.');
    console.warn('    Run `npm run seed:india-cities` first if you want them linked.\n');
  }

  const hashed = await bcrypt.hash(PASSWORD, 10);
  let created = 0, skipped = 0;

  for (let i = 0; i < COUNT; i++) {
    const seed  = AGENTS[i % AGENTS.length];
    const email = emailFor(seed.name, i);

    if (await userRepo.findOne({ where: { email } })) {
      skipped++;
      continue;
    }

    const cityRow  = cities.find(c => c.name.toLowerCase() === seed.city.toLowerCase());
    const stateRow = states.find(s => s.name.toLowerCase() === seed.state.toLowerCase());

    if (DRY_RUN) {
      console.log(`  would create  ${seed.name.padEnd(18)} ${email}`);
      created++;
      continue;
    }

    const user = await userRepo.save(userRepo.create({
      name:            seed.name,
      email,
      phone:           phoneFor(i),
      password:        hashed,
      role:            UserRole.AGENT,
      city:            seed.city,
      state:           seed.state,
      cityId:          cityRow?.id ?? null,
      stateId:         stateRow?.id ?? cityRow?.stateId ?? null,
      company:         seed.company,
      isVerified:      true,
      agentLicense:    `${seed.licensePrefix}${10000 + i}`,
      agentBio:        `${seed.experience} years in ${seed.city} real estate. Specialises in ${seed.speciality}.`,
      agentExperience: seed.experience,
      agentRating:     seed.rating,
      totalDeals:      seed.deals,
      agentTick:       seed.tick,
    } as Partial<User>));

    // One agency per agent, reused if an agency with that name already exists
    let agency = await agencyRepo.findOne({ where: { name: seed.company } });
    if (!agency) {
      agency = await agencyRepo.save(agencyRepo.create({
        name:         seed.company,
        description:  `${seed.company} — RERA-registered real estate agency operating in ${seed.city}.`,
        cityId:       cityRow?.id ?? null,
        stateId:      stateRow?.id ?? cityRow?.stateId ?? null,
        contactEmail: email,
        contactPhone: phoneFor(i),
        licenseNumber: `${seed.licensePrefix}${10000 + i}`,
        isActive:     true,
        isVerified:   true,
        status:       AgencyStatus.APPROVED,
        createdByUserId: user.id,
      }));
    }

    await profileRepo.save(profileRepo.create({
      userId:          user.id,
      agencyId:        agency.id,
      experienceYears: seed.experience,
      licenseNumber:   `${seed.licensePrefix}${10000 + i}`,
      rating:          seed.rating,
      totalDeals:      seed.deals,
      totalListings:   0,
      isActive:        true,
      bio:             `${seed.experience} years in ${seed.city} real estate. Specialises in ${seed.speciality}.`,
      tick:            seed.tick,
    }));

    await agencyRepo.increment({ id: agency.id }, 'totalAgents', 1);
    created++;
  }

  await dataSource.destroy();

  console.log(`\n  Created ${created} agent(s), skipped ${skipped} that already existed.`);
  if (created && !DRY_RUN) {
    console.log(`  Shared password for the new accounts: ${PASSWORD}`);
    console.log('  (shown once — change it or pass --password= next time)');
  }
  console.log('');
}

main().catch((err) => {
  console.error('\n  Agent seed failed:', err?.message ?? err, '\n');
  process.exit(1);
});
