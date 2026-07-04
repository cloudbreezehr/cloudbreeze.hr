import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createCursorGhosts } from "../../../js/sky-link/ghosts.js";

// The peer cursor is a pair of DOM elements on the cursor layer, styled like
// #cursor. Tests drive update() with seam-style remote pointers and inspect the
// elements it creates, positions, and removes — no canvas.

const canvas = { width: 800, height: 600 };

function remote(overrides = {}) {
  return {
    id: "peer",
    x: 100,
    y: 100,
    active: true,
    isDragging: false,
    holdStrength: 0,
    wellStrength: 0,
    seenAt: Date.now(),
    ...overrides,
  };
}

const dot = () => document.querySelector(".sky-link-cursor");
const ring = () => document.querySelector(".sky-link-cursor-ring");

describe("sky-link/ghosts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a peer cursor — dot + ring — at the streamed position", () => {
    const ghosts = createCursorGhosts();
    ghosts.update([remote()], canvas);
    expect(dot()).toBeTruthy();
    expect(ring()).toBeTruthy();
    expect(dot().classList.contains("visible")).toBe(true);
    expect(dot().style.translate).toContain("100px");
  });

  it("does not draw a peer pointer that's outside this viewport", () => {
    const ghosts = createCursorGhosts();
    ghosts.update([remote({ x: -50 })], canvas);
    expect(dot()).toBeNull();
  });

  it("shows a well glow scaled by the peer's well charge", () => {
    const ghosts = createCursorGhosts();
    ghosts.update([remote({ wellStrength: 0.8 })], canvas);
    expect(ring().classList.contains("gravity-well")).toBe(true);
    expect(ring().style.getPropertyValue("--well-strength")).toBe("0.800");
  });

  it("fades a departed peer cursor out, then removes its elements", () => {
    const ghosts = createCursorGhosts();
    ghosts.update([remote()], canvas);
    expect(dot().classList.contains("visible")).toBe(true);

    // Pointer gone: fades first (visible dropped) but stays in the DOM.
    ghosts.update([], canvas);
    expect(dot()).toBeTruthy();
    expect(dot().classList.contains("visible")).toBe(false);

    // Removed after the fade window elapses.
    vi.advanceTimersByTime(2000);
    expect(dot()).toBeNull();
  });

  it("keeps a re-entering cursor instead of removing it", () => {
    const ghosts = createCursorGhosts();
    ghosts.update([remote()], canvas);
    ghosts.update([], canvas); // starts the removal timer
    ghosts.update([remote()], canvas); // returns before it fires
    vi.advanceTimersByTime(2000);
    expect(dot()).toBeTruthy();
    expect(dot().classList.contains("visible")).toBe(true);
  });

  it("fires ghost-hand once when a peer's drag reaches inside the viewport", () => {
    const ghosts = createCursorGhosts();
    const events = [];
    const onAch = (e) => events.push(e.detail);
    window.addEventListener("achievement", onAch);
    try {
      // A remote drag outside the viewport doesn't count.
      ghosts.update([remote({ isDragging: true, x: -50 })], canvas);
      expect(
        events.filter((d) => d.type === "sky-link-ghost-hand"),
      ).toHaveLength(0);
      // Inside: fires exactly once, even across many frames.
      for (let i = 0; i < 5; i++)
        ghosts.update([remote({ isDragging: true, x: 400 })], canvas);
      expect(
        events.filter((d) => d.type === "sky-link-ghost-hand"),
      ).toHaveLength(1);
    } finally {
      window.removeEventListener("achievement", onAch);
    }
  });

  it("does not fire ghost-hand for a hovering (non-dragging) peer", () => {
    const ghosts = createCursorGhosts();
    const events = [];
    const onAch = (e) => events.push(e.detail);
    window.addEventListener("achievement", onAch);
    try {
      for (let i = 0; i < 5; i++)
        ghosts.update([remote({ isDragging: false, x: 400 })], canvas);
      expect(
        events.filter((d) => d.type === "sky-link-ghost-hand"),
      ).toHaveLength(0);
    } finally {
      window.removeEventListener("achievement", onAch);
    }
  });
});
