import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SEEN_DWELL_MS,
  INTRO_CARD_THRESHOLD,
} from "../../../../js/achievements/ui/cards.js";
import { POST_SETTLE_DELAY_MS } from "../../../../js/scroll-highlight.js";

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
    it("renders a section per non-theme set plus any theme sets with unlocks", () => {
      mod.renderSections(container);
      const sections = container.querySelectorAll(".achievement-set");
      // Non-theme sets are always shown: exploration, mastery, meta.
      // Theme sets appear only when at least one of their achievements
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

    it("brightens every theme set whose theme is active when themes stack", () => {
      // Two theme sets present, both with at least one unlock so they
      // render.  Both themes active → neither set should carry
      // .dimmed (any one-of-N stacked theme keeps its set bright).
      storage.unlock("the-depths");
      storage.unlock("first-frost");
      document.body.classList.add("deep-sea", "frozen");

      mod.renderSections(container);

      const sections = container.querySelectorAll(".achievement-set");
      const findSection = (label) =>
        Array.from(sections).find((s) => s.textContent.includes(label));
      expect(findSection("Deep Sea").classList.contains("dimmed")).toBe(false);
      expect(findSection("Frozen").classList.contains("dimmed")).toBe(false);
    });

    it("dims a theme set whose theme is not in the active stack", () => {
      storage.unlock("the-depths");
      storage.unlock("first-frost");
      document.body.classList.add("deep-sea");

      mod.renderSections(container);

      const sections = container.querySelectorAll(".achievement-set");
      const findSection = (label) =>
        Array.from(sections).find((s) => s.textContent.includes(label));
      expect(findSection("Deep Sea").classList.contains("dimmed")).toBe(false);
      expect(findSection("Frozen").classList.contains("dimmed")).toBe(true);
    });

    it("tags theme sections with data-set-id", () => {
      storage.unlock("the-depths");
      mod.renderSections(container);
      const themed = container.querySelector(
        '.achievement-set[data-set-id="deep-sea"]',
      );
      expect(themed).not.toBeNull();
    });

    it("live-updates dimming on theme-activate without re-rendering", () => {
      storage.unlock("the-depths");
      storage.unlock("first-frost");
      mod.renderSections(container);

      const findSection = (label) =>
        Array.from(container.querySelectorAll(".achievement-set")).find((s) =>
          s.textContent.includes(label),
        );
      const deepSea = findSection("Deep Sea");
      const frozen = findSection("Frozen");
      expect(deepSea.classList.contains("dimmed")).toBe(true);
      expect(frozen.classList.contains("dimmed")).toBe(true);

      document.body.classList.add("frozen");
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "theme-activate", theme: "frozen" },
        }),
      );

      // Same nodes (no re-render) — frozen flipped bright, deep-sea
      // stays dimmed.
      expect(findSection("Frozen")).toBe(frozen);
      expect(frozen.classList.contains("dimmed")).toBe(false);
      expect(deepSea.classList.contains("dimmed")).toBe(true);
    });

    it("live-updates dimming on theme-deactivate", () => {
      storage.unlock("the-depths");
      document.body.classList.add("deep-sea");
      mod.renderSections(container);

      const deepSea = container.querySelector(
        '.achievement-set[data-set-id="deep-sea"]',
      );
      expect(deepSea.classList.contains("dimmed")).toBe(false);

      document.body.classList.remove("deep-sea");
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "theme-deactivate", theme: "deep-sea" },
        }),
      );

      expect(deepSea.classList.contains("dimmed")).toBe(true);
    });

    it("ignores non-theme achievement events when refreshing dimming", () => {
      storage.unlock("the-depths");
      document.body.classList.add("deep-sea");
      mod.renderSections(container);

      const deepSea = container.querySelector(
        '.achievement-set[data-set-id="deep-sea"]',
      );
      expect(deepSea.classList.contains("dimmed")).toBe(false);

      // Remove the class but dispatch an unrelated event — dimming
      // should NOT update until a real theme event fires.
      document.body.classList.remove("deep-sea");
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "panel-open" },
        }),
      );
      expect(deepSea.classList.contains("dimmed")).toBe(false);
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

  describe("progress bar", () => {
    it("renders one segment per unit when total is small", () => {
      // dusk-and-dawn → progressKey theme-toggles-3 (total = 3).
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="dusk-and-dawn"]',
      );
      const wrap = card.querySelector(".achievement-card-progress-bar-wrap");
      expect(wrap).not.toBeNull();
      expect(wrap.classList.contains("segmented")).toBe(true);
      const segments = wrap.querySelectorAll(
        ".achievement-card-progress-bar-segment",
      );
      expect(segments.length).toEqual(3);
    });

    it("paints the .filled class on segments matching the collected count", () => {
      // Unlock 3 unrelated achievements so curious-mind (unlocks-5) reads 3/5.
      storage.unlock("first-light");
      storage.unlock("cloud-reader");
      storage.unlock("a-stillness");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="curious-mind"]',
      );
      const wrap = card.querySelector(".achievement-card-progress-bar-wrap");
      const segments = wrap.querySelectorAll(
        ".achievement-card-progress-bar-segment",
      );
      expect(segments.length).toEqual(5);
      const filled = wrap.querySelectorAll(
        ".achievement-card-progress-bar-segment.filled",
      ).length;
      expect(filled).toEqual(3);
    });

    it("falls back to a smooth fill when total exceeds the segmented threshold", () => {
      // dedicated → progressKey unlocks-15 (total = 15, above threshold).
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="dedicated"]',
      );
      const wrap = card.querySelector(".achievement-card-progress-bar-wrap");
      expect(wrap).not.toBeNull();
      expect(wrap.classList.contains("segmented")).toBe(false);
      expect(
        wrap.querySelectorAll(".achievement-card-progress-bar-segment").length,
      ).toEqual(0);
      expect(
        wrap.querySelector(".achievement-card-progress-bar-fill"),
      ).not.toBeNull();
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

    it("renders the timestamp + inline progress identically to a fresh paint", async () => {
      // Pick an achievement with a progressKey so the inline count
      // path is exercised, and seed enough state that the count is
      // non-zero.
      const ach = "curious-mind"; // progressKey: unlocks-5
      // unlock 3 unrelated achievements to populate countUnlocks
      storage.unlock("first-light");
      storage.unlock("cloud-reader");
      storage.unlock("a-stillness");
      mod.renderSections(container);

      // Reference DOM from a fresh render, after unlocking the target.
      storage.unlock(ach);
      container.replaceChildren();
      mod.renderSections(container);
      const referenceTime = container
        .querySelector(`.achievement-card[data-id="${ach}"]`)
        .querySelector(".achievement-card-time").outerHTML;

      // Now simulate the in-place refresh path: re-render in the locked
      // state, then unlock and call refreshCard.
      storage.reset();
      storage.unlock("first-light");
      storage.unlock("cloud-reader");
      storage.unlock("a-stillness");
      container.replaceChildren();
      mod.renderSections(container);
      storage.unlock(ach);
      mod.refreshCard(ach);

      const refreshedTime = container
        .querySelector(`.achievement-card[data-id="${ach}"]`)
        .querySelector(".achievement-card-time").outerHTML;
      expect(refreshedTime).toEqual(referenceTime);
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
