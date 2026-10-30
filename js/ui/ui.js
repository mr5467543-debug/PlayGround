export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'attrs') for (const [ak, av] of Object.entries(v)) el.setAttribute(ak, av);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function mount(target, ...nodes) {
  const el = typeof target === 'string' ? $(target) : target;
  clear(el);
  append(el, nodes);
  return el;
}

export function bar(cls, value, max, extra = '') {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return h('div', { class: `bar ${cls} ${extra}` }, h('i', { style: { width: `${pct}%` } }));
}

let sheetState = null;

export function openSheet({ kicker = '', title = '', body = null, actions = [], dismissible = true, narrow = false, onClose = null } = {}) {
  closeSheet({ silent: true });
  const overlay = document.getElementById('overlay');
  const bodyEl = h('div', { class: 'sheet-body' }, body);
  const head = h('div', { class: 'sheet-head' },
    h('div', {},
      kicker ? h('div', { class: 'kicker', text: kicker }) : null,
      h('h2', { text: title }),
    ),
    h('button', { class: 'icon-btn x', attrs: { 'aria-label': 'Close' }, text: '✕', onclick: () => closeSheet() }),
  );
  const foot = actions.length ? h('div', { class: 'sheet-foot' },
    actions.map(a => h('button', {
      class: `btn ${a.kind || ''}`,
      text: a.label,
      disabled: !!a.disabled,
      onclick: () => {
        if (a.onClick) a.onClick();
        if (a.close !== false) closeSheet();
      },
    })),
  ) : null;
  const sheet = h('div', { class: `sheet ${narrow ? 'narrow' : ''}` }, head, bodyEl, foot);
  overlay.innerHTML = '';
  overlay.append(sheet);
  overlay.classList.remove('hidden');

  const onKey = (e) => {
    if (e.key === 'Escape' && dismissible) closeSheet();
  };
  document.addEventListener('keydown', onKey);
  const onBackdrop = (e) => {
    if (e.target === overlay && dismissible) closeSheet();
  };
  overlay.addEventListener('click', onBackdrop);

  sheetState = { overlay, sheet, bodyEl, onClose, onKey, onBackdrop, dismissible };
  return {
    el: sheet,
    body: bodyEl,
    close: () => closeSheet(),
  };
}

export function closeSheet({ silent = false } = {}) {
  if (!sheetState) return;
  const { overlay, onClose, onKey, onBackdrop } = sheetState;
  document.removeEventListener('keydown', onKey);
  overlay.removeEventListener('click', onBackdrop);
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
  sheetState = null;
  if (!silent && onClose) onClose();
}

export function isSheetOpen() {
  return !!sheetState;
}

let toastTimer = null;
export function toast(message, kind = '', duration = 2300) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = `toast ${kind}`;
  }, duration);
}

export function shakeApp() {
  const app = document.getElementById('app');
  app.classList.remove('shake');
  void app.offsetWidth;
  app.classList.add('shake');
}

export function floatText(layer, tile, text, kind = '') {
  if (!layer) return;
  const el = h('div', {
    class: `float-text ${kind}`,
    text,
    style: {
      left: `${((tile.x + 0.5) / 15) * 100}%`,
      top: `${((tile.y + 0.15) / 13) * 100}%`,
    },
  });
  layer.append(el);
  setTimeout(() => el.remove(), 1150);
}

export function confirmSheet({ kicker, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm }) {
  openSheet({
    kicker, title, body,
    narrow: true,
    actions: [
      { label: cancelLabel, kind: 'ghost' },
      { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: onConfirm },
    ],
  });
}

export function formatGold(n) {
  return `${Math.round(n)}g`;
}
