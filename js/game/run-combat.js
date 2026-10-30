import { h, mount, openSheet, closeSheet, toast, shakeApp, isSheetOpen } from '../ui/ui.js';
import { sleep } from '../core/util.js';
import { skill as skillDef, SKILLS, EFFECTS } from '../data/skills.js';
import {
  isAlive, beginTurn, endTurn, strike, supportSkill, skillUsable, paySkill,
  applyRawDamage, healActor, cleanse as cleanseActor, actorsInAoe,
  chooseEnemyIntent, choosePlayerAutoAction, syncHeroFromActor,
} from '../systems/combat.js';
import { addXp, makeEchoRecord } from '../systems/hero.js';
import { makeRandomLoot, makeShard } from '../data/items.js';
import { saveMeta } from '../core/save.js';
import { audio } from '../core/audio.js';

export const combatMethods = {
  startCombat() {
    if (this.combat || this.dead) return;
    this.combat = true;
    this.player.statuses = [];
    this.player.cooldowns = {};
    this.player.ap = this.player.apMax;
    this.log('Steel sings. Combat begins.', 'bad');
    if (this.enemies.some(e => e.isEcho && e.hp > 0)) {
      this.log('An Echo of your own making turns toward you.', 'echo');
      if (this.firstCombatOnFloor) audio.echo();
    }
    this.firstCombatOnFloor = false;
    this.turnLabel.textContent = 'YOUR TURN';
    this.render();
    this.beginPlayerTurn();
    this.persist();
  },

  async beginPlayerTurn() {
    if (!this.combat || this.dead) return;
    const turn = beginTurn(this.player);
    this.applyTurnEvents(this.player, turn, 'You');
    if (this.dead) return;
    if (this.player.hp <= 0) { this.handleDeath('wounds that would not close'); return; }
    if (turn.stunned) {
      this.log('You are stunned and lose the turn.', 'bad');
      this.render();
      await sleep(900);
      if (!this.dead && this.combat) await this.endPlayerTurn();
      return;
    }
    this.render();
    if (this.auto && this.canAuto()) this.runAutoLoop();
  },

  applyTurnEvents(actor, turn, label) {
    for (const ev of turn.events) {
      if (ev.type === 'dot') {
        this.float(actor, `-${ev.amount}`, 'hurt');
        this.log(`${label} suffers ${ev.amount} ${EFFECTS[ev.status]?.name.toLowerCase() || ev.status} damage.`, 'bad');
        if (actor === this.player) {
          shakeApp();
          syncHeroFromActor(this.hero, this.player);
        }
      } else if (ev.type === 'regen') {
        this.float(actor, `+${ev.amount}`, 'heal');
      }
    }
  },

  async endPlayerTurn() {
    if (this.busy || this.dead || !this.combat) return;
    closeSheet();
    this.busy = true;
    endTurn(this.player);
    this.render();
    await sleep(220);
    await this.runEnemyTurn();
    if (this.dead || !this.combat) { this.busy = false; this.render(); return; }
    this.busy = false;
    await this.beginPlayerTurn();
    this.render();
    this.persist();
  },

  async runEnemyTurn() {
    this.turnLabel.textContent = 'ENEMY TURN';
    this.render();
    const order = this.enemies.filter(isAlive);
    for (const enemy of order) {
      if (this.dead || !this.combat) break;
      if (enemy.hp <= 0) continue;
      const turn = beginTurn(enemy);
      this.applyTurnEvents(enemy, turn, enemy.name);
      if (enemy.hp <= 0) { this.processDeaths(); continue; }
      this.render();
      if (turn.stunned) {
        this.float(enemy, 'STUNNED', '');
        this.log(`${enemy.name} is stunned.`, 'good');
        endTurn(enemy);
        await sleep(360);
        continue;
      }
      const intent = chooseEnemyIntent(enemy, this.player, this.enemies.filter(isAlive), this.fd);
      await this.executeEnemyIntent(enemy, intent);
      endTurn(enemy);
      if (this.player.hp <= 0) {
        this.handleDeath(`the ${enemy.isEcho ? 'Echo' : enemy.name} on floor ${this.floor}`);
        return;
      }
      await sleep(180);
    }
    this.turnLabel.textContent = 'YOUR TURN';
    this.render();
    this.processDeaths();
  },

  async executeEnemyIntent(enemy, intent) {
    if (!intent || intent.kind === 'wait') return;
    if (intent.kind === 'support') {
      const s = skillDef(intent.skillId);
      const target = intent.target;
      if (!isAlive(target) || Math.abs(enemy.x - target.x) + Math.abs(enemy.y - target.y) > s.range) return;
      if (!skillUsable(enemy, s, { ignoreAp: true })) return;
      paySkill(enemy, s);
      const res = supportSkill(enemy, target, s.id);
      if (res.heal) {
        this.float(target, `+${res.heal}`, 'heal');
        this.log(`${enemy.name} uses ${s.name} on ${target === enemy ? 'itself' : target.name}.`, 'echo');
      } else {
        this.log(`${enemy.name} invokes ${s.name}.`, 'echo');
      }
      audio.heal();
      this.render();
      await sleep(420);
      return;
    }
    if (intent.kind === 'skill') {
      const s = skillDef(intent.skillId);
      if (!skillUsable(enemy, s, { ignoreAp: true })) return;
      const tile = intent.tile || { x: this.player.x, y: this.player.y };
      paySkill(enemy, s);
      const hits = s.radius > 0
        ? [this.player].filter(p => Math.abs(p.x - tile.x) + Math.abs(p.y - tile.y) <= s.radius)
        : [this.player];
      if (!hits.length) {
        this.log(`${enemy.name} casts ${s.name}, but you are out of its reach.`, 'echo');
        this.render();
        await sleep(260);
        return;
      }
      this.log(`${enemy.name} casts ${s.name}.`, 'echo');
      for (const target of hits) {
        for (let i = 0; i < (s.hits || 1); i++) {
          const res = strike(enemy, target, s);
          this.describeHit(res, enemy, target, true);
          if (this.player.hp <= 0) break;
          await sleep(140);
        }
        if (this.player.hp <= 0) break;
      }
      this.render();
      await sleep(320);
      return;
    }
    if (intent.kind === 'move') {
      for (const step of intent.path || []) {
        if (this.dead) return;
        const from = { x: enemy.x, y: enemy.y };
        enemy.x = step.x;
        enemy.y = step.y;
        enemy.facing = step.x > from.x ? 'right' : step.x < from.x ? 'left' : step.y > from.y ? 'down' : 'up';
        this.render();
        await sleep(65);
      }
      if (intent.followUp === 'attack' && Math.abs(enemy.x - this.player.x) + Math.abs(enemy.y - this.player.y) <= 1) {
        const res = strike(enemy, this.player, SKILLS.strike);
        this.describeHit(res, enemy, this.player, false);
        await sleep(240);
      }
      return;
    }
    const res = strike(enemy, this.player, SKILLS.strike);
    this.describeHit(res, enemy, this.player, false);
    await sleep(280);
  },

  describeHit(res, attacker, target, isEnemySkill) {
    const isHeroTarget = target === this.player;
    if (res.missed) {
      this.float(target, 'MISS', '');
      this.log(`${attacker.name} misses ${isHeroTarget ? 'you' : target.name}.`, isHeroTarget ? 'good' : '');
      audio.miss();
      this.render();
      return;
    }
    const dmg = res.damage;
    const text = `${res.crit ? 'CRIT ' : ''}-${dmg}${res.absorbed ? ` (${res.absorbed} blocked)` : ''}`;
    this.float(target, text, isHeroTarget ? 'hurt' : res.crit ? 'crit' : '');
    if (res.crit) { shakeApp(); audio.crit(); } else { audio.hit(); }
    if (isHeroTarget) {
      this.log(`${attacker.name} hits you for ${dmg}${res.crit ? ' (critical)' : ''}.`, 'bad');
      this.damageArmor();
    } else {
      this.log(`You hit ${target.name} for ${dmg}${res.crit ? ' (critical)' : ''}.`, res.crit ? 'hl' : '');
    }
    if (res.statuses?.length) {
      const names = [...new Set(res.statuses.map(st => EFFECTS[st.id]?.name).filter(Boolean))];
      if (names.length) {
        this.log(`${isHeroTarget ? 'You are' : `${target.name} is`} afflicted: ${names.join(', ')}.`, isHeroTarget ? 'bad' : 'good');
      }
    }
    if (res.heal) this.float(attacker, `+${res.heal}`, 'heal');
    if (res.selfDamage) {
      this.float(attacker, `-${res.selfDamage}`, 'hurt');
      this.log(`${attacker.name} pays ${res.selfDamage} HP for the spell.`, 'bad');
    }
    this.syncFromPlayer();
    this.render();
  },

  async basicAttack(enemy) {
    if (this.busy || this.dead || !enemy || enemy.hp <= 0) return;
    if (this.player.ap < 1) { toast('No AP left.'); return; }
    this.busy = true;
    this.player.ap -= 1;
    const res = strike(this.player, enemy, SKILLS.strike);
    this.describeHit(res, this.player, enemy, false);
    await this.damageWeapon();
    this.processDeaths();
    this.busy = false;
    this.render();
    this.persist();
    if (this.auto && this.combat) this.runAutoLoop();
  },

  castSkill(id) {
    if (this.busy || this.dead) return;
    if (!this.combat) { toast('Skills can only be called in combat.'); return; }
    const s = skillDef(id);
    if (this.selectedSkill?.id === s.id) { this.cancelTargeting(); return; }
    if (!skillUsable(this.player, s)) {
      if (this.player.ap < s.ap) toast('Not enough AP.');
      else if (s.mp && this.player.mp < s.mp) toast('Not enough MP.');
      else toast('That skill is still recovering.');
      return;
    }
    if (s.target === 'self' || s.target === 'ally') {
      if (s.radius > 0 && s.target === 'self') {
        this.executeSkillAt(s, { x: this.player.x, y: this.player.y });
        return;
      }
      this.executeSupport(s, this.player);
      return;
    }
    this.selectedSkill = s;
    this.rangeHighlight = new Set(
      rangeTilesFor(this.fd, this.player, s.range)
        .filter(t => this.fd.grid[t.y][t.x] === 1 || this.enemyAt(t))
        .map(t => t.y * this.fd.w + t.x),
    );
    this.aoePreview = [];
    this.log(`${s.name} armed. Choose a target.`, 'hl');
    this.render();
  },

  cancelTargeting() {
    this.selectedSkill = null;
    this.rangeHighlight.clear();
    this.aoePreview = [];
    this.render();
  },

  async resolveTargetedSkill(s, tile) {
    if (this.busy) return;
    if (!this.combat) { this.cancelTargeting(); return; }
    const dist = Math.abs(tile.x - this.player.x) + Math.abs(tile.y - this.player.y);
    if (dist > s.range) { toast('Out of range.'); return; }
    if (s.blink) {
      if (this.fd.grid[tile.y]?.[tile.x] !== 1) { toast('You cannot blink into stone.'); return; }
      if (this.enemyAt(tile)) { toast('Something is already there.'); return; }
      this.busy = true;
      paySkill(this.player, s);
      this.player.x = tile.x;
      this.player.y = tile.y;
      this.updateVisibility();
      audio.move();
      this.log('You step through a seam in the world.', 'hl');
      this.cancelTargeting();
      const trap = this.fd.traps.find(t => !t.disarmed && !t.triggered && t.x === tile.x && t.y === tile.y);
      if (trap) await this.triggerTrap(trap);
      this.busy = false;
      this.render();
      this.persist();
      return;
    }
    if (s.target === 'enemy') {
      const enemy = this.enemyAt(tile);
      if (!enemy) { toast('Choose an enemy.'); return; }
      if (s.range > 1 && !this.hasLine(this.player, enemy)) { toast('A wall drinks the spell.'); return; }
      await this.executeSkillAt(s, tile, enemy);
      return;
    }
    if (s.target === 'tile') {
      if (s.radius > 0) {
        this.aoePreview = rangeTilesFor(this.fd, tile, s.radius);
        this.render();
      }
      if (s.range > 1 && !this.hasLine(this.player, tile)) { toast('A wall drinks the spell.'); return; }
      await this.executeSkillAt(s, tile);
      return;
    }
    this.executeSupport(s, this.player);
  },

  hasLine(a, b) {
    return lineOfSightFor(this.fd, a, b);
  },

  async executeSkillAt(s, tile, directTarget = null) {
    if (this.busy || this.dead) return;
    if (!skillUsable(this.player, s)) {
      toast(this.player.ap < s.ap ? 'Not enough AP.' : this.player.mp < s.mp ? 'Not enough MP.' : 'That skill is still recovering.');
      return;
    }
    let targets = [];
    if (directTarget) targets = [directTarget];
    else if (s.target === 'self' && s.radius > 0) {
      targets = this.enemies.filter(e => isAlive(e) && Math.abs(e.x - this.player.x) + Math.abs(e.y - this.player.y) <= s.radius);
    } else if (s.radius > 0) {
      targets = actorsInAoe(this.fd, tile, s.radius, this.enemies.filter(isAlive));
    } else if (s.target === 'tile') {
      targets = [];
    } else {
      const enemy = this.enemyAt(tile);
      if (enemy) targets = [enemy];
    }
    if (!targets.length) {
      toast('No target in the pattern.');
      this.cancelTargeting();
      return;
    }
    this.busy = true;
    paySkill(this.player, s);
    this.log(`${s.name}!`, 'hl');
    let anyCrit = false;
    for (const enemy of targets) {
      if (enemy.hp <= 0) continue;
      if (s.id === 'gambit' && Math.random() < 0.25) {
        const back = applyRawDamage(this.player, this.player.maxHp * 0.15, { ignoreShield: true });
        this.float(this.player, `BACKFIRE -${back.damage}`, 'hurt');
        this.log('The wager turns on you.', 'bad');
        continue;
      }
      for (let i = 0; i < (s.hits || 1); i++) {
        if (enemy.hp <= 0) break;
        const res = strike(this.player, enemy, s);
        anyCrit = anyCrit || !!res.crit;
        this.describeHit(res, this.player, enemy, false);
        await sleep(90);
      }
    }
    if (anyCrit) shakeApp();
    await this.damageWeapon();
    this.selectedSkill = null;
    this.rangeHighlight.clear();
    this.aoePreview = [];
    this.processDeaths();
    this.busy = false;
    this.render();
    this.persist();
    if (this.auto && this.combat) this.runAutoLoop();
  },

  executeSupport(s, target) {
    if (this.busy || this.dead) return;
    if (!skillUsable(this.player, s)) {
      toast(this.player.ap < s.ap ? 'Not enough AP.' : this.player.mp < s.mp ? 'Not enough MP.' : 'That skill is still recovering.');
      return;
    }
    paySkill(this.player, s);
    const res = supportSkill(this.player, target, s.id);
    if (res.heal) {
      this.float(target, `+${res.heal}`, 'heal');
      this.log(`${s.name} restores ${res.heal} HP.`, 'good');
      audio.heal();
    } else if (res.cleansed) {
      this.float(target, 'CLEANSED', 'heal');
      this.log('Afflictions burn away.', 'good');
      audio.heal();
    } else {
      this.log(`${s.name} settles over you.`, 'hl');
      audio.tone({ freq: 420, dur: 0.2, type: 'sine', gain: 0.08 });
    }
    if (res.statuses?.length) {
      this.log(`Gained: ${res.statuses.map(id => EFFECTS[id]?.name || id).join(', ')}.`, 'good');
    }
    this.syncFromPlayer();
    this.render();
    this.persist();
  },

  runAutoLoop() {
    if (this.autoRunning) return;
    this.autoRunning = true;
    this.autoLoop().finally(() => { this.autoRunning = false; });
  },

  async autoLoop() {
    let guard = 0;
    while (this.auto && this.combat && !this.dead && guard++ < 60) {
      if (this.busy || isSheetOpen()) { await sleep(240); continue; }
      const plan = choosePlayerAutoAction(this.player, this.enemies, this.fd);
      if (!plan || plan.kind === 'wait') break;
      this.busy = true;
      if (plan.kind === 'support') {
        this.executeSupport(skillDef(plan.skillId), this.player);
      } else if (plan.kind === 'skill') {
        const s = skillDef(plan.skillId);
        await this.executeSkillAt(s, plan.tile || { x: plan.target.x, y: plan.target.y }, plan.target);
      } else if (plan.kind === 'attack') {
        await this.basicAttack(plan.target);
      } else if (plan.kind === 'move') {
        await this.animatePath(plan.path);
      }
      this.busy = false;
      if (!this.combat || this.dead) break;
      if (this.player.ap <= 0) break;
      await sleep(180);
    }
    if (this.auto && this.combat && !this.dead) await this.endPlayerTurn();
    if (!this.combat || this.dead) { this.auto = false; this.render(); }
  },

  toggleAuto() {
    if (this.busy) return;
    if (!this.canAuto()) {
      toast('Auto-battle is only available on cleared floors — and never on an Echo floor.', '', 3200);
      return;
    }
    this.auto = !this.auto;
    if (this.auto) {
      this.log('Auto-battle engaged.', 'hl');
      this.runAutoLoop();
    }
    this.render();
  },

  canAuto() {
    return this.combat && !this.dead && this.meta.clearedFloors.includes(this.floor) && this.echoesOnFloor() === 0;
  },

  async damageWeapon() {
    const weapon = this.hero.equipment?.weapon;
    if (!weapon || weapon.durability == null) return;
    weapon.durability = Math.max(0, weapon.durability - 1);
    if (weapon.durability === 0 && !weapon.broken) {
      weapon.broken = true;
      weapon.power = Math.max(1, Math.floor(weapon.power / 2));
      this.log(`${weapon.name} breaks. Its edge is gone.`, 'bad');
      toast('Your weapon broke. Find a replacement.', 'bad');
      this.refreshPlayerDerived();
    }
    this.persist();
  },

  damageArmor() {
    const armor = this.hero.equipment?.armor;
    if (!armor || armor.durability == null) return;
    armor.durability = Math.max(0, armor.durability - 1);
    if (armor.durability === 0 && !armor.broken) {
      armor.broken = true;
      armor.defense = Math.max(1, Math.floor(armor.defense / 2));
      this.log(`${armor.name} gives way.`, 'bad');
      this.refreshPlayerDerived();
    }
  },

  processDeaths() {
    if (this.dead) return;
    let killedAny = false;
    for (const enemy of this.enemies) {
      if (enemy.hp > 0 || enemy.dead) continue;
      enemy.dead = true;
      killedAny = true;
      this.hero.kills = (this.hero.kills || 0) + 1;
      this.meta.kills = (this.meta.kills || 0) + 1;
      this.float(enemy, `+${enemy.xp} XP`, 'echo');
      this.log(`${enemy.name} falls. +${enemy.xp} XP · +${enemy.gold}g`, 'good');
      audio.death();
      this.hero.gold += enemy.gold;
      if (enemy.isEcho) {
        this.reclaimEcho(enemy);
      } else {
        this.grantXp(enemy.xp);
        if (Math.random() < 0.32) {
          const loot = makeRandomLoot(this.floor, this.player.stats.luk, 'enemy');
          for (const item of loot) this.receiveItem(item);
        }
      }
      if (enemy.boss && this.floor === 100) this.victoryPending = true;
    }
    if (killedAny) {
      this.syncFromPlayer();
      this.render();
      this.persist();
    }
    if (this.combat && !this.enemies.some(isAlive)) this.endCombat();
    if (this.victoryPending) this.handleVictory();
  },

  grantXp(amount) {
    syncHeroFromActor(this.hero, this.player);
    const res = addXp(this.hero, amount);
    this.refreshPlayerDerived();
    if (res.levels) {
      this.float(this.player, `LEVEL ${this.hero.level}`, 'crit');
      this.log(`You reach level ${this.hero.level}.`, 'hl');
      audio.victory();
      if (res.skills.length) {
        const names = res.skills.map(id => SKILLS[id]?.name).filter(Boolean);
        toast(`New skill${names.length > 1 ? 's' : ''}: ${names.join(', ')}`, 'good', 3000);
        this.log(`New skill${names.length > 1 ? 's' : ''}: ${names.join(', ')}.`, 'good');
      }
      this.renderSkills();
    }
  },

  receiveItem(item) {
    const ok = addItem(this.hero, item, { overflowToStash: this.meta.stash });
    if (!ok) {
      this.log(`${item.name} is sent to the Guild stash (pack full).`, 'bad');
      toast('Pack full — loot sent to the Guild stash.', 'bad');
    }
    return ok;
  },

  reclaimEcho(enemy) {
    const echo = enemy.echoRef;
    if (!echo) return;
    this.meta.echoes = (this.meta.echoes || []).filter(e => e.id !== echo.id);
    const recovered = [];
    const gear = Object.values(echo.equipment || {}).filter(Boolean);
    for (const item of gear) { this.receiveItem(item); recovered.push(item.name); }
    for (const item of echo.inventory || []) { this.receiveItem(item); recovered.push(item.name); }
    this.hero.gold += echo.gold || 0;
    const xp = Math.round((echo.xp || 0) * 0.35 + echo.level * 6);
    this.grantXp(xp);
    const shard = makeShard(echo);
    this.receiveItem(shard);
    this.pendingReclaim.push({ echo, recovered, xp, gold: echo.gold || 0, shard: shard.name });
    this.log(`Echo reclaimed: ${echo.name}. +${xp} XP · +${echo.gold || 0}g · Memory Shard.`, 'echo');
    audio.echo();
    this.persist();
  },

  endCombat() {
    if (!this.combat) return;
    this.combat = false;
    this.auto = false;
    this.selectedSkill = null;
    this.rangeHighlight.clear();
    this.aoePreview = [];
    this.player.statuses = [];
    this.player.cooldowns = {};
    this.player.ap = this.player.apMax;
    this.log('The floor falls silent.', 'good');
    if (!this.meta.clearedFloors.includes(this.floor)) {
      this.meta.clearedFloors.push(this.floor);
      const bonus = Math.round(8 + this.floor * 2.4);
      this.grantXp(bonus);
      this.log(`Floor ${this.floor} cleared. +${bonus} XP.`, 'hl');
      if (this.floor >= 10 && this.floor % 10 === 0) toast(`Floor ${this.floor} cleared.`, 'good');
    }
    this.syncFromPlayer();
    this.render();
    this.persist();
    if (this.victoryPending) return;
    if (this.pendingReclaim.length) this.showReclaimSheet();
  },

  showReclaimSheet() {
    const entries = this.pendingReclaim.splice(0);
    const body = [];
    for (const entry of entries) {
      body.push(h('div', { class: 'notice' },
        h('b', { text: `Echo of ${entry.echo.name} reclaimed. ` }),
        ` +${entry.xp} XP · +${entry.gold}g · ${entry.recovered.length} item(s) recovered.`,
      ));
      body.push(h('div', { class: 'kv' }, h('span', { text: 'Memory Shard' }), h('b', { text: entry.shard })));
    }
    body.push(h('p', {
      class: 'small muted',
      style: { margin: 0, lineHeight: '1.6' },
      text: 'Open Items and use the Memory Shard to learn one skill the fallen hero knew — even one from another class.',
    }));
    openSheet({
      kicker: 'Legacy',
      title: 'The Echo Yields',
      body,
      actions: [{ label: 'Keep the relics', kind: 'primary' }],
    });
  },

  handleDeath(cause) {
    if (this.dead || this.victory) return;
    this.dead = true;
    this.combat = false;
    this.auto = false;
    this.busy = true;
    closeSheet();
    this.player.hp = 0;
    syncHeroFromActor(this.hero, this.player);
    const echo = makeEchoRecord(this.hero, this.floor, cause);
    this.meta.echoes = this.meta.echoes || [];
    this.meta.echoes.push(echo);
    this.meta.deaths = (this.meta.deaths || 0) + 1;
    this.meta.activeHero = null;
    this.meta.hallOfHeroes = this.meta.hallOfHeroes || [];
    this.meta.hallOfHeroes.push({
      name: this.hero.name,
      className: this.hero.className,
      level: this.hero.level,
      floor: this.floor,
      diedAt: Date.now(),
      cause,
      echoId: echo.id,
    });
    this.meta.deepest = Math.max(this.meta.deepest || 0, this.floor);
    saveMeta(this.meta);
    this.renderer?.stop();
    audio.death();
    const app = document.getElementById('app');
    app.classList.add('shake');
    setTimeout(() => app.classList.remove('shake'), 500);

    const floorEchoes = this.meta.echoes.filter(e => e.floor === this.floor).length;
    const panel = h('div', { class: 'fate' },
      h('div', { class: 'fate-sigil', text: '◈' }),
      h('div', { class: 'title-kicker', text: `${this.hero.className} · Floor ${this.floor}` }),
      h('h1', { text: 'You have fallen' }),
      h('p', { text: `Your body remains on floor ${this.floor}. Everything you carried — ${echo.skills.length} skills, your gear, your gold — now belongs to the Echo. It will remember how you fought.` }),
      h('div', { class: 'fate-stats' },
        h('div', {}, h('b', { text: `${floorEchoes}` }), h('span', { text: 'Echoes here' })),
        h('div', {}, h('b', { text: `${this.hero.level}` }), h('span', { text: 'Level lost' })),
        h('div', {}, h('b', { text: `${this.meta.deaths}` }), h('span', { text: 'Total deaths' })),
      ),
      h('p', { class: 'small muted', text: 'Return to the Guild Hall and reincarnate. A new hero must fight back to this floor and defeat what you left behind.' }),
      h('button', {
        class: 'btn primary wide',
        text: 'Return to the Guild Hall',
        onclick: () => { this.destroy(); this.onExit(); },
      }),
    );
    mount('#screen', panel);
  },

  handleVictory() {
    if (this.victory) return;
    this.victory = true;
    this.victoryPending = false;
    this.combat = false;
    this.auto = false;
    this.busy = true;
    closeSheet();
    this.meta.victory = true;
    this.meta.deepest = 100;
    if (!this.meta.clearedFloors.includes(100)) this.meta.clearedFloors.push(100);
    this.syncFromPlayer();
    this.hero.floor = 100;
    this.meta.activeHero = this.hero;
    saveMeta(this.meta);
    this.renderer?.stop();
    audio.victory();
    const panel = h('div', { class: 'fate win' },
      h('div', { class: 'fate-sigil', text: '✦' }),
      h('div', { class: 'title-kicker', text: 'The Zenith · Floor 100' }),
      h('h1', { text: 'The Hundredth Floor is silent' }),
      h('p', { text: `${this.hero.name}, ${this.hero.className}, has broken the Warden of the Zenith. The dungeon holds its breath. The echoes of everyone you lost are finally quiet.` }),
      h('div', { class: 'fate-stats' },
        h('div', {}, h('b', { text: `${this.meta.deaths}` }), h('span', { text: 'Heroes lost' })),
        h('div', {}, h('b', { text: `${this.meta.echoes.length}` }), h('span', { text: 'Echoes left' })),
        h('div', {}, h('b', { text: `${this.hero.level}` }), h('span', { text: 'Final level' })),
      ),
      h('p', { class: 'small muted', text: 'This hero survived. Return to the Guild Hall, bank your relics, or keep the run alive for another cycle.' }),
      h('button', {
        class: 'btn primary wide',
        text: 'Return to the Guild Hall',
        onclick: () => { this.destroy(); this.onExit(); },
      }),
    );
    mount('#screen', panel);
  },
};

function rangeTilesFor(fd, center, radius) {
  const out = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d === 0 || d > radius) continue;
      const x = center.x + dx;
      const y = center.y + dy;
      if (x < 0 || y < 0 || x >= fd.w || y >= fd.h) continue;
      out.push({ x, y, d });
    }
  }
  return out;
}

function lineOfSightFor(fd, a, b) {
  let x0 = a.x;
  let y0 = a.y;
  const x1 = b.x;
  const y1 = b.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let guard = 0;
  while (guard++ < 200) {
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
    if (x0 === x1 && y0 === y1) return true;
    if (x0 < 0 || y0 < 0 || x0 >= fd.w || y0 >= fd.h) return false;
    if (fd.grid[y0][x0] !== 1) return false;
  }
  return false;
}
