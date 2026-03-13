// ═══════════════════════════════════════════════
//  Atlas API Types — all data flows through here
// ═══════════════════════════════════════════════

export interface LiveParameter {
  value: number | boolean
  source: string
  updated: string
}

export interface LiveParameters {
  world_id: string
  updated_at: string
  parameters: Record<string, LiveParameter>
  crisis_day: number
  last_topology_change: string | null
}

export interface RouteData {
  id: string
  label: string
  status: 'active' | 'blocked' | 'stressed' | 'delayed' | 'congested'
  color: string
}

export interface ChokepointData {
  id: string
  label: string
  lat: number
  lng: number
  status: 'open' | 'closed' | 'congested'
}

export interface ProfileSummary {
  id: string
  label: string
  flag: string
  role: string
  region_code: string
  tagline: string
  baseline_income: number
  unique_exposure: string[]
}

export interface HouseholdBasketItem {
  amount: number
  unit: string
  label: string
}

export interface CascadeConnection {
  edge_type: string
  path_label: string
  strength: number
  lag: string
  condition: string | null
  target: {
    id: string
    label: string
    node_type: string
  }
  target_ui: NodeUI | null
}

export interface NodeUI {
  number: string
  unit: string
  context: string
  color: string
  size: string
  tag: string | null
  domain: string | null
  domainColor: string | null
  line: string
  detail: string | null
  connection: string | null
  youKey: string | null
}

export interface CascadeCard {
  id: string
  label: string
  node_type: string
  edge_type: string
  path_label: string
  strength: number
  lag: string
  description: string
}

export interface WhatIfSummary {
  id: string
  label: string
  hint: string
  node_type: string
  direction: 'worsens' | 'improves'
  probability: number
}

export interface WhatIfDelta {
  label: string
  baseline: string
  altered: string
  delta: string
}

export interface HouseholdDelta {
  baseline_display: string
  scenario_display: string
  delta: number
  direction: 'worsens' | 'improves'
}

export interface CountryData {
  id: string
  label: string
  flag: string
  lat: number
  lng: number
  context: string
}

export interface RoleData {
  id: string
  country_id: string
  label: string
  short_label: string
  intro_line: string
  voice_style: string
  icon: string
}

export interface FuturePath {
  id: string
  label: string
  hint: string
  direction: 'worse' | 'better'
  probability: number
  icon: string
  trigger_node_ids: string[]
}

// ═══════════════════════════════════════════════
//  Response Shapes
// ═══════════════════════════════════════════════

export interface BootstrapResponse {
  world: {
    id: string
    label: string
    description: string
    shock_count: number
    stock_count: number
  }
  profiles: ProfileSummary[]
  entry_shock: { id: string; label: string }
  first_cascade_cards: CascadeCard[]
  routes: RouteData[]
  chokepoints: ChokepointData[]
  hidden_connection_count: number
  what_if_scenarios: WhatIfSummary[]
  what_if_count: number
  first_household_impact: HouseholdImpactResponse | null
  evidence_summary: string
  live_params: LiveParameters
  countries?: CountryData[]
  roles?: RoleData[]
  future_paths?: FuturePath[]
  narrative_pack?: string
}

export interface CascadePathResponse {
  from_node: {
    id: string
    label: string
    node_type: string
    ui?: NodeUI
  }
  connections: CascadeConnection[]
  cross_domain_edges: CascadeConnection[]
  what_if_scenarios: WhatIfSummary[]
}

export interface ImpactCategory {
  pre: number
  post_low: number
  post_base: number
  post_high: number
  unit: string
  label: string
  multiplier: number
  range: [number, number]
}

export interface HouseholdImpactResponse {
  profile: string
  flag: string
  currency: string
  role: string
  region_code: string
  confidence: string
  as_of_date: string
  baseline_income: number
  impacts: Record<string, ImpactCategory>
  monthly_hit: { low: number; base: number; high: number }
  pct_of_income: { low: number; base: number; high: number }
  human_endpoints: Record<string, string>
  assumptions: { source: string; range: string }
}

export interface ConnectionDiscovery {
  id: string
  source: { id: string; label: string; node_type: string }
  target: { id: string; label: string; node_type: string }
  edge_type: string
  condition: string
  strength: number
}

export interface ConnectionCheckResponse {
  world_id: string
  total_hidden_connections: number
  total_discovered: number
  total_remaining: number
  newly_discovered: ConnectionDiscovery[]
  all_discovered: ConnectionDiscovery[]
  discovery_progress: number
}

export interface WhatIfResponse {
  scenario_id: string
  scenario_label: string
  direction: 'worsens' | 'improves'
  probability: number
  confidence: string
  deltas: WhatIfDelta[]
  household_delta: HouseholdDelta | null
  narrative: string
}
