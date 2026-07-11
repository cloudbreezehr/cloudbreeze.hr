import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isFlipped,
  mirrorYWhenInverted,
  getScrollProgress,
} from "../../js/viewport.js";

describe("isFlipped", () => {
  beforeEach(() => {
    document.body.className = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("is false when the body has no classes", () => {
    expect(isFlipped()).toBe(false);
  });

  it("is true when body.upside-down is set", () => {
    document.body.classList.add("upside-down");
    expect(isFlipped()).toBe(true);
  });

  it("ignores other body classes", () => {
    document.body.classList.add("frozen", "deep-sea", "rainy");
    expect(isFlipped()).toBe(false);
  });

  it("flips back when the class is removed", () => {
    document.body.classList.add("upside-down");
    expect(isFlipped()).toBe(true);
    document.body.classList.remove("upside-down");
    expect(isFlipped()).toBe(false);
  });
});

describe("mirrorYWhenInverted", () => {
  beforeEach(() => {
    document.body.className = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("returns y unchanged when the page is upright", () => {
    expect(mirrorYWhenInverted(100, 800)).toBe(100);
    expect(mirrorYWhenInverted(0, 800)).toBe(0);
    expect(mirrorYWhenInverted(800, 800)).toBe(800);
  });

  it("returns height - y when the page is inverted", () => {
    document.body.classList.add("upside-down");
    expect(mirrorYWhenInverted(100, 800)).toBe(700);
    expect(mirrorYWhenInverted(0, 800)).toBe(800);
    expect(mirrorYWhenInverted(800, 800)).toBe(0);
  });

  it("is its own inverse — mirroring twice in inverted mode returns the original", () => {
    document.body.classList.add("upside-down");
    const y = 137;
    const h = 800;
    expect(mirrorYWhenInverted(mirrorYWhenInverted(y, h), h)).toBe(y);
  });

  it("ignores other body classes", () => {
    document.body.classList.add("frozen", "deep-sea", "rainy");
    expect(mirrorYWhenInverted(100, 800)).toBe(100);
  });

  it("toggling the class swaps behavior on the next call", () => {
    expect(mirrorYWhenInverted(100, 800)).toBe(100);
    document.body.classList.add("upside-down");
    expect(mirrorYWhenInverted(100, 800)).toBe(700);
    document.body.classList.remove("upside-down");
    expect(mirrorYWhenInverted(100, 800)).toBe(100);
  });
});

describe("getScrollProgress", () => {
  // getViewportHeight falls back to innerHeight in happy-dom (the lvh probe
  // has no layout), so stub innerHeight/scrollHeight/scrollY directly.
  function setGeometry({ scrollY, scrollHeight, innerHeight }) {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: innerHeight,
    });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: scrollHeight,
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: scrollY,
    });
  }

  afterEach(() => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    delete document.documentElement.scrollHeight;
  });

  it("is 0 at the top and 1 at the bottom", () => {
    setGeometry({ scrollY: 0, scrollHeight: 2000, innerHeight: 1000 });
    expect(getScrollProgress()).toBe(0);
    setGeometry({ scrollY: 1000, scrollHeight: 2000, innerHeight: 1000 });
    expect(getScrollProgress()).toBe(1);
  });

  it("reports the fraction scrolled partway down", () => {
    setGeometry({ scrollY: 250, scrollHeight: 2000, innerHeight: 1000 });
    expect(getScrollProgress()).toBe(0.25);
  });

  it("clamps out-of-range scroll positions to [0, 1]", () => {
    setGeometry({ scrollY: -50, scrollHeight: 2000, innerHeight: 1000 });
    expect(getScrollProgress()).toBe(0);
    setGeometry({ scrollY: 5000, scrollHeight: 2000, innerHeight: 1000 });
    expect(getScrollProgress()).toBe(1);
  });

  it("is 0 when the document is shorter than the viewport", () => {
    setGeometry({ scrollY: 0, scrollHeight: 500, innerHeight: 1000 });
    expect(getScrollProgress()).toBe(0);
  });

  it("honors an explicit scrollY over the live position", () => {
    setGeometry({ scrollY: 0, scrollHeight: 2000, innerHeight: 1000 });
    expect(getScrollProgress(500)).toBe(0.5);
  });
});
