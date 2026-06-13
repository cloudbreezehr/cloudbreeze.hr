import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rocketCountForTier } from "../../../js/effects/fireworks.js";

// rocketCountForTier is a pure function; the only runtime dependency is
// navigator.connection.saveData.  Stub it per-test with Object.defineProperty.

function stubSaveData(saveData) {
  Object.defineProperty(navigator, "connection", {
    get: () => ({ saveData }),
    configurable: true,
  });
}

function clearConnectionStub() {
  Object.defineProperty(navigator, "connection", {
    get: () => undefined,
    configurable: true,
  });
}

describe("effects/fireworks — rocketCountForTier", () => {
  beforeEach(() => clearConnectionStub());
  afterEach(() => clearConnectionStub());

  it("returns a positive count for legendary tier", () => {
    expect(rocketCountForTier("legendary")).toBeGreaterThan(0);
  });

  it("returns a positive count for epic tier", () => {
    expect(rocketCountForTier("epic")).toBeGreaterThan(0);
  });

  it("returns more rockets for legendary than epic", () => {
    expect(rocketCountForTier("legendary")).toBeGreaterThan(
      rocketCountForTier("epic"),
    );
  });

  it("returns 0 for unknown tier", () => {
    expect(rocketCountForTier("unknown")).toBe(0);
  });

  it("caps to 1 for legendary when data-saver is active", () => {
    stubSaveData(true);
    expect(rocketCountForTier("legendary")).toBe(1);
  });

  it("caps to 1 for epic when data-saver is active", () => {
    stubSaveData(true);
    expect(rocketCountForTier("epic")).toBe(1);
  });

  it("does not cap when data-saver is false", () => {
    stubSaveData(false);
    expect(rocketCountForTier("legendary")).toBeGreaterThan(1);
  });

  it("does not cap when connection is absent", () => {
    // navigator.connection is undefined (cleared in beforeEach)
    expect(rocketCountForTier("legendary")).toBeGreaterThan(1);
  });
});
