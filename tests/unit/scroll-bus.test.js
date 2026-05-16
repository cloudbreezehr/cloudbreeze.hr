import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { subscribe, getScrollY, _resetForTests } from "../../js/scroll-bus.js";

function setScrollY(y) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get() {
      return y;
    },
  });
}

function dispatchScroll() {
  window.dispatchEvent(new Event("scroll"));
}

describe("scroll-bus", () => {
  beforeEach(() => {
    setScrollY(0);
    _resetForTests();
  });

  afterEach(() => {
    _resetForTests();
  });

  it("delivers scrollY and deltaY snapshots to the subscriber", () => {
    const fn = vi.fn();
    subscribe(fn);

    setScrollY(100);
    dispatchScroll();
    setScrollY(150);
    dispatchScroll();

    expect(fn.mock.calls).toEqual([
      [{ scrollY: 100, deltaY: 100 }],
      [{ scrollY: 150, deltaY: 50 }],
    ]);
  });

  it("snapshots a negative deltaY when the page scrolls up", () => {
    const fn = vi.fn();
    subscribe(fn);

    setScrollY(200);
    dispatchScroll();
    setScrollY(50);
    dispatchScroll();

    expect(fn.mock.calls[1][0]).toEqual({ scrollY: 50, deltaY: -150 });
  });

  it("dispatches to every subscriber on a single native event", () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribe(a);
    subscribe(b);

    setScrollY(10);
    dispatchScroll();

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    expect(a.mock.calls[0][0]).toEqual(b.mock.calls[0][0]);
  });

  it("the unsubscribe handle stops further deliveries", () => {
    const fn = vi.fn();
    const unsub = subscribe(fn);

    setScrollY(10);
    dispatchScroll();
    unsub();
    setScrollY(20);
    dispatchScroll();

    expect(fn).toHaveBeenCalledOnce();
  });

  it("a thrown subscriber doesn't break the rest", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = vi.fn(() => {
      throw new Error("boom");
    });
    const b = vi.fn();
    subscribe(a);
    subscribe(b);

    setScrollY(5);
    dispatchScroll();

    expect(b).toHaveBeenCalledOnce();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("getScrollY returns the current document scroll position", () => {
    setScrollY(42);
    expect(getScrollY()).toBe(42);
  });

  it("attaches the native listener lazily on first subscribe", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    subscribe(() => {});
    subscribe(() => {});
    const scrollAttaches = addSpy.mock.calls.filter((c) => c[0] === "scroll");
    expect(scrollAttaches).toHaveLength(1);
    addSpy.mockRestore();
  });
});
