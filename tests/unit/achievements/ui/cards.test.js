import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SEEN_DWELL_MS,
  INTRO_CARD_THRESHOLD,
} from "../../../../js/achievements/ui/cards.js";
import { POST_SETTLE_DELAY_MS } from "../../../../js/scroll-highlight.js";
import { ACHIEVEMENTS } from "../../../../js/achievements/registry.js";

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

// Sample achievements the rendering tests key off — asserting against the
// registry keeps the tests copy-agnostic. to-the-minute is the hidden sample (a
// guard test pins that trait); first-light is the plain visible one.
const TIME_WARP = ACHIEVEMENTS.find((a) => a.id === "to-the-minute");
const FIRST_LIGHT = ACHIEVEMENTS.find((a) => a.id === "first-light");

describe("achievements/ui/cards", () => {
  let mod;
  let storage;
  let container;
  let panelEl;
  let panelOpen;
  let refreshPanelStub;
  let scrollToActivityEntryForStub;
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
    scrollToActivityEntryForStub = vi.fn();

    mod = await import("../../../../js/achievements/ui/cards.js");
    storage = await import("../../../../js/achievements/storage.js");
    storage.load();

    mod.configureCards({
      getPanelEl: () => panelEl,
      isPanelOpen: () => panelOpen,
      refreshPanel: refreshPanelStub,
      scrollToActivityEntryFor: scrollToActivityEntryForStub,
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

    it("drops a set with nothing reachable on this device", () => {
      // Linked Skies is entirely requires:"multiwindow"; a touch-only device
      // has zero reachable there, so the section must not render at all
      // (rather than showing an empty "0 / 0" set).
      const hasLinkedSkies = () =>
        [...container.querySelectorAll(".achievement-set-name")].some((el) =>
          el.textContent.includes("Linked Skies"),
        );
      const origMatchMedia = window.matchMedia;

      // Hover-capable: multi-window achievements are reachable → set shows.
      window.matchMedia = vi.fn(() => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      }));
      container.innerHTML = "";
      mod.renderSections(container);
      expect(hasLinkedSkies()).toBe(true);

      // Touch-only ((hover: none)): device.js drops the multiwindow capability,
      // leaving the set with nothing reachable → hidden.
      window.matchMedia = vi.fn((query) => ({
        matches: query === "(hover: none)",
        addEventListener() {},
        removeEventListener() {},
      }));
      container.innerHTML = "";
      mod.renderSections(container);
      expect(hasLinkedSkies()).toBe(false);

      window.matchMedia = origMatchMedia;
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

    it("shows a re-earn tally on an achievement earned more than once (dev mode)", () => {
      document.body.classList.add("dev-active");
      storage.unlock("first-light");
      storage.bumpTrigger("first-light");
      storage.bumpTrigger("first-light");
      storage.bumpTrigger("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      const tally = card.querySelector(".achievement-card-tally");
      expect(tally).toBeTruthy();
      expect(tally.textContent).toBe("×3");
    });

    it("shows no tally when earned only once, even in dev mode", () => {
      document.body.classList.add("dev-active");
      storage.unlock("first-light");
      storage.bumpTrigger("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(card.querySelector(".achievement-card-tally")).toBeNull();
    });

    it("hides the tally unless the dev console is active", () => {
      storage.unlock("first-light");
      storage.bumpTrigger("first-light");
      storage.bumpTrigger("first-light"); // count 2, but no dev-active
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(card.querySelector(".achievement-card-tally")).toBeNull();

      // Turning dev mode on surfaces it on the next live refresh.
      document.body.classList.add("dev-active");
      mod.refreshDynamicCardState();
      expect(card.querySelector(".achievement-card-tally").textContent).toBe(
        "×2",
      );
    });

    it("skips the tally scan entirely when dev mode is off (no wasted queries)", () => {
      storage.unlock("first-light");
      storage.bumpTrigger("first-light");
      storage.bumpTrigger("first-light");
      mod.renderSections(container);
      const title = container
        .querySelector('.achievement-card[data-id="first-light"]')
        .querySelector(".achievement-card-title");
      const spy = vi.spyOn(title, "querySelector");
      mod.refreshDynamicCardState(); // dev off → tally half not entered
      expect(spy).not.toHaveBeenCalled();
    });

    it("live-updates card bits in place without a re-render (dev mode)", () => {
      document.body.classList.add("dev-active");
      storage.unlock("first-light");
      storage.bumpTrigger("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(card.querySelector(".achievement-card-tally")).toBeNull();

      // A repeat earn bumps the count; the in-place refresh should surface it
      // and grow it on further repeats.
      storage.bumpTrigger("first-light"); // now 2
      mod.refreshDynamicCardState();
      expect(card.querySelector(".achievement-card-tally").textContent).toBe(
        "×2",
      );

      storage.bumpTrigger("first-light"); // now 3
      mod.refreshDynamicCardState();
      expect(card.querySelector(".achievement-card-tally").textContent).toBe(
        "×3",
      );
    });

    it("live-updates a locked achievement's progress bar in place", () => {
      // Persistent (clicks-1000) is a continuous fill bar; its line shows N/M.
      storage.setCounter("totalClicks", 250);
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="committed"]',
      );
      const line = () => card.querySelector(".achievement-card-progress-text");
      const fill = () =>
        card.querySelector(".achievement-card-progress-bar-fill");
      expect(line().textContent).toBe("250/1000");
      expect(fill().style.width).toBe("25%");

      storage.setCounter("totalClicks", 900);
      mod.refreshDynamicCardState();
      expect(line().textContent).toBe("900/1000");
      expect(fill().style.width).toBe("90%");
    });

    it("keeps an open card current on any achievement event", async () => {
      document.body.classList.add("dev-active");
      storage.unlock("first-light");
      storage.bumpTrigger("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );

      storage.bumpTrigger("first-light"); // now 2
      // Any event, not a bespoke tally hook, drives the refresh — throttled, so
      // it lands after the window rather than synchronously per event.
      window.dispatchEvent(
        new CustomEvent("achievement", { detail: { type: "click" } }),
      );
      expect(card.querySelector(".achievement-card-tally")).toBeNull(); // not yet
      await vi.advanceTimersByTimeAsync(mod.LIVE_REFRESH_THROTTLE_MS);
      expect(card.querySelector(".achievement-card-tally").textContent).toBe(
        "×2",
      );
    });

    it("collapses a burst of events into a single throttled refresh", async () => {
      document.body.classList.add("dev-active");
      storage.unlock("first-light");
      storage.bumpTrigger("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      const title = card.querySelector(".achievement-card-title");
      const spy = vi.spyOn(title, "querySelector");

      // Ten events in quick succession before the window elapses.
      for (let i = 0; i < 10; i++) {
        storage.bumpTrigger("first-light");
        window.dispatchEvent(
          new CustomEvent("achievement", { detail: { type: "click" } }),
        );
      }
      expect(spy).not.toHaveBeenCalled(); // nothing painted mid-burst
      await vi.advanceTimersByTimeAsync(mod.LIVE_REFRESH_THROTTLE_MS);
      // Exactly one pass touched this card, not ten.
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("re-renders an open panel when the dev console toggles", () => {
      const dispatchDev = (type) =>
        window.dispatchEvent(
          new CustomEvent("achievement", { detail: { type } }),
        );
      refreshPanelStub.mockClear();
      dispatchDev("dev-console-open");
      dispatchDev("dev-console-close");
      expect(refreshPanelStub).toHaveBeenCalledTimes(2);
    });

    it("ignores a dev-console toggle when the panel is closed", () => {
      panelOpen = false;
      refreshPanelStub.mockClear();
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "dev-console-open" },
        }),
      );
      expect(refreshPanelStub).not.toHaveBeenCalled();
    });

    describe("bonus achievements (Almanac)", () => {
      // Core/bonus membership comes from the live registry so the set can
      // grow without rewriting counts here.
      const almanac = ACHIEVEMENTS.filter((a) => a.set === "almanac");
      const CORE = almanac.filter((a) => !a.bonus).map((a) => a.id);
      const BONUS = almanac.find((a) => a.bonus).id;

      it("counts the set as core-complete before any bonus", () => {
        CORE.forEach((id) => storage.unlock(id));
        expect(mod.setCountForSet("almanac")).toEqual({
          total: CORE.length,
          unlocked: CORE.length,
        });
      });

      it("lifts both sides when a bonus is earned", () => {
        [...CORE, BONUS].forEach((id) => storage.unlock(id));
        expect(mod.setCountForSet("almanac")).toEqual({
          total: CORE.length + 1,
          unlocked: CORE.length + 1,
        });
      });

      it("shows a gap when a core is missing but a bonus is earned", () => {
        // one core left unearned; a bonus earned lifts the total but not to full
        [...CORE.slice(0, -1), BONUS].forEach((id) => storage.unlock(id));
        expect(mod.setCountForSet("almanac")).toEqual({
          total: CORE.length + 1,
          unlocked: CORE.length,
        });
      });

      it("hides an unearned bonus card, reveals it once earned", () => {
        CORE.forEach((id) => storage.unlock(id));
        mod.renderSections(container);
        expect(
          container.querySelector(`.achievement-card[data-id="${BONUS}"]`),
        ).toBeNull();

        storage.unlock(BONUS);
        mod.renderSections(container);
        expect(
          container.querySelector(`.achievement-card[data-id="${BONUS}"]`),
        ).not.toBeNull();
      });
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

    it("marks a set complete once all its reachable achievements are unlocked", async () => {
      const { getReachableAchievements } =
        await import("../../../../js/achievements/registry.js");
      getReachableAchievements().forEach((a) => storage.unlock(a.id));
      mod.renderSections(container);
      const sections = container.querySelectorAll(".achievement-set");
      expect(sections.length).toBeGreaterThan(0);
      for (const s of sections) {
        expect(s.classList.contains("set-complete")).toBe(true);
        expect(s.querySelector(".achievement-set-count").textContent).toContain(
          "✓",
        );
      }
    });

    it("locked hidden achievements show ??? title and hidden-ach class at the default help level", () => {
      mod.renderSections(container);
      const hidden = container.querySelector(
        '.achievement-card.hidden-ach[data-id="to-the-minute"]',
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
        FIRST_LIGHT.title,
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

    it("filters cards live by the search query", () => {
      storage.unlock("first-light");
      mod.renderSections(container);
      const input = container.querySelector(".achievement-search-input");
      expect(input).not.toBeNull();
      input.value = "zzzznomatch";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const visible = [
        ...container.querySelectorAll(".achievement-card[data-id]"),
      ].filter((c) => !c.classList.contains("search-hidden"));
      expect(visible.length).toEqual(0);
      // Clearing the query restores everything.
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const restored = [
        ...container.querySelectorAll(".achievement-card[data-id]"),
      ].filter((c) => !c.classList.contains("search-hidden"));
      expect(restored.length).toBeGreaterThan(0);
    });

    it("dispatches panel-search once per query begun, not per keystroke", () => {
      mod.renderSections(container);
      const events = [];
      const listener = (e) => events.push(e.detail.type);
      window.addEventListener("achievement", listener);
      const input = container.querySelector(".achievement-search-input");

      const type = (value) => {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      };
      type("sk");
      type("sky");
      expect(events.filter((t) => t === "panel-search")).toHaveLength(1);

      // Clearing and typing again begins a new search.
      type("");
      type("moon");
      expect(events.filter((t) => t === "panel-search")).toHaveLength(2);

      // Whitespace alone is not a query.
      type("");
      type("   ");
      expect(events.filter((t) => t === "panel-search")).toHaveLength(2);

      window.removeEventListener("achievement", listener);
    });

    it("keeps search focus and caret across an unlock-driven rebuild", () => {
      document.body.appendChild(container);
      mod.renderSections(container);
      const input = container.querySelector(".achievement-search-input");
      input.value = "clo";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      input.setSelectionRange(2, 2);

      // Simulate the refresh path: re-render the same container in place.
      mod.renderSections(container);

      const rebuilt = container.querySelector(".achievement-search-input");
      expect(document.activeElement).toBe(rebuilt);
      expect(rebuilt.value).toBe("clo");
      expect(rebuilt.selectionStart).toBe(2);
      document.body.removeChild(container);
    });

    it("flags cards unlocked since the last panel close with just-unlocked", () => {
      // Stamp a close boundary in the past, then unlock after it.
      storage.setPref(storage.LAST_PANEL_CLOSE_PREF, 1000);
      vi.setSystemTime(new Date(5000));
      storage.unlock("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(card.classList.contains("just-unlocked")).toBe(true);
    });

    it("does not flag just-unlocked when there is no prior close stamp", () => {
      storage.unlock("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(card.classList.contains("just-unlocked")).toBe(false);
    });

    it("shakes a locked card on click instead of navigating", () => {
      mod.renderSections(container);
      const card = container.querySelector(
        ".achievement-card.locked[data-id], .achievement-card.hidden-ach[data-id]",
      );
      expect(card).not.toBeNull();
      card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(card.classList.contains("shake")).toBe(true);
    });

    it("tags cards whose hover will surface a hint with data-has-hint", () => {
      // first-light is non-hidden and has a hint — when locked, the hint is
      // gated behind the help level (so at the default "off" data-has-hint
      // stays off); when unlocked the hint is freely shown.
      storage.unlock("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(card.dataset.hasHint).toEqual("1");
    });

    it("omits data-has-hint when a locked non-hidden card has no surfaceable hint", () => {
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      // Locked + non-hidden + help level "off" → resolveHintText
      // returns null; no affordance should be advertised.
      expect(card.dataset.hasHint).toBeUndefined();
    });

    it("omits data-has-hint on hidden-locked cards at the default help level", () => {
      // Hidden cards only surface a hint (placeholder or real) at "clues"
      // or "hints"; with the default "off", hover would show nothing, so no
      // affordance should advertise otherwise.
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card.hidden-ach[data-id="to-the-minute"]',
      );
      expect(card.dataset.hasHint).toBeUndefined();
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

    it("raising the help level to clues re-renders hidden cards with real titles", () => {
      mod.renderSections(container);
      mod.setHelpLevel("clues");
      // setHelpLevel triggers a refresh through the stub; simulate by
      // re-rendering into a fresh container.
      container.replaceChildren();
      mod.renderSections(container);
      const hidden = container.querySelector(
        '.achievement-card[data-id="to-the-minute"]',
      );
      expect(
        hidden.querySelector(".achievement-card-title").textContent,
      ).toEqual(TIME_WARP.title);
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

    function curiousMindSegments() {
      const card = container.querySelector(
        '.achievement-card[data-id="curious-mind"]',
      );
      return card.querySelectorAll(".achievement-card-progress-bar-segment");
    }

    it("establishes the snapshot silently on first render (no just-filled)", () => {
      storage.unlock("first-light");
      storage.unlock("cloud-reader");
      mod.renderSections(container);
      const justFilled = container.querySelectorAll(
        '.achievement-card[data-id="curious-mind"] .achievement-card-progress-bar-segment.just-filled',
      );
      expect(justFilled.length).toEqual(0);
    });

    it("shines only the segment that ticks past the snapshot", () => {
      storage.unlock("first-light");
      storage.unlock("cloud-reader");
      mod.renderSections(container);

      storage.unlock("a-stillness");
      container.innerHTML = "";
      mod.renderSections(container);

      const segs = curiousMindSegments();
      const justFilled = [...segs].map((s) =>
        s.classList.contains("just-filled"),
      );
      expect(justFilled).toEqual([false, false, true, false, false]);
    });

    it("skips the shine when progress decreases (state reset)", () => {
      storage.unlock("first-light");
      storage.unlock("cloud-reader");
      storage.unlock("a-stillness");
      mod.renderSections(container);
      container.innerHTML = "";

      // Simulate a partial state reset by relocking past the snapshot.
      storage.relock("a-stillness");
      storage.relock("cloud-reader");
      mod.renderSections(container);

      const segs = curiousMindSegments();
      expect([...segs].some((s) => s.classList.contains("just-filled"))).toBe(
        false,
      );
    });

    it("does not re-shine on a render with unchanged progress", () => {
      storage.unlock("first-light");
      storage.unlock("cloud-reader");
      mod.renderSections(container);
      container.innerHTML = "";
      mod.renderSections(container);

      const segs = curiousMindSegments();
      expect([...segs].some((s) => s.classList.contains("just-filled"))).toBe(
        false,
      );
    });
  });

  describe("refreshCard", () => {
    // The refresh coalesces a same-tick cascade behind a microtask; one
    // checkpoint flushes it.
    const flushRefresh = () => Promise.resolve();

    it("no-ops when the panel is closed", async () => {
      mod.renderSections(container);
      panelOpen = false;
      storage.unlock("first-light");
      mod.refreshCard("first-light");
      await flushRefresh();
      // Still locked, and no refresh was triggered while closed.
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(card.classList.contains("unlocked")).toBe(false);
      expect(refreshPanelStub).not.toHaveBeenCalled();
    });

    it("refreshes the panel, then shines the freshly-rendered card in place", async () => {
      // A prior close stamp means the rebuilt card would get the entrance
      // reveal; refreshCard should strip it and play the shine instead.
      storage.setPref(storage.LAST_PANEL_CLOSE_PREF, Date.now() - 1000);
      mod.renderSections(container);
      // The rebuild is what promotes the card to unlocked; wire the stub to it.
      refreshPanelStub.mockImplementation(() => mod.renderSections(container));

      storage.unlock("first-light");
      mod.refreshCard("first-light");
      await flushRefresh();

      expect(refreshPanelStub).toHaveBeenCalled();
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(card.classList.contains("unlocked")).toBe(true);
      expect(card.classList.contains("shine")).toBe(true);
      // Lit up in place rather than re-entering.
      expect(card.classList.contains("just-unlocked")).toBe(false);
    });

    it("refreshes the panel even when the card isn't currently rendered", async () => {
      // Don't renderSections — the card won't exist; the counts still refresh.
      storage.unlock("first-light");
      mod.refreshCard("first-light");
      await flushRefresh();
      expect(refreshPanelStub).toHaveBeenCalled();
    });

    it("coalesces a same-tick unlock cascade into one rebuild, shining every card", async () => {
      mod.renderSections(container);
      refreshPanelStub.mockImplementation(() => mod.renderSections(container));

      storage.unlock("first-light");
      storage.unlock("stargazer");
      mod.refreshCard("first-light");
      mod.refreshCard("stargazer");
      await flushRefresh();

      expect(refreshPanelStub).toHaveBeenCalledOnce();
      for (const id of ["first-light", "stargazer"]) {
        const card = container.querySelector(
          `.achievement-card[data-id="${id}"]`,
        );
        expect(card.classList.contains("shine")).toBe(true);
      }
    });
  });

  describe("unlocked card click", () => {
    it('tags unlocked cards with role="button" so the custom cursor expands over them', () => {
      storage.unlock("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      expect(card.getAttribute("role")).toEqual("button");
    });

    it("triggers the pop animation by adding the .clicked class", () => {
      storage.unlock("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      card.dispatchEvent(new Event("click", { bubbles: true }));
      expect(card.classList.contains("clicked")).toBe(true);
    });

    it("routes to the matching activity-log entry", () => {
      storage.unlock("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      card.dispatchEvent(new Event("click", { bubbles: true }));
      expect(scrollToActivityEntryForStub).toHaveBeenCalledWith(
        "first-light",
        "achievement-unlocked",
      );
    });

    it("does not tag locked cards as clickable", () => {
      mod.renderSections(container);
      const locked = container.querySelector(
        ".achievement-card.locked[data-id]",
      );
      expect(locked).not.toBeNull();
      expect(locked.getAttribute("role")).toBeNull();
    });

    it("timestamp click toggles mode without bubbling to the card", () => {
      storage.unlock("first-light");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="first-light"]',
      );
      const timeEl = card.querySelector(".achievement-card-time");
      timeEl.dispatchEvent(new Event("click", { bubbles: true }));
      // Timestamp toggle is the only effect — the card's
      // scroll-to-activity must NOT fire from the same click.
      expect(scrollToActivityEntryForStub).not.toHaveBeenCalled();
    });

    it("keeps the timestamp out of the tab order and role-free inside the card button", () => {
      // ARIA forbids interactive descendants inside role="button" — the
      // timestamp stays a plain pointer affordance.
      storage.unlock("first-light");
      mod.renderSections(container);
      const timeEl = container.querySelector(
        '.achievement-card[data-id="first-light"] .achievement-card-time',
      );
      expect(timeEl.getAttribute("role")).toBeNull();
      expect(timeEl.hasAttribute("tabindex")).toBe(false);
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

    it("fires an 'All caught up' confirmation toast when something was unseen", () => {
      storage.unlock("first-light");
      mod.renderSections(container);
      mod.markAllSeen();
      const toast = document.querySelector(".achievement-activation-toast");
      expect(toast).not.toBeNull();
      expect(toast.textContent).toContain("All caught up");
    });

    it("does not fire a toast when there was nothing unseen", () => {
      mod.renderSections(container);
      mod.markAllSeen();
      expect(
        document.querySelector(".achievement-activation-toast"),
      ).toBeNull();
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

  describe("help level", () => {
    it("keys the hidden-gating tests off a genuinely hidden achievement", () => {
      expect(TIME_WARP.hidden).toBe(true);
    });

    it("getHelpLevel defaults to off", () => {
      expect(mod.getHelpLevel()).toBe("off");
    });

    it("setHelpLevel changes the level and triggers a panel refresh", () => {
      mod.setHelpLevel("hints");
      expect(mod.getHelpLevel()).toBe("hints");
      expect(refreshPanelStub).toHaveBeenCalled();
    });

    it("setHelpLevel ignores an unknown level", () => {
      mod.setHelpLevel("bogus");
      expect(mod.getHelpLevel()).toBe("off");
    });

    function hoverHiddenTooltip() {
      const card = container.querySelector(
        '.achievement-card[data-id="to-the-minute"]',
      );
      card.dispatchEvent(new MouseEvent("mouseenter"));
      return document.querySelector(".achievement-tooltip");
    }

    it("'clues' reveals a hidden achievement's flavor but withholds the how-to", () => {
      mod.setHelpLevel("clues");
      mod.renderSections(container);
      const card = container.querySelector(
        '.achievement-card[data-id="to-the-minute"]',
      );
      expect(card.querySelector(".achievement-card-desc").textContent).toEqual(
        TIME_WARP.description,
      );
      // Hovering surfaces only the placeholder, never the instruction.
      expect(hoverHiddenTooltip().textContent).toEqual(
        "Hidden — unlock to reveal the hint",
      );
    });

    it("'hints' surfaces the how-to hint on a hidden achievement", () => {
      mod.setHelpLevel("hints");
      mod.renderSections(container);
      expect(hoverHiddenTooltip().textContent).toEqual(TIME_WARP.hint);
    });
  });
});
