(() => {
  'use strict';

  const body = document.body;

  // Class explorer filtering -------------------------------------------------
  const grid = document.querySelector('[data-class-grid]');
  if (grid) {
    const cards = Array.from(grid.querySelectorAll('[data-class-card]'));
    const buttons = Array.from(document.querySelectorAll('[data-filter]'));
    const search = document.querySelector('[data-class-search]');
    const count = document.querySelector('[data-result-count]');
    const empty = document.querySelector('[data-empty-state]');
    let active = 'all';

    const apply = () => {
      const query = (search?.value || '').trim().toLowerCase();
      let visible = 0;
      for (const card of cards) {
        const kind = card.dataset.kind;
        const haystack = card.dataset.search || '';
        const matchesKind = active === 'all' || kind === active;
        const matchesQuery = !query || haystack.includes(query);
        const show = matchesKind && matchesQuery;
        card.hidden = !show;
        if (show) visible += 1;
      }
      if (count) count.textContent = `${visible} / ${cards.length} callings`;
      if (empty) empty.hidden = visible !== 0;
    };

    for (const button of buttons) {
      button.addEventListener('click', () => {
        active = button.dataset.filter;
        for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
        apply();
      });
    }
    search?.addEventListener('input', apply);
    apply();
  }

  // Section reveal ----------------------------------------------------------
  const reveals = Array.from(document.querySelectorAll('[data-reveal]'));
  if (reveals.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    for (const element of reveals) observer.observe(element);
  } else {
    for (const element of reveals) element.classList.add('is-in');
  }

  // Documentation table of contents ----------------------------------------
  const toc = document.querySelector('[data-toc]');
  if (toc) {
    const links = Array.from(toc.querySelectorAll('a[href^="#"]'));
    const targets = links
      .map((link) => ({ link, target: document.getElementById(decodeURIComponent(link.hash.slice(1))) }))
      .filter((item) => item.target);
    if (targets.length && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const hit = targets.find((item) => item.target === entry.target);
          if (!hit) continue;
          for (const item of links) item.removeAttribute('aria-current');
          hit.link.setAttribute('aria-current', 'true');
        }
      }, { rootMargin: '-12% 0px -70% 0px' });
      for (const item of targets) observer.observe(item.target);
    }
  }

  body.dataset.rendered = 'true';
  window.__ECHO_READY__ = true;
})();
