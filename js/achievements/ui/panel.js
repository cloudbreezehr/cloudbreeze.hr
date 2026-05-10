// ── Cloudlog Panel ──
// Slide-in panel shell: header (title, points, hint toggle, mark-read),
// tab switcher (delegated to tabs.js), body containing the two views
// (achievements via cards.js, activity via activity.js), and footer.
// Also owns panel lifecycle — open/close, escape + outside-click
// dismissal, focus-trap wiring — and the configure* calls that wire
// sibling submodules to the live panel element.

import { ACHIEVEMENTS, sumPoints } from "../registry.js";
import * as storage from "../storage.js";
import * as activityLog from "../activity-log.js";
import { trapFocus } from "../focus-trap.js";
import { hideHintTooltip } from "./tooltip.js";
import { getNavBtnEl, setActive as setNavActive } from "./nav-button.js";
import { configureToasts, toastContainerContains } from "./toast.js";
import {
  configureCards,
  getRevealHints,
  setRevealHints,
  renderSections,
  scrollToCard,
  createSeenObserver,
  destroySeenObserver,
  observeUnseenCards,
  markAllSeen,
  updateMarkReadVisibility,
} from "./cards.js";
import { renderActivity } from "./activity.js";
import {
  configureTabs,
  getActiveTab,
  buildTabButton,
  setActiveTab,
  updateTabBadges,
} from "./tabs.js";

// ── Panel Constants ──
const PANEL_SLIDE_MS = 300;
const OUTSIDE_CLICK_DELAY_MS = 50;

// ── State ──
let panelEl = null;
let panelOpen = false;
let _escHandler = null;
let _outsideHandler = null;
let _releaseFocusTrap = null;

// Wire sibling submodules to this module's live panel state.  Done once
// at module-evaluation time; openPanel/isPanelOpen/refreshPanel are
// function-declaration-hoisted so the references captured here are
// already valid when toasts, cards, and tabs are later exercised.
configureToasts({
  openPanel,
  isPanelOpen,
  scrollToCard,
  setActiveTab,
  panelSlideMs: PANEL_SLIDE_MS,
});
configureCards({
  getPanelEl: () => panelEl,
  isPanelOpen,
  refreshPanel,
});
configureTabs({ getPanelEl: () => panelEl });

// Keep the Activity tab + tab badges in sync with the log.  The
// subscriber reads panelEl via the module-level let binding so it
// stays correct across destroyPanel → rebuild cycles — no explicit
// unsubscribe, just one subscription for the module's lifetime.
activityLog.onChange(() => {
  if (!panelEl) return;
  const view = panelEl.querySelector(".achievement-view-activity");
  if (view) renderActivity(view);
  updateTabBadges();
});

// ── Helpers ──

function totalPoints() {
  return sumPoints(storage.getUnlocked());
}

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
  if (getActiveTab() === "achievements")
    achievementsView.classList.add("active");
  renderSections(achievementsView);
  body.appendChild(achievementsView);

  const activityView = document.createElement("div");
  activityView.className = "achievement-view achievement-view-activity";
  activityView.setAttribute("role", "tabpanel");
  activityView.id = "achievement-panel-activity";
  activityView.setAttribute("aria-labelledby", "achievement-tab-activity");
  if (getActiveTab() === "activity") activityView.classList.add("active");
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

  // Initial badge paint reflects any unseen entries from prior sessions.
  updateTabBadges();

  return panel;
}

// Whole-panel refresh used when section counts or card states change.
// Cards and tabs both reach this via configureCards' injected callback
// so a single unlock fans out to: header totals → Achievements view
// re-render → seen-observer re-attach → mark-read button visibility →
// tab badges.  The Activity view isn't touched — its onChange
// subscription at module-top owns that path.
export function refreshPanel() {
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

// Drop panel-owned state — DOM, open flag, and the global handlers
// (escape, outside-click, focus trap) that openPanel installs.  The
// facade's destroy() calls this alongside each sibling module's own
// reset so full UI teardown is a chain of module-owned cleanups.
export function destroyPanel() {
  if (panelEl && panelEl.parentNode) panelEl.remove();
  panelEl = null;
  panelOpen = false;
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

// Test hook — drop panel state between runs.
export function _resetForTests() {
  destroyPanel();
}
