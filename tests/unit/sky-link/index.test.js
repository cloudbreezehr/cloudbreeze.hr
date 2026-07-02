import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { viewportDesktopRect } from "../../../js/sky-link/peers.js";

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

  beforeEach(async () => {
    vi.useFakeTimers();
    channels = [];
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    document.body.innerHTML = "";
    document.body.className = "";
    vi.resetModules();
    seam = await import("../../../js/sky-link/handoff.js");
    const mod = await import("../../../js/sky-link/index.js");
    SKY_LINK = mod.SKY_LINK;
    cleanup = mod.initSkyLink();
    selfRect = viewportDesktopRect(window);
  });

  afterEach(() => {
    cleanup?.();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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
    channel().onmessage({ data: { kind: "rect", id, rect } });
  }

  function achievementSpy() {
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail));
    return events;
  }

  it("announces its own rect on init", () => {
    const rects = channel().sent.filter((m) => m.kind === "rect");
    expect(rects.length).toBe(1);
    expect(rects[0].rect).toEqual(selfRect);
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

  it("hands off a star exiting toward a peer and reports the sent role", () => {
    const events = achievementSpy();
    injectPeer();
    const accepted = seam.offerHandoff({
      x: selfRect.w + 10,
      y: selfRect.h / 2,
      angle: 0,
      speed: 8,
      len: 50,
      opacity: 0.5,
      life: 10,
      maxLife: 60,
    });
    expect(accepted).toBe(true);
    const star = channel().sent.find((m) => m.kind === "star");
    expect(star.star).toMatchObject({ angle: 0, speed: 8, life: 10 });
    expect(events).toContainEqual({ type: "sky-link-handoff", role: "sent" });
  });

  it("refuses a handoff with no peer along the heading", () => {
    injectPeer();
    // Heading straight up — nothing is above.
    const accepted = seam.offerHandoff({
      x: selfRect.w / 2,
      y: -10,
      angle: -Math.PI / 2,
      speed: 8,
      len: 50,
      opacity: 0.5,
      life: 10,
      maxLife: 60,
    });
    expect(accepted).toBe(false);
    expect(channel().sent.find((m) => m.kind === "star")).toBeUndefined();
  });

  it("spawns an arriving star in local coordinates and reports the received role", () => {
    const events = achievementSpy();
    const spawn = vi.fn();
    seam.setSpawner(spawn);
    channel().onmessage({
      data: {
        kind: "star",
        id: "peer-1",
        star: {
          dx: selfRect.x - 40,
          dy: selfRect.y + 100,
          angle: 0,
          speed: 8,
          len: 50,
          opacity: 0.5,
          life: 10,
          maxLife: 60,
        },
      },
    });
    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({ x: -40, y: 100, angle: 0 }),
    );
    expect(events).toContainEqual({
      type: "sky-link-handoff",
      role: "received",
    });
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
    cleanup = null;
  });
});
