import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// theme.js queries matchMedia at init; tests control its return value.

describe("initTheme", () => {
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
    const { initTheme } = await import("../../js/theme.js");
    const theme = initTheme(makeToggle());
    expect(theme.isDark()).toBe(true);
    expect(document.body.classList.contains("light-mode")).toBe(false);
  });

  it("reads an explicit light preference from storage", async () => {
    localStorage.setItem("theme", "light");
    const { initTheme } = await import("../../js/theme.js");
    const theme = initTheme(makeToggle());
    expect(theme.isDark()).toBe(false);
    expect(document.body.classList.contains("light-mode")).toBe(true);
  });

  it("respects the OS preference when auto mode is stored", async () => {
    localStorage.setItem("theme", "auto");
    mqlMatches = true; // prefers-color-scheme: light → true = light
    const { initTheme } = await import("../../js/theme.js");
    const theme = initTheme(makeToggle());
    expect(theme.isDark()).toBe(false);
  });

  it("cycles auto → light → dark on successive clicks", async () => {
    localStorage.setItem("theme", "auto");
    const { initTheme } = await import("../../js/theme.js");
    const toggle = makeToggle();
    initTheme(toggle);
    expect(toggle.getAttribute("data-theme")).toBe("auto");

    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggle.getAttribute("data-theme")).toBe("light");

    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggle.getAttribute("data-theme")).toBe("dark");

    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggle.getAttribute("data-theme")).toBe("auto");
  });

  it("dispatches a theme-change achievement event on click", async () => {
    const { initTheme } = await import("../../js/theme.js");
    const toggle = makeToggle();
    initTheme(toggle);

    const listener = vi.fn();
    window.addEventListener("achievement", listener);
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    window.removeEventListener("achievement", listener);

    expect(listener).toHaveBeenCalled();
    const [event] = listener.mock.calls[0];
    expect(event.detail.type).toBe("theme-change");
    expect(["auto", "light", "dark"]).toContain(event.detail.theme);
  });

  it("notifies onChange subscribers when the theme changes", async () => {
    const { initTheme } = await import("../../js/theme.js");
    const toggle = makeToggle();
    const theme = initTheme(toggle);
    const cb = vi.fn();
    theme.onChange(cb);

    // Cycle all the way to light to guarantee an isDark transition
    // regardless of the default cycle's starting point.
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true })); // → auto
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true })); // → light
    expect(cb).toHaveBeenCalled();
    expect(theme.isDark()).toBe(false);
    expect(cb.mock.lastCall[0]).toBe(false);
  });
});
