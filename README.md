# Echoes of the 100th Floor

A design-first package for a hardcore turn-based tactical RPG roguelike on mobile.
Death is permanent; the dungeon is not. Every dead hero becomes an **Echo** — an
AI-controlled corpse on the floor where it fell, holding its gear, stats, and
skills until a new hero fights back down and reclaims them.

## What is in this repo

| Path | Contents |
| --- | --- |
| [`docs/GDD.md`](docs/GDD.md) | Game design document: Echo loop, hub, 100 floors, combat, UX, art, audio, balance, risks |
| [`docs/TECH_PLAN.md`](docs/TECH_PLAN.md) | Engine choice, deterministic simulation architecture, generation, persistence, mobile budgets, CI, roadmap |
| [`docs/CLASS_MATRIX.md`](docs/CLASS_MATRIX.md) | Generated 50-class matrix with lane coverage and build-space counts |
| [`design/classes.json`](design/classes.json) | Source of truth for the Stat-Lock class rules |
| [`design/skills.json`](design/skills.json) | 50 class kits (3 actives + capstone each) |
| [`design/save.schema.json`](design/save.schema.json) | JSON Schema for the save envelope and per-Echo files |
| [`design/examples/echo.example.json`](design/examples/echo.example.json) | A complete, schema-valid Echo |
| [`tools/class-engine.mjs`](tools/class-engine.mjs) | Executable spec for class derivation |
| [`tools/validate-classes.mjs`](tools/validate-classes.mjs) | Exhaustive test: all 3,003 legal builds, golden cases, matrix generator |
| [`tools/validate-save-schema.py`](tools/validate-save-schema.py) | Validates the example Echo against the schema |

## The class system, in one paragraph

The player allocates 10 points across STR, DEX, INT, VIT, WIS, LUK. Ten secret
callings are checked first. Otherwise the two highest stats select a **lane**
(`PURE_STR`, `STR+VIT`, `DEX+INT`, …); thresholds inside the lane select one of
the 50 classes. Every lane ends in a catch-all, so **every one of the 3,003 legal
builds resolves to exactly one class** — no "classless" builds, no overlaps.

Named cases from the brief are enforced as golden tests: 5 STR/5 VIT → Bruiser,
6 INT/4 DEX → Spellblade, 7 LUK/3 DEX → Gambler, 8 STR/2 VIT → Berserker,
5 STR/3 INT/2 WIS → Paladin.

## Verify it

```bash
node tools/validate-classes.mjs --strict
node tools/validate-classes.mjs --strict --matrix docs/CLASS_MATRIX.md
python3 tools/validate-save-schema.py
```

Expected: `Classes: 50 | Builds: 3003 | Lanes: 21/21`, every class reachable,
all golden cases pass, and the Echo example validates.

## Status

Design and rules are complete. The Godot 4.4 project is the next deliverable:
port `tools/class-engine.mjs` to `sim/class_engine.gd`, wire the golden test,
then build the combat sandbox and the death → reclaim vertical slice.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/mr5467543-debug/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/mr5467543-debug/PlayGround)

- 🎮 [Open the project](https://omgithub.com/mr5467543-debug/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=mr5467543-debug%2FPlayGround).
- 💻 [Explore the source](https://github.com/mr5467543-debug/PlayGround).
- 🛠️ [Check build runs](https://github.com/mr5467543-debug/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/mr5467543-debug/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/mr5467543-debug).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->
