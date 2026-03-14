\# 21 MILES — VISUAL OVERLAY SYSTEM
 
\## For Claude Code: Read this entire document. Create every file listed.
 
This replaces the crude [deck.gl](http://deck.gl)  ScatterplotLayer/ArcLayer/TextLayer approach
 
with a proper SVG + HTML overlay system. [deck.gl](http://deck.gl)  keeps ONLY TripsLayer + PathLayer.
 
Everything else is crisp SVG arcs and HTML indicators with CSS animations.
 
\-----
 
\## STEP 1: Expose the MapLibre map instance from MapStage
 
MapStage.tsx currently hides the map ref. We need it in the parent for projection.
 
Change MapStage to use `forwardRef` and `useImperativeHandle`:
 
\`\`\`tsx
 
// MapStage.tsx — ADD these imports:
 
import { forwardRef, useImperativeHandle } from 'react'
 
// Change the component signature:
 
const MapStage = forwardRef<[maplibregl.Map](http://maplibregl.Map)  | null, MapStageProps>(function MapStage(
 
{ scene, currentTime, trips, interactive, mapOpacity, activeScenario },
 
ref
 
) {
 
// ... existing code ...
 
// ADD after mapRef.current = map in the initialization useEffect:
 
useImperativeHandle(ref, () => mapRef.current, \[mapReady\])
 
// ... rest unchanged ...
 
})
 
export default MapStage
 
\`\`\`
 
In App.tsx, create a ref:
 
\`\`\`tsx
 
const mapInstanceRef = useRef<[maplibregl.Map](http://maplibregl.Map)  | null>(null)
 
// Pass to MapStage:
 
<MapStage ref={mapInstanceRef} ... />
 
// Pass to MapOverlay:
 
<MapOverlay map={mapInstanceRef.current} ... />
 
\`\`\`
 
ALSO: Remove the ScatterplotLayer from MapStage.tsx. The HTML overlay replaces it.
 
Keep ONLY TripsLayer in the [deck.gl](http://deck.gl)  overlay. Remove the ScatterplotLayer import
 
and all ports-related code from the [deck.gl](http://deck.gl)  layers array.
 
\-----
 
\## STEP 2: Create `src/data/overlayData.ts`
 
This maps Atlas seed nodes to geographic positions, colors, and visual properties.
 
\`\`\`tsx
 
// src/data/overlayData.ts
 
// Maps Atlas cascade nodes to geographic coordinates and visual properties
 
export interface OverlayNode {
 
id: string
 
label: string
 
shortLabel: string // for floating label (max ~12 chars)
 
position: \[number, number\] // \[lng, lat\]
 
domain: 'energy' | 'shipping' | 'medicine' | 'food' | 'finance' | 'household'
 
color: string
 
activationDay: number
 
icon?: string // emoji or symbol for the indicator
 
crisisLabel?: string // appears as floating text when active (e.g. "¥239/L")
 
}
 
export interface OverlayArc {
 
id: string
 
sourceId: string
 
targetId: string
 
edgeType: 'Causes' | 'Triggers' | 'LeadsTo' | 'Amplifies' | 'Drains' | 'Mitigates' | 'Suppresses'
 
domain: 'shock' | 'supply' | 'hidden' | 'amplify' | 'mitigate'
 
color: string
 
activationDay: number
 
isHidden?: boolean // true for "epoché" arcs — the discovery moments
 
}
 
export interface OverlayLabel {
 
id: string
 
nodeId: string
 
text: string
 
color: string
 
activationDay: number
 
}
 
// ═══════════════════════════════════════
 
// NODE POSITIONS (geographic coordinates)
 
// ═══════════════════════════════════════
 
const POS: Record<string, \[number, number\]> = {
 
'scenario:shock\_strait\_closure': \[56.3, 26.5\],
 
'scenario:shock\_insurance\_withdrawal': \[51.5, 29.0\], // Lloyd's link → offset from Hormuz
 
'scenario:tanker\_halt': \[57.5, 25.5\], // just outside Hormuz
 
'scenario:shock\_oil\_price\_spike': \[54.0, 27.5\],
 
'scenario:shock\_lng\_halt': \[51.5, 25.3\], // Qatar Ras Laffan
 
'scenario:cape\_reroute': \[18.5, -34.4\], // Cape of Good Hope
 
'scenario:fleet\_shrink': \[65, 5\], // Indian Ocean (abstract)
 
'scenario:spare\_capacity\_trap': \[50, 24\], // Gulf
 
'scenario:spr\_depletion': \[-95, 30\], // US Cushing, OK
 
'scenario:china\_hoarding': \[116, 39\], // Beijing
 
'scenario:asian\_refinery\_buffer\_drain':\[136.62, 34.96\], // Yokkaichi
 
'scenario:impact\_gasoline\_spike': \[139.7, 35.7\], // Tokyo
 
'scenario:impact\_heating\_crisis': \[139.7, 35.7\], // Tokyo
 
'scenario:impact\_factory\_shutdown': \[137.0, 35.0\], // Aichi/Toyota
 
'scenario:eu\_gas\_doubles': \[10, 50\], // Europe
 
'scenario:fertilizer\_spike': \[10, 48\], // Europe
 
'scenario:medical\_supply\_halt': \[136.62, 34.96\], // Yokkaichi refinery
 
'scenario:impact\_hospital\_shortage': \[135.5, 34.7\], // Osaka
 
'scenario:food\_price\_spike': \[40, 10\], // Global/East Africa
 
'scenario:impact\_food\_insecurity': \[36.82, -1.29\], // East Africa
 
'scenario:em\_currency\_crash': \[78, 20\], // South Asia
 
'scenario:pharma\_cost\_crisis': \[78, 22\], // India pharma
 
'scenario:fed\_stagflation\_trap': \[-77, 38.9\], // Washington DC
 
'scenario:impact\_social\_unrest': \[31, 30\], // Cairo/MENA
 
'scenario:impact\_global\_recession': \[0, 30\], // Global
 
'scenario:impact\_debt\_spiral': \[30, 0\], // Emerging markets
 
'scenario:impact\_reserve\_exhaustion': \[-95, 32\], // US
 
// Ports
 
'port:hormuz': \[56.3, 26.5\],
 
'port:bab\_mandeb': \[43.3, 12.6\],
 
'port:suez': \[32.3, 30.0\],
 
'port:mombasa': \[39.67, -4.05\],
 
'port:singapore': \[103.8, 1.3\],
 
'port:yokkaichi': \[136.62, 34.96\],
 
'port:cape': \[18.5, -34.4\],
 
}
 
// ═══════════════════════════════════════
 
// DOMAIN COLORS
 
// ═══════════════════════════════════════
 
const DOMAIN\_COLORS: Record<string, string> = {
 
energy: '#FF6444',
 
shipping: '#82BEFF',
 
medicine: '#B464DC',
 
food: '#E8B94A',
 
finance: '#FF8866',
 
household:'#C8A96E',
 
shock: '#FF4432',
 
supply: '#DC8C3C',
 
hidden: '#B464DC',
 
amplify: '#FFC832',
 
mitigate: '#50C878',
 
}
 
// ═══════════════════════════════════════
 
// BUILD OVERLAY DATA FROM ATLAS SEED
 
// ═══════════════════════════════════════
 
export function buildOverlayNodes(seed: any): OverlayNode\[\] {
 
const nodes: OverlayNode\[\] = \[\]
 
const nodeDefs: Array<{
 
id: string; label: string; short: string; domain: OverlayNode\['domain'\];
 
day: number; icon?: string; crisis?: string
 
}> = \[
 
{ id: 'scenario:shock\_strait\_closure', label: 'Strait of Hormuz Closure', short: 'CLOSED', domain: 'energy', day: 0, icon: '⊘', crisis: 'CLOSED' },
 
{ id: 'scenario:shock\_insurance\_withdrawal', label: 'Insurance Withdrawn', short: 'No Insurance', domain: 'finance', day: 1, icon: '📋' },
 
{ id: 'scenario:tanker\_halt', label: 'Tanker Traffic Stops', short: 'Halted', domain: 'shipping', day: 1, icon: '⚓' },
 
{ id: 'scenario:shock\_oil\_price\_spike', label: 'Oil Price Spike', short: '$105/bbl', domain: 'energy', day: 2, crisis: '$105/bbl' },
 
{ id: 'scenario:shock\_lng\_halt', label: 'Qatar LNG Halt', short: 'LNG Stopped', domain: 'energy', day: 2 },
 
{ id: 'scenario:cape\_reroute', label: 'Cape Reroute', short: '+14 DAYS', domain: 'shipping', day: 3, crisis: '+14 DAYS' },
 
{ id: 'scenario:fleet\_shrink', label: 'Fleet Shrinks 18%', short: 'Fleet 82%', domain: 'shipping', day: 5, crisis: 'Fleet 82%' },
 
{ id: 'scenario:spr\_depletion', label: 'SPR Drawdown', short: 'SPR ↓', domain: 'energy', day: 5 },
 
{ id: 'scenario:asian\_refinery\_buffer\_drain', label: 'Refinery Buffers Draining', short: '', domain: 'energy', day: 8 },
 
{ id: 'scenario:impact\_gasoline\_spike', label: 'Gasoline ¥239/L', short: '¥239/L', domain: 'household', day: 12, crisis: '¥239/L' },
 
{ id: 'scenario:eu\_gas\_doubles', label: 'EU Gas Price Doubles', short: 'Gas ×2', domain: 'energy', day: 14 },
 
{ id: 'scenario:impact\_factory\_shutdown', label: 'Toyota Shifts Cut', short: 'SHIFTS CUT', domain: 'household', day: 18, crisis: 'SHIFTS CUT' },
 
{ id: 'scenario:medical\_supply\_halt', label: 'Medical Plastics Halt', short: 'IV Bags ↓', domain: 'medicine', day: 21 },
 
{ id: 'scenario:impact\_hospital\_shortage', label: 'Hospital Shortage', short: 'IV BAGS -50%', domain: 'medicine', day: 21, icon: '🏥', crisis: 'IV BAGS -50%' },
 
{ id: 'scenario:fertilizer\_spike', label: 'Fertilizer Spike', short: 'Fert. ↑', domain: 'food', day: 28 },
 
{ id: 'scenario:em\_currency\_crash', label: 'EM Currency Crash', short: '¥/$ ↓', domain: 'finance', day: 30 },
 
{ id: 'scenario:food\_price\_spike', label: 'Food Price Spike', short: 'Food +15%', domain: 'food', day: 45, crisis: 'RATIONED' },
 
{ id: 'scenario:impact\_food\_insecurity', label: 'Food Insecurity', short: 'Rationed', domain: 'food', day: 45 },
 
{ id: 'scenario:impact\_social\_unrest', label: 'Social Unrest', short: 'Unrest', domain: 'finance', day: 60 },
 
\]
 
for (const def of nodeDefs) {
 
const pos = POS\[[def.id](http://def.id) \]
 
if (!pos) continue
 
nodes.push({
 
id: [def.id](http://def.id) ,
 
label: def.label,
 
shortLabel: def.short,
 
position: pos,
 
domain: def.domain,
 
color: DOMAIN\_COLORS\[def.domain\],
 
activationDay: [def.day](http://def.day) ,
 
icon: def.icon,
 
crisisLabel: def.crisis,
 
})
 
}
 
// Add port nodes (always visible)
 
const portDefs = \[
 
{ id: 'port:hormuz', label: 'Hormuz', pos: POS\['port:hormuz'\]!, color: DOMAIN\_[COLORS.energy](http://COLORS.energy)  },
 
{ id: 'port:bab\_mandeb', label: 'Bab el-Mandeb', pos: POS\['port:bab\_mandeb'\]!, color: DOMAIN\_COLORS.shipping },
 
{ id: 'port:suez', label: 'Suez', pos: POS\['port:suez'\]!, color: DOMAIN\_COLORS.shipping },
 
{ id: 'port:yokkaichi', label: 'Yokkaichi', pos: POS\['port:yokkaichi'\]!, color: DOMAIN\_[COLORS.energy](http://COLORS.energy)  },
 
{ id: 'port:singapore', label: 'Singapore', pos: POS\['port:singapore'\]!, color: DOMAIN\_COLORS.shipping },
 
{ id: 'port:mombasa', label: 'Mombasa', pos: POS\['port:mombasa'\]!, color: DOMAIN\_COLORS.shipping },
 
{ id: 'port:cape', label: 'Cape', pos: POS\['port:cape'\]!, color: DOMAIN\_COLORS.shipping },
 
\]
 
for (const p of portDefs) {
 
nodes.push({
 
id: [p.id](http://p.id) , label: p.label, shortLabel: p.label,
 
position: p.pos, domain: 'shipping', color: p.color,
 
activationDay: -1, // always visible
 
})
 
}
 
return nodes
 
}
 
export function buildOverlayArcs(seed: any): OverlayArc\[\] {
 
const arcs: OverlayArc\[\] = \[\]
 
// Key cascade arcs (not all 48 edges — just the visually important ones)
 
const arcDefs: Array<{
 
src: string; tgt: string; type: OverlayArc\['edgeType'\];
 
domain: OverlayArc\['domain'\]; day: number; hidden?: boolean
 
}> = \[
 
// Shock propagation (red)
 
{ src: 'scenario:shock\_strait\_closure', tgt: 'scenario:tanker\_halt', type: 'Causes', domain: 'shock', day: 0 },
 
{ src: 'scenario:shock\_strait\_closure', tgt: 'scenario:shock\_oil\_price\_spike', type: 'Causes', domain: 'shock', day: 0 },
 
{ src: 'scenario:shock\_strait\_closure', tgt: 'scenario:shock\_lng\_halt', type: 'Causes', domain: 'shock', day: 0 },
 
// Supply chain (amber)
 
{ src: 'scenario:tanker\_halt', tgt: 'scenario:cape\_reroute', type: 'LeadsTo', domain: 'supply', day: 1 },
 
{ src: 'scenario:cape\_reroute', tgt: 'scenario:fleet\_shrink', type: 'Causes', domain: 'supply', day: 3 },
 
{ src: 'scenario:fleet\_shrink', tgt: 'scenario:asian\_refinery\_buffer\_drain', type: 'Amplifies', domain: 'supply', day: 5 },
 
// THE HIDDEN CONNECTION (purple) — the epoché moment
 
{ src: 'scenario:asian\_refinery\_buffer\_drain', tgt: 'scenario:medical\_supply\_halt', type: 'LeadsTo', domain: 'hidden', day: 8, hidden: true },
 
{ src: 'scenario:medical\_supply\_halt', tgt: 'scenario:impact\_hospital\_shortage', type: 'LeadsTo', domain: 'hidden', day: 21, hidden: true },
 
// Oil → household (amber→gold)
 
{ src: 'scenario:shock\_oil\_price\_spike', tgt: 'scenario:impact\_gasoline\_spike', type: 'LeadsTo', domain: 'supply', day: 2 },
 
// Food chain (amber)
 
{ src: 'scenario:fleet\_shrink', tgt: 'scenario:food\_price\_spike', type: 'Amplifies', domain: 'amplify', day: 5 },
 
{ src: 'scenario:eu\_gas\_doubles', tgt: 'scenario:fertilizer\_spike', type: 'Causes', domain: 'supply', day: 14 },
 
{ src: 'scenario:fertilizer\_spike', tgt: 'scenario:food\_price\_spike', type: 'Amplifies', domain: 'amplify', day: 28 },
 
// Cascading impacts
 
{ src: 'scenario:food\_price\_spike', tgt: 'scenario:impact\_food\_insecurity', type: 'LeadsTo', domain: 'supply', day: 45 },
 
{ src: 'scenario:impact\_food\_insecurity', tgt: 'scenario:impact\_social\_unrest', type: 'Triggers', domain: 'shock', day: 45 },
 
\]
 
for (const def of arcDefs) {
 
const srcPos = POS\[def.src\]
 
const tgtPos = POS\[def.tgt\]
 
if (!srcPos || !tgtPos) continue
 
arcs.push({
 
id: `arc_${def.src}_${def.tgt}`,
 
sourceId: def.src,
 
targetId: def.tgt,
 
edgeType: def.type,
 
domain: def.domain,
 
color: DOMAIN\_COLORS\[def.domain\],
 
activationDay: [def.day](http://def.day) ,
 
isHidden: def.hidden,
 
})
 
}
 
return arcs
 
}
 
export function buildOverlayLabels(): OverlayLabel\[\] {
 
return \[
 
{ id: 'lbl\_closed', nodeId: 'scenario:shock\_strait\_closure', text: 'CLOSED', color: '#FF4432', activationDay: 1 },
 
{ id: 'lbl\_cape', nodeId: 'scenario:cape\_reroute', text: '+14 DAYS', color: '#DC8C3C', activationDay: 3 },
 
{ id: 'lbl\_fleet', nodeId: 'scenario:fleet\_shrink', text: 'FLEET 82%', color: '#82BEFF', activationDay: 5 },
 
{ id: 'lbl\_gas', nodeId: 'scenario:impact\_gasoline\_spike', text: '¥239/L', color: '#C8A96E', activationDay: 12 },
 
{ id: 'lbl\_toyota', nodeId: 'scenario:impact\_factory\_shutdown', text: 'SHIFTS CUT', color: '#C8A96E', activationDay: 18 },
 
{ id: 'lbl\_iv', nodeId: 'scenario:impact\_hospital\_shortage', text: 'IV BAGS -50%', color: '#B464DC', activationDay: 21 },
 
{ id: 'lbl\_fert', nodeId: 'scenario:fertilizer\_spike', text: 'FERT. ×2', color: '#E8B94A', activationDay: 28 },
 
{ id: 'lbl\_food', nodeId: 'scenario:food\_price\_spike', text: 'RATIONED', color: '#E8B94A', activationDay: 45 },
 
{ id: 'lbl\_spr', nodeId: 'scenario:spr\_depletion', text: 'SPR ↓', color: '#FF6444', activationDay: 60 },
 
\]
 
}
 
export { POS as NODE\_POSITIONS }
 
\`\`\`
 
\-----
 
\## STEP 3b: Create `src/components/shared/SvgIcons.tsx`
 
Hand-drawn SVG icons per domain. These appear at cascade nodes instead of emoji.
 
Each icon is a small SVG component — crisp at any size, animatable, glowing.
 
\`\`\`tsx
 
// src/components/shared/SvgIcons.tsx
 
interface IconProps {
 
size?: number
 
color?: string
 
className?: string
 
}
 
/\*\* Hospital cross — medicine domain \*/
 
export function IconHospital({ size = 24, color = '#B464DC', className }: IconProps) {
 
return (
 
<svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
 
<rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.5" opacity="0.6" />
 
<path d="M12 7v10M7 12h10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
 
</svg>
 
)
 
}
 
/\*\* Oil barrel — energy domain \*/
 
export function IconBarrel({ size = 24, color = '#FF6444', className }: IconProps) {
 
return (
 
<svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
 
<ellipse cx="12" cy="6" rx="7" ry="3" stroke={color} strokeWidth="1.5" />
 
<path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6" stroke={color} strokeWidth="1.5" />
 
<ellipse cx="12" cy="12" rx="7" ry="2" stroke={color} strokeWidth="0.8" opacity="0.4" />
 
<path d="M10 9v6M14 9v6" stroke={color} strokeWidth="0.8" opacity="0.3" />
 
</svg>
 
)
 
}
 
/\*\* Ship — shipping domain \*/
 
export function IconShip({ size = 24, color = '#82BEFF', className }: IconProps) {
 
return (
 
<svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
 
<path d="M3 17l2 2c2 1 4 1 5 0s3-1 5 0 3 1 5 0l1-1" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
 
<path d="M4 14l1-5h14l1 5" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
 
<path d="M9 9V5h6v4" stroke={color} strokeWidth="1.5" />
 
<path d="M12 5V3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
 
</svg>
 
)
 
}
 
/\*\* Wheat/grain — food domain \*/
 
export function IconFood({ size = 24, color = '#E8B94A', className }: IconProps) {
 
return (
 
<svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
 
<path d="M12 21V10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
 
<path d="M12 10c-2-3-6-4-6-4s1 4 4 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill={color} fillOpacity="0.15" />
 
<path d="M12 10c2-3 6-4 6-4s-1 4-4 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill={color} fillOpacity="0.15" />
 
<path d="M12 14c-2-2.5-5-3-5-3s.5 3 3.5 5" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill={color} fillOpacity="0.1" />
 
<path d="M12 14c2-2.5 5-3 5-3s-.5 3-3.5 5" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill={color} fillOpacity="0.1" />
 
</svg>
 
)
 
}
 
/\*\* Factory — manufacturing domain \*/
 
export function IconFactory({ size = 24, color = '#C8A96E', className }: IconProps) {
 
return (
 
<svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
 
<path d="M4 21V11l5 3V8l5 3V5l5 3v13H4z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
 
<rect x="7" y="16" width="2" height="3" fill={color} opacity="0.4" />
 
<rect x="11" y="16" width="2" height="3" fill={color} opacity="0.4" />
 
<rect x="15" y="16" width="2" height="3" fill={color} opacity="0.4" />
 
<path d="M19 5V2M19 2h-2M19 2h2" stroke={color} strokeWidth="1" opacity="0.5" strokeLinecap="round" />
 
</svg>
 
)
 
}
 
/\*\* Currency/Yen — finance domain \*/
 
export function IconCurrency({ size = 24, color = '#FF8866', className }: IconProps) {
 
return (
 
<svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
 
<circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" opacity="0.5" />
 
<path d="M8 7l4 5 4-5M8 13h8M8 16h8M12 12v8" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
 
</svg>
 
)
 
}
 
/\*\* Protest/unrest — stability domain \*/
 
export function IconUnrest({ size = 24, color = '#FF4432', className }: IconProps) {
 
return (
 
<svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
 
<path d="M12 3v6M12 9l-5 4h10l-5-4z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
 
<path d="M7 13v8M17 13v8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
 
<path d="M5 21h14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
 
<circle cx="12" cy="18" r="2" stroke={color} strokeWidth="1" opacity="0.4" />
 
</svg>
 
)
 
}
 
/\*\* Reserve tank — SPR domain \*/
 
export function IconReserve({ size = 24, color = '#FF6444', className }: IconProps) {
 
return (
 
<svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
 
<rect x="5" y="4" width="14" height="16" rx="2" stroke={color} strokeWidth="1.5" />
 
<rect x="7" y="12" width="10" height="6" rx="1" fill={color} opacity="0.25" />
 
<path d="M7 8h10" stroke={color} strokeWidth="0.8" opacity="0.3" strokeDasharray="2 2" />
 
<path d="M12 2v2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
 
</svg>
 
)
 
}
 
/\*\* Insurance/document — finance trigger \*/
 
export function IconDocument({ size = 24, color = '#FF8866', className }: IconProps) {
 
return (
 
<svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
 
<path d="M6 3h8l5 5v13H6V3z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
 
<path d="M14 3v5h5" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
 
<path d="M9 12h6M9 15h4" stroke={color} strokeWidth="1" opacity="0.5" strokeLinecap="round" />
 
<path d="M9 9h3" stroke={color} strokeWidth="1" opacity="0.3" strokeLinecap="round" />
 
</svg>
 
)
 
}
 
/\*\* Anchor — port icon \*/
 
export function IconAnchor({ size = 20, color = '#82BEFF', className }: IconProps) {
 
return (
 
<svg width={size} height={size} viewBox="0 0 20 20" className={className} fill="none">
 
<circle cx="10" cy="5" r="2" stroke={color} strokeWidth="1.2" />
 
<path d="M10 7v10" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
 
<path d="M5 13c0 3 2.5 5 5 5s5-2 5-5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
 
<path d="M7 10h6" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
 
</svg>
 
)
 
}
 
/\*\* Map a domain to its icon component \*/
 
export function DomainIcon({ domain, nodeId, ...props }: IconProps & { domain: string; nodeId?: string }) {
 
// Special cases by node ID
 
if (nodeId?.includes('insurance')) return <IconDocument {...props} />
 
if (nodeId?.includes('hospital') || nodeId?.includes('medical')) return <IconHospital {...props} />
 
if (nodeId?.includes('factory') || nodeId?.includes('toyota')) return <IconFactory {...props} />
 
if (nodeId?.includes('spr') || nodeId?.includes('reserve')) return <IconReserve {...props} />
 
if (nodeId?.includes('unrest')) return <IconUnrest {...props} />
 
// By domain
 
switch (domain) {
 
case 'energy': return <IconBarrel {...props} />
 
case 'shipping': return <IconShip {...props} />
 
case 'medicine': return <IconHospital {...props} />
 
case 'food': return <IconFood {...props} />
 
case 'finance': return <IconCurrency {...props} />
 
case 'household': return <IconFactory {...props} />
 
default: return <IconBarrel {...props} />
 
}
 
}
 
\`\`\`
 
\-----
 
\## STEP 3c: Create polygon flash effect in `overlay.css`
 
When a cascade node activates, a hexagonal polygon flashes outward and fades.
 
This gives the “alert zone” cinematic feel — like a shockwave at the POI.
 
Add to `overlay.css`:
 
\`\`\`css
 
/\* ═══ POLYGON FLASH — hexagonal burst at activation ═══ \*/
 
.node-cascade .polygon-flash {
 
position: absolute;
 
top: 50%; left: 50%;
 
transform: translate(-50%, -50%);
 
pointer-events: none;
 
opacity: 0;
 
}
 
.node-new .polygon-flash {
 
animation: polyFlash 1.8s ease-out forwards;
 
}
 
@keyframes polyFlash {
 
0% {
 
opacity: 0.9;
 
transform: translate(-50%, -50%) scale(0.3) rotate(0deg);
 
}
 
40% {
 
opacity: 0.6;
 
transform: translate(-50%, -50%) scale(1.2) rotate(15deg);
 
}
 
100% {
 
opacity: 0;
 
transform: translate(-50%, -50%) scale(2.5) rotate(30deg);
 
}
 
}
 
/\* Second polygon — offset timing for layered effect \*/
 
.node-new .polygon-flash-outer {
 
animation: polyFlashOuter 2.2s ease-out 0.2s forwards;
 
}
 
@keyframes polyFlashOuter {
 
0% {
 
opacity: 0.5;
 
transform: translate(-50%, -50%) scale(0.5) rotate(-10deg);
 
}
 
100% {
 
opacity: 0;
 
transform: translate(-50%, -50%) scale(3) rotate(20deg);
 
}
 
}
 
/\* ═══ DOMAIN ICON ANIMATION ═══ \*/
 
.node-icon-svg {
 
position: absolute;
 
top: 50%; left: 50%;
 
transform: translate(-50%, -50%);
 
filter: drop-shadow(0 0 6px var(--node-glow));
 
transition: filter 0.5s ease;
 
}
 
.node-new .node-icon-svg {
 
animation: iconAppear 0.8s ease-out;
 
}
 
@keyframes iconAppear {
 
0% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
 
50% { opacity: 1; transform: translate(-50%, -50%) scale(1.4); }
 
100% { transform: translate(-50%, -50%) scale(1); }
 
}
 
/\* Hidden/medicine icon gets extra glow \*/
 
.node-hidden .node-icon-svg {
 
filter: drop-shadow(0 0 8px var(--node-glow)) drop-shadow(0 0 16px var(--node-glow));
 
}
 
\`\`\`
 
\-----
 
\## STEP 3d: SVG Polygon Flash component
 
Add to `MapOverlay.tsx` — inline SVG hexagon that flashes when a node activates:
 
\`\`\`tsx
 
/\*\* Hexagonal polygon flash — appears at node activation \*/
 
function PolygonFlash({ color, size = 60 }: { color: string; size?: number }) {
 
// Hexagon points
 
const pts = Array.from({ length: 6 }, (\_, i) => {
 
const angle = (Math.PI / 3) \* i - Math.PI / 6
 
return `${size/2 + (size/2) Math.cos(angle)},${size/2 + (size/2) Math.sin(angle)}`
 
}).join(' ')
 
return (
 
<>
 
<svg className="polygon-flash" width={size} height={size} viewBox={\`0 0 ${size} ${size}\`}>
 
<polygon points={pts} fill="none" stroke={color} strokeWidth="1.5" opacity="0.8" />
 
</svg>
 
<svg className="polygon-flash polygon-flash-outer" width={size  *1.4} height={size*  1.4} viewBox={\`0 0 ${size  *1.4} ${size*  1.4}\`}>
 
<polygon
 
points={Array.from({ length: 6 }, (\_, i) => {
 
const a = (Math.PI / 3) \* i - Math.PI / 6
 
const s = size \* 0.7
 
return `${s + s Math.cos(a)},${s + s Math.sin(a)}`
 
}).join(' ')}
 
fill="none" stroke={color} strokeWidth="1" opacity="0.4"
 
strokeDasharray="8 4"
 
/>
 
</svg>
 
</>
 
)
 
}
 
\`\`\`
 
Then in the node rendering inside `MapOverlay.tsx`, replace the emoji icon with the domain icon + polygon flash:
 
\`\`\`tsx
 
{/\* Inside the cascade node rendering loop, replace the old icon span: \*/}
 
{/\* Polygon flash on activation \*/}
 
<PolygonFlash color={node.color} size={isHidden ? 80 : 60} />
 
{/\* Domain SVG icon \*/}
 
<div className="node-icon-svg">
 
<DomainIcon domain={node.domain} nodeId={[node.id](http://node.id) } color={node.color} size={isHidden ? 28 : 22} />
 
</div>
 
\`\`\`
 
\-----
 
\## STEP 3: Create `src/components/shared/MapOverlay.tsx`
 
The main overlay component. Manages projection and renders all visual layers.
 
\`\`\`tsx
 
// src/components/shared/MapOverlay.tsx
 
import { useEffect, useCallback, useState, useRef } from 'react'
 
import type { Map as MapLibreMap } from 'maplibre-gl'
 
import type { OverlayNode, OverlayArc, OverlayLabel } from '../../data/overlayData'
 
import { NODE\_POSITIONS } from '../../data/overlayData'
 
import { DomainIcon } from './SvgIcons'
 
import './overlay.css'
 
interface MapOverlayProps {
 
map: MapLibreMap | null
 
nodes: OverlayNode\[\]
 
arcs: OverlayArc\[\]
 
labels: OverlayLabel\[\]
 
currentDay: number
 
activeScenario?: string | null
 
onNodeClick?: (nodeId: string) => void
 
}
 
interface Projected {
 
x: number
 
y: number
 
}
 
export default function MapOverlay({
 
map, nodes, arcs, labels, currentDay, activeScenario, onNodeClick
 
}: MapOverlayProps) {
 
const \[projected, setProjected\] = useState<Map<string, Projected>>(new Map())
 
const rafRef = useRef<number>(0)
 
// Project all geographic positions to screen pixels
 
const reproject = useCallback(() => {
 
if (!map) return
 
const next = new Map<string, Projected>()
 
// Project node positions
 
for (const node of nodes) {
 
const px = map.project(node.position)
 
next.set([node.id](http://node.id) , { x: px.x, y: px.y })
 
}
 
// Project arc source/target positions (may differ from node positions)
 
for (const arc of arcs) {
 
const srcPos = NODE\_POSITIONS\[arc.sourceId\]
 
const tgtPos = NODE\_POSITIONS\[arc.targetId\]
 
if (srcPos && !next.has(arc.sourceId)) {
 
const px = map.project(srcPos as \[number, number\])
 
next.set(arc.sourceId, { x: px.x, y: px.y })
 
}
 
if (tgtPos && !next.has(arc.targetId)) {
 
const px = map.project(tgtPos as \[number, number\])
 
next.set(arc.targetId, { x: px.x, y: px.y })
 
}
 
}
 
setProjected(next)
 
}, \[map, nodes, arcs\])
 
// Re-project on every map move
 
useEffect(() => {
 
if (!map) return
 
reproject()
 
map.on('move', reproject)
 
map.on('resize', reproject)
 
return () => {
 
map.off('move', reproject)
 
map.off('resize', reproject)
 
}
 
}, \[map, reproject\])
 
// Filter active elements by current day
 
const activeNodes = nodes.filter(n => n.activationDay <= currentDay)
 
const futureNodes = nodes.filter(n => n.activationDay > currentDay && n.activationDay <= currentDay + 15)
 
const activeArcs = arcs.filter(a => a.activationDay <= currentDay)
 
const activeLabels = labels.filter(l => l.activationDay <= currentDay)
 
const justActivated = nodes.filter(n =>
 
n.activationDay <= currentDay && n.activationDay > currentDay - 2
 
)
 
return (
 
<div className="map-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
 
{/\* ═══ SVG LAYER: CASCADE ARCS ═══ \*/}
 
<svg className="overlay-svg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
 
<defs>
 
{/\* Glow filters per domain \*/}
 
<filter id="glow-shock" x="-50%" y="-50%" width="200%" height="200%">
 
<feGaussianBlur stdDeviation="3" result="blur" />
 
<feFlood floodColor="#FF4432" floodOpacity="0.6" result="color" />
 
<feComposite in="color" in2="blur" operator="in" result="shadow" />
 
<feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
 
</filter>
 
<filter id="glow-supply" x="-50%" y="-50%" width="200%" height="200%">
 
<feGaussianBlur stdDeviation="2.5" result="blur" />
 
<feFlood floodColor="#DC8C3C" floodOpacity="0.5" result="color" />
 
<feComposite in="color" in2="blur" operator="in" result="shadow" />
 
<feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
 
</filter>
 
<filter id="glow-hidden" x="-50%" y="-50%" width="200%" height="200%">
 
<feGaussianBlur stdDeviation="4" result="blur" />
 
<feFlood floodColor="#B464DC" floodOpacity="0.7" result="color" />
 
<feComposite in="color" in2="blur" operator="in" result="shadow" />
 
<feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
 
</filter>
 
<filter id="glow-amplify" x="-50%" y="-50%" width="200%" height="200%">
 
<feGaussianBlur stdDeviation="2" result="blur" />
 
<feFlood floodColor="#FFC832" floodOpacity="0.5" result="color" />
 
<feComposite in="color" in2="blur" operator="in" result="shadow" />
 
<feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
 
</filter>
 
<filter id="glow-mitigate" x="-50%" y="-50%" width="200%" height="200%">
 
<feGaussianBlur stdDeviation="2" result="blur" />
 
<feFlood floodColor="#50C878" floodOpacity="0.5" result="color" />
 
<feComposite in="color" in2="blur" operator="in" result="shadow" />
 
<feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
 
</filter>
 
</defs>
 
{/\* Inactive arcs (ghosted) \*/}
 
{arcs.filter(a => a.activationDay > currentDay && a.activationDay <= currentDay + 20).map(arc => {
 
const from = projected.get(arc.sourceId)
 
const to = projected.get(arc.targetId)
 
if (!from || !to) return null
 
const midX = (from.x + to.x) / 2
 
const arcHeight = arc.domain === 'hidden' ? 100 : arc.domain === 'shock' ? 70 : 40
 
const midY = Math.min(from.y, to.y) - arcHeight
 
return (
 
<path
 
key={[arc.id](http://arc.id)  + '\_ghost'}
 
d={\`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}\`}
 
fill="none"
 
stroke={arc.color}
 
strokeWidth={0.5}
 
strokeOpacity={0.08}
 
strokeDasharray="3 6"
 
/>
 
)
 
})}
 
{/\* Active arcs \*/}
 
{[activeArcs.map](http://activeArcs.map) (arc => {
 
const from = projected.get(arc.sourceId)
 
const to = projected.get(arc.targetId)
 
if (!from || !to) return null
 
const midX = (from.x + to.x) / 2
 
const arcHeight = arc.domain === 'hidden' ? 100 : arc.domain === 'shock' ? 70 : 40
 
const midY = Math.min(from.y, to.y) - arcHeight
 
const isNew = arc.activationDay > currentDay - 3
 
return (
 
<g key={[arc.id](http://arc.id) }>
 
{/\* Wide glow under-layer \*/}
 
<path
 
d={\`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}\`}
 
fill="none"
 
stroke={arc.color}
 
strokeWidth={8}
 
strokeOpacity={0.06}
 
filter={\`url(#glow-${arc.domain})\`}
 
/>
 
{/\* Core arc \*/}
 
<path
 
className={\`cascade-arc ${isNew ? 'arc-new' : ''} ${arc.isHidden ? 'arc-hidden' : ''}\`}
 
d={\`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}\`}
 
fill="none"
 
stroke={arc.color}
 
strokeWidth={arc.isHidden ? 2.5 : 1.8}
 
strokeOpacity={0.7}
 
strokeLinecap="round"
 
filter={arc.isHidden ? `url(#glow-hidden)` : undefined}
 
/>
 
{/\* Flow animation on active arcs \*/}
 
<path
 
className="arc-flow"
 
d={\`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}\`}
 
fill="none"
 
stroke={arc.color}
 
strokeWidth={1.2}
 
strokeOpacity={0.5}
 
strokeDasharray="6 10"
 
strokeLinecap="round"
 
/>
 
</g>
 
)
 
})}
 
</svg>
 
{/\* ═══ HTML LAYER: NODE INDICATORS ═══ \*/}
 
{/\* Port nodes (always visible, subtle) \*/}
 
{nodes.filter(n => [n.id](http://n.id) .startsWith('port:')).map(node => {
 
const pos = projected.get([node.id](http://node.id) )
 
if (!pos) return null
 
const isChokepoint = [node.id](http://node.id)  === 'port:hormuz' || [node.id](http://node.id)  === 'port:bab\_mandeb'
 
const isBlocked = isChokepoint && currentDay >= 1
 
return (
 
<div key={[node.id](http://node.id) } className="node-port" style={{
 
left: pos.x, top: pos.y,
 
}}>
 
<div className={\`port-dot ${isBlocked ? 'port-blocked' : ''}\`}
 
style={{ '--node-color': isBlocked ? '#FF4432' : node.color } as React.CSSProperties} />
 
<span className="port-label">{node.shortLabel || node.label}</span>
 
</div>
 
)
 
})}
 
{/\* Cascade nodes — appear as timeline reaches their day \*/}
 
{activeNodes.filter(n => ![n.id](http://n.id) .startsWith('port:')).map(node => {
 
const pos = projected.get([node.id](http://node.id) )
 
if (!pos) return null
 
const isNew = node.activationDay > currentDay - 3
 
const isHidden = node.domain === 'medicine'
 
return (
 
<div
 
key={[node.id](http://node.id) }
 
className={\`node-cascade ${isNew ? 'node-new' : ''} ${isHidden ? 'node-hidden' : ''}\`}
 
style={{
 
left: pos.x, top: pos.y,
 
'--node-color': node.color,
 
'--node-glow': node.color + '60',
 
} as React.CSSProperties}
 
onClick={() => onNodeClick?.([node.id](http://node.id) )}
 
\>
 
{/\* Pulse ring \*/}
 
<div className="node-ring" />
 
{/\* Second ring (for emphasis) \*/}
 
<div className="node-ring node-ring-outer" />
 
{/\* Polygon flash on activation \*/}
 
<PolygonFlash color={node.color} size={isHidden ? 80 : 60} />
 
{/\* Core dot \*/}
 
<div className="node-dot" />
 
{/\* Domain SVG icon \*/}
 
<div className="node-icon-svg">
 
<DomainIcon domain={node.domain} nodeId={[node.id](http://node.id) } color={node.color} size={isHidden ? 28 : 22} />
 
</div>
 
</div>
 
)
 
})}
 
{/\* Ghost nodes — upcoming, barely visible \*/}
 
{futureNodes.filter(n => ![n.id](http://n.id) .startsWith('port:')).map(node => {
 
const pos = projected.get([node.id](http://node.id) )
 
if (!pos) return null
 
return (
 
<div key={[node.id](http://node.id)  + '\_ghost'} className="node-ghost" style={{ left: pos.x, top: pos.y }}>
 
<div className="ghost-dot" style={{ background: node.color + '15', borderColor: node.color + '20' }} />
 
</div>
 
)
 
})}
 
{/\* ═══ HTML LAYER: FLOATING CRISIS LABELS ═══ \*/}
 
{[activeLabels.map](http://activeLabels.map) (label => {
 
const pos = projected.get(label.nodeId)
 
if (!pos) return null
 
const isNew = label.activationDay > currentDay - 3
 
return (
 
<div
 
key={[label.id](http://label.id) }
 
className={\`floating-label ${isNew ? 'label-new' : ''}\`}
 
style={{
 
left: pos.x, top: pos.y - 32,
 
color: label.color,
 
'--label-glow': label.color,
 
} as React.CSSProperties}
 
\>
 
{label.text}
 
</div>
 
)
 
})}
 
{/\* ═══ BUFFER COUNTDOWN (special: follows Yokkaichi) ═══ \*/}
 
{currentDay >= 8 && currentDay <= 60 && (() => {
 
const pos = projected.get('scenario:asian\_refinery\_buffer\_drain')
 
if (!pos) return null
 
const bufferDays = Math.max(0, 30 - Math.floor((currentDay - 8) \* 30 / 52))
 
return (
 
<div className="buffer-countdown" style={{ left: pos.x + 30, top: pos.y - 10 }}>
 
<span className="buffer-number" style={{
 
color: bufferDays < 10 ? '#FF4432' : bufferDays < 20 ? '#E8B94A' : '#C8A96E'
 
}}>
 
BUFFER: {bufferDays} DAYS
 
</span>
 
</div>
 
)
 
})()}
 
</div>
 
)
 
}
 
\`\`\`
 
\-----
 
\## STEP 4: Create `src/components/shared/overlay.css`
 
All the animations that make this feel alive.
 
\`\`\`css
 
/\* ═══════════════════════════════════════
 
MAP OVERLAY — CSS ANIMATIONS
 
═══════════════════════════════════════ \*/
 
/\* ── SVG ARC ANIMATIONS ── \*/
 
.cascade-arc {
 
transition: stroke-opacity 0.8s ease, stroke-width 0.6s ease;
 
}
 
.arc-new {
 
animation: arcAppear 1.5s ease-out;
 
}
 
@keyframes arcAppear {
 
0% { stroke-opacity: 0; stroke-width: 0; }
 
30% { stroke-opacity: 1; stroke-width: 4; }
 
100% { stroke-opacity: 0.7; }
 
}
 
.arc-hidden {
 
animation: arcReveal 2s ease-out;
 
}
 
@keyframes arcReveal {
 
0% { stroke-opacity: 0; stroke-dasharray: 2 100; }
 
50% { stroke-opacity: 1; stroke-dasharray: 2 20; }
 
100% { stroke-opacity: 0.7; stroke-dasharray: none; }
 
}
 
.arc-flow {
 
animation: flowDash 1.5s linear infinite;
 
}
 
@keyframes flowDash {
 
to { stroke-dashoffset: -16; }
 
}
 
/\* ── NODE INDICATORS ── \*/
 
.node-port, .node-cascade, .node-ghost {
 
position: absolute;
 
transform: translate(-50%, -50%);
 
pointer-events: none;
 
}
 
.node-cascade {
 
pointer-events: auto;
 
cursor: pointer;
 
}
 
/\* Port dots \*/
 
.port-dot {
 
width: 8px;
 
height: 8px;
 
border-radius: 50%;
 
background: var(--node-color);
 
opacity: 0.5;
 
transition: all 0.6s ease;
 
}
 
.port-blocked {
 
opacity: 1;
 
animation: portAlarm 1.5s ease-in-out infinite;
 
}
 
@keyframes portAlarm {
 
0%, 100% { box-shadow: 0 0 6px var(--node-color); transform: scale(1); }
 
50% { box-shadow: 0 0 20px var(--node-color), 0 0 40px var(--node-color); transform: scale(1.4); }
 
}
 
.port-label {
 
position: absolute;
 
left: 50%;
 
top: calc(100% + 4px);
 
transform: translateX(-50%);
 
font-size: 9px;
 
font-weight: 600;
 
color: rgba(255,255,255,0.4);
 
white-space: nowrap;
 
letter-spacing: 0.5px;
 
text-transform: uppercase;
 
}
 
/\* Cascade node rings \*/
 
.node-ring {
 
position: absolute;
 
top: 50%; left: 50%;
 
width: 28px; height: 28px;
 
border-radius: 50%;
 
transform: translate(-50%, -50%);
 
border: 1.5px solid var(--node-color);
 
opacity: 0.4;
 
animation: ringPulse 2.5s ease-in-out infinite;
 
}
 
.node-ring-outer {
 
width: 44px; height: 44px;
 
border-width: 1px;
 
opacity: 0.15;
 
animation-delay: 0.5s;
 
animation-duration: 3s;
 
}
 
@keyframes ringPulse {
 
0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
 
50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.2; }
 
}
 
/\* Core dot \*/
 
.node-dot {
 
position: absolute;
 
top: 50%; left: 50%;
 
width: 10px; height: 10px;
 
border-radius: 50%;
 
transform: translate(-50%, -50%);
 
background: var(--node-color);
 
box-shadow: 0 0 8px var(--node-glow), 0 0 20px var(--node-glow);
 
}
 
/\* Node icon \*/
 
.node-icon {
 
position: absolute;
 
top: 50%; left: 50%;
 
transform: translate(-50%, -50%);
 
font-size: 12px;
 
filter: drop-shadow(0 0 4px rgba(0,0,0,0.8));
 
}
 
/\* New node animation \*/
 
.node-new .node-dot {
 
animation: nodeFlash 1.2s ease-out;
 
}
 
.node-new .node-ring {
 
animation: ringBurst 1.2s ease-out;
 
}
 
@keyframes nodeFlash {
 
0% { transform: translate(-50%, -50%) scale(0); background: white; box-shadow: 0 0 30px white; }
 
30% { transform: translate(-50%, -50%) scale(2.5); background: white; }
 
100% { transform: translate(-50%, -50%) scale(1); }
 
}
 
@keyframes ringBurst {
 
0% { transform: translate(-50%, -50%) scale(0); opacity: 1; border-width: 3px; }
 
60% { transform: translate(-50%, -50%) scale(2); opacity: 0.5; }
 
100% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; border-width: 1.5px; }
 
}
 
/\* Hidden/medicine node — extra glow \*/
 
.node-hidden .node-dot {
 
box-shadow: 0 0 12px var(--node-glow), 0 0 30px var(--node-glow), 0 0 50px var(--node-glow);
 
}
 
.node-hidden .node-ring {
 
border-width: 2px;
 
opacity: 0.6;
 
}
 
/\* Ghost nodes (upcoming) \*/
 
.ghost-dot {
 
width: 6px; height: 6px;
 
border-radius: 50%;
 
border: 1px solid;
 
opacity: 0.3;
 
}
 
/\* ── FLOATING LABELS ── \*/
 
.floating-label {
 
position: absolute;
 
transform: translateX(-50%);
 
font-size: 11px;
 
font-weight: 700;
 
font-family: 'Instrument Sans', system-ui, sans-serif;
 
letter-spacing: 1px;
 
text-shadow: 0 1px 10px rgba(0,0,0,0.9), 0 0 20px var(--label-glow);
 
white-space: nowrap;
 
pointer-events: none;
 
transition: opacity 0.8s ease;
 
}
 
.label-new {
 
animation: labelAppear 1s ease-out;
 
}
 
@keyframes labelAppear {
 
0% { opacity: 0; transform: translateX(-50%) translateY(8px); }
 
100% { opacity: 1; transform: translateX(-50%) translateY(0); }
 
}
 
/\* ── BUFFER COUNTDOWN ── \*/
 
.buffer-countdown {
 
position: absolute;
 
pointer-events: none;
 
transform: translateY(-50%);
 
}
 
.buffer-number {
 
font-size: 11px;
 
font-weight: 700;
 
font-family: 'Instrument Sans', monospace;
 
letter-spacing: 1.5px;
 
text-shadow: 0 1px 8px rgba(0,0,0,0.9);
 
animation: bufferPulse 2s ease-in-out infinite;
 
}
 
@keyframes bufferPulse {
 
0%, 100% { opacity: 0.8; }
 
50% { opacity: 1; }
 
}
 
\`\`\`
 
\-----
 
\## STEP 5: Wire into App.tsx
 
\`\`\`tsx
 
// In App.tsx, add imports:
 
import MapOverlay from './components/shared/MapOverlay'
 
import { buildOverlayNodes, buildOverlayArcs, buildOverlayLabels } from './data/overlayData'
 
// After loading seed data, build overlay data once:
 
const overlayNodes = useMemo(() => seed ? buildOverlayNodes(seed) : \[\], \[seed\])
 
const overlayArcs = useMemo(() => seed ? buildOverlayArcs(seed) : \[\], \[seed\])
 
const overlayLabels = useMemo(() => buildOverlayLabels(), \[\])
 
// Add the ref for map instance:
 
const mapInstanceRef = useRef<[maplibregl.Map](http://maplibregl.Map)  | null>(null)
 
// In the render, after MapStage and before scroll content:
 
<MapOverlay
 
map={mapInstanceRef.current}
 
nodes={overlayNodes}
 
arcs={overlayArcs}
 
labels={overlayLabels}
 
currentDay={currentDay} // from timeline or scroll progress
 
activeScenario={activeScenario}
 
onNodeClick={(nodeId) => {
 
// Fly to node, show ink card
 
console.log('Node clicked:', nodeId)
 
}}
 
/>
 
\`\`\`
 
\-----
 
\## STEP 6: Remove [deck.gl](http://deck.gl)  layers that are now replaced
 
In MapStage.tsx, REMOVE:
 
\- `ScatterplotLayer` import and all portsLayer code
 
\- Any `ArcLayer`, `TextLayer`, `IconLayer`, `HeatmapLayer` if they exist
 
KEEP ONLY:
 
\- `TripsLayer` (the animated ship trails)
 
\- `PathLayer` (if used for static route ghosts)
 
The [deck.gl](http://deck.gl)  overlay should have at most 2 layers. Everything else is SVG + HTML.
 
\-----
 
\## SUMMARY
 
|Visual element |Old ([deck.gl](http://deck.gl) ) |New (SVG/HTML) |
 
|----------------------|--------------------------|---------------------------------------------|
 
|Ship trails |TripsLayer |TripsLayer (KEEP) |
 
|Port dots |ScatterplotLayer |HTML div + CSS pulse |
 
|Cascade arcs |ArcLayer (crude) |SVG path + bezier + CSS glow filter |
 
|Crisis labels |TextLayer (blurry) |HTML div + text-shadow |
 
|Node indicators |ScatterplotLayer (circles)|HTML div + ring animation |
 
|Domain icons |emoji (inconsistent) |SVG hand-drawn icons per domain (10 icons) |
 
|Activation flash |transitions (slow) |SVG hexagonal polygon burst + CSS @keyframes |
 
|Buffer countdown |TextLayer |HTML div + CSS pulse |
 
|Flow animation |none |SVG stroke-dasharray + @keyframes |
 
|Hidden connection glow|none |SVG filter + feGaussianBlur + extra icon glow|
 
|Ghost/future nodes |none |HTML div + low opacity |
 
**New files to create (4):**
 
\- `src/data/overlayData.ts` — node positions, arc definitions, label definitions
 
\- `src/components/shared/SvgIcons.tsx` — 10 hand-drawn SVG domain icons
 
\- `src/components/shared/MapOverlay.tsx` — overlay component + PolygonFlash
 
\- `src/components/shared/overlay.css` — all CSS animations
 
Performance: 1 WebGL layer instead of 6. Everything else is CSS-animated HTML/SVG.
 
Visual quality: Crisp anti-aliased SVG icons, hexagonal flash bursts, smooth CSS animations.