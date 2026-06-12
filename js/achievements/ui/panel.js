// ── Cloudlog Panel ──
// Slide-in panel shell: header (title, points, hint toggle, mark-read),
// tab switcher (delegated to tabs.js), body containing the two views
// (achievements via cards.js, activity via activity.js), and footer.
// Also owns panel lifecycle — open/close, escape dismissal, focus-trap
// wiring — and the configure* calls that wire sibling submodules to
// the live panel element.

import { ACHIEVEMENTS, sumPoints, getAchievement } from "../registry.js";
import * as storage from "../storage.js";
import * as activityLog from "../activity-log.js";
import { paintRelativeTime } from "../../time-ago.js";
import { trapFocus } from "../focus-trap.js";
import { pushOverlay } from "../../overlay-history.js";
import { getAppearancePreference } from "../../appearance.js";
import { hideHintTooltip } from "./tooltip.js";
import { setActive as setNavActive, updateBadge } from "./nav-button.js";
import { configureToasts, showActivationToast } from "./toast.js";
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
import {
  configureActivity,
  renderActivity,
  scrollToLatestActivityFor,
} from "./activity.js";
import {
  configureTabs,
  getActiveTab,
  buildTabButton,
  updateTabBadges,
} from "./tabs.js";

// ── Panel Constants ──
const PANEL_SLIDE_MS = 300;
const COMPACT_PREF = "compactCards";

// ── State ──
let panelEl = null;
let panelOpen = false;
let _escHandler = null;
let _releaseFocusTrap = null;
let _overlayHandle = null;
// Per-tab scroll positions snapshotted at close and restored on reopen,
// so a user who scrolled deep into a list and then closed the panel
// returns to the same view rather than the top.  Keyed by tab class
// fragment ("achievements" | "activity").
const _scrollByTab = new Map();

// Wire sibling submodules to this module's live panel state.  Done once
// at module-evaluation time; openPanel/isPanelOpen/refreshPanel are
// function-declaration-hoisted so the references captured here are
// already valid when the submodules are later exercised.
configureToasts({
  openPanel,
  isPanelOpen,
  scrollToCard,
  scrollToActivityEntryFor: scrollToLatestActivityFor,
  panelSlideMs: PANEL_SLIDE_MS,
});
configureCards({
  getPanelEl: () => panelEl,
  isPanelOpen,
  refreshPanel,
  scrollToActivityEntryFor: scrollToLatestActivityFor,
});
configureTabs({ getPanelEl: () => panelEl });
configureActivity({ getPanelEl: () => panelEl });

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

// Paint the overall-completion strip: fill width = unlocked / total,
// plus an accessible label.  Re-callable so refreshPanel keeps it
// current as unlocks land.
function paintProgressStrip(strip) {
  if (!strip) return;
  const fill = strip.querySelector(".achievement-progress-strip-fill");
  const unlocked = storage.getUnlocked().length;
  const total = ACHIEVEMENTS.length;
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  if (fill) fill.style.width = `${pct}%`;
  strip.setAttribute("role", "progressbar");
  strip.setAttribute("aria-valuemin", "0");
  strip.setAttribute("aria-valuemax", "100");
  strip.setAttribute("aria-valuenow", String(pct));
  strip.setAttribute("aria-label", `${pct}% of achievements unlocked`);
}

// Paint the "Last: <title> · <relative time>" caption from the most
// recently unlocked achievement.  Stays empty (and display:none via the
// :empty CSS) when nothing's unlocked yet.
function paintLastUnlocked(el) {
  if (!el) return;
  const unlocked = storage.getUnlocked();
  if (unlocked.length === 0) {
    el.textContent = "";
    return;
  }
  // getUnlocked() preserves insertion order, so the last entry is the
  // most recent unlock.
  const latest = unlocked[unlocked.length - 1];
  const ach = getAchievement(latest.id);
  if (!ach) {
    el.textContent = "";
    return;
  }
  el.textContent = "";
  const label = document.createElement("span");
  label.textContent = `Last: ${ach.title} · `;
  const time = document.createElement("span");
  paintRelativeTime(time, latest.ts);
  el.appendChild(label);
  el.appendChild(time);
}

// Export/import controls for the footer.  Export downloads the live
// state as JSON; import reads a chosen file and replaces local state
// (then repaints).  Kept compact — two small icon-ish text buttons.
function buildBackupControls() {
  const wrap = document.createElement("div");
  wrap.className = "achievement-backup";

  const exportBtn = document.createElement("button");
  exportBtn.className = "achievement-backup-btn";
  exportBtn.textContent = "Export";
  exportBtn.title = "Download your Cloudlog as a JSON file";
  exportBtn.addEventListener("click", () => {
    const blob = new Blob([storage.exportState()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cloudbreeze-cloudlog.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json,.json";
  importInput.style.display = "none";
  importInput.addEventListener("change", () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (storage.importState(String(reader.result))) {
        refreshPanel();
        // refreshPanel repaints panel contents only; the nav badge reads
        // the unseen count separately and needs its own nudge.
        updateBadge();
        showActivationToast("Cloudlog imported");
      } else {
        showActivationToast("Import failed — not a valid backup");
      }
    };
    reader.readAsText(file);
    importInput.value = "";
  });
  const importBtn = document.createElement("button");
  importBtn.className = "achievement-backup-btn";
  importBtn.textContent = "Import";
  importBtn.title = "Replace your Cloudlog from a backup file";
  importBtn.addEventListener("click", () => importInput.click());

  wrap.appendChild(exportBtn);
  wrap.appendChild(importBtn);
  wrap.appendChild(importInput);
  return wrap;
}

// ── Panel ──

export function openPanel(onHide) {
  if (panelOpen) return;
  // Register with the shared overlay-history stack so Back / back-gesture
  // closes the panel before navigating away, and Forward reopens it after
  // any close that left a forward entry.  The handle is kept in
  // _overlayHandle across close/reopen cycles so subsequent UI-closes
  // after a Forward-reopen still rewind the browser cursor.  pop() is
  // idempotent on the entry's alive flag, so a second pop in an already-
  // dead cycle is a silent no-op.  onReopen calls openPanelUI directly
  // so the DOM setup runs without pushing another overlay entry on top.
  //
  // Drop any stale handle before overwriting — invariant is that
  // _overlayHandle is always null or the currently-tracked overlay.
  // (A handle can be non-null here if the panel was closed via Back,
  // leaving the entry dead but still referenced.)
  if (_overlayHandle) _overlayHandle.dispose();
  _overlayHandle = pushOverlay(
    () => closePanel(),
    () => openPanelUI(onHide),
  );
  openPanelUI(onHide);
}

// UI-only open path.  Runs the DOM/event-handler setup without touching
// the overlay-history stack — used both by openPanel (on first open)
// and by the onReopen callback when the user navigates Forward back
// into a closed overlay entry.  Guarded against double-open so that a
// stray onReopen for an already-open panel is a no-op.
function openPanelUI(onHide) {
  if (panelOpen) return;
  panelOpen = true;
  setNavActive(true);

  // Appearance preference feeds the cartographers-almanac achievement
  // which collects each appearance the panel is opened under. Initial
  // tab credits Tab Tourist for the default view so the user only
  // needs to click the other tab to complete the pair.
  window.dispatchEvent(
    new CustomEvent("achievement", {
      detail: {
        type: "panel-open",
        appearance: getAppearancePreference(),
        tab: getActiveTab(),
      },
    }),
  );

  if (!panelEl) {
    panelEl = buildPanel(onHide);
    // Mount inert — Tab order should skip the panel until it's open.
    // openPanelUI un-inerts below; closePanel sets it back.
    panelEl.setAttribute("inert", "");
    document.body.appendChild(panelEl);
  } else {
    refreshPanel();
  }

  // Force reflow then open
  void panelEl.offsetHeight;
  panelEl.removeAttribute("inert");
  requestAnimationFrame(() => panelEl.classList.add("open"));

  // Restore each tab's last scroll position so reopening lands the
  // user back where they were.  Has to happen after the panel is in
  // the DOM tree (above) so the views have layout to scroll against.
  for (const [tab, top] of _scrollByTab) {
    const view = panelEl.querySelector(`.achievement-view-${tab}`);
    if (view) view.scrollTop = top;
  }

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
}

export function closePanel() {
  if (!panelOpen || !panelEl) return;
  panelOpen = false;
  setNavActive(false);

  // Stamp the close time so the next open can highlight unlocks earned
  // in the interim.
  storage.setPref(storage.LAST_PANEL_CLOSE_PREF, Date.now());

  // Snapshot scroll positions before the close animation runs so a
  // subsequent open restores the user's last view per tab.
  for (const tab of ["achievements", "activity"]) {
    const view = panelEl.querySelector(`.achievement-view-${tab}`);
    if (view) _scrollByTab.set(tab, view.scrollTop);
  }

  panelEl.classList.remove("open");
  // Make the off-screen panel non-focusable so Tab order doesn't walk
  // through the hidden cards.  Without this, after the visible page
  // ends, focus continues into the panel's role=button cards which
  // are mounted but slid off via transform: translateX(100%).
  panelEl.setAttribute("inert", "");
  hideHintTooltip();
  destroySeenObserver();

  // Pop but keep the handle — a Forward press after this close will
  // route through onReopen and call openPanelUI again.  The handle is
  // only released in destroyPanel (full teardown) or when a new
  // openPanel creates a fresh entry.  pop() is idempotent against the
  // entry's alive flag, so popstate-initiated closes (where alive was
  // already flipped by the handler) are safe.
  if (_overlayHandle) _overlayHandle.pop();

  if (_releaseFocusTrap) {
    _releaseFocusTrap();
    _releaseFocusTrap = null;
  }
  if (_escHandler) {
    document.removeEventListener("keydown", _escHandler);
    _escHandler = null;
  }
}

export function isPanelOpen() {
  return panelOpen;
}

function buildPanel(onHide) {
  const panel = document.createElement("div");
  panel.className = "achievement-panel";
  // Restore the persisted density preference so it survives reloads.
  if (storage.getPref(COMPACT_PREF, false)) panel.classList.add("compact");

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

  // Overall completion strip — turns the bare "12/26" count into a
  // glanceable "you're ~46% there" bar.  Width driven inline so the
  // single source of truth is the unlocked/total ratio.
  const progressStrip = document.createElement("div");
  progressStrip.className = "achievement-progress-strip";
  const progressFill = document.createElement("div");
  progressFill.className = "achievement-progress-strip-fill";
  progressStrip.appendChild(progressFill);
  paintProgressStrip(progressStrip);

  // "Last: <title> · 2m ago" session-context caption.  Hidden until the
  // first unlock exists; paintLastUnlocked owns visibility + content.
  const lastUnlocked = document.createElement("div");
  lastUnlocked.className = "achievement-last-unlocked";
  paintLastUnlocked(lastUnlocked);

  const closeBtn = document.createElement("button");
  closeBtn.className = "achievement-close";
  closeBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M4 12l8-8"/></svg>`;
  closeBtn.addEventListener("click", closePanel);

  header.appendChild(titleRow);
  header.appendChild(closeBtn);
  header.appendChild(progressStrip);
  header.appendChild(lastUnlocked);

  // Hint toggle — reveals descriptions on hidden achievements + tooltip clues on all locked
  const hintToggle = document.createElement("label");
  hintToggle.className = "achievement-hint-toggle";
  hintToggle.title =
    "Show hint text on locked achievements (hidden ones stay anonymous)";
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

  // Density toggle — collapses card descriptions for a denser list.
  // The label names the action it performs (a SR user hears the same
  // thing a sighted one reads), so no aria-pressed: pairing "pressed"
  // with an action verb ("Comfortable, pressed") reads as a contradiction.
  const densityBtn = document.createElement("button");
  densityBtn.className = "achievement-density-btn";
  densityBtn.title = "Toggle compact list";
  densityBtn.textContent = panel.classList.contains("compact")
    ? "Comfortable"
    : "Compact";
  densityBtn.addEventListener("click", () => {
    const compact = !panel.classList.contains("compact");
    panel.classList.toggle("compact", compact);
    storage.setPref(COMPACT_PREF, compact);
    densityBtn.textContent = compact ? "Comfortable" : "Compact";
  });
  headerControls.appendChild(densityBtn);

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

  // Body — wrapper around both tab views.  Each view is its own scroll
  // container; only one is visible at a time.
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

  // Each view is its own scroll container, so the tooltip-dismiss
  // listener has to attach to whichever one is doing the scrolling.
  achievementsView.addEventListener("scroll", hideHintTooltip, {
    passive: true,
  });
  activityView.addEventListener("scroll", hideHintTooltip, { passive: true });

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

  // Visit streak — a tiny "back tomorrow" nudge.  Shown only at 2+
  // consecutive days so a first/one-off visit carries no clutter.
  const streak = storage.currentStreak();
  if (streak >= 2) {
    const streakEl = document.createElement("span");
    streakEl.className = "achievement-streak";
    streakEl.textContent = `🔥 ${streak}-day streak`;
    streakEl.setAttribute("data-tooltip", "Consecutive days visited");
    footer.appendChild(streakEl);
  }

  footer.appendChild(hideBtn);
  footer.appendChild(buildBackupControls());
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
  paintProgressStrip(panelEl.querySelector(".achievement-progress-strip"));
  paintLastUnlocked(panelEl.querySelector(".achievement-last-unlocked"));
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
  // renderSections clears the view itself (preserving search focus/caret).
  const achView = panelEl.querySelector(".achievement-view-achievements");
  if (achView) renderSections(achView);

  // Re-observe new unseen cards after DOM rebuild
  observeUnseenCards();
  updateMarkReadVisibility();
  updateTabBadges();
}

// Drop panel-owned state — DOM, open flag, and the global handlers
// (escape, focus trap, etc.) that openPanel installs.  The facade's
// destroy() calls this alongside each sibling module's own reset so
// full UI teardown is a chain of module-owned cleanups.
export function destroyPanel() {
  if (panelEl && panelEl.parentNode) panelEl.remove();
  panelEl = null;
  panelOpen = false;
  // Full teardown — dispose() unregisters the overlay entirely so a
  // later Forward press can't resurrect a destroyed UI.  pop() first
  // to rewind the browser if this entry is still on top.
  if (_overlayHandle) {
    _overlayHandle.pop();
    _overlayHandle.dispose();
    _overlayHandle = null;
  }
  if (_releaseFocusTrap) {
    _releaseFocusTrap();
    _releaseFocusTrap = null;
  }
  if (_escHandler) {
    document.removeEventListener("keydown", _escHandler);
    _escHandler = null;
  }
  _scrollByTab.clear();
}

// Test hook — drop panel state between runs.
export function _resetForTests() {
  destroyPanel();
}
