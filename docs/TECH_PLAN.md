# Echoes of the 100th Floor
## Technical Implementation Plan v1.0

**Engine:** Godot 4.4 (stable), GDScript with static typing; C# optional for tooling only
**Targets:** iOS 15+, Android 9+ (API 28), 1080×1920 reference, portrait, offline-first
**Simulation:** headless, deterministic, event-sourced; rendering is a subscriber
**Repository state:** design-first. The rules, kits, schemas, and exhaustive class test exist today. The Godot project is the next deliverable.

---

## 1. Why Godot

| Requirement | Godot 4.4 | Notes |
| --- | --- | --- |
| 2D pixel/isometric | Excellent `TileMapLayer`, Y-sort, 2D lights, normal maps | Core look without custom renderer |
| Mobile export | Android AAB + iOS, one-click | Test on device early; avoid 4.4-only plugins |
| Small install | ~30–40 MB base | Fits the < 150 MB budget |
| Fast iteration | GDScript hot reload, scenes as text | Critical for 50 classes / 100 floors |
| Headless tests | `--headless --script` | Deterministic sim can run in CI |
| Cost | MIT, no royalties | Premium-friendly |

**Alternative:** Unity 6 if the team is C#-native. The architecture below is engine-agnostic; only the scene/UI layer changes. Do not split the simulation across engine nodes in either engine.

---

## 2. Quality attributes and budgets

| Attribute | Budget |
| --- | --- |
| Frame rate | 60 fps on iPhone 11 / Pixel 5; 30 fps fallback on low tier |
| Frame time | Sim ≤ 2 ms, render ≤ 8 ms, UI ≤ 2 ms, audio ≤ 1 ms, 3.6 ms slack |
| Draw calls | < 80; tilemap chunks 16×16; one atlas per band |
| Memory | < 300 MB RSS; < 180 MB texture |
| Install | < 150 MB (base + band 1 art) |
| Cold start | < 3 s to Guild Hall on mid-tier |
| Save latency | < 50 ms, off the main thread; Echo file < 8 KB |
| Combat resolution | < 4 ms for a 12-unit turn |
| Floor generation | < 120 ms p95, including validation |
| Battery | Pause render/audio on focus loss; cap 60 fps; no idle 3D |

---

## 3. Architecture

### 3.1 Layers

```
┌─────────────────────────────────────────────┐
│ Presentation (Godot scenes, UI, VFX, audio) │
│  reads events, never mutates state          │
└──────────────────────┬──────────────────────┘
                       │ commands / event log
┌──────────────────────▼──────────────────────┐
│ Application (run controller, screens, input)│
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│ Simulation (pure GDScript, no Node)         │
│  ClassEngine · Combat · Dungeon · Echo · AI │
│  Loot · Progression · Save models           │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│ Persistence (JSON, schema, migrations)      │
└─────────────────────────────────────────────┘
```

**Hard rule:** `sim/` must not import `Node`, `SceneTree`, `Input`, or `OS`. It receives plain data and returns events. This makes the game testable, replayable, and auto-battle-able at 20× without rendering.

### 3.2 Command → event flow

```gdscript
# sim/combat/combat_session.gd
class_name CombatSession

func submit(action: CombatAction) -> Array[CombatEvent]:
    assert(state == State.ACTIVE)
    if not rules.can_perform(state, action):
        return [CombatEvent.rejected(action, rules.last_error)]
    var events := rules.resolve(state, action)   # pure; advances state
    state.rng.commit(action.seed_draws)
    history.append(action)
    return events
```

- Every event is serializable: `{type, actor, target, amount, element, status, tile, ...}`.
- The UI animates the event list; it never computes damage.
- Replays = `(seed, [actions])`. A hash of the final state is stored for verification.
- Undo = snapshot the state before the action (once per combat).

### 3.3 Repository layout

```
design/
  classes.json            # 50 lane rules (source of truth)
  skills.json             # 50 kits: 3 actives + capstone each
  save.schema.json        # Echo + save contract
  items.json              # (next) item bases and affixes
  enemies.json            # (next) enemy templates
  passives.json           # (next) generated discipline nodes
  floors/                 # (next) handcrafted floors 1-10, 91-100
tools/
  class-engine.mjs        # executable spec for the class engine
  validate-classes.mjs    # exhaustive 3,003-build test + matrix generator
docs/
  GDD.md
  TECH_PLAN.md
  CLASS_MATRIX.md         # generated, do not edit
game/                     # Godot project (next)
  project.godot
  sim/
    class_engine.gd
    combat/
    dungeon/
    echo/
    ai/
  game/
    screens/
    battle/
    hub/
  ui/
  data/                   # imported JSON, validated at build
tests/
  class_matrix_test.gd
  combat_properties_test.gd
  dungeon_fuzz_test.gd
  echo_lifecycle_test.gd
  save_migration_test.gd
```

---

## 4. Determinism

Determinism is a feature, not a nicety: it powers replays, auto-battle, bug reports, and the class test.

### 4.1 RNG streams
Use **PCG32** with named streams, never `randf()`:

```gdscript
# sim/rng.gd
class_name Rng

var _state: int
var _inc: int

func _init(seed: int, stream: int) -> void:
    _state = 0
    _inc = (stream << 1) | 1
    next_u32()
    _state += seed
    next_u32()

static func stream_seed(run_seed: int, floor: int, domain: String) -> int:
    return hash("%d:%d:%s" % [run_seed, floor, domain])
```

Streams: `map`, `loot`, `combat`, `ai`, `echo_ai`, `events`. Each subsystem owns one. Never share a stream across systems; a draw in the wrong order desyncs everything.

### 4.2 Tie-breaks
- Stat ties: canonical `STR > DEX > INT > VIT > WIS > LUK`.
- Initiative ties: player first, then unit id (stable).
- AI action ties: lower AP, then action id.
- Loot table ties: sorted item id.
- Every unordered collection is sorted before iteration.

### 4.3 Golden matrix
The class validator enumerates every build and writes the canonical matrix:

```bash
node tools/validate-classes.mjs --strict --matrix docs/CLASS_MATRIX.md
```

The JS engine is the executable spec. The Godot test must reproduce the same 3,003-build classification table; CI fails if the GDScript port diverges.

---

## 5. Class engine

### 5.1 Data contract
`design/classes.json`:
```json
{
  "id": "paladin",
  "name": "The Paladin",
  "archetype": "hybrid",
  "lane": "STR+INT",
  "priority": 779,
  "requires": { "if": [["STR", ">", "INT"], ["INT", ">", "WIS"], ["WIS", ">=", 1]] }
}
```
`design/skills.json`:
```json
{
  "paladin": {
    "skills": [
      { "lvl": 1, "name": "Smite", "ap": 3, "mp": 2, "range": 1, "effect": "140% P + 50% M" }
    ],
    "capstone": { "lvl": 12, "name": "Judgment", "ap": 6, "mp": 8, "range": 2, "effect": "..." }
  }
}
```

### 5.2 GDScript port
```gdscript
# sim/class_engine.gd
class_name ClassEngine

const STATS := ["STR", "DEX", "INT", "VIT", "WIS", "LUK"]

static func derive_lane(stats: Dictionary) -> String:
    var ranked := []
    for i in STATS.size():
        ranked.append({"stat": STATS[i], "value": int(stats[STATS[i]])})
    ranked.sort_custom(func(a, b):
        if a.value != b.value: return a.value > b.value
        return STATS.find(a.stat) < STATS.find(b.stat))
    var first: Dictionary = ranked[0]
    var second: Dictionary = ranked[1]
    if first.value >= 6 and second.value <= 2:
        return "PURE_%s" % first.stat
    var pair := [first.stat, second.stat]
    pair.sort_custom(func(a, b): return STATS.find(a) < STATS.find(b))
    return "%s+%s" % [pair[0], pair[1]]

static func classify(stats: Dictionary, classes: Array) -> Dictionary:
    var ordered := classes.duplicate()
    ordered.sort_custom(func(a, b): return a.priority > b.priority)
    for cls in ordered:
        if cls.has("lane"): continue
        if _matches(cls.requires, stats): return cls
    var lane := derive_lane(stats)
    for cls in ordered:
        if cls.get("lane", "") != lane: continue
        if _matches(cls.requires, stats): return cls
    push_error("No lane catch-all for %s" % lane)
    return {}
```

The GDScript version must not "improve" the algorithm. The lane model and tie-break are part of the design.

### 5.3 Class test
`tests/class_matrix_test.gd`:
1. Enumerate all 3,003 compositions (same recursion as `tools/class-engine.mjs`).
2. Classify each.
3. Assert: exactly one result, every class reachable, golden cases pass, and the full classification table matches the JS output.
4. Fail the build on any drift.

This test runs in CI on every commit and takes < 50 ms.

### 5.4 Skill tree construction
At runtime, a class kit becomes a 12-node tree:
- 4 actives from `skills.json` at levels 1/4/8/12.
- 4 discipline passives generated from `role` + `archetype` (data table in `design/passives.json`, next).
- 4 mastery nodes (+HP/+ATK/+utility) from a shared template.

The tree is data, not code. A validator checks 12 nodes, strict level order, no duplicate ids, and that each active has AP/MP/range/effect.

---

## 6. Data schemas

### 6.1 Save and Echo
`design/save.schema.json` is the contract. Key decisions:

- **One Echo per file:** `user://echoes/ech_<id>.json`. A corrupted run save cannot destroy the graveyard.
- **Index:** `user://echoes/index.json` holds lightweight entries (id, name, class, floor, state, corruption). It is rebuildable by scanning the folder.
- **Envelope:** `user://saves/profile.json` references Echo ids, never embeds them.
- **Validation:** schema checked in CI with `ajv` (or Python `jsonschema`); runtime checks only the fields it mutates.
- **Versioning:** `schemaVersion` integer; migrations are pure functions `v1→v2→…`; the original file is backed up once before migration.

### 6.2 Item and enemy data (next)
```json
// design/items.json
{
  "bases": [
    { "id": "rusty_sword", "slot": "weapon", "tier": 1, "pAtk": 4, "durability": 60, "tags": ["blade"] }
  ],
  "affixes": [
    { "id": "of_ember", "stat": "mAtk", "min": 1, "max": 3, "tags": ["fire"] }
  ]
}
```
Enemies use the same stat block as the player plus `cost`, `aiRole`, `skills`, `lootTable`, `resistances`. This lets the combat resolver treat players, Echoes, and monsters uniformly.

### 6.3 Runtime DTOs
Use `RefCounted` classes with typed fields, not `Dictionary` soup, at the boundaries. JSON is converted once at load into DTOs; the sim works on DTOs. Serialization back to JSON happens only at save boundaries.

---

## 7. Dungeon generation

### 7.1 Inputs
```
seed       = PCG32(mix(runSeed, floor, GEN_VERSION))
band       = floor_band(floor)            # 1-10, 11-30, 31-60, 61-90, 91-100
theme      = band_theme(band)
budget     = 10 + floor * 2.2 + echo_count(floor) * 8
roomTarget = clamp(6 + floor / 12, 7, 11)
```

### 7.2 Algorithm (floors 11–90)
1. **Room placement**
   - Warrens: cellular automata cave, then room carving.
   - Depths: BSP split, 7–11 leaves, min room 4×4.
   - Abyss: BSP + one rule mutation (inverted gravity, mirror symmetry, loop corridor).
2. **Connectivity**
   - Build a Delaunay graph of room centers, take the MST, then add 15–25% extra edges for loops.
   - Pick entrance = room with the smallest `y`; stairs = room with the greatest graph distance from entrance.
3. **Dressing**
   - Hazard tiles by theme (fire vents, water, void).
   - Trap budget `floor / 8`, max 6; never on the only path without a disarm option.
   - Chests 1–3; shrine 0–1; secret room 0–1 (WIS check).
4. **Encounters**
   - Spend `budget` on enemy templates; at least one non-trivial encounter; no spawn within 6 tiles of the entrance.
   - Elites from floor 31; miniboss every 5 floors from 35.
5. **Echo override**
   - Persisted Echo positions replace the spawn tile in that room. Add 1–4 mourners and a "dread" aura.
   - If the stored tile is no longer walkable (layout version change), snap to the nearest walkable tile in the same room.
6. **Validation**
   - Entrance→stairs path exists; every chest/secret reachable; no trap on the only path; budget within ±10%; no enemy in a wall.
   - Retry up to 20 times with `seed + attempt`; if all fail, load a handcrafted fallback template for the band and log telemetry.

Floors 1–10 and 91–100 are handcrafted JSON scenes; 91–99 use procedural connectors between set pieces. Floor 100 is a fixed arena.

### 7.3 Persistence model
Store **seeds and diffs**, not full maps:

```json
{
  "floor": 37,
  "theme": "depths",
  "seed": 9918273,
  "layoutVersion": 4,
  "discovered": "base64-rle",
  "disarmedTraps": ["trap_12", "trap_19"],
  "shortcuts": ["lift_31_40"],
  "echoes": ["ech_a1b2c3d4"],
  "bossDefeated": false
}
```

On entry: regenerate from `seed + layoutVersion`, apply diffs, spawn Echoes. This keeps saves tiny (< 8 KB) and makes bug reproduction possible from a seed.

### 7.4 Performance
- Generation is CPU-only, < 120 ms p95; run it on a worker thread with a loading interstitial, never during combat.
- Cache the last 3 generated floors in memory; evict beyond that.
- Pre-bake navigation and line-of-sight blockers into packed arrays.

---

## 8. Combat engine

### 8.1 Core types
```gdscript
class_name CombatUnit
var id: String
var team: int                  # 0 player + summons, 1 enemy side (Echo + mourners)
var is_echo: bool              # true for the Echo commander
var is_summon: bool
var summoner_id: String        # empty for non-summons
var stats: Dictionary          # six primaries
var derived: Dictionary        # hp, atk, def, acc, eva, crit, spd
var hp: int
var mp: int
var ap: int
var facing: Vector2i
var statuses: Array[StatusInstance]
var skills: Array[SkillInstance]
var equipment: Dictionary
var ai: AiProfile
```

Summons are `team 0` units with `is_summon = true`; they act immediately after their summoner and do not join initiative. Echo mourners are `team 1`; the Echo is also `team 1` with `is_echo = true`.

### 8.2 Turn pipeline
1. `begin_round()`: tick statuses, apply damage-over-time, expire buffs, recompute SPD, sort initiative.
2. Active unit: AI or player submits an action.
3. `resolve()`: validate → pay AP/MP → roll hit → roll crit → compute damage → apply status → emit events → check deaths.
4. End turn: facing update, AP reset to 6, next unit.
5. Combat end: survivors, loot, XP, Echo state update.

### 8.3 Geometry
- Movement: 8-way (orthogonal 1, diagonal 1.5; accumulate as fixed-point halves to avoid float drift).
- LoS: Bresenham supercover; walls and smoke block.
- AoE: data-driven masks (`single`, `cross`, `line`, `cone`, `radius_1`, `radius_2`).
- Flanking: attacker and a second hostile unit adjacent to the target on opposite sides. The player has no party; only a summon (totem, mirror image, echo-copy) can create a player-side flank. Enemy Echoes can use mourners.
- Push/pull: step-by-step, stop at walls/units, 1 damage per blocked tile.

### 8.4 Damage
```gdscript
static func resolve_damage(attacker: CombatUnit, defender: CombatUnit, skill: SkillInstance) -> DamageResult:
    var hit := clampf(attacker.derived.acc - defender.derived.eva + skill.acc_mod, 15, 95)
    if rng.roll_percent() > hit:
        return DamageResult.miss()
    var crit := rng.roll_percent() <= clampf(attacker.derived.crit - defender.derived.crit_resist, 0, 75)
    var atk := attacker.derived.p_atk if skill.is_physical else attacker.derived.m_atk
    var raw := atk * skill.multiplier
    var defense := defender.derived.p_def if skill.is_physical else defender.derived.m_def
    var dmg := raw * 100.0 / (100.0 + defense)
    dmg *= rng.range_float(0.90, 1.10)
    if crit: dmg *= 1.75
    dmg *= element_multiplier(skill.element, defender)
    dmg *= position_multiplier(attacker, defender)
    var cap := defender.derived.max_hp * (1.0 if defender.is_boss else 0.7)
    dmg = minf(dmg, cap)
    return DamageResult.hit(maxi(1, roundi(dmg)), crit)
```

All randomness goes through the combat RNG; the number of draws is part of the action record. If a draw order changes, bump `COMBAT_VERSION` and invalidate replays.

### 8.5 Auto-battle
- Runs the same `CombatSession` headlessly.
- AI profile: conservative (heals earlier, avoids hazards, never uses consumables above rarity 2).
- UI plays the event log at 1×/2×/3×; simulation runs at 20× in batches of 10 turns.
- Abort conditions: HP < 35%, Echo present, boss, new item, level-up, floor exit, 60 s wall-clock.
- Auto-battle cannot be enabled on a floor with an active Echo (checked before the session starts, and again on spawn).

---

## 9. Echo service

### 9.1 Lifecycle

```
create character
   → descend
   → death
       snapshot(character, floor, position, cause)
       echo = build_echo(snapshot)
       write echo file (atomic)
       update index
       update floor.echoes
       update run (ended)
   → new character
   → reach floor
       load echoes for floor
       spawn echo + guardians
   → combat
       win  → reclaim(echo)
       lose → new echo, increment attempts/corruption
```

### 9.2 Snapshot rules
- Derived stats are recomputed from primaries + level + gear at death and stored, so a balance patch cannot silently buff old Echoes.
- Store `balanceVersion`; when loading an Echo from an older version, apply a **one-time normalization** to the current stat curve (documented, no gear changes).
- Store the full skill list with ranks. `memoryEligible` is true for all except skills flagged `noShard` (design reserves this for transformation/quest skills).
- Store AI profile at death; do not recompute from the current class table.

### 9.3 Atomic write
```gdscript
func write_atomic(path: String, data: Dictionary) -> Error:
    var tmp := path + ".tmp"
    var f := FileAccess.open(tmp, FileAccess.WRITE)
    if f == null: return FileAccess.get_open_error()
    f.store_string(JSON.stringify(data, "", false))
    f.flush()
    f.close()
    return DirAccess.rename_absolute(tmp, path)
```
- Keep one `.bak` of the previous file.
- The index is rewritten after the echo file; on load, if the index is stale, scan `echoes/*.json` and rebuild.
- A reclaim is a **transaction**: mark echo `reclaimed`, write echo, apply rewards to run, write run. If the run write fails, roll back the echo state and retry.
- Idempotency: reclaiming an already-`reclaimed` echo returns the stored result, never duplicates loot.

### 9.4 Overflow and fading
- Per-floor cap 6; on the 7th, the oldest becomes `wailing` (state change, not deletion) with +30% stats and a modifier.
- Global cap 600 files. Above 500, faded/reclaimed files older than 30 days are compacted into a `memorial.json` ledger (name, class, floor, epitaph) and removed. The Codex keeps the name.
- `Fade` after 8 descents: convert to a banked shard, state `faded`, keep the memorial.

### 9.5 AI
The Echo uses the same `UtilityAi` as enemies, with role weights from `aiProfile` and ±5% seeded noise. See GDD §8. Telemetry records each Echo encounter's win rate, average turns, and which skill killed the player most; use it to tune corruption.

---

## 10. Persistence and migrations

### 10.1 Files
```
user://saves/profile.json          # envelope: profile, settings, stash, codex, run
user://saves/profile.json.bak
user://echoes/index.json
user://echoes/ech_<id>.json
user://echoes/ech_<id>.json.bak
user://memorial.json               # compacted faded echoes
```

### 10.2 Integrity
- Canonical JSON (sorted keys, no whitespace) for hashing.
- Store `sha256` of the payload in a sidecar or header; verify on load.
- If the envelope fails: load `.bak`; if that fails, rebuild the run from Echo index + Stash backup and tell the player exactly what was recovered.
- Never block startup on a single corrupt Echo file; mark it `recovered: false` and continue.

### 10.3 Migrations
- `schemaVersion` gates a chain of pure functions.
- Each migration has a fixture (`tests/fixtures/v1_echo.json`) and a round-trip test.
- Migrations run on a copy; the original is preserved as `.pre_v2.bak`.
- A downgrade is never supported; the store may reject older clients.

### 10.4 Cloud sync
- Optional: Game Center / Google Play Games.
- Conflict policy: union Echoes by `echoId` (immutable except state); run save = higher `playtimeSeconds`; stash = item-level union with `instanceId` dedupe, then capacity enforcement.
- A conflict screen shows "3 Echoes recovered from another device" rather than silently merging.

---

## 11. Mobile implementation

### 11.1 Display
- Project stretch mode `canvas_items`, aspect `expand`, base 1080×1920.
- Respect `DisplayServer.get_display_safe_area()` for notches and gesture bars.
- Render at device resolution but cap 1080p internally on low-tier devices; upscale UI.
- Pixel snap: enable `rendering/2d/snap/snap_2d_transforms_to_pixel` and `snap_2d_vertices_to_pixel`; avoid fractional camera zoom.

### 11.2 Input
- Tap: `InputEventScreenTouch` with < 12 px movement and < 250 ms.
- Drag: path preview, AP cost, release to commit; cancel by dragging back to origin.
- Swipe up: skill wheel; swipe left/right: target cycle; two-finger tap: overlay toggle.
- Long press: inspect; haptics on invalid action (optional, toggle).
- All gestures have visible buttons; no gesture is the only way to do something.

### 11.3 UI performance
- One `CanvasLayer` for HUD, one for modal screens.
- Use `Control` anchors + containers; no per-frame `queue_redraw` unless animating.
- Pool damage numbers and status icons; cap 40 concurrent.
- Font atlases pre-generated for Latin + UI glyphs; no runtime font rasterization during combat.
- Localize by string keys from day one; leave 35% expansion room in buttons.

### 11.4 Audio
- OGG Vorbis, 96 kbps mono for SFX, 128 kbps stereo for music.
- Bus layout: Master → Music / SFX / UI / Voice; duck music −4 dB during Echo spawn and boss intro.
- Suspend audio on focus loss; resume with a 200 ms fade.

### 11.5 Export
- Android: AAB, min SDK 28, target latest, ARM64 + ARMv7, ASTC 6×6 with ETC2 fallback.
- iOS: Metal, arm64, no JIT; test on a physical device before content lock.
- Texture memory: atlas per band ≤ 2048²; evict previous band on transition; keep hub atlas resident.
- Install size: base + band 1 ≤ 80 MB; each additional band ≤ 18 MB; total ≤ 150 MB.

---

## 12. Testing and CI

### 12.1 Test pyramid

| Layer | What | Tool | Gate |
| --- | --- | --- | --- |
| Design invariants | 3,003 builds, 50 classes, 21 lanes, golden cases | `node tools/validate-classes.mjs --strict` | Every commit |
| Schema | Echo/save JSON validity, migration fixtures | `ajv` / `jsonschema` | Every commit |
| Unit | Damage, AP, status stacking, class lane | GUT (Godot Unit Test) | Every commit |
| Property | Damage ≥ 1, AP never negative, statuses expire, no NaN | GUT + generated inputs | Nightly |
| Determinism | Same seed+actions → same hash | GUT replay test | Every commit |
| Dungeon fuzz | 10,000 seeds: connectivity, reachability, budget | Headless script | Nightly |
| Echo lifecycle | death→save→load→fight→reclaim→idempotent | GUT + temp dir | Every commit |
| Save corruption | truncate, bit-flip, missing file, stale index | GUT | Nightly |
| Soak | 1,000 deaths, 600 Echoes, 8 h simulated | Headless | Weekly |
| Device | 6 devices, 30 min session, thermal + battery | Manual + Firebase Test Lab | Per milestone |

### 12.2 CI pipeline
```yaml
- node tools/validate-classes.mjs --strict --matrix docs/CLASS_MATRIX.md
- python3 tools/validate-save-schema.py  # Echo example + all schema $defs compile
- godot --headless --import
- godot --headless -s tests/run_tests.gd
- godot --headless -s tests/dungeon_fuzz.gd -- --seeds=2000
- godot --headless --export-release "Android" build/game.aab
- check size < 150 MB
- upload artifact + class matrix diff
```

The class matrix diff is posted on the PR. A rule change that silently steals builds from another class is visible before review.

### 12.3 Definition of done (vertical slice)
- 6 classes, 10 handcrafted floors, 1 boss.
- Death creates an Echo file; a new hero can reclaim it.
- Reclaim grants gear + XP + one of 3 shard skills.
- Save/quit/resume works mid-combat and mid-floor.
- 60 fps on iPhone 11 and Pixel 5; 30 fps on Redmi 9.
- Zero known save-corruption paths in the test suite.
- 5 external players complete death→reclaim without help.

---

## 13. Telemetry

Offline-first, opt-in, batched. Events are anonymous; no PII.

| Event | Fields | Question |
| --- | --- | --- |
| `run_start` | gate, class, level, echo_count | Which builds/gates are popular? |
| `death` | floor, cause, class, level, echo_id, time_since_start | Where does difficulty spike? |
| `echo_spawn` | echo_class, floor, corruption, guards | Are Echoes too common/rare? |
| `echo_attempt` | echo_id, result, turns, damage_taken, resonance | Is the recovery loop fair? |
| `reclaim` | echo_id, attempts, shard_choice, time_to_reclaim | Which shards are auto-picked? |
| `floor_clear` | floor, time, hp_left, auto_battle | Pacing and auto-battle usage |
| `class_created` | class_id, allocation, lane | Matrix health; detect dead classes |
| `shop` / `cosmetic` | sku, price | Monetization (if enabled) |
| `perf` | fps_p1, memory_mb, load_ms, device_tier | Device regressions |

Dashboards: death heatmap by floor, Echo reclaim funnel, class pick/win rate, session length, crash-free rate.

---

## 14. Roadmap

Assumes 1 engineer + 1 artist + part-time composer/QA. A solo developer should multiply by ~1.8.

### Phase 0 — Rules and sandbox (weeks 1–3)
- Lock class lane model and 50 rules (done in this repo).
- Port class engine to GDScript; pass the 3,003-build golden test.
- Build the combat sandbox: 9×9 grid, AP, one enemy, damage pipeline, event log.
- **Exit:** deterministic replay of a 10-turn fight; class test green in CI.

### Phase 1 — Vertical slice (weeks 4–8)
- Echo snapshot/save/load/reclaim.
- Guild Hall, character creation, one 10-floor handcrafted band.
- 6 classes, 12 enemies, 20 items, 1 boss.
- Portrait UI, tap/drag movement, skill wheel.
- **Exit:** 5 external players complete the death→reclaim loop; save/resume mid-combat.

### Phase 2 — Systems (weeks 9–15)
- Procedural generation for floors 11–40; themes and hazards.
- 24 classes, full skill trees, Memory Shards, durability, forge.
- Echo AI, corruption, Wailing overflow, Requiem/Fade.
- Auto-battle + deterministic playback.
- **Exit:** 40 floors playable; 30-minute soak with 50 Echoes; p95 gen < 120 ms.

### Phase 3 — Content and balance (weeks 16–23)
- Floors 41–100, bands 3–5, 6 bosses including the final boss composite.
- 50 classes; balance pass via simulation (10k fights per class pair).
- Art: 5 bands, Echo VFX, UI polish; audio: 5 band layers + Echo motif.
- **Exit:** content lock; 8–12 h first clear in playtest; crash-free > 99%.

### Phase 4 — Beta and ship (weeks 24–28)
- Device matrix, thermal/battery, install size, localization (EN/FR/DE/ES/PT-BR/JP/KR/ZH).
- Store pages, achievements, cloud save, accessibility audit.
- **Exit:** 99.5% crash-free, < 3 s cold start, certification build.

### Scope tiers
| Tier | Classes | Floors | Purpose |
| --- | ---: | ---: | --- |
| Vertical slice | 6 | 10 | Prove the loop |
| Alpha | 24 | 40 | Prove retention |
| Beta | 50 | 80 | Content lock |
| 1.0 | 50 | 100 | Ship |

---

## 15. Technical risks

| Risk | Signal | Mitigation |
| --- | --- | --- |
| **Determinism drift** | Replay hash mismatch after a patch | Versioned combat rules; golden replays; no unordered iteration; fixed RNG streams |
| **Save corruption** | Stale index, truncated JSON | Per-Echo files, atomic rename, `.bak`, checksums, rebuild index by scan |
| **Schema migration debt** | Old Echoes break after balance patches | `balanceVersion` + one-time normalization; fixtures per version |
| **Godot mobile quirks** | Android export/audio/thermal issues | Device tests from week 4; avoid exotic plugins; budget 15% schedule slack |
| **Generation soft-locks** | Unreachable stairs/chest | Validator + 20 retries + handcrafted fallback; fuzz 10k seeds nightly |
| **Echo data growth** | 600 files slow load | Index + lazy load; compact faded into memorial; cap 600 |
| **UI overdraw** | FPS drops in combat | Atlas per band, pooled numbers, no per-frame layout, profile on device |
| **Content cost** | 50 kits × 12 nodes | 4 authored actives per class + generated passives; template review |
| **Balance explosion** | 50×50 matchups | Role-based simulation; ban outliers; tune items first, classes second |
| **Cloud conflicts** | Duplicated/lost loot | Echo union by id; stash dedupe by instanceId; show a conflict report |

---

## 16. Appendices

### A. Class-matrix commands
```bash
node tools/validate-classes.mjs                 # structural + exhaustive test; all 50 kits required
node tools/validate-classes.mjs --strict        # CI alias; same checks, accepted for compatibility
node tools/validate-classes.mjs --matrix docs/CLASS_MATRIX.md
```

### B. Echo file example
See `design/examples/echo.example.json`. Every field is required by `design/save.schema.json`; the file is intentionally small enough to inspect in a bug report.

### C. Status pipeline order
1. Shields absorb.
2. Flat reduction.
3. Percentage reduction.
4. Elemental multiplier.
5. HP subtraction.
6. On-hit triggers (Hex, Bleed application, Echo passives).
7. Death check.

Order is fixed and tested; changing it is a `COMBAT_VERSION` bump.

### D. Balance simulation harness
- Generate up to 200 builds per class from the lane's valid allocations; for rare classes, reuse the available builds with different fight seeds.
- Run 50 fights per build against a floor-appropriate enemy set.
- Report win rate, turns, damage taken, AP efficiency.
- Flag classes outside 35–65% win rate or 2× median turn count.
- Run nightly; a class change requires a before/after report.

### E. Accessibility test checklist
- All status icons readable in protanopia/deuteranopia/tritanopia modes.
- Text at 1.4× does not clip any button or tooltip.
- Screen shake can be fully disabled.
- All gestures have button equivalents.
- No audio-only telegraph.
- Combat undo works after animation completes.

---

**Next build step:** scaffold the Godot 4.4 project with `sim/class_engine.gd`, port `tools/class-engine.mjs`, and wire the golden test. The design is only real when the 3,003-build test passes in the engine that ships.
