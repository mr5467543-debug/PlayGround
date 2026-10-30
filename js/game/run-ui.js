import { h, openSheet, closeSheet, toast } from '../ui/ui.js';
import { carried, carryUsed, effectiveStats, equipItem, knownSkills, learnSkill, removeItem, unequipItem, xpToNext } from '../systems/hero.js';
import { skill as skillDef, SKILLS } from '../data/skills.js';
import { itemStatLine, rarityColor, RARITY } from '../data/items.js';
import { actorsInAoe, healActor, cleanse as cleanseActor, isAlive, addStatus, applyRawDamage } from '../systems/combat.js';
import { manhattan } from '../systems/grid.js';
import { audio } from '../core/audio.js';
import { STATS } from '../data/classes.js';

export const uiMethods = {
  /* ---------------- character menu ---------------- */
  openMenu() {
    if (this.dead) return;
    const hero = this.hero;
    const stats = effectiveStats(hero);
    const skills = knownSkills(hero);
    const body = [
      h('div', { class: 'row', style: { gap: '12px', alignItems: 'center' } },
        h('div', { class: 'hc-sigil', text: this.player.classGlyph || '✦' }),
        h('div', { class: 'grow' },
          h('div', { class: 'hc-name', text: hero.name }),
          h('div', { class: 'hc-class', text: `${hero.className} · Level ${hero.level}` }),
          h('div', { class: 'hc-meta', text: `${hero.gold}g · ${hero.xp}/${xpToNext(hero.level)} XP · Floor ${this.floor}` }),
        ),
      ),
      h('div', { class: 'divider' }),
      h('div', { class: 'section-title' }, h('h2', { text: 'Attributes' })),
      h('div', { class: 'row wrap', style: { gap: '6px' } },
        STATS.map(st => h('span', { class: 'sig-pip' }, `${st.short} `, h('b', { text: stats[st.id] || 0 }))),
      ),
      h('div', { class: 'kv' }, h('span', { text: 'HP / MP' }), h('b', { text: `${hero.hp}/${hero.maxHp} · ${hero.mp}/${hero.maxMp}` })),
      h('div', { class: 'kv' }, h('span', { text: 'ATK / ARM / CRIT' }), h('b', { text: `${this.player.attack} / ${this.player.armor} / ${this.player.crit}%` })),
      h('div', { class: 'kv' }, h('span', { text: 'Pack' }), h('b', { text: `${carryUsed(hero)}/${hero.carry}` })),
      h('div', { class: 'kv' }, h('span', { text: 'Echoes on this floor' }), h('b', { text: `${this.echoesOnFloor()}` })),
      h('div', { class: 'section-title' }, h('h2', { text: 'Skills' })),
      h('div', { class: 'skills-list' },
        skills.map(entry => {
          const s = skillDef(entry.id);
          return h('div', { class: `skill-line ${entry.source === 'memory' ? 'learned' : ''}` },
            h('span', { class: 'sg', text: s.glyph }),
            h('span', { class: 'grow' }, h('b', { text: s.name }), h('span', { class: 'muted', text: ` — ${s.desc}` })),
            h('span', { class: 'sd', text: entry.source === 'memory' ? 'memory' : `lvl ${entry.level}` }),
          );
        }),
      ),
      h('div', { class: 'section-title' }, h('h2', { text: 'Gear' })),
      h('div', { class: 'skills-list' },
        ['weapon', 'armor', 'trinket'].map(slot => {
          const item = hero.equipment[slot];
          return h('div', { class: 'skill-line' },
            h('span', { class: 'sg', text: item?.glyph || '◌' }),
            h('span', { class: 'grow', text: item ? item.name : `No ${slot}` }),
            h('span', { class: 'sd', text: item ? `${item.durability ?? '∞'} dur` : '—' }),
          );
        }),
      ),
      h('div', { class: 'divider' }),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn small ghost grow',
          text: `Sound: ${this.meta.settings.sound !== false ? 'On' : 'Off'}`,
          onclick: () => {
            this.meta.settings.sound = !(this.meta.settings.sound !== false);
            audio.setEnabled(this.meta.settings.sound);
            this.persist();
            closeSheet();
            this.openMenu();
          },
        }),
        h('button', {
          class: 'btn small ghost grow',
          text: `Shake: ${this.meta.settings.shake !== false ? 'On' : 'Off'}`,
          onclick: () => {
            this.meta.settings.shake = !(this.meta.settings.shake !== false);
            window.__echoesShake = this.meta.settings.shake;
            this.persist();
            closeSheet();
            this.openMenu();
          },
        }),
      ),
    ];
    if (this.combat) {
      body.push(h('div', { class: 'notice danger' }, 'You are in combat. The only ways out are victory or an Echo.'));
    }
    openSheet({
      kicker: 'Character',
      title: hero.name,
      body,
      actions: [
        { label: 'Resume', kind: 'ghost' },
        {
          label: 'Return to Guild',
          kind: 'primary',
          disabled: this.combat,
          onClick: () => this.exitToGuild(),
        },
      ],
    });
  },

  /* ---------------- inventory ---------------- */
  openItems() {
    if (this.dead) return;
    const body = [];
    const inv = this.hero.inventory;
    const equip = this.hero.equipment;
    body.push(h('div', { class: 'section-title' }, h('h2', { text: 'Equipped' })));
    for (const slot of ['weapon', 'armor', 'trinket']) {
      const item = equip[slot];
      if (!item) {
        body.push(h('div', { class: 'item-row' },
          h('div', { class: 'ico', text: slot === 'weapon' ? '⚔' : slot === 'armor' ? '⛨' : '◉' }),
          h('div', { class: 'info' },
            h('div', { class: 'name', text: `No ${slot}` }),
            h('div', { class: 'meta', text: 'Empty slot' }),
          ),
        ));
        continue;
      }
      body.push(h('div', { class: 'item-row' },
        h('div', { class: 'ico', text: item.glyph || '◆', style: { color: rarityColor(item) } }),
        h('div', { class: 'info' },
          h('div', { class: 'name' }, `${item.name} `,
            h('span', { class: 'rar', style: { color: rarityColor(item) }, text: RARITY[item.rarity]?.name || '' })),
          h('div', { class: 'meta', text: `${slot} · ${item.durability ?? '∞'}/${item.maxDurability ?? '∞'} durability` }),
          h('div', { class: 'stat', text: itemStatLine(item) }),
        ),
        h('div', { class: 'act' },
          h('button', { class: 'btn small ghost', text: 'Unequip', onclick: () => this.unequipGear(slot) }),
        ),
      ));
    }

    body.push(h('div', { class: 'section-title' }, h('h2', { text: `Pack ${carryUsed(this.hero)}/${this.hero.carry}` })));
    if (!inv.length) {
      body.push(h('div', { class: 'empty-state' }, h('span', { class: 'glyph', text: '◌' }), 'Your pack is empty.'));
    } else {
      for (const item of inv) {
        const isGear = item.kind === 'gear';
        const isShard = item.kind === 'shard';
        const actLabel = isGear ? 'Equip' : isShard ? 'Learn' : 'Use';
        body.push(h('div', { class: 'item-row' },
          h('div', { class: 'ico', text: item.glyph || '◆', style: { color: isGear ? rarityColor(item) : 'var(--accent)' } }),
          h('div', { class: 'info' },
            h('div', { class: 'name' }, `${item.name}${item.count > 1 ? ` ×${item.count}` : ''} `,
              isGear ? h('span', { class: 'rar', style: { color: rarityColor(item) }, text: RARITY[item.rarity]?.name || '' }) : null),
            h('div', { class: 'meta', text: isGear ? `${item.slot} · ${item.durability ?? '∞'}/${item.maxDurability ?? '∞'} dur` : item.desc || '' }),
            isGear ? h('div', { class: 'stat', text: itemStatLine(item) }) : null,
            isGear ? h('div', { class: 'durability' },
              h('i', { style: { width: `${Math.min(100, ((item.durability || 0) / (item.maxDurability || 1)) * 100)}%` } })) : null,
          ),
          h('div', { class: 'act' },
            h('button', {
              class: 'btn small',
              text: actLabel,
              onclick: () => {
                if (isGear) this.equipGear(item);
                else if (isShard) this.openShard(item);
                else this.useConsumable(item);
              },
            }),
          ),
        ));
      }
    }
    body.push(h('div', { class: 'notice' }, 'Using an item in combat costs 1 AP. Gear durability falls as you fight.'));
    openSheet({
      kicker: 'Field kit',
      title: 'Pack & Relics',
      body,
      actions: [{ label: 'Close', kind: 'ghost' }],
    });
  },

  spendItemAp() {
    if (!this.combat) return true;
    if (this.player.ap < 1) { toast('No AP left. End your turn first.'); return false; }
    this.player.ap -= 1;
    return true;
  },

  equipGear(item) {
    if (!this.spendItemAp()) return;
    const old = this.hero.equipment[item.slot];
    equipItem(this.hero, item);
    this.refreshPlayerDerived();
    this.log(`Equipped ${item.name}${old ? ` (stowed ${old.name})` : ''}.`, 'hl');
    this.render();
    this.persist();
    closeSheet();
    this.openItems();
  },

  unequipGear(slot) {
    if (!this.spendItemAp()) return;
    if (!unequipItem(this.hero, slot)) { toast('Your pack is full.'); return; }
    this.refreshPlayerDerived();
    this.render();
    this.persist();
    closeSheet();
    this.openItems();
  },

  useConsumable(item) {
    if (!this.spendItemAp()) return;
    let used = false;
    if (item.heal) {
      const amount = Math.round(this.player.maxHp * item.heal);
      const healed = healActor(this.player, amount);
      this.float(this.player, `+${healed}`, 'heal');
      this.log(`${item.name} restores ${healed} HP.`, 'good');
      audio.heal();
      used = true;
    }
    if (item.mana) {
      const amount = Math.round(this.player.maxMp * item.mana);
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + amount);
      this.log(`${item.name} restores ${amount} MP.`, 'good');
      used = true;
    }
    if (item.cleanse) {
      cleanseActor(this.player);
      this.log('Afflictions washed away.', 'good');
      used = true;
    }
    if (item.bomb) {
      const target = this.enemies.filter(isAlive).sort((a, b) => manhattan(a, this.player) - manhattan(b, this.player))[0];
      if (!target) { toast('Nothing to burn.'); return; }
      const victims = actorsInAoe(this.fd, target, item.bomb.radius, this.enemies.filter(isAlive));
      for (const victim of victims) {
        const dmg = item.bomb.power + this.floor;
        applyRawDamage(victim, dmg);
        this.float(victim, `-${dmg}`, 'hurt');
        if (item.bomb.element === 'fire') addStatus(victim, 'burn', 3, 3);
      }
      this.log(`${item.name} erupts for ${item.bomb.power + this.floor} damage.`, 'hl');
      audio.trap();
      used = true;
    }
    if (item.blind) {
      const target = this.enemies.filter(isAlive).sort((a, b) => manhattan(a, this.player) - manhattan(b, this.player))[0];
      if (!target) { toast('No target.'); return; }
      const victims = actorsInAoe(this.fd, target, 1, this.enemies.filter(isAlive));
      for (const v of victims) addStatus(v, 'blind', 3);
      this.log(`${item.name} blinds ${victims.length} foe(s).`, 'good');
      used = true;
    }
    if (!used) { toast('Nothing happens.'); return; }
    removeItem(this.hero, item, 1);
    this.syncFromPlayer();
    this.processDeaths();
    this.render();
    this.persist();
    closeSheet();
    if (!this.dead) this.openItems();
  },

  openShard(item) {
    const known = new Set(knownSkills(this.hero).map(s => s.id));
    const options = (item.skills || []).filter(id => SKILLS[id] && !known.has(id));
    const body = [];
    if (!options.length) {
      body.push(h('div', { class: 'notice' }, 'This shard holds nothing you do not already know. It remains in your pack.'));
    } else {
      body.push(h('p', { class: 'small muted', style: { margin: 0 }, text: 'Choose one skill to bind into your current class. The shard is consumed.' }));
      for (const id of options) {
        const s = SKILLS[id];
        body.push(h('div', { class: 'skill-line learned' },
          h('span', { class: 'sg', text: s.glyph }),
          h('span', { class: 'grow' }, h('b', { text: s.name }), h('span', { class: 'muted', text: ` — ${s.desc}` })),
          h('button', { class: 'btn small primary', text: 'Learn', onclick: () => this.learnFromShard(item, id) }),
        ));
      }
    }
    openSheet({
      kicker: 'Memory Shard',
      title: item.name,
      body,
      actions: [{ label: 'Close', kind: 'ghost' }],
    });
  },

  learnFromShard(item, id) {
    if (learnSkill(this.hero, id)) {
      removeItem(this.hero, item, 1);
      const s = SKILLS[id];
      this.log(`Memory bound: ${s.name}.`, 'echo');
      toast(`Learned ${s.name}.`, 'good');
      audio.echo();
      this.renderSkills();
      this.render();
      this.persist();
      closeSheet();
      this.openItems();
    }
  },
};
