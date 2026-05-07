import { describe, it, expect } from "vitest";
import * as Layers from "../../js/layers.js";

// These tests protect the invariant described in the layers.js comment header:
// "ranges like HTTP status codes — pick from your range, never invent outside it."
// A mistake would be silent at runtime (wrong stacking order) but breaks UX —
// better to catch at test time.

describe("z-index layer registry", () => {
  it("background layers stay below page content", () => {
    expect(Layers.Z_RAIN_GLASS).toBeLessThan(Layers.Z_PAPER_INK);
  });

  it("page content stays below mode effects", () => {
    expect(Layers.Z_PAPER_INK).toBeLessThan(Layers.Z_MODE_FLASH);
  });

  it("mode effects stay below panels and HUDs", () => {
    expect(Layers.Z_MODE_FLASH).toBeLessThan(Layers.Z_MODE_HISTORY_HUD);
  });

  it("panels stay below dev tools", () => {
    expect(Layers.Z_MODE_HISTORY_HUD).toBeLessThan(Layers.Z_DEV_CONSOLE);
  });

  it("dev console stays below its own tooltip", () => {
    expect(Layers.Z_DEV_CONSOLE).toBeLessThan(Layers.Z_DEV_TOOLTIP);
  });

  it("dev tooltip stays below toasts/fireworks", () => {
    expect(Layers.Z_DEV_TOOLTIP).toBeLessThan(Layers.Z_FIREWORKS);
  });

  it("every exported layer falls in its documented range", () => {
    const ranges = [
      { name: "Z_RAIN_GLASS", val: Layers.Z_RAIN_GLASS, min: 0, max: 9 },
      { name: "Z_PAPER_INK", val: Layers.Z_PAPER_INK, min: 10, max: 49 },
      { name: "Z_MODE_FLASH", val: Layers.Z_MODE_FLASH, min: 100, max: 199 },
      {
        name: "Z_MODE_HISTORY_HUD",
        val: Layers.Z_MODE_HISTORY_HUD,
        min: 300,
        max: 399,
      },
      { name: "Z_DEV_CONSOLE", val: Layers.Z_DEV_CONSOLE, min: 400, max: 499 },
      { name: "Z_DEV_TOOLTIP", val: Layers.Z_DEV_TOOLTIP, min: 400, max: 499 },
      { name: "Z_FIREWORKS", val: Layers.Z_FIREWORKS, min: 500, max: 599 },
    ];
    for (const { name, val, min, max } of ranges) {
      expect(val, name).toBeGreaterThanOrEqual(min);
      expect(val, name).toBeLessThanOrEqual(max);
    }
  });
});
