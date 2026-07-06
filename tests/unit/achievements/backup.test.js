import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The sealed save-to-file / restore-from-file format. storage.js holds
// module-level state, so each test re-imports a fresh copy over a cleared
// localStorage; a second import stands in for "another device / a reset".

describe("achievements/backup", () => {
  let storage;
  let backup;
  let passport;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T10:30:00Z"));
    localStorage.clear();
    storage = await import("../../../js/achievements/storage.js");
    backup = await import("../../../js/achievements/backup.js");
    passport = await import("../../../js/achievements/passport.js");
    storage.activate();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // A clean profile with its own module state — export from `storage`, import here.
  async function freshProfile() {
    vi.resetModules();
    localStorage.clear();
    const storage2 = await import("../../../js/achievements/storage.js");
    const backup2 = await import("../../../js/achievements/backup.js");
    storage2.activate();
    return { storage2, backup2 };
  }

  it("exports readable, tagged JSON sealed with a valid passport", () => {
    storage.unlock("first-light");
    storage.setCounter("totalClicks", 42);
    const file = JSON.parse(backup.exportBackup());

    expect(file.cloudbreeze).toBe("cloudbreeze-cloudlog");
    expect(file.version).toBe(1);
    expect(file.exportedAt).toBe("2026-07-06T10:30:00.000Z");
    // The readable block mirrors live state...
    expect(file.state.counters.totalClicks).toBe(42);
    expect(file.state.unlocked.some((u) => u.id === "first-light")).toBe(true);
    // ...and the seal validates on its own.
    expect(passport.parsePassport(file.passport)).not.toBeNull();
  });

  it("round-trips the whole state to a fresh profile (prefs included)", async () => {
    storage.unlock("first-light");
    storage.unlock("stargazer");
    storage.setCounter("totalClicks", 123);
    storage.addProgressItem("appearances-used", "dark");
    storage.setPref("compactCards", true);
    const json = backup.exportBackup();

    const { storage2, backup2 } = await freshProfile();
    expect(backup2.importBackup(json)).toBe(true);
    expect(storage2.isUnlocked("first-light")).toBe(true);
    expect(storage2.isUnlocked("stargazer")).toBe(true);
    expect(storage2.getCounter("totalClicks")).toBe(123);
    expect(storage2.getProgressItems("appearances-used")).toContain("dark");
    // Non-core fields ride along on the full-state replace, even though the
    // seal doesn't cover them.
    expect(storage2.getPref("compactCards", false)).toBe(true);
  });

  it("refuses a file whose readable counter was hand-edited", async () => {
    storage.setCounter("totalClicks", 10);
    const file = JSON.parse(backup.exportBackup());
    file.state.counters.totalClicks = 999999; // seal left untouched

    const { storage2, backup2 } = await freshProfile();
    expect(backup2.importBackup(JSON.stringify(file))).toBe(false);
    expect(storage2.getCounter("totalClicks")).toBe(0); // nothing restored
  });

  it("refuses a file with a hand-added unlock", async () => {
    storage.unlock("first-light");
    const file = JSON.parse(backup.exportBackup());
    file.state.unlocked.push({ id: "stargazer", ts: 1 });

    const { storage2, backup2 } = await freshProfile();
    expect(backup2.importBackup(JSON.stringify(file))).toBe(false);
    expect(storage2.isUnlocked("stargazer")).toBe(false);
  });

  it("refuses a file with no seal", () => {
    const file = JSON.parse(backup.exportBackup());
    delete file.passport;
    expect(backup.importBackup(JSON.stringify(file))).toBe(false);
  });

  it("refuses a seal that fails its own checksum", () => {
    const file = JSON.parse(backup.exportBackup());
    file.passport = file.passport.replace(/\.[^.]+$/, ".deadbeef");
    expect(backup.importBackup(JSON.stringify(file))).toBe(false);
  });

  it("refuses non-JSON and non-object payloads", () => {
    expect(backup.importBackup("}{ not json")).toBe(false);
    expect(backup.importBackup("42")).toBe(false);
    expect(backup.importBackup("null")).toBe(false);
  });

  it("refuses a malformed state without throwing", () => {
    const file = JSON.parse(backup.exportBackup());
    delete file.state.progress; // the seal check would otherwise throw on it
    expect(backup.importBackup(JSON.stringify(file))).toBe(false);
  });
});
