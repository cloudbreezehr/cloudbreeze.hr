import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { INTRO_HINT_THRESHOLD } from "../../../../js/achievements/ui/activity.js";
import { getAchievement } from "../../../../js/achievements/registry.js";
import { POST_SETTLE_DELAY_MS } from "../../../../js/scroll-highlight.js";

// Symbolic landmark — tests want to land just past the post-settle delay
// so the deferred highlight has fired.  Tuning the source constant
// retunes the tests automatically.
const SLACK_MS = 1;
const AFTER_HIGHLIGHT_DELAY_MS = POST_SETTLE_DELAY_MS + SLACK_MS;

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

// Two real unlocks are seeded by an inner beforeEach; pad the rest of
// the way past the threshold so the hint must hide.
const SEED_UNLOCKS = 2;
const PAD_TO_PAST_THRESHOLD = INTRO_HINT_THRESHOLD - SEED_UNLOCKS + 1;

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

    it("renders re-locked entries with the relock toast variant", () => {
      activityLog.log("achievement-relocked", { achievementId: "first-light" });
      mod.renderActivity(container);
      const relockRows = container.querySelectorAll(
        ".activity-row .achievement-toast-relock",
      );
      expect(relockRows.length).toEqual(1);
      expect(
        relockRows[0].querySelector(".achievement-toast-title").textContent,
      ).toContain("Re-locked");
    });

    it("skips relock entries whose achievement was removed from the registry", () => {
      activityLog.log("achievement-relocked", { achievementId: "ghost-ach" });
      mod.renderActivity(container);
      const relockRows = container.querySelectorAll(
        ".activity-row .achievement-toast-relock",
      );
      expect(relockRows.length).toEqual(0);
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
      for (let i = 0; i < PAD_TO_PAST_THRESHOLD; i++) {
        activityLog.log("achievement-unlocked", {
          achievementId: "first-light",
        });
      }
      mod.renderActivity(container);
      expect(container.querySelector(".activity-intro-hint")).toBeNull();
    });
  });

  describe("hint tooltip on activity rows", () => {
    function getTooltip() {
      return document.querySelector(".achievement-tooltip");
    }

    it("shows the achievement hint when hovering an unlock row", () => {
      activityLog.log("achievement-unlocked", { achievementId: "first-light" });
      mod.renderActivity(container);
      const toast = container.querySelector(".activity-row .achievement-toast");
      toast.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      const tip = getTooltip();
      expect(tip).not.toBeNull();
      expect(tip.classList.contains("visible")).toBe(true);
      expect(tip.textContent).toEqual(getAchievement("first-light").hint);
    });

    it("hides the tooltip on mouseleave from an unlock row", () => {
      activityLog.log("achievement-unlocked", { achievementId: "first-light" });
      mod.renderActivity(container);
      const toast = container.querySelector(".activity-row .achievement-toast");
      toast.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      toast.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      expect(getTooltip().classList.contains("visible")).toBe(false);
    });

    it("shows the achievement hint when hovering a re-lock row", () => {
      activityLog.log("achievement-relocked", { achievementId: "first-light" });
      mod.renderActivity(container);
      const toast = container.querySelector(
        ".activity-row .achievement-toast-relock",
      );
      toast.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      const tip = getTooltip();
      expect(tip).not.toBeNull();
      expect(tip.classList.contains("visible")).toBe(true);
      expect(tip.textContent).toEqual(getAchievement("first-light").hint);
    });
  });

  describe("theme-switch rows", () => {
    it("renders an entered-theme entry with the theme's label", () => {
      activityLog.log("theme-switched", {
        themeId: "rainy",
        activated: true,
      });
      mod.renderActivity(container);
      const row = container.querySelector(
        ".activity-row .activity-theme-switch",
      );
      expect(row).not.toBeNull();
      expect(row.textContent).toContain("Entered Rainy");
    });

    it("renders a left-theme entry with the theme's label", () => {
      activityLog.log("theme-switched", {
        themeId: "frozen",
        activated: false,
      });
      mod.renderActivity(container);
      const row = container.querySelector(
        ".activity-row .activity-theme-switch",
      );
      expect(row).not.toBeNull();
      expect(row.textContent).toContain("Left Frozen");
    });

    it("paints the theme color via the --theme-color custom property", () => {
      activityLog.log("theme-switched", {
        themeId: "blocky",
        activated: true,
      });
      mod.renderActivity(container);
      const row = container.querySelector(".activity-theme-switch");
      // Blocky is registered with #ffa040; the row exposes it as
      // --theme-color so the border + icon adopt it without per-theme CSS.
      expect(row.style.getPropertyValue("--theme-color")).toEqual("#ffa040");
    });

    it("skips entries whose theme id is no longer registered", () => {
      activityLog.log("theme-switched", {
        themeId: "ghost-theme",
        activated: true,
      });
      mod.renderActivity(container);
      expect(container.querySelector(".activity-theme-switch")).toBeNull();
      expect(container.querySelectorAll(".activity-row").length).toEqual(0);
    });

    it("clicking a row toggles the theme via the registry", async () => {
      const themeRegistry = await import("../../../../js/themes/registry.js");
      const calls = [];
      themeRegistry.registerToggle("rainy", (opts) => calls.push(opts));

      activityLog.log("theme-switched", {
        themeId: "rainy",
        activated: true,
      });
      mod.renderActivity(container);
      const row = container.querySelector(".activity-theme-switch");
      row.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      expect(calls.length).toEqual(1);
    });
  });

  describe("re-lock row click navigation", () => {
    it("opens the achievement card just like an unlock row does", async () => {
      const toastMod = await import("../../../../js/achievements/ui/toast.js");
      const scrollToCard = vi.fn();
      toastMod.configureToasts({
        isPanelOpen: () => true,
        scrollToCard,
      });

      activityLog.log("achievement-relocked", { achievementId: "first-light" });
      mod.renderActivity(container);
      const toast = container.querySelector(
        ".activity-row .achievement-toast-relock",
      );
      toast.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      expect(scrollToCard).toHaveBeenCalledWith("first-light");
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

  describe("data-entry-id", () => {
    it("stamps each rendered row with its entry id", () => {
      activityLog.log("achievement-unlocked", { achievementId: "first-light" });
      mod.renderActivity(container);
      const rows = container.querySelectorAll(".activity-row");
      expect(rows.length).toEqual(1);
      const expectedId = activityLog.getActive()[0].id;
      expect(rows[0].dataset.entryId).toEqual(expectedId);
    });
  });

  describe("scrollToLatestActivityFor", () => {
    let panelEl;
    let view;
    let origScrollIntoView;

    beforeEach(() => {
      origScrollIntoView = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = vi.fn();

      // Stand in for the real Cloudlog panel: a wrapper containing the
      // activity view, since scrollToLatestActivityFor queries through it.
      panelEl = document.createElement("div");
      panelEl.className = "achievement-panel";
      view = document.createElement("div");
      view.className = "achievement-view-activity";
      panelEl.appendChild(view);
      document.body.appendChild(panelEl);

      mod.configureActivity({ getPanelEl: () => panelEl });
    });

    afterEach(() => {
      if (origScrollIntoView === undefined) {
        delete Element.prototype.scrollIntoView;
      } else {
        Element.prototype.scrollIntoView = origScrollIntoView;
      }
    });

    it("scrolls the matching row into view and adds the shine class", () => {
      activityLog.log("achievement-relocked", { achievementId: "first-light" });
      mod.renderActivity(view);
      const expectedId = activityLog.getActive()[0].id;

      mod.scrollToLatestActivityFor("first-light", "achievement-relocked");
      vi.advanceTimersByTime(AFTER_HIGHLIGHT_DELAY_MS);

      const row = view.querySelector(
        `.activity-row[data-entry-id="${expectedId}"]`,
      );
      expect(row).not.toBeNull();
      expect(row.classList.contains("shine")).toBe(true);
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it("picks the most recent active entry when multiple match", () => {
      // Log the older entry first, capture its id, then log the newer.
      activityLog.log("achievement-relocked", { achievementId: "first-light" });
      const olderId = activityLog.getActive()[0].id;
      vi.setSystemTime(new Date("2026-05-12T12:00:00Z"));
      activityLog.log("achievement-relocked", { achievementId: "first-light" });
      const newerId = activityLog.getActive().find((e) => e.id !== olderId).id;
      mod.renderActivity(view);

      mod.scrollToLatestActivityFor("first-light", "achievement-relocked");
      vi.advanceTimersByTime(AFTER_HIGHLIGHT_DELAY_MS);

      const shining = view.querySelector(".activity-row.shine");
      expect(shining).not.toBeNull();
      expect(shining.dataset.entryId).toEqual(newerId);
      expect(shining.dataset.entryId).not.toEqual(olderId);
    });

    it("ignores entries with the wrong type", () => {
      // An unlock entry exists for first-light but no relock — call
      // should be a no-op (no shine row).
      activityLog.log("achievement-unlocked", { achievementId: "first-light" });
      mod.renderActivity(view);

      mod.scrollToLatestActivityFor("first-light", "achievement-relocked");

      expect(view.querySelector(".activity-row.shine")).toBeNull();
    });

    it("is a no-op when no panel is configured", () => {
      activityLog.log("achievement-relocked", { achievementId: "first-light" });
      mod.configureActivity({ getPanelEl: () => null });

      expect(() =>
        mod.scrollToLatestActivityFor("first-light", "achievement-relocked"),
      ).not.toThrow();
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it("switches to the Activity tab so the scroll target is visible", async () => {
      const tabsMod = await import("../../../../js/achievements/ui/tabs.js");
      // Add the achievements view sibling + tab buttons so setActiveTab
      // has DOM to toggle.
      const achView = document.createElement("div");
      achView.className =
        "achievement-view achievement-view-achievements active";
      panelEl.appendChild(achView);
      const tabsEl = document.createElement("div");
      tabsEl.className = "achievement-tabs";
      panelEl.appendChild(tabsEl);
      tabsEl.appendChild(
        tabsMod.buildTabButton("achievements", "Achievements", "achievements"),
      );
      tabsEl.appendChild(
        tabsMod.buildTabButton("activity", "Activity", "activity"),
      );
      tabsMod.configureTabs({ getPanelEl: () => panelEl });

      activityLog.log("achievement-relocked", { achievementId: "first-light" });
      mod.renderActivity(view);

      mod.scrollToLatestActivityFor("first-light", "achievement-relocked");

      expect(tabsMod.getActiveTab()).toEqual("activity");
      expect(view.classList.contains("active")).toBe(true);
      expect(achView.classList.contains("active")).toBe(false);
    });
  });
});
