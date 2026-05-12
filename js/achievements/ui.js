// ── Achievement UI ──
// Facade that binds the extracted submodules together.  All DOM and
// behavior live in ./ui/*.js; this file exports the public API plus
// the two lifecycle callbacks (onAchievementUnlocked,
// onAchievementRelocked) that fan an unlock out to the toast,
// announcer, activity log, nav badge, and card.  No canvas interaction.

import * as activityLog from "./activity-log.js";
import { announce } from "./announcer.js";
import { hideHintTooltip } from "./ui/tooltip.js";
import {
  createNavButton as _createNavButton,
  showNavButton,
  hideNavButton,
  updateBadge,
  pulseBadge,
  getNavBtnEl,
} from "./ui/nav-button.js";
import {
  buildAchievementToast,
  showToast,
  showRelockToast,
  showActivationToast,
  showActivationPulse,
  destroyToastContainer,
} from "./ui/toast.js";
import { refreshCard, destroySeenObserver } from "./ui/cards.js";
import { updateTabBadges } from "./ui/tabs.js";
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

export { updateBadge, showNavButton, hideNavButton };

export { openPanel, closePanel, isPanelOpen };

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
