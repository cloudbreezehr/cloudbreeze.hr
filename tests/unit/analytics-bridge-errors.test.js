import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Errors-bridge test.  Focus areas:
//   - error / unhandled_rejection emit with message hash, truncation,
//     top stack frame, and active_mode
//   - per-session cap at MAX_PER_SESSION (10) with dedupe by hash
//   - topFrame skips the V8 "Error: ..." header but keeps Safari
//     frames like "ErrorHandler@file.js:12" (regression guard)
//
// Module-level `sent` and `seenHashes` state make vi.resetModules() the
// correct isolation primitive — bootstrap() handles that.

describe("analytics/bridges/errors", () => {
  let core;
  let bridge;
  let captured;

  async function bootstrap() {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    captured = [];
    core = await import("../../js/analytics/core.js");
    bridge = await import("../../js/analytics/bridges/errors.js");
    core.start({
      adapter: { name: "capture", send: (batch) => captured.push(...batch) },
    });
    bridge.initErrorsBridge();
  }

  function fireError(message, stack) {
    const err = new Error(message);
    if (stack) err.stack = stack;
    const event = new ErrorEvent("error", { message, error: err });
    window.dispatchEvent(event);
  }

  function fireRejection(reason) {
    // happy-dom doesn't expose PromiseRejectionEvent as a constructor the
    // same way Chrome does — use a CustomEvent shim with the `reason`.
    const event = new CustomEvent("unhandledrejection");
    Object.defineProperty(event, "reason", { value: reason });
    window.dispatchEvent(event);
  }

  function eventsNamed(name) {
    return captured.filter((e) => e.name === name);
  }

  beforeEach(async () => {
    document.body.dataset.activeTheme = "";
    await bootstrap();
  });

  afterEach(() => {
    if (core && core._stopForTests) core._stopForTests();
    delete document.body.dataset.activeTheme;
  });

  describe("error event", () => {
    it("emits with hash, truncated message, and top stack frame", () => {
      fireError("boom", "Error: boom\n    at foo (file.js:10:5)");
      core.flush();
      const e = eventsNamed("error")[0];
      expect(e).toBeTruthy();
      expect(e.props.message_truncated).toEqual("boom");
      expect(e.props.message_hash).toBeTruthy();
      expect(e.props.stack_top_frame).toEqual("at foo (file.js:10:5)");
    });

    it("truncates very long messages to 300 chars", () => {
      const long = "x".repeat(500);
      fireError(long, null);
      core.flush();
      expect(eventsNamed("error")[0].props.message_truncated.length).toEqual(
        300,
      );
    });

    it("captures active_mode at the time of the error", () => {
      document.body.dataset.activeTheme = "paper";
      fireError("kaboom", null);
      core.flush();
      expect(eventsNamed("error")[0].props.active_mode).toEqual("paper");
    });

    it("dedupes identical errors by hash", () => {
      for (let i = 0; i < 5; i++) {
        fireError("dup", "Error: dup\n    at same (file.js:1:1)");
      }
      core.flush();
      expect(eventsNamed("error").length).toEqual(1);
    });

    it("caps at MAX_PER_SESSION (10) distinct errors", () => {
      for (let i = 0; i < 15; i++) {
        fireError(`msg-${i}`, `Error: msg-${i}\n    at fn (f.js:${i}:1)`);
      }
      core.flush();
      expect(eventsNamed("error").length).toEqual(10);
    });
  });

  describe("unhandled_rejection", () => {
    it("emits with the rejection reason as message", () => {
      fireRejection(new Error("async boom"));
      core.flush();
      const e = eventsNamed("unhandled_rejection")[0];
      expect(e).toBeTruthy();
      expect(e.props.message_truncated).toEqual("async boom");
    });

    it("handles non-Error rejection reasons", () => {
      fireRejection("string reason");
      core.flush();
      const e = eventsNamed("unhandled_rejection")[0];
      expect(e.props.message_truncated).toEqual("string reason");
    });
  });

  describe("topFrame guard", () => {
    it("skips the V8 header line", () => {
      fireError(
        "x",
        "Error: something\n    at real.frame (file.js:10:1)\n    at next (x.js:2:1)",
      );
      core.flush();
      expect(eventsNamed("error")[0].props.stack_top_frame).toEqual(
        "at real.frame (file.js:10:1)",
      );
    });

    it("keeps Safari-style 'ErrorHandler@' frames that aren't V8 headers", () => {
      fireError("x", "ErrorHandler@file.js:10:5\nanotherFrame@file.js:12:5");
      core.flush();
      expect(eventsNamed("error")[0].props.stack_top_frame).toEqual(
        "ErrorHandler@file.js:10:5",
      );
    });
  });
});
