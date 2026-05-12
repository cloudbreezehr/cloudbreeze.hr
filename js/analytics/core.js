// ── Analytics Core ──
// Public track() API + queue + flush + adapter dispatch.
//
// Contract:
//   - track(name, props?) is the only mutation.  It's cheap — enqueue +
//     schedule.  Bridges call this; source modules stay analytics-agnostic.
//   - Consent is re-checked on every track() so a late opt-out takes
//     effect without reload.
//   - The queue flushes every FLUSH_INTERVAL_MS, whenever it hits
//     MAX_BATCH_SIZE, and on pagehide / visibility-hidden.
//   - Queue is capped at MAX_QUEUE so long offline periods can't grow
//     memory unbounded — oldest events drop first.
//   - The adapter is passed to init(); swapping vendors is a one-line
//     change at the call site.  Default is the console adapter.

import * as consent from "./consent.js";
import * as context from "./context.js";
import { consoleAdapter } from "./adapters/console.js";
import { noopAdapter } from "./adapters/noop.js";

// ── Tunables ──
export const FLUSH_INTERVAL_MS = 10000;
export const MAX_BATCH_SIZE = 20;
const MAX_QUEUE = 200;

let _adapter = noopAdapter;
let _queue = [];
let _flushTimer = null;
let _started = false;

function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

export function track(name, props) {
  if (!_started) return;
  if (!consent.allowed()) return;

  let merged;
  try {
    merged = { ...context.baseProps(), ...(props || {}) };
  } catch (err) {
    // Context building can throw in edge environments (tests without a
    // full DOM).  Don't let that break the caller.
    console.warn("[analytics] baseProps failed:", err);
    return;
  }

  const event = { name, props: merged };
  _queue.push(event);

  if (_queue.length > MAX_QUEUE) {
    _queue.splice(0, _queue.length - MAX_QUEUE);
  }

  if (_queue.length >= MAX_BATCH_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}

export function flush() {
  if (!_queue.length) return;
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  const batch = _queue;
  _queue = [];
  try {
    _adapter.send(batch);
  } catch (err) {
    console.warn("[analytics] adapter.send failed:", err);
  }
}

export function start({ adapter } = {}) {
  if (_started) return;
  _started = true;
  // Respect consent by swapping to the noop adapter.  Bridges still
  // subscribe (they're cheap and idempotent); track() short-circuits
  // before it would ever hit the adapter.
  _adapter = consent.allowed() ? adapter || consoleAdapter : noopAdapter;
  if (typeof _adapter.init === "function") {
    try {
      _adapter.init();
    } catch (err) {
      console.warn("[analytics] adapter.init failed:", err);
    }
  }

  // Flush on visibility changes and pagehide so session_end, errors, and
  // the tail of session_heartbeat actually make it out.
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) flush();
    });
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => flush());
  }
}

export function _stopForTests() {
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  _queue = [];
  _adapter = noopAdapter;
  _started = false;
}

export function _setAdapterForTests(adapter) {
  _adapter = adapter;
}

export function _queueSizeForTests() {
  return _queue.length;
}
