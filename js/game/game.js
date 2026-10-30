import { h, mount, openSheet, toast, confirmSheet } from '../ui/ui.js';
import { saveMeta } from '../core/save.js';
import { CLASSES, STATS, classById, ARCHETYPES } from '../data/classes.js';
import { deriveClass, emptyStats, statsTotal, SKILL_UNLOCK_LEVELS } from '../systems/classifier.js';
import { createHero, carryUsed, xpToNext } from '../systems/hero.js';
import { skill as skillDef } from '../data/skills.js';
import { DungeonRun } from './run.js';
import { audio } from '../core/audio.js';
import { codexMethods } from './game-codex.js';

const NAMES = [
  'Vale', 'Morrow', 'Sable', 'Ilyra', 'Orin', 'Ash', 'Thorne', 'Nyx',
  'Cael', 'Wren', 'Dorian', 'Mire', 'Kestrel', 'Rook', 'Selene', 'Varro',
  'Edda', 'Lucan', 'Mira', 'Garrick', 'Yara', 'Bram', 'Isolde', 'Fen',
];

export class Game {
  constructor(meta, fresh = false) {
    this.meta = meta;
    this.fresh = fresh;
    this.run = null;
  }

  boot() {
    audio.setEnabled(this.meta.settings?.sound !== false);
    window.__echoesShake = this.meta.settings?.shake !== false;
    this.showTitle();
  }

  hasProgress() {
    const m = this.meta;
    return (m.heroCount || 0) > 0 || (m.deaths || 0) > 0 || (m.echoes?.length || 0) > 0 || (m.deepest || 0) > 0;
  }

  topbar(title, sub, onBack = null) {
    return h('div', { class: 'topbar' },
      onBack ? h('button', {
        class: 'icon-btn',
        attrs: { 'aria-label': 'Back' },
        text: '‹',
        onclick: onBack,
      }) : null,
      h('div', { class: 'grow' },
        sub ? h('div', { class: 'tb-sub', text: sub }) : null,
        h('div', { class: 'tb-title', text: title }),
      ),
      h('button', {
        class: 'icon-btn',
        attrs: { 'aria-label': 'Toggle sound' },
        text: this.meta.settings?.sound !== false ? '♪' : '✕',
        onclick: (e) => {
          this.meta.settings.sound = !(this.meta.settings.sound !== false);
          audio.setEnabled(this.meta.settings.sound);
          saveMeta(this.meta);
          e.currentTarget.textContent = this.meta.settings.sound ? '♪' : '✕';
          toast(this.meta.settings.sound ? 'Sound on' : 'Sound off');
        },
      }),
    );
  }

  stopRun() {
    if (this.run) {
      this.run.destroy();
      this.run = null;
    }
    document.getElementById('app').dataset.theme = 'threshold';
  }

  /* ---------------- title ---------------- */

  showTitle() {
    this.stopRun();
    const active = this.meta.activeHero;
    const embers = h('div', { class: 'title-embers' });
    for (let i = 0; i < 18; i++) {
      embers.append(h('i', {
        style: {
          left: `${Math.random() * 100}%`,
          bottom: `${8 + Math.random() * 40}%`,
          animationDelay: `${Math.random() * 9}s`,
          animationDuration: `${6 + Math.random() * 7}s`,
          opacity: 0,
        },
      }));
    }
    const title = h('div', { class: 'title-screen' },
      h('div', { class: 'title-art' },
        h('div', { class: 'title-spire' }),
        h('div', { class: 'title-runes', text: '✦ ✧ ◈ ✦ ✧ ◈ ✦' }),
        embers,
      ),
      h('div', { class: 'title-copy' },
        h('div', { class: 'title-kicker', text: 'A hardcore legacy roguelike' }),
        h('h1', { class: 'title-main' }, 'Echoes of the', h('em', { text: '100th Floor' })),
        h('p', { class: 'title-tag', text: 'Every death leaves a body. Every body remembers. Descend one hundred floors, defeat what you were, and take your legacy back.' }),
        h('div', { class: 'title-stats' },
          h('div', { class: 'title-stat' }, h('b', { text: `${this.meta.deepest || 0}` }), h('span', { text: 'Deepest floor' })),
          h('div', { class: 'title-stat' }, h('b', { text: `${this.meta.deaths || 0}` }), h('span', { text: 'Deaths' })),
          h('div', { class: 'title-stat' }, h('b', { text: `${this.meta.echoes?.length || 0}` }), h('span', { text: 'Echoes' })),
        ),
        h('div', { class: 'title-actions' },
          active
            ? h('button', { class: 'btn primary wide', onclick: () => this.startRun(active) },
              h('span', { class: 'k', text: 'Active hero' }), `Continue the Descent — Floor ${active.floor}`)
            : h('button', { class: 'btn primary wide', onclick: () => this.showGuild() },
              h('span', { class: 'k', text: this.hasProgress() ? 'The Survivor waits' : 'A new cycle' }), 'Enter the Guild Hall'),
          active
            ? h('button', { class: 'btn ghost wide', onclick: () => this.showGuild() }, 'Enter the Guild Hall')
            : this.hasProgress()
              ? h('button', { class: 'btn ghost wide', onclick: () => this.showGuild() }, 'Enter the Guild Hall')
              : h('button', { class: 'btn ghost wide', onclick: () => this.showCodex('mechanics') }, 'Read the Codex'),
        ),
        h('p', { class: 'tiny muted', style: { marginTop: '16px', letterSpacing: '.22em' }, text: 'The dungeon remembers.' }),
      ),
    );
    mount('#screen', title);
  }

  /* ---------------- guild hall ---------------- */

  showGuild() {
    this.stopRun();
    const meta = this.meta;
    const hero = meta.activeHero;
    const gold = (meta.gold || 0) + (hero?.gold || 0);
    const echoCount = meta.echoes?.length || 0;
    const heroCard = hero ? this.heroCard(hero) : this.emptyHeroCard();
    const notice = echoCount
      ? h('div', { class: 'notice danger' },
        h('b', { text: `${echoCount} Echo${echoCount > 1 ? 'es' : ''} wait below. ` }),
        `Your deepest descent is floor ${meta.deepest || 1}. Reclaim a body to recover its gear, XP, and skills.`)
      : h('div', { class: 'notice' },
        h('b', { text: 'The dungeon is persistent. ' }),
        'When you fall, your body becomes an Echo on that floor. Create a new hero, fight back down, and defeat what you left behind.');

    const nav = h('div', { class: 'nav-grid' },
      h('button', { class: 'nav-tile', onclick: () => this.showStash() },
        h('span', { class: 'nt-icon', text: '◫' }),
        h('span', { class: 'nt-title', text: 'Stash' }),
        h('span', { class: 'nt-sub', text: `${meta.stash?.length || 0} items banked` }),
      ),
      h('button', { class: 'nav-tile', onclick: () => this.showEchoLedger() },
        h('span', { class: 'nt-icon', text: '◈' }),
        h('span', { class: 'nt-title', text: 'Echo Ledger' }),
        h('span', { class: 'nt-sub', text: `${echoCount} fallen hero${echoCount === 1 ? '' : 'es'}` }),
        echoCount ? h('span', { class: 'badge', text: echoCount }) : null,
      ),
      h('button', { class: 'nav-tile', onclick: () => this.showCodex() },
        h('span', { class: 'nt-icon', text: '✦' }),
        h('span', { class: 'nt-title', text: 'Codex' }),
        h('span', { class: 'nt-sub', text: 'Mechanics · 50 classes · world' }),
      ),
      h('button', { class: 'nav-tile', onclick: () => this.showHall() },
        h('span', { class: 'nt-icon', text: '⚱' }),
        h('span', { class: 'nt-title', text: 'Hall of Fallen' }),
        h('span', { class: 'nt-sub', text: `${meta.hallOfHeroes?.length || 0} names remembered` }),
      ),
    );

    const view = h('div', { class: 'guild' },
      h('div', { class: 'guild-head' },
        h('div', {},
          h('div', { class: 'kicker', text: 'The Survivor · Safe Ground' }),
          h('h1', { text: 'Guild Hall' }),
          h('div', { class: 'muted small', text: 'The only place a new hero can be forged.' }),
        ),
        h('div', { class: 'resources' },
          h('span', {}, h('b', { text: `${gold}` }), 'g'),
          h('span', {}, 'Depth ', h('b', { text: meta.deepest || 0 })),
          h('span', {}, 'Deaths ', h('b', { text: meta.deaths || 0 })),
        ),
      ),
      heroCard,
      notice,
      nav,
      h('div', { class: 'section-title' }, h('h2', { text: 'The Descent' })),
      h('div', { class: 'row' },
        hero
          ? h('button', { class: 'btn primary wide', onclick: () => this.startRun(hero) },
            h('span', { class: 'k', text: `Floor ${hero.floor}` }), `Continue with ${hero.name}`)
          : h('button', { class: 'btn primary wide', onclick: () => this.showCreation() },
            h('span', { class: 'k', text: 'Reincarnation' }), 'Forge a New Hero'),
      ),
      h('div', { class: 'divider' }),
      h('p', { class: 'tiny muted center', style: { letterSpacing: '.18em' }, text: 'Death is permanent · The dungeon is not' }),
    );
    mount('#screen', this.topbar('Guild Hall', 'The Survivor', () => this.showTitle()), view);
  }

  emptyHeroCard() {
    return h('div', { class: 'hero-card empty' },
      h('div', { class: 'hc-top' },
        h('div', { class: 'hc-sigil', text: '✧' }),
        h('div', { class: 'grow' },
          h('div', { class: 'hc-name', text: 'No living hero' }),
          h('div', { class: 'hc-class', text: 'The reincarnation circle is cold' }),
          h('div', { class: 'hc-meta', text: 'Allocate ten points to determine your class.' }),
        ),
      ),
      h('button', { class: 'btn primary wide', style: { marginTop: '12px' }, onclick: () => this.showCreation() }, 'Begin Reincarnation'),
    );
  }

  heroCard(hero) {
    const cls = classById(hero.classId);
    const xpNeed = xpToNext(hero.level);
    return h('div', { class: 'hero-card' },
      h('div', { class: 'hc-top' },
        h('div', { class: 'hc-sigil', text: cls.glyph }),
        h('div', { class: 'grow' },
          h('div', { class: 'hc-name', text: hero.name }),
          h('div', { class: 'hc-class', text: `${hero.className} · Level ${hero.level}` }),
          h('div', { class: 'hc-meta', text: `Floor ${hero.floor} · ${hero.gold}g · ${hero.kills || 0} kills` }),
        ),
      ),
      h('div', { class: 'hc-bars' },
        h('div', { class: 'bar hp' }, h('i', { style: { width: `${(hero.hp / hero.maxHp) * 100}%` } })),
        h('div', { class: 'bar mp' }, h('i', { style: { width: `${(hero.mp / hero.maxMp) * 100}%` } })),
        h('div', { class: 'bar xp' }, h('i', { style: { width: `${(hero.xp / xpNeed) * 100}%` } })),
      ),
      h('div', { class: 'row', style: { marginTop: '12px' } },
        h('button', { class: 'btn primary grow', onclick: () => this.startRun(hero) }, 'Descend'),
        h('button', {
          class: 'btn ghost',
          text: 'Retire',
          onclick: () => this.retireHero(hero),
        }),
      ),
    );
  }

  retireHero(hero) {
    confirmSheet({
      kicker: 'End of the line',
      title: `Retire ${hero.name}?`,
      body: h('p', { class: 'small muted', style: { lineHeight: '1.65', margin: 0 }, text: 'Their gear and pack move to the Guild stash. They leave no Echo. This cannot be undone.' }),
      confirmLabel: 'Retire Hero',
      danger: true,
      onConfirm: () => {
        this.meta.stash = this.meta.stash || [];
        const items = [
          ...Object.values(hero.equipment || {}).filter(Boolean),
          ...(hero.inventory || []),
        ];
        this.meta.stash.push(...items);
        this.meta.gold = (this.meta.gold || 0) + (hero.gold || 0);
        this.meta.hallOfHeroes = this.meta.hallOfHeroes || [];
        this.meta.hallOfHeroes.push({
          name: hero.name, className: hero.className, level: hero.level,
          floor: hero.floor, retiredAt: Date.now(), retired: true,
        });
        this.meta.activeHero = null;
        saveMeta(this.meta);
        toast(`${hero.name} retires. ${items.length} relics banked.`, 'good');
        this.showGuild();
      },
    });
  }

  showHall() {
    const hall = [...(this.meta.hallOfHeroes || [])].reverse();
    const body = hall.length
      ? hall.slice(0, 24).map(entry => h('div', { class: entry.retired ? 'item-row' : 'echo-row' },
        h('div', { class: entry.retired ? 'ico' : 'esig', text: entry.retired ? '⚱' : '◈' }),
        h('div', { class: 'info' },
          h('div', { class: entry.retired ? 'name' : 'name', text: entry.name }),
          h('div', { class: 'meta', text: `${entry.className} · Lv ${entry.level} · Floor ${entry.floor}` }),
        ),
        h('div', { class: 'floor', text: entry.retired ? 'retired' : `fell` }),
      ))
      : [h('div', { class: 'empty-state' }, h('span', { class: 'glyph', text: '⚱' }), 'No names yet. The dungeon is patient.')];
    openSheet({
      kicker: 'Remembrance',
      title: 'Hall of Fallen',
      body,
      actions: [{ label: 'Close', kind: 'ghost' }],
    });
  }

  /* ---------------- creation ---------------- */

  showCreation() {
    if (this.meta.activeHero) {
      toast('A living hero already carries the run. Retire them or let them fall.');
      return;
    }
    this.stopRun();
    let name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const alloc = emptyStats();
    let preview = null;

    const nameInput = h('input', {
      class: 'name-field',
      attrs: { maxlength: '20', placeholder: 'Name your next death', 'aria-label': 'Hero name' },
      value: name,
      oninput: (e) => { name = e.target.value; validate(); },
    });
    const nameButton = h('button', {
      class: 'icon-btn',
      attrs: { 'aria-label': 'Random name' },
      text: '↻',
      onclick: () => {
        name = NAMES[Math.floor(Math.random() * NAMES.length)];
        nameInput.value = name;
        validate();
      },
    });

    const body = h('div', { class: 'creation-body' });
    const forgeBtn = h('button', { class: 'btn primary grow', text: 'Forge Hero', disabled: true });

    function classCard() {
      const total = statsTotal(alloc);
      if (total < 10) {
        return h('div', { class: 'class-card' },
          h('div', { class: 'cc-kicker', text: 'Stat-Lock pending' }),
          h('div', { class: 'cc-name', text: 'Unwritten' }),
          h('div', { class: 'cc-arch', text: 'Allocate all ten points' }),
          h('p', { class: 'cc-desc', text: 'The dungeon does not ask what you want to be. It watches where you put your points, and decides. Pure builds, hybrids, iron covenants and forbidden paths — fifty classes wait in the ratios.' }),
        );
      }
      const result = deriveClass(alloc);
      preview = result;
      const cls = result.cls;
      return h('div', { class: 'class-card' },
        h('div', { class: 'cc-kicker', text: `${ARCHETYPES[cls.arch]} · Stat-Lock complete` }),
        h('div', { class: 'cc-name', text: cls.name }),
        h('div', { class: 'cc-arch', text: `${cls.role} · ${result.exact ? 'exact signature' : `${result.resonance}% resonance`}` }),
        h('p', { class: 'cc-desc', text: cls.desc }),
        h('div', { class: 'cc-sig' },
          STATS.map((st, i) => h('span', { class: `sig-pip ${cls.sig[i] > 0 ? 'hot' : ''}` },
            `${st.short} `, h('b', { text: cls.sig[i] }))),
        ),
        h('div', { class: 'cc-skills' },
          cls.skills.map((id, i) => {
            const s = skillDef(id);
            return h('div', { class: 'cc-skill' },
              h('span', { class: 'glyph', text: s.glyph }),
              h('span', { class: 'grow', text: s.name }),
              h('span', { class: 'lvl', text: `lvl ${SKILL_UNLOCK_LEVELS[i]}` }),
            );
          }),
        ),
        h('div', { class: 'resonance' },
          h('span', { text: 'Resonance' }),
          h('div', { class: 'bar' }, h('i', { style: { width: `${result.resonance}%` } })),
          h('span', { text: `${result.resonance}%` }),
        ),
      );
    }

    function renderAlloc() {
      const total = statsTotal(alloc);
      const remaining = 10 - total;
      const rows = STATS.map(st => {
        const val = alloc[st.id];
        return h('div', { class: `stat-row ${val === 0 ? 'zero' : ''}` },
          h('div', { class: 'stat-label' }, st.short, h('em', { text: st.name })),
          h('div', { class: 'pips' }, Array.from({ length: 10 }, (_, i) =>
            h('i', { class: i < val ? 'on' : '' }))),
          h('div', { class: 'stat-ctrl' },
            h('button', {
              text: '−',
              disabled: val <= 0,
              onclick: () => { if (alloc[st.id] > 0) { alloc[st.id]--; renderAlloc(); } },
            }),
            h('span', { class: 'val', text: val }),
            h('button', {
              text: '+',
              disabled: remaining <= 0 || val >= 10,
              onclick: () => { if (remaining > 0) { alloc[st.id]++; renderAlloc(); } },
            }),
          ),
        );
      });
      const presets = ['bruiser', 'spellblade', 'gambler', 'paladin', 'juggernaut', 'glass_cannon', 'monk', 'sentinel']
        .map(id => classById(id));
      mount(body,
        h('div', { class: 'row' },
          h('div', { class: 'grow' }, nameInput),
          nameButton,
        ),
        h('div', { class: 'alloc-head' },
          h('h2', { text: 'Reincarnation' }),
          h('div', { class: 'points-left' }, 'Points left ', h('b', { text: remaining })),
        ),
        h('div', { class: 'stat-rows' }, rows),
        h('div', { class: 'presets' },
          presets.map(cls => h('button', {
            class: 'preset-chip',
            text: cls.name.replace('The ', ''),
            onclick: () => {
              for (const st of STATS) alloc[st.id] = cls.sig[STATS.indexOf(st)];
              renderAlloc();
            },
          })),
          h('button', {
            class: 'preset-chip',
            text: 'Random',
            onclick: () => {
              for (const st of STATS) alloc[st.id] = 0;
              for (let i = 0; i < 10; i++) {
                const pick = STATS[Math.floor(Math.random() * STATS.length)].id;
                alloc[pick]++;
              }
              renderAlloc();
            },
          }),
          h('button', {
            class: 'preset-chip',
            text: 'Clear',
            onclick: () => { for (const st of STATS) alloc[st.id] = 0; renderAlloc(); },
          }),
        ),
        classCard(),
        h('div', { class: 'notice' }, h('b', { text: 'Stat-Lock: ' }), 'your class is derived from the final ratio. You cannot change it later — only a new hero can be shaped differently.'),
        h('div', { style: { height: '4px' } }),
      );
      forgeBtn.disabled = remaining !== 0 || !(name || '').trim();
      validateLabel(remaining);
    }

    function validate() {
      const remaining = 10 - statsTotal(alloc);
      forgeBtn.disabled = remaining !== 0 || !(name || '').trim();
      validateLabel(remaining);
    }

    function validateLabel(remaining) {
      forgeBtn.textContent = remaining === 0
        ? `Forge ${preview ? preview.cls.name : 'Hero'}`
        : `Allocate ${remaining} more point${remaining === 1 ? '' : 's'}`;
    }

    forgeBtn.addEventListener('click', () => {
      if (statsTotal(alloc) !== 10 || !(name || '').trim()) return;
      const result = deriveClass(alloc);
      const hero = createHero({ name: name.trim(), stats: { ...alloc }, classId: result.cls.id, meta: this.meta });
      this.meta.heroCount = (this.meta.heroCount || 0) + 1;
      this.meta.activeHero = hero;
      this.meta.runs = (this.meta.runs || 0) + 1;
      saveMeta(this.meta);
      audio.click();
      toast(`${hero.name} is ${result.cls.name}. The Stat-Lock holds.`, 'good', 2800);
      this.startRun(hero);
    });

    const view = h('div', { class: 'creation' },
      this.topbar('Reincarnate', 'Ten points · Fifty classes', () => this.showGuild()),
      body,
      h('div', { class: 'creation-foot' },
        h('button', { class: 'btn ghost', text: 'Back', onclick: () => this.showGuild() }),
        forgeBtn,
      ),
    );
    mount('#screen', view);
    renderAlloc();
  }

  /* ---------------- run ---------------- */

  startRun(hero) {
    if (!hero) return;
    this.stopRun();
    this.run = new DungeonRun({
      meta: this.meta,
      hero,
      onExit: () => {
        this.run = null;
        this.showGuild();
      },
    });
    this.run.start();
  }
}

Object.assign(Game.prototype, codexMethods);
