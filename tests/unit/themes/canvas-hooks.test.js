import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerCanvasHooks,
  getActiveHooks,
  dispatchTransitions,
  _resetForTests,
} from "../../../js/themes/canvas-hooks.js";
import { getThemeIds } from "../../../js/themes/registry.js";

describe("themes/canvas-hooks", () => {
  beforeEach(() => {
    document.body.className = "";
    _resetForTests();
  });

  it("returns no active hooks when no theme classes are set", () => {
    registerCanvasHooks("paper", { drawAmbient() {} });
    expect(getActiveHooks()).toEqual([]);
  });

  it("returns hooks only for themes whose body class is present", () => {
    const paperHooks = { drawAmbient() {} };
    const vhsHooks = { drawPost() {} };
    registerCanvasHooks("paper", paperHooks);
    registerCanvasHooks("vhs", vhsHooks);

    document.body.classList.add("paper");
    expect(getActiveHooks()).toEqual([{ id: "paper", hooks: paperHooks }]);

    document.body.classList.add("vhs");
    expect(getActiveHooks()).toEqual([
      { id: "paper", hooks: paperHooks },
      { id: "vhs", hooks: vhsHooks },
    ]);
  });

  it("ignores active themes that haven't registered hooks", () => {
    document.body.classList.add("frozen", "blocky");
    registerCanvasHooks("blocky", { drawPost() {} });
    expect(getActiveHooks().map((a) => a.id)).toEqual(["blocky"]);
  });

  it("orders hooks by registry declaration order, not registration order", () => {
    const ids = getThemeIds();
    // Pick two ids whose registry positions are stable but not adjacent.
    const second = ids[1]; // "deep-sea"
    const first = ids[0]; // "frozen"
    document.body.classList.add(second, first);

    // Register in reverse declaration order to prove we iterate by registry.
    registerCanvasHooks(second, { drawAmbient() {} });
    registerCanvasHooks(first, { drawAmbient() {} });

    expect(getActiveHooks().map((a) => a.id)).toEqual([first, second]);
  });

  it("re-registering a theme replaces the previous hooks object", () => {
    const a = { drawAmbient() {} };
    const b = { drawPost() {} };
    registerCanvasHooks("paper", a);
    registerCanvasHooks("paper", b);

    document.body.classList.add("paper");
    expect(getActiveHooks()).toEqual([{ id: "paper", hooks: b }]);
  });

  it("rejects unknown theme ids so a typo can't render to nothing", () => {
    expect(() => registerCanvasHooks("deepsea", { drawAmbient() {} })).toThrow(
      /unknown/,
    );
  });

  it("returns the same array reference on stable frames so callers can hold onto it", () => {
    registerCanvasHooks("paper", { drawAmbient() {} });
    document.body.classList.add("paper");
    const first = getActiveHooks();
    const second = getActiveHooks();
    expect(second).toBe(first);
  });

  it("invalidates the cache when a body class flips", () => {
    registerCanvasHooks("paper", { drawAmbient() {} });
    registerCanvasHooks("vhs", { drawPost() {} });
    document.body.classList.add("paper");
    const first = getActiveHooks();
    document.body.classList.add("vhs");
    const second = getActiveHooks();
    expect(second).not.toBe(first);
    expect(second.map((a) => a.id)).toEqual(["paper", "vhs"]);
  });

  it("invalidates the cache when a theme re-registers, even with the same body class", () => {
    const original = { drawAmbient() {} };
    const replacement = { drawPost() {} };
    registerCanvasHooks("paper", original);
    document.body.classList.add("paper");
    const first = getActiveHooks();
    expect(first[0].hooks).toBe(original);

    registerCanvasHooks("paper", replacement);
    const second = getActiveHooks();
    expect(second).not.toBe(first);
    expect(second[0].hooks).toBe(replacement);
  });
});

describe("themes/canvas-hooks — dispatchTransitions", () => {
  beforeEach(() => {
    document.body.className = "";
    _resetForTests();
  });

  it("fires onActivate exactly once when an id appears in the active set", () => {
    const onActivate = vi.fn();
    registerCanvasHooks("paper", { onActivate });

    document.body.classList.add("paper");
    dispatchTransitions(getActiveHooks());
    dispatchTransitions(getActiveHooks());
    dispatchTransitions(getActiveHooks());

    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("fires onDeactivate exactly once when an id leaves the active set", () => {
    const onDeactivate = vi.fn();
    registerCanvasHooks("paper", { onDeactivate });

    document.body.classList.add("paper");
    dispatchTransitions(getActiveHooks());
    document.body.classList.remove("paper");
    dispatchTransitions(getActiveHooks());
    dispatchTransitions(getActiveHooks());

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it("calls onDeactivate even though the body class is already gone", () => {
    // The deactivation transition is detected on the frame after the
    // body class is removed.  The dispatcher must look up hooks
    // independently of the live body-class membership.
    const onDeactivate = vi.fn();
    registerCanvasHooks("paper", { onDeactivate });

    document.body.classList.add("paper");
    dispatchTransitions(getActiveHooks());
    document.body.classList.remove("paper");

    // active set is now empty — but we still fire deactivate.
    dispatchTransitions(getActiveHooks());
    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it("re-firing across stable frames is a no-op", () => {
    const onActivate = vi.fn();
    const onDeactivate = vi.fn();
    registerCanvasHooks("paper", { onActivate, onDeactivate });

    document.body.classList.add("paper");
    for (let i = 0; i < 10; i++) dispatchTransitions(getActiveHooks());

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onDeactivate).not.toHaveBeenCalled();
  });

  it("handles toggling the same theme back and forth", () => {
    const onActivate = vi.fn();
    const onDeactivate = vi.fn();
    registerCanvasHooks("paper", { onActivate, onDeactivate });

    document.body.classList.add("paper");
    dispatchTransitions(getActiveHooks());
    document.body.classList.remove("paper");
    dispatchTransitions(getActiveHooks());
    document.body.classList.add("paper");
    dispatchTransitions(getActiveHooks());
    document.body.classList.remove("paper");
    dispatchTransitions(getActiveHooks());

    expect(onActivate).toHaveBeenCalledTimes(2);
    expect(onDeactivate).toHaveBeenCalledTimes(2);
  });
});
