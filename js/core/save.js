const SAVE_KEY = 'echoes100.save.v1';

export function defaultMeta(seed = null) {
  return {
    version: 1,
    seed: seed || Math.floor(Math.random() * 1e9).toString(36),
    heroCount: 0,
    deaths: 0,
    deepest: 0,
    clearedFloors: [],
    echoes: [],
    stash: [],
    hallOfHeroes: [],
    activeHero: null,
    settings: { sound: true, shake: true, autoBattle: false },
    tutorialSeen: [],
    victory: false,
    createdAt: Date.now(),
    lastPlayed: Date.now(),
    runs: 0,
    kills: 0,
  };
}

function normalize(meta) {
  const base = defaultMeta(meta.seed);
  const merged = { ...base, ...meta };
  merged.settings = { ...base.settings, ...(meta.settings || {}) };
  merged.echoes = Array.isArray(meta.echoes) ? meta.echoes : [];
  merged.stash = Array.isArray(meta.stash) ? meta.stash : [];
  merged.hallOfHeroes = Array.isArray(meta.hallOfHeroes) ? meta.hallOfHeroes : [];
  merged.clearedFloors = Array.isArray(meta.clearedFloors) ? meta.clearedFloors : [];
  merged.tutorialSeen = Array.isArray(meta.tutorialSeen) ? meta.tutorialSeen : [];
  return merged;
}

export function loadMeta() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return normalize(parsed);
  } catch {
    return null;
  }
}

export function saveMeta(meta) {
  try {
    meta.lastPlayed = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function exportSave(meta) {
  return JSON.stringify(meta, null, 2);
}

export function importSave(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.echoes)) return null;
    return normalize(parsed);
  } catch {
    return null;
  }
}

export { SAVE_KEY };
