import { describe, it, expect, beforeEach } from "vitest";
import { flashClass } from "../../js/flash-class.js";

// happy-dom doesn't run CSS animations, so drive the class's
// start/end lifecycle with synthetic events carrying an animationName.
function animEvent(type, animationName, bubbles = false) {
  const e = new Event(type, { bubbles });
  Object.defineProperty(e, "animationName", { value: animationName });
  return e;
}

describe("flash-class", () => {
  let el;

  beforeEach(() => {
    document.body.innerHTML = "";
    el = document.createElement("div");
    document.body.appendChild(el);
  });

  it("adds the class", () => {
    flashClass(el, "pop");
    expect(el.classList.contains("pop")).toBe(true);
  });

  it("removes the class when its own animation ends", () => {
    flashClass(el, "pop");
    el.dispatchEvent(animEvent("animationstart", "card-pop"));
    el.dispatchEvent(animEvent("animationend", "card-pop"));
    expect(el.classList.contains("pop")).toBe(false);
  });

  it("keeps the class when an unrelated child animation ends", () => {
    // A descendant's own animation (a progress-bar tick, a nested pop)
    // whose animationend bubbles up to the flashed element.
    const child = document.createElement("div");
    el.appendChild(child);

    flashClass(el, "pop");
    el.dispatchEvent(animEvent("animationstart", "card-pop"));
    child.dispatchEvent(animEvent("animationend", "progress-tick", true));
    expect(el.classList.contains("pop")).toBe(true);

    el.dispatchEvent(animEvent("animationend", "card-pop"));
    expect(el.classList.contains("pop")).toBe(false);
  });

  it("cleans up when the animation runs on a descendant", () => {
    // The class sits on the outer element but selects an inner one to
    // animate, so both start and end arrive via bubbling.
    const inner = document.createElement("div");
    el.appendChild(inner);

    flashClass(el, "pop");
    inner.dispatchEvent(animEvent("animationstart", "row-shine", true));
    inner.dispatchEvent(animEvent("animationend", "row-shine", true));
    expect(el.classList.contains("pop")).toBe(false);
  });

  it("re-arms on a repeat call while the class is still present", () => {
    flashClass(el, "pop");
    el.dispatchEvent(animEvent("animationstart", "card-pop"));
    expect(el.classList.contains("pop")).toBe(true);

    // Second call before the first animation ended: class is re-added and a
    // fresh start/end cycle tears it down.
    flashClass(el, "pop");
    expect(el.classList.contains("pop")).toBe(true);
    el.dispatchEvent(animEvent("animationstart", "card-pop"));
    el.dispatchEvent(animEvent("animationend", "card-pop"));
    expect(el.classList.contains("pop")).toBe(false);
  });

  it("is a no-op when the element is null", () => {
    expect(() => flashClass(null, "pop")).not.toThrow();
  });
});
