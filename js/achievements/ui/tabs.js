// ── Cloudlog Tabs ──
// Panel body holds two views — "achievements" (grouped sets, the original
// Cloudlog content) and "activity" (flat reverse-chron log of events).
// Switching tabs toggles which view is shown; activity tab also marks all
// entries seen on open, clearing its own unseen badge.

import * as storage from "../storage.js";
import * as activityLog from "../activity-log.js";

// ── State ──
let activeTab = "achievements";

// Panel is owned by the facade; tabs reads it via an injected getter
// so it can cope with null (before buildPanel runs) without importing
// ui.js and risking a circular dependency.
let _getPanelEl = () => null;

export function configureTabs({ getPanelEl } = {}) {
  if (getPanelEl) _getPanelEl = getPanelEl;
}

export function getActiveTab() {
  return activeTab;
}

export function buildTabButton(id, label, unseenSource) {
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
    const panelEl = _getPanelEl();
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

export function setActiveTab(id) {
  const panelEl = _getPanelEl();
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

export function updateTabBadges() {
  const panelEl = _getPanelEl();
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

// Test hook — return to default tab and drop the injected getter.
export function _resetForTests() {
  activeTab = "achievements";
  _getPanelEl = () => null;
}
