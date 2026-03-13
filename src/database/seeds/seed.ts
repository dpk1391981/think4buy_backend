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
} from '../../modules/properties/entities/property.entity';
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

console.log("DB USER:", process.env.DB_USERNAME);

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'dpk1391981',
  password: process.env.DB_PASSWORD || 'Dpk1391981!',
  database: process.env.DB_NAME || 'realestate_db',
  entities: [User, Amenity, Property, PropertyImage, Location, Inquiry, ServiceCatalog, Wallet, WalletTransaction, BoostPlan, SubscriptionPlan, State, City, Country, PropCategory, PropType, PropTypeAmenity, PropTypeField, CategoryAnalytics, FooterSeoLink, FooterSeoLinkGroup, SeoConfig],
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
    'property_amenities', 'property_images', 'inquiries', 'properties',
    'services_catalog', 'locations', 'wallet_transactions', 'wallets',
    'boost_plans', 'subscription_plans', 'cities', 'states', 'countries', 'users', 'amenities',
    'category_analytics', 'footer_seo_links', 'footer_seo_link_groups', 'seo_configs',
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
  const seller = await userRepo.save({ name: 'Rajesh Kumar', email: 'seller@example.com', phone: '9876543210', password: await bcrypt.hash('Seller@123', 10), role: UserRole.SELLER, city: 'Mumbai', state: 'Maharashtra', isVerified: true });
  const seller2 = await userRepo.save({ name: 'Priya Sharma', email: 'seller2@example.com', phone: '9845123456', password: await bcrypt.hash('Seller2@123', 10), role: UserRole.SELLER, city: 'Bangalore', state: 'Karnataka', isVerified: true });
  const seller3 = await userRepo.save({ name: 'Mohammed Aziz', email: 'seller3@example.com', phone: '9712345678', password: await bcrypt.hash('Seller3@123', 10), role: UserRole.SELLER, city: 'Hyderabad', state: 'Telangana', isVerified: true });
  const agent1 = await userRepo.save({ name: 'Amit Verma', email: 'agent1@example.com', phone: '9811223344', password: await bcrypt.hash('Agent1@123', 10), role: UserRole.AGENT, city: 'Mumbai', state: 'Maharashtra', company: 'PropElite Realty', isVerified: true, agentLicense: 'MH-RERA-A12345', agentBio: 'Senior consultant with 12 years in Mumbai luxury residential and commercial. Expert in Bandra, Juhu, Powai.', agentExperience: 12, agentRating: 4.8, totalDeals: 340, agentTick: 'gold' });
  const agent2 = await userRepo.save({ name: 'Sunita Nair', email: 'agent2@example.com', phone: '9988776655', password: await bcrypt.hash('Agent2@123', 10), role: UserRole.AGENT, city: 'Bangalore', state: 'Karnataka', company: 'HomeFirst Properties', isVerified: true, agentLicense: 'KA-RERA-B67890', agentBio: 'Top-performing agent in Bangalore tech corridors. Expert in Whitefield, Koramangala, HSR Layout.', agentExperience: 8, agentRating: 4.6, totalDeals: 215, agentTick: 'blue' });
  const agent3 = await userRepo.save({ name: 'Vikram Singh', email: 'agent3@example.com', phone: '9776655443', password: await bcrypt.hash('Agent3@123', 10), role: UserRole.AGENT, city: 'Delhi', state: 'Delhi', company: 'Capital Estates', isVerified: true, agentLicense: 'DL-RERA-C11223', agentBio: 'NCR specialist covering Delhi, Gurgaon and Noida. 15 years expertise in luxury villas and commercial.', agentExperience: 15, agentRating: 4.9, totalDeals: 480, agentTick: 'diamond' });
  const agent4 = await userRepo.save({ name: 'Deepa Menon', email: 'agent4@example.com', phone: '9944332211', password: await bcrypt.hash('Agent4@123', 10), role: UserRole.AGENT, city: 'Hyderabad', state: 'Telangana', company: 'Saffron Realty', isVerified: true, agentLicense: 'TS-RERA-D44556', agentBio: 'Hyderabad specialist with 10 years. Expert in Gachibowli, Kondapur, and HITEC City. Helped 300+ IT professionals.', agentExperience: 10, agentRating: 4.7, totalDeals: 298, agentTick: 'gold' });

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
  await cityRepo.save([
    { name: 'Mumbai',    stateId: mh.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?w=600&q=80', slug: 'mumbai', h1: 'Property in Mumbai', metaTitle: 'Buy & Rent Property in Mumbai - Think4BuySale', metaDescription: 'Find the best apartments, villas and plots for sale and rent in Mumbai. Explore Bandra, Powai, Andheri, Juhu and more.', metaKeywords: 'buy property mumbai, rent flat mumbai, mumbai real estate, apartments in mumbai', introContent: 'Mumbai is India\'s financial capital and one of the most sought-after real estate markets in the country. From luxury sea-facing apartments in Bandra to affordable housing in the suburbs, Mumbai offers properties for every budget.' },
    { name: 'Pune',      stateId: mh.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1545809074-59472b3f5ecc?w=600&q=80', slug: 'pune', h1: 'Property in Pune', metaTitle: 'Buy & Rent Property in Pune - Think4BuySale', metaDescription: 'Explore properties for sale and rent in Pune. Find apartments in Baner, Viman Nagar, Kothrud and more.', metaKeywords: 'buy property pune, rent flat pune, pune real estate, apartments baner' },
    { name: 'Nagpur',    stateId: mh.id, isActive: true, isFeatured: false, slug: 'nagpur' },
    { name: 'Bangalore', stateId: ka.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&q=80', slug: 'bangalore', h1: 'Property in Bangalore', metaTitle: 'Buy & Rent Property in Bangalore - Think4BuySale', metaDescription: 'Discover apartments, villas and plots in Bangalore. Browse listings in Whitefield, Koramangala, Indiranagar, HSR Layout and more.', metaKeywords: 'buy property bangalore, rent flat bangalore, bangalore apartments, whitefield property', introContent: 'Bangalore (Bengaluru) is India\'s IT capital and one of the fastest-growing real estate markets. From tech corridors in Whitefield to upscale localities in Koramangala, the city offers diverse property options.' },
    { name: 'Mysore',    stateId: ka.id, isActive: true, isFeatured: false, slug: 'mysore' },
    { name: 'Delhi',     stateId: dl.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&q=80', slug: 'delhi', h1: 'Property in Delhi', metaTitle: 'Buy & Rent Property in Delhi - Think4BuySale', metaDescription: 'Find properties for sale and rent in Delhi. Explore listings in Greater Kailash, Vasant Kunj, Dwarka, Saket and more.', metaKeywords: 'buy property delhi, rent flat delhi, delhi apartments, south delhi property' },
    { name: 'Gurgaon',   stateId: hr.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&q=80', slug: 'gurgaon', h1: 'Property in Gurgaon', metaTitle: 'Buy & Rent Property in Gurgaon - Think4BuySale', metaDescription: 'Explore luxury apartments, villas and commercial spaces in Gurgaon. Browse DLF Phase, Sohna Road, Golf Course Road.', metaKeywords: 'buy property gurgaon, rent flat gurgaon, gurgaon apartments, dlf gurgaon' },
    { name: 'Noida',     stateId: up.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&q=80', slug: 'noida', h1: 'Property in Noida', metaTitle: 'Buy & Rent Property in Noida - Think4BuySale', metaDescription: 'Find affordable and premium properties in Noida. Browse listings in Sector 62, 137, 150 and more.', metaKeywords: 'buy property noida, rent flat noida, noida sector 62, noida extension flats' },
    { name: 'Ghaziabad', stateId: up.id, isActive: true, isFeatured: true,  slug: 'ghaziabad' },
    { name: 'Lucknow',   stateId: up.id, isActive: true, isFeatured: false, slug: 'lucknow', h1: 'Property in Lucknow', metaTitle: 'Buy & Rent Property in Lucknow - Think4BuySale', metaDescription: 'Find the best properties in Lucknow. Explore Gomti Nagar, Aliganj, Hazratganj and more.', metaKeywords: 'buy property lucknow, rent flat lucknow, lucknow real estate, gomti nagar property' },
    { name: 'Chennai',   stateId: tn.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&q=80', slug: 'chennai', h1: 'Property in Chennai', metaTitle: 'Buy & Rent Property in Chennai - Think4BuySale', metaDescription: 'Discover properties for sale and rent in Chennai. Explore Anna Nagar, OMR, T Nagar, Velachery and more.', metaKeywords: 'buy property chennai, rent flat chennai, anna nagar property, omr apartments' },
    { name: 'Hyderabad', stateId: ts.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1572445373025-8b4b3ab7dd21?w=600&q=80', slug: 'hyderabad', h1: 'Property in Hyderabad', metaTitle: 'Buy & Rent Property in Hyderabad - Think4BuySale', metaDescription: 'Find apartments and villas in Hyderabad. Browse Gachibowli, Kondapur, HITEC City, Banjara Hills listings.', metaKeywords: 'buy property hyderabad, rent flat hyderabad, gachibowli apartments, hitec city property' },
    { name: 'Ahmedabad', stateId: gj.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1558618047-f4e90ae6e13e?w=600&q=80', slug: 'ahmedabad', h1: 'Property in Ahmedabad', metaTitle: 'Buy & Rent Property in Ahmedabad - Think4BuySale', metaDescription: 'Explore properties in Ahmedabad. Find listings in Prahlad Nagar, SG Highway, Bopal and more.', metaKeywords: 'buy property ahmedabad, rent flat ahmedabad, sg highway property, prahlad nagar apartments' },
    { name: 'Surat',     stateId: gj.id, isActive: true, isFeatured: false, slug: 'surat' },
    { name: 'Jaipur',    stateId: rj.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600&q=80', slug: 'jaipur', h1: 'Property in Jaipur', metaTitle: 'Buy & Rent Property in Jaipur - Think4BuySale', metaDescription: 'Find properties in Jaipur — the Pink City. Explore Vaishali Nagar, Malviya Nagar, Mansarovar listings.', metaKeywords: 'buy property jaipur, rent flat jaipur, vaishali nagar property, jaipur real estate' },
    { name: 'Kolkata',   stateId: wb.id, isActive: true, isFeatured: true,  imageUrl: 'https://images.unsplash.com/photo-1558431382-27e303142255?w=600&q=80', slug: 'kolkata', h1: 'Property in Kolkata', metaTitle: 'Buy & Rent Property in Kolkata - Think4BuySale', metaDescription: 'Discover properties in Kolkata. Browse Salt Lake, New Town, Park Street and other prime localities.', metaKeywords: 'buy property kolkata, rent flat kolkata, salt lake property, new town apartments' },
    { name: 'Kochi',     stateId: kl.id, isActive: true, isFeatured: false, slug: 'kochi', h1: 'Property in Kochi', metaTitle: 'Buy & Rent Property in Kochi - Think4BuySale', metaDescription: 'Find flats and villas in Kochi. Explore Kakkanad, Edapally, Marine Drive and more.', metaKeywords: 'buy property kochi, rent flat kochi, kakkanad apartments, kochi real estate' },
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
      slug: `apartment-${c.locality.toLowerCase().replace(/\s+/g, '-')}-${i + 58}`,
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

  console.log('All properties seeded successfully');

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
    { name: 'Buy',           slug: 'buy',            icon: '🏠', description: 'Properties for outright purchase',           status: true, sortOrder: 1 },
    { name: 'Rent',          slug: 'rent',           icon: '🔑', description: 'Properties available for rent',              status: true, sortOrder: 2 },
    { name: 'PG / Co-Living',slug: 'pg',             icon: '🛏️', description: 'PG accommodations and co-living spaces',      status: true, sortOrder: 3 },
    { name: 'Commercial',    slug: 'commercial',     icon: '🏢', description: 'Offices, shops, warehouses, showrooms',       status: true, sortOrder: 4 },
    { name: 'Industrial',    slug: 'industrial',     icon: '🏭', description: 'Factories, sheds, industrial plots',          status: true, sortOrder: 5 },
    { name: 'New Projects',  slug: 'builder_project',icon: '🏗️', description: 'Under-construction builder projects',         status: true, sortOrder: 6 },
    { name: 'Investment',    slug: 'investment',     icon: '📈', description: 'High-yield investment properties',            status: true, sortOrder: 7 },
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
  const [office, shop, showroom] = await typeRepo.save([
    { name: 'Office Space',      slug: 'commercial_office', icon: '💼', categoryId: comCat.id, status: true, sortOrder: 1 },
    { name: 'Shop / Showroom',   slug: 'commercial_shop',   icon: '🏪', categoryId: comCat.id, status: true, sortOrder: 2 },
    { name: 'Showroom',          slug: 'showroom',          icon: '🏪', categoryId: comCat.id, status: true, sortOrder: 3 },
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
  await mapAmenities(office.id,      [lift, parking, security, power, wifi, water]);
  await mapAmenities(shop.id,        [parking, security, power]);
  await mapAmenities(showroom.id,    [parking, security, power, lift]);
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
      { propertyType: 'apartment',         label: 'Apartments',    icon: '🏢', totalListings: 8,  totalViews: 2900 },
      { propertyType: 'villa',             label: 'Villas',        icon: '🏡', totalListings: 1,  totalViews: 2340 },
      { propertyType: 'commercial_shop',   label: 'Retail Shops',  icon: '🏪', totalListings: 1,  totalViews: 4500 },
      { propertyType: 'builder_floor',     label: 'Builder Floors',icon: '🏗️', totalListings: 1,  totalViews: 1680 },
      { propertyType: 'farm_house',        label: 'Farm Houses',   icon: '🌾', totalListings: 1,  totalViews: 3450 },
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
        { propertyType: 'commercial_shop',   label: 'Retail Shops',  icon: '🏪', totalListings: 1,  totalViews: 4500 },
        { propertyType: 'farm_house',        label: 'Farm Houses',   icon: '🌾', totalListings: 1,  totalViews: 3450 },
        { propertyType: 'apartment',         label: 'Apartments',    icon: '🏢', totalListings: 6,  totalViews: 2100 },
        { propertyType: 'villa',             label: 'Villas',        icon: '🏡', totalListings: 1,  totalViews: 2340 },
        { propertyType: 'builder_floor',     label: 'Builder Floors',icon: '🏗️', totalListings: 1,  totalViews: 1680 },
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
        { propertyType: 'apartment',         label: 'Apartments',    icon: '🏢', totalListings: 5,  totalViews: 1800 },
        { propertyType: 'commercial_office', label: 'Office Spaces', icon: '🏢', totalListings: 1,  totalViews: 890  },
        { propertyType: 'plot',              label: 'Plots / Land',  icon: '📐', totalListings: 1,  totalViews: 1340 },
        { propertyType: 'factory',           label: 'Factories',     icon: '🏭', totalListings: 1,  totalViews: 980  },
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
  console.log('Footer SEO links seeded');

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
