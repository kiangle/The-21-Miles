/**
 * 21 Miles — Mock Atlas Backend
 * 
 * This file IS Atlas for development. It returns the exact response shapes
 * the live Atlas API will return. When Atlas is ready, flip VITE_USE_MOCK=false.
 * 
 * Contains:
 * - Bootstrap response (world + profiles + entry + routes + what-ifs)
 * - Cascade path responses (every node with UI metadata + path_labels)
 * - Household impact (Kenya nurse + driver with low/base/high)
 * - Check connections (9 discoverable hidden laws)
 * - What-if results (3 scenarios with comparison data)
 * - Live parameters (real-time market snapshot)
 * - Route GeoJSON references
 */

const WORLD_ID = 'scenario:world_hormuz_energy';
const CRISIS_DAY = 12;
const RF = 0.15; // ±15% uncertainty range

// ═══════════════════════════════════════════════
//  PROFILES (ExposureProfiles from Atlas)
// ═══════════════════════════════════════════════

const PROFILES = {
  kenya_nurse: {
    id: "exposure_kenya_nurse",
    profile_type: "role",
    label: "Amara — Nurse, Nairobi",
    flag: "🇰🇪",
    currency: "KSh",
    region_code: "KE",
    role: "nurse",
    tagline: "The medicine she needs travels through the strait. So does the fuel that powers its delivery.",
    baseline_income: 50000,
    income_source: "Kenya National Bureau of Statistics, 2025",
    confidence: "estimated",
    version: 1,
    as_of_date: "2026-03-12T00:00:00Z",
    unique_exposure: [
      "85% of petroleum imported — nearly all through Gulf routes",
      "Hospital supplies (IV bags, gloves, syringes) are petrochemical products",
      "Indian generic medicines priced in USD — rupee + shilling both falling",
      "Food already 50%+ of household income for bottom 40%",
    ],
    vulnerability_factors: {
      gulf_dependency: 0.85,
      food_share_of_income: 0.50,
      dollar_debt_exposure: "high",
      fragile_state_proximity: "20 of 39 in Africa",
    },
    household_basket: {
      preCrisis: {
        fuel:      { amount: 180,   unit: "KSh/L",     label: "petrol" },
        heating:   { amount: 2200,  unit: "KSh/month", label: "cooking fuel" },
        food:      { amount: 25000, unit: "KSh/month", label: "food" },
        transport: { amount: 6000,  unit: "KSh/month", label: "matatu/fuel" },
      },
      crisisMultipliers: { fuel: 1.55, heating: 1.50, food: 1.40, transport: 1.55 },
      multiplierNotes: "All amplified by shilling depreciation. Food 50%+ of income for bottom 40%.",
    },
    human_endpoints: {
      energy: "Matatu fares climb 20% — daily wage workers can't afford the commute to earn the wage.",
      hospital: "The supply closet: half-empty. IV bag count down to 55% of normal. No announcement. Just fewer bags.",
      food: "A maize farmer does the math: fertilizer up 40%, diesel up 35%. She considers not planting this season.",
      job: "Three of five regular drivers on the Mombasa route have stopped driving. The margin is gone.",
    },
  },
  kenya_driver: {
    id: "exposure_kenya_driver",
    profile_type: "role",
    label: "Joseph — Truck Driver, Mombasa Road",
    flag: "🇰🇪",
    currency: "KSh",
    region_code: "KE",
    role: "driver",
    tagline: "The medicine the nurse needs is in his container. The economics say don't drive.",
    baseline_income: 50000,
    income_source: "Kenya National Bureau of Statistics, 2025",
    confidence: "estimated",
    version: 1,
    as_of_date: "2026-03-12T00:00:00Z",
    unique_exposure: [
      "Diesel is the single largest operating cost — 55% of route revenue",
      "Mombasa-Nairobi run margin: KSh 8,000 pre-crisis → KSh 1,200 post",
      "Container dwell time at Mombasa port tripled",
      "Three of five regular drivers have stopped — route economics broken",
    ],
    vulnerability_factors: {
      gulf_dependency: 0.85,
      diesel_share_of_costs: 0.55,
      route_margin_pre: 8000,
      route_margin_post: 1200,
    },
    household_basket: {
      preCrisis: {
        fuel:      { amount: 180,   unit: "KSh/L",     label: "diesel" },
        heating:   { amount: 2200,  unit: "KSh/month", label: "cooking fuel" },
        food:      { amount: 25000, unit: "KSh/month", label: "food" },
        transport: { amount: 6000,  unit: "KSh/month", label: "truck fuel" },
      },
      crisisMultipliers: { fuel: 1.55, heating: 1.50, food: 1.40, transport: 1.55 },
    },
    human_endpoints: {
      energy: "Diesel KSh 180 → KSh 279. The Mombasa run used to leave KSh 8,000. Now: KSh 1,200.",
      hospital: "The container with IV bags sits at Mombasa port. Three extra days. Nobody pays storage.",
      food: "The chai stop in Mtito Andei raised prices. Small thing. But it's the same everywhere.",
      job: "You can drive or you can eat. You can't do both the way you used to.",
    },
  },
};

// ═══════════════════════════════════════════════
//  CASCADE GRAPH — every node with UI + path_labels
// ═══════════════════════════════════════════════

const NODES: Record<string, any> = {
  // ── ENTRY ──────────────────────────────────
  "scenario:shock_strait_closure": {
    id: "scenario:shock_strait_closure",
    label: "Strait of Hormuz Closure",
    node_type: "shock",
    ui: {
      number: "20,000,000", unit: "barrels per day", context: "stopped flowing",
      color: "#C44B3F", size: "hero",
      tag: null, domain: null, domainColor: null,
      line: "The Strait of Hormuz closed on March 2. One-fifth of the world's oil. One-fifth of its gas. Gone.",
      detail: "US-Israeli strikes on Iran began February 28. By March 2, AIS tracking showed zero tanker transits. 150+ vessels anchored outside. Insurance pulled. The blockade was achieved not by mines — but by paperwork.",
      connection: null, youKey: null,
    },
    out: [
      { to: "scenario:shock_oil_price_spike",      edge: "Causes",   path_label: "What happened to prices",    s: 3, lag: "Immediate" },
      { to: "scenario:shock_lng_halt",              edge: "Causes",   path_label: "It's not just oil",          s: 3, lag: "Immediate" },
      { to: "scenario:cape_reroute",                edge: "Causes",   path_label: "Where the ships went",       s: 3, lag: "ShortTerm" },
      { to: "scenario:shock_insurance_withdrawal",  edge: "Triggers", path_label: "How it was shut down",       s: 3, lag: "Immediate" },
    ],
  },

  // ── OIL PRICE ──────────────────────────────
  "scenario:shock_oil_price_spike": {
    id: "scenario:shock_oil_price_spike",
    label: "Oil Price Spike",
    node_type: "shock",
    ui: {
      number: "+31%", unit: "in eight days", context: "Brent crude: $70 → $93",
      color: "#E8B94A", size: "large",
      tag: "Day 7", domain: "Markets", domainColor: "#E8B94A",
      line: "The fastest oil spike since 2008. Goldman Sachs projects $100 next week.",
      detail: null,
      connection: null, youKey: "energy",
    },
    out: [
      { to: "scenario:diesel_spike_kenya",  edge: "LeadsTo",  path_label: "Your fuel cost — the full math",  s: 3, lag: "ShortTerm" },
      { to: "scenario:china_hoarding",      edge: "Triggers", path_label: "Who's making it worse",           s: 2, lag: "ShortTerm" },
      { to: "scenario:em_currency_crash",   edge: "Causes",   path_label: "The invisible second hit",        s: 2, lag: "ShortTerm" },
      { to: "scenario:spr_depletion",       edge: "Triggers", path_label: "The last safety net",             s: 2, lag: "ShortTerm" },
    ],
  },

  // ── LNG HALT ───────────────────────────────
  "scenario:shock_lng_halt": {
    id: "scenario:shock_lng_halt",
    label: "Qatar LNG Halt",
    node_type: "shock",
    ui: {
      number: "20%", unit: "of global LNG", context: "vanished overnight",
      color: "#C44B3F", size: "large",
      tag: "Day 3", domain: "Energy", domainColor: "#E8B94A",
      line: "Qatar's Ras Laffan was struck. A fifth of the world's natural gas. The IEA says: no alternative routes exist.",
      detail: null, connection: null, youKey: null,
    },
    out: [
      { to: "scenario:eu_gas_doubles",     edge: "Causes", path_label: "What this does to European heating", s: 3, lag: "Immediate" },
      { to: "scenario:fertilizer_spike",   edge: "Causes", path_label: "The connection nobody sees",         s: 3, lag: "ShortTerm", cond: "Same CH₄ molecule — heating fuel = fertilizer feedstock" },
    ],
  },

  // ── INSURANCE ──────────────────────────────
  "scenario:shock_insurance_withdrawal": {
    id: "scenario:shock_insurance_withdrawal",
    label: "Insurance Withdrawal",
    node_type: "shock",
    ui: {
      number: "0", unit: "tankers", context: "passing through the Strait",
      color: "#C44B3F", size: "large",
      tag: "Day 3", domain: "Insurance", domainColor: "#E8B94A",
      line: "Not by mines. Not by warships. By an insurance form. Lloyd's pulled coverage and every ship stopped.",
      detail: "150+ vessels anchored, engines idling. Without insurance, no owner risks a $200M ship. One captain tried running it with his transponder off. He made it. Nobody followed.",
      connection: null, youKey: null,
    },
    out: [
      { to: "scenario:spare_capacity_trap", edge: "LeadsTo", path_label: "Why there's no backup",       s: 3, lag: "Immediate" },
    ],
  },

  // ── CAPE REROUTE ───────────────────────────
  "scenario:cape_reroute": {
    id: "scenario:cape_reroute",
    label: "Ships Reroute via Cape",
    node_type: "consequence",
    ui: {
      number: "+14", unit: "extra days", context: "per voyage around Africa",
      color: "#D4763C", size: "large",
      tag: "Day 7–14", domain: "Shipping", domainColor: "#5BA3CF",
      line: "Every ship goes the long way. Fourteen extra days. $1.2 million more per trip. MSC adds $800 per container.",
      detail: null, connection: null, youKey: null,
    },
    out: [
      { to: "scenario:fleet_shrink", edge: "Causes", path_label: "The real cost — ships themselves", s: 3, lag: "ShortTerm" },
    ],
  },

  // ── FLEET SHRINK ───────────────────────────
  "scenario:fleet_shrink": {
    id: "scenario:fleet_shrink",
    label: "Fleet Capacity Shrinks",
    node_type: "consequence",
    ui: {
      number: "−18%", unit: "fleet capacity", context: "same ships, longer routes",
      color: "#D4763C", size: "large",
      tag: "Day 14", domain: "Shipping", domainColor: "#5BA3CF",
      line: "Oil, food, and medicine travel on the same ships. When those ships take 14 extra days for oil, fewer are left for everything else.",
      detail: null,
      connection: "One bottleneck feeding three crises. Your fuel, your food, your hospital — all competing for deck space on vessels that just became 18% scarcer.",
      youKey: null,
    },
    out: [
      { to: "scenario:mombasa_freight_delay", edge: "Causes",    path_label: "What this does to Mombasa port", s: 3, lag: "ShortTerm" },
      { to: "scenario:food_price_spike",      edge: "Amplifies", path_label: "Your groceries",                 s: 2, lag: "MediumTerm", cond: "Same ships carry oil AND food — fleet competition" },
    ],
  },

  // ── DIESEL SPIKE (Kenya-specific) ──────────
  "scenario:diesel_spike_kenya": {
    id: "scenario:diesel_spike_kenya",
    label: "Kenya Diesel Price Spike",
    node_type: "impact",
    ui: {
      number: "KSh 279", unit: "per litre", context: "was KSh 180 twelve days ago",
      color: "#D4763C", size: "hero",
      tag: "Day 12", domain: "Your fuel", domainColor: "#D4763C",
      line: "Diesel jumped 55%. Every matatu fare. Every freight run. Every generator. More expensive overnight.",
      detail: null, connection: null, youKey: "energy",
    },
    out: [
      { to: "scenario:mombasa_freight_delay", edge: "Amplifies", path_label: "What this does to deliveries",         s: 2, lag: "ShortTerm" },
      { to: "scenario:compression",           edge: "LeadsTo",   path_label: "What this costs your family per month", s: 3, lag: "ShortTerm" },
    ],
  },

  // ── MOMBASA FREIGHT DELAY ──────────────────
  "scenario:mombasa_freight_delay": {
    id: "scenario:mombasa_freight_delay",
    label: "Mombasa Port Freight Delay",
    node_type: "consequence",
    ui: {
      number: "3×", unit: "container dwell time", context: "at Mombasa port",
      color: "#D4763C", size: "large",
      tag: "Day 14–21", domain: "Freight", domainColor: "#D4763C",
      line: "Containers sit at port three times longer than normal. Ships arrive late. Trucks can't afford the fuel to collect them. The supply chain has three broken links, not one.",
      detail: null, connection: null, youKey: "job",
    },
    out: [
      { to: "scenario:medicine_supply_halt",   edge: "Causes",   path_label: "What this does to the hospital",        s: 3, lag: "MediumTerm" },
      { to: "scenario:food_price_spike",       edge: "Amplifies", path_label: "What this does to food prices",         s: 2, lag: "MediumTerm" },
    ],
  },

  // ── MEDICINE SUPPLY HALT ───────────────────
  "scenario:medicine_supply_halt": {
    id: "scenario:medicine_supply_halt",
    label: "Medicine Supply Pressure",
    node_type: "consequence",
    ui: {
      number: "55%", unit: "of normal supply", context: "IV bags, gloves, syringes",
      color: "#C44B3F", size: "large",
      tag: "Day 21–30", domain: "Health", domainColor: "#5BA3CF",
      line: "Medical plastics are made from petroleum. The same refinery cut that reduces fuel also cuts medical supply production. Same barrel. Same plant.",
      detail: null,
      connection: "Closed strait → insurance → reroute → freight delay → refinery cut → petrochemical reduction → hospital supply shortage. Six steps. Four domains. One cascade.",
      youKey: "hospital",
    },
    out: [
      { to: "scenario:pharma_cost_crisis",  edge: "Amplifies", path_label: "It gets worse — the medicine supply", s: 2, lag: "MediumTerm", cond: "Two paths to same empty shelf: production halt + procurement cost" },
      { to: "scenario:compression",         edge: "LeadsTo",   path_label: "What it all costs your family",        s: 3, lag: "MediumTerm" },
    ],
  },

  // ── PHARMA COST CRISIS ─────────────────────
  "scenario:pharma_cost_crisis": {
    id: "scenario:pharma_cost_crisis",
    label: "Pharmaceutical Cost Crisis",
    node_type: "consequence",
    ui: {
      number: "60%", unit: "of world's vaccines", context: "made in India — now at risk",
      color: "#C44B3F", size: "large",
      tag: "Day 30–60", domain: "Health", domainColor: "#5BA3CF",
      line: "India makes most generic medicines. Raw materials priced in dollars. The rupee fell 12%. The medicine exists. The factory exists. The math doesn't work.",
      detail: "A pharmacist in Chennai can't restock antibiotics. 30+ countries that depend on Indian generics feel the impact. Kenya is one of them.",
      connection: "Oil spike → currency crash → pharma ingredients unaffordable → production slows → hospitals on three continents short. Seven steps. Four domains.",
      youKey: "hospital",
    },
    out: [
      { to: "scenario:compression", edge: "LeadsTo", path_label: "The total cost to your family", s: 3, lag: "MediumTerm" },
    ],
  },

  // ── EU GAS DOUBLES ─────────────────────────
  "scenario:eu_gas_doubles": {
    id: "scenario:eu_gas_doubles",
    label: "European Gas Price Doubles",
    node_type: "consequence",
    ui: {
      number: "€60+", unit: "per MWh", context: "was €30 last week",
      color: "#C44B3F", size: "hero",
      tag: "Already here", domain: "European energy", domainColor: "#E8B94A",
      line: "150 million households heat with gas. Germany spent 3 years replacing Russian gas — with Qatari LNG that transits Hormuz.",
      detail: null, connection: null, youKey: null,
    },
    out: [
      { to: "scenario:fertilizer_spike", edge: "Causes", path_label: "Where else this leads", s: 3, lag: "ShortTerm", cond: "Same CH₄ molecule — heating fuel = fertilizer feedstock" },
    ],
  },

  // ── FERTILIZER SPIKE ───────────────────────
  "scenario:fertilizer_spike": {
    id: "scenario:fertilizer_spike",
    label: "Fertilizer Price Spike",
    node_type: "consequence",
    ui: {
      number: "CH₄", unit: "natural gas", context: "one molecule — two crises",
      color: "#C8A96E", size: "hero",
      tag: "Hidden link", domain: "Energy → Food", domainColor: "#C8A96E",
      line: "The gas that heats a home in Hamburg is chemically identical to the feedstock for nitrogen fertilizer in a field outside Nakuru.",
      detail: "One molecule. Two crises. When it doubles in Europe, your food costs more in Kenya.",
      connection: "One molecule connects a thermostat in Hamburg to a farmer's planting decision outside Nakuru. The energy crisis and the food crisis are the same story told in two languages.",
      youKey: "food",
    },
    out: [
      { to: "scenario:food_price_spike", edge: "Amplifies", path_label: "What happens to your groceries", s: 3, lag: "MediumTerm" },
    ],
  },

  // ── FOOD PRICE SPIKE ───────────────────────
  "scenario:food_price_spike": {
    id: "scenario:food_price_spike",
    label: "Food Price Spike",
    node_type: "consequence",
    ui: {
      number: "KSh 35,000", unit: "per month groceries", context: "was KSh 25,000",
      color: "#D4763C", size: "hero",
      tag: "Day 30–60", domain: "Your kitchen", domainColor: "#D4763C",
      line: "Transport, fertilizer, fleet competition, currency weakness — four forces pushing your food bill from four directions at once.",
      detail: "When food already takes 50% of household income and all four forces push simultaneously — that's not inflation. That's a survival threshold.",
      connection: null, youKey: "food",
    },
    out: [
      { to: "scenario:compression", edge: "LeadsTo", path_label: "Your total monthly hit — all costs combined", s: 3, lag: "MediumTerm" },
    ],
  },

  // ── CHINA HOARDING ─────────────────────────
  "scenario:china_hoarding": {
    id: "scenario:china_hoarding",
    label: "China Accelerates Hoarding",
    node_type: "consequence",
    ui: {
      number: "+1.8M", unit: "bbl/day extra", context: "China is stockpiling",
      color: "#E8B94A", size: "large",
      tag: "Day 7–14", domain: "Geopolitics", domainColor: "#C44B3F",
      line: "The world's largest oil importer is buying faster — draining the spot market everyone else needs.",
      detail: "Every barrel China hoards is one barrel your country can't buy. China's been filling reserves for a year. They're prepared. Most countries aren't.",
      connection: null, youKey: null,
    },
    out: [
      { to: "scenario:mombasa_freight_delay", edge: "Amplifies", path_label: "The spiral this creates", s: 2, lag: "ShortTerm", cond: "China spot buying drains supply available to East Africa" },
    ],
  },

  // ── EM CURRENCY CRASH ──────────────────────
  "scenario:em_currency_crash": {
    id: "scenario:em_currency_crash",
    label: "Emerging Market Currencies Crash",
    node_type: "consequence",
    ui: {
      number: "−12%", unit: "Kenya shilling", context: "against the dollar",
      color: "#C44B3F", size: "large",
      tag: "Day 14–30", domain: "Finance", domainColor: "#C44B3F",
      line: "When you spend more dollars on energy, dollars flow out. The shilling drops. Everything priced in dollars gets more expensive. You're hit twice.",
      detail: null, connection: null, youKey: "energy",
    },
    out: [
      { to: "scenario:pharma_cost_crisis", edge: "Causes",    path_label: "What this does to medicine",   s: 2, lag: "MediumTerm", cond: "Pharma raw materials priced in USD — currency fall = cost spike" },
      { to: "scenario:food_price_spike",   edge: "Amplifies", path_label: "What this does to food",       s: 2, lag: "MediumTerm", cond: "Weaker currency = more expensive food imports" },
    ],
  },

  // ── SPARE CAPACITY TRAP ────────────────────
  "scenario:spare_capacity_trap": {
    id: "scenario:spare_capacity_trap",
    label: "Spare Capacity Trapped",
    node_type: "consequence",
    ui: {
      number: "90%", unit: "of spare capacity", context: "behind the same closed Strait",
      color: "#C44B3F", size: "hero",
      tag: "The fine print", domain: "Policy", domainColor: "#4A9B7F",
      line: "The emergency backup exists. It's in countries that export through Hormuz. The backup is behind the same locked door.",
      detail: "OPEC+ pledged 206,000 extra barrels. The disruption is 20 million. That's one percent. Pipeline bypasses cover 13-28% of the gap at best.",
      connection: null, youKey: null,
    },
    out: [
      { to: "scenario:spr_depletion", edge: "Triggers", path_label: "The last safety net", s: 2, lag: "ShortTerm" },
    ],
  },

  // ── SPR DEPLETION ──────────────────────────
  "scenario:spr_depletion": {
    id: "scenario:spr_depletion",
    label: "Strategic Reserves Draining",
    node_type: "consequence",
    ui: {
      number: "155", unit: "days remaining", context: "US strategic reserve at current draw",
      color: "#D4763C", size: "large",
      tag: "Day 30–60", domain: "Policy", domainColor: "#4A9B7F",
      line: "400 million barrels. Draining. The market watches the rate of decline and asks: what comes after the safety net runs out?",
      detail: "Reserves were designed for 90-day disruptions. There is no plan for longer. There is no plan B behind plan B.",
      connection: null, youKey: null,
    },
    out: [],
  },

  // ── COMPRESSION (payoff node) ──────────────
  "scenario:compression": {
    id: "scenario:compression",
    label: "Monthly Budget Compression",
    node_type: "impact",
    ui: {
      number: "KSh 14,400", unit: "extra per month", context: "heating + food + transport combined",
      color: "#C44B3F", size: "hero",
      tag: "Your monthly budget", domain: "Your family", domainColor: "#C8A96E",
      line: "Before this crisis: KSh 33,200 on heating, food, and transport. Now: KSh 47,600. Same life. Higher price. Because of a strait.",
      detail: null,
      connection: null, youKey: null, // Compression uses full household math, not a single youKey
    },
    out: [],
  },
};

// ═══════════════════════════════════════════════
//  HIDDEN CONNECTIONS (for check-connections)
// ═══════════════════════════════════════════════

const CONNECTIONS = [
  { id: "conn_refinery_medical",   needs: ["scenario:mombasa_freight_delay", "scenario:medicine_supply_halt"],    text: "Same refinery produces fuel AND medical plastics. One cut — two crises." },
  { id: "conn_fleet_food",         needs: ["scenario:fleet_shrink", "scenario:food_price_spike"],                 text: "Same ships carry oil and food. One fleet reduction — two shortages." },
  { id: "conn_ch4_molecule",       needs: ["scenario:eu_gas_doubles", "scenario:fertilizer_spike"],               text: "CH₄ — one molecule heats homes AND grows food. Same price shock. Different continent." },
  { id: "conn_fx_pharma",          needs: ["scenario:em_currency_crash", "scenario:pharma_cost_crisis"],          text: "Currency crash → medicine shortage. The oil crisis became a health crisis through the exchange rate." },
  { id: "conn_two_paths",          needs: ["scenario:medicine_supply_halt", "scenario:pharma_cost_crisis"],       text: "Two paths to the same empty shelf: Japan can't make supplies, India can't afford ingredients." },
  { id: "conn_china_drain",        needs: ["scenario:china_hoarding", "scenario:mombasa_freight_delay"],          text: "China's stockpiling drains the spot market Kenya needs. One country's preparation is another's crisis." },
  { id: "conn_driver_nurse",       needs: ["scenario:diesel_spike_kenya", "scenario:medicine_supply_halt"],       text: "The nurse wonders why medicine is late. The driver knows — but they'll never meet. 21 miles of water connects them through 6 intermediaries." },
  { id: "conn_food_unrest",        needs: ["scenario:food_price_spike", "scenario:compression"],                  text: "Food + fuel above 50% of income and both spiking. The Arab Spring started at this threshold." },
  { id: "conn_fertilizer_food",    needs: ["scenario:fertilizer_spike", "scenario:food_price_spike"],             text: "The fertilizer a Nakuru farmer can't afford was priced by the same molecule a Hamburg pensioner can't heat with." },
];

// ═══════════════════════════════════════════════
//  WHAT-IF SCENARIOS
// ═══════════════════════════════════════════════

const WHAT_IFS = {
  whatif_redsea: {
    id: "whatif_redsea",
    label: "What if Houthis resume Red Sea attacks?",
    hint: "The Cape route was the only alternative. If that's contested too —",
    node_type: "shock",
    direction: "worsens",
    probability: 0.45,
    confidence: "estimated",
    deltas: [
      { label: "Fleet capacity",     baseline: "82%",  altered: "60%",        delta: "−22%" },
      { label: "Oil price",          baseline: "$105", altered: "$135+",      delta: "+$30" },
      { label: "Route delay",        baseline: "+14d", altered: "+30d",       delta: "doubled" },
      { label: "Medicine supply",    baseline: "55%",  altered: "30%",        delta: "crisis level" },
      { label: "Monthly hit (KSh)",  baseline: "14,400", altered: "19,200",   delta: "+4,800" },
    ],
    household_multiplier: 1.33,
    narrative: "There is no safe corridor left between Asia and the Middle East. The Cape was the slack. Remove it, and there is none. IV bags drop to 30% of normal. Three of five drivers stop. The cascade has nowhere left to reroute.",
  },
  whatif_reserves: {
    id: "whatif_reserves",
    label: "What if IEA coordinates an SPR release?",
    hint: "400 million barrels — but finite and one-shot",
    node_type: "move",
    direction: "improves",
    probability: 0.70,
    confidence: "estimated",
    deltas: [
      { label: "Oil price",          baseline: "$105", altered: "$90",         delta: "−$15" },
      { label: "Diesel (KSh)",       baseline: "279",  altered: "240",         delta: "−39" },
      { label: "Medicine supply",    baseline: "55%",  altered: "70%",         delta: "+15%" },
      { label: "Monthly hit (KSh)",  baseline: "14,400", altered: "10,800",    delta: "−3,600" },
      { label: "SPR runway",         baseline: "155d", altered: "90d",         delta: "clock accelerates" },
    ],
    household_multiplier: 0.75,
    narrative: "It buys time. Every barrel released today is one less for tomorrow. Diesel eases to KSh 240. The Mombasa run pays again — barely. But everyone knows this is borrowed time. If the Strait stays closed past 90 days, the SPR gamble becomes the crisis.",
  },
  whatif_ceasefire: {
    id: "whatif_ceasefire",
    label: "What if a ceasefire opens in week 3?",
    hint: "Oman brokered Iran talks before. Could they again?",
    node_type: "move",
    direction: "improves",
    probability: 0.15,
    confidence: "estimated",
    deltas: [
      { label: "Oil price",          baseline: "$105", altered: "$82 by month 3", delta: "−$23" },
      { label: "Diesel (KSh)",       baseline: "279",  altered: "220",             delta: "−59" },
      { label: "Medicine supply",    baseline: "55%",  altered: "85% by week 8",   delta: "slow recovery" },
      { label: "Monthly hit (KSh)",  baseline: "14,400", altered: "7,200 by month 3", delta: "halved, not erased" },
      { label: "Insurance",          baseline: "Pulled", altered: "2-4 months to normalize", delta: "gradual" },
    ],
    household_multiplier: 0.50,
    narrative: "Ceasefire doesn't mean recovery. Mine clearance takes months. Insurance restoration is gradual. Diesel drops to KSh 220 — not back to 180. Never back to 180. The run pays again. The debt from the weeks it didn't — that stays. The lesson: even the best outcome takes months. Some damage is permanent.",
  },
};

// ═══════════════════════════════════════════════
//  LIVE PARAMETERS (mock of real-time feed)
// ═══════════════════════════════════════════════

const LIVE_PARAMS = {
  world_id: WORLD_ID,
  updated_at: new Date().toISOString(),
  parameters: {
    brent_crude_usd:      { value: 105.20,  source: "bloomberg",  updated: "2026-03-12T05:45:00Z" },
    ais_hormuz_transits:  { value: 0,       source: "kpler",      updated: "2026-03-12T04:00:00Z" },
    eu_gas_ttf_mwh:       { value: 64.30,   source: "bloomberg",  updated: "2026-03-12T05:45:00Z" },
    us_spr_million_bbl:   { value: 392,     source: "eia",        updated: "2026-03-11T00:00:00Z" },
    cape_route_extra_days: { value: 14,     source: "drewry",     updated: "2026-03-11T00:00:00Z" },
    kenya_diesel_ksh:     { value: 279,     source: "epra_kenya", updated: "2026-03-12T00:00:00Z" },
    kenya_shilling_usd:   { value: 0.0071,  source: "ecb",        updated: "2026-03-12T00:00:00Z" },
    fleet_capacity_pct:   { value: 82,      source: "kpler",      updated: "2026-03-12T04:00:00Z" },
    houthi_active:        { value: false,   source: "acled",      updated: "2026-03-11T00:00:00Z" },
    medicine_supply_pct:  { value: 55,      source: "who_estimate", updated: "2026-03-11T00:00:00Z" },
    food_price_index_chg: { value: 22,      source: "fao",        updated: "2026-03-10T00:00:00Z" },
  },
  crisis_day: CRISIS_DAY,
  last_topology_change: null,
};

// ═══════════════════════════════════════════════
//  ROUTE GEOMETRY (references — actual GeoJSON in public/geo/)
// ═══════════════════════════════════════════════

const ROUTES = [
  { id: "hormuz_transit",    label: "Hormuz Transit",      status: "blocked",  color: "#C44B3F" },
  { id: "cape_reroute",      label: "Cape of Good Hope",   status: "active",   color: "#D4763C" },
  { id: "suez_canal",        label: "Suez Canal",          status: "active",   color: "#5BA3CF" },
  { id: "indian_ocean_east", label: "Indian Ocean (East)", status: "stressed", color: "#E8B94A" },
  { id: "mombasa_approach",  label: "Mombasa Approach",    status: "delayed",  color: "#D4763C" },
  { id: "mombasa_nairobi",   label: "Mombasa–Nairobi Road", status: "active",  color: "#C8A96E" },
];

const CHOKEPOINTS = [
  { id: "hormuz",     label: "Strait of Hormuz",     lat: 26.5, lng: 56.3,  status: "closed" },
  { id: "bab_mandeb", label: "Bab el-Mandeb",        lat: 12.6, lng: 43.3,  status: "open" },
  { id: "suez",       label: "Suez Canal",            lat: 30.0, lng: 32.3,  status: "open" },
  { id: "malacca",    label: "Strait of Malacca",     lat: 1.4,  lng: 103.8, status: "open" },
  { id: "cape",       label: "Cape of Good Hope",     lat: -34.4, lng: 18.5, status: "congested" },
];

// ═══════════════════════════════════════════════
//  HOUSEHOLD IMPACT CALCULATOR
// ═══════════════════════════════════════════════

const CATS = { fuel: "fuel", heating: "heating", food: "food", transport: "transport" };

function computeHouseholdImpact(profile: any) {
  const pre = profile.household_basket.preCrisis;
  const mult = profile.household_basket.crisisMultipliers;
  const impacts: Record<string, any> = {};
  let lo = 0, ba = 0, hi = 0;
  for (const [k] of Object.entries(CATS)) {
    const a = pre[k].amount, m = mult[k];
    const mL = +(m * (1 - RF)).toFixed(2), mH = +(m * (1 + RF)).toFixed(2);
    impacts[k] = {
      pre: a, post_low: +(a * mL).toFixed(0), post_base: +(a * m).toFixed(0), post_high: +(a * mH).toFixed(0),
      unit: pre[k].unit, label: pre[k].label, multiplier: m, range: [mL, mH],
    };
    lo += a * mL - a; ba += a * m - a; hi += a * mH - a;
  }
  const inc = profile.baseline_income;
  return {
    profile: profile.label, flag: profile.flag, currency: profile.currency,
    role: profile.role, region_code: profile.region_code,
    confidence: profile.confidence, as_of_date: profile.as_of_date,
    baseline_income: inc,
    impacts,
    monthly_hit: { low: Math.round(lo), base: Math.round(ba), high: Math.round(hi) },
    pct_of_income: { low: +((lo/inc)*100).toFixed(1), base: +((ba/inc)*100).toFixed(1), high: +((hi/inc)*100).toFixed(1) },
    human_endpoints: profile.human_endpoints,
    assumptions: { source: "IEA pass-through + historical elasticity", range: `±${Math.round(RF*100)}% uncertainty` },
  };
}

// ═══════════════════════════════════════════════
//  REQUEST HANDLER — the mock Atlas server
// ═══════════════════════════════════════════════

export function handleRequest(method: string, path: string, body: any) {
  return new Promise(resolve => setTimeout(() => {

    // GET /explorer-bootstrap/{world_id}
    if (path.includes('/explorer-bootstrap/')) {
      const pid = new URLSearchParams(path.split('?')[1] || '').get('profile_id');
      const prof = pid ? Object.values(PROFILES).find(p => p.id === pid) : null;
      const entry = NODES["scenario:shock_strait_closure"];
      resolve({
        world: { id: WORLD_ID, label: "Hormuz Energy Shock", description: "Strait closure cascading across energy, shipping, food, health, and stability.", shock_count: 8, stock_count: 7 },
        profiles: Object.values(PROFILES).map(p => ({
          id: p.id, label: p.label, flag: p.flag, role: p.role, region_code: p.region_code,
          tagline: p.tagline, baseline_income: p.baseline_income, unique_exposure: p.unique_exposure,
        })),
        entry_shock: { id: entry.id, label: entry.label },
        first_cascade_cards: entry.out.map((e: any) => ({
          id: e.to, label: NODES[e.to]?.label || e.to, node_type: NODES[e.to]?.node_type || "unknown",
          edge_type: e.edge, path_label: e.path_label, strength: e.s, lag: e.lag,
          description: NODES[e.to]?.ui?.line || "",
        })),
        routes: ROUTES,
        chokepoints: CHOKEPOINTS,
        hidden_connection_count: CONNECTIONS.length,
        what_if_scenarios: Object.values(WHAT_IFS).map(w => ({
          id: w.id, label: w.label, hint: w.hint, node_type: w.node_type,
          direction: w.direction, probability: w.probability,
        })),
        what_if_count: Object.keys(WHAT_IFS).length,
        first_household_impact: prof ? computeHouseholdImpact(prof) : null,
        evidence_summary: "Built from IEA, EIA, CRS, and WHO evidence with ±15% uncertainty ranges on household estimates.",
        live_params: LIVE_PARAMS,
      });
    }

    // POST /cascade-path
    else if (path === '/cascade-path') {
      const node = NODES[body?.from_node_id];
      if (!node) { resolve({ from_node: { id: body?.from_node_id, label: "?", node_type: "?" }, connections: [], cross_domain_edges: [], what_if_scenarios: [] }); return; }
      const conns = (node.out || []).map((e: any) => ({
        edge_type: e.edge, path_label: e.path_label, strength: e.s, lag: e.lag, condition: e.cond || null,
        target: { id: e.to, label: NODES[e.to]?.label || e.to, node_type: NODES[e.to]?.node_type || "unknown" },
        target_ui: NODES[e.to]?.ui || null,
      }));
      // Determine which what-ifs apply to this node
      const nodeWhatIfs = [];
      // Oil price → SPR release, ceasefire
      if (node.id.includes('oil_price') || node.id.includes('spr') || node.id.includes('spare'))
        nodeWhatIfs.push(WHAT_IFS.whatif_reserves, WHAT_IFS.whatif_ceasefire);
      // Fleet / reroute → Red Sea
      if (node.id.includes('fleet') || node.id.includes('cape') || node.id.includes('reroute'))
        nodeWhatIfs.push(WHAT_IFS.whatif_redsea);
      // Compression → all
      if (node.id.includes('compression'))
        nodeWhatIfs.push(WHAT_IFS.whatif_redsea, WHAT_IFS.whatif_reserves, WHAT_IFS.whatif_ceasefire);

      resolve({
        from_node: { id: node.id, label: node.label, node_type: node.node_type, ui: node.ui },
        connections: conns,
        cross_domain_edges: conns.filter((c: any) => c.condition),
        what_if_scenarios: nodeWhatIfs.map((w: any) => ({ id: w.id, label: w.label, hint: w.hint, direction: w.direction, probability: w.probability })),
      });
    }

    // POST /household-impact
    else if (path === '/household-impact') {
      const p = Object.values(PROFILES).find(p => p.id === body?.profile_id);
      resolve(p ? computeHouseholdImpact(p) : { error: "not found" });
    }

    // POST /check-connections
    else if (path === '/check-connections') {
      const visited = new Set(body?.visited_node_ids || []);
      if (body?.new_node_id) visited.add(body.new_node_id);
      const total = CONNECTIONS.length;
      const allDisc = CONNECTIONS.filter(c => c.needs.every(n => visited.has(n))).map(c => ({
        id: c.id,
        source: { id: c.needs[0], label: NODES[c.needs[0]]?.label || c.needs[0], node_type: NODES[c.needs[0]]?.node_type || "unknown" },
        target: { id: c.needs[1], label: NODES[c.needs[1]]?.label || c.needs[1], node_type: NODES[c.needs[1]]?.node_type || "unknown" },
        edge_type: "Condition", condition: c.text, strength: 3,
      }));
      const newDisc = body?.new_node_id ? allDisc.filter(c => c.source.id === body.new_node_id || c.target.id === body.new_node_id) : [];
      resolve({
        world_id: body?.world_id || WORLD_ID,
        total_hidden_connections: total,
        total_discovered: allDisc.length,
        total_remaining: total - allDisc.length,
        newly_discovered: newDisc,
        all_discovered: allDisc,
        discovery_progress: total > 0 ? +(allDisc.length / total).toFixed(2) : 0,
      });
    }

    // POST /what-if
    else if (path === '/what-if') {
      const scenario = Object.values(WHAT_IFS).find(w => w.id === body?.scenario_id);
      if (!scenario) { resolve({ error: "scenario not found" }); return; }
      const prof = body?.profile_id ? Object.values(PROFILES).find(p => p.id === body.profile_id) : null;
      let household_delta = null;
      if (prof) {
        const base = computeHouseholdImpact(prof);
        const altered = Math.round(base.monthly_hit.base * scenario.household_multiplier);
        household_delta = {
          baseline_display: `${prof.currency} ${base.monthly_hit.base.toLocaleString()}/mo`,
          scenario_display: `${prof.currency} ${altered.toLocaleString()}/mo`,
          delta: altered - base.monthly_hit.base,
          direction: scenario.direction,
        };
      }
      resolve({
        scenario_id: scenario.id, scenario_label: scenario.label,
        direction: scenario.direction, probability: scenario.probability, confidence: scenario.confidence,
        deltas: scenario.deltas, household_delta, narrative: scenario.narrative,
      });
    }

    // GET /live-parameters/{world_id}
    else if (path.includes('/live-parameters/')) {
      resolve({ ...LIVE_PARAMS, updated_at: new Date().toISOString() });
    }

    else { resolve({ error: "unknown endpoint" }); }

  }, 100));
}
