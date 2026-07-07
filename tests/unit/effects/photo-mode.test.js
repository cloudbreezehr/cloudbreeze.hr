import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Drives photo mode through its public surface. The canvas is stubbed just
// enough for the save path: happy-dom's canvas has no real 2d context, so
// the capture pipeline (getContext → drawImage → toBlob) is faked and the
// test reads back what was drawn and downloaded.

describe("effects/photo-mode", () => {
  let photo;

  beforeEach(async () => {
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    document.body.innerHTML = '<canvas id="bg-canvas"></canvas>';
    document.body.className = "";
    vi.resetModules();
    photo = await import("../../../js/effects/photo-mode.js");
  });

  afterEach(() => {
    photo._resetForTests();
    delete window.matchMedia;
  });

  it("enters photo mode: body flag, toolbar, discovery event", () => {
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail.type));
    photo.enterPhotoMode();
    expect(document.body.classList.contains("photo-mode")).toBe(true);
    expect(document.querySelector(".photo-mode-bar")).not.toBeNull();
    expect(photo.isPhotoModeOpen()).toBe(true);
    expect(events).toContain("photo-mode");
  });

  it("makes the faded page inert on enter and restores it on exit", () => {
    const page = document.createElement("div");
    page.className = "page";
    document.body.appendChild(page);

    photo.enterPhotoMode();
    expect(page.hasAttribute("inert")).toBe(true);

    photo.exitPhotoMode();
    expect(page.hasAttribute("inert")).toBe(false);
  });

  it("restores focus to the pre-photo-mode element, captured before inert", () => {
    const page = document.createElement("div");
    page.className = "page";
    const link = document.createElement("button");
    page.appendChild(link);
    document.body.appendChild(page);
    link.focus();
    expect(document.activeElement).toBe(link);

    // Real browsers eject focus from a subtree the moment it goes inert;
    // happy-dom doesn't, so simulate it — this is what makes capture order
    // observable (capturing after inert would record <body>, not the link).
    const realSetAttribute = page.setAttribute.bind(page);
    page.setAttribute = (name, value) => {
      realSetAttribute(name, value);
      if (name === "inert") document.activeElement?.blur();
    };

    photo.enterPhotoMode();
    photo.exitPhotoMode();

    expect(document.activeElement).toBe(link);
  });

  it("Escape leaves photo mode and restores the page", () => {
    photo.enterPhotoMode();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
    );
    expect(document.body.classList.contains("photo-mode")).toBe(false);
    expect(photo.isPhotoModeOpen()).toBe(false);
  });

  it("saves the posed canvas as a PNG and reports the keepsake", () => {
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail.type));

    const src = document.getElementById("bg-canvas");
    src.width = 800;
    src.height = 600;
    src.toBlob = () => {};

    const drawn = [];
    const fakeCtx = {
      drawImage: (...args) => drawn.push(args),
    };
    const clicked = [];
    vi.spyOn(document, "createElement").mockImplementation(function fake(tag) {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => fakeCtx,
          toBlob: (cb) => cb(new Blob(["png"])),
        };
      }
      const el = Document.prototype.createElement.call(document, tag);
      if (tag === "a") el.click = () => clicked.push(el.download);
      return el;
    });
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:fake",
      revokeObjectURL: () => {},
    });

    expect(photo.saveSkyPhoto()).toBe(true);
    expect(drawn.length).toBe(1);
    expect(clicked).toEqual(["cloudbreeze-sky.png"]);
    expect(events).toContain("photo-saved");

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("save is a safe no-op when the canvas is missing", () => {
    document.getElementById("bg-canvas").remove();
    expect(photo.saveSkyPhoto()).toBe(false);
  });
});
