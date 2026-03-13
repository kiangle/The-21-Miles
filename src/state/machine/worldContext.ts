import type { LiveParameters, BootstrapResponse, CascadePathResponse, HouseholdImpactResponse, ConnectionDiscovery, WhatIfResponse } from '../../atlas/types'

export type SceneId =
  | 'entry'
  | 'flyTo'
  | 'baseline'
  | 'rupture'
  | 'detour'
  | 'cascade'
  | 'yourMonth'
  | 'whatNext'
  | 'split'
  | 'share'

export type LensId = 'shipping' | 'freight' | 'medicine' | 'household'
export type TimeId = 'day1' | 'day3' | 'week1' | 'month1'
export type FutureId = 'baseline' | 'redSea' | 'reserves' | 'closureEnds'
export type PerspectiveId = 'nurse' | 'driver'

export interface WorldMetrics {
  routeDelayDays: number
  medicinePressure: number
  freightStress: number
  monthlyHitKsh: number
  oilPriceUsd: number
  crisisDay: number
}

export interface WorldContext {
  // Core selection
  countryId: string | null
  roleId: PerspectiveId | null
  profileId: string | null

  // Scene progression
  scene: SceneId
  previousScene: SceneId | null

  // Parallel state domains
  lens: LensId
  time: TimeId
  future: FutureId
  compareMode: boolean

  // Cascade tracking
  currentNodeId: string | null
  visitedNodeIds: string[]
  discoveredConnections: ConnectionDiscovery[]

  // Atlas data
  bootstrap: BootstrapResponse | null
  currentCascade: CascadePathResponse | null
  householdImpact: HouseholdImpactResponse | null
  whatIfResult: WhatIfResponse | null
  liveParams: LiveParameters | null

  // Metrics
  worldMetrics: WorldMetrics

  // Ink narrative
  inkKnot: string | null

  // Playback
  playing: boolean
}

export const initialContext: WorldContext = {
  countryId: null,
  roleId: null,
  profileId: null,

  scene: 'entry',
  previousScene: null,

  lens: 'shipping',
  time: 'day1',
  future: 'baseline',
  compareMode: false,

  currentNodeId: null,
  visitedNodeIds: [],
  discoveredConnections: [],

  bootstrap: null,
  currentCascade: null,
  householdImpact: null,
  whatIfResult: null,
  liveParams: null,

  worldMetrics: {
    routeDelayDays: 14,
    medicinePressure: 55,
    freightStress: 3,
    monthlyHitKsh: 14400,
    oilPriceUsd: 105,
    crisisDay: 12,
  },

  inkKnot: null,
  playing: true,
}
