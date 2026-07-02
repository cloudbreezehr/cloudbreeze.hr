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

  it("kubectl reaches the real theme registry", () => {
    terminal.openTerminal();
    type("kubectl get themes");
    const lines = outputLines();
    expect(lines.find((l) => l.startsWith("frozen"))).toBeTruthy();
    expect(lines.find((l) => l.startsWith("matrix"))).toBeTruthy();
  });
});
