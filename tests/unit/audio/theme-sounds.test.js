import { describe, it, expect } from "vitest";
import { themeFilter, themeCue } from "../../../js/audio/theme-sounds.js";
import { getThemeIds } from "../../../js/themes/registry.js";

// Pure lookup over a per-theme sound catalogue. The load-bearing contract:
// every registered theme has a bus-tint filter (a new theme without one would
// play untinted), and unknown themes resolve to null rather than throwing.

describe("audio/theme-sounds", () => {
  it("gives every registered theme a well-formed bus-tint filter", () => {
    for (const id of getThemeIds()) {
      const f = themeFilter(id);
      expect(f, `theme "${id}" should declare a filter`).not.toBeNull();
      expect(typeof f.type).toBe("string");
      expect(Number.isFinite(f.freq)).toBe(true);
      expect(Number.isFinite(f.q)).toBe(true);
    }
  });

  it("returns null filter and cue for an unknown theme", () => {
    expect(themeFilter("nope")).toBeNull();
    expect(themeCue("nope")).toBeNull();
  });

  it("returns a custom cue only for themes that define one", () => {
    expect(themeCue("upside-down")).toBe("flip");
    expect(themeCue("wanted")).toBe("siren");
    expect(themeCue("frozen")).toBeNull();
  });
});
