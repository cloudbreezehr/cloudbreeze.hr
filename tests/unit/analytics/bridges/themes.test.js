import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Themes-bridge test.  Focus areas:
//   - theme_activated / theme_deactivated shape
//   - theme_switched fires when another theme is active at activation time
//   - is_first_ever_for_visitor is persistent across sessions
//   - method label derives from source `silent` flag (hud vs organic)
//   - buildup thresholds dedupe per (theme, threshold, phase) per session
//   - theme_abandoned respects the peak threshold (belt-and-suspenders)
//   - theme_effect_used maps source event types to stable effect ids
//   - secret-reveal events (logo-parallax, theme-history-reveal) pass through

describe("analytics/bridges/themes", () => {
  let core;
  let bridge;
  let session;
  let captured;

  async function bootstrap() {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    captured = [];
    core = await import("../../../../js/analytics/core.js");
    // Re-importing session after resetModules gives the bridge a fresh
    // sessionCounters object — its initial state is already what each test
    // expects, so no manual reset is needed.
    session = await import("../../../../js/analytics/bridges/session.js");
    bridge = await import("../../../../js/analytics/bridges/themes.js");
    core.start({
      adapter: { name: "capture", send: (batch) => captured.push(...batch) },
    });
    bridge.initThemesBridge();
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

  describe("theme_activated / theme_deactivated", () => {
    it("emits theme_activated with theme id and first-ever flag", () => {
      dispatch({ type: "theme-activate", theme: "frozen" });
      core.flush();
      const a = eventsNamed("theme_activated")[0];
      expect(a.props.theme_id).toEqual("frozen");
      expect(a.props.is_first_ever_for_visitor).toBe(true);
      expect(a.props.method).toEqual("organic");
      expect(a.props.prior_active_theme).toEqual(null);
    });

    it("is_first_ever_for_visitor persists across bridge re-inits", async () => {
      dispatch({ type: "theme-activate", theme: "frozen" });
      // Re-initialize the bridge without clearing localStorage — simulates
      // a second page load on the same browser.
      captured = [];
      core._stopForTests();
      vi.resetModules();
      core = await import("../../../../js/analytics/core.js");
      bridge = await import("../../../../js/analytics/bridges/themes.js");
      core.start({
        adapter: { name: "capture", send: (batch) => captured.push(...batch) },
      });
      bridge.initThemesBridge();
      dispatch({ type: "theme-activate", theme: "frozen" });
      core.flush();
      const a = eventsNamed("theme_activated")[0];
      expect(a.props.is_first_ever_for_visitor).toBe(false);
    });

    it("emits theme_deactivated with organic method when silent is falsy", () => {
      const ACTIVE_DURATION_MS = 5000;
      dispatch({ type: "theme-activate", theme: "frozen" });
      vi.advanceTimersByTime(ACTIVE_DURATION_MS);
      dispatch({ type: "theme-deactivate", theme: "frozen" });
      core.flush();
      const d = eventsNamed("theme_deactivated")[0];
      expect(d.props.method).toEqual("organic");
      expect(d.props.active_duration_ms).toBeGreaterThanOrEqual(
        ACTIVE_DURATION_MS,
      );
    });

    it("labels method as 'hud' when silent is true", () => {
      dispatch({ type: "theme-activate", theme: "frozen", silent: true });
      dispatch({ type: "theme-deactivate", theme: "frozen", silent: true });
      core.flush();
      expect(eventsNamed("theme_activated")[0].props.method).toEqual("hud");
      expect(eventsNamed("theme_deactivated")[0].props.method).toEqual("hud");
    });

    it("writes lastThemeActivationTs onto sessionCounters for cross-bridge signals", () => {
      expect(session.sessionCounters.lastThemeActivationTs).toEqual(null);
      dispatch({ type: "theme-activate", theme: "frozen" });
      expect(typeof session.sessionCounters.lastThemeActivationTs).toEqual(
        "number",
      );
    });
  });

  describe("theme_switched", () => {
    it("fires when a new theme activates without deactivating the first", () => {
      const TIME_BEFORE_SWITCH_MS = 3000;
      dispatch({ type: "theme-activate", theme: "frozen" });
      vi.advanceTimersByTime(TIME_BEFORE_SWITCH_MS);
      dispatch({ type: "theme-activate", theme: "deep-sea" });
      core.flush();

      const switches = eventsNamed("theme_switched");
      expect(switches.length).toEqual(1);
      expect(switches[0].props.from_theme).toEqual("frozen");
      expect(switches[0].props.to_theme).toEqual("deep-sea");
      expect(switches[0].props.active_ms_before_switch).toBeGreaterThanOrEqual(
        TIME_BEFORE_SWITCH_MS,
      );

      const activates = eventsNamed("theme_activated");
      expect(activates[1].props.prior_active_theme).toEqual("frozen");
    });

    it("does not fire when no other theme is active", () => {
      dispatch({ type: "theme-activate", theme: "frozen" });
      dispatch({ type: "theme-deactivate", theme: "frozen" });
      dispatch({ type: "theme-activate", theme: "deep-sea" });
      core.flush();
      expect(eventsNamed("theme_switched").length).toEqual(0);
    });
  });

  describe("buildup thresholds", () => {
    it("emits once per (theme, threshold, phase)", () => {
      dispatch({
        type: "theme-buildup",
        theme: "frozen",
        threshold: 0.25,
        phase: "activate",
        peakForce: 0.3,
      });
      dispatch({
        type: "theme-buildup",
        theme: "frozen",
        threshold: 0.25,
        phase: "activate",
        peakForce: 0.4,
      });
      core.flush();
      expect(eventsNamed("theme_buildup_threshold").length).toEqual(1);
    });

    it("separates thresholds, themes, and phases", () => {
      dispatch({
        type: "theme-buildup",
        theme: "frozen",
        threshold: 0.25,
        phase: "activate",
        peakForce: 0.3,
      });
      dispatch({
        type: "theme-buildup",
        theme: "frozen",
        threshold: 0.5,
        phase: "activate",
        peakForce: 0.6,
      });
      dispatch({
        type: "theme-buildup",
        theme: "deep-sea",
        threshold: 0.25,
        phase: "activate",
        peakForce: 0.3,
      });
      dispatch({
        type: "theme-buildup",
        theme: "frozen",
        threshold: 0.25,
        phase: "deactivate",
        peakForce: 0.3,
      });
      core.flush();
      expect(eventsNamed("theme_buildup_threshold").length).toEqual(4);
    });
  });

  describe("theme_abandoned", () => {
    it("emits with the tracked peak, duration, and phase", () => {
      dispatch({
        type: "theme-buildup",
        theme: "frozen",
        threshold: 0.25,
        phase: "activate",
        peakForce: 0.4,
      });
      const BUILDUP_DURATION_MS = 1500;
      vi.advanceTimersByTime(BUILDUP_DURATION_MS);
      dispatch({ type: "theme-abandoned", theme: "frozen" });
      core.flush();

      const ab = eventsNamed("theme_abandoned")[0];
      expect(ab.props.theme_id).toEqual("frozen");
      expect(ab.props.peak_force).toEqual(0.4);
      expect(ab.props.phase).toEqual("activate");
      expect(ab.props.buildup_duration_ms).toBeGreaterThanOrEqual(
        BUILDUP_DURATION_MS,
      );
    });

    it("does not emit when no buildup was tracked (guard preserved)", () => {
      dispatch({ type: "theme-abandoned", theme: "frozen" });
      core.flush();
      expect(eventsNamed("theme_abandoned").length).toEqual(0);
    });
  });

  describe("theme_effect_used", () => {
    it("maps source effect events to stable ids", () => {
      dispatch({ type: "theme-activate", theme: "frozen" });
      dispatch({ type: "frost-breath" });
      dispatch({ type: "jellyfish-pulse" });
      dispatch({ type: "paper-stroke" });
      dispatch({ type: "snow-globe" });
      core.flush();

      const effects = eventsNamed("theme_effect_used").map(
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
    it("logo_parallax_engaged and theme_hud_opened pass through", () => {
      dispatch({ type: "logo-parallax" });
      dispatch({ type: "theme-history-reveal" });
      core.flush();
      expect(eventsNamed("logo_parallax_engaged").length).toEqual(1);
      expect(eventsNamed("theme_hud_opened").length).toEqual(1);
    });
  });

  describe("theme_warning_shown", () => {
    it("emits with theme_id for upside-down-warning", () => {
      dispatch({ type: "upside-down-warning" });
      core.flush();
      const warn = eventsNamed("theme_warning_shown")[0];
      expect(warn).toBeTruthy();
      expect(warn.props.theme_id).toEqual("upside-down");
    });

    it("ignores unmapped source types (regression guard on the map)", () => {
      dispatch({ type: "some-other-warning" });
      core.flush();
      expect(eventsNamed("theme_warning_shown").length).toEqual(0);
    });
  });

  describe("consent", () => {
    it("persists no first-visit or per-theme timestamps while opted out", async () => {
      // Re-init from a clean slate, opted out before the bridge runs.
      localStorage.clear();
      sessionStorage.clear();
      vi.resetModules();
      captured = [];
      const consent = await import("../../../../js/analytics/consent.js");
      core = await import("../../../../js/analytics/core.js");
      session = await import("../../../../js/analytics/bridges/session.js");
      bridge = await import("../../../../js/analytics/bridges/themes.js");
      consent.optOut();
      core.start({
        adapter: { name: "capture", send: (batch) => captured.push(...batch) },
      });
      bridge.initThemesBridge();

      dispatch({ type: "theme-activate", theme: "frozen" });

      const { KEYS } = await import("../../../../js/analytics/storage.js");
      expect(localStorage.getItem(KEYS.FIRST_VISIT_TS)).toBeNull();
      expect(
        localStorage.getItem("cb_analytics_theme_first_frozen_ts"),
      ).toBeNull();
    });
  });
});
