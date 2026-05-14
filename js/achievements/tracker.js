// ── Achievement Tracker ──
// Listens to CustomEvents on window, maintains session state, evaluates
// conditions, and calls unlock() when achievements are earned.
// This is the only module that triggers unlocks — everything else just
// dispatches events.

import { getAchievement, getProgressiveAchievements } from "./registry.js";
import {
  PROGRESS_ITEMS,
  resolveProgressCurrent,
  resolveProgressTotal,
} from "./progress.js";
import * as storage from "./storage.js";

// ── Timing Constants ──
// Window for the rapid-fire achievement — N clicks must land inside
// this gap.
export const RAPID_FIRE_WINDOW_MS = 3000;
export const RAPID_FIRE_CLICKS = 10;
// Cumulative visible time for night-owl.  Counted via a setInterval
// poll so we accumulate per-tick rather than wall-clock — closing
// the tab pauses progress.
export const NIGHT_OWL_MS = 600000;
export const NIGHT_OWL_CHECK_INTERVAL = 30000;
const SCROLL_STARGAZER = 0.25;
const SCROLL_BOTTOM = 0.95;
const SCROLL_TOP = 0.05;
const SCROLL_SURGE_VELOCITY = 50;
const LONG_DRAG_SCREEN_FRACTION = 0.4;
const PIXEL_PERFECT_RADIUS = 30;
// Maximum gap between a fury-lightning trigger and the click that
// counts as the aftershock.
export const AFTERSHOCK_WINDOW_MS = 2000;
const CHAIN_LIGHTNING_COUNT = 5;
const VOID_CALLER_COUNT = 3;
const MODE_HOPPER_COUNT = 3;
// Storm Forecaster — distinct sub-modes the user must trigger lightning
// under within a single session. Doesn't count the default (no-mode)
// canvas, so the achievement specifically rewards weather across active
// sub-modes.
export const STORM_FORECASTER_MODE_COUNT = 3;
// The Long Watch — uninterrupted ms in a single sub-mode required to
// unlock. Restarts on each mode-activate (any switch resets the watch);
// cleared on mode-deactivate regardless of whether the deactivation was
// user-driven or programmatic.
export const LONG_WATCH_MS = 300000;
const MOONLIT_START_HOUR = 0;
const MOONLIT_END_HOUR = 5;

export function createTracker(onUnlock, onRelock) {
  // ── Session State ──
  const session = {
    clicks: 0,
    clickTimestamps: [],
    hasScrolled25: false,
    hasScrolledBottom: false,
    hasDragged: false,
    wellActivated: false,
    wellFull: false,
    lightningTriggered: false,
    auroraTriggered: false,
    snowGlobeTriggered: false,
    modesActivated: new Set(),
    panelOpened: false,
    startTime: Date.now(),
    visibleMs: 0,
    lastVisibleTime: document.hidden ? 0 : Date.now(),
    lightningCount: 0,
    lightningModes: new Set(),
    wellCount: 0,
    dragStartX: null,
    dragStartY: null,
    lastFuryTime: 0,
    longWatchTimer: null,
  };

  // ── Unlock ──

  function tryUnlock(id) {
    if (storage.isUnlocked(id)) return false;
    const success = storage.unlock(id);
    if (!success) return false;
    const achievement = getAchievement(id);
    if (achievement && onUnlock) onUnlock(achievement);
    // Any unlock may satisfy count-based progressives (meta totals,
    // set mastery, point thresholds). Re-evaluate the progressive set.
    checkProgressiveState();
    return true;
  }

  // ── Progressive Achievements ──

  function tryProgressItem(progressKey, item) {
    const added = storage.addProgressItem(progressKey, item);
    if (!added) return;
    checkProgressiveState(progressKey);
  }

  function syncProgressTotals() {
    for (const [key, resolver] of Object.entries(PROGRESS_ITEMS)) {
      const validNames = resolver();
      storage.setProgressTotal(key, validNames.length);
      storage.pruneProgressItems(key, validNames);
    }
  }

  // Re-evaluate progressive achievements. Pass a progressKey to check only
  // those achievements; omit it to check all. Count-based and collection-based
  // both follow the same "current >= total" rule; re-locks fire when current
  // drops below total (e.g. registry grew, or an unlock was rolled back).
  function checkProgressiveState(progressKey) {
    const targets = progressKey
      ? getProgressiveAchievements().filter(
          (a) => a.progressKey === progressKey,
        )
      : getProgressiveAchievements();
    for (const ach of targets) {
      const total = resolveProgressTotal(ach.progressKey);
      const current = resolveProgressCurrent(ach.progressKey);
      if (storage.isUnlocked(ach.id)) {
        if (current < total) {
          storage.relock(ach.id);
          if (onRelock) onRelock(ach);
        }
      } else if (current >= total && total > 0) {
        storage.clearRelocked(ach.id);
        tryUnlock(ach.id);
      }
    }
  }

  function activeMode() {
    return document.body.dataset.activeTheme || null;
  }

  // ── The Long Watch ──
  // Single timer is shared across all modes — starting a watch for one
  // mode replaces any prior watch, which is the right behavior since the
  // achievement requires a single uninterrupted span in any mode.

  function restartLongWatch() {
    if (session.longWatchTimer != null) clearTimeout(session.longWatchTimer);
    session.longWatchTimer = setTimeout(() => {
      session.longWatchTimer = null;
      tryUnlock("the-long-watch");
    }, LONG_WATCH_MS);
  }

  function clearLongWatch() {
    if (session.longWatchTimer != null) {
      clearTimeout(session.longWatchTimer);
      session.longWatchTimer = null;
    }
  }

  // ── Event type → handler map ──

  const handlers = {
    click(data) {
      session.clicks++;
      storage.incrementCounter("totalClicks");
      tryUnlock("first-light");

      // Rapid fire: 10 clicks in 3 seconds
      const now = Date.now();
      session.clickTimestamps.push(now);
      // Prune old timestamps
      while (
        session.clickTimestamps.length > 0 &&
        now - session.clickTimestamps[0] > RAPID_FIRE_WINDOW_MS
      ) {
        session.clickTimestamps.shift();
      }
      if (session.clickTimestamps.length >= RAPID_FIRE_CLICKS) {
        tryUnlock("rapid-fire");
        if (activeMode() === "upside-down") tryUnlock("vertigo");
      }

      // Quadrant tracking for cartographer
      if (data && data.x != null && data.y != null) {
        const midX = window.innerWidth / 2;
        const midY = window.innerHeight / 2;
        const qx = data.x < midX ? "l" : "r";
        const qy = data.y < midY ? "t" : "b";
        tryProgressItem("quadrants-clicked", qy + qx);

        // Pixel perfect — click near viewport center
        const dx = data.x - midX;
        const dy = data.y - midY;
        if (Math.sqrt(dx * dx + dy * dy) <= PIXEL_PERFECT_RADIUS) {
          tryUnlock("pixel-perfect");
        }
      }

      // Aftershock — click shortly after fury-lightning
      if (
        session.lastFuryTime > 0 &&
        now - session.lastFuryTime <= AFTERSHOCK_WINDOW_MS
      ) {
        tryUnlock("aftershock");
      }

      // Reset drag tracking on click
      session.dragStartX = null;
      session.dragStartY = null;

      // Mode-specific click achievements
      const mode = activeMode();
      if (mode === "deep-sea") tryUnlock("bioluminescent");
      if (mode === "blocky") tryUnlock("pixel-burst");
      if (mode === "rainy") tryUnlock("puddle-jump");
      if (mode === "upside-down") tryUnlock("rift-walker");
      if (mode === "paper" && data && data.card) tryUnlock("margin-notes");
    },

    "click-burst"() {
      tryUnlock("spark");
    },

    scroll(data) {
      if (data && data.progress != null) {
        if (data.progress >= SCROLL_STARGAZER && !session.hasScrolled25) {
          session.hasScrolled25 = true;
          tryUnlock("stargazer");
        }
        if (data.progress >= SCROLL_BOTTOM && !session.hasScrolledBottom) {
          session.hasScrolledBottom = true;
          tryUnlock("down-to-earth");
        }

        // Zenith: scroll to bottom then back to top
        if (session.hasScrolledBottom && data.progress <= SCROLL_TOP) {
          tryUnlock("zenith");
        }

        // Upside-down full scroll
        if (activeMode() === "upside-down" && data.progress >= SCROLL_BOTTOM) {
          tryUnlock("disoriented");
        }
      }

      // Scroll surge — high scroll velocity
      if (
        data &&
        data.velocity != null &&
        Math.abs(data.velocity) >= SCROLL_SURGE_VELOCITY
      ) {
        tryUnlock("scroll-surge");
      }
    },

    "appearance-change"(data) {
      storage.incrementCounter("appearanceToggles");
      checkProgressiveState("appearance-toggles-3");

      if (data && data.appearance === "dark") tryUnlock("nightfall");
      if (data && data.appearance === "light") tryUnlock("daybreak");
      if (data && data.appearance)
        tryProgressItem("appearances-used", data.appearance);
    },

    drag(data) {
      if (!session.hasDragged) {
        session.hasDragged = true;
        tryUnlock("trail-blazer");
      }

      // Track drag distance for the-long-drag
      if (data && data.x != null && data.y != null) {
        if (session.dragStartX === null) {
          session.dragStartX = data.x;
          session.dragStartY = data.y;
        } else {
          const dx = data.x - session.dragStartX;
          const dy = data.y - session.dragStartY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const threshold =
            LONG_DRAG_SCREEN_FRACTION *
            Math.max(window.innerWidth, window.innerHeight);
          if (dist >= threshold) {
            tryUnlock("the-long-drag");
          }
        }
      }

      // Frozen drag
      if (activeMode() === "frozen") tryUnlock("snowdrift");
    },

    hold() {
      tryUnlock("gathering-storm");
    },

    "hold-full"() {
      tryUnlock("eye-of-the-storm");
    },

    "well-activate"() {
      session.wellActivated = true;
      session.wellCount++;
      tryUnlock("event-horizon");

      // Void caller — multiple well activations
      if (session.wellCount >= VOID_CALLER_COUNT) {
        tryUnlock("void-caller");
      }

      const mode = activeMode();
      if (mode === "deep-sea") tryUnlock("pressure-drop");
      if (mode === "rainy") tryUnlock("monsoon");
    },

    "well-full"() {
      session.wellFull = true;
      tryUnlock("singularity");
    },

    "fury-lightning"() {
      session.lightningTriggered = true;
      session.lastFuryTime = Date.now();
      session.lightningCount++;
      tryUnlock("fury-unleashed");

      // Chain lightning — multiple fury triggers in one session
      if (session.lightningCount >= CHAIN_LIGHTNING_COUNT) {
        tryUnlock("chain-lightning");
      }

      const mode = activeMode();
      if (mode === "blocky") tryUnlock("8-bit-storm");
      if (mode === "rainy") tryUnlock("thunder-roll");
      if (mode === "deep-sea") tryUnlock("storm-surge");
      if (mode === "frozen") tryUnlock("frozen-lightning");
      if (mode === "upside-down") tryUnlock("glitch");
      if (mode === "paper") tryUnlock("ink-splatter");

      // Storm Forecaster — distinct sub-modes count toward this within a
      // single session. The default (no-mode) canvas is excluded.
      if (mode) {
        session.lightningModes.add(mode);
        if (session.lightningModes.size >= STORM_FORECASTER_MODE_COUNT) {
          tryUnlock("storm-forecaster");
        }
      }
    },

    "fury-aurora"() {
      session.auroraTriggered = true;
      tryUnlock("northern-lights");
    },

    "snow-globe"() {
      session.snowGlobeTriggered = true;
      tryUnlock("snow-globe");

      if (activeMode() === "frozen") tryUnlock("blizzard");
      if (activeMode() === "deep-sea") tryUnlock("permafrost");
    },

    "mode-activate"(data) {
      if (!data || !data.mode) return;
      session.modesActivated.add(data.mode);
      storage.incrementCounter("totalModeActivations");

      const modeMap = {
        "deep-sea": "the-depths",
        frozen: "first-frost",
        blocky: "resolution-drop",
        rainy: "first-drop",
        paper: "first-sketch",
        "upside-down": "the-flip",
      };
      if (modeMap[data.mode]) tryUnlock(modeMap[data.mode]);

      // Mode hopper
      if (session.modesActivated.size >= MODE_HOPPER_COUNT) {
        tryUnlock("mode-hopper");
      }

      // Elemental — every mode activated at least once (persistent)
      tryProgressItem("modes-activated", data.mode);

      // The Long Watch — start a fresh countdown for the new mode. Any
      // switch (activate of another mode while one is running) resets
      // the timer because mode-deactivate fires first.
      restartLongWatch();
    },

    "mode-deactivate"(data) {
      if (!data || !data.mode) return;
      // Long Watch must clear regardless of silent — leaving the mode
      // breaks the watch whether or not the exit was user-driven.
      clearLongWatch();
      // Programmatic deactivations carry silent=true — the exit
      // achievement is reserved for users who discover the original
      // exit gesture.
      if (data.silent) return;
      const deactivateMap = {
        "deep-sea": "resurface",
        frozen: "thaw",
        blocky: "defrag",
        rainy: "rainbow",
        paper: "blank-page",
        "upside-down": "restoration",
      };
      if (deactivateMap[data.mode]) tryUnlock(deactivateMap[data.mode]);
    },

    "upside-down-warning"() {
      tryUnlock("boundary-break");
    },

    "frost-breath"() {
      tryUnlock("frost-breath");
    },

    "jellyfish-pulse"() {
      storage.incrementCounter("jellyfishPulses");
      checkProgressiveState("jellyfish-pulses");
    },

    "paper-stroke"() {
      storage.incrementCounter("paperStrokes");
      checkProgressiveState("paper-strokes");
    },

    "panel-open"(data) {
      if (!session.panelOpened) {
        session.panelOpened = true;
        tryUnlock("cloud-reader");
      }
      // Cartographer's Almanac — record the active appearance each time
      // the panel opens; collected across (auto, light, dark) over any
      // number of sessions.
      if (data && data.appearance)
        tryProgressItem("almanac-appearances", data.appearance);
      // Tab Tourist credits the initial tab on open so the user only
      // needs to click the other tab to complete the pair. Default tab
      // is reported by the dispatcher so this stays UI-agnostic.
      if (data && data.tab) tryProgressItem("panel-tabs-visited", data.tab);
    },

    "panel-tab-switch"(data) {
      // Tab Tourist — collected across (achievements, activity) over any
      // number of sessions.
      if (data && data.tab) tryProgressItem("panel-tabs-visited", data.tab);
    },

    "contact-click"() {
      tryUnlock("landfall");
    },

    "linkedin-click"() {
      tryUnlock("connected");
    },

    orbit() {
      tryUnlock("orbit-lock");
      if (activeMode() === "deep-sea") tryUnlock("deep-orbit");
    },

    "dev-console-open"() {
      tryUnlock("reverse-engineer");
    },

    "logo-parallax"() {
      tryUnlock("magnetic-letters");
    },

    "mode-history-reveal"() {
      tryUnlock("historian");
    },

    "cloudlog-activate"() {
      tryUnlock("cloudlog-activated");
    },

    "timestamp-toggle"() {
      tryUnlock("time-warp");
    },

    "cloudlog-shortcut"() {
      tryUnlock("shortcut-master");
    },

    "cursor-idle"(data) {
      tryUnlock("idle-hands");
      if (data && data.animation) {
        tryProgressItem("idle-animations", data.animation);
      }
    },
  };

  // ── Visibility tracking for night-owl ──
  function onVisibilityChange() {
    const now = Date.now();
    if (document.hidden) {
      if (session.lastVisibleTime > 0) {
        session.visibleMs += now - session.lastVisibleTime;
        session.lastVisibleTime = 0;
      }
    } else {
      session.lastVisibleTime = now;
    }
    checkNightOwl();
  }

  function checkNightOwl() {
    let total = session.visibleMs;
    if (session.lastVisibleTime > 0) {
      total += Date.now() - session.lastVisibleTime;
    }
    if (total >= NIGHT_OWL_MS) {
      tryUnlock("night-owl");
    }
  }

  // ── Session-day tracking ──
  // Persistent-explorer / tenacious read their totals from progress.js,
  // which derives from counters.sessionDays. Just record today and let
  // checkProgressiveState pick them up.
  function trackSession() {
    const today = new Date().toISOString().slice(0, 10);
    const state = storage.getState();
    const days = state.counters.sessionDays || [];
    if (!days.includes(today)) {
      days.push(today);
      state.counters.sessionDays = days;
      storage.save();
    }
  }

  // ── Wire up ──

  function handleEvent(e) {
    const { type, ...data } = e.detail;
    const handler = handlers[type];
    if (handler) handler(data);
  }

  function start() {
    window.addEventListener("achievement", handleEvent);
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Night owl check every 30 seconds
    setInterval(checkNightOwl, NIGHT_OWL_CHECK_INTERVAL);

    trackSession();

    // Sync progressive achievement totals, prune stale items, check state
    syncProgressTotals();
    checkProgressiveState();

    // Moonlit — visiting between midnight and 5am
    const hour = new Date().getHours();
    if (hour >= MOONLIT_START_HOUR && hour <= MOONLIT_END_HOUR) {
      tryUnlock("moonlit");
    }
  }

  function stop() {
    window.removeEventListener("achievement", handleEvent);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    clearLongWatch();
  }

  /**
   * Check for achievements whose conditions are already met.
   * Called after activation to retroactively unlock.
   */
  function catchUp() {
    // If user has already clicked before activation
    if (session.clicks > 0) tryUnlock("first-light");
    if (session.hasScrolled25) tryUnlock("stargazer");
    if (session.hasScrolledBottom) tryUnlock("down-to-earth");
    if (session.hasDragged) tryUnlock("trail-blazer");
    if (session.lightningTriggered) tryUnlock("fury-unleashed");
    if (session.auroraTriggered) tryUnlock("northern-lights");
    if (session.snowGlobeTriggered) tryUnlock("snow-globe");
    if (session.wellActivated) tryUnlock("event-horizon");
    if (session.wellFull) tryUnlock("singularity");
    if (session.lightningCount >= CHAIN_LIGHTNING_COUNT)
      tryUnlock("chain-lightning");
    if (session.lightningModes.size >= STORM_FORECASTER_MODE_COUNT)
      tryUnlock("storm-forecaster");
    if (session.wellCount >= VOID_CALLER_COUNT) tryUnlock("void-caller");
    // If a mode is already active when Cloudlog activates, the
    // mode-activate event has already been dispatched and missed —
    // start the watch now from the catch-up moment. The achievement
    // measures uninterrupted time from this point forward, which is
    // strictly conservative (the user gets less credit, never more).
    if (activeMode() && session.longWatchTimer == null) restartLongWatch();
    checkProgressiveState();
  }

  return { start, stop, catchUp, record: handleEvent };
}
