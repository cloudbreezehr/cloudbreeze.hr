import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// spawnRipple is a transient WAAPI visual, so the contract worth locking is
// its reduced-motion behavior: it must draw nothing and — since the voice is
// tied to a ring it never draws — stay silent. Several callers dropped their
// own guards in favor of this one, so the no-op path is load-bearing.

describe("effects/ripple", () => {
  let reduced;
  let playSfx;

  beforeEach(() => {
    vi.resetModules();
    reduced = false;
    playSfx = vi.fn();
    vi.doMock("../../../js/motion.js", () => ({
      prefersReducedMotion: () => reduced,
    }));
    vi.doMock("../../../js/audio/sfx.js", () => ({ playSfx }));
    // happy-dom has no Web Animations API; a minimal stub lets the ring's
    // animate().onfinish assignment succeed on the normal-motion path.
    Element.prototype.animate = vi.fn(() => ({ onfinish: null }));
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.doUnmock("../../../js/motion.js");
    vi.doUnmock("../../../js/audio/sfx.js");
  });

  it("spawns a ring and plays its voice under normal motion", async () => {
    const { spawnRipple } = await import("../../../js/effects/ripple.js");
    spawnRipple(10, 20, { className: "test-ring", sound: "ping" });
    expect(document.querySelectorAll(".test-ring")).toHaveLength(1);
    expect(playSfx).toHaveBeenCalledWith("ping");
  });

  it("spawns the requested number of concentric rings", async () => {
    const { spawnRipple } = await import("../../../js/effects/ripple.js");
    spawnRipple(0, 0, { className: "test-ring", count: 3 });
    expect(document.querySelectorAll(".test-ring")).toHaveLength(3);
  });

  it("draws nothing and stays silent under reduced motion", async () => {
    reduced = true;
    const { spawnRipple } = await import("../../../js/effects/ripple.js");
    spawnRipple(10, 20, { className: "test-ring", sound: "ping" });
    expect(document.querySelectorAll(".test-ring")).toHaveLength(0);
    expect(playSfx).not.toHaveBeenCalled();
  });
});
