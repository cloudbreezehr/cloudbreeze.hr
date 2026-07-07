// ── Analytics Core ──
// Public track() API + queue + flush + adapter dispatch.
//
// Contract:
//   - track(name, props?) is the only mutation.  It's cheap — enqueue +
//     schedule.  Bridges call this; source modules stay analytics-agnostic.
//   - Consent is re-checked on every track() and every send, so a late
//     opt-out *or* opt-in takes effect without a reload.
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
// The adapter to send through whenever consent allows (a vendor adapter, or
// the console default). Kept separate from _adapter so consent can gate which
// of the two is live at any moment — see resolveAdapter.
let _realAdapter = noopAdapter;
let _realInited = false;
let _queue = [];
let _flushTimer = null;
let _started = false;

// Consent can flip at runtime, so the adapter is resolved per send rather than
// fixed at start(): opt-in promotes the real adapter (initialized once) and
// opt-out falls back to the noop — both without a page reload.
function resolveAdapter() {
  if (!consent.allowed()) return noopAdapter;
  if (_adapter === noopAdapter) {
    _adapter = _realAdapter;
    if (!_realInited && typeof _adapter.init === "function") {
      _realInited = true;
      try {
        _adapter.init();
      } catch (err) {
        console.warn("[analytics] adapter.init failed:", err);
      }
    }
  }
  return _adapter;
}

// Run a flush during browser idle time when the API is available so
// analytics never competes with a paint frame.  Falls back to a direct
// call where requestIdleCallback isn't supported.  Urgent flushes
// (batch-size cap, pagehide) bypass this and call flush() directly.
function flushWhenIdle() {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => flush(), { timeout: FLUSH_INTERVAL_MS });
  } else {
    flush();
  }
}

function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flushWhenIdle();
  }, FLUSH_INTERVAL_MS);
}

export function track(name, props) {
  if (!_started) return;
  if (!consent.allowed()) return;

  let merged;
  try {
    merged = { ...context.baseProps(), ...(props || {}) };
  } catch (err) {
    // Context building can throw in edge environments (e.g. minimal
    // DOM).  Don't let that break the caller.
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
    resolveAdapter().send(batch);
  } catch (err) {
    console.warn("[analytics] adapter.send failed:", err);
  }
}

export function start({ adapter } = {}) {
  if (_started) return;
  _started = true;
  // Remember the real adapter; resolveAdapter() promotes it the first time
  // consent allows a send (initializing it once). Calling it now inits
  // eagerly when consent is already granted, and is a harmless noop otherwise.
  _realAdapter = adapter || consoleAdapter;
  resolveAdapter();

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
  _realAdapter = noopAdapter;
  _realInited = false;
  _started = false;
}

export function _setAdapterForTests(adapter) {
  _adapter = adapter;
}

export function _queueSizeForTests() {
  return _queue.length;
}
