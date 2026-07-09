// ── Cloudlog Panel ──
// Slide-in panel shell: header (title, points, hint toggle, mark-read),
// tab switcher (delegated to tabs.js), body containing the two views
// (achievements via cards.js, activity via activity.js), and footer.
// Also owns panel lifecycle — open/close, escape dismissal, focus-trap
// wiring — and the configure* calls that wire sibling submodules to
// the live panel element.

import {
  getReachableAchievements,
  countCoreBonus,
  sumPoints,
  getAchievement,
} from "../registry.js";
import * as storage from "../storage.js";
import { exportBackup, importBackup } from "../backup.js";
import * as activityLog from "../activity-log.js";
import { paintRelativeTime } from "../../time-ago.js";
import { downloadBlob } from "../../download.js";
import { trapFocus } from "../focus-trap.js";
import { pushOverlay } from "../../overlay-history.js";
import { getAppearancePreference } from "../../appearance.js";
import { showHintTooltip, hideHintTooltip } from "./tooltip.js";
import { playSfx } from "../../audio/sfx.js";
import { setActive as setNavActive, updateBadge } from "./nav-button.js";
import { configureToasts, showActivationToast } from "./toast.js";
import {
  configureCards,
  getHelpLevel,
  setHelpLevel,
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
import {
  MENU_DOTS_SVG,
  EXPORT_SVG,
  IMPORT_SVG,
  HIDE_NAVBAR_SVG,
} from "./icons.js";

// ── Panel Constants ──
const PANEL_SLIDE_MS = 300;
const COMPACT_PREF = "compactCards";
// The help dial is progressive disclosure, like the sound toggle: a first-ever
// visitor gets the pure discovery experience, and it appears once they've come
// back on a later day.
const HELP_CONTROL_MIN_VISIT_DAYS = 2;

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
// Rebuilding rows is wholesale, so a synchronous burst of log entries
// (an unlock cascade) coalesces into one rebuild per tick.
let activityRefreshQueued = false;
activityLog.onChange(() => {
  if (activityRefreshQueued) return;
  activityRefreshQueued = true;
  queueMicrotask(() => {
    activityRefreshQueued = false;
    if (!panelEl) return;
    const view = panelEl.querySelector(".achievement-view-activity");
    if (view) renderActivity(view);
    updateTabBadges();
  });
});

// ── Helpers ──

function totalPoints() {
  return sumPoints(storage.getUnlocked());
}

// Completion counts scoped to what this device can earn, so a touch-only
// device isn't held below 100% by achievements it can't reach. Core (the 100%
// denominator) and bonus are split: bonus is un-schedulable, so it never gates
// completion — it pushes past it once core is done.
function reachableCounts() {
  const unlockedIds = new Set(storage.getUnlocked().map((u) => u.id));
  return countCoreBonus(getReachableAchievements(), (id) =>
    unlockedIds.has(id),
  );
}

// Completion percent. Core alone tops out at 100%; bonus counts only once core
// is complete, so those un-schedulable secrets push the number past 100 (each
// worth the same slice a core one would) rather than masking missing core.
export function completionPercent({ coreUnlocked, coreTotal, bonusUnlocked }) {
  if (coreTotal <= 0) return 0;
  const earned = coreUnlocked + (coreUnlocked >= coreTotal ? bonusUnlocked : 0);
  return Math.round((earned / coreTotal) * 100);
}

// Footer "N / M" count. Mirrors the per-set rule: earned bonus lifts both
// sides, so it reads as "everything found" and never overflows. (The strip's
// percent is the one place that shows past 100 — the deliberate Crash-style
// flourish for going beyond the core.)
function footerCounts() {
  const { coreUnlocked, coreTotal, bonusUnlocked } = reachableCounts();
  return {
    unlocked: coreUnlocked + bonusUnlocked,
    total: coreTotal + bonusUnlocked,
  };
}

// Paint the overall-completion strip: fill width tracks the percent (capped at
// full even when bonus pushes the number past 100), plus an accessible label.
// Re-callable so refreshPanel keeps it current as unlocks land.
function paintProgressStrip(strip) {
  if (!strip) return;
  const fill = strip.querySelector(".achievement-progress-strip-fill");
  const pct = completionPercent(reachableCounts());
  if (fill) fill.style.width = `${Math.min(pct, 100)}%`;
  strip.setAttribute("role", "progressbar");
  strip.setAttribute("aria-valuemin", "0");
  strip.setAttribute("aria-valuemax", String(Math.max(100, pct)));
  strip.setAttribute("aria-valuenow", String(pct));
  strip.setAttribute(
    "aria-label",
    pct > 100
      ? `${pct}% — every secret found`
      : `${pct}% of achievements unlocked`,
  );
}

// Paint the "+N new" badge — achievements unlocked since the panel last closed.
// Keys off the same close timestamp the per-card just-unlocked reveal uses, so
// the header total and the highlighted cards agree. Empty (hidden via :empty
// CSS) on a first visit or when nothing's new.
function paintNewSince(el) {
  if (!el) return;
  const sinceTs = storage.getPref(storage.LAST_PANEL_CLOSE_PREF, null);
  let count = 0;
  if (sinceTs != null) {
    for (const u of storage.getUnlocked()) {
      if (u.ts != null && u.ts > sinceTs) count++;
    }
  }
  el.textContent = count > 0 ? `+${count} new` : "";
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

// Download the live Cloudlog state as a sealed JSON file.
function exportCloudlog() {
  const blob = new Blob([exportBackup()], { type: "application/json" });
  downloadBlob(blob, "cloudbreeze-cloudlog.json");
}

// Hidden file input that drives Import — clicked programmatically from the
// overflow menu, reads a chosen backup, replaces local state, and repaints.
function buildImportInput() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.style.display = "none";
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (importBackup(String(reader.result))) {
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
    input.value = "";
  });
  return input;
}

// Drop-up overflow menu for the footer's rare actions, so the footer
// stays uncluttered (just streak + count inline).  Each item is
// `{ icon, label, onClick }`.  The menu drops up from a kebab button and
// dismisses on outside click, Esc, or item activation — the document
// listener is bound only while open and removed on close, so no handler
// outlives the menu.
function buildOverflowMenu(items) {
  const wrap = document.createElement("div");
  wrap.className = "achievement-menu";

  const btn = document.createElement("button");
  btn.className = "achievement-menu-btn";
  btn.setAttribute("aria-haspopup", "menu");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", "More options");
  btn.title = "More options";
  btn.innerHTML = MENU_DOTS_SVG;

  const list = document.createElement("div");
  list.className = "achievement-menu-list";
  list.setAttribute("role", "menu");

  let onOutside = null;

  function close() {
    if (!wrap.classList.contains("open")) return;
    wrap.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    if (onOutside) {
      document.removeEventListener("pointerdown", onOutside, true);
      onOutside = null;
    }
  }

  function open() {
    if (wrap.classList.contains("open")) return;
    wrap.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    // Capture-phase so a click anywhere outside the menu dismisses it
    // before in-panel handlers see the event; removed again on close.
    onOutside = (e) => {
      if (!wrap.contains(e.target)) close();
    };
    document.addEventListener("pointerdown", onOutside, true);
    // Land keyboard focus on the first action.
    const first = list.querySelector(".achievement-menu-item");
    if (first) first.focus();
  }

  btn.addEventListener("click", () =>
    wrap.classList.contains("open") ? close() : open(),
  );

  // Esc closes the menu and returns focus to its button, without bubbling
  // up to the panel's own Escape-to-close handler.
  list.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      btn.focus();
    }
  });

  for (const item of items) {
    const mi = document.createElement("button");
    mi.className = "achievement-menu-item";
    mi.setAttribute("role", "menuitem");
    const icon = document.createElement("span");
    icon.className = "achievement-menu-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = item.icon;
    const label = document.createElement("span");
    label.textContent = item.label;
    mi.appendChild(icon);
    mi.appendChild(label);
    mi.addEventListener("click", () => {
      close();
      item.onClick();
    });
    list.appendChild(mi);
  }

  wrap.appendChild(btn);
  wrap.appendChild(list);
  return wrap;
}

// ── Panel ──

export function openPanel(onHide) {
  if (panelOpen) return;
  // Register with the shared overlay-history stack so Back / back-gesture
  // closes the panel before navigating away.  A browser-Back close leaves
  // a forward entry, so Forward reopens the panel; a UI close (X / Esc)
  // replaces the entry in place, so Forward does not reopen after one.
  // The handle is kept in _overlayHandle across close/reopen cycles; pop()
  // is idempotent on the entry's alive flag, so a second pop in an
  // already-dead cycle is a silent no-op.  onReopen calls openPanelUI
  // directly so the DOM setup runs without pushing another overlay entry
  // on top.
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

  // The active appearance rides along for the achievement that collects
  // each appearance the panel is opened under. Initial
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
    // Initial tab-badge paint. Must run after panelEl is assigned:
    // updateTabBadges resolves the panel through the injected getter, which
    // stays null for the whole of buildPanel. Reflects unseen entries carried
    // over from prior sessions.
    updateTabBadges();
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
  playSfx("panelClose", { ui: true });
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

  // Pop but keep the handle.  After a browser-Back close the entry is
  // already dead (the popstate handler flipped it), so pop() no-ops and
  // the surviving forward entry lets Forward reopen via onReopen; after a
  // UI close pop() replaces the entry in place, so Forward won't reopen.
  // The handle is only released in destroyPanel (full teardown) or when a
  // new openPanel creates a fresh entry.
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
  // A focus-trapped, Escape-dismissable modal — name it so assistive tech
  // announces it as a dialog and reads its title on open (see the title id).
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "cloudlog-title");
  // Restore the persisted density preference so it survives reloads.
  if (storage.getPref(COMPACT_PREF, false)) panel.classList.add("compact");

  // Header
  const header = document.createElement("div");
  header.className = "achievement-header";

  const titleRow = document.createElement("div");
  titleRow.className = "achievement-title-row";

  const title = document.createElement("h3");
  title.className = "achievement-title";
  title.id = "cloudlog-title";
  title.textContent = "Cloudlog";

  const pointsEl = document.createElement("span");
  pointsEl.className = "achievement-points-total";
  pointsEl.textContent = `${totalPoints()} pts`;

  const newSince = document.createElement("span");
  newSince.className = "achievement-new-since";
  paintNewSince(newSince);
  // "+N new" is opaque on its own — surface its meaning through the same
  // hint-tooltip cards use, so hover (and a tap on touch) both explain it.
  newSince.addEventListener("mouseenter", () =>
    showHintTooltip(newSince, "Achievements earned since your last visit"),
  );
  newSince.addEventListener("mouseleave", hideHintTooltip);

  titleRow.appendChild(title);
  titleRow.appendChild(newSince);
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

  const headerControls = document.createElement("div");
  headerControls.className = "achievement-header-controls";

  // Help level — Off keeps hidden achievements anonymous; Clues reveals their
  // flavor (and surfaces hints on non-hidden ones); Hints also reveals how to
  // earn the hidden ones. Withheld until a return visit (see the constant).
  if (storage.visitedDayCount() >= HELP_CONTROL_MIN_VISIT_DAYS) {
    const hintToggle = document.createElement("label");
    hintToggle.className = "achievement-hint-toggle";
    hintToggle.title =
      "How much help to show on locked achievements — Off: hidden ones stay anonymous; Clues: reveal their flavor; Hints: reveal how to earn them";
    hintToggle.appendChild(document.createTextNode("Help "));
    const helpSelect = document.createElement("select");
    helpSelect.className = "achievement-help-level";
    for (const [value, label] of [
      ["off", "Off"],
      ["clues", "Clues"],
      ["hints", "Hints"],
    ]) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      helpSelect.appendChild(opt);
    }
    helpSelect.value = getHelpLevel();
    helpSelect.addEventListener("change", () => {
      setHelpLevel(helpSelect.value);
    });
    hintToggle.appendChild(helpSelect);
    headerControls.appendChild(hintToggle);
  }

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

  // Footer: ambient info inline (streak left, count right), with the rare
  // actions (export / import / hide) tucked behind an overflow menu so the
  // row never feels crammed.
  const footer = document.createElement("div");
  footer.className = "achievement-footer";

  // Left-side footer info: streak when the user is on a run; visit count
  // otherwise.  Streak conveys "come back tomorrow"; visit count gives a
  // sense of history to single-day or non-consecutive visitors.
  const streak = storage.currentStreak();
  const visitDays = storage.getState().counters.sessionDays?.length ?? 0;
  const leftEl = document.createElement("span");
  if (streak >= 2) {
    leftEl.className = "achievement-streak";
    leftEl.textContent = `🔥 ${streak}-day streak`;
    leftEl.setAttribute("data-tooltip", "Consecutive days visited");
  } else {
    leftEl.className = "achievement-visit-count";
    const noun = visitDays === 1 ? "day" : "days";
    leftEl.textContent = `Visit ${visitDays}`;
    leftEl.setAttribute("data-tooltip", `Visited on ${visitDays} ${noun}`);
  }
  footer.appendChild(leftEl);

  const footerEnd = document.createElement("div");
  footerEnd.className = "achievement-footer-end";

  const countEl = document.createElement("span");
  countEl.className = "achievement-count-total";
  const { unlocked, total } = footerCounts();
  countEl.textContent = `${unlocked}/${total}`;
  countEl.setAttribute(
    "data-tooltip",
    `Earned ${unlocked} of ${total} achievements`,
  );

  const importInput = buildImportInput();
  const menu = buildOverflowMenu([
    { icon: EXPORT_SVG, label: "Export", onClick: exportCloudlog },
    { icon: IMPORT_SVG, label: "Import", onClick: () => importInput.click() },
    {
      icon: HIDE_NAVBAR_SVG,
      label: "Hide from navbar",
      onClick: () => {
        closePanel();
        if (onHide) onHide();
      },
    },
  ]);

  footerEnd.appendChild(countEl);
  footerEnd.appendChild(menu);
  footerEnd.appendChild(importInput);
  footer.appendChild(footerEnd);
  panel.appendChild(footer);

  // Hide "Mark all read" when nothing is unseen
  const markBtn = panel.querySelector(".achievement-mark-read");
  if (markBtn && storage.getUnseenCount() === 0) markBtn.style.display = "none";

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
  paintNewSince(panelEl.querySelector(".achievement-new-since"));
  paintLastUnlocked(panelEl.querySelector(".achievement-last-unlocked"));
  const countEl = panelEl.querySelector(".achievement-count-total");
  if (countEl) {
    const { unlocked, total } = footerCounts();
    countEl.textContent = `${unlocked}/${total}`;
    countEl.setAttribute(
      "data-tooltip",
      `Earned ${unlocked} of ${total} achievements`,
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
  // later Forward press can't resurrect a destroyed UI.  pop() first to
  // replace the entry in place if it's still on top, then dispose.
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
