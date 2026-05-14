import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Shared cross-mode integration test: exercises the contract that every
// mode's init() promises — activation applies the body class, fires a
// single mode-activate event, and wires up its card class on real
// .service-card elements via enableCardEffects(). This is the smoke layer:
// "if any of these break, something is wrong with the wire-up."
//
// Scope intentionally narrow. Per-mode indicator details stay in
// mode-<name>.integration.test.js files (currently frozen only), and
// upside-down's async-wipe path has its own dedicated test (see TODO.md).
// Frozen is also excluded here because it already has a deep integration
// test — no point running the smoke against it too.

// ── Wipe timing (shared across config-style wipes) ──
// All four modes in this file use a wipe config with coverMs around the
// same order of magnitude; advancing 2 seconds of fake time covers the
// cover + reveal phases for all of them.
const WIPE_FLUSH_MS = 2000;

function flushWipe() {
  vi.advanceTimersByTime(WIPE_FLUSH_MS);
}

function stageSharedDom(extra = "") {
  // The set of selectors each mode's init() reaches for. Staged as a
  // superset so the same DOM works for every mode — individual modes
  // ignore the elements they don't touch.
  document.body.innerHTML = `
    <nav>
      <a class="nav-logo" href="#"></a>
      <button class="appearance-toggle"></button>
    </nav>
    <main>
      <span class="hero-tag"></span>
      <div class="page">
        <svg class="cloud-svg"></svg>
      </div>
      <div class="service-card"></div>
      <div class="service-card"></div>
    </main>
    <footer></footer>
    <div id="bg-canvas"></div>
    ${extra}
  `;
}

// ── Activation recipes ──
// Each mode declares how many real user inputs produce one activation.
// The recipes drive the real trigger (click dispatches, key events, hold
// timers) rather than calling internal methods.

function clickActivation(selector, count) {
  return () => {
    const el = document.querySelector(selector);
    for (let i = 0; i < count; i++) {
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    }
  };
}

function typeActivation(word) {
  return () => {
    for (const letter of word) {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: letter, bubbles: true }),
      );
    }
  };
}

function holdFooterActivation(ms) {
  return () => {
    // deep-sea's shouldAccept calls footer.getBoundingClientRect(); happy-dom
    // returns zero-rects, so staging needs a footer with a positive rect.
    // Since we can't force a real layout, the shouldAccept gate is what we
    // stub per-test by putting the pointerdown at coordinates the rect
    // covers once we override getBoundingClientRect.
    const footer = document.querySelector("footer");
    footer.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    });
    const down = new Event("pointerdown", { bubbles: true, cancelable: true });
    Object.defineProperty(down, "clientX", { value: 50 });
    Object.defineProperty(down, "clientY", { value: 50 });
    document.dispatchEvent(down);
    vi.advanceTimersByTime(ms + 100);
  };
}

// ── Mode cases ──
// Each case describes one mode's wire-up: how to initialize it, how to
// activate it, and what the activation produces. Upside-down is absent:
// its async-wipe path needs dedicated coverage (see TODO.md).
//
// Adding a new mode here is a deliberate decision, not a default. Each
// case adds ~150ms to the suite and re-verifies a contract that
// factory.test.js + the mode's own unit tests already cover
// component-by-component. The value of this file is the cross-mode
// smoke: "all modes wire up through the same contract." That value is
// realized once. Adding case #5 buys diminishing coverage.
//
// When a new mode lands, the default answer is: don't add it here.
// Only add it if the mode's init() has failure modes that feel
// meaningfully different from the four cases below — and if so, say
// what in a commit message.

const MODE_CASES = [
  {
    id: "blocky",
    cardClass: "pixel-card",
    async init() {
      const toggle = document.querySelector(".appearance-toggle");
      const { initBlocky } = await import("../../js/modes/blocky.js");
      initBlocky(toggle);
    },
    activate: clickActivation(".appearance-toggle", 20),
  },
  {
    id: "rainy",
    cardClass: "rain-card",
    async init() {
      const { initRainy } = await import("../../js/modes/rainy.js");
      initRainy();
    },
    activate: clickActivation(".hero-tag", 15),
  },
  {
    id: "deep-sea",
    cardClass: "caustic-card",
    async init() {
      const { initDeepSea } = await import("../../js/modes/deep-sea.js");
      initDeepSea();
    },
    activate: holdFooterActivation(10000),
  },
  {
    id: "paper",
    cardClass: "paper-card",
    async init() {
      const { initPaper } = await import("../../js/modes/paper.js");
      initPaper();
    },
    activate: typeActivation("SKETCH"),
  },
];

describe.each(MODE_CASES)(
  "mode-$id integration (shared contract)",
  ({ id, cardClass, init, activate }) => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-08T12:00:00"));
      window.scrollTo = vi.fn();
      // Web Animations API shim — several modes spawn self-cleaning DOM
      // particles (ripples, breath, strokes) via el.animate(). happy-dom
      // doesn't provide it.
      if (!Element.prototype.animate) {
        Element.prototype.animate = function () {
          const handle = { onfinish: null };
          queueMicrotask(() => handle.onfinish && handle.onfinish());
          return handle;
        };
      }
      stageSharedDom();
      vi.resetModules();
    });

    afterEach(() => {
      vi.useRealTimers();
      document.body.innerHTML = "";
      delete window.scrollTo;
    });

    it("applies the body class on activation", async () => {
      await init();

      activate();
      flushWipe();

      expect(document.body.classList.contains(id)).toBe(true);
    });

    it("fires exactly one mode-activate event on activation", async () => {
      await init();
      const listener = vi.fn();
      window.addEventListener("achievement", listener);

      activate();
      flushWipe();
      window.removeEventListener("achievement", listener);

      const activateEvents = listener.mock.calls.filter(
        (c) => c[0].detail.type === "mode-activate" && c[0].detail.mode === id,
      );
      expect(activateEvents).toHaveLength(1);
    });

    it("adds the mode's card class to every .service-card on activation", async () => {
      await init();

      activate();
      flushWipe();

      const cards = document.querySelectorAll(".service-card");
      for (const card of cards) {
        expect(card.classList.contains(cardClass)).toBe(true);
      }
    });
  },
);
