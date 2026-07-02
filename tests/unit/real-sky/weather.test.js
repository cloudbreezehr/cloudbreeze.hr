import { describe, it, expect, afterEach, vi } from "vitest";
import {
  weatherLabel,
  isRaining,
  fetchHomeWeather,
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
    expect(await fetchHomeWeather()).toEqual({
      tempC: 17.4,
      code: 61,
      label: "rain",
      raining: true,
    });
  });

  it("resolves null on HTTP failure, malformed payloads, and network errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    expect(await fetchHomeWeather()).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );
    expect(await fetchHomeWeather()).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await fetchHomeWeather()).toBeNull();
  });
});
