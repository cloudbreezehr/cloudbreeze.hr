// ── Achievement Cards ──
// Renders the grouped-by-set achievement grid inside the Cloudlog
// panel, plus the per-card lifecycle: unlock refresh, scroll-to,
// unseen-observer dwell tracking, and "mark all read" behavior.
//
// The tooltip module handles positioning; this module decides when a
// hint should actually show (resolveHintText encodes the help-level
// and dev-active rules).  The panel owns the chrome (header, tabs)
// and hands this module a container to paint into via renderSections.

import {
  ACHIEVEMENTS,
  SETS,
  getAchievement,
  getReachableAchievements,
  isBonus,
  isThemeSet,
} from "../registry.js";
import { resolveProgressCurrent, resolveProgressTotal } from "../progress.js";
import * as storage from "../storage.js";
import { formatTimestamp, toggleTimestampMode } from "./timestamp.js";
import { showHintTooltip, hideHintTooltip } from "./tooltip.js";
import { showActivationToast } from "./toast.js";
import { setActiveTab } from "./tabs.js";
import { updateBadge } from "./nav-button.js";
import { CLOUD_CHECK_SVG, CLOUD_LOCK_SVG, CLOUD_HIDDEN_SVG } from "./icons.js";
import { scrollAndHighlight } from "../../scroll-highlight.js";
import { bindClickable } from "../../clickable.js";

// ── Tooltip Constants ──
const HIDDEN_HINT_PLACEHOLDER = "Hidden — unlock to reveal the hint";

// ── Unseen Observer Constants ──
// Dwell threshold so a card briefly scrolling past doesn't count as
// "seen".
export const SEEN_DWELL_MS = 1000;
const SEEN_INTERSECTION_RATIO = 0.5;

// ── Card animation ──
const SHINE_DURATION_MS = 800;

// ── Progress bar ──
// Cap on the unit count for which we render one segment per progress
// unit instead of a single smooth fill.  Above this, individual
// segments would be too narrow to read at the bar's 2px height; the
// numeric "N/M" text takes over the precise-progress role.
const SEGMENTED_PROGRESS_MAX = 10;

// ── Intro card ──
// Onboarding card shown at the top of the Achievements view while the
// user is still discovering the panel's purpose.  Auto-vanishes once
// they've engaged enough that the message is no longer needed.
export const INTRO_CARD_THRESHOLD = 10;

// ── State ──
// How much help the panel surfaces on locked achievements, low → high:
//   "off"   — hidden achievements stay anonymous (???); no hints surface
//   "clues" — hidden achievements show their flavor (title + description),
//             and non-hidden locked achievements surface their hint
//   "hints" — additionally reveals the how-to hint on hidden achievements
// Default "off" keeps the discovery layer intact for new visitors; an
// explicit choice is persisted so it survives reloads.
const HELP_LEVELS = ["off", "clues", "hints"];
const HELP_LEVEL_PREF = "helpLevel";
const REVEAL_HINTS_PREF = "revealHints"; // legacy boolean, migrated below

let helpLevel = readInitialHelpLevel();

function readInitialHelpLevel() {
  const stored = storage.getPref(HELP_LEVEL_PREF, null);
  if (HELP_LEVELS.includes(stored)) return stored;
  // Migrate the old boolean toggle: its "on" revealed hidden flavor = "clues".
  return storage.getPref(REVEAL_HINTS_PREF, false) ? "clues" : "off";
}
let _seenObserver = null;
let _seenTimers = new Map();
// Last-rendered progress per key.  A subsequent render with a higher
// value shines the newly-filled segments; first render of any key
// silently establishes the baseline so the initial paint never flashes
// already-filled segments.
const lastProgressShineSnapshot = new Map();

// Panel-facing hooks injected by the facade.  getPanelEl lets us read
// the live panel element without importing the parent (which would
// circular-import), isPanelOpen lets refreshCard skip work when the
// panel isn't visible, refreshPanel lets a card change request a
// whole-panel re-render when section counts need updating, and
// scrollToActivityEntryFor lets a card click route to its activity-log
// entry.
let _getPanelEl = () => null;
let _isPanelOpen = () => false;
let _refreshPanel = () => {};
let _scrollToActivityEntryFor = () => {};

export function configureCards({
  getPanelEl,
  isPanelOpen,
  refreshPanel,
  scrollToActivityEntryFor,
} = {}) {
  if (getPanelEl) _getPanelEl = getPanelEl;
  if (isPanelOpen) _isPanelOpen = isPanelOpen;
  if (refreshPanel) _refreshPanel = refreshPanel;
  if (scrollToActivityEntryFor)
    _scrollToActivityEntryFor = scrollToActivityEntryFor;
  bindThemeStackListener();
}

// ── Reveal hints toggle ──
// The panel header owns the control; cards owns the underlying level and
// the rendering decisions it gates.  setHelpLevel also triggers a refresh
// so the caller doesn't have to remember to do it.

export function getHelpLevel() {
  return helpLevel;
}

export function setHelpLevel(level) {
  if (!HELP_LEVELS.includes(level)) return;
  helpLevel = level;
  storage.setPref(HELP_LEVEL_PREF, helpLevel);
  _refreshPanel();
}

// "clues" (or deeper) reveals hidden achievements' flavor and non-hidden
// hints; "hints" (deepest) additionally reveals the how-to on hidden ones.
const showsClues = () => helpLevel !== "off";
const showsHints = () => helpLevel === "hints";

// ── Hint resolution ──
// Returns the tooltip string to show on hover, or null to suppress. A
// hidden achievement's how-to hint stays behind the "hints" level (or an
// unlock, or dev tools); at "clues" a non-revealing placeholder stands in
// so its card still signals there's something to earn.
function resolveHintText(ach, isUnlocked, isRelocked) {
  if (isUnlocked || isRelocked) return ach.hint;
  if (ach.hidden) {
    if (document.body.classList.contains("dev-active")) return ach.hint;
    if (showsHints()) return ach.hint;
    return showsClues() ? HIDDEN_HINT_PLACEHOLDER : null;
  }
  return showsClues() ? ach.hint : null;
}

// ── Section helpers ──

// Sync a card title's re-earn tally (the ×N badge) to the stored trigger
// count: create it, update it, or drop it. Shared by the full render and the
// live per-card refresh so repeats update without rebuilding the panel.
//
// Dev-gated while the feature bakes: the tally only shows when the dev console
// is active (body.dev-active). A later home for this gate could be a completion
// check (e.g. only at 100%).
function tallyVisible() {
  return document.body.classList.contains("dev-active");
}

function applyCardTally(titleEl, id) {
  let tally = titleEl.querySelector(".achievement-card-tally");
  const times = storage.getTriggerCount(id);
  if (times > 1 && tallyVisible()) {
    if (!tally) {
      tally = document.createElement("span");
      tally.className = "achievement-card-tally";
      titleEl.appendChild(tally);
    }
    tally.textContent = `×${times}`;
    tally.setAttribute("data-tooltip", `Earned ${times} times`);
  } else if (tally) {
    tally.remove();
  }
}

// Update a rendered card's progress line + bar in place from its current count,
// without rebuilding the card (which would replay reveal animations and drop
// scroll/focus). Handles both bar shapes: a continuous fill (width) and a
// segmented bar (per-tick filled state).
function updateCardProgress(card, progressKey) {
  const total = resolveProgressTotal(progressKey);
  if (total <= 0) return;
  const collected = Math.min(resolveProgressCurrent(progressKey), total);
  const text = card.querySelector(".achievement-card-progress-text");
  if (text) text.textContent = `${collected}/${total}`;
  const fill = card.querySelector(".achievement-card-progress-bar-fill");
  if (fill) {
    fill.style.width = `${(collected / total) * 100}%`;
    return;
  }
  const segs = card.querySelectorAll(".achievement-card-progress-bar-segment");
  segs.forEach((seg, i) => seg.classList.toggle("filled", i < collected));
}

// Refresh the live-changing bits of every rendered card in place — the re-earn
// tally and any progress line/bar. One pass, no rebuild; this is the single
// home for "keep an open card current", so new live bits extend here rather
// than adding another per-bit refresh path.
export function refreshDynamicCardState() {
  const panelEl = _getPanelEl();
  if (!panelEl || !_isPanelOpen()) return;
  for (const card of panelEl.querySelectorAll(".achievement-card[data-id]")) {
    const id = card.dataset.id;
    const title = card.querySelector(".achievement-card-title");
    if (title) applyCardTally(title, id);
    const ach = getAchievement(id);
    if (ach && ach.progressKey) updateCardProgress(card, ach.progressKey);
  }
}

// Coalesce live refreshes to a microtask: it runs after the tracker has
// processed the current event (so counts/tallies are already updated,
// regardless of listener order), and a burst of events folds into one pass.
let _liveRefreshScheduled = false;
function scheduleLiveRefresh() {
  if (_liveRefreshScheduled) return;
  _liveRefreshScheduled = true;
  queueMicrotask(() => {
    _liveRefreshScheduled = false;
    refreshDynamicCardState();
  });
}

// A set's N / M. Core always counts toward the total; bonus counts only once
// earned, and then lifts both sides — so a set reads complete exactly when its
// core is done (never stranded at "5 / 9"), and each found secret grows the
// count in step (5 / 5 → 6 / 6) rather than overflowing it (6 / 5) or leaving a
// phantom gap when an unearned core remains (4 core + 1 bonus → 5 / 6).
export function setCountForSet(setId) {
  const inSet = getReachableAchievements().filter((a) => a.set === setId);
  let total = 0;
  let unlocked = 0;
  for (const a of inSet) {
    const earned = storage.isUnlocked(a.id);
    if (isBonus(a)) {
      if (earned) {
        total++;
        unlocked++;
      }
    } else {
      total++;
      if (earned) unlocked++;
    }
  }
  return { total, unlocked };
}

function hasAnyInSet(setId) {
  return ACHIEVEMENTS.some((a) => a.set === setId && storage.isUnlocked(a.id));
}

// Themes stack via body.classList — each theme adds its id as a class
// on activation — so containment is the correct any-of-N check when
// multiple themes can be on at once.
function isThemeActive(themeId) {
  return document.body.classList.contains(themeId);
}

// ── Live theme-stack dimming ──
// Invariant: every rendered theme section carries `.dimmed` if its
// theme isn't in the current stack.  Stack changes flip the class on
// the existing nodes — no re-render — so the panel stays in sync
// whether it's open or closed at the moment the stack changes.

function refreshThemeSetDimming() {
  const panel = _getPanelEl();
  if (!panel) return;
  const sections = panel.querySelectorAll(".achievement-set[data-set-id]");
  for (const section of sections) {
    section.classList.toggle("dimmed", !isThemeActive(section.dataset.setId));
  }
}

let _themeStackListener = null;

function bindThemeStackListener() {
  if (_themeStackListener) return;
  _themeStackListener = (e) => {
    const t = e.detail?.type;
    if (t === "dev-console-open" || t === "dev-console-close") {
      // Visibility gate changed — a full rebuild adds/removes gated bits.
      if (_isPanelOpen()) _refreshPanel();
      return;
    }
    if (t === "theme-activate" || t === "theme-deactivate") {
      refreshThemeSetDimming();
    }
    // Any event may nudge a live card bit (a tally, a progress bar); keep the
    // open panel current in place.
    scheduleLiveRefresh();
  };
  window.addEventListener("achievement", _themeStackListener);
}

// ── Unseen Observer ──

export function createSeenObserver() {
  if (_seenObserver) return;
  const panelEl = _getPanelEl();
  // The achievements view is the scroll container, so intersections
  // are computed against the viewport the user is actually scrolling.
  const root =
    panelEl && panelEl.querySelector(".achievement-view-achievements");
  if (!root) return;

  _seenObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const card = entry.target;
        const id = card.dataset.id;
        if (!id) continue;

        if (entry.intersectionRatio >= SEEN_INTERSECTION_RATIO) {
          // Start dwell timer
          if (!_seenTimers.has(id)) {
            _seenTimers.set(
              id,
              setTimeout(() => {
                _seenTimers.delete(id);
                markCardSeen(card, id);
              }, SEEN_DWELL_MS),
            );
          }
        } else {
          // Scrolled away before dwell completed — cancel
          const timer = _seenTimers.get(id);
          if (timer) {
            clearTimeout(timer);
            _seenTimers.delete(id);
          }
        }
      }
    },
    { root, threshold: SEEN_INTERSECTION_RATIO },
  );
}

export function destroySeenObserver() {
  if (_seenObserver) {
    _seenObserver.disconnect();
    _seenObserver = null;
  }
  for (const timer of _seenTimers.values()) clearTimeout(timer);
  _seenTimers.clear();
}

export function observeUnseenCards() {
  const panelEl = _getPanelEl();
  if (!_seenObserver || !panelEl) return;
  panelEl.querySelectorAll(".achievement-card.unseen").forEach((card) => {
    _seenObserver.observe(card);
  });
}

function markCardSeen(card, id) {
  if (!storage.markSeen(id)) return;
  card.classList.add("seen-fade");
  card.classList.remove("unseen");
  if (_seenObserver) _seenObserver.unobserve(card);
  updateBadge();
  updateMarkReadVisibility();
}

export function markAllSeen() {
  // No-op when nothing was unseen — avoids a misleading "all caught up"
  // toast on rapid double-clicks of the button.
  const hadUnseen = storage.getUnseenCount() > 0;
  const unlocked = storage.getUnlocked();
  for (const u of unlocked) storage.markSeen(u.id);
  const panelEl = _getPanelEl();
  if (panelEl) {
    panelEl.querySelectorAll(".achievement-card.unseen").forEach((card) => {
      card.classList.add("seen-fade");
      card.classList.remove("unseen");
      if (_seenObserver) _seenObserver.unobserve(card);
    });
  }
  updateBadge();
  updateMarkReadVisibility();
  if (hadUnseen) showActivationToast("All caught up");
}

export function updateMarkReadVisibility() {
  const panelEl = _getPanelEl();
  if (!panelEl) return;
  const btn = panelEl.querySelector(".achievement-mark-read");
  if (!btn) return;
  btn.style.display = storage.getUnseenCount() > 0 ? "" : "none";
}

// ── Scroll to card ──

export function scrollToCard(achievementId) {
  const panelEl = _getPanelEl();
  if (!panelEl) return;
  const card = panelEl.querySelector(
    `.achievement-card[data-id="${achievementId}"]`,
  );
  if (!card) return;

  // The card lives in the Achievements view — switch tabs first so
  // the scroll lands inside a `display: flex` container.  Otherwise
  // scrollIntoView no-ops against a hidden view and the highlight
  // never reaches the user.
  setActiveTab("achievements");

  scrollAndHighlight(card);
}

// ── Intro card ──
// One-time onboarding card prepended to the Achievements view while the
// user is still discovering what the Cloudlog is for.  Visual language
// matches the rest of the panel (same card chrome, set-color accent
// border) so it reads as part of the list, not a banner overlay.
function buildIntroCard() {
  const card = document.createElement("div");
  card.className = "achievement-card achievement-intro-card";

  const icon = document.createElement("div");
  icon.className = "achievement-icon achievement-intro-icon";
  icon.innerHTML = CLOUD_CHECK_SVG;

  const text = document.createElement("div");
  text.className = "achievement-text";

  const title = document.createElement("div");
  title.className = "achievement-card-title";
  title.textContent = "You found the Cloudlog";

  const desc = document.createElement("div");
  desc.className = "achievement-card-desc";
  desc.textContent = "Secrets you discover get logged here. Keep exploring.";

  text.appendChild(title);
  text.appendChild(desc);

  card.appendChild(icon);
  card.appendChild(text);

  return card;
}

// Build the timestamp + inline progress block for an unlocked card.
// Returns null when the achievement has no recorded unlock time.
// Single source of truth for this row — every call site must use it
// instead of inlining construction so all render paths produce
// identical DOM.
function buildCardTimeBlock(ach) {
  const ts = storage.getUnlockTime(ach.id);
  if (!ts) return null;

  const timeEl = document.createElement("div");
  timeEl.className = "achievement-card-time";
  timeEl.dataset.ts = String(ts);
  timeEl.textContent = formatTimestamp(ts);
  bindClickable(timeEl, (e) => {
    // Card itself is also clickable (scroll-to-activity); stop the
    // bubble so toggling the timestamp doesn't also jump tabs.
    e.stopPropagation();
    toggleTimestampMode(_getPanelEl());
  });

  if (ach.progressKey) {
    const total = resolveProgressTotal(ach.progressKey);
    const collected = Math.min(resolveProgressCurrent(ach.progressKey), total);
    if (total > 0) {
      const sep = document.createTextNode(" · ");
      const progressSpan = document.createElement("span");
      progressSpan.className = "achievement-card-progress-text";
      progressSpan.textContent =
        collected >= total
          ? `${collected}/${total} ✓`
          : `${collected}/${total}`;
      timeEl.appendChild(sep);
      timeEl.appendChild(progressSpan);
    }
  }

  return timeEl;
}

// Build the bottom-edge progress bar for an achievement with a
// progressKey.  Returns null when the achievement has no progress.
// Two render modes:
//   - segmented: total ≤ SEGMENTED_PROGRESS_MAX, one filled tick per
//     completed unit, gaps between.  Reinforces the textual N/M.
//   - smooth: anything larger, a single proportionally-wide fill.
function buildProgressBar(progressKey) {
  const total = resolveProgressTotal(progressKey);
  if (total <= 0) return null;
  const collected = Math.min(resolveProgressCurrent(progressKey), total);
  const prior = lastProgressShineSnapshot.get(progressKey) ?? collected;
  lastProgressShineSnapshot.set(progressKey, collected);

  const wrap = document.createElement("div");
  wrap.className = "achievement-card-progress-bar-wrap";

  if (total <= SEGMENTED_PROGRESS_MAX) {
    wrap.classList.add("segmented");
    for (let i = 0; i < total; i++) {
      const seg = document.createElement("div");
      seg.className = "achievement-card-progress-bar-segment";
      if (i < collected) seg.classList.add("filled");
      if (i >= prior && i < collected) seg.classList.add("just-filled");
      wrap.appendChild(seg);
    }
  } else {
    const fill = document.createElement("div");
    fill.className = "achievement-card-progress-bar-fill";
    fill.style.width = `${(collected / total) * 100}%`;
    wrap.appendChild(fill);
  }

  return wrap;
}

// ── Section renderer ──

export function renderSections(container) {
  // A refresh (unlock landing while the panel is open) rebuilds the whole
  // view, recreating the search input.  Capture focus + caret off the old
  // input before we replace it so typing isn't interrupted mid-keystroke.
  const caret = captureSearchCaret(container);
  container.innerHTML = "";

  if (storage.getUnlocked().length <= INTRO_CARD_THRESHOLD) {
    container.appendChild(buildIntroCard());
  }

  container.appendChild(buildSearchBar(container));

  // Snapshot the last-close stamp once per render so every card in this
  // pass compares against the same boundary.  Null (never closed) means
  // no card is "new since last time".
  const sinceTs = storage.getPref(storage.LAST_PANEL_CLOSE_PREF, null);

  // Reachable on this device — computed once, the same for every set.
  const reachable = getReachableAchievements();

  for (const set of SETS) {
    // Theme sets: only show if user has at least one unlocked
    if (isThemeSet(set.id) && !hasAnyInSet(set.id)) continue;
    // A set with nothing earnable on this device stays hidden entirely — e.g.
    // the multi-window set on a touch/single-window device, where every entry
    // requires that capability. Otherwise it'd render as an empty "0 / 0".
    if (reachable.every((a) => a.set !== set.id)) continue;

    const section = document.createElement("div");
    section.className = "achievement-set";
    // Tag theme sections so live theme-stack updates can find them
    // without re-rendering.
    if (isThemeSet(set.id)) section.dataset.setId = set.id;

    if (set.color) section.style.setProperty("--set-color", set.color);
    // A theme set is bright if its own theme is currently in the
    // active stack; non-theme sets never dim.
    const isDimmed = isThemeSet(set.id) && !isThemeActive(set.id);
    if (isDimmed) section.classList.add("dimmed");

    // Section header
    const sHeader = document.createElement("div");
    sHeader.className = "achievement-set-header";
    if (set.color) {
      sHeader.style.borderLeftColor = set.color;
    }

    const sName = document.createElement("span");
    sName.className = "achievement-set-name";
    // Prepend the set's icon.  Icons use currentColor so they tint to the
    // set's accent color via CSS on .achievement-set-icon.
    if (set.icon) {
      const iconEl = document.createElement("span");
      iconEl.className = "achievement-set-icon";
      iconEl.innerHTML = set.icon;
      sName.appendChild(iconEl);
    }
    const labelEl = document.createElement("span");
    labelEl.textContent = set.label;
    sName.appendChild(labelEl);

    const { total, unlocked } = setCountForSet(set.id);
    const complete = total > 0 && unlocked === total;
    if (complete) section.classList.add("set-complete");
    const sCount = document.createElement("span");
    sCount.className = "achievement-set-count";
    sCount.textContent = complete
      ? `${unlocked} / ${total} ✓`
      : `${unlocked} / ${total}`;

    sHeader.appendChild(sName);
    sHeader.appendChild(sCount);

    // Progress bar
    const progWrap = document.createElement("div");
    progWrap.className = "achievement-progress";
    const progBar = document.createElement("div");
    progBar.className = "achievement-progress-bar";
    const pct = total > 0 ? (unlocked / total) * 100 : 0;
    progBar.style.width = `${pct}%`;
    if (set.color) progBar.style.background = set.color;
    progWrap.appendChild(progBar);
    sHeader.appendChild(progWrap);

    section.appendChild(sHeader);

    // Achievement cards — only those earnable on this device, so a touch user
    // never sees a keyboard/hover-only entry they can't complete. Bonus stays
    // hidden until earned, so core-100% reads as done and a found secret is a
    // surprise rather than a standing "???".
    const setAchievements = reachable.filter(
      (a) => a.set === set.id && (!isBonus(a) || storage.isUnlocked(a.id)),
    );
    for (const ach of setAchievements) {
      const isUnlocked = storage.isUnlocked(ach.id);
      const card = document.createElement("div");
      card.className = "achievement-card";
      card.dataset.id = ach.id;

      const isUnseen = isUnlocked && !storage.isSeen(ach.id);
      const isRelocked = !isUnlocked && storage.isRelocked(ach.id);

      if (isUnlocked) {
        card.classList.add("unlocked");
        if (isUnseen) card.classList.add("unseen");
        // One-shot reveal for unlocks earned since the panel last
        // closed.  Fresh DOM each render means the keyframe plays once
        // per open without a replay guard.
        if (sinceTs != null) {
          const ts = storage.getUnlockTime(ach.id);
          if (ts && ts > sinceTs) card.classList.add("just-unlocked");
        }
      } else if (isRelocked) {
        card.classList.add("relocked");
      } else if (ach.hidden) {
        card.classList.add("hidden-ach");
      } else {
        card.classList.add("locked");
      }

      // Icon
      const icon = document.createElement("div");
      icon.className = "achievement-icon";
      if (isUnlocked) {
        icon.innerHTML = CLOUD_CHECK_SVG;
        if (set.color) icon.style.color = set.color;
      } else if (isRelocked) {
        icon.innerHTML = CLOUD_LOCK_SVG;
        if (set.color) icon.style.color = set.color;
      } else if (ach.hidden && !showsClues()) {
        icon.innerHTML = CLOUD_HIDDEN_SVG;
      } else {
        icon.innerHTML = CLOUD_LOCK_SVG;
      }

      // Text
      const text = document.createElement("div");
      text.className = "achievement-text";

      const cardTitle = document.createElement("div");
      cardTitle.className = "achievement-card-title";

      const cardPts = document.createElement("span");
      cardPts.className = "achievement-card-pts";
      cardPts.textContent = `${ach.points}`;

      const cardDesc = document.createElement("div");
      cardDesc.className = "achievement-card-desc";

      if (isUnlocked || isRelocked) {
        cardTitle.textContent = ach.title;
        cardDesc.textContent = ach.description;
      } else if (ach.hidden) {
        cardTitle.textContent = showsClues() ? ach.title : "???";
        cardDesc.textContent = showsClues()
          ? ach.description
          : "Hidden achievement";
      } else {
        // Locked but visible
        cardTitle.textContent = ach.title;
        cardDesc.textContent = ach.description;
      }

      // Re-earn tally: achievements you can trigger again (a theme, a spell)
      // show how many times you have. Once-only ones stay at 1 and show nothing.
      if (isUnlocked) applyCardTally(cardTitle, ach.id);

      text.appendChild(cardTitle);
      text.appendChild(cardDesc);

      if (isUnlocked) {
        const timeEl = buildCardTimeBlock(ach);
        if (timeEl) text.appendChild(timeEl);
      } else if (ach.progressKey) {
        // Locked/relocked: show progress on its own line (where timestamp would be)
        const total = resolveProgressTotal(ach.progressKey);
        const collected = resolveProgressCurrent(ach.progressKey);
        if (total > 0) {
          const progressLine = document.createElement("div");
          progressLine.className =
            "achievement-card-time achievement-card-progress-line";
          const progressSpan = document.createElement("span");
          progressSpan.className = "achievement-card-progress-text";
          progressSpan.textContent = `${collected}/${total}`;
          progressLine.appendChild(progressSpan);
          text.appendChild(progressLine);
        }
      }

      card.appendChild(icon);
      card.appendChild(text);
      card.appendChild(cardPts);

      if (ach.progressKey) {
        const bar = buildProgressBar(ach.progressKey);
        if (bar) card.appendChild(bar);
      }

      // Unlocked cards route to their activity-log entry — the click
      // jumps to the Activity tab and scrolls the matching row into
      // view.  Locked cards aren't navigable, but a click still gets a
      // tiny shake so the input doesn't feel ignored ("nothing here
      // yet").
      if (isUnlocked) {
        bindClickable(card, () => onCardClick(card, ach.id));
      } else {
        card.addEventListener("click", () => shakeCard(card));
      }

      // Hint tooltip on hover. The text shown depends on lock/hidden state
      // and the Reveal hints / dev-active flags — see `resolveHintText`.
      if (ach.hint) {
        // Tag cards whose hover *will* surface text so CSS can show a
        // resting affordance.  Cards whose hint resolves to null (a locked
        // card at a help level below what would surface it) carry no mark.
        if (resolveHintText(ach, isUnlocked, isRelocked)) {
          card.dataset.hasHint = "1";
        }
        card.addEventListener("mouseenter", () => {
          const text = resolveHintText(ach, isUnlocked, isRelocked);
          if (text) showHintTooltip(card, text);
        });
        card.addEventListener("mouseleave", hideHintTooltip);
      }

      section.appendChild(card);
    }

    container.appendChild(section);
  }

  // Re-apply any persisted query so a refresh (unlock landing while the
  // panel is open) doesn't reset an in-progress filter.
  applySearchFilter(container);

  restoreSearchCaret(container, caret);
}

// ── Search ──
const _searchState = { query: "" };

// Read focus + selection off the live search input, or null if it isn't
// the focused element.  Used to carry typing state across a full rebuild.
function captureSearchCaret(container) {
  const input = container.querySelector(".achievement-search-input");
  if (!input || document.activeElement !== input) return null;
  return { start: input.selectionStart, end: input.selectionEnd };
}

// Re-focus the freshly built search input and restore the caret/selection
// captured before the rebuild.  No-op when nothing was focused.
function restoreSearchCaret(container, caret) {
  if (!caret) return;
  const input = container.querySelector(".achievement-search-input");
  if (!input) return;
  input.focus();
  // type="search" reports null for selection in some engines; guard it.
  if (caret.start != null) input.setSelectionRange(caret.start, caret.end);
}

// Build the live search input.  Keeps its value across re-renders via
// _searchState so an unlock-driven refresh doesn't wipe what the user
// typed.
function buildSearchBar(container) {
  const wrap = document.createElement("div");
  wrap.className = "achievement-search";
  const input = document.createElement("input");
  input.type = "search";
  input.className = "achievement-search-input";
  input.placeholder = "Search achievements…";
  input.setAttribute("aria-label", "Search achievements");
  input.value = _searchState.query;
  input.addEventListener("input", () => {
    _searchState.query = input.value;
    applySearchFilter(container);
  });
  wrap.appendChild(input);
  return wrap;
}

// Hide cards whose title/description don't match the query, then hide
// any section left with no visible cards.  Matches the rendered text
// only, so locked-hidden cards (showing "???") match on "???" rather
// than leaking their real title.
function applySearchFilter(container) {
  const q = _searchState.query.trim().toLowerCase();
  container.querySelectorAll(".achievement-set").forEach((section) => {
    let anyVisible = false;
    section.querySelectorAll(".achievement-card[data-id]").forEach((card) => {
      if (!q) {
        card.classList.remove("search-hidden");
        anyVisible = true;
        return;
      }
      const title =
        card.querySelector(".achievement-card-title")?.textContent || "";
      const desc =
        card.querySelector(".achievement-card-desc")?.textContent || "";
      const match = (title + " " + desc).toLowerCase().includes(q);
      card.classList.toggle("search-hidden", !match);
      if (match) anyVisible = true;
    });
    // A section with no matching cards collapses out of the way.
    section.classList.toggle("search-hidden", !!q && !anyVisible);
  });
}

function onCardClick(card, achievementId) {
  card.classList.remove("clicked");
  void card.offsetHeight;
  card.classList.add("clicked");
  card.addEventListener(
    "animationend",
    () => card.classList.remove("clicked"),
    {
      once: true,
    },
  );
  _scrollToActivityEntryFor(achievementId, "achievement-unlocked");
}

// One-shot horizontal shake for a click on a locked card — input
// acknowledgment, not navigation.  Strip-then-add restarts the
// keyframe on rapid repeat clicks.
function shakeCard(card) {
  card.classList.remove("shake");
  void card.offsetHeight;
  card.classList.add("shake");
  card.addEventListener("animationend", () => card.classList.remove("shake"), {
    once: true,
  });
}

// Refresh a single card in-place when it unlocks while panel is open
export function refreshCard(achievementId) {
  const panelEl = _getPanelEl();
  if (!panelEl || !_isPanelOpen()) return;
  const card = panelEl.querySelector(
    `.achievement-card[data-id="${achievementId}"]`,
  );
  if (!card) {
    // Achievement might be in an invisible set — do full refresh
    _refreshPanel();
    return;
  }
  const ach = getAchievement(achievementId);
  if (!ach) return;

  const set = SETS.find((s) => s.id === ach.set);

  card.classList.remove("locked", "hidden-ach");
  card.classList.add("unlocked", "unseen");

  // Update icon
  const icon = card.querySelector(".achievement-icon");
  if (icon) {
    icon.innerHTML = CLOUD_CHECK_SVG;
    if (set && set.color) icon.style.color = set.color;
  }

  // Update text
  const title = card.querySelector(".achievement-card-title");
  if (title) {
    // textContent reset drops any prior tally span — re-apply from the count.
    title.textContent = ach.title;
    applyCardTally(title, achievementId);
  }
  const desc = card.querySelector(".achievement-card-desc");
  if (desc) desc.textContent = ach.description;

  // Replace any prior time-row (the locked-state progress line) so the
  // unlocked-state timestamp + inline progress lands cleanly.
  const textEl = card.querySelector(".achievement-text");
  if (textEl) {
    card.querySelector(".achievement-card-time")?.remove();
    const timeEl = buildCardTimeBlock(ach);
    if (timeEl) textEl.appendChild(timeEl);
  }

  // Newly unlocked card joins the rest in routing to its activity entry.
  bindClickable(card, () => onCardClick(card, achievementId));

  // Observe for seen tracking
  if (_seenObserver) _seenObserver.observe(card);

  // Shine animation
  card.classList.add("shine");
  setTimeout(() => card.classList.remove("shine"), SHINE_DURATION_MS);

  // Update section counts
  _refreshPanel();
}

// Test hook — drop all card state including injected callbacks.
export function _resetForTests() {
  destroySeenObserver();
  helpLevel = "off";
  _getPanelEl = () => null;
  _isPanelOpen = () => false;
  _refreshPanel = () => {};
  _scrollToActivityEntryFor = () => {};
  lastProgressShineSnapshot.clear();
  _searchState.query = "";
  _liveRefreshScheduled = false;
  if (_themeStackListener) {
    window.removeEventListener("achievement", _themeStackListener);
    _themeStackListener = null;
  }
}
