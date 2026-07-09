// ── Themes Bridge ──
// Translates theme-lifecycle CustomEvents into analytics events, and adds
// the buildup funnel view that the site doesn't currently capture.
//
// Listens for `theme-activate`, `theme-deactivate`, and per-theme buildup
// thresholds (0.25 / 0.50 / 0.75).
//
// theme_switched fires when a new theme activates while another is already
// active — worth knowing how often it happens so we can tune the
// priority rules.

import { track } from "../core.js";
import { sessionCounters } from "./session.js";
import * as identity from "../identity.js";
import * as consent from "../consent.js";

const FIRST_THEME_TS_KEYS = {}; // per-theme localStorage key for first activation
function firstTsKey(themeId) {
  if (!FIRST_THEME_TS_KEYS[themeId]) {
    FIRST_THEME_TS_KEYS[themeId] = `cb_analytics_theme_first_${themeId}_ts`;
  }
  return FIRST_THEME_TS_KEYS[themeId];
}

export function initThemesBridge() {
  const activeSince = new Map(); // theme_id -> ts
  let currentActive = null;
  const firedBuildup = new Set(); // key = `${theme}:${threshold}:${phase}`
  const abandonedPeaks = new Map(); // theme_id -> { peak, startedAt, phase }

  // First-visit timestamp, materialized lazily and only under consent —
  // identity.firstVisitTs() writes the key on first read, and an opted-out
  // visit must leave no analytics keys behind. Null while consent is denied
  // (track() drops the event then anyway).
  let firstVisitTs = null;
  function sinceFirstVisitMs(now) {
    if (firstVisitTs == null && consent.allowed()) {
      firstVisitTs = Date.parse(identity.firstVisitTs());
    }
    return firstVisitTs == null ? null : now - firstVisitTs;
  }

  window.addEventListener("achievement", (e) => {
    const d = e.detail || {};

    if (d.type === "theme-activate" && d.theme) {
      const now = Date.now();
      // First-ever detection persists a timestamp, so it only runs under
      // consent — same no-keys-while-opted-out contract as above.
      let isFirstEver = false;
      if (consent.allowed()) {
        let firstTs = null;
        try {
          firstTs = localStorage.getItem(firstTsKey(d.theme));
        } catch {
          /* ignore */
        }
        isFirstEver = !firstTs;
        if (isFirstEver) {
          try {
            localStorage.setItem(firstTsKey(d.theme), new Date().toISOString());
          } catch {
            /* ignore */
          }
        }
      }

      // Detect theme switch (another theme already active).
      let priorActive = null;
      if (currentActive && currentActive !== d.theme) {
        priorActive = currentActive;
        const priorSince = activeSince.get(currentActive) || now;
        track("theme_switched", {
          from_theme: currentActive,
          to_theme: d.theme,
          active_ms_before_switch: now - priorSince,
        });
      }

      sessionCounters.themesActivatedThisSession.add(d.theme);
      sessionCounters.lastThemeActivationTs = now;
      activeSince.set(d.theme, now);
      currentActive = d.theme;

      track("theme_activated", {
        theme_id: d.theme,
        method: d.silent ? "hud" : "organic",
        is_first_ever_for_visitor: isFirstEver,
        time_to_first_activation_ms: isFirstEver
          ? sinceFirstVisitMs(now)
          : null,
        prior_active_theme: priorActive,
      });
    }

    if (d.type === "theme-deactivate" && d.theme) {
      const now = Date.now();
      const since = activeSince.get(d.theme) || now;
      activeSince.delete(d.theme);
      if (currentActive === d.theme) currentActive = null;
      track("theme_deactivated", {
        theme_id: d.theme,
        method: d.silent ? "hud" : "organic",
        active_duration_ms: now - since,
      });
    }

    // Buildup thresholds.  Emitted by the factory via a dedicated
    // "theme-buildup" event type — see factory integration.  Only the
    // first crossing of each (theme, threshold, phase) triple per session
    // fires an event.
    if (d.type === "theme-buildup" && d.theme && d.threshold != null) {
      const key = `${d.theme}:${d.threshold}:${d.phase}`;
      if (firedBuildup.has(key)) return;
      firedBuildup.add(key);
      track("theme_buildup_threshold", {
        theme_id: d.theme,
        threshold: d.threshold,
        phase: d.phase,
      });

      // Start / update abandonment tracker.
      const existing = abandonedPeaks.get(d.theme);
      if (!existing || d.peakForce > existing.peak) {
        abandonedPeaks.set(d.theme, {
          peak: d.peakForce,
          startedAt: existing ? existing.startedAt : Date.now(),
          phase: d.phase,
        });
      }
    }

    if (d.type === "theme-abandoned" && d.theme) {
      const info = abandonedPeaks.get(d.theme);
      abandonedPeaks.delete(d.theme);
      // Re-assert the 0.25 threshold here so the bridge's output
      // contract stays self-contained — if upstream changes its
      // pre-firing threshold, the analytics semantics don't silently
      // drift with it.
      if (info && info.peak >= 0.25) {
        track("theme_abandoned", {
          theme_id: d.theme,
          peak_force: info.peak,
          buildup_duration_ms: Date.now() - info.startedAt,
          phase: info.phase,
        });
      }
    }

    // Theme-effect events — existing dispatches we repackage with a stable
    // effect_id.  Keeps the themes view self-contained.
    const effectMap = {
      "frost-breath": "frost_breath",
      "jellyfish-pulse": "jellyfish_pulse",
      "paper-stroke": "paper_stroke",
      "snow-globe": "snow_globe",
      "glass-cascade": "glass_cascade",
    };
    if (effectMap[d.type]) {
      track("theme_effect_used", {
        effect_id: effectMap[d.type],
        active_theme: currentActive,
      });
    }

    // Secret-reveal events — not themes themselves, but they sit in
    // the "discovery" taxonomy alongside.
    if (d.type === "logo-parallax") {
      track("logo_parallax_engaged", {});
    }
    if (d.type === "theme-history-reveal") {
      track("theme_hud_opened", {
        themes_known_count: sessionCounters.themesActivatedThisSession.size,
      });
    }

    // Theme-warning overlays — full-viewport confirmations that reveal
    // as the user accumulates deactivation force.  The warning is itself
    // a funnel step: we already know whether the user completed the
    // gesture, but until now we couldn't see how many got to the warning
    // overlay and bailed.  Keyed by source event type so future themes
    // that add warnings get tracked without changing the bridge.
    const warningSourceToTheme = {
      "upside-down-warning": "upside-down",
    };
    if (warningSourceToTheme[d.type]) {
      track("theme_warning_shown", {
        theme_id: warningSourceToTheme[d.type],
      });
    }
  });
}
