import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// identity.js persists visitor/session IDs in localStorage / sessionStorage.
// Each test clears both and re-imports so module-level state resets.

describe("analytics/identity", () => {
  let identity;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    identity = await import("../../js/analytics/identity.js");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("visitorId", () => {
    it("returns a UUID and persists it across calls", () => {
      const a = identity.visitorId();
      const b = identity.visitorId();
      expect(a).toEqual(b);
      expect(a).toMatch(/^[0-9a-f-]{30,}$/i);
    });

    it("reads persisted visitor id after module reset", async () => {
      const first = identity.visitorId();
      vi.resetModules();
      const identity2 = await import("../../js/analytics/identity.js");
      expect(identity2.visitorId()).toEqual(first);
    });
  });

  describe("firstVisitTs / daysSinceFirstVisit", () => {
    it("sets first_visit_ts once and never updates", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-01T00:00:00Z"));
      const ts1 = identity.firstVisitTs();
      vi.setSystemTime(new Date("2026-05-10T00:00:00Z"));
      const ts2 = identity.firstVisitTs();
      expect(ts2).toEqual(ts1);
    });

    it("daysSinceFirstVisit reflects the delta from stored ts", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-01T00:00:00Z"));
      identity.firstVisitTs();
      vi.setSystemTime(new Date("2026-05-08T00:00:00Z"));
      expect(identity.daysSinceFirstVisit()).toEqual(7);
    });
  });

  describe("visitCount + isFirstVisitEver", () => {
    it("isFirstVisitEver is true before bumpVisitCount and false after", () => {
      expect(identity.isFirstVisitEver()).toBe(true);
      identity.bumpVisitCount();
      expect(identity.isFirstVisitEver()).toBe(false);
    });

    it("bumpVisitCount increments monotonically", () => {
      expect(identity.bumpVisitCount()).toEqual(1);
      expect(identity.bumpVisitCount()).toEqual(2);
      expect(identity.visitCount()).toEqual(2);
    });
  });

  describe("session", () => {
    it("sessionId is stable within a session and resets with sessionStorage", async () => {
      const a = identity.sessionId();
      expect(identity.sessionId()).toEqual(a);
      sessionStorage.clear();
      vi.resetModules();
      const identity2 = await import("../../js/analytics/identity.js");
      expect(identity2.sessionId()).not.toEqual(a);
    });

    it("bumpAndGetSessionSeq returns strictly increasing integers", () => {
      identity.sessionId();
      const a = identity.bumpAndGetSessionSeq();
      const b = identity.bumpAndGetSessionSeq();
      const c = identity.bumpAndGetSessionSeq();
      expect(a).toEqual(1);
      expect(b).toEqual(2);
      expect(c).toEqual(3);
    });
  });
});
