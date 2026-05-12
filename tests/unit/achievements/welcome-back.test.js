import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// welcome-back fires the activation toast on init for returning users
// with progress, gated to once per browser tab via sessionStorage.
// storage.js owns the "is active / how many unlocked" signal; tests
// stub the toast callback to observe what message would be shown.

describe("achievements/welcome-back", () => {
  let mod;
  let storage;
  let showActivationToast;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.resetModules();

    mod = await import("../../../js/achievements/welcome-back.js");
    storage = await import("../../../js/achievements/storage.js");
    storage.load();

    showActivationToast = vi.fn();
  });

  afterEach(() => {
    mod._resetForTests();
    vi.useRealTimers();
  });

  it("does not fire when Cloudlog isn't active", () => {
    mod.maybeShowWelcomeBack(showActivationToast);
    vi.advanceTimersByTime(10000);
    expect(showActivationToast).not.toHaveBeenCalled();
  });

  it("does not fire when the user has zero unlocks", () => {
    storage.activate();
    mod.maybeShowWelcomeBack(showActivationToast);
    vi.advanceTimersByTime(10000);
    expect(showActivationToast).not.toHaveBeenCalled();
  });

  it("does not fire when every achievement is already unlocked", async () => {
    const { ACHIEVEMENTS } =
      await import("../../../js/achievements/registry.js");
    storage.activate();
    for (const ach of ACHIEVEMENTS) storage.unlock(ach.id);
    mod.maybeShowWelcomeBack(showActivationToast);
    vi.advanceTimersByTime(10000);
    expect(showActivationToast).not.toHaveBeenCalled();
  });

  it("fires on init with the secrets-remaining count", async () => {
    const { ACHIEVEMENTS } =
      await import("../../../js/achievements/registry.js");
    storage.activate();
    storage.unlock(ACHIEVEMENTS[0].id);
    const remaining = ACHIEVEMENTS.length - 1;

    mod.maybeShowWelcomeBack(showActivationToast);
    vi.advanceTimersByTime(1000);

    expect(showActivationToast).toHaveBeenCalledTimes(1);
    expect(showActivationToast.mock.calls[0][0]).toContain(`${remaining}`);
    expect(showActivationToast.mock.calls[0][0].toLowerCase()).toContain(
      "welcome back",
    );
  });

  it("uses singular 'secret' when only one is left", async () => {
    const { ACHIEVEMENTS } =
      await import("../../../js/achievements/registry.js");
    storage.activate();
    for (let i = 0; i < ACHIEVEMENTS.length - 1; i++) {
      storage.unlock(ACHIEVEMENTS[i].id);
    }
    mod.maybeShowWelcomeBack(showActivationToast);
    vi.advanceTimersByTime(1000);
    expect(showActivationToast.mock.calls[0][0]).toMatch(/\b1 secret\b/);
  });

  it("does not re-fire on a subsequent maybeShowWelcomeBack call within the same session", async () => {
    const { ACHIEVEMENTS } =
      await import("../../../js/achievements/registry.js");
    storage.activate();
    storage.unlock(ACHIEVEMENTS[0].id);

    mod.maybeShowWelcomeBack(showActivationToast);
    vi.advanceTimersByTime(1000);
    expect(showActivationToast).toHaveBeenCalledTimes(1);

    // Second init within the same tab — should be a no-op.
    mod.maybeShowWelcomeBack(showActivationToast);
    vi.advanceTimersByTime(1000);
    expect(showActivationToast).toHaveBeenCalledTimes(1);
  });
});
