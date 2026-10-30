import { skill as skillDef, SKILLS } from '../data/skills.js';
import { knownSkills, effectiveStats, echoCombatStats } from './hero.js';
import { classById } from '../data/classes.js';
import { findPath, lineOfSight, manhattan, rangeTiles, key } from './grid.js';

export function isAlive(a) {
  return a && a.hp > 0;
}

export function hasStatus(actor, id) {
  return (actor.statuses || []).some(s => s.id === id && s.dur > 0);
}

export function statusPower(actor, id) {
  const s = (actor.statuses || []).find(x => x.id === id && x.dur > 0);
  return s ? s.power || 0 : 0;
}

export function addStatus(actor, id, dur = 2, power = 0) {
  if (!actor.statuses) actor.statuses = [];
  const cur = actor.statuses.find(s => s.id === id);
  if (cur) {
    cur.dur = Math.max(cur.dur, dur);
    cur.power = Math.max(cur.power || 0, power);
  } else {
    actor.statuses.push({ id, dur, power });
  }
}

export function removeStatus(actor, id) {
  actor.statuses = (actor.statuses || []).filter(s => s.id !== id);
}

export function cleanse(actor) {
  const keep = new Set(['regen', 'shield', 'might', 'haste', 'fortune']);
  actor.statuses = (actor.statuses || []).filter(s => keep.has(s.id));
}

export function makePlayerActor(hero) {
  const stats = effectiveStats(hero);
  const cls = classById(hero.classId);
  return {
    kind: 'hero',
    id: hero.id,
    name: hero.name,
    classId: hero.classId,
    classGlyph: cls.glyph,
    level: hero.level,
    role: hero.role,
    hp: hero.hp,
    maxHp: hero.maxHp,
    mp: hero.mp,
    maxMp: hero.maxMp,
    ap: hero.apMax,
    apMax: hero.apMax,
    stats,
    attack: hero.attack,
    armor: hero.armor,
    resist: hero.resist,
    crit: hero.crit,
    dodge: hero.dodge,
    accuracy: hero.accuracy,
    statuses: [],
    cooldowns: {},
    skills: knownSkills(hero).map(s => s.id),
    weapon: hero.equipment.weapon,
    facing: 'down',
    x: 0,
    y: 0,
    isHero: true,
  };
}

export function syncHeroFromActor(hero, actor) {
  hero.hp = Math.max(0, Math.min(hero.maxHp, actor.hp));
  hero.mp = Math.max(0, Math.min(hero.maxMp, actor.mp));
}

export function enemyFromEcho(echo, x, y) {
  const s = echoCombatStats(echo);
  const cls = classById(echo.classId);
  return {
    id: echo.id,
    template: 'echo',
    name: `Echo of ${echo.name}`,
    glyph: cls.glyph,
    sprite: 'echo',
    color: '#b07ad6',
    role: echo.role,
    level: echo.level,
    x, y,
    hp: s.maxHp,
    maxHp: s.maxHp,
    mp: 20 + echo.level * 2,
    maxMp: 20 + echo.level * 2,
    stats: s.stats,
    attack: s.attack,
    armor: s.armor,
    resist: s.resist,
    crit: s.crit,
    dodge: s.dodge,
    accuracy: 78 + (s.stats.dex || 0) * 2,
    range: Math.max(1, ...(echo.skills || []).map(id => SKILLS[id]?.range || 0)),
    skills: [...(echo.skills || [])],
    aggro: 8,
    boss: false,
    elite: true,
    isEcho: true,
    echoRef: echo,
    xp: Math.round((echo.xp || 0) * 0.35 + echo.level * 7),
    gold: Math.round((echo.gold || 0) * 0.5),
    statuses: [],
    cooldowns: {},
    facing: 'down',
  };
}

export function apFor(actor) {
  let ap = (actor.apMax || 3) + (hasStatus(actor, 'haste') ? 1 : 0) - (hasStatus(actor, 'slow') ? 1 : 0);
  if (hasStatus(actor, 'confuse')) ap -= 1;
  return Math.max(1, ap);
}

export function beginTurn(actor) {
  const events = [];
  for (const k of Object.keys(actor.cooldowns || {})) {
    if (actor.cooldowns[k] > 0) actor.cooldowns[k]--;
  }
  const stunned = hasStatus(actor, 'stun');
  if (!stunned) {
    for (const st of actor.statuses || []) {
      if (st.id === 'burn' || st.id === 'bleed') {
        const dmg = Math.max(1, Math.round((st.power || 2) + actor.level * 0.35));
        actor.hp = Math.max(0, actor.hp - dmg);
        events.push({ type: 'dot', status: st.id, amount: dmg });
      } else if (st.id === 'poison') {
        const dmg = Math.max(1, Math.round(actor.maxHp * 0.028 + (st.power || 2)));
        actor.hp = Math.max(0, actor.hp - dmg);
        events.push({ type: 'dot', status: st.id, amount: dmg });
      } else if (st.id === 'regen') {
        const heal = Math.min(actor.maxHp - actor.hp, Math.max(1, st.power || 3));
        if (heal > 0) {
          actor.hp += heal;
          events.push({ type: 'regen', amount: heal });
        }
      }
    }
  }
  actor.ap = stunned ? 0 : apFor(actor);
  return { stunned, events };
}

export function endTurn(actor) {
  for (const st of actor.statuses || []) st.dur--;
  actor.statuses = (actor.statuses || []).filter(st => st.dur > 0 && !(st.id === 'shield' && st.power <= 0));
}

export function shieldAbsorb(actor, amount) {
  const shield = (actor.statuses || []).find(s => s.id === 'shield' && s.dur > 0);
  if (!shield || shield.power <= 0) return { damage: amount, absorbed: 0 };
  const absorbed = Math.min(shield.power, amount);
  shield.power -= absorbed;
  if (shield.power <= 0) removeStatus(actor, 'shield');
  return { damage: amount - absorbed, absorbed };
}

export function applyRawDamage(actor, amount, { ignoreShield = false } = {}) {
  let dmg = Math.max(0, Math.round(amount));
  let absorbed = 0;
  if (!ignoreShield) {
    const r = shieldAbsorb(actor, dmg);
    dmg = r.damage;
    absorbed = r.absorbed;
  }
  actor.hp = Math.max(0, actor.hp - dmg);
  return { damage: dmg, absorbed };
}

export function healActor(actor, amount) {
  const heal = Math.max(0, Math.round(amount));
  const actual = Math.min(heal, actor.maxHp - actor.hp);
  actor.hp += actual;
  return actual;
}

function facingVector(facing) {
  switch (facing) {
    case 'up': return { x: 0, y: -1 };
    case 'down': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
    default: return { x: 0, y: 0 };
  }
}

export function isBehind(attacker, defender) {
  const v = facingVector(defender.facing);
  if (!v.x && !v.y) return false;
  const behind = { x: defender.x - v.x, y: defender.y - v.y };
  return behind.x === attacker.x && behind.y === attacker.y;
}

export function rollHit(attacker, defender, rng = Math.random) {
  let acc = attacker.accuracy || (75 + (attacker.stats?.dex || 0) * 2);
  if (hasStatus(attacker, 'blind')) acc -= 40;
  if (hasStatus(attacker, 'confuse')) acc -= 20;
  acc += hasStatus(attacker, 'fortune') ? 6 : 0;
  const evade = defender.dodge || 0;
  const chance = Math.max(0.12, Math.min(0.97, (acc - evade + 12) / 100));
  return rng() < chance;
}

export function computeDamage(attacker, defender, s, { critAllowed = true, surrounded = false, rng = Math.random } = {}) {
  const stats = attacker.stats || {};
  let base;
  if (attacker.isHero || attacker.isEcho) {
    const scale = stats[s.stat] ?? stats.str ?? 0;
    if (s.kind === 'magic') base = scale * 1.55 + s.power * 1.1 + attacker.level * 1.4;
    else base = (attacker.attack || 4) + scale * 1.1 + s.power * 0.9 + attacker.level * 0.8;
  } else {
    if (s.kind === 'magic') base = attacker.attack * 1.15 + s.power * 1.05;
    else base = attacker.attack * 0.95 + s.power * 0.95;
    base += attacker.level * 0.5;
  }

  if (hasStatus(attacker, 'might')) base *= 1.3;
  if (hasStatus(attacker, 'weaken')) base *= 0.75;
  if (hasStatus(defender, 'mark')) base *= 1.2;
  if (s.backstab && isBehind(attacker, defender)) base *= 1.35;
  else if (isBehind(attacker, defender)) base *= 1.18;
  if (surrounded) base *= 1.12;
  if (s.execute) {
    const missing = 1 - defender.hp / defender.maxHp;
    if (missing > 0.55) base *= 1 + s.execute;
  }

  const critChance = Math.min(0.8, ((attacker.crit || 5) + (hasStatus(attacker, 'fortune') ? 18 : 0)) / 100);
  const crit = critAllowed && rng() < critChance;
  if (crit) base *= 1.8;

  base *= 0.92 + rng() * 0.16;

  let armor = defender.armor || 0;
  if (hasStatus(defender, 'sunder')) armor *= 0.7;
  const resist = defender.resist || 0;
  const defense = s.kind === 'magic' ? resist : armor;
  const denominator = s.kind === 'magic' ? (44 + defender.level * 2.4) : (52 + defender.level * 2.2);
  const reduction = defense / (defense + denominator);
  let damage = Math.max(1, Math.round(base * (1 - reduction)));
  if (hasStatus(defender, 'shield')) {
    const shield = defender.statuses.find(x => x.id === 'shield');
    if (shield) damage = Math.max(0, damage);
  }
  return { damage, crit, raw: Math.round(base) };
}

export function strike(attacker, defender, s, { rng = Math.random, surrounded = false, log = () => {} } = {}) {
  const skill = typeof s === 'string' ? skillDef(s) : s;
  if (!rollHit(attacker, defender, rng)) {
    return { missed: true, skill, target: defender };
  }
  const { damage, crit } = computeDamage(attacker, defender, skill, { surrounded, rng });
  const applied = applyRawDamage(defender, damage);
  const result = {
    missed: false, crit, skill, target: defender,
    damage: applied.damage, absorbed: applied.absorbed,
    killed: defender.hp <= 0,
    statuses: [],
  };
  for (const effect of skill.effects || []) {
    const effTarget = effect.target === 'self' ? attacker : defender;
    if (effTarget.hp <= 0) continue;
    if (rng() * 100 <= (effect.chance ?? 0.5) * 100) {
      addStatus(effTarget, effect.id, effect.dur ?? 2, effect.power ?? 0);
      result.statuses.push({ id: effect.id, target: effTarget });
    }
  }
  if (skill.drain && applied.damage > 0) {
    result.heal = healActor(attacker, applied.damage * skill.drain);
  }
  if (skill.selfDamage) {
    const self = applyRawDamage(attacker, attacker.maxHp * skill.selfDamage, { ignoreShield: true });
    result.selfDamage = self.damage;
  }
  return result;
}

export function supportSkill(attacker, target, skillId, rng = Math.random) {
  const s = skillDef(skillId);
  const result = { skill: s, target, heal: 0, statuses: [], cleansed: false };
  if (s.cleanse) {
    cleanse(target);
    result.cleansed = true;
  }
  if (s.power && (s.kind === 'heal')) {
    const scale = s.stat === 'wis' ? (attacker.stats?.wis || 0) : (attacker.stats?.int || 0);
    const base = (attacker.isHero || attacker.isEcho ? scale * 1.8 + s.power + attacker.level * 1.6 : attacker.attack + s.power);
    result.heal = healActor(target, base);
  }
  for (const effect of s.effects || []) {
    if (rng() * 100 <= (effect.chance ?? 1) * 100) {
      addStatus(target, effect.id, effect.dur ?? 2, effect.power ?? 0);
      result.statuses.push(effect.id);
    }
  }
  return result;
}

export function skillUsable(actor, s, { ignoreAp = false } = {}) {
  if (!s) return false;
  if (!ignoreAp && actor.ap < s.ap) return false;
  if (s.mp && (actor.mp || 0) < s.mp) return false;
  if ((actor.cooldowns?.[s.id] || 0) > 0) return false;
  if (s.kind === 'heal' || s.kind === 'buff') {
    if (s.target === 'self' || s.target === 'ally') return true;
  }
  return true;
}

export function paySkill(actor, s) {
  actor.ap = Math.max(0, (actor.ap || 0) - s.ap);
  actor.mp = Math.max(0, (actor.mp || 0) - (s.mp || 0));
  if (s.cd) {
    if (!actor.cooldowns) actor.cooldowns = {};
    actor.cooldowns[s.id] = s.cd + 1;
  }
}

export function aoeTiles(fd, center, radius) {
  return rangeTiles(fd, center, radius);
}

export function actorsInAoe(fd, center, radius, actors) {
  const tiles = aoeTiles(fd, center, radius);
  const set = new Set(tiles.map(t => key(t.x, t.y)));
  return actors.filter(a => a.hp > 0 && set.has(key(a.x, a.y)));
}

export function bestAoeCenter(fd, actors, radius, targets) {
  let best = null;
  let bestCount = -1;
  for (const a of targets) {
    const hits = actorsInAoe(fd, a, radius, actors).length;
    if (hits > bestCount) { bestCount = hits; best = { x: a.x, y: a.y }; }
  }
  return best;
}

export function estimateDamage(attacker, defender, s) {
  const stats = attacker.stats || {};
  const scale = stats[s.stat] ?? stats.str ?? 0;
  let base = (attacker.isHero || attacker.isEcho)
    ? (s.kind === 'magic' ? scale * 1.55 + s.power * 1.1 + attacker.level * 1.4 : (attacker.attack || 4) + scale * 1.1 + s.power * 0.9 + attacker.level * 0.8)
    : (s.kind === 'magic' ? attacker.attack * 1.15 + s.power * 1.05 : attacker.attack * 0.95 + s.power * 0.95);
  const defense = s.kind === 'magic' ? (defender.resist || 0) : (defender.armor || 0);
  const denominator = s.kind === 'magic' ? (44 + defender.level * 2.4) : (52 + defender.level * 2.2);
  return Math.max(1, base * (1 - defense / (defense + denominator)));
}

function usableOffense(actor, target, fd, { requireLos = true } = {}) {
  const out = [];
  for (const id of actor.skills || []) {
    const s = skillDef(id);
    if (s.kind !== 'phys' && s.kind !== 'magic' && s.kind !== 'utility') continue;
    if (!skillUsable(actor, s)) continue;
    const dist = manhattan(actor, target);
    if (s.target === 'self') {
      if (dist <= 1) out.push({ s, target, dist });
    } else if (dist <= s.range && (!requireLos || lineOfSight(fd, actor, target))) {
      out.push({ s, target, dist });
    }
  }
  return out.sort((a, b) => estimateDamage(actor, target, b.s) - estimateDamage(actor, target, a.s));
}

function usableSupport(actor, allies) {
  const out = [];
  for (const id of actor.skills || []) {
    const s = skillDef(id);
    if (s.kind !== 'heal' && s.kind !== 'buff') continue;
    if (!skillUsable(actor, s)) continue;
    for (const ally of allies) {
      if (!isAlive(ally)) continue;
      if (s.kind === 'heal' && ally.hp / ally.maxHp > (ally === actor ? 0.55 : 0.72)) continue;
      if (s.kind === 'buff' && ally !== actor) continue;
      out.push({ s, target: ally });
    }
  }
  return out.sort((a, b) => (a.target.hp / a.target.maxHp) - (b.target.hp / b.target.maxHp));
}

export function chooseEnemyIntent(enemy, player, enemies, fd) {
  const allies = enemies.filter(e => isAlive(e));
  const support = usableSupport(enemy, allies);
  if (support.length) {
    const pick = support[0];
    if (manhattan(enemy, pick.target) <= pick.s.range) {
      return { kind: 'support', skillId: pick.s.id, target: pick.target };
    }
  }

  const offense = usableOffense(enemy, player, fd);
  const dist = manhattan(enemy, player);
  if (offense.length) {
    const best = offense[0];
    if (best.s.target === 'self') {
      if (dist <= 1) return { kind: 'skill', skillId: best.s.id, target: player, tile: { x: player.x, y: player.y } };
    } else if (dist <= best.s.range && lineOfSight(fd, enemy, player)) {
      if (best.s.radius > 0) {
        const center = bestAoeCenter(fd, [player], best.s.radius, [player]) || { x: player.x, y: player.y };
        return { kind: 'skill', skillId: best.s.id, target: player, tile: center };
      }
      return { kind: 'skill', skillId: best.s.id, target: player, tile: { x: player.x, y: player.y } };
    }
  }

  if (dist <= 1) return { kind: 'attack', target: player };

  const occupied = new Set(allies.filter(a => a !== enemy).map(a => key(a.x, a.y)));
  const path = findPath(fd, enemy, { x: player.x, y: player.y }, { occupied });
  if (path.length) {
    const reservedForAttack = offense.length || true ? 1 : 0;
    const steps = Math.max(0, Math.min(path.length - 1, Math.max(1, enemy.apMax || 3) - reservedForAttack));
    const targetTile = steps > 0 ? path[steps - 1] : { x: enemy.x, y: enemy.y };
    const after = { x: targetTile.x, y: targetTile.y };
    const willBeAdjacent = manhattan(after, player) <= 1;
    return { kind: 'move', path: path.slice(0, steps), followUp: willBeAdjacent ? 'attack' : null };
  }
  return { kind: 'wait' };
}

export function choosePlayerAutoAction(actor, enemies, fd) {
  const alive = enemies.filter(isAlive);
  if (!alive.length) return { kind: 'wait' };
  const support = usableSupport(actor, [actor]);
  if (support.length && actor.hp / actor.maxHp < 0.5) {
    return { kind: 'support', skillId: support[0].s.id, target: actor };
  }
  let nearest = alive[0];
  let bestDist = manhattan(actor, nearest);
  for (const e of alive) {
    const d = manhattan(actor, e);
    if (d < bestDist) { nearest = e; bestDist = d; }
  }
  const offense = usableOffense(actor, nearest, fd);
  if (offense.length) {
    const best = offense[0];
    if (best.dist <= best.s.range) {
      if (best.s.radius > 0) {
        const center = bestAoeCenter(fd, alive, best.s.radius, alive) || { x: nearest.x, y: nearest.y };
        return { kind: 'skill', skillId: best.s.id, target: nearest, tile: center };
      }
      return { kind: 'skill', skillId: best.s.id, target: nearest, tile: { x: nearest.x, y: nearest.y } };
    }
  }
  if (bestDist <= 1) return { kind: 'attack', target: nearest };
  const occupied = new Set(alive.map(a => key(a.x, a.y)));
  const path = findPath(fd, actor, nearest, { occupied });
  if (path.length) {
    const steps = Math.min(path.length, actor.ap);
    return { kind: 'move', path: path.slice(0, steps), followUp: null };
  }
  return { kind: 'wait' };
}
