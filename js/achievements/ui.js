// ── Achievement UI ──
// Panel shell — header, tabs — and the lifecycle glue that binds the
// extracted submodules together.  Nav button, toast surface, cards,
// activity view, tooltip, and timestamp formatting live in ./ui/*.js.
// No canvas interaction.

import { ACHIEVEMENTS, sumPoints } from "./registry.js";
import * as storage from "./storage.js";
import * as activityLog from "./activity-log.js";
import { announce } from "./announcer.js";
import { trapFocus } from "./focus-trap.js";
import { hideHintTooltip } from "./ui/tooltip.js";
import {
  createNavButton as _createNavButton,
  showNavButton,
  hideNavButton,
  updateBadge as _updateBadge,
  pulseBadge,
  getNavBtnEl,
  setActive as setNavActive,
} from "./ui/nav-button.js";
import {
  configureToasts,
  buildAchievementToast,
  showToast,
  showRelockToast,
  showActivationToast,
  showActivationPulse,
  toastContainerContains,
  destroyToastContainer,
} from "./ui/toast.js";
import {
  configureCards,
  getRevealHints,
  setRevealHints,
  renderSections,
  refreshCard,
  scrollToCard,
  createSeenObserver,
  destroySeenObserver,
  observeUnseenCards,
  markAllSeen,
  updateMarkReadVisibility,
} from "./ui/cards.js";
import { renderActivity } from "./ui/activity.js";

// ── Panel Constants ──
const PANEL_SLIDE_MS = 300;

// ── State ──
let panelEl = null;
let panelOpen = false;
let _escHandler = null;
let _outsideHandler = null;
let _releaseFocusTrap = null;

// Hand the toast module its panel-facing callbacks once at import time.
// The referenced functions are declaration-hoisted so they're all live
// by the time the first toast fires.
configureToasts({
  openPanel,
  isPanelOpen,
  scrollToCard,
  setActiveTab,
  panelSlideMs: PANEL_SLIDE_MS,
});

// Same injection pattern for cards — it reads panelEl via a getter so
// it can cope with null (panel not yet built) and refreshPanel lets a
// single card re-render request a whole-panel refresh when section
// counts change.
configureCards({
  getPanelEl: () => panelEl,
  isPanelOpen,
  refreshPanel,
});

// ── Helpers ──

function totalPoints() {
  return sumPoints(storage.getUnlocked());
}

// ── Nav Button ──
// The button itself lives in ./ui/nav-button.js.  Thin wrappers below
// bridge the existing external call sites (createNavButton,
// updateBadge, showNavButton, hideNavButton) while tabs.js remains
// in this file — once tabs.js is extracted too, callers can import
// directly from nav-button.js.

export function createNavButton(onPanelToggle) {
  return _createNavButton(onPanelToggle, { onBadgeChange: updateTabBadges });
}

export function updateBadge() {
  _updateBadge();
}

export { showNavButton, hideNavButton };

// ── Panel ──

export function openPanel(onHide) {
  if (panelOpen) return;
  panelOpen = true;
  setNavActive(true);

  // Dispatch panel-open event for tracker
  window.dispatchEvent(
    new CustomEvent("achievement", { detail: { type: "panel-open" } }),
  );

  if (!panelEl) {
    panelEl = buildPanel(onHide);
    document.body.appendChild(panelEl);
  } else {
    refreshPanel();
  }

  // Force reflow then open
  void panelEl.offsetHeight;
  requestAnimationFrame(() => panelEl.classList.add("open"));

  // Start observing unseen cards
  createSeenObserver();
  observeUnseenCards();

  // Focus trap — keyboard users shouldn't tab behind the panel into
  // page content they can't see.  Starts on the next frame so the
  // panel's slide-in animation has committed and focus styles land
  // where the user expects.  Release happens in closePanel().
  requestAnimationFrame(() => {
    if (panelOpen && panelEl) {
      _releaseFocusTrap = trapFocus(panelEl);
    }
  });

  // Close on escape
  _escHandler = (e) => {
    if (e.key === "Escape") closePanel();
  };
  document.addEventListener("keydown", _escHandler);

  // Close on outside click (delayed to avoid catching the opening click)
  const OUTSIDE_CLICK_DELAY_MS = 50;
  setTimeout(() => {
    _outsideHandler = (e) => {
      const navEl = getNavBtnEl();
      if (
        panelEl &&
        !panelEl.contains(e.target) &&
        !(navEl && navEl.contains(e.target)) &&
        !toastContainerContains(e.target)
      ) {
        closePanel();
      }
    };
    document.addEventListener("pointerdown", _outsideHandler);
  }, OUTSIDE_CLICK_DELAY_MS);
}

export function closePanel() {
  if (!panelOpen || !panelEl) return;
  panelOpen = false;
  setNavActive(false);
  panelEl.classList.remove("open");
  hideHintTooltip();
  destroySeenObserver();

  if (_releaseFocusTrap) {
    _releaseFocusTrap();
    _releaseFocusTrap = null;
  }
  if (_escHandler) {
    document.removeEventListener("keydown", _escHandler);
    _escHandler = null;
  }
  if (_outsideHandler) {
    document.removeEventListener("pointerdown", _outsideHandler);
    _outsideHandler = null;
  }
}

export function isPanelOpen() {
  return panelOpen;
}

function buildPanel(onHide) {
  const panel = document.createElement("div");
  panel.className = "achievement-panel";

  // Header
  const header = document.createElement("div");
  header.className = "achievement-header";

  const titleRow = document.createElement("div");
  titleRow.className = "achievement-title-row";

  const title = document.createElement("h3");
  title.className = "achievement-title";
  title.textContent = "Cloudlog";

  const pointsEl = document.createElement("span");
  pointsEl.className = "achievement-points-total";
  pointsEl.textContent = `${totalPoints()} pts`;

  titleRow.appendChild(title);
  titleRow.appendChild(pointsEl);

  const closeBtn = document.createElement("button");
  closeBtn.className = "achievement-close";
  closeBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M4 12l8-8"/></svg>`;
  closeBtn.addEventListener("click", closePanel);

  header.appendChild(titleRow);
  header.appendChild(closeBtn);

  // Hint toggle — reveals descriptions on hidden achievements + tooltip clues on all locked
  const hintToggle = document.createElement("label");
  hintToggle.className = "achievement-hint-toggle";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = getRevealHints();
  cb.addEventListener("change", () => {
    setRevealHints(cb.checked);
  });
  hintToggle.appendChild(cb);
  hintToggle.appendChild(document.createTextNode(" Reveal hints"));

  const headerControls = document.createElement("div");
  headerControls.className = "achievement-header-controls";
  headerControls.appendChild(hintToggle);

  const markReadBtn = document.createElement("button");
  markReadBtn.className = "achievement-mark-read";
  markReadBtn.textContent = "Mark all read";
  markReadBtn.addEventListener("click", markAllSeen);
  headerControls.appendChild(markReadBtn);

  header.appendChild(headerControls);

  panel.appendChild(header);

  // Tab switcher — Achievements | Activity.  Default tab is Achievements.
  // Both tabs carry their own unseen badge — achievements counts unseen-in-
  // panel cards, activity counts unseen-in-log entries.  The nav-button
  // badge (outside the panel) mirrors only the achievement count.
  const tabs = document.createElement("div");
  tabs.className = "achievement-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.appendChild(
    buildTabButton("achievements", "Achievements", "achievements"),
  );
  tabs.appendChild(buildTabButton("activity", "Activity", "activity"));
  panel.appendChild(tabs);

  // Body (scrollable) — holds both tab views.  Only one is visible at a time.
  const body = document.createElement("div");
  body.className = "achievement-body";

  const achievementsView = document.createElement("div");
  achievementsView.className = "achievement-view achievement-view-achievements";
  achievementsView.setAttribute("role", "tabpanel");
  achievementsView.id = "achievement-panel-achievements";
  achievementsView.setAttribute(
    "aria-labelledby",
    "achievement-tab-achievements",
  );
  // Achievements is the default tab on open — mark it active so the
  // matching CSS display rule takes effect from the first paint.
  if (activeTab === "achievements") achievementsView.classList.add("active");
  renderSections(achievementsView);
  body.appendChild(achievementsView);

  const activityView = document.createElement("div");
  activityView.className = "achievement-view achievement-view-activity";
  activityView.setAttribute("role", "tabpanel");
  activityView.id = "achievement-panel-activity";
  activityView.setAttribute("aria-labelledby", "achievement-tab-activity");
  if (activeTab === "activity") activityView.classList.add("active");
  renderActivity(activityView);
  body.appendChild(activityView);

  // Dismiss tooltip when scrolling the panel
  body.addEventListener("scroll", hideHintTooltip, { passive: true });

  panel.appendChild(body);

  // Footer with hide option
  const footer = document.createElement("div");
  footer.className = "achievement-footer";
  const hideBtn = document.createElement("button");
  hideBtn.className = "achievement-hide-btn";
  hideBtn.textContent = "Hide from navbar";
  hideBtn.addEventListener("click", () => {
    closePanel();
    if (onHide) onHide();
  });
  const countEl = document.createElement("span");
  countEl.className = "achievement-count-total";
  const unlocked = storage.getUnlocked().length;
  countEl.textContent = `${unlocked}/${ACHIEVEMENTS.length}`;
  countEl.setAttribute(
    "data-tooltip",
    `Earned ${unlocked} of ${ACHIEVEMENTS.length} achievements`,
  );

  footer.appendChild(hideBtn);
  footer.appendChild(countEl);
  panel.appendChild(footer);

  // Hide "Mark all read" when nothing is unseen
  const markBtn = panel.querySelector(".achievement-mark-read");
  if (markBtn && storage.getUnseenCount() === 0) markBtn.style.display = "none";

  // Keep Activity tab + badge in sync with the log.  The panel is a
  // singleton (built once, reused), so no explicit unsubscribe is needed.
  activityLog.onChange(() => {
    if (!panelEl) return;
    const view = panelEl.querySelector(".achievement-view-activity");
    if (view) renderActivity(view);
    updateTabBadges();
  });

  // Initial badge paint reflects any unseen entries from prior sessions.
  updateTabBadges();

  return panel;
}

function refreshPanel() {
  if (!panelEl) return;
  // Update points and count
  const pointsEl = panelEl.querySelector(".achievement-points-total");
  if (pointsEl) pointsEl.textContent = `${totalPoints()} pts`;
  const countEl = panelEl.querySelector(".achievement-count-total");
  if (countEl) {
    const unlocked = storage.getUnlocked().length;
    countEl.textContent = `${unlocked}/${ACHIEVEMENTS.length}`;
    countEl.setAttribute(
      "data-tooltip",
      `Earned ${unlocked} of ${ACHIEVEMENTS.length} achievements`,
    );
  }

  // Re-render the Achievements view only — the Activity view is managed by
  // its own onChange subscription so rebuilding it here would double-render.
  const achView = panelEl.querySelector(".achievement-view-achievements");
  if (achView) {
    achView.innerHTML = "";
    renderSections(achView);
  }

  // Re-observe new unseen cards after DOM rebuild
  observeUnseenCards();
  updateMarkReadVisibility();
  updateTabBadges();
}

// ── Tabs ──
// Panel body holds two views — "achievements" (grouped sets, the original
// Cloudlog content) and "activity" (flat reverse-chron log of events).
// Switching tabs toggles which view is shown; activity tab also marks all
// entries seen on open, clearing its own unseen badge.

let activeTab = "achievements";

function buildTabButton(id, label, unseenSource) {
  const btn = document.createElement("button");
  btn.className = "achievement-tab";
  btn.dataset.tab = id;
  btn.setAttribute("role", "tab");
  btn.id = `achievement-tab-${id}`;
  btn.setAttribute("aria-controls", `achievement-panel-${id}`);
  const isActive = id === activeTab;
  btn.setAttribute("aria-selected", isActive ? "true" : "false");
  btn.tabIndex = isActive ? 0 : -1;
  if (isActive) btn.classList.add("active");

  const labelEl = document.createElement("span");
  labelEl.className = "achievement-tab-label";
  labelEl.textContent = label;
  btn.appendChild(labelEl);

  // Badge is created even when count is zero so we can show/hide via CSS.
  const badge = document.createElement("span");
  badge.className = "achievement-tab-badge";
  btn.appendChild(badge);
  btn.dataset.unseenSource = unseenSource || "";

  btn.addEventListener("click", () => setActiveTab(id));
  // Left/Right arrow navigation between tabs — standard ARIA tab pattern.
  btn.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (!panelEl) return;
    const all = Array.from(panelEl.querySelectorAll(".achievement-tab"));
    const i = all.indexOf(btn);
    if (i === -1) return;
    const next =
      e.key === "ArrowRight"
        ? all[(i + 1) % all.length]
        : all[(i - 1 + all.length) % all.length];
    setActiveTab(next.dataset.tab);
    next.focus();
    e.preventDefault();
  });
  return btn;
}

function setActiveTab(id) {
  if (!panelEl) return;
  activeTab = id;
  panelEl.querySelectorAll(".achievement-tab").forEach((btn) => {
    const isActive = btn.dataset.tab === id;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    btn.tabIndex = isActive ? 0 : -1;
  });
  panelEl
    .querySelector(".achievement-view-achievements")
    ?.classList.toggle("active", id === "achievements");
  panelEl
    .querySelector(".achievement-view-activity")
    ?.classList.toggle("active", id === "activity");
  // Opening the Activity tab marks all its entries as seen — matches how
  // opening the Cloudlog clears the achievement-unseen badge.
  if (id === "activity") activityLog.markAllSeen();
  updateTabBadges();
}

function updateTabBadges() {
  if (!panelEl) return;
  panelEl.querySelectorAll(".achievement-tab").forEach((btn) => {
    const source = btn.dataset.unseenSource;
    if (!source) return;
    const badge = btn.querySelector(".achievement-tab-badge");
    if (!badge) return;
    let count = 0;
    if (source === "activity") count = activityLog.getUnseenCount();
    else if (source === "achievements") count = storage.getUnseenCount();
    badge.textContent = String(count);
    badge.classList.toggle("visible", count > 0);
  });
}

// ── Toast re-exports ──
// Toast behavior lives in `./ui/toast.js`; this file still owns the
// panel and injects the panel-facing callbacks into the toast click
// handler via configureToasts (see the top of this file).

export {
  buildAchievementToast,
  showToast,
  showRelockToast,
  showActivationToast,
  showActivationPulse,
};

// ── Card re-exports ──
// Card rendering lives in `./ui/cards.js`.  The panel injects its
// callbacks via configureCards at the top of this file.

export { refreshCard };

// ── Lifecycle ──

export function onAchievementUnlocked(achievement) {
  showToast(achievement);
  announce(`Achievement unlocked: ${achievement.title}`);
  activityLog.log("achievement-unlocked", { achievementId: achievement.id });
  updateBadge();
  pulseBadge();
  refreshCard(achievement.id);
}

export function onAchievementRelocked(achievement) {
  showRelockToast(achievement);
  announce(`Achievement re-locked: ${achievement.title}`);
  updateBadge();
  refreshPanel();
}

export function destroy() {
  destroySeenObserver();
  hideHintTooltip();
  const navEl = getNavBtnEl();
  if (navEl && navEl.parentNode) navEl.remove();
  if (panelEl && panelEl.parentNode) panelEl.remove();
  destroyToastContainer();
  panelEl = null;
  panelOpen = false;
}
