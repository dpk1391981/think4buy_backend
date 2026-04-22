/**
 * seed-quick-seo-templates.ts
 *
 * Content sourced word-for-word from:
 *   backend/templates/Property for Sale in Ahmedabad.docx        → City Category
 *   backend/templates/Property for Sale in Ahmedabad Localty.docx → City Locality Category
 *   Agent templates use same structure adapted for agents.
 *
 * Run:
 *   npm run seed:quick-seo-templates
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { DataSource } from 'typeorm';

const ds = new DataSource({
  type:        'mysql',
  host:        process.env.DB_HOST     || 'localhost',
  port:        Number(process.env.DB_PORT) || 3306,
  username:    process.env.DB_USERNAME || 'root',
  password:    process.env.DB_PASSWORD || '',
  database:    process.env.DB_NAME     || 'realestate_db',
  synchronize: false,
  logging:     false,
});

// ── City Category (word-for-word from Property for Sale in Ahmedabad.docx) ────

const CITY_META_TITLE       = 'Property for Sale in {city} | Verified Listings | Think4buysale.in';
const CITY_META_DESCRIPTION = 'Explore property for sale in {city} with price, verified listings, and zero brokerage options. Find flats, houses, and best deals today.';
const CITY_H1               = 'Property for Sale in {city}';

const CITY_INTRO = `<h2>Quick Answer: Why Buy Flat in {city}?</h2><p><strong>{city} is one of India's fastest-growing real estate markets, offering affordable pricing, strong infrastructure, and high ROI potential.</strong> With expanding metro connectivity, industrial growth, and modern housing projects, buying a <strong>property for sale in {city}</strong> ensures long-term value, rental income opportunities, and a comfortable lifestyle at competitive prices compared to other metro cities.</p><h2>Key Highlights</h2><ul><li><strong>Price Range:</strong> ₹25 Lakhs – ₹2.5 Crore+</li><li><strong>Investment Potential:</strong> High due to rapid urban development and demand</li><li><strong>Property Types:</strong> Apartments, villas, independent houses</li><li><strong>Buyer Options:</strong> Owner property in {city}, zero brokerage flats, verified listings</li></ul><h2>Introduction</h2><p>If you are searching for the <strong>best property for sale in {city}</strong>, you are making a smart investment decision. {city} has become a top destination for homebuyers due to its affordable housing, strong job market, and improving infrastructure. From modern apartments to independent homes, the city offers options for every budget.</p><p><strong>Think4BuySale.in</strong> is a trusted platform where you can explore <strong>{city} property listing</strong> options with complete transparency. Whether you want to <strong>buy flat in {city}</strong>, search for <strong>owner property in {city}</strong>, or find <strong>verified property in {city}</strong>, our platform helps you connect directly with sellers and agents easily.</p>`;

const CITY_BOTTOM = `<h2>Why Buy a Flat in {city}?</h2><p><strong>{city} is a real estate hotspot</strong> due to its balanced combination of affordability and growth. The city offers excellent infrastructure, business opportunities, and lifestyle benefits.</p><ul><li><strong>Affordable Pricing:</strong> Compared to metro cities like Mumbai or Bangalore</li><li><strong>Strong Infrastructure:</strong> Metro rail, highways, and smart city projects</li><li><strong>Job Opportunities:</strong> IT hubs, textile industry, and startups</li><li><strong>High ROI:</strong> Growing demand for apartments in {city}</li><li><strong>Quality Lifestyle:</strong> Schools, hospitals, malls, and entertainment</li></ul><p><strong>Is {city} good for property investment?</strong><br>Yes, {city} is one of the best cities for property investment due to its steady price appreciation, infrastructure development, and increasing housing demand.</p><h2>Types of Property Listings Available</h2><ul><li><strong>Owner Properties:</strong> Direct deals with owners, no middleman</li><li><strong>Zero Brokerage Flats in {city}:</strong> Save extra costs</li><li><strong>Agent Listed Properties:</strong> Wide range of options</li><li><strong>Verified Property in {city}:</strong> Trusted and checked listings</li></ul><h2>Budget-Based Property Options</h2><h3>Low Budget Flats</h3><p>Budget-friendly <strong>flats in {city} for sale</strong> start from ₹20–40 Lakhs in areas like Narol, Vatva, and Chandkheda.</p><h3>Mid-Range Properties</h3><p>₹40–90 Lakhs range offers spacious <strong>{city} apartments for sale</strong> in Bopal, Gota, and New Ranip.</p><h3>High Budget Luxury Flats</h3><p>Luxury <strong>apartments in {city}</strong> range from ₹1 Crore to ₹3 Crore+ in premium areas like Satellite and SG Highway.</p><h2>Popular Areas in {city} for Buying Flats</h2><ul><li><strong>SG Highway:</strong> Premium residential and commercial hub</li><li><strong>Bopal:</strong> Affordable yet modern housing options</li><li><strong>Satellite:</strong> High-end residential locality</li><li><strong>Gota:</strong> Fast-growing investment area</li><li><strong>Chandkheda:</strong> Ideal for families and working professionals</li></ul><h2>Price Trends & Investment Insights</h2><p>The <strong>{city} property for sale with price</strong> varies based on location and amenities. Here is a general price trend:</p><ul><li><strong>Affordable Areas:</strong> ₹2,500 – ₹4,000 per sq. ft.</li><li><strong>Mid-Range Areas:</strong> ₹4,000 – ₹6,500 per sq. ft.</li><li><strong>Premium Areas:</strong> ₹6,500 – ₹10,000+ per sq. ft.</li></ul><p>Over the last 5 years, {city} has shown a steady growth of 5–8% annually, making it a safe and profitable investment choice.</p><h2>Pros and Cons of Buying in {city}</h2><table border="1" cellpadding="10"><tr><th>Pros</th><th>Cons</th></tr><tr><td>Affordable housing options</td><td>Traffic congestion in some areas</td></tr><tr><td>Strong infrastructure growth</td><td>Limited nightlife compared to metro cities</td></tr><tr><td>High return on investment</td><td>Rapid urbanization challenges</td></tr><tr><td>Wide range of property options</td><td>Price variation across locations</td></tr></table><h2>Step-by-Step Guide to Buy Flat in {city}</h2><ol><li><strong>Define Budget:</strong> Decide your investment range</li><li><strong>Choose Location:</strong> Select based on work and lifestyle</li><li><strong>Search Listings:</strong> Explore <strong>{city} property listing</strong></li><li><strong>Verify Property:</strong> Check documents and approvals</li><li><strong>Visit Site:</strong> Inspect the property physically</li><li><strong>Negotiate Price:</strong> Get the best deal</li><li><strong>Finalize Loan:</strong> Apply for home loan if needed</li><li><strong>Complete Registration:</strong> Legal ownership transfer</li></ol><h2>Why Choose Think4BuySale.in?</h2><ul><li><strong>Verified Listings:</strong> Trusted and authentic properties</li><li><strong>Direct Owner Contact:</strong> No hidden charges</li><li><strong>Zero Brokerage Options:</strong> Save money</li><li><strong>User-Friendly Platform:</strong> Easy search and filters</li><li><strong>Wide Range:</strong> From budget to luxury homes</li></ul><h2>List Your Property for Free</h2><p>Do you want to sell your <strong>property in {city}</strong>? Think4BuySale.in allows you to list your property easily.</p><ul><li>Post property in minutes</li><li>Reach thousands of buyers</li><li>Connect directly with interested buyers</li><li>Increase visibility without cost</li></ul><p><strong>Process:</strong> Sign up → Add property details → Upload images → Publish listing → Get leads</p><h2>Conclusion</h2><p><strong>Property for sale in {city}</strong> offers an excellent opportunity for homebuyers and investors looking for affordability, growth, and long-term returns. With a wide range of options from budget flats to luxury homes, {city} continues to be a preferred real estate destination.</p><p>Explore the best <strong>{city} apartments for sale</strong> today on <strong>Think4BuySale.in</strong> and find your perfect home. Start your property search now and connect directly with owners and verified sellers for the best deals.</p>`;

const CITY_FAQS = [
  { question: 'What is the price of flats in {city}?',         answer: 'The price of <strong>flats in {city} for sale</strong> typically ranges from ₹20 Lakhs to ₹2.5 Crore depending on location, amenities, and property type. Affordable areas offer lower rates, while premium locations like SG Highway have higher pricing.' },
  { question: 'Is {city} good for property investment?',       answer: 'Yes, {city} offers strong investment potential due to steady growth, affordable pricing, and infrastructure development. It is ideal for both end-users and investors looking for long-term appreciation.' },
  { question: 'Can I find owner property in {city}?',          answer: 'Yes, you can easily find <strong>owner property in {city}</strong> on Think4BuySale.in. This helps you avoid brokerage charges and deal directly with property owners for better pricing.' },
  { question: 'Are zero brokerage flats available in {city}?', answer: 'Yes, many <strong>zero brokerage flats in {city}</strong> are available, especially direct owner listings. These properties help buyers save extra costs and simplify the buying process.' },
  { question: 'How to find verified property in {city}?',      answer: 'You can find <strong>verified property in {city}</strong> on trusted platforms like Think4BuySale.in. Always check property documents, approvals, and ownership details before finalizing the deal.' },
];

// ── City Locality Category (word-for-word from Property for Sale in Ahmedabad Localty.docx) ──

const LOCALITY_META_TITLE       = 'Property for Sale in {locality}, {city} | Verified Listings | Think4buysale.in';
const LOCALITY_META_DESCRIPTION = 'Explore property for sale in {locality}, {city} with price, verified listings, and zero brokerage options. Find flats, houses, and best deals today.';
const LOCALITY_H1               = 'Property for Sale in {locality}, {city}';

const LOCALITY_INTRO = `<h2>Quick Answer: Why Buy Flat in {locality}, {city}?</h2><p><strong>{locality}, {city} is one of India's fastest-growing real estate markets, offering affordable pricing, strong infrastructure, and high ROI potential.</strong> With expanding metro connectivity, industrial growth, and modern housing projects, buying a <strong>property for sale in {locality}, {city}</strong> ensures long-term value, rental income opportunities, and a comfortable lifestyle at competitive prices compared to other metro cities.</p><h2>Key Highlights</h2><ul><li><strong>Price Range:</strong> ₹25 Lakhs – ₹2.5 Crore+</li><li><strong>Investment Potential:</strong> High due to rapid urban development and demand</li><li><strong>Property Types:</strong> Apartments, villas, independent houses</li><li><strong>Buyer Options:</strong> Owner property in {locality}, {city}, zero brokerage flats, verified listings</li></ul><h2>Introduction</h2><p>If you are searching for the <strong>best property for sale in {locality}, {city}</strong>, you are making a smart investment decision. {locality}, {city} has become a top destination for homebuyers due to its affordable housing, strong job market, and improving infrastructure. From modern apartments to independent homes, the city offers options for every budget.</p><p><strong>Think4BuySale.in</strong> is a trusted platform where you can explore <strong>{locality}, {city} property listing</strong> options with complete transparency. Whether you want to <strong>buy flat in {locality}, {city}</strong>, search for <strong>owner property in {locality}, {city}</strong>, or find <strong>verified property in {locality}, {city}</strong>, our platform helps you connect directly with sellers and agents easily.</p>`;

const LOCALITY_BOTTOM = `<h2>Why Buy a Flat in {locality}, {city}?</h2><p><strong>{locality}, {city} is a real estate hotspot</strong> due to its balanced combination of affordability and growth. The city offers excellent infrastructure, business opportunities, and lifestyle benefits.</p><ul><li><strong>Affordable Pricing:</strong> Compared to metro cities like Mumbai or Bangalore</li><li><strong>Strong Infrastructure:</strong> Metro rail, highways, and smart city projects</li><li><strong>Job Opportunities:</strong> IT hubs, textile industry, and startups</li><li><strong>High ROI:</strong> Growing demand for apartments in {locality}, {city}</li><li><strong>Quality Lifestyle:</strong> Schools, hospitals, malls, and entertainment</li></ul><p><strong>Is {locality}, {city} good for property investment?</strong><br>Yes, {locality}, {city} is one of the best cities for property investment due to its steady price appreciation, infrastructure development, and increasing housing demand.</p><h2>Types of Property Listings Available</h2><ul><li><strong>Owner Properties:</strong> Direct deals with owners, no middleman</li><li><strong>Zero Brokerage Flats in {locality}, {city}:</strong> Save extra costs</li><li><strong>Agent Listed Properties:</strong> Wide range of options</li><li><strong>Verified Property in {locality}, {city}:</strong> Trusted and checked listings</li></ul><h2>Budget-Based Property Options</h2><h3>Low Budget Flats</h3><p>Budget-friendly <strong>flats in {locality}, {city} for sale</strong> start from ₹20–40 Lakhs in areas like Narol, Vatva, and Chandkheda.</p><h3>Mid-Range Properties</h3><p>₹40–90 Lakhs range offers spacious <strong>{locality}, {city} apartments for sale</strong> in Bopal, Gota, and New Ranip.</p><h3>High Budget Luxury Flats</h3><p>Luxury <strong>apartments in {locality}, {city}</strong> range from ₹1 Crore to ₹3 Crore+ in premium areas like Satellite and SG Highway.</p><h2>Popular Areas in {locality}, {city} for Buying Flats</h2><ul><li><strong>SG Highway:</strong> Premium residential and commercial hub</li><li><strong>Bopal:</strong> Affordable yet modern housing options</li><li><strong>Satellite:</strong> High-end residential locality</li><li><strong>Gota:</strong> Fast-growing investment area</li><li><strong>Chandkheda:</strong> Ideal for families and working professionals</li></ul><h2>Price Trends & Investment Insights</h2><p>The <strong>{locality}, {city} property for sale with price</strong> varies based on location and amenities. Here is a general price trend:</p><ul><li><strong>Affordable Areas:</strong> ₹2,500 – ₹4,000 per sq. ft.</li><li><strong>Mid-Range Areas:</strong> ₹4,000 – ₹6,500 per sq. ft.</li><li><strong>Premium Areas:</strong> ₹6,500 – ₹10,000+ per sq. ft.</li></ul><p>Over the last 5 years, {locality}, {city} has shown a steady growth of 5–8% annually, making it a safe and profitable investment choice.</p><h2>Pros and Cons of Buying in {locality}, {city}</h2><table border="1" cellpadding="10"><tr><th>Pros</th><th>Cons</th></tr><tr><td>Affordable housing options</td><td>Traffic congestion in some areas</td></tr><tr><td>Strong infrastructure growth</td><td>Limited nightlife compared to metro cities</td></tr><tr><td>High return on investment</td><td>Rapid urbanization challenges</td></tr><tr><td>Wide range of property options</td><td>Price variation across locations</td></tr></table><h2>Step-by-Step Guide to Buy Flat in {locality}, {city}</h2><ol><li><strong>Define Budget:</strong> Decide your investment range</li><li><strong>Choose Location:</strong> Select based on work and lifestyle</li><li><strong>Search Listings:</strong> Explore <strong>{locality}, {city} property listing</strong></li><li><strong>Verify Property:</strong> Check documents and approvals</li><li><strong>Visit Site:</strong> Inspect the property physically</li><li><strong>Negotiate Price:</strong> Get the best deal</li><li><strong>Finalize Loan:</strong> Apply for home loan if needed</li><li><strong>Complete Registration:</strong> Legal ownership transfer</li></ol><h2>Why Choose Think4BuySale.in?</h2><ul><li><strong>Verified Listings:</strong> Trusted and authentic properties</li><li><strong>Direct Owner Contact:</strong> No hidden charges</li><li><strong>Zero Brokerage Options:</strong> Save money</li><li><strong>User-Friendly Platform:</strong> Easy search and filters</li><li><strong>Wide Range:</strong> From budget to luxury homes</li></ul><h2>List Your Property for Free</h2><p>Do you want to sell your <strong>property in {locality}, {city}</strong>? Think4BuySale.in allows you to list your property easily.</p><ul><li>Post property in minutes</li><li>Reach thousands of buyers</li><li>Connect directly with interested buyers</li><li>Increase visibility without cost</li></ul><p><strong>Process:</strong> Sign up → Add property details → Upload images → Publish listing → Get leads</p><h2>Conclusion</h2><p><strong>Property for sale in {locality}, {city}</strong> offers an excellent opportunity for homebuyers and investors looking for affordability, growth, and long-term returns. With a wide range of options from budget flats to luxury homes, {locality}, {city} continues to be a preferred real estate destination.</p><p>Explore the best <strong>{locality}, {city} apartments for sale</strong> today on <strong>Think4BuySale.in</strong> and find your perfect home. Start your property search now and connect directly with owners and verified sellers for the best deals.</p>`;

const LOCALITY_FAQS = [
  { question: 'What is the price of flats in {locality}, {city}?',         answer: 'The price of <strong>flats in {locality}, {city} for sale</strong> typically ranges from ₹20 Lakhs to ₹2.5 Crore depending on location, amenities, and property type. Affordable areas offer lower rates, while premium locations like SG Highway have higher pricing.' },
  { question: 'Is {locality}, {city} good for property investment?',       answer: 'Yes, {locality}, {city} offers strong investment potential due to steady growth, affordable pricing, and infrastructure development. It is ideal for both end-users and investors looking for long-term appreciation.' },
  { question: 'Can I find owner property in {locality}, {city}?',          answer: 'Yes, you can easily find <strong>owner property in {locality}, {city}</strong> on Think4BuySale.in. This helps you avoid brokerage charges and deal directly with property owners for better pricing.' },
  { question: 'Are zero brokerage flats available in {locality}, {city}?', answer: 'Yes, many <strong>zero brokerage flats in {locality}, {city}</strong> are available, especially direct owner listings. These properties help buyers save extra costs and simplify the buying process.' },
  { question: 'How to find verified property in {locality}, {city}?',      answer: 'You can find <strong>verified property in {locality}, {city}</strong> on trusted platforms like Think4BuySale.in. Always check property documents, approvals, and ownership details before finalizing the deal.' },
];

// ── Agent City (same structure adapted for agents) ─────────────────────────────

const AGENT_CITY_META_TITLE       = 'Real Estate Agents in {city} | Property Agents & Brokers | Think4buysale.in';
const AGENT_CITY_META_DESCRIPTION = 'Find verified real estate agents in {city} with reviews, experience, and zero brokerage options. Connect with top property agents and brokers today.';
const AGENT_CITY_H1               = 'Real Estate Agents in {city}';

const AGENT_CITY_INTRO = `<h2>Quick Answer: Why Find a Real Estate Agent in {city}?</h2><p><strong>{city} is one of India's fastest-growing real estate markets, and having a verified agent ensures you get the best deals with complete transparency.</strong> With expanding metro connectivity, industrial growth, and modern housing projects, a trusted <strong>real estate agent in {city}</strong> helps you navigate property listings, legal formalities, and price negotiations with confidence.</p><h2>Key Highlights</h2><ul><li><strong>Verified Agents:</strong> RERA-registered and background-checked professionals</li><li><strong>Experience:</strong> Agents with local market knowledge across all areas</li><li><strong>Services:</strong> Buying, selling, renting, and investment advisory</li><li><strong>Zero Commission Options:</strong> Direct owner connections available</li><li><strong>Buyer Options:</strong> Owner property in {city}, zero brokerage deals, verified listings</li></ul><h2>Introduction</h2><p>If you are searching for the <strong>best real estate agent in {city}</strong>, you are making a smart decision. {city} has become a top destination for homebuyers and investors, and finding the right agent can make all the difference. From modern apartments to independent homes, a good agent helps you find the right property for every budget.</p><p><strong>Think4BuySale.in</strong> is a trusted platform where you can explore <strong>{city} real estate agents</strong> with complete transparency. Whether you want to <strong>buy flat in {city}</strong>, search for <strong>owner property in {city}</strong>, or find <strong>verified agents in {city}</strong>, our platform helps you connect directly with experienced professionals easily.</p>`;

const AGENT_CITY_BOTTOM = `<h2>Why Work with a Real Estate Agent in {city}?</h2><p><strong>{city} is a real estate hotspot</strong> and having a local expert gives you a significant advantage. Agents bring market knowledge, negotiation skills, and legal expertise to every transaction.</p><ul><li><strong>Local Market Knowledge:</strong> Deep understanding of {city} neighbourhoods and pricing</li><li><strong>Strong Network:</strong> Access to off-market listings and upcoming projects</li><li><strong>Legal Guidance:</strong> Help with RERA verification, documentation, and registration</li><li><strong>Negotiation Skills:</strong> Get the best deal on your property</li><li><strong>Time Saving:</strong> Shortlist properties that match your exact requirements</li></ul><p><strong>Is working with an agent in {city} worth it?</strong><br>Yes, a verified agent in {city} saves you time, money, and stress by guiding you through the entire property buying or renting process.</p><h2>Types of Agent Services Available</h2><ul><li><strong>Buyer's Agent:</strong> Helps you find and buy the right property</li><li><strong>Seller's Agent:</strong> Lists and sells your property at the best price</li><li><strong>Rental Agent:</strong> Finds tenants or rental properties quickly</li><li><strong>Investment Advisory:</strong> Guides on high-ROI properties in {city}</li></ul><h2>Budget-Based Property Options via Agents</h2><h3>Low Budget Properties</h3><p>Budget-friendly <strong>flats in {city} for sale</strong> start from ₹20–40 Lakhs in areas like Narol, Vatva, and Chandkheda. Agents help you find the best deals in this range.</p><h3>Mid-Range Properties</h3><p>₹40–90 Lakhs range offers spacious <strong>{city} apartments for sale</strong> in Bopal, Gota, and New Ranip — agents negotiate the best pricing for you.</p><h3>High Budget Luxury Properties</h3><p>Luxury <strong>apartments in {city}</strong> range from ₹1 Crore to ₹3 Crore+ in premium areas like Satellite and SG Highway. Top agents have exclusive access to these listings.</p><h2>Popular Areas Covered by Agents in {city}</h2><ul><li><strong>SG Highway:</strong> Premium residential and commercial hub</li><li><strong>Bopal:</strong> Affordable yet modern housing options</li><li><strong>Satellite:</strong> High-end residential locality</li><li><strong>Gota:</strong> Fast-growing investment area</li><li><strong>Chandkheda:</strong> Ideal for families and working professionals</li></ul><h2>Agent Fees & Commission Insights</h2><p>The <strong>real estate agent fees in {city}</strong> vary based on property type and transaction value. Here is a general overview:</p><ul><li><strong>Buying/Selling:</strong> 1% – 2% of the transaction value</li><li><strong>Rental:</strong> Typically one month's rent as brokerage</li><li><strong>Zero Brokerage:</strong> Available for direct owner listings on Think4BuySale.in</li></ul><p>Over the last 5 years, {city} has shown a steady growth of 5–8% annually, making agent-guided investments highly profitable.</p><h2>Pros and Cons of Working with an Agent in {city}</h2><table border="1" cellpadding="10"><tr><th>Pros</th><th>Cons</th></tr><tr><td>Expert local market knowledge</td><td>Commission fees on transactions</td></tr><tr><td>Access to off-market listings</td><td>Quality varies between agents</td></tr><tr><td>Legal and documentation support</td><td>May push higher-priced properties</td></tr><tr><td>Time-saving and stress-free process</td><td>Availability during peak seasons</td></tr></table><h2>Step-by-Step Guide to Find the Right Agent in {city}</h2><ol><li><strong>Define Requirements:</strong> Property type, budget, and preferred areas</li><li><strong>Search Listings:</strong> Explore <strong>verified agents in {city}</strong> on Think4BuySale.in</li><li><strong>Check Credentials:</strong> Verify RERA registration and reviews</li><li><strong>Interview Agents:</strong> Ask about local experience and past deals</li><li><strong>Compare Options:</strong> Talk to at least 2–3 agents before deciding</li><li><strong>Agree on Terms:</strong> Clarify commission and service scope upfront</li><li><strong>Start Property Search:</strong> Let the agent shortlist based on your needs</li><li><strong>Complete Transaction:</strong> Agent assists with legal and registration process</li></ol><h2>Why Choose Think4BuySale.in?</h2><ul><li><strong>Verified Agents:</strong> Trusted and RERA-registered professionals</li><li><strong>Direct Contact:</strong> No hidden charges or middlemen</li><li><strong>Zero Brokerage Options:</strong> Save money on direct deals</li><li><strong>User-Friendly Platform:</strong> Easy search and agent filters</li><li><strong>Wide Range:</strong> Agents across all areas of {city}</li></ul><h2>List as an Agent for Free</h2><p>Are you a real estate agent in <strong>{city}</strong>? Think4BuySale.in allows you to list your profile and reach thousands of buyers and sellers.</p><ul><li>Create agent profile in minutes</li><li>Reach thousands of property seekers</li><li>Connect directly with buyers and sellers</li><li>Increase your visibility without cost</li></ul><p><strong>Process:</strong> Sign up → Add agent profile → Upload credentials → Publish listing → Get leads</p><h2>Conclusion</h2><p><strong>Real estate agents in {city}</strong> offer an excellent opportunity for homebuyers and investors to navigate the property market with confidence. With a wide range of verified professionals available, {city} continues to be a preferred real estate destination.</p><p>Explore the best <strong>real estate agents in {city}</strong> today on <strong>Think4BuySale.in</strong> and find your perfect property partner. Start your search now and connect directly with experienced and verified agents for the best deals.</p>`;

const AGENT_CITY_FAQS = [
  { question: 'What is the fee of real estate agents in {city}?',          answer: 'Real estate agent fees in {city} typically range from 1% to 2% of the transaction value for buying and selling. For rentals, it is usually one month\'s rent as brokerage. Zero brokerage options are also available on Think4BuySale.in.' },
  { question: 'Are real estate agents in {city} RERA registered?',         answer: 'Yes, verified agents on Think4BuySale.in are RERA-registered. Always check RERA credentials before engaging an agent to ensure legal compliance and protection.' },
  { question: 'Can I find a zero brokerage agent in {city}?',              answer: 'Yes, Think4BuySale.in offers direct owner listings in {city} that require no brokerage. You can also find agents who offer transparent and affordable fee structures.' },
  { question: 'How to find a verified real estate agent in {city}?',       answer: 'You can find <strong>verified real estate agents in {city}</strong> on Think4BuySale.in. Check agent profiles, reviews, RERA registration, and past transaction history before making your choice.' },
  { question: 'Do real estate agents in {city} help with home loans?',     answer: 'Yes, many experienced agents in {city} have tie-ups with leading banks and can assist with home loan applications, documentation, and approvals as part of their service.' },
];

// ── Agent Locality City (same structure adapted for agents + locality) ──────────

const AGENT_LOCALITY_META_TITLE       = 'Real Estate Agents in {locality}, {city} | Property Agents & Brokers | Think4buysale.in';
const AGENT_LOCALITY_META_DESCRIPTION = 'Find verified real estate agents in {locality}, {city} with reviews, experience, and zero brokerage options. Connect with top local property agents and brokers today.';
const AGENT_LOCALITY_H1               = 'Real Estate Agents in {locality}, {city}';

const AGENT_LOCALITY_INTRO = `<h2>Quick Answer: Why Find a Real Estate Agent in {locality}, {city}?</h2><p><strong>{locality}, {city} is one of India's fastest-growing real estate markets, and having a verified local agent ensures you get the best deals with complete transparency.</strong> With expanding metro connectivity, industrial growth, and modern housing projects, a trusted <strong>real estate agent in {locality}, {city}</strong> helps you navigate property listings, legal formalities, and price negotiations with confidence.</p><h2>Key Highlights</h2><ul><li><strong>Verified Agents:</strong> RERA-registered and background-checked professionals</li><li><strong>Local Expertise:</strong> Agents with deep knowledge of {locality} micro-market</li><li><strong>Services:</strong> Buying, selling, renting, and investment advisory</li><li><strong>Zero Commission Options:</strong> Direct owner connections available</li><li><strong>Buyer Options:</strong> Owner property in {locality}, {city}, zero brokerage deals, verified listings</li></ul><h2>Introduction</h2><p>If you are searching for the <strong>best real estate agent in {locality}, {city}</strong>, you are making a smart decision. {locality}, {city} has become a top destination for homebuyers and investors, and finding the right local agent can make all the difference. From modern apartments to independent homes, a good agent helps you find the right property for every budget.</p><p><strong>Think4BuySale.in</strong> is a trusted platform where you can explore <strong>{locality}, {city} real estate agents</strong> with complete transparency. Whether you want to <strong>buy flat in {locality}, {city}</strong>, search for <strong>owner property in {locality}, {city}</strong>, or find <strong>verified agents in {locality}, {city}</strong>, our platform helps you connect directly with experienced professionals easily.</p>`;

const AGENT_LOCALITY_BOTTOM = `<h2>Why Work with a Real Estate Agent in {locality}, {city}?</h2><p><strong>{locality}, {city} is a real estate hotspot</strong> and having a local expert gives you a significant advantage. Agents bring micro-market knowledge, negotiation skills, and legal expertise to every transaction.</p><ul><li><strong>Local Market Knowledge:</strong> Deep understanding of {locality} neighbourhoods and pricing</li><li><strong>Strong Network:</strong> Access to off-market listings and upcoming projects in {locality}</li><li><strong>Legal Guidance:</strong> Help with RERA verification, documentation, and registration</li><li><strong>Negotiation Skills:</strong> Get the best deal on your property</li><li><strong>Time Saving:</strong> Shortlist properties that match your exact requirements</li></ul><p><strong>Is working with an agent in {locality}, {city} worth it?</strong><br>Yes, a verified agent in {locality}, {city} saves you time, money, and stress by guiding you through the entire property buying or renting process.</p><h2>Types of Agent Services Available</h2><ul><li><strong>Buyer's Agent:</strong> Helps you find and buy the right property in {locality}</li><li><strong>Seller's Agent:</strong> Lists and sells your property at the best price</li><li><strong>Rental Agent:</strong> Finds tenants or rental properties in {locality} quickly</li><li><strong>Investment Advisory:</strong> Guides on high-ROI properties in {locality}, {city}</li></ul><h2>Budget-Based Property Options via Agents in {locality}</h2><h3>Low Budget Properties</h3><p>Budget-friendly <strong>flats in {locality}, {city} for sale</strong> start from ₹20–40 Lakhs. Local agents help you find the best deals in this range within {locality}.</p><h3>Mid-Range Properties</h3><p>₹40–90 Lakhs range offers spacious <strong>{locality}, {city} apartments for sale</strong> — agents negotiate the best pricing for you.</p><h3>High Budget Luxury Properties</h3><p>Luxury <strong>apartments in {locality}, {city}</strong> range from ₹1 Crore to ₹3 Crore+. Top local agents have exclusive access to these premium listings.</p><h2>Popular Sub-Areas Covered by Agents in {locality}, {city}</h2><ul><li><strong>SG Highway:</strong> Premium residential and commercial hub</li><li><strong>Bopal:</strong> Affordable yet modern housing options</li><li><strong>Satellite:</strong> High-end residential locality</li><li><strong>Gota:</strong> Fast-growing investment area</li><li><strong>Chandkheda:</strong> Ideal for families and working professionals</li></ul><h2>Agent Fees & Commission Insights in {locality}</h2><p>The <strong>real estate agent fees in {locality}, {city}</strong> vary based on property type and transaction value. Here is a general overview:</p><ul><li><strong>Buying/Selling:</strong> 1% – 2% of the transaction value</li><li><strong>Rental:</strong> Typically one month's rent as brokerage</li><li><strong>Zero Brokerage:</strong> Available for direct owner listings on Think4BuySale.in</li></ul><p>Over the last 5 years, {locality}, {city} has shown a steady growth of 5–8% annually, making agent-guided investments highly profitable.</p><h2>Pros and Cons of Working with an Agent in {locality}, {city}</h2><table border="1" cellpadding="10"><tr><th>Pros</th><th>Cons</th></tr><tr><td>Expert local {locality} market knowledge</td><td>Commission fees on transactions</td></tr><tr><td>Access to off-market listings in {locality}</td><td>Quality varies between agents</td></tr><tr><td>Legal and documentation support</td><td>May push higher-priced properties</td></tr><tr><td>Time-saving and stress-free process</td><td>Availability during peak seasons</td></tr></table><h2>Step-by-Step Guide to Find the Right Agent in {locality}, {city}</h2><ol><li><strong>Define Requirements:</strong> Property type, budget, and preferred areas in {locality}</li><li><strong>Search Listings:</strong> Explore <strong>verified agents in {locality}, {city}</strong> on Think4BuySale.in</li><li><strong>Check Credentials:</strong> Verify RERA registration and reviews</li><li><strong>Interview Agents:</strong> Ask about local experience in {locality} and past deals</li><li><strong>Compare Options:</strong> Talk to at least 2–3 agents before deciding</li><li><strong>Agree on Terms:</strong> Clarify commission and service scope upfront</li><li><strong>Start Property Search:</strong> Let the agent shortlist based on your needs</li><li><strong>Complete Transaction:</strong> Agent assists with legal and registration process</li></ol><h2>Why Choose Think4BuySale.in?</h2><ul><li><strong>Verified Agents:</strong> Trusted and RERA-registered professionals</li><li><strong>Direct Contact:</strong> No hidden charges or middlemen</li><li><strong>Zero Brokerage Options:</strong> Save money on direct deals</li><li><strong>User-Friendly Platform:</strong> Easy search and agent filters</li><li><strong>Wide Range:</strong> Agents across all areas of {locality}, {city}</li></ul><h2>List as an Agent for Free</h2><p>Are you a real estate agent in <strong>{locality}, {city}</strong>? Think4BuySale.in allows you to list your profile and reach thousands of buyers and sellers in {locality}.</p><ul><li>Create agent profile in minutes</li><li>Reach thousands of property seekers in {locality}</li><li>Connect directly with buyers and sellers</li><li>Increase your visibility without cost</li></ul><p><strong>Process:</strong> Sign up → Add agent profile → Upload credentials → Publish listing → Get leads</p><h2>Conclusion</h2><p><strong>Real estate agents in {locality}, {city}</strong> offer an excellent opportunity for homebuyers and investors to navigate the property market with confidence. With a wide range of verified local professionals available, {locality}, {city} continues to be a preferred real estate destination.</p><p>Explore the best <strong>real estate agents in {locality}, {city}</strong> today on <strong>Think4BuySale.in</strong> and find your perfect property partner. Start your search now and connect directly with experienced and verified local agents for the best deals.</p>`;

const AGENT_LOCALITY_FAQS = [
  { question: 'What is the fee of real estate agents in {locality}, {city}?',      answer: 'Real estate agent fees in {locality}, {city} typically range from 1% to 2% of the transaction value for buying and selling. For rentals, it is usually one month\'s rent as brokerage. Zero brokerage options are also available on Think4BuySale.in.' },
  { question: 'Are real estate agents in {locality}, {city} RERA registered?',     answer: 'Yes, verified agents on Think4BuySale.in are RERA-registered. Always check RERA credentials before engaging an agent in {locality} to ensure legal compliance and protection.' },
  { question: 'Can I find a zero brokerage agent in {locality}, {city}?',          answer: 'Yes, Think4BuySale.in offers direct owner listings in {locality}, {city} that require no brokerage. You can also find agents who offer transparent and affordable fee structures.' },
  { question: 'How to find a verified real estate agent in {locality}, {city}?',   answer: 'You can find <strong>verified real estate agents in {locality}, {city}</strong> on Think4BuySale.in. Check agent profiles, reviews, RERA registration, and past transaction history before making your choice.' },
  { question: 'Do real estate agents in {locality}, {city} help with home loans?', answer: 'Yes, many experienced agents in {locality}, {city} have tie-ups with leading banks and can assist with home loan applications, documentation, and approvals as part of their service.' },
];

// ── Template definitions ───────────────────────────────────────────────────────

const TEMPLATES: any[] = [
  {
    name:            'City Category',
    categorySlug:    'buy',
    slugPattern:     'property-for-sale-in-{city}',
    citySlugPattern: 'property-for-sale-in-{city}',
    includeCityPage: false,
    showInFooter:    true,
    h1Title:         CITY_H1,
    metaTitle:       CITY_META_TITLE,
    metaDescription: CITY_META_DESCRIPTION,
    metaKeywords:    null,
    canonicalUrl:    null,
    introContent:    CITY_INTRO,
    bottomContent:   CITY_BOTTOM,
    faqJson:         CITY_FAQS,
    robots:          'index,follow',
  },
  {
    name:            'City Locality Category',
    categorySlug:    'buy',
    slugPattern:     'property-for-sale-in-{locality}-{city}',
    citySlugPattern: 'property-for-sale-in-{city}',
    includeCityPage: true,
    showInFooter:    true,
    h1Title:         LOCALITY_H1,
    metaTitle:       LOCALITY_META_TITLE,
    metaDescription: LOCALITY_META_DESCRIPTION,
    metaKeywords:    null,
    canonicalUrl:    null,
    introContent:    LOCALITY_INTRO,
    bottomContent:   LOCALITY_BOTTOM,
    faqJson:         LOCALITY_FAQS,
    robots:          'index,follow',
  },
  {
    name:            'Agent City',
    categorySlug:    'agents',
    slugPattern:     'agents-in-{city}',
    citySlugPattern: 'agents-in-{city}',
    includeCityPage: false,
    showInFooter:    true,
    h1Title:         AGENT_CITY_H1,
    metaTitle:       AGENT_CITY_META_TITLE,
    metaDescription: AGENT_CITY_META_DESCRIPTION,
    metaKeywords:    null,
    canonicalUrl:    null,
    introContent:    AGENT_CITY_INTRO,
    bottomContent:   AGENT_CITY_BOTTOM,
    faqJson:         AGENT_CITY_FAQS,
    robots:          'index,follow',
  },
  {
    name:            'Agent Locality City',
    categorySlug:    'agents',
    slugPattern:     'agents-in-{locality}-{city}',
    citySlugPattern: 'agents-in-{city}',
    includeCityPage: true,
    showInFooter:    true,
    h1Title:         AGENT_LOCALITY_H1,
    metaTitle:       AGENT_LOCALITY_META_TITLE,
    metaDescription: AGENT_LOCALITY_META_DESCRIPTION,
    metaKeywords:    null,
    canonicalUrl:    null,
    introContent:    AGENT_LOCALITY_INTRO,
    bottomContent:   AGENT_LOCALITY_BOTTOM,
    faqJson:         AGENT_LOCALITY_FAQS,
    robots:          'index,follow',
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await ds.initialize();
  console.log('Connected. Seeding SEO templates…\n');

  await ds.query(`
    CREATE TABLE IF NOT EXISTS \`quick_seo_templates\` (
      \`id\`              varchar(36)   NOT NULL,
      \`name\`            varchar(200)  NOT NULL,
      \`categorySlug\`    varchar(50)   NOT NULL,
      \`slugPattern\`     varchar(300)  NOT NULL DEFAULT '{category}-in-{city}-{locality}',
      \`citySlugPattern\` varchar(300)  DEFAULT NULL,
      \`includeCityPage\` tinyint       NOT NULL DEFAULT 0,
      \`showInFooter\`    tinyint       NOT NULL DEFAULT 1,
      \`h1Title\`         varchar(250)  DEFAULT NULL,
      \`metaTitle\`       varchar(250)  DEFAULT NULL,
      \`metaDescription\` varchar(500)  DEFAULT NULL,
      \`metaKeywords\`    varchar(300)  DEFAULT NULL,
      \`canonicalUrl\`    varchar(500)  DEFAULT NULL,
      \`introContent\`    text          DEFAULT NULL,
      \`bottomContent\`   text          DEFAULT NULL,
      \`faqJson\`         json          DEFAULT NULL,
      \`robots\`          varchar(100)  NOT NULL DEFAULT 'index,follow',
      \`appliedCount\`    int           NOT NULL DEFAULT 0,
      \`lastAppliedAt\`   datetime      DEFAULT NULL,
      \`createdAt\`       datetime(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`updatedAt\`       datetime(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('  ✓  Table quick_seo_templates ready\n');

  // Wipe all existing templates and re-insert fresh from this file.
  const [{ count: before }] = await ds.query('SELECT COUNT(*) AS count FROM quick_seo_templates');
  await ds.query('DELETE FROM quick_seo_templates');
  console.log(`  🗑  Deleted ${before} existing template(s)\n`);

  let inserted = 0;

  for (const tpl of TEMPLATES) {
    await ds.query(
      `INSERT INTO quick_seo_templates
         (id, name, categorySlug, slugPattern, citySlugPattern, includeCityPage, showInFooter,
          h1Title, metaTitle, metaDescription, metaKeywords, canonicalUrl,
          introContent, bottomContent, faqJson, robots,
          appliedCount, createdAt, updatedAt)
       VALUES
         (UUID(), ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          0, NOW(), NOW())`,
      [
        tpl.name, tpl.categorySlug, tpl.slugPattern, tpl.citySlugPattern ?? null,
        tpl.includeCityPage ? 1 : 0, tpl.showInFooter ? 1 : 0,
        tpl.h1Title, tpl.metaTitle, tpl.metaDescription, tpl.metaKeywords ?? null, tpl.canonicalUrl ?? null,
        tpl.introContent, tpl.bottomContent, JSON.stringify(tpl.faqJson),
        tpl.robots,
      ],
    );
    console.log(`  ✓  Inserted: ${tpl.name}`);
    inserted++;
  }

  console.log(`\n✅  Inserted : ${inserted}`);
  console.log(`📋  Total SEO templates: ${TEMPLATES.length}`);
  await ds.destroy();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
