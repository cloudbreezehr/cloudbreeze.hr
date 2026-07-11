import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Drives the HUD through the public `spell-progress` event. The dev-view gate
// is the body `dev-active` class (same signal the achievement tally uses), so
// tests toggle that to switch between the normal and karaoke renders.

describe("effects/spell-accumulator", () => {
  let hud;
  let SACC;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    document.body.className = "";
    // Motion on by default; the merge animation runs. Element.animate is
    // shimmed (happy-dom has none) to fire onfinish so the merge completes.
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    });
    if (!Element.prototype.animate) {
      Element.prototype.animate = function () {
        const handle = { onfinish: null, cancel() {} };
        queueMicrotask(() => handle.onfinish && handle.onfinish());
        return handle;
      };
    }
  });

  afterEach(() => {
    if (hud) hud.stop();
    hud = null;
    vi.useRealTimers();
    delete window.matchMedia;
    delete Element.prototype.animate;
  });

  async function mount() {
    vi.resetModules();
    const mod = await import("../../../js/effects/spell-accumulator.js");
    SACC = mod.SACC;
    hud = mod.initSpellAccumulatorHud();
  }

  const root = () => document.querySelector(".spell-acc");
  const words = () => root().querySelectorAll(".spell-acc__word");
  const letters = () => root().querySelectorAll(".spell-acc__letter");

  function progress(candidates) {
    window.dispatchEvent(
      new CustomEvent("spell-progress", { detail: { candidates } }),
    );
  }
  const cand = (word, matched, extra = {}) => ({
    id: word.toLowerCase(),
    word,
    matched,
    charge: 0,
    chargeChar: null,
    ...extra,
  });

  it("mounts a hidden accumulator element", async () => {
    await mount();
    expect(root()).not.toBeNull();
    expect(root().classList.contains("spell-acc--visible")).toBe(false);
  });

  it("shows only the entered letters once a chain reaches the minimum", async () => {
    await mount();
    progress([cand("PAPER", 2)]);
    expect(root().classList.contains("spell-acc--visible")).toBe(true);
    // The full word is rendered, but un-pressed letters are tagged for hiding.
    expect(letters()).toHaveLength(5);
    const pressed = [...letters()].filter(
      (l) => !l.classList.contains("spell-acc__letter--empty"),
    );
    expect(pressed.map((l) => l.textContent).join("")).toBe("PA");
  });

  it("stays hidden below the minimum length for normal users", async () => {
    await mount();
    progress([cand("PAPER", SACC.MIN_LETTERS - 1)]);
    expect(root().classList.contains("spell-acc--visible")).toBe(false);
  });

  it("renders only the leading candidate for normal users", async () => {
    await mount();
    progress([cand("PAPER", 2), cand("PULSE", 2)]);
    expect(words()).toHaveLength(1);
  });

  it("shows every candidate, even single letters, for dev users", async () => {
    await mount();
    document.body.classList.add("dev-active");
    progress([cand("PAPER", 1), cand("PULSE", 1)]);
    expect(root().classList.contains("spell-acc--visible")).toBe(true);
    expect(root().classList.contains("spell-acc--dev")).toBe(true);
    expect(words()).toHaveLength(2);
  });

  it("re-renders when the dev console toggles without a new letter", async () => {
    await mount();
    progress([cand("PAPER", 2), cand("PULSE", 2)]);
    expect(words()).toHaveLength(1);
    document.body.classList.add("dev-active");
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "dev-console-open" } }),
    );
    expect(words()).toHaveLength(2);
  });

  it("inserts surplus charge letters right after the entered chargeChar run", async () => {
    await mount();
    document.body.classList.add("dev-active");
    progress([cand("BOOM", 3, { charge: 2, chargeChar: "O" })]);
    const spans = [...letters()];
    // B O O + (O O charge) + M — the extra O's sit before the pending M.
    expect(spans.map((l) => l.textContent).join("")).toBe("BOOOOM");
    expect(
      spans.filter((l) => l.classList.contains("spell-acc__letter--charge")),
    ).toHaveLength(2);
    const lastCharge = spans.findLastIndex((l) =>
      l.classList.contains("spell-acc__letter--charge"),
    );
    const pendingM = spans.findIndex((l) =>
      l.classList.contains("spell-acc__letter--empty"),
    );
    expect(lastCharge).toBeLessThan(pendingM);
  });

  it("hides after the linger window with no further letters", async () => {
    await mount();
    progress([cand("PAPER", 3)]);
    expect(root().classList.contains("spell-acc--visible")).toBe(true);
    vi.advanceTimersByTime(SACC.LINGER_MS + 1);
    expect(root().classList.contains("spell-acc--visible")).toBe(false);
  });

  it("hides when nothing is in progress", async () => {
    await mount();
    progress([cand("PAPER", 3)]);
    progress([]);
    expect(root().classList.contains("spell-acc--visible")).toBe(false);
  });

  it("flashes the whole completed word, then fades after the hold", async () => {
    await mount();
    window.dispatchEvent(
      new CustomEvent("spell-progress", {
        detail: { candidates: [], completed: { word: "STORM" } },
      }),
    );
    expect(root().classList.contains("spell-acc--visible")).toBe(true);
    // The full word shows — no un-pressed letters left over.
    expect([...letters()].map((l) => l.textContent).join("")).toBe("STORM");
    expect(root().querySelectorAll(".spell-acc__letter--empty")).toHaveLength(
      0,
    );
    vi.advanceTimersByTime(SACC.COMPLETE_HOLD_MS + 1);
    expect(root().classList.contains("spell-acc--visible")).toBe(false);
  });

  it("merges surplus charge letters into the word, landing on the clean word", async () => {
    await mount();
    window.dispatchEvent(
      new CustomEvent("spell-progress", {
        detail: {
          candidates: [],
          completed: { word: "BOOM", charge: 3, chargeChar: "O" },
        },
      }),
    );
    // The full charged echo shows first: B O O + three surplus O's + M.
    expect([...letters()].map((l) => l.textContent).join("")).toBe("BOOOOOM");
    expect(root().querySelectorAll(".spell-acc__letter--charge")).toHaveLength(
      3,
    );
    // After the merge animation, the surplus is gone and the clean word remains.
    await Promise.resolve();
    expect([...letters()].map((l) => l.textContent).join("")).toBe("BOOM");
    expect(root().querySelectorAll(".spell-acc__letter--charge")).toHaveLength(
      0,
    );
    expect(root().classList.contains("spell-acc--complete")).toBe(true);
  });

  it("marks a row maxed when the candidate is at its charge cap", async () => {
    await mount();
    document.body.classList.add("dev-active"); // show surplus regardless of width
    progress([cand("BOOM", 3, { charge: 2, chargeChar: "O", maxed: true })]);
    expect(root().querySelector(".spell-acc__word--maxed")).not.toBeNull();
  });

  it("marks the completed word maxed when it finished at the cap", async () => {
    await mount();
    window.dispatchEvent(
      new CustomEvent("spell-progress", {
        detail: {
          candidates: [],
          completed: { word: "BOOM", charge: 2, chargeChar: "O", maxed: true },
        },
      }),
    );
    expect(root().querySelector(".spell-acc__word--maxed")).not.toBeNull();
  });

  it("caps surplus letters to a ×N count when the row would overflow", async () => {
    await mount();
    // happy-dom has no layout; stub it so the row overflows and each glyph
    // advances a fixed step (uniform, as in the real monospace row).
    const ADV = 10;
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 333,
    });
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function () {
        if (this.classList.contains("spell-acc__word")) {
          const w = this.children.length * ADV;
          return { left: 0, right: w, width: w, top: 0, bottom: 0, height: 0 };
        }
        const idx = this.parentElement
          ? [...this.parentElement.children].indexOf(this)
          : 0;
        return {
          left: idx * ADV,
          right: idx * ADV + ADV,
          width: ADV,
          top: 0,
          bottom: 0,
          height: 0,
        };
      });

    progress([cand("BOOM", 3, { charge: 40, chargeChar: "O" })]);

    const count = root().querySelector(".spell-acc__count");
    expect(count).not.toBeNull();
    expect(count.textContent).toBe("×40"); // the true charge, not the shown glyphs
    const shown = root().querySelectorAll(".spell-acc__letter--charge").length;
    expect(shown).toBeGreaterThan(0); // some glyphs kept
    expect(shown).toBeLessThan(40); // but capped below the true count

    rectSpy.mockRestore();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: originalWidth,
    });
  });
});
