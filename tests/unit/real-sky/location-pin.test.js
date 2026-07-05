import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The inline precise-location pin, the card it opens, and the silent
// standing-grant path. Runs under reduced motion so the card's close removes it
// synchronously; stubs navigator.permissions + navigator.geolocation to drive
// the permission state and the native fix through the real requestPreciseLocation.

describe("real-sky/location-pin", () => {
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

  // motion.js samples matchMedia at import, so set it before loading.
  async function load() {
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    return import("../../../js/real-sky/location-pin.js");
  }

  const card = () => document.querySelector(".location-prompt");
  const tooltip = () => document.querySelector(".achievement-tooltip");
  const flush = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => {
    vi.resetModules();
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

  describe("createLocationPin", () => {
    it("starts hidden and toggles with setVisible", async () => {
      stubNavigator();
      const { createLocationPin } = await load();
      const pin = createLocationPin({ onUpgrade: () => {} });
      expect(pin.el.hidden).toBe(true);
      pin.setVisible(true);
      expect(pin.el.hidden).toBe(false);
      pin.setVisible(false);
      expect(pin.el.hidden).toBe(true);
    });

    it("opens an explaining, reassuring card on tap (no native title)", async () => {
      stubNavigator();
      const { createLocationPin } = await load();
      const pin = createLocationPin({ onUpgrade: () => {} });
      document.body.appendChild(pin.el);
      expect(pin.el.getAttribute("title")).toBeNull();
      pin.setVisible(true);
      pin.el.click();
      expect(card()).toBeTruthy();
      expect(card().querySelector(".location-prompt-note").textContent).toMatch(
        /never saved/i,
      );
    });

    it("Enable upgrades, fires the achievement, retires the pin, and closes", async () => {
      stubNavigator({ permission: "prompt" });
      const onUpgrade = vi.fn();
      const { createLocationPin } = await load();
      const pin = createLocationPin({ onUpgrade });
      document.body.appendChild(pin.el);
      pin.setVisible(true);
      pin.el.click();

      card().querySelector(".location-prompt-enable").click();
      await flush();

      expect(onUpgrade).toHaveBeenCalledTimes(1);
      expect(events).toContainEqual({ type: "precise-location" });
      expect(pin.el.hidden).toBe(true); // retired
      expect(card()).toBeNull(); // closed
    });

    it("reports a browser block instead of doing nothing", async () => {
      stubNavigator({
        permission: "prompt",
        geo: (_ok, err) => err({ code: 1 }),
      });
      const onUpgrade = vi.fn();
      const { createLocationPin } = await load();
      const pin = createLocationPin({ onUpgrade });
      document.body.appendChild(pin.el);
      pin.setVisible(true);
      pin.el.click();

      card().querySelector(".location-prompt-enable").click();
      await flush();

      expect(onUpgrade).not.toHaveBeenCalled();
      expect(events).toEqual([]);
      expect(card()).toBeTruthy(); // stays open with the explanation
      expect(card().querySelector(".location-prompt-msg").textContent).toMatch(
        /blocked/i,
      );
      expect(card().querySelector(".location-prompt-enable")).toBeNull();
      expect(pin.el.hidden).toBe(false); // not retired
    });

    it("does not toggle the badge — its tap doesn't bubble", async () => {
      stubNavigator();
      const { createLocationPin } = await load();
      const pin = createLocationPin({ onUpgrade: () => {} });
      const badge = document.createElement("p");
      const badgeClick = vi.fn();
      badge.addEventListener("click", badgeClick);
      badge.appendChild(pin.el);
      document.body.appendChild(badge);

      pin.el.click();
      expect(badgeClick).not.toHaveBeenCalled();
    });

    it("shows the hint tooltip on hover", async () => {
      stubNavigator();
      const { createLocationPin } = await load();
      const pin = createLocationPin({ onUpgrade: () => {} });
      pin.el.dispatchEvent(new Event("mouseenter"));
      expect(tooltip().classList.contains("visible")).toBe(true);
      expect(tooltip().textContent).toBe("Use precise location");
    });
  });

  it("the pin and card are in the canvas overlay selector (no click-through)", async () => {
    const { UI_OVERLAY_SELECTOR } = await import("../../../js/selectors.js");
    expect(UI_OVERLAY_SELECTOR).toContain(".location-pin");
    expect(UI_OVERLAY_SELECTOR).toContain(".location-prompt");
  });

  describe("usePreciseLocationIfGranted", () => {
    it("upgrades silently on a standing grant, without awarding", async () => {
      stubNavigator({ permission: "granted" });
      const onUpgrade = vi.fn();
      const { usePreciseLocationIfGranted } = await load();
      expect(await usePreciseLocationIfGranted(onUpgrade)).toBe(true);
      expect(onUpgrade).toHaveBeenCalledTimes(1);
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
