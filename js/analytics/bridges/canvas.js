// ── Canvas Bridge ──
// Aggregates the high-volume pointer interactions into summary events.
// Never emits per-click or per-move — one canvas_click_summary every
// SUMMARY_INTERVAL_MS and one more on session_end, plus discrete events
// for drag_complete, hold_complete, gravity_well_opened, fury_*,
// snow_globe_shake, scroll_surge, cursor_idle_fired.
//
// The "per drag" / "per hold" instrumentation uses the existing drag /
// hold / well-* dispatch sites.  We repackage, not re-detect.

import { track } from "../core.js";
import { sessionCounters } from "./session.js";

const SUMMARY_INTERVAL_MS = 60000;
const SCROLL_SURGE_VEL = 50;

export function initCanvasBridge() {
  let sinceLastSummary = {
    clickCount: 0,
    quadrants: new Set(),
    byMode: {},
  };
  let sessionWellCount = 0;
  let sessionFuryCount = 0;
  let dragStart = null;
  let holdStart = null;
  let holdReachedWell = false;
  let holdReachedFull = false;
  let scrollSurgeFired = false;

  function flushSummary() {
    if (sinceLastSummary.clickCount === 0) return;
    track("canvas_click_summary", {
      click_count: sinceLastSummary.clickCount,
      distinct_quadrants: sinceLastSummary.quadrants.size,
      clicks_by_mode: { ...sinceLastSummary.byMode },
    });
    sinceLastSummary = {
      clickCount: 0,
      quadrants: new Set(),
      byMode: {},
    };
  }

  setInterval(flushSummary, SUMMARY_INTERVAL_MS);
  window.addEventListener("pagehide", flushSummary);

  window.addEventListener("achievement", (e) => {
    const d = e.detail || {};
    switch (d.type) {
      case "click": {
        sessionCounters.clickTotalCanvas++;
        sinceLastSummary.clickCount++;
        if (d.x != null && d.y != null) {
          const qx = d.x < window.innerWidth / 2 ? "l" : "r";
          const qy = d.y < window.innerHeight / 2 ? "t" : "b";
          sinceLastSummary.quadrants.add(qy + qx);
        }
        const mode =
          document.body.dataset && document.body.dataset.activeTheme
            ? document.body.dataset.activeTheme
            : "none";
        sinceLastSummary.byMode[mode] =
          (sinceLastSummary.byMode[mode] || 0) + 1;

        // Drag sampling: reset accumulators on click (source uses this
        // to tell "a fresh gesture started").  holdStart is NOT set here
        // — it's set from the "hold" achievement event below, so routine
        // long clicks don't masquerade as hold gestures.
        dragStart = { x: d.x, y: d.y, t: Date.now() };
        break;
      }

      case "drag": {
        if (!dragStart) dragStart = { x: d.x, y: d.y, t: Date.now() };
        // Keep latest so drag_complete at pointerup can measure the
        // whole path.
        dragStart.lastX = d.x;
        dragStart.lastY = d.y;
        break;
      }

      case "hold":
        // Source only fires "hold" once charge actually begins.  Mark
        // the start so pointerup can emit hold_complete.  Incidental
        // long clicks that don't charge never get here.
        if (!holdStart) {
          holdStart = { t: Date.now() };
          holdReachedWell = false;
          holdReachedFull = false;
          track("hold_started", { active_mode: activeMode() });
        }
        break;

      case "hold-full":
        // Fires when hold strength reaches its max before (or instead of)
        // opening a well.  Distinct from hold_complete, which only fires
        // on pointerup — a user can reach max and release without ever
        // producing a hold_complete if they were already flagged earlier.
        track("hold_max_reached", {
          active_mode: activeMode(),
          time_to_max_ms: holdStart ? Date.now() - holdStart.t : null,
        });
        break;

      case "orbit":
        track("orbit_locked", { active_mode: activeMode() });
        break;

      case "click-burst":
        track("click_burst_triggered", { active_mode: activeMode() });
        break;

      case "well-activate":
        sessionWellCount++;
        holdReachedWell = true;
        track("gravity_well_opened", {
          session_well_count: sessionWellCount,
          active_mode: activeMode(),
          // hold_ms_to_open is the mastery curve: as users get better at
          // this, the time drops.  Null when the well opened outside of
          // a tracked hold (shouldn't happen, but we don't lie if it does).
          hold_ms_to_open: holdStart ? Date.now() - holdStart.t : null,
        });
        break;

      case "well-full":
        holdReachedFull = true;
        track("gravity_well_filled", { active_mode: activeMode() });
        break;

      case "fury-lightning":
        sessionFuryCount++;
        track("fury_lightning", {
          session_fury_count: sessionFuryCount,
          active_mode: activeMode(),
        });
        break;

      case "fury-aurora":
        track("fury_aurora", { active_mode: activeMode() });
        break;

      case "snow-globe":
        track("snow_globe_shake", { active_mode: activeMode() });
        break;

      case "scroll":
        if (
          !scrollSurgeFired &&
          d.velocity != null &&
          Math.abs(d.velocity) >= SCROLL_SURGE_VEL
        ) {
          scrollSurgeFired = true;
          track("scroll_surge", {
            velocity: d.velocity,
            direction: d.velocity > 0 ? "down" : "up",
          });
        }
        break;

      case "cursor-idle":
        track("cursor_idle_fired", {
          animation_name: d.animation || null,
        });
        break;
    }
  });

  // pointerup completes drag / hold reporting.  Thresholds filter out
  // incidental taps.
  const DRAG_MIN_PX = 20;
  const HOLD_MIN_MS = 200;

  window.addEventListener(
    "pointerup",
    () => {
      if (dragStart && dragStart.lastX != null) {
        const dx = (dragStart.lastX || 0) - (dragStart.x || 0);
        const dy = (dragStart.lastY || 0) - (dragStart.y || 0);
        const dist = Math.hypot(dx, dy);
        if (dist >= DRAG_MIN_PX) {
          const vp = Math.max(window.innerWidth, window.innerHeight);
          track("drag_complete", {
            duration_ms: Date.now() - dragStart.t,
            distance_px: Math.round(dist),
            distance_fraction_viewport: vp > 0 ? dist / vp : 0,
            active_mode: activeMode(),
          });
        }
        dragStart = null;
      }
      if (holdStart) {
        const held = Date.now() - holdStart.t;
        if (held >= HOLD_MIN_MS) {
          track("hold_complete", {
            hold_ms: held,
            reached_well: holdReachedWell,
            reached_full: holdReachedFull,
          });
        }
        holdStart = null;
      }
    },
    { passive: true },
  );
}

function activeMode() {
  return (document.body.dataset && document.body.dataset.activeTheme) || null;
}
