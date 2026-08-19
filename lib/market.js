import { db } from './db.js';

// ============================================================
// Affiliate market knowledge base — types + programs.
// Rates are typical/approximate public figures for orientation;
// always confirm current terms on the network's own site.
// ============================================================

export const TYPES = [
  {
    slug: 'retail', name: 'Physical Products & Retail', icon: 'cart',
    tagline: 'Marketplace & store affiliate programs',
    description: 'Promote physical goods from marketplaces and big-box stores. Low rates but massive catalogs and sky-high conversion trust — the classic beginner type and a volume play.',
    avg_commission: '1–10%', best_channels: 'SEO reviews · YouTube unboxings · Gift guides · Pinterest · Deal roundups',
    features: [
      { label: 'Category-based rates', value: 'Commissions vary by product category (e.g. Amazon pays 1–20% depending on category).' },
      { label: 'Short cookies', value: 'Typical cookies are 24h–7 days, so freshness and intent matter more than branding.' },
      { label: 'Seasonal spikes', value: 'Black Friday, Prime Day and holidays multiply clicks — plan campaigns 3–4 weeks ahead.' },
      { label: 'Volume play', value: 'Earnings scale with traffic volume; combine with high-ticket picks to raise EPC.' },
      { label: 'Comparison content', value: '"Best X for Y" listicles and price comparisons convert far above product roundups.' },
    ],
    tips: ['Use the tag/tracking ID in every destination URL', 'Update pricing mentions before BFCM', 'Rotate items that drop in stock'],
  },
  {
    slug: 'saas', name: 'Software & SaaS', icon: 'terminal',
    tagline: 'Recurring revenue from tools & subscriptions',
    description: 'The highest-LTV affiliate niche: promote software with recurring commissions (20–50%) and earn every month the customer stays. One signup can pay for years.',
    avg_commission: '20–50% recurring', best_channels: 'Comparison posts · YouTube tutorials · SEO · Communities · Newsletters',
    features: [
      { label: 'Recurring commissions', value: 'Monthly % of the subscription for the customer lifetime — MRR you can bank on.' },
      { label: 'High LTV', value: 'A single customer can be worth $100–$1,000+ over years; churn is the only enemy.' },
      { label: 'Trial-to-paid funnels', value: 'Free trials convert via honest walkthroughs, not hype. Show real screens.' },
      { label: 'SEO goldmine', value: '"X vs Y" and "X alternatives" keywords have huge search volume and high intent.' },
      { label: 'Partner ecosystems', value: 'PartnerStack & Impact host most SaaS programs with dashboards and tracking.' },
    ],
    tips: ['Target the alternative keywords of your chosen tool', 'Demo the product in video — trust drives trial signups', 'Revisit old posts when pricing changes'],
  },
  {
    slug: 'digital', name: 'Digital Products & Courses', icon: 'book',
    tagline: 'Info-products, e-books, courses, memberships',
    description: 'ClickBank, Digistore24 and course platforms pay 30–85% because the product is pure margin. High EPC potential but needs persuasive, funnel-aware content.',
    avg_commission: '30–75%', best_channels: 'Email funnels · YouTube review/debunk videos · Facebook ads · SEO',
    features: [
      { label: 'Huge commission rates', value: '30–85% is normal — digital goods have near-zero marginal cost for the vendor.' },
      { label: 'Instant payouts', value: 'Many networks pay weekly with low minimums — fast cash flow.' },
      { label: 'Funnel awareness', value: 'VSLs and upsells exist — vet the product before promoting; your reputation is the asset.' },
      { label: 'Email-first', value: 'Digital offers convert best via email sequences and retargeting, not cold traffic.' },
      { label: 'Marketplace risk', value: 'Vendor quality varies wildly. Check refund rates and vendor history.' },
    ],
    tips: ['Buy and test the product before promoting', 'Negotiate higher rates directly with vendors after volume', 'Pre-sell the outcome, not the product'],
  },
  {
    slug: 'finance', name: 'Finance & High-Ticket', icon: 'dollar',
    tagline: 'Credit cards, banking, investing, trading',
    description: 'Banks and fintechs pay $50–$250 per approved customer. The best CPA money in affiliate marketing — but approval is strict and compliance rules apply.',
    avg_commission: '$25–$250 CPA', best_channels: 'SEO listicles · Personal-finance sites · YouTube · Reddit/forums',
    features: [
      { label: 'Flat CPA payouts', value: 'Fixed dollars per lead/approval — $50–$250+ for credit cards and broker signups.' },
      { label: 'Strict approval', value: 'Programs vet traffic quality and your site; compliance disclosure is mandatory.' },
      { label: 'Evergreen demand', value: 'Credit score, best cards, investing guides — search demand never dries up.' },
      { label: 'High EPC ceiling', value: 'Best-in-class programs run $2–$8 EPC, dwarfing retail.' },
      { label: 'Geo-restricted', value: 'Most offers are US/UK only — check eligibility before building content.' },
    ],
    tips: ['Disclose affiliate relationships (FTC rules)', 'Target intent keywords like "best credit card for travel"', 'Refresh offers monthly — bonuses change'],
  },
  {
    slug: 'travel', name: 'Travel & Hospitality', icon: 'globe',
    tagline: 'Hotels, flights, tours, experiences',
    description: 'Booking platforms share a slice of their commission with you. Low percentages, but high order values and long planning cycles make it a reliable niche.',
    avg_commission: '2–8% of booking', best_channels: 'Destination guides · Itineraries · Instagram/TikTok · Email',
    features: [
      { label: 'Revenue-share model', value: 'You get 25–50% of the platform\'s own commission — small % of big bookings.' },
      { label: 'High order values', value: '$1,000 trips make 4% meaningful; luxury travel raises it further.' },
      { label: 'Long research phase', value: 'Travelers research for weeks — content compounds and keeps converting.' },
      { label: 'Seasonality', value: 'Summer/holiday peaks; plan content 2–3 months before travel seasons.' },
      { label: 'Visual platforms', value: 'Instagram Reels & TikTok destination content drives strong click-through.' },
    ],
    tips: ['Build evergreen destination hubs, not one-off posts', 'Use long cookies (Booking 30d) to your advantage', 'Monetize itinerary PDFs via email capture'],
  },
  {
    slug: 'fashion', name: 'Fashion & Beauty', icon: 'star',
    tagline: 'Apparel, cosmetics, accessories',
    description: 'Visual-first niche built for Instagram, TikTok and LTK. 5–20% rates with strong brand loyalty; fast trend cycles reward speed.',
    avg_commission: '5–20%', best_channels: 'TikTok/Reels · LTK · Hauls · Instagram shops',
    features: [
      { label: 'Creator platforms', value: 'LTK, ShopMy and rewardStyle turn looks into shoppable content automatically.' },
      { label: 'High AOV loyalty', value: 'Fans buy repeatedly from the same creator — building a lookbook compounds.' },
      { label: 'Fast trends', value: 'Posting within days of a trend matters more than SEO depth here.' },
      { label: 'Brand programs', value: 'Direct programs (SHEIN, ASOS) plus networks (Awin, Rakuten) host most brands.' },
      { label: 'UGC content', value: 'Try-on hauls and GRWM videos consistently outperform static posts.' },
    ],
    tips: ['Use the "shop my looks" page pattern', 'Tag items within 24h of posting for algorithm boost', 'Mix fast fashion volume with premium brand higher rates'],
  },
  {
    slug: 'hosting', name: 'Web Hosting & Domains', icon: 'layers',
    tagline: 'Flat payouts for hosting signups',
    description: 'The classic high-payout niche: $50–$150 per hosting signup. Massive search volume from "how to start a website" audiences, and tutorials practically sell themselves.',
    avg_commission: '$50–$150 CPA', best_channels: 'SEO tutorials · YouTube · Comparisons · Communities',
    features: [
      { label: 'Flat signup payouts', value: 'Fixed $50–$150 per sale regardless of plan price — predictable earnings.' },
      { label: 'Evergreen tutorials', value: '"How to start a blog" content converts for years with near-zero updates.' },
      { label: 'High competition', value: 'Every big blogger promotes hosting — differentiate with niche tutorials.' },
      { label: 'Rebill extensions', value: 'Some programs pay on renewals too; ask about recurring terms.' },
      { label: 'Speed & uptime angles', value: 'Performance tests and migration guides build trust better than coupons.' },
    ],
    tips: ['Build a live demo site on your recommended host', 'Track uptime screenshots as proof', 'A/B test "how to" vs "best X" titles'],
  },
  {
    slug: 'vpn', name: 'VPN & Cybersecurity', icon: 'shield',
    tagline: 'Privacy tools with huge payouts',
    description: 'VPNs pay 40–100% of the first year plus recurring renewals. One of the highest-CPS niches in tech, powered by privacy concerns and YouTube sponsorships.',
    avg_commission: '40–100% + recurring', best_channels: 'YouTube · SEO comparisons · Privacy blogs · Podcasts',
    features: [
      { label: 'First-year CPS', value: '40–100% of the first subscription payment — $50–$100+ per sale.' },
      { label: 'Recurring renewals', value: 'Most programs pay 30% on renewals, so old content keeps paying.' },
      { label: 'Discount-driven', value: 'Affiliates get exclusive coupons (e.g. "70% off + 3 months free") that raise CR.' },
      { label: 'Trust content wins', value: 'Speed tests, leak tests and honest reviews outperform listicles.' },
      { label: 'Sponsorship market', value: 'VPNs are the biggest YouTube sponsorship category — pitch directly.' },
    ],
    tips: ['Use your exclusive coupon in video descriptions and pinned comments', 'Re-test speeds quarterly and update posts', 'Disclose sponsorships clearly'],
  },
  {
    slug: 'education', name: 'Education & E-Learning', icon: 'book',
    tagline: 'Courses, languages, skills platforms',
    description: 'Learning platforms pay 20–45% or flat enrollment bonuses. Evergreen demand for skill-building content and a natural fit for tutorial creators.',
    avg_commission: '20–45%', best_channels: 'SEO skill guides · YouTube · Email courses · LinkedIn',
    features: [
      { label: 'Enrollment bonuses', value: 'Platforms like Skillshare pay flat fees per trial signup; others pay %.' },
      { label: 'Skill-based SEO', value: '"Learn Python", "best Excel course" keywords convert for years.' },
      { label: 'New-year spikes', value: 'January resolution traffic doubles; prep content in November.' },
      { label: 'Creator synergy', value: 'Your own courses + affiliate courses coexist in one funnel.' },
      { label: 'Marketplace variety', value: 'Udemy, Coursera, MasterClass, Babbel — each has distinct rates.' },
    ],
    tips: ['Bundle free content with paid course recommendations', 'Target job-change intent ("career switch to X")', 'Track enrollment seasonality in your niche'],
  },
  {
    slug: 'health', name: 'Health & Fitness', icon: 'activity',
    tagline: 'Meal kits, supplements, wearables',
    description: 'Meal-kit CPA, supplement revshare and wearable programs. Strong recurring potential and passionate audiences — with stricter compliance expectations.',
    avg_commission: '$10–$30 CPA / 10–30%', best_channels: 'Transformation content · YouTube · Instagram · Email',
    features: [
      { label: 'Meal-kit CPA', value: 'HelloFresh-style programs pay $15–$25 per first box — simple, proven CPA.' },
      { label: 'Subscription economics', value: 'Kits and apps convert once but pay on the first cycle only — size the funnel.' },
      { label: 'Compliance matters', value: 'No medical claims; FTC rules apply to health testimonials.' },
      { label: 'Transformation content', value: 'Before/after stories and routines outperform product pitches.' },
      { label: 'Discount-led', value: 'First-box discounts are the standard hook; use program-specific codes.' },
    ],
    tips: ['Share realistic results only', 'Use first-box discount codes as email lead magnets', 'Pair with wearable/supplement offers to raise basket size'],
  },
  {
    slug: 'creator', name: 'Creator & Freelance Tools', icon: 'sparkle',
    tagline: 'Marketplaces & tools for side-hustlers',
    description: 'Freelance marketplaces (CPA up to $150) and creator software (recurring 25–30%). Perfect for audiences building side incomes.',
    avg_commission: '$30–$150 CPA / 25–30% recurring', best_channels: 'Side-hustle content · YouTube · Twitter/X · Email',
    features: [
      { label: 'Marketplace CPA', value: 'Fiverr/Upwork pay per first-time buyer — high one-shot payouts.' },
      { label: 'Recurring tool stacks', value: 'Adobe, Envato, stock sites pay monthly % of subscriptions.' },
      { label: 'Side-hustle audience', value: 'Content about earning online converts this catalog extremely well.' },
      { label: 'Tutorial-driven', value: 'Tool walkthroughs sell the tool better than review posts.' },
      { label: 'Seasonal pushes', value: 'New-year goal setting and September back-to-school spikes.' },
    ],
    tips: ['Show real gig results to build trust', 'Create tool-comparison matrices', 'Cross-sell marketplace + tools in one funnel'],
  },
  {
    slug: 'gaming', name: 'Gaming & Entertainment', icon: 'video',
    tagline: 'Games, gear, streaming programs',
    description: 'Creator programs from Epic/Twitch plus gear affiliates (Logitech, SteelSeries). Streaming audiences convert gear links with unusual loyalty.',
    avg_commission: '5–20% / creator codes', best_channels: 'Twitch/YouTube streams · Gear guides · Discord',
    features: [
      { label: 'Creator codes', value: 'Epic Support-A-Creator style codes pay a share when your code is used in-game.' },
      { label: 'Gear affiliates', value: 'Peripherals pay 5–15%; setups content is a proven converter.' },
      { label: 'Loyal communities', value: 'Streamers\' audiences buy on recommendation — conversion is trust-based.' },
      { label: 'Launch spikes', value: 'Game and hardware launches create predictable traffic bursts.' },
      { label: 'Multi-platform', value: 'Monetize the same link on Twitch, YouTube, Discord and X.' },
    ],
    tips: ['Put links in stream overlays and !commands', 'Publish setup lists with Amazon + brand links', 'Time content around launch calendars'],
  },
];

export const PROGRAMS = [
  // ---------------- retail
  { name: 'Amazon Associates', type: 'retail', network: 'Amazon', commission_type: 'CPS', rate_min: 1, rate_max: 20, rate_label: '1–20% by category', cookie_days: 1, payout_method: 'Amazon Pay / gift card', min_payout: 10, approval: 'Easy', epc: 0.45, growth: 6, popularity: 98, url: 'https://affiliate-program.amazon.com/', blurb: 'The world\'s biggest catalog. Rates are low but conversion trust is unmatched — everyone already shops there.', promo: 'Seasonal category bonuses (e.g. extra rates during Prime Day).', pros: ['Universal brand trust', 'Huge catalog — any niche works', 'Cookie covers full cart, not just the linked item'], cons: ['Low base rates', '24-hour cookie'], best_for: ['Product reviews', 'Gift guides', 'Setup lists', 'Roundups'] },
  { name: 'Walmart Affiliates', type: 'retail', network: 'Walmart / Impact', commission_type: 'CPS', rate_min: 1, rate_max: 4, rate_label: '1–4%', cookie_days: 3, payout_method: 'Direct deposit', min_payout: 50, approval: 'Easy', epc: 0.32, growth: 8, popularity: 82, url: 'https://affiliates.walmart.com/', blurb: 'Second-biggest US retailer program. Groceries & essentials angle works well for family-audience creators.', promo: 'Rolling category boosts around holidays.', pros: ['Better grocery/essentials rates', '3-day cookie', 'Strong Q4 volume'], cons: ['Rates below Amazon in most categories'], best_for: ['Family content', 'Deal roundups', 'Home & garden'] },
  { name: 'eBay Partner Network', type: 'retail', network: 'eBay', commission_type: 'CPS', rate_min: 1, rate_max: 5, rate_label: '1–5% by category', cookie_days: 1, payout_method: 'PayPal / bank', min_payout: 10, approval: 'Easy', epc: 0.3, growth: 3, popularity: 75, url: 'https://partnernetwork.ebay.com/', blurb: 'Unique angle: used, refurbished and collectible goods. Great for budget-tech and thrift audiences.', promo: 'Double commissions during seasonal events.', pros: ['Refurbished/budget niche', 'Auction & fixed-price listings', 'Global inventory'], cons: ['24h cookie', 'Inventory volatility'], best_for: ['Budget tech', 'Collectibles', 'Thrift content'] },
  { name: 'AliExpress Affiliates', type: 'retail', network: 'AliExpress / Admitad', commission_type: 'CPS', rate_min: 3, rate_max: 9, rate_label: '3–9%', cookie_days: 3, payout_method: 'Bank / Payoneer', min_payout: 16, approval: 'Easy', epc: 0.24, growth: 11, popularity: 70, url: 'https://portals.aliexpress.com/', blurb: 'Cheap-tech and gadget audiences love it. Rates beat Amazon for low-price items; shipping times are the objection to address.', promo: 'Extra rates during 11.11 and summer sales.', pros: ['Higher rates on low-ticket items', 'Deal-heavy culture = click-friendly', 'Big catalog'], cons: ['Long shipping hurts conversion', 'Quality perception'], best_for: ['Gadget roundups', 'Deal channels', 'DIY/electronics'] },
  // ---------------- saas
  { name: 'Shopify Affiliate Program', type: 'saas', network: 'Shopify', commission_type: 'CPS + recurring', rate_min: 30, rate_max: 150, rate_label: '$30–$150 per sale', cookie_days: 30, payout_method: 'PayPal', min_payout: 25, approval: 'Medium', epc: 2.1, growth: 12, popularity: 88, url: 'https://www.shopify.com/affiliates', blurb: 'The gold standard of SaaS affiliates: paid per referred store owner. "How to start a store" content converts for years.', promo: 'Up to $150 for Plus plan referrals.', pros: ['Proven high EPC', '30-day cookie', 'Evergreen how-to demand'], cons: ['Competitive space', 'Approval requires real audience'], best_for: ['E-commerce tutorials', 'Side-hustle content', 'YouTube'] },
  { name: 'Semrush', type: 'saas', network: 'Semrush / Impact', commission_type: 'Recurring', rate_min: 40, rate_max: 40, rate_label: '40% recurring', cookie_days: 120, payout_method: 'PayPal', min_payout: 10, approval: 'Medium', epc: 2.4, growth: 9, popularity: 85, url: 'https://www.semrush.com/partner/', blurb: '40% recurring on the SEO suite every marketer knows. The 120-day cookie is among the longest in SaaS.', promo: 'Free trial + exclusive audience discounts.', pros: ['Long 120-day cookie', 'High recurring rate', 'Trusted brand'], cons: ['Saturated among SEO blogs'], best_for: ['SEO tutorials', 'Marketing newsletters', 'Tool comparisons'] },
  { name: 'Monday.com', type: 'saas', network: 'Monday / Impact', commission_type: 'Recurring', rate_min: 25, rate_max: 25, rate_label: '25% recurring', cookie_days: 90, payout_method: 'Bank / PayPal', min_payout: 100, approval: 'Medium', epc: 1.8, growth: 10, popularity: 80, url: 'https://monday.com/partners', blurb: 'Work-OS darling with strong brand demand. Project-management templates and tutorials convert well.', promo: '14-day trial for referred users.', pros: ['90-day cookie', 'High LTV product', 'Broad audience fit'], cons: ['$100 payout minimum'], best_for: ['Productivity content', 'PM tutorials', 'Business blogs'] },
  { name: 'Notion (PartnerStack)', type: 'saas', network: 'PartnerStack', commission_type: 'Recurring', rate_min: 20, rate_max: 30, rate_label: '20–30% recurring', cookie_days: 60, payout_method: 'PayPal', min_payout: 10, approval: 'Easy', epc: 1.4, growth: 14, popularity: 83, url: 'https://www.notion.so/partners', blurb: 'The internet\'s favorite productivity tool. Template creators monetize twice: template sales + affiliate commissions.', promo: 'Free plan + paid referrals earn recurring.', pros: ['Easy approval', 'Template synergy', 'Cult community'], cons: ['Free plan limits conversion'], best_for: ['Productivity creators', 'Template sellers', 'Study-tube'] },
  { name: 'ConvertKit (Kit)', type: 'saas', network: 'Kit / PartnerStack', commission_type: 'Recurring', rate_min: 30, rate_max: 30, rate_label: '30% recurring', cookie_days: 60, payout_method: 'PayPal', min_payout: 10, approval: 'Easy', epc: 1.6, growth: 7, popularity: 76, url: 'https://kit.com/affiliates', blurb: 'Creator-native email platform — your audience of creators is exactly its customer base.', promo: 'Free plan up to 10k subscribers.', pros: ['Creator-fit brand', '30% for life of customer', 'Easy approval'], cons: ['Niche audience required'], best_for: ['Creator newsletters', 'Email marketing tutorials'] },
  // ---------------- digital
  { name: 'ClickBank', type: 'digital', network: 'ClickBank', commission_type: 'CPS/revshare', rate_min: 10, rate_max: 75, rate_label: '10–75%', cookie_days: 60, payout_method: 'Direct deposit / wire', min_payout: 10, approval: 'Easy', epc: 0.9, growth: 5, popularity: 86, url: 'https://www.clickbank.com/', blurb: 'The classic digital marketplace: supplements, e-books, courses. Massive rates, weekly payouts, and full funnel analytics.', promo: 'Weekly payouts with a $10 minimum.', pros: ['Huge rates', 'Fast weekly payouts', 'Built-in analytics'], cons: ['Vendor quality varies', 'Some niches saturated'], best_for: ['Email funnels', 'Review sites', 'Paid traffic'] },
  { name: 'Digistore24', type: 'digital', network: 'Digistore24', commission_type: 'CPS/revshare', rate_min: 20, rate_max: 85, rate_label: '20–85%', cookie_days: 180, payout_method: 'Bank / PayPal', min_payout: 50, approval: 'Easy', epc: 0.8, growth: 8, popularity: 72, url: 'https://www.digistore24.com/', blurb: 'European ClickBank with the longest cookies in digital (up to 180 days) and strong EU offer catalog.', promo: 'Vendor contests with rate boosts.', pros: ['Very long cookies', 'High rates', 'EU market strength'], cons: ['German-centric dashboard'], best_for: ['EU audiences', 'Info-products', 'DACH niches'] },
  { name: 'Teachable', type: 'digital', network: 'Teachable', commission_type: 'Recurring', rate_min: 30, rate_max: 30, rate_label: '30% recurring', cookie_days: 90, payout_method: 'PayPal', min_payout: 50, approval: 'Easy', epc: 1.2, growth: 10, popularity: 78, url: 'https://teachable.com/affiliates', blurb: 'Course creators promoting to course creators — the meta niche. 30% recurring on every plan tier.', promo: 'Free plan + trial options for leads.', pros: ['Recurring 30%', '90-day cookie', 'Meta-niche synergy'], cons: ['$50 payout threshold'], best_for: ['Creator economy content', 'Course-selling tutorials'] },
  { name: 'Kajabi', type: 'digital', network: 'Kajabi', commission_type: 'Recurring', rate_min: 30, rate_max: 30, rate_label: '30% recurring', cookie_days: 60, payout_method: 'PayPal', min_payout: 25, approval: 'Easy', epc: 1.5, growth: 6, popularity: 71, url: 'https://kajabi.com/affiliates', blurb: 'Premium all-in-one platform for experts. Higher price point = higher commission dollars per sale.', promo: 'Free trial for referred experts.', pros: ['High ticket = high $ per sale', '30% recurring', 'Trusted in expert niches'], cons: ['Premium price limits volume'], best_for: ['Coaching niches', 'Expert interviews'] },
  // ---------------- finance
  { name: 'Chase Credit Cards', type: 'finance', network: 'Rakuten / Impact', commission_type: 'CPA', rate_min: 50, rate_max: 100, rate_label: '$50–$100 per approval', cookie_days: 30, payout_method: 'Direct deposit', min_payout: 50, approval: 'Hard', epc: 3.5, growth: 4, popularity: 90, url: 'https://www.chase.com/', blurb: 'The most recognizable card issuer. Points-and-miles content converts Chase cards extremely well.', promo: 'Rotating signup bonuses (e.g. 60k points).', pros: ['Premium brand', 'High CPA', 'Points communities'], cons: ['Strict approval', 'US-only offers'], best_for: ['Travel/points blogs', 'Personal finance sites'] },
  { name: 'Capital One', type: 'finance', network: 'Rakuten', commission_type: 'CPA', rate_min: 50, rate_max: 150, rate_label: '$50–$150 per approval', cookie_days: 30, payout_method: 'Direct deposit', min_payout: 50, approval: 'Hard', epc: 3.2, growth: 6, popularity: 84, url: 'https://www.capitalone.com/', blurb: 'Strong cashback card lineup. "Best cashback card" comparisons are evergreen winners.', promo: 'Cashback bonus campaigns.', pros: ['High CPA ceiling', 'Cashback angle converts', 'Mass appeal'], cons: ['Approval criteria strict'], best_for: ['Cashback content', 'Credit card comparison sites'] },
  { name: 'American Express', type: 'finance', network: 'CJ Affiliate', commission_type: 'CPA', rate_min: 50, rate_max: 120, rate_label: '$50–$120 per approval', cookie_days: 30, payout_method: 'Direct deposit', min_payout: 50, approval: 'Hard', epc: 3.6, growth: 3, popularity: 80, url: 'https://www.americanexpress.com/', blurb: 'Premium cards with premium payouts. Business-card content pays particularly well.', promo: 'Elevated signup bonus windows.', pros: ['Premium payouts', 'Business-card niche', 'Brand prestige'], cons: ['Niche audience needed'], best_for: ['Business finance', 'Premium travel'] },
  { name: 'eToro', type: 'finance', network: 'eToro / Impact', commission_type: 'CPA', rate_min: 100, rate_max: 250, rate_label: '$100–$250 per funded trader', cookie_days: 60, payout_method: 'Bank', min_payout: 100, approval: 'Medium', epc: 2.8, growth: 9, popularity: 77, url: 'https://www.etoro.com/', blurb: 'Social trading platform paying for funded accounts. Trading-education content is the natural fit.', promo: 'Bonus for first deposits.', pros: ['High CPA', '60-day cookie', 'Global reach'], cons: ['Compliance rules', 'Funded-account condition'], best_for: ['Trading education', 'Finfluencers'] },
  { name: 'Binance', type: 'finance', network: 'Binance', commission_type: 'Revshare', rate_min: 20, rate_max: 40, rate_label: '20–40% of trading fees', cookie_days: 365, payout_method: 'Crypto', min_payout: 20, approval: 'Easy', epc: 1.1, growth: 2, popularity: 72, url: 'https://www.binance.com/en/activity/referral', blurb: 'Share of trading fees for a year. Crypto audiences self-select; disclosure rules apply.', promo: 'Fee discounts for referred users.', pros: ['12-month cookie', 'Recurring fee share', 'Easy signup'], cons: ['Crypto volatility', 'Regulatory gray zones'], best_for: ['Crypto content', 'Trading communities'] },
  // ---------------- travel
  { name: 'Booking.com', type: 'travel', network: 'Booking.com', commission_type: 'Revshare', rate_min: 25, rate_max: 40, rate_label: '25–40% of Booking commission', cookie_days: 30, payout_method: 'Bank / PayPal', min_payout: 100, approval: 'Easy', epc: 0.9, growth: 7, popularity: 88, url: 'https://www.booking.com/affiliates.html', blurb: 'The largest OTA affiliate program. Destination guides convert bookings with a 30-day cookie.', promo: 'Seasonal placement bonuses.', pros: ['Huge inventory', '30-day cookie', 'Global reach'], cons: ['$100 payout threshold', 'Low % of %'], best_for: ['Destination guides', 'Itineraries', 'Hotel roundups'] },
  { name: 'TripAdvisor', type: 'travel', network: 'TripAdvisor / CJ', commission_type: 'Revshare', rate_min: 50, rate_max: 50, rate_label: '50% of referral commission', cookie_days: 14, payout_method: 'Bank', min_payout: 50, approval: 'Easy', epc: 0.6, growth: 4, popularity: 79, url: 'https://www.tripadvisor.com/Affiliates', blurb: 'Trusted reviews brand. Works well for review-heavy travel content.', promo: 'Click-based campaigns available.', pros: ['Trust brand', 'Review synergy', 'Easy approval'], cons: ['14-day cookie'], best_for: ['Hotel reviews', 'Activity roundups'] },
  { name: 'Expedia Group', type: 'travel', network: 'Expedia / Impact', commission_type: 'Revshare', rate_min: 2, rate_max: 6, rate_label: '2–6% of booking', cookie_days: 7, payout_method: 'Bank', min_payout: 50, approval: 'Medium', epc: 0.7, growth: 5, popularity: 76, url: 'https://expediaaffiliates.com/', blurb: 'Flights + hotels + packages under one brand family (Vrbo, Hotels.com).', promo: 'Package booking boosts.', pros: ['Multi-product', 'Flight inventory', 'Brand reach'], cons: ['Short 7-day cookie'], best_for: ['Family travel', 'Flight deals'] },
  { name: 'Viator', type: 'travel', network: 'Viator / Impact', commission_type: 'CPS', rate_min: 8, rate_max: 8, rate_label: '8% of tour booking', cookie_days: 30, payout_method: 'PayPal', min_payout: 50, approval: 'Easy', epc: 0.8, growth: 10, popularity: 74, url: 'https://www.viator.com/partners', blurb: 'Tours & experiences marketplace. "Things to do in X" content is underrated and converts well.', promo: 'Activity-specific campaigns.', pros: ['Underrated niche', '30-day cookie', 'Easy approval'], cons: ['Seasonal demand'], best_for: ['Things-to-do guides', 'City break content'] },
  // ---------------- fashion
  { name: 'SHEIN', type: 'fashion', network: 'SHEIN / Awin', commission_type: 'CPS', rate_min: 10, rate_max: 20, rate_label: '10–20%', cookie_days: 30, payout_method: 'PayPal', min_payout: 20, approval: 'Easy', epc: 0.5, growth: 15, popularity: 87, url: 'https://www.shein.com/affiliate', blurb: 'Fast-fashion juggernaut with TikTok-native audience. Hauls convert fast at these rates.', promo: 'Frequent sitewide sales to hook audiences.', pros: ['High rates for fashion', 'TikTok-native', '30-day cookie'], cons: ['Low AOV', 'Brand perception'], best_for: ['Hauls', 'TikTok/Reels', 'Budget fashion'] },
  { name: 'Sephora', type: 'fashion', network: 'Sephora / Rakuten', commission_type: 'CPS', rate_min: 5, rate_max: 10, rate_label: '5–10%', cookie_days: 30, payout_method: 'Check / direct', min_payout: 50, approval: 'Medium', epc: 0.7, growth: 6, popularity: 81, url: 'https://www.sephora.com/affiliates', blurb: 'Beauty authority brand. GRWM and routine videos drive strong conversion.', promo: 'Holiday sets campaigns.', pros: ['Prestige brand', 'Beauty community trust', 'High AOV'], cons: ['Approval needs beauty content'], best_for: ['Beauty creators', 'GRWM content'] },
  { name: 'ASOS', type: 'fashion', network: 'ASOS / Awin', commission_type: 'CPS', rate_min: 2, rate_max: 7, rate_label: '2–7%', cookie_days: 30, payout_method: 'Bank', min_payout: 20, approval: 'Easy', epc: 0.5, growth: 8, popularity: 78, url: 'https://www.asos.com/affiliate/', blurb: 'Youth fashion giant with strong EU/UK presence and frequent sales to ride.', promo: 'Outlet & sale events.', pros: ['EU/UK strength', 'Sales calendar', 'Easy approval'], cons: ['Lower base rate'], best_for: ['Trend content', 'UK/EU audiences'] },
  { name: 'LTK (rewardStyle)', type: 'fashion', network: 'LTK', commission_type: 'CPS', rate_min: 10, rate_max: 20, rate_label: '10–20% (varies by brand)', cookie_days: 30, payout_method: 'Direct deposit', min_payout: 100, approval: 'Medium', epc: 0.6, growth: 9, popularity: 75, url: 'https://www.shopltk.com/', blurb: 'The creator shopping platform — your looks become shoppable and brands pay directly.', promo: 'Brand collaborations unlock via LTK.', pros: ['Shoppable everything', 'Brand collabs', 'Creator-native'], cons: ['$100 payout min', 'US-centric'], best_for: ['Fashion creators', 'Instagram/TikTok'] },
  // ---------------- hosting
  { name: 'Bluehost', type: 'hosting', network: 'Bluehost / Impact', commission_type: 'CPA', rate_min: 65, rate_max: 130, rate_label: '$65–$130 per signup', cookie_days: 90, payout_method: 'PayPal', min_payout: 100, approval: 'Easy', epc: 1.9, growth: 3, popularity: 85, url: 'https://www.bluehost.com/affiliates', blurb: 'The classic hosting affiliate. "How to start a blog" content has minted six-figure affiliates here.', promo: 'Seasonal rate bumps to $130.', pros: ['Proven payout history', '90-day cookie', 'Easy approval'], cons: ['Performance reputation mixed'], best_for: ['Blogging tutorials', 'How-to-start content'] },
  { name: 'Hostinger', type: 'hosting', network: 'Hostinger', commission_type: 'CPA', rate_min: 60, rate_max: 95, rate_label: '$60–$95 per signup', cookie_days: 30, payout_method: 'PayPal / bank', min_payout: 100, approval: 'Easy', epc: 1.7, growth: 12, popularity: 82, url: 'https://www.hostinger.com/affiliates', blurb: 'Fast-growing budget host with strong global reach and a generous starter plan to promote.', promo: 'Extra commissions during sales events.', pros: ['Cheap plans convert', 'Global brand growth', 'Easy approval'], cons: ['30-day cookie'], best_for: ['Budget hosting', 'Global audiences', 'Side-hustle content'] },
  { name: 'SiteGround', type: 'hosting', network: 'SiteGround', commission_type: 'CPA', rate_min: 50, rate_max: 125, rate_label: '$50–$125 per signup', cookie_days: 60, payout_method: 'PayPal', min_payout: 100, approval: 'Easy', epc: 1.8, growth: 5, popularity: 79, url: 'https://www.siteground.com/affiliates', blurb: 'Performance-focused host beloved by WordPress pros — reviews write themselves.', promo: 'Tiered payouts for volume.', pros: ['Respected performance', '60-day cookie', 'Tiered rates'], cons: ['Higher plan prices'], best_for: ['WordPress content', 'Performance reviews'] },
  { name: 'Namecheap', type: 'hosting', network: 'Namecheap', commission_type: 'CPS', rate_min: 20, rate_max: 35, rate_label: '20–35%', cookie_days: 45, payout_method: 'PayPal', min_payout: 50, approval: 'Easy', epc: 0.9, growth: 6, popularity: 74, url: 'https://www.namecheap.com/affiliates/', blurb: 'Domains + hosting with solid rates and a brand that screams value.', promo: 'Domain-sale tie-ins.', pros: ['Domain + hosting combo', '45-day cookie', 'Value brand'], cons: ['Lower $ per sale'], best_for: ['Domain tutorials', 'DIY web content'] },
  { name: 'Cloudways', type: 'hosting', network: 'Cloudways', commission_type: 'CPA', rate_min: 50, rate_max: 125, rate_label: '$50–$125 per signup', cookie_days: 90, payout_method: 'PayPal', min_payout: 100, approval: 'Easy', epc: 2.2, growth: 9, popularity: 73, url: 'https://www.cloudways.com/en/affiliate.php', blurb: 'Managed cloud hosting for devs and agencies — higher prices, higher payouts, technical audiences.', promo: 'Hybrid payout options.', pros: ['High EPC', '90-day cookie', 'Dev audience trusts reviews'], cons: ['Technical niche'], best_for: ['Dev tutorials', 'Agency content'] },
  // ---------------- vpn
  { name: 'NordVPN', type: 'vpn', network: 'NordVPN / Impact', commission_type: 'CPS + recurring', rate_min: 40, rate_max: 100, rate_label: '40–100% + 30% renewals', cookie_days: 30, payout_method: 'PayPal / bank', min_payout: 10, approval: 'Easy', epc: 2.5, growth: 8, popularity: 90, url: 'https://nordvpn.com/affiliates/', blurb: 'The VPN affiliate benchmark: 40–100% of first-year plans plus 30% recurring. Massive sponsorship ecosystem.', promo: 'Exclusive "70% off + 3 months free" coupons.', pros: ['Highest-known payouts', 'Recurring 30%', 'Brand recognition'], cons: ['Saturated among YouTubers'], best_for: ['YouTube', 'Privacy blogs', 'Comparison SEO'] },
  { name: 'Surfshark', type: 'vpn', network: 'Surfshark / Impact', commission_type: 'CPS + recurring', rate_min: 40, rate_max: 40, rate_label: '40% + renewals', cookie_days: 30, payout_method: 'PayPal', min_payout: 10, approval: 'Easy', epc: 2.0, growth: 14, popularity: 84, url: 'https://surfshark.com/affiliates', blurb: 'Value-positioned Nord sibling with unlimited devices — family/streaming angles convert.', promo: 'Long-plan discounts for audiences.', pros: ['Unlimited devices angle', 'Growing brand', 'Easy approval'], cons: ['Younger brand'], best_for: ['Streaming content', 'Family tech', 'Budget privacy'] },
  { name: 'ExpressVPN', type: 'vpn', network: 'ExpressVPN / Impact', commission_type: 'CPS + recurring', rate_min: 35, rate_max: 40, rate_label: '35–40% + renewals', cookie_days: 30, payout_method: 'PayPal', min_payout: 50, approval: 'Easy', epc: 2.1, growth: 4, popularity: 82, url: 'https://www.expressvpn.com/affiliates', blurb: 'Premium reputation, premium price — review-led audiences convert on trust.', promo: 'Standard 3-months-free offer.', pros: ['Premium trust', 'Speed reputation', 'Established program'], cons: ['Higher price = more objections'], best_for: ['Security reviews', 'Tech publications'] },
  { name: 'Proton VPN', type: 'vpn', network: 'Proton / Impact', commission_type: 'CPS', rate_min: 40, rate_max: 40, rate_label: '40% first payment', cookie_days: 30, payout_method: 'Bank', min_payout: 100, approval: 'Easy', epc: 1.6, growth: 11, popularity: 76, url: 'https://protonvpn.com/partners', blurb: 'Privacy-first brand (free tier exists) with a devoted community.', promo: 'Free tier funnel for audiences.', pros: ['Privacy cred', 'Free tier funnel', 'Swiss brand'], cons: ['$100 payout min'], best_for: ['Privacy activists', 'Security content'] },
  // ---------------- education
  { name: 'Coursera', type: 'education', network: 'Coursera / Impact', commission_type: 'CPS', rate_min: 20, rate_max: 45, rate_label: '20–45%', cookie_days: 30, payout_method: 'Bank', min_payout: 100, approval: 'Medium', epc: 1.1, growth: 9, popularity: 80, url: 'https://www.coursera.org/affiliates', blurb: 'University-grade courses with career-switch intent behind every search.', promo: 'Specialization discounts.', pros: ['Career intent traffic', 'Brand prestige', '30-day cookie'], cons: ['$100 payout min'], best_for: ['Career-change content', 'Skill guides'] },
  { name: 'Skillshare', type: 'education', network: 'Skillshare / Impact', commission_type: 'CPA', rate_min: 7, rate_max: 7, rate_label: '$7 per trial signup', cookie_days: 30, payout_method: 'PayPal', min_payout: 10, approval: 'Easy', epc: 0.8, growth: 5, popularity: 78, url: 'https://www.skillshare.com/en/affiliates', blurb: 'Creator-taught classes; the free-trial model converts curious creatives easily.', promo: '1-month free trial hook.', pros: ['Easy trial conversion', 'Creator-fit', 'Low payout min'], cons: ['Low flat CPA'], best_for: ['Creative niches', 'Hobby content'] },
  { name: 'Udemy', type: 'education', network: 'Udemy / Impact', commission_type: 'CPS', rate_min: 15, rate_max: 40, rate_label: '15–40% (varies)', cookie_days: 7, payout_method: 'PayPal', min_payout: 50, approval: 'Easy', epc: 0.9, growth: 6, popularity: 79, url: 'https://www.udemy.com/affiliate/', blurb: 'Largest course marketplace; the $10-sale culture means volume is the play.', promo: 'Frequent flash sales to ride.', pros: ['Huge catalog', 'Sales create urgency', 'Easy approval'], cons: ['7-day cookie', 'Low price points'], best_for: ['Course roundups', 'Skill content'] },
  { name: 'Babbel', type: 'education', network: 'Babbel / Impact', commission_type: 'CPS', rate_min: 25, rate_max: 40, rate_label: '25–40%', cookie_days: 30, payout_method: 'Bank', min_payout: 100, approval: 'Medium', epc: 1.3, growth: 7, popularity: 70, url: 'https://www.babbel.com/en/affiliate-program', blurb: 'Language learning with strong January resolution spikes.', promo: 'Lifetime-deal windows.', pros: ['New-year spikes', 'Evergreen demand', '30-day cookie'], cons: ['$100 payout min'], best_for: ['Language content', 'Travel prep'] },
  // ---------------- health
  { name: 'HelloFresh', type: 'health', network: 'HelloFresh / Impact', commission_type: 'CPA', rate_min: 15, rate_max: 25, rate_label: '$15–$25 per first box', cookie_days: 14, payout_method: 'Bank', min_payout: 100, approval: 'Medium', epc: 1.4, growth: 5, popularity: 83, url: 'https://www.hellofresh.com/affiliates', blurb: 'Meal-kit CPA with household name recognition and endless discount codes to share.', promo: 'Up to 10 free meals codes.', pros: ['Brand recognition', 'Proven CPA', 'Discount hooks'], cons: ['14-day cookie', '$100 min'], best_for: ['Family content', 'Budget cooking', 'Lifestyle'] },
  { name: 'Noom', type: 'health', network: 'Noom / Impact', commission_type: 'CPA', rate_min: 20, rate_max: 30, rate_label: '$20–$30 per trial', cookie_days: 30, payout_method: 'Bank', min_payout: 100, approval: 'Medium', epc: 1.5, growth: 3, popularity: 72, url: 'https://www.noom.com/', blurb: 'Psychology-based weight program; New Year and summer spikes are real.', promo: 'Trial discounts for leads.', pros: ['Seasonal spikes', '30-day cookie', 'Higher CPA'], cons: ['Health niche compliance'], best_for: ['Wellness content', 'Transformation stories'] },
  { name: 'Huel', type: 'health', network: 'Huel / Impact', commission_type: 'CPS', rate_min: 10, rate_max: 15, rate_label: '10–15%', cookie_days: 30, payout_method: 'Bank', min_payout: 50, approval: 'Easy', epc: 0.7, growth: 9, popularity: 74, url: 'https://huel.com/pages/affiliates', blurb: 'Nutrition brand with cult following and strong subscription model.', promo: 'Starter bundle discounts.', pros: ['Subscriptions = LTV', 'Cult community', 'Easy approval'], cons: ['Niche audience'], best_for: ['Productivity', 'Fitness', 'Busy-professional content'] },
  { name: 'MyProtein', type: 'health', network: 'MyProtein / Awin', commission_type: 'CPS', rate_min: 8, rate_max: 15, rate_label: '8–15%', cookie_days: 30, payout_method: 'Bank', min_payout: 25, approval: 'Easy', epc: 0.6, growth: 7, popularity: 75, url: 'https://www.myprotein.com/affiliates.list', blurb: 'Supplement giant with constant deals — gym content converts at scale.', promo: 'Frequent 40–50% off events.', pros: ['Deal calendar', 'Gym audience', 'Easy approval'], cons: ['Low AOV'], best_for: ['Gym content', 'Deal pages'] },
  // ---------------- creator
  { name: 'Fiverr', type: 'creator', network: 'Fiverr', commission_type: 'CPA/revshare', rate_min: 15, rate_max: 150, rate_label: 'Up to $150 CPA + 30% first order', cookie_days: 30, payout_method: 'PayPal', min_payout: 50, approval: 'Easy', epc: 1.7, growth: 10, popularity: 84, url: 'https://www.fiverr.com/affiliate-program', blurb: 'Freelance marketplace with tiered CPA up to $150 depending on service category.', promo: 'Category-specific CPA tiers.', pros: ['High CPA ceiling', 'Side-hustle fit', '30-day cookie'], cons: ['First-order-only revshare'], best_for: ['Side-hustle content', 'Freelancing guides'] },
  { name: 'Adobe', type: 'creator', network: 'Adobe / Impact', commission_type: 'CPS + recurring', rate_min: 8, rate_max: 85, rate_label: '8%–85% (trial-based)', cookie_days: 30, payout_method: 'Bank', min_payout: 25, approval: 'Medium', epc: 1.9, growth: 6, popularity: 85, url: 'https://www.adobe.com/affiliates.html', blurb: 'Creative Cloud is a subscription every creator already considers — tutorials sell it.', promo: 'Free-trial conversions pay well.', pros: ['Recurring subscriptions', 'Tutorial synergy', 'Brand power'], cons: ['Rate complexity'], best_for: ['Design tutorials', 'Creative content'] },
  { name: 'Envato Market', type: 'creator', network: 'Envato / Impact', commission_type: 'CPS', rate_min: 30, rate_max: 30, rate_label: '30% (up to $120/sale)', cookie_days: 90, payout_method: 'PayPal', min_payout: 50, approval: 'Easy', epc: 1.0, growth: 4, popularity: 70, url: 'https://envato.com/affiliates/', blurb: 'Themes, templates, stock — 30% of every marketplace sale with a generous cookie.', promo: 'Bundle campaigns.', pros: ['30% flat', '90-day cookie', 'Template audiences'], cons: ['One-time purchases'], best_for: ['Web dev tutorials', 'Template roundups'] },
  { name: 'Upwork', type: 'creator', network: 'Upwork / Impact', commission_type: 'CPA', rate_min: 50, rate_max: 100, rate_label: '$50–$100 per new client', cookie_days: 30, payout_method: 'Bank', min_payout: 100, approval: 'Medium', epc: 1.5, growth: 8, popularity: 77, url: 'https://www.upwork.com/affiliates', blurb: 'Freelance marketplace CPA — pair with Fiverr content for double monetization.', promo: 'New-client bonuses.', pros: ['High CPA', 'Freelancer intent', 'Pair with Fiverr'], cons: ['$100 min payout'], best_for: ['Freelance how-tos', 'Career content'] },
  // ---------------- gaming
  { name: 'Epic Games (Support-A-Creator)', type: 'gaming', network: 'Epic Games', commission_type: 'Revshare', rate_min: 5, rate_max: 5, rate_label: '5% of in-game spend', cookie_days: 14, payout_method: 'Bank', min_payout: 100, approval: 'Easy', epc: 0.4, growth: 3, popularity: 76, url: 'https://www.epicgames.com/site/support-a-creator', blurb: 'Fans enter your code in Fortnite and you earn 5% of their V-Bucks and game spend.', promo: 'Seasonal item-shop traffic.', pros: ['Zero-friction code', 'Fortnite scale', 'Easy approval'], cons: ['5% of game spend'], best_for: ['Fortnite creators', 'Streamers'] },
  { name: 'Logitech G', type: 'gaming', network: 'Logitech / Impact', commission_type: 'CPS', rate_min: 5, rate_max: 10, rate_label: '5–10%', cookie_days: 30, payout_method: 'Bank', min_payout: 50, approval: 'Easy', epc: 0.8, growth: 6, popularity: 73, url: 'https://www.logitechg.com/', blurb: 'The gear brand streamers already recommend — setup videos convert naturally.', promo: 'Launch-window campaigns.', pros: ['Setup-content fit', 'Brand trust', '30-day cookie'], cons: ['Moderate rates'], best_for: ['Setup tours', 'Gear guides'] },
  { name: 'SteelSeries', type: 'gaming', network: 'SteelSeries / Impact', commission_type: 'CPS', rate_min: 5, rate_max: 10, rate_label: '5–10%', cookie_days: 30, payout_method: 'Bank', min_payout: 50, approval: 'Easy', epc: 0.7, growth: 7, popularity: 68, url: 'https://steelseries.com/', blurb: 'Esports-grade peripherals with a loyal fan base.', promo: 'Esports team tie-ins.', pros: ['Esports cred', 'Loyal fans'], cons: ['Smaller catalog'], best_for: ['Esports content', 'Peripheral reviews'] },
  { name: 'Humble Bundle', type: 'gaming', network: 'Humble Bundle', commission_type: 'CPS', rate_min: 10, rate_max: 15, rate_label: '10–15%', cookie_days: 30, payout_method: 'PayPal', min_payout: 10, approval: 'Easy', epc: 0.6, growth: 5, popularity: 69, url: 'https://www.humblebundle.com/affiliates', blurb: 'Charity game bundles with urgency baked in — deals content thrives.', promo: 'Time-limited bundles.', pros: ['Urgency converts', 'Charity angle', 'Easy approval'], cons: ['Bundle inventory varies'], best_for: ['Deal channels', 'Indie game content'] },
];

export function seedMarket() {
  const typeCount = db.prepare('SELECT COUNT(*) n FROM affiliate_types').get().n;
  if (typeCount > 0) return;
  const insType = db.prepare(`INSERT INTO affiliate_types (slug, name, icon, tagline, description, avg_commission, best_channels, features, tips, sort) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const tx = db.transaction(() => {
    TYPES.forEach((t, i) => insType.run(t.slug, t.name, t.icon, t.tagline, t.description, t.avg_commission, t.best_channels, JSON.stringify(t.features), JSON.stringify(t.tips), i));
    const insProg = db.prepare(`INSERT INTO programs (type_slug, name, network, commission_type, rate_min, rate_max, rate_label, cookie_days, payout_method, min_payout, approval, epc, growth, popularity, url, blurb, promo, pros, cons, best_for, verified) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    PROGRAMS.forEach(p => insProg.run(p.type, p.name, p.network, p.commission_type, p.rate_min, p.rate_max, p.rate_label, p.cookie_days, p.payout_method, p.min_payout, p.approval, p.epc, p.growth, p.popularity, p.url, p.blurb, p.promo, JSON.stringify(p.pros), JSON.stringify(p.cons), JSON.stringify(p.best_for), 0));
  });
  tx();
  console.log(`[market] seeded ${TYPES.length} affiliate types, ${PROGRAMS.length} programs`);
}
