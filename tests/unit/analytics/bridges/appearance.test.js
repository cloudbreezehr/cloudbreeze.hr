import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Appearance-bridge test.  Focus areas:
//   - appearance_toggle fires with from/to sequencing (first toggle's `from` is null)
//   - toggles_in_session counter increments monotonically
//   - via is "click" today (only source path); regression guard so future
//     changes are intentional

describe("analytics/bridges/appearance", () => {
  let core;
  let bridge;
  let captured;

  async function bootstrap() {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    captured = [];
    core = await import("../../../../js/analytics/core.js");
    bridge = await import("../../../../js/analytics/bridges/appearance.js");
    core.start({
      adapter: { name: "capture", send: (batch) => captured.push(...batch) },
    });
    bridge.initAppearanceBridge();
  }

  function dispatchAppearanceChange(appearance) {
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "appearance-change", appearance },
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

  it("emits appearance_toggle with null `from` on the first toggle", () => {
    dispatchAppearanceChange("dark");
    core.flush();
    const t = eventsNamed("appearance_toggle")[0];
    expect(t.props.from).toEqual(null);
    expect(t.props.to).toEqual("dark");
    expect(t.props.toggles_in_session).toEqual(1);
    expect(t.props.via).toEqual("click");
  });

  it("subsequent toggles carry the previous appearance as `from`", () => {
    dispatchAppearanceChange("dark");
    dispatchAppearanceChange("light");
    dispatchAppearanceChange("auto");
    core.flush();
    const toggles = eventsNamed("appearance_toggle").map((e) => ({
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
    dispatchAppearanceChange("dark");
    dispatchAppearanceChange("light");
    dispatchAppearanceChange("dark");
    core.flush();
    const counts = eventsNamed("appearance_toggle").map(
      (e) => e.props.toggles_in_session,
    );
    expect(counts).toEqual([1, 2, 3]);
  });

  it("ignores non-appearance-change achievement events", () => {
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "click" } }),
    );
    core.flush();
    expect(eventsNamed("appearance_toggle").length).toEqual(0);
  });

  it("handles missing appearance field with to: null", () => {
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "appearance-change" } }),
    );
    core.flush();
    expect(eventsNamed("appearance_toggle")[0].props.to).toEqual(null);
  });
});
