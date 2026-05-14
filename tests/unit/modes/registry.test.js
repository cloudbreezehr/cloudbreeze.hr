import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getModes,
  getModeIds,
  getMode,
  registerToggle,
  toggleMode,
  isModeRegistered,
  hasActiveModeExcept,
} from "../../../js/modes/registry.js";

describe("modes/registry — metadata", () => {
  it("exposes all six known modes in declaration order", () => {
    expect(getModeIds()).toEqual([
      "frozen",
      "deep-sea",
      "blocky",
      "rainy",
      "paper",
      "upside-down",
    ]);
  });

  it("returns a defensive copy from getModes()", () => {
    const first = getModes();
    first.push({ id: "fake" });
    const second = getModes();
    expect(second.find((m) => m.id === "fake")).toBeUndefined();
  });

  it("each mode has id, label, color, icon", () => {
    for (const m of getModes()) {
      expect(m).toMatchObject({
        id: expect.any(String),
        label: expect.any(String),
        color: expect.stringMatching(/^#[0-9a-fA-F]{3,8}$/),
        icon: expect.stringContaining("<svg"),
      });
    }
  });

  it("getMode returns the entry by id", () => {
    expect(getMode("frozen")).toMatchObject({ id: "frozen", label: "Frozen" });
  });

  it("getMode returns null for unknown ids", () => {
    expect(getMode("no-such-mode")).toBeNull();
  });

  it("isModeRegistered reflects the declared set", () => {
    expect(isModeRegistered("paper")).toBe(true);
    expect(isModeRegistered("nope")).toBe(false);
  });
});

describe("modes/registry — toggle plumbing", () => {
  beforeEach(() => {
    document.body.className = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("toggleMode does nothing for a mode that has not been registered yet", () => {
    // A mode id that exists but has no toggle bound (e.g. tests run in isolation
    // without calling initPaper()).  Must not throw.
    expect(() => toggleMode("blocky")).not.toThrow();
  });

  it("toggleMode invokes a registered handler with the opts object", () => {
    const handler = vi.fn();
    registerToggle("frozen", handler);
    toggleMode("frozen", { silent: true });
    expect(handler).toHaveBeenCalledWith({ silent: true });
  });

  it("registerToggle rejects unknown ids", () => {
    expect(() => registerToggle("not-a-mode", () => {})).toThrow(/unknown/);
  });
});

describe("modes/registry — hasActiveModeExcept", () => {
  beforeEach(() => {
    document.body.className = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("returns false when no mode class is set", () => {
    expect(hasActiveModeExcept("paper")).toBe(false);
  });

  it("returns true when some other mode is active", () => {
    document.body.classList.add("frozen");
    expect(hasActiveModeExcept("paper")).toBe(true);
  });

  it("returns false when only the excluded mode is active", () => {
    document.body.classList.add("paper");
    expect(hasActiveModeExcept("paper")).toBe(false);
  });

  it("supports multiple exclusions", () => {
    document.body.classList.add("frozen");
    expect(hasActiveModeExcept("frozen", "paper")).toBe(false);
    document.body.classList.add("rainy");
    expect(hasActiveModeExcept("frozen", "paper")).toBe(true);
  });

  it("ignores unrelated body classes", () => {
    document.body.classList.add("light-appearance", "dev-active");
    expect(hasActiveModeExcept("paper")).toBe(false);
  });
});
