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
    counters: {
      totalClicks: 0,
      totalModeActivations: 0,
      sessions: 0,
      sessionDays: [],
    },
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
    if (parsed.counters && typeof parsed.counters === "object") {
      Object.assign(state.counters, parsed.counters);
    }
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

export function reset() {
  _state = defaultState();
  saveNow();
}
