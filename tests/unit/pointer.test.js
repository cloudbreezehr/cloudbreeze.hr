import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { bindPointer } from "../../js/pointer.js";

// happy-dom provides Pointer/TouchEvent constructors; synthesize events
// directly rather than going through a helper so the Event type is accurate.

function pointerEvent(type, { x, y }) {
  // happy-dom doesn't currently construct PointerEvent with clientX/Y via
  // the standard constructor — use a plain Event with the props we need.
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientX", { value: x });
  Object.defineProperty(event, "clientY", { value: y });
  // bindPointer only reads the target for a return-false check; default is fine.
  return event;
}

function touchEvent(type, touches) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", { value: touches });
  return event;
}

describe("bindPointer", () => {
  let target;
  let handlers;

  beforeEach(() => {
    target = document.createElement("div");
    document.body.appendChild(target);
    handlers = {
      onDown: vi.fn(),
      onMove: vi.fn(),
      onUp: vi.fn(),
    };
  });

  afterEach(() => {
    target.remove();
  });

  it("invokes onDown with client coordinates", () => {
    bindPointer(target, handlers);
    target.dispatchEvent(pointerEvent("pointerdown", { x: 12, y: 34 }));
    expect(handlers.onDown).toHaveBeenCalledOnce();
    expect(handlers.onDown.mock.calls[0][0]).toBe(12);
    expect(handlers.onDown.mock.calls[0][1]).toBe(34);
  });

  it("does not forward pointermove until a pointerdown has been accepted", () => {
    bindPointer(target, handlers);
    target.dispatchEvent(pointerEvent("pointermove", { x: 1, y: 1 }));
    expect(handlers.onMove).not.toHaveBeenCalled();
  });

  it("forwards pointermove after pointerdown", () => {
    bindPointer(target, handlers);
    target.dispatchEvent(pointerEvent("pointerdown", { x: 0, y: 0 }));
    target.dispatchEvent(pointerEvent("pointermove", { x: 5, y: 6 }));
    expect(handlers.onMove).toHaveBeenCalledWith(5, 6);
  });

  it("honors a onDown returning false to skip tracking", () => {
    handlers.onDown.mockReturnValue(false);
    bindPointer(target, handlers);
    target.dispatchEvent(pointerEvent("pointerdown", { x: 0, y: 0 }));
    target.dispatchEvent(pointerEvent("pointermove", { x: 5, y: 6 }));
    expect(handlers.onMove).not.toHaveBeenCalled();
    // pointerup also stays inert because we never became active
    target.dispatchEvent(pointerEvent("pointerup", { x: 0, y: 0 }));
    expect(handlers.onUp).not.toHaveBeenCalled();
  });

  it("fires onUp once on pointerup", () => {
    bindPointer(target, handlers);
    target.dispatchEvent(pointerEvent("pointerdown", { x: 0, y: 0 }));
    target.dispatchEvent(pointerEvent("pointerup", { x: 0, y: 0 }));
    expect(handlers.onUp).toHaveBeenCalledOnce();
  });

  it("ignores repeated pointerup events after release", () => {
    bindPointer(target, handlers);
    target.dispatchEvent(pointerEvent("pointerdown", { x: 0, y: 0 }));
    target.dispatchEvent(pointerEvent("pointerup", { x: 0, y: 0 }));
    target.dispatchEvent(pointerEvent("pointerup", { x: 0, y: 0 }));
    expect(handlers.onUp).toHaveBeenCalledOnce();
  });

  it("falls back to touch events when pointer events stop firing (mobile scroll capture)", () => {
    bindPointer(target, handlers);
    target.dispatchEvent(pointerEvent("pointerdown", { x: 0, y: 0 }));
    // Simulate the browser capturing the pointer for scrolling:
    // touchmove still fires, pointermove does not.
    target.dispatchEvent(
      touchEvent("touchmove", [{ clientX: 42, clientY: 43 }]),
    );
    expect(handlers.onMove).toHaveBeenCalledWith(42, 43);
    target.dispatchEvent(touchEvent("touchend", []));
    expect(handlers.onUp).toHaveBeenCalledOnce();
  });

  it("ignores touchmove with no touches", () => {
    bindPointer(target, handlers);
    target.dispatchEvent(pointerEvent("pointerdown", { x: 0, y: 0 }));
    target.dispatchEvent(touchEvent("touchmove", []));
    expect(handlers.onMove).not.toHaveBeenCalled();
  });
});
