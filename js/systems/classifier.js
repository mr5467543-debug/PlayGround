import { CLASSES, STAT_IDS } from '../data/classes.js';

export const SKILL_UNLOCK_LEVELS = [1, 3, 6];

export function emptyStats() {
  return Object.fromEntries(STAT_IDS.map(id => [id, 0]));
}

export function statsTotal(stats) {
  return STAT_IDS.reduce((sum, id) => sum + (stats[id] || 0), 0);
}

function squaredDistance(stats, sig) {
  let total = 0;
  for (let i = 0; i < STAT_IDS.length; i++) {
    const d = (stats[STAT_IDS[i]] || 0) - sig[i];
    total += d * d;
  }
  return total;
}

function satisfiesRule(stats, rule) {
  if (!rule || rule.length < 2) return false;
  for (let i = 0; i < rule.length - 1; i++) {
    if ((stats[rule[i]] || 0) <= (stats[rule[i + 1]] || 0)) return false;
  }
  return true;
}

export function resonanceFor(distance) {
  return Math.max(35, Math.min(100, Math.round(100 - Math.sqrt(distance) * 10)));
}

export function deriveClass(stats) {
  const total = statsTotal(stats);
  const exact = CLASSES.find(c => c.sig.every((v, i) => v === (stats[STAT_IDS[i]] || 0)));
  if (exact) {
    return { cls: exact, distance: 0, resonance: 100, exact: true, total };
  }

  let best = CLASSES[0];
  let bestScore = Infinity;
  let bestDistance = Infinity;
  for (const cls of CLASSES) {
    const distance = squaredDistance(stats, cls.sig);
    const ruleBonus = satisfiesRule(stats, cls.rule) ? 1.75 : 0;
    const score = distance - ruleBonus;
    if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) < 1e-9 && distance < bestDistance)) {
      best = cls;
      bestScore = score;
      bestDistance = distance;
    }
  }
  return {
    cls: best,
    distance: bestDistance,
    resonance: resonanceFor(bestDistance),
    exact: false,
    total,
  };
}

export function unlockedClassSkills(cls, level) {
  return cls.skills.map((id, i) => ({ id, level: SKILL_UNLOCK_LEVELS[i], unlocked: level >= SKILL_UNLOCK_LEVELS[i] }));
}

export function predictSkills(cls, level) {
  return cls.skills.filter((_, i) => level >= SKILL_UNLOCK_LEVELS[i]);
}

export function topStats(stats, count = 2) {
  return [...STAT_IDS].sort((a, b) => (stats[b] || 0) - (stats[a] || 0)).slice(0, count);
}
