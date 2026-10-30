export const RARITY = {
  common:   { name: 'Common',   color: '#a89a86', mult: 1.00, weight: 56 },
  uncommon: { name: 'Uncommon', color: '#7fae7a', mult: 1.24, weight: 26 },
  rare:     { name: 'Rare',     color: '#6f9bd6', mult: 1.52, weight: 12 },
  epic:     { name: 'Epic',     color: '#b07ad6', mult: 1.86, weight: 5 },
  mythic:   { name: 'Mythic',   color: '#e0b768', mult: 2.35, weight: 1 },
};

export const CONSUMABLES = {
  draught:      { name: 'Crimson Draught', glyph: '🜂', desc: 'Restore 35% of max HP.', heal: 0.35, value: 18 },
  elixir:       { name: 'Grand Elixir', glyph: '✚', desc: 'Restore 70% of max HP.', heal: 0.7, value: 52 },
  tonic:        { name: 'Azure Tonic', glyph: '♆', desc: 'Restore 50% of max MP.', mana: 0.5, value: 22 },
  antidote:     { name: 'Bitter Antidote', glyph: '◇', desc: 'Cleanse all afflictions.', cleanse: true, value: 16 },
  firebomb:     { name: 'Firebomb', glyph: '☄', desc: 'Throw at a tile: 14 + floor damage in a 1-tile burst.', bomb: { power: 14, radius: 1, element: 'fire' }, value: 28 },
  smoke_flask:  { name: 'Smoke Flask', glyph: '☁', desc: 'Blind every enemy adjacent to the target tile.', blind: true, value: 20 },
  ration:       { name: 'Dungeon Ration', glyph: '◒', desc: 'Restore 12% HP. Tastes like regret.', heal: 0.12, value: 7 },
};

const WEAPON_BASES = [
  { key: 'longsword', name: 'Longsword', stat: 'str', glyph: '⚔', power: 1.00 },
  { key: 'warhammer', name: 'Warhammer', stat: 'str', glyph: '⚒', power: 1.18 },
  { key: 'greataxe', name: 'Greataxe', stat: 'str', glyph: '⟁', power: 1.14 },
  { key: 'dagger', name: 'Dagger', stat: 'dex', glyph: '🗡', power: 0.82, crit: 4 },
  { key: 'rapier', name: 'Rapier', stat: 'dex', glyph: '➶', power: 0.92, crit: 3 },
  { key: 'shortbow', name: 'Shortbow', stat: 'dex', glyph: '➹', power: 0.88 },
  { key: 'staff', name: 'Staff', stat: 'int', glyph: '✶', power: 0.94, mp: 6 },
  { key: 'grimoire', name: 'Grimoire', stat: 'int', glyph: '❂', power: 0.86, mp: 10 },
  { key: 'censer', name: 'Censer', stat: 'wis', glyph: '☩', power: 0.86, mp: 4 },
  { key: 'mace', name: 'Mace', stat: 'wis', glyph: '✧', power: 0.96 },
];

const ARMOR_BASES = [
  { key: 'leather', name: 'Leather Cuirass', glyph: '⛨', defense: 0.9 },
  { key: 'chain', name: 'Chain Hauberk', glyph: '⛓', defense: 1.12 },
  { key: 'scale', name: 'Scale Mail', glyph: '⬢', defense: 1.25 },
  { key: 'plate', name: 'Warden Plate', glyph: '⛨', defense: 1.42 },
  { key: 'mantle', name: 'Void Mantle', glyph: '◈', defense: 1.05 },
];

const TRINKET_BASES = [
  { key: 'ring', name: 'Signet Ring', glyph: '◉' },
  { key: 'charm', name: 'Owl Charm', glyph: '❧' },
  { key: 'locket', name: 'Echo Locket', glyph: '⬡' },
  { key: 'stone', name: 'Bloodstone', glyph: '◆' },
  { key: 'star', name: 'Star Fragment', glyph: '✦' },
];

const PREFIX = {
  common: ['Rusted', 'Weathered', 'Chipped', 'Plain', 'Scavenged'],
  uncommon: ['Keen', 'Sturdy', 'Warded', 'Honed', 'Gilded'],
  rare: ['Runed', 'Gravemarked', 'Templar', 'Whispering', 'Stormtouched'],
  epic: ['Abyssal', 'Soulbound', 'Dread', 'Sanguine', 'Astral'],
  mythic: ['Zenith', 'Hundredth', 'Godwrought', 'Eternal', 'Firstborn'],
};

const STAT_NAMES = { str: 'STR', dex: 'DEX', int: 'INT', vit: 'VIT', wis: 'WIS', luk: 'LUK' };
let uidCounter = 0;

function pick(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}

export function uid(prefix = 'i') {
  uidCounter++;
  return `${prefix}${Date.now().toString(36)}${uidCounter.toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
}

export function rollRarity(luck = 0, floor = 1) {
  const weights = {};
  const bump = luck * 0.9 + floor * 0.12;
  weights.common = Math.max(8, RARITY.common.weight - bump * 1.6);
  weights.uncommon = RARITY.uncommon.weight + bump * 0.55;
  weights.rare = RARITY.rare.weight + bump * 0.65;
  weights.epic = RARITY.epic.weight + bump * 0.32;
  weights.mythic = RARITY.mythic.weight + bump * 0.10;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const key of Object.keys(weights)) {
    roll -= weights[key];
    if (roll <= 0) return key;
  }
  return 'common';
}

export function makeGear(floor = 1, luck = 0, forcedSlot = null, forcedRarity = null) {
  const rarity = forcedRarity || rollRarity(luck, floor);
  const rar = RARITY[rarity];
  const slot = forcedSlot || pick(['weapon', 'armor', 'trinket']);
  const mult = rar.mult;
  let base;
  let item;
  const bonus = {};
  const statKeys = ['str', 'dex', 'int', 'vit', 'wis', 'luk'];

  if (slot === 'weapon') {
    base = pick(WEAPON_BASES);
    const power = Math.round((3.5 + floor * 0.62) * base.power * mult);
    if (Math.random() < 0.65) {
      const key = base.stat === 'int' ? 'int' : base.stat === 'wis' ? 'wis' : base.stat;
      bonus[key] = 1 + Math.floor(mult + floor / 32);
    }
    item = {
      kind: 'gear', slot, base: base.key, rarity, glyph: base.glyph,
      name: `${pick(PREFIX[rarity])} ${base.name}`,
      power, crit: base.crit || 0, mpBonus: base.mp || 0, bonus,
      desc: 'A weapon recovered from the dark.',
    };
  } else if (slot === 'armor') {
    base = pick(ARMOR_BASES);
    const defense = Math.round((2 + floor * 0.5) * base.defense * mult);
    bonus.vit = Math.max(1, Math.round(mult + floor / 40));
    item = {
      kind: 'gear', slot, base: base.key, rarity, glyph: base.glyph,
      name: `${pick(PREFIX[rarity])} ${base.name}`,
      defense, bonus,
      desc: 'Armor with someone else\'s history in the straps.',
    };
  } else {
    base = pick(TRINKET_BASES);
    const stat = pick(statKeys);
    bonus[stat] = 1 + Math.floor(mult * 1.4 + floor / 28);
    if (Math.random() < 0.45) bonus[pick(statKeys.filter(s => s !== stat))] = 1;
    item = {
      kind: 'gear', slot, base: base.key, rarity, glyph: base.glyph,
      name: `${pick(PREFIX[rarity])} ${base.name}`,
      bonus,
      desc: 'It hums when the floors below are angry.',
    };
  }

  const durability = 16 + Math.round(mult * 12) + Math.floor(Math.random() * 7);
  return {
    ...item,
    uid: uid('g'),
    durability,
    maxDurability: durability,
    value: Math.round((6 + floor * 3.2) * mult),
    floor,
  };
}

export function makeConsumable(floor = 1, forced = null) {
  const key = forced || pick(['draught', 'draught', 'tonic', 'antidote', 'firebomb', 'smoke_flask', 'ration']);
  const t = CONSUMABLES[key];
  return {
    kind: 'consumable', base: key, name: t.name, glyph: t.glyph, desc: t.desc,
    count: 1, value: Math.round(t.value + floor * 0.8), uid: uid('c'),
    heal: t.heal, mana: t.mana, cleanse: t.cleanse, bomb: t.bomb, blind: t.blind,
  };
}

export function makeShard(echo) {
  return {
    kind: 'shard', base: 'memory_shard', name: `Memory Shard of ${echo.name}`,
    glyph: '◈', desc: `Learn one skill remembered by ${echo.name}, ${echo.className}.`,
    skills: [...(echo.skills || [])], echoClass: echo.classId, echoName: echo.name,
    count: 1, value: 0, uid: uid('s'),
  };
}

export function makeRandomLoot(floor, luck, source = 'chest') {
  const count = source === 'chest' ? (Math.random() < 0.45 ? 2 : 1) : 1;
  const out = [];
  for (let i = 0; i < count; i++) {
    if (Math.random() < (source === 'chest' ? 0.38 : 0.22)) out.push(makeConsumable(floor));
    else out.push(makeGear(floor, luck + (source === 'chest' ? 4 : 0)));
  }
  return out;
}

export function itemStatLine(item) {
  const bits = [];
  if (item.power) bits.push(`+${item.power} power`);
  if (item.defense) bits.push(`+${item.defense} armor`);
  if (item.crit) bits.push(`+${item.crit}% crit`);
  if (item.mpBonus) bits.push(`+${item.mpBonus} MP`);
  if (item.bonus) for (const [k, v] of Object.entries(item.bonus)) bits.push(`+${v} ${STAT_NAMES[k] || k.toUpperCase()}`);
  return bits.join(' · ');
}

export function itemGlyph(item) {
  return item.glyph || '◆';
}

export function itemName(item) {
  return item.name || 'Unknown Relic';
}

export function rarityColor(item) {
  return RARITY[item.rarity]?.color || '#a89a86';
}
