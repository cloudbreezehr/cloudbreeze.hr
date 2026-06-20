import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The bridge turns theme-activate/deactivate events into bed changes, mirroring
// the render loop's "last-triggered wins" rule. beds is mocked to capture the
// theme it would play (null = silence).

describe("audio/bridges/themes", () => {
  let beds;
  let stop;

  beforeEach(async () => {
    vi.resetModules();
    beds = [];
    vi.doMock("../../../../js/audio/beds.js", () => ({
      setBed: (id) => beds.push(id),
    }));
    const mod = await import("../../../../js/audio/bridges/themes.js");
    stop = mod.initThemesAudioBridge();
  });

  afterEach(() => {
    if (stop) stop();
    vi.doUnmock("../../../../js/audio/beds.js");
  });

  const fire = (type, theme) =>
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type, theme } }),
    );
  const activate = (t) => fire("theme-activate", t);
  const deactivate = (t) => fire("theme-deactivate", t);

  it("plays the activated theme's bed", () => {
    activate("frozen");
    expect(beds).toEqual(["frozen"]);
  });

  it("hands the bed to the most recently activated theme", () => {
    activate("frozen");
    activate("vhs");
    expect(beds).toEqual(["frozen", "vhs"]);
  });

  it("falls back to the prior theme when the winner deactivates", () => {
    activate("frozen");
    activate("vhs");
    deactivate("vhs");
    expect(beds).toEqual(["frozen", "vhs", "frozen"]);
  });

  it("silences when the last active theme deactivates", () => {
    activate("frozen");
    deactivate("frozen");
    expect(beds).toEqual(["frozen", null]);
  });
});
