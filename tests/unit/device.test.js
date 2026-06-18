import { describe, it, expect, afterEach, vi } from "vitest";
import { hasCapability } from "../../js/device.js";

// device.js reads matchMedia live, so each test stubs the (hover: none) query
// to model a touch-only device or a hover-capable one, then reads back.

describe("device — input capabilities", () => {
  function stubTouchOnly(touchOnly) {
    window.matchMedia = vi.fn((query) => ({
      matches: query === "(hover: none)" ? touchOnly : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
  }

  afterEach(() => {
    delete window.matchMedia;
  });

  it("keyboard and hover are available on a hover-capable device", () => {
    stubTouchOnly(false);
    expect(hasCapability("keyboard")).toBe(true);
    expect(hasCapability("hover")).toBe(true);
  });

  it("keyboard and hover are unavailable on a touch-only device", () => {
    stubTouchOnly(true);
    expect(hasCapability("keyboard")).toBe(false);
    expect(hasCapability("hover")).toBe(false);
  });

  it("unknown capabilities fail open so a typo doesn't hide an achievement", () => {
    stubTouchOnly(true);
    expect(hasCapability("telepathy")).toBe(true);
  });
});
