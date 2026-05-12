import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// activity.js owns the Activity tab renderer — both the main list and
// the trash sub-view.  Its only module state is the current sub-view,
// which _resetForTests wipes.  activityLog is the real sibling module
// so tests exercise the same read/write paths production does.

// Stub fireworks so buildAchievementToast (reused for each row) doesn't
// try to animate inside a test.
vi.mock("../../../../js/effects/fireworks.js", () => ({
  burstFireworks: vi.fn(),
  launchRocketFireworks: vi.fn(),
  rocketCountForTier: vi.fn(() => 1),
}));

describe("achievements/ui/activity", () => {
  let mod;
  let activityLog;
  let container;

  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T12:00:00Z"));
    vi.resetModules();
    document.body.innerHTML = "";

    container = document.createElement("div");
    document.body.appendChild(container);

    mod = await import("../../../../js/achievements/ui/activity.js");
    activityLog = await import("../../../../js/achievements/activity-log.js");
  });

  afterEach(() => {
    mod._resetForTests();
    vi.useRealTimers();
  });

  describe("empty state", () => {
    it('shows "No activity yet" when the log is empty', () => {
      mod.renderActivity(container);
      expect(container.querySelector(".activity-count").textContent).toEqual(
        "No activity yet",
      );
      expect(container.querySelector(".activity-empty")).not.toBeNull();
    });

    it("hides the clear-all button when there's nothing to clear", () => {
      mod.renderActivity(container);
      const clearBtn = container.querySelector(".activity-clear");
      expect(clearBtn.style.display).toEqual("none");
    });

    it("does not show the trash footer when no entries have been dismissed", () => {
      mod.renderActivity(container);
      expect(container.querySelector(".activity-footer")).toBeNull();
    });
  });

  describe("list view with entries", () => {
    beforeEach(() => {
      // Two real unlocks so rows have resolvable payloads.
      activityLog.log("achievement-unlocked", { achievementId: "first-light" });
      activityLog.log("achievement-unlocked", {
        achievementId: "cloud-reader",
      });
    });

    it("renders one row per entry", () => {
      mod.renderActivity(container);
      expect(container.querySelectorAll(".activity-row").length).toEqual(2);
    });

    it("count uses singular/plural noun correctly", () => {
      mod.renderActivity(container);
      expect(container.querySelector(".activity-count").textContent).toEqual(
        "2 entries",
      );
    });

    it("unseen entries carry the unseen class", () => {
      mod.renderActivity(container);
      const rows = container.querySelectorAll(".activity-row");
      for (const row of rows)
        expect(row.classList.contains("unseen")).toBe(true);
    });

    it("skips entries whose achievement was removed from the registry", () => {
      activityLog.log("achievement-unlocked", {
        achievementId: "ghost-ach-id",
      });
      mod.renderActivity(container);
      // Two valid + one ghost = two rows.
      expect(container.querySelectorAll(".activity-row").length).toEqual(2);
    });

    it("dismiss button trashes the entry", () => {
      mod.renderActivity(container);
      const dismiss = container.querySelector(".activity-dismiss");
      dismiss.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(activityLog.getActive().length).toEqual(1);
      expect(activityLog.getTrashedCount()).toEqual(1);
    });

    it("renders the intro hint while at or below the threshold", () => {
      mod.renderActivity(container);
      expect(container.querySelector(".activity-intro-hint")).not.toBeNull();
    });

    it("hides the intro hint once the threshold is exceeded", () => {
      // Threshold is 10; pad with additional unlocks to cross it.
      for (let i = 0; i < 9; i++) {
        activityLog.log("achievement-unlocked", {
          achievementId: "first-light",
        });
      }
      mod.renderActivity(container);
      expect(container.querySelector(".activity-intro-hint")).toBeNull();
    });
  });

  describe("trash sub-view", () => {
    beforeEach(() => {
      activityLog.log("achievement-unlocked", { achievementId: "first-light" });
      // Dismiss one so there's a trashed entry to toggle to.
      const entries = activityLog.getActive();
      activityLog.trash(entries[0].id);
    });

    it("does not render the intro hint inside the trash view", () => {
      mod.renderActivity(container);
      container
        .querySelector(".activity-trash-toggle")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(container.querySelector(".activity-intro-hint")).toBeNull();
    });

    it("toggle button opens the trash view", () => {
      mod.renderActivity(container);
      const toggle = container.querySelector(".activity-trash-toggle");
      expect(toggle.getAttribute("aria-pressed")).toEqual("false");

      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const backToggle = container.querySelector(".activity-trash-toggle");
      expect(backToggle.getAttribute("aria-pressed")).toEqual("true");
      expect(backToggle.textContent).toContain("Back to activity");
    });

    it("restore button moves an entry back to the active list", () => {
      mod.renderActivity(container);
      // Switch to trash view first.
      container
        .querySelector(".activity-trash-toggle")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));

      const restore = container.querySelector(".activity-restore");
      restore.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(activityLog.getActive().length).toEqual(1);
      expect(activityLog.getTrashedCount()).toEqual(0);
    });

    it("auto-falls-back to the list view when trash drains to empty", () => {
      mod.renderActivity(container);
      // Enter trash.
      container
        .querySelector(".activity-trash-toggle")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      // Empty it.
      container
        .querySelector(".activity-clear")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      // Re-render — the sub-view should have reset to "list" because
      // trash is now empty.
      mod.renderActivity(container);
      expect(container.querySelector(".activity-count").textContent).toEqual(
        "No activity yet",
      );
    });
  });

  describe("clear all", () => {
    it("soft-deletes every active entry into the trash", () => {
      activityLog.log("achievement-unlocked", { achievementId: "first-light" });
      activityLog.log("achievement-unlocked", {
        achievementId: "cloud-reader",
      });
      mod.renderActivity(container);
      container
        .querySelector(".activity-clear")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(activityLog.getActive().length).toEqual(0);
      expect(activityLog.getTrashedCount()).toEqual(2);
    });
  });
});
