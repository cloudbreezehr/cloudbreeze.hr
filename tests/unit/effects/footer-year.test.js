import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initFooterYear } from "../../../js/effects/footer-year.js";

describe("effects/footer-year", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-03-04T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rewrites the year token while preserving surrounding prose", () => {
    document.body.innerHTML =
      '<p class="footer-copy" data-copy-year>© 2026 Cloudbreeze d.o.o.</p>';
    initFooterYear();
    expect(document.querySelector(".footer-copy").textContent).toEqual(
      "© 2031 Cloudbreeze d.o.o.",
    );
  });

  it("is a no-op when no marked element exists", () => {
    expect(() => initFooterYear()).not.toThrow();
  });
});
