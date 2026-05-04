// ── Activity Log ──
// Persistent log of user-facing events: toasts the user might have missed,
// rendered in a dedicated tab inside the Cloudlog panel.
//
// Entry shape is generic so additional event types can be added later
// without schema changes:
//
//   { id, type, timestamp, seen, payload }
//
// Today only "achievement-unlocked" entries exist (payload carries the
// achievement id).  Future types like "mode-discovered" drop in by pushing
// new { type, payload } pairs and teaching the renderer how to draw them.

import { defineConstants } from "../dev/registry.js";

const STORAGE_KEY = "cb_activity_log_v1";

const AL = defineConstants("achievements.activityLog", {
  // Maximum entries kept in the log.  Oldest is evicted on overflow.
  MAX_ENTRIES: { value: 1000, min: 10, max: 10000, step: 10 },
});

// ── State ──

let _entries = load();
const _listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
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

// ── Public API ──

/**
 * Append an event to the log.  Returns the new entry's id.  Oldest entry
 * is evicted when the log would exceed MAX_ENTRIES.
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
    payload,
  };
  _entries.unshift(entry);
  if (_entries.length > AL.MAX_ENTRIES) _entries.length = AL.MAX_ENTRIES;
  save();
  notify();
  return entry.id;
}

/** All entries, newest first.  Returns a shallow copy. */
export function getEntries() {
  return _entries.slice();
}

/** Count of entries with seen=false. */
export function getUnseenCount() {
  let count = 0;
  for (const e of _entries) if (!e.seen) count++;
  return count;
}

/** Mark every entry as seen.  Called when the Activity tab opens. */
export function markAllSeen() {
  let changed = false;
  for (const e of _entries) {
    if (!e.seen) {
      e.seen = true;
      changed = true;
    }
  }
  if (changed) {
    save();
    notify();
  }
}

/** Remove a single entry.  Used by the per-row dismiss button. */
export function dismiss(id) {
  const idx = _entries.findIndex((e) => e.id === id);
  if (idx === -1) return;
  _entries.splice(idx, 1);
  save();
  notify();
}

/** Remove every entry.  Used by the "Clear all" button. */
export function clear() {
  if (_entries.length === 0) return;
  _entries = [];
  save();
  notify();
}

/**
 * Subscribe to log changes.  Callback runs after any mutation (log,
 * markAllSeen, dismiss, clear).  Returns an unsubscribe function.
 */
export function onChange(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}
