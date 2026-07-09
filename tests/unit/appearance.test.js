import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// appearance.js queries matchMedia at init; tests control its return value.

describe("initAppearance", () => {
  let mqlMatches;
  let mqlListeners;

  beforeEach(() => {
    document.body.className = "";
    localStorage.clear();
    mqlMatches = false;
    mqlListeners = [];
    window.matchMedia = vi.fn(() => ({
      get matches() {
        return mqlMatches;
      },
      addEventListener: (type, listener) => {
        if (type === "change") mqlListeners.push(listener);
      },
      removeEventListener: vi.fn(),
    }));
    vi.resetModules();
  });

  afterEach(() => {
    delete window.matchMedia;
    localStorage.clear();
    document.body.className = "";
  });

  function makeToggle() {
    const el = document.createElement("button");
    document.body.appendChild(el);
    return el;
  }

  it("defaults to dark when no stored preference exists", async () => {
    const { initAppearance } = await import("../../js/appearance.js");
    const appearance = initAppearance(makeToggle());
    expect(appearance.isDark()).toBe(true);
    expect(document.body.classList.contains("light-appearance")).toBe(false);
  });

  it("reads an explicit light preference from storage", async () => {
    localStorage.setItem("appearance", "light");
    const { initAppearance } = await import("../../js/appearance.js");
    const appearance = initAppearance(makeToggle());
    expect(appearance.isDark()).toBe(false);
    expect(document.body.classList.contains("light-appearance")).toBe(true);
  });

  it("falls back to the default when storage access throws", async () => {
    // Blocked site data / storage-disabled webviews throw on access. This
    // runs in the boot-critical path, so init must complete, not abort.
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });
    const { initAppearance, getAppearancePreference } =
      await import("../../js/appearance.js");
    expect(getAppearancePreference()).toBe("dark");
    const appearance = initAppearance(makeToggle());
    expect(appearance.isDark()).toBe(true);
    spy.mockRestore();
  });

  it("still applies the cycled appearance when persisting it throws", async () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });
    const { initAppearance } = await import("../../js/appearance.js");
    const toggle = makeToggle();
    initAppearance(toggle);
    toggle.click();
    // The cycle applied (dark → auto) even though persistence failed.
    expect(toggle.getAttribute("data-appearance")).toBe("auto");
    spy.mockRestore();
  });

  it("respects the OS preference when auto is stored", async () => {
    localStorage.setItem("appearance", "auto");
    mqlMatches = true; // prefers-color-scheme: light → true = light
    const { initAppearance } = await import("../../js/appearance.js");
    const appearance = initAppearance(makeToggle());
    expect(appearance.isDark()).toBe(false);
  });

  it("cycles auto → light → dark on successive clicks", async () => {
    localStorage.setItem("appearance", "auto");
    const { initAppearance } = await import("../../js/appearance.js");
    const toggle = makeToggle();
    initAppearance(toggle);
    expect(toggle.getAttribute("data-appearance")).toBe("auto");

    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggle.getAttribute("data-appearance")).toBe("light");

    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggle.getAttribute("data-appearance")).toBe("dark");

    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggle.getAttribute("data-appearance")).toBe("auto");
  });

  it("dispatches an appearance-change achievement event on click", async () => {
    const { initAppearance } = await import("../../js/appearance.js");
    const toggle = makeToggle();
    initAppearance(toggle);

    const listener = vi.fn();
    window.addEventListener("achievement", listener);
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    window.removeEventListener("achievement", listener);

    expect(listener).toHaveBeenCalled();
    const [event] = listener.mock.calls[0];
    expect(event.detail.type).toBe("appearance-change");
    expect(["auto", "light", "dark"]).toContain(event.detail.appearance);
  });

  it("notifies onChange subscribers when the appearance changes", async () => {
    const { initAppearance } = await import("../../js/appearance.js");
    const toggle = makeToggle();
    const appearance = initAppearance(toggle);
    const cb = vi.fn();
    appearance.onChange(cb);

    // Cycle all the way to light to guarantee an isDark transition
    // regardless of the default cycle's starting point.
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true })); // → auto
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true })); // → light
    expect(cb).toHaveBeenCalled();
    expect(appearance.isDark()).toBe(false);
    expect(cb.mock.lastCall[0]).toBe(false);
  });
});

describe("getAppearancePreference", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns 'dark' when no preference is stored", async () => {
    const { getAppearancePreference } = await import("../../js/appearance.js");
    expect(getAppearancePreference()).toEqual("dark");
  });

  it.each(["dark", "light", "auto"])(
    "returns the stored '%s' preference",
    async (pref) => {
      localStorage.setItem("appearance", pref);
      const { getAppearancePreference } =
        await import("../../js/appearance.js");
      expect(getAppearancePreference()).toEqual(pref);
    },
  );
});
