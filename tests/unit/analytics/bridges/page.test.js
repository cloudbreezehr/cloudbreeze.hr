import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Page-bridge test.  Focus areas:
//   - scroll_depth fires exactly once per 25/50/75/100 threshold and
//     picks the nearest threshold pass on the first crossing
//   - scrollMaxDepth on sessionCounters tracks the highest percent seen
//   - section_view fires on first intersection per section, dwell on exit
//   - nav_click triggers on internal anchor clicks only
//
// IntersectionObserver is a happy-dom stub — swap in a controllable fake
// (same pattern as reveal.test.js).

describe("analytics/bridges/page", () => {
  let core;
  let bridge;
  let session;
  let captured;
  let observerInstances;
  let OriginalIntersectionObserver;

  async function bootstrap() {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    captured = [];
    core = await import("../../../../js/analytics/core.js");
    session = await import("../../../../js/analytics/bridges/session.js");
    bridge = await import("../../../../js/analytics/bridges/page.js");
    core.start({
      adapter: { name: "capture", send: (batch) => captured.push(...batch) },
    });
    // Reset shared sessionCounters so state doesn't leak across bootstraps.
    session.sessionCounters.scrollMaxDepth = 0;
    session.sessionCounters.keyboardUsed = false;
    bridge.initPageBridge();
  }

  function dispatchAchievement(detail) {
    window.dispatchEvent(new CustomEvent("achievement", { detail }));
  }

  function eventsNamed(name) {
    return captured.filter((e) => e.name === name);
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00Z"));

    observerInstances = [];
    OriginalIntersectionObserver = window.IntersectionObserver;
    class FakeIntersectionObserver {
      constructor(cb, opts) {
        this.cb = cb;
        this.opts = opts;
        this.observed = new Set();
        observerInstances.push(this);
      }
      observe(el) {
        this.observed.add(el);
      }
      unobserve(el) {
        this.observed.delete(el);
      }
      disconnect() {
        this.observed.clear();
      }
      fireIntersecting(el) {
        this.cb([{ target: el, isIntersecting: true }]);
      }
      fireNotIntersecting(el) {
        this.cb([{ target: el, isIntersecting: false }]);
      }
    }
    window.IntersectionObserver = FakeIntersectionObserver;

    document.body.innerHTML = `
      <nav>
        <a href="#services">Services</a>
        <a href="#about">About</a>
        <a href="https://example.com">External</a>
      </nav>
      <section id="services"></section>
      <section id="about"></section>
      <section id="contact"></section>
    `;
    await bootstrap();
  });

  afterEach(() => {
    if (core && core._stopForTests) core._stopForTests();
    window.IntersectionObserver = OriginalIntersectionObserver;
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  describe("scroll_depth", () => {
    it("fires once for each 25/50/75/100 threshold as the user scrolls", () => {
      dispatchAchievement({ type: "scroll", progress: 0.26 });
      dispatchAchievement({ type: "scroll", progress: 0.51 });
      dispatchAchievement({ type: "scroll", progress: 0.78 });
      dispatchAchievement({ type: "scroll", progress: 1.0 });
      core.flush();

      const depths = eventsNamed("scroll_depth").map((e) => e.props.percent);
      expect(depths).toEqual([25, 50, 75, 100]);
    });

    it("does not re-fire a threshold on subsequent crossings", () => {
      dispatchAchievement({ type: "scroll", progress: 0.3 });
      dispatchAchievement({ type: "scroll", progress: 0.3 });
      dispatchAchievement({ type: "scroll", progress: 0.1 });
      dispatchAchievement({ type: "scroll", progress: 0.3 });
      core.flush();
      expect(eventsNamed("scroll_depth").length).toEqual(1);
    });

    it("jumping past multiple thresholds fires them all", () => {
      dispatchAchievement({ type: "scroll", progress: 1.0 });
      core.flush();
      const depths = eventsNamed("scroll_depth").map((e) => e.props.percent);
      expect(depths).toEqual([25, 50, 75, 100]);
    });

    it("updates sessionCounters.scrollMaxDepth with the largest percent seen", () => {
      dispatchAchievement({ type: "scroll", progress: 0.3 });
      dispatchAchievement({ type: "scroll", progress: 0.7 });
      dispatchAchievement({ type: "scroll", progress: 0.4 });
      expect(session.sessionCounters.scrollMaxDepth).toEqual(70);
    });
  });

  describe("section_view / section_dwell", () => {
    it("fires section_view on first intersection only", () => {
      const obs = observerInstances[0];
      const el = document.getElementById("services");
      obs.fireIntersecting(el);
      obs.fireNotIntersecting(el);
      obs.fireIntersecting(el);
      core.flush();

      const views = eventsNamed("section_view");
      expect(views.length).toEqual(1);
      expect(views[0].props.section_id).toEqual("services");
    });

    it("fires section_dwell on exit with accumulated ms", () => {
      const obs = observerInstances[0];
      const el = document.getElementById("services");
      obs.fireIntersecting(el);
      vi.advanceTimersByTime(4_000);
      obs.fireNotIntersecting(el);
      core.flush();

      const dwells = eventsNamed("section_dwell");
      expect(dwells.length).toEqual(1);
      expect(dwells[0].props.section_id).toEqual("services");
      expect(dwells[0].props.dwell_ms).toBeGreaterThanOrEqual(4_000);
    });
  });

  describe("nav_click", () => {
    it("fires for internal anchor clicks in nav", () => {
      document.querySelector("a[href='#services']").click();
      core.flush();
      const clicks = eventsNamed("nav_click");
      expect(clicks.length).toEqual(1);
      expect(clicks[0].props.target_id).toEqual("services");
    });

    it("does not fire for external links in nav (CTA bridge owns that)", () => {
      document.querySelector("a[href='https://example.com']").click();
      core.flush();
      expect(eventsNamed("nav_click").length).toEqual(0);
    });
  });

  describe("keyboard flag", () => {
    it("flips sessionCounters.keyboardUsed once on first keydown", () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
      expect(session.sessionCounters.keyboardUsed).toBe(true);
    });
  });

  describe("back_to_top", () => {
    it("fires once after reaching bottom then scrolling near-top", () => {
      dispatchAchievement({ type: "scroll", progress: 0.3 });
      dispatchAchievement({ type: "scroll", progress: 0.97 });
      dispatchAchievement({ type: "scroll", progress: 0.5 });
      dispatchAchievement({ type: "scroll", progress: 0.03 });
      core.flush();
      expect(eventsNamed("back_to_top").length).toEqual(1);
    });

    it("does not fire if the user never reaches the bottom", () => {
      dispatchAchievement({ type: "scroll", progress: 0.5 });
      dispatchAchievement({ type: "scroll", progress: 0.02 });
      core.flush();
      expect(eventsNamed("back_to_top").length).toEqual(0);
    });

    it("fires at most once even with multiple bottom/top oscillations", () => {
      dispatchAchievement({ type: "scroll", progress: 0.98 });
      dispatchAchievement({ type: "scroll", progress: 0.0 });
      dispatchAchievement({ type: "scroll", progress: 0.97 });
      dispatchAchievement({ type: "scroll", progress: 0.01 });
      core.flush();
      expect(eventsNamed("back_to_top").length).toEqual(1);
    });
  });

  describe("keyboard_shortcut_used", () => {
    it("fires when keyboard.js dispatches a keyboard-shortcut event", () => {
      dispatchAchievement({
        type: "keyboard-shortcut",
        key: "l",
        ctrl: false,
        shift: false,
        alt: false,
      });
      core.flush();
      const evt = eventsNamed("keyboard_shortcut_used")[0];
      expect(evt).toBeTruthy();
      expect(evt.props.key).toEqual("l");
      expect(evt.props.ctrl).toBe(false);
    });

    it("records modifier flags", () => {
      dispatchAchievement({
        type: "keyboard-shortcut",
        key: ".",
        ctrl: true,
        shift: true,
        alt: false,
      });
      core.flush();
      const evt = eventsNamed("keyboard_shortcut_used")[0];
      expect(evt.props.ctrl).toBe(true);
      expect(evt.props.shift).toBe(true);
    });
  });

  describe("dev_console_opened", () => {
    it("fires on dev-console-open achievement dispatches", () => {
      dispatchAchievement({ type: "dev-console-open" });
      core.flush();
      expect(eventsNamed("dev_console_opened").length).toEqual(1);
    });

    it("re-opens are distinct interactions and each emit", () => {
      dispatchAchievement({ type: "dev-console-open" });
      dispatchAchievement({ type: "dev-console-open" });
      core.flush();
      expect(eventsNamed("dev_console_opened").length).toEqual(2);
    });
  });
});
