import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../../modules/users/entities/user.entity';
import { Amenity, AmenityCategory } from '../../modules/properties/entities/amenity.entity';
import {
  Property,
  PropertyType,
  PropertyCategory,
  FurnishingStatus,
  PossessionStatus,
  ListingPlan,
  ListingUserType,
  ApprovalStatus,
  PropertyStatus,
} from '../../modules/properties/entities/property.entity';
import { Agency } from '../../modules/agency/entities/agency.entity';
import { AgentProfile } from '../../modules/agency/entities/agent-profile.entity';
import { PropertyAgentMap } from '../../modules/agency/entities/property-agent-map.entity';
import { AgentLocationMap } from '../../modules/agency/entities/agent-location-map.entity';
import { PropertyImage } from '../../modules/properties/entities/property-image.entity';
import { Location } from '../../modules/locations/entities/location.entity';
import { Inquiry } from '../../modules/inquiries/entities/inquiry.entity';
import { ServiceCatalog, ServiceType } from '../../modules/services-catalog/entities/service-catalog.entity';
import { Wallet } from '../../modules/wallet/entities/wallet.entity';
import { WalletTransaction, TransactionType, TransactionReason } from '../../modules/wallet/entities/wallet-transaction.entity';
import { BoostPlan } from '../../modules/wallet/entities/boost-plan.entity';
import { SubscriptionPlan, PlanType } from '../../modules/wallet/entities/subscription-plan.entity';
import { State } from '../../modules/locations/entities/state.entity';
import { City } from '../../modules/locations/entities/city.entity';
import { Country } from '../../modules/locations/entities/country.entity';
import { PropCategory } from '../../modules/property-config/entities/prop-category.entity';
import { PropType } from '../../modules/property-config/entities/prop-type.entity';
import { PropTypeAmenity } from '../../modules/property-config/entities/prop-type-amenity.entity';
import { PropTypeField, FieldType } from '../../modules/property-config/entities/prop-type-field.entity';
import { CategoryAnalytics } from '../../modules/analytics/entities/category-analytics.entity';
import { FooterSeoLink, FooterSeoLinkGroup } from '../../modules/seo/entities/footer-seo-link.entity';
import { SeoConfig } from '../../modules/seo/entities/seo-config.entity';
import { CityPage } from '../../modules/seo/entities/city-page.entity';

console.log("DB USER:", process.env.DB_USERNAME);

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'dpk1391981',
  password: process.env.DB_PASSWORD || 'Dpk1391981!',
  database: process.env.DB_NAME || 'realestate_db',
  entities: [User, Amenity, Property, PropertyImage, Location, Inquiry, ServiceCatalog, Wallet, WalletTransaction, BoostPlan, SubscriptionPlan, State, City, Country, PropCategory, PropType, PropTypeAmenity, PropTypeField, CategoryAnalytics, FooterSeoLink, FooterSeoLinkGroup, SeoConfig, CityPage, Agency, AgentProfile, PropertyAgentMap, AgentLocationMap],
  synchronize: true,
});

function futureDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function seed() {
  await dataSource.initialize();
  console.log('Clearing existing data...');

  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const entity of [
    'lead_activity_logs', 'lead_assignments', 'leads',
    'agent_location_map', 'property_agent_map', 'agent_profiles', 'agencies',
    'property_amenities', 'property_images', 'inquiries', 'properties',
    'services_catalog', 'locations', 'wallet_transactions', 'wallets',
    'boost_plans', 'subscription_plans', 'cities', 'states', 'countries', 'users', 'amenities',
    'category_analytics', 'footer_seo_links', 'footer_seo_link_groups', 'seo_configs', 'city_seo_pages',
  ]) {
    await dataSource.query(`TRUNCATE TABLE \`${entity}\``);
  }
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('Cleared all tables');

  // ─── Amenities ────────────────────────────────────────────────────────────────
  const amenityRepo = dataSource.getRepository(Amenity);
  await amenityRepo.save([
    { name: 'Swimming Pool', icon: 'pool', category: AmenityCategory.RECREATION },
    { name: 'Gym / Fitness Center', icon: 'fitness_center', category: AmenityCategory.RECREATION },
    { name: 'Clubhouse', icon: 'domain', category: AmenityCategory.SOCIETY },
    { name: 'Children Play Area', icon: 'child_care', category: AmenityCategory.RECREATION },
    { name: 'Security / CCTV', icon: 'security', category: AmenityCategory.SECURITY },
    { name: 'Power Backup', icon: 'electrical_services', category: AmenityCategory.BASIC },
    { name: 'Lift / Elevator', icon: 'elevator', category: AmenityCategory.BASIC },
    { name: 'Car Parking', icon: 'local_parking', category: AmenityCategory.BASIC },
    { name: 'Garden / Park', icon: 'park', category: AmenityCategory.RECREATION },
    { name: 'Jogging Track', icon: 'directions_run', category: AmenityCategory.RECREATION },
    { name: 'Indoor Games', icon: 'sports_esports', category: AmenityCategory.RECREATION },
    { name: 'Intercom', icon: 'settings_phone', category: AmenityCategory.SECURITY },
    { name: 'Water Supply 24/7', icon: 'water', category: AmenityCategory.BASIC },
    { name: 'Gas Pipeline', icon: 'local_gas_station', category: AmenityCategory.BASIC },
    { name: 'WiFi / Internet', icon: 'wifi', category: AmenityCategory.BASIC },
    { name: 'Shopping Center', icon: 'shopping_cart', category: AmenityCategory.SOCIETY },
    { name: 'Spa & Sauna', icon: 'spa', category: AmenityCategory.RECREATION },
    { name: 'Basketball Court', icon: 'sports_basketball', category: AmenityCategory.RECREATION },
    { name: 'Tennis Court', icon: 'sports_tennis', category: AmenityCategory.RECREATION },
    { name: 'Rooftop Terrace', icon: 'rooftop', category: AmenityCategory.RECREATION },
  ]);

  // ─── Services ─────────────────────────────────────────────────────────────────
  const serviceRepo = dataSource.getRepository(ServiceCatalog);
  await serviceRepo.save([
    { name: 'Home Loan', slug: 'home-loan', description: 'Get best home loan rates from top banks. Compare and apply online.', icon: 'bank', type: ServiceType.HOME_LOAN, ctaText: 'Check Eligibility', isActive: true, sortOrder: 0 },
    { name: 'Legal Services', slug: 'legal-services', description: 'Expert legal advice for property registration, agreements & more.', icon: 'legal', type: ServiceType.LEGAL, ctaText: 'Get Legal Help', isActive: true, sortOrder: 1 },
    { name: 'Interior Design', slug: 'interior-design', description: 'Transform your new home with our expert interior designers.', icon: 'interior', type: ServiceType.INTERIOR, ctaText: 'Get Free Quote', isActive: true, sortOrder: 2 },
    { name: 'Packers & Movers', slug: 'packers-movers', description: 'Safe and affordable shifting services across India.', icon: 'movers', type: ServiceType.PACKERS_MOVERS, ctaText: 'Get Quote', isActive: true, sortOrder: 3 },
    { name: 'Vastu Consultation', slug: 'vastu-consultation', description: 'Expert Vastu Shastra guidance for your home or office.', icon: 'vastu', type: ServiceType.VASTU, ctaText: 'Book Consultation', isActive: true, sortOrder: 4 },
    { name: 'Property Management', slug: 'property-management', description: 'End-to-end property management for NRI and investors.', icon: 'key', type: ServiceType.PROPERTY_MANAGEMENT, ctaText: 'Learn More', isActive: true, sortOrder: 5 },
  ]);

  // ─── Locations ────────────────────────────────────────────────────────────────
  const locationRepo = dataSource.getRepository(Location);
  const LOCATIONS = [
    { city: 'Mumbai', state: 'Maharashtra', locality: 'Bandra West', pincode: '400050', propertyCount: 450 },
    { city: 'Mumbai', state: 'Maharashtra', locality: 'Powai', pincode: '400076', propertyCount: 320 },
    { city: 'Mumbai', state: 'Maharashtra', locality: 'Andheri East', pincode: '400069', propertyCount: 280 },
    { city: 'Mumbai', state: 'Maharashtra', locality: 'Juhu', pincode: '400049', propertyCount: 190 },
    { city: 'Delhi', state: 'Delhi', locality: 'Greater Kailash', pincode: '110048', propertyCount: 310 },
    { city: 'Delhi', state: 'Delhi', locality: 'Vasant Kunj', pincode: '110070', propertyCount: 245 },
    { city: 'Delhi', state: 'Delhi', locality: 'Dwarka', pincode: '110075', propertyCount: 380 },
    { city: 'Delhi', state: 'Delhi', locality: 'Saket', pincode: '110017', propertyCount: 210 },
    { city: 'Bangalore', state: 'Karnataka', locality: 'Koramangala', pincode: '560034', propertyCount: 520 },
    { city: 'Bangalore', state: 'Karnataka', locality: 'Whitefield', pincode: '560066', propertyCount: 480 },
    { city: 'Bangalore', state: 'Karnataka', locality: 'Indiranagar', pincode: '560038', propertyCount: 350 },
    { city: 'Bangalore', state: 'Karnataka', locality: 'HSR Layout', pincode: '560102', propertyCount: 290 },
    { city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 62', pincode: '201309', propertyCount: 340 },
    { city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 137', pincode: '201304', propertyCount: 420 },
    { city: 'Gurgaon', state: 'Haryana', locality: 'DLF Phase 2', pincode: '122002', propertyCount: 380 },
    { city: 'Gurgaon', state: 'Haryana', locality: 'Sohna Road', pincode: '122018', propertyCount: 290 },
    { city: 'Hyderabad', state: 'Telangana', locality: 'Gachibowli', pincode: '500032', propertyCount: 460 },
    { city: 'Hyderabad', state: 'Telangana', locality: 'Kondapur', pincode: '500084', propertyCount: 380 },
    { city: 'Pune', state: 'Maharashtra', locality: 'Baner', pincode: '411045', propertyCount: 340 },
    { city: 'Pune', state: 'Maharashtra', locality: 'Viman Nagar', pincode: '411014', propertyCount: 260 },
    { city: 'Chennai', state: 'Tamil Nadu', locality: 'Anna Nagar', pincode: '600040', propertyCount: 310 },
    { city: 'Chennai', state: 'Tamil Nadu', locality: 'OMR', pincode: '600097', propertyCount: 280 },
    { city: 'Kolkata', state: 'West Bengal', locality: 'Salt Lake', pincode: '700064', propertyCount: 240 },
    { city: 'Ahmedabad', state: 'Gujarat', locality: 'Prahlad Nagar', pincode: '380015', propertyCount: 190 },
    { city: 'Jaipur', state: 'Rajasthan', locality: 'Vaishali Nagar', pincode: '302021', propertyCount: 160 },
    { city: 'Ghaziabad', state: 'Uttar Pradesh', locality: 'Indirapuram', pincode: '201014', propertyCount: 310 },
    { city: 'Lucknow', state: 'Uttar Pradesh', locality: 'Gomti Nagar', pincode: '226010', propertyCount: 220 },
    { city: 'Kochi', state: 'Kerala', locality: 'Kakkanad', pincode: '682030', propertyCount: 175 },
  ];
  for (const loc of LOCATIONS) {
    await locationRepo.save(locationRepo.create({ ...loc, isActive: true }));
  }

  // ─── Users ────────────────────────────────────────────────────────────────────
  const userRepo = dataSource.getRepository(User);

  const admin = await userRepo.save({ name: 'Admin User', email: 'admin@realestate.com', password: await bcrypt.hash('Admin@123', 10), role: UserRole.ADMIN, isVerified: true, phone: '9958023001' });
   const admin2 = await userRepo.save({ name: 'Admin User', email: 'admin2@realestate.com', password: await bcrypt.hash('Admin@123', 10), role: UserRole.ADMIN, isVerified: true, phone: '8285257636' });
  const seller = await userRepo.save({ name: 'Rajesh Kumar', email: 'seller@example.com', phone: '9876543210', password: await bcrypt.hash('Seller@123', 10), role: UserRole.SELLER, city: 'Mumbai', state: 'Maharashtra', isVerified: true });
  const seller2 = await userRepo.save({ name: 'Priya Sharma', email: 'seller2@example.com', phone: '9845123456', password: await bcrypt.hash('Seller2@123', 10), role: UserRole.SELLER, city: 'Bangalore', state: 'Karnataka', isVerified: true });
  const seller3 = await userRepo.save({ name: 'Mohammed Aziz', email: 'seller3@example.com', phone: '9712345678', password: await bcrypt.hash('Seller3@123', 10), role: UserRole.SELLER, city: 'Hyderabad', state: 'Telangana', isVerified: true });
  const agent1 = await userRepo.save({ name: 'Amit Verma', email: 'agent1@example.com', phone: '9811223344', password: await bcrypt.hash('Agent1@123', 10), role: UserRole.AGENT, city: 'Mumbai', state: 'Maharashtra', company: 'PropElite Realty', isVerified: true, agentLicense: 'MH-RERA-A12345', agentBio: 'Senior consultant with 12 years in Mumbai luxury residential and commercial. Expert in Bandra, Juhu, Powai.', agentExperience: 12, agentRating: 4.8, totalDeals: 340, agentTick: 'gold' });
  const agent2 = await userRepo.save({ name: 'Sunita Nair', email: 'agent2@example.com', phone: '9988776655', password: await bcrypt.hash('Agent2@123', 10), role: UserRole.AGENT, city: 'Bangalore', state: 'Karnataka', company: 'HomeFirst Properties', isVerified: true, agentLicense: 'KA-RERA-B67890', agentBio: 'Top-performing agent in Bangalore tech corridors. Expert in Whitefield, Koramangala, HSR Layout.', agentExperience: 8, agentRating: 4.6, totalDeals: 215, agentTick: 'blue' });
  const agent3 = await userRepo.save({ name: 'Vikram Singh', email: 'agent3@example.com', phone: '9776655443', password: await bcrypt.hash('Agent3@123', 10), role: UserRole.AGENT, city: 'Delhi', state: 'Delhi', company: 'Capital Estates', isVerified: true, agentLicense: 'DL-RERA-C11223', agentBio: 'NCR specialist covering Delhi, Gurgaon and Noida. 15 years expertise in luxury villas and commercial.', agentExperience: 15, agentRating: 4.9, totalDeals: 480, agentTick: 'diamond' });
  const agent4 = await userRepo.save({ name: 'Deepa Menon', email: 'agent4@example.com', phone: '9999999999', password: await bcrypt.hash('Agent4@123', 10), role: UserRole.AGENT, city: 'Hyderabad', state: 'Telangana', company: 'Saffron Realty', isVerified: true, agentLicense: 'TS-RERA-D44556', agentBio: 'Hyderabad specialist with 10 years. Expert in Gachibowli, Kondapur, and HITEC City. Helped 300+ IT professionals.', agentExperience: 10, agentRating: 4.7, totalDeals: 298, agentTick: 'gold' });

  console.log('Created users (admin, 3 sellers, 4 agents)');

  // ─── Wallets ──────────────────────────────────────────────────────────────────
  const walletRepo = dataSource.getRepository(Wallet);
  const walletTxRepo = dataSource.getRepository(WalletTransaction);
  const createWallet = async (userId: string, balance = 100) => {
    const w = await walletRepo.save(walletRepo.create({ userId, balance, totalEarned: balance }));
    await walletTxRepo.save({ walletId: w.id, type: TransactionType.BONUS, reason: TransactionReason.WELCOME_BONUS, amount: balance, balanceBefore: 0, balanceAfter: balance, description: 'Welcome bonus tokens' });
    return w;
  };
  await createWallet(admin.id, 500);
  await createWallet(admin2.id, 500);
  await createWallet(seller.id, 100);
  await createWallet(seller2.id, 100);
  await createWallet(seller3.id, 100);
  await createWallet(agent1.id, 250);
  await createWallet(agent2.id, 250);
  await createWallet(agent3.id, 250);
  await createWallet(agent4.id, 250);
  console.log('Created wallets');

  // ─── Boost Plans ──────────────────────────────────────────────────────────────
  const boostPlanRepo = dataSource.getRepository(BoostPlan);
  await boostPlanRepo.save([
    { name: '7 Day Boost', durationDays: 7, tokenCost: 10, description: 'Boost visibility for 7 days', isActive: true, sortOrder: 0 },
    { name: '15 Day Boost', durationDays: 15, tokenCost: 20, description: 'Boost visibility for 15 days', isActive: true, sortOrder: 1 },
    { name: '30 Day Boost', durationDays: 30, tokenCost: 40, description: 'Boost visibility for 30 days — Best Value!', isActive: true, sortOrder: 2 },
  ]);

  // ─── Subscription Plans ───────────────────────────────────────────────────────
  const subPlanRepo = dataSource.getRepository(SubscriptionPlan);
  await subPlanRepo.save([
    { name: 'Basic Plan', type: PlanType.BASIC, price: 499, durationDays: 30, tokensIncluded: 50, maxListings: 5, features: ['5 Listings', '50 Tokens', 'Basic Analytics', 'Email Support'], isActive: true, sortOrder: 0 },
    { name: 'Premium Plan', type: PlanType.PREMIUM, price: 1499, durationDays: 30, tokensIncluded: 150, maxListings: 15, features: ['15 Listings', '150 Tokens', 'Advanced Analytics', 'Priority Support', 'Featured Badge'], isActive: true, sortOrder: 1 },
    { name: 'Featured Plan', type: PlanType.FEATURED, price: 3999, durationDays: 30, tokensIncluded: 500, maxListings: 50, features: ['50 Listings', '500 Tokens', 'Top Placement', 'Dedicated Support', 'Homepage Showcase'], isActive: true, sortOrder: 2 },
    { name: 'Enterprise Plan', type: PlanType.ENTERPRISE, price: 9999, durationDays: 30, tokensIncluded: 2000, maxListings: 200, features: ['Unlimited Listings', '2000 Tokens', 'API Access', 'Account Manager', 'Custom Branding'], isActive: true, sortOrder: 3 },
  ]);

  // ─── Countries ────────────────────────────────────────────────────────────────
  const countryRepo = dataSource.getRepository(Country);
  const india = await countryRepo.save({ name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳', isActive: true, sortOrder: 0 });
  await countryRepo.save([
    { name: 'United States', code: 'US', dialCode: '+1',   flag: '🇺🇸', isActive: true, sortOrder: 1 },
    { name: 'United Kingdom', code: 'UK', dialCode: '+44', flag: '🇬🇧', isActive: true, sortOrder: 2 },
    { name: 'UAE',            code: 'AE', dialCode: '+971', flag: '🇦🇪', isActive: true, sortOrder: 3 },
    { name: 'Australia',      code: 'AU', dialCode: '+61', flag: '🇦🇺', isActive: true, sortOrder: 4 },
    { name: 'Canada',         code: 'CA', dialCode: '+1',  flag: '🇨🇦', isActive: true, sortOrder: 5 },
    { name: 'Singapore',      code: 'SG', dialCode: '+65', flag: '🇸🇬', isActive: true, sortOrder: 6 },
  ]);
  console.log('Countries created');

  // ─── States & Cities ──────────────────────────────────────────────────────────
  const stateRepo = dataSource.getRepository(State);
  const cityRepo = dataSource.getRepository(City);
  const mh = await stateRepo.save({ name: 'Maharashtra', code: 'MH', isActive: true, countryId: india.id, slug: 'maharashtra', metaTitle: 'Buy & Rent Property in Maharashtra - Think4BuySale', metaDescription: 'Explore thousands of properties for sale and rent across Maharashtra. Find your dream home in Mumbai, Pune, Nagpur and more.', metaKeywords: 'buy property maharashtra, rent property maharashtra, maharashtra real estate', h1: 'Properties in Maharashtra' });
  const ka = await stateRepo.save({ name: 'Karnataka', code: 'KA', isActive: true, countryId: india.id, slug: 'karnataka', metaTitle: 'Buy & Rent Property in Karnataka - Think4BuySale', metaDescription: 'Find properties for sale and rent in Bangalore, Mysore and other cities in Karnataka.', metaKeywords: 'buy property karnataka, bangalore real estate, rent property karnataka', h1: 'Properties in Karnataka' });
  const dl = await stateRepo.save({ name: 'Delhi', code: 'DL', isActive: true, countryId: india.id, slug: 'delhi', metaTitle: 'Buy & Rent Property in Delhi - Think4BuySale', metaDescription: 'Find the best properties for sale and rent in Delhi. Explore listings in all areas of Delhi NCR.', metaKeywords: 'buy property delhi, rent flat delhi, delhi real estate, delhi ncr property', h1: 'Properties in Delhi' });
  const tn = await stateRepo.save({ name: 'Tamil Nadu', code: 'TN', isActive: true, countryId: india.id, slug: 'tamil-nadu', metaTitle: 'Buy & Rent Property in Tamil Nadu - Think4BuySale', metaDescription: 'Discover properties across Tamil Nadu including Chennai, Coimbatore and more.', metaKeywords: 'buy property tamil nadu, chennai real estate, rent flat tamil nadu', h1: 'Properties in Tamil Nadu' });
  const ts = await stateRepo.save({ name: 'Telangana', code: 'TS', isActive: true, countryId: india.id, slug: 'telangana', metaTitle: 'Buy & Rent Property in Telangana - Think4BuySale', metaDescription: 'Find apartments, villas and plots for sale and rent in Hyderabad and across Telangana.', metaKeywords: 'buy property telangana, hyderabad real estate, rent flat hyderabad', h1: 'Properties in Telangana' });
  const gj = await stateRepo.save({ name: 'Gujarat', code: 'GJ', isActive: true, countryId: india.id, slug: 'gujarat', metaTitle: 'Buy & Rent Property in Gujarat - Think4BuySale', metaDescription: 'Explore residential and commercial properties in Ahmedabad, Surat and across Gujarat.', metaKeywords: 'buy property gujarat, ahmedabad real estate, surat property', h1: 'Properties in Gujarat' });
  const rj = await stateRepo.save({ name: 'Rajasthan', code: 'RJ', isActive: true, countryId: india.id, slug: 'rajasthan', metaTitle: 'Buy & Rent Property in Rajasthan - Think4BuySale', metaDescription: 'Find properties for sale and rent in Jaipur, Jodhpur and other cities in Rajasthan.', metaKeywords: 'buy property rajasthan, jaipur real estate, rent flat jaipur', h1: 'Properties in Rajasthan' });
  const wb = await stateRepo.save({ name: 'West Bengal', code: 'WB', isActive: true, countryId: india.id, slug: 'west-bengal', metaTitle: 'Buy & Rent Property in West Bengal - Think4BuySale', metaDescription: 'Explore properties in Kolkata and other cities across West Bengal.', metaKeywords: 'buy property west bengal, kolkata real estate, rent flat kolkata', h1: 'Properties in West Bengal' });
  const up = await stateRepo.save({ name: 'Uttar Pradesh', code: 'UP', isActive: true, countryId: india.id, slug: 'uttar-pradesh', metaTitle: 'Buy & Rent Property in Uttar Pradesh - Think4BuySale', metaDescription: 'Find properties for sale and rent in Noida, Lucknow, Ghaziabad and all UP cities.', metaKeywords: 'buy property uttar pradesh, noida real estate, lucknow property, ghaziabad flats', h1: 'Properties in Uttar Pradesh' });
  const hr = await stateRepo.save({ name: 'Haryana', code: 'HR', isActive: true, countryId: india.id, slug: 'haryana', metaTitle: 'Buy & Rent Property in Haryana - Think4BuySale', metaDescription: 'Explore luxury and affordable properties in Gurgaon, Faridabad and across Haryana.', metaKeywords: 'buy property haryana, gurgaon real estate, rent flat gurgaon', h1: 'Properties in Haryana' });
  const kl = await stateRepo.save({ name: 'Kerala', code: 'KL', isActive: true, countryId: india.id, slug: 'kerala', metaTitle: 'Buy & Rent Property in Kerala - Think4BuySale', metaDescription: 'Find properties for sale and rent in Kochi, Thiruvananthapuram and across Kerala.', metaKeywords: 'buy property kerala, kochi real estate, rent flat trivandrum', h1: 'Properties in Kerala' });
  // Additional Indian states
  await stateRepo.save([
    { name: 'Punjab',           code: 'PB', isActive: true, countryId: india.id, slug: 'punjab' },
    { name: 'Andhra Pradesh',   code: 'AP', isActive: true, countryId: india.id, slug: 'andhra-pradesh' },
    { name: 'Madhya Pradesh',   code: 'MP', isActive: true, countryId: india.id, slug: 'madhya-pradesh' },
    { name: 'Bihar',            code: 'BR', isActive: true, countryId: india.id, slug: 'bihar' },
    { name: 'Odisha',           code: 'OD', isActive: true, countryId: india.id, slug: 'odisha' },
    { name: 'Jharkhand',        code: 'JH', isActive: true, countryId: india.id, slug: 'jharkhand' },
    { name: 'Assam',            code: 'AS', isActive: true, countryId: india.id, slug: 'assam' },
    { name: 'Chhattisgarh',     code: 'CG', isActive: true, countryId: india.id, slug: 'chhattisgarh' },
    { name: 'Uttarakhand',      code: 'UK', isActive: true, countryId: india.id, slug: 'uttarakhand' },
    { name: 'Himachal Pradesh', code: 'HP', isActive: true, countryId: india.id, slug: 'himachal-pradesh' },
    { name: 'Goa',              code: 'GA', isActive: true, countryId: india.id, slug: 'goa' },
  ]);
  const [
    mumbaiCity, puneCity, nagpurCity,
    bangaloreCity, mysoreCity,
    delhiCity,
    gurgaonCity,
    noidaCity, ghaziabadCity, lucknowCity,
    chennaiCity,
    hyderabadCity,
    ahmedabadCity, suratCity,
    jaipurCity,
    kolkataCity,
    kochiCity,
  ] = await cityRepo.save([
    { name: 'Mumbai',    stateId: mh.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?w=600&q=80', slug: 'mumbai',    h1: 'Property in Mumbai',    metaTitle: 'Buy & Rent Property in Mumbai - Think4BuySale',    metaDescription: 'Find the best apartments, villas and plots for sale and rent in Mumbai. Explore Bandra, Powai, Andheri, Juhu and more.',                 metaKeywords: 'buy property mumbai, rent flat mumbai, mumbai real estate, apartments in mumbai',         introContent: 'Mumbai is India\'s financial capital and most expensive real estate market, offering everything from affordable flats in Thane and Navi Mumbai to ultra-luxury sea-facing apartments in Worli and Bandra. The city\'s real estate is underpinned by strong rental demand and persistent supply constraints.',         seoContent: 'Mumbai\'s property market is shaped by limited land supply on the island city, massive infrastructure development (Metro, Coastal Road, MTHL), and a diverse economic base spanning finance, entertainment, trade, and logistics.\n\nReady properties in Mumbai are typically priced 15–20% higher than under-construction. The MHADA and SRA redevelopment schemes in Dharavi and Worli are expected to add significant new supply in central Mumbai.',         faqs: [{ question: 'What is the property price range in Mumbai suburbs vs South Mumbai?', answer: 'South Mumbai (Cuffe Parade, Marine Lines, Nariman Point): Rs. 40,000–1,00,000/sqft. Bandra-Juhu-Andheri belt: Rs. 25,000–50,000/sqft. Thane and Navi Mumbai: Rs. 7,000–15,000/sqft.' }, { question: 'What is RERA\'s impact on Mumbai real estate?', answer: 'MahaRERA (Maharashtra RERA) has significantly improved project delivery timelines and builder accountability in Mumbai. All new projects must be RERA-registered, and buyers can track project progress online.' }] },
    { name: 'Pune',      stateId: mh.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1545809074-59472b3f5ecc?w=600&q=80', slug: 'pune',      h1: 'Property in Pune',      metaTitle: 'Buy & Rent Property in Pune - Think4BuySale',      metaDescription: 'Explore properties for sale and rent in Pune. Find apartments in Baner, Viman Nagar, Kothrud and more.',                              metaKeywords: 'buy property pune, rent flat pune, pune real estate, apartments baner' },
    { name: 'Nagpur',    stateId: mh.id, isActive: true, isFeatured: false,                                                                                       slug: 'nagpur' },
    { name: 'Bangalore', stateId: ka.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&q=80', slug: 'bangalore', h1: 'Property in Bangalore', metaTitle: 'Buy & Rent Property in Bangalore - Think4BuySale', metaDescription: 'Discover apartments, villas and plots in Bangalore. Browse listings in Whitefield, Koramangala, Indiranagar, HSR Layout and more.',  metaKeywords: 'buy property bangalore, rent flat bangalore, bangalore apartments, whitefield property',   introContent: 'Bangalore (Bengaluru) is India\'s IT capital and one of the fastest-growing real estate markets. From tech corridors in Whitefield to upscale localities in Koramangala, the city offers diverse property options.' },
    { name: 'Mysore',    stateId: ka.id, isActive: true, isFeatured: false,                                                                                       slug: 'mysore' },
    { name: 'Delhi',     stateId: dl.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&q=80', slug: 'delhi',     h1: 'Property in Delhi',     metaTitle: 'Buy & Rent Property in Delhi - Think4BuySale',     metaDescription: 'Find properties for sale and rent in Delhi. Explore listings in Greater Kailash, Vasant Kunj, Dwarka, Saket and more.',              metaKeywords: 'buy property delhi, rent flat delhi, delhi apartments, south delhi property',              introContent: 'Delhi is India\'s capital and one of the world\'s largest metropolises, offering a rich mix of heritage neighbourhoods and modern planned residential sectors. Real estate ranges from luxury South Delhi builder floors to affordable DDA flats in Dwarka and Rohini.',              seoContent: 'Delhi\'s property market is one of India\'s most mature and diverse. The city is divided into multiple planning zones with distinct real estate characters: South Delhi (premium, Rs. 3–15 crore), Central Delhi (heritage + commercial), West Delhi (family residential, Rs. 60 lakh–2 crore), North Delhi (student and budget-friendly), and New Delhi (government zone with limited residential supply).',              faqs: [{ question: 'What is the best area to buy property in Delhi?', answer: 'For luxury: Greater Kailash, Defence Colony, Vasant Kunj. For mid-segment: Dwarka, Rohini, Janakpuri. For budget: Uttam Nagar, Bawana, Narela. For commercial investment: Connaught Place, Nehru Place, Okhla.' }, { question: 'How is property registration done in Delhi?', answer: 'Property registration in Delhi is done through the Delhi Online Registration Information System (DORIS). Stamp duty is 4% for women and 6% for men. Registration can be done at the Sub-Registrar\'s office.' }] },
    { name: 'Gurgaon',   stateId: hr.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&q=80', slug: 'gurgaon',   h1: 'Property in Gurgaon',   metaTitle: 'Buy & Rent Property in Gurgaon - Think4BuySale',   metaDescription: 'Explore luxury apartments, villas and commercial spaces in Gurgaon. Browse DLF Phase, Sohna Road, Golf Course Road.',               metaKeywords: 'buy property gurgaon, rent flat gurgaon, gurgaon apartments, dlf gurgaon' },
    { name: 'Noida',     stateId: up.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&q=80', slug: 'noida',     h1: 'Property in Noida',     metaTitle: 'Buy & Rent Property in Noida - Think4BuySale',     metaDescription: 'Find affordable and premium properties in Noida. Browse listings in Sector 62, 137, 150 and more.',                                  metaKeywords: 'buy property noida, rent flat noida, noida sector 62, noida extension flats' },
    { name: 'Ghaziabad', stateId: up.id, isActive: true, isFeatured: true,                                                                                        slug: 'ghaziabad' },
    { name: 'Lucknow',   stateId: up.id, isActive: true, isFeatured: false,                                                                                       slug: 'lucknow',   h1: 'Property in Lucknow',   metaTitle: 'Buy & Rent Property in Lucknow - Think4BuySale',   metaDescription: 'Find the best properties in Lucknow. Explore Gomti Nagar, Aliganj, Hazratganj and more.',                                          metaKeywords: 'buy property lucknow, rent flat lucknow, lucknow real estate, gomti nagar property' },
    { name: 'Chennai',   stateId: tn.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&q=80', slug: 'chennai',   h1: 'Property in Chennai',   metaTitle: 'Buy & Rent Property in Chennai - Think4BuySale',   metaDescription: 'Discover properties for sale and rent in Chennai. Explore Anna Nagar, OMR, T Nagar, Velachery and more.',                          metaKeywords: 'buy property chennai, rent flat chennai, anna nagar property, omr apartments' },
    { name: 'Hyderabad', stateId: ts.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1572445373025-8b4b3ab7dd21?w=600&q=80', slug: 'hyderabad', h1: 'Property in Hyderabad', metaTitle: 'Buy & Rent Property in Hyderabad - Think4BuySale', metaDescription: 'Find apartments and villas in Hyderabad. Browse Gachibowli, Kondapur, HITEC City, Banjara Hills listings.',                          metaKeywords: 'buy property hyderabad, rent flat hyderabad, gachibowli apartments, hitec city property' },
    { name: 'Ahmedabad', stateId: gj.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1558618047-f4e90ae6e13e?w=600&q=80', slug: 'ahmedabad', h1: 'Property in Ahmedabad', metaTitle: 'Buy & Rent Property in Ahmedabad - Think4BuySale', metaDescription: 'Explore properties in Ahmedabad. Find listings in Prahlad Nagar, SG Highway, Bopal and more.',                                      metaKeywords: 'buy property ahmedabad, rent flat ahmedabad, sg highway property, prahlad nagar apartments' },
    { name: 'Surat',     stateId: gj.id, isActive: true, isFeatured: false,                                                                                       slug: 'surat' },
    { name: 'Jaipur',    stateId: rj.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600&q=80', slug: 'jaipur',    h1: 'Property in Jaipur',    metaTitle: 'Buy & Rent Property in Jaipur - Think4BuySale',    metaDescription: 'Find properties in Jaipur — the Pink City. Explore Vaishali Nagar, Malviya Nagar, Mansarovar listings.',                           metaKeywords: 'buy property jaipur, rent flat jaipur, vaishali nagar property, jaipur real estate' },
    { name: 'Kolkata',   stateId: wb.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1558431382-27e303142255?w=600&q=80', slug: 'kolkata',   h1: 'Property in Kolkata',   metaTitle: 'Buy & Rent Property in Kolkata - Think4BuySale',   metaDescription: 'Discover properties in Kolkata. Browse Salt Lake, New Town, Park Street and other prime localities.',                               metaKeywords: 'buy property kolkata, rent flat kolkata, salt lake property, new town apartments' },
    { name: 'Kochi',     stateId: kl.id, isActive: true, isFeatured: false,                                                                                       slug: 'kochi',     h1: 'Property in Kochi',     metaTitle: 'Buy & Rent Property in Kochi - Think4BuySale',     metaDescription: 'Find flats and villas in Kochi. Explore Kakkanad, Edapally, Marine Drive and more.',                                               metaKeywords: 'buy property kochi, rent flat kochi, kakkanad apartments, kochi real estate' },
  ]);
  console.log('States & cities created');

  // ─── Properties ───────────────────────────────────────────────────────────────
  const propertyRepo = dataSource.getRepository(Property);
  const imageRepo = dataSource.getRepository(PropertyImage);

  const APARTMENT_IMGS = [
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
    'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=800&q=80',
    'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=800&q=80',
  ];
  const VILLA_IMGS = [
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=800&q=80',
  ];
  const OFFICE_IMGS = [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80',
    'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80',
    'https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=800&q=80',
  ];
  const WAREHOUSE_IMGS = [
    'https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&q=80',
    'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800&q=80',
    'https://images.unsplash.com/photo-1565793979290-b6f7a74b2b8a?w=800&q=80',
  ];
  const PLOT_IMGS = [
    'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80',
    'https://images.unsplash.com/photo-1558618047-f4e90ae6e13e?w=800&q=80',
  ];
  const PG_IMGS = [
    'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&q=80',
    'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=800&q=80',
    'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800&q=80',
  ];

  type PropData = Omit<Partial<Property>, 'owner'> & { owner: User; ownerId: string };

  const createProperty = async (data: PropData, images: string[]) => {
    const prop = await propertyRepo.save(propertyRepo.create({
      ...data,
    }));
    for (let i = 0; i < images.length; i++) {
      await imageRepo.save(imageRepo.create({ propertyId: prop.id, url: images[i], isPrimary: i === 0, sortOrder: i }));
    }
    return prop;
  };

  // ── MUMBAI - BUY ──────────────────────────────────────────────────────────────
  await createProperty({
    title: '3 BHK Premium Apartment in Bandra West', slug: 'premium-3bhk-bandra-west-001',
    description: 'Stunning sea-facing 3 BHK in the heart of Bandra West. Fully furnished with modular kitchen, premium fittings. Access to infinity pool, gym, and rooftop terrace. Steps from Carter Road and Bandstand promenade.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 32500000, priceUnit: 'total',
    area: 1850, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3, balconies: 2, floorNumber: 12, totalFloors: 22,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Mumbai', state: 'Maharashtra', locality: 'Bandra West', society: 'Atlantis Heights',
    address: 'Linking Road, Bandra West, Mumbai', pincode: '400050', latitude: 19.0596, longitude: 72.8295,
    isFeatured: true, isPremium: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), boostExpiresAt: futureDate(30), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, viewCount: 1240, owner: agent1, ownerId: agent1.id,
  }, APARTMENT_IMGS.slice(0, 5));

  await createProperty({
    title: '2 BHK Apartment for Sale in Powai', slug: 'apartment-sale-powai-002',
    description: 'Modern 2 BHK in Hiranandani Gardens, Powai. Gated township with schools, hospitals, malls within complex. Lake-facing unit with stunning views. Semi-furnished with brand new kitchen appliances.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 18500000, priceUnit: 'total',
    area: 1050, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2, balconies: 1, floorNumber: 8, totalFloors: 18,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Mumbai', state: 'Maharashtra', locality: 'Powai', society: 'Hiranandani Gardens',
    address: 'Hiranandani Gardens, Powai, Mumbai', pincode: '400076',
    isFeatured: false, isPremium: true, isVerified: true, listingPlan: ListingPlan.PREMIUM,
    listingExpiresAt: futureDate(60), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, viewCount: 890, owner: agent1, ownerId: agent1.id,
  }, APARTMENT_IMGS.slice(1, 5));

  await createProperty({
    title: '4 BHK Penthouse in Juhu', slug: 'penthouse-juhu-003',
    description: 'Ultra-luxury 4 BHK penthouse with private terrace and sea views in Juhu. Double-height living area, private jacuzzi, chef\'s kitchen. Elite neighborhood with easy access to Juhu Beach and Mumbai airport.',
    type: PropertyType.PENTHOUSE, category: PropertyCategory.BUY, price: 75000000, priceUnit: 'total',
    area: 4200, areaUnit: 'sqft', bedrooms: 4, bathrooms: 5, balconies: 3, floorNumber: 24, totalFloors: 24,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Mumbai', state: 'Maharashtra', locality: 'Juhu', society: 'Sea Pearl',
    address: 'Juhu Tara Road, Juhu, Mumbai', pincode: '400049',
    isFeatured: true, isPremium: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), boostExpiresAt: futureDate(15), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, viewCount: 2100, owner: agent1, ownerId: agent1.id,
  }, VILLA_IMGS.slice(0, 4));

  // ── MUMBAI - RENT ─────────────────────────────────────────────────────────────
  await createProperty({
    title: '2 BHK Flat for Rent in Andheri East', slug: 'rent-2bhk-andheri-east-004',
    description: 'Well-maintained 2 BHK in prime Andheri East location. Minutes from metro station and Western Express Highway. Semi-furnished with modular kitchen, wardrobes in all rooms. Society with security and parking.',
    type: PropertyType.APARTMENT, category: PropertyCategory.RENT, price: 55000, priceUnit: 'per month',
    area: 950, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2, balconies: 1, floorNumber: 5, totalFloors: 14,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Mumbai', state: 'Maharashtra', locality: 'Andheri East',
    address: 'J.B. Nagar, Andheri East, Mumbai', pincode: '400069',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    brokerage: '1 Month', viewCount: 450, owner: seller, ownerId: seller.id,
  }, APARTMENT_IMGS.slice(2, 5));

  await createProperty({
    title: '1 BHK Studio for Rent in Bandra', slug: 'studio-rent-bandra-005',
    description: 'Cozy 1 BHK studio apartment in the heart of Bandra West. Fully furnished with AC, sofa, bed, TV, microwave. Perfect for working professionals. Walking distance from Bandra station and Hill Road.',
    type: PropertyType.STUDIO, category: PropertyCategory.RENT, price: 38000, priceUnit: 'per month',
    area: 520, areaUnit: 'sqft', bedrooms: 1, bathrooms: 1,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Mumbai', state: 'Maharashtra', locality: 'Bandra West',
    address: 'Pali Hill, Bandra West, Mumbai', pincode: '400050',
    isVerified: true, listingPlan: ListingPlan.FREE, approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.OWNER, brokerage: '15 Days', viewCount: 320, owner: seller, ownerId: seller.id,
  }, APARTMENT_IMGS.slice(3, 5));

  // ── DELHI - BUY ───────────────────────────────────────────────────────────────
  await createProperty({
    title: '3 BHK Builder Floor in Greater Kailash', slug: 'builder-floor-gk-006',
    description: 'Spacious ground floor + terrace rights in premium GK-II locality. 1800 sqft with large garden. Italian marble flooring, modular kitchen, 2 covered parking. South Delhi\'s most sought-after address for families.',
    type: PropertyType.BUILDER_FLOOR, category: PropertyCategory.BUY, price: 22000000, priceUnit: 'total',
    area: 1800, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3, floorNumber: 0, totalFloors: 3,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Delhi', state: 'Delhi', locality: 'Greater Kailash',
    address: 'GK-II, Greater Kailash, New Delhi', pincode: '110048',
    isFeatured: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), boostExpiresAt: futureDate(20), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, viewCount: 1680, owner: agent3, ownerId: agent3.id,
  }, VILLA_IMGS.slice(1, 5));

  await createProperty({
    title: '4 BHK Villa in Vasant Kunj', slug: 'villa-vasant-kunj-007',
    description: 'Luxurious independent 4 BHK villa in South Delhi\'s greenest locality. 4000 sqft plot with private lawn and terrace. Recently renovated with premium fittings. Walking distance from DLF Promenade and Vasant Kunj forests.',
    type: PropertyType.VILLA, category: PropertyCategory.BUY, price: 45000000, priceUnit: 'total',
    area: 3200, areaUnit: 'sqft', bedrooms: 4, bathrooms: 4, balconies: 2,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Delhi', state: 'Delhi', locality: 'Vasant Kunj',
    address: 'Vasant Kunj Enclave, New Delhi', pincode: '110070',
    isFeatured: true, isPremium: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, viewCount: 2340, owner: agent3, ownerId: agent3.id,
  }, VILLA_IMGS.slice(0, 5));

  await createProperty({
    title: '2 BHK Apartment in Dwarka Sector 6', slug: 'apartment-dwarka-008',
    description: 'Affordable 2 BHK in DDA-approved society in Dwarka. Close to Blue Line metro, schools, and markets. Good for first-time homebuyers. Society with power backup, security, and park.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 8500000, priceUnit: 'total',
    area: 1100, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2, floorNumber: 3, totalFloors: 10,
    furnishingStatus: FurnishingStatus.UNFURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Delhi', state: 'Delhi', locality: 'Dwarka', society: 'DDA Flats',
    address: 'Sector 6, Dwarka, New Delhi', pincode: '110075',
    isVerified: false, listingPlan: ListingPlan.FREE, approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.OWNER, viewCount: 560, owner: seller, ownerId: seller.id,
  }, APARTMENT_IMGS.slice(0, 3));

  // ── DELHI - RENT ──────────────────────────────────────────────────────────────
  await createProperty({
    title: '3 BHK Apartment for Rent in Saket', slug: 'rent-3bhk-saket-009',
    description: 'Premium 3 BHK in Saket with modern amenities. Fully furnished, air-conditioned throughout. Steps from Select CITYWALK mall, PVR, and multiple restaurants. Ideal for corporate executives.',
    type: PropertyType.APARTMENT, category: PropertyCategory.RENT, price: 75000, priceUnit: 'per month',
    area: 1650, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3, balconies: 2, floorNumber: 7,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Delhi', state: 'Delhi', locality: 'Saket', address: 'Saket, New Delhi', pincode: '110017',
    isPremium: true, isVerified: true, listingPlan: ListingPlan.PREMIUM,
    listingExpiresAt: futureDate(60), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, brokerage: '1 Month', viewCount: 780, owner: agent3, ownerId: agent3.id,
  }, APARTMENT_IMGS.slice(1, 5));

  // ── BANGALORE - BUY ───────────────────────────────────────────────────────────
  await createProperty({
    title: '3 BHK Luxury Apartment in Koramangala', slug: 'luxury-3bhk-koramangala-010',
    description: 'Ultra-modern 3 BHK in the heart of Koramangala. Smart home automation, modular kitchen with chimney, imported marble flooring. Society has infinity pool, squash court, co-working space, and concierge services.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 19500000, priceUnit: 'total',
    area: 1750, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3, balconies: 2, floorNumber: 15, totalFloors: 28,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Bangalore', state: 'Karnataka', locality: 'Koramangala', society: 'Prestige Shantiniketan',
    address: '5th Block, Koramangala, Bangalore', pincode: '560034',
    isFeatured: true, isPremium: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), boostExpiresAt: futureDate(25), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, viewCount: 1890, owner: agent2, ownerId: agent2.id,
  }, APARTMENT_IMGS.slice(0, 5));

  await createProperty({
    title: '2 BHK Villa in Whitefield', slug: 'villa-whitefield-011',
    description: 'Independent 2 BHK villa in premium gated community in Whitefield. Private garden, rooftop terrace. Minutes from ITPL, RMZ Infinity, and Phoenix Market City. Power backup, swimming pool, clubhouse in community.',
    type: PropertyType.VILLA, category: PropertyCategory.BUY, price: 14500000, priceUnit: 'total',
    area: 1600, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Bangalore', state: 'Karnataka', locality: 'Whitefield', society: 'Brigade Orchards',
    address: 'EPIP Zone, Whitefield, Bangalore', pincode: '560066',
    isVerified: true, listingPlan: ListingPlan.PREMIUM, listingExpiresAt: futureDate(60),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.AGENT,
    viewCount: 1120, owner: agent2, ownerId: agent2.id,
  }, VILLA_IMGS.slice(0, 4));

  await createProperty({
    title: '4 BHK Under Construction Apartment in Indiranagar', slug: 'new-apartment-indiranagar-012',
    description: 'Exclusive new-launch 4 BHK in prime Indiranagar. RERA registered. Handed over by December 2025. Smart homes with home automation. Rooftop infinity pool, sky lounge, EV charging, mini-theatre.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 28000000, priceUnit: 'total',
    area: 2100, areaUnit: 'sqft', bedrooms: 4, bathrooms: 4, floorNumber: 18, totalFloors: 25,
    furnishingStatus: FurnishingStatus.UNFURNISHED, possessionStatus: PossessionStatus.UNDER_CONSTRUCTION,
    city: 'Bangalore', state: 'Karnataka', locality: 'Indiranagar', society: 'Total Environment Sky Deck',
    address: '100 Feet Road, Indiranagar, Bangalore', pincode: '560038',
    isFeatured: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, reraNumber: 'PRM/KA/RERA/1251/310/PR/220930/004812',
    viewCount: 3200, owner: agent2, ownerId: agent2.id,
  }, APARTMENT_IMGS.slice(2, 6));

  // ── BANGALORE - RENT ──────────────────────────────────────────────────────────
  await createProperty({
    title: '2 BHK for Rent in HSR Layout', slug: 'rent-2bhk-hsr-layout-013',
    description: 'Freshly painted 2 BHK in HSR Layout Sector 2. Semi-furnished with wardrobes, geysers, and fan fittings. Walking distance to Agara Lake, Jayanagar shopping complex, and multiple cafes.',
    type: PropertyType.APARTMENT, category: PropertyCategory.RENT, price: 32000, priceUnit: 'per month',
    area: 1050, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2, floorNumber: 2,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Bangalore', state: 'Karnataka', locality: 'HSR Layout',
    address: 'Sector 2, HSR Layout, Bangalore', pincode: '560102',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    brokerage: '1 Month', viewCount: 670, owner: seller2, ownerId: seller2.id,
  }, APARTMENT_IMGS.slice(1, 4));

  await createProperty({
    title: '3 BHK Luxury Flat for Rent in Whitefield', slug: 'rent-3bhk-whitefield-014',
    description: 'Brand new fully furnished 3 BHK flat in Brigade Cosmopolis. Premium appliances — LG fridge, Samsung washer, 65" Sony TV, 3 ACs. Club amenities: pool, gym, indoor badminton, cricket net.',
    type: PropertyType.APARTMENT, category: PropertyCategory.RENT, price: 65000, priceUnit: 'per month',
    area: 1600, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3, balconies: 2, floorNumber: 10, totalFloors: 22,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Bangalore', state: 'Karnataka', locality: 'Whitefield', society: 'Brigade Cosmopolis',
    address: 'EPIP Zone, Whitefield, Bangalore', pincode: '560066',
    isPremium: true, isVerified: true, listingPlan: ListingPlan.PREMIUM,
    listingExpiresAt: futureDate(60), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, brokerage: '1 Month', viewCount: 920, owner: agent2, ownerId: agent2.id,
  }, APARTMENT_IMGS.slice(0, 5));

  // ── NOIDA - BUY ───────────────────────────────────────────────────────────────
  await createProperty({
    title: '3 BHK Apartment in Noida Sector 137', slug: 'apartment-noida-sector137-015',
    description: 'Spacious 3 BHK in ATS Triumph, Sector 137 Noida. Directly on Noida Expressway. 3 minutes to Noida Sector 137 metro station. Society amenities: 2 swimming pools, gym, squash court, mini-theatre.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 12500000, priceUnit: 'total',
    area: 1650, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3, balconies: 2, floorNumber: 14, totalFloors: 28,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 137', society: 'ATS Triumph',
    address: 'Sector 137, Noida, UP', pincode: '201304',
    isFeatured: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, viewCount: 1450, owner: agent3, ownerId: agent3.id,
  }, APARTMENT_IMGS.slice(0, 5));

  await createProperty({
    title: '2 BHK Flat in Noida Sector 62', slug: 'apartment-noida-sec62-016',
    description: '2 BHK ready-to-move flat in Assotech Windsor Court, Sector 62 Noida. 5 minutes from Sector 62 Metro. IT parks walking distance. Society has gym, garden, 24x7 power backup and security.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 7800000, priceUnit: 'total',
    area: 1050, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2, floorNumber: 6, totalFloors: 14,
    furnishingStatus: FurnishingStatus.UNFURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 62',
    address: 'Sector 62, Noida', pincode: '201309',
    isVerified: false, listingPlan: ListingPlan.FREE, approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.OWNER, viewCount: 340, owner: seller, ownerId: seller.id,
  }, APARTMENT_IMGS.slice(2, 5));

  await createProperty({
    title: 'Residential Plot for Sale in Noida Extension', slug: 'plot-noida-ext-017',
    description: 'YEIDA approved residential plot in Greater Noida West. 200 sqyd plot with wide roads, power, water, and drainage in place. Near FNG Expressway. Excellent investment for future villa construction.',
    type: PropertyType.PLOT, category: PropertyCategory.BUY, price: 4200000, priceUnit: 'total',
    area: 200, areaUnit: 'sqyd',
    city: 'Noida', state: 'Uttar Pradesh', locality: 'Greater Noida West',
    address: 'Sector 12, Greater Noida West', pincode: '201306',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.AGENT,
    viewCount: 780, owner: agent3, ownerId: agent3.id,
  }, PLOT_IMGS);

  // ── GURGAON ───────────────────────────────────────────────────────────────────
  await createProperty({
    title: '3 BHK in DLF Phase 2 Gurgaon', slug: 'apartment-dlf-phase2-018',
    description: '3 BHK in prestigious DLF Phase 2. Part of premium society with club facilities. Close to Golf Course Road, Cyber Hub, and NH-48. Marble floors, modular kitchen, 2 balconies with green view.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 24000000, priceUnit: 'total',
    area: 1800, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3, balconies: 2, floorNumber: 8, totalFloors: 15,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Gurgaon', state: 'Haryana', locality: 'DLF Phase 2',
    address: 'DLF Phase 2, Gurugram, Haryana', pincode: '122002',
    isFeatured: true, isPremium: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, viewCount: 1980, owner: agent3, ownerId: agent3.id,
  }, APARTMENT_IMGS.slice(0, 5));

  await createProperty({
    title: '4 BHK Villa for Rent in Sohna Road', slug: 'villa-rent-sohna-road-019',
    description: 'Spacious 4 BHK independent villa on Sohna Road. Private garden, 4 ACs, modular kitchen, servant quarter. Society with pool and gym. Close to GD Goenka school and Omaxe Celebration Mall.',
    type: PropertyType.VILLA, category: PropertyCategory.RENT, price: 150000, priceUnit: 'per month',
    area: 3800, areaUnit: 'sqft', bedrooms: 4, bathrooms: 5,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Gurgaon', state: 'Haryana', locality: 'Sohna Road',
    address: 'Sohna Road, Gurugram', pincode: '122018',
    isPremium: true, isVerified: true, listingPlan: ListingPlan.PREMIUM,
    listingExpiresAt: futureDate(60), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, brokerage: '1 Month', viewCount: 1340, owner: agent3, ownerId: agent3.id,
  }, VILLA_IMGS.slice(0, 5));

  // ── HYDERABAD ─────────────────────────────────────────────────────────────────
  await createProperty({
    title: '3 BHK Apartment in Gachibowli', slug: 'apartment-gachibowli-020',
    description: '3 BHK luxury apartment in the IT hub of Gachibowli. Walking distance to Microsoft, Google, Amazon campuses. Modern amenities: rooftop pool, fully-equipped gym, co-working space, amphitheater.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 14500000, priceUnit: 'total',
    area: 1750, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3, floorNumber: 12, totalFloors: 25,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Hyderabad', state: 'Telangana', locality: 'Gachibowli', society: 'Aparna Sarovar',
    address: 'Gachibowli, Hyderabad', pincode: '500032',
    isFeatured: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, viewCount: 1560, owner: agent4, ownerId: agent4.id,
  }, APARTMENT_IMGS.slice(0, 5));

  await createProperty({
    title: '2 BHK Flat for Rent in Kondapur', slug: 'rent-flat-kondapur-021',
    description: 'Ready 2 BHK flat for rent in Kondapur, Hyderabad. 10 mins from HITEC City. Furnished with beds, sofa, dining table, and geysers. Society has gym, kids play area, security guards 24/7.',
    type: PropertyType.APARTMENT, category: PropertyCategory.RENT, price: 28000, priceUnit: 'per month',
    area: 1100, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2, floorNumber: 4,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Hyderabad', state: 'Telangana', locality: 'Kondapur',
    address: 'Kondapur, Hyderabad', pincode: '500084',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    brokerage: '1 Month', viewCount: 430, owner: seller3, ownerId: seller3.id,
  }, APARTMENT_IMGS.slice(2, 5));

  await createProperty({
    title: '4 BHK Villa in Jubilee Hills Hyderabad', slug: 'villa-jubilee-hills-022',
    description: 'Prestigious 4 BHK villa in Jubilee Hills, Hyderabad\'s most prime residential area. Double-height entrance, private garden, Italian marble throughout. Roof-top terrace with city views.',
    type: PropertyType.VILLA, category: PropertyCategory.BUY, price: 55000000, priceUnit: 'total',
    area: 5000, areaUnit: 'sqft', bedrooms: 4, bathrooms: 5,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Hyderabad', state: 'Telangana', locality: 'Jubilee Hills',
    address: 'Road No. 36, Jubilee Hills, Hyderabad', pincode: '500033',
    isFeatured: true, isPremium: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, viewCount: 2870, owner: agent4, ownerId: agent4.id,
  }, VILLA_IMGS.slice(0, 5));

  // ── PUNE ──────────────────────────────────────────────────────────────────────
  await createProperty({
    title: '2 BHK Apartment in Baner Pune', slug: 'apartment-baner-pune-023',
    description: '2 BHK in premium society in Baner, Pune. Close to Hinjewadi IT Park. Clubhouse, swimming pool, tennis court. Vastu-compliant east-facing flat with garden view.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 9500000, priceUnit: 'total',
    area: 1100, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2, floorNumber: 5, totalFloors: 14,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Pune', state: 'Maharashtra', locality: 'Baner',
    address: 'Baner Road, Pune', pincode: '411045',
    isVerified: true, listingPlan: ListingPlan.PREMIUM, listingExpiresAt: futureDate(60),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.AGENT,
    viewCount: 680, owner: agent1, ownerId: agent1.id,
  }, APARTMENT_IMGS.slice(1, 4));

  await createProperty({
    title: '3 BHK for Rent in Viman Nagar Pune', slug: 'rent-3bhk-viman-nagar-024',
    description: 'Spacious 3 BHK for rent in Viman Nagar, Pune. 5 mins from Pune Airport. Fully furnished with premium appliances. Society with pool, gym, and 24-hour security.',
    type: PropertyType.APARTMENT, category: PropertyCategory.RENT, price: 45000, priceUnit: 'per month',
    area: 1400, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Pune', state: 'Maharashtra', locality: 'Viman Nagar',
    address: 'Viman Nagar, Pune', pincode: '411014',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    brokerage: '1 Month', viewCount: 390, owner: seller, ownerId: seller.id,
  }, APARTMENT_IMGS.slice(0, 4));

  await createProperty({
    title: '3 BHK Independent House in Kothrud Pune', slug: 'house-kothrud-pune-025',
    description: 'Spacious independent house in the heart of Kothrud. 3 BHK with servant quarters, car porch, and garden. Close to Karve Road, Nal Stop market, and Deccan Gymkhana.',
    type: PropertyType.HOUSE, category: PropertyCategory.BUY, price: 16000000, priceUnit: 'total',
    area: 2200, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3, balconies: 2,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Pune', state: 'Maharashtra', locality: 'Kothrud',
    address: 'Kothrud, Pune', pincode: '411038',
    isVerified: true, listingPlan: ListingPlan.PREMIUM, listingExpiresAt: futureDate(60),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    viewCount: 520, owner: seller, ownerId: seller.id,
  }, VILLA_IMGS.slice(2, 5));

  // ── CHENNAI ───────────────────────────────────────────────────────────────────
  await createProperty({
    title: '3 BHK Apartment in Anna Nagar Chennai', slug: 'apartment-anna-nagar-026',
    description: 'Premium 3 BHK in Anna Nagar West, Chennai. Walking distance from Anna Nagar Metro. Society with pool, clubhouse. East-facing vastu-compliant unit. Close to Ampa Skywalk Mall and hospitals.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 11500000, priceUnit: 'total',
    area: 1450, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3, floorNumber: 7, totalFloors: 12,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Chennai', state: 'Tamil Nadu', locality: 'Anna Nagar',
    address: 'Anna Nagar West, Chennai', pincode: '600040',
    isVerified: true, listingPlan: ListingPlan.PREMIUM, listingExpiresAt: futureDate(60),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.AGENT,
    viewCount: 870, owner: agent2, ownerId: agent2.id,
  }, APARTMENT_IMGS.slice(0, 4));

  await createProperty({
    title: '2 BHK Flat for Rent in OMR Chennai', slug: 'rent-flat-omr-chennai-027',
    description: 'Modern 2 BHK in Old Mahabalipuram Road (OMR), Chennai IT Corridor. 10 mins to TCS, Infosys, Cognizant campuses. Semi-furnished, good ventilation, covered parking.',
    type: PropertyType.APARTMENT, category: PropertyCategory.RENT, price: 22000, priceUnit: 'per month',
    area: 1050, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Chennai', state: 'Tamil Nadu', locality: 'OMR',
    address: 'Sholinganallur, OMR, Chennai', pincode: '600097',
    isVerified: false, listingPlan: ListingPlan.FREE, approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.OWNER, brokerage: '1 Month', viewCount: 280, owner: seller2, ownerId: seller2.id,
  }, APARTMENT_IMGS.slice(2, 4));

  await createProperty({
    title: '4 BHK Villa in Adyar Chennai', slug: 'villa-adyar-chennai-028',
    description: 'Prestigious 4 BHK independent villa in Adyar, one of Chennai\'s most coveted addresses. Private garden, two-car garage. Walking distance from Adyar river, Theosophical Society. Prestigious schools nearby.',
    type: PropertyType.VILLA, category: PropertyCategory.BUY, price: 38000000, priceUnit: 'total',
    area: 4500, areaUnit: 'sqft', bedrooms: 4, bathrooms: 4, balconies: 3,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Chennai', state: 'Tamil Nadu', locality: 'Adyar',
    address: 'Adyar, Chennai', pincode: '600020',
    isFeatured: true, isPremium: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, viewCount: 1870, owner: agent2, ownerId: agent2.id,
  }, VILLA_IMGS.slice(0, 5));

  // ── KOLKATA ───────────────────────────────────────────────────────────────────
  await createProperty({
    title: '3 BHK Apartment in Salt Lake Kolkata', slug: 'apartment-salt-lake-029',
    description: 'Elegant 3 BHK in prestigious Salt Lake City, Kolkata. Sector V IT hub proximity. Semi-furnished with ACs and wardrobes. Society with power backup, gym, and rooftop garden.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 8500000, priceUnit: 'total',
    area: 1450, areaUnit: 'sqft', bedrooms: 3, bathrooms: 2, floorNumber: 5,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Kolkata', state: 'West Bengal', locality: 'Salt Lake',
    address: 'Sector III, Salt Lake, Kolkata', pincode: '700064',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    viewCount: 450, owner: seller, ownerId: seller.id,
  }, APARTMENT_IMGS.slice(1, 4));

  await createProperty({
    title: '2 BHK Apartment for Rent in Rajarhat Kolkata', slug: 'rent-apartment-rajarhat-030',
    description: '2 BHK fully furnished apartment in New Town Rajarhat. Near Infosys, Wipro, and TCS campuses. Society with swimming pool, clubhouse, and children\'s park. Excellent connectivity via Major Arterial Road.',
    type: PropertyType.APARTMENT, category: PropertyCategory.RENT, price: 18000, priceUnit: 'per month',
    area: 950, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Kolkata', state: 'West Bengal', locality: 'Rajarhat',
    address: 'New Town, Rajarhat, Kolkata', pincode: '700135',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    brokerage: '1 Month', viewCount: 310, owner: seller, ownerId: seller.id,
  }, APARTMENT_IMGS.slice(3, 6));

  // ── COMMERCIAL PROPERTIES ─────────────────────────────────────────────────────
  await createProperty({
    title: 'Office Space for Sale in Andheri East Mumbai', slug: 'office-sale-andheri-031',
    description: 'Grade A commercial office space in Technopolis Knowledge Park, Andheri East. 2000 sqft fully fitted with workstations, conference room, pantry. RERA registered. Metro connectivity, ample parking.',
    type: PropertyType.COMMERCIAL_OFFICE, category: PropertyCategory.COMMERCIAL, price: 35000000, priceUnit: 'total',
    area: 2000, areaUnit: 'sqft', city: 'Mumbai', state: 'Maharashtra', locality: 'Andheri East',
    address: 'Technopolis Knowledge Park, Andheri East, Mumbai', pincode: '400093',
    isVerified: true, isFeatured: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, viewCount: 1230, owner: agent1, ownerId: agent1.id,
  }, OFFICE_IMGS);

  await createProperty({
    title: 'Furnished Office for Rent in Sector 62 Noida', slug: 'office-rent-noida-032',
    description: 'Plug-and-play office space for rent in Sector 62 Noida IT corridor. 1500 sqft fitted with 30 workstations, conference room, reception. Fiber internet, cafeteria, adequate parking. Immediate occupancy available.',
    type: PropertyType.COMMERCIAL_OFFICE, category: PropertyCategory.COMMERCIAL, price: 120000, priceUnit: 'per month',
    area: 1500, areaUnit: 'sqft', city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 62',
    address: 'Sector 62, Noida', pincode: '201309',
    isVerified: true, listingPlan: ListingPlan.PREMIUM, listingExpiresAt: futureDate(60),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.AGENT,
    brokerage: '2%', viewCount: 890, owner: agent3, ownerId: agent3.id,
  }, OFFICE_IMGS.slice(1, 4));

  await createProperty({
    title: 'Retail Shop for Sale in Connaught Place Delhi', slug: 'shop-cp-delhi-033',
    description: 'Premium retail shop in iconic Connaught Place, New Delhi. Ground floor, 800 sqft with frontage on inner circle. Ideal for fashion retail, F&B, banking, medical. Heritage building, high footfall area.',
    type: PropertyType.COMMERCIAL_SHOP, category: PropertyCategory.COMMERCIAL, price: 85000000, priceUnit: 'total',
    area: 800, areaUnit: 'sqft', city: 'Delhi', state: 'Delhi', locality: 'Connaught Place',
    address: 'Inner Circle, Connaught Place, New Delhi', pincode: '110001',
    isVerified: true, isFeatured: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.OWNER, viewCount: 4500, owner: seller, ownerId: seller.id,
  }, OFFICE_IMGS.slice(0, 3));

  await createProperty({
    title: 'Commercial Office in Koramangala Bangalore', slug: 'office-koramangala-034',
    description: '1200 sqft modern office space in heart of Koramangala startup hub. Fibre internet, conference rooms shared. Surrounded by top startups. Flexible lease terms available.',
    type: PropertyType.COMMERCIAL_OFFICE, category: PropertyCategory.COMMERCIAL, price: 95000, priceUnit: 'per month',
    area: 1200, areaUnit: 'sqft', city: 'Bangalore', state: 'Karnataka', locality: 'Koramangala',
    address: '1st Block, Koramangala, Bangalore', pincode: '560034',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.AGENT,
    brokerage: '1%', viewCount: 670, owner: agent2, ownerId: agent2.id,
  }, OFFICE_IMGS.slice(0, 3));

  await createProperty({
    title: 'Showroom Space for Rent in Banjara Hills Hyderabad', slug: 'showroom-banjara-hills-035',
    description: 'Prime 2500 sqft showroom space on Road No. 12, Banjara Hills. Ground floor with glass frontage and high ceiling. Ideal for automobile showroom, furniture, or luxury retail. Ample visitor parking.',
    type: PropertyType.SHOWROOM, category: PropertyCategory.COMMERCIAL, price: 180000, priceUnit: 'per month',
    area: 2500, areaUnit: 'sqft', city: 'Hyderabad', state: 'Telangana', locality: 'Banjara Hills',
    address: 'Road No. 12, Banjara Hills, Hyderabad', pincode: '500034',
    isVerified: true, listingPlan: ListingPlan.PREMIUM, listingExpiresAt: futureDate(60),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.AGENT,
    brokerage: '2%', viewCount: 960, owner: agent4, ownerId: agent4.id,
  }, OFFICE_IMGS.slice(0, 3));

  // ── INDUSTRIAL / WAREHOUSE ────────────────────────────────────────────────────
  await createProperty({
    title: 'Warehouse for Rent in Ghaziabad Industrial Area', slug: 'warehouse-rent-ghaziabad-036',
    description: 'Large industrial warehouse in NH-58 Ghaziabad. 5000 sqft RCC structure, 25ft clear height, 3-phase power 100KW, truck dock with 40-ton capacity ramp. CCTV, 24x7 security guard, firefighting system.',
    type: PropertyType.COMMERCIAL_WAREHOUSE, category: PropertyCategory.INDUSTRIAL, price: 150000, priceUnit: 'per month',
    area: 5000, areaUnit: 'sqft', city: 'Ghaziabad', state: 'Uttar Pradesh', locality: 'Industrial Area',
    address: 'NH-58, Industrial Area Phase 2, Ghaziabad', pincode: '201001',
    isVerified: true, isFeatured: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, brokerage: '2 Months', viewCount: 1890, owner: agent3, ownerId: agent3.id,
  }, WAREHOUSE_IMGS);

  await createProperty({
    title: 'Factory Shed for Sale in Noida Sector 63', slug: 'factory-noida-sector63-037',
    description: 'Ready industrial factory shed for sale. 8000 sqft RCC structure with 30ft height. 3-phase 250KW power, overhead crane provision, admin block, 4 truck parking. HSIIDC approved plot.',
    type: PropertyType.FACTORY, category: PropertyCategory.INDUSTRIAL, price: 25000000, priceUnit: 'total',
    area: 8000, areaUnit: 'sqft', city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 63',
    address: 'Sector 63, Noida, UP', pincode: '201301',
    isVerified: true, listingPlan: ListingPlan.PREMIUM, listingExpiresAt: futureDate(60),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.AGENT,
    brokerage: '1%', viewCount: 980, owner: agent3, ownerId: agent3.id,
  }, WAREHOUSE_IMGS.slice(1, 3));

  await createProperty({
    title: 'Industrial Shed for Lease in Bhiwandi', slug: 'industrial-shed-bhiwandi-038',
    description: '12,000 sqft industrial shed in Asia\'s largest warehousing hub — Bhiwandi, Thane. 35ft height, dual-entry truck dock, 3-phase 200KW power, 24x7 security. Strategic location near NH-3 and JN Port.',
    type: PropertyType.INDUSTRIAL_SHED, category: PropertyCategory.INDUSTRIAL, price: 280000, priceUnit: 'per month',
    area: 12000, areaUnit: 'sqft', city: 'Mumbai', state: 'Maharashtra', locality: 'Bhiwandi',
    address: 'Bhiwandi Warehousing Hub, Thane', pincode: '421302',
    isVerified: true, isFeatured: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, brokerage: '2 Months', viewCount: 2340, owner: agent1, ownerId: agent1.id,
  }, WAREHOUSE_IMGS);

  await createProperty({
    title: 'Warehouse for Sale in Hyderabad Patancheru', slug: 'warehouse-hyderabad-039',
    description: 'IDA-approved warehouse property for sale in Patancheru industrial zone. 6500 sqft with future expansion potential. Water, power, drainage in place. HMDA approved layout. 20 mins from Hitec City.',
    type: PropertyType.COMMERCIAL_WAREHOUSE, category: PropertyCategory.INDUSTRIAL, price: 18000000, priceUnit: 'total',
    area: 6500, areaUnit: 'sqft', city: 'Hyderabad', state: 'Telangana', locality: 'Patancheru',
    address: 'IDA Patancheru, Hyderabad', pincode: '502319',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.AGENT,
    brokerage: '1%', viewCount: 760, owner: agent4, ownerId: agent4.id,
  }, WAREHOUSE_IMGS.slice(0, 2));

  // ── PG / CO-LIVING ────────────────────────────────────────────────────────────
  await createProperty({
    title: 'Premium PG Accommodation in Koramangala', slug: 'pg-koramangala-040',
    description: 'Premium fully-managed PG in the heart of Koramangala startup hub. AC single/double rooms with attached bath. Includes: breakfast + dinner, WiFi (100 Mbps), weekly laundry, housekeeping.',
    type: PropertyType.PG, category: PropertyCategory.PG, price: 18000, priceUnit: 'per month',
    area: 200, areaUnit: 'sqft', bedrooms: 1, bathrooms: 1,
    furnishingStatus: FurnishingStatus.FURNISHED,
    city: 'Bangalore', state: 'Karnataka', locality: 'Koramangala',
    address: '5th Block, Koramangala, Bangalore', pincode: '560095',
    isVerified: true, isFeatured: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.OWNER, viewCount: 1120, owner: seller2, ownerId: seller2.id,
  }, PG_IMGS);

  await createProperty({
    title: 'Co-Living Space for Working Professionals in Gurgaon', slug: 'coliving-gurgaon-041',
    description: 'Modern co-living space near Cyber Hub Gurgaon. Private single rooms with en-suite. Fully managed — cleaning, laundry, meals included. Co-working lounge, gym, rooftop terrace, game room.',
    type: PropertyType.CO_LIVING, category: PropertyCategory.PG, price: 22000, priceUnit: 'per month',
    area: 220, areaUnit: 'sqft', bedrooms: 1, bathrooms: 1,
    furnishingStatus: FurnishingStatus.FURNISHED,
    city: 'Gurgaon', state: 'Haryana', locality: 'Sector 29',
    address: 'Near Cyber Hub, Sector 29, Gurgaon', pincode: '122002',
    isVerified: true, listingPlan: ListingPlan.PREMIUM, listingExpiresAt: futureDate(60),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    viewCount: 890, owner: seller, ownerId: seller.id,
  }, PG_IMGS.slice(1, 3));

  await createProperty({
    title: 'Girls PG in Powai Mumbai Near IT Hub', slug: 'girls-pg-powai-042',
    description: 'Well-maintained girls-only PG accommodation in Powai near Hiranandani. AC rooms (single/double/triple). Meals: breakfast + dinner. 24x7 security warden. Washing machine, geyser, WiFi included.',
    type: PropertyType.PG, category: PropertyCategory.PG, price: 14000, priceUnit: 'per month',
    area: 180, areaUnit: 'sqft', bedrooms: 1, bathrooms: 1,
    furnishingStatus: FurnishingStatus.FURNISHED,
    city: 'Mumbai', state: 'Maharashtra', locality: 'Powai',
    address: 'Hiranandani Gardens, Powai, Mumbai', pincode: '400076',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    viewCount: 560, owner: seller, ownerId: seller.id,
  }, PG_IMGS);

  await createProperty({
    title: 'Co-Living Hostel in Gachibowli Hyderabad', slug: 'coliving-gachibowli-043',
    description: 'Premium co-living accommodation near HITEC City. Private AC rooms. All-inclusive: meals, WiFi, laundry, housekeeping. Community events, networking sessions. Gym access. Direct shuttle to major IT parks.',
    type: PropertyType.CO_LIVING, category: PropertyCategory.PG, price: 15000, priceUnit: 'per month',
    area: 190, areaUnit: 'sqft', bedrooms: 1, bathrooms: 1,
    furnishingStatus: FurnishingStatus.FURNISHED,
    city: 'Hyderabad', state: 'Telangana', locality: 'Gachibowli',
    address: 'Near Financial District, Gachibowli, Hyderabad', pincode: '500032',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    viewCount: 430, owner: seller3, ownerId: seller3.id,
  }, PG_IMGS.slice(0, 2));

  await createProperty({
    title: 'Boys PG Near Electronic City Bangalore', slug: 'boys-pg-electronic-city-044',
    description: 'Well-maintained boys PG near Electronic City Phase 1. AC and non-AC rooms. 3 meals daily, high-speed WiFi, TV lounge, laundry. 5 mins walk to Infosys gate. Monthly rent starts from ₹8000.',
    type: PropertyType.PG, category: PropertyCategory.PG, price: 9000, priceUnit: 'per month',
    area: 150, areaUnit: 'sqft', bedrooms: 1, bathrooms: 1,
    furnishingStatus: FurnishingStatus.FURNISHED,
    city: 'Bangalore', state: 'Karnataka', locality: 'Electronic City',
    address: 'Electronic City Phase 1, Bangalore', pincode: '560100',
    isVerified: true, listingPlan: ListingPlan.FREE, approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.OWNER, viewCount: 890, owner: seller2, ownerId: seller2.id,
  }, PG_IMGS.slice(0, 2));

  // ── BUILDER PROJECTS ──────────────────────────────────────────────────────────
  await createProperty({
    title: 'New Project: 3 BHK Under Construction in Thane', slug: 'new-project-thane-045',
    description: 'Pre-launch pricing! Grand new township project in Thane West. 3 BHK units starting from 1.1 Cr. RERA registered. Possession December 2026. 50+ amenities: sky garden, Olympic pool, cricket pitch, school inside campus.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUILDER_PROJECT, price: 11000000, priceUnit: 'total',
    area: 1400, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3, floorNumber: 20, totalFloors: 32,
    furnishingStatus: FurnishingStatus.UNFURNISHED, possessionStatus: PossessionStatus.UNDER_CONSTRUCTION,
    city: 'Mumbai', state: 'Maharashtra', locality: 'Thane West', society: 'Godrej Reserve',
    address: 'Thane West, Maharashtra', pincode: '400615',
    isVerified: true, isFeatured: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, reraNumber: 'P51700047826',
    viewCount: 4200, owner: agent1, ownerId: agent1.id,
  }, APARTMENT_IMGS.slice(0, 5));

  await createProperty({
    title: 'New Launch: 2 BHK in Sarjapur Road Bangalore', slug: 'new-project-sarjapur-046',
    description: 'New residential project on high-growth Sarjapur Road, Bangalore. 2 & 3 BHK apartments. Close to Wipro campus, Cessna Business Park. Possession 2026. RERA compliant. Pre-launch offer.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUILDER_PROJECT, price: 6000000, priceUnit: 'total',
    area: 1000, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2, floorNumber: 12, totalFloors: 20,
    furnishingStatus: FurnishingStatus.UNFURNISHED, possessionStatus: PossessionStatus.UNDER_CONSTRUCTION,
    city: 'Bangalore', state: 'Karnataka', locality: 'Sarjapur Road',
    address: 'Sarjapur Road, Bangalore', pincode: '560035',
    isVerified: true, listingPlan: ListingPlan.PREMIUM, listingExpiresAt: futureDate(60),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.AGENT,
    reraNumber: 'PRM/KA/RERA/1251/309/PR/220820/004599',
    viewCount: 2800, owner: agent2, ownerId: agent2.id,
  }, APARTMENT_IMGS.slice(1, 5));

  await createProperty({
    title: 'Prestige Smart City 3 BHK Whitefield Bangalore', slug: 'prestige-smart-city-047',
    description: 'Premium 3 BHK in Prestige Smart City, Whitefield. RERA registered mega-township. 12-acre landscape, 80+ amenities, 8 towers. Possession Q2 2026. Near ITPL and Kadugodi metro station.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUILDER_PROJECT, price: 15500000, priceUnit: 'total',
    area: 1620, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3, floorNumber: 22, totalFloors: 35,
    furnishingStatus: FurnishingStatus.UNFURNISHED, possessionStatus: PossessionStatus.UNDER_CONSTRUCTION,
    city: 'Bangalore', state: 'Karnataka', locality: 'Whitefield', society: 'Prestige Smart City',
    address: 'Whitefield, Bangalore', pincode: '560066',
    isVerified: true, isFeatured: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, reraNumber: 'PRM/KA/RERA/1251/299/PR/211228/003600',
    viewCount: 3600, owner: agent2, ownerId: agent2.id,
  }, APARTMENT_IMGS.slice(0, 5));

  // ── INVESTMENT / PLOT ─────────────────────────────────────────────────────────
  await createProperty({
    title: 'Investment Plot in Noida Expressway', slug: 'plot-noida-expressway-048',
    description: 'Prime investment plot on Noida-Greater Noida Expressway. 500 sqyd approved by YEIDA. Near Jaypee Wishtown and upcoming Metro station. Commercial/residential use permitted.',
    type: PropertyType.PLOT, category: PropertyCategory.INVESTMENT, price: 8500000, priceUnit: 'total',
    area: 500, areaUnit: 'sqyd', city: 'Noida', state: 'Uttar Pradesh', locality: 'Noida Expressway',
    address: 'Sector 150, Noida Expressway', pincode: '201310',
    isVerified: true, listingPlan: ListingPlan.PREMIUM, listingExpiresAt: futureDate(60),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.AGENT,
    viewCount: 1340, owner: agent3, ownerId: agent3.id,
  }, PLOT_IMGS);

  await createProperty({
    title: 'Agricultural Land for Sale near Alibaug', slug: 'land-alibaug-049',
    description: 'Scenic agricultural land near Alibaug, 2 hours from Mumbai by sea. 5 acres with cashew and mango plantation. Bore well, electricity. Perfect for farmhouse, resort, or organic farming. Beach 3 km away.',
    type: PropertyType.LAND, category: PropertyCategory.INVESTMENT, price: 12000000, priceUnit: 'total',
    area: 5, areaUnit: 'acre', city: 'Mumbai', state: 'Maharashtra', locality: 'Alibaug',
    address: 'Alibaug, Raigad, Maharashtra', pincode: '402201',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    viewCount: 780, owner: seller, ownerId: seller.id,
  }, PLOT_IMGS);

  await createProperty({
    title: 'Residential Plot in Ahmedabad SG Highway', slug: 'plot-ahmedabad-sg-highway-050',
    description: 'AUDA-approved residential plot near SG Highway, Ahmedabad. 300 sqyd in gated plotted development. All utilities in place. Near Iskon temple and premium schools. Excellent appreciation potential.',
    type: PropertyType.PLOT, category: PropertyCategory.INVESTMENT, price: 5500000, priceUnit: 'total',
    area: 300, areaUnit: 'sqyd', city: 'Ahmedabad', state: 'Gujarat', locality: 'SG Highway',
    address: 'Near SG Highway, Ahmedabad', pincode: '380054',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    viewCount: 620, owner: seller, ownerId: seller.id,
  }, PLOT_IMGS);

  // ── MORE CITIES ───────────────────────────────────────────────────────────────
  await createProperty({
    title: '2 BHK Apartment in Ahmedabad Prahlad Nagar', slug: 'apartment-ahmedabad-051',
    description: '2 BHK in premium Prahlad Nagar, Ahmedabad\'s most upmarket locality. Near SG Highway, Iskon temple, and top malls. Society with swimming pool, gym, garden.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 7500000, priceUnit: 'total',
    area: 1100, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2, floorNumber: 4,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Ahmedabad', state: 'Gujarat', locality: 'Prahlad Nagar',
    address: 'Prahlad Nagar, Ahmedabad', pincode: '380015',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    viewCount: 420, owner: seller, ownerId: seller.id,
  }, APARTMENT_IMGS.slice(1, 4));

  await createProperty({
    title: '3 BHK Villa in Jaipur Vaishali Nagar', slug: 'villa-jaipur-052',
    description: 'Beautiful 3 BHK independent villa with Rajasthani design elements in Vaishali Nagar, Jaipur. Private garden with fountain. Near Vaishali Nagar metro station and Mansarovar commercial area.',
    type: PropertyType.VILLA, category: PropertyCategory.BUY, price: 12000000, priceUnit: 'total',
    area: 2400, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Jaipur', state: 'Rajasthan', locality: 'Vaishali Nagar',
    address: 'Vaishali Nagar, Jaipur', pincode: '302021',
    isVerified: true, listingPlan: ListingPlan.PREMIUM, listingExpiresAt: futureDate(60),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.AGENT,
    viewCount: 560, owner: agent3, ownerId: agent3.id,
  }, VILLA_IMGS.slice(0, 4));

  await createProperty({
    title: '2 BHK Flat in Lucknow Gomti Nagar', slug: 'apartment-lucknow-053',
    description: 'Modern 2 BHK in Gomti Nagar, Lucknow\'s prime residential area. Near Sahara Ganj Mall, Ram Manohar Lohia Hospital. Good connectivity to Hazratganj market. Society with power backup.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 4800000, priceUnit: 'total',
    area: 1100, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2, floorNumber: 3,
    furnishingStatus: FurnishingStatus.UNFURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Lucknow', state: 'Uttar Pradesh', locality: 'Gomti Nagar',
    address: 'Gomti Nagar Extension, Lucknow', pincode: '226010',
    isVerified: false, listingPlan: ListingPlan.FREE, approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.OWNER, viewCount: 280, owner: seller, ownerId: seller.id,
  }, APARTMENT_IMGS.slice(2, 4));

  await createProperty({
    title: '3 BHK Apartment for Rent in Kochi Kakkanad', slug: 'rent-apartment-kochi-054',
    description: '3 BHK fully furnished apartment for rent near InfoPark, Kakkanad Kochi. Close to Infopark Kochi, Lulu Mall. Society with pool, gym, children\'s park. 5 mins to proposed Metro station.',
    type: PropertyType.APARTMENT, category: PropertyCategory.RENT, price: 35000, priceUnit: 'per month',
    area: 1400, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Kochi', state: 'Kerala', locality: 'Kakkanad',
    address: 'Infopark Road, Kakkanad, Kochi', pincode: '682030',
    isVerified: true, listingPlan: ListingPlan.BASIC, listingExpiresAt: futureDate(30),
    approvalStatus: ApprovalStatus.APPROVED, listedBy: ListingUserType.OWNER,
    brokerage: '1 Month', viewCount: 320, owner: seller2, ownerId: seller2.id,
  }, APARTMENT_IMGS.slice(0, 4));

  // ── FARMHOUSE ─────────────────────────────────────────────────────────────────
  await createProperty({
    title: 'Luxury Farmhouse for Sale near Delhi NCR', slug: 'farmhouse-delhi-ncr-055',
    description: 'Exclusive 2-acre farmhouse estate in Chhatarpur, South Delhi. Main bungalow 6000 sqft with guest cottage, pool, tennis court, and 50-tree orchard. On 60-ft road, 24x7 power backup, borewell.',
    type: PropertyType.FARM_HOUSE, category: PropertyCategory.BUY, price: 120000000, priceUnit: 'total',
    area: 2, areaUnit: 'acre', bedrooms: 5, bathrooms: 6,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Delhi', state: 'Delhi', locality: 'Chhatarpur',
    address: 'Chattarpur Farms, South Delhi', pincode: '110074',
    isFeatured: true, isPremium: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, viewCount: 3450, owner: agent3, ownerId: agent3.id,
  }, VILLA_IMGS.slice(0, 5));

  // ── PENDING PROPERTIES (for admin panel testing) ───────────────────────────────
  await createProperty({
    title: '2 BHK Apartment in Noida Sector 78', slug: 'apartment-noida-sec78-056',
    description: 'Well-located 2 BHK apartment in Sector 78 Noida awaiting owner approval.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 7200000, priceUnit: 'total',
    area: 1000, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2, floorNumber: 2,
    furnishingStatus: FurnishingStatus.UNFURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 78',
    address: 'Sector 78, Noida', pincode: '201301',
    approvalStatus: ApprovalStatus.PENDING, listedBy: ListingUserType.OWNER,
    viewCount: 45, owner: seller, ownerId: seller.id,
  }, APARTMENT_IMGS.slice(0, 2));

  await createProperty({
    title: 'Shop for Rent in Indiranagar Bangalore', slug: 'shop-rent-indiranagar-057',
    description: 'Prime 600 sqft ground floor shop for rent on 100 Feet Road, Indiranagar. High footfall commercial street.',
    type: PropertyType.COMMERCIAL_SHOP, category: PropertyCategory.COMMERCIAL, price: 85000, priceUnit: 'per month',
    area: 600, areaUnit: 'sqft', city: 'Bangalore', state: 'Karnataka', locality: 'Indiranagar',
    address: '100 Feet Road, Indiranagar, Bangalore', pincode: '560038',
    approvalStatus: ApprovalStatus.PENDING, listedBy: ListingUserType.OWNER,
    brokerage: '2%', viewCount: 120, owner: seller2, ownerId: seller2.id,
  }, OFFICE_IMGS.slice(0, 2));

  // ── NOIDA WAREHOUSE PROPERTIES (from think4buysale.in/warehouse-space-for-rent-in-noida.php) ──
  await createProperty({
    title: 'Warehouse for Rent in Noida Sector 63 — 5000 sqft', slug: 'warehouse-noida-sec63-058',
    description: 'Premium warehouse space at KLJ Noida One, Sector 63. 5000 sqft RCC structure with 30ft height, humidity-controlled environment, 3-phase power supply, loading docks with truck ramp. CCTV surveillance, 24x7 security, fire safety measures. Excellent transport connectivity on Sector 63 Road. ₹30/sqft.',
    type: PropertyType.COMMERCIAL_WAREHOUSE, category: PropertyCategory.INDUSTRIAL, price: 150000, priceUnit: 'per month',
    area: 5000, areaUnit: 'sqft', city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 63',
    address: 'Plot No B-706, Tower C, KLJ Noida One, Sector 63 Rd, Noida', pincode: '201301',
    isVerified: true, isFeatured: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, brokerage: '1 Month', viewCount: 1240, owner: agent3, ownerId: agent3.id,
  }, WAREHOUSE_IMGS);

  await createProperty({
    title: 'Warehouse for Rent in Noida Sector 63 — 10000 sqft', slug: 'warehouse-noida-sec63-059',
    description: 'Large-format warehouse in Noida Sector 63 — 10,000 sqft with 25ft clear height, crane access, dual loading docks, continuous electricity and water supply. Broad entrance for heavy vehicles. Ideal for FMCG, e-commerce, or manufacturing storage. ₹25/sqft.',
    type: PropertyType.COMMERCIAL_WAREHOUSE, category: PropertyCategory.INDUSTRIAL, price: 250000, priceUnit: 'per month',
    area: 10000, areaUnit: 'sqft', city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 63',
    address: 'Plot No B-706, KLJ Noida One, Sector 63 Rd, Noida', pincode: '201301',
    isVerified: true, listingPlan: ListingPlan.PREMIUM,
    listingExpiresAt: futureDate(60), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, brokerage: '1 Month', viewCount: 980, owner: agent3, ownerId: agent3.id,
  }, WAREHOUSE_IMGS.slice(0, 2));

  await createProperty({
    title: 'Warehouse for Rent in Noida Sector 63 — 20000 sqft', slug: 'warehouse-noida-sec63-060',
    description: 'High-capacity 20,000 sqft warehouse at Sector 63 Noida. 18ft clear height, multiple loading bays, 3-phase power 200KW, fire suppression system, CCTV, dedicated security personnel. Perfect for bulk logistics and warehousing operations. ₹18/sqft.',
    type: PropertyType.COMMERCIAL_WAREHOUSE, category: PropertyCategory.INDUSTRIAL, price: 375000, priceUnit: 'per month',
    area: 20000, areaUnit: 'sqft', city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 63',
    address: 'Plot No B-706, KLJ Noida One, Sector 63 Rd, Noida', pincode: '201301',
    isVerified: true, listingPlan: ListingPlan.PREMIUM,
    listingExpiresAt: futureDate(60), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, brokerage: '1 Month', viewCount: 860, owner: agent3, ownerId: agent3.id,
  }, WAREHOUSE_IMGS.slice(1, 3));

  await createProperty({
    title: 'Warehouse for Rent in Noida Sector 63 — 2800 sqft', slug: 'warehouse-noida-sec63-061',
    description: 'Compact warehouse unit of 2800 sqft in KLJ Noida One, Sector 63. Suitable for SMEs and startups. Heightened shed, humidity control, continuous power supply. Shared loading dock, 24x7 security, fire safety. ₹30/sqft.',
    type: PropertyType.COMMERCIAL_WAREHOUSE, category: PropertyCategory.INDUSTRIAL, price: 84000, priceUnit: 'per month',
    area: 2800, areaUnit: 'sqft', city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 63',
    address: 'Plot No B-706, KLJ Noida One, Sector 63 Rd, Noida', pincode: '201301',
    isVerified: false, listingPlan: ListingPlan.BASIC,
    listingExpiresAt: futureDate(30), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.OWNER, brokerage: '1 Month', viewCount: 540, owner: seller3, ownerId: seller3.id,
  }, WAREHOUSE_IMGS.slice(0, 2));

  await createProperty({
    title: 'Warehouse for Rent in Noida Sector 63 — 60000 sqft', slug: 'warehouse-noida-sec63-062',
    description: 'Mega warehouse facility in Noida Sector 63 — 60,000 sqft. Ideal for large-scale distribution, cold chain logistics, or 3PL operations. 30ft clear height, 8 truck docks, overhead crane provisions, 3-phase 500KW power, CCTV across all zones, DG backup, fire NOC. ₹30/sqft.',
    type: PropertyType.COMMERCIAL_WAREHOUSE, category: PropertyCategory.INDUSTRIAL, price: 1800000, priceUnit: 'per month',
    area: 60000, areaUnit: 'sqft', city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 63',
    address: 'Plot No B-706, KLJ Noida One, Sector 63 Rd, Noida', pincode: '201301',
    isVerified: true, isFeatured: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), approvalStatus: ApprovalStatus.APPROVED,
    listedBy: ListingUserType.AGENT, brokerage: '2 Months', viewCount: 1560, owner: agent3, ownerId: agent3.id,
  }, WAREHOUSE_IMGS);

  // ── BULK FILLER PROPERTIES TO REACH 80+ ───────────────────────────────────────
  const bulkCities = [
    { city: 'Mumbai', state: 'Maharashtra', locality: 'Andheri West', pin: '400058' },
    { city: 'Delhi', state: 'Delhi', locality: 'Rohini', pin: '110085' },
    { city: 'Bangalore', state: 'Karnataka', locality: 'Marathahalli', pin: '560037' },
    { city: 'Hyderabad', state: 'Telangana', locality: 'Manikonda', pin: '500089' },
    { city: 'Pune', state: 'Maharashtra', locality: 'Kharadi', pin: '411014' },
    { city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 50', pin: '201301' },
    { city: 'Gurgaon', state: 'Haryana', locality: 'Sector 56', pin: '122011' },
    { city: 'Chennai', state: 'Tamil Nadu', locality: 'Velachery', pin: '600042' },
    { city: 'Kolkata', state: 'West Bengal', locality: 'Rajarhat', pin: '700135' },
    { city: 'Ahmedabad', state: 'Gujarat', locality: 'Bopal', pin: '380058' },
    { city: 'Jaipur', state: 'Rajasthan', locality: 'Jagatpura', pin: '302017' },
    { city: 'Lucknow', state: 'Uttar Pradesh', locality: 'Hazratganj', pin: '226001' },
    { city: 'Mumbai', state: 'Maharashtra', locality: 'Goregaon East', pin: '400063' },
    { city: 'Delhi', state: 'Delhi', locality: 'Janakpuri', pin: '110058' },
    { city: 'Bangalore', state: 'Karnataka', locality: 'JP Nagar', pin: '560078' },
    { city: 'Hyderabad', state: 'Telangana', locality: 'Nallagandla', pin: '500019' },
    { city: 'Pune', state: 'Maharashtra', locality: 'Wakad', pin: '411057' },
    { city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 100', pin: '201301' },
    { city: 'Gurgaon', state: 'Haryana', locality: 'Palam Vihar', pin: '122017' },
    { city: 'Chennai', state: 'Tamil Nadu', locality: 'Porur', pin: '600116' },
    { city: 'Hyderabad', state: 'Telangana', locality: 'Kukatpally', pin: '500072' },
    { city: 'Bangalore', state: 'Karnataka', locality: 'Bellandur', pin: '560103' },
    { city: 'Mumbai', state: 'Maharashtra', locality: 'Chembur', pin: '400071' },
  ];

  const agents = [agent1, agent2, agent3, agent4];
  const sellers = [seller, seller2, seller3];

  for (let i = 0; i < 23; i++) {
    const c = bulkCities[i];
    const bhk = [1, 2, 2, 3, 3, 4][i % 6];
    const isRent = i % 3 === 0;
    const basePrice = isRent ? (bhk * 8000 + 10000) : (bhk * 2000000 + 4000000);
    const ag = agents[i % 4];
    const useAgent = i % 2 === 0;
    const owner = useAgent ? ag : sellers[i % 3];
    await createProperty({
      title: `${bhk} BHK Apartment ${isRent ? 'for Rent' : 'for Sale'} in ${c.locality} ${c.city}`,
      slug: `apartment-${c.locality.toLowerCase().replace(/\s+/g, '-')}-${i + 63}`,
      description: `Well-maintained ${bhk} BHK apartment in ${c.locality}, ${c.city}. Close to metro, markets, and hospitals. Society with 24x7 security, power backup, and parking. ${isRent ? 'Ready for immediate possession.' : 'Vastu-compliant, good investment option.'}`,
      type: PropertyType.APARTMENT,
      category: isRent ? PropertyCategory.RENT : PropertyCategory.BUY,
      price: basePrice,
      priceUnit: isRent ? 'per month' : 'total',
      area: 800 + bhk * 200,
      areaUnit: 'sqft',
      bedrooms: bhk,
      bathrooms: bhk,
      balconies: 1,
      floorNumber: 3 + (i % 8),
      totalFloors: 12,
      furnishingStatus: i % 3 === 0 ? FurnishingStatus.FURNISHED : i % 3 === 1 ? FurnishingStatus.SEMI_FURNISHED : FurnishingStatus.UNFURNISHED,
      possessionStatus: PossessionStatus.READY_TO_MOVE,
      city: c.city,
      state: c.state,
      locality: c.locality,
      address: `${c.locality}, ${c.city}`,
      pincode: c.pin,
      isVerified: i % 4 !== 0,
      listingPlan: i % 5 === 0 ? ListingPlan.FEATURED : i % 3 === 0 ? ListingPlan.PREMIUM : ListingPlan.BASIC,
      listingExpiresAt: futureDate(30 + i * 3),
      approvalStatus: ApprovalStatus.APPROVED,
      listedBy: useAgent ? ListingUserType.AGENT : ListingUserType.OWNER,
      brokerage: isRent ? '1 Month' : undefined,
      viewCount: Math.floor(Math.random() * 800 + 100),
      isFeatured: i % 5 === 0,
      owner: owner,
      ownerId: owner.id,
    }, APARTMENT_IMGS.slice(i % 4, (i % 4) + 3));
  }

  // ── ADMIN-OWNED PROPERTIES (visible in admin's "My Listings") ─────────────────
  await createProperty({
    title: '3 BHK Luxury Apartment in South Delhi', slug: 'admin-apartment-south-delhi-a1',
    description: 'Spacious 3 BHK luxury apartment in Defence Colony, South Delhi. Fully furnished, modular kitchen, premium fittings. Society amenities include gym, pool, and 24x7 security. Ideal for families or professionals.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 28000000, priceUnit: 'total',
    area: 1800, areaUnit: 'sqft', bedrooms: 3, bathrooms: 3, balconies: 2, floorNumber: 7, totalFloors: 15,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Delhi', state: 'Delhi', locality: 'Defence Colony',
    address: 'Defence Colony, New Delhi', pincode: '110024',
    isFeatured: true, isPremium: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90), boostExpiresAt: futureDate(45),
    approvalStatus: ApprovalStatus.APPROVED, status: PropertyStatus.ACTIVE,
    listedBy: ListingUserType.OWNER, viewCount: 2350, owner: admin, ownerId: admin.id,
  }, APARTMENT_IMGS.slice(0, 5));

  await createProperty({
    title: '4 BHK Villa for Sale in Gurgaon Golf Course Road', slug: 'admin-villa-gurgaon-a2',
    description: 'Premium 4 BHK independent villa on Golf Course Road, Gurgaon. Private garden, swimming pool, home theatre. Located in upscale DLF Phase 5. Close to Cyber Hub, top malls, and international schools.',
    type: PropertyType.VILLA, category: PropertyCategory.BUY, price: 65000000, priceUnit: 'total',
    area: 5200, areaUnit: 'sqft', bedrooms: 4, bathrooms: 5,
    furnishingStatus: FurnishingStatus.FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Gurgaon', state: 'Haryana', locality: 'Golf Course Road',
    address: 'DLF Phase 5, Golf Course Road, Gurgaon', pincode: '122009',
    isFeatured: true, isPremium: true, isVerified: true, listingPlan: ListingPlan.FEATURED,
    listingExpiresAt: futureDate(90),
    approvalStatus: ApprovalStatus.APPROVED, status: PropertyStatus.ACTIVE,
    listedBy: ListingUserType.OWNER, viewCount: 1890, owner: admin, ownerId: admin.id,
  }, VILLA_IMGS.slice(0, 5));

  await createProperty({
    title: '2 BHK Apartment for Rent in Powai Mumbai', slug: 'admin-rent-powai-a3',
    description: '2 BHK semi-furnished apartment for rent in Hiranandani Gardens, Powai. Lake view. Society has pool, gym, children\'s park. Near IIT Bombay, L&T, and top tech campuses.',
    type: PropertyType.APARTMENT, category: PropertyCategory.RENT, price: 55000, priceUnit: 'per month',
    area: 1050, areaUnit: 'sqft', bedrooms: 2, bathrooms: 2, balconies: 1, floorNumber: 10, totalFloors: 18,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Mumbai', state: 'Maharashtra', locality: 'Powai',
    address: 'Hiranandani Gardens, Powai, Mumbai', pincode: '400076',
    isVerified: true, listingPlan: ListingPlan.PREMIUM, listingExpiresAt: futureDate(60),
    approvalStatus: ApprovalStatus.APPROVED, status: PropertyStatus.ACTIVE,
    listedBy: ListingUserType.OWNER, brokerage: '1 Month',
    viewCount: 1120, owner: admin, ownerId: admin.id,
  }, APARTMENT_IMGS.slice(2, 5));

  await createProperty({
    title: 'Office Space for Rent in Connaught Place New Delhi', slug: 'admin-office-cp-a4',
    description: 'Premium 1800 sqft Grade A office space in Connaught Place\'s inner circle. Fully fitted with partitioned cabins, conference room, reception area, pantry. Metro-accessible. Ideal for law firms, consultancies, and financial services.',
    type: PropertyType.COMMERCIAL_OFFICE, category: PropertyCategory.COMMERCIAL, price: 250000, priceUnit: 'per month',
    area: 1800, areaUnit: 'sqft', city: 'Delhi', state: 'Delhi', locality: 'Connaught Place',
    address: 'Inner Circle, Connaught Place, New Delhi', pincode: '110001',
    isFeatured: true, isVerified: true, listingPlan: ListingPlan.FEATURED, listingExpiresAt: futureDate(90),
    approvalStatus: ApprovalStatus.APPROVED, status: PropertyStatus.ACTIVE,
    listedBy: ListingUserType.OWNER, brokerage: '2 Months',
    viewCount: 3200, owner: admin, ownerId: admin.id,
  }, OFFICE_IMGS.slice(0, 3));

  await createProperty({
    title: '3 BHK Apartment Pending Review in Noida', slug: 'admin-pending-noida-a5',
    description: '3 BHK well-maintained apartment in Sector 62 Noida, submitted for admin review.',
    type: PropertyType.APARTMENT, category: PropertyCategory.BUY, price: 9500000, priceUnit: 'total',
    area: 1350, areaUnit: 'sqft', bedrooms: 3, bathrooms: 2, floorNumber: 4,
    furnishingStatus: FurnishingStatus.UNFURNISHED, possessionStatus: PossessionStatus.READY_TO_MOVE,
    city: 'Noida', state: 'Uttar Pradesh', locality: 'Sector 62',
    address: 'Sector 62, Noida', pincode: '201309',
    approvalStatus: ApprovalStatus.PENDING, status: PropertyStatus.INACTIVE,
    listedBy: ListingUserType.OWNER, viewCount: 12, owner: admin, ownerId: admin.id,
  }, APARTMENT_IMGS.slice(1, 3));

  console.log('All properties seeded successfully (including admin-owned properties)');

  // ─── Agencies — linked to real countryId / stateId / cityId ─────────────────
  const agencyRepo = dataSource.getRepository(Agency);
  const agentProfileRepo = dataSource.getRepository(AgentProfile);
  const propertyAgentMapRepo = dataSource.getRepository(PropertyAgentMap);
  const agentLocationMapRepo = dataSource.getRepository(AgentLocationMap);

  const [agencyPropElite, agencyHomeFirst, agencyCapital, agencySaffron] = await agencyRepo.save([
    {
      name: 'PropElite Realty',
      description: 'Mumbai\'s leading luxury residential and commercial real estate agency. 15+ years of excellence in premium property dealings across Bandra, Juhu, Powai, and South Mumbai.',
      contactEmail: 'contact@propelite.in',
      contactPhone: '9811000001',
      address: 'Level 12, One BKC, Bandra Kurla Complex, Mumbai – 400051',
      website: 'https://propelite.in',
      licenseNumber: 'MH-RERA-AGENCY-001',
      countryId: india.id,
      stateId: mh.id,
      cityId: mumbaiCity.id,
      isActive: true,
      isVerified: true,
      totalAgents: 1,
    },
    {
      name: 'HomeFirst Properties',
      description: 'Bangalore\'s top-rated real estate firm specialising in tech-corridor residential, luxury villas, and commercial leasing. Serving IT professionals since 2016.',
      contactEmail: 'info@homefirst.co.in',
      contactPhone: '9811000002',
      address: 'No. 24, 2nd Floor, Koramangala 5th Block, Bangalore – 560034',
      website: 'https://homefirst.co.in',
      licenseNumber: 'KA-RERA-AGENCY-002',
      countryId: india.id,
      stateId: ka.id,
      cityId: bangaloreCity.id,
      isActive: true,
      isVerified: true,
      totalAgents: 1,
    },
    {
      name: 'Capital Estates',
      description: 'Delhi NCR\'s most trusted real estate consultancy. Expert in South Delhi, Gurgaon, Noida, and Faridabad properties. 20+ years of heritage and trust.',
      contactEmail: 'delhi@capitalestates.in',
      contactPhone: '9811000003',
      address: '203, DLF Centre, Sansad Marg, Connaught Place, New Delhi – 110001',
      website: 'https://capitalestates.in',
      licenseNumber: 'DL-RERA-AGENCY-003',
      countryId: india.id,
      stateId: dl.id,
      cityId: delhiCity.id,
      isActive: true,
      isVerified: true,
      totalAgents: 1,
    },
    {
      name: 'Saffron Realty',
      description: 'Hyderabad\'s premier real estate agency for residential and IT-corridor commercial properties. Trusted by 1000+ IT families in HITEC City, Gachibowli, and Financial District.',
      contactEmail: 'info@saffronrealty.in',
      contactPhone: '9811000004',
      address: 'Plot 45, Jubilee Hills, Hyderabad – 500033',
      website: 'https://saffronrealty.in',
      licenseNumber: 'TS-RERA-AGENCY-004',
      countryId: india.id,
      stateId: ts.id,
      cityId: hyderabadCity.id,
      isActive: true,
      isVerified: true,
      totalAgents: 1,
    },
  ]);
  console.log('Agencies seeded (with countryId, stateId, cityId)');

  // ─── Agent Profiles — linked to agencies ─────────────────────────────────────
  const [profile1, profile2, profile3, profile4] = await agentProfileRepo.save([
    {
      userId: agent1.id,
      agencyId: agencyPropElite.id,
      experienceYears: 12,
      licenseNumber: 'MH-RERA-A12345',
      rating: 4.8,
      totalDeals: 340,
      totalListings: 0,
      bio: 'Senior consultant with 12 years in Mumbai luxury residential and commercial. Expert in Bandra, Juhu, Powai.',
      tick: 'gold' as const,
      isActive: true,
      metaTitle: 'Amit Verma – Senior Real Estate Consultant in Mumbai | Think4BuySale',
      metaDescription: 'Amit Verma is a gold-tick verified real estate consultant with 12 years of expertise in Mumbai luxury residential and commercial properties. Expert in Bandra, Juhu, and Powai.',
      introContent: 'With over 12 years of experience in Mumbai\'s dynamic real estate market, Amit Verma has established himself as one of the city\'s most trusted property consultants. Specialising in luxury residential properties and premium commercial spaces across Bandra, Juhu, Powai, and South Mumbai, Amit brings deep market knowledge and a client-first approach to every transaction.',
      seoContent: 'Amit Verma operates as a senior consultant under PropElite Realty, one of Mumbai\'s leading real estate agencies. His expertise spans the full spectrum of Mumbai real estate — from 2 BHK apartments in Andheri to penthouse suites in Worli, from co-working spaces in BKC to retail showrooms on Linking Road.\n\nWith 340+ successful transactions and a 4.8-star rating from verified clients, Amit has earned a reputation for transparent dealings, comprehensive market guidance, and excellent post-sale support. He holds a valid MahaRERA agent registration (MH-RERA-A12345).\n\nAreas of coverage: Bandra West, Bandra East, Khar, Santa Cruz, Juhu, Vile Parle, Andheri West, Powai, Vikhroli, and South Mumbai (Lower Parel, Worli, Prabhadevi).',
    },
    {
      userId: agent2.id,
      agencyId: agencyHomeFirst.id,
      experienceYears: 8,
      licenseNumber: 'KA-RERA-B67890',
      rating: 4.6,
      totalDeals: 215,
      totalListings: 0,
      bio: 'Top-performing agent in Bangalore tech corridors. Expert in Whitefield, Koramangala, HSR Layout.',
      tick: 'blue' as const,
      isActive: true,
      metaTitle: 'Sunita Nair – Real Estate Agent in Bangalore | Think4BuySale',
      metaDescription: 'Sunita Nair is a verified real estate agent with 8 years of expertise in Bangalore tech corridors. Expert in Whitefield, Koramangala, HSR Layout, and Electronic City.',
      introContent: 'Sunita Nair is Bangalore\'s go-to real estate expert for IT professionals and startups looking to buy or rent in the city\'s most sought-after tech corridors. With 8 years of on-ground experience in Whitefield, Koramangala, HSR Layout, and Sarjapur Road, Sunita brings unparalleled local expertise and a strong network of property owners and developers.',
      seoContent: 'As a blue-tick verified agent with HomeFirst Realty, Sunita Nair has facilitated over 215 property transactions across Bangalore\'s eastern and southern corridors. She specialises in 2 and 3 BHK apartments catering to IT professionals relocating to Bangalore, new project bookings from reputed developers, and rental management for NRI property owners.\n\nSunita holds a valid Karnataka RERA agent registration (KA-RERA-B67890) and is fluent in English, Kannada, Hindi, and Malayalam — making her the ideal consultant for clients from diverse backgrounds.\n\nAreas of coverage: Whitefield, Marathahalli, Sarjapur Road, Koramangala, HSR Layout, Bellandur, Hebbal, and Electronic City.',
    },
    {
      userId: agent3.id,
      agencyId: agencyCapital.id,
      experienceYears: 15,
      licenseNumber: 'DL-RERA-C11223',
      rating: 4.9,
      totalDeals: 480,
      totalListings: 0,
      bio: 'NCR specialist covering Delhi, Gurgaon and Noida. 15 years expertise in luxury villas and commercial.',
      tick: 'diamond' as const,
      isActive: true,
      metaTitle: 'Vikram Singh – Diamond-Tier Real Estate Expert in Delhi NCR | Think4BuySale',
      metaDescription: 'Vikram Singh is a diamond-tick verified real estate expert with 15 years of experience in Delhi NCR. Specialises in luxury villas, commercial properties, and high-value transactions in Gurgaon and Noida.',
      introContent: 'Vikram Singh is one of Delhi NCR\'s most accomplished real estate professionals, with 15 years of experience spanning luxury residential, premium commercial, and industrial properties across Delhi, Gurgaon, and Noida. As a diamond-tick verified agent under Capital Properties NCR, Vikram has managed some of the region\'s most high-profile property transactions.',
      seoContent: 'With 480+ successful deals and a near-perfect 4.9-star rating, Vikram Singh\'s track record speaks for itself. He specialises in luxury villa communities in Gurgaon (DLF City, Golf Course Extension), high-rise luxury apartments in South Delhi and Noida Expressway, Grade A commercial leasing in Cyber City Gurgaon and Sector 62 Noida, and pre-leased commercial investment properties.\n\nVikram holds a Delhi RERA agent registration (DL-RERA-C11223) and maintains close relationships with top developers including DLF, Godrej Properties, M3M, and ATS.\n\nAreas of coverage: South Delhi (GK, Vasant Kunj, Saket), Golf Course Road Gurgaon, Cyber City, Noida Expressway (Sector 137–150), Greater Noida West.',
    },
    {
      userId: agent4.id,
      agencyId: agencySaffron.id,
      experienceYears: 10,
      licenseNumber: 'TS-RERA-D44556',
      rating: 4.7,
      totalDeals: 298,
      totalListings: 0,
      bio: 'Hyderabad specialist with 10 years. Expert in Gachibowli, Kondapur, and HITEC City.',
      tick: 'gold' as const,
      isActive: true,
      metaTitle: 'Priya Sharma – Real Estate Agent in Hyderabad | Think4BuySale',
      metaDescription: 'Priya Sharma is a gold-tick verified real estate agent with 10 years of expertise in Hyderabad. Expert in Gachibowli, Kondapur, HITEC City, and Financial District properties.',
      introContent: 'Priya Sharma is Hyderabad\'s trusted real estate specialist, with 10 years of deep expertise in the city\'s booming IT corridors and premium residential markets. Based with Saffron Realty Hyderabad, Priya has helped hundreds of IT professionals, NRI investors, and families find their perfect home or commercial space in the Cyberabad belt.',
      seoContent: 'As a gold-tick verified agent, Priya Sharma has completed 298+ transactions across Hyderabad\'s most dynamic markets. Her expertise covers 2 and 3 BHK apartment purchases and rentals in Kondapur and Gachibowli, luxury villa communities in Kokapet and Nallagandla, commercial office leasing in HITEC City and Financial District, and new project advisory for buyers looking at Telangana RERA registered projects.\n\nPriya holds a valid Telangana RERA agent registration (TS-RERA-D44556) and speaks English, Hindi, Telugu, and Marathi.\n\nAreas of coverage: HITEC City, Gachibowli, Kondapur, Madhapur, Financial District, Kokapet, Miyapur, Kukatpally, and Manikonda.',
    },
  ]);
  console.log('Agent profiles seeded');

  // ─── Agent Location Maps — state + city level ─────────────────────────────────
  // Each agent gets state-level coverage + city-level entries for each city they operate in.
  await agentLocationMapRepo.save([
    // ── Agent 1 — Amit Verma (PropElite, Mumbai) ── Maharashtra ──────────────
    { agentId: profile1.id, countryId: india.id, stateId: mh.id, cityId: mumbaiCity.id    },
    { agentId: profile1.id, countryId: india.id, stateId: mh.id, cityId: puneCity.id      },
    { agentId: profile1.id, countryId: india.id, stateId: mh.id, cityId: nagpurCity.id    },
    // state-level catch-all (covers Thane, Nashik, etc.)
    { agentId: profile1.id, countryId: india.id, stateId: mh.id                           },

    // ── Agent 2 — Sunita Nair (HomeFirst, Bangalore) ── Karnataka ────────────
    { agentId: profile2.id, countryId: india.id, stateId: ka.id, cityId: bangaloreCity.id },
    { agentId: profile2.id, countryId: india.id, stateId: ka.id, cityId: mysoreCity.id    },
    // state-level catch-all
    { agentId: profile2.id, countryId: india.id, stateId: ka.id                           },
    // also covers Chennai (south India expansion)
    { agentId: profile2.id, countryId: india.id, stateId: tn.id, cityId: chennaiCity.id   },

    // ── Agent 3 — Vikram Singh (Capital, Delhi) ── NCR: Delhi+HR+UP ──────────
    { agentId: profile3.id, countryId: india.id, stateId: dl.id, cityId: delhiCity.id     },
    { agentId: profile3.id, countryId: india.id, stateId: hr.id, cityId: gurgaonCity.id   },
    { agentId: profile3.id, countryId: india.id, stateId: up.id, cityId: noidaCity.id     },
    { agentId: profile3.id, countryId: india.id, stateId: up.id, cityId: ghaziabadCity.id },
    { agentId: profile3.id, countryId: india.id, stateId: up.id, cityId: lucknowCity.id   },
    // state-level catch-alls
    { agentId: profile3.id, countryId: india.id, stateId: dl.id                           },
    { agentId: profile3.id, countryId: india.id, stateId: hr.id                           },
    { agentId: profile3.id, countryId: india.id, stateId: up.id                           },
    // also covers Jaipur and Kolkata (pan-north India)
    { agentId: profile3.id, countryId: india.id, stateId: rj.id, cityId: jaipurCity.id    },
    { agentId: profile3.id, countryId: india.id, stateId: wb.id, cityId: kolkataCity.id   },

    // ── Agent 4 — Deepa Menon (Saffron, Hyderabad) ── Telangana + Gujarat ────
    { agentId: profile4.id, countryId: india.id, stateId: ts.id, cityId: hyderabadCity.id },
    { agentId: profile4.id, countryId: india.id, stateId: ts.id                           },
    // also covers Ahmedabad
    { agentId: profile4.id, countryId: india.id, stateId: gj.id, cityId: ahmedabadCity.id },
    { agentId: profile4.id, countryId: india.id, stateId: kl.id, cityId: kochiCity.id     },
  ]);
  console.log('Agent location maps seeded (state + city level)');

  // ─── Property–Agent Mapping ───────────────────────────────────────────────────
  // Strategy:
  //   • If property.ownerId is an agent user → map to that agent's profile (self-listed)
  //   • If property.ownerId is a seller → map by city name to the agent who covers that city
  //   • Any remaining city → round-robin across all 4 agents

  const agentUserToProfile: Record<string, AgentProfile> = {
    [agent1.id]: profile1,
    [agent2.id]: profile2,
    [agent3.id]: profile3,
    [agent4.id]: profile4,
  };

  // City name → responsible agent profile
  const cityNameToProfile: Record<string, AgentProfile> = {
    // Agent 1 — Mumbai / Maharashtra
    'mumbai':    profile1,
    'pune':      profile1,
    'nagpur':    profile1,
    // Agent 2 — Bangalore / Karnataka + Chennai
    'bangalore': profile2,
    'mysore':    profile2,
    'chennai':   profile2,
    // Agent 3 — Delhi NCR + North India
    'delhi':     profile3,
    'gurgaon':   profile3,
    'noida':     profile3,
    'ghaziabad': profile3,
    'lucknow':   profile3,
    'jaipur':    profile3,
    'kolkata':   profile3,
    // Agent 4 — Hyderabad / South + West
    'hyderabad': profile4,
    'ahmedabad': profile4,
    'surat':     profile4,
    'kochi':     profile4,
  };

  const allProperties = await propertyRepo.find({ select: ['id', 'ownerId', 'city'] });
  const propertyMaps: Partial<PropertyAgentMap>[] = [];
  const listingCountPerAgent: Record<string, number> = {};
  let fallbackIdx = 0;
  const allProfiles = [profile1, profile2, profile3, profile4];

  for (const prop of allProperties) {
    const ownerProfile = agentUserToProfile[prop.ownerId ?? ''];
    const cityKey = (prop.city ?? '').toLowerCase().trim();
    const cityProfile = cityNameToProfile[cityKey];
    // priority: self-listed agent > city match > round-robin fallback
    const profile = ownerProfile ?? cityProfile ?? allProfiles[fallbackIdx++ % 4];
    const assignedByAdmin = !ownerProfile; // admin-assigned if not self-listed

    propertyMaps.push({
      propertyId: prop.id,
      agentId: profile.id,
      assignedByAdmin,
      isActive: true,
    });
    listingCountPerAgent[profile.id] = (listingCountPerAgent[profile.id] ?? 0) + 1;
  }

  await propertyAgentMapRepo.save(propertyMaps);

  // ── Update totalListings on agent profiles ────────────────────────────────
  for (const [profileId, count] of Object.entries(listingCountPerAgent)) {
    await agentProfileRepo.update(profileId, { totalListings: count });
  }

  // ── Update totalListings + totalAgents on agencies ────────────────────────
  await agencyRepo.update(agencyPropElite.id, { totalListings: listingCountPerAgent[profile1.id] ?? 0, totalAgents: 1 });
  await agencyRepo.update(agencyHomeFirst.id, { totalListings: listingCountPerAgent[profile2.id] ?? 0, totalAgents: 1 });
  await agencyRepo.update(agencyCapital.id,   { totalListings: listingCountPerAgent[profile3.id] ?? 0, totalAgents: 1 });
  await agencyRepo.update(agencySaffron.id,   { totalListings: listingCountPerAgent[profile4.id] ?? 0, totalAgents: 1 });

  const totalMapped = propertyMaps.length;
  const perAgent = allProfiles.map(p => `${p.licenseNumber}: ${listingCountPerAgent[p.id] ?? 0}`).join(', ');
  console.log(`Property-agent maps seeded: ${totalMapped} mappings [${perAgent}]`);

  // ── Link properties to city/state FK records by matching city name string ──
  // This ensures stateId and cityId are populated so navbar state-filter works.
  // Pass 1: match by city name → set cityId + stateId
  await dataSource.query(`
    UPDATE properties p
    JOIN cities c ON LOWER(c.name) = LOWER(p.city)
    SET p.cityId = c.id, p.stateId = c.state_id
    WHERE p.cityId IS NULL OR p.stateId IS NULL
  `);

  // Pass 2: for properties whose city isn't in cities table, at least set stateId by state name
  await dataSource.query(`
    UPDATE properties p
    JOIN states s ON LOWER(s.name) = LOWER(p.state)
    SET p.stateId = s.id
    WHERE p.stateId IS NULL
  `);
  console.log('Linked properties → cities/states (stateId + cityId populated)');

  // ─── Property Config: clear + reseed ────────────────────────────────────────
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['prop_type_fields', 'prop_type_amenities', 'prop_types', 'prop_categories']) {
    await dataSource.query(`TRUNCATE TABLE \`${t}\``);
  }
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');

  const catRepo  = dataSource.getRepository(PropCategory);
  const typeRepo = dataSource.getRepository(PropType);
  const ptaRepo  = dataSource.getRepository(PropTypeAmenity);
  const fldRepo  = dataSource.getRepository(PropTypeField);

  // ─── prop_categories — mirrors PROPERTY_CATEGORIES from constants.ts ─────────
  const [buyCat, rentCat, pgCat, comCat, indCat, bpCat, invCat] = await catRepo.save([
    {
      name: 'Buy', slug: 'buy', icon: '🏠', description: 'Properties for outright purchase', status: true, sortOrder: 1,
      h1: 'Buy Property in India – Apartments, Villas, Plots & More',
      metaTitle: 'Buy Property in India | Apartments, Villas, Plots for Sale | Think4BuySale',
      metaDescription: 'Buy verified apartments, villas, independent houses, builder floors and plots across India. Explore 10,000+ RERA-registered listings in Mumbai, Delhi, Bangalore, Hyderabad and 100+ cities.',
      metaKeywords: 'buy property india, buy flat india, buy apartment india, buy villa india, buy plot india, property for sale india, real estate india',
      introContent: 'Think4BuySale is India\'s trusted platform for buying residential and commercial properties. Whether you are looking for a 2 BHK apartment in Mumbai, a villa in Bangalore, or a plot in Hyderabad, we have verified listings from individual owners, builders, and RERA-registered agents across 100+ cities.',
      seoContent: 'Buying a home is one of the most significant financial decisions you will ever make. At Think4BuySale, we make the journey simpler by offering a wide range of verified property listings across all major Indian cities and tier-2 towns.\n\nOur platform covers all property types — from compact studio apartments to sprawling farmhouses, from affordable builder floors to luxury penthouses. Every listing undergoes a verification process to ensure accuracy of location, price, and ownership documents.\n\nWe provide comprehensive market insights, locality guides, and price trends to help you make an informed decision. Filter by budget, BHK configuration, possession status, furnishing, and amenities to find the perfect property.\n\nWhether you are a first-time home buyer, an NRI investor, or a seasoned real estate investor, Think4BuySale connects you directly with owners and RERA-registered agents for a transparent, zero-brokerage or low-brokerage buying experience.\n\nExplore new launch projects from reputed builders alongside resale properties. Compare prices across localities, read expert market analysis, and schedule site visits — all from one platform.',
      faqs: [
        { question: 'How do I buy a property on Think4BuySale?', answer: 'Browse listings, filter by your preferences, contact the owner or agent directly, and schedule a site visit. Our platform connects you directly with sellers for a transparent process.' },
        { question: 'Are the property listings verified?', answer: 'Yes, all listings go through a verification process. Look for the "Verified" badge on listings. We also promote RERA-registered properties to ensure legal compliance.' },
        { question: 'What documents do I need to buy a property in India?', answer: 'You will need Aadhaar card, PAN card, income proof (for home loan), bank statements, and property documents including sale deed, encumbrance certificate, and approved building plan.' },
        { question: 'Can I get a home loan through Think4BuySale?', answer: 'Yes, we have tie-ups with leading banks and NBFCs. You can apply for a home loan directly through our platform and get pre-approved before finalising a property.' },
        { question: 'What is the typical buying process timeline?', answer: 'From property finalisation to registration, it typically takes 30–60 days. This includes legal due diligence, loan processing (if applicable), drafting of sale agreement, and property registration.' },
      ],
    },
    {
      name: 'Rent', slug: 'rent', icon: '🔑', description: 'Properties available for rent', status: true, sortOrder: 2,
      h1: 'Rent Property in India – Flats, Apartments & Houses for Rent',
      metaTitle: 'Rent Property in India | Apartments, Flats, Houses for Rent | Think4BuySale',
      metaDescription: 'Find furnished and unfurnished apartments, flats, villas and independent houses for rent in Mumbai, Delhi, Bangalore and 100+ cities. Direct owner listings, best rental deals.',
      metaKeywords: 'rent property india, rent flat india, apartments for rent india, house for rent india, furnished flat rent, unfurnished apartment rent',
      introContent: 'Find your perfect rental home on Think4BuySale — India\'s trusted platform for renting apartments, flats, villas, and independent houses. Browse thousands of verified rental listings from direct owners and RERA-registered agents across Mumbai, Delhi NCR, Bangalore, Hyderabad, Pune, and 100+ cities.',
      seoContent: 'Renting a property has never been easier. Think4BuySale\'s rental marketplace connects tenants directly with property owners and professional agents, ensuring transparency in pricing, no hidden charges, and hassle-free documentation.\n\nOur rental listings cover a wide spectrum — from budget-friendly PG-style studio apartments to premium fully-furnished 4 BHK flats in gated communities. Whether you are a working professional relocating to a new city, a student seeking accommodation near campus, or a family looking for a spacious home, we have options for every need and budget.\n\nFilter rental listings by monthly rent, furnishing status (furnished/semi-furnished/unfurnished), BHK type, pet-friendly, and parking availability. Read verified tenant reviews and locality insights to choose the right neighbourhood.\n\nWe also offer rental agreement assistance, digital documentation services, and move-in support to make your relocation seamless.\n\nAll rental listings are verified to ensure the listed price, area, and amenities match reality. Look for the "Verified" and "Direct Owner" badges for the most transparent rental experiences.',
      faqs: [
        { question: 'How do I find a rental property on Think4BuySale?', answer: 'Use our search bar to enter your preferred city and locality, set your budget range, select BHK configuration, and browse verified listings. Contact owners directly through the platform.' },
        { question: 'What documents are required for renting a property?', answer: 'Typically, you will need Aadhaar card, PAN card, latest salary slips or bank statements (3 months), and a passport-size photograph. Some landlords may also ask for a reference letter from your employer.' },
        { question: 'Is security deposit mandatory for rentals?', answer: 'Yes, most landlords require a security deposit of 1–3 months\' rent (varies by city and agreement). This is refundable at the end of your tenancy after deducting any damages.' },
        { question: 'Can I find furnished apartments for short-term rent?', answer: 'Yes, Think4BuySale lists fully furnished apartments for both short-term (1–3 months) and long-term rentals. Use the "Furnished" filter and specify your duration preference.' },
        { question: 'How is rent negotiated on Think4BuySale?', answer: 'Our platform shows listed prices, but rent is negotiable between tenant and landlord. Contact the owner/agent, express your interest, and discuss terms before signing the agreement.' },
      ],
    },
    {
      name: 'PG / Co-Living', slug: 'pg', icon: '🛏️', description: 'PG accommodations and co-living spaces', status: true, sortOrder: 3,
      h1: 'PG & Co-Living Spaces in India – Affordable Accommodation',
      metaTitle: 'PG Accommodation & Co-Living Spaces in India | Think4BuySale',
      metaDescription: 'Find affordable PG, paying guest accommodations, hostels and co-living spaces near offices, colleges and IT parks across India. Meals included, WiFi, furnished rooms.',
      metaKeywords: 'PG accommodation india, paying guest india, co-living spaces india, PG near IT park, hostel accommodation india, furnished PG india',
      introContent: 'Think4BuySale offers a curated selection of PG (Paying Guest) accommodations and co-living spaces across India\'s major cities. Whether you are a student, a young professional, or relocating for work, find safe, verified, and affordable housing with all the essentials — WiFi, meals, laundry, and 24x7 security.',
      seoContent: 'PG accommodations and co-living spaces have transformed urban housing in India. With thousands of young professionals and students migrating to cities like Bangalore, Delhi, Mumbai, Hyderabad, and Pune, the demand for flexible, affordable, and community-oriented living has never been higher.\n\nAt Think4BuySale, we list verified PG accommodations ranging from basic rooms with meals to premium co-living spaces with gym, workspaces, and recreational areas. Our PG listings include single occupancy, double occupancy, and triple sharing options.\n\nFilter by gender preference (male/female/unisex), proximity to metro stations, IT parks, universities, and hospitals. Check amenities like AC, meals (breakfast/dinner), WiFi speed, laundry, parking for two-wheelers, and CCTV security.\n\nCo-living spaces offer a step above traditional PG — with dedicated work desks, community events, housekeeping, and flexible lease terms starting from just 1 month. Ideal for digital nomads and professionals who want a ready-to-move-in home without long lock-ins.\n\nAll PG and co-living listings on Think4BuySale are verified by our team to ensure the listed amenities, pricing, and safety standards are accurate.',
      faqs: [
        { question: 'What is the difference between a PG and a co-living space?', answer: 'A PG (Paying Guest) is a traditional room-sharing arrangement where you rent a room in someone\'s home or a dedicated PG facility. Co-living spaces are purpose-built, managed properties with premium amenities, flexible leases, community events, and professional management.' },
        { question: 'Are PG accommodations on Think4BuySale verified?', answer: 'Yes, all PG listings are verified for accuracy of price, amenities, and location. We also display tenant ratings and reviews to help you make an informed choice.' },
        { question: 'What is the minimum stay duration for PG/co-living?', answer: 'Most PG facilities require a minimum stay of 1–3 months. Co-living spaces often offer more flexibility, starting from 1 month. Details are mentioned in each listing.' },
        { question: 'Can I find PG accommodation near my college or office?', answer: 'Yes. Use the locality search or "Near Metro/IT Park/College" filters to find PG accommodations within 1–5 km of your workplace or educational institution.' },
      ],
    },
    {
      name: 'Commercial', slug: 'commercial', icon: '🏢', description: 'Offices, shops, warehouses, showrooms', status: true, sortOrder: 4,
      h1: 'Commercial Properties in India – Office Space, Shops & Showrooms',
      metaTitle: 'Commercial Properties for Sale & Rent in India | Office Space, Shops | Think4BuySale',
      metaDescription: 'Find commercial office spaces, retail shops, showrooms and warehouse spaces for sale and rent across India. Grade A offices, high-street retail, co-working spaces in Mumbai, Delhi, Bangalore.',
      metaKeywords: 'commercial property india, office space for rent india, retail shop for sale india, showroom rent india, commercial real estate india, office lease india',
      introContent: 'Discover prime commercial properties across India on Think4BuySale. From Grade A office spaces in BKC Mumbai and Cyber City Gurgaon to high-street retail shops in Connaught Place Delhi and Brigade Road Bangalore — we have verified commercial listings to suit every business need and budget.',
      seoContent: 'India\'s commercial real estate market has seen unprecedented growth driven by the IT/ITES boom, retail expansion, e-commerce warehousing demand, and the rise of co-working culture. Think4BuySale brings together the most comprehensive listings of commercial properties across residential and commercial hubs.\n\nWhether you are a startup looking for a 500 sqft plug-and-play office in Noida, an enterprise seeking a 50,000 sqft Grade A headquarters in BKC Mumbai, or a retailer eyeing a high-footfall showroom on MG Road Bangalore — our platform connects you with landlords, developers, and brokers for the best commercial deals.\n\nOur commercial listings span: office spaces (bare shell, semi-furnished, fully furnished), retail shops and showrooms (ground floor and upper floor), co-working memberships and managed offices, commercial plots, and IT/SEZ spaces with tax benefits.\n\nFilter by carpet area (sqft), floor, furnishing, possession, lease tenure, power load, parking bays, and proximity to metro stations and business districts. All listings include detailed floor plans, photos, and virtual tours where available.\n\nFor commercial investment, explore high-yield pre-leased commercial properties in established business parks offering 7–9% annual returns.',
      faqs: [
        { question: 'What are the top commercial property markets in India?', answer: 'Mumbai (BKC, Andheri, Powai), Delhi NCR (Gurgaon, Noida, Connaught Place), Bangalore (Whitefield, Koramangala, Outer Ring Road), Hyderabad (HITEC City, Gachibowli), and Pune (Hinjewadi, Baner) are the top commercial real estate markets.' },
        { question: 'What is the difference between carpet area and built-up area for commercial spaces?', answer: 'Carpet area is the actual usable floor area excluding walls and common areas. Built-up area includes walls. Super built-up area includes common areas like lobbies, stairways, and corridors. Rentals are typically quoted on carpet area for commercial leases.' },
        { question: 'What documents are required for a commercial lease?', answer: 'You will need company registration documents, GST registration, director/owner KYC, audited financials or ITR (3 years), and bank statements. The lease agreement should be registered for tenures exceeding 12 months.' },
        { question: 'Is GST applicable on commercial rentals?', answer: 'Yes. GST at 18% is applicable on commercial rentals when the landlord is GST-registered. This is in addition to the monthly rent and must be explicitly mentioned in the lease agreement.' },
        { question: 'What is pre-leased commercial property?', answer: 'A pre-leased commercial property is one that is already rented to a tenant (often a reputed company) at the time of sale. Investors buy these properties for stable rental income, typically yielding 6–9% annually.' },
      ],
    },
    {
      name: 'Industrial', slug: 'industrial', icon: '🏭', description: 'Factories, sheds, industrial plots', status: true, sortOrder: 5,
      h1: 'Industrial Properties in India – Warehouses, Factories & Sheds',
      metaTitle: 'Industrial Properties for Rent & Sale in India | Warehouses, Factories | Think4BuySale',
      metaDescription: 'Find industrial warehouses, factory sheds, cold storage and industrial plots for rent and sale across major industrial corridors in India. HSIIDC, UPSIDC, MIDC approved properties.',
      metaKeywords: 'industrial property india, warehouse for rent india, factory shed india, industrial land india, HSIIDC property, UPSIDC industrial, MIDC industrial property',
      introContent: 'India\'s industrial real estate sector is booming, driven by the Make in India initiative, PLI schemes, and the explosive growth of e-commerce logistics. Think4BuySale lists verified industrial properties — warehouses, factory sheds, cold storage, and industrial plots — across all major industrial corridors and GIDC/HSIIDC/UPSIDC/MIDC approved zones.',
      seoContent: 'The industrial real estate segment in India spans manufacturing hubs, multi-modal logistics parks, cold chain facilities, and SEZ-based export-oriented units. As India positions itself as a global manufacturing powerhouse, demand for quality industrial space has surged across states like Maharashtra, Gujarat, Haryana, Uttar Pradesh, Tamil Nadu, and Telangana.\n\nThink4BuySale\'s industrial listings cover the complete spectrum: small 2,000 sqft sheds for SME manufacturing, mid-size 20,000 sqft warehouses for distribution, and large 2-lakh sqft logistics parks for e-commerce fulfillment. All listed properties specify key industrial parameters: clear ceiling height, floor load capacity, power load (KVA), loading dock configuration, ramp availability, and government approvals.\n\nKey industrial corridors listed on our platform include: NH-58 (Ghaziabad-Meerut), Bhiwandi (Asia\'s largest logistics hub), Patancheru (Hyderabad), Sri City and Sriperumbudur (Tamil Nadu), Chakan and Bhosari (Pune), Sanand (Gujarat), and Manesar-Bawal (Haryana).\n\nAll industrial listings are verified for legal title, approved land use (industrial), building plan sanction, and utilities (three-phase power, water, drainage). Listings include proximity to highways, railheads, and ports.\n\nFor industrial investors, we offer pre-leased industrial properties with reputed anchor tenants, providing 8–10% annual yield — higher than commercial Grade A offices.',
      faqs: [
        { question: 'What is the difference between a warehouse and a factory shed?', answer: 'A warehouse is primarily used for storage and distribution — typically with high clear height, loading docks, and minimal office space. A factory shed is designed for manufacturing operations — with heavy power load, overhead cranes, effluent treatment, and worker facilities.' },
        { question: 'What approvals should I check before leasing an industrial property?', answer: 'Verify: Change of land use (CLU) for industrial purposes, building plan sanction, fire NOC, environmental clearance (for manufacturing), and registration with the state industrial development authority (HSIIDC/UPSIDC/MIDC, etc.).' },
        { question: 'What is the typical lease tenure for industrial properties?', answer: 'Industrial properties are typically leased for 3–9 years with a lock-in period of 1–3 years. Rent escalation clauses of 5–15% every 3 years are standard.' },
        { question: 'What power load is standard for warehouses vs factories?', answer: 'Warehouses typically require 50–200 KVA three-phase power. Factories require 200–1,000+ KVA depending on the machinery load. Always verify sanctioned load vs. required load before finalising.' },
      ],
    },
    {
      name: 'New Projects', slug: 'builder_project', icon: '🏗️', description: 'Under-construction builder projects', status: true, sortOrder: 6,
      h1: 'New Launch & Under-Construction Projects in India',
      metaTitle: 'New Projects in India | New Launch Properties & Under-Construction Flats | Think4BuySale',
      metaDescription: 'Explore new launch and under-construction residential projects across India. Book early for best prices, flexible payment plans, and RERA-registered builder projects in Mumbai, Pune, Bangalore & more.',
      metaKeywords: 'new projects india, new launch property india, under construction flats india, RERA registered projects, builder projects india, new apartments india',
      introContent: 'Explore the latest new launch and under-construction residential projects from India\'s top builders on Think4BuySale. From affordable housing under PMAY to luxury gated communities, find RERA-registered projects with flexible payment plans, construction-linked payment options, and early-bird discounts.',
      seoContent: 'Investing in a new project (under-construction property) offers several advantages over resale properties — lower entry price, flexible payment schedules, newer construction quality, modern amenities, and the opportunity to customise your home.\n\nThink4BuySale lists thousands of new launch projects from reputed developers like Lodha Group, Godrej Properties, Prestige Group, Sobha Limited, Mahindra Lifespaces, and hundreds of regional builders. Projects are categorised by location, configuration (1/2/3/4 BHK), price range, and possession timeline.\n\nAll projects listed on our platform are RERA-registered, ensuring legal compliance, transparency in project timeline, and protection of buyer interests. You can track project progress, check builder credentials, and read buyer reviews before making a booking decision.\n\nPayment plans available: Construction-Linked Plan (CLP), Flexi Pay, 10:90 plans, and possession-linked options. Early buyers often get pre-launch prices 10–20% lower than the final booking price.\n\nWe also list approved builder floors, plotted development schemes, and township projects. Use our EMI calculator, project comparison tool, and locality price trend charts to make a well-informed investment decision.',
      faqs: [
        { question: 'What is RERA and why is it important for new projects?', answer: 'RERA (Real Estate Regulatory Authority) is a statutory body under the Real Estate Act 2016 that regulates builder projects. A RERA-registered project ensures the developer has valid approvals, a defined delivery timeline, and is accountable for any delays. Always insist on a RERA registration number.' },
        { question: 'What is a construction-linked payment plan?', answer: 'In a CLP, you pay installments linked to construction milestones (e.g., 10% at booking, 15% at foundation, 20% at each slab). This aligns your payments with actual construction progress, reducing financial risk.' },
        { question: 'What are the risks of buying under-construction property?', answer: 'Key risks include: project delays, builder insolvency, changes in floor plan or specifications, and lack of possession. Mitigate these by choosing RERA-registered projects, checking builder track record, reading the sale agreement carefully, and opting for a bank-approved project.' },
        { question: 'Can I get a home loan for under-construction property?', answer: 'Yes, banks offer home loans for under-construction properties. The disbursement is staged as per construction milestones. During construction, you pay only the interest (pre-EMI) on the disbursed amount.' },
        { question: 'What is the pre-launch offer in new projects?', answer: 'Pre-launch prices are offered before the official project launch, often 10–20% lower than the final price. However, these projects may not have all approvals in place. Ensure RERA registration is done before booking even at pre-launch.' },
      ],
    },
    {
      name: 'Investment', slug: 'investment', icon: '📈', description: 'High-yield investment properties', status: false, sortOrder: 7,
      h1: 'Real Estate Investment Opportunities in India',
      metaTitle: 'Real Estate Investment Properties in India | High-Yield Commercial & Residential',
      metaDescription: 'Discover high-yield real estate investment opportunities in India — pre-leased commercial, REITs, NRI investments, and fractional ownership options.',
      metaKeywords: 'real estate investment india, property investment india, pre-leased commercial property, high yield property, NRI property investment india',
      introContent: 'Think4BuySale curates high-yield real estate investment opportunities across residential and commercial segments in India. From pre-leased commercial properties with 7–9% annual returns to fractional ownership in Grade A office assets and NRI-friendly residential investment destinations.',
      seoContent: 'Real estate has consistently been one of India\'s most preferred investment asset classes, offering a combination of capital appreciation and rental income. Whether you are an individual investor, an NRI, or an institutional investor, Think4BuySale provides curated investment-grade properties with transparent yield data and exit options.\n\nInvestment categories available: Pre-leased commercial properties (offices, retail, industrial), residential apartments in high-appreciation corridors, plotted development in approved layouts, fractional ownership in Grade A commercial assets, and REIT-equivalent real estate funds.\n\nTop investment markets in India: Mumbai (Bandra, BKC, Thane), Bangalore (Outer Ring Road, Whitefield), Hyderabad (HITEC City, Kokapet), Pune (Hinjewadi, Wakad), and Delhi NCR (Gurgaon, Noida Expressway) consistently show 8–15% annual appreciation in select micro-markets.\n\nFor NRI investors, we offer dedicated advisory on FEMA compliance, PIO/OCI investment rules, repatriation of rental income, and tax implications under DTAA (Double Taxation Avoidance Agreement).',
      faqs: [
        { question: 'What is the expected ROI from real estate investment in India?', answer: 'Residential properties yield 2–4% annual rental income with 5–15% capital appreciation. Commercial properties yield 6–9% annual rental income with 5–8% capital appreciation. Pre-leased commercial offers the most stable returns.' },
        { question: 'Can NRIs invest in Indian real estate?', answer: 'Yes, NRIs (Non-Resident Indians) and OCIs can invest in residential and commercial real estate in India under FEMA. They cannot purchase agricultural land. Rental income is taxable in India and may be taxable in the country of residence under DTAA provisions.' },
        { question: 'What is fractional ownership in real estate?', answer: 'Fractional ownership allows multiple investors to co-own a high-value commercial property (typically Rs. 50 crore+) in proportion to their investment. Platforms manage the property and distribute rental income proportionally. Minimum investment is typically Rs. 25–50 lakhs.' },
      ],
    },
  ]);
  console.log('Seeded prop_categories (aligned with listing categories)');

  // ─── prop_types — slugs mirror PropertyType enum values ──────────────────────
  // buy: residential types
  const [apt, villa, house, builderFloor, penthouse, studio, farmHouse, plot] = await typeRepo.save([
    { name: 'Apartment',         slug: 'apartment',         icon: '🏙️', categoryId: buyCat.id, status: true, sortOrder: 1 },
    { name: 'Villa',             slug: 'villa',             icon: '🏡', categoryId: buyCat.id, status: true, sortOrder: 2 },
    { name: 'Independent House', slug: 'house',             icon: '🏠', categoryId: buyCat.id, status: true, sortOrder: 3 },
    { name: 'Builder Floor',     slug: 'builder_floor',     icon: '🏗️', categoryId: buyCat.id, status: true, sortOrder: 4 },
    { name: 'Penthouse',         slug: 'penthouse',         icon: '🌆', categoryId: buyCat.id, status: true, sortOrder: 5 },
    { name: 'Studio Apartment',  slug: 'studio',            icon: '🛋️', categoryId: buyCat.id, status: true, sortOrder: 6 },
    { name: 'Farm House',        slug: 'farm_house',        icon: '🌾', categoryId: buyCat.id, status: true, sortOrder: 7 },
    { name: 'Residential Plot',  slug: 'plot',              icon: '📐', categoryId: buyCat.id, status: true, sortOrder: 8 },
  ]);
  // rent: same types
  const [rApt, rVilla, rHouse, rBuilderFloor, rPenthouse, rStudio] = await typeRepo.save([
    { name: 'Apartment',         slug: 'apartment',         icon: '🏙️', categoryId: rentCat.id, status: true, sortOrder: 1 },
    { name: 'Villa',             slug: 'villa',             icon: '🏡', categoryId: rentCat.id, status: true, sortOrder: 2 },
    { name: 'Independent House', slug: 'house',             icon: '🏠', categoryId: rentCat.id, status: true, sortOrder: 3 },
    { name: 'Builder Floor',     slug: 'builder_floor',     icon: '🏗️', categoryId: rentCat.id, status: true, sortOrder: 4 },
    { name: 'Penthouse',         slug: 'penthouse',         icon: '🌆', categoryId: rentCat.id, status: true, sortOrder: 5 },
    { name: 'Studio Apartment',  slug: 'studio',            icon: '🛋️', categoryId: rentCat.id, status: true, sortOrder: 6 },
  ]);
  // pg
  const [pgType, coLiving] = await typeRepo.save([
    { name: 'PG / Hostel',       slug: 'pg',                icon: '🛏️', categoryId: pgCat.id,  status: true, sortOrder: 1 },
    { name: 'Co-Living Space',   slug: 'co_living',         icon: '🏘️', categoryId: pgCat.id,  status: true, sortOrder: 2 },
  ]);
  // commercial
  const [office, shop, showroom, comWarehouse, comFactory] = await typeRepo.save([
    { name: 'Office Space',      slug: 'commercial_office',    icon: '💼', categoryId: comCat.id, status: true, sortOrder: 1 },
    { name: 'Shop / Showroom',   slug: 'commercial_shop',      icon: '🏪', categoryId: comCat.id, status: true, sortOrder: 2 },
    { name: 'Showroom',          slug: 'showroom',             icon: '🏪', categoryId: comCat.id, status: true, sortOrder: 3 },
    { name: 'Warehouse',         slug: 'commercial_warehouse', icon: '🏭', categoryId: comCat.id, status: true, sortOrder: 4 },
    { name: 'Factory',           slug: 'factory',              icon: '⚙️', categoryId: comCat.id, status: true, sortOrder: 5 },
  ]);
  // industrial
  const [warehouse, factory, indShed] = await typeRepo.save([
    { name: 'Warehouse',         slug: 'commercial_warehouse', icon: '🏭', categoryId: indCat.id, status: true, sortOrder: 1 },
    { name: 'Factory',           slug: 'factory',              icon: '⚙️', categoryId: indCat.id, status: true, sortOrder: 2 },
    { name: 'Industrial Shed',   slug: 'industrial_shed',      icon: '🏚️', categoryId: indCat.id, status: true, sortOrder: 3 },
  ]);
  // builder_project (same residential types for new construction)
  const [bpApt, bpVilla] = await typeRepo.save([
    { name: 'Apartment',         slug: 'apartment',         icon: '🏙️', categoryId: bpCat.id, status: true, sortOrder: 1 },
    { name: 'Villa / Plots',     slug: 'villa',             icon: '🏡', categoryId: bpCat.id, status: true, sortOrder: 2 },
  ]);
  // investment
  const [invPlot, invLand] = await typeRepo.save([
    { name: 'Residential Plot',  slug: 'plot',              icon: '📐', categoryId: invCat.id, status: true, sortOrder: 1 },
    { name: 'Agricultural Land', slug: 'land',              icon: '🌱', categoryId: invCat.id, status: true, sortOrder: 2 },
  ]);
  console.log('Seeded prop_types (slugs match PropertyType enum)');

  // ─── prop_type_amenities — map amenities to each property type ────────────────
  const allAmenities = await dataSource.getRepository(Amenity).find();
  const byName = (n: string) => allAmenities.find(a => a.name.toLowerCase().includes(n.toLowerCase()));

  const lift     = byName('Lift');
  const parking  = byName('Parking');
  const gym      = byName('Gym');
  const pool     = byName('Swimming');
  const security = byName('Security');
  const power    = byName('Power');
  const club     = byName('Clubhouse');
  const garden   = byName('Garden');
  const wifi     = byName('WiFi');
  const intercom = byName('Intercom');
  const play     = byName('Play');
  const terrace  = byName('Terrace') || byName('Rooftop');
  const gas      = byName('Gas');
  const jogging  = byName('Jogging');
  const indoor   = byName('Indoor');
  const water    = byName('Water Supply');
  const spa      = byName('Spa');
  const shop2    = byName('Shopping');

  const mapAmenities = async (typeId: string, list: (typeof lift)[]) => {
    const rows = list.filter(Boolean).map(a => ptaRepo.create({ propTypeId: typeId, amenityId: a!.id }));
    if (rows.length) await ptaRepo.save(rows);
  };

  // Residential — Buy
  await mapAmenities(apt.id,         [lift, parking, gym, pool, security, power, club, garden, intercom, play, jogging, indoor, gas, water, terrace]);
  await mapAmenities(villa.id,       [garden, parking, pool, security, power, club, terrace, gas, water, gym, spa]);
  await mapAmenities(house.id,       [parking, security, power, garden, water]);
  await mapAmenities(builderFloor.id,[parking, security, power, intercom, lift]);
  await mapAmenities(penthouse.id,   [lift, parking, gym, pool, security, power, terrace, club, gas, water]);
  await mapAmenities(studio.id,      [lift, parking, security, power, wifi, water]);
  await mapAmenities(farmHouse.id,   [garden, parking, pool, security, power, water]);
  await mapAmenities(plot.id,        [security]);
  // Residential — Rent (same amenity sets)
  await mapAmenities(rApt.id,        [lift, parking, gym, pool, security, power, club, garden, intercom, play, jogging, indoor, gas, water, terrace]);
  await mapAmenities(rVilla.id,      [garden, parking, pool, security, power, club, terrace, gas, water, gym]);
  await mapAmenities(rHouse.id,      [parking, security, power, garden, water]);
  await mapAmenities(rBuilderFloor.id,[parking, security, power, intercom, lift]);
  await mapAmenities(rPenthouse.id,  [lift, parking, gym, pool, security, power, terrace, club]);
  await mapAmenities(rStudio.id,     [lift, parking, security, power, wifi, water]);
  // PG
  await mapAmenities(pgType.id,      [wifi, security, power, water, intercom]);
  await mapAmenities(coLiving.id,    [wifi, security, power, water, gym, intercom, terrace]);
  // Commercial
  await mapAmenities(office.id,       [lift, parking, security, power, wifi, water]);
  await mapAmenities(shop.id,         [parking, security, power]);
  await mapAmenities(showroom.id,     [parking, security, power, lift]);
  await mapAmenities(comWarehouse.id, [parking, security, power]);
  await mapAmenities(comFactory.id,   [parking, security, power, water]);
  // Industrial
  await mapAmenities(warehouse.id,   [parking, security, power]);
  await mapAmenities(factory.id,     [parking, security, power, water]);
  await mapAmenities(indShed.id,     [parking, security, power]);
  // Builder Projects
  await mapAmenities(bpApt.id,       [lift, parking, gym, pool, security, power, club, garden, intercom, play, jogging, terrace]);
  await mapAmenities(bpVilla.id,     [garden, parking, pool, security, power, club, terrace]);
  // Investment
  await mapAmenities(invPlot.id,     [security]);
  await mapAmenities(invLand.id,     []);
  console.log('Seeded prop_type_amenities');

  // ─── prop_type_fields — dynamic form fields per type ─────────────────────────
  const F = FieldType;

  // Helper: field factory
  const field = (propTypeId: string, fieldName: string, fieldLabel: string, fieldType: FieldType,
    opts: string[] | null, placeholder: string | null, isRequired: boolean, sortOrder: number,
  ) => ({ propTypeId, fieldName, fieldLabel, fieldType, optionsJson: opts, placeholder, isRequired, sortOrder });

  const FURNISHING_OPTS = ['Unfurnished', 'Semi Furnished', 'Fully Furnished'];
  const FACING_OPTS     = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'];
  const YES_NO          = ['Yes', 'No'];

  // Helper to duplicate same fields for multiple typeIds (rent mirrors buy)
  const fieldsFor = (typeId: string, defs: ReturnType<typeof field>[]) =>
    defs.map(d => ({ ...d, propTypeId: typeId }));

  const aptFields = (id: string) => [
    field(id, 'bedrooms',     'Bedrooms',               F.NUMBER,   null,          'e.g. 2',    true,  1),
    field(id, 'bathrooms',    'Bathrooms',               F.NUMBER,   null,          'e.g. 2',    false, 2),
    field(id, 'balconies',    'Balconies',               F.NUMBER,   null,          'e.g. 1',    false, 3),
    field(id, 'carpet_area',  'Carpet Area (sqft)',      F.NUMBER,   null,          'e.g. 950',  true,  4),
    field(id, 'total_floors', 'Total Floors',            F.NUMBER,   null,          'e.g. 15',   false, 5),
    field(id, 'floor_number', 'Floor Number',            F.NUMBER,   null,          'e.g. 5',    false, 6),
    field(id, 'furnishing',   'Furnishing Status',       F.DROPDOWN, FURNISHING_OPTS, null,      true,  7),
    field(id, 'facing',       'Facing Direction',        F.DROPDOWN, FACING_OPTS,   null,        false, 8),
  ];
  const villaFields = (id: string) => [
    field(id, 'bedrooms',     'Bedrooms',               F.NUMBER,   null,          'e.g. 4',    true,  1),
    field(id, 'bathrooms',    'Bathrooms',               F.NUMBER,   null,          'e.g. 3',    false, 2),
    field(id, 'carpet_area',  'Built-up Area (sqft)',   F.NUMBER,   null,          'e.g. 2400', true,  3),
    field(id, 'plot_area',    'Plot Area (sqft)',        F.NUMBER,   null,          'e.g. 3000', false, 4),
    field(id, 'total_floors', 'Floors',                 F.NUMBER,   null,          'e.g. 2',    false, 5),
    field(id, 'furnishing',   'Furnishing Status',       F.DROPDOWN, FURNISHING_OPTS, null,      false, 6),
    field(id, 'has_garden',   'Garden / Lawn',           F.RADIO,    YES_NO,        null,        false, 7),
  ];
  const houseFields = (id: string) => [
    field(id, 'bedrooms',     'Bedrooms',               F.NUMBER,   null,          'e.g. 3',    true,  1),
    field(id, 'bathrooms',    'Bathrooms',               F.NUMBER,   null,          'e.g. 2',    false, 2),
    field(id, 'total_floors', 'Number of Floors',        F.NUMBER,   null,          'e.g. 2',    false, 3),
    field(id, 'plot_area',    'Plot Area (sqft)',        F.NUMBER,   null,          'e.g. 2000', true,  4),
    field(id, 'built_up_area','Built-up Area (sqft)',   F.NUMBER,   null,          'e.g. 1800', false, 5),
    field(id, 'furnishing',   'Furnishing',              F.DROPDOWN, FURNISHING_OPTS, null,      false, 6),
  ];
  const bfFields = (id: string) => [
    field(id, 'bedrooms',     'Bedrooms',               F.NUMBER,   null,          'e.g. 3',    true,  1),
    field(id, 'bathrooms',    'Bathrooms',               F.NUMBER,   null,          'e.g. 2',    false, 2),
    field(id, 'carpet_area',  'Carpet Area (sqft)',      F.NUMBER,   null,          'e.g. 1200', true,  3),
    field(id, 'floor_number', 'Floor Number',            F.NUMBER,   null,          'e.g. 2',    false, 4),
    field(id, 'furnishing',   'Furnishing',              F.DROPDOWN, FURNISHING_OPTS, null,      false, 5),
  ];
  const phFields = (id: string) => [
    field(id, 'bedrooms',     'Bedrooms',               F.NUMBER,   null,          'e.g. 3',    true,  1),
    field(id, 'bathrooms',    'Bathrooms',               F.NUMBER,   null,          'e.g. 3',    false, 2),
    field(id, 'carpet_area',  'Carpet Area (sqft)',      F.NUMBER,   null,          'e.g. 3500', true,  3),
    field(id, 'floor_number', 'Floor',                   F.NUMBER,   null,          'e.g. 22',   false, 4),
    field(id, 'has_terrace',  'Private Terrace',         F.RADIO,    YES_NO,        null,        false, 5),
    field(id, 'furnishing',   'Furnishing',              F.DROPDOWN, FURNISHING_OPTS, null,      false, 6),
  ];
  const studioFields = (id: string) => [
    field(id, 'carpet_area',  'Carpet Area (sqft)',      F.NUMBER,   null,          'e.g. 400',  true,  1),
    field(id, 'floor_number', 'Floor Number',            F.NUMBER,   null,          'e.g. 3',    false, 2),
    field(id, 'furnishing',   'Furnishing',              F.DROPDOWN, FURNISHING_OPTS, null,      true,  3),
  ];

  const allFields: any[] = [
    // Buy
    ...aptFields(apt.id),
    ...villaFields(villa.id),
    ...houseFields(house.id),
    ...bfFields(builderFloor.id),
    ...phFields(penthouse.id),
    ...studioFields(studio.id),
    // Farm House (buy)
    field(farmHouse.id, 'bedrooms',    'Bedrooms',            F.NUMBER, null, 'e.g. 4',    true,  1),
    field(farmHouse.id, 'land_area',   'Land Area (Acres)',   F.NUMBER, null, 'e.g. 2',    true,  2),
    field(farmHouse.id, 'has_pool',    'Swimming Pool',       F.RADIO,  YES_NO, null,      false, 3),
    // Plot (buy)
    field(plot.id, 'plot_area',     'Plot Area (sqft)',       F.NUMBER,   null, 'e.g. 2000', true,  1),
    field(plot.id, 'facing',        'Plot Facing',            F.DROPDOWN, FACING_OPTS, null, false, 2),
    field(plot.id, 'boundary_wall', 'Boundary Wall',          F.RADIO,    YES_NO, null,      false, 3),
    field(plot.id, 'is_corner',     'Corner Plot',            F.RADIO,    YES_NO, null,      false, 4),
    // Rent
    ...aptFields(rApt.id),
    ...villaFields(rVilla.id),
    ...houseFields(rHouse.id),
    ...bfFields(rBuilderFloor.id),
    ...phFields(rPenthouse.id),
    ...studioFields(rStudio.id),
    // PG
    field(pgType.id, 'room_type',   'Room Type',              F.DROPDOWN, ['Single Sharing', 'Double Sharing', 'Triple Sharing', 'Private Room'], null, true, 1),
    field(pgType.id, 'meals',       'Meals Included',         F.RADIO,    YES_NO, null, false, 2),
    field(pgType.id, 'gender',      'For',                    F.RADIO,    ['Boys', 'Girls', 'Any'], null, true, 3),
    field(coLiving.id, 'room_type', 'Room Type',              F.DROPDOWN, ['Private Room', 'Studio', 'Shared Room'], null, true, 1),
    field(coLiving.id, 'seats',     'Available Beds',         F.NUMBER,   null, 'e.g. 10', true, 2),
    field(coLiving.id, 'meals',     'Meals Included',         F.RADIO,    YES_NO, null, false, 3),
    // Commercial
    field(office.id, 'carpet_area', 'Carpet Area (sqft)',     F.NUMBER,   null, 'e.g. 1500', true,  1),
    field(office.id, 'cabins',      'Cabins',                 F.NUMBER,   null, 'e.g. 5',    false, 2),
    field(office.id, 'meeting_rooms','Meeting Rooms',         F.NUMBER,   null, 'e.g. 2',    false, 3),
    field(office.id, 'washrooms',   'Washrooms',              F.NUMBER,   null, 'e.g. 2',    false, 4),
    field(office.id, 'floor_number','Floor Number',           F.NUMBER,   null, 'e.g. 3',    false, 5),
    field(office.id, 'furnishing',  'Furnishing',             F.DROPDOWN, ['Bare Shell', 'Semi Furnished', 'Fully Furnished'], null, false, 6),
    field(shop.id, 'carpet_area',   'Carpet Area (sqft)',     F.NUMBER,   null, 'e.g. 300',  true,  1),
    field(shop.id, 'floor_number',  'Floor',                  F.DROPDOWN, ['Ground Floor', '1st Floor', '2nd Floor', '3rd Floor+'], null, false, 2),
    field(shop.id, 'frontage',      'Frontage (ft)',          F.NUMBER,   null, 'e.g. 15',   false, 3),
    field(showroom.id, 'carpet_area','Carpet Area (sqft)',    F.NUMBER,   null, 'e.g. 1000', true,  1),
    field(showroom.id, 'frontage',  'Frontage (ft)',          F.NUMBER,   null, 'e.g. 30',   false, 2),
    field(showroom.id, 'ceiling_height','Ceiling Height (ft)',F.NUMBER,   null, 'e.g. 14',   false, 3),
    // Commercial Warehouse & Factory (under Commercial category)
    field(comWarehouse.id, 'carpet_area',    'Carpet Area (sqft)',  F.NUMBER, null, 'e.g. 5000', true,  1),
    field(comWarehouse.id, 'ceiling_height', 'Ceiling Height (ft)', F.NUMBER, null, 'e.g. 20',   false, 2),
    field(comWarehouse.id, 'loading_docks',  'Loading Docks',       F.NUMBER, null, 'e.g. 2',    false, 3),
    field(comWarehouse.id, 'has_ramp',       'Vehicle Ramp',        F.RADIO,  YES_NO, null,      false, 4),
    field(comFactory.id, 'plot_area',        'Plot Area (sqft)',    F.NUMBER, null, 'e.g. 10000',true,  1),
    field(comFactory.id, 'built_up_area',    'Built-up Area (sqft)',F.NUMBER, null, 'e.g. 7000', false, 2),
    field(comFactory.id, 'power_load',       'Power Load (KVA)',    F.NUMBER, null, 'e.g. 100',  false, 3),
    field(comFactory.id, 'ceiling_height',   'Ceiling Height (ft)', F.NUMBER, null, 'e.g. 25',   false, 4),
    field(comFactory.id, 'water_supply',     'Water Supply',        F.RADIO,  YES_NO, null,      false, 5),
    // Industrial
    field(warehouse.id, 'carpet_area',   'Carpet Area (sqft)',F.NUMBER,   null, 'e.g. 5000', true,  1),
    field(warehouse.id, 'ceiling_height','Ceiling Height (ft)',F.NUMBER,  null, 'e.g. 20',   false, 2),
    field(warehouse.id, 'loading_docks', 'Loading Docks',     F.NUMBER,   null, 'e.g. 2',    false, 3),
    field(warehouse.id, 'has_ramp',      'Vehicle Ramp',      F.RADIO,    YES_NO, null,       false, 4),
    field(factory.id, 'plot_area',       'Plot Area (sqft)',  F.NUMBER,   null, 'e.g. 10000',true,  1),
    field(factory.id, 'built_up_area',   'Built-up Area (sqft)',F.NUMBER, null, 'e.g. 7000', false, 2),
    field(factory.id, 'power_load',      'Power Load (KVA)',  F.NUMBER,   null, 'e.g. 100',  false, 3),
    field(factory.id, 'ceiling_height',  'Ceiling Height (ft)',F.NUMBER,  null, 'e.g. 25',   false, 4),
    field(factory.id, 'water_supply',    'Water Supply',      F.RADIO,    YES_NO, null,       false, 5),
    field(indShed.id, 'carpet_area',     'Shed Area (sqft)',  F.NUMBER,   null, 'e.g. 3000', true,  1),
    field(indShed.id, 'ceiling_height',  'Height (ft)',       F.NUMBER,   null, 'e.g. 20',   false, 2),
    // Builder Projects
    ...aptFields(bpApt.id).map(f => ({ ...f, propTypeId: bpApt.id })),
    ...villaFields(bpVilla.id).map(f => ({ ...f, propTypeId: bpVilla.id })),
    // Investment
    field(invPlot.id, 'plot_area',   'Plot Area (sqft)',      F.NUMBER,   null, 'e.g. 2000', true,  1),
    field(invPlot.id, 'facing',      'Facing',                F.DROPDOWN, FACING_OPTS, null,  false, 2),
    field(invPlot.id, 'boundary_wall','Boundary Wall',        F.RADIO,    YES_NO, null,       false, 3),
    field(invLand.id, 'land_area',   'Land Area (Acres)',     F.NUMBER,   null, 'e.g. 5',    true,  1),
    field(invLand.id, 'water_source','Water Source',          F.DROPDOWN, ['Borewell', 'Canal', 'River', 'Rain-fed', 'None'], null, false, 2),
    field(invLand.id, 'soil_type',   'Soil Type',             F.DROPDOWN, ['Black', 'Red', 'Sandy', 'Clay', 'Loamy'], null, false, 3),
  ];

  await fldRepo.save(allFields as any);
  console.log('Seeded prop_type_fields');

  // ─── Assign amenities to ALL existing properties based on their PropertyType ──
  // Build a lookup: PropertyType enum slug → amenity IDs from prop_type_amenities
  const typeAmenityMap: Record<string, string[]> = {};

  // Load all prop_types (slug → id) and all prop_type_amenities
  const allPropTypes = await typeRepo.find();
  const ptSlugById: Record<string, string> = {};
  for (const pt of allPropTypes) {
    ptSlugById[pt.id] = pt.slug;
  }
  const allPTA = await ptaRepo.find();
  for (const pta of allPTA) {
    const slug = ptSlugById[pta.propTypeId];
    if (!slug) continue;
    if (!typeAmenityMap[slug]) typeAmenityMap[slug] = [];
    if (!typeAmenityMap[slug].includes(pta.amenityId)) {
      typeAmenityMap[slug].push(pta.amenityId);
    }
  }

  // For each property type, bulk-insert property_amenities
  const allProps = await propertyRepo.find({ select: ['id', 'type'] });
  let amenityInserts = 0;
  // Clear existing property_amenities first
  await dataSource.query('DELETE FROM property_amenities');

  for (const prop of allProps) {
    const amenityIds = typeAmenityMap[prop.type] || [];
    for (const amenityId of amenityIds) {
      await dataSource.query(
        'INSERT IGNORE INTO property_amenities (`propertiesId`, `amenitiesId`) VALUES (?, ?)',
        [prop.id, amenityId],
      );
      amenityInserts++;
    }
  }
  console.log(`Mapped ${amenityInserts} amenity links to ${allProps.length} properties`);

  // ─── Link agents/sellers → city/state FK records ─────────────────────────────
  await dataSource.query(`
    UPDATE users u
    JOIN cities c ON LOWER(c.name) = LOWER(u.city)
    JOIN states s ON s.id = c.state_id
    SET u.cityId = c.id, u.stateId = s.id
    WHERE u.role IN ('agent', 'seller') AND (u.cityId IS NULL OR u.stateId IS NULL)
  `);
  console.log('Linked agents & sellers → cityId / stateId');

  // ─── Category Analytics Seed ─────────────────────────────────────────────────
  // Pre-computed from seeded property data.
  // Scores = listings*0.25 + views*0.30 + searches*0.20 (no searches in seed)
  // Three scopes: global (state='',city=''), per-state, per-city for top 4 cities
  const catAnalyticsRepo = dataSource.getRepository(CategoryAnalytics);

  type RawCatItem = {
    propertyType: string; label: string; icon: string;
    totalListings: number; totalViews: number;
  };

  // Helper: score + ranked sort
  const buildRows = (
    rows: RawCatItem[],
    state: string,
    city: string,
  ): Partial<CategoryAnalytics>[] =>
    rows
      .map(r => ({
        ...r,
        score:         r.totalListings * 0.25 + r.totalViews * 0.30,
        trendingScore: 0,
        isTrending:    false,
        country:       'India',
        state,
        city,
      }))
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));

  // ── Global (no location filter) ──
  const globalData: RawCatItem[] = [
    { propertyType: 'apartment',            label: 'Apartments',       icon: '🏢', totalListings: 55, totalViews: 16200 },
    { propertyType: 'villa',                label: 'Villas',           icon: '🏡', totalListings: 5,  totalViews: 6870  },
    { propertyType: 'commercial_warehouse', label: 'Warehouses',       icon: '🏭', totalListings: 3,  totalViews: 4990  },
    { propertyType: 'commercial_shop',      label: 'Retail Shops',     icon: '🏪', totalListings: 2,  totalViews: 4620  },
    { propertyType: 'farm_house',           label: 'Farm Houses',      icon: '🌾', totalListings: 1,  totalViews: 3450  },
    { propertyType: 'commercial_office',    label: 'Office Spaces',    icon: '🏢', totalListings: 4,  totalViews: 2790  },
    { propertyType: 'pg',                   label: 'PG / Hostel',      icon: '🛏️', totalListings: 3,  totalViews: 2570  },
    { propertyType: 'industrial_shed',      label: 'Industrial Sheds', icon: '⚙️', totalListings: 1,  totalViews: 2340  },
    { propertyType: 'penthouse',            label: 'Penthouses',       icon: '🌆', totalListings: 1,  totalViews: 2100  },
    { propertyType: 'plot',                 label: 'Plots / Land',     icon: '📐', totalListings: 2,  totalViews: 1960  },
    { propertyType: 'house',                label: 'Houses',           icon: '🏠', totalListings: 3,  totalViews: 1920  },
    { propertyType: 'builder_floor',        label: 'Builder Floors',   icon: '🏗️', totalListings: 1,  totalViews: 1680  },
    { propertyType: 'co_living',            label: 'Co-Living',        icon: '🤝', totalListings: 2,  totalViews: 1320  },
    { propertyType: 'factory',              label: 'Factories',        icon: '🏭', totalListings: 1,  totalViews: 980   },
    { propertyType: 'showroom',             label: 'Showrooms',        icon: '🏬', totalListings: 1,  totalViews: 960   },
    { propertyType: 'land',                 label: 'Land',             icon: '🗺️', totalListings: 1,  totalViews: 780   },
    { propertyType: 'studio',               label: 'Studio Flats',     icon: '🛋️', totalListings: 1,  totalViews: 320   },
  ];

  // Mark top 2 global categories as trending for demo
  const globalRows = buildRows(globalData, '', '');
  globalRows[0].isTrending = true;  globalRows[0].trendingScore = 0.35;
  globalRows[1].isTrending = true;  globalRows[1].trendingScore = 0.28;

  // ── Per-state ──
  const stateData: Record<string, RawCatItem[]> = {
    Maharashtra: [
      { propertyType: 'apartment',            label: 'Apartments',    icon: '🏢', totalListings: 20, totalViews: 6800 },
      { propertyType: 'industrial_shed',      label: 'Industrial Sheds', icon: '⚙️', totalListings: 1, totalViews: 2340 },
      { propertyType: 'commercial_office',    label: 'Office Spaces', icon: '🏢', totalListings: 1,  totalViews: 1230 },
      { propertyType: 'penthouse',            label: 'Penthouses',    icon: '🌆', totalListings: 1,  totalViews: 2100 },
      { propertyType: 'pg',                   label: 'PG / Hostel',   icon: '🛏️', totalListings: 1,  totalViews: 560  },
      { propertyType: 'studio',               label: 'Studio Flats',  icon: '🛋️', totalListings: 1,  totalViews: 320  },
      { propertyType: 'land',                 label: 'Land',          icon: '🗺️', totalListings: 1,  totalViews: 780  },
      { propertyType: 'villa',                label: 'Villas',        icon: '🏡', totalListings: 1,  totalViews: 800  },
    ],
    Karnataka: [
      { propertyType: 'apartment',         label: 'Apartments',    icon: '🏢', totalListings: 15, totalViews: 5400 },
      { propertyType: 'pg',                label: 'PG / Hostel',   icon: '🛏️', totalListings: 2,  totalViews: 2010 },
      { propertyType: 'commercial_office', label: 'Office Spaces', icon: '🏢', totalListings: 1,  totalViews: 670  },
      { propertyType: 'villa',             label: 'Villas',        icon: '🏡', totalListings: 1,  totalViews: 500  },
      { propertyType: 'co_living',         label: 'Co-Living',     icon: '🤝', totalListings: 1,  totalViews: 430  },
    ],
    Delhi: [
      { propertyType: 'apartment',            label: 'Apartments',    icon: '🏢', totalListings: 8,  totalViews: 2900 },
      { propertyType: 'commercial_shop',      label: 'Retail Shops',  icon: '🏪', totalListings: 1,  totalViews: 4500 },
      { propertyType: 'farm_house',           label: 'Farm Houses',   icon: '🌾', totalListings: 1,  totalViews: 3450 },
      { propertyType: 'villa',               label: 'Villas',        icon: '🏡', totalListings: 1,  totalViews: 2340 },
      { propertyType: 'builder_floor',        label: 'Builder Floors',icon: '🏗️', totalListings: 1,  totalViews: 1680 },
      { propertyType: 'commercial_office',    label: 'Office Spaces', icon: '🏢', totalListings: 3,  totalViews: 1500 },
      { propertyType: 'commercial_warehouse', label: 'Warehouses',    icon: '🏭', totalListings: 3,  totalViews: 1200 },
      { propertyType: 'factory',              label: 'Factories',     icon: '⚙️', totalListings: 2,  totalViews: 900  },
    ],
    Telangana: [
      { propertyType: 'apartment',            label: 'Apartments',    icon: '🏢', totalListings: 8,  totalViews: 2200 },
      { propertyType: 'commercial_warehouse', label: 'Warehouses',    icon: '🏭', totalListings: 1,  totalViews: 760  },
      { propertyType: 'showroom',             label: 'Showrooms',     icon: '🏬', totalListings: 1,  totalViews: 960  },
      { propertyType: 'co_living',            label: 'Co-Living',     icon: '🤝', totalListings: 1,  totalViews: 430  },
      { propertyType: 'villa',                label: 'Villas',        icon: '🏡', totalListings: 1,  totalViews: 600  },
    ],
  };

  // ── Per-city ──
  const cityData: Record<string, { state: string; rows: RawCatItem[] }> = {
    Mumbai: {
      state: 'Maharashtra',
      rows: [
        { propertyType: 'apartment',         label: 'Apartments',      icon: '🏢', totalListings: 12, totalViews: 4800 },
        { propertyType: 'industrial_shed',   label: 'Industrial Sheds',icon: '⚙️', totalListings: 1,  totalViews: 2340 },
        { propertyType: 'penthouse',         label: 'Penthouses',      icon: '🌆', totalListings: 1,  totalViews: 2100 },
        { propertyType: 'commercial_office', label: 'Office Spaces',   icon: '🏢', totalListings: 1,  totalViews: 1230 },
        { propertyType: 'pg',                label: 'PG / Hostel',     icon: '🛏️', totalListings: 1,  totalViews: 560  },
        { propertyType: 'studio',            label: 'Studio Flats',    icon: '🛋️', totalListings: 1,  totalViews: 320  },
      ],
    },
    Bangalore: {
      state: 'Karnataka',
      rows: [
        { propertyType: 'apartment',         label: 'Apartments',    icon: '🏢', totalListings: 10, totalViews: 3800 },
        { propertyType: 'pg',                label: 'PG / Hostel',   icon: '🛏️', totalListings: 2,  totalViews: 2010 },
        { propertyType: 'commercial_office', label: 'Office Spaces', icon: '🏢', totalListings: 1,  totalViews: 670  },
        { propertyType: 'co_living',         label: 'Co-Living',     icon: '🤝', totalListings: 1,  totalViews: 430  },
      ],
    },
    Delhi: {
      state: 'Delhi',
      rows: [
        { propertyType: 'commercial_shop',      label: 'Retail Shops',  icon: '🏪', totalListings: 1,  totalViews: 4500 },
        { propertyType: 'farm_house',           label: 'Farm Houses',   icon: '🌾', totalListings: 1,  totalViews: 3450 },
        { propertyType: 'apartment',            label: 'Apartments',    icon: '🏢', totalListings: 6,  totalViews: 2100 },
        { propertyType: 'villa',               label: 'Villas',        icon: '🏡', totalListings: 1,  totalViews: 2340 },
        { propertyType: 'builder_floor',        label: 'Builder Floors',icon: '🏗️', totalListings: 1,  totalViews: 1680 },
        { propertyType: 'commercial_office',    label: 'Office Spaces', icon: '🏢', totalListings: 3,  totalViews: 1500 },
        { propertyType: 'commercial_warehouse', label: 'Warehouses',    icon: '🏭', totalListings: 3,  totalViews: 1200 },
        { propertyType: 'factory',              label: 'Factories',     icon: '⚙️', totalListings: 2,  totalViews: 900  },
      ],
    },
    Hyderabad: {
      state: 'Telangana',
      rows: [
        { propertyType: 'apartment',            label: 'Apartments', icon: '🏢', totalListings: 6,  totalViews: 1800 },
        { propertyType: 'showroom',             label: 'Showrooms',  icon: '🏬', totalListings: 1,  totalViews: 960  },
        { propertyType: 'commercial_warehouse', label: 'Warehouses', icon: '🏭', totalListings: 1,  totalViews: 760  },
        { propertyType: 'co_living',            label: 'Co-Living',  icon: '🤝', totalListings: 1,  totalViews: 430  },
      ],
    },
    Noida: {
      state: 'Uttar Pradesh',
      rows: [
        { propertyType: 'apartment',            label: 'Apartments',    icon: '🏢', totalListings: 5,  totalViews: 1800 },
        { propertyType: 'commercial_office',    label: 'Office Spaces', icon: '🏢', totalListings: 1,  totalViews: 890  },
        { propertyType: 'plot',                 label: 'Plots / Land',  icon: '📐', totalListings: 1,  totalViews: 1340 },
        { propertyType: 'factory',              label: 'Factories',     icon: '🏭', totalListings: 1,  totalViews: 980  },
        { propertyType: 'commercial_warehouse', label: 'Warehouses',    icon: '🏭', totalListings: 5,  totalViews: 2100 },
      ],
    },
    Gurgaon: {
      state: 'Haryana',
      rows: [
        { propertyType: 'apartment',  label: 'Apartments', icon: '🏢', totalListings: 4,  totalViews: 1500 },
        { propertyType: 'co_living',  label: 'Co-Living',  icon: '🤝', totalListings: 1,  totalViews: 890  },
      ],
    },
    Pune: {
      state: 'Maharashtra',
      rows: [
        { propertyType: 'apartment', label: 'Apartments', icon: '🏢', totalListings: 5,  totalViews: 1920 },
        { propertyType: 'house',     label: 'Houses',     icon: '🏠', totalListings: 1,  totalViews: 520  },
        { propertyType: 'villa',     label: 'Villas',     icon: '🏡', totalListings: 1,  totalViews: 400  },
      ],
    },
  };

  const allCatRows: Partial<CategoryAnalytics>[] = [
    ...globalRows,
    ...Object.entries(stateData).flatMap(([state, rows]) => buildRows(rows, state, '')),
    ...Object.entries(cityData).flatMap(([city, { state, rows }]) => buildRows(rows, state, city)),
  ];

  await catAnalyticsRepo.save(allCatRows as CategoryAnalytics[]);
  console.log(`Category analytics seeded: ${allCatRows.length} records (global + ${Object.keys(stateData).length} states + ${Object.keys(cityData).length} cities)`);

  // ─── SEO Config ───────────────────────────────────────────────────────────────
  const seoConfigRepo = dataSource.getRepository(SeoConfig);
  await seoConfigRepo.save([
    { key: 'site_title', label: 'Site Title', description: 'Default title for all pages', value: 'Think4BuySale - Buy, Sell & Rent Property in India' },
    { key: 'site_description', label: 'Site Description', description: 'Default meta description', value: 'India\'s trusted real estate platform. Find apartments, villas, plots, commercial spaces for sale and rent across 100+ cities.' },
    { key: 'site_keywords', label: 'Site Keywords', description: 'Default meta keywords', value: 'buy property india, sell property, rent apartment, real estate india, think4buysale' },
    { key: 'og_image', label: 'OG Image URL', description: 'Default Open Graph image for social sharing', value: '/images/og-default.jpg' },
    { key: 'twitter_handle', label: 'Twitter Handle', description: 'Twitter/X account handle', value: '@think4buysale' },
    { key: 'canonical_domain', label: 'Canonical Domain', description: 'Canonical base URL', value: 'https://think4buysale.com' },
    { key: 'google_site_verification', label: 'Google Site Verification', description: 'Google Search Console verification meta content', value: '' },
  ]);
  console.log('SEO config seeded');

  // ─── Footer SEO Links ─────────────────────────────────────────────────────────
  const footerGroupRepo = dataSource.getRepository(FooterSeoLinkGroup);
  const footerLinkRepo = dataSource.getRepository(FooterSeoLink);

  const fgBuy = await footerGroupRepo.save({ title: 'Buy Property', sortOrder: 0, isActive: true });
  const fgRent = await footerGroupRepo.save({ title: 'Rent Property', sortOrder: 1, isActive: true });
  const fgPG = await footerGroupRepo.save({ title: 'PG / Co-Living', sortOrder: 2, isActive: true });
  const fgNew = await footerGroupRepo.save({ title: 'New Projects', sortOrder: 3, isActive: true });
  const fgOffice = await footerGroupRepo.save({ title: 'Search Office Space', sortOrder: 4, isActive: true });

  const topCities = ['Mumbai', 'Bangalore', 'Delhi', 'Hyderabad', 'Pune', 'Chennai', 'Gurgaon', 'Noida', 'Kolkata', 'Ahmedabad'];
  const slugOf = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

  for (const [i, city] of topCities.entries()) {
    const s = slugOf(city);
    await footerLinkRepo.save([
      { groupId: fgBuy.id, label: `Buy Property in ${city}`, url: `/buy/property-in-${s}`, sortOrder: i, isActive: true },
      { groupId: fgRent.id, label: `Rent Flat in ${city}`, url: `/flats-for-rent/${s}`, sortOrder: i, isActive: true },
      { groupId: fgPG.id, label: `PG in ${city}`, url: `/properties?category=pg&city=${encodeURIComponent(city)}`, sortOrder: i, isActive: true },
      { groupId: fgNew.id, label: `New Projects in ${city}`, url: `/new-projects/${s}`, sortOrder: i, isActive: true },
    ]);
  }

  // ── Search Office Space — Delhi industrial areas (State: Delhi) ───────────────
  const delhiOfficeLinks = [
    { label: 'Anand Parbat',                          url: '/commercial-office-space-for-rent-in-anand-parbat-industrial-area.php' },
    { label: 'Anand Industrial Estate',               url: '/commercial-office-space-for-rent-in-anand-industrial-estate.php' },
    { label: 'Badli',                                  url: '/commercial-office-space-for-rent-in-badli-industrial-area.php' },
    { label: 'Bawana',                                 url: '/commercial-office-space-for-rent-in-bawana-industrial-area.php' },
    { label: 'Friends Colony',                         url: '/commercial-office-space-for-rent-in-friends-colony-industrial-area.php' },
    { label: 'Gurgaon',                                url: '/commercial-office-space-for-rent-in-gurgaon.php' },
    { label: 'Hapur',                                  url: '/commercial-office-space-for-rent-in-hapur-industrial-area.php' },
    { label: 'Janakpuri',                              url: '/commercial-office-space-for-rent-in-janakpuri.php' },
    { label: 'Jhilmil',                                url: '/commercial-office-space-for-rent-in-jhilmil-industrial-area.php' },
    { label: 'Kirti Nagar',                            url: '/commercial-office-space-for-rent-in-kirti-nagar-industrial-area.php' },
    { label: 'Lawrence Road',                          url: '/commercial-office-space-for-rent-in-lawrence-road-industrial-area.php' },
    { label: 'Mangolpuri',                             url: '/commercial-office-space-for-rent-in-mangolpuri-industrial-area.php' },
    { label: 'Mayapuri',                               url: '/commercial-office-space-for-rent-in-mayapuri-industrial-area.php' },
    { label: 'Meerut Road',                            url: '/commercial-office-space-for-rent-in-meerut-road-industrial-area.php' },
    { label: 'Mg Road',                                url: '/commercial-office-space-for-rent-in-mg-road-industrial-area-ghaziabad.php' },
    { label: 'Mohan Cooperative',                      url: '/commercial-office-space-for-rent-in-mohan-cooperative-industrial-area.php' },
    { label: 'Mohan Nagar',                            url: '/commercial-office-space-for-rent-in-mohan-nagar-industrial-area-site-2.php' },
    { label: 'Moti Nagar',                             url: '/commercial-office-space-for-rent-in-moti-nagar-industrial-area.php' },
    { label: 'Mussoorie Gulawathi Road',               url: '/commercial-office-space-for-rent-in-mussoorie-gulawathi-road-industrial-area.php' },
    { label: 'Najafgarh',                              url: '/commercial-office-space-for-rent-in-najafgarh-road-industrial-area.php' },
    { label: 'Naraina',                                url: '/commercial-office-space-for-rent-in-naraina-industrial-area.php' },
    { label: 'Narela',                                 url: '/commercial-office-space-for-rent-in-narela-industrial-area.php' },
    { label: 'Noida',                                  url: '/commercial-office-space-for-rent-in-noida.php' },
    { label: 'Okhla',                                  url: '/commercial-office-space-for-rent-in-okhla-industrial-area.php' },
    { label: 'Patparganj',                             url: '/commercial-office-space-for-rent-in-patparganj-industrial-area.php' },
    { label: 'Pipe Market Chikambarpur',               url: '/commercial-office-space-for-rent-in-pipe-market-chikambarpur-industrial-area.php' },
    { label: 'Rampura',                                url: '/commercial-office-space-for-rent-in-rampura-industrial-area.php' },
    { label: 'Sahibabad',                              url: '/commercial-office-space-for-rent-in-sahibabad-industrial-area.php' },
    { label: 'Shahdara',                               url: '/commercial-office-space-for-rent-in-shahdara-industrial-area.php' },
    { label: 'UPSIDC',                                 url: '/commercial-office-space-for-rent-in-upsidc-industrial-area.php' },
    { label: 'Wazirpur',                               url: '/commercial-office-space-for-rent-in-wazirpur-industrial-area.php' },
    { label: 'South Side Ghaziabad',                   url: '/commercial-office-space-for-rent-in-south-side-industrial-area-ghaziabad.php' },
    { label: 'Rajendra Nagar Industrial Area Ghaziabad', url: '/commercial-office-space-for-rent-in-rajendra-nagar-industrial-area-ghaziabad.php' },
  ];
  for (const [i, link] of delhiOfficeLinks.entries()) {
    await footerLinkRepo.save({ groupId: fgOffice.id, label: link.label, url: link.url, sortOrder: i, isActive: true });
  }

  console.log('Footer SEO links seeded');

  // ─── City SEO Pages ────────────────────────────────────────────────────────────
  const cityPageRepo = dataSource.getRepository(CityPage);
  const cityPages = [
    // MUMBAI
    {
      cityName: 'Mumbai', pageType: 'buy' as any, slug: 'buy-property-in-mumbai', isActive: true,
      h1: 'Buy Property in Mumbai – Flats, Villas, Plots for Sale',
      metaTitle: 'Buy Property in Mumbai | Apartments, Villas, Flats for Sale | Think4BuySale',
      metaDescription: 'Buy apartments, villas, plots and commercial properties in Mumbai. Browse 5,000+ verified listings in Bandra, Andheri, Thane, Navi Mumbai, Powai, and South Mumbai.',
      metaKeywords: 'buy property mumbai, flats for sale mumbai, apartments mumbai, villa mumbai, plot mumbai, south mumbai property',
      introContent: 'Mumbai — India\'s financial capital and the city of dreams — offers a diverse real estate market ranging from luxury sea-facing apartments in South Mumbai and Bandra to affordable flats in Thane and Navi Mumbai. Think4BuySale lists 5,000+ verified properties for sale across all Mumbai neighbourhoods.',
      seoContent: 'Mumbai\'s real estate market is one of the most dynamic and resilient in India. The city\'s property prices span a wide range — from Rs. 60–80 lakh for a 1 BHK in Thane to Rs. 10 crore+ for a luxury apartment in South Mumbai.\n\nKey micro-markets: Bandra West (premium residential), Andheri East (commercial hub), Powai (IT corridor), Thane (affordable family housing), Navi Mumbai (emerging with excellent infrastructure), Malad and Kandivali (mid-segment), and Prabhadevi/Worli (ultra-luxury).\n\nMumbai offers excellent connectivity via local trains, metro (Aqua Line operational, more under construction), and the upcoming Coastal Road and Atal Setu bridge connecting the island city to Navi Mumbai. This infrastructure push is driving property appreciation in peripheral areas like Ulwe, Panvel, and Dronagiri.',
      faqs: [
        { question: 'What is the property price range in Mumbai?', answer: 'Mumbai property prices range from Rs. 7,000/sqft (Boisar/Karjat) to Rs. 1,00,000+/sqft (South Mumbai sea-facing). Mid-segment areas like Thane and Navi Mumbai offer 1 BHK flats between Rs. 60–90 lakh.' },
        { question: 'Which are the best areas to buy property in Mumbai?', answer: 'For luxury: Bandra, Worli, Juhu, Prabhadevi. For mid-segment: Andheri, Powai, Mulund. For affordable: Thane, Navi Mumbai, Mira Road, Vasai-Virar. For investment: Panvel, Ulwe, Kharghar.' },
      ],
    },
    {
      cityName: 'Mumbai', pageType: 'rent' as any, slug: 'rent-property-in-mumbai', isActive: true,
      h1: 'Rent Property in Mumbai – Flats & Apartments for Rent',
      metaTitle: 'Rent Property in Mumbai | Apartments, Flats for Rent | Think4BuySale',
      metaDescription: 'Rent furnished and unfurnished apartments, flats and houses in Mumbai. Find rentals in Andheri, Bandra, Thane, Navi Mumbai. Direct owner listings, best rental deals.',
      metaKeywords: 'rent property mumbai, flats for rent mumbai, apartments for rent mumbai, furnished flat mumbai, 1 BHK rent mumbai',
      introContent: 'Looking to rent in Mumbai? Think4BuySale lists 3,000+ rental properties across Mumbai — from budget studio flats in Malad to premium sea-facing apartments in Worli. Find furnished, semi-furnished, and unfurnished options with direct owner listings.',
      seoContent: 'Mumbai\'s rental market is among the most competitive in India. A 1 BHK in Andheri West rents for Rs. 25,000–40,000 per month, while Bandra West commands Rs. 45,000–70,000 for similar configurations. Thane and Navi Mumbai offer significantly more affordable options — Rs. 15,000–25,000 for a 1 BHK.\n\nPopular rental markets: Andheri (proximity to airports and BKC), Bandra (upscale lifestyle), Powai (IT professionals), Thane (families seeking larger homes), Borivali and Kandivali (balanced lifestyle and commute), and CBD Belapur/Kharghar in Navi Mumbai.\n\nTips for Mumbai renters: Always insist on a registered lease agreement, pay no more than 2 months\' security deposit, check for building society NOC for tenants, and verify electricity meter and water charges separately.',
      faqs: [
        { question: 'What is the average rent in Mumbai?', answer: 'Average monthly rent: 1 BHK in Andheri Rs. 28,000–38,000; Thane Rs. 15,000–22,000; Bandra Rs. 45,000–65,000. 2 BHK in Powai Rs. 45,000–65,000; Navi Mumbai Rs. 22,000–30,000.' },
        { question: 'Is a rental agreement mandatory in Mumbai?', answer: 'Yes, a registered rental/leave & licence agreement is strongly recommended and legally required for tenancies exceeding 12 months. For 11-month agreements, registration is optional but advisable.' },
      ],
    },
    {
      cityName: 'Mumbai', pageType: 'commercial' as any, slug: 'commercial-property-in-mumbai', isActive: true,
      h1: 'Commercial Properties in Mumbai – Office Space, Shops & Showrooms',
      metaTitle: 'Commercial Property in Mumbai | Office Space, Shops for Sale & Rent | Think4BuySale',
      metaDescription: 'Find commercial office spaces, retail shops, showrooms and warehouses in Mumbai. Grade A offices in BKC, Andheri, Lower Parel. Best commercial property deals.',
      metaKeywords: 'commercial property mumbai, office space mumbai, retail shop mumbai, BKC office, Lower Parel office space, Andheri commercial property',
      introContent: 'Mumbai is India\'s premier commercial real estate destination with world-class Grade A office campuses in BKC, Lower Parel, and Andheri. Think4BuySale lists verified commercial spaces — from 500 sqft plug-and-play offices for startups to 1 lakh sqft enterprise headquarters.',
      seoContent: 'Mumbai\'s commercial property market is anchored by Bandra Kurla Complex (BKC) — home to SEBI, RBI, major banks, and MNCs with rentals of Rs. 250–350/sqft/month. Lower Parel and Worli are emerging as alternative CBDs with large floor plates and premium mall-adjacent offices. Andheri (MIDC, Chakala, Marol) offers mid-segment office parks at Rs. 100–150/sqft.\n\nIndustrially, Bhiwandi near Thane is Asia\'s largest logistics and warehousing hub, with over 50 million sqft of warehouse space and growing. It serves as the distribution backbone for e-commerce companies in Mumbai.',
      faqs: [
        { question: 'What is the office rental rate in BKC Mumbai?', answer: 'BKC office space rentals range from Rs. 200–350/sqft/month for Grade A buildings. Lower Parel is Rs. 180–250/sqft, Andheri East Rs. 100–160/sqft.' },
      ],
    },
    {
      cityName: 'Mumbai', pageType: 'pg' as any, slug: 'pg-in-mumbai', isActive: true,
      h1: 'PG Accommodation in Mumbai – Paying Guest & Co-Living',
      metaTitle: 'PG in Mumbai | Paying Guest & Co-Living Spaces Near IT Parks | Think4BuySale',
      metaDescription: 'Find PG accommodation and co-living spaces in Mumbai near BKC, Andheri, Powai, Thane. Furnished rooms with meals, WiFi, and 24x7 security from Rs. 8,000/month.',
      metaKeywords: 'PG in mumbai, paying guest mumbai, co-living mumbai, PG andheri, PG bandra, hostel mumbai, furnished PG mumbai',
      introContent: 'Find safe, verified PG accommodations and co-living spaces in Mumbai starting from Rs. 8,000/month. Think4BuySale lists PGs near IT parks in Andheri, Powai, and BKC — with options for meals, AC rooms, attached bathrooms, and WiFi.',
      seoContent: 'Mumbai has a thriving PG market driven by its massive working population and student community. PGs near Andheri (IT hubs) and Kurla (BKC proximity) are most popular with working professionals, while Dadar, Matunga, and Ghatkopar PGs cater to students and government office employees.\n\nCo-living operators like Stanza Living, Zolo, and OYO Life have significant presence in Mumbai, offering standardised, fully-managed accommodations with flexible monthly leases.',
      faqs: [
        { question: 'What is the average PG cost in Mumbai?', answer: 'PG costs range from Rs. 8,000–15,000/month for basic accommodation (non-AC, sharing) to Rs. 18,000–25,000/month for premium furnished PG with meals, AC, and attached bathroom in areas like Andheri and Powai.' },
      ],
    },
    {
      cityName: 'Mumbai', pageType: 'new_projects' as any, slug: 'new-projects-in-mumbai', isActive: true,
      h1: 'New Launch Projects in Mumbai – RERA Registered Builder Projects',
      metaTitle: 'New Projects in Mumbai | New Launch & Under-Construction Properties | Think4BuySale',
      metaDescription: 'Explore new launch and under-construction residential projects in Mumbai from Lodha, Godrej, Oberoi, Raymond, and more. RERA-registered, flexible payment plans.',
      metaKeywords: 'new projects mumbai, new launch property mumbai, under construction flats mumbai, RERA projects mumbai, Lodha new project, Godrej project mumbai',
      introContent: 'Mumbai\'s new project pipeline is robust with leading developers like Lodha Group, Godrej Properties, Oberoi Realty, L&T Realty, and Raymond launching premium residential projects in Thane, Mulund, Dombivli, and South Mumbai.',
      seoContent: 'Key new launch corridors in Mumbai: Thane and Dombivli (affordable 1&2 BHK under Rs. 80 lakh), Mulund and Bhandup (mid-segment 2&3 BHK), Andheri and Goregaon (premium projects), and Worli/Bandra (ultra-luxury with sea views).\n\nSome upcoming infrastructure like Navi Mumbai Airport (expected completion 2025), Metro Line extensions, and MTHL bridge are expected to significantly boost property values in Ulwe, Panvel, and Airoli in the next 3–5 years.',
      faqs: [
        { question: 'Which are the top developers for new projects in Mumbai?', answer: 'Leading developers in Mumbai include Lodha Group (Palava City, World One), Godrej Properties (Vikhroli, Thane), Oberoi Realty (Goregaon, Borivali), L&T Realty (Mulund, Powai), and Raymond Realty (Thane).' },
      ],
    },
    // DELHI
    {
      cityName: 'Delhi', pageType: 'buy' as any, slug: 'buy-property-in-delhi', isActive: true,
      h1: 'Buy Property in Delhi – Flats, Builder Floors & Plots for Sale',
      metaTitle: 'Buy Property in Delhi | Flats, Builder Floors, Plots for Sale | Think4BuySale',
      metaDescription: 'Buy apartments, builder floors, villas and plots in Delhi. Explore verified listings in Greater Kailash, Vasant Kunj, Dwarka, Rohini, and Janakpuri.',
      metaKeywords: 'buy property delhi, flats for sale delhi, builder floors delhi, plot delhi, south delhi property, dwarka flat sale',
      introContent: 'Delhi\'s real estate market is one of India\'s most established, offering everything from luxury builder floors in South Delhi to affordable DDA flats in Dwarka. Think4BuySale lists 3,000+ verified properties for sale across all Delhi localities.',
      seoContent: 'Delhi\'s property market is characterised by its unique builder floor culture in South and West Delhi, DDA housing schemes in Dwarka and Rohini, and luxury residential pockets in Greater Kailash, Defence Colony, and Vasant Kunj.\n\nKey investment areas: Dwarka (metro connectivity, DDA flats Rs. 60–90 lakh), South Delhi (premium, Rs. 3–10 crore), Rohini (mid-segment, Rs. 50–80 lakh), and Janakpuri (family-friendly, Rs. 80 lakh–2 crore).\n\nDelhi\'s strategic location makes it a strong investment choice — property values in Dwarka have appreciated 40–50% in the last decade driven by metro and NH-8 expressway development.',
      faqs: [
        { question: 'What is the property price range in Delhi?', answer: 'Property prices in Delhi range from Rs. 40–60 lakh (Bawana, Narela) to Rs. 10 crore+ (Defence Colony, GK). Mid-range areas like Rohini and Dwarka offer 2 BHK apartments at Rs. 60–90 lakh.' },
        { question: 'What is a builder floor in Delhi?', answer: 'A builder floor is an independent floor of a 4-storey residential building, very common in South Delhi, West Delhi, and Gurgaon. Each floor is owned/rented independently, offering more privacy than a flat in an apartment complex.' },
      ],
    },
    {
      cityName: 'Delhi', pageType: 'rent' as any, slug: 'rent-property-in-delhi', isActive: true,
      h1: 'Rent Property in Delhi – Flats, Builder Floors & Apartments for Rent',
      metaTitle: 'Rent Property in Delhi | Flats, Builder Floors for Rent | Think4BuySale',
      metaDescription: 'Rent flats, builder floors and apartments in Delhi. Find rentals in Dwarka, Rohini, Greater Kailash, Janakpuri, Connaught Place. Direct owner listings.',
      metaKeywords: 'rent property delhi, flats for rent delhi, builder floor rent delhi, apartment rent delhi, furnished flat delhi rent',
      introContent: 'Find your perfect rental in Delhi with Think4BuySale. From budget 1 BHK flats in Rohini to premium furnished builder floors in Greater Kailash — browse 2,000+ verified rental listings across all Delhi localities.',
      seoContent: 'Delhi\'s rental market offers exceptional diversity — from sharing accommodation near university campuses in North Delhi to executive builder floors near corporate offices in Connaught Place and Nehru Place.\n\nAverage monthly rent: 2 BHK builder floor in South Delhi Rs. 35,000–60,000; Dwarka Rs. 18,000–28,000; Rohini Rs. 15,000–22,000; Central Delhi (near CP) Rs. 25,000–45,000.',
      faqs: [
        { question: 'What is the average rent in Delhi?', answer: '1 BHK in Rohini: Rs. 12,000–18,000/month. 2 BHK in Dwarka: Rs. 18,000–25,000/month. 2 BHK builder floor in GK-II: Rs. 40,000–65,000/month.' },
      ],
    },
    {
      cityName: 'Delhi', pageType: 'commercial' as any, slug: 'commercial-property-in-delhi', isActive: true,
      h1: 'Commercial Properties in Delhi – Office Space, Shops in Prime Locations',
      metaTitle: 'Commercial Property in Delhi | Office Space, Shops for Sale & Rent | Think4BuySale',
      metaDescription: 'Find commercial office spaces, retail shops, and showrooms in Delhi. Premium offices in Connaught Place, Nehru Place, Bhikaji Cama Place, and Mohan Cooperative.',
      metaKeywords: 'commercial property delhi, office space delhi, retail shop delhi, CP office rent, Nehru Place commercial, Bhikaji Cama Place office',
      introContent: 'Delhi offers prime commercial real estate across its iconic business districts — Connaught Place (India\'s most expensive retail market), Nehru Place (IT hub), Bhikaji Cama Place (corporate offices), and Jasola (banking and financial services).',
      seoContent: 'Delhi\'s commercial market is anchored by Connaught Place — consistently rated among the top 10 most expensive retail destinations in the world. Office space here commands Rs. 300–500/sqft/month. Nehru Place is Delhi\'s IT and electronics hub, with office rentals at Rs. 80–120/sqft.\n\nFor industrial and warehousing needs, Delhi\'s industrial areas — Wazirpur, Okhla, Mohan Cooperative, Lawrence Road, and Bawana — offer small-to-medium factory sheds and godowns at Rs. 20–40/sqft/month.',
      faqs: [
        { question: 'What is the office rental rate in Connaught Place?', answer: 'Office space in Connaught Place commands Rs. 250–400/sqft/month for Grade A space. Nehru Place office space is Rs. 80–120/sqft/month and Bhikaji Cama Place is Rs. 120–200/sqft/month.' },
      ],
    },
    {
      cityName: 'Delhi', pageType: 'pg' as any, slug: 'pg-in-delhi', isActive: true,
      h1: 'PG Accommodation in Delhi – Paying Guest Near Metro & Offices',
      metaTitle: 'PG in Delhi | Paying Guest Accommodation Near Metro, Colleges | Think4BuySale',
      metaDescription: 'Find PG accommodation in Delhi near metro stations, colleges, and offices. Affordable paying guest rooms with meals and WiFi in Rohini, Dwarka, Janakpuri, and South Delhi.',
      metaKeywords: 'PG in delhi, paying guest delhi, PG near metro delhi, hostel delhi, co-living delhi, PG south delhi, PG rohini',
      introContent: 'Delhi has a massive PG market catering to students, government employees, and private sector professionals. Find verified PG accommodations near metro stations, DU colleges, IIT, JNU, and corporate offices across all Delhi localities.',
      seoContent: 'PG accommodations in Delhi are most sought-after near Delhi University North Campus (Kamla Nagar, Vijay Nagar, Mukherjee Nagar), Central Delhi (Karol Bagh, Rajendra Nagar), and South Delhi near Nehru Place and Saket.\n\nAverage PG cost in Delhi: Rs. 6,000–10,000/month for basic sharing; Rs. 12,000–18,000 for AC furnished rooms with meals.',
      faqs: [
        { question: 'What is the cheapest PG in Delhi?', answer: 'Budget PG accommodations in areas like Uttam Nagar, Nangloi, and Rohini offer sharing rooms from Rs. 5,000–8,000/month without meals. Areas near DU North Campus offer PGs from Rs. 7,000–12,000/month with meals.' },
      ],
    },
    {
      cityName: 'Delhi', pageType: 'new_projects' as any, slug: 'new-projects-in-delhi', isActive: true,
      h1: 'New Launch Projects in Delhi – RERA Builder Projects',
      metaTitle: 'New Projects in Delhi | New Launch Properties | Think4BuySale',
      metaDescription: 'Explore new launch residential projects in Delhi from top developers. RERA-registered projects in Dwarka, Rohini, Narela, and South Delhi. Flexible payment plans.',
      metaKeywords: 'new projects delhi, new launch property delhi, under construction flats delhi, RERA projects delhi, DDA housing delhi',
      introContent: 'Delhi\'s new project landscape is shaped by DDA housing schemes, builder floor developments in South and West Delhi, and new residential townships in Narela and Dwarka Extension.',
      seoContent: 'Delhi\'s new launch market is unique — unlike Mumbai and Bangalore where apartment complexes dominate, Delhi sees significant activity in builder floor construction (G+3 independent floors) in South and West Delhi localities.\n\nKey new project corridors: Narela (affordable sub-Rs. 40 lakh units), Dwarka (mid-segment under DUSIB/DDA), and L-Zone Dwarka Expressway (premium upcoming residential).',
      faqs: [
        { question: 'Are DDA flats available in Delhi?', answer: 'DDA periodically launches housing schemes for LIG, MIG, and HIG categories at subsidised rates. Keep track of DDA\'s official housing scheme draws on their website for the latest availability.' },
      ],
    },
    // BANGALORE
    {
      cityName: 'Bangalore', pageType: 'buy' as any, slug: 'buy-property-in-bangalore', isActive: true,
      h1: 'Buy Property in Bangalore – Apartments, Villas & Plots for Sale',
      metaTitle: 'Buy Property in Bangalore | Apartments, Villas for Sale | Think4BuySale',
      metaDescription: 'Buy apartments, villas, plots and houses in Bangalore. Explore listings in Whitefield, Koramangala, HSR Layout, Indiranagar, Electronic City, and Sarjapur Road.',
      metaKeywords: 'buy property bangalore, apartments bangalore, villas bangalore, plot bangalore, whitefield property, koramangala apartment',
      introContent: 'Bangalore — India\'s Silicon Valley — offers a robust real estate market driven by its thriving IT sector. Think4BuySale lists verified properties in Whitefield, Sarjapur Road, Koramangala, HSR Layout, Hebbal, and 50+ localities across Bangalore.',
      seoContent: 'Bangalore\'s real estate market is characterised by strong demand from IT/ITES professionals, startup founders, and young families. Property prices range from Rs. 35–50 lakh for a 2 BHK in Electronic City to Rs. 3–8 crore for a villa in Whitefield or Sarjapur Road.\n\nKey micro-markets: Whitefield (IT hub, premium apartments Rs. 70 lakh–1.5 crore), Sarjapur Road (family residential, good schools), Koramangala (startup hub, premium), Electronic City (affordable, close to IT parks), Hebbal (north Bangalore, excellent connectivity), and North Bangalore (Devanahalli, near new airport — best for long-term investment).\n\nBangalore\'s metro expansion (Phase 2 connecting Whitefield, Hebbal, and RV Road) is significantly boosting property values along the new corridors.',
      faqs: [
        { question: 'What is the property price range in Bangalore?', answer: 'Bangalore property prices range from Rs. 4,500/sqft (Electronic City, Tumkur Road) to Rs. 15,000+/sqft (Koramangala, Indiranagar, Whitefield premium). A 2 BHK apartment typically costs Rs. 50 lakh–1 crore in most mid-segment areas.' },
        { question: 'Which areas in Bangalore are best for IT professionals?', answer: 'Whitefield (ITPL), Marathahalli, Sarjapur Road, and Bellandur are closest to major IT parks on the east side. HSR Layout, Koramangala, and BTM Layout are popular among startup professionals. Electronic City offers affordable options near Infosys and Wipro campuses.' },
      ],
    },
    {
      cityName: 'Bangalore', pageType: 'rent' as any, slug: 'rent-property-in-bangalore', isActive: true,
      h1: 'Rent Property in Bangalore – Apartments & Flats for Rent',
      metaTitle: 'Rent Property in Bangalore | Apartments, Flats for Rent | Think4BuySale',
      metaDescription: 'Rent furnished and unfurnished apartments in Bangalore. Find 1 BHK, 2 BHK, 3 BHK flats for rent near IT parks in Whitefield, Koramangala, HSR Layout, Electronic City.',
      metaKeywords: 'rent property bangalore, flats for rent bangalore, apartment rent bangalore, furnished flat bangalore, 2 BHK rent bangalore, PG bangalore',
      introContent: 'Find your rental home in Bangalore with Think4BuySale. From Rs. 12,000/month studio apartments near Electronic City to Rs. 80,000/month premium 3 BHK flats in Koramangala — browse 4,000+ verified rental listings.',
      seoContent: 'Bangalore\'s rental market is driven by the constant influx of IT professionals, students, and entrepreneurs. Demand is highest near Whitefield, Marathahalli, Bellandur, Koramangala, Indiranagar, and HSR Layout.\n\nMonthly rent ranges: 1 BHK in Electronic City Rs. 12,000–18,000; Whitefield Rs. 18,000–28,000; Koramangala Rs. 25,000–40,000. 2 BHK in HSR Layout Rs. 28,000–42,000; Marathahalli Rs. 20,000–32,000.',
      faqs: [
        { question: 'What is the average rent in Bangalore?', answer: '1 BHK in Whitefield: Rs. 18,000–25,000/month. 2 BHK in HSR Layout: Rs. 28,000–40,000/month. Studio near Electronic City: Rs. 12,000–16,000/month. Rent has increased 15–20% since 2022.' },
      ],
    },
    {
      cityName: 'Bangalore', pageType: 'pg' as any, slug: 'pg-in-bangalore', isActive: true,
      h1: 'PG Accommodation in Bangalore – Co-Living Near IT Parks',
      metaTitle: 'PG in Bangalore | Co-Living Spaces Near IT Parks | Think4BuySale',
      metaDescription: 'Find PG and co-living accommodation in Bangalore near IT parks, Koramangala, Whitefield, HSR Layout. Furnished rooms with WiFi, meals from Rs. 7,000/month.',
      metaKeywords: 'PG in bangalore, paying guest bangalore, co-living bangalore, PG koramangala, PG whitefield, hostel bangalore, working professional PG bangalore',
      introContent: 'Bangalore has India\'s most vibrant co-living market, driven by its massive IT workforce. Find verified PG and co-living spaces near Whitefield ITPL, Koramangala, HSR Layout, and Electronic City with professional management.',
      seoContent: 'Co-living in Bangalore has evolved far beyond traditional PG. Operators like NestAway, Zolo, Stanza Living, and Colive offer professionally managed accommodations with WiFi, housekeeping, community events, and flexible leases — ideal for the city\'s transient tech workforce.\n\nAverage PG cost: Rs. 7,000–12,000/month (sharing) near Electronic City and Bannerghatta Road; Rs. 15,000–22,000/month for premium co-living near Koramangala and Indiranagar.',
      faqs: [
        { question: 'What is the cost of PG near Whitefield in Bangalore?', answer: 'PG near Whitefield ITPL ranges from Rs. 9,000–15,000/month for a sharing room with meals to Rs. 18,000–25,000 for a premium co-living private room with all utilities.' },
      ],
    },
    {
      cityName: 'Bangalore', pageType: 'commercial' as any, slug: 'commercial-property-in-bangalore', isActive: true,
      h1: 'Commercial Properties in Bangalore – Office Space, Retail & Industrial',
      metaTitle: 'Commercial Property in Bangalore | Office Space, Shops | Think4BuySale',
      metaDescription: 'Find commercial office spaces, retail shops, and warehouses in Bangalore. Grade A offices in Outer Ring Road, Whitefield, Koramangala, and Electronic City.',
      metaKeywords: 'commercial property bangalore, office space bangalore, retail shop bangalore, ORR office, whitefield office space, koramangala commercial',
      introContent: 'Bangalore is South India\'s premier commercial real estate market, hosting global tech giants, unicorn startups, and leading Indian corporations. Find Grade A offices, co-working spaces, and retail shops across Outer Ring Road, Whitefield, and Koramangala.',
      seoContent: 'Bangalore\'s Outer Ring Road (ORR) corridor from Marathahalli to Hebbal is among India\'s most sought-after office markets, with companies like Google, Microsoft, Amazon, Infosys, and Wipro having large campuses. Office rentals on ORR range from Rs. 70–120/sqft/month.\n\nWhitefield\'s ITPL and EPIP Zone host major IT/ITES companies with office rentals at Rs. 60–100/sqft. The upcoming metro connectivity is expected to push these values 15–20% higher.',
      faqs: [
        { question: 'What is the office rental rate on Bangalore\'s Outer Ring Road?', answer: 'Grade A office space on Outer Ring Road (Marathahalli to Sarjapur) rents at Rs. 70–120/sqft/month. Whitefield is Rs. 60–100/sqft and Electronic City is Rs. 45–70/sqft.' },
      ],
    },
    {
      cityName: 'Bangalore', pageType: 'new_projects' as any, slug: 'new-projects-in-bangalore', isActive: true,
      h1: 'New Launch Projects in Bangalore – RERA Residential Projects',
      metaTitle: 'New Projects in Bangalore | New Launch Properties | Think4BuySale',
      metaDescription: 'Explore new launch and under-construction apartments and villas in Bangalore from Prestige, Sobha, Brigade, Godrej, and Mahindra. RERA-registered projects.',
      metaKeywords: 'new projects bangalore, new launch bangalore, under construction flats bangalore, RERA projects bangalore, prestige project bangalore, sobha project',
      introContent: 'Bangalore\'s new project pipeline is the strongest in South India, with premium developers like Prestige Group, Sobha Limited, Brigade Group, Godrej Properties, and Tata Housing launching projects across North Bangalore, Sarjapur Road, and Whitefield.',
      seoContent: 'North Bangalore (Hebbal, Devanahalli, and Yelahanka) is the fastest-growing new project corridor, driven by proximity to Kempegowda International Airport and upcoming Namma Metro Phase 2.\n\nSarjapur Road and Whitefield remain perennial favourites with 2 BHK apartments starting at Rs. 65 lakh. Under-construction projects in Hennur and Thanisandra (North Bangalore) offer 3 BHK at Rs. 80 lakh–1.2 crore with 2–3 year possession timelines.',
      faqs: [
        { question: 'Which are the top developers for new projects in Bangalore?', answer: 'Top developers include Prestige Group (multiple projects across the city), Sobha Limited (Hebbal, Whitefield), Brigade Group (ORR, Electronics City), Godrej Properties (Rajendra Nagar, Hoskote), and Salarpuria Sattva (Whitefield, Marathahalli).' },
      ],
    },
    // HYDERABAD
    {
      cityName: 'Hyderabad', pageType: 'buy' as any, slug: 'buy-property-in-hyderabad', isActive: true,
      h1: 'Buy Property in Hyderabad – Apartments, Villas & Plots for Sale',
      metaTitle: 'Buy Property in Hyderabad | Flats, Villas for Sale | Think4BuySale',
      metaDescription: 'Buy apartments, villas and plots in Hyderabad. Explore listings in HITEC City, Gachibowli, Kokapet, Financial District, Kondapur, Manikonda, and Banjara Hills.',
      metaKeywords: 'buy property hyderabad, flats for sale hyderabad, apartments hyderabad, HITEC City property, Gachibowli flat, Kokapet villa',
      introContent: 'Hyderabad — India\'s fastest-growing property market — offers exceptional value for money compared to Mumbai and Bangalore. Think4BuySale lists 4,000+ verified properties across HITEC City, Financial District, Kondapur, Gachibowli, and 40+ localities.',
      seoContent: 'Hyderabad\'s real estate market has delivered the highest appreciation among all major Indian cities in 2022–2024, driven by massive IT expansion, excellent infrastructure, and investor-friendly policies. Property prices in Kokapet (Financial District) have doubled in 5 years.\n\nKey micro-markets: Gachibowli and Financial District (IT campus zone, premium), Kondapur and Madhapur (HITEC City belt, mid-to-premium), Miyapur and Kukatpally (mid-segment, Rs. 45–70 lakh), Manikonda (affordable), and Kokapet (ultra-premium investment, Rs. 8,000–15,000/sqft).\n\nHyderabad offers the lowest stamp duty (4–6%) among major metros and no additional surcharge, making it very investor-friendly.',
      faqs: [
        { question: 'What is the property price range in Hyderabad?', answer: 'Hyderabad property prices range from Rs. 3,500/sqft (LB Nagar, Hayathnagar) to Rs. 12,000+/sqft (Kokapet, Financial District). A 2 BHK in Kondapur costs Rs. 60–80 lakh; in HITEC City Rs. 80 lakh–1.2 crore.' },
        { question: 'Which areas in Hyderabad are best for investment?', answer: 'Kokapet and Financial District (PBEL City, ORR junction) for premium investment. Narsingi, Manikonda, and Tellapur for mid-segment. Shadnagar and Shamshabad near the airport for long-term appreciation play.' },
      ],
    },
    {
      cityName: 'Hyderabad', pageType: 'rent' as any, slug: 'rent-property-in-hyderabad', isActive: true,
      h1: 'Rent Property in Hyderabad – Flats & Apartments Near IT Hubs',
      metaTitle: 'Rent Property in Hyderabad | Flats for Rent Near HITEC City | Think4BuySale',
      metaDescription: 'Rent furnished and unfurnished apartments in Hyderabad near HITEC City, Gachibowli, Financial District, Kondapur, and Miyapur. Best rental deals in Hyderabad.',
      metaKeywords: 'rent property hyderabad, flats for rent hyderabad, apartment rent hyderabad, furnished flat hyderabad, HITEC City rent, Gachibowli apartment rent',
      introContent: 'Find rental properties in Hyderabad with Think4BuySale. From budget apartments in Miyapur (Rs. 12,000/month) to premium villas in Jubilee Hills (Rs. 80,000+/month) — browse 3,000+ verified rental listings across Hyderabad.',
      seoContent: 'Hyderabad\'s rental market is among the most affordable in India\'s major IT cities. A 2 BHK in Kondapur rents for Rs. 22,000–35,000/month — compared to Rs. 35,000–50,000 in comparable Bangalore localities. This affordability attracts a large migrant workforce from across India.\n\nPopular rental areas: Kondapur (HITEC City proximity), Gachibowli (Financial District employees), Miyapur (affordable, good metro access), Manikonda (family-friendly), and Kukatpally (mid-segment).',
      faqs: [
        { question: 'What is the average rent in Hyderabad?', answer: '1 BHK in Miyapur: Rs. 10,000–15,000/month. 2 BHK in Kondapur: Rs. 22,000–30,000/month. 3 BHK in Gachibowli: Rs. 35,000–50,000/month. Hyderabad rents are 30–40% lower than Bangalore for comparable properties.' },
      ],
    },
    {
      cityName: 'Hyderabad', pageType: 'commercial' as any, slug: 'commercial-property-in-hyderabad', isActive: true,
      h1: 'Commercial Properties in Hyderabad – Offices & Warehouses',
      metaTitle: 'Commercial Property in Hyderabad | Office Space, Shops | Think4BuySale',
      metaDescription: 'Find commercial office spaces, retail shops, warehouses in Hyderabad. Grade A offices in HITEC City, Gachibowli, Financial District, and Cyber Towers.',
      metaKeywords: 'commercial property hyderabad, office space hyderabad, HITEC City office, Gachibowli commercial, Financial District office rent',
      introContent: 'Hyderabad\'s commercial market is anchored by HITEC City and the Financial District — home to Google, Amazon, Facebook, Microsoft, and hundreds of Indian IT companies. Grade A office rentals are competitively priced at Rs. 60–100/sqft/month.',
      seoContent: 'HITEC City and Cyberabad IT corridor (HITEC City, Gachibowli, Financial District) is one of India\'s premier IT real estate corridors with 80+ million sqft of office space. Office vacancies remain at 10–15%, one of the lowest in India, indicating strong demand.\n\nPatancheru industrial zone is Hyderabad\'s primary manufacturing and warehousing hub, with IDA-approved warehouses and factory sheds catering to pharma, auto-components, and FMCG sectors.',
      faqs: [
        { question: 'What is the office rental rate in HITEC City Hyderabad?', answer: 'Grade A office in HITEC City rents at Rs. 60–90/sqft/month. Financial District commands Rs. 80–110/sqft. Gachibowli mid-segment office space is Rs. 50–75/sqft.' },
      ],
    },
    {
      cityName: 'Hyderabad', pageType: 'new_projects' as any, slug: 'new-projects-in-hyderabad', isActive: true,
      h1: 'New Launch Projects in Hyderabad – RERA Residential Projects',
      metaTitle: 'New Projects in Hyderabad | New Launch Flats & Villas | Think4BuySale',
      metaDescription: 'Explore new launch and under-construction apartments in Hyderabad from Aparna, Prestige, My Home, Ramky, and Incor. RERA-registered projects in Kokapet, Kompally, and Adibatla.',
      metaKeywords: 'new projects hyderabad, new launch hyderabad, under construction flats hyderabad, RERA hyderabad, My Home project, Prestige project hyderabad',
      introContent: 'Hyderabad\'s new project market is booming with major launches in Kokapet, Kompally, Adibatla, and Tellapur from leading developers like My Home Group, Aparna Constructions, Ramky Estates, Incor, and Prestige Group.',
      seoContent: 'Kokapet (ORR junction near Financial District) is Hyderabad\'s hottest new launch destination — premium villas and high-rises at Rs. 8,000–12,000/sqft with rapid appreciation potential. Kompally and Suraram in north Hyderabad offer affordable 2 BHK apartments under Rs. 50 lakh.\n\nAdibatla IT corridor is emerging as the next Whitefield — positioned near Infosys DC and TSIIC IT park, new projects here offer 2 BHK at Rs. 40–55 lakh with 3–4 year possession timelines and strong appreciation potential.',
      faqs: [
        { question: 'Which areas in Hyderabad have the best new projects for investment?', answer: 'Kokapet and Financial District for premium (Rs. 8,000–15,000/sqft). Kompally and Bachupally for affordable (Rs. 4,500–6,500/sqft). Adibatla for emerging IT corridor play (Rs. 4,000–5,500/sqft).' },
      ],
    },
    // NOIDA
    {
      cityName: 'Noida', pageType: 'buy' as any, slug: 'buy-property-in-noida', isActive: true,
      h1: 'Buy Property in Noida – Flats, Plots & Commercial Spaces for Sale',
      metaTitle: 'Buy Property in Noida | Flats, Plots for Sale | Think4BuySale',
      metaDescription: 'Buy apartments, plots and commercial properties in Noida. Explore listings in Sector 62, 78, 137, 150, Greater Noida West. RERA-registered builder projects.',
      metaKeywords: 'buy property noida, flats for sale noida, apartment noida, plot noida, sector 62 noida, noida expressway property',
      introContent: 'Noida — part of the dynamic NCR region — is one of North India\'s fastest-growing real estate markets. Well-planned sectors, excellent metro connectivity, proximity to Delhi, and affordable prices make Noida a top choice for home buyers and investors.',
      seoContent: 'Noida\'s real estate market offers a well-planned urban environment with sectors dedicated to residential, commercial, and industrial use. Premium sectors along Noida Expressway (Sector 137, 150, 168) command Rs. 6,000–9,000/sqft for RERA-registered projects with world-class amenities.\n\nKey investment corridors: Noida Expressway (Sector 137–168) for premium projects, Greater Noida West (Noida Extension) for affordable 2 BHK under Rs. 50 lakh, Sector 62–63 for commercial/industrial, and Knowledge Park (Greater Noida) for educational and residential growth.\n\nUpcoming infrastructure — Jewar International Airport (2025), metro extension to Greater Noida West — is expected to drive 20–30% appreciation in peripheral areas over 5 years.',
      faqs: [
        { question: 'What is the property price range in Noida?', answer: 'Noida property prices range from Rs. 3,500/sqft (Greater Noida West) to Rs. 9,000+/sqft (Noida Expressway premium). A 2 BHK in Greater Noida West is Rs. 35–55 lakh; Noida Expressway Rs. 80 lakh–1.5 crore.' },
        { question: 'Is Noida Expressway good for investment?', answer: 'Yes. Noida Expressway sectors (137–168) have shown 40–50% appreciation in 5 years. With Jewar Airport, Film City, and data centre parks planned in the area, long-term appreciation potential is strong.' },
      ],
    },
    {
      cityName: 'Noida', pageType: 'commercial' as any, slug: 'commercial-property-in-noida', isActive: true,
      h1: 'Commercial Properties in Noida – Office Space, Warehouses & Industrial',
      metaTitle: 'Commercial Property in Noida | Office Space, Warehouse | Think4BuySale',
      metaDescription: 'Find commercial office spaces, warehouses, and industrial properties in Noida. IT offices in Sector 62, warehouses in Sector 63, industrial sheds in Phase 2.',
      metaKeywords: 'commercial property noida, office space noida, warehouse noida, sector 62 office, noida industrial area, sector 63 warehouse',
      introContent: 'Noida is a major commercial and industrial hub in the NCR region. Sector 62 is the IT hub, Sector 63 is the primary warehousing and manufacturing zone, and the Expressway corridor offers premium office parks.',
      seoContent: 'Sector 62 Noida hosts offices of HCL, Samsung, Wipro, Adobe, and hundreds of mid-size IT companies. Office rentals range from Rs. 50–90/sqft/month for Grade A space.\n\nSector 63 Noida is a major warehousing cluster — home to KLJ Noida One and similar multi-tenanted warehouse parks offering units from 2,500–60,000 sqft at Rs. 18–40/sqft/month. The sector has excellent connectivity via Noida-Greater Noida Expressway and NH-9.',
      faqs: [
        { question: 'What is the warehouse rental rate in Noida Sector 63?', answer: 'Warehouse space in Noida Sector 63 rents at Rs. 18–40/sqft/month depending on size and specifications. Small units (2,500–5,000 sqft) command a premium (Rs. 30–40/sqft) while large units (20,000+ sqft) are available at Rs. 18–25/sqft.' },
      ],
    },
    // GURGAON
    {
      cityName: 'Gurgaon', pageType: 'buy' as any, slug: 'buy-property-in-gurgaon', isActive: true,
      h1: 'Buy Property in Gurgaon – Luxury Apartments, Villas & Commercial Spaces',
      metaTitle: 'Buy Property in Gurgaon | Apartments, Villas for Sale | Think4BuySale',
      metaDescription: 'Buy luxury apartments, villas, and commercial spaces in Gurgaon. Explore listings in DLF City, Sohna Road, Golf Course Road, Dwarka Expressway, and New Gurgaon.',
      metaKeywords: 'buy property gurgaon, apartments gurgaon, DLF City gurgaon, Golf Course Road property, Dwarka Expressway apartment, luxury villa gurgaon',
      introContent: 'Gurgaon — India\'s millennium city — is the NCR\'s premium residential and commercial destination. Think4BuySale lists high-rise luxury apartments, villas, and commercial spaces across Golf Course Road, DLF City, Sohna Road, and Dwarka Expressway.',
      seoContent: 'Gurgaon\'s real estate market is driven by the concentration of Fortune 500 companies and their high-earning workforce. Golf Course Road and Golf Course Extension (Sectors 55–58) are India\'s most premium residential addresses outside South Mumbai, with apartments at Rs. 15,000–25,000/sqft.\n\nDwarka Expressway (Sectors 99–115) has emerged as a complete township zone with affordable mid-segment projects (Rs. 6,000–10,000/sqft). Sohna Road offers budget-friendly options (Rs. 4,500–7,000/sqft) with good connectivity.\n\nNew Gurgaon (Sectors 37D, 58A, 81–95) is the next growth corridor with excellent infrastructure and competitive pricing.',
      faqs: [
        { question: 'What is the property price range in Gurgaon?', answer: 'Gurgaon property prices range from Rs. 4,500/sqft (Sohna, New Gurgaon periphery) to Rs. 25,000+/sqft (Golf Course Road premium). A 2 BHK on Sohna Road costs Rs. 55–80 lakh; Golf Course Extension Rs. 1.5–3 crore.' },
      ],
    },
    {
      cityName: 'Gurgaon', pageType: 'commercial' as any, slug: 'commercial-property-in-gurgaon', isActive: true,
      h1: 'Commercial Properties in Gurgaon – Cyber City, Golf Course Road Offices',
      metaTitle: 'Commercial Property in Gurgaon | Cyber City, DLF Office Space | Think4BuySale',
      metaDescription: 'Find commercial office spaces in Gurgaon — Cyber City, Golf Course Road, Udyog Vihar, and Manesar. India\'s top MNC destination. Grade A offices and co-working spaces.',
      metaKeywords: 'commercial property gurgaon, Cyber City office gurgaon, DLF office gurgaon, Golf Course Road commercial, Udyog Vihar gurgaon office, Manesar industrial',
      introContent: 'Gurgaon is India\'s top corporate office destination with Cyber City and Cyber Hub hosting hundreds of MNCs including Google, Amazon, Microsoft, Deloitte, and KPMG. Think4BuySale lists Grade A offices, co-working spaces, and retail spaces across Gurgaon\'s prime commercial corridors.',
      seoContent: 'Cyber City Gurgaon is among Asia\'s largest planned business districts — over 30 million sqft of Grade A office space. Office rentals here are Rs. 120–180/sqft/month. Golf Course Road extension offers premium office parks at Rs. 100–150/sqft.\n\nManesar, Gurgaon\'s industrial zone (NH-8 beyond Kherki Daula toll), hosts Maruti Suzuki\'s manufacturing plant and thousands of auto-component, electronics, and pharmaceutical manufacturers. Manesar industrial property rentals: Rs. 15–25/sqft/month for factory sheds.',
      faqs: [
        { question: 'What is the office rental rate in Cyber City Gurgaon?', answer: 'Cyber City Grade A office space rents at Rs. 120–180/sqft/month. Golf Course Road is Rs. 100–150/sqft. Udyog Vihar (older commercial zone) offers Rs. 60–90/sqft. Co-working spaces range from Rs. 7,000–15,000 per seat per month.' },
      ],
    },
    // PUNE
    {
      cityName: 'Pune', pageType: 'buy' as any, slug: 'buy-property-in-pune', isActive: true,
      h1: 'Buy Property in Pune – Apartments, Villas & Plots for Sale',
      metaTitle: 'Buy Property in Pune | Flats, Apartments for Sale | Think4BuySale',
      metaDescription: 'Buy apartments, villas and plots in Pune. Explore listings in Hinjewadi, Kothrud, Baner, Wakad, Viman Nagar, Hadapsar, and Kharadi.',
      metaKeywords: 'buy property pune, flats for sale pune, apartments pune, hinjewadi property, baner flat, kothrud apartment, viman nagar property',
      introContent: 'Pune — Maharashtra\'s cultural and educational capital — offers a vibrant real estate market driven by its large IT sector, defence presence, and automotive industry. Think4BuySale lists 3,000+ verified properties across Hinjewadi, Baner, Wakad, Kothrud, and Hadapsar.',
      seoContent: 'Pune\'s real estate market is characterised by strong end-user demand from IT professionals (Hinjewadi, Kharadi, Hadapsar belt), defence personnel (Aundh, NIBM Road), and students/academics (Kothrud, Deccan area).\n\nProperty prices: Hinjewadi IT park belt Rs. 5,500–8,500/sqft; Baner/Pashan Rs. 7,000–10,000/sqft; Kothrud Rs. 8,000–12,000/sqft (premium locality); Hadapsar and Magarpatta Rs. 6,000–9,000/sqft. Affordable options: Wagholi, Undri, Pisoli (Rs. 3,500–5,500/sqft).\n\nPune\'s upcoming metro (Phase 1 operational, Phase 2 to Hinjewadi underway) is expected to significantly boost property values along the metro corridors.',
      faqs: [
        { question: 'What is the property price range in Pune?', answer: 'Pune property prices range from Rs. 3,500/sqft (Wagholi, Undri) to Rs. 12,000+/sqft (Kothrud, Boat Club Road premium). A 2 BHK in Hinjewadi costs Rs. 55–80 lakh; Baner Rs. 70–1 crore.' },
      ],
    },
    {
      cityName: 'Pune', pageType: 'rent' as any, slug: 'rent-property-in-pune', isActive: true,
      h1: 'Rent Property in Pune – Apartments & Flats Near IT Parks',
      metaTitle: 'Rent Property in Pune | Flats, Apartments for Rent | Think4BuySale',
      metaDescription: 'Rent furnished and unfurnished apartments in Pune near Hinjewadi, Baner, Kharadi, Hadapsar, and Viman Nagar. Direct owner listings, best rental deals.',
      metaKeywords: 'rent property pune, flats for rent pune, apartment rent pune, hinjewadi rent, baner flat rent, kharadi apartment, viman nagar rental',
      introContent: 'Find rental homes in Pune with Think4BuySale. From Rs. 12,000/month 1 BHK apartments in Hadapsar to Rs. 45,000/month premium flats in Koregaon Park — browse 2,500+ verified rental listings.',
      seoContent: 'Pune\'s rental market is driven by IT professionals in Hinjewadi and Kharadi, students in Kothrud and Deccan, and corporate employees in Baner and Aundh. Monthly rentals: 1 BHK in Hinjewadi Rs. 12,000–18,000; Baner Rs. 18,000–28,000; Kothrud Rs. 20,000–30,000. 2 BHK in Wakad Rs. 18,000–25,000.',
      faqs: [
        { question: 'What is the average rent in Pune?', answer: '1 BHK in Hadapsar: Rs. 11,000–16,000/month. 2 BHK in Baner: Rs. 22,000–32,000/month. 3 BHK in Koregaon Park: Rs. 40,000–60,000/month. Pune rents are 25–35% lower than Bangalore.' },
      ],
    },
    // CHENNAI
    {
      cityName: 'Chennai', pageType: 'buy' as any, slug: 'buy-property-in-chennai', isActive: true,
      h1: 'Buy Property in Chennai – Apartments, Villas & Plots for Sale',
      metaTitle: 'Buy Property in Chennai | Flats, Villas for Sale | Think4BuySale',
      metaDescription: 'Buy apartments, villas, and plots in Chennai. Explore listings in OMR, ECR, Porur, Velachery, Perambur, Sholinganallur, and Anna Nagar.',
      metaKeywords: 'buy property chennai, flats for sale chennai, apartments chennai, OMR property, ECR villa, Velachery flat, Anna Nagar apartment',
      introContent: 'Chennai — South India\'s industrial and cultural capital — offers a stable, value-driven real estate market. Think4BuySale lists 2,500+ verified properties along the Old Mahabalipuram Road (OMR) IT corridor, East Coast Road (ECR), and across all major Chennai localities.',
      seoContent: 'Chennai\'s real estate market is characterised by strong end-user demand and conservative appreciation — making it a stable investment destination. Property prices on OMR IT corridor (Sholinganallur to Perungudi) range from Rs. 5,500–8,500/sqft.\n\nKey investment areas: OMR (IT professionals, strong rental demand), ECR (premium villas and farmhouses), Porur (IT hub near Ramapuram), Perambur and Kolathur (affordable, mid-segment), and suburban corridors like Poonamallee and Tambaram for budget buyers.\n\nChennai\'s new infrastructure — Phase 2 metro extension, SIPCOT IT Park Phase 3 — is expected to drive appreciation in South and West Chennai corridors.',
      faqs: [
        { question: 'What is the property price range in Chennai?', answer: 'Chennai property prices range from Rs. 3,000/sqft (Poonamallee, Tambaram) to Rs. 10,000+/sqft (Anna Nagar, Nungambakkam premium). OMR IT corridor: Rs. 5,500–8,000/sqft. A 2 BHK on OMR costs Rs. 55–80 lakh.' },
      ],
    },
    // KOLKATA
    {
      cityName: 'Kolkata', pageType: 'buy' as any, slug: 'buy-property-in-kolkata', isActive: true,
      h1: 'Buy Property in Kolkata – Flats, Villas & Plots for Sale',
      metaTitle: 'Buy Property in Kolkata | Flats, Apartments for Sale | Think4BuySale',
      metaDescription: 'Buy apartments, villas and plots in Kolkata. Explore listings in New Town, Rajarhat, Salt Lake, Park Street, Behala, and Tollygunge.',
      metaKeywords: 'buy property kolkata, flats for sale kolkata, apartments kolkata, New Town property, Rajarhat flat, Salt Lake apartment',
      introContent: 'Kolkata offers some of India\'s most affordable property prices in a metro city, making it attractive for both home buyers and investors. Think4BuySale lists 2,000+ verified properties in New Town/Rajarhat, Salt Lake, and across Kolkata\'s established localities.',
      seoContent: 'Kolkata\'s real estate market is emerging from a long period of stability into a growth phase, driven by IT investment in Sector V and New Town, improved metro connectivity, and the Kolkata Leather Complex near Bantala.\n\nProperty prices: New Town/Rajarhat Rs. 4,500–7,000/sqft; Salt Lake Rs. 6,000–9,000/sqft; Park Street area Rs. 12,000+/sqft. Affordable options: Behala, Tollygunge, and Jadavpur offer 2 BHK flats at Rs. 30–50 lakh. Kolkata offers the best value among all Indian metros for residential investment.',
      faqs: [
        { question: 'What is the property price range in Kolkata?', answer: 'Kolkata property prices range from Rs. 3,000/sqft (Barasat, Narendrapur) to Rs. 12,000+/sqft (Park Street, Elgin Road). New Town/Rajarhat 2 BHK costs Rs. 35–60 lakh — among the most affordable in India\'s metros.' },
      ],
    },
    // AHMEDABAD
    {
      cityName: 'Ahmedabad', pageType: 'buy' as any, slug: 'buy-property-in-ahmedabad', isActive: true,
      h1: 'Buy Property in Ahmedabad – Apartments, Villas & Commercial',
      metaTitle: 'Buy Property in Ahmedabad | Flats, Villas for Sale | Think4BuySale',
      metaDescription: 'Buy apartments, villas and plots in Ahmedabad. Explore listings in SG Highway, Bopal, Thaltej, Prahlad Nagar, Chandkheda, and Naroda.',
      metaKeywords: 'buy property ahmedabad, flats for sale ahmedabad, SG Highway property, Bopal apartment, Thaltej flat, Prahlad Nagar property',
      introContent: 'Ahmedabad — Gujarat\'s commercial capital and one of India\'s fastest-growing cities — offers excellent real estate value. Think4BuySale lists verified properties along SG Highway, Bopal, Thaltej, and across the city\'s well-planned localities.',
      seoContent: 'Ahmedabad\'s real estate market is driven by its robust industrial economy, textile and diamond trading communities, and rapidly expanding IT/pharma sectors. SG Highway and the Western suburbs (Bopal, South Bopal, Shilaj) are the premium residential corridors with apartments at Rs. 5,500–9,000/sqft.\n\nAhmedabad GIFT City (Global Finance and IT hub, just outside Ahmedabad near Gandhinagar) is India\'s first operational smart city with special economic zones — a major driver for premium residential demand in the North Ahmedabad/Gandhinagar belt.',
      faqs: [
        { question: 'What is the property price range in Ahmedabad?', answer: 'Ahmedabad property prices range from Rs. 3,000/sqft (Naroda, Vatva industrial area) to Rs. 8,000+/sqft (SG Highway premium, Prahlad Nagar). A 2 BHK in Bopal costs Rs. 45–65 lakh.' },
      ],
    },
  ];

  await cityPageRepo.save(cityPages.map(cp => cityPageRepo.create(cp)));
  console.log(`City SEO pages seeded: ${cityPages.length} entries`);

  await dataSource.destroy();
  console.log('\nSeeding complete!');
  console.log('─────────────────────────────────────────');
  console.log('Accounts:');
  console.log('  Admin   -> admin@realestate.com / Admin@123');
  console.log('  Seller  -> seller@example.com   / Seller@123');
  console.log('  Seller2 -> seller2@example.com  / Seller2@123');
  console.log('  Seller3 -> seller3@example.com  / Seller3@123');
  console.log('  Agent1  -> agent1@example.com   / Agent1@123  (Gold Tick)');
  console.log('  Agent2  -> agent2@example.com   / Agent2@123  (Blue Tick)');
  console.log('  Agent3  -> agent3@example.com   / Agent3@123  (Diamond Tick)');
  console.log('  Agent4  -> agent4@example.com   / Agent4@123  (Gold Tick)');
  console.log('─────────────────────────────────────────');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
