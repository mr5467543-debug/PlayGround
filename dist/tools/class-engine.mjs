/**
 * Echoes of the 100th Floor - Class Engine (reference implementation)
 *
 * This file is the executable specification for the "Stat-Lock" class
 * derivation system. The Godot port must reproduce `classify()` exactly;
 * `tools/validate-classes.mjs` is the golden test.
 *
 * Rule DSL
 * --------
 * A class rule is:
 *   {
 *     "lane": "STR+DEX",                            // optional; omitted = global
 *     "if": [["STR", ">=", 7], ["INT", "<=", 3]],   // every clause must hold
 *     "multiset": [2, 2, 2, 2, 1, 1]                // optional: exact sorted shape
 *   }
 *
 * Operators: ">=", "<=", "==", ">", "<"
 * Stats: STR, DEX, INT, VIT, WIS, LUK
 *
 * Lane model
 * ----------
 * Every allocation has a lane derived from its two highest stats:
 *   - PURE_<STAT>  when the top stat is >= 6 and the second is <= 2
 *   - <A>+<B>      otherwise (pair canonicalised by STATS order)
 * Global classes (secret callings) are checked first, by priority.
 * Then only the allocation's lane is considered; the first matching class wins.
 * Every lane ends in an unconditional catch-all, so classification is total:
 * every legal allocation returns exactly one class.
 */

export const STATS = Object.freeze(["STR", "DEX", "INT", "VIT", "WIS", "LUK"]);
export const TOTAL_POINTS = 10;
export const STAT_MAX = 10;

const OPS = {
  ">=": (a, b) => a >= b,
  "<=": (a, b) => a <= b,
  "==": (a, b) => a === b,
  ">": (a, b) => a > b,
  "<": (a, b) => a < b,
};

export function emptyAllocation() {
  return Object.fromEntries(STATS.map((s) => [s, 0]));
}

export function validateAllocation(allocation) {
  const errors = [];
  let sum = 0;
  for (const stat of STATS) {
    const value = allocation[stat];
    if (!Number.isInteger(value)) errors.push(`${stat} must be an integer`);
    else if (value < 0 || value > STAT_MAX) errors.push(`${stat} out of range: ${value}`);
    else sum += value;
  }
  if (sum !== TOTAL_POINTS) errors.push(`allocation must sum to ${TOTAL_POINTS}, got ${sum}`);
  return { valid: errors.length === 0, errors, sum };
}

function sortedShape(allocation) {
  return STATS.map((s) => allocation[s])
    .slice()
    .sort((a, b) => b - a);
}

export function matchesRule(rule, allocation) {
  if (!rule) return false;
  if (rule.multiset) {
    const shape = sortedShape(allocation);
    if (shape.length !== rule.multiset.length) return false;
    if (shape.some((v, i) => v !== rule.multiset[i])) return false;
  }
  if (!rule.if || rule.if.length === 0) return true;
  return rule.if.every((clause) => {
    if (!Array.isArray(clause) || clause.length !== 3) {
      throw new Error(`Malformed rule clause: ${JSON.stringify(clause)}`);
    }
    const [stat, op, raw] = clause;
    if (!STATS.includes(stat)) throw new Error(`Unknown stat in rule: ${stat}`);
    const compare = OPS[op];
    if (!compare) throw new Error(`Unknown operator in rule: ${op}`);
    let target = raw;
    if (typeof raw === "string") {
      if (!STATS.includes(raw)) throw new Error(`Unknown stat on right side: ${raw}`);
      target = allocation[raw];
    }
    return compare(allocation[stat], target);
  });
}

/** Stable ordering: priority desc, then id asc. */
export function sortClasses(classes) {
  return classes
    .slice()
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

/**
 * Determine an allocation's lane from its two highest stats.
 * Ties are broken by canonical STATS order (STR > DEX > INT > VIT > WIS > LUK).
 */
export function deriveLane(allocation) {
  const ranked = STATS.map((stat) => ({ stat, value: allocation[stat] })).sort(
    (a, b) => b.value - a.value || STATS.indexOf(a.stat) - STATS.indexOf(b.stat),
  );
  const [first, second] = ranked;
  if (first.value >= 6 && second.value <= 2) return `PURE_${first.stat}`;
  const pair = [first.stat, second.stat].sort((a, b) => STATS.indexOf(a) - STATS.indexOf(b));
  return `${pair[0]}+${pair[1]}`;
}

export function isCatchAll(cls) {
  return !cls.requires?.multiset && (!cls.requires?.if || cls.requires.if.length === 0);
}

export function classify(classes, allocation) {
  const { valid } = validateAllocation(allocation);
  if (!valid) throw new Error(`Illegal allocation: ${JSON.stringify(allocation)}`);
  const ordered = sortClasses(classes);
  for (const cls of ordered) {
    if (cls.lane) continue; // globals only
    if (matchesRule(cls.requires, allocation)) return cls;
  }
  const lane = deriveLane(allocation);
  for (const cls of ordered) {
    if (cls.lane !== lane) continue;
    if (matchesRule(cls.requires, allocation)) return cls;
  }
  return null;
}

/** All compositions of `total` into 6 bounded parts, canonical stat order. */
export function* enumerateAllocations(total = TOTAL_POINTS) {
  const alloc = emptyAllocation();
  function* walk(index, remaining) {
    if (index === STATS.length - 1) {
      if (remaining <= STAT_MAX) {
        alloc[STATS[index]] = remaining;
        yield { ...alloc };
      }
      return;
    }
    for (let value = 0; value <= Math.min(remaining, STAT_MAX); value++) {
      alloc[STATS[index]] = value;
      yield* walk(index + 1, remaining - value);
    }
  }
  yield* walk(0, total);
}

export function formatAllocation(allocation) {
  return STATS.map((s) => `${s}:${allocation[s]}`).join(" ");
}

export function loadClasses(json) {
  const classes = Array.isArray(json) ? json : json.classes;
  if (!Array.isArray(classes)) throw new Error("classes.json must contain a classes array");
  return sortClasses(classes);
}
