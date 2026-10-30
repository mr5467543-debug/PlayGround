import { classById, STAT_IDS } from '../data/classes.js';
import { SKILLS } from '../data/skills.js';
import { makeConsumable, makeGear, uid } from '../data/items.js';
import { SKILL_UNLOCK_LEVELS } from './classifier.js';

export function xpToNext(level) {
  return 18 + level * 12;
}

export function inventoryLimit(hero) {
  const s = effectiveStats(hero);
  return 10 + Math.floor(s.str / 2);
}

export function effectiveStats(hero) {
  const out = {};
  for (const id of STAT_IDS) out[id] = hero.stats[id] || 0;
  for (const slot of ['weapon', 'armor', 'trinket']) {
    const item = hero.equipment?.[slot];
    if (!item || !item.bonus) continue;
    for (const [k, v] of Object.entries(item.bonus)) out[k] = (out[k] || 0) + v;
  }
  return out;
}

export function gearArmor(hero) {
  return (hero.equipment?.armor?.defense || 0) + (hero.equipment?.trinket?.defense || 0);
}

export function recalcHero(hero, { fill = false } = {}) {
  const stats = effectiveStats(hero);
  const level = hero.level || 1;
  const oldMaxHp = hero.maxHp;
  const oldMaxMp = hero.maxMp;
  hero.maxHp = 20 + stats.vit * 4 + level * 3;
  hero.maxMp = 4 + stats.int * 3 + stats.wis;
  if (fill || hero.hp == null) hero.hp = hero.maxHp;
  if (hero.mp == null) hero.mp = hero.maxMp;
  if (fill) hero.mp = hero.maxMp;
  hero.hp = Math.max(1, Math.min(hero.maxHp, hero.hp));
  hero.mp = Math.max(0, Math.min(hero.maxMp, hero.mp));
  hero.apMax = 3 + (stats.dex >= 7 ? 1 : 0) + (stats.wis >= 10 ? 1 : 0);
  hero.attack = hero.equipment?.weapon?.power || 3;
  hero.armor = Math.round(stats.vit * 1.25 + gearArmor(hero));
  hero.resist = Math.round(stats.wis * 1.1 + stats.int * 0.35);
  hero.crit = Math.min(70, Math.round(5 + stats.luk * 2.4 + (hero.equipment?.weapon?.crit || 0)));
  hero.dodge = Math.min(45, Math.round(stats.dex * 1.05 + stats.luk * 0.55));
  hero.accuracy = 72 + stats.dex * 2.1 + stats.luk * 0.5;
  hero.carry = inventoryLimit(hero);
  hero.effStats = stats;
  if (oldMaxHp && !fill && hero.maxHp > oldMaxHp) {
    hero.hp = Math.min(hero.maxHp, hero.hp + (hero.maxHp - oldMaxHp));
  }
  if (oldMaxMp && !fill && hero.maxMp > oldMaxMp) {
    hero.mp = Math.min(hero.maxMp, hero.mp + (hero.maxMp - oldMaxMp));
  }
  return hero;
}

const STARTER = {
  bruiser: ['Longsword', '⚔', 'str'],
  tank: ['Iron Mace', '⚒', 'vit'],
  caster: ['Apprentice Staff', '✶', 'int'],
  healer: ['Brass Censer', '☩', 'wis'],
  rogue: ['Bone Dagger', '🗡', 'dex'],
  hybrid: ['Initiate Blade', '⚔', 'dex'],
};

export function createHero({ name, stats, classId, meta }) {
  const cls = classById(classId);
  const role = cls.role;
  const [wName, wGlyph, wStat] = STARTER[role] || STARTER.hybrid;
  const weapon = {
    kind: 'gear', slot: 'weapon', base: 'starter', rarity: 'common',
    name: `Initiate ${wName}`, glyph: wGlyph, power: 4, crit: 0, mpBonus: 0,
    bonus: { [wStat]: 1 }, durability: 34, maxDurability: 34, value: 4,
    desc: 'A guild-issue weapon. It has seen better centuries.', floor: 0,
  };
  const armor = {
    kind: 'gear', slot: 'armor', base: 'starter', rarity: 'common',
    name: 'Guild-Issue Leathers', glyph: '⛨', defense: 3,
    bonus: { vit: 1 }, durability: 30, maxDurability: 30, value: 4,
    desc: 'Stiff, patched, and faintly damp.', floor: 0,
  };

  const hero = {
    id: uid('h'),
    name,
    classId: cls.id,
    className: cls.name,
    role: cls.role,
    stats: { ...stats },
    level: 1,
    xp: 0,
    hp: 1,
    mp: 0,
    gold: 10,
    inventory: [makeConsumable(1, 'draught'), makeConsumable(1, 'draught'), makeConsumable(1, 'ration')],
    equipment: { weapon, armor, trinket: null },
    learned: [],
    floor: 1,
    deepest: 1,
    explored: {},
    cooldowns: {},
    statuses: [],
    kills: 0,
    floorsCleared: 0,
    createdAt: Date.now(),
    runs: (meta?.runs || 0) + 1,
  };
  recalcHero(hero, { fill: true });
  return hero;
}

export function classSkillsFor(hero) {
  const cls = classById(hero.classId);
  return cls.skills.map((id, i) => ({
    id,
    level: SKILL_UNLOCK_LEVELS[i],
    unlocked: hero.level >= SKILL_UNLOCK_LEVELS[i],
  }));
}

export function knownSkills(hero) {
  const out = [];
  for (const entry of classSkillsFor(hero)) {
    if (entry.unlocked) out.push({ id: entry.id, source: 'class', level: entry.level });
  }
  for (const id of hero.learned || []) {
    if (!SKILLS[id]) continue;
    if (out.some(s => s.id === id)) continue;
    out.push({ id, source: 'memory', level: 1 });
  }
  return out;
}

export function learnSkill(hero, id) {
  if (!SKILLS[id]) return false;
  if (knownSkills(hero).some(s => s.id === id)) return false;
  hero.learned.push(id);
  return true;
}

export function addXp(hero, amount) {
  const result = { levels: 0, skills: [], xp: amount };
  hero.xp += amount;
  while (hero.xp >= xpToNext(hero.level) && hero.level < 99) {
    hero.xp -= xpToNext(hero.level);
    hero.level++;
    result.levels++;
    const before = new Set(knownSkills(hero).map(s => s.id));
    recalcHero(hero);
    hero.hp = Math.min(hero.maxHp, hero.hp + Math.round(hero.maxHp * 0.25));
    hero.mp = Math.min(hero.maxMp, hero.mp + Math.round(hero.maxMp * 0.25));
    for (const s of knownSkills(hero)) {
      if (!before.has(s.id)) result.skills.push(s.id);
    }
  }
  return result;
}

export function carryUsed(hero) {
  return hero.inventory.reduce((n, item) => n + (item.count || 1), 0);
}

export function addItem(hero, item, { overflowToStash = null } = {}) {
  if (!item) return true;
  if (item.kind === 'consumable') {
    const existing = hero.inventory.find(i => i.kind === 'consumable' && i.base === item.base);
    if (existing) {
      existing.count = (existing.count || 1) + (item.count || 1);
      return true;
    }
  }
  if (carryUsed(hero) >= hero.carry) {
    if (overflowToStash) {
      overflowToStash.push(item);
      return false;
    }
    return false;
  }
  hero.inventory.push(item);
  if (item.kind === 'gear') recalcHero(hero);
  return true;
}

export function removeItem(hero, item, count = 1) {
  const idx = hero.inventory.findIndex(i => i.uid === item.uid);
  if (idx < 0) return false;
  const found = hero.inventory[idx];
  if ((found.count || 1) > count) {
    found.count -= count;
  } else {
    hero.inventory.splice(idx, 1);
  }
  if (found.kind === 'gear') recalcHero(hero);
  return true;
}

export function equipItem(hero, item) {
  if (!item || item.kind !== 'gear') return false;
  const slot = item.slot;
  const current = hero.equipment[slot];
  const idx = hero.inventory.findIndex(i => i.uid === item.uid);
  if (idx < 0) return false;
  hero.inventory.splice(idx, 1);
  hero.equipment[slot] = item;
  if (current) hero.inventory.push(current);
  recalcHero(hero);
  return true;
}

export function unequipItem(hero, slot) {
  const item = hero.equipment[slot];
  if (!item) return false;
  if (carryUsed(hero) >= hero.carry) return false;
  hero.equipment[slot] = null;
  hero.inventory.push(item);
  recalcHero(hero);
  return true;
}

export function startWeaponName(hero) {
  return hero.equipment?.weapon?.name || 'Bare Hands';
}

export function makeEchoRecord(hero, floor, cause = 'slain in the dark') {
  const skills = knownSkills(hero).map(s => s.id);
  return {
    id: uid('echo'),
    floor,
    name: hero.name,
    classId: hero.classId,
    className: hero.className,
    role: hero.role,
    level: hero.level,
    stats: { ...hero.stats },
    skills,
    equipment: JSON.parse(JSON.stringify(hero.equipment || {})),
    inventory: JSON.parse(JSON.stringify(hero.inventory || [])),
    gold: hero.gold || 0,
    xp: hero.xp || 0,
    maxHp: hero.maxHp,
    attack: hero.attack,
    armor: hero.armor,
    resist: hero.resist,
    crit: hero.crit,
    dodge: hero.dodge,
    deathFloor: floor,
    cause,
    createdAt: Date.now(),
    reclaimed: false,
  };
}

export function echoCombatStats(echo) {
  const stats = echo.stats || {};
  const gearStats = {};
  for (const slot of ['weapon', 'armor', 'trinket']) {
    const item = echo.equipment?.[slot];
    for (const [k, v] of Object.entries(item?.bonus || {})) gearStats[k] = (gearStats[k] || 0) + v;
  }
  const total = {};
  for (const id of STAT_IDS) total[id] = (stats[id] || 0) + (gearStats[id] || 0);
  const weapon = echo.equipment?.weapon;
  const armor = echo.equipment?.armor;
  return {
    maxHp: Math.max(40, echo.maxHp || (20 + total.vit * 4 + echo.level * 3)),
    attack: Math.max(5, echo.attack || (weapon?.power || 4)),
    armor: Math.max(2, echo.armor || (total.vit * 1.25 + (armor?.defense || 0))),
    resist: Math.max(0, echo.resist || (total.wis * 1.1 + total.int * 0.35)),
    crit: Math.max(5, echo.crit || (5 + total.luk * 2.4)),
    dodge: Math.max(0, echo.dodge || (total.dex * 1.05 + total.luk * 0.55)),
    stats: total,
    weapon,
    armorPiece: armor,
  };
}

export function heroClass(hero) {
  return classById(hero.classId);
}
