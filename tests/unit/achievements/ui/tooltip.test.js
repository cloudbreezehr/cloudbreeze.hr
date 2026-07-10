import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// tooltip.js owns a singleton DOM node.  Reset modules so each test
// starts without a leftover tooltip attached from a prior run.

describe("achievements/ui/tooltip", () => {
  let mod;
  let anchor;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = "";
    mod = await import("../../../../js/achievements/ui/tooltip.js");
    anchor = document.createElement("button");
    anchor.textContent = "anchor";
    // Layout stub so getBoundingClientRect returns sensible numbers in
    // happy-dom.  Without this every rect is zeros and the position
    // math can't be asserted.
    anchor.getBoundingClientRect = () => ({
      top: 100,
      bottom: 120,
      left: 50,
      right: 80,
      width: 30,
      height: 20,
      x: 50,
      y: 100,
      toJSON() {
        return {};
      },
    });
    document.body.appendChild(anchor);
  });

  afterEach(() => {
    mod._resetForTests();
  });

  function getTooltip() {
    return document.querySelector(".achievement-tooltip");
  }

  it("creates a tooltip element on first show", () => {
    expect(getTooltip()).toBeNull();
    mod.showHintTooltip(anchor, "hello", false);
    expect(getTooltip()).not.toBeNull();
  });

  it("writes the hint text into the tooltip", () => {
    mod.showHintTooltip(anchor, "try triple-clicking", false);
    expect(getTooltip().textContent).toEqual("try triple-clicking");
  });

  it("reuses the same tooltip DOM across shows", () => {
    mod.showHintTooltip(anchor, "one", false);
    const first = getTooltip();
    mod.showHintTooltip(anchor, "two", false);
    expect(getTooltip()).toBe(first);
    expect(first.textContent).toEqual("two");
  });

  it("adds the visible class on show and removes it on hide", () => {
    mod.showHintTooltip(anchor, "x", false);
    expect(getTooltip().classList.contains("visible")).toBe(true);
    mod.hideHintTooltip();
    expect(getTooltip().classList.contains("visible")).toBe(false);
  });

  it("hideHintTooltip is a no-op when the tooltip was never shown", () => {
    expect(() => mod.hideHintTooltip()).not.toThrow();
    expect(getTooltip()).toBeNull();
  });

  it("positions below the anchor by default", () => {
    mod.showHintTooltip(anchor, "x", false);
    const tip = getTooltip();
    // anchor rect: top=100 bottom=120; below places at bottom + offset
    expect(tip.style.top).toEqual("126px");
    expect(tip.style.transform).toContain("translateY(0)");
  });

  it("positions above the anchor when preferAbove is true", () => {
    mod.showHintTooltip(anchor, "x", true);
    const tip = getTooltip();
    // anchor top=100; above places at top - offset
    expect(tip.style.top).toEqual("94px");
    expect(tip.style.transform).toContain("translateY(-100%)");
  });

  it("centers horizontally on the anchor's midpoint", () => {
    mod.showHintTooltip(anchor, "x", false);
    const tip = getTooltip();
    // midpoint of left=50..right=80 is 65
    expect(tip.style.left).toEqual("65px");
  });

  it("shifts inward when the centered tooltip would clip the right edge", () => {
    const TIP_WIDTH = 300;
    // Anchor at the far-right edge of the viewport — centered placement
    // would overflow.
    anchor.getBoundingClientRect = () => ({
      top: 100,
      bottom: 120,
      left: window.innerWidth - 40,
      right: window.innerWidth - 10,
      width: 30,
      height: 20,
      x: window.innerWidth - 40,
      y: 100,
      toJSON: () => ({}),
    });
    mod.showHintTooltip(anchor, "would overflow", false);
    const tip = getTooltip();
    // Stub the tip's measured rect so the clamp branch fires.  The
    // centered position is at anchor mid (innerWidth - 25); a tip
    // TIP_WIDTH wide spans (anchor mid - TIP_WIDTH/2) to (anchor mid
    // + TIP_WIDTH/2), with the right edge past innerWidth.
    tip.getBoundingClientRect = () => {
      const center = window.innerWidth - 25;
      return {
        left: center - TIP_WIDTH / 2,
        right: center + TIP_WIDTH / 2,
        top: 100,
        bottom: 130,
        width: TIP_WIDTH,
        height: 30,
        x: center - TIP_WIDTH / 2,
        y: 100,
        toJSON: () => ({}),
      };
    };
    // Re-show to force re-measurement against the stubbed rect.
    mod.showHintTooltip(anchor, "would overflow", false);
    // After the clamp, the new left should pull the tooltip back so
    // its right edge sits at innerWidth - margin.  Center → left value
    // adjusts by the overflow amount.
    const finalLeft = parseFloat(tip.style.left);
    expect(finalLeft).toBeLessThan(window.innerWidth - 25);
  });

  it("shifts inward when the centered tooltip would clip the left edge", () => {
    const TIP_WIDTH = 300;
    // Anchor at the far-left edge of the viewport — centered placement
    // would extend past the left edge.
    anchor.getBoundingClientRect = () => ({
      top: 100,
      bottom: 120,
      left: 10,
      right: 40,
      width: 30,
      height: 20,
      x: 10,
      y: 100,
      toJSON: () => ({}),
    });
    mod.showHintTooltip(anchor, "would overflow", false);
    const tip = getTooltip();
    tip.getBoundingClientRect = () => {
      const center = 25; // anchor midpoint
      return {
        left: center - TIP_WIDTH / 2,
        right: center + TIP_WIDTH / 2,
        top: 100,
        bottom: 130,
        width: TIP_WIDTH,
        height: 30,
        x: center - TIP_WIDTH / 2,
        y: 100,
        toJSON: () => ({}),
      };
    };
    mod.showHintTooltip(anchor, "would overflow", false);
    // Clamp should push the anchor rightward so the tooltip's left
    // edge clears the viewport edge with the configured margin.
    const finalLeft = parseFloat(tip.style.left);
    expect(finalLeft).toBeGreaterThan(25);
  });
});
