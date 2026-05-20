import { describe, it, expect, beforeEach, vi } from "vitest";
import { bindClickable } from "../../js/clickable.js";

describe("bindClickable", () => {
  let el;
  let handler;

  beforeEach(() => {
    document.body.innerHTML = "";
    el = document.createElement("div");
    document.body.appendChild(el);
    handler = vi.fn();
  });

  it('sets role="button" so the custom cursor recognizes the element', () => {
    bindClickable(el, handler);
    expect(el.getAttribute("role")).toBe("button");
  });

  it('sets tabindex="0" so keyboard users can reach the element', () => {
    bindClickable(el, handler);
    expect(el.getAttribute("tabindex")).toBe("0");
  });

  it("preserves a pre-existing tabindex (e.g. -1 for programmatic-only focus)", () => {
    el.setAttribute("tabindex", "-1");
    bindClickable(el, handler);
    expect(el.getAttribute("tabindex")).toBe("-1");
  });

  it("invokes the handler on click", () => {
    bindClickable(el, handler);
    el.dispatchEvent(new Event("click", { bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("invokes the handler on Enter keypress", () => {
    bindClickable(el, handler);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("invokes the handler on Space keypress", () => {
    bindClickable(el, handler);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("ignores unrelated keypresses", () => {
    bindClickable(el, handler);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("prevents default on Enter/Space so Space doesn't scroll the page", () => {
    bindClickable(el, handler);
    const evt = new KeyboardEvent("keydown", {
      key: " ",
      cancelable: true,
    });
    el.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
  });

  it("is a no-op when given a falsy element", () => {
    expect(() => bindClickable(null, handler)).not.toThrow();
    expect(() => bindClickable(undefined, handler)).not.toThrow();
  });

  it("is a no-op when given a non-function handler", () => {
    expect(() => bindClickable(el, null)).not.toThrow();
    expect(el.hasAttribute("role")).toBe(false);
  });
});
