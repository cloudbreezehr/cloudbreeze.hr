import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Upside-down gets its own integration file because its wipe is the only
// one in the codebase that's a function (not a config object). The factory
// wraps the wipe's returned Promise with `.finally(() => isTransitioning =
// false)`, and that async code path is only exercised against a stub in
// factory.test.js. This file runs it against real playback — the real
// runSlidingWipe, real setTimeout-based phase gates, real DOM sliding.
//
// Scope: wire-up smoke for the async-wipe path, not for the overscroll
// trigger (which is separately unit-tested in triggers-overscroll.test.js).
// Activation is driven through `toggleTheme("upside-down", opts)` — the
// registered toggle calls the real complete() → real runSlidingWipe, which
// is the code we're here to exercise. Drivng it through real wheel events
// would add no coverage of the wipe path that this file targets, and the
// drain-loop timing makes that route impractical under fake timers anyway.

// ── Upside-down wipe timings mirrored from the source ──
const WIPE_PHASE_MS = 500;
const WIPE_SETTLE_MS = 550;
// Real wipe: setTimeout(settle) → runMidpoint + rAF → setTimeout(settle) →
// resolve. Advancing past settle*2 + phase + a bit covers the full sequence.
const WIPE_FLUSH_MS = WIPE_SETTLE_MS * 2 + WIPE_PHASE_MS + 100;

function stageDom() {
  document.body.innerHTML = `
    <nav></nav>
    <div class="page">
      <svg class="cloud-svg"></svg>
      <div class="service-card"></div>
      <div class="service-card"></div>
    </div>
    <div id="bg-canvas"></div>
  `;
}

async function setupUpsideDown() {
  vi.resetModules();
  stageDom();
  const { initUpsideDown } = await import("../../js/themes/upside-down.js");
  initUpsideDown();
  // Re-import toggleTheme from the same fresh registry the theme registered
  // into — a static import at file top would hold the *previous* module
  // instance after vi.resetModules(), with no toggle bound.
  const { toggleTheme } = await import("../../js/themes/registry.js");
  return { toggleTheme };
}

// Drive the factory through its async wipe path to completion.
async function completeAsyncWipe() {
  vi.advanceTimersByTime(WIPE_FLUSH_MS);
  // The factory wraps the wipe promise in .finally(); flush microtasks
  // so `isTransitioning` releases before the next complete() call lands.
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
  await Promise.resolve();
}

describe("theme-upside-down integration (async wipe)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
    window.scrollTo = vi.fn();
    if (!Element.prototype.animate) {
      Element.prototype.animate = function () {
        const handle = { onfinish: null };
        queueMicrotask(() => handle.onfinish && handle.onfinish());
        return handle;
      };
    }
    // Scroll staging — the init's overscroll trigger reads scrollHeight
    // at bind time. Values don't matter for these tests (we drive via
    // toggleTheme) but the properties must exist.
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 1000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete window.scrollTo;
  });

  it("activates the body class after the async wipe resolves", async () => {
    const { toggleTheme } = await setupUpsideDown();

    toggleTheme("upside-down", { direction: "bottom" });
    await completeAsyncWipe();

    expect(document.body.classList.contains("upside-down")).toBe(true);
  });

  it("adds the ud-wipe element during the wipe and removes it after settle", async () => {
    const { toggleTheme } = await setupUpsideDown();

    toggleTheme("upside-down", { direction: "bottom" });

    // Mid-wipe: element is in the DOM.
    expect(document.querySelector(".ud-wipe")).not.toBeNull();

    await completeAsyncWipe();

    expect(document.querySelector(".ud-wipe")).toBeNull();
  });

  it("fires exactly one theme-activate achievement event on activation", async () => {
    const { toggleTheme } = await setupUpsideDown();
    const listener = vi.fn();
    window.addEventListener("achievement", listener);

    toggleTheme("upside-down", { direction: "bottom" });
    await completeAsyncWipe();
    window.removeEventListener("achievement", listener);

    const activations = listener.mock.calls.filter(
      (c) =>
        c[0].detail.type === "theme-activate" &&
        c[0].detail.theme === "upside-down",
    );
    expect(activations).toHaveLength(1);
  });

  it("adds upside-card class to service cards on activation", async () => {
    const { toggleTheme } = await setupUpsideDown();

    toggleTheme("upside-down", { direction: "bottom" });
    await completeAsyncWipe();

    const cards = document.querySelectorAll(".service-card");
    for (const card of cards) {
      expect(card.classList.contains("upside-card")).toBe(true);
    }
  });

  it("releases the transition lock after the async wipe so deactivation runs", async () => {
    const { toggleTheme } = await setupUpsideDown();

    toggleTheme("upside-down", { direction: "bottom" });
    await completeAsyncWipe();
    expect(document.body.classList.contains("upside-down")).toBe(true);

    toggleTheme("upside-down", { direction: "top" });
    await completeAsyncWipe();

    expect(document.body.classList.contains("upside-down")).toBe(false);
  });
});
