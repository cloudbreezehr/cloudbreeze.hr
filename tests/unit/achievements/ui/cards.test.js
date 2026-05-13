import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SEEN_DWELL_MS,
  INTRO_CARD_THRESHOLD,
} from "../../../../js/achievements/ui/cards.js";
import { POST_SETTLE_DELAY_MS } from "../../../../js/achievements/ui/scroll-highlight.js";

// cards.js owns the grouped-by-set achievement grid plus the seen-
// observer dwell tracking.  It reads live panel state via injected
// callbacks so tests stub those cheaply rather than booting the full
// panel.  IntersectionObserver is missing from happy-dom, so we stub
// the constructor to capture the callback for direct invocation.

const SLACK_MS = 100;
const PAST_DWELL_MS = SEEN_DWELL_MS + SLACK_MS;
const HALF_DWELL_MS = Math.floor(SEEN_DWELL_MS / 2);
const PAST_INTRO_THRESHOLD_COUNT = INTRO_CARD_THRESHOLD + 1;
const PAST_HIGHLIGHT_DELAY_MS = POST_SETTLE_DELAY_MS + SLACK_MS;

describe("achievements/ui/cards", () => {
  let mod;
  let storage;
  let container;
  let panelEl;
  let panelOpen;
  let refreshPanelStub;
  let observerInstances;

  let origScrollIntoView;

  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.resetModules();
    document.body.innerHTML = "";
    document.body.className = "";

    // happy-dom doesn't implement scrollIntoView.  Stash the original
    // (may be undefined) so afterEach can restore cleanly.
    origScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();

    // Capture IntersectionObserver instances so tests can fire entries
    // into the callback synchronously.
    observerInstances = [];
    globalThis.IntersectionObserver = class {
      constructor(cb, opts) {
        this.cb = cb;
        this.opts = opts;
        this.observed = new Set();
        observerInstances.push(this);
      }
      observe(el) {
        this.observed.add(el);
      }
      unobserve(el) {
        this.observed.delete(el);
      }
      disconnect() {
        this.observed.clear();
      }
    };

    // Panel stand-in.  The achievements-view is the scroll container the
    // seen-observer uses as its intersection root, so renderSections
    // paints directly into it.
    panelEl = document.createElement("div");
    panelEl.className = "achievement-panel";
    const body = document.createElement("div");
    body.className = "achievement-body";
    panelEl.appendChild(body);
    container = document.createElement("div");
    container.className = "achievement-view achievement-view-achievements";
    body.appendChild(container);
    document.body.appendChild(panelEl);

    // Mark-all-read button that updateMarkReadVisibility toggles.
    const markReadBtn = document.createElement("button");
    markReadBtn.className = "achievement-mark-read";
    panelEl.appendChild(markReadBtn);

    panelOpen = true;
    refreshPanelStub = vi.fn();

    mod = await import("../../../../js/achievements/ui/cards.js");
    storage = await import("../../../../js/achievements/storage.js");
    storage.load();

    mod.configureCards({
      getPanelEl: () => panelEl,
      isPanelOpen: () => panelOpen,
      refreshPanel: refreshPanelStub,
    });
  });

  afterEach(() => {
    mod._resetForTests();
    vi.useRealTimers();
    delete globalThis.IntersectionObserver;
    if (origScrollIntoView === undefined) {
      delete Element.prototype.scrollIntoView;
    } else {
      Element.prototype.scrollIntoView = origScrollIntoView;
    }
  });

  describe("renderSections", () => {
    it("renders a section per non-mode set plus any mode sets with unlocks", () => {
      mod.renderSections(container);
      const sections = container.querySelectorAll(".achievement-set");
      // Non-mode sets are always shown: exploration, mastery, meta.
      // Mode sets appear only when at least one of their achievements
      // is unlocked — none are at this point.
      expect(sections.length).toBeGreaterThanOrEqual(3);
    });

    it("renders each achievement as a card inside its set", () => {
      mod.renderSections(container);
      // The intro card shares .achievement-card chrome but isn't an
      // achievement; scope to data-id-bearing cards.
      const cards = container.querySelectorAll(".achievement-card[data-id]");
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card.dataset.id).toBeTruthy();
      }
    });

    it("renders the intro card while unlocked count is at or below the threshold", () => {
      mod.renderSections(container);
      expect(container.querySelector(".achievement-intro-card")).not.toBeNull();
    });

    it("hides the intro card once unlocked count exceeds the threshold", async () => {
      const { ACHIEVEMENTS } =
        await import("../../../../js/achievements/registry.js");
      for (const ach of ACHIEVEMENTS.slice(0, PAST_INTRO_THRESHOLD_COUNT))
        storage.unlock(ach.id);
      mod.renderSections(container);
      expect(container.querySelector(".achievement-intro-card")).toBeNull();
    });

    it("locked hidden achievements show ??? title and hidden-ach class when revealHints is off", () => {
      mod.renderSections(container);
      const hidden = container.querySelector(
        '.achievement-card.hidden-ach[data-id="time-warp"]',
      );
      expect(hidden).not.toBeNull();
      expect(
        hidden.querySelector(".achievement-card-title").textContent,
      ).toEqual("???");
    });

    it("unlocked achievements carry the unlocked class and show their title", () => {
      storage.unlock("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(card.classList.contains("unlocked")).toBe(true);
      expect(card.querySelector(".achievement-card-title").textContent).toEqual(
        "First Light",
      );
    });

    it("unlocked but unseen cards carry the unseen class", () => {
      storage.unlock("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(card.classList.contains("unseen")).toBe(true);
    });

    it("turning on revealHints re-renders hidden cards with real titles", () => {
      mod.renderSections(container);
      mod.setRevealHints(true);
      // setRevealHints triggers a refresh through the stub; simulate by
      // re-rendering into a fresh container.
      container.replaceChildren();
      mod.renderSections(container);
      const hidden = container.querySelector(
        '.achievement-card[data-id="time-warp"]',
      );
      expect(
        hidden.querySelector(".achievement-card-title").textContent,
      ).toEqual("Time Warp");
    });
  });

  describe("refreshCard", () => {
    it("no-ops when the panel is closed", () => {
      mod.renderSections(container);
      panelOpen = false;
      storage.unlock("first-light");
      mod.refreshCard("first-light");
      // Still in locked state; the first-light card didn't get
      // the unlocked class promoted.
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(card.classList.contains("unlocked")).toBe(false);
    });

    it("promotes the card to unlocked in-place and calls refreshPanel", () => {
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(card.classList.contains("unlocked")).toBe(false);

      storage.unlock("first-light");
      mod.refreshCard("first-light");

      expect(card.classList.contains("unlocked")).toBe(true);
      expect(card.classList.contains("unseen")).toBe(true);
      expect(refreshPanelStub).toHaveBeenCalled();
    });

    it("falls back to full panel refresh when the card isn't in the DOM", () => {
      // Don't renderSections — card won't exist.  refreshCard should
      // trigger refreshPanel and exit.
      storage.unlock("first-light");
      mod.refreshCard("first-light");
      expect(refreshPanelStub).toHaveBeenCalled();
    });
  });

  describe("scrollToCard", () => {
    it("adds the shine class to the matching card", () => {
      mod.renderSections(container);
      mod.scrollToCard("first-light");
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      vi.advanceTimersByTime(PAST_HIGHLIGHT_DELAY_MS);
      expect(card.classList.contains("shine")).toBe(true);
    });

    it("switches to the Achievements tab so the scroll target is visible", async () => {
      const tabsMod = await import("../../../../js/achievements/ui/tabs.js");
      tabsMod.configureTabs({ getPanelEl: () => panelEl });

      // Build the two tab buttons + matching view containers so
      // setActiveTab has DOM to toggle.
      const tabsEl = document.createElement("div");
      tabsEl.className = "achievement-tabs";
      panelEl.appendChild(tabsEl);
      tabsEl.appendChild(
        tabsMod.buildTabButton("achievements", "Achievements", "achievements"),
      );
      tabsEl.appendChild(
        tabsMod.buildTabButton("activity", "Activity", "activity"),
      );

      // Activity view starts active, achievements view does not.
      const achievementsView = container; // already class .achievement-view-achievements
      const activityView = document.createElement("div");
      activityView.className =
        "achievement-view achievement-view-activity active";
      panelEl.querySelector(".achievement-body").appendChild(activityView);

      // Flip the active tab to activity so we can observe scrollToCard switching back.
      tabsMod.setActiveTab("activity");
      expect(achievementsView.classList.contains("active")).toBe(false);

      mod.renderSections(achievementsView);
      mod.scrollToCard("first-light");

      expect(tabsMod.getActiveTab()).toEqual("achievements");
      expect(achievementsView.classList.contains("active")).toBe(true);
    });

    it("no-ops when no matching card exists", () => {
      mod.renderSections(container);
      expect(() => mod.scrollToCard("nonexistent-id")).not.toThrow();
    });
  });

  describe("seen observer", () => {
    it("creates the observer once and reuses it on subsequent calls", () => {
      mod.createSeenObserver();
      expect(observerInstances).toHaveLength(1);
      mod.createSeenObserver();
      expect(observerInstances).toHaveLength(1);
    });

    it("marks a card seen after the dwell threshold of continuous intersection", () => {
      storage.unlock("first-light");
      mod.createSeenObserver();
      mod.renderSections(container);
      mod.observeUnseenCards();
      const observer = observerInstances[0];
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(observer.observed.has(card)).toBe(true);

      observer.cb([{ target: card, intersectionRatio: 1 }]);
      vi.advanceTimersByTime(PAST_DWELL_MS);

      expect(card.classList.contains("unseen")).toBe(false);
      expect(card.classList.contains("seen-fade")).toBe(true);
      expect(storage.isSeen("first-light")).toBe(true);
    });

    it("cancels the dwell timer when the card scrolls out before the threshold", () => {
      storage.unlock("first-light");
      mod.createSeenObserver();
      mod.renderSections(container);
      mod.observeUnseenCards();
      const observer = observerInstances[0];
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );

      observer.cb([{ target: card, intersectionRatio: 1 }]);
      vi.advanceTimersByTime(HALF_DWELL_MS);
      observer.cb([{ target: card, intersectionRatio: 0 }]);
      vi.advanceTimersByTime(PAST_DWELL_MS);

      expect(card.classList.contains("unseen")).toBe(true);
      expect(storage.isSeen("first-light")).toBe(false);
    });

    it("destroySeenObserver disconnects and clears dwell timers", () => {
      storage.unlock("first-light");
      mod.createSeenObserver();
      mod.renderSections(container);
      mod.observeUnseenCards();
      const observer = observerInstances[0];
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      observer.cb([{ target: card, intersectionRatio: 1 }]);

      mod.destroySeenObserver();
      vi.advanceTimersByTime(PAST_DWELL_MS);
      // The dwell timer was cancelled, so the card is still unseen.
      expect(storage.isSeen("first-light")).toBe(false);
    });
  });

  describe("markAllSeen", () => {
    it("clears the unseen class on every unlocked card", () => {
      storage.unlock("first-light");
      storage.unlock("cloud-reader");
      mod.renderSections(container);
      expect(
        container.querySelectorAll(".achievement-card.unseen").length,
      ).toBe(2);

      mod.markAllSeen();
      expect(
        container.querySelectorAll(".achievement-card.unseen").length,
      ).toBe(0);
      expect(storage.getUnseenCount()).toEqual(0);
    });
  });

  describe("updateMarkReadVisibility", () => {
    it("hides the mark-read button when unseen count is zero", () => {
      const btn = panelEl.querySelector(".achievement-mark-read");
      mod.updateMarkReadVisibility();
      expect(btn.style.display).toEqual("none");
    });

    it("shows the mark-read button when there are unseen unlocks", () => {
      storage.unlock("first-light");
      const btn = panelEl.querySelector(".achievement-mark-read");
      mod.updateMarkReadVisibility();
      expect(btn.style.display).toEqual("");
    });
  });

  describe("revealHints", () => {
    it("getRevealHints defaults to false", () => {
      expect(mod.getRevealHints()).toBe(false);
    });

    it("setRevealHints flips the flag and triggers a panel refresh", () => {
      mod.setRevealHints(true);
      expect(mod.getRevealHints()).toBe(true);
      expect(refreshPanelStub).toHaveBeenCalled();
    });
  });
});
