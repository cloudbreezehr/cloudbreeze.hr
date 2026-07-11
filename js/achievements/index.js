// ── Achievement System Entry Point ──
// Public API for the achievement system. Handles activation (triple-click),
// wires tracker + UI + storage together.

import * as storage from "./storage.js";
import { getAchievement } from "./registry.js";
import { createTracker } from "./tracker.js";
import {
  createNavButton,
  showNavButton,
  hideNavButton,
  openPanel,
  closePanel,
  isPanelOpen,
  showActivationToast,
  showActivationPulse,
  markRevealPulseFired,
  setActiveTab,
  getActiveTab,
  refreshPanel,
  updateBadge,
  scrollToCard,
  onAchievementUnlocked,
  onAchievementRelocked,
  celebrateCompletion,
} from "./ui.js";
import { onKey } from "../keyboard.js";
import { maybeShowWelcomeBack, markGreeted } from "./welcome-back.js";
import { initDiscoveryHint } from "./discovery-hint.js";
import { getParam, hasFlag, onUrlChange } from "../url-params.js";

// ── Triple-click detection ──
// Window during which a click counts toward the same triple. Each click
// pushes its timestamp; older entries fall off when they age past this
// window, so a slow-then-fast sequence (click ... pause ... click click
// click) still triggers cleanly.
export const TRIPLE_CLICK_MAX_MS = 600;
export const TRIPLE_CLICK_COUNT = 3;
// Wait for the panel slide-in before scrolling a deep-linked card into
// view, so the scroll lands against a laid-out container.
const PANEL_SETTLE_MS = 350;
// Delay before the `finale` demo preview fires, so the page has painted.
const FINALE_PREVIEW_DELAY_MS = 800;

/**
 * Watch an event target for triple-clicks within TRIPLE_CLICK_MAX_MS.
 * Calls `onTriple(event)` with the third click's event when the burst
 * completes, then resets state.
 *
 * Returns a stop() function that detaches the listener.
 */
export function createTripleClickDetector(target, onTriple) {
  let clickTimes = [];
  function onClick(e) {
    const now = Date.now();
    clickTimes.push(now);
    while (clickTimes.length > 0 && now - clickTimes[0] > TRIPLE_CLICK_MAX_MS) {
      clickTimes.shift();
    }
    if (clickTimes.length >= TRIPLE_CLICK_COUNT) {
      clickTimes = [];
      onTriple(e);
    }
  }
  target.addEventListener("click", onClick);
  return () => target.removeEventListener("click", onClick);
}

export function initAchievements() {
  // Load persisted state
  storage.load();
  let tracker = null;

  function startTracking() {
    if (tracker) return;
    // Fan-out: the tracker's onUnlock drives the UI (toast, log, badge)
    // and also emits an "analytics-unlock" window event so observers
    // can react to unlocks without importing the achievement module.
    function onUnlock(achievement) {
      onAchievementUnlocked(achievement);
      window.dispatchEvent(
        new CustomEvent("analytics-unlock", { detail: { achievement } }),
      );
    }
    function onRelock(achievement) {
      onAchievementRelocked(achievement);
      window.dispatchEvent(
        new CustomEvent("analytics-relock", { detail: { achievement } }),
      );
    }
    tracker = createTracker(onUnlock, onRelock);
    tracker.start();
  }

  function showUI() {
    createNavButton(() => {
      if (isPanelOpen()) {
        closePanel();
      } else {
        openPanel(() => {
          // onHide callback — user chose "hide from navbar"
          storage.setHidden(true);
          hideNavButton();
        });
      }
    });

    if (storage.isHidden()) {
      hideNavButton();
    } else {
      showNavButton();
    }
  }

  function activate(x, y) {
    // Either path below already announces with a click-site pulse and a
    // toast; the nav-button reveal pulse would pile a third attention-
    // grab on top.  Burn its latch up front so showNavButton lands
    // silently for this gesture.
    markRevealPulseFired();

    if (storage.isActive()) {
      // Already active — triple-click toggles visibility
      if (storage.isHidden()) {
        storage.setHidden(false);
        showNavButton();
        showActivationToast("Cloudlog restored");
        showActivationPulse(x, y);
        markGreeted();
      }
      return;
    }

    // First-time activation
    storage.activate();
    showActivationPulse(x, y);
    showActivationToast("Cloudlog activated");
    markGreeted();
    showUI();
    startTracking();

    // Clear text selection from triple-click
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();

    // Unlock the activation achievement
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "cloudlog-activate", x, y },
      }),
    );
  }

  // If already active from a previous session, start immediately
  if (storage.isActive()) {
    showUI();
    startTracking();
    maybeShowWelcomeBack(showActivationToast);
  }

  // A bulk storage rewrite (speedrun reset/restore) skips the per-unlock
  // callbacks that normally keep the UI in step, so repaint on demand: the
  // nav badge always, the panel only while it's open.
  window.addEventListener("cloudlog-bulk-change", () => {
    updateBadge();
    if (isPanelOpen()) refreshPanel();
  });

  // Contact link click events — dispatch achievement events for page-level links
  document.querySelectorAll('a[href^="mailto:"]').forEach((el) => {
    el.addEventListener("click", () => {
      window.dispatchEvent(
        new CustomEvent("achievement", { detail: { type: "contact-click" } }),
      );
    });
  });
  document.querySelectorAll('a[href*="linkedin"]').forEach((el) => {
    el.addEventListener("click", () => {
      window.dispatchEvent(
        new CustomEvent("achievement", { detail: { type: "linkedin-click" } }),
      );
    });
  });

  // Demo preview: the `finale` flag fires the completionist celebration
  // once so it can be judged without clearing the whole Cloudlog. Harmless
  // in production — nobody navigates here — and mirrors the `theme` shortcut.
  if (hasFlag("finale")) {
    setTimeout(celebrateCompletion, FINALE_PREVIEW_DELAY_MS);
  }

  // Keyboard shortcut — L opens/closes Cloudlog
  onKey("L", () => {
    if (!storage.isActive()) return;
    if (isPanelOpen()) {
      closePanel();
    } else {
      openPanel(() => {
        storage.setHidden(true);
        hideNavButton();
      });
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "cloudlog-shortcut" },
        }),
      );
    }
  });

  // While the panel is open, [ and ] swap tabs without leaving the
  // keyboard.  No-op when the panel is closed so the keys stay free for
  // anything else.
  const TABS_ORDER = ["achievements", "activity"];
  function stepTab(delta) {
    if (!isPanelOpen()) return;
    const i = TABS_ORDER.indexOf(getActiveTab());
    if (i === -1) return;
    const next =
      TABS_ORDER[(i + delta + TABS_ORDER.length) % TABS_ORDER.length];
    setActiveTab(next);
  }
  onKey("[", () => stepTab(-1));
  onKey("]", () => stepTab(1));

  // Deep-links open the panel directly to a tab (shareable "look what I
  // unlocked" URLs).
  function openFromHash() {
    let tab = null;
    if (hasFlag("cloudlog-activity")) tab = "activity";
    else if (hasFlag("cloudlog-achievements")) tab = "achievements";
    if (!tab) return;
    if (!storage.isActive()) return;
    if (!isPanelOpen()) {
      openPanel(() => {
        storage.setHidden(true);
        hideNavButton();
      });
    }
    setActiveTab(tab);
  }
  onUrlChange(openFromHash);
  openFromHash();

  createTripleClickDetector(document, (e) => activate(e.clientX, e.clientY));

  // Gentle one-time nudge for visitors who linger without discovering
  // any of the interactive layer.
  initDiscoveryHint(showActivationToast);

  // Cross-tab sync — when another tab writes the achievements key, this
  // tab's in-memory state is stale.  Re-load and repaint so an unlock in
  // one tab shows up in the other without a manual reload.  The
  // `storage` event only fires in *other* tabs, never the writer.
  window.addEventListener("storage", (e) => {
    if (e.key !== storage.STORAGE_KEY) return;
    storage.load();
    updateBadge();
    if (isPanelOpen()) refreshPanel();
  });

  // Tell the user once if a save fails (quota, private mode) so silent
  // data loss doesn't surprise them.  storage dispatches only on the
  // rising edge, so this fires once per failure run, not per write.
  window.addEventListener(
    "storage-write-failed",
    () => showActivationToast("Couldn't save — your progress may not persist"),
    { once: true },
  );

  // The `achievement` parameter deep-links to a specific card — opens the
  // panel and scrolls/highlights the card.  Shareable "look what I found" URL.
  const achParam = getParam("achievement");
  if (achParam && storage.isActive() && getAchievement(achParam)) {
    if (!isPanelOpen()) {
      openPanel(() => {
        storage.setHidden(true);
        hideNavButton();
      });
    }
    setActiveTab("achievements");
    setTimeout(() => scrollToCard(achParam), PANEL_SETTLE_MS);
  }
}
