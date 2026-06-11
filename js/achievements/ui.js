// ── Achievement UI ──
// Facade that binds the extracted submodules together.  All DOM and
// behavior live in ./ui/*.js; this file exports the public API plus
// the two lifecycle callbacks (onAchievementUnlocked,
// onAchievementRelocked) that fan an unlock out to the toast,
// announcer, activity log, nav badge, and card.  No canvas interaction.
//
// Also writes theme-switch entries into the activity log so the user
// can see when they entered or left a theme alongside their unlocks.

import * as activityLog from "./activity-log.js";
import * as storage from "./storage.js";
import { announce } from "./announcer.js";
import { hideHintTooltip } from "./ui/tooltip.js";
import {
  createNavButton as _createNavButton,
  showNavButton,
  hideNavButton,
  updateBadge,
  pulseBadge,
  getNavBtnEl,
  markRevealPulseFired,
} from "./ui/nav-button.js";
import {
  buildAchievementToast,
  showToast,
  showRelockToast,
  showActivationToast,
  showActivationPulse,
  celebrateFirstUnlock,
  destroyToastContainer,
} from "./ui/toast.js";
import { refreshCard, destroySeenObserver } from "./ui/cards.js";
import { updateTabBadges, setActiveTab, getActiveTab } from "./ui/tabs.js";
import {
  openPanel,
  closePanel,
  isPanelOpen,
  refreshPanel,
  destroyPanel,
} from "./ui/panel.js";

// ── Nav Button ──
// The button itself lives in ./ui/nav-button.js.  The wrapper below
// binds its unseen-count signal to tabs.updateTabBadges so a single
// call to updateBadge refreshes both the nav and the tab badges.

export function createNavButton(onPanelToggle) {
  return _createNavButton(onPanelToggle, { onBadgeChange: updateTabBadges });
}

export { updateBadge, showNavButton, hideNavButton, markRevealPulseFired };

export { openPanel, closePanel, isPanelOpen, refreshPanel };

export { setActiveTab, getActiveTab };

export {
  buildAchievementToast,
  showToast,
  showRelockToast,
  showActivationToast,
  showActivationPulse,
};

export { refreshCard };

// ── Lifecycle ──

export function onAchievementUnlocked(achievement) {
  showToast(achievement);
  const pts = achievement.points || 0;
  const noun = pts === 1 ? "point" : "points";
  announce(`Achievement unlocked: ${achievement.title}. ${pts} ${noun}.`);
  activityLog.log("achievement-unlocked", { achievementId: achievement.id });
  // The first unlock of all time gets a rocket volley regardless of
  // tier — a one-time "this site does something" beat.  Latched in a
  // pref so it never repeats.
  if (!storage.getPref("firstUnlockCelebrated", false)) {
    storage.setPref("firstUnlockCelebrated", true);
    celebrateFirstUnlock();
  }
  updateBadge();
  pulseBadge();
  refreshCard(achievement.id);
}

export function onAchievementRelocked(achievement) {
  showRelockToast(achievement);
  announce(`Achievement re-locked: ${achievement.title}`);
  activityLog.log("achievement-relocked", { achievementId: achievement.id });
  updateBadge();
  refreshPanel();
}

export function destroy() {
  destroySeenObserver();
  hideHintTooltip();
  const navEl = getNavBtnEl();
  if (navEl && navEl.parentNode) navEl.remove();
  destroyPanel();
  destroyToastContainer();
}

// ── Theme-switch logging ──
// One subscription for the module's lifetime — no teardown needed.
// Both user-driven and programmatic (silent) switches are logged so
// the activity tab reflects every change in theme state.
function onAchievementEvent(e) {
  const d = e.detail;
  if (!d) return;
  if (d.type === "theme-activate" || d.type === "theme-deactivate") {
    activityLog.log("theme-switched", {
      themeId: d.theme,
      activated: d.type === "theme-activate",
    });
  }
}
window.addEventListener("achievement", onAchievementEvent);

// Test hook — drop the subscription so each module-reset run starts
// from a clean slate.  Production never calls this.
export function _resetForTests() {
  window.removeEventListener("achievement", onAchievementEvent);
}
