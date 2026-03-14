/**
 * SceneRecipe — exactly one coherent world state.
 *
 * A recipe tells every system what to do:
 * - MapLibre camera focus
 * - Which Pixi/Matter layers are alive
 * - What actor/emitter/constraint modes apply
 * - What narrative beat is active
 *
 * Nothing else decides what's visible. Only the active recipe.
 */

export type MapFocus = 'world' | 'kenya' | 'corridor' | 'mombasa' | 'nairobi' | 'shipping'
export type LensType = 'shipping' | 'freight' | 'medicine' | 'month'
export type Perspective = 'amara' | 'joseph' | null
export type TimeSlice = 'day1' | 'day3' | 'week1' | 'month1'
export type ActorMode = 'none' | 'ships' | 'convoys' | 'medicine' | 'chamber'
export type EmitterMode = 'off' | 'steady' | 'bursts' | 'sparse'
export type ConstraintMode = 'none' | 'lane' | 'corridor' | 'pulse' | 'chamber'

export interface SceneRecipe {
  id: string
  phase: 'globe' | 'landed'
  mapFocus: MapFocus
  lens: LensType
  perspective: Perspective
  time: TimeSlice
  narrativeBeatId: string
  visibleLayers: string[]
  actorMode: ActorMode
  emitterMode: EmitterMode
  constraintMode: ConstraintMode
  shelfLevel?: number
  chamberPressure?: number
  pressure: number
}

// ── Camera presets for MapLibre ──
export const MAP_FOCUS_PRESETS: Record<MapFocus, {
  center: [number, number]
  zoom: number
  pitch: number
  bearing: number
}> = {
  world:    { center: [42, 15],        zoom: 1.8,  pitch: 0,   bearing: 0 },
  shipping: { center: [50, 5],         zoom: 3.0,  pitch: 10,  bearing: -15 },
  kenya:    { center: [37.6, -1.4],    zoom: 4.8,  pitch: 10,  bearing: 0 },
  corridor: { center: [38.2, -2.5],    zoom: 6.6,  pitch: 20,  bearing: -12 },
  mombasa:  { center: [39.67, -4.05],  zoom: 8.5,  pitch: 30,  bearing: -10 },
  nairobi:  { center: [36.82, -1.29],  zoom: 8.7,  pitch: 30,  bearing: 10 },
}

/** Map a lens to the appropriate camera focus for that domain. */
export const LENS_FOCUS_MAP: Record<string, MapFocus> = {
  shipping:  'shipping',
  freight:   'corridor',
  medicine:  'kenya',
  household: 'nairobi',
}

// ── Recipe catalog ──

// Base recipes (perspective-neutral or primary perspective)
const _shipping_day1: SceneRecipe = {
  id: 'shipping_day1',
  phase: 'landed',
  mapFocus: 'shipping',
  lens: 'shipping',
  perspective: null,
  time: 'day1',
  narrativeBeatId: 'shipping_overview',
  visibleLayers: ['basemap', 'shippingRoutes', 'chokepoints', 'vessels'],
  actorMode: 'ships',
  emitterMode: 'steady',
  constraintMode: 'lane',
  pressure: 0.2,
}

const _shipping_week1: SceneRecipe = {
  id: 'shipping_week1',
  phase: 'landed',
  mapFocus: 'shipping',
  lens: 'shipping',
  perspective: null,
  time: 'week1',
  narrativeBeatId: 'shipping_disrupted',
  visibleLayers: ['basemap', 'shippingRoutes', 'chokepoints', 'vessels', 'capeReroute'],
  actorMode: 'ships',
  emitterMode: 'bursts',
  constraintMode: 'lane',
  pressure: 0.7,
}

const _amara_medicine_day1: SceneRecipe = {
  id: 'amara_medicine_day1',
  phase: 'landed',
  mapFocus: 'nairobi',
  lens: 'medicine',
  perspective: 'amara',
  time: 'day1',
  narrativeBeatId: 'nurse_intro',
  visibleLayers: ['basemap', 'corridorGhost', 'medicineLine', 'shelf'],
  actorMode: 'medicine',
  emitterMode: 'steady',
  constraintMode: 'pulse',
  shelfLevel: 1,
  pressure: 0.12,
}

const _amara_medicine_week1: SceneRecipe = {
  id: 'amara_medicine_week1',
  phase: 'landed',
  mapFocus: 'corridor',
  lens: 'medicine',
  perspective: 'amara',
  time: 'week1',
  narrativeBeatId: 'medicine_path',
  visibleLayers: ['basemap', 'corridorGhost', 'medicineLine', 'shelf'],
  actorMode: 'medicine',
  emitterMode: 'sparse',
  constraintMode: 'pulse',
  shelfLevel: 0.4,
  pressure: 0.7,
}

const _joseph_freight_day1: SceneRecipe = {
  id: 'joseph_freight_day1',
  phase: 'landed',
  mapFocus: 'corridor',
  lens: 'freight',
  perspective: 'joseph',
  time: 'day1',
  narrativeBeatId: 'driver_intro',
  visibleLayers: ['basemap', 'corridor', 'depot', 'convoys'],
  actorMode: 'convoys',
  emitterMode: 'steady',
  constraintMode: 'corridor',
  pressure: 0.2,
}

const _joseph_freight_week1: SceneRecipe = {
  id: 'joseph_freight_week1',
  phase: 'landed',
  mapFocus: 'corridor',
  lens: 'freight',
  perspective: 'joseph',
  time: 'week1',
  narrativeBeatId: 'detour',
  visibleLayers: ['basemap', 'corridor', 'depot', 'convoys'],
  actorMode: 'convoys',
  emitterMode: 'bursts',
  constraintMode: 'corridor',
  pressure: 0.68,
}

export const RECIPES: Record<string, SceneRecipe> = {
  globe_context: {
    id: 'globe_context',
    phase: 'globe',
    mapFocus: 'world',
    lens: 'shipping',
    perspective: null,
    time: 'day1',
    narrativeBeatId: '',
    visibleLayers: ['earth', 'routes', 'chokepoints', 'countryMarkers'],
    actorMode: 'none',
    emitterMode: 'off',
    constraintMode: 'none',
    pressure: 0,
  },

  kenya_focus: {
    id: 'kenya_focus',
    phase: 'globe',
    mapFocus: 'kenya',
    lens: 'shipping',
    perspective: null,
    time: 'day1',
    narrativeBeatId: '',
    visibleLayers: ['earth', 'routes', 'chokepoints', 'countryMarkers', 'kenyaBorder'],
    actorMode: 'none',
    emitterMode: 'off',
    constraintMode: 'none',
    pressure: 0.1,
  },

  // Primary shipping recipes (no perspective)
  shipping_day1: _shipping_day1,
  shipping_week1: _shipping_week1,

  // Nurse primary recipes
  amara_medicine_day1: _amara_medicine_day1,
  amara_medicine_week1: _amara_medicine_week1,

  // Driver primary recipes
  joseph_freight_day1: _joseph_freight_day1,
  joseph_freight_week1: _joseph_freight_week1,

  // Cross-role: Nurse viewing shipping
  amara_shipping_day1: { ..._shipping_day1, id: 'amara_shipping_day1', perspective: 'amara' },
  amara_shipping_week1: { ..._shipping_week1, id: 'amara_shipping_week1', perspective: 'amara' },

  // Cross-role: Nurse viewing freight
  amara_freight_day1: { ..._joseph_freight_day1, id: 'amara_freight_day1', perspective: 'amara', lens: 'freight' },
  amara_freight_week1: { ..._joseph_freight_week1, id: 'amara_freight_week1', perspective: 'amara', lens: 'freight' },

  // Cross-role: Driver viewing shipping
  joseph_shipping_day1: { ..._shipping_day1, id: 'joseph_shipping_day1', perspective: 'joseph' },
  joseph_shipping_week1: { ..._shipping_week1, id: 'joseph_shipping_week1', perspective: 'joseph' },

  // Cross-role: Driver viewing medicine
  joseph_medicine_day1: { ..._amara_medicine_day1, id: 'joseph_medicine_day1', perspective: 'joseph', lens: 'medicine' },
  joseph_medicine_week1: { ..._amara_medicine_week1, id: 'joseph_medicine_week1', perspective: 'joseph', lens: 'medicine' },

  month_squeeze_month1: {
    id: 'month_squeeze_month1',
    phase: 'landed',
    mapFocus: 'nairobi',
    lens: 'month',
    perspective: null,
    time: 'month1',
    narrativeBeatId: 'your_month',
    visibleLayers: ['basemap', 'chamber'],
    actorMode: 'chamber',
    emitterMode: 'off',
    constraintMode: 'chamber',
    chamberPressure: 1,
    pressure: 1,
  },
}

/**
 * Resolve recipe from a mapFocus value + role + time.
 * Used when ink RECIPE tags fire with a focus name.
 */
export function resolveRecipeByFocus(
  focus: MapFocus,
  role: 'nurse' | 'driver' | null,
  time: TimeSlice,
): SceneRecipe {
  // Find best matching recipe for this focus + role
  const perspective = role === 'nurse' ? 'amara' : role === 'driver' ? 'joseph' : null
  const candidates = Object.values(RECIPES).filter(r =>
    r.mapFocus === focus && r.phase === 'landed' && (r.perspective === perspective || r.perspective === null)
  )
  // Prefer time match, then any
  const exact = candidates.find(r => r.time === time)
  if (exact) return exact
  if (candidates.length > 0) return candidates[0]
  return RECIPES.globe_context
}

/**
 * Resolve the best recipe for a given state combination.
 * lens is an OPTIONAL override — when provided and we're in a landed scene,
 * it picks the recipe by lens. Otherwise falls back to role-based logic.
 */
export function resolveRecipe(
  scene: string,
  role: 'nurse' | 'driver' | null,
  time: TimeSlice,
  lens?: LensType | null,
): SceneRecipe {
  if (scene === 'entry') return RECIPES.globe_context
  if (scene === 'flyTo') return RECIPES.kenya_focus

  if (scene === 'yourMonth' || scene === 'whatNext' || scene === 'split') {
    return RECIPES.month_squeeze_month1
  }

  // If lens is explicitly set, try to find a matching recipe
  if (lens) {
    const perspective = role === 'nurse' ? 'amara' : role === 'driver' ? 'joseph' : null
    const candidates = Object.values(RECIPES).filter(r =>
      r.phase === 'landed' && r.lens === lens &&
      (r.perspective === perspective || r.perspective === null)
    )
    // Prefer exact perspective match
    const exact = candidates.filter(r => r.perspective === perspective)
    const pool = exact.length > 0 ? exact : candidates

    const withTime = pool.find(r => r.time === time)
    if (withTime) return withTime
    // day3 falls back to day1
    if (time === 'day3') {
      const day1 = pool.find(r => r.time === 'day1')
      if (day1) return day1
    }
    if (pool.length > 0) return pool[0]
  }

  // Default: role-based (original working logic)
  if (scene === 'baseline') {
    return time === 'day1' || time === 'day3' ? RECIPES.shipping_day1 : RECIPES.shipping_week1
  }
  if (role === 'nurse') {
    return time === 'day1' || time === 'day3' ? RECIPES.amara_medicine_day1 : RECIPES.amara_medicine_week1
  }
  if (role === 'driver') {
    return time === 'day1' || time === 'day3' ? RECIPES.joseph_freight_day1 : RECIPES.joseph_freight_week1
  }

  return RECIPES.globe_context
}
