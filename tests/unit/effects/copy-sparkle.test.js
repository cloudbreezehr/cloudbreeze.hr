import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// copy-sparkle answers a real copy (a non-collapsed selection) with a burst
// of .copy-sparkle DOM at the selection rect and a text-copied achievement
// event. The event is the durable contract — it fires even under reduced
// motion, where the burst (a one-shot flourish) is skipped entirely.

const SELECTION_RECT = { left: 100, top: 50, width: 200, height: 20 };
const EMPTY_RECT = { left: 0, top: 0, width: 0, height: 0 };

describe("effects/copy-sparkle", () => {
  let mod;
  let stop;
  let reducedMotion;
  let selection;
  let events;
  let onAchievement;

  beforeEach(async () => {
    document.body.innerHTML = "";
    vi.resetModules();

    reducedMotion = false;
    window.matchMedia = vi.fn((query) => ({
      matches: query.includes("reduce") ? reducedMotion : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    // happy-dom doesn't implement Element.animate; the burst only needs it
    // to exist to spawn its particles.
    Element.prototype.animate = vi.fn(() => ({ onfinish: null }));

    selection = {
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => ({ getBoundingClientRect: () => SELECTION_RECT }),
    };
    document.getSelection = vi.fn(() => selection);

    events = [];
    onAchievement = (e) => events.push(e.detail.type);
    window.addEventListener("achievement", onAchievement);

    mod = await import("../../../js/effects/copy-sparkle.js");
    stop = mod.initCopySparkle();
  });

  afterEach(() => {
    if (stop) stop();
    window.removeEventListener("achievement", onAchievement);
    delete Element.prototype.animate;
    delete document.getSelection;
  });

  const copy = () =>
    document.dispatchEvent(new Event("copy", { bubbles: true }));

  it("sparkles at the selection and reports the copy", () => {
    copy();
    expect(events).toEqual(["text-copied"]);
    expect(document.querySelectorAll(".copy-sparkle").length).toBeGreaterThan(
      0,
    );
  });

  it("ignores a copy with nothing selected", () => {
    selection.isCollapsed = true;
    copy();
    expect(events).toEqual([]);
    expect(document.querySelector(".copy-sparkle")).toBeNull();
  });

  it("reduced motion: the event still fires, the burst is skipped", async () => {
    // motion.js reads matchMedia at import time — flip, then re-import.
    stop();
    stop = null;
    reducedMotion = true;
    vi.resetModules();
    mod = await import("../../../js/effects/copy-sparkle.js");
    stop = mod.initCopySparkle();

    copy();
    expect(events).toEqual(["text-copied"]);
    expect(document.querySelector(".copy-sparkle")).toBeNull();
  });

  it("stays quiet when the selection has no on-screen rect", () => {
    selection.getRangeAt = () => ({
      getBoundingClientRect: () => EMPTY_RECT,
    });
    copy();
    // The copy still counts; only the visual has nowhere to land.
    expect(events).toEqual(["text-copied"]);
    expect(document.querySelector(".copy-sparkle")).toBeNull();
  });

  it("scales the burst with the selection, up to a cap", () => {
    // Deterministic ranges so burst sizes compare cleanly.
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const burstFor = (width, height) => {
      selection.getRangeAt = () => ({
        getBoundingClientRect: () => ({ left: 10, top: 10, width, height }),
      });
      copy();
      const els = [...document.querySelectorAll(".copy-sparkle")];
      const sizes = els.map((el) => parseFloat(el.style.width));
      els.forEach((el) => el.remove());
      return { count: els.length, size: sizes[0] };
    };

    const word = burstFor(60, 18);
    const paragraph = burstFor(500, 220);
    // A paragraph outshines a word — more sparkles, bigger ones.
    expect(paragraph.count).toBeGreaterThan(word.count);
    expect(paragraph.size).toBeGreaterThan(word.size);

    // Past the cap the burst stops growing: two absurd select-alls of very
    // different sizes produce identical bursts.
    const selectAll = burstFor(2000, 4000);
    const biggerStill = burstFor(9000, 9000);
    expect(biggerStill.count).toEqual(selectAll.count);
    expect(biggerStill.size).toEqual(selectAll.size);

    Math.random.mockRestore();
  });
});
