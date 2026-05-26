import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// konami.js binds a window keydown listener that drives a sequence
// matcher.  Each test resets modules so the matcher's internal state
// is fresh, then dispatches synthetic KeyboardEvents to exercise it.

describe("themes/konami", () => {
  let mod;
  let registryMock;
  let stopFn;

  beforeEach(async () => {
    document.body.innerHTML = "";
    document.body.className = "";
    vi.useFakeTimers();
    vi.resetModules();

    // Stub the theme registry so the test doesn't pull in every real theme.
    registryMock = {
      ids: ["theme-a", "theme-b", "theme-c"],
      toggled: [],
    };
    vi.doMock("../../../js/themes/registry.js", () => ({
      getThemeIds: () => registryMock.ids.slice(),
      toggleTheme: (id) => registryMock.toggled.push(id),
    }));

    mod = await import("../../../js/themes/konami.js");
    stopFn = mod.initKonami().stop;
  });

  afterEach(() => {
    if (stopFn) stopFn();
    vi.useRealTimers();
    vi.doUnmock("../../../js/themes/registry.js");
  });

  function press(key) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  }

  function pressSequence(keys) {
    for (const k of keys) press(k);
  }

  function getPrompt() {
    return document.querySelector(".konami-confirm-prompt");
  }

  it("does not show the prompt before the full sequence is typed", () => {
    pressSequence(mod._KONAMI_SEQUENCE.slice(0, -1));
    expect(getPrompt()).toBeNull();
  });

  it("shows the confirm prompt after the full sequence", () => {
    pressSequence(mod._KONAMI_SEQUENCE);
    expect(getPrompt()).not.toBeNull();
  });

  it("engages chaos on Enter — dispatches the achievement and toggles each inactive theme", () => {
    const seen = [];
    const onAchievement = (e) => seen.push(e.detail);
    window.addEventListener("achievement", onAchievement);

    pressSequence(mod._KONAMI_SEQUENCE);
    press("Enter");

    expect(seen).toContainEqual({ type: "konami-cheat" });
    expect(registryMock.toggled).toEqual(registryMock.ids);
    expect(getPrompt()).toBeNull();

    window.removeEventListener("achievement", onAchievement);
  });

  it("skips themes whose body class is already set", () => {
    document.body.classList.add("theme-b");
    pressSequence(mod._KONAMI_SEQUENCE);
    press("Enter");
    expect(registryMock.toggled).toEqual(["theme-a", "theme-c"]);
  });

  it("resets the prompt when a non-Enter key is pressed during the confirm window", () => {
    pressSequence(mod._KONAMI_SEQUENCE);
    expect(getPrompt()).not.toBeNull();
    press("x");
    expect(getPrompt()).toBeNull();
    expect(registryMock.toggled).toEqual([]);
  });

  it("auto-cancels the prompt after the timeout", () => {
    pressSequence(mod._KONAMI_SEQUENCE);
    expect(getPrompt()).not.toBeNull();
    vi.advanceTimersByTime(mod._KONAMI_CONFIRM_TIMEOUT_MS);
    expect(getPrompt()).toBeNull();
  });

  it("ignores keys typed inside an input field", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    pressSequence(mod._KONAMI_SEQUENCE);
    expect(getPrompt()).toBeNull();
  });

  it("recovers from a stray first-key press by treating it as a fresh start", () => {
    // Type the first arrow once, then start the real sequence — the
    // soft reset means the stray ArrowUp is reused as position 0.
    press("ArrowUp");
    pressSequence(mod._KONAMI_SEQUENCE.slice(1));
    expect(getPrompt()).not.toBeNull();
  });
});
