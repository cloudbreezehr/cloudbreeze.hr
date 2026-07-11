import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Drives the overlay through its public surface: open, type, submit, close.
// The audio engine is untouched (playSfx is a no-op until sound is enabled),
// and matchMedia is stubbed for the modules that read it at import time.

describe("terminal/index", () => {
  let terminal;

  beforeEach(async () => {
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    document.body.innerHTML = "";
    document.body.className = "";
    vi.resetModules();
    terminal = await import("../../../js/terminal/index.js");
  });

  afterEach(() => {
    terminal._resetForTests();
    delete window.matchMedia;
  });

  function type(text) {
    const input = document.querySelector(".terminal-input");
    input.value = text;
    input.form.dispatchEvent(new Event("submit", { cancelable: true }));
  }

  function outputLines() {
    return [...document.querySelectorAll(".terminal-line")].map(
      (el) => el.textContent,
    );
  }

  it("opens with the banner and reports the discovery", () => {
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail.type));
    terminal.openTerminal();
    expect(terminal.isTerminalOpen()).toBe(true);
    expect(document.querySelector(".terminal-overlay")).not.toBeNull();
    expect(outputLines().join(" ")).toContain("sky shell");
    expect(events).toContain("terminal-open");
  });

  it("executes a command and prints the echo plus output", () => {
    terminal.openTerminal();
    type("echo hello sky");
    const lines = outputLines();
    expect(lines).toContain("visitor@cloudbreeze:~$ echo hello sky");
    expect(lines).toContain("hello sky");
  });

  it("announces each executed command on the achievement stream", () => {
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail));
    terminal.openTerminal();
    type("whoami");
    expect(events).toContainEqual(
      expect.objectContaining({ type: "terminal-command", command: "whoami" }),
    );
  });

  it("clear empties the scrollback", () => {
    terminal.openTerminal();
    type("echo noise");
    type("clear");
    expect(outputLines()).toEqual([]);
  });

  it("exit closes the overlay", () => {
    terminal.openTerminal();
    type("exit");
    expect(terminal.isTerminalOpen()).toBe(false);
  });

  it("Escape closes the overlay", () => {
    terminal.openTerminal();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
    );
    expect(terminal.isTerminalOpen()).toBe(false);
  });

  it("ArrowUp recalls the previous command into the input", () => {
    terminal.openTerminal();
    type("whoami");
    const input = document.querySelector(".terminal-input");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", cancelable: true }),
    );
    expect(input.value).toBe("whoami");
  });

  it("the backquote shortcut opens the console but types normally inside it", () => {
    terminal.initTerminal();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "`", cancelable: true }),
    );
    expect(terminal.isTerminalOpen()).toBe(true);
    // Focus sits in the prompt — a backquote there is input, not a toggle.
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "`", cancelable: true }),
    );
    expect(terminal.isTerminalOpen()).toBe(true);
    // Once focus leaves the prompt, the toggle applies again.
    document.querySelector(".terminal-input").blur();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "`", cancelable: true }),
    );
    expect(terminal.isTerminalOpen()).toBe(false);
  });

  it("man hands off to the cheatsheet, then hands back on close", () => {
    terminal.openTerminal();
    type("man cloudbreeze");
    expect(terminal.isTerminalOpen()).toBe(false);
    const overlay = document.querySelector(".cheatsheet-overlay");
    expect(overlay).not.toBeNull();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
    );
    expect(terminal.isTerminalOpen()).toBe(true);
  });

  it("kubectl reaches the real theme registry", () => {
    terminal.openTerminal();
    type("kubectl get themes");
    const lines = outputLines();
    expect(lines.find((l) => l.startsWith("frozen"))).toBeTruthy();
    expect(lines.find((l) => l.startsWith("matrix"))).toBeTruthy();
  });

  it("a plain click in the scrollback returns focus to the prompt", () => {
    terminal.openTerminal();
    type("echo hi");
    const scrollback = document.querySelector(".terminal-scrollback");
    const input = document.querySelector(".terminal-input");
    document.getSelection = vi.fn(() => ({ isCollapsed: true }));

    scrollback.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    scrollback.dispatchEvent(new Event("click", { bubbles: true }));
    expect(document.activeElement).toBe(input);

    delete document.getSelection;
  });

  it("a click that selected text keeps the selection's focus, not the prompt", () => {
    terminal.openTerminal();
    type("echo hi");
    const scrollback = document.querySelector(".terminal-scrollback");
    document.getSelection = vi.fn(() => ({ isCollapsed: false }));

    // Pressing down in the buffer starts a drag by moving focus off the prompt.
    scrollback.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.activeElement).toBe(scrollback);
    // The click ending the drag must not reclaim the prompt — that clears it.
    scrollback.dispatchEvent(new Event("click", { bubbles: true }));
    expect(document.activeElement).toBe(scrollback);

    delete document.getSelection;
  });

  it("Ctrl/Cmd+A selects the whole buffer instead of the prompt line", () => {
    terminal.openTerminal();
    type("echo copy me");
    const scrollback = document.querySelector(".terminal-scrollback");

    const added = [];
    const sel = {
      isCollapsed: true,
      removeAllRanges: vi.fn(),
      addRange: vi.fn((r) => added.push(r)),
    };
    document.getSelection = vi.fn(() => sel);

    const ev = new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    scrollback.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(sel.removeAllRanges).toHaveBeenCalled();
    expect(added).toHaveLength(1);
    // The range spans every output line, not the prompt's single row.
    expect(added[0].startContainer).toBe(scrollback);
    expect(added[0].endOffset).toBe(scrollback.childNodes.length);
    expect(document.activeElement).toBe(scrollback);

    delete document.getSelection;
  });

  // A selection parks focus on the scrollback; an edit keystroke should return
  // to the prompt so it starts (or edits) a command instead of being lost.
  it.each(["l", "Backspace", "Delete"])(
    "editing (%s) after a selection hands focus to the prompt",
    (key) => {
      terminal.openTerminal();
      type("echo hi");
      const scrollback = document.querySelector(".terminal-scrollback");
      const input = document.querySelector(".terminal-input");

      scrollback.focus();
      scrollback.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
      expect(document.activeElement).toBe(input);
    },
  );

  it("typing a character over a selection inserts it into the prompt", () => {
    terminal.openTerminal();
    type("echo hi");
    const scrollback = document.querySelector(".terminal-scrollback");
    const input = document.querySelector(".terminal-input");

    // Focus parked on the scrollback (a selection); the keystroke must both
    // return focus and land the character, not just move focus and drop it.
    scrollback.focus();
    const ev = new KeyboardEvent("keydown", {
      key: "x",
      bubbles: true,
      cancelable: true,
    });
    scrollback.dispatchEvent(ev);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("x");
    expect(ev.defaultPrevented).toBe(true);
  });

  it("a copy shortcut over a selection doesn't steal focus to the prompt", () => {
    terminal.openTerminal();
    type("echo hi");
    const scrollback = document.querySelector(".terminal-scrollback");

    // Ctrl/Cmd+C must leave focus on the scrollback — grabbing the prompt
    // would collapse the selection before the copy runs.
    scrollback.focus();
    scrollback.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "c",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(document.activeElement).toBe(scrollback);
  });
});
