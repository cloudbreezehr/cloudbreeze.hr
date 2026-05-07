import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  defineConstants,
  getRegistry,
  getSectionMeta,
  resetValue,
  resetSection,
  resetAll,
  exportConfig,
  importConfig,
  onSectionActivate,
  notifySectionActivate,
} from "../../js/dev/registry.js";

// `defineConstants` mutates a module-level Map.  Tests use unique category
// names so they don't stomp each other.  Vitest runs files in isolation
// by default, so this is defensive rather than strictly necessary.

function uniq(base) {
  return `test.${base}.${Math.random().toString(36).slice(2, 10)}`;
}

describe("defineConstants", () => {
  it("returns a mutable object backed by the provided values", () => {
    const obj = defineConstants(uniq("a"), {
      FOO: 10,
      BAR: { value: 5, min: 0, max: 20, step: 1, description: "bar" },
    });
    expect(obj.FOO).toBe(10);
    expect(obj.BAR).toBe(5);
    obj.FOO = 999;
    expect(obj.FOO).toBe(999);
  });

  it("infers min/max/step when metadata is shorthand", () => {
    const cat = uniq("b");
    defineConstants(cat, { X: 5 });
    const meta = getRegistry().get(cat).get("X");
    expect(meta.min).toBeDefined();
    expect(meta.max).toBeDefined();
    expect(meta.step).toBeDefined();
    expect(meta.default).toBe(5);
  });

  it("accepts explicit metadata over inferred", () => {
    const cat = uniq("c");
    defineConstants(cat, {
      Y: { value: 0.5, min: 0, max: 1, step: 0.01, description: "y" },
    });
    const meta = getRegistry().get(cat).get("Y");
    expect(meta.min).toBe(0);
    expect(meta.max).toBe(1);
    expect(meta.step).toBe(0.01);
    expect(meta.description).toBe("y");
  });

  it("formats the label from SCREAMING_SNAKE when not provided", () => {
    const cat = uniq("d");
    defineConstants(cat, { LOGO_FROST_AT: 0.5 });
    const meta = getRegistry().get(cat).get("LOGO_FROST_AT");
    expect(meta.label).toBe("Logo Frost At");
  });

  it("stores section options when provided", () => {
    const cat = uniq("e");
    defineConstants(cat, { A: 1 }, { mode: "frozen" });
    expect(getSectionMeta(cat)).toEqual({ mode: "frozen" });
  });

  it("returns null sectionMeta for categories with no options", () => {
    const cat = uniq("f");
    defineConstants(cat, { A: 1 });
    expect(getSectionMeta(cat)).toBeNull();
  });
});

describe("reset helpers", () => {
  it("resetValue restores a single key to its default", () => {
    const cat = uniq("reset1");
    const obj = defineConstants(cat, { K: 42 });
    obj.K = 100;
    resetValue(cat, "K");
    expect(obj.K).toBe(42);
  });

  it("resetSection restores every key in the section", () => {
    const cat = uniq("reset2");
    const obj = defineConstants(cat, { A: 1, B: 2 });
    obj.A = 10;
    obj.B = 20;
    resetSection(cat);
    expect(obj).toEqual({ A: 1, B: 2 });
  });

  it("resetSection is a no-op for unknown categories", () => {
    expect(() => resetSection("no-such-category")).not.toThrow();
  });

  it("resetAll restores every registered section", () => {
    const a = defineConstants(uniq("all-a"), { X: 1 });
    const b = defineConstants(uniq("all-b"), { Y: 2 });
    a.X = 99;
    b.Y = 99;
    resetAll();
    expect(a.X).toBe(1);
    expect(b.Y).toBe(2);
  });
});

describe("export / import round-trip", () => {
  it("exportConfig only includes values that differ from defaults", () => {
    const cat = uniq("ex1");
    const obj = defineConstants(cat, { A: 1, B: 2 });
    obj.A = 7; // changed
    // B is left at its default.
    const config = exportConfig();
    expect(config[cat]).toEqual({ A: 7 });
  });

  it("importConfig applies matching values and ignores unknown keys", () => {
    const cat = uniq("ex2");
    const obj = defineConstants(cat, { A: 1, B: 2 });
    importConfig({ [cat]: { A: 42, C: "ignored" } });
    expect(obj.A).toBe(42);
    expect(obj.B).toBe(2);
  });

  it("importConfig skips type-mismatched values", () => {
    const cat = uniq("ex3");
    const obj = defineConstants(cat, { A: 1 });
    importConfig({ [cat]: { A: "not a number" } });
    expect(obj.A).toBe(1);
  });

  it("importConfig silently ignores unknown categories", () => {
    expect(() =>
      importConfig({ "unknown-category": { X: 1 } }),
    ).not.toThrow();
  });
});

describe("section activation callbacks", () => {
  // onSectionActivate pushes into a module-level array with no public way to
  // clear it.  To keep the test resilient, we only check that our callback
  // fires when notified — not that it's the only callback.

  it("fires registered callbacks for the notified category", () => {
    const cb = vi.fn();
    onSectionActivate(cb);
    notifySectionActivate("some.category");
    expect(cb).toHaveBeenCalledWith("some.category");
  });
});
