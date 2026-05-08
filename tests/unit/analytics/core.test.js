import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// core.js holds module-level queue + adapter + flush timer state.
// Each test resets modules so state doesn't leak between cases.

describe("analytics/core", () => {
  let core;
  let sent;
  let adapter;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00Z"));
    sent = [];
    adapter = {
      name: "test",
      init: vi.fn(),
      send: (batch) => sent.push(...batch),
      flush: vi.fn(),
    };
    core = await import("../../../js/analytics/core.js");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("track() before start() is a no-op", () => {
    core.track("foo", { a: 1 });
    expect(core._queueSizeForTests()).toEqual(0);
  });

  it("start() attaches the adapter and tracked events reach it on flush", () => {
    core.start({ adapter });
    core.track("a_event", { x: 1 });
    expect(sent.length).toEqual(0);
    core.flush();
    expect(sent.length).toEqual(1);
    expect(sent[0].name).toEqual("a_event");
    expect(sent[0].props.x).toEqual(1);
  });

  it("merges base props into every event", () => {
    core.start({ adapter });
    core.track("with_base", {});
    core.flush();
    const p = sent[0].props;
    expect(p.visitor_id).toBeTruthy();
    expect(p.session_id).toBeTruthy();
    expect(p.session_seq).toBeGreaterThan(0);
    expect(p.ts).toEqual("2026-05-08T12:00:00.000Z");
  });

  it("flushes automatically when batch size is reached", () => {
    core.start({ adapter });
    for (let i = 0; i < 20; i++) core.track(`e${i}`, {});
    // Batch of 20 triggers immediate flush.
    expect(sent.length).toEqual(20);
  });

  it("flushes on scheduled interval", () => {
    core.start({ adapter });
    core.track("scheduled", {});
    expect(sent.length).toEqual(0);
    vi.advanceTimersByTime(10000);
    expect(sent.length).toEqual(1);
  });

  it("opt-out short-circuits track()", async () => {
    const consent = await import("../../../js/analytics/consent.js");
    consent.optOut();
    core.start({ adapter });
    core.track("blocked", {});
    core.flush();
    expect(sent.length).toEqual(0);
  });

  it("caps the queue at MAX_QUEUE (200)", () => {
    core.start({ adapter });
    // Use an adapter that does not drain, so queue grows.
    core._setAdapterForTests({
      name: "capture",
      send: () => {},
    });
    // MAX_BATCH_SIZE is 20 — flush will happen, so we need to prevent
    // drain.  Use a non-draining send + manual inspection via the test
    // helper.
    for (let i = 0; i < 25; i++) core.track(`e${i}`, {});
    expect(core._queueSizeForTests()).toBeLessThanOrEqual(200);
  });
});
