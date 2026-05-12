// ── Activity Log ──
// Persistent log of user-facing events — primarily toasts the user
// might have missed, surfaced later for review.
//
// Entry shape is generic so additional event types can be added later
// without schema changes:
//
//   { id, type, timestamp, seen, trashedAt, payload }
//
// New types drop in by pushing { type, payload } pairs and teaching the
// renderer how to draw them.
//
// Soft delete: dismissing an entry sets `trashedAt` to a timestamp rather
// than removing it.  Trashed entries are invisible in the main list but
// recoverable via the trash view.  They auto-purge after TRASH_TTL_MS.

import { defineConstants } from "../dev/registry.js";

const STORAGE_KEY = "cb_activity_log_v1";

const AL = defineConstants("achievements.activityLog", {
  // Maximum entries kept in the log (across active + trashed).  When
  // exceeded, the oldest entry is evicted — trashed entries are evicted
  // first since they're already out of sight.
  MAX_ENTRIES: { value: 1000, min: 10, max: 10000, step: 10 },
  // Trashed entries are permanently deleted after this many ms.
  // Default: 7 days.
  TRASH_TTL_MS: {
    value: 604800000,
    min: 60000,
    max: 2592000000,
    step: 60000,
  },
});

// ── State ──

let _entries = load();
const _listeners = new Set();

// Purge expired trashed entries on load — keeps the log tidy across
// sessions without requiring the user to open the Cloudlog.
purgeExpired();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Backfill trashedAt for entries saved before soft-delete existed.
    for (const e of parsed) {
      if (e.trashedAt === undefined) e.trashedAt = null;
    }
    return parsed;
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_entries));
  } catch {
    // localStorage full or unavailable — silently continue
  }
}

function notify() {
  for (const cb of _listeners) cb();
}

// Remove entries whose TTL has expired.  Called at load time and
// whenever the log is mutated, so a reload after a week-long gap
// cleans up automatically.
function purgeExpired() {
  const now = Date.now();
  const cutoff = now - AL.TRASH_TTL_MS;
  let i = _entries.length;
  let changed = false;
  while (i--) {
    const e = _entries[i];
    if (e.trashedAt && e.trashedAt < cutoff) {
      _entries.splice(i, 1);
      changed = true;
    }
  }
  return changed;
}

// ── Public API ──

/**
 * Append an event to the log.  Returns the new entry's id.  Oldest entry
 * is evicted when the log would exceed MAX_ENTRIES (trashed entries go
 * first).
 *
 * @param {string} type     Event type, e.g. "achievement-unlocked".
 * @param {object} payload  Type-specific data.
 */
export function log(type, payload) {
  const entry = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: Date.now(),
    seen: false,
    trashedAt: null,
    payload,
  };
  _entries.unshift(entry);
  enforceCap();
  save();
  notify();
  return entry.id;
}

// Keep _entries within MAX_ENTRIES by evicting from the tail.  Trashed
// entries are evicted first — they're already hidden so the user won't
// notice, and active entries should have priority.
function enforceCap() {
  if (_entries.length <= AL.MAX_ENTRIES) return;
  // Drop oldest trashed first
  for (
    let i = _entries.length - 1;
    i >= 0 && _entries.length > AL.MAX_ENTRIES;
    i--
  ) {
    if (_entries[i].trashedAt) _entries.splice(i, 1);
  }
  // Still over cap (no trashed to evict) — drop oldest active
  if (_entries.length > AL.MAX_ENTRIES) {
    _entries.length = AL.MAX_ENTRIES;
  }
}

/** Active entries (not trashed), newest first. */
export function getActive() {
  return _entries.filter((e) => !e.trashedAt);
}

/** Trashed entries, newest-trashed first. */
export function getTrashed() {
  return _entries
    .filter((e) => e.trashedAt)
    .sort((a, b) => b.trashedAt - a.trashedAt);
}

/** Count of active (non-trashed) entries with seen=false. */
export function getUnseenCount() {
  let count = 0;
  for (const e of _entries) if (!e.seen && !e.trashedAt) count++;
  return count;
}

/** Count of trashed entries. */
export function getTrashedCount() {
  let count = 0;
  for (const e of _entries) if (e.trashedAt) count++;
  return count;
}

/** Mark every active entry as seen.  Called when the Activity tab opens. */
export function markAllSeen() {
  let changed = false;
  for (const e of _entries) {
    if (!e.seen && !e.trashedAt) {
      e.seen = true;
      changed = true;
    }
  }
  if (changed) {
    save();
    notify();
  }
}

/**
 * Soft-delete a single entry — moves it to trash with a timestamp so it
 * can be restored within TRASH_TTL_MS.  Used by the per-row dismiss button.
 */
export function trash(id) {
  const entry = _entries.find((e) => e.id === id);
  if (!entry || entry.trashedAt) return;
  entry.trashedAt = Date.now();
  save();
  notify();
}

/** Restore a trashed entry to the active list, preserving its timestamp. */
export function restore(id) {
  const entry = _entries.find((e) => e.id === id);
  if (!entry || !entry.trashedAt) return;
  entry.trashedAt = null;
  save();
  notify();
}

/** Soft-delete every active entry.  Used by the "Clear all" button. */
export function clear() {
  const now = Date.now();
  let changed = false;
  for (const e of _entries) {
    if (!e.trashedAt) {
      e.trashedAt = now;
      changed = true;
    }
  }
  if (changed) {
    save();
    notify();
  }
}

/** Hard-delete every trashed entry.  Used by the "Empty trash" button. */
export function emptyTrash() {
  const before = _entries.length;
  _entries = _entries.filter((e) => !e.trashedAt);
  if (_entries.length !== before) {
    save();
    notify();
  }
}

/**
 * Subscribe to log changes.  Callback runs after any mutation.
 * Returns an unsubscribe function.
 */
export function onChange(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}
