import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The cheatsheet reveals the spellable secrets in a modal (focus trap + Esc +
// backdrop dismiss, like keyboard-help) and, once discovered, persists a flag
// so a corner button reopens it. Each test clears storage + re-imports so the
// discovered pref and module singletons are fresh.

describe("effects/cheatsheet", () => {
  let mod;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    document.body.innerHTML = "";
    document.body.className = "";
    mod = await import("../../../js/effects/cheatsheet.js");
  });

  afterEach(() => {
    mod._resetForTests();
  });

  const getOverlay = () => document.querySelector(".cheatsheet-overlay");
  const getToggle = () => document.querySelector(".cheatsheet-toggle");

  it("opens and closes the overlay", () => {
    expect(getOverlay()).toBeNull();
    mod.openCheatsheet();
    expect(getOverlay()).not.toBeNull();
    expect(mod.isCheatsheetOpen()).toBe(true);
    mod.closeCheatsheet();
    expect(mod.isCheatsheetOpen()).toBe(false);
  });

  it("toggles open then closed", () => {
    mod.toggleCheatsheet();
    expect(mod.isCheatsheetOpen()).toBe(true);
    mod.toggleCheatsheet();
    expect(mod.isCheatsheetOpen()).toBe(false);
  });

  it("lists themes and incantations with incantation hints", () => {
    mod.openCheatsheet();
    const text = getOverlay().textContent;
    expect(text).toContain("Frozen"); // a theme label
    expect(text).toContain("BOOM"); // an incantation word
    expect(text).toContain("fireworks rockets"); // its hint
  });

  it("moves focus to the close button and closes on click", () => {
    mod.openCheatsheet();
    const closeBtn = getOverlay().querySelector(".cheatsheet-close");
    expect(document.activeElement).toBe(closeBtn);
    closeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(mod.isCheatsheetOpen()).toBe(false);
  });

  it("closes on Escape", () => {
    mod.openCheatsheet();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(mod.isCheatsheetOpen()).toBe(false);
  });

  it("closes on a backdrop click but not a panel click", () => {
    mod.openCheatsheet();
    const overlay = getOverlay();
    overlay
      .querySelector(".cheatsheet-panel")
      .dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(mod.isCheatsheetOpen()).toBe(true);
    overlay.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(mod.isCheatsheetOpen()).toBe(false);
  });

  it("persists discovery and mounts the corner button on first find", () => {
    expect(mod.isCheatsheetDiscovered()).toBe(false);
    expect(getToggle()).toBeNull();
    const first = mod.markCheatsheetDiscovered();
    expect(first).toBe(true);
    expect(mod.isCheatsheetDiscovered()).toBe(true);
    expect(getToggle()).not.toBeNull();
  });

  it("announces the first discovery for achievements, once", () => {
    const handler = vi.fn();
    window.addEventListener("achievement", handler);
    mod.markCheatsheetDiscovered();
    mod.markCheatsheetDiscovered();
    window.removeEventListener("achievement", handler);
    const discoveries = handler.mock.calls.filter(
      ([e]) => e.detail.type === "cheatsheet-discovered",
    );
    expect(discoveries).toHaveLength(1);
  });

  it("mounts the corner button on init when already discovered", async () => {
    mod.markCheatsheetDiscovered();
    mod._resetForTests(); // simulate a fresh page load with the pref persisted
    expect(getToggle()).toBeNull();
    mod.initCheatsheet();
    expect(getToggle()).not.toBeNull();
  });

  it("does not mount the corner button on init when undiscovered", () => {
    mod.initCheatsheet();
    expect(getToggle()).toBeNull();
  });

  it("the corner button toggles the panel", () => {
    mod.markCheatsheetDiscovered();
    getToggle().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(mod.isCheatsheetOpen()).toBe(true);
    getToggle().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(mod.isCheatsheetOpen()).toBe(false);
  });
});
