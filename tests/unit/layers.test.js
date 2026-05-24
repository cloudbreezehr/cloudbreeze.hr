import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  LAYERS,
  injectLayerVars,
  Z_RAIN_GLASS,
  Z_PAPER_INK,
  Z_THEME_FLASH,
  Z_THEME_HISTORY_HUD,
  Z_DEV_CONSOLE,
  Z_DEV_TOOLTIP,
  Z_FIREWORKS,
} from "../../js/layers.js";

// These tests protect the invariant described in the layers.js comment header:
// "ranges like HTTP status codes — pick from your range, never invent outside it."
// A mistake would be silent at runtime (wrong stacking order) but breaks UX —
// better to catch at test time.

describe("z-index layer registry", () => {
  it("background layers stay below page content", () => {
    expect(Z_RAIN_GLASS).toBeLessThan(Z_PAPER_INK);
  });

  it("page content stays below theme effects", () => {
    expect(Z_PAPER_INK).toBeLessThan(Z_THEME_FLASH);
  });

  it("theme effects stay below panels and HUDs", () => {
    expect(Z_THEME_FLASH).toBeLessThan(Z_THEME_HISTORY_HUD);
  });

  it("panels stay below dev tools", () => {
    expect(Z_THEME_HISTORY_HUD).toBeLessThan(Z_DEV_CONSOLE);
  });

  it("dev console stays below its own tooltip", () => {
    expect(Z_DEV_CONSOLE).toBeLessThan(Z_DEV_TOOLTIP);
  });

  it("dev tooltip stays below toasts/fireworks", () => {
    expect(Z_DEV_TOOLTIP).toBeLessThan(Z_FIREWORKS);
  });

  it("every exported layer falls in its documented range", () => {
    const ranges = [
      { name: "Z_RAIN_GLASS", val: Z_RAIN_GLASS, min: 0, max: 9 },
      { name: "Z_PAPER_INK", val: Z_PAPER_INK, min: 10, max: 49 },
      { name: "Z_THEME_FLASH", val: Z_THEME_FLASH, min: 100, max: 199 },
      {
        name: "Z_THEME_HISTORY_HUD",
        val: Z_THEME_HISTORY_HUD,
        min: 300,
        max: 399,
      },
      { name: "Z_DEV_CONSOLE", val: Z_DEV_CONSOLE, min: 400, max: 499 },
      { name: "Z_DEV_TOOLTIP", val: Z_DEV_TOOLTIP, min: 400, max: 499 },
      { name: "Z_FIREWORKS", val: Z_FIREWORKS, min: 500, max: 599 },
    ];
    for (const { name, val, min, max } of ranges) {
      expect(val, name).toBeGreaterThanOrEqual(min);
      expect(val, name).toBeLessThanOrEqual(max);
    }
  });

  it("every entry in the LAYERS map is in some documented range", () => {
    // Catches a future entry that's typoed outside any range.
    const documentedRanges = [
      [0, 9],
      [10, 49],
      [50, 99],
      [100, 199],
      [200, 299],
      [300, 399],
      [400, 499],
      [500, 599],
      [600, 699],
      [700, 799],
      [9000, 9999],
    ];
    for (const [name, value] of Object.entries(LAYERS)) {
      const inRange = documentedRanges.some(
        ([lo, hi]) => value >= lo && value <= hi,
      );
      expect(inRange, `${name}=${value} outside every documented range`).toBe(
        true,
      );
    }
  });
});

describe("injectLayerVars", () => {
  beforeEach(() => {
    // Strip any stale --z-* properties from prior runs in the same DOM.
    const root = document.documentElement;
    for (const prop of Array.from(root.style)) {
      if (prop.startsWith("--z-")) root.style.removeProperty(prop);
    }
  });

  afterEach(() => {
    const root = document.documentElement;
    for (const prop of Array.from(root.style)) {
      if (prop.startsWith("--z-")) root.style.removeProperty(prop);
    }
  });

  it("writes every LAYERS entry as a kebab-cased --z-* property on :root", () => {
    injectLayerVars();
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--z-canvas")).toBe("0");
    expect(root.style.getPropertyValue("--z-page-content")).toBe("2");
    expect(root.style.getPropertyValue("--z-theme-buildup")).toBe("50");
    expect(root.style.getPropertyValue("--z-dev-console")).toBe("400");
    expect(root.style.getPropertyValue("--z-cursor")).toBe("9999");
  });

  it("re-injecting is idempotent", () => {
    injectLayerVars();
    injectLayerVars();
    expect(document.documentElement.style.getPropertyValue("--z-canvas")).toBe(
      "0",
    );
  });
});
