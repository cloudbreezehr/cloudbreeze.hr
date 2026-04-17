// ── Achievement Storage ──
// Thin wrapper around localStorage for achievement persistence.
// Reads once on load; in-memory state is authoritative thereafter.
// Writes are debounced to max 1/second.

// ── Constants ──
const STORAGE_KEY = "achievements";
const SAVE_DEBOUNCE_MS = 1000;

// ── Default state ──
function defaultState() {
  return {
    active: false,
    hidden: false,
    unlocked: [],
    seen: [],
    counters: {
      totalClicks: 0,
      totalModeActivations: 0,
      sessions: 0,
      sessionDays: [],
    },
    progress: {},
    relocked: [],
  };
}

// ── In-memory state ──
let _state = null;
let _saveTimer = null;

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle schema evolution
    const state = defaultState();
    state.active = !!parsed.active;
    state.hidden = !!parsed.hidden;
    if (Array.isArray(parsed.unlocked)) state.unlocked = parsed.unlocked;
    if (Array.isArray(parsed.seen)) state.seen = parsed.seen;
    if (parsed.counters && typeof parsed.counters === "object") {
      Object.assign(state.counters, parsed.counters);
    }
    if (parsed.progress && typeof parsed.progress === "object") {
      state.progress = parsed.progress;
    }
    if (Array.isArray(parsed.relocked)) state.relocked = parsed.relocked;
    return state;
  } catch {
    return defaultState();
  }
}

function write(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently continue
  }
}

// ── Public API ──

export function load() {
  _state = read();
  return _state;
}

export function getState() {
  if (!_state) _state = read();
  return _state;
}

export function save() {
  if (!_state) return;
  if (_saveTimer) return; // already scheduled
  _saveTimer = setTimeout(() => {
    write(_state);
    _saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

export function saveNow() {
  if (!_state) return;
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  write(_state);
}

export function isActive() {
  return getState().active;
}

export function isHidden() {
  return getState().hidden;
}

export function activate() {
  const state = getState();
  state.active = true;
  state.hidden = false;
  saveNow();
}

export function setHidden(hidden) {
  const state = getState();
  state.hidden = hidden;
  saveNow();
}

export function isUnlocked(id) {
  return getState().unlocked.some((u) => u.id === id);
}

export function getUnlockTime(id) {
  const entry = getState().unlocked.find((u) => u.id === id);
  return entry ? entry.ts : null;
}

export function unlock(id) {
  const state = getState();
  if (state.unlocked.some((u) => u.id === id)) return false;
  state.unlocked.push({ id, ts: Date.now() });
  save();
  return true;
}

export function getUnlocked() {
  return getState().unlocked;
}

export function isSeen(id) {
  return getState().seen.includes(id);
}

export function markSeen(id) {
  const state = getState();
  if (state.seen.includes(id)) return false;
  state.seen.push(id);
  save();
  return true;
}

export function getUnseenCount() {
  const state = getState();
  return state.unlocked.filter((u) => !state.seen.includes(u.id)).length;
}

export function getCounter(key) {
  return getState().counters[key] || 0;
}

export function setCounter(key, value) {
  getState().counters[key] = value;
  save();
}

export function incrementCounter(key, amount) {
  const state = getState();
  state.counters[key] = (state.counters[key] || 0) + (amount || 1);
  save();
}

// ── Progressive Achievement Progress ──

export function getProgressItems(key) {
  const entry = getState().progress[key];
  return entry ? entry.items : [];
}

export function getProgressTotal(key) {
  const entry = getState().progress[key];
  return entry ? entry.total : 0;
}

export function setProgressTotal(key, total) {
  const state = getState();
  if (!state.progress[key]) {
    state.progress[key] = { items: [], total };
  } else {
    state.progress[key].total = total;
  }
  save();
}

export function addProgressItem(key, item) {
  const state = getState();
  if (!state.progress[key]) {
    state.progress[key] = { items: [], total: 0 };
  }
  const entry = state.progress[key];
  if (entry.items.includes(item)) return false;
  entry.items.push(item);
  save();
  return true;
}

export function pruneProgressItems(key, validNames) {
  const state = getState();
  const entry = state.progress[key];
  if (!entry) return;
  const before = entry.items.length;
  entry.items = entry.items.filter((item) => validNames.includes(item));
  if (entry.items.length < before) save();
}

// ── Re-locking ──

export function relock(id) {
  const state = getState();
  const idx = state.unlocked.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  state.unlocked.splice(idx, 1);
  const seenIdx = state.seen.indexOf(id);
  if (seenIdx !== -1) state.seen.splice(seenIdx, 1);
  if (!state.relocked.includes(id)) state.relocked.push(id);
  save();
  return true;
}

export function isRelocked(id) {
  return getState().relocked.includes(id);
}

export function clearRelocked(id) {
  const state = getState();
  const idx = state.relocked.indexOf(id);
  if (idx !== -1) {
    state.relocked.splice(idx, 1);
    save();
  }
}

export function reset() {
  _state = defaultState();
  saveNow();
}
