// ── Achievement Storage ──
// Thin wrapper around localStorage for achievement persistence.
// Reads once on load; in-memory state is authoritative thereafter.
// Writes are debounced to max 1/second.

// ── Constants ──
export const STORAGE_KEY = "achievements";
// Sidecar key holding the last corrupt payload, kept for diagnosis so a
// parse failure doesn't silently erase whatever was there.
const CORRUPT_KEY = "achievements.corrupt";
const SAVE_DEBOUNCE_MS = 1000;
// Bump when the persisted shape changes in a way the existing
// field-merge can't reconcile (e.g. renames, type changes, splits).
// Add a corresponding branch in `migrate()` below.
export const SCHEMA_VERSION = 1;

// ── Default state ──
function defaultState() {
  return {
    version: SCHEMA_VERSION,
    active: false,
    hidden: false,
    unlocked: [],
    seen: [],
    counters: {
      totalClicks: 0,
      totalThemeActivations: 0,
      sessions: 0,
      sessionDays: [],
    },
    progress: {},
    relocked: [],
    // Free-form UI preferences that should survive reloads (reveal-hints
    // toggle, compact density, …).  Additive bag so adding a pref is a
    // getPref/setPref call with no schema bump.
    prefs: {},
  };
}

// Apply schema bumps to a parsed-but-not-yet-merged blob.  Each bump
// is one `if (fromVersion < N) { ... }` block that rewrites fields in
// place; the field-merge below then absorbs the result.  Today this
// is a no-op — the hook exists so future migrations land in a single
// well-named place instead of being grafted into read().
//
// Invariant: when migrate() returns, `parsed` is shaped at
// SCHEMA_VERSION.  The downstream field-merge takes its version from
// defaultState (always current) and never reads parsed.version again,
// so any branch that runs MUST upgrade parsed to the current shape.
function migrate(parsed) {
  const fromVersion = typeof parsed.version === "number" ? parsed.version : 0;
  if (fromVersion >= SCHEMA_VERSION) return parsed;
  // No transformations registered yet for version 1.  Examples for
  // future use: `if (fromVersion < 2) parsed.foo = parsed.legacyFoo`.
  return parsed;
}

// ── In-memory state ──
let _state = null;
let _saveTimer = null;

// Merge an already-parsed (and migrated) blob onto a fresh default.
// Additive schema evolution lands here — only fields present and the
// right type are copied, so a backup from an older shape still loads.
// Field changes the merge can't absorb go through migrate() instead.
function mergeIntoDefault(parsed) {
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
  if (parsed.prefs && typeof parsed.prefs === "object") {
    Object.assign(state.prefs, parsed.prefs);
  }
  return state;
}

function read() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return defaultState();
  }
  if (!raw) return defaultState();
  try {
    return mergeIntoDefault(migrate(JSON.parse(raw)));
  } catch {
    // Parse/shape error — the stored payload is corrupt.  Stash it
    // under a sidecar key (once) for diagnosis instead of silently
    // overwriting it on the next save, then start fresh.
    try {
      if (raw && !localStorage.getItem(CORRUPT_KEY)) {
        localStorage.setItem(CORRUPT_KEY, raw);
      }
    } catch {
      // ignore — nothing more we can do
    }
    return defaultState();
  }
}

// True after a write failed because the quota was exceeded — lets the
// UI surface a one-time "couldn't save" notice.  Callers read it via
// lastWriteFailed().
let _writeFailed = false;

export function lastWriteFailed() {
  return _writeFailed;
}

function write(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    _writeFailed = false;
  } catch {
    // QuotaExceededError, private-mode, or disabled storage all land
    // here.  Flag the failure so the UI can tell the user their
    // progress isn't being saved instead of failing silently.  Emit only
    // on the rising edge so a run of failed writes nags just once.
    if (!_writeFailed && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("storage-write-failed"));
    }
    _writeFailed = true;
  }
}

// ── Public API ──

let _unloadBound = false;

export function load() {
  _state = read();
  // Flush any debounced write before the tab goes away so a rapid close
  // doesn't lose the last second of progress.  pagehide + visibilitychange
  // are reliable where beforeunload isn't (mobile Safari skips beforeunload
  // and it breaks bfcache); both can fire, but saveNow no-ops with no timer
  // pending so a double-fire is harmless.  Bound once.
  if (!_unloadBound && typeof window !== "undefined") {
    _unloadBound = true;
    const flush = () => {
      if (_saveTimer) saveNow();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }
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

// ── UI preferences ──
// Generic persisted-preference bag.  getPref returns `fallback` when
// the key was never set so callers state their own default inline.

// Timestamp of the last panel close — read to decide which cards count
// as "earned while you were away" and should animate in on reopen.
export const LAST_PANEL_CLOSE_PREF = "lastPanelCloseTs";

export function getPref(key, fallback = null) {
  const prefs = getState().prefs || {};
  return key in prefs ? prefs[key] : fallback;
}

export function setPref(key, value) {
  const state = getState();
  if (!state.prefs) state.prefs = {};
  state.prefs[key] = value;
  save();
}

export function getCounter(key) {
  return getState().counters[key] || 0;
}

// Consecutive-day visit streak ending today, derived from the
// sessionDays history (an array of "YYYY-MM-DD" strings).  Returns 0 if
// today isn't recorded yet, otherwise the run of back-to-back days
// ending today.  Computed rather than stored so it can't drift from the
// underlying day set.
export function currentStreak() {
  const days = getState().counters.sessionDays || [];
  if (days.length === 0) return 0;
  const present = new Set(days);
  const DAY_MS = 86400000;
  // Day keys are UTC (trackSession uses toISOString().slice(0,10)), so
  // step in UTC to match — slicing the ISO string yields the UTC date.
  let cursor = Date.now();
  const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10);
  if (!present.has(isoOf(cursor))) return 0;
  let streak = 0;
  while (present.has(isoOf(cursor))) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
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

// ── Backup / restore ──
// Serialize the live state for download.  Returns a pretty JSON string
// the user can save to a file.
export function exportState() {
  return JSON.stringify(getState(), null, 2);
}

// Replace the live state from a previously-exported JSON string.  Runs
// the same migrate + field-merge as a normal load so a backup from an
// older schema still imports cleanly.  Returns true on success, false
// if the payload is unparseable or not an object.
export function importState(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;
  _state = mergeIntoDefault(migrate(parsed));
  saveNow();
  return true;
}
