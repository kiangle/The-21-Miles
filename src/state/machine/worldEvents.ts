import type { LiveParameters, BootstrapResponse, CascadePathResponse, HouseholdImpactResponse, ConnectionDiscovery, WhatIfResponse } from '../../atlas/types'
import type { LensId, TimeId, FutureId, SceneId } from './worldContext'

export type WorldEvent =
  | { type: 'BOOTSTRAP_LOADED'; data: BootstrapResponse }
  | { type: 'SELECT_COUNTRY'; countryId: string }
  | { type: 'SELECT_ROLE'; roleId: 'nurse' | 'driver'; profileId: string }
  | { type: 'ADVANCE_SCENE'; scene: SceneId }
  | { type: 'SET_LENS'; lens: LensId }
  | { type: 'SET_TIME'; time: TimeId }
  | { type: 'SET_FUTURE'; future: FutureId }
  | { type: 'TOGGLE_COMPARE' }
  | { type: 'SWITCH_PERSPECTIVE' }
  | { type: 'CASCADE_PATH_RECEIVED'; data: CascadePathResponse; nodeId: string }
  | { type: 'HOUSEHOLD_IMPACT_RECEIVED'; data: HouseholdImpactResponse }
  | { type: 'CONNECTION_DISCOVERED'; connections: ConnectionDiscovery[] }
  | { type: 'WHAT_IF_RECEIVED'; data: WhatIfResponse }
  | { type: 'LIVE_PARAMS_UPDATE'; params: LiveParameters }
  | { type: 'SET_INK_KNOT'; knot: string }
  | { type: 'SET_VISUAL_DOMAIN'; domain: string }
  | { type: 'SET_MORPH_QUEUE'; stages: string[] }
  | { type: 'ADVANCE_MORPH_QUEUE' }
  | { type: 'FREEZE_FLOW' }
  | { type: 'RESUME_FLOW' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
