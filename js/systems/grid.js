export function inBounds(fd, x, y) {
  return x >= 0 && y >= 0 && x < fd.w && y < fd.h;
}

export function passable(fd, x, y) {
  return inBounds(fd, x, y) && fd.grid[y][x] === 1;
}

export function key(x, y) {
  return `${x},${y}`;
}

export function chebyshev(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function adjacent(a, b) {
  return chebyshev(a, b) === 1;
}

export function neighbors(x, y) {
  return [
    { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 },
  ];
}

export function lineOfSight(fd, a, b) {
  let x0 = a.x, y0 = a.y;
  const x1 = b.x, y1 = b.y;
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
    if (!inBounds(fd, x0, y0) || fd.grid[y0][x0] !== 1) return false;
  }
  return false;
}

/**
 * Dijkstra pathfinder. Returns array of tiles excluding start, or [] when unreachable.
 * costFn(x, y) can raise traversal cost; occupied tiles are blocked.
 */
export function findPath(fd, start, goal, { occupied = new Set(), costFn = null, maxCost = Infinity } = {}) {
  if (!passable(fd, goal.x, goal.y)) return [];
  if (start.x === goal.x && start.y === goal.y) return [];
  const w = fd.w;
  const size = w * fd.h;
  const dist = new Array(size).fill(Infinity);
  const prev = new Array(size).fill(-1);
  const visited = new Array(size).fill(false);
  const idx = (x, y) => y * w + x;
  const s = idx(start.x, start.y);
  dist[s] = 0;
  const open = [{ x: start.x, y: start.y, d: 0 }];
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].d < open[best].d) best = i;
    const cur = open.splice(best, 1)[0];
    const ci = idx(cur.x, cur.y);
    if (visited[ci]) continue;
    visited[ci] = true;
    if (cur.x === goal.x && cur.y === goal.y) break;
    if (cur.d > maxCost) continue;
    for (const n of neighbors(cur.x, cur.y)) {
      if (!passable(fd, n.x, n.y)) continue;
      const ni = idx(n.x, n.y);
      if (visited[ni]) continue;
      const isGoal = n.x === goal.x && n.y === goal.y;
      if (!isGoal && occupied.has(key(n.x, n.y))) continue;
      const step = costFn ? costFn(n.x, n.y) : 1;
      if (!isFinite(step)) continue;
      const nd = cur.d + step;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        prev[ni] = ci;
        open.push({ x: n.x, y: n.y, d: nd });
      }
    }
  }
  const gi = idx(goal.x, goal.y);
  if (!isFinite(dist[gi])) return [];
  const path = [];
  let cur = gi;
  let guard = 0;
  while (cur !== s && guard++ < 500) {
    path.push({ x: cur % w, y: Math.floor(cur / w) });
    cur = prev[cur];
    if (cur < 0) return [];
  }
  return path.reverse();
}

export function tilesInRadius(center, radius) {
  const out = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (Math.abs(dx) + Math.abs(dy) > radius + Math.max(0, radius - 1)) continue;
      out.push({ x: center.x + dx, y: center.y + dy });
    }
  }
  return out;
}

export function rangeTiles(fd, center, radius) {
  const out = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d === 0 || d > radius) continue;
      const x = center.x + dx;
      const y = center.y + dy;
      if (!inBounds(fd, x, y)) continue;
      out.push({ x, y, d });
    }
  }
  return out;
}
