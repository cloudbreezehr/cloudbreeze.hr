import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// context.js memoizes the static context at module load.  We reset
// modules per-test so a previous test's referrer/UTM capture doesn't
// leak into the next one.

describe("analytics/context", () => {
  let context;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    context = await import("../../../js/analytics/context.js");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("baseProps", () => {
    it("includes identity, viewport, theme, and timestamps", () => {
      const p = context.baseProps();
      expect(p.visitor_id).toBeTruthy();
      expect(p.session_id).toBeTruthy();
      expect(p.session_seq).toBeGreaterThan(0);
      expect(p.viewport_w).toBeGreaterThan(0);
      expect(p.theme_effective).toMatch(/^(dark|light)$/);
      expect(p.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("points_total sums achievement points when unlocked entries exist", async () => {
      // Pick a real achievement id from the registry so sumPoints resolves
      // to a non-zero value.  "first-light" is TRIVIAL (1 point).
      localStorage.setItem(
        "achievements",
        JSON.stringify({
          active: true,
          unlocked: [
            { id: "first-light", ts: 1000 },
            { id: "spark", ts: 2000 },
          ],
        }),
      );
      const p = context.baseProps();
      expect(p.unlocks_total).toEqual(2);
      expect(p.points_total).toBeGreaterThan(0);
      expect(p.cloudlog_active).toBe(true);
    });

    it("points_total is 0 when no unlocks persisted", () => {
      const p = context.baseProps();
      expect(p.points_total).toEqual(0);
      expect(p.unlocks_total).toEqual(0);
      expect(p.cloudlog_active).toBe(false);
    });

    it("ignores unknown achievement ids when summing points", () => {
      localStorage.setItem(
        "achievements",
        JSON.stringify({
          active: true,
          unlocked: [{ id: "not-a-real-achievement", ts: 1 }],
        }),
      );
      const p = context.baseProps();
      expect(p.unlocks_total).toEqual(1);
      expect(p.points_total).toEqual(0);
    });

    it("falls back gracefully on corrupt achievements storage", () => {
      localStorage.setItem("achievements", "{{not-json");
      const p = context.baseProps();
      expect(p.unlocks_total).toEqual(0);
      expect(p.points_total).toEqual(0);
      expect(p.cloudlog_active).toBe(false);
    });
  });
});
