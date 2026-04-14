// ── Achievement Tracker ──
// Listens to CustomEvents on window, maintains session state, evaluates
// conditions, and calls unlock() when achievements are earned.
// This is the only module that triggers unlocks — everything else just
// dispatches events.

import {
  getSetPrereqs,
  getAllNonMeta,
  SET_MASTERY_MAP,
  getAchievement,
  sumPoints,
} from "./registry.js";
import * as storage from "./storage.js";

// ── Timing Constants ──
const RAPID_FIRE_WINDOW_MS = 3000;
const RAPID_FIRE_CLICKS = 10;
const NIGHT_OWL_MS = 600000; // 10 minutes
const SCROLL_STARGAZER = 0.25;
const SCROLL_BOTTOM = 0.95;
const SCROLL_TOP = 0.05;
const THEME_TOGGLE_THRESHOLD = 3;

// ── Meta thresholds ──
const META_CURIOUS_COUNT = 5;
const META_DEDICATED_COUNT = 15;
const META_HUNDRED_POINTS = 100;
const META_FIVEHUNDRED_POINTS = 500;
const MODE_HOPPER_COUNT = 3;

export function createTracker(onUnlock) {
  // ── Session State ──
  const session = {
    clicks: 0,
    clickTimestamps: [],
    hasScrolled25: false,
    hasScrolledBottom: false,
    themeToggles: 0,
    hasToggledDark: false,
    hasToggledLight: false,
    hasToggledAuto: false,
    hasDragged: false,
    wellActivated: false,
    wellFull: false,
    lightningTriggered: false,
    auroraTriggered: false,
    snowGlobeTriggered: false,
    quadrants: new Set(), // "tl", "tr", "bl", "br"
    modesActivated: new Set(),
    panelOpened: false,
    jellyPulses: 0,
    startTime: Date.now(),
    visibleMs: 0,
    lastVisibleTime: document.hidden ? 0 : Date.now(),
  };

  // ── Helpers ──

  function tryUnlock(id) {
    if (storage.isUnlocked(id)) return false;
    const success = storage.unlock(id);
    if (success) {
      const achievement = getAchievement(id);
      if (achievement && onUnlock) onUnlock(achievement);
      checkMeta();
    }
    return success;
  }

  function unlockedCount() {
    return storage.getUnlocked().length;
  }

  function checkSetMastery(setId) {
    const masteryId = SET_MASTERY_MAP[setId];
    if (!masteryId || storage.isUnlocked(masteryId)) return;
    const prereqs = getSetPrereqs(setId);
    if (prereqs.every((id) => storage.isUnlocked(id))) {
      tryUnlock(masteryId);
    }
  }

  function checkMeta() {
    const count = unlockedCount();
    const pts = sumPoints(storage.getUnlocked());

    if (count >= META_CURIOUS_COUNT) tryUnlock("curious-mind");
    if (count >= META_DEDICATED_COUNT) tryUnlock("dedicated");
    if (pts >= META_HUNDRED_POINTS) tryUnlock("hundred-club");
    if (pts >= META_FIVEHUNDRED_POINTS) tryUnlock("five-hundred");

    if (session.modesActivated.size >= MODE_HOPPER_COUNT) {
      tryUnlock("mode-hopper");
    }

    // Completionist: all non-meta achievements
    const allNonMeta = getAllNonMeta();
    if (allNonMeta.every((id) => storage.isUnlocked(id))) {
      tryUnlock("completionist");
    }
  }

  function activeMode() {
    return document.body.dataset.activeTheme || null;
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
      }

      // Quadrant tracking for cartographer
      if (data && data.x != null && data.y != null) {
        const midX = window.innerWidth / 2;
        const midY = window.innerHeight / 2;
        const qx = data.x < midX ? "l" : "r";
        const qy = data.y < midY ? "t" : "b";
        session.quadrants.add(qy + qx);
        if (session.quadrants.size >= 4) {
          tryUnlock("cartographer");
        }
      }

      // Mode-specific click achievements
      const mode = activeMode();
      if (mode === "deep-sea") tryUnlock("bioluminescent");
      if (mode === "blocky") tryUnlock("pixel-burst");
      if (mode === "rainy") tryUnlock("puddle-jump");
      if (mode === "upside-down") tryUnlock("rift-walker");
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
    },

    "theme-change"(data) {
      session.themeToggles++;
      if (data && data.theme === "dark") {
        session.hasToggledDark = true;
        tryUnlock("nightfall");
      }
      if (data && data.theme === "light") {
        session.hasToggledLight = true;
        tryUnlock("daybreak");
      }
      if (data && data.theme === "auto") {
        session.hasToggledAuto = true;
      }
      if (session.themeToggles >= THEME_TOGGLE_THRESHOLD) {
        tryUnlock("dusk-and-dawn");
      }
      if (
        session.hasToggledDark &&
        session.hasToggledLight &&
        session.hasToggledAuto
      ) {
        tryUnlock("full-spectrum");
      }
    },

    drag() {
      if (!session.hasDragged) {
        session.hasDragged = true;
        tryUnlock("trail-blazer");
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
      tryUnlock("event-horizon");

      if (activeMode() === "deep-sea") {
        tryUnlock("pressure-drop");
        checkSetMastery("deep-sea");
      }
    },

    "well-full"() {
      session.wellFull = true;
      tryUnlock("singularity");
    },

    "fury-lightning"() {
      session.lightningTriggered = true;
      tryUnlock("fury-unleashed");

      if (activeMode() === "blocky") {
        tryUnlock("8-bit-storm");
        checkSetMastery("blocky");
      }
      if (activeMode() === "rainy") {
        tryUnlock("thunder-roll");
        checkSetMastery("rainy");
      }
    },

    "fury-aurora"() {
      session.auroraTriggered = true;
      tryUnlock("northern-lights");
    },

    "snow-globe"() {
      session.snowGlobeTriggered = true;
      tryUnlock("snow-globe");

      if (activeMode() === "frozen") {
        tryUnlock("blizzard");
        checkSetMastery("frozen");
      }
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
        "upside-down": "the-flip",
      };
      if (modeMap[data.mode]) tryUnlock(modeMap[data.mode]);

      // Mode hopper
      if (session.modesActivated.size >= MODE_HOPPER_COUNT) {
        tryUnlock("mode-hopper");
      }
    },

    "mode-deactivate"(data) {
      if (!data || !data.mode) return;
      const deactivateMap = {
        "deep-sea": "resurface",
        frozen: "thaw",
        blocky: "defrag",
        rainy: "rainbow",
        "upside-down": "restoration",
      };
      if (deactivateMap[data.mode]) {
        tryUnlock(deactivateMap[data.mode]);
        checkSetMastery(data.mode);
      }
    },

    "upside-down-warning"() {
      tryUnlock("boundary-break");
    },

    "frost-breath"() {
      tryUnlock("frost-breath");
      checkSetMastery("frozen");
    },

    "jellyfish-pulse"() {
      session.jellyPulses++;
      const JELLY_PULSE_THRESHOLD = 5;
      if (session.jellyPulses >= JELLY_PULSE_THRESHOLD) {
        tryUnlock("jellyfish-drift");
        checkSetMastery("deep-sea");
      }
    },

    "panel-open"() {
      if (!session.panelOpened) {
        session.panelOpened = true;
        tryUnlock("cloud-reader");
      }
    },

    "cloudlog-activate"() {
      tryUnlock("cloudlog-activated");
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

  // ── Session tracking for persistent-explorer ──
  function trackSession() {
    const today = new Date().toISOString().slice(0, 10);
    const state = storage.getState();
    const days = state.counters.sessionDays || [];
    if (!days.includes(today)) {
      days.push(today);
      state.counters.sessionDays = days;
      storage.save();
    }
    const PERSISTENT_DAYS = 3;
    if (days.length >= PERSISTENT_DAYS) {
      tryUnlock("persistent-explorer");
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
    const NIGHT_OWL_CHECK_INTERVAL = 30000;
    setInterval(checkNightOwl, NIGHT_OWL_CHECK_INTERVAL);

    trackSession();
  }

  function stop() {
    window.removeEventListener("achievement", handleEvent);
    document.removeEventListener("visibilitychange", onVisibilityChange);
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
    checkMeta();
  }

  return { start, stop, catchUp, record: handleEvent };
}
