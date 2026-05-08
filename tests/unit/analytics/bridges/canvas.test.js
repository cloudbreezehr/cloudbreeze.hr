import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Canvas-bridge test.  Focus areas:
//   - summary aggregation (click_count, quadrant set, by-mode map)
//   - drag_complete only fires past the DRAG_MIN_PX threshold
//   - hold_complete ONLY fires when source dispatched a "hold" event —
//     incidental long clicks that never reached warmup must not leak
//     into the stream (regression guard for the pre-fix behavior)
//   - discrete events (gravity well, fury, snow-globe, scroll surge,
//     cursor idle) emit with counters and active_mode
//
// Follows the bootstrap pattern from analytics-bridge-achievements.test.js.

describe("analytics/bridges/canvas", () => {
  let core;
  let bridge;
  let captured;

  async function bootstrap() {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    captured = [];
    core = await import("../../../../js/analytics/core.js");
    bridge = await import("../../../../js/analytics/bridges/canvas.js");
    core.start({
      adapter: { name: "capture", send: (batch) => captured.push(...batch) },
    });
    bridge.initCanvasBridge();
  }

  function dispatch(detail) {
    window.dispatchEvent(new CustomEvent("achievement", { detail }));
  }

  function eventsNamed(name) {
    return captured.filter((e) => e.name === name);
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00Z"));
    document.body.dataset.activeTheme = "";
    await bootstrap();
  });

  afterEach(() => {
    if (core && core._stopForTests) core._stopForTests();
    delete document.body.dataset.activeTheme;
    vi.useRealTimers();
  });

  describe("click summary", () => {
    it("aggregates click count, distinct quadrants, and by-mode buckets", () => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 1000,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: 800,
      });
      dispatch({ type: "click", x: 100, y: 100 }); // tl
      dispatch({ type: "click", x: 900, y: 100 }); // tr
      dispatch({ type: "click", x: 100, y: 700 }); // bl
      vi.advanceTimersByTime(60_000);
      core.flush();

      const summaries = eventsNamed("canvas_click_summary");
      expect(summaries.length).toEqual(1);
      expect(summaries[0].props.click_count).toEqual(3);
      expect(summaries[0].props.distinct_quadrants).toEqual(3);
      expect(summaries[0].props.clicks_by_mode).toEqual({ none: 3 });
    });

    it("buckets clicks by active mode", () => {
      dispatch({ type: "click", x: 10, y: 10 });
      document.body.dataset.activeTheme = "frozen";
      dispatch({ type: "click", x: 10, y: 10 });
      dispatch({ type: "click", x: 10, y: 10 });
      vi.advanceTimersByTime(60_000);
      core.flush();

      const summary = eventsNamed("canvas_click_summary")[0];
      expect(summary.props.clicks_by_mode).toEqual({ none: 1, frozen: 2 });
    });

    it("does not emit a summary when click count is zero", () => {
      vi.advanceTimersByTime(60_000);
      core.flush();
      expect(eventsNamed("canvas_click_summary").length).toEqual(0);
    });

    it("resets counters after each flush", () => {
      dispatch({ type: "click", x: 10, y: 10 });
      vi.advanceTimersByTime(60_000);
      dispatch({ type: "click", x: 10, y: 10 });
      vi.advanceTimersByTime(60_000);
      core.flush();

      const summaries = eventsNamed("canvas_click_summary");
      expect(summaries.length).toEqual(2);
      expect(summaries[0].props.click_count).toEqual(1);
      expect(summaries[1].props.click_count).toEqual(1);
    });
  });

  describe("drag_complete", () => {
    it("emits on pointerup when distance exceeds threshold", () => {
      dispatch({ type: "click", x: 100, y: 100 });
      dispatch({ type: "drag", x: 200, y: 200 });
      window.dispatchEvent(new Event("pointerup"));
      core.flush();

      const drags = eventsNamed("drag_complete");
      expect(drags.length).toEqual(1);
      expect(drags[0].props.distance_px).toBeGreaterThanOrEqual(20);
      expect(drags[0].props.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it("does not emit when the drag stays below DRAG_MIN_PX (20)", () => {
      dispatch({ type: "click", x: 100, y: 100 });
      dispatch({ type: "drag", x: 105, y: 105 });
      window.dispatchEvent(new Event("pointerup"));
      core.flush();
      expect(eventsNamed("drag_complete").length).toEqual(0);
    });
  });

  describe("hold_complete", () => {
    it("emits ONLY when source dispatched a 'hold' event first", () => {
      // Regression guard: without a source "hold" event, a long click
      // followed by pointerup must not produce hold_complete.
      dispatch({ type: "click", x: 10, y: 10 });
      vi.advanceTimersByTime(500);
      window.dispatchEvent(new Event("pointerup"));
      core.flush();
      expect(eventsNamed("hold_complete").length).toEqual(0);
    });

    it("emits when 'hold' was dispatched and pointerup lands after HOLD_MIN_MS", () => {
      dispatch({ type: "hold" });
      vi.advanceTimersByTime(300);
      window.dispatchEvent(new Event("pointerup"));
      core.flush();

      const holds = eventsNamed("hold_complete");
      expect(holds.length).toEqual(1);
      expect(holds[0].props.hold_ms).toBeGreaterThanOrEqual(200);
      expect(holds[0].props.reached_well).toBe(false);
      expect(holds[0].props.reached_full).toBe(false);
    });

    it("reports reached_well / reached_full when the session hit those milestones", () => {
      dispatch({ type: "hold" });
      dispatch({ type: "well-activate" });
      dispatch({ type: "well-full" });
      vi.advanceTimersByTime(300);
      window.dispatchEvent(new Event("pointerup"));
      core.flush();

      const hold = eventsNamed("hold_complete")[0];
      expect(hold.props.reached_well).toBe(true);
      expect(hold.props.reached_full).toBe(true);
    });
  });

  describe("gravity well + fury counters", () => {
    it("gravity_well_opened increments session_well_count", () => {
      dispatch({ type: "well-activate" });
      dispatch({ type: "well-activate" });
      dispatch({ type: "well-activate" });
      core.flush();

      const wells = eventsNamed("gravity_well_opened");
      expect(wells.length).toEqual(3);
      expect(wells.map((w) => w.props.session_well_count)).toEqual([1, 2, 3]);
    });

    it("fury_lightning increments session_fury_count", () => {
      dispatch({ type: "fury-lightning" });
      dispatch({ type: "fury-lightning" });
      core.flush();
      const furies = eventsNamed("fury_lightning");
      expect(furies.map((f) => f.props.session_fury_count)).toEqual([1, 2]);
    });

    it("fury_aurora, snow_globe_shake, gravity_well_filled carry active_mode", () => {
      document.body.dataset.activeTheme = "deep-sea";
      dispatch({ type: "fury-aurora" });
      dispatch({ type: "snow-globe" });
      dispatch({ type: "well-full" });
      core.flush();

      expect(eventsNamed("fury_aurora")[0].props.active_mode).toEqual(
        "deep-sea",
      );
      expect(eventsNamed("snow_globe_shake")[0].props.active_mode).toEqual(
        "deep-sea",
      );
      expect(eventsNamed("gravity_well_filled")[0].props.active_mode).toEqual(
        "deep-sea",
      );
    });
  });

  describe("scroll_surge", () => {
    it("fires once per session when velocity crosses the threshold", () => {
      dispatch({ type: "scroll", velocity: 60 });
      dispatch({ type: "scroll", velocity: 80 });
      dispatch({ type: "scroll", velocity: -100 });
      core.flush();

      const surges = eventsNamed("scroll_surge");
      expect(surges.length).toEqual(1);
      expect(surges[0].props.direction).toEqual("down");
    });

    it("ignores scrolls under the threshold", () => {
      dispatch({ type: "scroll", velocity: 20 });
      dispatch({ type: "scroll", velocity: 49 });
      core.flush();
      expect(eventsNamed("scroll_surge").length).toEqual(0);
    });

    it("reports upward direction when velocity is negative", () => {
      dispatch({ type: "scroll", velocity: -80 });
      core.flush();
      const surge = eventsNamed("scroll_surge")[0];
      expect(surge.props.direction).toEqual("up");
    });
  });

  describe("cursor_idle_fired", () => {
    it("passes through the animation name", () => {
      dispatch({ type: "cursor-idle", animation: "pulse" });
      core.flush();
      const idles = eventsNamed("cursor_idle_fired");
      expect(idles.length).toEqual(1);
      expect(idles[0].props.animation_name).toEqual("pulse");
    });

    it("uses null when animation is missing from the detail", () => {
      dispatch({ type: "cursor-idle" });
      core.flush();
      expect(eventsNamed("cursor_idle_fired")[0].props.animation_name).toEqual(
        null,
      );
    });
  });
});
