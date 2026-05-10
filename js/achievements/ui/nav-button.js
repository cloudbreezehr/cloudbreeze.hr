// ── Cloudlog Nav Button ──
// The navbar entry point that opens the Cloudlog panel.  Owns the
// button DOM and its unseen-count badge.  Shown/hidden in response
// to activation state (see js/achievements/index.js).

import * as storage from "../storage.js";

// Matches the SVG used throughout the Cloudlog UI so the nav button,
// toast icon, and activation pulse share a consistent visual identity.
const CLOUD_CHECK_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M11.5 12H5C3.3 12 2 10.7 2 9c0-1.5 1-2.7 2.4-3C4.7 4.4 6.2 3 8 3c1.3 0 2.4.6 3.1 1.6.3-.1.6-.1.9-.1 1.7 0 3 1.3 3 3 0 1.5-1.1 2.8-2.5 3"/>
  <path d="M6 10l2 2 3-3.5"/>
</svg>`;

let navBtn = null;
let badgeEl = null;
let _onBadgeChange = null;

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

  // Insert before the theme toggle
  const themeToggle = actions.querySelector(".theme-toggle");
  if (themeToggle) {
    actions.insertBefore(navBtn, themeToggle);
  } else {
    actions.insertBefore(navBtn, actions.firstChild);
  }

  navBtn.addEventListener("click", () => {
    onPanelToggle();
  });

  updateBadge();
  return navBtn;
}

export function showNavButton() {
  if (navBtn) navBtn.style.display = "";
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
}
