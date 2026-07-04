import { describe, it, expect } from "vitest";
import { createRemotePointerRegistry } from "../../../js/sky-link/pointers.js";

const TTL_MS = 1000;

function state(x, y, overrides = {}) {
  return {
    x,
    y,
    active: true,
    isDragging: false,
    holdStrength: 0,
    wellStrength: 0,
    ...overrides,
  };
}

describe("sky-link/pointers", () => {
  it("stores the latest state per pointer id", () => {
    const reg = createRemotePointerRegistry(TTL_MS);
    reg.upsert("a", state(10, 20), 0);
    reg.upsert("a", state(30, 40, { isDragging: true, holdStrength: 0.5 }), 5);
    expect(reg.count()).toBe(1);
    expect(reg.all()[0]).toMatchObject({
      id: "a",
      x: 30,
      y: 40,
      isDragging: true,
      holdStrength: 0.5,
      seenAt: 5,
    });
  });

  it("tracks multiple pointers independently", () => {
    const reg = createRemotePointerRegistry(TTL_MS);
    reg.upsert("a", state(1, 1), 0);
    reg.upsert("b", state(2, 2, { wellStrength: 1 }), 0);
    expect(reg.count()).toBe(2);
    expect(
      reg
        .all()
        .map((p) => p.id)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  it("prunes pointers whose owner went quiet past the TTL", () => {
    const reg = createRemotePointerRegistry(TTL_MS);
    reg.upsert("a", state(1, 1), 0);
    reg.upsert("b", state(2, 2), TTL_MS);
    expect(reg.prune(TTL_MS + 1)).toBe(true);
    expect(reg.all().map((p) => p.id)).toEqual(["b"]);
    expect(reg.prune(TTL_MS + 2)).toBe(false);
  });

  it("removes a pointer on demand and reports whether it existed", () => {
    const reg = createRemotePointerRegistry(TTL_MS);
    reg.upsert("a", state(1, 1), 0);
    expect(reg.remove("a")).toBe(true);
    expect(reg.remove("a")).toBe(false);
    expect(reg.count()).toBe(0);
  });
});
