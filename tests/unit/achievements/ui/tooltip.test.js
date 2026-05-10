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
});
