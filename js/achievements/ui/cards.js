// ── Achievement Cards ──
// Renders the grouped-by-set achievement grid inside the Cloudlog
// panel, plus the per-card lifecycle: unlock refresh, scroll-to,
// unseen-observer dwell tracking, and "mark all read" behavior.
//
// The tooltip module handles positioning; this module decides when a
// hint should actually show (resolveHintText encodes the Reveal-hints
// and dev-active rules).  The panel owns the chrome (header, tabs)
// and hands this module a container to paint into via renderSections.

import { ACHIEVEMENTS, SETS, getAchievement, isThemeSet } from "../registry.js";
import { resolveProgressCurrent, resolveProgressTotal } from "../progress.js";
import * as storage from "../storage.js";
import { formatTimestamp, toggleTimestampMode } from "./timestamp.js";
import { showHintTooltip, hideHintTooltip } from "./tooltip.js";
import { setActiveTab } from "./tabs.js";
import { updateBadge } from "./nav-button.js";
import { CLOUD_CHECK_SVG, CLOUD_LOCK_SVG, CLOUD_HIDDEN_SVG } from "./icons.js";
import { scrollAndHighlight } from "../../scroll-highlight.js";

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
let revealHints = false;
let _seenObserver = null;
let _seenTimers = new Map();

// Panel-facing hooks injected by the facade.  getPanelEl lets us read
// the live panel element without importing the parent (which would
// circular-import), isPanelOpen lets refreshCard skip work when the
// panel isn't visible, and refreshPanel lets a card change request a
// whole-panel re-render when section counts need updating.
let _getPanelEl = () => null;
let _isPanelOpen = () => false;
let _refreshPanel = () => {};

export function configureCards({ getPanelEl, isPanelOpen, refreshPanel } = {}) {
  if (getPanelEl) _getPanelEl = getPanelEl;
  if (isPanelOpen) _isPanelOpen = isPanelOpen;
  if (refreshPanel) _refreshPanel = refreshPanel;
}

// ── Reveal hints toggle ──
// The panel header owns the checkbox; cards owns the underlying flag
// and the rendering decisions it gates.  setRevealHints also triggers
// a refresh so the caller doesn't have to remember to do it.

export function getRevealHints() {
  return revealHints;
}

export function setRevealHints(value) {
  revealHints = !!value;
  _refreshPanel();
}

// ── Hint resolution ──
// Returns the tooltip string to show on hover, or null to suppress.
// Hidden achievements never leak their real hint via Reveal hints —
// that toggle only affects their title/description. A non-revealing
// placeholder is shown instead so the UI stays consistent. The real
// hint is only exposed while dev tools are active (`body.dev-active`).
function resolveHintText(ach, isUnlocked, isRelocked) {
  if (isUnlocked || isRelocked) return ach.hint;
  if (ach.hidden) {
    if (document.body.classList.contains("dev-active")) return ach.hint;
    return revealHints ? HIDDEN_HINT_PLACEHOLDER : null;
  }
  return revealHints ? ach.hint : null;
}

// ── Section helpers ──

function setCountForSet(setId) {
  const all = ACHIEVEMENTS.filter((a) => a.set === setId);
  const unlocked = all.filter((a) => storage.isUnlocked(a.id));
  return { total: all.length, unlocked: unlocked.length };
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
  timeEl.addEventListener("click", () => toggleTimestampMode(_getPanelEl()));

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

  const wrap = document.createElement("div");
  wrap.className = "achievement-card-progress-bar-wrap";

  if (total <= SEGMENTED_PROGRESS_MAX) {
    wrap.classList.add("segmented");
    for (let i = 0; i < total; i++) {
      const seg = document.createElement("div");
      seg.className = "achievement-card-progress-bar-segment";
      if (i < collected) seg.classList.add("filled");
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
  if (storage.getUnlocked().length <= INTRO_CARD_THRESHOLD) {
    container.appendChild(buildIntroCard());
  }

  for (const set of SETS) {
    // Theme sets: only show if user has at least one unlocked
    if (isThemeSet(set.id) && !hasAnyInSet(set.id)) continue;

    const section = document.createElement("div");
    section.className = "achievement-set";

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
    const sCount = document.createElement("span");
    sCount.className = "achievement-set-count";
    sCount.textContent = `${unlocked} / ${total}`;

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

    // Achievement cards
    const setAchievements = ACHIEVEMENTS.filter((a) => a.set === set.id);
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
      } else if (ach.hidden && !revealHints) {
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
        cardTitle.textContent = revealHints ? ach.title : "???";
        cardDesc.textContent = revealHints
          ? ach.description
          : "Hidden achievement";
      } else {
        // Locked but visible
        cardTitle.textContent = ach.title;
        cardDesc.textContent = ach.description;
      }

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

      // Click pop on unlocked cards
      if (isUnlocked) {
        card.addEventListener("click", onCardClick);
      }

      // Hint tooltip on hover. The text shown depends on lock/hidden state
      // and the Reveal hints / dev-active flags — see `resolveHintText`.
      if (ach.hint) {
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
}

function onCardClick(e) {
  const card = e.currentTarget;
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
  if (title) title.textContent = ach.title;
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

  // Click pop for newly unlocked card
  card.addEventListener("click", onCardClick);

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
  revealHints = false;
  _getPanelEl = () => null;
  _isPanelOpen = () => false;
  _refreshPanel = () => {};
}
