import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// storage.js maintains module-level state.  Each test resets modules to
// start from a clean in-memory state, and clears localStorage between runs
// so the first read returns the default state.

describe("achievements/storage", () => {
  let storage;

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    storage = await import("../../../js/achievements/storage.js");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("state shape", () => {
    it("returns a default state when storage is empty", () => {
      const state = storage.getState();
      expect(state).toMatchObject({
        active: false,
        hidden: false,
        unlocked: [],
        seen: [],
        relocked: [],
        progress: {},
      });
      expect(state.counters).toMatchObject({
        totalClicks: 0,
        totalThemeActivations: 0,
        sessions: 0,
        sessionDays: [],
      });
    });

    it("merges partial parsed state with defaults", () => {
      localStorage.setItem(
        "achievements",
        JSON.stringify({ active: true, counters: { totalClicks: 7 } }),
      );
      const state = storage.getState();
      expect(state.active).toBe(true);
      expect(state.counters.totalClicks).toBe(7);
      // Keys not present on disk still exist on the default
      expect(state.unlocked).toEqual([]);
      expect(state.counters.sessions).toBe(0);
    });

    it("falls back to defaults on invalid JSON", () => {
      localStorage.setItem("achievements", "not-json");
      const state = storage.getState();
      expect(state).toMatchObject({ active: false, unlocked: [] });
    });

    it("preserves a corrupt payload under a sidecar key", () => {
      localStorage.setItem("achievements", "not-json{");
      storage.getState();
      expect(localStorage.getItem("achievements.corrupt")).toEqual("not-json{");
    });

    it("stamps the schema version on default state", () => {
      const state = storage.getState();
      expect(state.version).toEqual(storage.SCHEMA_VERSION);
    });

    it("loads unversioned legacy state without losing data", () => {
      // Old saves (pre-versioning) wrote no `version` field; the
      // migrate hook should treat them as a lower version and pass
      // them through the existing field-merge.
      localStorage.setItem(
        "achievements",
        JSON.stringify({ active: true, unlocked: [{ id: "x", ts: 1 }] }),
      );
      const state = storage.getState();
      expect(state.active).toBe(true);
      expect(state.unlocked).toEqual([{ id: "x", ts: 1 }]);
    });
  });

  describe("activate / setHidden", () => {
    it("activate sets active=true, hidden=false, and persists immediately", () => {
      storage.activate();
      expect(storage.isActive()).toBe(true);
      expect(storage.isHidden()).toBe(false);
      const raw = JSON.parse(localStorage.getItem("achievements"));
      expect(raw.active).toBe(true);
    });

    it("setHidden persists the flag", () => {
      storage.setHidden(true);
      expect(storage.isHidden()).toBe(true);
      const raw = JSON.parse(localStorage.getItem("achievements"));
      expect(raw.hidden).toBe(true);
    });
  });

  describe("unlock / isUnlocked / getUnlocked", () => {
    it("unlocks a new achievement and returns true", () => {
      expect(storage.unlock("test-a")).toBe(true);
      expect(storage.isUnlocked("test-a")).toBe(true);
    });

    it("returns false when trying to unlock the same id twice", () => {
      storage.unlock("test-a");
      expect(storage.unlock("test-a")).toBe(false);
      expect(storage.getUnlocked().length).toBe(1);
    });

    it("stores a timestamp for unlocked items", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(1000));
      storage.unlock("test-ts");
      expect(storage.getUnlockTime("test-ts")).toBe(1000);
    });

    it("returns null unlock-time for unknown ids", () => {
      expect(storage.getUnlockTime("nope")).toBeNull();
    });
  });

  describe("seen tracking", () => {
    it("markSeen returns true the first time, false thereafter", () => {
      storage.unlock("test-a");
      expect(storage.markSeen("test-a")).toBe(true);
      expect(storage.markSeen("test-a")).toBe(false);
    });

    it("getUnseenCount counts unlocked items not yet seen", () => {
      storage.unlock("a");
      storage.unlock("b");
      storage.unlock("c");
      storage.markSeen("a");
      expect(storage.getUnseenCount()).toBe(2);
    });
  });

  describe("counters", () => {
    it("getCounter defaults to 0", () => {
      expect(storage.getCounter("unknown")).toBe(0);
    });

    it("setCounter updates the counter", () => {
      storage.setCounter("appearanceToggles", 5);
      expect(storage.getCounter("appearanceToggles")).toBe(5);
    });

    it("incrementCounter adds the default increment of 1", () => {
      storage.incrementCounter("clicks");
      storage.incrementCounter("clicks");
      expect(storage.getCounter("clicks")).toBe(2);
    });

    it("incrementCounter accepts a custom amount", () => {
      storage.incrementCounter("clicks", 5);
      expect(storage.getCounter("clicks")).toBe(5);
    });
  });

  describe("export / import", () => {
    it("round-trips state through export then import", async () => {
      storage.unlock("first-light");
      storage.setPref("revealHints", true);
      const json = storage.exportState();

      // Wipe and re-import into a fresh module instance.
      vi.resetModules();
      const fresh = await import("../../../js/achievements/storage.js");
      fresh.load();
      expect(fresh.isUnlocked("first-light")).toBe(false);
      expect(fresh.importState(json)).toBe(true);
      expect(fresh.isUnlocked("first-light")).toBe(true);
      expect(fresh.getPref("revealHints", false)).toBe(true);
    });

    it("rejects an unparseable import", () => {
      expect(storage.importState("}{not json")).toBe(false);
    });

    it("rejects a non-object import", () => {
      expect(storage.importState("42")).toBe(false);
    });
  });

  describe("currentStreak", () => {
    function isoDaysAgo(n) {
      return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    }

    it("returns 0 when today isn't recorded", () => {
      storage.getState().counters.sessionDays = [isoDaysAgo(3)];
      expect(storage.currentStreak()).toBe(0);
    });

    it("counts consecutive days ending today", () => {
      storage.getState().counters.sessionDays = [
        isoDaysAgo(2),
        isoDaysAgo(1),
        isoDaysAgo(0),
      ];
      expect(storage.currentStreak()).toBe(3);
    });

    it("stops at the first gap", () => {
      storage.getState().counters.sessionDays = [
        isoDaysAgo(5),
        isoDaysAgo(1),
        isoDaysAgo(0),
      ];
      expect(storage.currentStreak()).toBe(2);
    });
  });

  describe("visitedDayCount", () => {
    it("is 0 for a first-ever visit and counts distinct recorded days", () => {
      expect(storage.visitedDayCount()).toBe(0);
      storage.getState().counters.sessionDays = ["2026-06-02", "2026-06-03"];
      expect(storage.visitedDayCount()).toBe(2);
    });
  });

  describe("trigger tally", () => {
    it("counts each earn, starts at 0, and survives a reload", async () => {
      expect(storage.getTriggerCount("first-light")).toBe(0);
      storage.bumpTrigger("first-light");
      storage.bumpTrigger("first-light");
      expect(storage.getTriggerCount("first-light")).toBe(2);
      storage.saveNow();

      vi.resetModules();
      const fresh = await import("../../../js/achievements/storage.js");
      fresh.load();
      expect(fresh.getTriggerCount("first-light")).toBe(2);
    });

    it("is wiped by resetProgress", () => {
      storage.bumpTrigger("first-light");
      storage.resetProgress();
      expect(storage.getTriggerCount("first-light")).toBe(0);
    });

    it("setTriggerCount overrides the tally regardless of prior bumps", () => {
      storage.bumpTrigger("persistent");
      storage.bumpTrigger("persistent"); // 2 from an incidental unlock path
      storage.setTriggerCount("persistent", 1); // derived milestone value wins
      expect(storage.getTriggerCount("persistent")).toBe(1);
    });
  });

  describe("preferences", () => {
    it("getPref returns the fallback when unset", () => {
      expect(storage.getPref("revealHints", false)).toBe(false);
      expect(storage.getPref("missing", "x")).toBe("x");
    });

    it("setPref persists and round-trips through a reload", async () => {
      storage.setPref("revealHints", true);
      expect(storage.getPref("revealHints", false)).toBe(true);
      storage.saveNow();
      // Re-read from a fresh module instance to confirm it persisted.
      vi.resetModules();
      const fresh = await import("../../../js/achievements/storage.js");
      fresh.load();
      expect(fresh.getPref("revealHints", false)).toBe(true);
    });
  });

  describe("progress items", () => {
    it("getProgressItems returns empty array for unknown key", () => {
      expect(storage.getProgressItems("nothing")).toEqual([]);
    });

    it("addProgressItem adds uniquely", () => {
      expect(storage.addProgressItem("appearances-used", "dark")).toBe(true);
      expect(storage.addProgressItem("appearances-used", "dark")).toBe(false);
      expect(storage.addProgressItem("appearances-used", "light")).toBe(true);
      expect(storage.getProgressItems("appearances-used")).toEqual([
        "dark",
        "light",
      ]);
    });

    it("pruneProgressItems drops entries not in the valid list", () => {
      storage.addProgressItem("appearances-used", "dark");
      storage.addProgressItem("appearances-used", "old-name");
      storage.pruneProgressItems("appearances-used", ["dark", "light"]);
      expect(storage.getProgressItems("appearances-used")).toEqual(["dark"]);
    });

    it("pruneProgressItems is a no-op for an unknown key", () => {
      expect(() => storage.pruneProgressItems("nope", [])).not.toThrow();
    });
  });

  describe("relock", () => {
    it("relock removes an unlocked achievement and tracks it", () => {
      storage.unlock("a");
      storage.markSeen("a");
      expect(storage.relock("a")).toBe(true);
      expect(storage.isUnlocked("a")).toBe(false);
      expect(storage.isSeen("a")).toBe(false);
      expect(storage.isRelocked("a")).toBe(true);
    });

    it("relock returns false for never-unlocked ids", () => {
      expect(storage.relock("never")).toBe(false);
    });

    it("clearRelocked removes the relock marker", () => {
      storage.unlock("a");
      storage.relock("a");
      storage.clearRelocked("a");
      expect(storage.isRelocked("a")).toBe(false);
    });
  });

  describe("reset", () => {
    it("wipes all state and persists immediately", () => {
      storage.unlock("a");
      storage.setCounter("x", 42);
      storage.reset();
      expect(storage.isUnlocked("a")).toBe(false);
      expect(storage.getCounter("x")).toBe(0);
      const raw = JSON.parse(localStorage.getItem("achievements"));
      expect(raw.unlocked).toEqual([]);
    });
  });

  describe("resetProgress", () => {
    it("wipes earned progress but preserves active, hidden, and prefs", () => {
      storage.activate();
      storage.setHidden(true);
      storage.unlock("a");
      storage.setCounter("totalClicks", 99);
      storage.addProgressItem("appearances-used", "dark");
      storage.setPref("keepMe", "backup-code");

      storage.resetProgress();

      // Earned progress gone.
      expect(storage.isUnlocked("a")).toBe(false);
      expect(storage.getCounter("totalClicks")).toBe(0);
      expect(storage.getProgressItems("appearances-used")).toEqual([]);
      // Identity + the prefs bag (where a backup would live) survive.
      expect(storage.isActive()).toBe(true);
      expect(storage.isHidden()).toBe(true);
      expect(storage.getPref("keepMe")).toBe("backup-code");
    });

    it("persists immediately", () => {
      storage.unlock("a");
      storage.resetProgress();
      const raw = JSON.parse(localStorage.getItem("achievements"));
      expect(raw.unlocked).toEqual([]);
    });
  });

  describe("write failure", () => {
    it("flags lastWriteFailed and emits once on the rising edge", () => {
      const fired = vi.fn();
      window.addEventListener("storage-write-failed", fired);
      const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });

      storage.unlock("a");
      storage.saveNow(); // forces the write → fails
      expect(storage.lastWriteFailed()).toBe(true);
      expect(fired).toHaveBeenCalledTimes(1);

      // A second failed write while already-failed must not re-nag.
      storage.unlock("b");
      storage.saveNow();
      expect(fired).toHaveBeenCalledTimes(1);

      spy.mockRestore();
      window.removeEventListener("storage-write-failed", fired);
    });

    it("clears the failure flag once a write succeeds again", () => {
      const spy = vi
        .spyOn(localStorage, "setItem")
        .mockImplementationOnce(() => {
          throw new Error("quota");
        });
      storage.unlock("a");
      storage.saveNow();
      expect(storage.lastWriteFailed()).toBe(true);
      storage.saveNow(); // setItem works now
      expect(storage.lastWriteFailed()).toBe(false);
      spy.mockRestore();
    });
  });

  describe("unload flush", () => {
    it("flushes a pending debounced write on pagehide", () => {
      vi.useFakeTimers();
      storage.load(); // binds the pagehide/visibilitychange flush
      storage.setPref("k", "v"); // debounced via save(), timer pending
      // Nothing written yet — the debounce hasn't elapsed.
      window.dispatchEvent(new Event("pagehide"));
      const raw = JSON.parse(localStorage.getItem("achievements"));
      expect(raw.prefs.k).toEqual("v");
    });
  });
});
