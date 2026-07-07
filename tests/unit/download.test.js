import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// downloadBlob triggers a browser save through a transient anchor. The DOM
// side is real (happy-dom); URL and the anchor's click are stubbed so we can
// observe the filename, that the anchor is attached for the click and detached
// after, and that the object URL is revoked on a later task — not in the same
// tick, where some engines would cancel the in-flight download read.

describe("download/downloadBlob", () => {
  let mod;
  let created, revoked, clickedName, inDomAtClick;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    created = [];
    revoked = [];
    clickedName = null;
    inDomAtClick = false;
    document.body.innerHTML = "";
    // Keep URL constructable (happy-dom parses the anchor's href on append);
    // only the object-URL statics are stubbed for observation.
    const RealURL = globalThis.URL;
    function urlStub(...args) {
      return new RealURL(...args);
    }
    urlStub.createObjectURL = (blob) => {
      created.push(blob);
      return `blob:test-${created.length - 1}`;
    };
    urlStub.revokeObjectURL = (url) => revoked.push(url);
    vi.stubGlobal("URL", urlStub);
    vi.spyOn(document, "createElement").mockImplementation(function (tag) {
      const el = Document.prototype.createElement.call(document, tag);
      if (tag === "a") {
        el.click = () => {
          clickedName = el.download;
          inDomAtClick = document.body.contains(el);
        };
      }
      return el;
    });
    mod = await import("../../js/download.js");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clicks an attached anchor carrying the filename, then detaches it", () => {
    const blob = new Blob(["data"]);
    mod.downloadBlob(blob, "sky.png");
    expect(created).toEqual([blob]);
    expect(clickedName).toBe("sky.png");
    expect(inDomAtClick).toBe(true); // in the document when clicked
    expect(document.querySelector("a")).toBeNull(); // removed afterward
  });

  it("revokes the object URL on a later task, not synchronously", () => {
    mod.downloadBlob(new Blob(["data"]), "sky.png");
    expect(revoked).toEqual([]); // still valid right after the click
    vi.runAllTimers();
    expect(revoked).toEqual(["blob:test-0"]);
  });
});
