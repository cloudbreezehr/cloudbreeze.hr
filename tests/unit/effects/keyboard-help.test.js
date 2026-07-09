import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// keyboard-help opens a modal listing documented shortcuts on "?" and
// closes on "?" again, Esc, or backdrop click.  Each test resets the
// singleton + re-imports so module state is fresh.

describe("effects/keyboard-help", () => {
  let mod;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = "";
    document.body.className = "";
    mod = await import("../../../js/effects/keyboard-help.js");
    mod.initKeyboardHelp();
  });

  afterEach(() => {
    mod._resetForTests();
  });

  function pressQuestion() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "?", shiftKey: true, bubbles: true }),
    );
  }

  function getOverlay() {
    return document.querySelector(".keyboard-help-overlay");
  }

  it("opens the overlay on ?", () => {
    expect(getOverlay()).toBeNull();
    pressQuestion();
    expect(getOverlay()).not.toBeNull();
    expect(mod.isHelpOpen()).toBe(true);
  });

  it("lists the documented shortcuts", () => {
    pressQuestion();
    const text = getOverlay().textContent;
    expect(text).toContain("Cloudlog");
    expect(text).toContain("dev console");
  });

  it("toggles closed on a second ?", () => {
    pressQuestion();
    pressQuestion();
    expect(mod.isHelpOpen()).toBe(false);
  });

  it("does not stack on top of an open cheatsheet", async () => {
    // Two aria-modal dialogs (and two focus traps) must never be open at
    // once — ? yields while the cheatsheet owns the foreground.
    const cheatsheet = await import("../../../js/effects/cheatsheet.js");
    cheatsheet.openCheatsheet();
    try {
      pressQuestion();
      expect(mod.isHelpOpen()).toBe(false);
      expect(getOverlay()).toBeNull();
    } finally {
      cheatsheet._resetForTests();
    }
  });

  it("contains a focusable close button and moves focus into the dialog", () => {
    pressQuestion();
    const closeBtn = getOverlay().querySelector(".keyboard-help-close");
    expect(closeBtn).not.toBeNull();
    expect(document.activeElement).toBe(closeBtn);
  });

  it("closes when the close button is clicked", () => {
    pressQuestion();
    getOverlay()
      .querySelector(".keyboard-help-close")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(mod.isHelpOpen()).toBe(false);
  });

  it("closes on Escape", () => {
    pressQuestion();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(mod.isHelpOpen()).toBe(false);
  });

  it("does not intercept Escape when closed", () => {
    const handler = vi.fn();
    document.addEventListener("keydown", handler);
    const e = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(e);
    document.removeEventListener("keydown", handler);
    // The help module added no global Escape listener, so the event
    // reaches other handlers undisturbed (not defaultPrevented by us).
    expect(e.defaultPrevented).toBe(false);
  });
});
