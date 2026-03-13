/**
 * 21 Miles — Matter.js Physics Spec
 * 
 * Matter.js gives PHYSICAL FEEL to cascades. It does NOT simulate truth.
 * Atlas simulates. Matter.js makes the simulation visceral.
 * 
 * RULE: Only use physics where it TEACHES meaning.
 * If removing the physics doesn't change comprehension, remove the physics.
 * 
 * Matter.js world runs at 60fps. Bodies sync to Pixi sprites every frame.
 * The Matter world is 2D, mapped to the Pixi stage coordinate system.
 * MapLibre geo coordinates → Pixi screen coordinates → Matter body positions.
 */

// ═══════════════════════════════════════════════════════
//  1. ENGINE SETUP
// ═══════════════════════════════════════════════════════

/**
 * MatterWorld.ts
 * 
 * One Matter.Engine per session. Runs in a requestAnimationFrame loop
 * synchronized with the Pixi ticker. No visible Matter canvas — 
 * Matter only computes positions, Pixi renders them.
 */
export interface MatterWorldConfig {
  gravity: { x: 0, y: 0 },         // zero gravity — vessels float, not fall
  enableSleeping: true,              // bodies at rest don't compute
  constraintIterations: 4,           // enough for corridor walls
  positionIterations: 8,             // smooth bunching behavior
  timestep: 1000 / 60,              // 60fps
  bounds: {                          // match Pixi stage dimensions
    min: { x: 0, y: 0 },
    max: { x: stageWidth, y: stageHeight }
  }
}

/**
 * SYNC MODEL:
 * 
 * 1. XState emits scene change → MatterWorld.setScene('rupture')
 * 2. MatterWorld creates/removes bodies for that scene
 * 3. Each frame: Matter.Engine.update(engine, delta)
 * 4. Each frame: forEach body → update Pixi sprite position + rotation
 * 5. Pixi renders sprites with flow-species visual style
 * 
 * The sync is one-directional: Matter → Pixi.
 * User interaction (taps) go to XState, not to Matter directly.
 */

// ═══════════════════════════════════════════════════════
//  2. VESSEL BODIES — Baseline + Rupture
// ═══════════════════════════════════════════════════════

/**
 * vesselBodies.ts
 * 
 * Vessel particles represent ships. In baseline, they flow smoothly
 * along route paths. At rupture, they bunch at the chokepoint.
 * 
 * Each vessel is a Matter.Body with:
 * - Small circle (radius 3-6px depending on vessel type)
 * - Low friction (0.01) — they glide
 * - Moderate restitution (0.3) — soft bouncing when bunching
 * - Custom label: 'vessel_tanker' | 'vessel_container' | 'vessel_lng'
 */

export interface VesselBodyDef {
  id: string
  type: 'tanker' | 'container' | 'lng'
  radius: number                    // 3 (container), 4 (tanker), 5 (LNG)
  routeId: string                   // which shipping lane
  routeProgress: number             // 0.0 to 1.0 along route path
  speed: number                     // baseline speed (pixels/frame)
  color: string                     // matches flow species stage
}

/**
 * BASELINE BEHAVIOR:
 * - Vessels follow a path (route polyline from GeoJSON)
 * - Each frame: advance routeProgress by speed
 * - Convert routeProgress → screen position
 * - Matter body position set via Body.setPosition (not force)
 * - When routeProgress reaches 1.0, reset to 0.0 (loop)
 * - Vessels are spaced evenly — visible rhythm
 * 
 * RUPTURE BEHAVIOR:
 * - Chokepoint becomes a static body WALL (see below)
 * - Vessels approaching Hormuz can no longer advance
 * - Their speed drops to near-zero
 * - They begin BUNCHING: Matter collision pushes them apart slightly
 * - Visual: cluster of bodies jostling near the wall
 * - Bodies behind them slow down too (chain reaction via proximity dampening)
 * - Downstream: vessels that passed before closure continue but thin out
 * 
 * IMPLEMENTATION:
 * - On rupture: insert chokepoint wall body
 * - Change vessel update: if distance to wall < threshold, speed = 0
 * - Let Matter collision handle the bunching naturally
 * - Apply light random force jitter (±0.0002) for organic movement
 */

const VESSEL_DEFAULTS = {
  tanker:    { radius: 4, speed: 1.2, density: 0.001, frictionAir: 0.02 },
  container: { radius: 3, speed: 1.0, density: 0.001, frictionAir: 0.02 },
  lng:       { radius: 5, speed: 0.8, density: 0.001, frictionAir: 0.02 },
}

// How many vessels per route at baseline
const VESSEL_COUNTS = {
  hormuz_eastbound: 25,
  hormuz_westbound: 20,
  cape_northbound: 0,    // increases at detour
  cape_southbound: 0,    // increases at detour
  suez_northbound: 15,
  suez_southbound: 12,
  mombasa_approach: 8,
}

// ═══════════════════════════════════════════════════════
//  3. CHOKEPOINT BODIES — The Wall
// ═══════════════════════════════════════════════════════

/**
 * chokepoint wall:
 * - Static body (isStatic: true)
 * - Positioned at Hormuz strait screen coordinates
 * - Thin rectangle spanning the strait width
 * - Only created at rupture, removed if ceasefire
 * - Vessels collide with it and bunch
 * 
 * Optional: semi-permeable wall
 * - 95% of vessels stop
 * - 5% pass through (representing the rare dark-transit vessels)
 * - Implemented via collision filter categories
 */

export interface ChokepointWallDef {
  id: 'hormuz_wall'
  position: { x: number, y: number }  // screen coords of Hormuz
  width: 120                           // spans the strait visually
  height: 6                            // thin barrier
  isStatic: true
  collisionFilter: {
    category: 0x0002,                  // wall category
    mask: 0x0001                       // collides with vessels
  }
  render: {
    visible: false                     // Matter debug renderer off
    // Pixi renders a red glow at this position instead
  }
}

// ═══════════════════════════════════════════════════════
//  4. REROUTE STRAIN — Cape Detour
// ═══════════════════════════════════════════════════════

/**
 * When the detour activates:
 * 
 * 1. Cape route vessels spawn (were 0 at baseline)
 * 2. Cape route is LONGER — vessels take more frames to complete a loop
 * 3. This means: same vessel count, fewer arrivals per unit time
 * 4. The visual: Cape route bands are thicker (more vessels in transit)
 *    but arrival cadence at Mombasa is slower (longer gaps)
 * 
 * STRAIN PHYSICS:
 * - Cape route has a "corridor constraint" — invisible walls along the route
 * - As vessel count increases, they bunch within the corridor
 * - The corridor narrows slightly at the Cape of Good Hope point
 * - Vessels slow when bunched (proximity dampening)
 * - Visual result: thicker, pulsing, stressed flow
 * 
 * CORRIDOR CONSTRAINT:
 * - Two parallel static body walls along each route
 * - Spaced 30-50px apart
 * - Vessels bounce softly between them
 * - At narrow points: walls closer → more bunching
 */

export interface CorridorConstraint {
  routeId: string
  wallBodies: [Matter.Body, Matter.Body]  // left and right walls
  width: number                            // distance between walls
  narrowPoints: Array<{
    position: number  // routeProgress where corridor narrows
    width: number     // reduced corridor width at that point
  }>
}

// ═══════════════════════════════════════════════════════
//  5. CONGESTION BODIES — Freight Cascade Stage
// ═══════════════════════════════════════════════════════

/**
 * When the cascade enters the freight domain:
 * 
 * Flow bands morph into congestion particles.
 * These are DIFFERENT bodies from vessels — smaller, more numerous,
 * representing cost/delay units rather than ships.
 * 
 * CONGESTION BEHAVIOR:
 * - Small circles (radius 2) spawned at port positions
 * - Attracted toward a "pressure attractor" at Mombasa port
 * - They don't pass through — they accumulate
 * - Visual: growing cluster at port = freight delay
 * - When cluster exceeds threshold: pulse outward (port releases)
 * - Released particles travel inland along road routes
 * - These become the "import stress filaments" visually
 * 
 * ATTRACTOR:
 * - Not a Matter body — implemented as a force applied each frame
 * - Bodies within radius of port: apply force toward port center
 * - Force strength: 0.00005 * distance (linear attraction)
 * - Collision between congestion bodies creates the bunching visual
 */

export interface CongestionBodyDef {
  radius: 2
  density: 0.0005
  frictionAir: 0.05          // higher air friction = slower, stickier
  restitution: 0.1           // low bounce — they cluster, not scatter
  label: 'congestion'
  attractorTarget: { x: number, y: number }  // port position
  attractorStrength: 0.00005
  releaseThreshold: 40       // when N bodies accumulated, pulse release
}

// ═══════════════════════════════════════════════════════
//  6. PRESSURE WAVE — Cascade Crossing Domains
// ═══════════════════════════════════════════════════════

/**
 * When a cascade crosses from one domain to another
 * (shipping → freight → medicine → household):
 * 
 * A "pressure wave" separates from the source system
 * and propagates toward the target system.
 * 
 * PHYSICS:
 * - Wave is a cluster of small particles (radius 1-2)
 * - Initially bunched together at the source domain position
 * - An impulse is applied to each particle outward
 * - As they travel, they spread slightly (expanding wave front)
 * - When they arrive at the target domain position, they
 *   become the new visual species (e.g., medicine cadence pulses)
 * 
 * This creates the visual of "something traveling between systems"
 * without drawing a line or arrow. The physics makes it feel real.
 * 
 * IMPLEMENTATION:
 * - On cascade crossing event from XState:
 *   1. Spawn 20-30 wave particles at source position
 *   2. Apply outward impulse toward target position
 *   3. Each frame: particles move via Matter physics
 *   4. When centroid of cluster reaches target: 
 *      remove wave particles, spawn target-domain bodies
 *   5. GSAP morphs the Pixi visual style during transit
 */

export interface PressureWaveDef {
  particleCount: 25
  particleRadius: 1.5
  initialSpread: 10          // px radius of initial cluster
  impulseStrength: 0.003     // toward target
  frictionAir: 0.01          // low — they travel far
  lifespan: 3000             // ms before auto-cleanup
  visualMorphDuration: 1500  // ms for Pixi style transition
}

// ═══════════════════════════════════════════════════════
//  7. FORK DEFORMATION — Split Futures
// ═══════════════════════════════════════════════════════

/**
 * When the user forks the world:
 * 
 * The Matter world doesn't duplicate — instead, it runs TWO
 * sets of bodies in the same engine with different force regimes.
 * 
 * BASELINE bodies: continue with current forces
 * ALTERED bodies: cloned from baseline, then modified:
 * 
 * Red Sea fork: 
 *   - Cape route corridor ALSO gets a wall (second chokepoint)
 *   - Vessel speed drops further
 *   - Congestion at Mombasa intensifies (stronger attractor)
 * 
 * Reserves fork:
 *   - Vessel speed increases slightly
 *   - Congestion attractor weakens
 *   - Some bunched vessels at Hormuz "leak through" (wall becomes semi-permeable)
 * 
 * Ceasefire fork:
 *   - Hormuz wall is removed (gradually — bodies leak through over 2 seconds)
 *   - Vessel speed recovers to 80% of baseline (not 100%)
 *   - Congestion clears slowly
 * 
 * VISUAL SPLIT:
 * - Left half of screen: baseline bodies visible
 * - Right half: altered bodies visible
 * - Bodies near the center edge: fade opacity
 * - Pixi rendering clips each half with a mask
 * - Matter physics runs all bodies — Pixi selectively shows them
 * 
 * COLLISION FILTER:
 * - Baseline bodies: category 0x0004
 * - Altered bodies: category 0x0008
 * - They don't collide with each other
 * - Both collide with walls (0x0002)
 */

export interface ForkPhysicsConfig {
  baseline: {
    collisionCategory: 0x0004
    vesselSpeed: number      // current from state
    congestionStrength: number
    wallState: 'closed'
  }
  altered: {
    collisionCategory: 0x0008
    vesselSpeed: number      // modified per scenario
    congestionStrength: number
    wallState: 'closed' | 'semi_permeable' | 'removed'
  }
}

// ═══════════════════════════════════════════════════════
//  8. COMPRESSION BODIES — Budget Chamber
// ═══════════════════════════════════════════════════════

/**
 * The compression chamber uses Matter for the "walls closing in" effect.
 * 
 * Four static walls define the budget space.
 * As each cost category arrives (fuel, food, heating, transport):
 * - The corresponding wall moves inward
 * - The wall is a kinematic body (Body.setPosition each frame)
 * - Small floating particles inside represent "room to breathe"
 * - As walls close, particles get compressed — they jitter more
 * - When space is very small, particles collide rapidly — visual stress
 * 
 * CATEGORY WALLS:
 * - Top wall = fuel cost (moves down)
 * - Right wall = food cost (moves left)
 * - Bottom wall = heating cost (moves up)
 * - Left wall = transport cost (moves right)
 * 
 * Each wall's inward distance = proportional to cost increase as % of income
 * 
 * BREATHING PARTICLES:
 * - 30-50 small circles inside the chamber
 * - Zero gravity, low friction
 * - Random initial velocities
 * - They represent "room left" — as chamber shrinks, they compress
 * - Color: gold (the Kiangle color) — this is what you have left
 */

export interface CompressionChamberConfig {
  wallThickness: 8
  chamberSize: 300            // px initial square
  breathingParticles: 40
  particleRadius: 3
  particleFrictionAir: 0.03
  
  // Each wall moves inward by this fraction of chamberSize
  // Values from Atlas household-impact: cost increase / income
  wallInsets: {
    fuel: number       // e.g., 0.08 (8% of income to fuel)
    food: number       // e.g., 0.20 (20% of income to food)  
    heating: number    // e.g., 0.02 (2% of income to heating)
    transport: number  // e.g., 0.07 (7% of income to transport)
  }
  
  // The remaining space area as % of original = what's left
  // For Kenya: ~63% remains (37% consumed by cost increases)
  // For Japan: ~92% remains (8% consumed)
  // This VISUAL DIFFERENCE is the story
}

// ═══════════════════════════════════════════════════════
//  9. PERFORMANCE RULES
// ═══════════════════════════════════════════════════════

/**
 * BODY LIMITS:
 * - Max 200 active bodies at any time
 * - Sleeping bodies (Matter.Sleeping) for off-screen or static clusters
 * - Remove bodies that exit the stage bounds
 * 
 * SCENE TRANSITIONS:
 * - On scene change: remove all bodies from previous scene EXCEPT
 *   those that persist (e.g., bunched vessels at Hormuz stay through detour)
 * - Use Matter.Composite.clear() for full scene resets
 * - Spawn new bodies for new scene
 * 
 * MOBILE:
 * - Reduce vessel count by 40% on mobile (< 768px width)
 * - Reduce congestion particles by 50%
 * - Compression chamber particles: 20 instead of 40
 * - Disable pressure wave particles on low-end devices
 *   (detect via navigator.hardwareConcurrency < 4)
 * 
 * DEBUG:
 * - Matter.Render can be enabled in dev mode for body visualization
 * - Toggle with config flag: MATTER_DEBUG=true
 */
