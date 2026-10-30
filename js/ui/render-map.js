import { hashString } from '../core/rng.js';
import { EFFECTS } from '../data/skills.js';

const TILE = 32;

const PALETTES = {
  threshold: { floor: '#2b2326', floor2: '#261f22', wall: '#151015', wallTop: '#241b23', edge: '#40303a', accent: '#c9a86a', fog: '#08050a', dust: '#5b4a42' },
  warrens:   { floor: '#242b20', floor2: '#1f261c', wall: '#10140f', wallTop: '#1c2318', edge: '#39452f', accent: '#8fa96a', fog: '#060906', dust: '#4b5a3a' },
  depths:    { floor: '#1e2731', floor2: '#1a222c', wall: '#0c1118', wallTop: '#18212c', edge: '#2f404f', accent: '#6d97b8', fog: '#05080b', dust: '#3d5364' },
  abyss:     { floor: '#261c31', floor2: '#21182b', wall: '#120c1a', wallTop: '#1f152d', edge: '#3d2a50', accent: '#a06fc4', fog: '#07040a', dust: '#4f3466' },
  zenith:    { floor: '#2f2936', floor2: '#2a2430', wall: '#17131b', wallTop: '#251f28', edge: '#4a4054', accent: '#e7cf98', fog: '#08060b', dust: '#6c5d55' },
};

const HERO_CLOAKS = ['#8c3f4e', '#3f6b8c', '#5b7a4a', '#6b4a8c', '#8c6b3f', '#4a6b6b'];

function paletteFor(fd) {
  return PALETTES[fd.theme?.id] || PALETTES.threshold;
}

function hash2(x, y) {
  return hashString(`${x}:${y}`);
}

function px(v) {
  return Math.round(v);
}

function drawShadow(ctx, x, y, w = 20) {
  ctx.save();
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x + TILE / 2, y + TILE - 7, w / 2, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHealthBar(ctx, x, y, hp, maxHp, width = 24) {
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  const bx = px(x + (TILE - width) / 2);
  const by = y + 3;
  ctx.fillStyle = 'rgba(5,3,8,.85)';
  ctx.fillRect(bx, by, width, 3);
  ctx.fillStyle = pct > 0.55 ? '#6d9b6f' : pct > 0.25 ? '#c9a86a' : '#c0575f';
  ctx.fillRect(bx, by, Math.max(1, px(width * pct)), 3);
}

function drawStatusDots(ctx, actor, x, y) {
  const ids = (actor.statuses || []).filter(s => s.dur > 0).slice(0, 5);
  ids.forEach((st, i) => {
    const eff = EFFECTS[st.id];
    ctx.fillStyle = eff?.color || '#fff';
    ctx.fillRect(x + 6 + i * 5, y + 26, 3, 3);
  });
}

function drawHeroFigure(ctx, cx, cy, color, { echo = false, t = 0, scale = 1 } = {}) {
  const x = cx;
  const y = cy;
  ctx.save();
  ctx.translate(x + TILE / 2, y + TILE / 2);
  ctx.scale(scale, scale);
  if (echo) ctx.globalAlpha = 0.82;
  // cloak
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-7, 11);
  ctx.lineTo(-5, -3);
  ctx.lineTo(5, -3);
  ctx.lineTo(7, 11);
  ctx.closePath();
  ctx.fill();
  // inner cloak shade
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(-2, -2, 4, 11);
  // hood
  ctx.fillStyle = echo ? '#2a1838' : '#1b141c';
  ctx.beginPath();
  ctx.arc(0, -6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -7, 6, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();
  // eyes
  ctx.fillStyle = echo ? '#e4c6ff' : '#ffd98a';
  ctx.fillRect(-3, -6, 2, 1);
  ctx.fillRect(1, -6, 2, 1);
  // weapon
  ctx.strokeStyle = echo ? '#c9a0ff' : '#c9c0b2';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(7, 2);
  ctx.lineTo(10, -8);
  ctx.stroke();
  if (echo) {
    ctx.globalAlpha = 0.5 + Math.sin(t / 240) * 0.14;
    ctx.fillStyle = '#a06fc4';
    for (let i = 0; i < 4; i++) {
      const phase = t / 380 + i * 1.7;
      ctx.fillRect(px(Math.sin(phase) * 9), -12 - ((t / 26 + i * 9) % 18), 2, 3);
    }
  }
  ctx.restore();
}

function drawRat(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 8, y + 18, 15, 7);
  ctx.fillRect(x + 20, y + 16, 6, 5);
  ctx.fillStyle = '#3c3126';
  ctx.fillRect(x + 9, y + 24, 2, 4);
  ctx.fillRect(x + 18, y + 24, 2, 4);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 20);
  ctx.quadraticCurveTo(x + 2, y + 16, x + 4, y + 25);
  ctx.stroke();
  ctx.fillStyle = '#e05454';
  ctx.fillRect(x + 23, y + 17, 2, 1);
}

function drawSlime(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x + 16, y + 23, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.fillRect(x + 12, y + 18, 4, 2);
  ctx.fillStyle = '#1d2418';
  ctx.fillRect(x + 12, y + 22, 2, 2);
  ctx.fillRect(x + 19, y + 22, 2, 2);
}

function drawSkeleton(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 13, y + 10, 7, 6);
  ctx.fillRect(x + 15, y + 16, 3, 4);
  ctx.fillRect(x + 12, y + 20, 9, 2);
  ctx.fillRect(x + 13, y + 22, 2, 6);
  ctx.fillRect(x + 18, y + 22, 2, 6);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 13, y + 19 + i * 2);
    ctx.lineTo(x + 20, y + 19 + i * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#e05454';
  ctx.fillRect(x + 14, y + 12, 2, 1);
  ctx.fillRect(x + 18, y + 12, 2, 1);
}

function drawCultist(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 16, y + 8);
  ctx.lineTo(x + 24, y + 27);
  ctx.lineTo(x + 8, y + 27);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1a1020';
  ctx.beginPath();
  ctx.arc(x + 16, y + 12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e6b6ff';
  ctx.fillRect(x + 13, y + 11, 2, 1);
  ctx.fillRect(x + 18, y + 11, 2, 1);
  ctx.strokeStyle = '#c9a86a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 24, y + 12);
  ctx.lineTo(x + 26, y + 27);
  ctx.stroke();
}

function drawHound(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 7, y + 18, 17, 7);
  ctx.fillRect(x + 21, y + 15, 6, 7);
  ctx.fillRect(x + 25, y + 12, 2, 4);
  ctx.fillStyle = '#2e2019';
  ctx.fillRect(x + 9, y + 24, 2, 4);
  ctx.fillRect(x + 20, y + 24, 2, 4);
  ctx.fillStyle = '#f0c060';
  ctx.fillRect(x + 23, y + 17, 2, 1);
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 7, y + 19);
  ctx.lineTo(x + 2, y + 14);
  ctx.stroke();
}

function drawWraith(ctx, x, y, color, t) {
  ctx.save();
  ctx.globalAlpha = 0.82 + Math.sin(t / 300) * 0.08;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 16, y + 7);
  ctx.quadraticCurveTo(x + 26, y + 12, x + 23, y + 25);
  ctx.quadraticCurveTo(x + 20, y + 21, x + 18, y + 26);
  ctx.quadraticCurveTo(x + 16, y + 21, x + 14, y + 26);
  ctx.quadraticCurveTo(x + 12, y + 21, x + 9, y + 25);
  ctx.quadraticCurveTo(x + 6, y + 12, x + 16, y + 7);
  ctx.fill();
  ctx.fillStyle = '#161024';
  ctx.beginPath();
  ctx.arc(x + 16, y + 14, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8c6ff';
  ctx.fillRect(x + 13, y + 13, 2, 2);
  ctx.fillRect(x + 18, y + 13, 2, 2);
  ctx.restore();
}

function drawGolem(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 8, y + 12, 16, 13);
  ctx.fillRect(x + 6, y + 14, 3, 9);
  ctx.fillRect(x + 23, y + 14, 3, 9);
  ctx.fillRect(x + 10, y + 25, 4, 5);
  ctx.fillRect(x + 18, y + 25, 4, 5);
  ctx.fillStyle = '#4a5560';
  ctx.fillRect(x + 10, y + 15, 12, 2);
  ctx.fillStyle = '#8fe0ff';
  ctx.fillRect(x + 13, y + 18, 3, 2);
  ctx.fillRect(x + 18, y + 18, 3, 2);
  ctx.strokeStyle = '#2c343d';
  ctx.strokeRect(x + 8.5, y + 12.5, 15, 12);
}

function drawImp(ctx, x, y, color, t) {
  const bob = Math.sin(t / 220) * 1.5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + 16, y + 19 + bob, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 18 + bob);
  ctx.lineTo(x + 4, y + 12 + bob);
  ctx.lineTo(x + 9, y + 22 + bob);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 18 + bob);
  ctx.lineTo(x + 28, y + 12 + bob);
  ctx.lineTo(x + 23, y + 22 + bob);
  ctx.fill();
  ctx.fillStyle = '#2a1010';
  ctx.fillRect(x + 12, y + 14 + bob, 2, 3);
  ctx.fillRect(x + 18, y + 14 + bob, 2, 3);
  ctx.fillStyle = '#ffd27a';
  ctx.fillRect(x + 13, y + 18 + bob, 5, 1);
}

function drawKnight(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 10, y + 12, 12, 12);
  ctx.fillRect(x + 11, y + 24, 4, 5);
  ctx.fillRect(x + 18, y + 24, 4, 5);
  ctx.fillRect(x + 8, y + 14, 3, 7);
  ctx.fillRect(x + 22, y + 14, 3, 7);
  ctx.fillStyle = '#26202a';
  ctx.fillRect(x + 12, y + 15, 9, 3);
  ctx.fillStyle = '#e05454';
  ctx.fillRect(x + 14, y + 16, 2, 1);
  ctx.fillStyle = '#d8d0c2';
  ctx.fillRect(x + 25, y + 8, 1, 16);
  ctx.fillRect(x + 23, y + 8, 5, 1);
  ctx.fillStyle = '#b23b4c';
  ctx.fillRect(x + 13, y + 21, 7, 2);
}

function drawEye(ctx, x, y, color, t) {
  const pulse = 1 + Math.sin(t / 330) * 0.06;
  ctx.save();
  ctx.translate(x + 16, y + 18);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0e6ff';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b1b5e';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#160d1f';
  ctx.beginPath();
  ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const bx = x + 8 + i * 5;
    const sway = Math.sin(t / 300 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(bx, y + 25);
    ctx.quadraticCurveTo(bx + sway, y + 29, bx - 1, y + 31);
    ctx.stroke();
  }
}

function drawBoss(ctx, x, y, color, t) {
  ctx.save();
  ctx.translate(x + 16, y + 16);
  const scale = 1.25 + Math.sin(t / 500) * 0.02;
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-9, 15);
  ctx.lineTo(-7, -6);
  ctx.lineTo(7, -6);
  ctx.lineTo(9, 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1a1420';
  ctx.beginPath();
  ctx.arc(0, -8, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -10, 7, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(-4, -9, 3, 2);
  ctx.fillRect(2, -9, 3, 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-7, -14);
  ctx.lineTo(-11, -22);
  ctx.lineTo(-3, -16);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(7, -14);
  ctx.lineTo(11, -22);
  ctx.lineTo(3, -16);
  ctx.fill();
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(10, 10);
  ctx.lineTo(15, -12);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.5 + Math.sin(t / 260) * 0.25;
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(x + 16, y + 8, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSprite(ctx, actor, t) {
  const x = actor.x * TILE;
  const y = actor.y * TILE;
  drawShadow(ctx, x, y, actor.boss ? 26 : 20);
  switch (actor.sprite) {
    case 'rat': drawRat(ctx, x, y, actor.color); break;
    case 'slime': drawSlime(ctx, x, y, actor.color); break;
    case 'skeleton': drawSkeleton(ctx, x, y, actor.color); break;
    case 'cultist': drawCultist(ctx, x, y, actor.color); break;
    case 'hound': drawHound(ctx, x, y, actor.color); break;
    case 'wraith': drawWraith(ctx, x, y, actor.color, t); break;
    case 'golem': drawGolem(ctx, x, y, actor.color); break;
    case 'imp': drawImp(ctx, x, y, actor.color, t); break;
    case 'knight': drawKnight(ctx, x, y, actor.color); break;
    case 'eye': drawEye(ctx, x, y, actor.color, t); break;
    case 'boss': drawBoss(ctx, x, y, actor.color, t); break;
    case 'echo': drawHeroFigure(ctx, x, y, '#a06fc4', { echo: true, t }); break;
    default: drawSlime(ctx, x, y, actor.color); break;
  }
  if (actor.hp < actor.maxHp || actor.isEcho || actor.boss) {
    drawHealthBar(ctx, x, y, actor.hp, actor.maxHp, actor.boss ? 28 : 24);
  }
  drawStatusDots(ctx, actor, x, y);
}

function drawPlayer(ctx, player, t) {
  const x = player.x * TILE;
  const y = player.y * TILE;
  drawShadow(ctx, x, y, 22);
  const color = player.cloak || HERO_CLOAKS[hashString(player.classId || 'hero') % HERO_CLOAKS.length];
  // selection ring
  ctx.save();
  ctx.strokeStyle = 'rgba(201,168,106,.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x + 16, y + 28, 12 + Math.sin(t / 360) * 1.2, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  drawHeroFigure(ctx, x, y, color, { t });
  if (player.hp < player.maxHp) drawHealthBar(ctx, x, y, player.hp, player.maxHp, 26);
  drawStatusDots(ctx, player, x, y);
}

function drawTile(ctx, fd, x, y, pal, t, explored, visible, time) {
  const px0 = x * TILE;
  const py0 = y * TILE;
  const wall = fd.grid[y][x] === 0;
  const h = hash2(x, y);
  if (!explored) {
    ctx.fillStyle = pal.fog;
    ctx.fillRect(px0, py0, TILE, TILE);
    return;
  }
  if (wall) {
    ctx.fillStyle = pal.wall;
    ctx.fillRect(px0, py0, TILE, TILE);
    const hasFloorNeighbor = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fd.grid[y + dy]?.[x + dx] === 1);
    if (hasFloorNeighbor) {
      ctx.fillStyle = pal.wallTop;
      ctx.fillRect(px0, py0 + 2, TILE, 4);
      ctx.fillStyle = pal.edge;
      ctx.fillRect(px0, py0 + 22, TILE, 1);
    }
    // brick seams
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(px0 + (h % 3) * 7, py0 + 10 + (h % 2) * 6, 11, 1);
    ctx.fillRect(px0 + ((h >> 3) % 3) * 7, py0 + 18 + ((h >> 2) % 2) * 4, 8, 1);
  } else {
    ctx.fillStyle = (x + y) % 2 === 0 ? pal.floor : pal.floor2;
    ctx.fillRect(px0, py0, TILE, TILE);
    const decor = fd.decorGrid?.[y]?.[x] || 0;
    if (decor === 1) {
      ctx.strokeStyle = 'rgba(0,0,0,.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px0 + 6 + (h % 8), py0 + 8);
      ctx.lineTo(px0 + 12 + (h % 6), py0 + 15);
      ctx.lineTo(px0 + 9 + (h % 9), py0 + 24);
      ctx.stroke();
    } else if (decor === 2) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(time / 900 + h % 10) * 0.15;
      ctx.fillStyle = pal.accent;
      ctx.fillRect(px0 + 12, py0 + 12, 2, 8);
      ctx.fillRect(px0 + 9, py0 + 15, 8, 2);
      ctx.restore();
    } else if (decor === 3) {
      ctx.fillStyle = 'rgba(190,180,160,.35)';
      ctx.fillRect(px0 + 7, py0 + 21, 4, 2);
      ctx.fillRect(px0 + 12, py0 + 23, 2, 1);
      ctx.fillRect(px0 + 20, py0 + 18, 3, 1);
    } else if (decor === 4) {
      ctx.fillStyle = 'rgba(90,130,80,.18)';
      ctx.fillRect(px0 + 20, py0 + 8, 5, 3);
      ctx.fillRect(px0 + 22, py0 + 11, 3, 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px0 + 0.5, py0 + 0.5, TILE - 1, TILE - 1);
  }

  if (!visible) {
    ctx.fillStyle = 'rgba(5,3,8,.5)';
    ctx.fillRect(px0, py0, TILE, TILE);
  }

  if (fd.stairs.x === x && fd.stairs.y === y) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(px0 + 5, py0 + 6, 22, 20);
    ctx.fillStyle = pal.accent;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.7 - i * 0.16;
      ctx.fillRect(px0 + 7 + i * 4, py0 + 8 + i * 6, 18 - i * 8, 3);
    }
    ctx.globalAlpha = 0.25 + Math.sin(t / 500) * 0.12;
    ctx.fillRect(px0 + 4, py0 + 4, 24, 24);
    ctx.restore();
  }

  const chest = fd.chests.find(c => c.x === x && c.y === y && !c.opened);
  if (chest) {
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(px0 + 9, py0 + 13, 14, 11);
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(px0 + 9, py0 + 13, 14, 2);
    ctx.fillRect(px0 + 14, py0 + 18, 4, 4);
    ctx.fillStyle = '#f0d79a';
    ctx.fillRect(px0 + 15, py0 + 19, 2, 2);
  }

  const trap = fd.traps.find(tr => tr.x === x && tr.y === y && tr.revealed && !tr.disarmed && !tr.triggered);
  if (trap) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = trap.kind === 'venom' ? '#8fc75f' : trap.kind === 'ember' ? '#ff8a5c' : '#c0575f';
    ctx.fillRect(px0 + 8, py0 + 8, 2, 2);
    ctx.fillRect(px0 + 22, py0 + 8, 2, 2);
    ctx.fillRect(px0 + 15, py0 + 15, 2, 2);
    ctx.fillRect(px0 + 8, py0 + 22, 2, 2);
    ctx.fillRect(px0 + 22, py0 + 22, 2, 2);
    ctx.restore();
  }
}

export class MapRenderer {
  constructor(canvas, layer) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layer = layer;
    this.state = null;
    this.running = false;
    this.last = 0;
    this.t = 0;
    this.frame = this.frame.bind(this);
    canvas.width = 15 * TILE;
    canvas.height = 13 * TILE;
    this.ctx.imageSmoothingEnabled = false;
  }

  setState(state) {
    this.state = state;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
  }

  frame(ts) {
    if (!this.running) return;
    if (!this.last || ts - this.last > 75) {
      this.last = ts;
      this.t = ts;
      this.draw(ts);
    }
    requestAnimationFrame(this.frame);
  }

  draw(time = this.t) {
    const state = this.state;
    if (!state || !state.fd) return;
    const { fd, explored, visible, player, enemies } = state;
    const ctx = this.ctx;
    const pal = paletteFor(fd);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = pal.fog;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < fd.h; y++) {
      for (let x = 0; x < fd.w; x++) {
        const idx = y * fd.w + x;
        drawTile(ctx, fd, x, y, pal, time, explored.has(idx), visible.has(idx), time);
      }
    }

    // targeting highlight
    if (state.rangeHighlight?.size) {
      ctx.save();
      ctx.fillStyle = 'rgba(201,168,106,.14)';
      ctx.strokeStyle = 'rgba(201,168,106,.28)';
      for (const idx of state.rangeHighlight) {
        const x = idx % fd.w;
        const y = Math.floor(idx / fd.w);
        ctx.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
        ctx.strokeRect(x * TILE + 2.5, y * TILE + 2.5, TILE - 5, TILE - 5);
      }
      ctx.restore();
    }
    if (state.aoePreview?.length) {
      ctx.save();
      ctx.fillStyle = 'rgba(215,90,108,.2)';
      ctx.strokeStyle = 'rgba(215,90,108,.5)';
      for (const tile of state.aoePreview) {
        ctx.fillRect(tile.x * TILE + 2, tile.y * TILE + 2, TILE - 4, TILE - 4);
        ctx.strokeRect(tile.x * TILE + 2.5, tile.y * TILE + 2.5, TILE - 5, TILE - 5);
      }
      ctx.restore();
    }

    for (const chest of fd.chests) {
      if (!chest.opened) continue;
    }

    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const idx = enemy.y * fd.w + enemy.x;
      if (!visible.has(idx)) continue;
      drawSprite(ctx, enemy, time);
    }

    if (player) drawPlayer(ctx, player, time);

    // lighting
    const cx = (player.x + 0.5) * TILE;
    const cy = (player.y + 0.5) * TILE;
    const grad = ctx.createRadialGradient(cx, cy, TILE * 0.8, cx, cy, TILE * 5.2);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.65, 'rgba(4,2,7,.18)');
    grad.addColorStop(1, 'rgba(4,2,7,.62)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // subtle scanline / grain
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = '#fff';
    for (let yy = 0; yy < this.canvas.height; yy += 4) ctx.fillRect(0, yy, this.canvas.width, 1);
    ctx.restore();
  }
}

export { TILE };
