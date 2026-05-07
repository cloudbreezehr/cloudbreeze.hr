import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initReveal } from "../../js/reveal.js";

// happy-dom's IntersectionObserver is a stub that never actually fires.
// Replace it with a controllable one so we can simulate visibility.

describe("initReveal", () => {
  let observerInstances;
  let OriginalIntersectionObserver;

  beforeEach(() => {
    observerInstances = [];
    OriginalIntersectionObserver = window.IntersectionObserver;
    class FakeIntersectionObserver {
      constructor(callback, opts) {
        this.callback = callback;
        this.opts = opts;
        this.observed = new Set();
        observerInstances.push(this);
      }
      observe(el) {
        this.observed.add(el);
      }
      unobserve(el) {
        this.observed.delete(el);
      }
      disconnect() {
        this.observed.clear();
      }
      // Test-only: fire the callback for a given element.
      fireIntersecting(el) {
        this.callback([{ target: el, isIntersecting: true }]);
      }
      fireNotIntersecting(el) {
        this.callback([{ target: el, isIntersecting: false }]);
      }
    }
    window.IntersectionObserver = FakeIntersectionObserver;
    document.body.innerHTML = "";
  });

  afterEach(() => {
    window.IntersectionObserver = OriginalIntersectionObserver;
    document.body.innerHTML = "";
  });

  it("observes every element matching the selector", () => {
    document.body.innerHTML = `
      <div class="reveal" id="a"></div>
      <div class="reveal" id="b"></div>
      <div id="c"></div>
    `;
    initReveal();
    expect(observerInstances).toHaveLength(1);
    const [obs] = observerInstances;
    expect(obs.observed.size).toBe(2);
  });

  it("forwards the threshold option to the observer", () => {
    initReveal(".reveal", 0.42);
    expect(observerInstances[0].opts).toEqual({ threshold: 0.42 });
  });

  it("adds .visible and stops observing on intersection", () => {
    document.body.innerHTML = `<div class="reveal" id="a"></div>`;
    const el = document.getElementById("a");
    initReveal();
    const [obs] = observerInstances;
    obs.fireIntersecting(el);
    expect(el.classList.contains("visible")).toBe(true);
    expect(obs.observed.has(el)).toBe(false);
  });

  it("leaves the class alone for entries that are not intersecting", () => {
    document.body.innerHTML = `<div class="reveal" id="a"></div>`;
    const el = document.getElementById("a");
    initReveal();
    const [obs] = observerInstances;
    obs.fireNotIntersecting(el);
    expect(el.classList.contains("visible")).toBe(false);
    expect(obs.observed.has(el)).toBe(true);
  });

  it("accepts a custom selector", () => {
    document.body.innerHTML = `
      <div class="animate" id="a"></div>
      <div class="animate" id="b"></div>
      <div class="reveal" id="c"></div>
    `;
    initReveal(".animate");
    const [obs] = observerInstances;
    expect(obs.observed.size).toBe(2);
  });
});
