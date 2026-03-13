# 21 MILES — PHYSICS + TRANSITIONS + VISUAL PATCH

## For Claude Code: Apply these changes to the existing codebase

This patch fixes 8 systemic issues where the physics engine, GSAP transitions,
and console toggles are disconnected from the visual world. Every section
contains exact code to implement.

---

## PATCH 1: Physics reconfigures per lens

**Problem:** All renderers keep their bodies alive simultaneously. Switching lens
just toggles visibility. The physics world never changes.

**Fix:** Each lens gets its own body configuration. Switching lens calls
`matterWorld.clear()` then spawns the correct bodies for that lens.

### File: `src/stage/scene/PixiStage.tsx`

Add a new function `reconfigurePhysicsForLens` and call it when lens changes:

```typescript
// Add this inside the PixiStage component, after initPixi sets up positions

function reconfigurePhysicsForLens(
  engine: Matter.Engine,
  lens: LensId,
  positions: ReturnType<typeof computePositions>,
  pressure: number,
  w: number,
  h: number,
) {
  // Remove all non-wall bodies from the engine
  const allBodies = Matter.Composite.allBodies(engine.world)
  const toRemove = allBodies.filter(b => !b.isStatic || b.label === 'chokepoint_wall')
  toRemove.forEach(b => Matter.Composite.remove(engine.world, b))

  const POS = positions

  switch (lens) {
    case 'shipping': {
      // Chokepoint walls at Hormuz
      const gapWidth = Math.max(3, 30 - pressure * 25)
      const halfGap = gapWidth / 2
      const wallTop = Matter.Bodies.rectangle(
        POS.hormuz.x, POS.hormuz.y - halfGap - 30, 6, 60,
        { isStatic: true, label: 'chokepoint_wall', collisionFilter: { category: 0x0008, mask: 0x0004 } }
      )
      const wallBot = Matter.Bodies.rectangle(
        POS.hormuz.x, POS.hormuz.y + halfGap + 30, 6, 60,
        { isStatic: true, label: 'chokepoint_wall', collisionFilter: { category: 0x0008, mask: 0x0004 } }
      )
      Matter.Composite.add(engine.world, [wallTop, wallBot])

      // 18 vessel bodies spread along the main shipping lane
      const mainPath = [POS.hormuz, { x: w * 0.72, y: h * 0.22 }, POS.babElMandeb, { x: w * 0.58, y: h * 0.35 }, POS.mombasa]
      for (let i = 0; i < 18; i++) {
        const t = i / 18
        const segIdx = Math.min(Math.floor(t * (mainPath.length - 1)), mainPath.length - 2)
        const lt = t * (mainPath.length - 1) - segIdx
        const x = mainPath[segIdx].x + (mainPath[segIdx + 1].x - mainPath[segIdx].x) * lt + (Math.random() - 0.5) * 20
        const y = mainPath[segIdx].y + (mainPath[segIdx + 1].y - mainPath[segIdx].y) * lt + (Math.random() - 0.5) * 15
        const body = Matter.Bodies.circle(x, y, 3 + Math.random() * 2, {
          density: 0.0008, frictionAir: 0.025, restitution: 0.25, label: 'vessel',
          collisionFilter: { category: 0x0004, mask: 0x0004 | 0x0008 },
        })
        Matter.Composite.add(engine.world, body)
      }

      // Cape reroute vessels (count depends on pressure)
      const rerouteCount = Math.floor(pressure * 12)
      const capePath = [POS.capeTown, { x: w * 0.39, y: h * 0.60 }, { x: w * 0.44, y: h * 0.52 }, POS.mombasa]
      for (let i = 0; i < rerouteCount; i++) {
        const t = i / Math.max(rerouteCount, 1)
        const segIdx = Math.min(Math.floor(t * (capePath.length - 1)), capePath.length - 2)
        const lt = t * (capePath.length - 1) - segIdx
        const x = capePath[segIdx].x + (capePath[segIdx + 1].x - capePath[segIdx].x) * lt + (Math.random() - 0.5) * 15
        const y = capePath[segIdx].y + (capePath[segIdx + 1].y - capePath[segIdx].y) * lt + (Math.random() - 0.5) * 10
        const body = Matter.Bodies.circle(x, y, 3, {
          density: 0.0008, frictionAir: 0.03, restitution: 0.25, label: 'vessel_reroute',
          collisionFilter: { category: 0x0004, mask: 0x0004 | 0x0008 },
        })
        Matter.Composite.add(engine.world, body)
      }
      break
    }

    case 'freight': {
      // Corridor walls along Mombasa–Nairobi road
      const corridorMid = {
        x: (POS.mombasa.x + POS.nairobi.x) / 2,
        y: (POS.mombasa.y + POS.nairobi.y) / 2,
      }
      const angle = Math.atan2(POS.nairobi.y - POS.mombasa.y, POS.nairobi.x - POS.mombasa.x)
      const perpAngle = angle + Math.PI / 2
      const corridorWidth = 25
      const corridorLen = Math.sqrt(
        (POS.nairobi.x - POS.mombasa.x) ** 2 + (POS.nairobi.y - POS.mombasa.y) ** 2
      ) * 1.2

      const wallLeft = Matter.Bodies.rectangle(
        corridorMid.x + Math.cos(perpAngle) * corridorWidth,
        corridorMid.y + Math.sin(perpAngle) * corridorWidth,
        corridorLen, 4,
        { isStatic: true, angle, label: 'corridor_wall', collisionFilter: { category: 0x0008, mask: 0x0004 } }
      )
      const wallRight = Matter.Bodies.rectangle(
        corridorMid.x - Math.cos(perpAngle) * corridorWidth,
        corridorMid.y - Math.sin(perpAngle) * corridorWidth,
        corridorLen, 4,
        { isStatic: true, angle, label: 'corridor_wall', collisionFilter: { category: 0x0008, mask: 0x0004 } }
      )
      Matter.Composite.add(engine.world, [wallLeft, wallRight])

      // 30 congestion particles at Mombasa, attracted toward Nairobi
      for (let i = 0; i < 30; i++) {
        const body = Matter.Bodies.circle(
          POS.mombasa.x + (Math.random() - 0.5) * 40,
          POS.mombasa.y + (Math.random() - 0.5) * 30,
          2.5,
          {
            density: 0.0005, frictionAir: 0.04 + Math.random() * 0.02,
            restitution: 0.15, label: 'congestion',
            collisionFilter: { category: 0x0004, mask: 0x0004 | 0x0008 },
          }
        )
        Matter.Composite.add(engine.world, body)
      }

      // Port bottleneck wall at Mombasa (narrows exit)
      const portGateLeft = Matter.Bodies.rectangle(
        POS.mombasa.x - 18, POS.mombasa.y - 15, 4, 30,
        { isStatic: true, label: 'port_gate', collisionFilter: { category: 0x0008, mask: 0x0004 } }
      )
      const portGateRight = Matter.Bodies.rectangle(
        POS.mombasa.x - 18, POS.mombasa.y + 15, 4, 30,
        { isStatic: true, label: 'port_gate', collisionFilter: { category: 0x0008, mask: 0x0004 } }
      )
      Matter.Composite.add(engine.world, [portGateLeft, portGateRight])
      break
    }

    case 'medicine': {
      // Supply gate at hospital — blocks a percentage of incoming packets
      const gateOpeningPct = Math.max(0.3, 1.0 - pressure * 0.6) // at pressure=1.0, only 40% get through
      const gateGap = 40 * gateOpeningPct
      const halfGap = gateGap / 2

      const gateTop = Matter.Bodies.rectangle(
        POS.hospital.x, POS.hospital.y - halfGap - 20, 6, 40,
        { isStatic: true, label: 'supply_gate', collisionFilter: { category: 0x0008, mask: 0x0004 } }
      )
      const gateBot = Matter.Bodies.rectangle(
        POS.hospital.x, POS.hospital.y + halfGap + 20, 6, 40,
        { isStatic: true, label: 'supply_gate', collisionFilter: { category: 0x0008, mask: 0x0004 } }
      )
      Matter.Composite.add(engine.world, [gateTop, gateBot])

      // 15 medicine packet bodies from Mombasa toward hospital
      for (let i = 0; i < 15; i++) {
        const t = i / 15
        const x = POS.mombasa.x + (POS.hospital.x - POS.mombasa.x) * t + (Math.random() - 0.5) * 20
        const y = POS.mombasa.y + (POS.hospital.y - POS.mombasa.y) * t + (Math.random() - 0.5) * 15
        const body = Matter.Bodies.circle(x, y, 3.5, {
          density: 0.0006, frictionAir: 0.035, restitution: 0.2, label: 'medicine_packet',
          collisionFilter: { category: 0x0004, mask: 0x0004 | 0x0008 },
        })
        Matter.Composite.add(engine.world, body)
      }
      break
    }

    case 'household': {
      // Compression chamber — 4 kinematic walls + breathing particles
      const chamberCenterX = w * 0.5
      const chamberCenterY = h * 0.45
      const chamberSize = 150

      // Cost percentages from Atlas household impact (Kenya nurse)
      const fuelPct = 0.08 * pressure
      const foodPct = 0.20 * pressure
      const heatingPct = 0.02 * pressure
      const transportPct = 0.07 * pressure

      const halfSize = chamberSize / 2

      // Top wall (fuel) — moves DOWN by fuelPct * chamberSize
      const topInset = fuelPct * chamberSize
      const wallTop = Matter.Bodies.rectangle(
        chamberCenterX, chamberCenterY - halfSize + topInset, chamberSize, 6,
        { isStatic: true, label: 'compression_top' }
      )
      // Right wall (food) — moves LEFT
      const rightInset = foodPct * chamberSize
      const wallRight = Matter.Bodies.rectangle(
        chamberCenterX + halfSize - rightInset, chamberCenterY, 6, chamberSize,
        { isStatic: true, label: 'compression_right' }
      )
      // Bottom wall (heating) — moves UP
      const bottomInset = heatingPct * chamberSize
      const wallBottom = Matter.Bodies.rectangle(
        chamberCenterX, chamberCenterY + halfSize - bottomInset, chamberSize, 6,
        { isStatic: true, label: 'compression_bottom' }
      )
      // Left wall (transport) — moves RIGHT
      const leftInset = transportPct * chamberSize
      const wallLeft = Matter.Bodies.rectangle(
        chamberCenterX - halfSize + leftInset, chamberCenterY, 6, chamberSize,
        { isStatic: true, label: 'compression_left' }
      )
      Matter.Composite.add(engine.world, [wallTop, wallRight, wallBottom, wallLeft])

      // 30 breathing particles inside the chamber — GOLD color, jittery
      for (let i = 0; i < 30; i++) {
        const x = chamberCenterX + (Math.random() - 0.5) * chamberSize * 0.6
        const y = chamberCenterY + (Math.random() - 0.5) * chamberSize * 0.6
        const body = Matter.Bodies.circle(x, y, 3, {
          density: 0.0005, frictionAir: 0.02, restitution: 0.8, label: 'breathing',
          collisionFilter: { category: 0x0004, mask: 0x0004 | 0x0008 },
        })
        // Random initial velocity for life
        Matter.Body.setVelocity(body, {
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
        })
        Matter.Composite.add(engine.world, body)
      }
      break
    }
  }
}
```

### Wire it in the lens useEffect:

```typescript
// Replace the existing lens useEffect in PixiStage.tsx
useEffect(() => {
  if (!morphRef.current || !engineRef.current || !appRef.current) return
  const w = appRef.current.screen.width
  const h = appRef.current.screen.height
  const POS = computePositions(w, h)
  const pressure = TIME_PRESSURE[time] * FUTURE_PRESSURE[future]

  // Reconfigure physics bodies for this lens
  reconfigurePhysicsForLens(engineRef.current, lens, POS, pressure, w, h)

  // GSAP morph the visual renderers
  morphRef.current.morphTo(lens)
}, [lens, time, future, scene])
```

---

## PATCH 2: GSAP-animated lens transitions in MorphController

**Problem:** `morphTo()` tweens an empty object. No visual crossfade.

**Fix:** Replace `morphTo()` with real GSAP cross-fade on Pixi containers.

### File: `src/scenes/cascade/MorphController.ts`

Replace the `morphTo` method:

```typescript
morphTo(targetLens: LensId, duration = 1.2): Promise<void> {
  if (this.transitioning || targetLens === this.currentLens) {
    // Even if same lens, still update showOnly for state sync
    this.showOnly(targetLens)
    return Promise.resolve()
  }

  this.transitioning = true
  const fromLens = this.currentLens
  this.currentLens = targetLens
  this.state.activeLens = targetLens

  const outRenderer = this.getRendererForLens(fromLens)
  const inRenderer = this.getRendererForLens(targetLens)

  // Make incoming visible before fading in
  inRenderer.setVisible(true)

  return new Promise(resolve => {
    const tl = gsap.timeline({
      onComplete: () => {
        this.transitioning = false
        this.showOnly(targetLens)
        resolve()
      },
    })

    // Get the PIXI containers from renderers (add getContainer() method to each renderer)
    const outContainer = (outRenderer as any).container as PIXI.Container
    const inContainer = (inRenderer as any).container as PIXI.Container

    if (outContainer && inContainer) {
      // Cross-fade: out shrinks + fades, in grows + fades in
      inContainer.alpha = 0
      inContainer.scale.set(0.92)

      tl.to(outContainer, {
        alpha: 0,
        duration: duration * 0.5,
        ease: 'power2.in',
        onUpdate: () => {
          // Scale down slightly as it fades
          outContainer.scale.set(1.0 - (1.0 - outContainer.alpha) * 0.08)
        },
      }, 0)

      tl.to(inContainer, {
        alpha: 1,
        duration: duration * 0.6,
        ease: 'power2.out',
        onUpdate: () => {
          inContainer.scale.set(0.92 + inContainer.alpha * 0.08)
        },
      }, duration * 0.3) // overlap by 0.3

    } else {
      // Fallback: instant switch
      outRenderer.setVisible(false)
      inRenderer.setVisible(true)
      this.transitioning = false
      resolve()
    }
  })
}
```

---

## PATCH 3: Time scrubbing changes physics forces with GSAP animation

**Problem:** Changing time only adjusts a pressure float. No visible physics change.

**Fix:** Time changes GSAP-animate chokepoint wall gap, vessel speed, and congestion strength.

### File: `src/stage/scene/PixiStage.tsx`

Replace the time/future useEffect:

```typescript
// Replace the existing time/future useEffect
useEffect(() => {
  if (!morphRef.current || !engineRef.current) return

  const pressure = TIME_PRESSURE[time] * FUTURE_PRESSURE[future]
  const engine = engineRef.current

  // Animate pressure to morph controller
  const current = { p: morphRef.current['state'].pressure }
  gsap.to(current, {
    p: pressure,
    duration: 0.8,
    ease: 'power2.out',
    onUpdate: () => {
      morphRef.current?.setPressure(current.p)
    },
  })

  // Animate chokepoint walls
  const walls = Matter.Composite.allBodies(engine.world)
    .filter(b => b.label === 'chokepoint_wall')

  if (walls.length >= 2) {
    const w = appRef.current?.screen.width || window.innerWidth
    const h = appRef.current?.screen.height || window.innerHeight
    const POS = computePositions(w, h)

    // Gap shrinks with pressure: 30 at day1 → 0 at month1+redSea
    const targetGap = Math.max(0, 30 - pressure * 28)
    const halfGap = targetGap / 2
    const wallLen = 60

    gsap.to(walls[0].position, {
      x: POS.hormuz.x,
      y: POS.hormuz.y - halfGap - wallLen / 2,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => Matter.Body.setPosition(walls[0], walls[0].position),
    })
    gsap.to(walls[1].position, {
      x: POS.hormuz.x,
      y: POS.hormuz.y + halfGap + wallLen / 2,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => Matter.Body.setPosition(walls[1], walls[1].position),
    })
  }

  // Animate supply gate for medicine lens
  const gates = Matter.Composite.allBodies(engine.world)
    .filter(b => b.label === 'supply_gate')
  if (gates.length >= 2) {
    const w = appRef.current?.screen.width || window.innerWidth
    const h = appRef.current?.screen.height || window.innerHeight
    const POS = computePositions(w, h)
    const gateOpeningPct = Math.max(0.3, 1.0 - pressure * 0.6)
    const gateGap = 40 * gateOpeningPct
    const halfGap = gateGap / 2

    gsap.to({}, {
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: function() {
        const progress = this.progress()
        const currentHalfGap = halfGap // simplified — interpolate if needed
        Matter.Body.setPosition(gates[0], {
          x: POS.hospital.x,
          y: POS.hospital.y - currentHalfGap - 20,
        })
        Matter.Body.setPosition(gates[1], {
          x: POS.hospital.x,
          y: POS.hospital.y + currentHalfGap + 20,
        })
      },
    })
  }

  // Animate compression walls for household lens
  const compressionWalls = Matter.Composite.allBodies(engine.world)
    .filter(b => b.label?.startsWith('compression_'))
  if (compressionWalls.length === 4) {
    const w = appRef.current?.screen.width || window.innerWidth
    const h = appRef.current?.screen.height || window.innerHeight
    const cx = w * 0.5
    const cy = h * 0.45
    const size = 150
    const half = size / 2

    const fuelInset = 0.08 * pressure * size
    const foodInset = 0.20 * pressure * size
    const heatInset = 0.02 * pressure * size
    const transInset = 0.07 * pressure * size

    const targets = [
      { body: compressionWalls.find(b => b.label === 'compression_top')!, y: cy - half + fuelInset },
      { body: compressionWalls.find(b => b.label === 'compression_right')!, x: cx + half - foodInset },
      { body: compressionWalls.find(b => b.label === 'compression_bottom')!, y: cy + half - heatInset },
      { body: compressionWalls.find(b => b.label === 'compression_left')!, x: cx - half + transInset },
    ]

    targets.forEach(({ body, x, y }) => {
      if (!body) return
      gsap.to(body.position, {
        x: x ?? body.position.x,
        y: y ?? body.position.y,
        duration: 1.2,
        ease: 'power2.inOut',
        onUpdate: () => Matter.Body.setPosition(body, body.position),
      })
    })
  }

  // Constriction state
  if (renderersRef.current) {
    renderersRef.current.flowBands.setConstricted(
      pressure > 0.3 && future !== 'closureEnds'
    )
  }
}, [time, future])
```

---

## PATCH 4: "What happens next?" splits the screen physically

**Problem:** `SplitFutureRenderer` exists but only draws a line and labels. 
Physics world doesn't duplicate. No actual split.

**Fix:** When future changes from baseline, clone all active bodies into a 
second set with modified forces. Mask left/right halves of the Pixi stage.

### File: `src/stage/scene/PixiStage.tsx`

Add split-screen logic when `compareMode` becomes true:

```typescript
// Replace the compareMode useEffect
useEffect(() => {
  if (!splitRef.current || !engineRef.current || !appRef.current) return
  const engine = engineRef.current
  const app = appRef.current
  const w = app.screen.width
  const h = app.screen.height

  if (compareMode && future !== 'baseline') {
    // Show the split renderer
    splitRef.current.setVisible(true)

    // GSAP animate split progress from 0 to 1
    const obj = { split: 0 }
    gsap.to(obj, {
      split: 1,
      duration: 1.5,
      ease: 'power3.inOut',
      onUpdate: () => splitRef.current?.setSplit(obj.split),
    })

    // Clone existing bodies as "altered future" bodies
    const existingBodies = Matter.Composite.allBodies(engine.world)
      .filter(b => !b.isStatic && b.label !== 'breathing')

    existingBodies.forEach(original => {
      // Shift clone to right half
      const clone = Matter.Bodies.circle(
        original.position.x + w / 2,
        original.position.y,
        (original as any).circleRadius || 3,
        {
          density: original.density,
          frictionAir: original.frictionAir,
          restitution: original.restitution,
          label: `${original.label}_altered`,
          collisionFilter: { category: 0x0010, mask: 0x0010 | 0x0008 },
        }
      )
      Matter.Body.setVelocity(clone, { ...original.velocity })
      Matter.Composite.add(engine.world, clone)
    })

    // Modify altered-future forces based on selected future
    // This happens in the ticker — altered bodies get different force multipliers
    ;(engine as any).__futureMultiplier = FUTURE_PRESSURE[future]

  } else {
    // Remove altered bodies
    const altered = Matter.Composite.allBodies(engine.world)
      .filter(b => b.label?.includes('_altered'))
    altered.forEach(b => Matter.Composite.remove(engine.world, b))

    // GSAP close split
    const obj = { split: splitRef.current['splitProgress'] || 0 }
    gsap.to(obj, {
      split: 0,
      duration: 0.8,
      ease: 'power2.in',
      onUpdate: () => splitRef.current?.setSplit(obj.split),
      onComplete: () => splitRef.current?.setVisible(false),
    })
    ;(engine as any).__futureMultiplier = 1.0
  }
}, [compareMode, future])
```

---

## PATCH 5: ScrollTrigger drives scene progression

**Problem:** ScrollTrigger `onUpdate` has empty branches.

**Fix:** Scroll progress drives scene transitions with GSAP choreography.

### File: `src/app/Shell.tsx`

Replace the ScrollTrigger useEffect:

```typescript
useEffect(() => {
  if (!stageVisible || !storyStageRef.current) return

  let lastScene: SceneId = 'baseline'

  const st = ScrollTrigger.create({
    trigger: storyStageRef.current,
    start: 'top top',
    end: '+=4000',  // 4000px of scroll = full story
    pin: true,
    scrub: 0.5,     // smooth scrub with 0.5s lag
    onUpdate: (self) => {
      const p = self.progress

      let targetScene: SceneId
      let targetLens: LensId = 'shipping'
      let targetTime: TimeId = 'day1'

      if (p < 0.15) {
        // 0–15%: Baseline — calm flow
        targetScene = 'baseline'
        targetLens = 'shipping'
        targetTime = 'day1'
      } else if (p < 0.30) {
        // 15–30%: Rupture — chokepoint closes
        targetScene = 'rupture'
        targetLens = 'shipping'
        targetTime = 'day3'
      } else if (p < 0.45) {
        // 30–45%: Detour — Cape reroute activates
        targetScene = 'detour'
        targetLens = 'shipping'
        targetTime = 'week1'
      } else if (p < 0.55) {
        // 45–55%: Cascade — freight lens
        targetScene = 'cascade'
        targetLens = 'freight'
        targetTime = 'week1'
      } else if (p < 0.65) {
        // 55–65%: Cascade — medicine lens
        targetScene = 'cascade'
        targetLens = 'medicine'
        targetTime = 'week1'
      } else if (p < 0.80) {
        // 65–80%: Your month — household lens
        targetScene = 'yourMonth'
        targetLens = 'household'
        targetTime = 'month1'
      } else {
        // 80–100%: What happens next
        targetScene = 'whatNext'
        targetLens = 'household'
        targetTime = 'month1'
      }

      // Only send scene change when crossing a threshold
      if (targetScene !== lastScene) {
        lastScene = targetScene
        send({ type: 'SET_SCENE', sceneId: targetScene } as any)

        // Trigger GSAP scene choreography
        switch (targetScene) {
          case 'rupture':
            // Camera shake
            gsap.to(storyStageRef.current, {
              x: '+=3', duration: 0.08, repeat: 5, yoyo: true,
              ease: 'power4.inOut',
              onComplete: () => gsap.set(storyStageRef.current, { x: 0 }),
            })
            // Audio
            audio.playRupture?.()
            break

          case 'detour':
            // Flash the stage amber briefly
            if (storyStageRef.current) {
              gsap.fromTo(storyStageRef.current, 
                { filter: 'brightness(1.3) saturate(1.5)' },
                { filter: 'brightness(1.0) saturate(1.0)', duration: 0.8 }
              )
            }
            break

          case 'cascade':
            // Narrative beat
            audio.playDomainCrossing?.()
            break

          case 'yourMonth':
            // Stage dims, compression takes focus
            gsap.to(storyStageRef.current, {
              filter: 'brightness(0.6)',
              duration: 1.5,
              ease: 'power2.inOut',
            })
            audio.playCompression?.()
            break
        }
      }

      // Continuous updates: lens and time follow scroll
      send({ type: 'SET_LENS', lens: targetLens } as any)
      send({ type: 'SET_TIME', time: targetTime } as any)
    },
  })

  scrollTriggerRef.current = st

  return () => {
    st.kill()
    scrollTriggerRef.current = null
  }
}, [stageVisible, send, audio])
```

---

## PATCH 6: Scene transition GSAP choreography

### File: `src/stage/scene/PixiStage.tsx`

Add a new useEffect that watches `scene` and plays GSAP timelines:

```typescript
// Scene transition choreography
useEffect(() => {
  if (!renderersRef.current || !engineRef.current || !appRef.current) return
  const engine = engineRef.current
  const renderers = renderersRef.current

  switch (scene) {
    case 'rupture': {
      // Animate chokepoint closure over 1.5s
      const walls = Matter.Composite.allBodies(engine.world)
        .filter(b => b.label === 'chokepoint_wall')

      if (walls.length >= 2) {
        const w = appRef.current.screen.width
        const h = appRef.current.screen.height
        const POS = computePositions(w, h)

        // Start with gap open, close it
        const anim = { gap: 30 }
        gsap.to(anim, {
          gap: 3,
          duration: 1.5,
          ease: 'power3.in',
          onUpdate: () => {
            const halfGap = anim.gap / 2
            Matter.Body.setPosition(walls[0], {
              x: POS.hormuz.x,
              y: POS.hormuz.y - halfGap - 30,
            })
            Matter.Body.setPosition(walls[1], {
              x: POS.hormuz.x,
              y: POS.hormuz.y + halfGap + 30,
            })
          },
        })
      }

      // Set constricted
      renderers.flowBands.setConstricted(true)
      break
    }

    case 'detour': {
      // Cape route fades in
      renderers.flowBands.setConstricted(true)
      break
    }

    case 'cascade': {
      // Auto-morph through lenses with delay
      const morphSequence = async () => {
        await morphRef.current?.morphTo('shipping', 0.8)
        await new Promise(r => setTimeout(r, 1500))
        await morphRef.current?.morphTo('freight', 1.0)
        await new Promise(r => setTimeout(r, 1500))
        await morphRef.current?.morphTo('medicine', 1.0)
      }
      morphSequence()
      break
    }
  }
}, [scene])
```

---

## PATCH 7: Richer Pixi visuals per renderer

### File: `src/stage/renderers/FlowBandRenderer.ts`

In the `update()` method, after drawing ship miniatures, add particle emissions:

```typescript
// Add inside the vessel rendering loop, after drawShipMiniature:

// Exhaust particles — 2-3 tiny dots behind each ship that fade
const exhaustCount = 2 + Math.floor(Math.random() * 2)
for (let e = 0; e < exhaustCount; e++) {
  const age = Math.random() // 0 = just born, 1 = fading
  const ex = bx - Math.cos(v.prevAngle) * (8 + age * 12) * scale + (Math.random() - 0.5) * 4
  const ey = by - Math.sin(v.prevAngle) * (8 + age * 12) * scale + (Math.random() - 0.5) * 4
  const ea = (1 - age) * 0.3 * alpha
  this.actorGfx.beginFill(color, ea)
  this.actorGfx.drawCircle(ex, ey, 1.0 * (1 - age * 0.5))
  this.actorGfx.endFill()
}
```

### File: `src/stage/renderers/CongestionRenderer.ts`

In the update loop for congestion particles, add pulsing and tension web:

```typescript
// After drawing each congestion particle, add pulse scale:
const pulseScale = 0.85 + 0.3 * Math.sin(Date.now() * 0.003 + i * 1.7)
const drawRadius = (body.circleRadius || 2.5) * pulseScale

// After all particles drawn, add tension web between nearby particles:
const positions = this.bodies.map(b => b.position)
for (let i = 0; i < positions.length; i++) {
  for (let j = i + 1; j < positions.length; j++) {
    const dx = positions[j].x - positions[i].x
    const dy = positions[j].y - positions[i].y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 25 && dist > 2) {
      const alpha = (1 - dist / 25) * 0.15 * this.pressure
      this.gfx.lineStyle(0.5, 0xff8844, alpha)
      this.gfx.moveTo(positions[i].x, positions[i].y)
      this.gfx.lineTo(positions[j].x, positions[j].y)
    }
  }
}
this.gfx.lineStyle(0)
```

### File: `src/stage/renderers/PulseRenderer.ts`

Add blocked-packet visual — packets that hit the supply gate turn red and shake:

```typescript
// In the update loop, after drawing each medicine packet:

// Check if packet is near the supply gate and slowed (blocked)
const distToGate = Math.sqrt(
  (bx - this.shelfPos.x) ** 2 + (by - this.shelfPos.y) ** 2
)
const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2)
const isBlocked = distToGate < 30 && speed < 0.3

if (isBlocked) {
  // Red tint + shake
  const shakeX = (Math.random() - 0.5) * 2
  const shakeY = (Math.random() - 0.5) * 2
  drawMedicineMiniature(this.actorGfx, bx + shakeX, by + shakeY, 0, scale, alpha)
  // Red glow around blocked packet
  this.actorGfx.beginFill(0xff3333, 0.15)
  this.actorGfx.drawCircle(bx, by, 8 * scale)
  this.actorGfx.endFill()
} else if (distToGate < 15) {
  // Green flash — packet passed through
  this.actorGfx.beginFill(0x44ff44, 0.2 * (1 - distToGate / 15))
  this.actorGfx.drawCircle(bx, by, 6 * scale)
  this.actorGfx.endFill()
  drawMedicineMiniature(this.actorGfx, bx, by, 0, scale, alpha)
} else {
  drawMedicineMiniature(this.actorGfx, bx, by, 0, scale, alpha)
}
```

---

## PATCH 8: Per-frame physics forces in the ticker

**Problem:** Bodies spawn but don't receive continuous forces. They just sit there.

**Fix:** In the Pixi ticker, apply forces to bodies based on current lens + state.

### File: `src/stage/scene/PixiStage.tsx`

Replace the ticker callback with force application:

```typescript
app.ticker.add((delta) => {
  const dt = delta / 60
  const currentLens = morphRef.current?.getCurrentLens() || 'shipping'
  const currentPressure = morphRef.current?.['state']?.pressure || 0.5

  // One physics step
  Matter.Engine.update(engine, dt * 1000)

  // ── Apply lens-specific forces to bodies ──
  const allBodies = Matter.Composite.allBodies(engine.world).filter(b => !b.isStatic)

  allBodies.forEach(body => {
    if (body.label === 'vessel' || body.label === 'vessel_reroute') {
      // Vessels: force toward next waypoint along their route
      // FlowBandRenderer handles this internally — but add jitter for life
      const jitter = 0.00008
      Matter.Body.applyForce(body, body.position, {
        x: (Math.random() - 0.5) * jitter,
        y: (Math.random() - 0.5) * jitter,
      })
    }

    if (body.label === 'congestion') {
      // Congestion: attract toward Nairobi with strength based on pressure
      const target = POS.nairobi
      const dx = target.x - body.position.x
      const dy = target.y - body.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 5) {
        const strength = 0.00003 * (0.5 + currentPressure)
        Matter.Body.applyForce(body, body.position, {
          x: (dx / dist) * strength,
          y: (dy / dist) * strength,
        })
      }
    }

    if (body.label === 'medicine_packet') {
      // Medicine: weak force toward hospital, weakened by pressure
      const target = POS.hospital
      const dx = target.x - body.position.x
      const dy = target.y - body.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 5) {
        const strength = 0.00004 * (1.2 - currentPressure * 0.5)
        Matter.Body.applyForce(body, body.position, {
          x: (dx / dist) * strength,
          y: (dy / dist) * strength,
        })
      }
    }

    if (body.label === 'breathing') {
      // Breathing particles: random jitter that increases as chamber shrinks
      const jitter = 0.0001 * (0.5 + currentPressure * 2)
      Matter.Body.applyForce(body, body.position, {
        x: (Math.random() - 0.5) * jitter,
        y: (Math.random() - 0.5) * jitter,
      })
    }

    // Altered-future bodies get modified forces
    if (body.label?.includes('_altered')) {
      const futureMultiplier = (engine as any).__futureMultiplier || 1.0
      const extraForce = 0.00002 * (futureMultiplier - 1.0)
      Matter.Body.applyForce(body, body.position, {
        x: (Math.random() - 0.5) * extraForce,
        y: (Math.random() - 0.5) * extraForce,
      })
    }
  })

  // ── Update all renderers ──
  flowBands.update(dt)
  congestion.update(dt)
  filaments.update(dt)
  pulses.update(dt)
  margins.update(dt)
  split.update()
})
```

---

## PATCH 9: Pixi stage atmosphere filter

### File: `src/stage/scene/PixiStage.tsx`

After creating the PIXI app, add filters:

```typescript
// After app is created, add atmosphere
import { GlowFilter } from '@pixi/filter-glow'

// Inside initPixi, after all renderers are created:

// Vignette overlay
const vignette = new PIXI.Graphics()
const vignetteGradient = (ctx: CanvasRenderingContext2D) => {
  const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7)
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(1, 'rgba(0,0,0,0.4)')
  return gradient
}
// Simpler: just draw concentric dark circles
for (let i = 10; i >= 0; i--) {
  const radius = Math.max(w, h) * (0.3 + i * 0.05)
  const alpha = i * 0.02
  vignette.beginFill(0x000000, alpha)
  vignette.drawCircle(w / 2, h / 2, radius)
  vignette.endFill()
}
app.stage.addChild(vignette)

// Glow filter on the entire stage (requires @pixi/filter-glow or @pixi/filter-advanced-bloom)
// If package is available:
try {
  const glow = new GlowFilter({ distance: 8, outerStrength: 0.5, color: 0x4488cc })
  app.stage.filters = [glow]
} catch (e) {
  // Filter not available — skip
}
```

---

## SUMMARY OF CHANGES

| Patch | What it fixes | Key file |
|-------|---------------|----------|
| 1 | Physics reconfigures per lens | PixiStage.tsx |
| 2 | GSAP cross-fade on lens morph | MorphController.ts |
| 3 | Time scrub animates walls/forces | PixiStage.tsx |
| 4 | "What happens next?" splits screen | PixiStage.tsx |
| 5 | ScrollTrigger drives scenes | Shell.tsx |
| 6 | Scene transitions with GSAP | PixiStage.tsx |
| 7 | Richer Pixi visuals per renderer | All renderers |
| 8 | Per-frame physics forces in ticker | PixiStage.tsx |
| 9 | Atmosphere filter + vignette | PixiStage.tsx |

**Install if not already present:**
```bash
npm install @pixi/filter-glow @pixi/filter-advanced-bloom
```

**The test after applying all patches:**
- Tap "Follow the... Freight" → ships disappear, congestion particles spawn at port, pile up in corridor with tension webs between them
- Scrub from Day 1 → Month 1 → chokepoint wall visibly closes, more reroute vessels, congestion thickens, compression walls close in
- Tap "Houthis resume Red Sea attacks" → screen splits, right half shows doubled pressure, everything more stressed
- Scroll through the story → scenes auto-progress with camera shakes, GSAP crossfades, lens auto-morphs
- Each lens should look like a COMPLETELY DIFFERENT WORLD — not subtle tweaks
