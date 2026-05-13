import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// activity-log holds module-level state (the entry array, listener set).
// Each test resets modules + clears localStorage so a fresh import starts
// from a known-empty state.  The module also runs purgeExpired() at import
// time, so the system clock is stabilized via setSystemTime before each
// import.

const BOOT_TIME = new Date("2026-05-08T12:00:00Z").getTime();

async function importLog() {
  vi.resetModules();
  return await import("../../../js/achievements/activity-log.js");
}

describe("achievements/activity-log", () => {
  let log;

  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(BOOT_TIME);
    log = await importLog();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("log() and accessors", () => {
    it("starts with an empty active and trashed list", () => {
      expect(log.getActive()).toEqual([]);
      expect(log.getTrashed()).toEqual([]);
      expect(log.getUnseenCount()).toEqual(0);
      expect(log.getTrashedCount()).toEqual(0);
    });

    it("appends an entry, returns its id, and shows it as active+unseen", () => {
      const id = log.log("achievement-unlocked", { achievementId: "first" });
      const active = log.getActive();
      expect(active).toHaveLength(1);
      expect(active[0].id).toEqual(id);
      expect(active[0].type).toEqual("achievement-unlocked");
      expect(active[0].payload).toEqual({ achievementId: "first" });
      expect(active[0].timestamp).toEqual(BOOT_TIME);
      expect(active[0].seen).toBe(false);
      expect(active[0].trashedAt).toEqual(null);
      expect(log.getUnseenCount()).toEqual(1);
    });

    it("returns active entries newest-first", () => {
      log.log("a", { n: 1 });
      vi.advanceTimersByTime(1000);
      log.log("a", { n: 2 });
      vi.advanceTimersByTime(1000);
      log.log("a", { n: 3 });
      const active = log.getActive();
      expect(active.map((e) => e.payload.n)).toEqual([3, 2, 1]);
    });

    it("persists to localStorage under STORAGE_KEY", () => {
      log.log("a", { n: 1 });
      const raw = localStorage.getItem(log.STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toEqual("a");
    });
  });

  describe("MAX_ENTRIES eviction", () => {
    it("evicts the oldest active entry once the cap is exceeded", async () => {
      // Cap is high (1000) — drive it down via dev-registry tuning isn't
      // available here, so seed localStorage with a near-full log and add
      // the overflow entries through the API.
      const { AL } = log;
      const seedCount = AL.MAX_ENTRIES;
      const seed = Array.from({ length: seedCount }, (_, i) => ({
        id: `evt_seed_${i}`,
        type: "a",
        timestamp: BOOT_TIME - (seedCount - i),
        seen: false,
        trashedAt: null,
        payload: { n: i },
      }));
      // Newest-first ordering — index 0 is the newest seeded entry.
      seed.reverse();
      localStorage.setItem(log.STORAGE_KEY, JSON.stringify(seed));
      log = await importLog();

      expect(log.getActive()).toHaveLength(AL.MAX_ENTRIES);
      const oldestSeedId = seed[seed.length - 1].id;
      log.log("a", { n: "newest" });
      const active = log.getActive();
      expect(active).toHaveLength(AL.MAX_ENTRIES);
      // The oldest seeded entry was evicted, the new entry is at the head.
      expect(active.find((e) => e.id === oldestSeedId)).toBeUndefined();
      expect(active[0].payload).toEqual({ n: "newest" });
    });

    it("evicts trashed entries before active when over cap", async () => {
      const { AL } = log;
      const seedCount = AL.MAX_ENTRIES;
      // Half trashed, half active — newest-first.
      const seed = Array.from({ length: seedCount }, (_, i) => ({
        id: `evt_seed_${i}`,
        type: "a",
        timestamp: BOOT_TIME - i,
        seen: false,
        trashedAt: i % 2 === 0 ? BOOT_TIME - i : null,
        payload: { n: i, trashed: i % 2 === 0 },
      }));
      localStorage.setItem(log.STORAGE_KEY, JSON.stringify(seed));
      log = await importLog();

      const trashedBefore = log.getTrashedCount();
      const activeBefore = log.getActive().length;
      log.log("a", { n: "newest" });
      // The new entry pushed the count over MAX_ENTRIES; one trashed entry
      // got evicted to make room.
      expect(log.getTrashedCount()).toEqual(trashedBefore - 1);
      expect(log.getActive().length).toEqual(activeBefore + 1);
    });
  });

  describe("trash / restore", () => {
    it("trash() moves an entry to the trashed view with trashedAt set", () => {
      const id = log.log("a", { n: 1 });
      vi.advanceTimersByTime(1000);
      log.trash(id);
      expect(log.getActive()).toEqual([]);
      const trashed = log.getTrashed();
      expect(trashed).toHaveLength(1);
      expect(trashed[0].id).toEqual(id);
      expect(trashed[0].trashedAt).toEqual(BOOT_TIME + 1000);
    });

    it("trash() is a no-op for unknown ids and already-trashed entries", () => {
      const id = log.log("a", { n: 1 });
      log.trash(id);
      const firstTrashedAt = log.getTrashed()[0].trashedAt;
      vi.advanceTimersByTime(5000);
      // Trashing again should not update the timestamp.
      log.trash(id);
      expect(log.getTrashed()[0].trashedAt).toEqual(firstTrashedAt);
      // Unknown id is a silent no-op.
      log.trash("evt_does_not_exist");
      expect(log.getTrashed()).toHaveLength(1);
    });

    it("restore() moves a trashed entry back to active", () => {
      const id = log.log("a", { n: 1 });
      log.trash(id);
      log.restore(id);
      expect(log.getActive()).toHaveLength(1);
      expect(log.getTrashed()).toEqual([]);
      expect(log.getActive()[0].trashedAt).toEqual(null);
    });

    it("restore() is a no-op for non-trashed entries", () => {
      const id = log.log("a", { n: 1 });
      log.restore(id);
      expect(log.getActive()).toHaveLength(1);
      expect(log.getActive()[0].trashedAt).toEqual(null);
    });
  });

  describe("clear / emptyTrash", () => {
    it("clear() soft-deletes every active entry", () => {
      log.log("a", { n: 1 });
      log.log("a", { n: 2 });
      log.log("a", { n: 3 });
      log.clear();
      expect(log.getActive()).toEqual([]);
      expect(log.getTrashed()).toHaveLength(3);
    });

    it("emptyTrash() hard-deletes every trashed entry", () => {
      const idA = log.log("a", { n: 1 });
      log.log("a", { n: 2 });
      log.trash(idA);
      log.emptyTrash();
      expect(log.getActive()).toHaveLength(1);
      expect(log.getTrashed()).toEqual([]);
    });
  });

  describe("markAllSeen / getUnseenCount", () => {
    it("counts only unseen, non-trashed entries", () => {
      const id1 = log.log("a", { n: 1 });
      log.log("a", { n: 2 });
      const id3 = log.log("a", { n: 3 });
      log.trash(id3);
      expect(log.getUnseenCount()).toEqual(2);
      // Mark everything seen — count drops to 0.
      log.markAllSeen();
      expect(log.getUnseenCount()).toEqual(0);
      // Trashed entries are not affected by markAllSeen — verify by id.
      expect(log.getTrashed().find((e) => e.id === id3).seen).toBe(false);
      expect(log.getActive().find((e) => e.id === id1).seen).toBe(true);
    });
  });

  describe("purgeExpired (cross-session)", () => {
    it("removes trashed entries older than TRASH_TTL_MS at import time", async () => {
      const { AL } = log;
      // Seed with one trashed entry just past the TTL boundary and one
      // recently trashed.
      const SLACK_MS = 1000;
      const expired = {
        id: "evt_expired",
        type: "a",
        timestamp: BOOT_TIME - AL.TRASH_TTL_MS - SLACK_MS,
        seen: true,
        trashedAt: BOOT_TIME - AL.TRASH_TTL_MS - SLACK_MS,
        payload: {},
      };
      const fresh = {
        id: "evt_fresh",
        type: "a",
        timestamp: BOOT_TIME - 1000,
        seen: true,
        trashedAt: BOOT_TIME - 1000,
        payload: {},
      };
      localStorage.setItem(log.STORAGE_KEY, JSON.stringify([fresh, expired]));
      log = await importLog();

      const trashed = log.getTrashed();
      expect(trashed).toHaveLength(1);
      expect(trashed[0].id).toEqual("evt_fresh");
    });

    it("preserves trashed entries within the TTL window", async () => {
      const { AL } = log;
      const SLACK_MS = 1000;
      const recentlyTrashed = {
        id: "evt_recent",
        type: "a",
        timestamp: BOOT_TIME - AL.TRASH_TTL_MS + SLACK_MS,
        seen: true,
        trashedAt: BOOT_TIME - AL.TRASH_TTL_MS + SLACK_MS,
        payload: {},
      };
      localStorage.setItem(log.STORAGE_KEY, JSON.stringify([recentlyTrashed]));
      log = await importLog();

      expect(log.getTrashed()).toHaveLength(1);
    });
  });

  describe("backfill", () => {
    it("backfills trashedAt=null on entries persisted before soft-delete existed", async () => {
      // Old format: no trashedAt field.
      const legacy = [
        {
          id: "evt_legacy",
          type: "a",
          timestamp: BOOT_TIME - 1000,
          seen: false,
          payload: { n: 1 },
        },
      ];
      localStorage.setItem(log.STORAGE_KEY, JSON.stringify(legacy));
      log = await importLog();

      const active = log.getActive();
      expect(active).toHaveLength(1);
      expect(active[0].trashedAt).toEqual(null);
    });
  });

  describe("load() resilience", () => {
    it("falls back to empty array on invalid JSON", async () => {
      localStorage.setItem(log.STORAGE_KEY, "not-json");
      log = await importLog();
      expect(log.getActive()).toEqual([]);
    });

    it("falls back to empty array when the persisted value is not an array", async () => {
      localStorage.setItem(log.STORAGE_KEY, JSON.stringify({ oops: true }));
      log = await importLog();
      expect(log.getActive()).toEqual([]);
    });
  });

  describe("onChange listener", () => {
    it("notifies subscribers after log() and returns an unsubscribe", () => {
      const cb = vi.fn();
      const unsub = log.onChange(cb);
      log.log("a", { n: 1 });
      expect(cb).toHaveBeenCalledTimes(1);
      log.log("a", { n: 2 });
      expect(cb).toHaveBeenCalledTimes(2);
      unsub();
      log.log("a", { n: 3 });
      expect(cb).toHaveBeenCalledTimes(2);
    });

    it("notifies on trash, restore, clear, emptyTrash, markAllSeen", () => {
      const cb = vi.fn();
      log.onChange(cb);
      const id = log.log("a", { n: 1 });
      const before = cb.mock.calls.length;
      log.trash(id);
      log.restore(id);
      log.markAllSeen();
      log.clear();
      log.emptyTrash();
      // Each mutation triggers exactly one notification.
      expect(cb.mock.calls.length - before).toEqual(5);
    });

    it("does not notify on no-op trash/restore", () => {
      const cb = vi.fn();
      log.onChange(cb);
      log.trash("evt_does_not_exist");
      log.restore("evt_does_not_exist");
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
