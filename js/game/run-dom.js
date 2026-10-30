import { h, mount } from '../ui/ui.js';

export function buildDom(run) {
  run.floorNum = h('b', { text: '1' });
  run.themeName = h('div', { class: 'theme-name' });
  run.dangerEl = h('div', { class: 'danger' });
  run.hpFill = h('i', { style: { width: '100%' } });
  run.hpNum = h('span', { class: 'num' });
  run.mpFill = h('i', { style: { width: '100%' } });
  run.mpNum = h('span', { class: 'num' });
  run.apPips = h('div', { class: 'ap-pips' });
  run.statLine = h('div', { class: 'dh-stats' });
  run.turnLabel = h('span', { class: 'turn', text: 'EXPLORING' });
  run.echoLabel = h('span', {});
  run.mapTip = h('div', { class: 'map-tip' });
  run.fxLayer = h('div', { style: { position: 'absolute', inset: '0', pointerEvents: 'none' } });
  run.canvas = h('canvas', { id: 'map', attrs: { 'aria-label': 'Dungeon map' } });
  run.mapWrap = h('div', { class: 'map-wrap' },
    run.canvas,
    h('div', { class: 'map-topline' }, run.turnLabel, run.echoLabel),
    run.fxLayer,
    run.mapTip,
  );
  run.logEl = h('div', { class: 'log' });
  run.skillsEl = h('div', { class: 'skill-scroll' });
  run.itemsBtn = h('button', { class: 'btn', onclick: () => run.openItems() },
    h('span', { class: 'ico', text: '◈' }), 'Items');
  run.endTurnBtn = h('button', {
    class: 'btn primary',
    onclick: () => { run.auto = false; run.endPlayerTurn(); },
  }, h('span', { class: 'ico', text: '⟳' }), 'End Turn');
  run.autoBtn = h('button', { class: 'btn', onclick: () => run.toggleAuto() },
    h('span', { class: 'ico', text: '▶' }), 'Auto');
  run.menuBtn = h('button', {
    class: 'icon-btn',
    attrs: { 'aria-label': 'Menu' },
    text: '☰',
    onclick: () => run.openMenu(),
  });

  run.root = h('div', { class: 'dungeon' },
    h('div', { class: 'dungeon-hud' },
      h('div', { class: 'dh-row' },
        h('div', { class: 'floor-badge' }, 'FLOOR ', run.floorNum),
        run.themeName,
        run.dangerEl,
        run.menuBtn,
      ),
      h('div', { class: 'hp-line' },
        h('span', { class: 'tiny', text: 'HP' }),
        h('div', { class: 'bar hp' }, run.hpFill),
        run.hpNum,
        run.apPips,
      ),
      h('div', { class: 'hp-line' },
        h('span', { class: 'tiny', text: 'MP' }),
        h('div', { class: 'bar mp' }, run.mpFill),
        run.mpNum,
        run.statLine,
      ),
    ),
    run.mapWrap,
    run.logEl,
    h('div', { class: 'action-area' },
      run.skillsEl,
      h('div', { class: 'action-row' }, run.itemsBtn, run.endTurnBtn, run.autoBtn),
    ),
  );

  run.canvas.addEventListener('pointerdown', (e) => run.onCanvasTap(e));
  mount('#screen', run.root);
}
