export const THEMES = {
  threshold: { id: 'threshold', name: 'The Threshold', label: 'Floors 1–10', accent: '#c9a86a', fog: '#0b080d', blurb: 'Rotting entry halls. The dungeon is still deciding what you are.' },
  warrens:   { id: 'warrens', name: 'The Warrens', label: 'Floors 11–30', accent: '#8fa96a', fog: '#080b08', blurb: 'Elemental seepage and old traps. Something here has been breeding.' },
  depths:    { id: 'depths', name: 'The Depths', label: 'Floors 31–60', accent: '#6d97b8', fog: '#070a0d', blurb: 'Elite hunting grounds. The stone remembers every death.' },
  abyss:     { id: 'abyss', name: 'The Abyss', label: 'Floors 61–90', accent: '#a06fc4', fog: '#0a070e', blurb: 'Reality frays. Echoes are louder than the living.' },
  zenith:    { id: 'zenith', name: 'The Zenith', label: 'Floors 91–100', accent: '#e7cf98', fog: '#0d0a10', blurb: 'The top of the world, buried under a hundred floors of regret.' },
};

export function themeForFloor(floor) {
  if (floor <= 10) return THEMES.threshold;
  if (floor <= 30) return THEMES.warrens;
  if (floor <= 60) return THEMES.depths;
  if (floor <= 90) return THEMES.abyss;
  return THEMES.zenith;
}

export const ENEMY_TEMPLATES = {
  rat:     { name: 'Gutter Rat', glyph: 'r', sprite: 'rat', color: '#8b7458', role: 'melee', hp: 0.75, atk: 0.8, armor: 0.5, xp: 0.8, gold: 0.7, skills: [], aggro: 4 },
  slime:   { name: 'Rot Slime', glyph: 's', sprite: 'slime', color: '#6f8b57', role: 'melee', hp: 1.15, atk: 0.85, armor: 0.7, xp: 1, gold: 0.8, skills: ['poison_blade'], aggro: 3 },
  skeleton:{ name: 'Bone Conscript', glyph: 'k', sprite: 'skeleton', color: '#b6ab93', role: 'melee', hp: 1, atk: 1, armor: 1.1, xp: 1.1, gold: 1, skills: ['sunder'], aggro: 5 },
  cultist: { name: 'Ash Cultist', glyph: 'c', sprite: 'cultist', color: '#a06fc4', role: 'caster', hp: 0.85, atk: 1.05, armor: 0.6, xp: 1.2, gold: 1.2, skills: ['firebolt', 'curse'], aggro: 6, range: 4 },
  hound:   { name: 'Warrens Hound', glyph: 'h', sprite: 'hound', color: '#a9744c', role: 'melee', hp: 0.95, atk: 1.2, armor: 0.7, xp: 1.2, gold: 1, skills: ['lunge', 'rend'], aggro: 6 },
  wraith:  { name: 'Wailing Wraith', glyph: 'w', sprite: 'wraith', color: '#8fa9d8', role: 'caster', hp: 0.9, atk: 1.15, armor: 0.5, xp: 1.4, gold: 1.2, skills: ['shadow_bolt', 'drain_life'], aggro: 6, range: 4, incorporeal: true },
  golem:   { name: 'Depth Golem', glyph: 'g', sprite: 'golem', color: '#7f8894', role: 'melee', hp: 1.8, atk: 1.15, armor: 1.8, xp: 1.8, gold: 1.6, skills: ['power_strike', 'shield_bash'], aggro: 5 },
  imp:     { name: 'Cinder Imp', glyph: 'i', sprite: 'imp', color: '#d07850', role: 'caster', hp: 0.8, atk: 1.1, armor: 0.6, xp: 1.3, gold: 1.1, skills: ['firebolt', 'smoke_bomb'], aggro: 6, range: 4 },
  knight:  { name: 'Fallen Knight', glyph: 'K', sprite: 'knight', color: '#9d8f74', role: 'melee', hp: 1.5, atk: 1.25, armor: 1.6, xp: 1.7, gold: 1.8, skills: ['cleave', 'shield_bash'], aggro: 5 },
  eye:     { name: 'Void Eye', glyph: 'e', sprite: 'eye', color: '#b07ad6', role: 'caster', hp: 1.1, atk: 1.3, armor: 0.8, xp: 1.9, gold: 1.7, skills: ['void_bolt', 'hex'], aggro: 7, range: 5 },
  warden:  { name: 'The Hundredth Warden', glyph: 'W', sprite: 'boss', color: '#e7cf98', role: 'boss', hp: 8.5, atk: 1.5, armor: 2.2, xp: 12, gold: 10, skills: ['meteor', 'soul_lance', 'cleave', 'ward'], aggro: 9, range: 5, boss: true },
  mother:  { name: 'The Warren Mother', glyph: 'M', sprite: 'boss', color: '#8fa96a', role: 'boss', hp: 3.4, atk: 1.25, armor: 1.4, xp: 6, gold: 5, skills: ['poison_blade', 'rend', 'hex'], aggro: 8, range: 3, boss: true },
  colossus:{ name: 'The Depth Colossus', glyph: 'C', sprite: 'boss', color: '#6d97b8', role: 'boss', hp: 4.8, atk: 1.35, armor: 2.0, xp: 8, gold: 7, skills: ['power_strike', 'whirlwind', 'shield_bash'], aggro: 8, boss: true },
  regent:  { name: 'The Abyss Regent', glyph: 'R', sprite: 'boss', color: '#a06fc4', role: 'boss', hp: 6.2, atk: 1.45, armor: 1.8, xp: 10, gold: 9, skills: ['void_bolt', 'meteor', 'hex', 'time_slip'], aggro: 9, range: 5, boss: true },
};

export const THEME_POOLS = {
  threshold: ['rat', 'slime', 'skeleton'],
  warrens:   ['rat', 'slime', 'hound', 'skeleton', 'cultist'],
  depths:    ['skeleton', 'hound', 'knight', 'golem', 'cultist'],
  abyss:     ['wraith', 'imp', 'eye', 'knight', 'golem'],
  zenith:    ['knight', 'wraith', 'eye', 'golem', 'imp'],
};

const FLOOR_BOSS = { 30: 'mother', 60: 'colossus', 90: 'regent', 100: 'warden' };

let enemyCounter = 0;

export function makeEnemy(templateId, floor, overrides = {}) {
  const t = ENEMY_TEMPLATES[templateId] || ENEMY_TEMPLATES.rat;
  const tier = Math.floor((floor - 1) / 10) + 1;
  const health = Math.round((9 + floor * 5.6) * t.hp * (1 + tier * 0.055));
  const attack = Math.round((2.6 + floor * 1.12) * t.atk);
  const armor = Math.round((t.armor * (1 + floor * 0.018)) * 10) / 10;
  const xp = Math.round((5 + floor * 2.6) * t.xp);
  const gold = Math.round((2 + floor * 1.25) * t.gold);
  enemyCounter++;
  return {
    id: `e${enemyCounter}`,
    template: templateId,
    name: overrides.name || t.name,
    glyph: t.glyph,
    sprite: t.sprite,
    color: t.color,
    role: overrides.role || t.role,
    level: floor,
    x: 0, y: 0,
    hp: overrides.hp ?? health,
    maxHp: overrides.hp ?? health,
    mp: 8 + floor,
    maxMp: 8 + floor,
    attack,
    armor,
    resist: Math.round(floor * 0.22),
    crit: 5 + Math.floor(floor * 0.08),
    dodge: 3 + Math.min(18, Math.round(floor * 0.12)),
    range: overrides.range || t.range || 1,
    skills: overrides.skills || [...t.skills],
    aggro: t.aggro,
    incorporeal: !!t.incorporeal,
    boss: !!t.boss,
    elite: !!overrides.elite,
    xp: Math.round(xp * (overrides.xpMult || 1)),
    gold: Math.round(gold * (overrides.goldMult || 1)),
    statuses: [],
    cooldowns: {},
    facing: 'down',
    isEcho: false,
    echoRef: null,
  };
}

export function bossForFloor(floor) {
  return FLOOR_BOSS[floor] || null;
}

export function floorRoster(floor, echoCount = 0) {
  const theme = themeForFloor(floor);
  const pool = THEME_POOLS[theme.id];
  const tier = Math.ceil(floor / 10);
  let count = 2 + Math.min(4, Math.floor(tier / 2)) + (floor > 60 ? 1 : 0);
  if (floor <= 3) count = 2;
  if (floor > 10 && floor % 10 === 0 && floor !== 100) count = Math.max(1, count - 1);
  count += Math.min(2, echoCount);
  const out = [];
  const bossId = bossForFloor(floor);
  if (bossId) out.push(bossId);
  for (let i = 0; i < count; i++) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    out.push(pick);
  }
  return out;
}

export function floorDanger(floor, echoCount) {
  const base = 1 + Math.floor(floor / 20);
  return Math.min(5, base + echoCount);
}
