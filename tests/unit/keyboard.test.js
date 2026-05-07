import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { onKey } from "../../js/keyboard.js";

function dispatchKey(opts) {
  const event = new KeyboardEvent("keydown", {
    key: opts.key,
    ctrlKey: !!opts.ctrl,
    metaKey: !!opts.meta,
    shiftKey: !!opts.shift,
    altKey: !!opts.alt,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
  return event;
}

describe("onKey", () => {
  let cleanup;

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    if (cleanup) cleanup();
    cleanup = undefined;
  });

  it("fires when the matching key is pressed (case-insensitive)", () => {
    const cb = vi.fn();
    cleanup = onKey("L", cb);
    dispatchKey({ key: "l" });
    expect(cb).toHaveBeenCalledOnce();
  });

  it("ignores unrelated keys", () => {
    const cb = vi.fn();
    cleanup = onKey("l", cb);
    dispatchKey({ key: "x" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("requires ctrl when opts.ctrl is true", () => {
    const cb = vi.fn();
    cleanup = onKey("p", cb, { ctrl: true });
    dispatchKey({ key: "p" });
    expect(cb).not.toHaveBeenCalled();
    dispatchKey({ key: "p", ctrl: true });
    expect(cb).toHaveBeenCalledOnce();
  });

  it("treats meta (cmd) as equivalent to ctrl", () => {
    const cb = vi.fn();
    cleanup = onKey("p", cb, { ctrl: true });
    dispatchKey({ key: "p", meta: true });
    expect(cb).toHaveBeenCalledOnce();
  });

  it("rejects events with extra modifiers not requested", () => {
    const cb = vi.fn();
    cleanup = onKey("p", cb);
    dispatchKey({ key: "p", shift: true });
    expect(cb).not.toHaveBeenCalled();
    dispatchKey({ key: "p", alt: true });
    expect(cb).not.toHaveBeenCalled();
  });

  it("requires shift and alt when specified", () => {
    const cb = vi.fn();
    cleanup = onKey(".", cb, { ctrl: true, shift: true });
    dispatchKey({ key: ".", ctrl: true });
    expect(cb).not.toHaveBeenCalled();
    dispatchKey({ key: ".", ctrl: true, shift: true });
    expect(cb).toHaveBeenCalledOnce();
  });

  it("blocks firing while an input is focused", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const cb = vi.fn();
    cleanup = onKey("l", cb);
    dispatchKey({ key: "l" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("blocks firing while a textarea is focused", () => {
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();

    const cb = vi.fn();
    cleanup = onKey("l", cb);
    dispatchKey({ key: "l" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("blocks firing while a contenteditable is focused", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    div.tabIndex = 0;
    document.body.appendChild(div);
    div.focus();

    const cb = vi.fn();
    cleanup = onKey("l", cb);
    dispatchKey({ key: "l" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("fires even inside an input when allowInInput is true", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const cb = vi.fn();
    cleanup = onKey("l", cb, { allowInInput: true });
    dispatchKey({ key: "l" });
    expect(cb).toHaveBeenCalledOnce();
  });

  it("calls preventDefault on matched events", () => {
    const cb = vi.fn();
    cleanup = onKey("l", cb);
    const event = dispatchKey({ key: "l" });
    expect(event.defaultPrevented).toBe(true);
  });

  it("returns a cleanup that detaches the handler", () => {
    const cb = vi.fn();
    cleanup = onKey("l", cb);
    cleanup();
    cleanup = undefined;
    dispatchKey({ key: "l" });
    expect(cb).not.toHaveBeenCalled();
  });
});
