import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  scrollAndHighlight,
  POST_SETTLE_DELAY_MS,
} from "../../js/scroll-highlight.js";

// scroll-highlight defers the highlight until the smooth scroll
// genuinely settles.  The settle detector polls scrollTop every rAF
// with a startup grace window before declaring "no movement = done".
// Tests drive rAF and scrollTop deterministically.

const SLACK_MS = 1;
const AFTER_DELAY_MS = POST_SETTLE_DELAY_MS + SLACK_MS;

describe("scroll-highlight", () => {
  let target;
  let rafQueue;
  let rafSpy;
  let now;
  let nowSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    now = 0;
    nowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
    rafQueue = [];
    rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        rafQueue.push(cb);
        return rafQueue.length;
      });

    document.body.innerHTML = "";
    target = document.createElement("div");
    target.className = "row";
    target.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    rafSpy.mockRestore();
    nowSpy.mockRestore();
    vi.useRealTimers();
  });

  // Advance rAF + clock together so the settle loop sees both.
  function frame(deltaMs = 16) {
    now += deltaMs;
    const queue = rafQueue;
    rafQueue = [];
    for (const cb of queue) cb();
  }

  function makeScroller() {
    const scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    scroller.scrollTop = 0;
    scroller.appendChild(target);
    document.body.appendChild(scroller);
    return scroller;
  }

  // happy-dom doesn't run CSS animations, so drive the highlight's
  // start/end lifecycle with synthetic events carrying an animationName.
  function animEvent(type, animationName, bubbles = false) {
    const e = new Event(type, { bubbles });
    Object.defineProperty(e, "animationName", { value: animationName });
    return e;
  }

  it("waits the post-settle delay before highlighting when there is no scrollable ancestor", () => {
    document.body.appendChild(target);
    scrollAndHighlight(target);
    expect(target.scrollIntoView).toHaveBeenCalledOnce();
    expect(target.classList.contains("shine")).toBe(false);

    vi.advanceTimersByTime(AFTER_DELAY_MS);
    expect(target.classList.contains("shine")).toBe(true);
  });

  it("highlights after the start-grace window when the scroll never moves", () => {
    makeScroller();
    scrollAndHighlight(target);
    expect(target.classList.contains("shine")).toBe(false);

    // Drive frames until the grace window expires without any scrollTop change.
    for (let i = 0; i < 10; i++) frame(16);
    vi.advanceTimersByTime(AFTER_DELAY_MS);
    expect(target.classList.contains("shine")).toBe(true);
  });

  it("waits for scrollTop to settle (stable across consecutive frames) before highlighting", () => {
    const scroller = makeScroller();
    scrollAndHighlight(target);

    // Frame 1: scroll begins moving.
    scroller.scrollTop = 50;
    frame(16);
    expect(target.classList.contains("shine")).toBe(false);

    // Frame 2: still moving.
    scroller.scrollTop = 120;
    frame(16);
    expect(target.classList.contains("shine")).toBe(false);

    // Frame 3: lands on target.
    scroller.scrollTop = 200;
    frame(16);
    expect(target.classList.contains("shine")).toBe(false);

    // Frame 4: held — first stable reading after movement.
    frame(16);
    expect(target.classList.contains("shine")).toBe(false);

    // Frame 5: second stable reading — settle declared.
    frame(16);
    vi.advanceTimersByTime(AFTER_DELAY_MS);
    expect(target.classList.contains("shine")).toBe(true);
  });

  it("does not falsely settle on the first frame when the smooth scroll has not yet committed", () => {
    const scroller = makeScroller();
    scrollAndHighlight(target);

    // First few frames: scroller still at 0 because smooth scroll
    // hasn't committed a delta yet — grace window is in effect.
    frame(16);
    frame(16);
    expect(target.classList.contains("shine")).toBe(false);

    // Movement begins late.
    scroller.scrollTop = 100;
    frame(16);
    scroller.scrollTop = 200;
    frame(16);
    expect(target.classList.contains("shine")).toBe(false);

    // Stable for two frames — settle.
    frame(16);
    frame(16);
    vi.advanceTimersByTime(AFTER_DELAY_MS);
    expect(target.classList.contains("shine")).toBe(true);
  });

  it("bounds the settle wait once movement was seen", () => {
    const scroller = makeScroller();
    scrollAndHighlight(target);

    // Movement starts then keeps oscillating forever — never two stable
    // frames in a row.  The hard timeout should still fire eventually.
    for (let i = 0; i < 200; i++) {
      scroller.scrollTop = i % 2 === 0 ? 100 : 200;
      frame(16);
      if (target.classList.contains("shine")) break;
    }
    vi.advanceTimersByTime(AFTER_DELAY_MS);
    expect(target.classList.contains("shine")).toBe(true);
  });

  it("removes the highlight class when its own animation ends", () => {
    document.body.appendChild(target);
    scrollAndHighlight(target);
    vi.advanceTimersByTime(AFTER_DELAY_MS);
    expect(target.classList.contains("shine")).toBe(true);

    target.dispatchEvent(animEvent("animationstart", "row-shine"));
    target.dispatchEvent(animEvent("animationend", "row-shine"));
    expect(target.classList.contains("shine")).toBe(false);
  });

  it("keeps the highlight when an unrelated child animation ends", () => {
    // A descendant with its own animation (a progress-bar tick, a click
    // pop) whose animationend bubbles up to the highlighted element.
    const child = document.createElement("div");
    target.appendChild(child);
    document.body.appendChild(target);
    scrollAndHighlight(target);
    vi.advanceTimersByTime(AFTER_DELAY_MS);

    target.dispatchEvent(animEvent("animationstart", "row-shine"));
    child.dispatchEvent(animEvent("animationend", "progress-tick", true));
    expect(target.classList.contains("shine")).toBe(true);

    target.dispatchEvent(animEvent("animationend", "row-shine"));
    expect(target.classList.contains("shine")).toBe(false);
  });

  it("cleans up when the highlight animation runs on a descendant", () => {
    // Some highlight targets carry `shine` on the outer element but animate
    // an inner one, so both start and end arrive via bubbling.
    const inner = document.createElement("div");
    target.appendChild(inner);
    document.body.appendChild(target);
    scrollAndHighlight(target);
    vi.advanceTimersByTime(AFTER_DELAY_MS);
    expect(target.classList.contains("shine")).toBe(true);

    inner.dispatchEvent(animEvent("animationstart", "row-shine", true));
    inner.dispatchEvent(animEvent("animationend", "row-shine", true));
    expect(target.classList.contains("shine")).toBe(false);
  });

  it("is a no-op when the element is null", () => {
    expect(() => scrollAndHighlight(null)).not.toThrow();
  });
});
