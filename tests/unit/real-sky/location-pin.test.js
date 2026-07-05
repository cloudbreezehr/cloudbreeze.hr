import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The inline precise-location pin and the silent standing-grant path. Stub
// navigator.permissions + navigator.geolocation to drive the permission state
// and the native fix through the real requestPreciseLocation.

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

  const load = () => import("../../../js/real-sky/location-pin.js");
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

    it("upgrades, fires the achievement, and retires on a successful tap", async () => {
      stubNavigator({ permission: "prompt" });
      const onUpgrade = vi.fn();
      const { createLocationPin } = await load();
      const pin = createLocationPin({ onUpgrade });
      pin.setVisible(true);

      pin.el.click();
      await flush();

      expect(onUpgrade).toHaveBeenCalledTimes(1);
      expect(events).toContainEqual({ type: "precise-location" });
      expect(pin.el.hidden).toBe(true); // retired
      pin.setVisible(true); // retired means it can't come back
      expect(pin.el.hidden).toBe(true);
    });

    it("stays offered and awards nothing when the request is blocked", async () => {
      stubNavigator({
        permission: "prompt",
        geo: (_ok, err) => err({ code: 1 }),
      });
      const onUpgrade = vi.fn();
      const { createLocationPin } = await load();
      const pin = createLocationPin({ onUpgrade });
      pin.setVisible(true);

      pin.el.click();
      await flush();

      expect(onUpgrade).not.toHaveBeenCalled();
      expect(events).toEqual([]);
      expect(pin.el.hidden).toBe(false); // still there to retry
    });

    it("does not toggle the badge — its click doesn't bubble", async () => {
      stubNavigator();
      const { createLocationPin } = await load();
      const pin = createLocationPin({ onUpgrade: () => {} });
      const badge = document.createElement("p");
      const badgeClick = vi.fn();
      badge.addEventListener("click", badgeClick);
      badge.appendChild(pin.el);
      document.body.appendChild(badge);

      pin.el.click();
      await flush();

      expect(badgeClick).not.toHaveBeenCalled();
    });

    it("explains itself through the hint tooltip, not the native title", async () => {
      stubNavigator();
      const { createLocationPin } = await load();
      const pin = createLocationPin({ onUpgrade: () => {} });
      expect(pin.el.getAttribute("title")).toBeNull();

      pin.el.dispatchEvent(new Event("mouseenter"));
      expect(tooltip().classList.contains("visible")).toBe(true);
      expect(tooltip().textContent).toBe("Use precise location");

      pin.el.dispatchEvent(new Event("mouseleave"));
      expect(tooltip().classList.contains("visible")).toBe(false);
    });
  });

  describe("usePreciseLocationIfGranted", () => {
    it("upgrades silently on a standing grant, without awarding", async () => {
      stubNavigator({ permission: "granted" });
      const onUpgrade = vi.fn();
      const { usePreciseLocationIfGranted } = await load();
      expect(await usePreciseLocationIfGranted(onUpgrade)).toBe(true);
      expect(onUpgrade).toHaveBeenCalledTimes(1);
      // The achievement rewards the deliberate tap, not this reuse.
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
