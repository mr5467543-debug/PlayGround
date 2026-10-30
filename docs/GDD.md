# Echoes of the 100th Floor
## Game Design Document v1.0

**Genre:** Turn-based tactical RPG roguelike
**Platform:** iOS / Android, portrait, offline-first
**Business model:** Premium ($6.99) + cosmetic Echo skins; no ads, no pay-to-win
**Target session:** 6–12 minutes; 25–40 minutes per descent
**Team target:** 1 designer-engineer, 1 pixel artist, 1 composer (part-time), QA

> **Design thesis:** Every death must cost something the player can see, name, and eventually take back. The dungeon is not a level select; it is a graveyard with a floor plan.

### Related documents
- [`TECH_PLAN.md`](TECH_PLAN.md) — engine, architecture, persistence, generation, roadmap
- [`CLASS_MATRIX.md`](CLASS_MATRIX.md) — generated 50-class table
- [`../design/classes.json`](../design/classes.json) — class rules (source of truth)
- [`../design/skills.json`](../design/skills.json) — 50 class kits
- [`../design/save.schema.json`](../design/save.schema.json) — Echo / save contract
- [`../tools/validate-classes.mjs`](../tools/validate-classes.mjs) — exhaustive class-matrix test

---

## 1. Pillars

### 1.1 Audience and positioning
**Core audience:** 25–45, mobile players who want a "real" RPG in 10-minute sessions; fans of *Slay the Spire*, *Darkest Dungeon*, *Crown Trick*, *Hades*, and *Loop Hero*.

**Positioning:** the tactical depth of a desktop roguelike with the death loop of a soulslike, designed thumb-first. The hook is not "another 100-floor dungeon"; it is **your own corpse as the boss**.

**Unique selling points**
1. Every death creates a persistent, named enemy built from your exact kit.
2. 50 classes derived from 10 points — no class select, no respec, high replay.
3. A graveyard that is also a progression system: your failures become loot, skills, and a final boss.

**Win condition:** reach floor 100 and defeat The First Echo. **Loss condition:** none at the account level. A character dies; the account continues. The only true loss is the time you choose not to spend.

### 1.2 Design pillars
1. **Death is a place, not a reset.** A dead hero becomes a location on the map with a name, a build, and a grudge.
2. **Builds are discovered, not selected.** Ten points make a calling; the player learns the matrix by experimenting, not by reading a wiki.
3. **Every turn is legible.** No hidden rolls that decide a run. Damage, hit chance, intent, and threat are visible before commitment.
4. **The dungeon remembers.** Layouts, bosses, traps, and corpses persist. Only the living respawn.
5. **Short sessions, long memory.** A phone-sized loop (one floor, one fight, one decision) feeding a 100-floor obsession.

### 1.3 Anti-pillars
- No party management. You are one hero; your old heroes are the enemies.
- No stat respec. A character is a commitment; the next character is the reset.
- No energy timers, no gacha, no rewarded ads.
- No procedural sameness: each 20-floor band changes a rule, not just a tileset.

### 1.4 Solo-play contract
- The player controls exactly **one hero**. There is no persistent party, companion, or co-op.
- **"Ally" means the hero or a summon the hero controls.** Single-target ally effects may target the hero.
- **Summons are temporary combat units** created by skills or class passives (totem, mirror image, echo-copy). They act on the hero's turn, have their own HP, and vanish at combat end. An effect that needs an adjacent ally can use a summon; its self-only portion still applies when no summon exists.
- Enemy Echoes may fight alongside **mourners**. "Ally" in AI rules means another unit on the same side; this never gives the player a party.

---

## 2. Core loops

### 2.1 Moment loop (10–60 s)
Move → read intent → spend AP → resolve → read new intent.

### 2.2 Floor loop (3–7 min)
Enter → reveal fog → choose route (loot / shrine / stairs / Echo) → fight 2–4 encounters → descend or extract.

### 2.3 Descent loop (25–40 min)
Guild Hall → allocate stats → pick a Descent Gate → clear a band → reach target floor → reclaim an Echo → extract alive with loot, or die and create a new one.

### 2.4 Legacy loop (the game)
Die → Echo registered → new hero → Heirloom XP → descend → defeat the Echo → Memory Shard → cross-class build → push deeper → die again.

**Extraction rule:** loot only reaches the Stash if you return to the Guild alive or use a **Vault Rune** (rare consumable). This makes every descent a risk decision, not a loot conveyor.

---

## 3. The Echo system

### 3.1 Death sequence (target: < 8 seconds to agency)
1. HP reaches 0. Time slows; the death tile is highlighted.
2. The character's equipment silhouette is stamped onto the floor.
3. A short card: **NAME — CLASS — FLOOR — "LAST WORDS"**.
4. `echo_<id>.json` is written atomically. The floor state records the Echo id.
5. The run ends. The player returns to the Guild Hall. A new character can be created immediately.

No confirmation dialog, no lost-run pop-up, no ad.

### 3.2 What the Echo keeps
| Kept | Lost |
| --- | --- |
| All six stats and derived stats | Current HP/MP (spawns at 100%, unless a class modifier says otherwise) |
| All equipped gear (durability as at death) | Stash items (always safe) |
| Full inventory | Gold carried (50% drops on the Echo, 50% is lost) |
| Every unlocked class skill + Memory skills | Active buffs, consumables used |
| AI profile derived from its kit | Player control |

### 3.3 Echo combat behaviour
The Echo is an elite AI unit on its death tile, guarded by 1–4 "mourners" drawn from the floor's enemy pool. It uses the exact skills, gear, and stats it had, with an AI profile generated at death:

| Build signal | AI profile | Behaviour |
| --- | --- | --- |
| Healing skill + WIS ≥ 5 | Healer | Heals itself below 60%; never frontlines |
| INT ≥ 6 and max HP < 40% of floor average | Glass nuker | Stays at max range; targets the player's lowest resistance |
| STR ≥ 6, VIT ≥ 4 | Bruiser | Charges the nearest target; uses AoE when 2+ cluster |
| DEX ≥ 6, LUK ≥ 4 | Assassin | Flanks with mourners, targets the lowest-DEF unit, disengages below 30% HP |
| VIT ≥ 6, WIS ≥ 4 | Tank | Taunts, body-blocks corridors, protects wounded mourners |
| Capstone unlocked | Any | Opens with the capstone if 2+ targets are valid |

**Fairness rule:** the Echo's next action is telegraphed with an icon and a target line. The player always gets one turn of information. Echoes cannot be auto-battled.

### 3.4 Reclaim
Defeat the Echo in combat to receive:
- **100% of equipped gear** and inventory (durability unchanged).
- **60% of the XP** it had earned (applied to the current hero, can level them mid-run).
- **The 50% of carried gold that dropped on it**.
- **One Memory Shard**, with 3–4 skill choices drawn from the Echo's kit (capstone weighted 2×).

The Memory Shard is an item. It can be banked. Using it teaches one skill to the current character **regardless of class**, at rank 1, using the current character's stats. Memory skills occupy **Memory slots**: 3 base, +1 at floors 30/60/90. A capstone costs 2 slots.

### 3.5 Failure while reclaiming
If the new hero dies before reclaiming:
- The old Echo remains.
- The new death creates a second Echo, possibly on a different floor.
- The floor now has 2 Echoes. Each additional Echo adds **+1 enemy** (max +5) and **+10% loot quality** to that floor.

**Echo cap:** 6 per floor. The 7th converts the oldest Echo into a **Wailing Echo**: +30% stats, an extra corruption modifier, double shard value, and a floor-wide hazard aura. Nothing is deleted.

### 3.6 Anti-softlock valves
The design must never trap a player behind their own corpse.

| Valve | Rule |
| --- | --- |
| **Resonance** | Each failed attempt against a specific Echo grants +5% damage vs it (max +50%) and reveals one more skill in its kit. Resets on reclaim. |
| **Requiem** | After 3 failed attempts, the Guild offers a ritual: pay gold equal to 50% of the Echo's gear value to put it to rest. You receive 30% XP and one random shard, not the gear. |
| **Fade** | An Echo untouched for 8 descents fades into a banked Memory Shard at the Guild. The gear is lost. |
| **Depth Ward** | You cannot enter a band whose minimum level exceeds your character level (see §7.4), so a new hero cannot stumble into a level-40 Echo at level 3. |
| **Descent Gates** | Start at the deepest unlocked gate that is not deeper than the Echo you are hunting (§7.5). |

### 3.7 Echo economy
Echoes are the best loot source in the game, by design:

- Echo gear is **Echo-Bound** until reclaimed: it cannot be stashed or sold, and defeating the Echo is the only way to release it.
- Echo kill: guaranteed one item at the Echo's rarity, +1 rarity roll per corruption tier.
- Echo floors cannot be auto-battled, so the risk stays manual.
- The **Gravewarden** class gains +10% max HP per Echo defeated in the run; the **Martyr** creates weaker Echoes with double shards. Classes interact with the legacy loop, not just combat.

---

## 4. Character creation: the Stat-Lock engine

### 4.1 Input
- Pool: **10 points**, each stat 0–10, total must equal 10.
- Six stats: STR, DEX, INT, VIT, WIS, LUK.
- The UI previews the derived class in real time, with the lane ("Your two strongest callings: STR + VIT") and the exact class name.
- Confirmation is final. There is no respec; a new character is the reset.

### 4.2 Derivation (implemented and exhaustively tested)
The old threshold-only approach left most builds classless. The shipped model is **lane-based**:

1. **Secret callings** are checked first, globally (10 classes; e.g. 7 LUK / 3 DEX = The Gambler).
2. Otherwise, rank the six stats. Ties break canonically: **STR > DEX > INT > VIT > WIS > LUK**.
3. If the top stat is **≥ 6** and the second is **≤ 2**, the lane is `PURE_<STAT>`.
4. Otherwise the lane is the canonical pair of the top two stats (e.g. `STR+VIT`).
5. Within the lane, classes are checked by priority; the last class in every lane is an unconditional catch-all.

This guarantees that **all 3,003 legal builds** resolve to exactly one of the 50 classes. The validator enumerates every build and fails CI on any gap, overlap, or unreachable class.

**Named cases from the brief (golden tests):**

| Allocation | Class |
| --- | --- |
| 5 STR / 5 VIT | The Bruiser |
| 6 INT / 4 DEX | The Spellblade |
| 7 LUK / 3 DEX | The Gambler |
| 8 STR / 2 VIT | The Berserker |
| 5 STR / 3 INT / 2 WIS | The Paladin |
| 4 STR / 6 DEX | The Buccaneer |
| 8 INT / 2 VIT | The Glass Cannon |
| 10 LUK | The Singularity |
| 9 LUK / 1 INT | The Fool |

The full table, lane coverage, and build-space distribution are generated in [`CLASS_MATRIX.md`](CLASS_MATRIX.md).

### 4.3 The 50-class matrix
| Archetype | Count | Examples | Design job |
| --- | --- | ---: | --- |
| Pure | 10 | Muscle Wizard, Ghost, Glass Cannon, Wall, Oracle, Fool | Teach the extreme; one stat defines the run |
| Hybrid | 20 | Monk, Spellblade, Paladin, Trickster, Reaver, Pilgrim | Two-stat tension; most "planned" builds land here |
| Tank | 10 | Juggernaut, Warlock, Templar, Bulwark, Shaman | Convert VIT/WIS into self/summon utility and survival |
| Secret | 10 | Gambler, Berserker, Oathbreaker, Equilibrium, Singularity | Rewards system mastery; odd shapes with unique rules |

Secret classes are not stronger, just stranger. The Singularity (10/0/0/0/0/0) has one absurd number and five zeroes.

### 4.4 Derived stats
| Stat | Formula (character level L) |
| --- | --- |
| Max HP | `25 + 7×VIT + 3×STR + 2×L` |
| Max MP | `8 + 4×INT + 2×WIS + 1×L` |
| P.ATK | `4 + 2.2×STR + 0.6×DEX + 0.4×L` |
| M.ATK | `4 + 2.2×INT + 0.6×WIS + 0.4×L` |
| P.DEF | `1.5×VIT + 0.6×STR + 0.3×L` |
| M.DEF | `1.5×WIS + 0.6×INT + 0.3×L` |
| SPD | `10 + 1.5×DEX + 0.3×LUK` |
| ACC | `80 + 2.5×DEX + 1.0×LUK + weapon` |
| EVA | `5 + 1.8×DEX + 1.2×LUK − armor penalty` |
| CRIT | `5 + 1.5×LUK + 0.5×DEX` (cap 75) |
| Trap Sense | `10 + 4×WIS + 1×LUK + light radius` |
| Carry | `12 + 1×STR` inventory slots (max 22) |

**Level growth:** levels 2–30 grant **Depth Points** and unlock the class tree's nodes. The flat HP/MP growth per level is already in the formulas above. Depth Points buy flat Mastery bonuses (Power / Guile / Faith), never the six primary stats, so a class can never drift.

### 4.5 Skill trees
Every class has a 12-node tree:
- 4 **actives** at levels 1, 4, 8, 12 (the capstone).
- 4 **discipline passives** at levels 2, 5, 9, 11.
- 4 **stat/mastery nodes** at levels 3, 6, 7, 10.

Only the current class tree is available. On death, unlocked tree skills are frozen on the Echo. Reclaiming the Echo can return one of them as a Memory skill. Memory slots are the only way to mix class kits.

The four actives for all 50 classes are specified in `design/skills.json`; the innate passive is in `design/classes.json`. The discipline passives are generated from the class's role tag and reviewed by design.

---

## 5. The Guild Hall (hub)

A single static, atmospheric screen with seven interactive stations. No walking required; tap a station.

| Station | Function |
| --- | --- |
| **The Survivor** | Create a new character after death. Shows the Reincarnation board. |
| **The Reincarnation Board** | Allocate 10 points; live class preview; confirm once. |
| **The Stash** | Shared account inventory. 24 slots base, +8 per band boss. Items are safe here. |
| **The Forge** | Repair durability, dismantle gear into Residuum, craft affixes. |
| **The Echo Registry** | Every Echo, floor, class, corruption tier, and estimated power. Set a "revenge target" that highlights the floor. |
| **The Gate** | Choose a Descent Gate, inspect the band modifier, descend. |
| **The Codex** | Unlocked classes, item catalogue, lore. Account-wide, never lost. |

**Renown** (account progression) comes from first-time floor clears, boss kills, and Echo reclaims. It unlocks: stash slots, auto-battle speed, Echo intel (see loadout before committing), cosmetic skins, and Requiem cost reductions. Requiem itself is always available after 3 failed attempts, so Renown never gates an anti-softlock valve. Renown never grants raw combat power.

---

## 6. The dungeon: 100 floors

### 6.1 Bands
| Floors | Band | Theme | New rule | Enemies | Boss |
| --- | --- | --- | --- | --- | --- |
| 1–10 | The Threshold | Collapsed guild barracks, moss, candlelight | Tutorial: AP, flanking, traps, extraction | Rats, husks, deserters | **The Gatekeeper** (10) |
| 11–30 | The Warrens | Flooded tunnels, fungus, fire vents | Elemental hazards; WIS trap detection matters | Broodlings, bog witches, miners | **The Flood** (20), **The Brood Mother** (30) |
| 31–60 | The Depths | Black masonry, forges, bone cathedrals | Elites; mini-bosses every 5; durability pressure | Iron penitents, flesh sculptors, wardens | **The Forge Saint** (40), **The Choir** (50), **The Warden** (60) |
| 61–90 | The Abyss | Inverted rooms, starless voids, mirror halls | Reality rules per floor (gravity, mirrors, loops) | Void echoes, paradox hounds, the Unmade | **The Mirror** (70), **The Hollow King** (80), **The Unmade** (90) |
| 91–100 | The Zenith | Gold, white marble, impossible light | Fixed gauntlet; no extraction until 100 | Your echoes, saints, the First | **The First Echo** (100) |

### 6.2 Floor structure
- **Floors 1–10:** handcrafted. Teach one mechanic per floor; floor 10 is a boss arena.
- **Floors 11–90:** procedural layout within a fixed theme. 7–11 rooms, one entrance, one stairs, 1–3 optional treasure rooms, 0–1 shrine, 0–1 secret room (WIS).
- **Floors 91–99:** handcrafted set pieces connected by short procedural corridors. Each is a puzzle-boss hybrid.
- **Floor 100:** fixed arena. The final boss is **The First Echo**, a composite of up to three of your highest-corruption Echoes, using their skills and gear. If you have no Echoes, it uses the Guild's founder build.

### 6.3 Persistence vs respawn
The dungeon is persistent in **shape**, not in **population**:
- Layout, secrets found, shortcuts, boss kills, and Echoes persist forever.
- Regular enemies respawn on every descent ("the dungeon refills").
- Cleared floors can be auto-battled *except* floors with an active Echo, a boss, or a reality rule.

This preserves the recovery run (you still fight down) without forcing a 60-floor walking simulator.

### 6.4 Fog of war
- Vision radius: 4 tiles + 1 per 4 WIS, blocked by walls.
- Explored tiles stay dimly visible; enemies in fog are hidden.
- **Listen** (free action, once per floor): reveals enemy positions in a 6-tile radius but not their identity.
- Traps are invisible until Trap Sense succeeds (roll `d100 ≤ Trap Sense` within 2 tiles) or triggered.
- Secret doors: `d100 ≤ Trap Sense − 20` when adjacent.

### 6.5 Traps and hazards
| Trap | Trigger | Effect | Counter |
| --- | --- | --- | --- |
| Spike | Step | 15% max HP, Bleed | WIS detect, DEX disarm |
| Flame vent | Step / every 2 turns | Burn 3 turns | INT resist, water tiles |
| Alarm | Step | Spawns 2 enemies | WIS detect, LUK disarm |
| Pit | Step | 20% HP, drops to lower room | DEX save, rope item |
| Rune | Line of sight | Elemental AoE | Dispel, WIS detect |
| Gravity flip (Abyss) | Floor rule | Movement directions invert | Map reading; no counter |

### 6.6 Loot and durability
- **Chests:** 1–3 per floor; quality scales with floor, LUK, and Echo count.
- **Drops:** 35% base, +2% per LUK; elites 100%.
- **Durability:** weapons 60, armor 80, shields 50. A hit or skill use costs 1; a critical costs 3. At 0 the item is **Broken** (kept, no stats) and can be repaired at the Forge for 30% of value.
- **Extraction:** only items in the Stash survive death. A **Vault Rune** sends one item to the Stash instantly.
- **Gold:** 50% of carried gold drops on the Echo; the other 50% is lost. Reclaiming the Echo returns the dropped half.

**Item budget:** a floor-appropriate item has stat value ≈ `6 + floor × 0.8`. Rarity multipliers: common ×1.0, masterwork ×1.35, relic ×1.8, echo-bound ×2.2. No item may grant more than +3 to a primary stat.

### 6.7 Economy
| Currency | Source | Sink | Notes |
| --- | --- | --- | --- |
| **Gold** | Kills, chests, Echo reclaim, selling | Forge repair, Requiem, consumables | 50% drops on death; the other 50% is lost |
| **Residuum** | Dismantling gear | Crafting affixes, re-rolling a single affix | Never lost on death (account currency) |
| **Renown** | First clears, bosses, reclaims | Unlocks convenience and cosmetics | No combat power |
| **Memory Shards** | Echo reclaim, Fade | Learning cross-class skills | Stored in the Guild, never lost |

**Sinks are deliberate.** Repair is the main gold sink; it punishes hoarding broken gear but never hard-locks a run (a broken weapon still does 1 damage and can be replaced by floor loot). Residuum gives duplicate loot a use. Renown gives long-term goals without invalidating the hardcore premise. There is no inflation-prone vendor trash: common items dismantle into Residuum and disappear.

---

## 7. Combat

### 7.1 Grid and turn order
- **9×9 tactical grid**, 32 px logical tiles (rendered 3× on 1080p), eight-way movement: orthogonal costs 1, diagonal costs 1.5 (rounded down after total).
- Initiative: each round, units act in descending **SPD**; ties go player-first, then unit id.
- Haste/Slow modify SPD by ±30% for the round.
- **Facing matters.** Backstab (attack from behind): +25% damage and +15% crit. Flanking requires a second hostile unit on the opposite side (+10% damage); for the player that unit must be a summon. If both apply, use backstab, not both.

### 7.2 AP economy
| Action | AP |
| --- | ---: |
| Move 1 tile | 1 |
| Basic attack | 3 |
| Skill | 2–6 (per kit) |
| Use item | 2 |
| Wait / guard | 0 (refunds 2, +20% DEF until next turn) |
| Disengage | 2 (0 for Buccaneer once per turn) |

Base AP is **6**. Unspent AP does not carry over unless a skill says so. This makes "move + attack" or "skill + reposition" the default turn, not "do everything".

### 7.3 Resolution formulas
```
Hit%      = clamp(ACC − EVA + statusMod, 15, 95)
Crit%     = clamp(CRIT − targetCritResist, 0, 75)
Raw       = ATK × skillMultiplier
Mitigated = Raw × 100 / (100 + DEF)
Damage    = max(1, Mitigated × variance(0.90..1.10)
                        × crit(1.75) × element(0.5/1.0/1.5) × position(1.0/1.10/1.25))
```
- Elemental resistance is capped at 75%; weakness at −50%.
- Crit and backstab multiply. `position` is 1.10 for flank and 1.25 for backstab; the higher applies. Non-boss damage is capped at 70% of the target's max HP per hit to prevent one-shot spikes.
- **Deterministic seeds:** the combat RNG stream is seeded per encounter, so replays and auto-battle are reproducible.

### 7.4 Level and depth gating
| Band | Minimum level to enter |
| --- | ---: |
| 1–10 | 1 |
| 11–30 | 5 |
| 31–60 | 15 |
| 61–90 | 25 |
| 91–100 | 30 |

A new hero gains **Heirloom XP**: +25% XP per unlocked gate, capped at +100%, until they reach the deepest floor minus 10. Recovery runs are fast but not free.

### 7.5 Descent Gates
Defeating a band boss unlocks a gate: floors **1, 11, 31, 61, 91**. A new character may start at any unlocked gate **no deeper than their Echo's floor**, so the Echo remains reachable. Starting at a gate (rather than floor 1) grants Guild-issue common gear appropriate to the band; it does not grant loot or skip the Echo. The Gate UI blocks any gate that would skip an active Echo.

### 7.6 Status effects
| Status | Effect | Duration | Stacks |
| --- | --- | --- | --- |
| Burn | 5% max HP/turn, fire | 3 | 2 (refreshes) |
| Bleed | 4% max HP when moving or attacking | 3 | 3 |
| Poison | 3% max HP/turn, ignores DEF | 4 | 1 |
| Stun | Skip turn | 1 | — |
| Blind | −40% accuracy | 2 | — |
| Confuse | 50% chance to attack a random adjacent unit | 2 | — |
| Root | Cannot move | 2 | — |
| Hex | +15% damage taken | 2 | — |
| Shield | Absorbs damage before HP | until broken | — |

Resistances: VIT reduces Bleed duration by 1 at VIT ≥ 6; WIS reduces Confuse/Blind by 1 turn at WIS ≥ 6; INT reduces Burn by 1 turn at INT ≥ 6.

### 7.7 Worked turn
A 6 AP Monk at 5 STR / 5 DEX faces a Husk 3 tiles away:
1. Move 2 tiles (2 AP) to put a pillar between herself and a second Husk; this breaks line of sight and forces the second enemy to spend a turn repositioning.
2. **Flurry** (3 AP): three 60% hits. Hit chance 82% → expected 2.46 hits ≈ 148% P damage.
3. **Pressure Point** is 4 AP, so it is not available this turn. Save 1 AP or **Wait** for +20% DEF.
4. The Husk telegraphs a cleave. Next turn: disengage (2 AP) or **Counter Stance** (2 AP) and bait it.

The tension is AP scarcity, not cooldown timers.

---

## 8. Echo AI (implementation-facing)

### 8.1 Utility scoring
Each turn, enumerate legal actions. Score:
```
score = baseValue
      + expectedDamage × aggression
      + healValue × (1 − targetHpRatio) × healerWeight
      + buffValue × sideUnitCount
      + controlValue × threatLevel
      − friendlyFireRisk × 3
      − apCost × 0.4
      − distancePenalty(preferredRange)
```
`sideUnitCount` is the number of living units on the acting side, including the actor; for the player this is 1 + summons. Pick the highest score; break ties by lower AP cost, then by action id. Add ±5% noise seeded by `(echoId, turn)` so identical Echoes do not mirror each other.

### 8.2 Role overrides
| Role | Hard rule |
| --- | --- |
| Healer | If self < 60% HP, healing outranks damage |
| Glass nuker | Never end turn adjacent to an enemy if a ranged tile exists |
| Assassin | Prioritize the lowest-DEF target; disengage below 30% HP |
| Tank | Body-block the shortest path to wounded mourners; taunt on cooldown |
| Controller | Prefer Stun/Blind on the player's highest-ATK unit |

### 8.3 Corruption
| Tier | Trigger | Effect |
| --- | ---: | --- |
| 0 | Fresh death | Base stats, 80% AI efficiency |
| 1 | 1 kill | +10% stats, +1 guard |
| 2 | 3 kills | +20% stats, extra resistance, +1 skill |
| 3 | 6 kills | +30% stats, Echo Art (floor-themed), double shards |

Corruption is displayed on the Echo Registry. A high-corruption Echo is a raid boss, not a chore.

---

## 9. UX and mobile

### 9.1 Screen layout (portrait, 1080×1920 reference)
```
┌──────────────────────────────┐
│ Top bar: floor, threat, menu │  ~8%
├──────────────────────────────┤
│                              │
│   9×9 tactical grid          │  ~52%
│   (camera pans on big rooms) │
│                              │
├──────────────────────────────┤
│ Intent strip: enemy actions  │  ~8%
├──────────────────────────────┤
│ Thumb zone: AP pips, skill   │  ~32%
│ wheel, move/attack/item      │
└──────────────────────────────┘
```
- **Tap** a tile to move; **drag** to preview path and AP cost; release to commit.
- **Swipe up** from the thumb zone opens the skill wheel (radial, 6 slots).
- **Swipe left/right** cycles targets; **long-press** inspects any unit or tile.
- **Two-finger tap** toggles the grid and threat overlay.
- Every action is undoable **once per combat** ("Rewind"), restoring the pre-action state. This is a learning tool, not a safety net.

### 9.2 Readability
- Damage numbers: 32 px pixel font, outlined; crits 48 px and shake 8 px / 120 ms.
- Status icons always paired with a letter (B, BL, P, S) for colorblind players.
- Intent icons: sword (attack), flask (heal), shield (buff), eye (debuff), skull (execute).
- Minimum touch target 48×48 dp.
- Text scale 0.8×–1.4×; all layouts reflow.

### 9.3 Auto-battle
- Unlocked at Renown 3.
- Available only on floors with no active Echo, no boss, and no unresolved reality rule.
- Runs the deterministic sim at 20× and plays back the event log at 1×/2×/3×.
- Stops automatically on: HP < 35%, an Echo spawn, a new item, a level-up, or a floor exit.
- Auto-battle never makes choices a player could not; it uses the same AI as enemies, with a conservative profile.

### 9.4 Save/resume
- Save on every room transition and every combat action (debounced 500 ms).
- Kill the app mid-combat → resume at the start of the current turn.
- One profile per device; cloud sync optional (Game Center / Play Games). Conflicts merge Echoes by id, union stash items by instanceId, then enforce capacity in favor of the higher-playtime profile.

---

## 10. Art direction

### 10.1 Specs
- 32×32 tiles; characters 64×64, 4 directions, 8-frame idle/walk, 6-frame attack, 4-frame hurt/death.
- 32-bit-era palette discipline: 48 colors per band, 12 reserved for VFX.
- 2.5D top-down with Y-sorting and fake height (walls 1.5 tiles tall); isometric projection only for the floor-100 arena.
- 2D normal maps + point lights: torches, magic, Echo aura. Light radius is a gameplay stat, not just mood.
- Fog of war shader with dithered edge, not a hard black mask.

### 10.2 Palette
| Role | Hex |
| --- | --- |
| Soot / shadow | `#2B2118` |
| Stone | `#4A4640` |
| Deep purple | `#2E1A3A` |
| Bone | `#D8CBB0` |
| Ember | `#D46A2C` |
| Arcane blue | `#4C7FD6` |
| Blood | `#8E2B2B` |
| Poison | `#5C8A3A` |
| Gold | `#C9A24B` |

### 10.3 Typography
- Display / titles: **Cinzel** (OFL), uppercase, tracked +4%.
- Body / lore: **EB Garamond** (OFL).
- UI stats / numbers: **Inter** (OFL), tabular numerals.
- In-world damage and pickups: **m5x7** pixel font at 2× / 3×.

### 10.4 Echo visual language
- The Echo is the dead hero's sprite, desaturated 40%, with a purple rim light and a floating memory shard.
- Idle animation is the character's idle, slowed to 0.7× and offset by 2 frames — "wrong" without being a new asset.
- On spawn: 0.4 s desaturation pulse, reversed creation chime, and a ring of dust.
- On defeat: the gear silhouette collapses into a shard; the screen briefly shows the death card again.

### 10.5 Audio
- Exploration: low drone + room-tone layer (dripping, wind, distant hammer).
- Combat: percussion layer enters on initiative; intensity rises with enemy count.
- Echo theme: music box + reversed choir, tempo 0.7× the Guild theme.
- Character creation motif (3 notes) is reversed and pitched down for Echo spawn. The player should feel the recognition before the UI explains it.
- All SFX mono-compatible; no audio essential to gameplay.

---

## 11. Narrative (light touch)

The Guild has sent heroes into the Tower for 300 years. The Tower does not kill them; it **files** them. Every floor is a shelf. The 100th floor is the archive's index — a creature made of every hero who ever reached it. The final boss uses your own Echoes because it has been waiting for someone with a legacy worth reading.

Told through:
- Item descriptions (1–2 lines).
- Echo epitaphs (auto-generated from cause of death + class + floor).
- 20 lore fragments in the Codex: one per boss, plus ten environmental pieces.
- No cutscenes longer than 10 seconds; no unskippable dialogue.

---

## 12. Accessibility

- Colorblind palettes for status icons and elemental damage.
- Screen-shake toggle and intensity slider.
- Text scale 0.8–1.4; high-contrast UI mode.
- Full one-handed layout; no mandatory two-finger gestures (all have buttons).
- Turn undo once per combat; telegraphs are always visible.
- No QTE, no timing-based input, no audio-only cues.
- Difficulty options: **Standard** and **Pilgrim** (Echoes −15% stats, traps telegraphed, no achievement lockout beyond a cosmetic badge).

---

## 13. Monetization and live operations

- **Premium unlock:** $6.99, full game, no ads, no energy.
- **Cosmetics:** $1.99–$3.99 Echo skins (the dead hero's silhouette), Guild Hall themes, alternate damage-number fonts. Cosmetic only.
- **Expansion:** "The 101st Floor" — 20 floors, 8 classes, new band rule. $4.99.
- **No** loot boxes, no stat boosts, no continues, no ads.
- Seasonal **Echo Hunt** (free): a curated weekly seed with a leaderboard for deepest reclaim. Server optional; offline score card otherwise.

---

## 14. Balance targets and KPIs

### 14.1 Balance
| Metric | Target |
| --- | --- |
| First death | Floor 6–9, within 20 min |
| First successful reclaim | 70% of players within 2 attempts |
| First band boss clear | 60% of players within 60 min |
| Floor 100 clear (first) | 8–12 h total play |
| Class pick rate | no class > 8% of created characters; no class < 0.5% |
| Echo death spiral | < 5% of players with 3+ unresolved Echoes on one floor |
| Combat length | 3–5 rounds normal, 6–10 elite/Echo |
| Run length | 25–40 min per descent |

### 14.2 KPIs
- Tutorial completion ≥ 80%.
- D1 ≥ 35%, D7 ≥ 15%, D30 ≥ 6%.
- Median session 8–12 min; 3+ sessions/day for retained players.
- Crash-free sessions ≥ 99.5%.
- Death-to-new-character time < 20 s.
- Auto-battle usage 30–50% of cleared-floor time (not higher; if higher, manual combat is too slow).

---

## 15. Risks and mitigations

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| **Death spiral** | A weak hero vs a strong Echo feels unfair | Depth Ward, Resonance, Requiem, Fade, Heirloom XP |
| **Echo snowball** | Many Echoes make a floor unplayable | Cap 6/floor; overflow becomes Wailing (loot, not lock); Requiem |
| **50 classes = 50 balance problems** | Content and QA cost | Lane data-driven kits; 4 actives each; balance by role, not per-class; automated sim |
| **Procedural sameness** | 100 floors of rooms | Band rules change movement/vision/economy, not just tiles |
| **Mobile readability** | 9×9 grid + dense UI in portrait | Thumb zone, intent strip, icon+letter, 48 dp targets, playtest on 5.5" |
| **Save corruption** | Losing a 20-hour graveyard | Per-Echo files, atomic writes, checksums, schema migrations, cloud backup |
| **Grind** | Replaying floors to reach an Echo | Descent Gates, auto-battle, Heirloom XP |
| **Echo AI exploits** | Players bait the AI into dumb loops | Utility + role overrides; telemetry on win rate vs Echo; no pathing through hazards |
| **Premium ceiling** | Hardcore niche | Cosmetic skins, expansion, demo at floor 10 |

---

## 16. Scope and MVP cut

| Milestone | Content | Purpose |
| --- | --- | --- |
| **Vertical slice** | 6 classes, 10 floors, Echo loop, 1 boss | Prove the death→reclaim loop is fun |
| **Alpha** | 24 classes, 40 floors, 3 bands, items, auto-battle | Prove retention and build diversity |
| **Beta** | 50 classes, 80 floors, 4 bands, full UX | Content lock and balance |
| **1.0** | 100 floors, final boss, cosmetics, cloud save | Ship |

The 50-class matrix and 100-floor plan are the 1.0 target, not the first build. The vertical slice must include at least one secret class and one Echo reclaim.

---

## 17. Glossary

- **Echo:** the AI-controlled corpse of a dead player character, on the floor where it died.
- **Ally:** the hero or a summon the hero controls; there is no AI companion.
- **Summon:** a temporary player-side unit created by a skill or passive; it acts after the hero and vanishes at combat end.
- **Mourner:** an enemy from the floor pool that guards an Echo; not a player companion.
- **Reclaim:** defeating your Echo to recover gear, XP, gold, and a Memory Shard.
- **Memory Shard:** consumable that teaches one skill from a dead class, regardless of current class.
- **Lane:** the pair (or pure stat) that selects a class family from the 10-point allocation.
- **Descent Gate:** unlocked start point at floors 1/11/31/61/91.
- **Depth Ward:** minimum level required to enter a band.
- **Wailing Echo:** overflow Echo at 7+ per floor; stronger, richer, still reclaimable.
- **Extraction:** returning to the Guild alive (or using a Vault Rune) to keep loot.
