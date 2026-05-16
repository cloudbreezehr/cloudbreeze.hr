import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isFlipped, mirrorYWhenInverted } from "../../js/viewport.js";

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
