/**
 * Seed default leads for agents so the panel is populated during development.
 * Run: npx ts-node -r tsconfig-paths/register src/database/seeds/seed-leads.ts
 *
 * Requires agents (agent1–agent4) to already exist from seed.ts.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { Lead, LeadSource, LeadStatus, LeadTemperature, LeadPropertyType } from '../../modules/leads/entities/lead.entity';
import { LeadAssignment, AssignmentType } from '../../modules/leads/entities/lead-assignment.entity';
import { LeadActivityLog, ActivityType, ActorType } from '../../modules/leads/entities/lead-activity-log.entity';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'dpk1391981',
  password: process.env.DB_PASSWORD || 'Dpk1391981!',
  database: process.env.DB_NAME || 'realestate_db',
  entities: [Lead, LeadAssignment, LeadActivityLog],
  synchronize: true,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

// ── Lead definitions ──────────────────────────────────────────────────────────

const LEAD_TEMPLATES = [
  // ── Mumbai / agent1 ──────────────────────────────────────────────────
  {
    agentEmail: 'agent1@example.com',
    contactName: 'Rahul Sharma',
    contactPhone: '9810001001',
    contactEmail: 'rahul.sharma@gmail.com',
    city: 'Mumbai', state: 'Maharashtra',
    source: LeadSource.PROPERTY_PAGE,
    propertyType: LeadPropertyType.RESIDENTIAL,
    budgetMin: 8000000, budgetMax: 12000000,
    requirement: 'Looking for a 3 BHK in Bandra or Powai. Prefers ready-to-move. Has home loan pre-approval of ₹1 Cr.',
    leadScore: 88,
    temperature: LeadTemperature.HOT,
    status: LeadStatus.SITE_VISIT_SCHEDULED,
    notes: 'Very serious buyer. Site visit scheduled this weekend.',
    createdAt: daysAgo(2),
  },
  {
    agentEmail: 'agent1@example.com',
    contactName: 'Priya Mehta',
    contactPhone: '9820002002',
    contactEmail: 'priya.mehta@yahoo.com',
    city: 'Mumbai', state: 'Maharashtra',
    source: LeadSource.WHATSAPP,
    propertyType: LeadPropertyType.RESIDENTIAL,
    budgetMin: 5000000, budgetMax: 7500000,
    requirement: '2 BHK in Andheri West or Goregaon. Needs parking. Prefers society with gym.',
    leadScore: 72,
    temperature: LeadTemperature.HOT,
    status: LeadStatus.CONTACTED,
    notes: 'Responded quickly on WhatsApp. Interested in 2 listings.',
    createdAt: daysAgo(4),
  },
  {
    agentEmail: 'agent1@example.com',
    contactName: 'Kiran Desai',
    contactPhone: '9833003003',
    contactEmail: 'kiran.desai@outlook.com',
    city: 'Mumbai', state: 'Maharashtra',
    source: LeadSource.SEARCH,
    propertyType: LeadPropertyType.COMMERCIAL,
    budgetMin: 15000000, budgetMax: 25000000,
    requirement: 'Office space 1500–2500 sq ft in BKC or Lower Parel. Ready for immediate occupation.',
    leadScore: 65,
    temperature: LeadTemperature.WARM,
    status: LeadStatus.NEGOTIATION,
    notes: 'Negotiating on price. Requested floor plan and OC certificate.',
    createdAt: daysAgo(7),
  },
  {
    agentEmail: 'agent1@example.com',
    contactName: 'Suresh Patil',
    contactPhone: '9844004004',
    city: 'Mumbai', state: 'Maharashtra',
    source: LeadSource.CALL,
    propertyType: LeadPropertyType.RESIDENTIAL,
    budgetMin: 3000000, budgetMax: 5000000,
    requirement: '1 BHK or studio near Borivali station. First home buyer.',
    leadScore: 45,
    temperature: LeadTemperature.WARM,
    status: LeadStatus.FOLLOW_UP,
    notes: 'Needs to finalise budget with bank. Follow up next week.',
    createdAt: daysAgo(10),
  },
  {
    agentEmail: 'agent1@example.com',
    contactName: 'Asha Iyer',
    contactPhone: '9855005005',
    city: 'Mumbai', state: 'Maharashtra',
    source: LeadSource.PORTAL_IMPORT,
    propertyType: LeadPropertyType.RENTAL,
    budgetMin: 40000, budgetMax: 70000,
    requirement: 'Furnished 2 BHK on rent near Hiranandani Powai. Prefers tower floor.',
    leadScore: 55,
    temperature: LeadTemperature.WARM,
    status: LeadStatus.SITE_VISIT_COMPLETED,
    notes: 'Visited 2 flats. Comparing offers. Decision expected by end of week.',
    createdAt: daysAgo(5),
  },
  {
    agentEmail: 'agent1@example.com',
    contactName: 'Manish Tiwari',
    contactPhone: '9866006006',
    city: 'Mumbai', state: 'Maharashtra',
    source: LeadSource.CONTACT_FORM,
    propertyType: LeadPropertyType.PLOT,
    budgetMin: 10000000, budgetMax: 20000000,
    requirement: 'Agricultural or NA plot in Thane or Palghar belt. Min 2000 sq meters.',
    leadScore: 30,
    temperature: LeadTemperature.COLD,
    status: LeadStatus.NEW,
    notes: 'Enquiry received via contact form. Not yet contacted.',
    createdAt: hoursAgo(6),
  },
  {
    agentEmail: 'agent1@example.com',
    contactName: 'Neha Kapoor',
    contactPhone: '9877007007',
    contactEmail: 'neha.k@gmail.com',
    city: 'Mumbai', state: 'Maharashtra',
    source: LeadSource.CAMPAIGN,
    propertyType: LeadPropertyType.RESIDENTIAL,
    budgetMin: 20000000, budgetMax: 35000000,
    requirement: 'Penthouse or 4 BHK luxury apartment in Juhu or Versova. Sea-facing preferred.',
    leadScore: 92,
    temperature: LeadTemperature.HOT,
    status: LeadStatus.DEAL_IN_PROGRESS,
    notes: 'HNI client. Deal almost finalised on 4 BHK. Awaiting legal clearance.',
    createdAt: daysAgo(14),
  },

  // ── Bangalore / agent2 ───────────────────────────────────────────────
  {
    agentEmail: 'agent2@example.com',
    contactName: 'Anand Kumar',
    contactPhone: '9700101010',
    contactEmail: 'anand.k@infosys.com',
    city: 'Bangalore', state: 'Karnataka',
    source: LeadSource.PROPERTY_PAGE,
    propertyType: LeadPropertyType.RESIDENTIAL,
    budgetMin: 7000000, budgetMax: 10000000,
    requirement: '3 BHK in Whitefield or Marathahalli. Close to ITPL. Needs good school nearby.',
    leadScore: 80,
    temperature: LeadTemperature.HOT,
    status: LeadStatus.SITE_VISIT_SCHEDULED,
    notes: 'TCS employee relocating. Bank loan approved for ₹75L.',
    createdAt: daysAgo(1),
  },
  {
    agentEmail: 'agent2@example.com',
    contactName: 'Rekha Bhat',
    contactPhone: '9700202020',
    city: 'Bangalore', state: 'Karnataka',
    source: LeadSource.WHATSAPP,
    propertyType: LeadPropertyType.RENTAL,
    budgetMin: 25000, budgetMax: 40000,
    requirement: '2 BHK in Koramangala or Indiranagar. Semi-furnished. 11-month lease.',
    leadScore: 60,
    temperature: LeadTemperature.WARM,
    status: LeadStatus.CONTACTED,
    notes: 'Looking to move in within 2 weeks.',
    createdAt: daysAgo(3),
  },
  {
    agentEmail: 'agent2@example.com',
    contactName: 'Vinod Reddy',
    contactPhone: '9700303030',
    contactEmail: 'vinod.r@wipro.com',
    city: 'Bangalore', state: 'Karnataka',
    source: LeadSource.SEARCH,
    propertyType: LeadPropertyType.RESIDENTIAL,
    budgetMin: 5500000, budgetMax: 8000000,
    requirement: '2 BHK in HSR Layout or Sarjapur Road. Under-construction acceptable.',
    leadScore: 58,
    temperature: LeadTemperature.WARM,
    status: LeadStatus.FOLLOW_UP,
    notes: 'Comparing 3 projects. Needs RERA details.',
    createdAt: daysAgo(6),
  },
  {
    agentEmail: 'agent2@example.com',
    contactName: 'Meera Joshi',
    contactPhone: '9700404040',
    city: 'Bangalore', state: 'Karnataka',
    source: LeadSource.CALL,
    propertyType: LeadPropertyType.COMMERCIAL,
    budgetMin: 8000000, budgetMax: 12000000,
    requirement: 'Retail shop in Jayanagar or Banashankari for pharmacy business. 400–600 sq ft.',
    leadScore: 70,
    temperature: LeadTemperature.HOT,
    status: LeadStatus.NEGOTIATION,
    notes: 'Budget firm. Expects stamp duty included in price.',
    createdAt: daysAgo(8),
  },
  {
    agentEmail: 'agent2@example.com',
    contactName: 'Sunil Gowda',
    contactPhone: '9700505050',
    city: 'Bangalore', state: 'Karnataka',
    source: LeadSource.MANUAL,
    propertyType: LeadPropertyType.PLOT,
    budgetMin: 3000000, budgetMax: 6000000,
    requirement: 'Residential plot in Devanahalli or Kanakapura Road. 30×40 or 40×60 site.',
    leadScore: 42,
    temperature: LeadTemperature.COLD,
    status: LeadStatus.NEW,
    notes: 'Added manually after referral.',
    createdAt: hoursAgo(2),
  },
  {
    agentEmail: 'agent2@example.com',
    contactName: 'Divya Naidu',
    contactPhone: '9700606060',
    contactEmail: 'divya.n@accenture.com',
    city: 'Bangalore', state: 'Karnataka',
    source: LeadSource.CAMPAIGN,
    propertyType: LeadPropertyType.RESIDENTIAL,
    budgetMin: 12000000, budgetMax: 18000000,
    requirement: '3 BHK or 4 BHK villa in Sarjapur township. Gated community must. Pet-friendly.',
    leadScore: 85,
    temperature: LeadTemperature.HOT,
    status: LeadStatus.DEAL_WON,
    notes: 'Deal closed! Villa in Prestige Shantiniketan. Commission invoice sent.',
    createdAt: daysAgo(21),
  },

  // ── Delhi / agent3 ───────────────────────────────────────────────────
  {
    agentEmail: 'agent3@example.com',
    contactName: 'Rajiv Khanna',
    contactPhone: '9810101010',
    contactEmail: 'rajiv.k@tatasteel.com',
    city: 'Delhi', state: 'Delhi',
    source: LeadSource.PROPERTY_PAGE,
    propertyType: LeadPropertyType.RESIDENTIAL,
    budgetMin: 18000000, budgetMax: 28000000,
    requirement: '4 BHK independent house in Greater Kailash I or II. Min 300 sq yards. Need duplex structure.',
    leadScore: 90,
    temperature: LeadTemperature.HOT,
    status: LeadStatus.SITE_VISIT_COMPLETED,
    notes: 'Very serious. Third site visit done. Doing final comparison.',
    createdAt: daysAgo(3),
  },
  {
    agentEmail: 'agent3@example.com',
    contactName: 'Pooja Agarwal',
    contactPhone: '9820202020',
    city: 'Delhi', state: 'Delhi',
    source: LeadSource.WHATSAPP,
    propertyType: LeadPropertyType.RENTAL,
    budgetMin: 35000, budgetMax: 55000,
    requirement: '3 BHK in Vasant Kunj or Saket. Furnished. Need near international school.',
    leadScore: 62,
    temperature: LeadTemperature.WARM,
    status: LeadStatus.CONTACTED,
    notes: 'Expat family. Moving from Singapore in 2 months.',
    createdAt: daysAgo(2),
  },
  {
    agentEmail: 'agent3@example.com',
    contactName: 'Deepak Srivastava',
    contactPhone: '9830303030',
    contactEmail: 'deepak.s@gmail.com',
    city: 'Noida', state: 'Uttar Pradesh',
    source: LeadSource.SEARCH,
    propertyType: LeadPropertyType.RESIDENTIAL,
    budgetMin: 6000000, budgetMax: 9000000,
    requirement: '3 BHK in Sector 62 or 137. ATS, Mahagun, or Supertech preferred.',
    leadScore: 55,
    temperature: LeadTemperature.WARM,
    status: LeadStatus.FOLLOW_UP,
    notes: 'Gave 3 options. Waiting for him to visit this weekend.',
    createdAt: daysAgo(9),
  },
  {
    agentEmail: 'agent3@example.com',
    contactName: 'Sunita Yadav',
    contactPhone: '9840404040',
    city: 'Delhi', state: 'Delhi',
    source: LeadSource.CAMPAIGN,
    propertyType: LeadPropertyType.COMMERCIAL,
    budgetMin: 20000000, budgetMax: 40000000,
    requirement: 'Showroom or commercial space in Connaught Place or Nehru Place. Ground floor required.',
    leadScore: 78,
    temperature: LeadTemperature.HOT,
    status: LeadStatus.NEGOTIATION,
    notes: 'Budget confirmed by owner. Awaiting NOC from property owner.',
    createdAt: daysAgo(11),
  },
  {
    agentEmail: 'agent3@example.com',
    contactName: 'Arun Malhotra',
    contactPhone: '9850505050',
    city: 'Delhi', state: 'Delhi',
    source: LeadSource.CALL,
    propertyType: LeadPropertyType.PLOT,
    budgetMin: 50000000, budgetMax: 100000000,
    requirement: 'Farm house plot in Chattarpur or Mehrauli. Min 1000 sq yards with existing structure.',
    leadScore: 35,
    temperature: LeadTemperature.COLD,
    status: LeadStatus.NEW,
    notes: 'High-value enquiry. Yet to verify intent.',
    createdAt: hoursAgo(12),
  },
  {
    agentEmail: 'agent3@example.com',
    contactName: 'Leela Sharma',
    contactPhone: '9860606060',
    contactEmail: 'leela.s@yahoo.com',
    city: 'Gurgaon', state: 'Haryana',
    source: LeadSource.PORTAL_IMPORT,
    propertyType: LeadPropertyType.RESIDENTIAL,
    budgetMin: 9000000, budgetMax: 14000000,
    requirement: '3 BHK in DLF 5 or Golf Course Road. High-rise with pool view.',
    leadScore: 68,
    temperature: LeadTemperature.WARM,
    status: LeadStatus.DEAL_IN_PROGRESS,
    notes: 'Negotiated 5% discount. Token amount paid. Agreement being drafted.',
    createdAt: daysAgo(18),
  },

  // ── Hyderabad / agent4 ───────────────────────────────────────────────
  {
    agentEmail: 'agent4@example.com',
    contactName: 'Siddharth Rao',
    contactPhone: '9700001111',
    contactEmail: 'sid.rao@amazon.com',
    city: 'Hyderabad', state: 'Telangana',
    source: LeadSource.PROPERTY_PAGE,
    propertyType: LeadPropertyType.RESIDENTIAL,
    budgetMin: 8000000, budgetMax: 11000000,
    requirement: '3 BHK in Gachibowli or Kondapur. Near Amazon HQ. Need good connectivity.',
    leadScore: 82,
    temperature: LeadTemperature.HOT,
    status: LeadStatus.SITE_VISIT_SCHEDULED,
    notes: 'Amazon SDE2. Transferred from Bangalore. Wants possession in 3 months.',
    createdAt: daysAgo(1),
  },
  {
    agentEmail: 'agent4@example.com',
    contactName: 'Kavitha Nair',
    contactPhone: '9700002222',
    city: 'Hyderabad', state: 'Telangana',
    source: LeadSource.WHATSAPP,
    propertyType: LeadPropertyType.RENTAL,
    budgetMin: 20000, budgetMax: 35000,
    requirement: '2 BHK in Jubilee Hills or Banjara Hills. Furnished. 11-month lease.',
    leadScore: 58,
    temperature: LeadTemperature.WARM,
    status: LeadStatus.CONTACTED,
    notes: 'Interior designer looking for central location.',
    createdAt: daysAgo(3),
  },
  {
    agentEmail: 'agent4@example.com',
    contactName: 'Prasad Kulkarni',
    contactPhone: '9700003333',
    contactEmail: 'prasad.k@tcs.com',
    city: 'Hyderabad', state: 'Telangana',
    source: LeadSource.SEARCH,
    propertyType: LeadPropertyType.RESIDENTIAL,
    budgetMin: 4500000, budgetMax: 7000000,
    requirement: '2 BHK in HITEC City or Madhapur. Ready-to-move. South facing.',
    leadScore: 50,
    temperature: LeadTemperature.WARM,
    status: LeadStatus.FOLLOW_UP,
    notes: 'Visited 1 property. Wants more options.',
    createdAt: daysAgo(7),
  },
  {
    agentEmail: 'agent4@example.com',
    contactName: 'Lalitha Reddy',
    contactPhone: '9700004444',
    city: 'Hyderabad', state: 'Telangana',
    source: LeadSource.MANUAL,
    propertyType: LeadPropertyType.PLOT,
    budgetMin: 5000000, budgetMax: 8000000,
    requirement: 'Residential plot in Shamshabad or Yadagirigutta near highway. HMDA approved.',
    leadScore: 40,
    temperature: LeadTemperature.COLD,
    status: LeadStatus.NEW,
    notes: 'Walk-in client. Added manually.',
    createdAt: hoursAgo(3),
  },
  {
    agentEmail: 'agent4@example.com',
    contactName: 'Ravi Gupta',
    contactPhone: '9700005555',
    contactEmail: 'ravi.g@microsoft.com',
    city: 'Hyderabad', state: 'Telangana',
    source: LeadSource.CAMPAIGN,
    propertyType: LeadPropertyType.RESIDENTIAL,
    budgetMin: 14000000, budgetMax: 20000000,
    requirement: '4 BHK luxury apartment in Kokapet or Financial District. Must have club house, pool.',
    leadScore: 88,
    temperature: LeadTemperature.HOT,
    status: LeadStatus.DEAL_IN_PROGRESS,
    notes: 'Microsoft employee. Serious buyer. Negotiating on floor 18+ with city view.',
    createdAt: daysAgo(12),
  },
  {
    agentEmail: 'agent4@example.com',
    contactName: 'Harini Subramanian',
    contactPhone: '9700006666',
    city: 'Hyderabad', state: 'Telangana',
    source: LeadSource.CALL,
    propertyType: LeadPropertyType.COMMERCIAL,
    budgetMin: 6000000, budgetMax: 10000000,
    requirement: 'Office space 800–1200 sq ft in Somajiguda or Begumpet for IT startup.',
    leadScore: 66,
    temperature: LeadTemperature.WARM,
    status: LeadStatus.NEGOTIATION,
    notes: 'CEO of 15-person startup. Needs fully furnished plug-and-play office.',
    createdAt: daysAgo(9),
  },
];

// ── Activity log templates per status ─────────────────────────────────────────

function buildActivityLogs(leadId: string, agentId: string, status: LeadStatus, createdAt: Date): Partial<LeadActivityLog>[] {
  const logs: Partial<LeadActivityLog>[] = [
    {
      leadId,
      actorId: agentId,
      actorType: ActorType.AGENT,
      activityType: ActivityType.STATUS_CHANGE,
      oldValue: { status: LeadStatus.NEW },
      newValue: { status: LeadStatus.NEW },
      notes: 'Lead created and assigned',
      createdAt,
    },
  ];

  const progressions: [LeadStatus, ActivityType, string][] = [
    [LeadStatus.CONTACTED, ActivityType.CALL_LOGGED, 'First call made. Discussed requirements.'],
    [LeadStatus.FOLLOW_UP, ActivityType.NOTE_ADDED, 'Follow-up scheduled. Sent property brochures via WhatsApp.'],
    [LeadStatus.SITE_VISIT_SCHEDULED, ActivityType.VISIT_SCHEDULED, 'Site visit confirmed for the weekend.'],
    [LeadStatus.SITE_VISIT_COMPLETED, ActivityType.VISIT_COMPLETED, 'Visited 2 properties. Client impressed with second option.'],
    [LeadStatus.NEGOTIATION, ActivityType.NOTE_ADDED, 'Price negotiation in progress. Client asking for 5% discount.'],
    [LeadStatus.DEAL_IN_PROGRESS, ActivityType.DEAL_CREATED, 'Token amount received. Agreement drafting started.'],
    [LeadStatus.DEAL_WON, ActivityType.DEAL_CREATED, 'Deal closed successfully! Registration completed.'],
  ];

  const statusOrder = [
    LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.FOLLOW_UP,
    LeadStatus.SITE_VISIT_SCHEDULED, LeadStatus.SITE_VISIT_COMPLETED,
    LeadStatus.NEGOTIATION, LeadStatus.DEAL_IN_PROGRESS, LeadStatus.DEAL_WON,
  ];
  const currentIdx = statusOrder.indexOf(status);

  let logTime = new Date(createdAt);
  for (let i = 0; i < progressions.length; i++) {
    const [progStatus, actType, note] = progressions[i];
    if (statusOrder.indexOf(progStatus) > currentIdx) break;
    logTime = new Date(logTime.getTime() + 1000 * 60 * 60 * (12 + i * 24)); // +12h, +36h, +60h…
    logs.push({
      leadId,
      actorId: agentId,
      actorType: ActorType.AGENT,
      activityType: actType,
      oldValue: { status: statusOrder[i] },
      newValue: { status: progStatus },
      notes: note,
      createdAt: logTime,
    });
  }

  return logs;
}

// ── Main seed ─────────────────────────────────────────────────────────────────

async function seedLeads() {
  await dataSource.initialize();

  const leadRepo = dataSource.getRepository(Lead);
  const assignmentRepo = dataSource.getRepository(LeadAssignment);
  const activityRepo = dataSource.getRepository(LeadActivityLog);

  // Clear existing leads data
  console.log('Clearing existing leads data...');
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  const dbName = process.env.DB_NAME || 'realestate_db';
  for (const table of ['lead_activity_logs', 'lead_assignments', 'leads']) {
    const [exists] = await dataSource.query(
      `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
      [dbName, table],
    );
    if (Number(exists.cnt) > 0) {
      await dataSource.query(`TRUNCATE TABLE \`${table}\``);
    }
  }
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');

  // Resolve agent emails → user IDs via raw query (avoids entity relation graph)
  const agentEmails = ['agent1@example.com', 'agent2@example.com', 'agent3@example.com', 'agent4@example.com'];
  const placeholders = agentEmails.map(() => '?').join(', ');
  const agents: { id: string; email: string }[] = await dataSource.query(
    `SELECT id, email FROM users WHERE email IN (${placeholders})`,
    agentEmails,
  );

  if (agents.length === 0) {
    console.error('❌  No agent users found. Run seed.ts first.');
    process.exit(1);
  }

  const agentMap = new Map<string, string>(); // email → id
  for (const a of agents) agentMap.set(a.email, a.id);

  console.log(`Found ${agents.length} agents. Seeding ${LEAD_TEMPLATES.length} leads...`);

  let created = 0;
  for (const tpl of LEAD_TEMPLATES) {
    const agentId = agentMap.get(tpl.agentEmail);
    if (!agentId) { console.warn(`  Skipping — agent not found: ${tpl.agentEmail}`); continue; }

    const { agentEmail, createdAt, ...rest } = tpl;

    // Save lead
    const lead = leadRepo.create({
      ...rest,
      assignedAgentId: agentId,
      createdAt,
      updatedAt: createdAt,
    });
    const saved = await leadRepo.save(lead);

    // Save assignment
    await assignmentRepo.save(
      assignmentRepo.create({
        leadId: saved.id,
        agentId,
        assignmentType: AssignmentType.MANUAL,
        assignedBy: agentId,
        isActive: true,
        assignedAt: createdAt,
      }),
    );

    // Save activity logs
    const logs = buildActivityLogs(saved.id, agentId, tpl.status, createdAt);
    await activityRepo.save(logs.map((l) => activityRepo.create(l)));

    created++;
    console.log(`  ✓ [${tpl.status.padEnd(24)}] ${tpl.contactName} (${tpl.city}) → ${tpl.agentEmail}`);
  }

  await dataSource.destroy();

  console.log('');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅  Leads seeded: ${created}/${LEAD_TEMPLATES.length}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('Distribution:');
  for (const email of agentEmails) {
    const count = LEAD_TEMPLATES.filter((t) => t.agentEmail === email).length;
    console.log(`  ${email.padEnd(28)} ${count} leads`);
  }
}

seedLeads().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
