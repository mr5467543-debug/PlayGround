import { h, mount, openSheet, closeSheet, toast, shakeApp, floatText, isSheetOpen } from '../ui/ui.js';
import { MapRenderer } from '../ui/render-map.js';
import { generateFloor, revealAround, perceptionRadius, detectTraps, findTrapAt, findChestAt, MAP_W, MAP_H } from '../systems/dungeon.js';
import { isAlive, makePlayerActor, syncHeroFromActor, enemyFromEcho } from '../systems/combat.js';
import { recalcHero, effectiveStats, knownSkills, addItem, makeEchoRecord, carryUsed } from '../systems/hero.js';
import { skill as skillDef } from '../data/skills.js';
import { makeRandomLoot } from '../data/items.js';
import { floorDanger } from '../data/enemies.js';
import { findPath, manhattan, rangeTiles, lineOfSight, key } from '../systems/grid.js';
import { saveMeta } from '../core/save.js';
import { audio } from '../core/audio.js';
import { buildDom } from './run-dom.js';
import { sleep } from '../core/util.js';
import { combatMethods } from './run-combat.js';
import { uiMethods } from './run-ui.js';

export class DungeonRun {
  constructor({ meta, hero, onExit }) {
    this.meta = meta;
    this.hero = hero;
    this.onExit = onExit;
    this.floor = hero.floor || 1;
    this.fd = null;
    this.explored = new Set();
    this.visible = new Set();
    this.enemies = [];
    this.player = null;
    this.combat = false;
    this.busy = false;
    this.dead = false;
    this.victory = false;
    this.victoryPending = false;
    this.auto = false;
    this.autoRunning = false;
    this.selectedSkill = null;
    this.rangeHighlight = new Set();
    this.aoePreview = [];
    this.logs = [];
    this.pendingReclaim = [];
    this.firstCombatOnFloor = true;
    this.saveTimer = null;
    this.renderer = null;
    audio.setEnabled(meta.settings?.sound !== false);
    buildDom(this);
    this.renderer = new MapRenderer(this.canvas, this.fxLayer);
  }

  start() {
    this.enterFloor(this.hero.floor || 1);
  }

  destroy() {
    this.renderer?.stop();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    document.getElementById('app').dataset.theme = 'threshold';
  }

  enterFloor(floor) {
    if (this.dead || this.victory) return;
    closeSheet();
    this.floor = floor;
    this.hero.floor = floor;
    this.hero.deepest = Math.max(this.hero.deepest || floor, floor);
    this.meta.deepest = Math.max(this.meta.deepest || 0, floor);
    const echoRecords = (this.meta.echoes || []).filter(e => e.floor === floor);
    this.fd = generateFloor(this.meta, floor, echoRecords);
    this.hero.explored = this.hero.explored || {};
    this.explored = new Set(this.hero.explored[floor] || []);
    this.player = makePlayerActor(this.hero);
    this.player.x = this.fd.start.x;
    this.player.y = this.fd.start.y;
    this.player.facing = 'down';
    this.player.ap = this.player.apMax;
    this.enemies = [
      ...this.fd.enemies,
      ...this.fd.echoSpawns.map(s => enemyFromEcho(s.echo, s.x, s.y)),
    ];
    this.combat = false;
    this.busy = false;
    this.dead = false;
    this.auto = false;
    this.victoryPending = false;
    this.selectedSkill = null;
    this.rangeHighlight.clear();
    this.aoePreview = [];
    this.pendingReclaim = [];
    this.firstCombatOnFloor = true;
    this.logs = [];
    this.setTheme(this.fd.theme.id);
    this.updateVisibility();
    this.log(`Floor ${floor} — ${this.fd.theme.name}.`, 'hl');
    if (this.fd.tip) this.log(this.fd.tip, '');
    if (echoRecords.length) {
      this.log(`${echoRecords.length} Echo${echoRecords.length > 1 ? 'es' : ''} on this floor.`, 'echo');
    }
    this.renderSkills();
    this.render();
    this.saveNow();
    this.renderer.start();
    const records = echoRecords;
    setTimeout(() => this.showEntrySheet(records), 520);
  }

  showEntrySheet(echoRecords) {
    if (this.dead || this.fd?.floor !== this.floor) return;
    if (isSheetOpen()) return;
    const showTutorial = this.floor === 1 && !(this.meta.tutorialSeen || []).includes(1);
    const body = [];
    if (showTutorial) {
      body.push(h('p', {
        class: 'small',
        style: { lineHeight: '1.7', color: 'var(--parchment-dim)', margin: '0' },
        text: 'Tap any floor tile to walk. Tap a foe to strike it. Movement and attacks spend Action Points (AP) in combat; end your turn to let the dungeon answer.',
      }));
      body.push(h('div', { class: 'notice' },
        h('b', { text: 'Death is not the end. ' }),
        'Fall, and your body becomes an Echo. Reclaim it with a new hero to recover your gear, XP, and a Memory Shard.',
      ));
    }
    if (echoRecords.length) {
      body.push(h('div', { class: 'notice danger' },
        h('b', { text: 'Echoes detected. ' }),
        `${echoRecords.map(e => e.name).join(', ')} ${echoRecords.length > 1 ? 'rest' : 'rests'} on this floor. Defeat them to reclaim what they carry.`,
      ));
      audio.echo();
    }
    if (!body.length) {
      if (this.fd.tip) toast(this.fd.tip, '', 3600);
      return;
    }
    openSheet({
      kicker: echoRecords.length ? 'The dungeon remembers' : 'Guild briefing',
      title: echoRecords.length ? 'An Echo Stirs' : 'The First Descent',
      body,
      actions: [{ label: echoRecords.length ? 'Face the Echo' : 'Enter the floor', kind: 'primary' }],
      onClose: () => {
        if (showTutorial && !(this.meta.tutorialSeen || []).includes(1)) {
          this.meta.tutorialSeen.push(1);
          this.saveNow();
        }
      },
    });
  }

  setTheme(themeId) {
    document.getElementById('app').dataset.theme = themeId;
  }

  echoesOnFloor() {
    return (this.meta.echoes || []).filter(e => e.floor === this.floor).length;
  }

  updateVisibility() {
    const radius = 4 + Math.floor((this.player.stats.wis || 0) / 3);
    this.visible = new Set();
    for (let dy = -radius - 1; dy <= radius + 1; dy++) {
      for (let dx = -radius - 1; dx <= radius + 1; dx++) {
        if (Math.hypot(dx, dy) > radius + 0.25) continue;
        const x = this.player.x + dx;
        const y = this.player.y + dy;
        if (x < 0 || y < 0 || x >= this.fd.w || y >= this.fd.h) continue;
        this.visible.add(y * this.fd.w + x);
      }
    }
    revealAround(this.fd, this.explored, this.player.x, this.player.y, radius + 1);
    this.hero.explored[this.floor] = [...this.explored];
    const newly = detectTraps(this.fd, this.explored, this.player.stats, this.player.x, this.player.y, perceptionRadius(this.player.stats));
    if (newly.length) this.log('Your senses find a trap in the stone.', 'good');
    this.fd.danger = floorDanger(this.floor, this.echoesOnFloor());
  }

  render() {
    if (!this.fd || !this.player) return;
    this.floorNum.textContent = this.floor;
    this.themeName.textContent = this.fd.theme.name;
    this.hpFill.style.width = `${Math.max(0, Math.min(100, (this.player.hp / this.player.maxHp) * 100))}%`;
    this.hpNum.textContent = `${Math.max(0, Math.ceil(this.player.hp))}/${this.player.maxHp}`;
    this.mpFill.style.width = `${Math.max(0, Math.min(100, (this.player.mp / this.player.maxMp) * 100))}%`;
    this.mpNum.textContent = `${Math.max(0, Math.floor(this.player.mp))}/${this.player.maxMp}`;
    mount(this.apPips, Array.from({ length: this.player.apMax }, (_, i) =>
      h('i', { class: i < this.player.ap ? 'on' : '' })));
    mount(this.statLine,
      h('span', {}, 'ATK ', h('b', { text: this.player.attack })),
      h('span', {}, 'ARM ', h('b', { text: this.player.armor })),
      h('span', {}, 'CRIT ', h('b', { text: `${this.player.crit}%` })),
    );
    const danger = floorDanger(this.floor, this.echoesOnFloor());
    mount(this.dangerEl,
      h('span', { text: 'Danger' }),
      Array.from({ length: 5 }, (_, i) => h('span', { class: `pip ${i < danger ? 'on' : ''}` })),
    );
    this.turnLabel.textContent = this.combat ? (this.busy ? 'ENEMY TURN' : 'YOUR TURN') : 'EXPLORING';
    const echoCount = this.echoesOnFloor();
    this.echoLabel.textContent = echoCount ? `${echoCount} ECHO${echoCount > 1 ? 'ES' : ''}` : '';
    this.mapWrap.classList.toggle('echo-floor', echoCount > 0);
    this.endTurnBtn.classList.toggle('hidden', !this.combat);
    this.autoBtn.textContent = this.auto ? 'Auto ON' : 'Auto';
    this.autoBtn.classList.toggle('primary', this.auto);
    this.autoBtn.disabled = !this.canAuto();
    this.renderLog();
    this.updateTip();
    this.renderSkills();
    this.renderer?.setState({
      fd: this.fd,
      explored: this.explored,
      visible: this.visible,
      player: this.player,
      enemies: this.enemies,
      rangeHighlight: this.rangeHighlight,
      aoePreview: this.aoePreview || [],
    });
  }

  updateTip() {
    let tip = 'Tap a tile to move · Tap a foe to engage';
    if (this.selectedSkill) {
      tip = `Choose a target for ${this.selectedSkill.name} · tap it again to cancel`;
    } else if (this.combat) {
      tip = 'Your turn · tap a foe, use a skill, or End Turn';
    }
    if (this.player && findChestAt(this.fd, this.player.x, this.player.y)) {
      tip = 'A chest waits beneath your feet';
    }
    if (this.player && this.player.x === this.fd.stairs.x && this.player.y === this.fd.stairs.y) {
      tip = this.combat ? 'The stairs are here — finish the fight first' : 'The stairs are here · tap the stairs to descend';
    }
    if (this.echoesOnFloor() && !this.combat) {
      tip = 'An Echo guards this floor · danger rises with each death';
    }
    this.mapTip.textContent = tip;
  }

  renderLog() {
    mount(this.logEl, this.logs.slice(-3).map(l =>
      h('div', { class: `log-line ${l.kind || ''}`, text: l.text })));
  }

  log(text, kind = '') {
    this.logs.push({ text, kind });
    if (this.logs.length > 30) this.logs.shift();
    if (this.logEl) this.renderLog();
  }

  renderSkills() {
    if (!this.skillsEl || !this.player) return;
    const entries = knownSkills(this.hero);
    const buttons = entries.map((entry) => {
      const s = skillDef(entry.id);
      const cd = this.player.cooldowns?.[entry.id] || 0;
      const disabled = !this.combat || this.busy || this.dead || cd > 0 ||
        this.player.ap < s.ap || (s.mp && this.player.mp < s.mp);
      const cost = [s.ap ? `${s.ap} AP` : '', s.mp ? `${s.mp} MP` : ''].filter(Boolean).join(' · ');
      return h('button', {
        class: `skill-btn ${disabled ? 'disabled' : ''} ${this.selectedSkill?.id === s.id ? 'selected' : ''} ${entry.source === 'memory' ? 'extra' : ''}`,
        attrs: { title: s.desc, 'aria-label': `${s.name}: ${s.desc}` },
        onclick: () => this.castSkill(s.id),
      },
        h('span', { class: 'sg', text: s.glyph }),
        h('span', { class: 'sn', text: s.name }),
        h('span', { class: 'cost', text: cost || 'free' }),
        cd > 0 ? h('span', { class: 'cd', text: cd }) : null,
      );
    });
    mount(this.skillsEl, buttons);
    if (!buttons.length) {
      this.skillsEl.append(h('div', { class: 'tiny muted', style: { padding: '18px 8px' }, text: 'No skills yet' }));
    }
  }

  refreshPlayerDerived() {
    if (!this.player) return;
    syncHeroFromActor(this.hero, this.player);
    recalcHero(this.hero);
    const p = this.player;
    p.maxHp = this.hero.maxHp;
    p.hp = this.hero.hp;
    p.maxMp = this.hero.maxMp;
    p.mp = this.hero.mp;
    p.stats = effectiveStats(this.hero);
    p.attack = this.hero.attack;
    p.armor = this.hero.armor;
    p.resist = this.hero.resist;
    p.crit = this.hero.crit;
    p.dodge = this.hero.dodge;
    p.accuracy = this.hero.accuracy;
    p.apMax = this.hero.apMax;
    p.ap = Math.min(p.ap ?? p.apMax, p.apMax);
  }

  persist() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 250);
  }

  saveNow() {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (this.dead || this.victory) { saveMeta(this.meta); return; }
    if (this.player) syncHeroFromActor(this.hero, this.player);
    this.meta.activeHero = this.hero;
    saveMeta(this.meta);
  }

  tapTile(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * MAP_W);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * MAP_H);
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return null;
    return { x, y };
  }

  enemyAt(tile) {
    return this.enemies.find(en => en.hp > 0 && en.x === tile.x && en.y === tile.y) || null;
  }

  async onCanvasTap(e) {
    if (this.busy || this.dead || this.victory) return;
    const tile = this.tapTile(e);
    if (!tile) return;
    e.preventDefault();

    const revealedTrap = this.fd.traps.find(t => t.revealed && !t.disarmed && !t.triggered && t.x === tile.x && t.y === tile.y);
    if (revealedTrap) {
      if (manhattan(this.player, tile) <= 1) await this.disarmTrap(revealedTrap);
      else toast('Move beside the trap to disarm it.');
      return;
    }

    if (this.selectedSkill) {
      await this.resolveTargetedSkill(this.selectedSkill, tile);
      return;
    }

    const enemy = this.enemyAt(tile);
    if (enemy) {
      if (!this.combat) {
        this.startCombat();
        if (manhattan(this.player, tile) <= 1 && this.player.ap >= 1) await this.basicAttack(enemy);
        else { this.log(`The ${enemy.name} notices you.`, 'bad'); this.render(); }
      } else if (manhattan(this.player, tile) <= 1) {
        await this.basicAttack(enemy);
      } else {
        toast('Too far for a melee strike. Use a skill.');
      }
      return;
    }

    await this.moveTo(tile);
  }

  async moveTo(tile) {
    if (tile.x === this.player.x && tile.y === this.player.y) {
      if (this.player.x === this.fd.stairs.x && this.player.y === this.fd.stairs.y) this.openStairs();
      const chest = findChestAt(this.fd, tile.x, tile.y);
      if (chest) await this.openChest(chest);
      return;
    }
    const occupied = new Set(this.enemies.filter(isAlive).map(en => key(en.x, en.y)));
    const knownTraps = new Set(this.fd.traps.filter(t => t.revealed && !t.disarmed && !t.triggered).map(t => key(t.x, t.y)));
    const path = findPath(this.fd, this.player, tile, {
      occupied,
      costFn: (x, y) => (knownTraps.has(key(x, y)) ? 7 : 1),
    });
    if (!path.length) { toast('No path through the dark.'); return; }
    if (this.combat && this.player.ap <= 0) { toast('No AP left. End your turn.'); return; }
    const steps = this.combat ? Math.min(path.length, this.player.ap) : path.length;
    if (steps <= 0) return;
    this.busy = true;
    await this.animatePath(path.slice(0, steps));
    this.busy = false;
    if (this.dead) return;
    this.render();
    this.persist();
    this.checkAutoStart();
  }

  async animatePath(path) {
    for (const step of path) {
      if (this.dead) return;
      const from = { x: this.player.x, y: this.player.y };
      this.player.x = step.x;
      this.player.y = step.y;
      this.player.facing = step.x > from.x ? 'right' : step.x < from.x ? 'left' : step.y > from.y ? 'down' : 'up';
      if (this.combat) this.player.ap = Math.max(0, this.player.ap - 1);
      this.updateVisibility();
      const trap = findTrapAt(this.fd, step.x, step.y);
      if (trap) await this.triggerTrap(trap);
      if (this.dead) return;
      const chest = findChestAt(this.fd, step.x, step.y);
      if (chest) await this.openChest(chest);
      if (this.dead) return;
      this.render();
      await sleep(this.combat ? 75 : 55);
      if (!this.combat) {
        const near = this.enemies.find(en => isAlive(en) && manhattan(en, this.player) <= (en.aggro || 4) && lineOfSight(this.fd, en, this.player));
        if (near) { this.startCombat(); return; }
      }
      if (this.combat && this.player.ap <= 0) return;
      if (step.x === this.fd.stairs.x && step.y === this.fd.stairs.y && !this.combat) {
        this.openStairs();
        return;
      }
    }
  }

  checkAutoStart() {
    if (this.combat || this.dead) return;
    const near = this.enemies.find(en => isAlive(en) && manhattan(en, this.player) <= (en.aggro || 4) && lineOfSight(this.fd, en, this.player));
    if (near) this.startCombat();
  }

  async triggerTrap(trap) {
    if (trap.triggered || trap.disarmed) return;
    trap.triggered = true;
    trap.revealed = true;
    audio.trap();
    shakeApp();
    let dmg = 0;
    if (trap.kind === 'spike') {
      dmg = Math.round(this.player.maxHp * 0.12 + this.floor * 0.8);
      const r = applyTrapDamage(this.player, dmg);
      this.float(trap, `-${r.damage}`, 'hurt');
      this.log(`Spikes erupt from the floor. ${r.damage} damage.`, 'bad');
    } else if (trap.kind === 'ember') {
      dmg = Math.round(this.player.maxHp * 0.06 + this.floor * 0.4);
      const r = applyTrapDamage(this.player, dmg);
      this.player.statuses.push({ id: 'burn', dur: 3, power: 3 });
      this.float(trap, `-${r.damage} BURN`, 'hurt');
      this.log('A gout of ember scorches you. You are burning.', 'bad');
    } else {
      dmg = Math.round(this.player.maxHp * 0.05 + this.floor * 0.3);
      const r = applyTrapDamage(this.player, dmg);
      this.player.statuses.push({ id: 'poison', dur: 3, power: 2 });
      this.float(trap, `-${r.damage} POISON`, 'hurt');
      this.log('A needle of venom bites. You are poisoned.', 'bad');
    }
    syncHeroFromActor(this.hero, this.player);
    this.render();
    await sleep(260);
    if (this.player.hp <= 0) this.handleDeath(`a ${trap.kind} trap on floor ${this.floor}`);
  }

  async disarmTrap(trap) {
    const stats = this.player.stats;
    const chance = 0.55 + stats.dex * 0.025 + stats.luk * 0.01;
    this.busy = true;
    if (Math.random() < chance) {
      trap.disarmed = true;
      audio.loot();
      this.float(trap, 'DISARMED', 'heal');
      this.log('You coax the trap apart. The floor is a little safer.', 'good');
    } else {
      this.log('The mechanism bites your fingers.', 'bad');
      await this.triggerTrap(trap);
    }
    this.busy = false;
    this.render();
    this.persist();
  }

  async openChest(chest) {
    if (chest.opened) return;
    chest.opened = true;
    const items = makeRandomLoot(this.floor, this.player.stats.luk, 'chest');
    const gold = Math.round(5 + this.floor * 2.2);
    this.hero.gold += gold;
    const lost = [];
    for (const item of items) {
      if (!addItem(this.hero, item, { overflowToStash: this.meta.stash })) lost.push(item);
    }
    audio.loot();
    this.log(`Chest: ${items.map(i => i.name).join(', ')} · ${gold}g`, 'good');
    if (lost.length) toast(`${lost.length} item(s) sent to the Guild stash (pack full).`, 'bad');
    this.float(chest, `+${gold}g`, 'crit');
    this.render();
    await sleep(220);
    this.persist();
  }

  openStairs() {
    if (this.combat) { toast('Finish the fight before taking the stairs.'); return; }
    const bossAlive = this.enemies.some(en => en.boss && en.hp > 0);
    const actions = [];
    if (this.floor < 100) {
      actions.push({ label: `Descend to ${this.floor + 1}`, kind: 'primary', onClick: () => this.descend() });
    } else if (!bossAlive) {
      actions.push({ label: 'Ascend', kind: 'primary', onClick: () => this.handleVictory() });
    }
    actions.push({ label: 'Return to Guild', onClick: () => this.exitToGuild() });
    actions.push({ label: 'Stay', kind: 'ghost' });
    const body = [
      h('p', { class: 'small', style: { lineHeight: '1.65', color: 'var(--parchment-dim)', margin: '0' }, text: this.fd.theme.blurb }),
      h('div', { class: 'kv' }, h('span', { text: 'Current floor' }), h('b', { text: `${this.floor}` })),
      h('div', { class: 'kv' }, h('span', { text: 'Echoes' }), h('b', { text: `${this.echoesOnFloor()}` })),
      h('div', { class: 'kv' }, h('span', { text: 'Pack' }), h('b', { text: `${carryUsed(this.hero)}/${this.hero.carry} items` })),
    ];
    if (this.floor === 100 && bossAlive) {
      body.push(h('div', { class: 'notice danger' }, 'The Warden of the Zenith blocks the way. There is no stair above this one.'));
    }
    openSheet({
      kicker: 'Descent',
      title: this.floor === 100 ? 'The Zenith Stair' : `The Stair to ${this.floor + 1}`,
      body,
      actions,
    });
  }

  descend() {
    if (this.combat) { toast('The stair will not open in battle.'); return; }
    closeSheet();
    const next = this.floor + 1;
    if (next > 100) { this.handleVictory(); return; }
    audio.descend();
    if (!this.meta.clearedFloors.includes(this.floor)) this.meta.clearedFloors.push(this.floor);
    this.hero.hp = Math.min(this.player.maxHp, Math.round(this.player.hp + this.player.maxHp * 0.12));
    this.hero.mp = Math.min(this.player.maxMp, Math.round(this.player.mp + this.player.maxMp * 0.12));
    this.syncFromPlayer();
    this.enterFloor(next);
  }

  syncFromPlayer() {
    syncHeroFromActor(this.hero, this.player);
    this.hero.floor = this.floor;
    this.meta.activeHero = this.hero;
  }

  exitToGuild() {
    if (this.combat) { toast('You cannot leave the fight alive. Win, or fall.'); return; }
    closeSheet();
    this.syncFromPlayer();
    this.hero.floor = this.floor;
    this.meta.activeHero = this.hero;
    saveMeta(this.meta);
    this.destroy();
    this.onExit();
  }

  float(actor, text, kind = '') {
    if (!actor) return;
    floatText(this.fxLayer, actor, text, kind);
  }
}

function applyTrapDamage(actor, amount) {
  const shield = (actor.statuses || []).find(s => s.id === 'shield' && s.dur > 0);
  let dmg = Math.max(1, Math.round(amount));
  let absorbed = 0;
  if (shield) {
    absorbed = Math.min(shield.power, dmg);
    shield.power -= absorbed;
    dmg -= absorbed;
  }
  actor.hp = Math.max(0, actor.hp - dmg);
  return { damage: dmg, absorbed };
}

Object.assign(DungeonRun.prototype, combatMethods, uiMethods);
