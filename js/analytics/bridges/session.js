// ── Session Bridge ──
// Emits session_start / heartbeat / pause / resume / end with aggregate
// counters that bridges in the same module scope can bump.  Lives at the
// top of analytics init so every other bridge can share its counters via
// the exported sessionCounters object.

import { track } from "../core.js";
import * as identity from "../identity.js";

export const HEARTBEAT_MS = 15000;

// Counters other bridges mutate.  Values are snapshotted onto heartbeat
// and session_end events.  No mutation from outside the bridges.
//
// lastThemeActivationTs is the epoch-ms timestamp of the most recent
// theme activation in this session — separates "in-play" sessions
// (user discovered a theme) from "passive" ones for downstream
// analysis.  Null until the first theme_activated in the session.
export const sessionCounters = {
  scrollMaxDepth: 0,
  unlocksThisSession: 0,
  pointsThisSession: 0,
  themesActivatedThisSession: new Set(),
  clickTotalCanvas: 0,
  clickTotalCta: 0,
  keyboardUsed: false,
  lastThemeActivationTs: null,
};

let _startedAt = 0;
let _visibleMs = 0;
let _lastVisibleTs = 0;
let _hiddenSinceTs = 0;
let _heartbeatTimer = null;
let _endFired = false;

function currentVisibleMs() {
  let total = _visibleMs;
  if (_lastVisibleTs > 0) total += Date.now() - _lastVisibleTs;
  return total;
}

function emitHeartbeat() {
  track("session_heartbeat", {
    visible_ms_so_far: currentVisibleMs(),
    scroll_max_depth: sessionCounters.scrollMaxDepth,
    unlocks_this_session: sessionCounters.unlocksThisSession,
  });
}

function scheduleHeartbeat() {
  if (_heartbeatTimer) return;
  _heartbeatTimer = setInterval(() => {
    if (document.hidden) return;
    emitHeartbeat();
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
}

function onVisibility() {
  if (document.hidden) {
    if (_lastVisibleTs > 0) {
      _visibleMs += Date.now() - _lastVisibleTs;
      _lastVisibleTs = 0;
    }
    _hiddenSinceTs = Date.now();
    track("session_pause", {});
  } else {
    const hiddenMs = _hiddenSinceTs ? Date.now() - _hiddenSinceTs : 0;
    _hiddenSinceTs = 0;
    _lastVisibleTs = Date.now();
    track("session_resume", { hidden_ms: hiddenMs });
  }
}

function emitSessionEnd() {
  if (_endFired) return;
  _endFired = true;
  stopHeartbeat();
  const visibleMs = currentVisibleMs();
  const hiddenMs = Math.max(0, Date.now() - _startedAt - visibleMs);
  track("session_end", {
    total_visible_ms: visibleMs,
    hidden_ms: hiddenMs,
    max_scroll_depth: sessionCounters.scrollMaxDepth,
    themes_activated_this_session: [
      ...sessionCounters.themesActivatedThisSession,
    ],
    unlocks_this_session: sessionCounters.unlocksThisSession,
    points_this_session: sessionCounters.pointsThisSession,
    click_total_canvas: sessionCounters.clickTotalCanvas,
    click_total_cta: sessionCounters.clickTotalCta,
    keyboard_used: sessionCounters.keyboardUsed,
  });
}

export function initSessionBridge() {
  _startedAt = Date.now();
  _lastVisibleTs = document.hidden ? 0 : _startedAt;

  const firstEver = identity.isFirstVisitEver();
  identity.firstVisitTs(); // materialize if missing
  const newVisitCount = identity.bumpVisitCount();

  const conn =
    (typeof navigator !== "undefined" && navigator.connection) || null;
  track("session_start", {
    is_first_visit_ever: firstEver,
    visit_count: newVisitCount,
    entry_path: location.pathname + location.search + location.hash,
    screen_w: screen.width,
    screen_h: screen.height,
    hw_concurrency: navigator.hardwareConcurrency || null,
    device_memory: navigator.deviceMemory || null,
    connection: conn ? conn.effectiveType || null : null,
  });

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", emitSessionEnd);
  scheduleHeartbeat();
}
