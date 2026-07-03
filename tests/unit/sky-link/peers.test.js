import { describe, it, expect } from "vitest";
import {
  toDesktop,
  toLocal,
  sideToward,
  edgeGap,
  rayRectEntry,
  rayTargetPeer,
  createPeerRegistry,
} from "../../../js/sky-link/peers.js";

const TTL_MS = 1000;

function rect(x, y, w = 800, h = 600) {
  return { x, y, w, h };
}

describe("sky-link/peers — viewport geometry", () => {
  it("round-trips a point through desktop and local coordinates", () => {
    const r = rect(300, 200);
    const desktop = toDesktop({ x: 40, y: 70 }, r);
    expect(desktop).toEqual({ x: 340, y: 270 });
    expect(toLocal(desktop, r)).toEqual({ x: 40, y: 70 });
  });
});

describe("sky-link/peers — registry membership", () => {
  it("answers membership without touching expiry state", () => {
    const reg = createPeerRegistry(TTL_MS);
    expect(reg.has("a")).toBe(false);
    reg.upsert("a", rect(0, 0), 0);
    expect(reg.has("a")).toBe(true);
    reg.remove("a");
    expect(reg.has("a")).toBe(false);
  });
});

describe("sky-link/peers — facing sides and gaps", () => {
  const self = rect(0, 0);

  it("reports the dominant direction toward a peer", () => {
    expect(sideToward(self, rect(1000, 0))).toBe("right");
    expect(sideToward(self, rect(-1000, 0))).toBe("left");
    expect(sideToward(self, rect(0, 1000))).toBe("bottom");
    expect(sideToward(self, rect(0, -1000))).toBe("top");
  });

  it("resolves diagonal ties horizontally", () => {
    expect(sideToward(self, rect(900, 900))).toBe("right");
  });

  it("measures the shortest edge gap, zero when overlapping", () => {
    expect(edgeGap(self, rect(1000, 0))).toBe(200);
    expect(edgeGap(self, rect(400, 300))).toBe(0);
    expect(edgeGap(self, rect(1000, 700))).toBe(Math.hypot(200, 100));
  });
});

describe("sky-link/peers — ray targeting", () => {
  it("returns the distance to a rect the ray enters", () => {
    // Straight right from (0, 0) into a rect starting at x=100.
    expect(rayRectEntry({ x: 0, y: 0 }, 0, rect(100, -50, 200, 100))).toBe(100);
  });

  it("returns 0 for a ray starting inside the rect", () => {
    expect(rayRectEntry({ x: 150, y: 0 }, 0, rect(100, -50, 200, 100))).toBe(0);
  });

  it("misses rects off the ray's path or behind it", () => {
    expect(
      rayRectEntry({ x: 0, y: 0 }, 0, rect(100, 200, 100, 100)),
    ).toBeNull();
    expect(
      rayRectEntry({ x: 0, y: 0 }, Math.PI, rect(100, -50, 100, 100)),
    ).toBeNull();
  });

  it("targets the nearest peer within the distance budget", () => {
    const near = { id: "near", rect: rect(100, -50, 100, 100) };
    const far = { id: "far", rect: rect(500, -50, 100, 100) };
    expect(rayTargetPeer({ x: 0, y: 0 }, 0, [far, near], 1000)).toBe(near);
    expect(rayTargetPeer({ x: 0, y: 0 }, 0, [far], 300)).toBeNull();
  });
});

describe("sky-link/peers — registry expiry", () => {
  it("tracks peers and prunes those past their TTL", () => {
    const registry = createPeerRegistry(TTL_MS);
    registry.upsert("a", rect(0, 0), 0);
    registry.upsert("b", rect(1000, 0), TTL_MS / 2);
    expect(registry.count()).toBe(2);

    // "a" has gone silent past the TTL; "b" is still fresh.
    expect(registry.prune(TTL_MS + 1)).toBe(true);
    expect(registry.all().map((p) => p.id)).toEqual(["b"]);

    // Nothing left to prune — reports no change.
    expect(registry.prune(TTL_MS + 1)).toBe(false);
  });

  it("re-announcing refreshes a peer's expiry", () => {
    const registry = createPeerRegistry(TTL_MS);
    registry.upsert("a", rect(0, 0), 0);
    registry.upsert("a", rect(0, 0), TTL_MS);
    expect(registry.prune(TTL_MS + 1)).toBe(false);
    expect(registry.count()).toBe(1);
  });

  it("removes peers that say goodbye", () => {
    const registry = createPeerRegistry(TTL_MS);
    registry.upsert("a", rect(0, 0), 0);
    expect(registry.remove("a")).toBe(true);
    expect(registry.remove("a")).toBe(false);
    expect(registry.count()).toBe(0);
  });
});
