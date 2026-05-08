import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Modes-bridge test.  Focus areas:
//   - mode_activated / mode_deactivated shape
//   - mode_switched fires when another mode is active at activation time
//   - is_first_ever_for_visitor is persistent across sessions
//   - method label derives from source `silent` flag (hud vs organic)
//   - buildup thresholds dedupe per (mode, threshold, phase) per session
//   - mode_abandoned respects the peak threshold (belt-and-suspenders)
//   - mode_effect_used maps source event types to stable effect ids
//   - secret-reveal events (logo-parallax, mode-history-reveal) pass through

describe("analytics/bridges/modes", () => {
  let core;
  let bridge;
  let captured;

  async function bootstrap() {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    captured = [];
    core = await import("../../../../js/analytics/core.js");
    bridge = await import("../../../../js/analytics/bridges/modes.js");
    core.start({
      adapter: { name: "capture", send: (batch) => captured.push(...batch) },
    });
    bridge.initModesBridge();
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
    await bootstrap();
  });

  afterEach(() => {
    if (core && core._stopForTests) core._stopForTests();
    vi.useRealTimers();
  });

  describe("mode_activated / mode_deactivated", () => {
    it("emits mode_activated with mode id and first-ever flag", () => {
      dispatch({ type: "mode-activate", mode: "frozen" });
      core.flush();
      const a = eventsNamed("mode_activated")[0];
      expect(a.props.mode_id).toEqual("frozen");
      expect(a.props.is_first_ever_for_visitor).toBe(true);
      expect(a.props.method).toEqual("organic");
      expect(a.props.prior_active_mode).toEqual(null);
    });

    it("is_first_ever_for_visitor persists across bridge re-inits", async () => {
      dispatch({ type: "mode-activate", mode: "frozen" });
      // Re-initialize the bridge without clearing localStorage — simulates
      // a second page load on the same browser.
      captured = [];
      core._stopForTests();
      vi.resetModules();
      core = await import("../../../../js/analytics/core.js");
      bridge = await import("../../../../js/analytics/bridges/modes.js");
      core.start({
        adapter: { name: "capture", send: (batch) => captured.push(...batch) },
      });
      bridge.initModesBridge();
      dispatch({ type: "mode-activate", mode: "frozen" });
      core.flush();
      const a = eventsNamed("mode_activated")[0];
      expect(a.props.is_first_ever_for_visitor).toBe(false);
    });

    it("emits mode_deactivated with organic method when silent is falsy", () => {
      dispatch({ type: "mode-activate", mode: "frozen" });
      vi.advanceTimersByTime(5000);
      dispatch({ type: "mode-deactivate", mode: "frozen" });
      core.flush();
      const d = eventsNamed("mode_deactivated")[0];
      expect(d.props.method).toEqual("organic");
      expect(d.props.active_duration_ms).toBeGreaterThanOrEqual(5000);
    });

    it("labels method as 'hud' when silent is true", () => {
      dispatch({ type: "mode-activate", mode: "frozen", silent: true });
      dispatch({ type: "mode-deactivate", mode: "frozen", silent: true });
      core.flush();
      expect(eventsNamed("mode_activated")[0].props.method).toEqual("hud");
      expect(eventsNamed("mode_deactivated")[0].props.method).toEqual("hud");
    });
  });

  describe("mode_switched", () => {
    it("fires when a new mode activates without deactivating the first", () => {
      dispatch({ type: "mode-activate", mode: "frozen" });
      vi.advanceTimersByTime(3000);
      dispatch({ type: "mode-activate", mode: "deep-sea" });
      core.flush();

      const switches = eventsNamed("mode_switched");
      expect(switches.length).toEqual(1);
      expect(switches[0].props.from_mode).toEqual("frozen");
      expect(switches[0].props.to_mode).toEqual("deep-sea");
      expect(switches[0].props.active_ms_before_switch).toBeGreaterThanOrEqual(
        3000,
      );

      const activates = eventsNamed("mode_activated");
      expect(activates[1].props.prior_active_mode).toEqual("frozen");
    });

    it("does not fire when no other mode is active", () => {
      dispatch({ type: "mode-activate", mode: "frozen" });
      dispatch({ type: "mode-deactivate", mode: "frozen" });
      dispatch({ type: "mode-activate", mode: "deep-sea" });
      core.flush();
      expect(eventsNamed("mode_switched").length).toEqual(0);
    });
  });

  describe("buildup thresholds", () => {
    it("emits once per (mode, threshold, phase)", () => {
      dispatch({
        type: "mode-buildup",
        mode: "frozen",
        threshold: 0.25,
        phase: "activate",
        peakForce: 0.3,
      });
      dispatch({
        type: "mode-buildup",
        mode: "frozen",
        threshold: 0.25,
        phase: "activate",
        peakForce: 0.4,
      });
      core.flush();
      expect(eventsNamed("mode_buildup_threshold").length).toEqual(1);
    });

    it("separates thresholds, modes, and phases", () => {
      dispatch({
        type: "mode-buildup",
        mode: "frozen",
        threshold: 0.25,
        phase: "activate",
        peakForce: 0.3,
      });
      dispatch({
        type: "mode-buildup",
        mode: "frozen",
        threshold: 0.5,
        phase: "activate",
        peakForce: 0.6,
      });
      dispatch({
        type: "mode-buildup",
        mode: "deep-sea",
        threshold: 0.25,
        phase: "activate",
        peakForce: 0.3,
      });
      dispatch({
        type: "mode-buildup",
        mode: "frozen",
        threshold: 0.25,
        phase: "deactivate",
        peakForce: 0.3,
      });
      core.flush();
      expect(eventsNamed("mode_buildup_threshold").length).toEqual(4);
    });
  });

  describe("mode_abandoned", () => {
    it("emits with the tracked peak, duration, and phase", () => {
      dispatch({
        type: "mode-buildup",
        mode: "frozen",
        threshold: 0.25,
        phase: "activate",
        peakForce: 0.4,
      });
      vi.advanceTimersByTime(1500);
      dispatch({ type: "mode-abandoned", mode: "frozen" });
      core.flush();

      const ab = eventsNamed("mode_abandoned")[0];
      expect(ab.props.mode_id).toEqual("frozen");
      expect(ab.props.peak_force).toEqual(0.4);
      expect(ab.props.phase).toEqual("activate");
      expect(ab.props.buildup_duration_ms).toBeGreaterThanOrEqual(1500);
    });

    it("does not emit when no buildup was tracked (guard preserved)", () => {
      dispatch({ type: "mode-abandoned", mode: "frozen" });
      core.flush();
      expect(eventsNamed("mode_abandoned").length).toEqual(0);
    });
  });

  describe("mode_effect_used", () => {
    it("maps source effect events to stable ids", () => {
      dispatch({ type: "mode-activate", mode: "frozen" });
      dispatch({ type: "frost-breath" });
      dispatch({ type: "jellyfish-pulse" });
      dispatch({ type: "paper-stroke" });
      dispatch({ type: "snow-globe" });
      core.flush();

      const effects = eventsNamed("mode_effect_used").map(
        (e) => e.props.effect_id,
      );
      expect(effects).toEqual([
        "frost_breath",
        "jellyfish_pulse",
        "paper_stroke",
        "snow_globe",
      ]);
    });
  });

  describe("secret reveals", () => {
    it("logo_parallax_engaged and mode_hud_opened pass through", () => {
      dispatch({ type: "logo-parallax" });
      dispatch({ type: "mode-history-reveal" });
      core.flush();
      expect(eventsNamed("logo_parallax_engaged").length).toEqual(1);
      expect(eventsNamed("mode_hud_opened").length).toEqual(1);
    });
  });
});
