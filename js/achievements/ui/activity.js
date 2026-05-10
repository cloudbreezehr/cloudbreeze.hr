// ── Activity view ──
// Re-chronological stack of achievement toasts.  Two sub-views: "list"
// (active entries, default) and "trash" (soft-deleted entries, recoverable
// until TTL elapses).  A toggle button at the bottom swaps between them.
// Reuses buildAchievementToast so live toasts and log entries stay
// visually identical.

import * as activityLog from "../activity-log.js";
import { getAchievement } from "../registry.js";
import { formatRelativeTime } from "../../time-ago.js";
import { buildAchievementToast, wireToastClick } from "./toast.js";

let activitySubView = "list"; // "list" | "trash"

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

// Build a single activity-log row.  `opts.trash` selects between the
// active-list "dismiss" action and the trash-view "restore" action.
// Returns null if the entry's payload can't be resolved (e.g. achievement
// removed from the registry).  Switch on entry.type when new event types
// are added later.
function renderActivityEntry(entry, opts = {}) {
  const isTrash = !!opts.trash;
  const row = document.createElement("div");
  row.className = "activity-row" + (isTrash ? " trashed" : "");
  if (!isTrash && !entry.seen) row.classList.add("unseen");

  let content = null;
  if (entry.type === "achievement-unlocked") {
    const achievement = getAchievement(entry.payload?.achievementId);
    if (!achievement) return null;
    content = buildAchievementToast(achievement);
    wireToastClick(content, achievement);
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

// Test hook — return to "list" sub-view between runs so no test inherits
// trash-mode state from a prior one.
export function _resetForTests() {
  activitySubView = "list";
}
