// 21 MILES — Kenya
// Both perspectives. Zero jargon. All numbers from Atlas.
// Compile: inklecate kenya.ink -o kenya.ink.json

// ═══════════════════════════════════════
//  VARIABLES (injected by app from Atlas)
// ═══════════════════════════════════════

VAR perspective = "nurse"
VAR roleName = "Amara"
VAR monthlyHit = 14400
VAR monthlyHitPct = 29
VAR currency = "KSh"
VAR oilPrice = 105
VAR fuelPrice = 279
VAR fuelPricePre = 180
VAR foodCost = 35000
VAR foodCostPre = 25000
VAR heatingCost = 3300
VAR heatingCostPre = 2200
VAR transportCost = 9300
VAR transportCostPre = 6000
VAR routeDelay = 14
VAR crisisDay = 12
VAR fleetPct = 82
VAR medicinePct = 55
VAR sprDays = 155
VAR futureHitWorst = 19200
VAR futureHitRelief = 10800
VAR futureHitPeace = 7200

// ═══════════════════════════════════════
//  ENTRY
// ═══════════════════════════════════════

=== start ===
# SCENE: entry
A distant channel is already inside your month.
Twenty-one miles of water. Day {crisisDay}.
+ [See through Amara's eyes — a nurse in Nairobi] -> nurse_intro
+ [See through Joseph's eyes — a driver on the Mombasa road] -> driver_intro

// ═══════════════════════════════════════
//  NURSE INTRO
// ═══════════════════════════════════════

=== nurse_intro ===
# SCENE: baseline
~ perspective = "nurse"
~ roleName = "Amara"
The supply room is full. Shelves stacked. Rhythm normal.
You check the IV bag count — 340 units. Standard for the week.
The route from India to Mombasa to here — it just works. Has worked for years.
+ [Watch the strait] -> rupture

// ═══════════════════════════════════════
//  DRIVER INTRO
// ═══════════════════════════════════════

=== driver_intro ===
# SCENE: baseline
~ perspective = "driver"
~ roleName = "Joseph"
Diesel is {currency} {fuelPricePre} a litre. The Mombasa-Nairobi run pays {currency} 45,000.
After fuel, tolls, food, and the truck loan: {currency} 8,000 left.
Not much. But enough.
+ [Watch the strait] -> rupture

// ═══════════════════════════════════════
//  RUPTURE
// ═══════════════════════════════════════

=== rupture ===
# SCENE: rupture
# SOUND: pressure_buildup
The flow stops before the news arrives.
{perspective == "nurse":
    You won't hear about the strait for three more days. By then, the first shipment has already missed its window.
}
{perspective == "driver":
    The fuel station owner calls. "Price is changing tomorrow. Fill up today if you can."
}
+ [Where did the ships go?] -> detour
+ [Why is Kenya so exposed?] -> exposure

// ═══════════════════════════════════════
//  EXPOSURE
// ═══════════════════════════════════════

=== exposure ===
# SCENE: exposure
Kenya imports 85% of its petroleum products.
Dollar-denominated debt. Food import dependent.
The shilling has already dropped.
+ [Where did the ships go?] -> detour

// ═══════════════════════════════════════
//  DETOUR
// ═══════════════════════════════════════

=== detour ===
# SCENE: detour
# SOUND: stretched_tones
Every ship now goes around Africa. {routeDelay} extra days. $1.2 million more per voyage.
{perspective == "nurse":
    That's not your problem yet. It will be.
}
{perspective == "driver":
    Diesel was {currency} {fuelPricePre}. It's now {currency} {fuelPrice}. That happened in {crisisDay} days.
}
+ [Follow the medicine] -> medicine_path
+ [Follow the food] -> food_path
+ [What happens to the ships?] -> fleet

// ═══════════════════════════════════════
//  FLEET
// ═══════════════════════════════════════

=== fleet ===
# SCENE: detour
Same number of ships. Longer routes. Fewer deliveries.
Fleet down to {fleetPct}% of normal. Oil, food, and medicine compete for the same deck space.
+ [Follow the medicine] -> medicine_path
+ [Follow the food] -> food_path

// ═══════════════════════════════════════
//  MEDICINE PATH
// ═══════════════════════════════════════

=== medicine_path ===
# SCENE: cascade
# MORPH: shipping -> freight -> import_stress -> medicine
# SOUND: domain_crossing
Fuel becomes freight.
Freight becomes delay.
Delay becomes shortage.
{perspective == "nurse":
    The shipment that should arrive Tuesday won't.
    The one after that — uncertain.
    Supply level: {medicinePct}% of normal. And falling.
}
{perspective == "driver":
    The container sits at Mombasa for three extra days. Nobody pays the storage.
    You could carry it — but the fuel costs more than the job pays.
}
+ [How does this reach your family?] -> your_month
+ [There's something connecting these] -> link_refinery
+ [What happens next?] -> what_next

// ═══════════════════════════════════════
//  LINK: Refinery → Medical
// ═══════════════════════════════════════

=== link_refinery ===
# DISCOVERY: refinery_medical
# SOUND: discovery_chord
The oil that moves ships makes syringes.
Same refinery. Same barrel. Same chemical fraction.
When the refinery cuts output, it doesn't choose. Fuel AND medical plastics drop together.
There is no separate health crisis. It's the energy crisis, four steps further down a chain nobody mapped.
+ [How does this reach your family?] -> your_month

// ═══════════════════════════════════════
//  FOOD PATH
// ═══════════════════════════════════════

=== food_path ===
# SCENE: cascade
# MORPH: shipping -> freight -> fertilizer -> food
# SOUND: domain_crossing
Four forces hit your grocery bill from four directions.
Transport: ships rerouting adds $1.2 million per voyage.
Fertilizer: the gas that makes it doubled.
Fleet: food cargoes deprioritized behind oil.
Currency: the shilling dropped — imports cost more in every currency.
{perspective == "nurse":
    The canteen at the hospital has cut portions. Twice this week.
}
{perspective == "driver":
    The chai stop in Mtito Andei raised prices. Small thing. But it's the same everywhere.
}
+ [How does this reach your family?] -> your_month
+ [There's something connecting these] -> link_molecule
+ [What happens next?] -> what_next

// ═══════════════════════════════════════
//  LINK: CH₄ Molecule
// ═══════════════════════════════════════

=== link_molecule ===
# DISCOVERY: ch4_molecule
# SOUND: discovery_chord
CH₄.
The gas that heats a home in Hamburg is the same molecule that becomes fertilizer in a field outside Nakuru.
When it doubles in Europe, your food costs more in Kenya.
The energy crisis and the food crisis are the same story told in two languages.
+ [How does this reach your family?] -> your_month

// ═══════════════════════════════════════
//  YOUR MONTH
// ═══════════════════════════════════════

=== your_month ===
# SCENE: your_month
# SOUND: walls_closing
{perspective == "nurse":
    Your take-home: {currency} 50,000.
    Before: cooking fuel {currency} {heatingCostPre}. Food {currency} {foodCostPre}. Transport {currency} {transportCostPre}.
    Now: cooking fuel {currency} {heatingCost}. Food {currency} {foodCost}. Transport {currency} {transportCost}.
    
    {currency} {monthlyHit} more. Every month.
    {monthlyHitPct}% of your income — gone.
    Not to better food. Not to a warmer home.
    To the same life, priced by a strait you've never seen.
}
{perspective == "driver":
    Diesel was {currency} {fuelPricePre}. Now {currency} {fuelPrice}.
    The Mombasa run used to leave {currency} 8,000 after costs.
    Now it leaves {currency} 1,200. Before food. Before rent. Before school fees.
    
    {currency} {monthlyHit} more. Every month.
    {monthlyHitPct}% of your income — gone.
    You can drive or you can eat. You can't do both the way you used to.
}
+ [What happens next?] -> what_next
+ [Show someone] -> share

// ═══════════════════════════════════════
//  WHAT HAPPENS NEXT?
// ═══════════════════════════════════════

=== what_next ===
# SCENE: what_next
# CONSOLE: futures_active
The world isn't set. Here are paths it could take.
+ [What if Houthis resume Red Sea attacks?] -> future_worse
+ [What if reserves are released?] -> future_relief
+ [What if a ceasefire opens?] -> future_peace

// ═══════════════════════════════════════
//  FUTURE: WORSE (Red Sea)
// ═══════════════════════════════════════

=== future_worse ===
# SCENE: split
# FUTURE: redSea
# SOUND: splitting_tone
The Cape route was the only way around. If that's contested too —
There is no safe corridor left.
{perspective == "nurse":
    IV bags drop to 30%. Not a shortage. A crisis.
    Your hospital starts choosing which departments get supplies.
}
{perspective == "driver":
    Diesel crosses {currency} 320. Three of five drivers have stopped.
    The run isn't a loss — it's a donation.
}
{currency} {monthlyHit} becomes {currency} {futureHitWorst}. Per month.
+ [See both paths side by side] -> compare_worse
+ [Try a different path] -> what_next

=== compare_worse ===
# SPLIT_SCREEN: true
How things stand now: {currency} {monthlyHit} per month.
If this happens: {currency} {futureHitWorst} per month.
The difference is not just money. It's whether the system has any room left. Right now, the Cape IS the room. Remove it, and there is none.
+ [Try a different path] -> what_next
+ [Show someone] -> share

// ═══════════════════════════════════════
//  FUTURE: RELIEF (Reserves)
// ═══════════════════════════════════════

=== future_relief ===
# SCENE: split
# FUTURE: reserves
It buys time. {sprDays} days of US reserves. Borrowed time.
{perspective == "nurse":
    Supply eases slightly. IV bags climb to 70%. But the countdown is visible.
}
{perspective == "driver":
    Diesel eases to {currency} 240. The run pays again — barely.
    Everyone knows it won't last.
}
{currency} {monthlyHit} becomes {currency} {futureHitRelief}. Per month. For now.
+ [See both paths side by side] -> compare_relief
+ [Try a different path] -> what_next

=== compare_relief ===
# SPLIT_SCREEN: true
How things stand now: {currency} {monthlyHit} per month. Unrelieved.
If reserves release: {currency} {futureHitRelief} per month. Temporary.
The difference is real but finite. Reserves were designed for 90-day disruptions. If this lasts longer, the safety net becomes the crisis.
+ [Try a different path] -> what_next
+ [Show someone] -> share

// ═══════════════════════════════════════
//  FUTURE: PEACE (Ceasefire)
// ═══════════════════════════════════════

=== future_peace ===
# SCENE: split
# FUTURE: ceasefire
A channel opens. But ceasefire doesn't mean recovery.
Mine clearance takes months. Insurance comes back slowly. Prices fall but don't return.
{perspective == "nurse":
    Shipments resume over 8 weeks, not 8 days.
    The damage to contracts and trust takes 6-12 months.
}
{perspective == "driver":
    Diesel drops to {currency} 220. Not back to {fuelPricePre}. Never back to {fuelPricePre}.
    The run pays again. The debt from the weeks it didn't — that stays.
}
{currency} {monthlyHit} becomes {currency} {futureHitPeace}. By month 3.
The bleeding stops. The scar remains.
+ [See both paths side by side] -> compare_peace
+ [Show someone] -> share

=== compare_peace ===
# SPLIT_SCREEN: true
How things stand now: {currency} {monthlyHit} per month. And rising.
If a ceasefire opens: {currency} {futureHitPeace} by month 3. Recovery, not return.
Even the best outcome takes months. The system does not snap back. Some damage — to savings, to contracts, to trust — is permanent.
+ [Try a different path] -> what_next
+ [Show someone] -> share

// ═══════════════════════════════════════
//  SHARE
// ═══════════════════════════════════════

=== share ===
# SCENE: share
# GENERATE_CLIP: true
{perspective == "nurse":
    {roleName} checks the supply room one more time.
    {medicinePct}% of normal. Day {crisisDay}.
    {currency} {monthlyHit} gone from her month.
    Twenty-one miles away, a strait she's never seen decides whether she can do her job.
}
{perspective == "driver":
    {roleName} does the math one more time.
    Diesel {currency} {fuelPrice}. Day {crisisDay}.
    {currency} {monthlyHit} gone from his month.
    The medicine the nurse needs is in his container. The economics say don't drive.
}
-> END
