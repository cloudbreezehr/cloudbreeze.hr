import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HOME_LOCATION } from "../../../js/real-sky/local.js";

// A coarse IP lookup that upgrades the shared location in place, and falls
// back to the home town on any failure. Module-level state (the current
// location) means each test re-imports against a fresh module.

describe("real-sky/geolocate", () => {
  let geo;

  beforeEach(async () => {
    vi.resetModules();
    geo = await import("../../../js/real-sky/geolocate.js");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubResponse(payload, ok = true) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok, json: async () => payload })),
    );
  }

  it("starts pinned to the home town", () => {
    expect(geo.currentLocation()).toEqual(HOME_LOCATION);
  });

  it("maps the API shape to { latDeg, lonDeg, label }", async () => {
    stubResponse({ city: "Zagreb", latitude: 45.81, longitude: 15.98 });
    expect(await geo.fetchIpLocation()).toEqual({
      latDeg: 45.81,
      lonDeg: 15.98,
      label: "Zagreb",
    });
  });

  it("upgrades the shared location in place on a successful lookup", async () => {
    stubResponse({ city: "Zagreb", latitude: 45.81, longitude: 15.98 });
    const resolved = await geo.locateVisitor();
    expect(resolved.label).toBe("Zagreb");
    expect(geo.currentLocation()).toEqual({
      latDeg: 45.81,
      lonDeg: 15.98,
      label: "Zagreb",
    });
  });

  it("resolves null on HTTP failure, malformed payloads, and network errors", async () => {
    stubResponse({}, false);
    expect(await geo.fetchIpLocation()).toBeNull();

    // Missing city, or coordinates that aren't finite numbers.
    stubResponse({ latitude: 45.81, longitude: 15.98 });
    expect(await geo.fetchIpLocation()).toBeNull();
    stubResponse({ city: "Nowhere", latitude: "?", longitude: null });
    expect(await geo.fetchIpLocation()).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await geo.fetchIpLocation()).toBeNull();
  });

  it("leaves the location at the home town when the lookup fails", async () => {
    stubResponse({}, false);
    const resolved = await geo.locateVisitor();
    expect(resolved).toEqual(HOME_LOCATION);
    expect(geo.currentLocation()).toEqual(HOME_LOCATION);
  });
});
