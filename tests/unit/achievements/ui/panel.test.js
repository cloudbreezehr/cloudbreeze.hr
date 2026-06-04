import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// panel.js is the biggest extracted module — it builds the Cloudlog
// panel DOM, wires escape/outside-click/focus-trap handlers, and owns
// the open/close lifecycle.  Tests lean on the real sibling modules
// (tabs, cards, activity) so the integration seams get exercised, not
// just the panel shell in isolation.  IntersectionObserver and
// fireworks are stubbed because neither runs meaningfully in happy-dom.

vi.mock("../../../../js/effects/fireworks.js", () => ({
  burstFireworks: vi.fn(),
  launchRocketFireworks: vi.fn(),
  rocketCountForTier: vi.fn(() => 1),
}));

describe("achievements/ui/panel", () => {
  let mod;
  let storage;
  let activityLog;
  let navButton;
  let cards;
  let tabs;
  let toast;
  let origScrollIntoView;

  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T12:00:00Z"));
    vi.resetModules();
    document.body.innerHTML = `
      <nav>
        <div class="nav-actions">
          <button class="appearance-toggle"></button>
        </div>
      </nav>
    `;
    document.body.className = "";

    // IntersectionObserver isn't in happy-dom; the panel's createSeenObserver
    // call requires it to exist, but we only care that the panel opens.
    globalThis.IntersectionObserver = class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    origScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();

    mod = await import("../../../../js/achievements/ui/panel.js");
    storage = await import("../../../../js/achievements/storage.js");
    activityLog = await import("../../../../js/achievements/activity-log.js");
    navButton = await import("../../../../js/achievements/ui/nav-button.js");
    cards = await import("../../../../js/achievements/ui/cards.js");
    tabs = await import("../../../../js/achievements/ui/tabs.js");
    toast = await import("../../../../js/achievements/ui/toast.js");
    storage.load();

    // Nav button needs to exist for closePanel's setNavActive to work,
    // and for the outside-click handler to know what counts as "inside
    // the nav button".
    navButton.createNavButton(() => {});
  });

  afterEach(() => {
    mod._resetForTests();
    cards._resetForTests();
    tabs._resetForTests();
    toast._resetForTests();
    navButton._resetForTests();
    vi.useRealTimers();
    delete globalThis.IntersectionObserver;
    if (origScrollIntoView === undefined) {
      delete Element.prototype.scrollIntoView;
    } else {
      Element.prototype.scrollIntoView = origScrollIntoView;
    }
  });

  function getPanel() {
    return document.querySelector(".achievement-panel");
  }

  describe("openPanel", () => {
    it("creates the panel on first open", () => {
      expect(getPanel()).toBeNull();
      mod.openPanel();
      expect(getPanel()).not.toBeNull();
      expect(mod.isPanelOpen()).toBe(true);
    });

    it("marks the nav button active", () => {
      mod.openPanel();
      const navBtn = document.querySelector(".achievement-btn");
      expect(navBtn.classList.contains("active")).toBe(true);
    });

    it("dispatches a panel-open achievement event", () => {
      const listener = vi.fn();
      window.addEventListener("achievement", listener);
      mod.openPanel();
      window.removeEventListener("achievement", listener);
      const matching = listener.mock.calls.filter(
        (c) => c[0].detail.type === "panel-open",
      );
      expect(matching).toHaveLength(1);
    });

    it("is idempotent — a second open on the same panel is a no-op", () => {
      mod.openPanel();
      const first = getPanel();
      mod.openPanel();
      expect(getPanel()).toBe(first);
    });

    it("re-opening a previously closed panel refreshes instead of rebuilding", () => {
      mod.openPanel();
      const first = getPanel();
      mod.closePanel();
      mod.openPanel();
      // Same DOM node — buildPanel isn't called twice for the same panelEl.
      expect(getPanel()).toBe(first);
    });

    it("removes the inert attribute on open and re-adds it on close", () => {
      mod.openPanel();
      const panel = getPanel();
      expect(panel.hasAttribute("inert")).toBe(false);
      mod.closePanel();
      expect(panel.hasAttribute("inert")).toBe(true);
      // Reopening drops it again.
      mod.openPanel();
      expect(panel.hasAttribute("inert")).toBe(false);
    });

    it("restores each tab's scrollTop across close → reopen", () => {
      mod.openPanel();
      const achView = document.querySelector(".achievement-view-achievements");
      const actView = document.querySelector(".achievement-view-activity");
      const ACH_SCROLL = 123;
      const ACT_SCROLL = 47;
      achView.scrollTop = ACH_SCROLL;
      actView.scrollTop = ACT_SCROLL;
      mod.closePanel();
      // Simulate the views being scrolled to 0 by an outside force
      // before re-open (e.g. a re-render).
      achView.scrollTop = 0;
      actView.scrollTop = 0;
      mod.openPanel();
      const achViewAfter = document.querySelector(
        ".achievement-view-achievements",
      );
      const actViewAfter = document.querySelector(".achievement-view-activity");
      expect(achViewAfter.scrollTop).toEqual(ACH_SCROLL);
      expect(actViewAfter.scrollTop).toEqual(ACT_SCROLL);
    });

    it("renders the two tabs", () => {
      mod.openPanel();
      const tabButtons = document.querySelectorAll(".achievement-tab");
      expect(tabButtons).toHaveLength(2);
      expect(tabButtons[0].dataset.tab).toEqual("achievements");
      expect(tabButtons[1].dataset.tab).toEqual("activity");
    });

    it("paints the total points text", () => {
      storage.unlock("first-light");
      mod.openPanel();
      const pointsEl = document.querySelector(".achievement-points-total");
      expect(pointsEl.textContent).toMatch(/\d+ pts$/);
    });

    it("shows the last-unlocked caption once something is unlocked", () => {
      storage.unlock("first-light");
      mod.openPanel();
      const caption = document.querySelector(".achievement-last-unlocked");
      expect(caption.textContent).toContain("Last:");
    });

    it("leaves the last-unlocked caption empty with zero unlocks", () => {
      mod.openPanel();
      const caption = document.querySelector(".achievement-last-unlocked");
      expect(caption.textContent).toEqual("");
    });

    it("paints the overall progress strip with a width and aria value", () => {
      storage.unlock("first-light");
      mod.openPanel();
      const strip = document.querySelector(".achievement-progress-strip");
      const fill = strip.querySelector(".achievement-progress-strip-fill");
      expect(strip.getAttribute("role")).toEqual("progressbar");
      // At least one unlock → non-zero percentage.
      expect(parseInt(strip.getAttribute("aria-valuenow"), 10)).toBeGreaterThan(
        0,
      );
      expect(fill.style.width).toMatch(/%$/);
    });
  });

  describe("closePanel", () => {
    it("removes the 'open' class and flips the flag", () => {
      mod.openPanel();
      const panel = getPanel();
      panel.classList.add("open");
      mod.closePanel();
      expect(panel.classList.contains("open")).toBe(false);
      expect(mod.isPanelOpen()).toBe(false);
    });

    it("clears the nav-active class on the nav button", () => {
      mod.openPanel();
      mod.closePanel();
      const navBtn = document.querySelector(".achievement-btn");
      expect(navBtn.classList.contains("active")).toBe(false);
    });

    it("is a no-op when the panel isn't open", () => {
      expect(() => mod.closePanel()).not.toThrow();
      expect(mod.isPanelOpen()).toBe(false);
    });
  });

  describe("dismissal", () => {
    it("Escape closes the panel", () => {
      mod.openPanel();
      expect(mod.isPanelOpen()).toBe(true);
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      expect(mod.isPanelOpen()).toBe(false);
    });

    it("pointer click outside the panel does NOT close it", () => {
      mod.openPanel();
      const orphan = document.createElement("div");
      document.body.appendChild(orphan);
      orphan.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      expect(mod.isPanelOpen()).toBe(true);
    });

    it("the close button closes the panel", () => {
      mod.openPanel();
      const closeBtn = document.querySelector(".achievement-close");
      closeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(mod.isPanelOpen()).toBe(false);
    });
  });

  describe("refreshPanel", () => {
    it("repaints points + count when state changes", () => {
      mod.openPanel();
      const pointsBefore = document.querySelector(
        ".achievement-points-total",
      ).textContent;
      storage.unlock("first-light");
      mod.refreshPanel();
      const pointsAfter = document.querySelector(
        ".achievement-points-total",
      ).textContent;
      expect(pointsBefore).not.toEqual(pointsAfter);
    });

    it("is a no-op when the panel has never been built", () => {
      expect(() => mod.refreshPanel()).not.toThrow();
    });
  });

  describe("destroyPanel", () => {
    it("removes the panel DOM and resets state", () => {
      mod.openPanel();
      expect(getPanel()).not.toBeNull();
      mod.destroyPanel();
      expect(getPanel()).toBeNull();
      expect(mod.isPanelOpen()).toBe(false);
    });

    it("is safe to call before openPanel", () => {
      expect(() => mod.destroyPanel()).not.toThrow();
    });
  });

  describe("hint toggle", () => {
    it("wires the checkbox to cards.setRevealHints", () => {
      mod.openPanel();
      const cb = document.querySelector(".achievement-hint-toggle input");
      expect(cb.checked).toBe(false);
      cb.checked = true;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
      expect(cards.getRevealHints()).toBe(true);
    });
  });

  describe("mark-all-read button", () => {
    it("is hidden when there are no unseen unlocks", () => {
      mod.openPanel();
      const btn = document.querySelector(".achievement-mark-read");
      expect(btn.style.display).toEqual("none");
    });

    it("is visible when there are unseen unlocks", () => {
      storage.unlock("first-light");
      mod.openPanel();
      const btn = document.querySelector(".achievement-mark-read");
      expect(btn.style.display).not.toEqual("none");
    });

    it("clicking it marks all unseen as seen", () => {
      storage.unlock("first-light");
      mod.openPanel();
      const btn = document.querySelector(".achievement-mark-read");
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(storage.getUnseenCount()).toEqual(0);
    });
  });

  describe("hide-from-navbar button", () => {
    it("closes the panel and invokes onHide", () => {
      const onHide = vi.fn();
      mod.openPanel(onHide);
      const hideBtn = document.querySelector(".achievement-hide-btn");
      hideBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(mod.isPanelOpen()).toBe(false);
      expect(onHide).toHaveBeenCalledOnce();
    });
  });

  describe("activity log subscription", () => {
    it("re-renders the activity view when the log changes", () => {
      mod.openPanel();
      // Before: empty state — no .activity-row entries, just the
      // empty-state placeholder.
      expect(
        document.querySelectorAll(".achievement-view-activity .activity-row"),
      ).toHaveLength(0);
      activityLog.log("achievement-unlocked", { achievementId: "first-light" });
      // After the log mutates, the subscription fires and re-renders;
      // one row now exists.
      expect(
        document.querySelectorAll(".achievement-view-activity .activity-row"),
      ).toHaveLength(1);
    });

    it("keeps the subscription alive across destroy → rebuild", () => {
      // The subscription lives at module-top — not inside buildPanel —
      // so a destroy+rebuild cycle doesn't need to re-subscribe, and
      // equally doesn't stack a second subscriber on the log.  This
      // test pins the "rebuild still wires activity renders" half of
      // that invariant; the "no stacking" half is enforced by the
      // subscription's placement (one call at module evaluation).
      mod.openPanel();
      mod.destroyPanel();
      mod.openPanel();
      activityLog.log("achievement-unlocked", { achievementId: "first-light" });
      expect(
        document.querySelectorAll(".achievement-view-activity .activity-row"),
      ).toHaveLength(1);
    });
  });
});
