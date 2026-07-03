import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initCursor } from "../../js/cursor.js";

// The custom cursor shows on movement and must leave the screen when the
// pointer leaves the window — not freeze at the last edge it touched.
// Events are dispatched from an element so they bubble to the document
// listeners with a real Element target (the handlers call target.closest).

describe("cursor visibility", () => {
  let dot;
  let ring;
  let origRaf;

  beforeEach(() => {
    // The ring-ease loop self-schedules via rAF; make it run once, not recurse.
    origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = () => 0;
    document.body.innerHTML = "";
    document.body.className = "";
    dot = document.createElement("div");
    dot.id = "cursor";
    ring = document.createElement("div");
    ring.id = "cursor-ring";
    document.body.append(dot, ring);
    initCursor(dot, ring);
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf;
  });

  function move(x = 100, y = 100) {
    document.body.dispatchEvent(
      new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true }),
    );
  }

  function leaveWindow() {
    document.body.dispatchEvent(
      new MouseEvent("mouseout", { relatedTarget: null, bubbles: true }),
    );
  }

  it("becomes visible on the first pointer movement", () => {
    expect(dot.classList.contains("visible")).toBe(false);
    move();
    expect(dot.classList.contains("visible")).toBe(true);
    expect(ring.classList.contains("visible")).toBe(true);
  });

  it("hides when the pointer leaves the window (null relatedTarget)", () => {
    move();
    leaveWindow();
    expect(dot.classList.contains("visible")).toBe(false);
    expect(ring.classList.contains("visible")).toBe(false);
  });

  it("stays visible on a plain element-to-element mouseout inside the window", () => {
    move();
    document.body.dispatchEvent(
      new MouseEvent("mouseout", { relatedTarget: ring, bubbles: true }),
    );
    expect(dot.classList.contains("visible")).toBe(true);
  });

  it("re-shows on the next movement after leaving", () => {
    move();
    leaveWindow();
    expect(dot.classList.contains("visible")).toBe(false);
    move(150, 150);
    expect(dot.classList.contains("visible")).toBe(true);
  });
});
