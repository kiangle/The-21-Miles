/**
 * SceneRecipe — exactly one coherent world state.
 *
 * A recipe tells every system what to do:
 * - MapLibre camera focus
 * - Which Pixi/Matter layers are alive
 * - What emitter pattern runs
 * - What constraint mode applies
 * - What narrative beat is active
 *
 * Nothing else decides what's visible. Only the active recipe.
 */

export type MapFocus = 'world' | 'kenya' | 'mombasa' | 'nairobi' | 'corridor'
export type LensType = 'shipping' | 'freight' | 'medicine' | 'household'
export type Perspective = 'amara' | 'joseph'
export type TimeSlice = 'day1' | 'day3' | 'week1' | 'month1'
export type ActiveActorMode = 'ships' | 'convoys' | 'medicine' | 'chamber' | 'none'
export type EmitterMode = 'steady' | 'bursts' | 'sparse' | 'off'
export type ConstraintMode = 'lane' | 'corridor' | 'pulse' | 'chamber' | 'none'

export interface SceneRecipe {
  id: string
  phase: 'globe' | 'landed'
  mapFocus: MapFocus
  lens: LensType
  perspective: Perspective | null
  time: TimeSlice
  visibleLayers: string[]
  activeActorMode: ActiveActorMode
  emitterMode: EmitterMode
  constraintMode: ConstraintMode
  shelfLevel?: number
  chamberPressure?: number
  narrativeBeatId: string
  /** Pressure value 0–1.5 applied to physics systems */
  pressure: number
}

// ── Camera presets for MapLibre ──
export const MAP_FOCUS_PRESETS: Record<MapFocus, {
  center: [number, number]
  zoom: number
  pitch: number
  bearing: number
}> = {
  world:    { center: [40, 10],       zoom: 1.5,  pitch: 0,  bearing: 0 },
  kenya:    { center: [37.5, -1.0],   zoom: 5.5,  pitch: 0,  bearing: 0 },
  mombasa:  { center: [39.67, -4.05], zoom: 9,    pitch: 30, bearing: 0 },
  nairobi:  { center: [36.82, -1.29], zoom: 9,    pitch: 30, bearing: 0 },
  corridor: { center: [38.2, -2.5],   zoom: 6.5,  pitch: 15, bearing: 0 },
}

// ── Recipe catalog ──

export const RECIPES: Record<string, SceneRecipe> = {
  globe_context: {
    id: 'globe_context',
    phase: 'globe',
    mapFocus: 'world',
    lens: 'shipping',
    perspective: null,
    time: 'day1',
    visibleLayers: ['routes', 'chokepoints'],
    activeActorMode: 'none',
    emitterMode: 'off',
    constraintMode: 'none',
    narrativeBeatId: '',
    pressure: 0,
  },

  kenya_entry: {
    id: 'kenya_entry',
    phase: 'globe',
    mapFocus: 'kenya',
    lens: 'shipping',
    perspective: null,
    time: 'day1',
    visibleLayers: ['routes', 'chokepoints', 'kenya_border'],
    activeActorMode: 'none',
    emitterMode: 'off',
    constraintMode: 'none',
    narrativeBeatId: '',
    pressure: 0.1,
  },

  amara_medicine_day1: {
    id: 'amara_medicine_day1',
    phase: 'landed',
    mapFocus: 'corridor',
    lens: 'medicine',
    perspective: 'amara',
    time: 'day1',
    visibleLayers: ['corridor', 'pulses'],
    activeActorMode: 'medicine',
    emitterMode: 'steady',
    constraintMode: 'pulse',
    shelfLevel: 1.0,
    narrativeBeatId: 'nurse_intro',
    pressure: 0.2,
  },

  amara_medicine_week1: {
    id: 'amara_medicine_week1',
    phase: 'landed',
    mapFocus: 'corridor',
    lens: 'medicine',
    perspective: 'amara',
    time: 'week1',
    visibleLayers: ['corridor', 'pulses'],
    activeActorMode: 'medicine',
    emitterMode: 'sparse',
    constraintMode: 'pulse',
    shelfLevel: 0.4,
    narrativeBeatId: 'medicine_path',
    pressure: 0.7,
  },

  joseph_freight_day1: {
    id: 'joseph_freight_day1',
    phase: 'landed',
    mapFocus: 'corridor',
    lens: 'freight',
    perspective: 'joseph',
    time: 'day1',
    visibleLayers: ['corridor', 'congestion'],
    activeActorMode: 'convoys',
    emitterMode: 'steady',
    constraintMode: 'corridor',
    narrativeBeatId: 'driver_intro',
    pressure: 0.2,
  },

  joseph_freight_day3: {
    id: 'joseph_freight_day3',
    phase: 'landed',
    mapFocus: 'corridor',
    lens: 'freight',
    perspective: 'joseph',
    time: 'day3',
    visibleLayers: ['corridor', 'congestion'],
    activeActorMode: 'convoys',
    emitterMode: 'bursts',
    constraintMode: 'corridor',
    narrativeBeatId: 'exposure',
    pressure: 0.45,
  },

  joseph_freight_week1: {
    id: 'joseph_freight_week1',
    phase: 'landed',
    mapFocus: 'corridor',
    lens: 'freight',
    perspective: 'joseph',
    time: 'week1',
    visibleLayers: ['corridor', 'congestion'],
    activeActorMode: 'convoys',
    emitterMode: 'bursts',
    constraintMode: 'corridor',
    narrativeBeatId: 'detour',
    pressure: 0.7,
  },

  month_squeeze: {
    id: 'month_squeeze',
    phase: 'landed',
    mapFocus: 'nairobi',
    lens: 'household',
    perspective: null,
    time: 'month1',
    visibleLayers: ['chamber'],
    activeActorMode: 'chamber',
    emitterMode: 'off',
    constraintMode: 'chamber',
    chamberPressure: 1.0,
    narrativeBeatId: 'your_month',
    pressure: 1.0,
  },

  rupture_global: {
    id: 'rupture_global',
    phase: 'landed',
    mapFocus: 'kenya',
    lens: 'shipping',
    perspective: null,
    time: 'day1',
    visibleLayers: ['routes', 'chokepoints', 'flowBands'],
    activeActorMode: 'ships',
    emitterMode: 'steady',
    constraintMode: 'lane',
    narrativeBeatId: 'rupture',
    pressure: 0.4,
  },
}

/**
 * Resolve the best recipe for a given state combination.
 * Ink beats can override via tag RECIPE:<id>.
 */
export function resolveRecipe(
  scene: string,
  role: 'nurse' | 'driver' | null,
  time: TimeSlice,
): SceneRecipe {
  // Direct scene → recipe mapping
  if (scene === 'entry') return RECIPES.globe_context
  if (scene === 'flyTo') return RECIPES.kenya_entry

  if (scene === 'rupture') return RECIPES.rupture_global

  if (scene === 'yourMonth' || scene === 'whatNext' || scene === 'split') {
    return RECIPES.month_squeeze
  }

  // Role + time based resolution for baseline/detour/cascade
  if (role === 'nurse') {
    if (time === 'day1' || time === 'day3') return RECIPES.amara_medicine_day1
    return RECIPES.amara_medicine_week1
  }
  if (role === 'driver') {
    if (time === 'day1') return RECIPES.joseph_freight_day1
    if (time === 'day3') return RECIPES.joseph_freight_day3
    return RECIPES.joseph_freight_week1
  }

  // Fallback
  return RECIPES.globe_context
}
