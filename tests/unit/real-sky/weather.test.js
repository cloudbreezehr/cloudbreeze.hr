import { describe, it, expect, afterEach, vi } from "vitest";
import {
  weatherLabel,
  isRaining,
  isSnowing,
  fetchWeather,
} from "../../../js/real-sky/weather.js";

describe("real-sky/weather — WMO interpretation", () => {
  it("maps representative codes to short labels", () => {
    expect(weatherLabel(0)).toBe("clear");
    expect(weatherLabel(2)).toBe("partly cloudy");
    expect(weatherLabel(3)).toBe("overcast");
    expect(weatherLabel(45)).toBe("foggy");
    expect(weatherLabel(55)).toBe("drizzle");
    expect(weatherLabel(63)).toBe("rain");
    expect(weatherLabel(73)).toBe("snow");
    expect(weatherLabel(81)).toBe("rain");
    expect(weatherLabel(96)).toBe("thunder");
  });

  it("recognizes rain, showers, and thunderstorms as raining", () => {
    for (const code of [51, 63, 67, 80, 82, 95, 99]) {
      expect(isRaining(code), String(code)).toBe(true);
    }
    for (const code of [0, 2, 3, 45, 71, 77]) {
      expect(isRaining(code), String(code)).toBe(false);
    }
  });

  it("recognizes snowfall, snow grains, and snow showers as snowing", () => {
    for (const code of [71, 73, 75, 77, 85, 86]) {
      expect(isSnowing(code), String(code)).toBe(true);
    }
    for (const code of [0, 2, 3, 45, 63, 80, 95]) {
      expect(isSnowing(code), String(code)).toBe(false);
    }
  });
});

describe("real-sky/weather — fetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves current conditions from the API shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          current: { temperature_2m: 17.4, weather_code: 61 },
        }),
      })),
    );
    expect(await fetchWeather()).toEqual({
      tempC: 17.4,
      code: 61,
      label: "rain",
      raining: true,
      snowing: false,
    });
  });

  it("targets the coordinates of the location it's given", async () => {
    const spy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ current: { temperature_2m: 20, weather_code: 0 } }),
    }));
    vi.stubGlobal("fetch", spy);
    await fetchWeather({ latDeg: 35.68, lonDeg: 139.69, label: "Tokyo" });
    const url = spy.mock.calls[0][0];
    expect(url).toContain("latitude=35.68");
    expect(url).toContain("longitude=139.69");
  });

  it("resolves null on HTTP failure, malformed payloads, and network errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    expect(await fetchWeather()).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );
    expect(await fetchWeather()).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await fetchWeather()).toBeNull();
  });
});
