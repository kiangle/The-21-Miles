# 21 Miles — Detailed Implementation Plan for Claude Code

## Goal

Turn the current build into a true Atlas showcase by making:

- the landed stage geographically legible
    
- PixiJS + Matter.js visually meaningful
    
- the control tray truly interactive
    
- each lens distinct
    
- futures visibly branching
    
- the system explain the text, not the other way around
    

---

## 1. Working assumptions

Current state, based on the latest build:

- entry globe is much better and usable
    
- narrative layer is now strong
    
- landed stage still feels too abstract
    
- Pixi/Matter are mounted but under-expressive
    
- bottom tray looks interactive but does not create strong enough visible state changes
    
- minimal basemap is missing or too weak
    
- Atlas power is still under-felt in the interaction layer
    

This patch is **not** about redoing the whole app.

It is about improving the **mounted landed experience**.

---

## 2. Implementation order

Follow this order exactly:

### Phase 1 — Fix landed-stage structure

1. Audit actual mounted path after Kenya selection
    
2. Confirm map, Pixi, Matter, overlays, and tray are all mounted in the same active scene
    
3. Fix layering/pointer-events/z-index first
    

### Phase 2 — Add minimal basemap

1. Put a restrained geographic layer under the landed stage
    
2. Show Kenya, Mombasa, Nairobi, sea/coastline, corridor relation
    
3. Keep it minimal and dark
    

### Phase 3 — Make tray controls real

1. Ensure clicks are received
    
2. Ensure state updates fire
    
3. Ensure stage visuals subscribe and react
    
4. Ensure every tray control produces visible world change
    

### Phase 4 — Redesign Pixi + Matter visual grammar

1. Shipping
    
2. Freight
    
3. Medicine
    
4. Food
    
5. Household compression
    

### Phase 5 — Future branching

1. Make “What happens next?” visibly alter flows/pressure/compression
    
2. Not just text
    

### Phase 6 — Final polish

1. Strengthen clarity
    
2. Remove decorative noise
    
3. Improve coherence between text and system visuals
    

---

## 3. Mandatory architectural rule

Do **not** create a second parallel landed-stage implementation.

Patch the current mounted path.

Work through the actual runtime path already in use after Kenya click.

You must improve the existing mounted path, not build alternative unused components.

---

## 4. Runtime path audit requirements

Before patching, confirm the active path after Kenya selection.

Expected path should look like:

`Entry Globe -> Kenya selected -> flyTo -> landed stage -> role perspective -> narrative progression -> tray controls -> future branching`

You must explicitly identify:

- where `MapRoot` is mounted
    
- where `PixiStage` is mounted
    
- where `Matter.Engine` is instantiated
    
- where tray controls dispatch state
    
- where stage visuals subscribe to lens/time/future/perspective
    
- whether any overlay is intercepting clicks
    

Return this internally before major code edits.

---

# 5. Landed-stage structure spec

## Goal

The landed stage must feel like one integrated composition:

- **basemap** = place
    
- **Pixi** = living system
    
- **Matter** = pressure logic
    
- **narrative** = interpretation
    
- **tray** = control surface
    

Not:

- text over random background art
    

---

## 6. Minimal basemap spec

### Purpose

The user must know where they are.

### Required visible elements

- Kenya outline
    
- coastline / Indian Ocean context
    
- Mombasa
    
- Nairobi
    
- corridor relation between Mombasa and Nairobi
    

### Optional

- East Africa regional hint if subtle
    
- port symbol
    
- corridor highlight
    

### Must not include

- busy consumer-map labels
    
- bright roads everywhere
    
- irrelevant map chrome
    
- default full cartography
    

### Style

- deep navy / near-black
    
- muted sea vs land distinction
    
- thin coastline
    
- minimal label treatment
    
- port/city markers in subtle gold/off-white
    
- corridor visible but restrained
    

### Implementation direction

Use MapLibre as the mounted base layer.

If the current MapLibre style is too empty or broken:

- patch the style so it has a minimal visible geography layer
    
- or create a restrained custom style configuration
    

But MapLibre must remain truly mounted and useful.

### Acceptance condition

At a glance I can tell:

- this is Kenya
    
- Mombasa is the port
    
- Nairobi is inland
    
- the corridor matters
    

---

# 7. Control tray implementation spec

This is the most important interaction surface after the narrative.

## Controls that must work

- Follow the…
    
    - Shipping
        
    - Freight
        
    - Medicine
        
    - Food
        
- Timeline
    
    - Day 1
        
    - Day 3
        
    - Week 1
        
    - Month 1
        
- What happens next?
    
    - future options from Atlas/bootstrap
        
- See through…
    
    - Joseph’s eyes
        
    - Amara’s eyes
        

---

## 7.1 Control-bar debugging checklist

Audit and fix all of the following:

### Pointer and layering

- pointer-events enabled on tray
    
- Pixi canvas not intercepting clicks
    
- map layer not intercepting clicks
    
- narrative overlays not blocking tray
    
- tray z-index above stage visuals
    
- buttons have active hit areas
    

### State path

For each button, verify:

- click received
    
- dispatch fired
    
- machine state updated
    
- subscribed components rerender
    
- visible world changes
    

### Required report

For each control type, verify:

- input works
    
- state changes
    
- visible effect happens
    

---

## 7.2 Required visible behavior for each tray control

### Follow the… = change analytical lens

#### Shipping

Primary world emphasis:

- maritime lanes
    
- chokepoints
    
- queueing
    
- rerouting
    
- port pressure
    

#### Freight

Primary world emphasis:

- inland corridor
    
- convoy rhythm
    
- depot buildup
    
- bottlenecks
    
- port-to-city transfer
    

#### Medicine

Primary world emphasis:

- pulse cadence
    
- clinic shelf depletion
    
- missed beats
    
- fragile timed flow
    

#### Food

Primary world emphasis:

- broad household spread
    
- market distribution
    
- basket squeeze
    
- compounding pressure
    

### Rule

Switching lens must visibly reorganize the world within 1 second.

---

### Timeline = change stage evolution

#### Day 1

- rupture onset
    
- early queue
    
- little downstream compression yet
    

#### Day 3

- reroute emerging
    
- corridor pressure visible
    
- prices beginning to move
    

#### Week 1

- medicine cadence breaks visible
    
- freight irregularity stronger
    
- basket squeeze begins
    

#### Month 1

- sustained rerouting
    
- depleted timing rhythm
    
- strongest compression state
    

### Rule

Timeline must change:

- flow density
    
- queue size
    
- cadence rhythm
    
- compression severity
    
- narrative phrasing where relevant
    

---

### What happens next? = branch futures

Each future must visibly alter:

- route pressure
    
- queue size
    
- corridor load
    
- medicine cadence
    
- household compression
    

#### Example mapping

**attacks resume**

- more blockage
    
- longer queues
    
- higher pressure
    
- stronger compression
    

**reserves released**

- some local relief
    
- partial corridor stabilization
    
- temporary chamber widening
    

**ceasefire opens**

- queue drains gradually
    
- reroutes ease
    
- cadence recovers with lag
    

### Rule

Future choice must feel like a force acting on the world.

---

### See through… = change perspective

#### Joseph

Emphasize:

- freight
    
- diesel
    
- corridor economics
    
- logistics timing
    

#### Amara

Emphasize:

- medicine cadence
    
- shelf risk
    
- downstream personal consequence
    

### Rule

Perspective switch must change:

- narrative framing
    
- highlighted subsystem
    
- visual emphasis
    
- some metrics or overlay hierarchy
    

---

# 8. Pixi + Matter redesign spec

This is the heart of the patch.

## First-principles rule

Matter should drive:

- blockage
    
- collision
    
- queue
    
- squeeze
    
- competition
    
- delayed release
    

Pixi should render:

- flow
    
- trails
    
- glow
    
- rhythm
    
- depletion
    
- spread
    
- compression
    
- symbolic anchors
    

Not random abstract lines.

---

## 8.1 Shipping lens spec

### Human question

Where did the ships go?

### Must show

- chokepoint blockage
    
- bunching upstream
    
- reroute around Africa
    
- maritime current
    
- slower longer path
    

### Matter logic

- create chokepoint gate
    
- packet bodies queue upstream
    
- some bodies reroute after delay
    
- pressure increases before reroute release
    

### Pixi rendering

- flow lanes with glow
    
- moving vessel/container packets
    
- queue density bloom
    
- reroute arc activation
    
- path thickness by load
    

### Recognizable anchors

- occasional vessel/container hints
    
- chokepoint ring
    
- port node
    

### Success condition

Without reading, the user can see:  
the route got blocked and the system is rerouting

---

## 8.2 Freight lens spec

### Human question

Why is the corridor slowing?

### Must show

- Mombasa to Nairobi corridor
    
- convoy rhythm
    
- depot accumulation
    
- uneven spacing
    
- bottleneck under reduced throughput
    

### Matter logic

- convoy packets as bodies
    
- corridor gates
    
- queue buildup at key transfer node
    
- spacing compression under load
    

### Pixi rendering

- convoy beads
    
- corridor band
    
- depot saturation glow
    
- interrupted cadence
    
- logistic slowdown rhythm
    

### Recognizable anchors

- convoy/truck hints
    
- depot node
    
- corridor line
    

### Success condition

User feels:  
this is inland logistics pressure, not ocean flow

---

## 8.3 Medicine lens spec

### Human question

Why is the clinic running short?

### Must show

- pulse-based supply rhythm
    
- fragile timed arrivals
    
- missed beats
    
- shelf depletion
    

### Matter logic

- packets delayed past timing window
    
- cadence breaks when route stress grows
    
- shelf refill misses threshold moments
    

### Pixi rendering

- pulse trains
    
- heartbeat cadence
    
- shelf cells/bars fading
    
- skipped rhythm event
    

### Recognizable anchors

- clinic node
    
- shelf motif
    
- medicine packet hints
    

### Success condition

User sees:  
timing broke, not only quantity

---

## 8.4 Food lens spec

### Human question

Why is my month shrinking?

### Must show

- broad distributed spread
    
- market/household sinks
    
- many small flows
    
- thinning and competition
    
- monthly squeeze
    

### Matter logic

- limited packets compete across sinks
    
- some packets diverted
    
- household chamber tightens
    
- lower-priority units squeezed out
    

### Pixi rendering

- branching distribution
    
- basket/market node hints
    
- thinning flow
    
- pressure coloration
    
- household sink animation
    

### Recognizable anchors

- baskets
    
- crates
    
- market nodes
    
- household sinks
    

### Success condition

User feels:  
this has reached everyday household life

---

# 9. Household compression chamber spec

This must become a signature visual.

## Goal

Translate the monthly hit into physical intuition.

## Must contain

Tokens or bodies representing:

- food
    
- fuel
    
- medicine
    
- rent
    
- maybe debt/school if already modeled
    

## Matter behavior

- chamber walls move inward as time/future worsens
    
- token bodies compete for room
    
- weaker categories get squeezed or displaced first
    
- future relief can widen chamber
    

## Pixi behavior

- elegant tokens
    
- subtle labels or category hints
    
- pressure lighting
    
- visible squeeze effect
    

## Rule

It must feel serious and physical, not playful.

## Success condition

User immediately understands:  
less can fit inside the month now

---

# 10. Visual distinction spec by lens

This is mandatory.

Each lens must have a distinct visual signature:

### Shipping

- maritime glow lanes
    
- queue bloom
    
- reroute arc
    
- ocean-facing logic
    

### Freight

- inland corridor rails
    
- convoy beads
    
- depot saturation
    
- bottleneck gates
    

### Medicine

- pulse rhythm
    
- fragile arrival timing
    
- clinic depletion
    

### Food

- distributed branching spread
    
- market/basket pressure
    
- household squeeze
    

Claude must not rely only on changing colors.  
It must change:

- motion type
    
- density pattern
    
- object form
    
- spatial emphasis
    
- explanatory hierarchy
    

---

# 11. Atlas-driven wiring requirements

Do not hardcode where Atlas data should already drive the experience.

The following must come from bootstrap or derived world data:

- future options
    
- role/perspective labels
    
- narrative pack
    
- route data
    
- chokepoints
    
- city/port anchors if present
    
- exposure/pressure values for compression and lens emphasis
    

If any current effect is hardcoded and can reasonably be driven from bootstrap, refactor it.

---

# 12. Remaining known fixes

## Entry globe

Do not spend major time here unless small cleanup is needed.  
Minor polish only:

- reduce clutter
    
- keep Kenya start obvious
    
- ensure premium feel remains
    

## Broken responsiveness in tray

Must be fully fixed now.

## Weak stage visuals

Must be either strengthened or simplified.  
No decorative abstraction.

## Missing clear place

Minimal basemap solves this.

---

# 13. Concrete file-by-file work plan

Patch these actual files, not theoretical new architecture.

## `src/stage/map/MapRoot.tsx`

- mount minimal basemap
    
- add Kenya/Mombasa/Nairobi grounding
    
- ensure dark restrained style
    
- ensure visible under overlays
    

## `src/stage/scene/PixiStage.tsx`

- redesign stage rendering by lens
    
- bind to lens/time/future/perspective changes
    
- make visible state changes strong
    
- ensure no dead decorative layers
    

## Matter integration file(s)

- instantiate actual queue/compression logic
    
- shipping gate logic
    
- freight corridor logic
    
- compression chamber logic
    

## `src/app/Shell.tsx`

- tray click handling
    
- z-index / pointer-events
    
- subscription to state changes
    
- ensure overlays and tray coexist correctly
    

## `src/state/machine/worldMachine.ts`

- verify lens/time/future/perspective actions update state clearly
    
- ensure subscribers can respond to all tray changes
    

## narrative / overlay files

- keep narrative strength
    
- ensure copy responds to lens/time/perspective/future where needed
    

---

# 14. Acceptance checklist

This patch is not complete until all are true:

## Basemap

- I know where Kenya is
    
- I can identify Mombasa and Nairobi
    
- the sea/corridor relation is clear
    

## Controls

- every tray control is clickable
    
- every tray control visibly changes the world
    
- no fake-interactive UI remains
    

## Lens distinction

- shipping, freight, medicine, food are unmistakably different
    

## Timeline

- day/week/month visibly alter pressure and propagation
    

## Futures

- future selection visibly branches the world
    

## Perspective

- Joseph and Amara visibly change interpretation and emphasis
    

## Pixi/Matter

- background is explanatory, not decorative
    
- I can see blockage, queue, delay, cadence break, and compression
    

## Atlas showcase

A new viewer should conclude:  
Atlas reveals hidden interdependence and branching consequences

---

# 15. Required completion report from Claude

When done, return only:

1. what changed in the landed stage
    
2. how the basemap is mounted and styled
    
3. how each lens now differs visually
    
4. how Matter drives queue/compression logic
    
5. how each tray control changes the mounted world
    
6. files changed
    
7. anything still weak
    
8. screenshots for:
    
    - Shipping
        
    - Freight
        
    - Medicine
        
    - Food
        
    - household compression
        

---

