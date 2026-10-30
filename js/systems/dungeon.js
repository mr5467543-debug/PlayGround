import { rngFrom, randInt, pickWith } from '../core/rng.js';
import { makeEnemy, floorRoster, themeForFloor, bossForFloor, floorDanger } from '../data/enemies.js';
import { key } from './grid.js';

export const MAP_W = 15;
export const MAP_H = 13;

const TUTORIAL_TIPS = {
  1: 'Tap a tile to walk. Tap a foe to strike. The first ten floors are fixed lessons.',
  2: 'Watch your Action Points. Moving and attacking both cost AP; end your turn to refresh.',
  3: 'Chests hide gear. Gear has durability — every fight eats a little of it.',
  4: 'WIS reveals traps as you approach. Tap a revealed trap beside you to disarm it.',
  5: 'Skills cost AP and sometimes MP. Your class decides which skills exist.',
  6: 'If you fall, your body stays here as an Echo. Another hero must come down and beat it.',
  7: 'Memory Shards let you steal one skill from a defeated Echo, regardless of class.',
  8: 'Return alive to bank gear in the Guild stash. Dying leaves everything behind.',
  9: 'Auto-battle can grind cleared floors — but never a floor with an Echo on it.',
  10: 'Beyond this floor, the dungeon stops teaching and starts hunting.',
};

function newGrid(fill = 0) {
  return Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(fill));
}

function roomCenter(r) {
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

function roomsOverlap(a, b) {
  return a.x - 1 < b.x + b.w + 1 && a.x + a.w + 1 > b.x - 1 && a.y - 1 < b.y + b.h + 1 && a.y + a.h + 1 > b.y - 1;
}

function carveRoom(grid, r) {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      grid[y][x] = 1;
    }
  }
}

function carveCorridor(grid, a, b, rng) {
  const horizontalFirst = rng() < 0.5;
  const carveH = (x1, x2, y) => {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) grid[y][x] = 1;
  };
  const carveV = (y1, y2, x) => {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) grid[y][x] = 1;
  };
  if (horizontalFirst) {
    carveH(a.x, b.x, a.y);
    carveV(a.y, b.y, b.x);
  } else {
    carveV(a.y, b.y, a.x);
    carveH(a.x, b.x, b.y);
  }
}

function randomFloorTile(fd, rng, predicate) {
  for (let tries = 0; tries < 500; tries++) {
    const x = randInt(rng, 1, fd.w - 2);
    const y = randInt(rng, 1, fd.h - 2);
    if (fd.grid[y][x] !== 1) continue;
    if (predicate && !predicate(x, y)) continue;
    return { x, y };
  }
  return null;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function generateFloor(meta, floor, echoRecords = []) {
  const fixed = floor <= 10;
  const seed = fixed ? `tutorial:${floor}` : `${meta.seed}:${floor}`;
  const rng = rngFrom(seed, 'layout');
  const theme = themeForFloor(floor);
  const grid = newGrid(0);
  const rooms = [];
  const targetRooms = fixed ? 4 : 6;

  for (let attempt = 0; attempt < 60 && rooms.length < targetRooms; attempt++) {
    const w = randInt(rng, 3, 5);
    const h = randInt(rng, 3, 4);
    const r = { x: randInt(rng, 1, MAP_W - w - 1), y: randInt(rng, 1, MAP_H - h - 1), w, h };
    if (rooms.some(other => roomsOverlap(r, other))) continue;
    rooms.push(r);
    carveRoom(grid, r);
  }

  if (rooms.length === 0) {
    rooms.push({ x: 1, y: 1, w: 6, h: 5 });
    carveRoom(grid, rooms[0]);
  }

  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(grid, roomCenter(rooms[i - 1]), roomCenter(rooms[i]), rng);
  }
  for (let i = 0; i < 2; i++) {
    const a = pickWith(rng, rooms);
    const b = pickWith(rng, rooms);
    if (a !== b) carveCorridor(grid, roomCenter(a), roomCenter(b), rng);
  }

  const startRoom = rooms[0];
  const start = roomCenter(startRoom);
  let stairsRoom = rooms[rooms.length - 1];
  let best = -1;
  for (const r of rooms) {
    const c = roomCenter(r);
    const d = distance(c, start);
    if (d > best) { best = d; stairsRoom = r; }
  }
  const stairs = roomCenter(stairsRoom);
  grid[stairs.y][stairs.x] = 1;

  const taken = new Set([key(start.x, start.y), key(stairs.x, stairs.y)]);
  const near = (p, d) => distance(p, start) < d;

  for (const r of rooms) {
    if (r === startRoom || r === stairsRoom) continue;
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (grid[y][x] !== 1) continue;
        if (taken.has(key(x, y))) continue;
        const roll = rng();
        if (roll < 0.045) grid[y][x] = 0;
        else if (roll < 0.06) taken.add(key(x, y));
      }
    }
  }

  const fd = {
    floor,
    w: MAP_W,
    h: MAP_H,
    grid,
    rooms,
    start,
    stairs,
    theme,
    fixed,
    bossFloor: bossForFloor(floor),
    enemies: [],
    chests: [],
    traps: [],
    echoSpawns: [],
    decor: [],
    danger: floorDanger(floor, echoRecords.length),
    tip: TUTORIAL_TIPS[floor] || null,
  };

  const chestCount = floor <= 2 ? 1 : (rng() < 0.55 ? 2 : 1);
  for (let i = 0; i < chestCount; i++) {
    const p = randomFloorTile(fd, rng, (x, y) => !taken.has(key(x, y)) && !near({ x, y }, 4));
    if (p) {
      taken.add(key(p.x, p.y));
      fd.chests.push({ x: p.x, y: p.y, opened: false });
    }
  }

  if (floor >= 5) {
    const trapCount = Math.min(5, 1 + Math.floor(floor / 22) + (rng() < 0.45 ? 1 : 0));
    const kinds = ['spike', 'ember', 'venom', 'spike', 'ember'];
    for (let i = 0; i < trapCount; i++) {
      const p = randomFloorTile(fd, rng, (x, y) => !taken.has(key(x, y)) && !near({ x, y }, 4));
      if (!p) continue;
      taken.add(key(p.x, p.y));
      fd.traps.push({ x: p.x, y: p.y, kind: pickWith(rng, kinds), revealed: false, triggered: false, disarmed: false });
    }
  }

  const roster = floorRoster(floor, echoRecords.length);
  const bossId = fd.bossFloor;
  const occupied = new Set(taken);
  const spawnEnemy = (templateId, x, y) => {
    const e = makeEnemy(templateId, floor);
    e.x = x;
    e.y = y;
    fd.enemies.push(e);
    occupied.add(key(x, y));
    return e;
  };

  for (const templateId of roster) {
    let p = null;
    if (templateId === bossId) {
      for (const n of [
        { x: stairs.x, y: stairs.y - 1 }, { x: stairs.x - 1, y: stairs.y },
        { x: stairs.x + 1, y: stairs.y }, { x: stairs.x, y: stairs.y + 1 },
      ]) {
        if (fd.grid[n.y]?.[n.x] === 1 && !occupied.has(key(n.x, n.y))) { p = n; break; }
      }
    }
    if (!p) {
      p = randomFloorTile(fd, rng, (x, y) => !occupied.has(key(x, y)) && !near({ x, y }, 5));
    }
    if (!p) p = randomFloorTile(fd, rng, (x, y) => !occupied.has(key(x, y)));
    if (p) spawnEnemy(templateId, p.x, p.y);
  }

  echoRecords.forEach((echo, index) => {
    let p = null;
    const preferred = index === 0 ? stairsRoom : pickWith(rng, rooms.filter(r => r !== startRoom));
    const c = roomCenter(preferred);
    const candidates = [];
    for (let y = preferred.y; y < preferred.y + preferred.h; y++) {
      for (let x = preferred.x; x < preferred.x + preferred.w; x++) {
        if (fd.grid[y][x] === 1 && !occupied.has(key(x, y))) candidates.push({ x, y });
      }
    }
    p = candidates.sort((a, b) => distance(a, c) - distance(b, c))[0] || null;
    if (!p) p = randomFloorTile(fd, rng, (x, y) => !occupied.has(key(x, y)));
    if (!p || key(echo.id) === key(start.x, start.y)) return;
    if (p && p.x === start.x && p.y === start.y) {
      p = randomFloorTile(fd, rng, (x, y) => !occupied.has(key(x, y)) && !(x === start.x && y === start.y));
    }
    if (!p) return;
    occupied.add(key(p.x, p.y));
    fd.echoSpawns.push({ echo, x: p.x, y: p.y });
  });

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const roll = rng();
      fd.decor.push(roll < 0.055 ? 1 : roll < 0.085 ? 2 : roll < 0.105 ? 3 : roll < 0.135 ? 4 : 0);
    }
  }
  fd.decorGrid = [];
  for (let y = 0; y < MAP_H; y++) {
    fd.decorGrid.push(fd.decor.slice(y * MAP_W, (y + 1) * MAP_W));
  }

  return fd;
}

export function revealAround(fd, explored, x, y, radius) {
  let changed = false;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.hypot(dx, dy) > radius + 0.35) continue;
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= fd.w || ty >= fd.h) continue;
      const idx = ty * fd.w + tx;
      if (!explored.has(idx)) {
        explored.add(idx);
        changed = true;
      }
    }
  }
  return changed;
}

export function perceptionRadius(stats) {
  return 3 + Math.floor((stats?.wis || 0) / 2);
}

export function detectTraps(fd, explored, stats, x, y, radius) {
  const revealed = [];
  for (const trap of fd.traps) {
    if (trap.revealed || trap.disarmed) continue;
    const dist = Math.hypot(trap.x - x, trap.y - y);
    if (dist <= radius) {
      trap.revealed = true;
      revealed.push(trap);
      explored.add(trap.y * fd.w + trap.x);
    }
  }
  return revealed;
}

export function findTrapAt(fd, x, y) {
  return fd.traps.find(t => t.x === x && t.y === y && !t.disarmed && !t.triggered);
}

export function findChestAt(fd, x, y) {
  return fd.chests.find(c => c.x === x && c.y === y && !c.opened);
}
