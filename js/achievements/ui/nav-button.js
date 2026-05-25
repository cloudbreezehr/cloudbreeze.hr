// ── Cloudlog Nav Button ──
// The navbar entry point that opens the Cloudlog panel.  Owns the
// button DOM and its unseen-count badge.  Shown/hidden in response
// to Cloudlog activation state.

import * as storage from "../storage.js";
import { CLOUD_CHECK_SVG } from "./icons.js";
import { showActivationPulse } from "./toast.js";

let navBtn = null;
let badgeEl = null;
let _onBadgeChange = null;
// Per-session latch — flips true after the first time the button
// enters a visible state, so subsequent hide/show cycles don't replay
// the introductory pulse.
let revealPulseFired = false;

export function createNavButton(onPanelToggle, { onBadgeChange } = {}) {
  const actions = document.querySelector(".nav-actions");
  if (!actions) return null;
  _onBadgeChange = onBadgeChange || null;

  navBtn = document.createElement("button");
  navBtn.className = "achievement-btn";
  navBtn.setAttribute("aria-label", "Achievements");
  navBtn.setAttribute("data-tooltip", "Cloudlog");
  navBtn.innerHTML = CLOUD_CHECK_SVG;

  badgeEl = document.createElement("span");
  badgeEl.className = "achievement-badge";
  badgeEl.textContent = "0";
  navBtn.appendChild(badgeEl);

  // Insert before the appearance toggle
  const appearanceToggle = actions.querySelector(".appearance-toggle");
  if (appearanceToggle) {
    actions.insertBefore(navBtn, appearanceToggle);
  } else {
    actions.insertBefore(navBtn, actions.firstChild);
  }

  navBtn.addEventListener("click", () => {
    onPanelToggle();
  });

  updateBadge();
  return navBtn;
}

function maybeFireRevealPulse() {
  if (revealPulseFired || !navBtn) return;
  revealPulseFired = true;
  const rect = navBtn.getBoundingClientRect();
  showActivationPulse(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

// Burn the latch without firing the pulse — callers that already have
// a more meaningful announcement (the activation pulse at the click
// site) use this so showNavButton doesn't double-announce.
export function markRevealPulseFired() {
  revealPulseFired = true;
}

export function showNavButton() {
  if (!navBtn) return;
  navBtn.style.display = "";
  maybeFireRevealPulse();
}

export function hideNavButton() {
  if (navBtn) navBtn.style.display = "none";
}

export function updateBadge() {
  if (badgeEl) {
    const count = storage.getUnseenCount();
    badgeEl.textContent = String(count);
    if (count > 0) {
      badgeEl.classList.add("visible");
    } else {
      badgeEl.classList.remove("visible");
    }
    if (navBtn) {
      navBtn.setAttribute(
        "data-tooltip",
        count > 0 ? `Cloudlog (${count} new)` : "Cloudlog",
      );
    }
  }
  // Let callers (tabs, panel) react to the same unseen count without
  // them needing to remember to invoke their own update.
  if (_onBadgeChange) _onBadgeChange();
}

export function pulseBadge() {
  if (!badgeEl) return;
  badgeEl.classList.remove("pulse");
  void badgeEl.offsetHeight;
  badgeEl.classList.add("pulse");
}

export function getNavBtnEl() {
  return navBtn;
}

export function setActive(active) {
  if (!navBtn) return;
  navBtn.classList.toggle("active", active);
}

// Test hook — discard module state between test runs.
export function _resetForTests() {
  if (navBtn && navBtn.parentNode) navBtn.parentNode.removeChild(navBtn);
  navBtn = null;
  badgeEl = null;
  _onBadgeChange = null;
  revealPulseFired = false;
}
