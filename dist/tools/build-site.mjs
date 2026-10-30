#!/usr/bin/env node
// Build the static design dossier into dist/ with no external dependencies.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classify, enumerateAllocations, loadClasses } from './class-engine.mjs'
import { renderMarkdown } from './markdown.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')

const esc = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const classesJson = JSON.parse(readFileSync(join(root, 'design/classes.json'), 'utf8'))
const skillsJson = JSON.parse(readFileSync(join(root, 'design/skills.json'), 'utf8'))
const classes = loadClasses(classesJson)

// Exact build counts from the executable class engine.
const buildCounts = new Map(classes.map((cls) => [cls.id, 0]))
let totalBuilds = 0
for (const allocation of enumerateAllocations()) {
  const cls = classify(classes, allocation)
  if (!cls) throw new Error(`Unclassified allocation: ${JSON.stringify(allocation)}`)
  buildCounts.set(cls.id, buildCounts.get(cls.id) + 1)
  totalBuilds += 1
}

const archetypes = ['pure', 'hybrid', 'tank', 'secret']
const archetypeLabels = { pure: 'Pure', hybrid: 'Hybrid', tank: 'Tank', secret: 'Secret' }
const archetypeCounts = Object.fromEntries(archetypes.map((kind) => [kind, classes.filter((cls) => cls.archetype === kind).length]))

const operatorSymbol = { '>=': '≥', '<=': '≤', '==': '=', '>': '>', '<': '<' }
const describeRequirement = (cls) => {
  if (cls.requires?.multiset) return `Spread ${cls.requires.multiset.join(' / ')}`
  const conditions = cls.requires?.if || []
  if (!conditions.length) return 'Lane default'
  return conditions.map(([stat, op, value]) => `${stat} ${operatorSymbol[op] || op} ${value}`).join(' · ')
}

const signatureSkill = (id) => {
  const kit = skillsJson[id]
  return kit?.skills?.[0]?.name || '—'
}

// ---------------------------------------------------------------- templates

const navItems = [
  ['index.html', 'Overview'],
  ['gdd.html', 'Game design'],
  ['tech.html', 'Technical plan'],
  ['classes.html', 'Class matrix']
]

const layout = ({ title, description, current, content, pageClass = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/styles.css">
</head>
<body class="${esc(pageClass)}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="shell">
    <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">E</span>Echoes of the 100th Floor</a>
    <nav class="site-nav" aria-label="Primary">
      ${navItems.map(([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ')}
    </nav>
    <span class="version-tag">Dossier v1.0</span>
  </div>
</header>
<main id="main">
${content}
</main>
<footer class="site-footer">
  <div class="shell">
    <p>Echoes of the 100th Floor · design dossier v1.0 · ${totalBuilds.toLocaleString('en-US')} legal builds, ${classes.length} callings</p>
    <div class="footer-links">
      <a href="gdd.html">GDD</a>
      <a href="tech.html">Tech plan</a>
      <a href="classes.html">Class matrix</a>
      <a href="design/classes.json">classes.json</a>
    </div>
  </div>
</footer>
<script src="assets/app.js" defer></script>
</body>
</html>
`

const floorBands = [
  ['1–10', 'The Threshold', 'Collapsed guild barracks, moss, candlelight', 'Tutorial: AP, flanking, traps, extraction', 'The Gatekeeper'],
  ['11–30', 'The Warrens', 'Flooded tunnels, fungus, fire vents', 'Elemental hazards; WIS trap detection', 'The Flood · The Brood Mother'],
  ['31–60', 'The Depths', 'Black masonry, forges, bone cathedrals', 'Elites; mini-bosses every 5; durability pressure', 'The Forge Saint · The Choir · The Warden'],
  ['61–90', 'The Abyss', 'Inverted rooms, starless voids, mirror halls', 'Reality rules per floor: gravity, mirrors, loops', 'The Mirror · The Hollow King · The Unmade'],
  ['91–100', 'The Zenith', 'Gold, white marble, impossible light', 'Fixed gauntlet; no extraction until 100', 'The First Echo']
]

const obelisk = () => {
  const bands = []
  for (let high = 100; high >= 10; high -= 10) {
    const cells = []
    for (let floor = high - 9; floor <= high; floor += 1) {
      const cap = floor === 100 ? ' gate' : floor % 10 === 0 ? ' cap' : ''
      cells.push(`<span class="cell${cap}" title="Floor ${floor}"></span>`)
    }
    bands.push(`<div class="floor-band"><span>${high - 9}–${high}</span><span class="cells" aria-hidden="true">${cells.join('')}</span></div>`)
  }
  return `<div class="obelisk-wrap" aria-hidden="true">
      <div class="obelisk">
        <p class="obelisk-title">Persistent dungeon · 100 floors</p>
        <div class="floors">${bands.join('')}</div>
        <p class="obelisk-caption">Boss floor · every 10</p>
      </div>
    </div>`
}

const classCards = classes.map((cls) => {
  const kind = cls.archetype
  const search = [cls.name, cls.id, cls.lane, kind, cls.role, cls.passive, signatureSkill(cls.id)].join(' ').toLowerCase()
  return `<article class="class-card" data-class-card data-kind="${esc(kind)}" data-search="${esc(search)}">
        <div class="class-top"><span class="lane">${esc(cls.lane || 'Global')}</span><span class="builds">${buildCounts.get(cls.id)} builds</span></div>
        <h3>${esc(cls.name)}</h3>
        <p class="epithet">“${esc(cls.epithet)}”</p>
        <p class="req">${esc(describeRequirement(cls))}</p>
        <p class="passive">${esc(cls.passive)}</p>
        <div class="sig"><span>${esc(cls.role)}</span><b>${esc(signatureSkill(cls.id))}</b></div>
      </article>`
}).join('\n      ')

const landing = `
<section class="hero">
  <div class="shell">
    <div class="hero-grid">
      <div>
        <p class="kicker">Mobile tactical roguelike · design dossier v1.0</p>
        <h1>Every death becomes a boss on the <span class="accent">100th floor.</span></h1>
        <p class="hero-lede">A portrait, offline-first tactical RPG where your corpse keeps your build. Ten stat points derive one of <strong>50 callings</strong>. The hero you lose becomes the enemy you must fight back down to reclaim.</p>
        <div class="hero-actions">
          <a class="btn" href="gdd.html">Read the game design doc</a>
          <a class="btn ghost" href="#classes">Explore the 50 classes</a>
        </div>
        <div class="stat-row">
          <div class="stat"><strong>${classes.length}</strong><span>Callings</span></div>
          <div class="stat"><strong>${totalBuilds.toLocaleString('en-US')}</strong><span>Legal builds</span></div>
          <div class="stat"><strong>100</strong><span>Persistent floors</span></div>
          <div class="stat"><strong>0</strong><span>Respecs</span></div>
        </div>
      </div>
      ${obelisk()}
    </div>
  </div>
</section>

<section class="block" id="loop">
  <div class="shell">
    <div class="section-head" data-reveal>
      <div>
        <p class="eyebrow">The Echo loop</p>
        <h2>Death is a place, not a reset.</h2>
      </div>
      <p>The only true loss is the time you choose not to spend. The dungeon keeps everything else.</p>
    </div>
    <div class="loop">
      <article class="loop-step death" data-reveal>
        <h3>The hero falls</h3>
        <p>HP reaches zero. The run ends permanently. Kit, gear, and the death tile are stamped into the floor.</p>
      </article>
      <article class="loop-step echo" data-reveal>
        <h3>The Echo wakes</h3>
        <p>A named AI combatant now holds that floor, scored from the same skills you used — desaturated, slower, wrong.</p>
      </article>
      <article class="loop-step descent" data-reveal>
        <h3>A new hero descends</h3>
        <p>Ten points make a different calling. Layouts, secrets, shortcuts, and corpses are exactly where you left them.</p>
      </article>
      <article class="loop-step reclaim" data-reveal>
        <h3>Reclaim or fall again</h3>
        <p>Beat the Echo to recover its gear and memory. Fail, and the floor keeps another corpse with your name on it.</p>
      </article>
    </div>
  </div>
</section>

<section class="block" id="classes">
  <div class="shell">
    <div class="section-head" data-reveal>
      <div>
        <p class="eyebrow">Stat-Lock engine</p>
        <h2>50 callings from one allocation.</h2>
      </div>
      <p>Allocate 10 points across six stats. Secrets resolve first, the two highest stats pick a lane, and thresholds inside the lane pick the class. Every legal build resolves to exactly one calling.</p>
    </div>
    <div class="explorer-controls" role="group" aria-label="Filter classes">
      <button class="filter-btn" type="button" data-filter="all" aria-pressed="true">All ${classes.length}</button>
      ${archetypes.map((kind) => `<button class="filter-btn" type="button" data-filter="${kind}" aria-pressed="false">${archetypeLabels[kind]} ${archetypeCounts[kind]}</button>`).join('\n      ')}
      <input class="search" type="search" data-class-search placeholder="Search name, lane, role…" aria-label="Search classes">
      <span class="result-count" data-result-count>${classes.length} / ${classes.length} callings</span>
    </div>
    <div class="class-grid" data-class-grid>
      ${classCards}
    </div>
    <p class="empty-state" data-empty-state hidden>No calling matches that filter. The dungeon is empty — for now.</p>
  </div>
</section>

<section class="block" id="floors">
  <div class="shell">
    <div class="section-head" data-reveal>
      <div>
        <p class="eyebrow">The descent</p>
        <h2>Five bands. One hundred floors.</h2>
      </div>
      <p>Each band changes a rule, not just a tileset. Floors 1–10 teach; 11–90 procedurally vary; 91–100 become a fixed gauntlet.</p>
    </div>
    <div class="table-scroll" data-reveal>
      <table>
        <thead><tr><th>Floors</th><th>Band</th><th>Theme</th><th>New rule</th><th>Bosses</th></tr></thead>
        <tbody>
          ${floorBands.map(([floors, band, theme, rule, boss]) => `<tr><td><strong>${floors}</strong></td><td><strong>${band}</strong></td><td>${theme}</td><td>${rule}</td><td>${boss}</td></tr>`).join('\n          ')}
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="block" id="documents">
  <div class="shell">
    <div class="section-head" data-reveal>
      <div>
        <p class="eyebrow">The dossier</p>
        <h2>Rules, budgets, and the whole graveyard.</h2>
      </div>
      <p>Everything below is generated from the repository's design source. The class engine is executable and exhaustively tested.</p>
    </div>
    <div class="doc-cards">
      <a class="doc-card" href="gdd.html" data-reveal>
        <span class="doc-index">Document 01</span>
        <h3>Game Design Document</h3>
        <p>Pillars, the Echo system, the Guild Hall, 100 floors, 9×9 combat, mobile UX, art, audio, balance, and risks.</p>
        <span class="doc-meta">17 sections · full GDD</span>
      </a>
      <a class="doc-card" href="tech.html" data-reveal>
        <span class="doc-index">Document 02</span>
        <h3>Technical Plan</h3>
        <p>Godot 4.4 architecture, deterministic simulation, RNG streams, dungeon generation, persistence, budgets, and roadmap.</p>
        <span class="doc-meta">16 sections · implementation</span>
      </a>
      <a class="doc-card" href="classes.html" data-reveal>
        <span class="doc-index">Reference</span>
        <h3>The 50-Class Matrix</h3>
        <p>Every calling, lane, requirement, signature skill, and exact build count — generated from <code>design/classes.json</code>.</p>
        <span class="doc-meta">Generated · ${totalBuilds.toLocaleString('en-US')} builds</span>
      </a>
    </div>
  </div>
</section>
`

// -------------------------------------------------------------- doc pages

const pageFor = new Map([
  ['GDD.md', 'gdd.html'],
  ['TECH_PLAN.md', 'tech.html'],
  ['CLASS_MATRIX.md', 'classes.html'],
  ['README.md', 'index.html'],
  ['../README.md', 'index.html']
])

const docLink = (href) => {
  if (/^(https?:|mailto:|#|\/)/i.test(href)) return href
  const [path, hash = ''] = href.split('#')
  if (pageFor.has(path)) return `${pageFor.get(path)}${hash ? `#${hash}` : ''}`
  const basename = path.split('/').pop()
  if (pageFor.has(basename)) return `${pageFor.get(basename)}${hash ? `#${hash}` : ''}`
  if (path.startsWith('../design/') || path.startsWith('../tools/')) return path.slice(3) + (hash ? `#${hash}` : '')
  return href
}

const tocHtml = (toc) => {
  const items = toc.filter((item) => item.level === 2 || item.level === 3)
  let html = '<ol>'
  let subOpen = false
  let liOpen = false
  for (const item of items) {
    if (item.level === 2) {
      if (subOpen) { html += '</ol>'; subOpen = false }
      if (liOpen) html += '</li>'
      html += `<li><a href="#${item.id}">${esc(item.text)}</a>`
      liOpen = true
    } else if (liOpen) {
      if (!subOpen) { html += '<ol>'; subOpen = true }
      html += `<li><a href="#${item.id}">${esc(item.text)}</a></li>`
    }
  }
  if (subOpen) html += '</ol>'
  if (liOpen) html += '</li>'
  return `${html}</ol>`
}

const documents = [
  {
    file: 'docs/GDD.md',
    out: 'gdd.html',
    index: 'Document 01',
    title: 'Game Design Document',
    description: 'The complete game design for Echoes of the 100th Floor: Echo loop, Stat-Lock classes, 100 floors, combat, mobile UX, art, audio, and balance.',
    next: 'tech.html',
    nextLabel: 'Technical Plan'
  },
  {
    file: 'docs/TECH_PLAN.md',
    out: 'tech.html',
    index: 'Document 02',
    title: 'Technical Implementation Plan',
    description: 'Godot 4.4 architecture, deterministic simulation, dungeon generation, persistence, mobile budgets, CI, and roadmap for Echoes of the 100th Floor.',
    next: 'classes.html',
    nextLabel: 'The 50-Class Matrix'
  },
  {
    file: 'docs/CLASS_MATRIX.md',
    out: 'classes.html',
    index: 'Reference',
    title: 'The 50-Class Matrix',
    description: 'Every calling, lane, requirement, signature skill, and exact build count for Echoes of the 100th Floor.',
    next: 'gdd.html',
    nextLabel: 'Game Design Document'
  }
]

const docPages = documents.map((doc) => {
  const source = readFileSync(join(root, doc.file), 'utf8')
  const rendered = renderMarkdown(source, { link: docLink, stripHeader: true })
  const content = `
<section class="doc-hero">
  <div class="shell">
    <a class="back" href="index.html">← Overview</a>
    <p class="eyebrow" style="margin-top:1rem">${esc(doc.index)} · design dossier</p>
    <h1>${esc(rendered.title || doc.title)}</h1>
    <p>${esc(rendered.subtitle || doc.description)}</p>
  </div>
</section>
<div class="shell doc-layout">
  <aside class="doc-toc" data-toc aria-label="On this page">
    <p class="toc-label">On this page</p>
    ${tocHtml(rendered.toc)}
  </aside>
  <article class="prose">
${rendered.html}
    <nav class="doc-footer" aria-label="Document navigation">
      <a href="index.html">← All documents</a>
      <a href="${doc.next}">${esc(doc.nextLabel)} →</a>
    </nav>
  </article>
</div>`
  return {
    out: doc.out,
    html: layout({
      title: `${doc.title} · Echoes of the 100th Floor`,
      description: doc.description,
      current: doc.out,
      content,
      pageClass: 'doc-page'
    })
  }
})

// ------------------------------------------------------------------ assets

rmSync(dist, { recursive: true, force: true })
mkdirSync(join(dist, 'assets'), { recursive: true })

cpSync(join(root, 'site/styles.css'), join(dist, 'assets/styles.css'))
cpSync(join(root, 'site/app.js'), join(dist, 'assets/app.js'))
cpSync(join(root, 'design'), join(dist, 'design'), { recursive: true })
cpSync(join(root, 'tools'), join(dist, 'tools'), { recursive: true })

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" fill="#171210"/>
<rect x="6" y="6" width="52" height="52" fill="none" stroke="#C9A24B" stroke-width="2"/>
<path d="M32 14v36M18 24h28M22 40h20" stroke="#C9A24B" stroke-width="3"/>
<circle cx="32" cy="24" r="5" fill="#8E2B2B"/>
<circle cx="32" cy="40" r="5" fill="#4C7FD6"/>
</svg>
`
writeFileSync(join(dist, 'assets/favicon.svg'), favicon)

writeFileSync(join(dist, 'index.html'), layout({
  title: 'Echoes of the 100th Floor · Design Dossier',
  description: 'A design-first dossier for a hardcore mobile tactical RPG roguelike: 50 Stat-Lock classes, 3,003 builds, 100 persistent floors, and the Echo death loop.',
  current: 'index.html',
  content: landing,
  pageClass: 'landing'
}))

for (const page of docPages) writeFileSync(join(dist, page.out), page.html)

const totalBytes = ['index.html', 'gdd.html', 'tech.html', 'classes.html', 'assets/styles.css', 'assets/app.js']
  .map((file) => readFileSync(join(dist, file)).length)
  .reduce((sum, size) => sum + size, 0)

console.log(`Built dist/: ${docPages.length + 1} pages, ${(totalBytes / 1024).toFixed(1)} KiB of HTML/CSS/JS, ${classes.length} classes, ${totalBuilds} builds.`)
