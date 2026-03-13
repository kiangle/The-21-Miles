# CLAUDE.md — 21 Miles v2

## What this is

21 Miles is a playable world. NOT a dashboard. NOT cards. NOT scrollytelling. The user sees Earth from space, watches trade arteries die, picks their country, and lives through the cascade as it reaches their kitchen table.

## Read in this order

1. `21MILES_V2_SPEC.md` — architecture, scenes, tech stack, build order
2. `21MILES_LANGUAGE_EXTENSIBILITY_PATCH.md` — **READ THIS SECOND. It overrides the spec on all user-facing language.**
3. `docs/MATTER_PHYSICS_SPEC.ts` — every Matter.js body definition and sync model
4. `public/ink/kenya.ink` — complete branching narrative for Kenya (nurse + driver)
5. `src/atlas/mock/kenyaMock.ts` — mock Atlas server with full graph data

## The two most important rules

**1. ZERO JARGON in any user-facing text.** No "fork," "cascade," "what-if scenario," "baseline," "compare mode," "compression chamber," "lens," "perspective," "node," "edge." See the language patch for the complete banned list and replacements.

**2. Everything comes from Atlas.** Countries, roles, scenarios, cascade nodes, connections, "what happens next?" options, narrative packs — all from Atlas. To add Japan, you add data to Atlas and author an ink file. Zero app code changes. The Kenya slice is ONE instance of a general system.

## User-facing language

| User sees | Never |
|---|---|
| "What happens next?" | "Fork the future" |
| "How things stand now" / "If this happens..." | "Baseline vs altered" |
| "See both paths side by side" | "Compare mode" |
| "Follow the medicine" | "Set lens: medicine" |
| "See through Amara's eyes" | "Switch perspective" |
| "Your month" (just the visual) | "Compression chamber" |
| "Show someone" | "Share your cascade" |
| "You traced a link" | "Connection discovered" |

## Tech stack

Three.js (globe) + MapLibre/deck.gl (geo) + PixiJS (2D world) + Matter.js (physics) + XState (state) + inkjs (narrative) + Tone.js (audio) + GSAP (transitions) + D3 (budget visual) + React/TypeScript/Vite

## MVP

Kenya. Nurse + truck driver. Hormuz closure → reroute → medicine path → your month → "what happens next?" (3 paths). Atlas-powered. Live data. Shareable clip.
