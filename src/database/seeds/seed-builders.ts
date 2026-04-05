/**
 * Builder Users Seeder
 * ---------------------
 * Creates sample builder accounts with realistic company details and
 * seeds a few `builder_project` properties per builder.
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/seed-builders.ts
 *
 * Idempotent — safe to run multiple times.
 * Feature flag ENABLE_BUILDER_REGISTRATION is created (default: false).
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require('bcryptjs');
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ─── DataSource ───────────────────────────────────────────────────────────────

const dataSource = new DataSource({
  type:        'mysql',
  host:        process.env.DB_HOST     || 'localhost',
  port:        parseInt(process.env.DB_PORT || '3306'),
  username:    process.env.DB_USERNAME || 'root',
  password:    process.env.DB_PASSWORD || '',
  database:    process.env.DB_NAME     || 'realestate_db',
  entities:    [path.resolve(__dirname, '../../modules/**/*.entity.{ts,js}')],
  synchronize: false,
  charset:     'utf8mb4',
});

// ─── Builder definitions ──────────────────────────────────────────────────────

interface BuilderDef {
  name:               string;
  email:              string;
  phone:              string;
  password:           string;
  city:               string;
  builderCompanyName: string;
  builderReraNumber:  string;
  builderExperience:  number;
  builderWebsite:     string;
  builderProjectCount: number;
  projects:           ProjectDef[];
}

interface ProjectDef {
  title:             string;
  slug:              string;
  description:       string;
  city:              string;
  state:             string;
  locality:          string;
  price:             number;
  priceUnit:         string;
  possessionStatus:  string;
  isNewProject:      boolean;
  bedrooms:          number | null;
  bathrooms:         number | null;
  area:              number;
  areaUnit:          string;
  totalFloors:       number | null;
}

const DEFAULT_PASSWORD = 'Builder@123';

const BUILDERS: BuilderDef[] = [
  // ── 1. Godrej Properties ────────────────────────────────────────────────────
  {
    name:               'Godrej Properties Admin',
    email:              'projects@godrejproperties.example.com',
    phone:              '9811000001',
    password:           DEFAULT_PASSWORD,
    city:               'Mumbai',
    builderCompanyName: 'Godrej Properties Ltd.',
    builderReraNumber:  'A51800000001',
    builderExperience:  35,
    builderWebsite:     'https://www.godrejproperties.com',
    builderProjectCount: 150,
    projects: [
      {
        title:            'Godrej Emerald — 2 & 3 BHK Luxury Apartments in Thane',
        slug:             'godrej-emerald-thane',
        description:      'Godrej Emerald offers spacious 2 & 3 BHK apartments nestled in a lush 6-acre township in Thane West. Enjoy world-class amenities including a clubhouse, swimming pool, landscaped gardens and dedicated kids play areas.',
        city:             'Thane',
        state:            'Maharashtra',
        locality:         'Thane West',
        price:            8500000,
        priceUnit:        'total',
        possessionStatus: 'ready_to_move',
        isNewProject:     false,
        bedrooms:         3,
        bathrooms:        3,
        area:             1350,
        areaUnit:         'sqft',
        totalFloors:      32,
      },
      {
        title:            'Godrej Reserve — Premium Villas in Kandivali East',
        slug:             'godrej-reserve-kandivali',
        description:      'Godrej Reserve is an exclusive gated community offering ultra-premium 3 & 4 BHK residences with private terraces, infinity pool and 5-star concierge services in the heart of Kandivali East, Mumbai.',
        city:             'Mumbai',
        state:            'Maharashtra',
        locality:         'Kandivali East',
        price:            18000000,
        priceUnit:        'total',
        possessionStatus: 'under_construction',
        isNewProject:     true,
        bedrooms:         4,
        bathrooms:        4,
        area:             2200,
        areaUnit:         'sqft',
        totalFloors:      28,
      },
      {
        title:            'Godrej Horizon — 2 BHK Affordable Homes in Noida',
        slug:             'godrej-horizon-noida',
        description:      'Godrej Horizon brings affordable luxury to Noida Sector 43 with well-designed 2 BHK apartments, modern amenities and excellent connectivity to Delhi-NCR via the expressway.',
        city:             'Noida',
        state:            'Uttar Pradesh',
        locality:         'Sector 43',
        price:            6200000,
        priceUnit:        'total',
        possessionStatus: 'under_construction',
        isNewProject:     false,
        bedrooms:         2,
        bathrooms:        2,
        area:             1050,
        areaUnit:         'sqft',
        totalFloors:      24,
      },
    ],
  },

  // ── 2. Eldeco Group ──────────────────────────────────────────────────────────
  {
    name:               'Eldeco Group Admin',
    email:              'projects@eldeco.example.com',
    phone:              '9811000002',
    password:           DEFAULT_PASSWORD,
    city:               'Lucknow',
    builderCompanyName: 'Eldeco Infrastructure & Properties Ltd.',
    builderReraNumber:  'UPRERAPRJ12345',
    builderExperience:  40,
    builderWebsite:     'https://www.eldeco.com',
    builderProjectCount: 80,
    projects: [
      {
        title:            'Eldeco Live by the Greens — 3 BHK Apartments in Lucknow',
        slug:             'eldeco-live-by-greens-lucknow',
        description:      'Eldeco Live by the Greens is an integrated township in Lucknow featuring 3 BHK spacious apartments surrounded by 70% open green spaces, a 9-hole golf course and a world-class clubhouse.',
        city:             'Lucknow',
        state:            'Uttar Pradesh',
        locality:         'Shaheed Path',
        price:            7500000,
        priceUnit:        'total',
        possessionStatus: 'ready_to_move',
        isNewProject:     false,
        bedrooms:         3,
        bathrooms:        3,
        area:             1800,
        areaUnit:         'sqft',
        totalFloors:      14,
      },
      {
        title:            'Eldeco Acclaim — 2 & 3 BHK New Launch in Gurugram',
        slug:             'eldeco-acclaim-gurugram',
        description:      'Eldeco Acclaim is a brand-new residential community in Sector 65, Gurugram offering 2 & 3 BHK apartments with modern layouts, rooftop infinity pool and proximity to Cyber City and Golf Course Extension Road.',
        city:             'Gurugram',
        state:            'Haryana',
        locality:         'Sector 65',
        price:            11500000,
        priceUnit:        'total',
        possessionStatus: 'under_construction',
        isNewProject:     true,
        bedrooms:         3,
        bathrooms:        3,
        area:             1600,
        areaUnit:         'sqft',
        totalFloors:      20,
      },
    ],
  },

  // ── 3. Gaurs Group ───────────────────────────────────────────────────────────
  {
    name:               'Gaurs Group Admin',
    email:              'projects@gaursgroup.example.com',
    phone:              '9811000003',
    password:           DEFAULT_PASSWORD,
    city:               'Ghaziabad',
    builderCompanyName: 'Gaurs Group',
    builderReraNumber:  'UPRERAPRJ67890',
    builderExperience:  30,
    builderWebsite:     'https://www.gaursgroup.com',
    builderProjectCount: 60,
    projects: [
      {
        title:            'Gaur Atulyam — 3 BHK Ultra Luxury Residences in Greater Noida West',
        slug:             'gaur-atulyam-greater-noida-west',
        description:      'Gaur Atulyam is a flagship luxury project located in Greater Noida West offering grand 3 & 4 BHK residences with 100+ amenities including a sports arena, spa, private theatre and concierge desk.',
        city:             'Greater Noida',
        state:            'Uttar Pradesh',
        locality:         'Greater Noida West',
        price:            9800000,
        priceUnit:        'total',
        possessionStatus: 'under_construction',
        isNewProject:     true,
        bedrooms:         3,
        bathrooms:        3,
        area:             2000,
        areaUnit:         'sqft',
        totalFloors:      35,
      },
      {
        title:            'Gaurs 16th Parkview — 2 BHK Apartments in Ghaziabad',
        slug:             'gaurs-16th-parkview-ghaziabad',
        description:      'Gaurs 16th Parkview offers smartly designed 2 BHK apartments in Ghaziabad prime location with a central park, metro connectivity and easy access to NH-58. Ideal for first-time home buyers.',
        city:             'Ghaziabad',
        state:            'Uttar Pradesh',
        locality:         'Crossings Republik',
        price:            4500000,
        priceUnit:        'total',
        possessionStatus: 'ready_to_move',
        isNewProject:     false,
        bedrooms:         2,
        bathrooms:        2,
        area:             900,
        areaUnit:         'sqft',
        totalFloors:      18,
      },
      {
        title:            'Gaur Yamuna City — Plots for Sale in Yamuna Expressway',
        slug:             'gaur-yamuna-city-plots',
        description:      'Gaur Yamuna City is one of NCR largest integrated townships along the Yamuna Expressway offering residential plots ranging from 100 to 500 sq. yards with wide internal roads and fully developed infrastructure.',
        city:             'Greater Noida',
        state:            'Uttar Pradesh',
        locality:         'Yamuna Expressway',
        price:            2800000,
        priceUnit:        'total',
        possessionStatus: 'ready_to_move',
        isNewProject:     false,
        bedrooms:         null,
        bathrooms:        null,
        area:             900,
        areaUnit:         'sqft',
        totalFloors:      null,
      },
    ],
  },

  // ── 4. DLF Limited ───────────────────────────────────────────────────────────
  {
    name:               'DLF Projects Admin',
    email:              'projects@dlf.example.com',
    phone:              '9811000004',
    password:           DEFAULT_PASSWORD,
    city:               'Gurugram',
    builderCompanyName: 'DLF Limited',
    builderReraNumber:  'HRERAGGM12345',
    builderExperience:  75,
    builderWebsite:     'https://www.dlf.in',
    builderProjectCount: 300,
    projects: [
      {
        title:            'DLF The Camellias — Ultra Luxury Apartments in Gurugram',
        slug:             'dlf-the-camellias-gurugram',
        description:      'DLF The Camellias is a super-luxury residential masterpiece on Golf Course Road, Gurugram featuring 4 & 5 BHK sky villas with private pools, butler service, CCTV-monitored perimeter and seamless connectivity to Cyber Hub.',
        city:             'Gurugram',
        state:            'Haryana',
        locality:         'Golf Course Road',
        price:            80000000,
        priceUnit:        'total',
        possessionStatus: 'ready_to_move',
        isNewProject:     false,
        bedrooms:         4,
        bathrooms:        5,
        area:             6000,
        areaUnit:         'sqft',
        totalFloors:      38,
      },
      {
        title:            'DLF Privana South — New Launch 4 BHK in Sector 77',
        slug:             'dlf-privana-south-gurugram',
        description:      'DLF Privana South is a highly anticipated new launch in Sector 77, Gurugram offering 4 BHK ultra-premium residences with panoramic Aravalli views, a signature clubhouse spanning 70,000 sq ft and co-working spaces.',
        city:             'Gurugram',
        state:            'Haryana',
        locality:         'Sector 77',
        price:            55000000,
        priceUnit:        'total',
        possessionStatus: 'under_construction',
        isNewProject:     true,
        bedrooms:         4,
        bathrooms:        4,
        area:             3500,
        areaUnit:         'sqft',
        totalFloors:      42,
      },
      {
        title:            'DLF Garden City Homes — 2 BHK Ready Apartments in Chennai',
        slug:             'dlf-garden-city-homes-chennai',
        description:      'DLF Garden City Homes in Porur, Chennai offers 2 BHK fully ready apartments with vastu-compliant layouts, landscaped gardens, a gymnasium and a dedicated childrens learning centre. Excellent connectivity to Old Mahabalipuram Road.',
        city:             'Chennai',
        state:            'Tamil Nadu',
        locality:         'Porur',
        price:            7800000,
        priceUnit:        'total',
        possessionStatus: 'ready_to_move',
        isNewProject:     false,
        bedrooms:         2,
        bathrooms:        2,
        area:             1100,
        areaUnit:         'sqft',
        totalFloors:      12,
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ─── CLI Argument Parsing ─────────────────────────────────────────────────────
// Usage:
//   npx ts-node ... seed-builders.ts                       → seed all builders
//   npx ts-node ... seed-builders.ts --id=<userId>         → re-seed by user UUID
//   npx ts-node ... seed-builders.ts --email=<email>       → re-seed by email

function parseArgs(): { filterId?: string; filterEmail?: string } {
  const args = process.argv.slice(2);
  let filterId: string | undefined;
  let filterEmail: string | undefined;
  for (const arg of args) {
    const idMatch    = arg.match(/^--id=(.+)$/);
    const emailMatch = arg.match(/^--email=(.+)$/);
    if (idMatch)    filterId    = idMatch[1];
    if (emailMatch) filterEmail = emailMatch[1];
  }
  return { filterId, filterEmail };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  await dataSource.initialize();
  console.log('✅ DB connected\n');

  const { filterId, filterEmail } = parseArgs();

  // If --id or --email is provided, seed only the matching builder
  let buildersToSeed = BUILDERS;
  if (filterId || filterEmail) {
    if (filterId) {
      // Look up the user by ID to find their email
      const rows = await dataSource.query(
        `SELECT email FROM users WHERE id = ? AND role = 'builder' LIMIT 1`, [filterId],
      );
      if (!rows.length) {
        console.error(`❌ No builder user found with id: ${filterId}`);
        process.exit(1);
      }
      const targetEmail = rows[0].email as string;
      buildersToSeed = BUILDERS.filter((b) => b.email === targetEmail);
      if (!buildersToSeed.length) {
        // If the user exists in DB but isn't in our BUILDERS array, create a minimal entry
        // by seeding projects for whoever already exists (re-seed their projects only)
        const [user] = await dataSource.query(
          `SELECT * FROM users WHERE id = ? LIMIT 1`, [filterId],
        );
        console.log(`ℹ️  Builder ID ${filterId} not in static BUILDERS list — seeding from DB profile.`);
        console.log(`   Company: ${user.builderCompanyName || '(none)'}`);
        console.log(`   No static projects to seed. Exiting gracefully.`);
        await dataSource.destroy();
        return;
      }
    } else if (filterEmail) {
      buildersToSeed = BUILDERS.filter((b) => b.email === filterEmail);
      if (!buildersToSeed.length) {
        console.error(`❌ No builder in BUILDERS list matches email: ${filterEmail}`);
        process.exit(1);
      }
    }
    console.log(`🎯 Seeding only: ${buildersToSeed.map((b) => b.builderCompanyName).join(', ')}\n`);
  }

  // ── 0. Ensure ENABLE_BUILDER_REGISTRATION feature flag exists ────────────────
  const [existingFlag] = await dataSource.query(
    `SELECT id FROM system_configs WHERE \`key\` = 'ENABLE_BUILDER_REGISTRATION' LIMIT 1`,
  );
  if (!existingFlag) {
    await dataSource.query(
      `INSERT INTO system_configs (id, \`key\`, value, valueType, description, \`group\`, isSecret, createdAt, updatedAt)
       VALUES (UUID(), 'ENABLE_BUILDER_REGISTRATION', 'false', 'boolean',
               'Allow public builder registration on the platform. When true, builders can self-register and post projects.',
               'features', 0, NOW(), NOW())`,
    );
    console.log('✅ Created system config: ENABLE_BUILDER_REGISTRATION = false');
  } else {
    console.log('ℹ️  System config ENABLE_BUILDER_REGISTRATION already exists — skipping');
  }

  // ── 1. Ensure builder RBAC role exists ──────────────────────────────────────
  const [existingBuilderRole] = await dataSource.query(
    `SELECT id FROM roles WHERE name = 'builder' LIMIT 1`,
  );
  let builderRoleId: string | null = existingBuilderRole?.id ?? null;

  if (!builderRoleId) {
    await dataSource.query(
      `INSERT INTO roles (id, name, displayName, description, isSystem, isActive, level, createdAt, updatedAt)
       VALUES (UUID(), 'builder', 'Builder / Developer', 'Real-estate developer / builder company account', 1, 1, 30, NOW(), NOW())`,
    );
    const [row] = await dataSource.query(`SELECT id FROM roles WHERE name = 'builder' LIMIT 1`);
    builderRoleId = row.id;
    console.log('✅ Created RBAC role: builder —', builderRoleId);
  } else {
    console.log('ℹ️  RBAC role "builder" already exists —', builderRoleId);
  }

  // ── 2. Upsert each builder user and their projects ──────────────────────────
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  for (const b of buildersToSeed) {
    console.log(`\n── Processing: ${b.builderCompanyName} ──────────────────────────`);

    // 2a. Upsert builder user
    const [existingUser] = await dataSource.query(
      `SELECT id FROM users WHERE email = ? LIMIT 1`, [b.email],
    );

    let userId: string;

    if (existingUser) {
      await dataSource.query(
        `UPDATE users
         SET name = ?, phone = ?, password = ?, role = 'builder', systemRoleId = ?,
             city = ?, isActive = 1, isVerified = 1, needsOnboarding = 0,
             builderCompanyName = ?, builderReraNumber = ?, builderExperience = ?,
             builderWebsite = ?, builderProjectCount = ?, builderVerified = 1,
             updatedAt = NOW()
         WHERE id = ?`,
        [
          b.name, b.phone, hashed, builderRoleId,
          b.city,
          b.builderCompanyName, b.builderReraNumber, b.builderExperience,
          b.builderWebsite, b.builderProjectCount, existingUser.id,
        ],
      );
      userId = existingUser.id;
      console.log(`  ℹ️  Updated existing user  → ${userId}`);
    } else {
      await dataSource.query(
        `INSERT INTO users
           (id, name, email, phone, password, role, systemRoleId,
            city, isActive, isVerified, needsOnboarding, isSuperAdmin,
            builderCompanyName, builderReraNumber, builderExperience,
            builderWebsite, builderProjectCount, builderVerified,
            agentFreeQuota, agentUsedQuota, agentTick, agentProfileStatus,
            totalDeals, dailyCreditUsed, failedLoginAttempts,
            createdAt, updatedAt)
         VALUES
           (UUID(), ?, ?, ?, ?, 'builder', ?,
            ?, 1, 1, 0, 0,
            ?, ?, ?,
            ?, ?, 1,
            0, 0, 'none', 'none',
            0, 0, 0,
            NOW(), NOW())`,
        [
          b.name, b.email, b.phone, hashed, builderRoleId,
          b.city,
          b.builderCompanyName, b.builderReraNumber, b.builderExperience,
          b.builderWebsite, b.builderProjectCount,
        ],
      );
      const [newUser] = await dataSource.query(
        `SELECT id FROM users WHERE email = ? LIMIT 1`, [b.email],
      );
      userId = newUser.id;
      console.log(`  ✅  Created new user        → ${userId}`);
    }

    // 2b. Upsert each project for this builder
    for (const p of b.projects) {
      const [existingProp] = await dataSource.query(
        `SELECT id FROM properties WHERE slug = ? LIMIT 1`, [p.slug],
      );

      if (existingProp) {
        await dataSource.query(
          `UPDATE properties
           SET title = ?, description = ?, city = ?, state = ?, locality = ?,
               price = ?, priceUnit = ?, possessionStatus = ?, isNewProject = ?,
               bedrooms = ?, bathrooms = ?, area = ?, areaUnit = ?,
               totalFloors = ?, builderName = ?, category = 'builder_project',
               listingType = 'buy', listedBy = 'builder', ownerId = ?,
               approvalStatus = 'approved', status = 'active',
               updatedAt = NOW()
           WHERE id = ?`,
          [
            p.title, p.description, p.city, p.state, p.locality,
            p.price, p.priceUnit, p.possessionStatus, p.isNewProject ? 1 : 0,
            p.bedrooms, p.bathrooms, p.area, p.areaUnit,
            p.totalFloors, b.builderCompanyName, userId,
            existingProp.id,
          ],
        );
        console.log(`  ℹ️  Updated property: ${p.slug}`);
      } else {
        await dataSource.query(
          `INSERT INTO properties
             (id, title, slug, description, city, state, locality,
              price, priceUnit, possessionStatus, isNewProject,
              bedrooms, bathrooms, area, areaUnit, totalFloors,
              builderName, category, listingType, listedBy, ownerId,
              approvalStatus, status,
              furnishingStatus, listingPlan, type,
              isFeatured, isPremium,
              viewCount,
              createdAt, updatedAt)
           VALUES
             (UUID(), ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, 'builder_project', 'buy', 'builder', ?,
              'approved', 'active',
              'unfurnished', 'free', 'apartment',
              0, 0,
              0,
              NOW(), NOW())`,
          [
            p.title, p.slug, p.description, p.city, p.state, p.locality,
            p.price, p.priceUnit, p.possessionStatus, p.isNewProject ? 1 : 0,
            p.bedrooms, p.bathrooms, p.area, p.areaUnit, p.totalFloors,
            b.builderCompanyName, userId,
          ],
        );
        console.log(`  ✅  Created property: ${p.slug}`);
      }
    }
  }

  // ── 3. Summary ──────────────────────────────────────────────────────────────
  console.log('\n🎉 Builder seeder completed successfully!');
  console.log('────────────────────────────────────────────────────');
  console.log('Default password for all builder accounts:', DEFAULT_PASSWORD);
  console.log('Change after first login!\n');
  for (const b of buildersToSeed) {
    console.log(`  ${b.builderCompanyName}`);
    console.log(`    Email : ${b.email}`);
    console.log(`    Phone : ${b.phone}`);
    console.log(`    RERA  : ${b.builderReraNumber}\n`);
  }

  await dataSource.destroy();
}

run().catch((err) => {
  console.error('❌ Builder seeder failed:', err.message);
  process.exit(1);
});
