import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The precise-location controls: a floating corner button plus the popover it
// (and a one-time auto-nudge) opens. Tests run under reduced motion so close()
// removes the card synchronously, and stub navigator.permissions +
// navigator.geolocation to drive the permission state and the native fix
// through the real requestPreciseLocation.

describe("real-sky/location-prompt", () => {
  let events;
  let onAchievement;

  function stubNavigator({ permission = "prompt", geo } = {}) {
    vi.stubGlobal("navigator", {
      permissions: { query: vi.fn(async () => ({ state: permission })) },
      geolocation: {
        getCurrentPosition:
          geo || ((ok) => ok({ coords: { latitude: 45.8, longitude: 15.9 } })),
      },
    });
  }

  // motion.js samples matchMedia at import, so set it before loading the module.
  async function load() {
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    return import("../../../js/real-sky/location-prompt.js");
  }

  const button = () => document.querySelector(".location-button");
  const popover = () => document.querySelector(".location-prompt");
  const flush = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.body.innerHTML = "";
    events = [];
    onAchievement = (e) => events.push(e.detail);
    window.addEventListener("achievement", onAchievement);
  });

  afterEach(() => {
    window.removeEventListener("achievement", onAchievement);
    vi.unstubAllGlobals();
    delete window.matchMedia;
  });

  it("mounts a floating corner button", async () => {
    stubNavigator({ permission: "prompt" });
    const { mountLocationControls } = await load();
    mountLocationControls({ onUpgrade: () => {} });
    expect(button()).toBeTruthy();
    expect(popover()).toBeNull(); // passive — nothing opens until asked
  });

  it("opens the popover when the button is clicked", async () => {
    stubNavigator({ permission: "prompt" });
    const { mountLocationControls } = await load();
    mountLocationControls({ onUpgrade: () => {} });
    button().click();
    expect(popover()).toBeTruthy();
  });

  it("Enable upgrades, awards you-are-here, removes the button, and closes", async () => {
    stubNavigator({ permission: "prompt" });
    const onUpgrade = vi.fn();
    const { mountLocationControls } = await load();
    mountLocationControls({ onUpgrade });
    button().click();

    document.querySelector(".location-prompt-enable").click();
    await flush();

    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual({ type: "precise-location" });
    expect(popover()).toBeNull();
    expect(button()).toBeNull();
  });

  it("a blocked Enable keeps the button and shows a hint, no award", async () => {
    stubNavigator({
      permission: "prompt",
      geo: (_ok, err) => err({ code: 1 }),
    });
    const onUpgrade = vi.fn();
    const { mountLocationControls } = await load();
    mountLocationControls({ onUpgrade });
    button().click();

    document.querySelector(".location-prompt-enable").click();
    await flush();

    expect(onUpgrade).not.toHaveBeenCalled();
    expect(events).toEqual([]);
    // Card stays open with a hint; the button remains as the way back.
    expect(popover()).toBeTruthy();
    expect(button()).toBeTruthy();
  });

  it("Dismiss closes the popover but leaves the button", async () => {
    stubNavigator({ permission: "prompt" });
    const { mountLocationControls } = await load();
    mountLocationControls({ onUpgrade: () => {} });
    button().click();

    document.querySelector(".location-prompt-dismiss").click();
    await flush();

    expect(popover()).toBeNull();
    expect(button()).toBeTruthy();
    // Still reachable — the button reopens it.
    button().click();
    expect(popover()).toBeTruthy();
  });

  describe("offerOnce", () => {
    it("opens the popover when the permission is undecided", async () => {
      stubNavigator({ permission: "prompt" });
      const { mountLocationControls } = await load();
      const controls = mountLocationControls({ onUpgrade: () => {} });
      await controls.offerOnce();
      expect(popover()).toBeTruthy();
    });

    it("does not open when the permission is already denied", async () => {
      stubNavigator({ permission: "denied" });
      const { mountLocationControls } = await load();
      const controls = mountLocationControls({ onUpgrade: () => {} });
      await controls.offerOnce();
      expect(popover()).toBeNull();
      // The button still stands as the silent way back.
      expect(button()).toBeTruthy();
    });

    it("offers at most once", async () => {
      stubNavigator({ permission: "prompt" });
      const { mountLocationControls } = await load();
      const controls = mountLocationControls({ onUpgrade: () => {} });
      await controls.offerOnce();
      popover()?.remove();
      await controls.offerOnce();
      expect(popover()).toBeNull();
    });
  });

  describe("usePreciseLocationIfGranted", () => {
    it("upgrades silently on a standing grant, without awarding", async () => {
      stubNavigator({ permission: "granted" });
      const onUpgrade = vi.fn();
      const { usePreciseLocationIfGranted } = await load();
      const upgraded = await usePreciseLocationIfGranted(onUpgrade);
      expect(upgraded).toBe(true);
      expect(onUpgrade).toHaveBeenCalledTimes(1);
      // The achievement rewards the deliberate Enable, not this reuse.
      expect(events).toEqual([]);
    });

    it("is a no-op when the permission is not granted", async () => {
      stubNavigator({ permission: "prompt" });
      const onUpgrade = vi.fn();
      const { usePreciseLocationIfGranted } = await load();
      expect(await usePreciseLocationIfGranted(onUpgrade)).toBe(false);
      expect(onUpgrade).not.toHaveBeenCalled();
    });
  });
});
