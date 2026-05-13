// ── Activity view ──
// Re-chronological stack of achievement toasts.  Two sub-views: "list"
// (active entries, default) and "trash" (soft-deleted entries, recoverable
// until TTL elapses).  A toggle button at the bottom swaps between them.
// Reuses the canonical toast renderers so log entries render identically
// to the originating toast.

import * as activityLog from "../activity-log.js";
import { getAchievement } from "../registry.js";
import { formatRelativeTime } from "../../time-ago.js";
import {
  buildAchievementToast,
  wireToastClick,
  buildRelockToast,
  wireRelockToastClick,
} from "./toast.js";
import { showHintTooltip, hideHintTooltip } from "./tooltip.js";
import { INTRO_CARD_THRESHOLD } from "./cards.js";

// ── Intro hint ──
// Onboarding tip prepended to the active list during the discovery phase.
// Shares INTRO_CARD_THRESHOLD so both onboarding cues vanish at the same
// milestone instead of drifting independently.
export const INTRO_HINT_THRESHOLD = INTRO_CARD_THRESHOLD;

let activitySubView = "list"; // "list" | "trash"

// Panel-facing hook injected by the facade — lets scroll-to-entry find
// the live panel element without this module importing its parent.
let _getPanelEl = () => null;

export function configureActivity({ getPanelEl } = {}) {
  if (getPanelEl) _getPanelEl = getPanelEl;
}

export function renderActivity(container) {
  container.replaceChildren();

  // If the trash view becomes empty (user emptied it or restored every
  // entry), auto-fall-back to the main list so there's always something
  // to look at.
  if (activitySubView === "trash" && activityLog.getTrashedCount() === 0) {
    activitySubView = "list";
  }

  const isTrash = activitySubView === "trash";
  const entries = isTrash ? activityLog.getTrashed() : activityLog.getActive();
  const trashedCount = activityLog.getTrashedCount();

  const header = document.createElement("div");
  header.className = "activity-header";
  const countEl = document.createElement("span");
  countEl.className = "activity-count";
  if (entries.length === 0) {
    countEl.textContent = isTrash ? "Trash is empty" : "No activity yet";
  } else {
    const noun = entries.length === 1 ? "entry" : "entries";
    countEl.textContent = `${entries.length} ${noun}`;
  }
  header.appendChild(countEl);

  // Primary action — differs per sub-view.  List: soft-delete all
  // (entries go to trash).  Trash: hard-delete all (permanent purge).
  const primaryBtn = document.createElement("button");
  primaryBtn.className = "activity-clear";
  primaryBtn.textContent = isTrash ? "Empty trash" : "Clear all";
  primaryBtn.addEventListener("click", () => {
    if (isTrash) activityLog.emptyTrash();
    else activityLog.clear();
  });
  if (entries.length === 0) primaryBtn.style.display = "none";
  header.appendChild(primaryBtn);

  container.appendChild(header);

  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "activity-empty";
    empty.textContent = isTrash
      ? "Dismissed entries appear here, recoverable for a week."
      : "Earned achievements will appear here.";
    container.appendChild(empty);
  } else {
    const list = document.createElement("div");
    list.className = "activity-list";
    if (!isTrash && entries.length <= INTRO_HINT_THRESHOLD) {
      list.appendChild(buildIntroHint());
    }
    for (const entry of entries) {
      const row = renderActivityEntry(entry, { trash: isTrash });
      if (row) list.appendChild(row);
    }
    container.appendChild(list);
  }

  // Footer — sub-view toggle.  Only shown when there's something to
  // toggle to (i.e. we're in trash, or there's trashed content to visit).
  if (isTrash || trashedCount > 0) {
    const footer = document.createElement("div");
    footer.className = "activity-footer";
    const toggle = document.createElement("button");
    toggle.className = "activity-trash-toggle";
    toggle.setAttribute("aria-pressed", isTrash ? "true" : "false");
    toggle.innerHTML = isTrash
      ? "<span>← Back to activity</span>"
      : `<span>Trash (${trashedCount})</span>`;
    toggle.addEventListener("click", () => {
      activitySubView = isTrash ? "list" : "trash";
      renderActivity(container);
    });
    footer.appendChild(toggle);
    container.appendChild(footer);
  }
}

// Onboarding hint prepended to the active list while the user is still
// discovering what the Activity tab represents.  Visual language echoes
// the Achievements-tab intro card (accent border, gradient tint) so the
// two tabs feel like part of the same onboarding language.
function buildIntroHint() {
  const hint = document.createElement("div");
  hint.className = "activity-intro-hint";
  hint.textContent = "Your discoveries appear here in order, newest first.";
  return hint;
}

// Build a single activity-log row.  `opts.trash` selects between the
// active-list "dismiss" action and the trash-view "restore" action.
// Returns null if the entry's payload can't be resolved (e.g. achievement
// removed from the registry).  Switch on entry.type when new event types
// are added later.
function renderActivityEntry(entry, opts = {}) {
  const isTrash = !!opts.trash;
  const row = document.createElement("div");
  row.className = "activity-row" + (isTrash ? " trashed" : "");
  row.dataset.entryId = entry.id;
  if (!isTrash && !entry.seen) row.classList.add("unseen");

  let content = null;
  if (entry.type === "achievement-unlocked") {
    const achievement = getAchievement(entry.payload?.achievementId);
    if (!achievement) return null;
    content = buildAchievementToast(achievement);
    wireToastClick(content, achievement);
    if (achievement.hint) {
      content.addEventListener("mouseenter", () =>
        showHintTooltip(content, achievement.hint),
      );
      content.addEventListener("mouseleave", hideHintTooltip);
    }
  } else if (entry.type === "achievement-relocked") {
    const achievement = getAchievement(entry.payload?.achievementId);
    if (!achievement) return null;
    content = buildRelockToast(achievement);
    wireRelockToastClick(content, achievement);
  }
  if (!content) return null;

  const meta = document.createElement("div");
  meta.className = "activity-meta";
  const time = document.createElement("span");
  time.className = "activity-time";
  // Trashed rows show when the entry was dismissed; active rows show when
  // the event originally fired.
  const ts = isTrash ? entry.trashedAt : entry.timestamp;
  const prefix = isTrash ? "dismissed " : "";
  time.textContent = `${prefix}${formatRelativeTime(ts)}`;
  time.title = new Date(ts).toLocaleString();
  meta.appendChild(time);

  const actionBtn = document.createElement("button");
  if (isTrash) {
    actionBtn.className = "activity-restore";
    actionBtn.setAttribute("aria-label", "Restore entry");
    // Undo arrow — curled arrow pointing left-up
    actionBtn.innerHTML =
      '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c0-2 1.8-3.5 4-3.5S10 4 10 6M2 6l2-2M2 6l2 2"/></svg>';
    actionBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      activityLog.restore(entry.id);
    });
  } else {
    actionBtn.className = "activity-dismiss";
    actionBtn.setAttribute("aria-label", "Dismiss entry");
    actionBtn.innerHTML =
      '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M3 3l6 6M3 9l6-6"/></svg>';
    actionBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      activityLog.trash(entry.id);
    });
  }
  meta.appendChild(actionBtn);

  row.appendChild(content);
  row.appendChild(meta);
  return row;
}

// Find the latest active activity entry for a given achievement id and
// type, switch the panel into the Activity tab + list sub-view, and
// scroll the row into view with a brief highlight.  No-op if no
// matching entry exists or the panel isn't open.
export function scrollToLatestActivityFor(achievementId, type) {
  if (!achievementId || !type) return;
  const matches = activityLog
    .getActive()
    .filter(
      (e) => e.type === type && e.payload?.achievementId === achievementId,
    )
    .sort((a, b) => b.timestamp - a.timestamp);
  if (matches.length === 0) return;
  const entryId = matches[0].id;

  const panelEl = _getPanelEl();
  if (!panelEl) return;
  const view = panelEl.querySelector(".achievement-view-activity");
  if (!view) return;
  // If we're in the trash sub-view, swap back to the list and
  // re-render so the target row exists.  Otherwise the panel's own
  // onChange path has already kept the active list current.
  if (activitySubView !== "list") {
    activitySubView = "list";
    renderActivity(view);
  }

  const row = view.querySelector(`.activity-row[data-entry-id="${entryId}"]`);
  if (!row) return;

  row.scrollIntoView({ behavior: "smooth", block: "center" });
  row.classList.remove("shine");
  void row.offsetHeight;
  row.classList.add("shine");
  row.addEventListener("animationend", () => row.classList.remove("shine"), {
    once: true,
  });
}

// Test hook — return to "list" sub-view between runs so no test inherits
// trash-mode state from a prior one.
export function _resetForTests() {
  activitySubView = "list";
  _getPanelEl = () => null;
}
