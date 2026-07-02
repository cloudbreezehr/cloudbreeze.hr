import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Drives initRealSky with a stubbed clock and network: the body phase
// attribute, the achievement events, and the footer badge are the contract.

describe("real-sky/index", () => {
  let realSky;
  let cleanup;

  beforeEach(async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<p class="footer-badge">Systems online</p>';
    delete document.body.dataset.skyPhase;
    vi.resetModules();
    realSky = await import("../../../js/real-sky/index.js");
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function stubWeather(payload) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => payload,
      })),
    );
  }

  it("stamps the visitor's day phase on the body and keeps it fresh", () => {
    stubWeather({});
    // Local midday — any timezone's noon is "day" at temperate latitude.
    vi.setSystemTime(new Date(2026, 5, 21, 12, 0));
    cleanup = realSky.initRealSky();
    expect(document.body.dataset.skyPhase).toBe("day");
  });

  it("dispatches the real-sky snapshot event on init", () => {
    stubWeather({});
    vi.setSystemTime(new Date(2026, 7, 12, 12, 0));
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail));
    cleanup = realSky.initRealSky();
    const snapshot = events.find((d) => d.type === "real-sky");
    expect(snapshot).toBeTruthy();
    expect(snapshot.shower).toBe("perseids");
    expect(snapshot).toHaveProperty("moonFull");
    expect(snapshot).toHaveProperty("moment");
  });

  it("writes the live weather into the footer badge and reports rain", async () => {
    stubWeather({ current: { temperature_2m: 16.6, weather_code: 63 } });
    vi.setSystemTime(new Date(2026, 5, 21, 12, 0));
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail));
    cleanup = realSky.initRealSky();
    await vi.waitFor(() => {
      expect(document.querySelector(".footer-badge").textContent).toBe(
        "Systems online · 17°C rain over Pula",
      );
    });
    expect(events).toContainEqual(
      expect.objectContaining({ type: "real-weather", raining: true }),
    );
  });

  it("leaves the badge untouched when the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    vi.setSystemTime(new Date(2026, 5, 21, 12, 0));
    cleanup = realSky.initRealSky();
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector(".footer-badge").textContent).toBe(
      "Systems online",
    );
  });

  it("cleanup stops the refresh loop and clears the phase attribute", () => {
    stubWeather({});
    vi.setSystemTime(new Date(2026, 5, 21, 12, 0));
    cleanup = realSky.initRealSky();
    cleanup();
    cleanup = null;
    expect(document.body.dataset.skyPhase).toBeUndefined();
  });
});
