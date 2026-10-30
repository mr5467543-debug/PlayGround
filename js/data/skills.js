export const EFFECTS = {
  burn:    { name: 'Burn',     glyph: '🜂', kind: 'dot',   color: '#ff8a5c', desc: 'Takes fire damage each turn.' },
  bleed:   { name: 'Bleed',    glyph: '🩸', kind: 'dot',   color: '#d75a6c', desc: 'Takes physical damage each turn.' },
  poison:  { name: 'Poison',   glyph: '☠', kind: 'dot',   color: '#8fc75f', desc: 'Loses a share of max HP each turn.' },
  stun:    { name: 'Stun',     glyph: '✹', kind: 'control', color: '#f0d27a', desc: 'Loses the next turn.' },
  blind:   { name: 'Blind',    glyph: '◐', kind: 'control', color: '#a9a2b8', desc: 'Accuracy reduced by 40%.' },
  confuse: { name: 'Confuse',  glyph: '✷', kind: 'control', color: '#c79bff', desc: 'Acts at random.' },
  weaken:  { name: 'Weaken',   glyph: '▽', kind: 'debuff', color: '#9d8b78', desc: 'Deals 25% less damage.' },
  slow:    { name: 'Slow',     glyph: '⧗', kind: 'debuff', color: '#7fa9c9', desc: 'Loses 1 AP.' },
  sunder:  { name: 'Sunder',   glyph: '⛨', kind: 'debuff', color: '#c9a86a', desc: 'Armor reduced.' },
  mark:    { name: 'Marked',   glyph: '◎', kind: 'debuff', color: '#d75a6c', desc: 'Takes 20% more damage.' },
  regen:   { name: 'Regen',    glyph: '✚', kind: 'buff',   color: '#8fe0a0', desc: 'Heals each turn.' },
  shield:  { name: 'Shield',   glyph: '⬡', kind: 'buff',   color: '#9cc4e8', desc: 'Absorbs incoming damage.' },
  might:   { name: 'Might',    glyph: '△', kind: 'buff',   color: '#ffcf8a', desc: 'Deals 30% more damage.' },
  haste:   { name: 'Haste',    glyph: '»', kind: 'buff',   color: '#a8e6c2', desc: 'Gains 1 AP.' },
  fortune: { name: 'Fortune',  glyph: '✦', kind: 'buff',   color: '#ffe49a', desc: 'Critical chance increased.' },
};

function mk(id, name, glyph, desc, opts = {}) {
  return {
    id, name, glyph, desc,
    ap: opts.ap ?? 1,
    mp: opts.mp ?? 0,
    cd: opts.cd ?? 0,
    range: opts.range ?? 1,
    radius: opts.radius ?? 0,
    power: opts.power ?? 0,
    stat: opts.stat ?? 'str',
    kind: opts.kind ?? 'phys',
    target: opts.target ?? 'enemy',
    effects: opts.effects ?? [],
    hits: opts.hits ?? 1,
    drain: opts.drain ?? 0,
    execute: opts.execute ?? 0,
    blink: opts.blink ?? false,
    cleanse: opts.cleanse ?? false,
    selfDamage: opts.selfDamage ?? 0,
    revive: opts.revive ?? false,
    backstab: opts.backstab ?? false,
    element: opts.element ?? 'steel',
  };
}

export const SKILLS = {
  /* ---- martial ---- */
  strike:        mk('strike', 'Strike', '⚔', 'A measured blow. Costs 1 AP, no cooldown.', { power: 5 }),
  power_strike:  mk('power_strike', 'Power Strike', '⚒', 'A heavy two-handed swing.', { ap: 2, power: 13, effects: [{ id: 'sunder', chance: 0.35, dur: 2 }] }),
  cleave:        mk('cleave', 'Cleave', '⟁', 'Sweeping arc that hits the target and all adjacent foes.', { ap: 2, power: 8, target: 'tile', radius: 1, effects: [{ id: 'bleed', chance: 0.3, dur: 3, power: 3 }] }),
  flurry:        mk('flurry', 'Flurry', '⧉', 'Three quick cuts. Each can crit independently.', { ap: 2, power: 4, hits: 3, stat: 'dex' }),
  riposte:       mk('riposte', 'Riposte', '↯', 'A precise counter-strike that punishes exposed foes.', { power: 8, stat: 'dex', backstab: true }),
  backstab:      mk('backstab', 'Backstab', '⤿', 'Heavy damage when striking a foe from behind.', { ap: 2, power: 12, stat: 'dex', backstab: true }),
  sunder:        mk('sunder', 'Sunder', '⛏', 'Rend armor and leave the target exposed.', { power: 5, effects: [{ id: 'sunder', chance: 0.8, dur: 3 }, { id: 'bleed', chance: 0.4, dur: 2, power: 2 }] }),
  execute:       mk('execute', 'Execute', '☠', 'Devastating against wounded enemies.', { ap: 2, power: 9, execute: 0.6 }),
  whirlwind:     mk('whirlwind', 'Whirlwind', '☸', 'Spin, striking every adjacent enemy.', { ap: 3, power: 9, target: 'self', radius: 1 }),
  shield_bash:   mk('shield_bash', 'Shield Bash', '⬢', 'Slam with a shield. May stun.', { ap: 2, power: 6, effects: [{ id: 'stun', chance: 0.45, dur: 1 }] }),
  spear_thrust:  mk('spear_thrust', 'Spear Thrust', '➶', 'Strike from two tiles away.', { power: 7, range: 2 }),
  lunge:         mk('lunge', 'Lunge', '➹', 'Close the gap and strike.', { ap: 2, power: 10, range: 2 }),
  poison_blade:  mk('poison_blade', 'Poison Blade', '☣', 'Coat the blade and open a vein.', { power: 4, effects: [{ id: 'poison', chance: 0.75, dur: 3 }] }),
  rend:          mk('rend', 'Rend', '🩸', 'A ragged cut that bleeds for a long time.', { power: 4, effects: [{ id: 'bleed', chance: 0.95, dur: 4, power: 3 }] }),
  lucky_strike:  mk('lucky_strike', 'Lucky Strike', '✦', 'A wild swing with a high chance to crit.', { power: 6, stat: 'luk', effects: [{ id: 'fortune', chance: 0.3, dur: 2, target: 'self' }] }),
  doom_fist:     mk('doom_fist', 'Doom Fist', '✊', 'Bare-knuckle devastation, ignoring half of armor.', { ap: 2, power: 14, stat: 'str', effects: [{ id: 'stun', chance: 0.25, dur: 1 }] }),
  gambit:        mk('gambit', 'Gambit', '🎲', 'A reckless wager: huge damage, or a backlash.', { ap: 2, power: 19, stat: 'luk' }),

  /* ---- arcane ---- */
  firebolt:      mk('firebolt', 'Firebolt', '🜂', 'Hurl a mote of flame. May burn.', { mp: 2, range: 4, power: 8, stat: 'int', kind: 'magic', element: 'fire', effects: [{ id: 'burn', chance: 0.4, dur: 3, power: 3 }] }),
  frost_spike:   mk('frost_spike', 'Frost Spike', '❄', 'Impale with ice. May slow.', { mp: 2, range: 4, power: 7, stat: 'int', kind: 'magic', element: 'ice', effects: [{ id: 'slow', chance: 0.55, dur: 2 }] }),
  chain_lightning: mk('chain_lightning', 'Chain Lightning', '⚡', 'Arcs to the target and two nearby foes.', { ap: 2, mp: 4, range: 4, power: 9, stat: 'int', kind: 'magic', element: 'storm', target: 'tile', radius: 1 }),
  void_bolt:     mk('void_bolt', 'Void Bolt', '◈', 'Unravel a target with raw absence.', { ap: 2, mp: 4, range: 5, power: 13, stat: 'int', kind: 'magic', element: 'void', effects: [{ id: 'mark', chance: 0.3, dur: 2 }] }),
  arcane_burst:  mk('arcane_burst', 'Arcane Burst', '❂', 'Detonate a sigil at a chosen tile.', { mp: 5, range: 4, power: 9, stat: 'int', kind: 'magic', target: 'tile', radius: 1, element: 'arcane' }),
  meteor:        mk('meteor', 'Meteor', '☄', 'Call a burning stone from nowhere.', { ap: 3, mp: 8, range: 5, power: 17, stat: 'int', kind: 'magic', target: 'tile', radius: 1, element: 'fire', effects: [{ id: 'burn', chance: 0.5, dur: 3, power: 4 }] }),
  drain_life:    mk('drain_life', 'Drain Life', '♆', 'Steal vitality from a foe.', { mp: 3, range: 3, power: 8, stat: 'int', kind: 'magic', element: 'shadow', drain: 0.6 }),
  curse:         mk('curse', 'Curse', '☾', 'Weaken and mark a foe.', { mp: 2, range: 3, power: 3, stat: 'int', kind: 'magic', element: 'shadow', effects: [{ id: 'weaken', chance: 0.85, dur: 3 }, { id: 'mark', chance: 0.7, dur: 3 }] }),
  hex:           mk('hex', 'Hex', '✷', 'Rot the mind. May confuse.', { ap: 2, mp: 3, range: 4, power: 6, stat: 'int', kind: 'magic', element: 'shadow', effects: [{ id: 'poison', chance: 0.6, dur: 3 }, { id: 'confuse', chance: 0.35, dur: 2 }] }),
  shadow_bolt:   mk('shadow_bolt', 'Shadow Bolt', '◐', 'A bolt of living dark that blinds.', { mp: 2, range: 4, power: 7, stat: 'int', kind: 'magic', element: 'shadow', effects: [{ id: 'blind', chance: 0.55, dur: 2 }] }),
  time_slip:     mk('time_slip', 'Time Slip', '⧗', 'Borrow a moment from the future.', { ap: 1, mp: 4, range: 0, kind: 'buff', target: 'self', effects: [{ id: 'haste', chance: 1, dur: 2 }, { id: 'shield', chance: 1, dur: 2, power: 8 }] }),
  soul_lance:    mk('soul_lance', 'Soul Lance', '⌁', 'Pierce flesh and spirit alike.', { ap: 2, mp: 5, range: 5, power: 15, stat: 'int', kind: 'magic', element: 'soul', effects: [{ id: 'sunder', chance: 0.4, dur: 2 }] }),
  blood_magic:   mk('blood_magic', 'Blood Magic', '🜏', 'Pay health for catastrophic power.', { ap: 2, mp: 0, range: 5, power: 20, stat: 'int', kind: 'magic', element: 'blood', selfDamage: 0.15 }),
  blink:         mk('blink', 'Blink', '⌖', 'Step through the seam of the world (range 3).', { ap: 1, mp: 3, range: 3, kind: 'utility', target: 'tile', blink: true }),

  /* ---- faith / support ---- */
  heal:          mk('heal', 'Mend', '✚', 'Knit flesh with a word.', { mp: 3, range: 3, power: 11, stat: 'wis', kind: 'heal', target: 'ally' }),
  greater_heal:  mk('greater_heal', 'Greater Mend', '✙', 'A flood of restorative light.', { ap: 2, mp: 6, range: 3, power: 24, stat: 'wis', kind: 'heal', target: 'ally' }),
  regeneration:  mk('regeneration', 'Regeneration', '♻', 'Regrow what was lost over time.', { mp: 3, range: 3, kind: 'heal', target: 'ally', effects: [{ id: 'regen', chance: 1, dur: 4, power: 5 }] }),
  cleanse:       mk('cleanse', 'Cleanse', '◇', 'Burn away afflictions.', { mp: 3, range: 3, kind: 'heal', target: 'ally', cleanse: true, power: 4 }),
  bless:         mk('bless', 'Bless', '☩', 'Steady the hand and harden the will.', { mp: 3, range: 3, kind: 'buff', target: 'ally', effects: [{ id: 'might', chance: 1, dur: 3 }, { id: 'regen', chance: 1, dur: 2, power: 4 }] }),
  ward:          mk('ward', 'Ward', '⬡', 'A shell of prayer absorbs harm.', { mp: 3, range: 3, kind: 'buff', target: 'ally', effects: [{ id: 'shield', chance: 1, dur: 3, power: 14 }] }),
  sanctuary:     mk('sanctuary', 'Sanctuary', '⌂', 'Consecrate the ground beneath you.', { ap: 2, mp: 5, range: 0, kind: 'heal', target: 'self', power: 10, effects: [{ id: 'shield', chance: 1, dur: 3, power: 16 }, { id: 'regen', chance: 1, dur: 3, power: 3 }] }),
  judgement:     mk('judgement', 'Judgement', '☀', 'Light falls on the unrepentant.', { ap: 2, mp: 5, range: 4, power: 12, stat: 'wis', kind: 'magic', element: 'light', effects: [{ id: 'blind', chance: 0.4, dur: 2 }] }),
  smite:         mk('smite', 'Smite', '✧', 'A blade wrapped in conviction.', { mp: 2, range: 1, power: 8, stat: 'str', kind: 'magic', element: 'light', effects: [{ id: 'burn', chance: 0.3, dur: 2, power: 2 }] }),
  soul_ward:     mk('soul_ward', 'Soul Ward', '◉', 'Bind a ward to your own echo.', { mp: 4, range: 0, kind: 'buff', target: 'self', effects: [{ id: 'shield', chance: 1, dur: 3, power: 18 }, { id: 'might', chance: 1, dur: 2 }] }),

  /* ---- trickery / utility ---- */
  smoke_bomb:    mk('smoke_bomb', 'Smoke Bomb', '☁', 'Choke a cluster of foes. Blinds them.', { mp: 2, range: 3, power: 3, stat: 'dex', kind: 'utility', target: 'tile', radius: 1, effects: [{ id: 'blind', chance: 0.8, dur: 3 }] }),
  lucky_star:    mk('lucky_star', 'Lucky Star', '★', 'Fortune bends toward you.', { mp: 2, range: 0, kind: 'buff', target: 'self', effects: [{ id: 'fortune', chance: 1, dur: 4 }, { id: 'haste', chance: 1, dur: 1 }] }),
  battle_focus:  mk('battle_focus', 'Battle Focus', '◉', 'Read the fight and find the opening.', { ap: 1, mp: 2, range: 0, kind: 'buff', target: 'self', effects: [{ id: 'might', chance: 1, dur: 2 }, { id: 'fortune', chance: 1, dur: 2 }] }),
  sacrifice:     mk('sacrifice', 'Sacrifice', '🜏', 'Give blood. Take everything.', { ap: 2, mp: 0, range: 1, power: 22, stat: 'wis', kind: 'magic', element: 'blood', selfDamage: 0.25 }),
  siphon:        mk('siphon', 'Siphon', '♆', 'Tear vitality from a foe and drink it.', { ap: 2, mp: 4, range: 3, power: 10, stat: 'int', kind: 'magic', element: 'soul', drain: 1 }),
};

export const SKILL_LIST = Object.values(SKILLS);

export function skill(id) {
  return SKILLS[id] || SKILLS.strike;
}
