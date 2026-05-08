import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Theme-bridge test.  Focus areas:
//   - theme_toggle fires with from/to sequencing (first toggle's `from` is null)
//   - toggles_in_session counter increments monotonically
//   - via is "click" today (only source path); regression guard so future
//     changes are intentional

describe("analytics/bridges/theme", () => {
  let core;
  let bridge;
  let captured;

  async function bootstrap() {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    captured = [];
    core = await import("../../../../js/analytics/core.js");
    bridge = await import("../../../../js/analytics/bridges/theme.js");
    core.start({
      adapter: { name: "capture", send: (batch) => captured.push(...batch) },
    });
    bridge.initThemeBridge();
  }

  function dispatchThemeChange(theme) {
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "theme-change", theme },
      }),
    );
  }

  function eventsNamed(name) {
    return captured.filter((e) => e.name === name);
  }

  beforeEach(async () => {
    await bootstrap();
  });

  afterEach(() => {
    if (core && core._stopForTests) core._stopForTests();
  });

  it("emits theme_toggle with null `from` on the first toggle", () => {
    dispatchThemeChange("dark");
    core.flush();
    const t = eventsNamed("theme_toggle")[0];
    expect(t.props.from).toEqual(null);
    expect(t.props.to).toEqual("dark");
    expect(t.props.toggles_in_session).toEqual(1);
    expect(t.props.via).toEqual("click");
  });

  it("subsequent toggles carry the previous theme as `from`", () => {
    dispatchThemeChange("dark");
    dispatchThemeChange("light");
    dispatchThemeChange("auto");
    core.flush();
    const toggles = eventsNamed("theme_toggle").map((e) => ({
      from: e.props.from,
      to: e.props.to,
    }));
    expect(toggles).toEqual([
      { from: null, to: "dark" },
      { from: "dark", to: "light" },
      { from: "light", to: "auto" },
    ]);
  });

  it("toggles_in_session increments monotonically", () => {
    dispatchThemeChange("dark");
    dispatchThemeChange("light");
    dispatchThemeChange("dark");
    core.flush();
    const counts = eventsNamed("theme_toggle").map(
      (e) => e.props.toggles_in_session,
    );
    expect(counts).toEqual([1, 2, 3]);
  });

  it("ignores non-theme-change achievement events", () => {
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "click" } }),
    );
    core.flush();
    expect(eventsNamed("theme_toggle").length).toEqual(0);
  });

  it("handles missing theme field with to: null", () => {
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "theme-change" } }),
    );
    core.flush();
    expect(eventsNamed("theme_toggle")[0].props.to).toEqual(null);
  });
});
