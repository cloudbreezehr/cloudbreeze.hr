import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getThemes,
  getThemeIds,
  getTheme,
  registerToggle,
  toggleTheme,
  isThemeRegistered,
  hasActiveThemeExcept,
} from "../../../js/themes/registry.js";

describe("themes/registry — metadata", () => {
  it("exposes all known themes in declaration order", () => {
    expect(getThemeIds()).toEqual([
      "frozen",
      "deep-sea",
      "blocky",
      "rainy",
      "paper",
      "vhs",
      "upside-down",
    ]);
  });

  it("returns a defensive copy from getThemes()", () => {
    const first = getThemes();
    first.push({ id: "fake" });
    const second = getThemes();
    expect(second.find((m) => m.id === "fake")).toBeUndefined();
  });

  it("each theme has id, label, color, icon", () => {
    for (const m of getThemes()) {
      expect(m).toMatchObject({
        id: expect.any(String),
        label: expect.any(String),
        color: expect.stringMatching(/^#[0-9a-fA-F]{3,8}$/),
        icon: expect.stringContaining("<svg"),
      });
    }
  });

  it("getTheme returns the entry by id", () => {
    expect(getTheme("frozen")).toMatchObject({ id: "frozen", label: "Frozen" });
  });

  it("getTheme returns null for unknown ids", () => {
    expect(getTheme("no-such-theme")).toBeNull();
  });

  it("isThemeRegistered reflects the declared set", () => {
    expect(isThemeRegistered("paper")).toBe(true);
    expect(isThemeRegistered("nope")).toBe(false);
  });
});

describe("themes/registry — toggle plumbing", () => {
  beforeEach(() => {
    document.body.className = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("toggleTheme does nothing for a theme that has not been registered yet", () => {
    // A theme id that exists but has no toggle bound (e.g. tests run in isolation
    // without calling initPaper()).  Must not throw.
    expect(() => toggleTheme("blocky")).not.toThrow();
  });

  it("toggleTheme invokes a registered handler with the opts object", () => {
    const handler = vi.fn();
    registerToggle("frozen", handler);
    toggleTheme("frozen", { silent: true });
    expect(handler).toHaveBeenCalledWith({ silent: true });
  });

  it("registerToggle rejects unknown ids", () => {
    expect(() => registerToggle("not-a-theme", () => {})).toThrow(/unknown/);
  });
});

describe("themes/registry — hasActiveThemeExcept", () => {
  beforeEach(() => {
    document.body.className = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("returns false when no theme class is set", () => {
    expect(hasActiveThemeExcept("paper")).toBe(false);
  });

  it("returns true when some other theme is active", () => {
    document.body.classList.add("frozen");
    expect(hasActiveThemeExcept("paper")).toBe(true);
  });

  it("returns false when only the excluded theme is active", () => {
    document.body.classList.add("paper");
    expect(hasActiveThemeExcept("paper")).toBe(false);
  });

  it("supports multiple exclusions", () => {
    document.body.classList.add("frozen");
    expect(hasActiveThemeExcept("frozen", "paper")).toBe(false);
    document.body.classList.add("rainy");
    expect(hasActiveThemeExcept("frozen", "paper")).toBe(true);
  });

  it("ignores unrelated body classes", () => {
    document.body.classList.add("light-appearance", "dev-active");
    expect(hasActiveThemeExcept("paper")).toBe(false);
  });
});
