import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  TOAST_HOLD_MS,
  TOAST_RESUME_DELAY_MS,
  TOAST_SLIDE_OUT_MS,
  TOAST_STAGGER_MS,
  TOAST_MAX_VISIBLE,
} from "../../../../js/achievements/ui/toast.js";

// toast.js owns the toast queue, the shared container DOM, the pause/
// resume machinery, and the activation callout/pulse ring.  Each test
// resets the module so queue state, DOM, and injected callbacks start
// fresh.  We stub fireworks at import time because the toast flow
// fires burstFireworks(...) inside a setTimeout — real drawing isn't
// exercised here.

vi.mock("../../../../js/effects/fireworks.js", () => ({
  burstFireworks: vi.fn(),
  launchRocketFireworks: vi.fn(),
  rocketCountForTier: vi.fn(() => 1),
}));

// One past the cap so we have an active set plus a queued entry.
const QUEUE_OVERFLOW_COUNT = TOAST_MAX_VISIBLE + 1;
// Past-cap fill for destroy tests — confirms both active + queued
// state get cleaned up.
const PAST_CAP_FILL = TOAST_MAX_VISIBLE + 2;

describe("achievements/ui/toast", () => {
  let mod;

  const makeAchievement = (overrides = {}) => ({
    id: "sample-id",
    title: "Sample Title",
    description: "Sample description",
    set: "exploration",
    points: 1,
    hint: "click something",
    ...overrides,
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    document.body.innerHTML = "";
    mod = await import("../../../../js/achievements/ui/toast.js");
  });

  afterEach(() => {
    mod._resetForTests();
    vi.useRealTimers();
  });

  function getContainer() {
    return document.querySelector(".achievement-toast-container");
  }

  describe("rarityTierFor", () => {
    it("returns null for sub-epic point counts", async () => {
      const { POINT_TIERS } =
        await import("../../../../js/achievements/registry.js");
      expect(mod.rarityTierFor(POINT_TIERS.EPIC - 1)).toBeNull();
      expect(mod.rarityTierFor(POINT_TIERS.RARE)).toBeNull();
    });

    it("returns epic at the epic threshold and legendary at the legendary threshold", async () => {
      const { POINT_TIERS } =
        await import("../../../../js/achievements/registry.js");
      expect(mod.rarityTierFor(POINT_TIERS.EPIC)).toEqual("epic");
      expect(mod.rarityTierFor(POINT_TIERS.LEGENDARY - 1)).toEqual("epic");
      expect(mod.rarityTierFor(POINT_TIERS.LEGENDARY)).toEqual("legendary");
    });
  });

  describe("showCompletionShare", () => {
    it("shows a dismissible completion share card with a save action", () => {
      mod.showCompletionShare();
      const card = document.querySelector(".cloudlog-share");
      expect(card).not.toBeNull();
      expect(card.querySelector(".cloudlog-share-save")).not.toBeNull();
      const close = card.querySelector(".cloudlog-share-close");
      expect(close).not.toBeNull();
      close.click();
      expect(document.querySelector(".cloudlog-share")).toBeNull();
    });

    it("replaces a prior card instead of stacking", () => {
      mod.showCompletionShare();
      mod.showCompletionShare();
      expect(document.querySelectorAll(".cloudlog-share")).toHaveLength(1);
    });
  });

  describe("buildAchievementToast", () => {
    it("renders title, description, and points into toast structure", () => {
      const toast = mod.buildAchievementToast(
        makeAchievement({ title: "T", description: "D", points: 5 }),
      );
      expect(
        toast.querySelector(".achievement-toast-title").textContent,
      ).toEqual("T");
      expect(
        toast.querySelector(".achievement-toast-desc").textContent,
      ).toEqual("D");
      expect(toast.querySelector(".achievement-toast-pts").textContent).toEqual(
        "5",
      );
    });

    it("writes the hint onto the dataset when provided", () => {
      const toast = mod.buildAchievementToast(
        makeAchievement({ hint: "try again" }),
      );
      expect(toast.dataset.hint).toEqual("try again");
    });

    it("omits the dataset.hint when no hint is supplied", () => {
      const toast = mod.buildAchievementToast(
        makeAchievement({ hint: undefined }),
      );
      expect(toast.dataset.hint).toBeUndefined();
    });

    it("tags the toast with dataset.rarity at the epic and legendary thresholds", async () => {
      const { POINT_TIERS } =
        await import("../../../../js/achievements/registry.js");
      const epicToast = mod.buildAchievementToast(
        makeAchievement({ points: POINT_TIERS.EPIC }),
      );
      const legendaryToast = mod.buildAchievementToast(
        makeAchievement({ points: POINT_TIERS.LEGENDARY }),
      );
      const subToast = mod.buildAchievementToast(
        makeAchievement({ points: POINT_TIERS.RARE }),
      );
      expect(epicToast.dataset.rarity).toEqual("epic");
      expect(legendaryToast.dataset.rarity).toEqual("legendary");
      expect(subToast.dataset.rarity).toBeUndefined();
    });
  });

  describe("showToast", () => {
    it("creates the container lazily on first show", () => {
      expect(getContainer()).toBeNull();
      mod.showToast(makeAchievement());
      expect(getContainer()).not.toBeNull();
      expect(getContainer().children).toHaveLength(1);
    });

    it("queues toasts past the visibility cap and drains them on dismiss", () => {
      for (let i = 0; i < QUEUE_OVERFLOW_COUNT; i++) {
        mod.showToast(makeAchievement({ id: `a${i}`, title: `T${i}` }));
      }
      expect(
        getContainer().querySelectorAll(".achievement-toast"),
      ).toHaveLength(TOAST_MAX_VISIBLE);

      // Walk the dismiss → slide-out → stagger pipeline one stage at a
      // time so the next auto-dismiss cycle doesn't intrude before the
      // queued toast actually mounts.
      vi.advanceTimersByTime(TOAST_HOLD_MS);
      vi.advanceTimersByTime(TOAST_SLIDE_OUT_MS);
      vi.advanceTimersByTime(TOAST_STAGGER_MS);
      const titles = [
        ...getContainer().querySelectorAll(".achievement-toast-title"),
      ].map((el) => el.textContent);
      expect(titles).toContain(`T${QUEUE_OVERFLOW_COUNT - 1}`);
    });

    it("applies the set's accent color as a CSS custom property when present", () => {
      // Deep-sea is a theme set with a concrete color; exploration has
      // color: null and skips the property.  Both paths exist.
      mod.showToast(makeAchievement({ set: "deep-sea" }));
      const toast = getContainer().querySelector(".achievement-toast");
      expect(toast.style.getPropertyValue("--toast-accent")).toEqual("#00ffc8");
    });

    it("skips the accent property when the set has no color", () => {
      mod.showToast(makeAchievement({ set: "exploration" }));
      const toast = getContainer().querySelector(".achievement-toast");
      expect(toast.style.getPropertyValue("--toast-accent")).toEqual("");
    });
  });

  describe("wireToastClick", () => {
    it("invokes openPanel + scrollToCard when panel is closed", () => {
      const openPanel = vi.fn();
      const scrollToCard = vi.fn();
      mod.configureToasts({
        openPanel,
        isPanelOpen: () => false,
        scrollToCard,
        panelSlideMs: 0,
      });
      const toast = mod.buildAchievementToast(makeAchievement());
      mod.wireToastClick(toast, makeAchievement());
      toast.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      vi.runAllTimers();
      expect(openPanel).toHaveBeenCalledOnce();
      expect(scrollToCard).toHaveBeenCalledWith("sample-id");
    });

    it("skips openPanel when panel is already open", () => {
      const openPanel = vi.fn();
      const scrollToCard = vi.fn();
      mod.configureToasts({
        openPanel,
        isPanelOpen: () => true,
        scrollToCard,
        panelSlideMs: 0,
      });
      const toast = mod.buildAchievementToast(makeAchievement());
      mod.wireToastClick(toast, makeAchievement());
      toast.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(openPanel).not.toHaveBeenCalled();
      expect(scrollToCard).toHaveBeenCalledWith("sample-id");
    });
  });

  describe("wireRelockToastClick", () => {
    it("opens panel and delegates to the activity-scroll target", () => {
      const openPanel = vi.fn();
      const scrollToActivityEntryFor = vi.fn();
      mod.configureToasts({
        openPanel,
        isPanelOpen: () => false,
        scrollToActivityEntryFor,
        panelSlideMs: 0,
      });
      const ach = makeAchievement();
      const toast = mod.buildRelockToast(ach);
      mod.wireRelockToastClick(toast, ach);
      toast.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      vi.runAllTimers();
      expect(openPanel).toHaveBeenCalledOnce();
      expect(scrollToActivityEntryFor).toHaveBeenCalledWith(
        "sample-id",
        "achievement-relocked",
      );
    });

    it("skips openPanel when panel is already open", () => {
      const openPanel = vi.fn();
      const scrollToActivityEntryFor = vi.fn();
      mod.configureToasts({
        openPanel,
        isPanelOpen: () => true,
        scrollToActivityEntryFor,
        panelSlideMs: 0,
      });
      const ach = makeAchievement();
      const toast = mod.buildRelockToast(ach);
      mod.wireRelockToastClick(toast, ach);
      toast.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(openPanel).not.toHaveBeenCalled();
      expect(scrollToActivityEntryFor).toHaveBeenCalledWith(
        "sample-id",
        "achievement-relocked",
      );
    });
  });

  describe("showRelockToast", () => {
    it("renders a re-lock variant with locked icon and re-lock class", () => {
      mod.showRelockToast(makeAchievement({ title: "Ancient" }));
      const toast = getContainer().querySelector(".achievement-toast-relock");
      expect(toast).not.toBeNull();
      expect(
        toast.querySelector(".achievement-toast-title").textContent,
      ).toEqual("Re-locked: Ancient");
    });

    it("adds the .enter class so the entry animation can run", () => {
      mod.showRelockToast(makeAchievement());
      const toast = getContainer().querySelector(".achievement-toast-relock");
      expect(toast.classList.contains("enter")).toEqual(true);
    });
  });

  describe("showActivationToast", () => {
    it("appends a ribbon with the provided message and auto-removes it", () => {
      mod.showActivationToast("Cloudlog activated");
      const toast = document.querySelector(".achievement-activation-toast");
      expect(toast).not.toBeNull();
      expect(toast.textContent).toContain("Cloudlog activated");
      // After the full lifetime, the node should be gone.
      vi.runAllTimers();
      expect(
        document.querySelector(".achievement-activation-toast"),
      ).toBeNull();
    });
  });

  describe("showActivationPulse", () => {
    it("drops a pulse ring at the given coords and removes it after the animation", () => {
      mod.showActivationPulse(120, 80);
      const ring = document.querySelector(".achievement-pulse-ring");
      expect(ring).not.toBeNull();
      expect(ring.style.left).toEqual("120px");
      expect(ring.style.top).toEqual("80px");
      vi.runAllTimers();
      expect(document.querySelector(".achievement-pulse-ring")).toBeNull();
    });
  });

  describe("progress bar", () => {
    function getFill() {
      return getContainer().querySelector(".achievement-toast-progress-fill");
    }

    it("appends a progress track + fill to live toasts and starts the drain transition", () => {
      mod.showToast(makeAchievement());
      const fill = getFill();
      expect(fill).not.toBeNull();
      expect(fill.style.transition).toEqual(
        `transform ${TOAST_HOLD_MS}ms linear`,
      );
      expect(fill.style.transform).toEqual("scaleX(0)");
    });

    it("skips the progress bar on toasts rendered via buildAchievementToast alone", () => {
      const toast = mod.buildAchievementToast(makeAchievement());
      expect(toast.querySelector(".achievement-toast-progress")).toBeNull();
    });

    it("freezes the fill at the interpolated scale on hover", () => {
      mod.showToast(makeAchievement());
      const fill = getFill();
      const ELAPSED = TOAST_HOLD_MS / 4;
      vi.advanceTimersByTime(ELAPSED);

      getContainer().dispatchEvent(new MouseEvent("mouseenter"));
      // 1 - 0.25 = 0.75 remaining.
      expect(fill.style.transform).toEqual("scaleX(0.75)");
      expect(fill.style.transition).toEqual("none");
    });

    it("resumes drain from the frozen scale over the rescheduled delay", () => {
      mod.showToast(makeAchievement());
      const fill = getFill();
      const ELAPSED = TOAST_HOLD_MS / 4;
      vi.advanceTimersByTime(ELAPSED);

      getContainer().dispatchEvent(new MouseEvent("mouseenter"));
      getContainer().dispatchEvent(new MouseEvent("mouseleave"));

      // Remaining is well past the resume floor, so the drain matches
      // remaining exactly.
      const REMAINING = TOAST_HOLD_MS - ELAPSED;
      expect(fill.style.transition).toEqual(`transform ${REMAINING}ms linear`);
      expect(fill.style.transform).toEqual("scaleX(0)");
    });

    it("starts a full-duration drain on resume for a toast created while paused", () => {
      mod.showToast(makeAchievement({ id: "first" }));
      getContainer().dispatchEvent(new MouseEvent("mouseenter"));

      mod.showToast(makeAchievement({ id: "second" }));
      const fills = getContainer().querySelectorAll(
        ".achievement-toast-progress-fill",
      );
      const pausedFill = fills[fills.length - 1];
      expect(pausedFill.style.transition).toEqual("");

      getContainer().dispatchEvent(new MouseEvent("mouseleave"));
      expect(pausedFill.style.transition).toEqual(
        `transform ${TOAST_HOLD_MS}ms linear`,
      );
      expect(pausedFill.style.transform).toEqual("scaleX(0)");
    });

    it("extends the drain duration to the resume floor when hover lands near expiry", () => {
      mod.showToast(makeAchievement());
      const fill = getFill();
      const NEAR_EXPIRY = TOAST_HOLD_MS - TOAST_RESUME_DELAY_MS / 2;
      vi.advanceTimersByTime(NEAR_EXPIRY);

      getContainer().dispatchEvent(new MouseEvent("mouseenter"));
      getContainer().dispatchEvent(new MouseEvent("mouseleave"));

      expect(fill.style.transition).toEqual(
        `transform ${TOAST_RESUME_DELAY_MS}ms linear`,
      );
    });
  });

  describe("focus pause", () => {
    function getFill() {
      return getContainer().querySelector(".achievement-toast-progress-fill");
    }

    it("freezes the drain on focusin", () => {
      mod.showToast(makeAchievement());
      const fill = getFill();
      const ELAPSED = TOAST_HOLD_MS / 4;
      vi.advanceTimersByTime(ELAPSED);

      getContainer().dispatchEvent(new FocusEvent("focusin"));
      expect(fill.style.transition).toEqual("none");
      expect(fill.style.transform).toEqual("scaleX(0.75)");
    });

    it("resumes the drain on focusout when no other source is holding", () => {
      mod.showToast(makeAchievement());
      const fill = getFill();
      const ELAPSED = TOAST_HOLD_MS / 4;
      vi.advanceTimersByTime(ELAPSED);

      getContainer().dispatchEvent(new FocusEvent("focusin"));
      getContainer().dispatchEvent(
        new FocusEvent("focusout", { relatedTarget: null }),
      );

      const REMAINING = TOAST_HOLD_MS - ELAPSED;
      expect(fill.style.transition).toEqual(`transform ${REMAINING}ms linear`);
    });

    it("stays paused when only one of hover/focus releases", () => {
      mod.showToast(makeAchievement());
      const fill = getFill();
      vi.advanceTimersByTime(TOAST_HOLD_MS / 4);

      getContainer().dispatchEvent(new MouseEvent("mouseenter"));
      getContainer().dispatchEvent(new FocusEvent("focusin"));
      // Releasing hover while focus is still in shouldn't restart drain.
      getContainer().dispatchEvent(new MouseEvent("mouseleave"));

      expect(fill.style.transition).toEqual("none");
    });

    it("ignores focusout when focus moves to a descendant", () => {
      mod.showToast(makeAchievement());
      const fill = getFill();
      vi.advanceTimersByTime(TOAST_HOLD_MS / 4);

      getContainer().dispatchEvent(new FocusEvent("focusin"));
      // Synthesize focus moving from one toast to another inside.
      const child = getContainer().querySelector(".achievement-toast");
      getContainer().dispatchEvent(
        new FocusEvent("focusout", { relatedTarget: child }),
      );

      expect(fill.style.transition).toEqual("none");
    });
  });

  describe("queue counter", () => {
    function getCounter() {
      return document.querySelector(".achievement-toast-queue-counter");
    }

    it("does not render the counter while the queue is empty", () => {
      mod.showToast(makeAchievement({ id: "a0" }));
      expect(getCounter()).toBeNull();
    });

    it("renders +N more once queued toasts exceed the visible cap", () => {
      const QUEUED = 2;
      for (let i = 0; i < TOAST_MAX_VISIBLE + QUEUED; i++) {
        mod.showToast(makeAchievement({ id: `a${i}` }));
      }
      const counter = getCounter();
      expect(counter).not.toBeNull();
      expect(counter.textContent).toEqual(`+${QUEUED} more`);
    });

    it("clears the counter on destroyToastContainer", () => {
      const QUEUED = 2;
      for (let i = 0; i < TOAST_MAX_VISIBLE + QUEUED; i++) {
        mod.showToast(makeAchievement({ id: `a${i}` }));
      }
      expect(getCounter()).not.toBeNull();
      mod.destroyToastContainer();
      expect(getCounter()).toBeNull();
    });

    it("decrements as the queue drains and removes itself on empty", () => {
      // Queued past the cap so one drain cycle leaves at least one
      // still pending — otherwise the counter goes 0 in a single step.
      const QUEUED = TOAST_MAX_VISIBLE + 1;
      for (let i = 0; i < TOAST_MAX_VISIBLE + QUEUED; i++) {
        mod.showToast(makeAchievement({ id: `a${i}` }));
      }
      expect(getCounter().textContent).toEqual(`+${QUEUED} more`);

      vi.advanceTimersByTime(TOAST_HOLD_MS);
      vi.advanceTimersByTime(TOAST_SLIDE_OUT_MS);
      vi.advanceTimersByTime(TOAST_STAGGER_MS);
      const REMAINING_AFTER_ONE_CYCLE = QUEUED - TOAST_MAX_VISIBLE;
      expect(getCounter().textContent).toEqual(
        `+${REMAINING_AFTER_ONE_CYCLE} more`,
      );

      vi.advanceTimersByTime(TOAST_HOLD_MS);
      vi.advanceTimersByTime(TOAST_SLIDE_OUT_MS);
      vi.advanceTimersByTime(TOAST_STAGGER_MS);
      expect(getCounter()).toBeNull();
    });
  });

  describe("destroyToastContainer", () => {
    it("removes the container, clears timers, and resets queue state", () => {
      for (let i = 0; i < PAST_CAP_FILL; i++) {
        mod.showToast(makeAchievement({ id: `a${i}` }));
      }
      expect(getContainer()).not.toBeNull();
      mod.destroyToastContainer();
      expect(getContainer()).toBeNull();
      // After destroy, a subsequent show re-creates the container fresh
      // — if queue/active state had leaked, the new toast would silently
      // queue instead of rendering.
      mod.showToast(makeAchievement({ id: "fresh" }));
      expect(getContainer()).not.toBeNull();
      expect(getContainer().children).toHaveLength(1);
    });
  });
});
