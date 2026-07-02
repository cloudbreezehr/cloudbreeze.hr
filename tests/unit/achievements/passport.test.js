import { describe, it, expect, beforeEach, vi } from "vitest";

// Round-trips real storage state through the codec. storage.js holds
// module-level state, so each test re-imports a fresh copy over a cleared
// localStorage.

describe("achievements/passport", () => {
  let storage;
  let passport;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    storage = await import("../../../js/achievements/storage.js");
    passport = await import("../../../js/achievements/passport.js");
    storage.activate();
  });

  it("round-trips unlocks, counters, and collections", async () => {
    storage.unlock("first-light");
    storage.unlock("stargazer");
    storage.setCounter("totalClicks", 123);
    storage.addProgressItem("appearances-used", "dark");
    const code = passport.exportPassport();

    // A fresh profile on "another device".
    vi.resetModules();
    localStorage.clear();
    const storage2 = await import("../../../js/achievements/storage.js");
    const passport2 = await import("../../../js/achievements/passport.js");
    storage2.activate();

    const result = passport2.importPassport(code);
    expect(result).toEqual({ added: 2, total: 2 });
    expect(storage2.isUnlocked("first-light")).toBe(true);
    expect(storage2.isUnlocked("stargazer")).toBe(true);
    expect(storage2.getCounter("totalClicks")).toBe(123);
    expect(storage2.getProgressItems("appearances-used")).toContain("dark");
  });

  it("keeps the earliest timestamp when both sides unlocked the same thing", () => {
    storage.unlock("first-light");
    const localTs = storage.getUnlockTime("first-light");
    const earlier = localTs - 999999;
    const code = buildCode({
      u: [{ id: "first-light", ts: earlier }],
      c: {},
      p: {},
    });
    const result = passport.importPassport(code);
    expect(result.added).toBe(0);
    expect(storage.getUnlockTime("first-light")).toBe(earlier);
  });

  it("counters merge by max, day lists by union", async () => {
    storage.setCounter("totalClicks", 500);
    storage.setCounter("sessionDays", ["2026-01-01", "2026-01-02"]);
    const code = passport.exportPassport();

    vi.resetModules();
    localStorage.clear();
    const storage2 = await import("../../../js/achievements/storage.js");
    const passport2 = await import("../../../js/achievements/passport.js");
    storage2.activate();
    storage2.setCounter("totalClicks", 900);
    storage2.setCounter("sessionDays", ["2026-01-02", "2026-01-03"]);

    passport2.importPassport(code);
    expect(storage2.getCounter("totalClicks")).toBe(900);
    expect(storage2.getState().counters.sessionDays.sort()).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
  });

  it("rejects garbage, wrong prefixes, and tampered payloads", () => {
    expect(passport.importPassport("")).toBeNull();
    expect(passport.importPassport("not a code")).toBeNull();
    expect(passport.importPassport("XYZ1.abc.123")).toBeNull();
    const valid = passport.exportPassport();
    const tampered = valid.replace(/^CBP1\./, "CBP1.AAAA");
    expect(passport.importPassport(tampered)).toBeNull();
  });

  it("skips unknown achievement ids from a newer site", () => {
    const code = buildCode({
      u: [
        { id: "from-the-future", ts: 1 },
        { id: "first-light", ts: 1 },
      ],
      c: {},
      p: {},
    });
    const result = passport.importPassport(code);
    expect(result.added).toBe(1);
    expect(storage.isUnlocked("first-light")).toBe(true);
  });
});

// Hand-build a valid code, mirroring the codec's format (FNV-1a base36
// checksum over the base64 payload).
import { hashString } from "../../../js/daily/seed.js";
function buildCode(payload) {
  const b64 = btoa(
    String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))),
  );
  return `CBP1.${b64}.${hashString(b64).toString(36)}`;
}
