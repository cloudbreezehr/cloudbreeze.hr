// ── Modes Bridge ──
// Translates mode-lifecycle CustomEvents into analytics events, and adds
// the buildup funnel view that the site doesn't currently capture.
//
// The source modules already dispatch `mode-activate` and `mode-deactivate`
// via the factory.  For buildup (0.25 / 0.50 / 0.75 thresholds), we need
// a small instrumentation hook — the factory exposes setForce() which is
// where we tap in.  See factory.js integration for details.
//
// mode_switched fires when a new mode activates while another is already
// active — the HUD allows this, and it's worth knowing how often it
// happens so we can tune the priority rules.

import { track } from "../core.js";
import { sessionCounters } from "./session.js";
import * as identity from "../identity.js";

const FIRST_MODE_TS_KEYS = {}; // per-mode localStorage key for first activation
function firstTsKey(modeId) {
  if (!FIRST_MODE_TS_KEYS[modeId]) {
    FIRST_MODE_TS_KEYS[modeId] = `cb_analytics_mode_first_${modeId}_ts`;
  }
  return FIRST_MODE_TS_KEYS[modeId];
}

export function initModesBridge() {
  const activeSince = new Map(); // mode_id -> ts
  let currentActive = null;
  const firedBuildup = new Set(); // key = `${mode}:${threshold}:${phase}`
  const abandonedPeaks = new Map(); // mode_id -> { peak, startedAt, phase }

  const firstVisitTs = Date.parse(identity.firstVisitTs());

  window.addEventListener("achievement", (e) => {
    const d = e.detail || {};

    if (d.type === "mode-activate" && d.mode) {
      const now = Date.now();
      let firstTs = null;
      try {
        firstTs = localStorage.getItem(firstTsKey(d.mode));
      } catch {
        /* ignore */
      }
      const isFirstEver = !firstTs;
      if (isFirstEver) {
        try {
          localStorage.setItem(firstTsKey(d.mode), new Date().toISOString());
        } catch {
          /* ignore */
        }
      }

      // Detect mode switch (another mode already active).
      let priorActive = null;
      if (currentActive && currentActive !== d.mode) {
        priorActive = currentActive;
        const priorSince = activeSince.get(currentActive) || now;
        track("mode_switched", {
          from_mode: currentActive,
          to_mode: d.mode,
          active_ms_before_switch: now - priorSince,
        });
      }

      sessionCounters.modesActivatedThisSession.add(d.mode);
      activeSince.set(d.mode, now);
      currentActive = d.mode;

      track("mode_activated", {
        mode_id: d.mode,
        method: d.silent ? "hud" : "organic",
        is_first_ever_for_visitor: isFirstEver,
        time_to_first_activation_ms: isFirstEver ? now - firstVisitTs : null,
        prior_active_mode: priorActive,
      });
    }

    if (d.type === "mode-deactivate" && d.mode) {
      const now = Date.now();
      const since = activeSince.get(d.mode) || now;
      activeSince.delete(d.mode);
      if (currentActive === d.mode) currentActive = null;
      track("mode_deactivated", {
        mode_id: d.mode,
        method: d.silent ? "hud" : "organic",
        active_duration_ms: now - since,
      });
    }

    // Buildup thresholds.  Emitted by the factory via a dedicated
    // "mode-buildup" event type — see factory integration.  Only the
    // first crossing of each (mode, threshold, phase) triple per session
    // fires an event.
    if (d.type === "mode-buildup" && d.mode && d.threshold != null) {
      const key = `${d.mode}:${d.threshold}:${d.phase}`;
      if (firedBuildup.has(key)) return;
      firedBuildup.add(key);
      track("mode_buildup_threshold", {
        mode_id: d.mode,
        threshold: d.threshold,
        phase: d.phase,
      });

      // Start / update abandonment tracker.
      const existing = abandonedPeaks.get(d.mode);
      if (!existing || d.peakForce > existing.peak) {
        abandonedPeaks.set(d.mode, {
          peak: d.peakForce,
          startedAt: existing ? existing.startedAt : Date.now(),
          phase: d.phase,
        });
      }
    }

    if (d.type === "mode-abandoned" && d.mode) {
      const info = abandonedPeaks.get(d.mode);
      abandonedPeaks.delete(d.mode);
      // The factory already guards on peak >= 0.25 before firing
      // mode-abandoned.  Re-asserting here keeps the bridge's output
      // contract self-contained: if the factory threshold ever
      // changes, analytics semantics don't silently drift with it.
      if (info && info.peak >= 0.25) {
        track("mode_abandoned", {
          mode_id: d.mode,
          peak_force: info.peak,
          buildup_duration_ms: Date.now() - info.startedAt,
          phase: info.phase,
        });
      }
    }

    // Mode-effect events — existing dispatches we repackage with a stable
    // effect_id.  Keeps the modes view self-contained.
    const effectMap = {
      "frost-breath": "frost_breath",
      "jellyfish-pulse": "jellyfish_pulse",
      "paper-stroke": "paper_stroke",
      "snow-globe": "snow_globe",
    };
    if (effectMap[d.type]) {
      track("mode_effect_used", {
        effect_id: effectMap[d.type],
        active_mode: currentActive,
      });
    }

    // Secret-reveal events — logo parallax and mode history HUD aren't
    // modes themselves but sit in the "discovery" taxonomy alongside.
    if (d.type === "logo-parallax") {
      track("logo_parallax_engaged", {});
    }
    if (d.type === "mode-history-reveal") {
      track("mode_hud_opened", {
        modes_known_count: sessionCounters.modesActivatedThisSession.size,
      });
    }
  });
}
