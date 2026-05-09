// ── Achievements Bridge ──
// Translates the existing achievement CustomEvent stream into analytics
// events without changing source modules.  Three surfaces:
//
//   1. Cloudlog activation — first "cloudlog-activate" event per visitor
//      is a high-signal conversion moment (from "tourist" to "player").
//
//   2. Unlock events — every unlock records set, points, session-level
//      ordering, and the active mode at unlock time.  This is the future
//      rarity feed's write path.
//
//   3. Set completion + progress milestones — derived from counting the
//      unlocked set against each set's prereq list.
//
// The bridge does NOT re-implement condition logic.  It observes what the
// tracker already fired by hooking into the same achievement-custom-event
// stream AND by wrapping the tracker's onUnlock callback through a thin
// bus in index.js.

import { track } from "../core.js";
import { sessionCounters } from "./session.js";
import {
  sumPoints,
  getAllNonMeta,
  SET_MASTERY_MAP,
} from "../../achievements/registry.js";
import * as storage from "../../achievements/storage.js";
import * as identity from "../identity.js";

const PROGRESS_MILESTONES = [10, 25, 50, 75, 100];

// Source event type → analytics method label.
const CLOUDLOG_METHOD_BY_TYPE = {
  "cloudlog-activate": "triple_click",
  "cloudlog-shortcut": "shortcut",
};

export function initAchievementsBridge() {
  const sessionStartedAt = Date.now();
  const firstVisitTs = Date.parse(identity.firstVisitTs());
  let unlockOrder = 0;
  const firedMilestones = new Set();
  const completedSets = new Set();
  let panelOpenCount = 0;
  let cloudlogActivatedFired = false;
  // Recorded on the first cloudlog activation this session.  Unlocks use
  // it to report time_since_cloudlog_activated_ms — a discovery vs.
  // tourist-cohort separator for the achievement funnel.
  let cloudlogActivatedAt = null;

  function quadrantOf(x, y) {
    if (x == null || y == null) return null;
    const qx = x < window.innerWidth / 2 ? "l" : "r";
    const qy = y < window.innerHeight / 2 ? "t" : "b";
    return qy + qx;
  }

  window.addEventListener("achievement", (e) => {
    const d = e.detail || {};
    switch (d.type) {
      case "cloudlog-activate":
      case "cloudlog-shortcut":
        if (!cloudlogActivatedFired) {
          cloudlogActivatedFired = true;
          cloudlogActivatedAt = Date.now();
          track("cloudlog_activated", {
            method: CLOUDLOG_METHOD_BY_TYPE[d.type] || "unknown",
            time_since_first_visit_ms: Date.now() - firstVisitTs,
            session_elapsed_ms: Date.now() - sessionStartedAt,
            // trigger coords / quadrant only meaningful for the triple-
            // click path; shortcut-based activations leave them null.
            trigger_x: d.x != null ? d.x : null,
            trigger_y: d.y != null ? d.y : null,
            trigger_quadrant: quadrantOf(d.x, d.y),
          });
        }
        break;
      case "panel-open":
        panelOpenCount++;
        track("cloudlog_panel_opened", {
          open_count_session: panelOpenCount,
          unlocks_at_time: storage.getUnlocked().length,
        });
        break;
    }
  });

  // Achievement-unlock callback pathway.  Bridged through a custom window
  // event ("analytics-unlock") dispatched from the shim we install in
  // js/achievements/index.js — see initAchievements() integration.
  window.addEventListener("analytics-unlock", (e) => {
    const ach = e.detail && e.detail.achievement;
    if (!ach) return;
    unlockOrder++;
    sessionCounters.unlocksThisSession++;
    sessionCounters.pointsThisSession += ach.points || 0;

    const unlocked = storage.getUnlocked();
    const unlocksAfter = unlocked.length;
    const pointsAfter = sumPoints(unlocked);

    // active_mode is carried by baseProps — no snapshot needed here.
    // time_since_cloudlog_activated_ms is null for unlocks fired before
    // the user has discovered the Cloudlog (possible via persistent
    // state catch-up or achievements that don't require the Cloudlog).
    track("achievement_unlocked", {
      achievement_id: ach.id,
      set_id: ach.set,
      points: ach.points || 0,
      hidden: !!ach.hidden,
      progressive: !!ach.progressKey,
      session_unlock_order: unlockOrder,
      time_since_session_start_ms: Date.now() - sessionStartedAt,
      time_since_first_visit_ms: Date.now() - firstVisitTs,
      time_since_cloudlog_activated_ms:
        cloudlogActivatedAt != null ? Date.now() - cloudlogActivatedAt : null,
      unlocks_after: unlocksAfter,
      points_after: pointsAfter,
    });

    // Set completion — fire the first time all prereqs for a set are
    // unlocked.  Uses the mastery-achievement map so we only run this for
    // sets that have an "unlock all" achievement.
    for (const [setId] of Object.entries(SET_MASTERY_MAP)) {
      if (completedSets.has(setId)) continue;
      if (storage.isUnlocked(SET_MASTERY_MAP[setId])) {
        completedSets.add(setId);
        track("set_completed", {
          set_id: setId,
          time_to_complete_ms: Date.now() - firstVisitTs,
          unlocks_at_completion: unlocksAfter,
        });
      }
    }

    // Non-meta progress milestones — 10 / 25 / 50 / 75 / 100%.
    const nonMetaIds = new Set(getAllNonMeta());
    const nonMetaTotal = nonMetaIds.size;
    if (nonMetaTotal > 0) {
      const nonMetaUnlocked = unlocked.filter((u) =>
        nonMetaIds.has(u.id),
      ).length;
      const pct = Math.floor((nonMetaUnlocked / nonMetaTotal) * 100);
      for (const m of PROGRESS_MILESTONES) {
        if (pct >= m && !firedMilestones.has(m)) {
          firedMilestones.add(m);
          track("progress_milestone", {
            percent: m,
            total_unlocks: nonMetaUnlocked,
          });
        }
      }
    }
  });
}
