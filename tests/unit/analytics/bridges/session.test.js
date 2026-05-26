import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HEARTBEAT_MS } from "../../../../js/analytics/bridges/session.js";

// Session-bridge test.  Focus areas:
//   - session_start fires exactly once on init and carries the expected
//     one-off fields (first-visit flag, visit count, entry path)
//   - heartbeats emit every HEARTBEAT_MS while the page is visible, and
//     stop when hidden
//   - session_pause / session_resume track visibility transitions
//   - session_end rolls up sessionCounters on pagehide
//
// sessionCounters is exported and mutated across bridges.  Tests reset
// modules so counter state doesn't leak between cases.

const HEARTBEATS_TO_RUN = 3;
const PAUSED_HIDDEN_MS = HEARTBEAT_MS * 3;
const HIDDEN_DURATION_MS = 7_000;
const SESSION_END_LEAD_MS = HEARTBEAT_MS * 2;

describe("analytics/bridges/session", () => {
  let core;
  let bridge;
  let captured;
  let hidden = false;

  async function bootstrap() {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    captured = [];
    core = await import("../../../../js/analytics/core.js");
    bridge = await import("../../../../js/analytics/bridges/session.js");
    core.start({
      adapter: { name: "capture", send: (batch) => captured.push(...batch) },
    });
    bridge.initSessionBridge();
  }

  function setHidden(value) {
    hidden = value;
    document.dispatchEvent(new Event("visibilitychange"));
  }

  function eventsNamed(name) {
    return captured.filter((e) => e.name === name);
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00Z"));
    hidden = false;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    await bootstrap();
  });

  afterEach(() => {
    if (core && core._stopForTests) core._stopForTests();
    vi.useRealTimers();
  });

  describe("session_start", () => {
    it("fires once on init with first-visit flag and visit count = 1", () => {
      core.flush();
      const starts = eventsNamed("session_start");
      expect(starts.length).toEqual(1);
      expect(starts[0].props.is_first_visit_ever).toBe(true);
      expect(starts[0].props.visit_count).toEqual(1);
      expect(starts[0].props.entry_path).toBeTruthy();
    });

    it("carries the hardware quality tier as a dimension", () => {
      core.flush();
      const start = eventsNamed("session_start")[0];
      expect(["low", "mid", "high"]).toContain(start.props.quality_tier);
    });

    it("is_first_visit_ever becomes false on a second load", async () => {
      core.flush();
      // Simulate a page reload: new session, same origin.
      core._stopForTests();
      sessionStorage.clear();
      vi.resetModules();
      captured = [];
      core = await import("../../../../js/analytics/core.js");
      bridge = await import("../../../../js/analytics/bridges/session.js");
      core.start({
        adapter: { name: "capture", send: (batch) => captured.push(...batch) },
      });
      bridge.initSessionBridge();
      core.flush();
      const start = eventsNamed("session_start")[0];
      expect(start.props.is_first_visit_ever).toBe(false);
      expect(start.props.visit_count).toEqual(2);
    });
  });

  describe("heartbeat", () => {
    it("emits one session_heartbeat per interval while visible", () => {
      for (let i = 0; i < HEARTBEATS_TO_RUN; i++) {
        vi.advanceTimersByTime(HEARTBEAT_MS);
      }
      core.flush();
      expect(eventsNamed("session_heartbeat").length).toEqual(
        HEARTBEATS_TO_RUN,
      );
    });

    it("skips heartbeats while the page is hidden", () => {
      setHidden(true);
      vi.advanceTimersByTime(PAUSED_HIDDEN_MS);
      core.flush();
      // The pause event fires on visibility change, but no heartbeats.
      expect(eventsNamed("session_heartbeat").length).toEqual(0);
    });

    it("heartbeat carries accumulated visible_ms and counter snapshot", () => {
      bridge.sessionCounters.scrollMaxDepth = 42;
      bridge.sessionCounters.unlocksThisSession = 3;
      vi.advanceTimersByTime(HEARTBEAT_MS);
      core.flush();
      const hb = eventsNamed("session_heartbeat")[0];
      expect(hb.props.scroll_max_depth).toEqual(42);
      expect(hb.props.unlocks_this_session).toEqual(3);
      expect(hb.props.visible_ms_so_far).toBeGreaterThanOrEqual(HEARTBEAT_MS);
    });
  });

  describe("visibility transitions", () => {
    it("session_pause fires when the page hides", () => {
      setHidden(true);
      core.flush();
      expect(eventsNamed("session_pause").length).toEqual(1);
    });

    it("session_resume reports hidden_ms since the last pause", () => {
      setHidden(true);
      vi.advanceTimersByTime(HIDDEN_DURATION_MS);
      setHidden(false);
      core.flush();
      const resume = eventsNamed("session_resume")[0];
      expect(resume).toBeTruthy();
      expect(resume.props.hidden_ms).toBeGreaterThanOrEqual(HIDDEN_DURATION_MS);
    });
  });

  describe("session_end", () => {
    it("rolls up sessionCounters on pagehide", () => {
      bridge.sessionCounters.scrollMaxDepth = 88;
      bridge.sessionCounters.unlocksThisSession = 5;
      bridge.sessionCounters.pointsThisSession = 40;
      bridge.sessionCounters.clickTotalCanvas = 12;
      bridge.sessionCounters.clickTotalCta = 2;
      bridge.sessionCounters.keyboardUsed = true;
      bridge.sessionCounters.themesActivatedThisSession.add("frozen");
      bridge.sessionCounters.themesActivatedThisSession.add("deep-sea");

      vi.advanceTimersByTime(SESSION_END_LEAD_MS);
      window.dispatchEvent(new Event("pagehide"));
      core.flush();

      const end = eventsNamed("session_end")[0];
      expect(end).toBeTruthy();
      expect(end.props.max_scroll_depth).toEqual(88);
      expect(end.props.unlocks_this_session).toEqual(5);
      expect(end.props.points_this_session).toEqual(40);
      expect(end.props.click_total_canvas).toEqual(12);
      expect(end.props.click_total_cta).toEqual(2);
      expect(end.props.keyboard_used).toBe(true);
      expect(end.props.themes_activated_this_session.sort()).toEqual([
        "deep-sea",
        "frozen",
      ]);
      expect(end.props.total_visible_ms).toBeGreaterThanOrEqual(30_000);
    });

    it("fires session_end only once even if pagehide fires twice", () => {
      window.dispatchEvent(new Event("pagehide"));
      window.dispatchEvent(new Event("pagehide"));
      core.flush();
      expect(eventsNamed("session_end").length).toEqual(1);
    });
  });
});
