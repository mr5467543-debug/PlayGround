#!/usr/bin/env node
/**
 * Validates the 50-class Stat-Lock matrix.
 *
 * Checks:
 *  1. Structural integrity (50 classes, archetype quotas, unique ids/priorities).
 *  2. Rules are well formed and every class is reachable.
 *  3. Every one of the 3003 legal 10-point allocations resolves to exactly one class.
 *  4. Golden cases from the design brief classify as intended.
 *  5. Every class has 3 skills + a capstone. --strict is accepted as a CI alias.
 *
 * Usage:
 *   node tools/validate-classes.mjs
 *   node tools/validate-classes.mjs --strict
 *   node tools/validate-classes.mjs --matrix docs/CLASS_MATRIX.md
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  STATS,
  TOTAL_POINTS,
  classify,
  deriveLane,
  enumerateAllocations,
  formatAllocation,
  isCatchAll,
  loadClasses,
  matchesRule,
  validateAllocation,
} from "./class-engine.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const classesPath = path.join(root, "design", "classes.json");
const skillsPath = path.join(root, "design", "skills.json");

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const matrixIndex = args.indexOf("--matrix");
const matrixPath = matrixIndex >= 0 ? path.resolve(process.cwd(), args[matrixIndex + 1]) : null;

const errors = [];
const warnings = [];

const raw = JSON.parse(await readFile(classesPath, "utf8"));
const skillTrees = JSON.parse(await readFile(skillsPath, "utf8"));
const classes = loadClasses(raw);

// ---------- 1. Structure ----------
if (classes.length !== 50) errors.push(`Expected 50 classes, found ${classes.length}`);

const quotas = { pure: 10, hybrid: 20, tank: 10, secret: 10 };
for (const [archetype, expected] of Object.entries(quotas)) {
  const actual = classes.filter((c) => c.archetype === archetype).length;
  if (actual !== expected) errors.push(`Archetype ${archetype}: expected ${expected}, found ${actual}`);
}

const ids = new Set();
const names = new Set();
const priorities = new Set();
const lanes = new Set();
for (const cls of classes) {
  if (ids.has(cls.id)) errors.push(`Duplicate id: ${cls.id}`);
  ids.add(cls.id);
  if (names.has(cls.name)) errors.push(`Duplicate name: ${cls.name}`);
  names.add(cls.name);
  if (priorities.has(cls.priority)) errors.push(`Duplicate priority ${cls.priority} (${cls.id})`);
  priorities.add(cls.priority);
  if (!cls.role) warnings.push(`${cls.id}: missing role`);
  if (!cls.passive) warnings.push(`${cls.id}: missing passive`);
  if (cls.lane) lanes.add(cls.lane);

  const tree = skillTrees[cls.id];
  if (!tree) {
    errors.push(`${cls.id}: missing entry in design/skills.json`);
  } else {
    cls.skills = tree.skills;
    cls.capstone = tree.capstone;
    if (!Array.isArray(tree.skills) || tree.skills.length !== 3) {
      errors.push(`${cls.id}: expected 3 active skills, found ${tree.skills?.length ?? 0}`);
    }
    if (!tree.capstone?.name) errors.push(`${cls.id}: missing capstone`);
    const levels = (tree.skills ?? []).map((s) => s.lvl);
    if (levels.some((lvl, i) => i > 0 && lvl <= levels[i - 1])) {
      errors.push(`${cls.id}: skill levels must be strictly increasing (${levels.join(", ")})`);
    }
    for (const skill of [...(tree.skills ?? []), tree.capstone].filter(Boolean)) {
      if (!skill.name || !skill.effect) errors.push(`${cls.id}: skill missing name/effect`);
      if (!Number.isInteger(skill.ap) || skill.ap < 0) errors.push(`${cls.id}/${skill.name}: invalid AP cost`);
      if (!Number.isInteger(skill.mp) || skill.mp < 0) errors.push(`${cls.id}/${skill.name}: invalid MP cost`);
    }
  }
  if (strict && !cls.capstone) errors.push(`${cls.id}: strict mode requires a capstone`);

  try {
    matchesRule(cls.requires, Object.fromEntries(STATS.map((s) => [s, 0])));
  } catch (error) {
    errors.push(`${cls.id}: malformed rule (${error.message})`);
  }
}

for (const id of Object.keys(skillTrees)) {
  if (!ids.has(id)) errors.push(`design/skills.json contains unknown class id: ${id}`);
}

// Every lane must be represented and end in exactly one catch-all.
const expectedLanes = [
  ...STATS.map((s) => `PURE_${s}`),
  ...STATS.flatMap((a, i) => STATS.slice(i + 1).map((b) => `${a}+${b}`)),
];
for (const lane of expectedLanes) {
  if (!lanes.has(lane)) errors.push(`Lane has no class: ${lane}`);
}
for (const lane of lanes) {
  if (!expectedLanes.includes(lane)) errors.push(`Unknown lane: ${lane}`);
  const local = classes.filter((c) => c.lane === lane);
  const catchAlls = local.filter(isCatchAll);
  if (catchAlls.length !== 1) {
    errors.push(`Lane ${lane} must have exactly one catch-all, found ${catchAlls.length}`);
  } else {
    const lowest = local.slice().sort((a, b) => a.priority - b.priority)[0];
    if (lowest.id !== catchAlls[0].id) {
      errors.push(`Lane ${lane}: catch-all ${catchAlls[0].id} is not the lowest-priority class (${lowest.id})`);
    }
  }
}
for (const cls of classes) {
  if (!cls.lane && cls.archetype !== "secret") {
    errors.push(`${cls.id}: only secret classes may be global (missing lane)`);
  }
}

// ---------- 2/3. Exhaustive coverage ----------
const counts = new Map(classes.map((c) => [c.id, 0]));
const laneCounts = new Map();
let total = 0;

for (const allocation of enumerateAllocations(TOTAL_POINTS)) {
  const check = validateAllocation(allocation);
  if (!check.valid) {
    errors.push(`Generator produced illegal allocation ${formatAllocation(allocation)}`);
    continue;
  }
  total++;
  const cls = classify(classes, allocation);
  if (!cls) {
    errors.push(`Unmatched allocation: ${formatAllocation(allocation)}`);
    continue;
  }
  counts.set(cls.id, counts.get(cls.id) + 1);
  const lane = deriveLane(allocation);
  laneCounts.set(lane, (laneCounts.get(lane) ?? 0) + 1);
}

const expectedTotal = 3003; // C(10+6-1, 6-1)
if (total !== expectedTotal) errors.push(`Expected ${expectedTotal} allocations, enumerated ${total}`);

for (const cls of classes) {
  if (counts.get(cls.id) === 0) errors.push(`Unreachable class: ${cls.name} (${cls.id})`);
}

// ---------- 4. Golden cases ----------
const golden = [
  { alloc: { STR: 5, VIT: 5 }, expect: "bruiser", label: "5 STR / 5 VIT" },
  { alloc: { INT: 6, DEX: 4 }, expect: "spellblade", label: "6 INT / 4 DEX" },
  { alloc: { LUK: 7, DEX: 3 }, expect: "gambler", label: "7 LUK / 3 DEX" },
  { alloc: { STR: 8, VIT: 2 }, expect: "berserker", label: "8 STR / 2 VIT" },
  { alloc: { STR: 5, INT: 3, WIS: 2 }, expect: "paladin", label: "5 STR / 3 INT / 2 WIS" },
  { alloc: { STR: 4, DEX: 6 }, expect: "buccaneer", label: "4 STR / 6 DEX" },
  { alloc: { INT: 8, VIT: 2 }, expect: "glass_cannon", label: "8 INT / 2 VIT" },
  { alloc: { LUK: 10 }, expect: "singularity", label: "10 LUK" },
  { alloc: { LUK: 9, INT: 1 }, expect: "fool", label: "9 LUK / 1 INT" },
];

const goldenResults = golden.map(({ alloc, expect, label }) => {
  const full = Object.fromEntries(STATS.map((s) => [s, alloc[s] ?? 0]));
  const cls = classify(classes, full);
  const pass = cls?.id === expect;
  if (!pass) errors.push(`Golden case failed: ${label} -> ${cls?.id ?? "none"} (expected ${expect})`);
  return { label, expected: expect, actual: cls?.id ?? "none", pass };
});

// ---------- Report ----------
const sortedByCount = classes
  .map((c) => ({ id: c.id, name: c.name, archetype: c.archetype, priority: c.priority, count: counts.get(c.id) }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

console.log(`Classes: ${classes.length} | Builds: ${total} | Lanes: ${laneCounts.size}/21`);
console.log("\nBuild-space distribution (top 12):");
for (const row of sortedByCount.slice(0, 12)) {
  console.log(`  ${String(row.count).padStart(4)}  ${(100 * row.count / total).toFixed(1).padStart(5)}%  ${row.name} [${row.archetype}]`);
}
console.log("\nRarest 8 classes:");
for (const row of sortedByCount.slice(-8).reverse()) {
  console.log(`  ${String(row.count).padStart(4)}  ${(100 * row.count / total).toFixed(1).padStart(5)}%  ${row.name}`);
}

console.log("\nGolden cases:");
for (const r of goldenResults) {
  console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.label.padEnd(24)} -> ${r.actual}`);
}

if (matrixPath) {
  const archetypeLabels = { pure: "Pure", hybrid: "Hybrid", tank: "Tank", secret: "Specialized / Secret" };
  const lines = [
    "# The 50-Class Matrix",
    "",
    "> Generated from `design/classes.json` by `tools/validate-classes.mjs --matrix`.",
    "> **Do not edit by hand.** Edit the JSON, then regenerate.",
    "",
    `Every legal distribution of ${TOTAL_POINTS} points across the six stats (${total} builds) maps to exactly one class.`,
    "Secret callings are checked globally first. Otherwise the two highest stats select a lane",
    "(`PURE_<STAT>` when the top stat is 6+ and the second is 2 or less, else the canonical pair).",
    "Within a lane, classes are checked by descending priority; the last class in each lane is the lane default.",
    "",
  ];
  for (const archetype of ["pure", "hybrid", "tank", "secret"]) {
    const group = classes.filter((c) => c.archetype === archetype).sort((a, b) => b.priority - a.priority);
    lines.push(`## ${archetypeLabels[archetype]} (${group.length})`, "");
    lines.push("| Class | Lane | Requirement | Signature skill | Builds |");
    lines.push("| --- | --- | --- | --- | ---: |");
    for (const c of group) {
      const req = describeRequirement(c.requires);
      const signature = c.skills?.[0]?.name ?? "—";
      lines.push(`| **${c.name}** | ${c.lane ?? "Global"} | ${req} | ${signature} | ${counts.get(c.id)} |`);
    }
    lines.push("");
  }
  lines.push("## Lane coverage", "");
  lines.push("| Lane | Builds | Class(es) |");
  lines.push("| --- | ---: | --- |");
  for (const lane of [...laneCounts.keys()].sort()) {
    const members = classes.filter((c) => c.lane === lane).map((c) => c.name).join(", ");
    lines.push(`| ${lane} | ${laneCounts.get(lane)} | ${members} |`);
  }
  lines.push("");
  await mkdir(path.dirname(matrixPath), { recursive: true });
  await writeFile(matrixPath, lines.join("\n"), "utf8");
  console.log(`\nWrote ${path.relative(process.cwd(), matrixPath)}`);
}

if (warnings.length) {
  console.log("\nWarnings:");
  for (const warning of warnings) console.log(`  ! ${warning}`);
}

if (errors.length) {
  console.error("\nErrors:");
  for (const error of errors) console.error(`  x ${error}`);
  process.exit(1);
}

console.log("\nAll checks passed.");

function describeRequirement(requires) {
  if (!requires || (!requires.if?.length && !requires.multiset)) return "— (lane default)";
  const parts = [];
  if (requires.multiset) parts.push(`shape ${requires.multiset.join("/")}`);
  for (const [stat, op, value] of requires.if ?? []) {
    parts.push(`${stat} ${op} ${value}`);
  }
  return parts.join(", ");
}
