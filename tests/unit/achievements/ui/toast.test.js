import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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
  });

  describe("showToast", () => {
    it("creates the container lazily on first show", () => {
      expect(getContainer()).toBeNull();
      mod.showToast(makeAchievement());
      expect(getContainer()).not.toBeNull();
      expect(getContainer().children).toHaveLength(1);
    });

    it("queues toasts past TOAST_MAX_VISIBLE (3) and drains them on dismiss", () => {
      // Four unlocks — first three show, fourth waits in the queue.
      for (let i = 0; i < 4; i++) {
        mod.showToast(makeAchievement({ id: `a${i}`, title: `T${i}` }));
      }
      expect(getContainer().children).toHaveLength(3);

      // Auto-dismiss (TOAST_HOLD_MS = 4000) triggers the exit animation
      // (TOAST_SLIDE_OUT_MS = 300), which on completion schedules the
      // queued toast with a stagger (TOAST_STAGGER_MS = 200).  Advance
      // step-by-step so we don't run into the next auto-dismiss cycle.
      vi.advanceTimersByTime(4000); // dismiss #1 fires
      vi.advanceTimersByTime(300); // slide-out completes, stagger scheduled
      vi.advanceTimersByTime(200); // stagger fires, showToast(T3) runs
      const titles = [
        ...getContainer().querySelectorAll(".achievement-toast-title"),
      ].map((el) => el.textContent);
      expect(titles).toContain("T3");
    });

    it("applies the set's accent color as a CSS custom property when present", () => {
      // Deep-sea is a mode set with a concrete color; exploration has
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
      const setActiveTab = vi.fn();
      mod.configureToasts({
        openPanel,
        isPanelOpen: () => false,
        scrollToCard,
        setActiveTab,
        panelSlideMs: 0,
      });
      const toast = mod.buildAchievementToast(makeAchievement());
      mod.wireToastClick(toast, makeAchievement());
      toast.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      vi.runAllTimers();
      expect(openPanel).toHaveBeenCalledOnce();
      expect(setActiveTab).toHaveBeenCalledWith("achievements");
      expect(scrollToCard).toHaveBeenCalledWith("sample-id");
    });

    it("skips openPanel when panel is already open", () => {
      const openPanel = vi.fn();
      const scrollToCard = vi.fn();
      const setActiveTab = vi.fn();
      mod.configureToasts({
        openPanel,
        isPanelOpen: () => true,
        scrollToCard,
        setActiveTab,
        panelSlideMs: 0,
      });
      const toast = mod.buildAchievementToast(makeAchievement());
      mod.wireToastClick(toast, makeAchievement());
      toast.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(openPanel).not.toHaveBeenCalled();
      expect(scrollToCard).toHaveBeenCalledWith("sample-id");
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

  describe("toastContainerContains", () => {
    it("returns false before the container exists", () => {
      expect(mod.toastContainerContains(document.body)).toBe(false);
    });

    it("returns true for a toast element inside the container", () => {
      mod.showToast(makeAchievement());
      const toast = getContainer().querySelector(".achievement-toast");
      expect(mod.toastContainerContains(toast)).toBe(true);
    });

    it("returns false for a node outside the container", () => {
      mod.showToast(makeAchievement());
      const orphan = document.createElement("div");
      document.body.appendChild(orphan);
      expect(mod.toastContainerContains(orphan)).toBe(false);
    });
  });

  describe("destroyToastContainer", () => {
    it("removes the container DOM", () => {
      mod.showToast(makeAchievement());
      expect(getContainer()).not.toBeNull();
      mod.destroyToastContainer();
      expect(getContainer()).toBeNull();
    });

    it("lets a subsequent show re-create the container", () => {
      mod.showToast(makeAchievement({ id: "a0" }));
      mod.destroyToastContainer();
      mod.showToast(makeAchievement({ id: "fresh" }));
      expect(getContainer()).not.toBeNull();
    });
  });
});
