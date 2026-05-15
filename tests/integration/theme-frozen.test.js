import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FF } from "../../js/themes/frozen.js";

// Integration test: exercises initFrozen() end-to-end through the real
// factory, real click-count trigger, and real playWipe — no module mocks.
// The scope is wire-up verification, not visual correctness: happy-dom has
// no layout engine, so we assert on observable DOM outcomes (classes,
// attached elements, style properties) rather than rendered appearance.

const {
  CLICKS_TO_FREEZE,
  CLICKS_TO_THAW,
  FROST_CREEP_AT,
  WIPE_COVER_MS,
  WIPE_REVEAL_MS,
} = FF;

// Strict-less-than threshold checks (e.g. progress < FROST_CREEP_AT) need
// one extra click to land just past the boundary.
const SLACK_CLICKS = 1;

// Helpers

function stageDom() {
  document.body.innerHTML = `
    <a class="nav-logo" href="#"></a>
    <svg class="cloud-svg"></svg>
    <canvas id="bg-canvas"></canvas>
    <div class="service-card"></div>
    <div class="service-card"></div>
  `;
}

function clickLogo(times = 1) {
  const logo = document.querySelector(".nav-logo");
  for (let i = 0; i < times; i++) {
    logo.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  }
}

// Small epsilon so vi.advanceTimersByTime lands just past the wipe boundary
// rather than on it (timer order at exact boundaries is implementation-defined).
const SLACK_MS = 50;

// playWipe uses setTimeout for cover + requestAnimationFrame + setTimeout for
// reveal. Driving the timers past cover+reveal runs the full cycle under
// fake timers.
function flushWipe() {
  vi.advanceTimersByTime(WIPE_COVER_MS + WIPE_REVEAL_MS + SLACK_MS);
}

async function setupFrozen() {
  vi.resetModules();
  stageDom();
  const { initFrozen } = await import("../../js/themes/frozen.js");
  initFrozen();
}

describe("theme-frozen integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
    // scrollTo is called from the preClick hook; happy-dom doesn't implement it.
    window.scrollTo = vi.fn();
    // Web Animations API shim: happy-dom has no Element.animate. The frost
    // breath particles and frost ripples use it; stub it so the self-clean
    // onfinish path still fires (particles are removed from the DOM when
    // animation ends). Cleared in afterEach so the shim doesn't bleed into
    // unrelated suites running in the same process.
    if (!Element.prototype.animate) {
      Element.prototype.animate = function () {
        const handle = { onfinish: null };
        queueMicrotask(() => handle.onfinish && handle.onfinish());
        return handle;
      };
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete window.scrollTo;
    delete Element.prototype.animate;
  });

  it("activates after CLICKS_TO_FREEZE logo clicks and applies the body class + theme-activate event", async () => {
    await setupFrozen();
    const listener = vi.fn();
    window.addEventListener("achievement", listener);

    clickLogo(CLICKS_TO_FREEZE);
    flushWipe();

    expect(document.body.classList.contains("frozen")).toBe(true);

    const activateEvents = listener.mock.calls.filter(
      (c) =>
        c[0].detail.type === "theme-activate" && c[0].detail.theme === "frozen",
    );
    expect(activateEvents).toHaveLength(1);
    window.removeEventListener("achievement", listener);
  });

  it("deactivates after CLICKS_TO_THAW additional clicks and removes the body class", async () => {
    await setupFrozen();

    clickLogo(CLICKS_TO_FREEZE);
    flushWipe();
    expect(document.body.classList.contains("frozen")).toBe(true);

    clickLogo(CLICKS_TO_THAW);
    flushWipe();

    expect(document.body.classList.contains("frozen")).toBe(false);
  });

  it("adds the frost-wipe element for the cover phase and removes it after reveal", async () => {
    await setupFrozen();
    clickLogo(CLICKS_TO_FREEZE);

    // Cover phase: the wipe element is in the DOM.
    const wipeDuringCover = document.querySelector(".frost-wipe");
    expect(wipeDuringCover).not.toBeNull();

    flushWipe();

    // After cover + reveal, the wipe element has been removed.
    expect(document.querySelector(".frost-wipe")).toBeNull();
  });

  it("fades in the frost-overlay once force crosses the creep threshold", async () => {
    await setupFrozen();
    const overlay = document.querySelector(".frost-overlay");
    // The overlay element is attached by initFrozen() regardless of force;
    // the indicator's job is to drive its opacity once force exceeds the
    // threshold. Below the threshold, opacity stays at 0.
    expect(overlay).not.toBeNull();

    // Just under threshold: 7 clicks → force 0.28 < FROST_CREEP_AT (0.32).
    clickLogo(7);
    expect(parseFloat(overlay.style.opacity) || 0).toBe(0);

    // The indicator uses progress < FROST_CREEP_AT (strict less-than), so
    // force exactly at the threshold doesn't cross. SLACK_CLICKS lands one
    // click past the boundary.
    const clicksToCross =
      Math.ceil(FROST_CREEP_AT * CLICKS_TO_FREEZE) + SLACK_CLICKS;
    clickLogo(clicksToCross - 7);
    expect(parseFloat(overlay.style.opacity)).toBeGreaterThan(0);
  });

  it("adds frost-card to service cards on activation and removes it on deactivation", async () => {
    await setupFrozen();
    const cards = document.querySelectorAll(".service-card");

    clickLogo(CLICKS_TO_FREEZE);
    flushWipe();

    for (const card of cards) {
      expect(card.classList.contains("frost-card")).toBe(true);
    }

    clickLogo(CLICKS_TO_THAW);
    flushWipe();

    for (const card of cards) {
      expect(card.classList.contains("frost-card")).toBe(false);
    }
  });
});
