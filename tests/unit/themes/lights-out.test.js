import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// lights-out.js binds a document keydown listener that fires when two
// Escape presses land within LIGHTS_OUT_WINDOW_MS.  Tests reset modules
// so the internal _lastEscTime is fresh each run.

describe("themes/lights-out", () => {
  let mod;
  let registryMock;
  let stopFn;

  beforeEach(async () => {
    document.body.innerHTML = "";
    document.body.className = "";
    vi.useFakeTimers();
    vi.resetModules();

    registryMock = {
      themes: [
        { id: "frozen" },
        { id: "deep-sea" },
        { id: "vhs", ownsEscape: true },
      ],
      toggled: [],
    };
    vi.doMock("../../../js/themes/registry.js", () => ({
      getThemes: () => registryMock.themes.slice(),
      toggleTheme: (id, opts) => registryMock.toggled.push({ id, opts }),
    }));

    mod = await import("../../../js/themes/lights-out.js");
    stopFn = mod.initLightsOut().stop;
  });

  afterEach(() => {
    if (stopFn) stopFn();
    vi.useRealTimers();
    vi.doUnmock("../../../js/themes/registry.js");
  });

  function pressEsc(modifiers = {}) {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        ...modifiers,
      }),
    );
  }

  function doubleTapEsc() {
    pressEsc();
    vi.advanceTimersByTime(mod.LIGHTS_OUT_WINDOW_MS / 2);
    pressEsc();
  }

  it("does not clear themes on a single Escape", () => {
    document.body.classList.add("frozen");
    pressEsc();
    expect(registryMock.toggled).toHaveLength(0);
  });

  it("clears active themes on a fast double-tap Escape", () => {
    document.body.classList.add("frozen");
    document.body.classList.add("deep-sea");
    doubleTapEsc();
    expect(registryMock.toggled).toEqual([
      { id: "frozen", opts: { silent: true } },
      { id: "deep-sea", opts: { silent: true } },
    ]);
  });

  it("does nothing when no theme is active", () => {
    doubleTapEsc();
    expect(registryMock.toggled).toHaveLength(0);
  });

  it("yields to a sole Escape-owning theme so its own exit gesture runs", () => {
    document.body.classList.add("vhs");
    doubleTapEsc();
    expect(registryMock.toggled).toHaveLength(0);
  });

  it("still clears when an Escape-owning theme is stacked with another", () => {
    document.body.classList.add("frozen");
    document.body.classList.add("vhs");
    doubleTapEsc();
    expect(registryMock.toggled).toEqual([
      { id: "frozen", opts: { silent: true } },
      { id: "vhs", opts: { silent: true } },
    ]);
  });

  it("does not fire when presses are outside the window", () => {
    document.body.classList.add("frozen");
    pressEsc();
    vi.advanceTimersByTime(mod.LIGHTS_OUT_WINDOW_MS + 50);
    pressEsc();
    expect(registryMock.toggled).toHaveLength(0);
  });

  it("ignores Escape with a modifier key held", () => {
    document.body.classList.add("frozen");
    pressEsc({ ctrlKey: true });
    vi.advanceTimersByTime(mod.LIGHTS_OUT_WINDOW_MS / 2);
    pressEsc({ ctrlKey: true });
    expect(registryMock.toggled).toHaveLength(0);
  });

  it("ignores Escape when an input element is focused", () => {
    document.body.classList.add("frozen");
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    pressEsc();
    vi.advanceTimersByTime(mod.LIGHTS_OUT_WINDOW_MS / 2);
    pressEsc();
    expect(registryMock.toggled).toHaveLength(0);
  });

  it("resets the latch after firing so a rapid third press does not re-trigger", () => {
    document.body.classList.add("frozen");
    doubleTapEsc();
    expect(registryMock.toggled).toHaveLength(1);

    // Third press immediately after — _lastEscTime was reset to 0
    pressEsc();
    expect(registryMock.toggled).toHaveLength(1);
  });
});
