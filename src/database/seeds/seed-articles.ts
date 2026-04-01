/**
 * Articles Seed Script
 * Run: npx ts-node -r tsconfig-paths/register src/database/seeds/seed-articles.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { Article, ArticleStatus, ArticleCategory } from '../../modules/articles/entities/article.entity';
import { User, UserRole } from '../../modules/users/entities/user.entity';
import { Role } from '../../modules/rbac/entities/role.entity';
import { Permission } from '../../modules/rbac/entities/permission.entity';
import { Property } from '../../modules/properties/entities/property.entity';
import { PropertyImage } from '../../modules/properties/entities/property-image.entity';
import { Amenity } from '../../modules/properties/entities/amenity.entity';
import { Location } from '../../modules/locations/entities/location.entity';
import { Inquiry } from '../../modules/inquiries/entities/inquiry.entity';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'dpk1391981',
  password: process.env.DB_PASSWORD || 'Dpk1391981!',
  database: process.env.DB_NAME || 'realestate_db',
  entities: [Article, User, Role, Permission, Property, PropertyImage, Amenity, Location, Inquiry],
  synchronize: true,
});

const ARTICLES = [
  // ── Market Insights ────────────────────────────────────────────────────────
  {
    title: 'India Real Estate Market Outlook 2025: Growth, Trends & Hotspots',
    slug: 'india-real-estate-market-outlook-2025',
    category: ArticleCategory.MARKET,
    excerpt: 'India\'s real estate market is poised for robust growth in 2025. Explore the top investment hotspots, price trends, and sector-wise analysis across major cities.',
    content: `## India Real Estate Market Outlook 2025

India's real estate sector is on a strong growth trajectory in 2025, driven by infrastructure development, policy reforms, and rising urbanisation. Here is a comprehensive look at what buyers, sellers, and investors can expect.

### Residential Market

The residential market is witnessing sustained demand, particularly in the mid-segment (₹40L–₹1.5Cr range). Cities like Pune, Hyderabad, and Bengaluru are recording double-digit sales growth year-on-year.

Key drivers:
- Stable home loan interest rates (8–9% range)
- Government push for affordable housing under PMAY
- Increased NRI investment due to favourable exchange rates
- Work-from-home normalisation increasing demand for spacious homes

### Commercial Real Estate

Office space absorption is at a decade high. Tech companies, GCCs (Global Capability Centres), and co-working operators are the primary demand drivers. Grade-A office space in Bengaluru, Hyderabad, and Pune remains in strong demand.

### Top Investment Hotspots

**Delhi NCR:** Sectors 108–113 in Dwarka Expressway corridor; Noida Extension for affordable options.

**Mumbai:** Navi Mumbai (Kharghar, Panvel) for affordability; BKC and Lower Parel for premium commercial.

**Bengaluru:** Sarjapur Road, Whitefield for IT corridors; Hebbal for luxury.

**Hyderabad:** HITEC City, Gachibowli, and the upcoming HMDA zones.

**Pune:** Hinjewadi, Kharadi, and Wakad for IT-driven residential demand.

### Price Trends

Residential property prices have appreciated 8–12% on average across top 8 cities in 2024. The trend is expected to continue through 2025, especially in micro-markets with good metro connectivity.

### Regulatory Landscape

RERA continues to protect buyer interests. States like Maharashtra, UP, and Karnataka have strengthened enforcement, reducing the risk of project delays and defaults.

### Verdict for 2025

Buy-to-own in mid-segment is a sound strategy for end-users. Investors should target rental-yield plays in commercial and co-living segments. New project launches with RERA registration are safer choices than resale in under-construction projects.`,
    tags: ['market trends', 'investment', '2025', 'real estate', 'India'],
    isFeatured: true,
    readTime: 6,
    metaTitle: 'India Real Estate Market Outlook 2025 | Think4BuySale',
    metaDescription: 'Comprehensive analysis of India\'s real estate market in 2025 — residential trends, commercial demand, top investment hotspots and price forecasts.',
    metaKeywords: 'india real estate 2025, property market outlook, real estate investment india, property price trends',
    status: ArticleStatus.PUBLISHED,
  },

  // ── Guides ────────────────────────────────────────────────────────────────
  {
    title: 'First-Time Home Buyer\'s Guide: Everything You Need to Know',
    slug: 'first-time-home-buyer-guide-india',
    category: ArticleCategory.GUIDES,
    excerpt: 'Buying your first home in India? This step-by-step guide covers budget planning, home loan eligibility, RERA checks, registration costs, and common mistakes to avoid.',
    content: `## First-Time Home Buyer's Complete Guide

Buying your first home is one of the biggest financial decisions of your life. This guide breaks it down into simple steps so you are never caught off guard.

### Step 1: Define Your Budget

Before looking at properties, calculate:
- **Down payment:** Minimum 10–20% of property value
- **EMI capacity:** Your monthly EMI should not exceed 40–45% of your net monthly income
- **Hidden costs:** Registration (5–7%), stamp duty, GST (on under-construction), brokerage, interior costs

**Example:** For a ₹70L flat, budget ~₹85–90L total (property + all costs).

### Step 2: Check Home Loan Eligibility

Banks typically offer 75–90% of property value as loan. Your eligibility depends on:
- Monthly income and employment type
- CIBIL credit score (750+ is ideal)
- Existing EMIs / debts
- Property type and approval status

**Tip:** Get pre-approved for a loan before shortlisting properties — it gives you negotiating power.

### Step 3: RERA Registration Check

For any under-construction project, verify the RERA registration on your state's RERA portal. A valid registration means:
- Project details and timeline are filed
- Builder is accountable for delays
- Buyer money goes into an escrow account

### Step 4: Title Verification

Hire a lawyer to verify the property's title documents:
- Sale deed chain (minimum 30 years history)
- Encumbrance certificate (no pending loans on property)
- Approved building plan from municipal authority
- Occupancy Certificate (OC) for ready-to-move flats

### Step 5: Negotiate and Make an Offer

- Research recent transaction prices in the area (use SRO data or property portals)
- Under-construction projects offer more negotiation room
- Ask for freebies: car parking, modular kitchen, club membership

### Step 6: Registration and Possession

After signing the sale agreement:
1. Pay stamp duty + registration fees at the Sub-Registrar Office
2. Collect registered sale deed
3. Ensure OC and CC are obtained
4. Do a thorough quality check before accepting possession

### Common Mistakes to Avoid

- Buying without RERA check in under-construction projects
- Ignoring maintenance costs and society charges
- Not getting a loan pre-sanction letter
- Overlooking location fundamentals: water, electricity, metro connectivity
- Skipping legal due diligence to save money`,
    tags: ['home buying', 'first time buyer', 'home loan', 'RERA', 'guide'],
    isFeatured: true,
    readTime: 8,
    metaTitle: 'First-Time Home Buyer\'s Guide India 2025 | Think4BuySale',
    metaDescription: 'Complete step-by-step guide for first-time home buyers in India. Budget planning, RERA checks, loan eligibility, stamp duty and common mistakes.',
    metaKeywords: 'first time home buyer india, home buying guide, home loan eligibility, RERA check, property registration',
    status: ArticleStatus.PUBLISHED,
  },

  // ── Tips ──────────────────────────────────────────────────────────────────
  {
    title: '10 Proven Tips to Get the Best Price When Selling Your Property',
    slug: 'tips-to-get-best-price-selling-property',
    category: ArticleCategory.TIPS,
    excerpt: 'Selling a property in India? Use these 10 battle-tested strategies — from timing and pricing to staging and negotiations — to maximise your sale price.',
    content: `## 10 Proven Tips to Get the Best Price When Selling Your Property

Selling a property at the right price requires strategy, not just luck. Here are 10 tips that consistently help sellers achieve the best outcomes.

### 1. Time the Market Right

Festive seasons (Navratri, Diwali) and the Jan–March quarter typically see higher buyer activity. Avoid listing during monsoon when site visits drop.

### 2. Price It Correctly from Day One

Overpricing is the #1 mistake sellers make. Overpriced properties sit longer, making buyers suspicious. Get at least 2–3 independent valuations before deciding on an asking price.

### 3. Fix the Small Things First

Peeling paint, broken tiles, leaky taps, and faulty switches — these small issues signal "neglected property" to buyers and cost you far more in negotiation than they would to fix.

### 4. Deep Clean and Declutter

A clean, decluttered home photographs better, shows better, and sells for more. Consider professional cleaning before listing.

### 5. Professional Photography Makes a Difference

80% of buyers start their search online. High-quality photos and a virtual walkthrough can generate significantly more enquiries. Don't use phone photos for a property worth ₹50L+.

### 6. List on Multiple Platforms

List on Think4BuySale, 99acres, MagicBricks, and Housing.com simultaneously. More visibility = more competing buyers = better price.

### 7. Disclose Everything Upfront

Hiding defects that buyers will discover during inspection destroys trust and deals. Full disclosure builds confidence and speeds up the transaction.

### 8. Have Your Documents Ready

A seller with all documents ready (title deed, encumbrance certificate, society NOC, OC, property tax receipts) closes 30–40% faster. Buyers lose interest when documentation takes months.

### 9. Negotiate Smart, Not Hard

The goal is a win-win deal, not victory. Understand the buyer's timeline and motivations. Sometimes a slightly lower price with a faster closing is more valuable than holding out for the last rupee.

### 10. Work with a Verified Agent

A good agent has local market knowledge, a buyer network, and negotiation skills that typically net you more than their commission. Choose RERA-registered agents.`,
    tags: ['selling tips', 'property sale', 'pricing strategy', 'negotiation'],
    isFeatured: false,
    readTime: 5,
    metaTitle: '10 Tips to Get the Best Price When Selling Your Property | Think4BuySale',
    metaDescription: 'Selling your property? Use these 10 proven strategies on timing, pricing, staging, and negotiation to maximise your sale price in the Indian real estate market.',
    metaKeywords: 'selling property tips india, property sale price, real estate selling strategy, property negotiation',
    status: ArticleStatus.PUBLISHED,
  },

  // ── Legal ─────────────────────────────────────────────────────────────────
  {
    title: 'Understanding Stamp Duty and Registration Charges in India (State-Wise 2025)',
    slug: 'stamp-duty-registration-charges-india-2025',
    category: ArticleCategory.LEGAL,
    excerpt: 'A state-by-state breakdown of stamp duty and property registration charges in India for 2025, with tips to calculate your total transaction cost.',
    content: `## Stamp Duty and Registration Charges in India — 2025 Guide

Stamp duty and registration charges are one of the largest transaction costs when buying property in India, yet many buyers underestimate them. Here is everything you need to know.

### What is Stamp Duty?

Stamp duty is a tax levied by state governments on property transactions. The legal owner must pay stamp duty for the transfer to be legally valid and for the property to be registered in their name.

### What are Registration Charges?

Registration charges are fees paid to the Sub-Registrar's Office to register the property sale deed as an official government record.

### State-Wise Rates (2025)

| State | Stamp Duty (Men) | Stamp Duty (Women) | Registration |
|---|---|---|---|
| Maharashtra | 5% | 4% | 1% (max ₹30,000) |
| Delhi | 6% | 4% | 1% |
| Karnataka | 5% | 5% | 1% |
| Tamil Nadu | 7% | 7% | 4% (max ₹40,000) |
| Uttar Pradesh | 7% | 6% | 1% |
| Rajasthan | 6% | 5% | 1% |
| Gujarat | 4.9% | 4.9% | 1% |
| West Bengal | 5–7% (slab) | 5–7% | 1% |
| Telangana | 4% | 4% | 0.5% |
| Punjab | 6% | 4% | 1% |

*Note: Rates change periodically. Always verify on your state's government portal.*

### How to Calculate Your Total Transaction Cost

**Example:** Buying a ₹80L flat in Maharashtra (male buyer)

- Stamp duty: 5% × ₹80L = ₹4L
- Registration: 1% × ₹80L = ₹80,000 (capped at ₹30,000)
- Total stamp + registration: ≈ ₹4.3L
- Other costs: Legal fees, society transfer charges, NOC fees

### Ways to Save on Stamp Duty

1. **Register in woman's name** — most states offer 1–2% concession for women buyers
2. **Festive amnesty schemes** — some states periodically waive penalties on stamp duty arrears
3. **Ensure correct circle rate** — stamp duty is on higher of circle rate or actual price; verify your area's circle rate before agreeing on a price
4. **Joint ownership** — joint registrations can sometimes leverage lower slabs

### Key Points to Remember

- Stamp duty must be paid before or at the time of registration
- Under-paid stamp duty can attract penalties of 2–4× the shortfall
- GST (on under-construction properties) is separate from stamp duty
- Parking spaces, if purchased separately, attract their own stamp duty`,
    tags: ['stamp duty', 'registration charges', 'legal', 'property tax', '2025'],
    isFeatured: false,
    readTime: 7,
    metaTitle: 'Stamp Duty & Registration Charges in India 2025 (State-Wise) | Think4BuySale',
    metaDescription: 'State-wise stamp duty and registration charge rates in India for 2025. Learn how to calculate your total property transaction cost and save on stamp duty.',
    metaKeywords: 'stamp duty india 2025, property registration charges, stamp duty state wise, property transaction cost india',
    status: ArticleStatus.PUBLISHED,
  },

  // ── Investment ────────────────────────────────────────────────────────────
  {
    title: 'Commercial Real Estate vs Residential: Where Should You Invest in 2025?',
    slug: 'commercial-vs-residential-real-estate-investment-2025',
    category: ArticleCategory.INVESTMENT,
    excerpt: 'Comparing commercial and residential real estate investment in India for 2025 — yields, risks, capital appreciation, and which asset class suits your goals.',
    content: `## Commercial Real Estate vs Residential: Where Should You Invest?

One of the most common questions from real estate investors is whether to put money in commercial or residential property. The answer depends on your capital, risk appetite, and investment horizon.

### Rental Yields: Commercial Wins

| Asset Class | Average Gross Rental Yield |
|---|---|
| Residential (Metro) | 2–3.5% |
| Residential (Tier 2) | 3–4.5% |
| Commercial Office | 7–10% |
| Retail/Shop | 5–8% |
| Warehouse/Industrial | 8–12% |

Commercial properties in Grade-A office parks and logistics hubs offer 2–3× higher yields than residential properties.

### Capital Appreciation: Residential Leads in Long-Run

Residential properties in emerging micro-markets (metro periphery, new transit corridors) have historically delivered 12–18% CAGR over 7–10 year periods. Commercial yields tend to be more stable but can appreciate sharply in supply-constrained CBD areas.

### Entry Cost and Accessibility

- **Residential:** Entry from ₹20L in Tier 2 cities; ₹50L+ in metros
- **Commercial:** Typically ₹1Cr+ for even a small shop or office unit; Grade-A offices start at ₹2–5Cr
- **REITs:** Allow exposure to commercial real estate from as little as ₹10,000

### Risk Factors

**Residential:**
- Vacancy risk is lower (always tenants for good homes)
- Easier to sell (liquid market)
- Tenant disputes more common

**Commercial:**
- Higher vacancy risk between tenants
- Longer vacant periods (3–6 months to find commercial tenants)
- Requires proper agreements (lock-in periods protect income)
- Tenant quality matters enormously

### Tax Considerations

- Rental income from both types is taxable under "Income from House Property"
- 30% standard deduction on net annual value applies to both
- Depreciation on commercial furniture and equipment is an additional deduction

### Our Verdict for 2025

| Investor Profile | Recommendation |
|---|---|
| First-time investor | Residential — easier entry, simpler management |
| HNI with ₹2Cr+ capital | Grade-A commercial for yield |
| Passive investor | REITs (Embassy, Mindspace, Nexus) for liquidity |
| Long-term wealth creation | Mix of residential + warehouse/industrial |

**Bottom line:** If yield and passive income are your primary goals, commercial wins. If you want a balance of capital appreciation and reasonable yield with lower risk, residential in an emerging micro-market is the safer bet for 2025.`,
    tags: ['investment', 'commercial real estate', 'residential', 'rental yield', 'REITs'],
    isFeatured: true,
    readTime: 7,
    metaTitle: 'Commercial vs Residential Real Estate Investment 2025 | Think4BuySale',
    metaDescription: 'Should you invest in commercial or residential property in India in 2025? Compare rental yields, capital appreciation, risk factors and tax benefits.',
    metaKeywords: 'commercial real estate investment india, residential vs commercial property, rental yield india, real estate investment 2025',
    status: ArticleStatus.PUBLISHED,
  },

  // ── News ───────────────────────────────────────────────────────────────────
  {
    title: 'Top 5 Infrastructure Projects Boosting Property Values in Delhi NCR',
    slug: 'infrastructure-projects-boosting-property-values-delhi-ncr',
    category: ArticleCategory.NEWS,
    excerpt: 'Five major infrastructure projects in Delhi NCR — metro expansions, expressways, and RRTS — are already lifting property prices in adjacent micro-markets.',
    content: `## Top 5 Infrastructure Projects Boosting Property Values in Delhi NCR

Infrastructure is the single biggest driver of property appreciation. In Delhi NCR, several landmark projects are reshaping micro-market dynamics. Here are the five that matter most right now.

### 1. Regional Rapid Transit System (RRTS) — Delhi to Meerut

India's first RRTS corridor is live between Sahibabad and Duhai. The full Delhi–Meerut stretch, once complete, will cut commute time to under 60 minutes. Property prices in Ghaziabad (Raj Nagar Extension, Crossing Republik, Modinagar) have already risen 15–20% in anticipation.

**Impact zones:** Ghaziabad, Murad Nagar, Modinagar, Meerut

### 2. Delhi–Mumbai Expressway (NH-48 Extension)

The 8-lane expressway connecting Delhi to Mumbai is accelerating development along its Delhi entry corridors. IMT Manesar and Dharuhera are direct beneficiaries, with warehousing and industrial demand surging.

**Impact zones:** Manesar, Dharuhera, Bawal (Haryana stretch)

### 3. Dwarka Expressway (NH-248BB) — Now Fully Operational

The Dwarka Expressway, fully operational since 2024, has transformed Sectors 88–113 in Gurugram from delayed projects to in-demand addresses. Average prices in the corridor have risen 25–30% over the past 18 months.

**Impact zones:** Sectors 88A, 89, 99, 108–113 (Gurugram)

### 4. Delhi Metro Phase IV Expansion

Phase IV adds ~65 km across six corridors, including the critical Janakpuri–RK Ashram and Mukundpur–Maujpur lines. Localities falling within 500m of new stations have seen 8–12% price bumps during planning announcements.

**Impact zones:** Janakpuri, Paschim Vihar, Rohini, Mukundpur

### 5. Jewar International Airport (Noida International Airport)

Slated to become India's largest airport by passenger capacity, Jewar airport is the most transformative project for Greater Noida West, Yamuna Expressway, and Agra Road belt. Land values along Yamuna Expressway have doubled in 3 years.

**Impact zones:** Greater Noida West, Yamuna Expressway, Jewar, Tappal

---

### How to Use This Data as a Buyer/Investor

- **Buy early along confirmed corridors** — prices jump significantly once physical construction becomes visible
- **Verify possession timelines** — infrastructure delays are common; don't pay tomorrow's price for today's reality
- **Check connectivity to last-mile transport** — a metro station 3 km away with no autos or feeder buses has limited impact`,
    tags: ['Delhi NCR', 'infrastructure', 'metro', 'RRTS', 'property appreciation', 'news'],
    isFeatured: false,
    readTime: 5,
    metaTitle: 'Top 5 Infrastructure Projects Boosting Property Values in Delhi NCR | Think4BuySale',
    metaDescription: 'RRTS, Dwarka Expressway, Jewar Airport, Metro Phase IV — discover how 5 major infrastructure projects are pushing property prices up in Delhi NCR.',
    metaKeywords: 'delhi ncr infrastructure 2025, property appreciation delhi, RRTS property prices, Jewar airport real estate',
    status: ArticleStatus.PUBLISHED,
  },

  // ── Tips ──────────────────────────────────────────────────────────────────
  {
    title: 'How to Calculate the True Cost of Renting vs Buying a Home in India',
    slug: 'renting-vs-buying-home-india-cost-calculator',
    category: ArticleCategory.TIPS,
    excerpt: 'Is it better to rent or buy? This data-driven breakdown helps you compare the true long-term costs of renting vs buying in major Indian cities.',
    content: `## Renting vs Buying: The True Cost Comparison

The "rent vs buy" debate is one of the most hotly contested topics in personal finance. The answer is rarely black-and-white — it depends on your city, your tenure, and your financial goals.

### The "Price-to-Rent Ratio" Rule

A common global benchmark:

- **Price-to-Rent Ratio (P/R) < 15** → Buying is clearly better
- **P/R 15–20** → Marginal — depends on personal factors
- **P/R > 20** → Renting is financially rational

**Formula:** P/R Ratio = Property Price ÷ Annual Rent

**Example (Bengaluru, Whitefield):**
- 2BHK price: ₹80L
- Monthly rent: ₹22,000 → Annual rent: ₹2.64L
- P/R Ratio: 80L ÷ 2.64L ≈ **30** → Renting makes more financial sense here

### The True Cost of Buying

Don't just compare EMI to rent. Include:

| Cost | Amount (₹80L property, ₹65L loan @ 8.5%) |
|---|---|
| Monthly EMI | ₹56,000 |
| Stamp duty + registration | ₹4–5L (one-time) |
| Maintenance/society charges | ₹3,000–8,000/month |
| Property tax | ₹5,000–15,000/year |
| Opportunity cost of down payment | 6–7% return if invested |

**True monthly cost of owning:** ₹65,000–70,000/month

### The True Cost of Renting

| Cost | Amount |
|---|---|
| Monthly rent | ₹22,000 |
| Brokerage (one-time) | ₹22,000 (1 month) |
| Security deposit cost (locked capital) | ₹1.32L (6 months) at 7% opportunity cost = ₹770/month |

**True monthly cost of renting:** ₹23,000–24,000/month

### The Hidden Benefit of Buying: Equity Building

Over 20 years, your ₹65L loan will be fully paid off. You will have:
- An owned asset worth potentially ₹2–3Cr (at 5–8% CAGR)
- Zero housing cost post-EMI tenure
- Rental income if you choose to let it out

### When Renting Makes Sense

- You plan to move city within 3–5 years
- Your P/R ratio is above 25
- You have an investment alternative earning 12%+ returns
- Job stability is uncertain

### When Buying Makes Sense

- You plan to stay in the city for 7+ years
- P/R ratio is below 20 in your target area
- You want forced savings through EMI discipline
- You have a stable family and income`,
    tags: ['rent vs buy', 'home loan', 'financial planning', 'real estate tips'],
    isFeatured: false,
    readTime: 6,
    metaTitle: 'Renting vs Buying a Home in India: True Cost Comparison | Think4BuySale',
    metaDescription: 'A data-driven comparison of renting vs buying in major Indian cities. Calculate the true cost using the price-to-rent ratio and make the right decision.',
    metaKeywords: 'rent vs buy india, home loan vs rent, price to rent ratio, renting vs buying india',
    status: ArticleStatus.PUBLISHED,
  },

  // ── Draft placeholder ──────────────────────────────────────────────────────
  {
    title: 'NRI Property Investment Guide India 2025 [DRAFT]',
    slug: 'nri-property-investment-guide-india-2025',
    category: ArticleCategory.INVESTMENT,
    excerpt: 'Coming soon: a comprehensive guide for NRIs looking to invest in Indian real estate — regulations, tax implications, repatriation rules, and city picks.',
    content: `## NRI Property Investment Guide India 2025

*This article is under preparation. Check back soon.*

### What Will Be Covered

- FEMA regulations for NRI property purchase
- Tax implications: TDS on NRI property transactions
- Repatriation of sale proceeds
- Best cities for NRI investment in 2025
- Power of attorney requirements
- Home loan options for NRIs`,
    tags: ['NRI', 'investment', 'FEMA', 'tax', 'guide'],
    isFeatured: false,
    readTime: 1,
    metaTitle: 'NRI Property Investment Guide India 2025 | Think4BuySale',
    metaDescription: 'Complete NRI property investment guide for India 2025 — FEMA rules, tax implications, repatriation, and top city picks.',
    metaKeywords: 'NRI property india, NRI real estate investment, FEMA property rules NRI',
    status: ArticleStatus.DRAFT,
  },
];

async function seedArticles() {
  await dataSource.initialize();
  console.log('[Articles Seed] Database connected');

  const articleRepo = dataSource.getRepository(Article);
  const userRepo    = dataSource.getRepository(User);

  // Find admin user to assign as author
  const admin = await userRepo.findOne({ where: { role: UserRole.ADMIN } });
  if (!admin) {
    console.warn('[Articles Seed] No admin user found — articles will have no author');
  }

  let created = 0;
  let skipped = 0;

  for (const data of ARTICLES) {
    const existing = await articleRepo.findOne({ where: { slug: data.slug } });
    if (existing) {
      console.log(`[Articles Seed] Skipping existing: ${data.slug}`);
      skipped++;
      continue;
    }

    const article = articleRepo.create({
      ...data,
      authorId: admin?.id ?? null,
      publishedAt: data.status === ArticleStatus.PUBLISHED ? new Date() : null,
    });

    await articleRepo.save(article);
    console.log(`[Articles Seed] Created: ${data.title}`);
    created++;
  }

  console.log(`
[Articles Seed] ✅ Complete!
  Created: ${created}
  Skipped (already exist): ${skipped}
  Total seed articles: ${ARTICLES.length}
  `);

  await dataSource.destroy();
}

seedArticles().catch((err) => {
  console.error('[Articles Seed] ❌ Error:', err);
  process.exit(1);
});
