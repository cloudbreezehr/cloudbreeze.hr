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

    injectPeer();
    channel().onmessage(pointerMsg(true));
    vi.advanceTimersByTime(SKY_LINK.TTL_MS + SKY_LINK.POLL_MS * 2);
    expect(seam.remotePointers()).toEqual([]);
  });

  it("exposes live peer rects to the renderer through the seam", () => {
    expect(seam.peerWorldRects()).toEqual([]);
    const rect = peerRectRight();
    injectPeer("peer-1", rect);
    expect(seam.peerWorldRects()).toEqual([rect]);
    channel().onmessage({ data: { kind: "bye", id: "peer-1" } });
    expect(seam.peerWorldRects()).toEqual([]);
  });

  it("forwards local canvas clicks to peers as desktop-space impulses", () => {
    injectPeer();
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "click", x: 10, y: 20 },
      }),
    );
    const impulse = channel().sent.find((m) => m.kind === "impulse");
    expect(impulse.point).toEqual({
      x: selfRect.x + 10,
      y: selfRect.y + 20,
    });
  });

  it("keeps clicks local while no peer is linked", () => {
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "click", x: 10, y: 20 },
      }),
    );
    expect(channel().sent.find((m) => m.kind === "impulse")).toBeUndefined();
  });

  it("applies a nearby remote impulse and ignores a distant one", () => {
    const impulses = [];
    window.addEventListener("sky-link-impulse", (e) => impulses.push(e.detail));
    // Just past the right edge — within reach.
    channel().onmessage({
      data: {
        kind: "impulse",
        id: "peer-1",
        point: {
          x: selfRect.x + selfRect.w + SKY_LINK.IMPULSE_REACH_PX / 2,
          y: selfRect.y + 50,
        },
      },
    });
    expect(impulses.length).toBe(1);
    expect(impulses[0].strength).toBeGreaterThan(0);

    // Far beyond reach — dropped.
    channel().onmessage({
      data: {
        kind: "impulse",
        id: "peer-1",
        point: {
          x: selfRect.x + selfRect.w + SKY_LINK.IMPULSE_REACH_PX * 3,
          y: selfRect.y + 50,
        },
      },
    });
    expect(impulses.length).toBe(1);
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
