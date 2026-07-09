import { describe, it, expect, beforeEach, vi } from "vitest";
import { createCommands, executeLine } from "../../../js/terminal/commands.js";

// Commands are pure over injected deps; each test builds a small fake world
// and reads back the printed lines and the calls the command routed out.

describe("terminal/commands", () => {
  let deps;
  let commands;
  let themeState;

  function run(line, ctx = { history: [] }) {
    return executeLine(line, commands, ctx);
  }

  beforeEach(() => {
    themeState = new Map([
      ["frozen", false],
      ["matrix", true],
    ]);
    deps = {
      themes: {
        list: () =>
          [...themeState].map(([id, active]) => ({
            id,
            label: id,
            active,
          })),
        activate: vi.fn((id) => themeState.set(id, true)),
        deactivate: vi.fn((id) => themeState.set(id, false)),
        clearAll: vi.fn(() => {
          const removed = [...themeState]
            .filter(([, active]) => active)
            .map(([id]) => id);
          for (const id of removed) themeState.set(id, false);
          return removed;
        }),
      },
      spellWords: () => [{ word: "BOOM", hint: "" }],
      castWord: vi.fn((word) => word === "BOOM" || word === "DEPLOY"),
      stats: () => ({ points: 120, unlocked: 7, total: 40 }),
      qualityTier: () => "high",
      openCheatsheet: vi.fn(),
      daily: () => ({
        seedKey: "2026-07-02",
        todayKey: "2026-07-02",
        traveling: false,
        word: "METEOR",
        link: "https://cloudbreeze.hr/#sky=2026-07-02",
      }),
      passport: {
        issue: vi.fn(() => "CBP1.fake.code"),
        stamp: vi.fn((code) =>
          code === "CBP1.fake.code" ? { added: 3, total: 5 } : null,
        ),
      },
      copy: vi.fn(),
      emit: vi.fn(),
    };
    commands = createCommands(deps);
  });

  it("help lists every command exactly once", () => {
    const { lines } = run("help");
    for (const c of commands) {
      expect(lines.filter((l) => l.trim().startsWith(c.name))).toHaveLength(1);
    }
  });

  it("unknown commands get the classic scolding", () => {
    const { lines } = run("frobnicate --hard");
    expect(lines).toEqual(["sky: command not found: frobnicate"]);
  });

  it("empty input prints nothing", () => {
    expect(run("   ")).toEqual({ lines: [] });
  });

  it("whoami reports secrets and points", () => {
    const { lines } = run("whoami");
    expect(lines[0]).toContain("7/40 secrets");
    expect(lines[0]).toContain("120 points");
  });

  it("ls secrets/ is denied", () => {
    const { lines } = run("ls secrets/");
    expect(lines[0]).toContain("Permission denied");
  });

  it("ls themes lists the registry ids", () => {
    const { lines } = run("ls themes");
    expect(lines[0]).toContain("frozen");
    expect(lines[0]).toContain("matrix");
  });

  it("man opens the book of secrets", () => {
    run("man cloudbreeze");
    expect(deps.openCheatsheet).toHaveBeenCalled();
  });

  it("plain sudo is denied and reported", () => {
    const { lines } = run("sudo make me a sandwich");
    expect(lines.join(" ")).toContain("not in the sudoers file");
    expect(deps.emit).toHaveBeenCalledWith("terminal-sudo-denied");
  });

  it("sudo rm -rf / clears every active theme", () => {
    const { lines } = run("sudo rm -rf /");
    expect(deps.themes.clearAll).toHaveBeenCalled();
    expect(deps.emit).toHaveBeenCalledWith("terminal-rm-rf");
    expect(lines).toContain("removed '/sky/themes/matrix'");
    expect(lines.join(" ")).toContain("Operation not permitted");
  });

  it("sudo rm with split flags still counts as the classic", () => {
    run("sudo rm -r -f /");
    expect(deps.emit).toHaveBeenCalledWith("terminal-rm-rf");
  });

  it("sudo rm on a non-root path stays a sudoers scolding", () => {
    const { lines } = run("sudo rm -rf /tmp");
    expect(lines.join(" ")).toContain("not in the sudoers file");
  });

  it("bare rm -rf / clears every active theme — no sudo needed", () => {
    const { lines } = run("rm -rf /");
    expect(deps.themes.clearAll).toHaveBeenCalled();
    expect(deps.emit).toHaveBeenCalledWith("terminal-rm-rf");
    expect(lines).toContain("removed '/sky/themes/matrix'");
    expect(lines.join(" ")).toContain("Operation not permitted");
  });

  it("bare rm with the meme's extra flags still counts as the classic", () => {
    run("rm -rf --no-preserve-root /");
    expect(deps.emit).toHaveBeenCalledWith("terminal-rm-rf");
  });

  it("bare rm short of the classic is a playful refusal, not command-not-found", () => {
    const { lines } = run("rm -rf");
    const text = lines.join(" ");
    expect(text).not.toContain("command not found");
    expect(text.toLowerCase()).toContain("rm:");
    expect(deps.emit).not.toHaveBeenCalledWith("terminal-rm-rf");
  });

  it("kubectl get themes prints a status table", () => {
    const { lines } = run("kubectl get themes");
    expect(lines[0]).toMatch(/NAME\s+READY\s+STATUS/);
    expect(lines.find((l) => l.startsWith("matrix"))).toContain("Running");
    expect(lines.find((l) => l.startsWith("frozen"))).toContain("Dormant");
    expect(deps.emit).toHaveBeenCalledWith("terminal-kubectl");
  });

  it("kubectl apply activates a dormant theme", () => {
    const { lines } = run("kubectl apply -f frozen");
    expect(deps.themes.activate).toHaveBeenCalledWith("frozen");
    expect(lines[0]).toBe("theme.cloudbreeze.hr/frozen configured");
  });

  it("kubectl apply on a running theme reports unchanged", () => {
    const { lines } = run("kubectl apply -f matrix");
    expect(deps.themes.activate).not.toHaveBeenCalled();
    expect(lines[0]).toContain("unchanged");
  });

  it("kubectl delete deactivates a running theme", () => {
    const { lines } = run("kubectl delete theme matrix");
    expect(deps.themes.deactivate).toHaveBeenCalledWith("matrix");
    expect(lines[0]).toBe('theme "matrix" deleted');
  });

  it("cast releases a known spell and rejects an unknown one", () => {
    expect(run("cast boom").lines[0]).toBe("BOOM released.");
    expect(deps.castWord).toHaveBeenCalledWith("BOOM");
    expect(run("cast xyzzy").lines[0]).toContain("unknown spell 'XYZZY'");
  });

  it("deploy ships via the DEPLOY spell", () => {
    run("deploy");
    expect(deps.castWord).toHaveBeenCalledWith("DEPLOY");
  });

  it("passport with no args issues a code and copies it", () => {
    const { lines } = run("passport");
    expect(deps.passport.issue).toHaveBeenCalled();
    expect(deps.copy).toHaveBeenCalledWith("CBP1.fake.code");
    expect(lines).toContain("CBP1.fake.code");
    expect(deps.emit).toHaveBeenCalledWith("passport-export");
  });

  it("passport with a code stamps it in and reports the merge", () => {
    const { lines } = run("passport CBP1.fake.code");
    expect(lines[0]).toContain(
      "3 new unlocks carried over (5 on the passport)",
    );
    expect(deps.emit).toHaveBeenCalledWith("passport-import");
  });

  it("passport rejects an invalid code without emitting", () => {
    const { lines } = run("passport garbage");
    expect(lines[0]).toContain("didn't validate");
    expect(deps.emit).not.toHaveBeenCalledWith("passport-import");
  });

  it("today reports the sky of the day, its link, and its word", () => {
    const { lines } = run("today");
    expect(lines[0]).toBe("Sky of the day: 2026-07-02");
    expect(lines.join(" ")).toContain("#sky=2026-07-02");
    expect(lines.join(" ")).toContain("Word of the day: METEOR");
  });

  it("today points a link time-traveler back home via the link", () => {
    deps.daily = () => ({
      seedKey: "2025-12-24",
      todayKey: "2026-07-02",
      traveling: true,
      viaLink: true,
      word: "METEOR",
      link: "https://cloudbreeze.hr/#sky=2025-12-24",
    });
    commands = createCommands(deps);
    const { lines } = run("today");
    expect(lines[0]).toContain("past sky: 2025-12-24");
    expect(lines[1]).toContain("2026-07-02");
    expect(lines[1]).toContain("drop the #sky link");
  });

  it("today tells a page left open past midnight to reload, not to drop a link", () => {
    deps.daily = () => ({
      seedKey: "2026-07-01",
      todayKey: "2026-07-02",
      traveling: true,
      viaLink: false,
      word: "METEOR",
      link: "https://cloudbreeze.hr/#sky=2026-07-01",
    });
    commands = createCommands(deps);
    const { lines } = run("today");
    expect(lines[1]).toContain("reload");
    expect(lines[1]).not.toContain("drop the #sky link");
  });

  it("history echoes the session's numbered commands", () => {
    const { lines } = run("history", { history: ["ls", "help"] });
    expect(lines).toEqual(["  1  ls", "  2  help"]);
  });

  it("clear and exit flag the overlay actions", () => {
    expect(run("clear").clear).toBe(true);
    expect(run("exit").close).toBe(true);
  });
});
