// ── Achievement System Entry Point ──
// Public API for the achievement system. Handles activation (triple-click),
// wires tracker + UI + storage together. Called from index.html after all
// other modules initialize.

import * as storage from "./storage.js";
import { createTracker } from "./tracker.js";
import {
  createNavButton,
  showNavButton,
  hideNavButton,
  openPanel,
  closePanel,
  isPanelOpen,
  setDevMode,
  showActivationToast,
  showActivationPulse,
  onAchievementUnlocked,
} from "./ui.js";

// ── Triple-click detection ──
const TRIPLE_CLICK_MAX_MS = 600;
const TRIPLE_CLICK_COUNT = 3;

export function initAchievements() {
  const dev =
    window.location.hash === "#dev" ||
    window.location.href.includes("localhost");
  setDevMode(dev);

  // Load persisted state
  storage.load();
  let tracker = null;

  function startTracking() {
    if (tracker) return;
    tracker = createTracker(onAchievementUnlocked);
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
    }
  }

  function activate(x, y) {
    if (storage.isActive()) {
      // Already active — triple-click toggles visibility
      if (storage.isHidden()) {
        storage.setHidden(false);
        showNavButton();
        showActivationToast("Cloudlog restored");
        showActivationPulse(x, y);
      }
      return;
    }

    // First-time activation
    storage.activate();
    showActivationPulse(x, y);
    showActivationToast("Cloudlog activated");
    showUI();
    startTracking();

    // Clear text selection from triple-click
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();

    // Unlock the activation achievement and catch up on session state
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "cloudlog-activate" },
      }),
    );
    tracker.catchUp();
  }

  // If already active from a previous session, start immediately
  if (storage.isActive()) {
    showUI();
    startTracking();
  }

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

  // Triple-click detection
  let clickTimes = [];
  document.addEventListener("click", (e) => {
    const now = Date.now();
    clickTimes.push(now);

    // Keep only recent clicks
    while (clickTimes.length > 0 && now - clickTimes[0] > TRIPLE_CLICK_MAX_MS) {
      clickTimes.shift();
    }

    if (clickTimes.length >= TRIPLE_CLICK_COUNT) {
      clickTimes = [];
      activate(e.clientX, e.clientY);
    }
  });
}
