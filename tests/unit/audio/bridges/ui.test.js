import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The UI bridge maps interface events (appearance toggle, panel open) and a
// direct hover binding on the hero CTAs to dry cues. sfx is mocked to capture
// name + opts so we can assert the pitch mapping, the touch skip, and the
// ui: true flag that keeps these out of the themed effects bus.

describe("audio/bridges/ui", () => {
  let calls;
  let stop;

  beforeEach(async () => {
    vi.resetModules();
    calls = [];
    vi.doMock("../../../../js/audio/sfx.js", () => ({
      playSfx: (name, opts) => calls.push({ name, opts }),
    }));
    // The hover binding queries the CTAs at init, so they must exist first.
    document.body.innerHTML = `
      <div class="hero-actions">
        <a href="#contact" class="btn-primary"><span>Start a project</span></a>
        <a href="#services" class="btn-ghost">Explore our services</a>
      </div>`;
    const mod = await import("../../../../js/audio/bridges/ui.js");
    stop = mod.initUiAudioBridge();
  });

  afterEach(() => {
    if (stop) stop();
    document.body.innerHTML = "";
    vi.doUnmock("../../../../js/audio/sfx.js");
  });

  const fire = (detail) =>
    window.dispatchEvent(new CustomEvent("achievement", { detail }));

  const hover = (el, pointerType = "mouse") => {
    const ev = new Event("pointerenter");
    ev.pointerType = pointerType;
    el.dispatchEvent(ev);
  };

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

  it("feathers when the cursor settles on a hero CTA via mouse or pen", () => {
    hover(document.querySelector(".btn-primary"), "mouse");
    hover(document.querySelector(".btn-ghost"), "pen");
    expect(calls).toEqual([
      { name: "hoverShimmer", opts: { ui: true } },
      { name: "hoverShimmer", opts: { ui: true } },
    ]);
  });

  it("stays silent on touch hover, where the tap already plays the world click", () => {
    hover(document.querySelector(".btn-primary"), "touch");
    expect(calls).toEqual([]);
  });

  it("ignores unrelated achievement events", () => {
    fire({ type: "first-theme" });
    fire({ type: "set-mastery" });
    expect(calls).toEqual([]);
  });

  it("detaches its listeners on cleanup", () => {
    stop();
    stop = null;
    fire({ type: "appearance-change", appearance: "light" });
    hover(document.querySelector(".btn-primary"), "mouse");
    expect(calls).toEqual([]);
  });
});
