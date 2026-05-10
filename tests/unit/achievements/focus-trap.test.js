import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { trapFocus } from "../../../js/achievements/focus-trap.js";

// happy-dom does not emulate layout, so offsetParent is null for many
// elements by default.  The focus-trap's "is this actually visible"
// filter uses offsetParent, so tests inject elements in a way that
// happy-dom reports as visible (attached to body, no display:none).
// Where needed we mock offsetParent on specific elements to exclude
// them from the cycle.

function makeButton(label) {
  const b = document.createElement("button");
  b.textContent = label;
  return b;
}

describe("achievements/focus-trap", () => {
  let container;
  let release;
  let previouslyFocused;

  beforeEach(() => {
    document.body.innerHTML = "";
    previouslyFocused = document.createElement("button");
    previouslyFocused.textContent = "outside";
    document.body.appendChild(previouslyFocused);
    previouslyFocused.focus();

    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (release) {
      release();
      release = undefined;
    }
    document.body.innerHTML = "";
  });

  function pressTab(shift = false) {
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: shift,
      bubbles: true,
      cancelable: true,
    });
    container.dispatchEvent(event);
    return event;
  }

  it("moves focus to the first focusable on start", () => {
    const a = makeButton("a");
    const b = makeButton("b");
    container.append(a, b);
    release = trapFocus(container);
    expect(document.activeElement).toBe(a);
  });

  it("honors an explicit initialFocus when passed", () => {
    const a = makeButton("a");
    const b = makeButton("b");
    container.append(a, b);
    release = trapFocus(container, { initialFocus: b });
    expect(document.activeElement).toBe(b);
  });

  it("wraps Tab from the last focusable to the first", () => {
    const a = makeButton("a");
    const b = makeButton("b");
    container.append(a, b);
    release = trapFocus(container);
    b.focus();
    const event = pressTab(false);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a);
  });

  it("wraps Shift+Tab from the first focusable to the last", () => {
    const a = makeButton("a");
    const b = makeButton("b");
    container.append(a, b);
    release = trapFocus(container);
    // initial focus lands on a
    const event = pressTab(true);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(b);
  });

  it("lets Tab pass through between middle focusables without preventing default", () => {
    const a = makeButton("a");
    const b = makeButton("b");
    const c = makeButton("c");
    container.append(a, b, c);
    release = trapFocus(container);
    b.focus();
    const event = pressTab(false);
    // From the middle, the browser's own Tab handling should move focus
    // to c.  We don't preventDefault in that case.
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores non-Tab keys", () => {
    const a = makeButton("a");
    container.append(a);
    release = trapFocus(container);
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    container.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("swallows Tab in an empty container", () => {
    release = trapFocus(container);
    const event = pressTab(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it("restores focus to the previously-focused element on release", () => {
    const a = makeButton("a");
    container.append(a);
    release = trapFocus(container);
    expect(document.activeElement).toBe(a);
    release();
    release = undefined;
    expect(document.activeElement).toBe(previouslyFocused);
  });

  it("skips disabled buttons in the cycle", () => {
    const a = makeButton("a");
    const disabled = makeButton("disabled");
    disabled.disabled = true;
    const c = makeButton("c");
    container.append(a, disabled, c);
    release = trapFocus(container);
    // From last, Tab should wrap to a — confirms the disabled middle
    // button is not in the cycle.
    c.focus();
    pressTab(false);
    expect(document.activeElement).toBe(a);
  });

  it("bounces focus back to the trap when activeElement is outside the container", () => {
    const a = makeButton("a");
    container.append(a);
    release = trapFocus(container);
    // Simulate focus escaping to a foreign element
    previouslyFocused.focus();
    const event = pressTab(false);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a);
  });
});
