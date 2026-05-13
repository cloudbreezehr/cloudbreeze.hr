import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// tabs.js owns the tab bar + the active-tab flag.  Panel DOM is stubbed
// directly — buildPanel isn't invoked; we only need the query shapes
// (achievement-tab, achievement-view-*) for setActiveTab to hit.

describe("achievements/ui/tabs", () => {
  let mod;
  let activityLog;
  let storage;
  let panelEl;

  function buildPanelDom() {
    panelEl = document.createElement("div");
    // Tabs container — buildTabButton output goes here in production.
    const tabBar = document.createElement("div");
    tabBar.className = "achievement-tabs";
    panelEl.appendChild(tabBar);

    const achView = document.createElement("div");
    achView.className = "achievement-view achievement-view-achievements";
    panelEl.appendChild(achView);

    const actView = document.createElement("div");
    actView.className = "achievement-view achievement-view-activity";
    panelEl.appendChild(actView);

    document.body.appendChild(panelEl);
    return { tabBar, achView, actView };
  }

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    document.body.innerHTML = "";

    mod = await import("../../../../js/achievements/ui/tabs.js");
    activityLog = await import("../../../../js/achievements/activity-log.js");
    storage = await import("../../../../js/achievements/storage.js");
    storage.load();

    mod.configureTabs({ getPanelEl: () => panelEl });
  });

  afterEach(() => {
    mod._resetForTests();
  });

  describe("buildTabButton", () => {
    it("returns a button with the right aria + dataset", () => {
      const btn = mod.buildTabButton(
        "achievements",
        "Achievements",
        "achievements",
      );
      expect(btn.getAttribute("role")).toEqual("tab");
      expect(btn.dataset.tab).toEqual("achievements");
      expect(btn.dataset.unseenSource).toEqual("achievements");
      expect(btn.id).toEqual("achievement-tab-achievements");
      // The default active tab is "achievements" — it starts selected.
      expect(btn.getAttribute("aria-selected")).toEqual("true");
      expect(btn.tabIndex).toEqual(0);
    });

    it("non-default tabs start inactive with tabIndex -1", () => {
      const btn = mod.buildTabButton("activity", "Activity", "activity");
      expect(btn.getAttribute("aria-selected")).toEqual("false");
      expect(btn.tabIndex).toEqual(-1);
    });

    it("click switches the active tab", () => {
      const { tabBar, achView, actView } = buildPanelDom();
      tabBar.appendChild(
        mod.buildTabButton("achievements", "Achievements", "achievements"),
      );
      tabBar.appendChild(
        mod.buildTabButton("activity", "Activity", "activity"),
      );

      const activityBtn = tabBar.querySelector('[data-tab="activity"]');
      activityBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      expect(mod.getActiveTab()).toEqual("activity");
      expect(actView.classList.contains("active")).toBe(true);
      expect(achView.classList.contains("active")).toBe(false);
    });

    it("arrow keys move focus between tabs", () => {
      const { tabBar } = buildPanelDom();
      const btnA = mod.buildTabButton(
        "achievements",
        "Achievements",
        "achievements",
      );
      const btnB = mod.buildTabButton("activity", "Activity", "activity");
      tabBar.appendChild(btnA);
      tabBar.appendChild(btnB);
      // Dispatching ArrowRight on the first tab should move to the second
      // and switch active state.
      btnA.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      expect(mod.getActiveTab()).toEqual("activity");
    });
  });

  describe("setActiveTab", () => {
    it("no-ops when no panel is configured", () => {
      panelEl = null;
      expect(() => mod.setActiveTab("activity")).not.toThrow();
      // activeTab isn't mutated because the panel guard tripped first.
      expect(mod.getActiveTab()).toEqual("achievements");
    });

    it("flipping to the activity tab marks activity-log entries as seen", () => {
      buildPanelDom();
      activityLog.log("achievement-unlocked", { achievementId: "first-light" });
      expect(activityLog.getUnseenCount()).toEqual(1);

      mod.setActiveTab("activity");
      expect(activityLog.getUnseenCount()).toEqual(0);
    });

    it("hides any visible hint tooltip so it doesn't strand over the new tab", async () => {
      buildPanelDom();
      const tooltipMod =
        await import("../../../../js/achievements/ui/tooltip.js");
      const anchor = document.createElement("button");
      anchor.getBoundingClientRect = () => ({
        top: 100,
        bottom: 120,
        left: 50,
        right: 80,
        width: 30,
        height: 20,
        x: 50,
        y: 100,
        toJSON: () => ({}),
      });
      document.body.appendChild(anchor);
      tooltipMod.showHintTooltip(anchor, "hint", false);
      const tip = document.querySelector(".achievement-tooltip");
      expect(tip.classList.contains("visible")).toBe(true);

      mod.setActiveTab("activity");
      expect(tip.classList.contains("visible")).toBe(false);
    });
  });

  describe("updateTabBadges", () => {
    it("paints count text on badges and toggles the visible class", () => {
      const { tabBar } = buildPanelDom();
      tabBar.appendChild(
        mod.buildTabButton("achievements", "Achievements", "achievements"),
      );
      tabBar.appendChild(
        mod.buildTabButton("activity", "Activity", "activity"),
      );

      // Seed one unseen unlock in each source.
      storage.unlock("first-light");
      activityLog.log("achievement-unlocked", { achievementId: "first-light" });

      mod.updateTabBadges();

      const achBadge = tabBar.querySelector(
        '[data-tab="achievements"] .achievement-tab-badge',
      );
      const actBadge = tabBar.querySelector(
        '[data-tab="activity"] .achievement-tab-badge',
      );
      expect(achBadge.textContent).toEqual("1");
      expect(achBadge.classList.contains("visible")).toBe(true);
      expect(actBadge.textContent).toEqual("1");
      expect(actBadge.classList.contains("visible")).toBe(true);
    });

    it("no-ops when no panel is configured", () => {
      panelEl = null;
      expect(() => mod.updateTabBadges()).not.toThrow();
    });
  });

  describe("_resetForTests", () => {
    it("returns activeTab to the default", () => {
      buildPanelDom();
      mod.setActiveTab("activity");
      expect(mod.getActiveTab()).toEqual("activity");
      mod._resetForTests();
      expect(mod.getActiveTab()).toEqual("achievements");
    });
  });
});
