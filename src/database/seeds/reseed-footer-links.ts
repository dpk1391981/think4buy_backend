import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { FooterSeoLink, FooterSeoLinkGroup } from '../../modules/seo/entities/footer-seo-link.entity';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'dpk1391981',
  password: process.env.DB_PASSWORD || 'Dpk1391981!',
  database: process.env.DB_NAME || 'think4buysale',
  entities: [FooterSeoLink, FooterSeoLinkGroup],
  synchronize: false,
});

const slugOf = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

const TOP_CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Noida', 'Gurgaon', 'Kolkata', 'Ahmedabad'];

const FOOTER_GROUPS = [
  {
    title: 'Buy Property by City',
    sortOrder: 0,
    links: TOP_CITIES.map((city, i) => ({ label: `Property for Sale in ${city}`, url: `/property-for-sale-in-${slugOf(city)}`, sortOrder: i, isActive: true })),
  },
  {
    title: 'Rent Property by City',
    sortOrder: 1,
    links: TOP_CITIES.map((city, i) => ({ label: `Property for Rent in ${city}`, url: `/property-for-rent-in-${slugOf(city)}`, sortOrder: i, isActive: true })),
  },
  {
    title: 'Flats for Sale',
    sortOrder: 2,
    links: TOP_CITIES.map((city, i) => ({ label: `Flats for Sale in ${city}`, url: `/flats-for-sale-in-${slugOf(city)}`, sortOrder: i, isActive: true })),
  },
  {
    title: 'Flats for Rent',
    sortOrder: 3,
    links: TOP_CITIES.map((city, i) => ({ label: `Flats for Rent in ${city}`, url: `/flats-for-rent-in-${slugOf(city)}`, sortOrder: i, isActive: true })),
  },
  {
    title: 'Villas & Independent Houses',
    sortOrder: 4,
    links: TOP_CITIES.map((city, i) => ({ label: `Villas for Sale in ${city}`, url: `/villas-for-sale-in-${slugOf(city)}`, sortOrder: i, isActive: true })),
  },
  {
    title: 'Plots & Land',
    sortOrder: 5,
    links: TOP_CITIES.map((city, i) => ({ label: `Plots for Sale in ${city}`, url: `/plots-for-sale-in-${slugOf(city)}`, sortOrder: i, isActive: true })),
  },
  {
    title: 'Commercial Property',
    sortOrder: 6,
    links: TOP_CITIES.map((city, i) => ({ label: `Commercial Property in ${city}`, url: `/commercial-property-in-${slugOf(city)}`, sortOrder: i, isActive: true })),
  },
  {
    title: 'Office Space for Rent',
    sortOrder: 7,
    links: TOP_CITIES.map((city, i) => ({ label: `Office Space for Rent in ${city}`, url: `/office-space-for-rent-in-${slugOf(city)}`, sortOrder: i, isActive: true })),
  },
  {
    title: 'New Projects',
    sortOrder: 8,
    links: TOP_CITIES.map((city, i) => ({ label: `New Projects in ${city}`, url: `/new-projects-in-${slugOf(city)}`, sortOrder: i, isActive: true })),
  },
  {
    title: 'PG / Co-Living',
    sortOrder: 9,
    links: TOP_CITIES.map((city, i) => ({ label: `PG in ${city}`, url: `/pg-in-${slugOf(city)}`, sortOrder: i, isActive: true })),
  },
];

async function run() {
  await dataSource.initialize();
  const groupRepo = dataSource.getRepository(FooterSeoLinkGroup);
  const linkRepo = dataSource.getRepository(FooterSeoLink);

  // Clear existing
  await linkRepo.query('DELETE FROM footer_seo_links');
  await groupRepo.query('DELETE FROM footer_seo_link_groups');
  console.log('Cleared existing footer SEO links');

  for (const groupDef of FOOTER_GROUPS) {
    const group = await groupRepo.save({ title: groupDef.title, sortOrder: groupDef.sortOrder, isActive: true });
    for (const link of groupDef.links) {
      await linkRepo.save({ groupId: group.id, ...link });
    }
    console.log(`  ✓ ${groupDef.title} (${groupDef.links.length} links)`);
  }

  console.log('\nFooter SEO links reseeded successfully!');
  await dataSource.destroy();
}

run().catch(e => { console.error(e); process.exit(1); });
