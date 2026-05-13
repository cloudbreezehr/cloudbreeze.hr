import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  TRIPLE_CLICK_MAX_MS,
  TRIPLE_CLICK_COUNT,
  createTripleClickDetector,
} from "../../../js/achievements/index.js";

// Triple-click detector — pure state machine over click timestamps.
// Lives in achievements/index.js because it gates the entire Cloudlog UI;
// any regression here would silently lock visitors out of the achievement
// system.

const BOOT_TIME = new Date("2026-05-08T12:00:00Z").getTime();

// Symbolic timings derived from the source constant.  Tuning the source
// automatically retunes these.
const SLACK_MS = 50;
const WITHIN_TRIPLE_MS = TRIPLE_CLICK_MAX_MS / 4;
const PAST_TRIPLE_MS = TRIPLE_CLICK_MAX_MS + SLACK_MS;

function clickAt(target, x = 0, y = 0) {
  target.dispatchEvent(
    new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }),
  );
}

describe("achievements/createTripleClickDetector", () => {
  let target;
  let onTriple;
  let stop;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BOOT_TIME);
    target = document.createElement("div");
    document.body.appendChild(target);
    onTriple = vi.fn();
  });

  afterEach(() => {
    if (stop) stop();
    target.remove();
    vi.useRealTimers();
  });

  it("fires onTriple on the third click within TRIPLE_CLICK_MAX_MS", () => {
    stop = createTripleClickDetector(target, onTriple);
    for (let i = 0; i < TRIPLE_CLICK_COUNT; i++) {
      clickAt(target);
      vi.advanceTimersByTime(WITHIN_TRIPLE_MS);
    }
    expect(onTriple).toHaveBeenCalledOnce();
  });

  it("does not fire when fewer than TRIPLE_CLICK_COUNT clicks land", () => {
    stop = createTripleClickDetector(target, onTriple);
    for (let i = 0; i < TRIPLE_CLICK_COUNT - 1; i++) {
      clickAt(target);
      vi.advanceTimersByTime(WITHIN_TRIPLE_MS);
    }
    expect(onTriple).not.toHaveBeenCalled();
  });

  it("drops clicks older than TRIPLE_CLICK_MAX_MS so a stale click can't complete a burst", () => {
    stop = createTripleClickDetector(target, onTriple);
    // First click happens, then we wait past the window.
    clickAt(target);
    vi.advanceTimersByTime(PAST_TRIPLE_MS);
    // Two more rapid clicks — only two fall inside the window now, so
    // the burst doesn't complete.
    clickAt(target);
    vi.advanceTimersByTime(WITHIN_TRIPLE_MS);
    clickAt(target);
    expect(onTriple).not.toHaveBeenCalled();
  });

  it("fires once per completed burst — a fourth click does not re-fire", () => {
    stop = createTripleClickDetector(target, onTriple);
    for (let i = 0; i < TRIPLE_CLICK_COUNT; i++) {
      clickAt(target);
      vi.advanceTimersByTime(WITHIN_TRIPLE_MS);
    }
    expect(onTriple).toHaveBeenCalledOnce();
    // A lone fourth click after the third should not fire again — state
    // resets on success.
    clickAt(target);
    expect(onTriple).toHaveBeenCalledOnce();
  });

  it("re-arms after a successful burst — a second burst fires again", () => {
    stop = createTripleClickDetector(target, onTriple);
    for (let i = 0; i < TRIPLE_CLICK_COUNT; i++) {
      clickAt(target);
      vi.advanceTimersByTime(WITHIN_TRIPLE_MS);
    }
    expect(onTriple).toHaveBeenCalledTimes(1);

    // Wait past the window so any stale state would fall out anyway.
    vi.advanceTimersByTime(PAST_TRIPLE_MS);

    for (let i = 0; i < TRIPLE_CLICK_COUNT; i++) {
      clickAt(target);
      vi.advanceTimersByTime(WITHIN_TRIPLE_MS);
    }
    expect(onTriple).toHaveBeenCalledTimes(2);
  });

  it("passes the third click's event to onTriple so callers can read clientX/Y", () => {
    stop = createTripleClickDetector(target, onTriple);
    clickAt(target, 10, 20);
    vi.advanceTimersByTime(WITHIN_TRIPLE_MS);
    clickAt(target, 30, 40);
    vi.advanceTimersByTime(WITHIN_TRIPLE_MS);
    clickAt(target, 50, 60);

    expect(onTriple).toHaveBeenCalledOnce();
    const e = onTriple.mock.calls[0][0];
    expect(e.clientX).toEqual(50);
    expect(e.clientY).toEqual(60);
  });

  it("stop() detaches the listener — subsequent clicks don't fire onTriple", () => {
    stop = createTripleClickDetector(target, onTriple);
    stop();
    stop = null;
    for (let i = 0; i < TRIPLE_CLICK_COUNT; i++) {
      clickAt(target);
      vi.advanceTimersByTime(WITHIN_TRIPLE_MS);
    }
    expect(onTriple).not.toHaveBeenCalled();
  });

  it("a long pause between the first two clicks still allows a fast triple after", () => {
    // Specifically: the dropping logic peels stale clicks, so a slow start
    // doesn't prevent a fast finish.
    stop = createTripleClickDetector(target, onTriple);
    clickAt(target);
    vi.advanceTimersByTime(PAST_TRIPLE_MS);
    // First click is now stale — a fast triple from here should still fire.
    clickAt(target);
    vi.advanceTimersByTime(WITHIN_TRIPLE_MS);
    clickAt(target);
    vi.advanceTimersByTime(WITHIN_TRIPLE_MS);
    clickAt(target);
    expect(onTriple).toHaveBeenCalledOnce();
  });
});
