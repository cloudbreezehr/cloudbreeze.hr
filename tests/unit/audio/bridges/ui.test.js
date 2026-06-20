import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The UI bridge maps interface events (appearance toggle, panel open) to dry
// cues. sfx is mocked to capture name + opts so we can assert the pitch mapping
// and the ui: true flag that keeps these out of the themed effects bus.

describe("audio/bridges/ui", () => {
  let calls;
  let stop;

  beforeEach(async () => {
    vi.resetModules();
    calls = [];
    vi.doMock("../../../../js/audio/sfx.js", () => ({
      playSfx: (name, opts) => calls.push({ name, opts }),
    }));
    const mod = await import("../../../../js/audio/bridges/ui.js");
    stop = mod.initUiAudioBridge();
  });

  afterEach(() => {
    if (stop) stop();
    vi.doUnmock("../../../../js/audio/sfx.js");
  });

  const fire = (detail) =>
    window.dispatchEvent(new CustomEvent("achievement", { detail }));

  it("pitches the appearance tick by where the preference sits dark→light", () => {
    fire({ type: "appearance-change", appearance: "dark" });
    fire({ type: "appearance-change", appearance: "auto" });
    fire({ type: "appearance-change", appearance: "light" });
    expect(calls).toEqual([
      { name: "uiTick", opts: { ui: true, progress: 0 } },
      { name: "uiTick", opts: { ui: true, progress: 0.5 } },
      { name: "uiTick", opts: { ui: true, progress: 1 } },
    ]);
  });

  it("falls back to a mid tick for an unknown appearance value", () => {
    fire({ type: "appearance-change", appearance: "sepia" });
    expect(calls).toEqual([
      { name: "uiTick", opts: { ui: true, progress: 0.5 } },
    ]);
  });

  it("whooshes when the Cloudlog panel opens, played dry", () => {
    fire({ type: "panel-open" });
    expect(calls).toEqual([{ name: "panelOpen", opts: { ui: true } }]);
  });

  it("ignores unrelated achievement events", () => {
    fire({ type: "first-theme" });
    fire({ type: "set-mastery" });
    expect(calls).toEqual([]);
  });

  it("detaches its listener on cleanup", () => {
    stop();
    stop = null;
    fire({ type: "appearance-change", appearance: "light" });
    expect(calls).toEqual([]);
  });
});
