import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { viewportDesktopRect } from "../../../js/world/space.js";

// Exercises the transport through a fake BroadcastChannel: tests inject peer
// messages via the captured instance's onmessage and read outbound traffic
// from its sent log. Geometry is derived from the same viewport helper the
// module uses, so the assertions don't bake in happy-dom's window metrics.

let channels;
class FakeBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.sent = [];
    this.onmessage = null;
    channels.push(this);
  }
  postMessage(msg) {
    this.sent.push(msg);
  }
  close() {
    this.closed = true;
  }
}

describe("sky-link/index", () => {
  let cleanup;
  let seam;
  let SKY_LINK;
  let selfRect;
  let seed;

  beforeEach(async () => {
    vi.useFakeTimers();
    channels = [];
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    document.body.innerHTML = "";
    document.body.className = "";
    vi.resetModules();
    seam = await import("../../../js/sky-link/seam.js");
    const daily = await import("../../../js/daily/random.js");
    seed = daily.skySeedKey();
    const mod = await import("../../../js/sky-link/index.js");
    SKY_LINK = mod.SKY_LINK;
    cleanup = mod.initSkyLink();
    selfRect = viewportDesktopRect(window);
  });

  afterEach(() => {
    cleanup?.();
    seam.setLocalPointerSource(null);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function bindLocalPointer(state) {
    seam.setLocalPointerSource(() => state);
  }

  function pointerMessages() {
    return channel().sent.filter((m) => m.kind === "pointer");
  }

  function channel() {
    return channels[0];
  }

  // A peer viewport of the same size, sitting `gap` px to the right.
  function peerRectRight(gap = 100) {
    return {
      x: selfRect.x + selfRect.w + gap,
      y: selfRect.y,
      w: selfRect.w,
      h: selfRect.h,
    };
  }

  function injectPeer(id = "peer-1", rect = peerRectRight()) {
    channel().onmessage({ data: { kind: "rect", id, seed, rect } });
  }

  function achievementSpy() {
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail));
    return events;
  }

  it("announces its own rect and sky seed on init", () => {
    const rects = channel().sent.filter((m) => m.kind === "rect");
    expect(rects.length).toBe(1);
    expect(rects[0].rect).toEqual(selfRect);
    expect(rects[0].seed).toBe(seed);
  });

  it("never links with a window on a different sky", () => {
    channel().onmessage({
      data: {
        kind: "rect",
        id: "time-traveler",
        seed: "1999-12-31",
        rect: peerRectRight(),
      },
    });
    expect(document.body.classList.contains("sky-linked")).toBe(false);
    expect(seam.peerWorldRects()).toEqual([]);
  });

  it("links up when a peer announces: body class, glow, achievement event", () => {
    const events = achievementSpy();
    injectPeer();
    expect(document.body.classList.contains("sky-linked")).toBe(true);
    expect(events).toContainEqual({ type: "sky-link", windows: 2 });
    const glow = document.querySelector('.sky-link-glow[data-side="right"]');
    expect(glow.classList.contains("on")).toBe(true);
  });

  it("re-announced rects don't re-fire the link achievement", () => {
    const events = achievementSpy();
    injectPeer();
    injectPeer();
    expect(events.filter((d) => d.type === "sky-link").length).toBe(1);
  });

  it("a third window fires the achievement with the grown count", () => {
    const events = achievementSpy();
    injectPeer("peer-1");
    injectPeer("peer-2", peerRectRight(2000));
    expect(events).toContainEqual({ type: "sky-link", windows: 3 });
  });

  it("drops the link when the peer goes silent past the TTL", () => {
    injectPeer();
    expect(document.body.classList.contains("sky-linked")).toBe(true);
    vi.advanceTimersByTime(SKY_LINK.TTL_MS + SKY_LINK.POLL_MS * 2);
    expect(document.body.classList.contains("sky-linked")).toBe(false);
  });

  it("drops the link when the peer says goodbye", () => {
    injectPeer("peer-1");
    channel().onmessage({ data: { kind: "bye", id: "peer-1" } });
    expect(document.body.classList.contains("sky-linked")).toBe(false);
  });

  it("broadcasts the local pointer to peers in desktop coordinates", () => {
    injectPeer();
    bindLocalPointer({
      x: 10,
      y: 20,
      active: true,
      isDragging: true,
      holdStrength: 0.5,
      wellStrength: 0.25,
    });
    vi.advanceTimersByTime(SKY_LINK.POINTER_SEND_MS + 1);
    const sent = pointerMessages();
    expect(sent.length).toBe(1);
    expect(sent[0].pointer).toEqual({
      x: Math.round(selfRect.x + 10),
      y: Math.round(selfRect.y + 20),
      active: true,
      isDragging: true,
      holdStrength: 0.5,
      wellStrength: 0.25,
    });
  });

  it("stays silent with no peers and while the pointer idles", () => {
    // No peers: nothing to say even with an engaged pointer.
    bindLocalPointer({
      x: 1,
      y: 1,
      active: true,
      isDragging: false,
      holdStrength: 0,
      wellStrength: 0,
    });
    vi.advanceTimersByTime(SKY_LINK.POINTER_SEND_MS * 3);
    expect(pointerMessages()).toEqual([]);

    // Peer linked but pointer never engaged: still silent.
    injectPeer();
    bindLocalPointer({
      x: 1,
      y: 1,
      active: false,
      isDragging: false,
      holdStrength: 0,
      wellStrength: 0,
    });
    vi.advanceTimersByTime(SKY_LINK.HEARTBEAT_MS * 2);
    expect(pointerMessages()).toEqual([]);
  });

  it("announces disengagement once, then goes quiet", () => {
    injectPeer();
    const state = {
      x: 5,
      y: 5,
      active: true,
      isDragging: false,
      holdStrength: 0,
      wellStrength: 0,
    };
    bindLocalPointer(state);
    vi.advanceTimersByTime(SKY_LINK.POINTER_SEND_MS + 1);
    expect(pointerMessages().length).toBe(1);

    state.active = false;
    vi.advanceTimersByTime(SKY_LINK.HEARTBEAT_MS * 2);
    const sent = pointerMessages();
    expect(sent.length).toBe(2);
    expect(sent[1].pointer.active).toBe(false);
  });

  it("folds a linked peer's pointer into local coordinates via the seam", () => {
    injectPeer();
    channel().onmessage({
      data: {
        kind: "pointer",
        id: "peer-1",
        pointer: {
          x: selfRect.x + 300,
          y: selfRect.y + 120,
          active: true,
          isDragging: true,
          holdStrength: 1,
          wellStrength: 0.5,
        },
      },
    });
    expect(seam.remotePointers()).toEqual([
      {
        id: "peer-1",
        x: 300,
        y: 120,
        active: true,
        isDragging: true,
        holdStrength: 1,
        wellStrength: 0.5,
        seenAt: expect.any(Number),
      },
    ]);
  });

  it("ignores pointers from windows that never passed the handshake", () => {
    channel().onmessage({
      data: {
        kind: "pointer",
        id: "stranger",
        pointer: { x: 0, y: 0, active: true, isDragging: false },
      },
    });
    expect(seam.remotePointers()).toEqual([]);
  });

  it("drops a peer's pointer on disengagement, on bye, and on TTL", () => {
    const pointerMsg = (active) => ({
      data: {
        kind: "pointer",
        id: "peer-1",
        pointer: {
          x: selfRect.x,
          y: selfRect.y,
          active,
          isDragging: false,
          holdStrength: 0,
          wellStrength: 0,
        },
      },
    });
    injectPeer();
    channel().onmessage(pointerMsg(true));
    expect(seam.remotePointers().length).toBe(1);

    channel().onmessage(pointerMsg(false));
    expect(seam.remotePointers()).toEqual([]);

    channel().onmessage(pointerMsg(true));
    channel().onmessage({ data: { kind: "bye", id: "peer-1" } });
    expect(seam.remotePointers()).toEqual([]);

    // A silent pointer expires on its own (tighter) TTL, before the rect
    // TTL would drop the whole link.
    injectPeer();
    channel().onmessage(pointerMsg(true));
    expect(SKY_LINK.POINTER_TTL_MS).toBeLessThan(SKY_LINK.TTL_MS);
    vi.advanceTimersByTime(SKY_LINK.POINTER_TTL_MS + SKY_LINK.POLL_MS * 2);
    expect(seam.remotePointers()).toEqual([]);
    expect(seam.peerWorldRects().length).toBe(1);
  });

  it("exposes live peer rects to the renderer through the seam", () => {
    expect(seam.peerWorldRects()).toEqual([]);
    const rect = peerRectRight();
    injectPeer("peer-1", rect);
    expect(seam.peerWorldRects()).toEqual([rect]);
    channel().onmessage({ data: { kind: "bye", id: "peer-1" } });
    expect(seam.peerWorldRects()).toEqual([]);
  });

  it("forwards a local effect to peers in desktop coordinates", () => {
    injectPeer();
    // A gravity-well release carries its blast strength and well charge.
    window.dispatchEvent(
      new CustomEvent("sky-effect", {
        detail: { x: 10, y: 20, strength: 9, well: 0.5 },
      }),
    );
    const effect = channel().sent.find((m) => m.kind === "effect");
    expect(effect.point).toEqual({ x: selfRect.x + 10, y: selfRect.y + 20 });
    expect(effect.strength).toBe(9);
    expect(effect.well).toBe(0.5);
  });

  it("keeps effects local while no peer is linked", () => {
    window.dispatchEvent(
      new CustomEvent("sky-effect", {
        detail: { x: 10, y: 20, strength: 5, well: 0 },
      }),
    );
    expect(channel().sent.find((m) => m.kind === "effect")).toBeUndefined();
  });

  it("applies a nearby mirrored effect and ignores a distant one", () => {
    injectPeer(); // peer-1 must have handshook first
    const effects = [];
    window.addEventListener("sky-link-effect", (e) => effects.push(e.detail));
    // Just past the right edge — within reach. Force is scaled down, well
    // charge rides along untouched.
    channel().onmessage({
      data: {
        kind: "effect",
        id: "peer-1",
        point: {
          x: selfRect.x + selfRect.w + SKY_LINK.EFFECT_REACH_PX / 2,
          y: selfRect.y + 50,
        },
        strength: 8,
        well: 0.5,
      },
    });
    expect(effects.length).toBe(1);
    expect(effects[0].strength).toBeGreaterThan(0);
    expect(effects[0].well).toBe(0.5);

    // Far beyond reach — dropped.
    channel().onmessage({
      data: {
        kind: "effect",
        id: "peer-1",
        point: {
          x: selfRect.x + selfRect.w + SKY_LINK.EFFECT_REACH_PX * 3,
          y: selfRect.y + 50,
        },
        strength: 8,
      },
    });
    expect(effects.length).toBe(1);
  });

  it("forwards a local spell cast to peers in desktop coordinates", () => {
    injectPeer();
    window.dispatchEvent(
      new CustomEvent("sky-cast", {
        detail: { word: "SNOW", x: 10, y: 20, charge: 2 },
      }),
    );
    const cast = channel().sent.find((m) => m.kind === "cast");
    expect(cast.word).toBe("SNOW");
    expect(cast.point).toEqual({ x: selfRect.x + 10, y: selfRect.y + 20 });
    expect(cast.charge).toBe(2);
  });

  it("keeps casts local while no peer is linked", () => {
    window.dispatchEvent(
      new CustomEvent("sky-cast", { detail: { word: "SNOW", x: 1, y: 1 } }),
    );
    expect(channel().sent.find((m) => m.kind === "cast")).toBeUndefined();
  });

  it("re-casts a peer's spell at the translated origin, with no reach limit", () => {
    injectPeer(); // peer-1 must have handshook first
    const casts = [];
    window.addEventListener("sky-link-cast", (e) => casts.push(e.detail));
    // Far from this viewport — a cast still lands (unlike a click/well).
    channel().onmessage({
      data: {
        kind: "cast",
        id: "peer-1",
        word: "CONFETTI",
        point: {
          x: selfRect.x + selfRect.w + SKY_LINK.EFFECT_REACH_PX * 5,
          y: selfRect.y + 120,
        },
        charge: 3,
      },
    });
    expect(casts).toHaveLength(1);
    expect(casts[0]).toMatchObject({ word: "CONFETTI", charge: 3 });
  });

  it("ignores an effect or cast from a window that never handshook", () => {
    const effects = [];
    const casts = [];
    window.addEventListener("sky-link-effect", (e) => effects.push(e.detail));
    window.addEventListener("sky-link-cast", (e) => casts.push(e.detail));
    // No injectPeer — a different-day #sky= window is deliberately unlinked.
    const point = { x: selfRect.x + 10, y: selfRect.y + 10 };
    channel().onmessage({
      data: { kind: "effect", id: "stranger", point, strength: 5 },
    });
    channel().onmessage({
      data: { kind: "cast", id: "stranger", word: "SNOW", point },
    });
    expect(effects).toEqual([]);
    expect(casts).toEqual([]);
  });

  it("drops malformed inbound messages without wedging the receiver", () => {
    injectPeer(); // a good link stands alongside the bad traffic
    const run = () => {
      channel().onmessage({
        data: { kind: "rect", id: "peer-2", seed, rect: null },
      });
      channel().onmessage({
        data: { kind: "pointer", id: "peer-1", pointer: null },
      });
      channel().onmessage({
        data: { kind: "effect", id: "peer-1", point: { x: NaN, y: 5 } },
      });
      channel().onmessage({
        data: { kind: "cast", id: "peer-1", word: "SNOW", point: null },
      });
    };
    expect(run).not.toThrow();
    // The bad rect never registered peer-2; the good peer-1 link is intact.
    expect(seam.peerWorldRects().length).toBe(1);
    expect(seam.remotePointers()).toEqual([]);
  });

  it("cleanup says goodbye, closes the channel, and removes the glows", () => {
    injectPeer();
    cleanup();
    expect(channel().sent.some((m) => m.kind === "bye")).toBe(true);
    expect(channel().closed).toBe(true);
    expect(document.querySelector(".sky-link-glow")).toBeNull();
    expect(document.body.classList.contains("sky-linked")).toBe(false);
    expect(seam.peerWorldRects()).toEqual([]);
    cleanup = null;
  });
});

describe("sky-link/index — inert environments", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete window.matchMedia;
    document.body.innerHTML = "";
  });

  it("stays fully inert on a touch-only device", async () => {
    vi.useFakeTimers();
    channels = [];
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    // (hover: none) matches — the device can't place windows side by side.
    window.matchMedia = vi.fn((query) => ({
      matches: query === "(hover: none)",
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    document.body.innerHTML = "";
    vi.resetModules();
    const mod = await import("../../../js/sky-link/index.js");
    const cleanup = mod.initSkyLink();
    expect(channels).toHaveLength(0);
    expect(document.querySelector(".sky-link-glow")).toBeNull();
    cleanup();
  });
});

describe("sky-link/index — hidden windows", () => {
  let cleanup;
  let hidden;

  beforeEach(async () => {
    vi.useFakeTimers();
    channels = [];
    hidden = false;
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    // The touch-only test above deletes its stubbed matchMedia, which on
    // happy-dom removes it for the rest of this file — restore a benign one.
    window.matchMedia = vi.fn((query) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    document.body.innerHTML = "";
    vi.resetModules();
    const mod = await import("../../../js/sky-link/index.js");
    cleanup = mod.initSkyLink();
  });

  afterEach(() => {
    cleanup?.();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete document.hidden;
  });

  it("goes quiet while hidden and resumes announcing when visible", async () => {
    const { SKY_LINK } = await import("../../../js/sky-link/index.js");
    const rects = () => channels[0].sent.filter((m) => m.kind === "rect");
    expect(rects()).toHaveLength(1);

    hidden = true;
    vi.advanceTimersByTime(SKY_LINK.HEARTBEAT_MS * 3);
    expect(rects()).toHaveLength(1);

    hidden = false;
    vi.advanceTimersByTime(SKY_LINK.HEARTBEAT_MS + SKY_LINK.POLL_MS);
    expect(rects().length).toBeGreaterThan(1);
  });
});
