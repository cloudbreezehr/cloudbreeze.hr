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
import { announce } from "./announcer.js";
import { getThemeIds } from "../themes/registry.js";
import { wordOfTheDay } from "../daily/word.js";
import { isTimeTraveling } from "../daily/random.js";
import {
  themeEnterLine,
  themeExitLine,
  comboLine,
  incantationLine,
} from "../narration.js";

// Themes that count toward "all themes active" stacking achievements.
const STACKABLE_THEME_COUNT = getThemeIds().length;
const TRIPLE_STACK_COUNT = 3;

// ── Timing Constants ──
// Window for the rapid-fire achievement — N clicks must land inside
// this gap.
export const RAPID_FIRE_WINDOW_MS = 3000;
export const RAPID_FIRE_CLICKS = 10;
// Lifetime click milestones.
const PERSISTENT_CLICKS = 1000;
const DEVOTED_CLICKS = 10000;
// Consecutive-day visit streak for the "Regular" achievement.
const REGULAR_STREAK_DAYS = 7;
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
const THEME_HOPPER_COUNT = 3;
// Linked windows (this one included) needed for the triptych achievement.
const TRIPTYCH_WINDOWS = 3;
// Score banked via clicks in a single wanted-theme run to earn high-roller.
const HIGH_ROLLER_CASH = 10000;
// Channel Surfer — distinct click-glitches in a single VHS session.
const CHANNEL_SURFER_COUNT = 5;
// Storm Forecaster — distinct themes the user must trigger lightning
// under within a single session. Doesn't count the default (no-theme)
// canvas, so the achievement specifically rewards weather across active
// themes.
export const STORM_FORECASTER_THEME_COUNT = 3;
// The Long Watch — uninterrupted ms in a single theme required to
// unlock. Restarts on each theme-activate (any switch resets the watch);
// cleared on theme-deactivate regardless of whether the deactivation was
// user-driven or programmatic.
export const LONG_WATCH_MS = 300000;
const MOONLIT_START_HOUR = 0;
const MOONLIT_END_HOUR = 5;

export function createTracker(onUnlock, onRelock, onRepeat) {
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
    themesActivated: new Set(),
    panelOpened: false,
    startTime: Date.now(),
    visibleMs: 0,
    lastVisibleTime: document.hidden ? 0 : Date.now(),
    lightningCount: 0,
    lightningThemes: new Set(),
    wellCount: 0,
    vhsGlitchCount: 0,
    dragStartX: null,
    dragStartY: null,
    lastFuryTime: 0,
    longWatchTimer: null,
    // Tracks which constellations have been formed in this session for
    // the celestial-cartographer "all four in one session" achievement.
    constellationsFound: new Set(),
  };

  // ── Unlock ──

  function tryUnlock(id) {
    // Tally every earn, repeats included; a repeat stops here.
    if (storage.isUnlocked(id)) {
      storage.bumpTrigger(id);
      if (onRepeat) onRepeat(id);
      return false;
    }
    const success = storage.unlock(id);
    if (!success) return false;
    storage.bumpTrigger(id);
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

  function activeTheme() {
    return document.body.dataset.activeTheme || null;
  }

  // ── The Long Watch ──
  // Single timer is shared across all themes — starting a watch for one
  // theme replaces any prior watch, which is the right behavior since the
  // achievement requires a single uninterrupted span in any theme.

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
      const totalClicks = storage.getCounter("totalClicks") + 1;
      storage.incrementCounter("totalClicks");
      tryUnlock("first-light");

      // Lifetime click milestones — persistent counters, so these tick
      // over across sessions.
      if (totalClicks >= PERSISTENT_CLICKS) tryUnlock("persistent");
      if (totalClicks >= DEVOTED_CLICKS) tryUnlock("devoted");

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
        if (activeTheme() === "upside-down") tryUnlock("vertigo");
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

      // Theme-specific click achievements
      const theme = activeTheme();
      if (theme === "deep-sea") tryUnlock("bioluminescent");
      if (theme === "blocky") tryUnlock("pixel-burst");
      if (theme === "rainy") tryUnlock("puddle-jump");
      if (theme === "upside-down") tryUnlock("rift-walker");
      if (theme === "paper" && data && data.card) tryUnlock("margin-notes");
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
        if (activeTheme() === "upside-down" && data.progress >= SCROLL_BOTTOM) {
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
      if (activeTheme() === "frozen") tryUnlock("snowdrift");
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

      const theme = activeTheme();
      if (theme === "deep-sea") tryUnlock("pressure-drop");
      if (theme === "rainy") tryUnlock("monsoon");
      if (theme === "vhs") tryUnlock("bad-tracking");
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

      const theme = activeTheme();
      if (theme === "blocky") tryUnlock("8-bit-storm");
      if (theme === "rainy") tryUnlock("thunder-roll");
      if (theme === "deep-sea") tryUnlock("storm-surge");
      if (theme === "frozen") tryUnlock("frozen-lightning");
      if (theme === "upside-down") tryUnlock("glitch");
      if (theme === "paper") tryUnlock("ink-splatter");

      // Storm Forecaster — distinct themes count toward this within a
      // single session. The default (no-theme) canvas is excluded.
      if (theme) {
        session.lightningThemes.add(theme);
        if (session.lightningThemes.size >= STORM_FORECASTER_THEME_COUNT) {
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

      if (activeTheme() === "frozen") tryUnlock("blizzard");
      if (activeTheme() === "deep-sea") tryUnlock("permafrost");
    },

    "theme-activate"(data) {
      if (!data || !data.theme) return;
      // Announce visual theme changes to screen readers — the canvas
      // and overlays are aria-hidden, so without this a theme swap is
      // silent to SR users.  Skip programmatic (silent) activations.
      if (!data.silent) {
        announce(themeEnterLine(data.theme));
      }
      session.themesActivated.add(data.theme);
      storage.incrementCounter("totalThemeActivations");

      const themeMap = {
        "deep-sea": "the-depths",
        frozen: "first-frost",
        blocky: "resolution-drop",
        rainy: "first-drop",
        paper: "first-sketch",
        vhs: "tracking-lost",
        "upside-down": "the-flip",
        constellation: "night-sky-mapped",
        matrix: "enter-the-matrix",
        wanted: "most-wanted",
      };
      if (themeMap[data.theme]) tryUnlock(themeMap[data.theme]);

      // Theme hopper
      if (session.themesActivated.size >= THEME_HOPPER_COUNT) {
        tryUnlock("theme-hopper");
      }

      // Elemental — every theme activated at least once (persistent)
      tryProgressItem("themes-activated", data.theme);

      // Stacking combos — count themes currently in the body class set.
      // Reading the live DOM means this fires whether the stack was built
      // gesture-by-gesture or by the Konami all-at-once code.
      const activeCount = getThemeIds().filter((id) =>
        document.body.classList.contains(id),
      ).length;
      if (activeCount >= TRIPLE_STACK_COUNT) tryUnlock("triple-stack");
      if (activeCount >= STACKABLE_THEME_COUNT) tryUnlock("kitchen-sink");

      // The Long Watch — start a fresh countdown for the new theme. Any
      // switch (activate of another theme while one is running) resets
      // the timer because theme-deactivate fires first.
      restartLongWatch();
    },

    "theme-deactivate"(data) {
      if (!data || !data.theme) return;
      // Long Watch must clear regardless of silent — leaving the theme
      // breaks the watch whether or not the exit was user-driven.
      clearLongWatch();
      // Programmatic deactivations carry silent=true — the exit
      // achievement is reserved for users who discover the original
      // exit gesture.
      if (data.silent) return;
      announce(themeExitLine(data.theme));
      const deactivateMap = {
        "deep-sea": "resurface",
        frozen: "thaw",
        blocky: "defrag",
        rainy: "rainbow",
        paper: "blank-page",
        vhs: "tape-eject",
        "upside-down": "restoration",
        matrix: "back-to-reality",
        wanted: "lay-low",
      };
      if (deactivateMap[data.theme]) tryUnlock(deactivateMap[data.theme]);
    },

    "wanted-cash"(data) {
      if (data && data.total >= HIGH_ROLLER_CASH) tryUnlock("high-roller");
    },

    "wanted-cheat"(data) {
      if (!data || !data.code) return;
      tryUnlock("cheat-the-system");
      tryProgressItem("wanted-cheats-entered", data.code);
    },

    "matrix-decode"() {
      tryUnlock("follow-the-white-rabbit");
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

    "vhs-glitch"() {
      session.vhsGlitchCount++;
      if (session.vhsGlitchCount >= CHANNEL_SURFER_COUNT) {
        tryUnlock("channel-surfer");
      }
    },

    "vhs-cursor-still"() {
      tryUnlock("phosphor-burn");
    },

    "star-clicked"() {
      // Any tagged-star hit counts toward the trivial "click a star" tier.
      tryUnlock("lone-star");
    },

    "constellation-formed"(data) {
      if (!data || !data.constellationId) return;
      const map = {
        "orions-belt": "belt-of-orion",
        cassiopeia: "the-queens-chair",
        "ursa-major": "the-great-bear",
        lyra: "the-lyre",
      };
      const id = map[data.constellationId];
      if (id) tryUnlock(id);
      // celestial-cartographer: all four asterisms in one session.
      // Tracked against the known mapping above so unrecognized ids
      // (future constellation entries) don't accidentally count.
      if (id) {
        session.constellationsFound.add(data.constellationId);
        if (session.constellationsFound.size >= Object.keys(map).length) {
          tryUnlock("celestial-cartographer");
        }
      }
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
      if (activeTheme() === "deep-sea") tryUnlock("deep-orbit");
    },

    "dev-console-open"() {
      tryUnlock("reverse-engineer");
    },

    "logo-parallax"() {
      tryUnlock("magnetic-letters");
    },

    "theme-history-reveal"() {
      tryUnlock("historian");
    },

    "cloudlog-activate"() {
      tryUnlock("cloudlog-activated");
    },

    "photo-mode"() {
      tryUnlock("sky-photographer");
    },

    "photo-saved"() {
      tryUnlock("wallpaper-material");
    },

    "real-sky"(data) {
      if (!data) return;
      if (data.moonFull) tryUnlock("moonstruck");
      if (data.shower) tryUnlock("star-shower");
      if (data.moment === "solstice") tryUnlock("sun-stands-still");
      if (data.moment === "equinox") tryUnlock("equal-night");
    },

    "real-weather"(data) {
      if (data && data.raining) tryUnlock("rain-check");
    },

    "precise-location"() {
      tryUnlock("you-are-here");
    },

    "terminal-open"() {
      tryUnlock("shell-access");
    },

    "terminal-sudo-denied"() {
      tryUnlock("not-in-sudoers");
    },

    "terminal-rm-rf"() {
      tryUnlock("scorched-earth");
    },

    "terminal-kubectl"() {
      tryUnlock("cloud-native");
    },

    "sky-link"(data) {
      tryUnlock("parallel-skies");
      if (data && data.windows >= TRIPTYCH_WINDOWS) tryUnlock("triptych");
    },

    "sky-link-handoff"() {
      // Every linked window witnesses a crossing from the shared world
      // schedule and fires its own event — whichever side the user is
      // watching unlocks the courier.
      tryUnlock("star-courier");
    },

    "sky-scrub"() {
      tryUnlock("fixed-stars");
    },

    "sky-link-ghost-hand"() {
      tryUnlock("ghost-hand");
    },

    "distant-well"() {
      tryUnlock("distant-well");
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

    "konami-cheat"() {
      tryUnlock("cheat-code");
    },

    "theme-spelled"() {
      tryUnlock("wordsmith");
    },

    incantation(data) {
      tryUnlock("abracadabra");
      if (data && data.word) {
        tryProgressItem("incantations-cast", data.word);
        // Spells are pure visual flourish — narrate them or screen-reader
        // users never know a cast happened.
        announce(incantationLine(data.word));
      }
      if (data && data.maxed) tryUnlock("overkill");
      if (data && data.word === wordOfTheDay()) tryUnlock("in-season");
    },

    "theme-combo"(data) {
      if (!data || !data.combo) return;
      tryUnlock("alchemist");
      tryProgressItem("combos-discovered", data.combo);
      announce(comboLine(data.combo));
    },

    "passport-export"() {
      tryUnlock("passport-issued");
    },

    "speedrun-armed"() {
      tryUnlock("on-the-clock");
    },

    "speedrun-finished"() {
      tryUnlock("any-percent");
    },

    "passport-import"() {
      tryUnlock("passport-stamped");
      // Imported unlocks can complete collections and sets — re-evaluate
      // everything progressive against the merged state.
      checkProgressiveState();
    },

    "themes-scribbled"() {
      tryUnlock("clean-slate");
    },

    "shooting-star-clicked"() {
      tryUnlock("wish-granted");
    },

    "cheatsheet-discovered"() {
      tryUnlock("open-secrets");
    },

    "sound-enabled"() {
      tryUnlock("sound-on");
    },

    "theme-sound-heard"(data) {
      if (data && data.theme) tryProgressItem("themes-heard", data.theme);
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
    // Reward a week of consecutive-day visits.
    if (storage.currentStreak() >= REGULAR_STREAK_DAYS) tryUnlock("regular");
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

    // Time Traveler — arriving under a shared sky seeded from another day.
    // Sampled here rather than delivered as an event: it's a standing
    // condition present at load (like moonlit), so a boot-time dispatch would
    // race this listener's registration and be lost.
    if (isTimeTraveling()) tryUnlock("time-traveler");
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
    if (session.lightningThemes.size >= STORM_FORECASTER_THEME_COUNT)
      tryUnlock("storm-forecaster");
    if (session.wellCount >= VOID_CALLER_COUNT) tryUnlock("void-caller");
    if (session.vhsGlitchCount >= CHANNEL_SURFER_COUNT)
      tryUnlock("channel-surfer");
    // If a theme is already active when Cloudlog activates, the
    // theme-activate event has already been dispatched and missed —
    // start the watch now from the catch-up moment. The achievement
    // measures uninterrupted time from this point forward, which is
    // strictly conservative (the user gets less credit, never more).
    if (activeTheme() && session.longWatchTimer == null) restartLongWatch();
    checkProgressiveState();
  }

  return { start, stop, catchUp, record: handleEvent };
}
