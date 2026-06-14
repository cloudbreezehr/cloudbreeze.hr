import { describe, it, expect, beforeEach, vi } from "vitest";

// overlay-history holds module-level state (seq map, currentSeq, listener).
// Each test resets modules + re-imports so the listener is re-installed
// fresh against the test's window and no entries leak across runs.
//
// Direction (Back vs Forward) is decided by comparing the destination
// seq to the module's currentSeq — not by which browser API fired the
// popstate.  Tests dispatch synthetic popstate events directly with a
// chosen destination state, so the helper names describe the
// destination (ToRoot / ToSeq), and the test comments spell out
// whether that destination is a Back or a Forward from currentSeq.

describe("overlay-history", () => {
  let overlay;

  beforeEach(async () => {
    vi.resetModules();
    overlay = await import("../../js/overlay-history.js");
    overlay._resetForTests();
  });

  // Dispatch a synthetic popstate carrying the given state.  Mirrors
  // what the browser fires on Back / Forward into a seq'd entry; the
  // module decides direction by comparing the destination seq to
  // currentSeq, not by the nature of the dispatch.
  function popstateTo(state) {
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
  }

  // Pop into the pre-overlay state (state=null).  Used when a Back
  // press leaves the overlay timeline entirely.
  function popstateToRoot() {
    popstateTo(null);
  }

  // Pop into a specific overlay seq.  Used both for Forward (seq >
  // currentSeq) and Back-between-entries (seq < currentSeq).
  function popstateToSeq(seq) {
    popstateTo({ overlay: true, seq });
  }

  describe("pushOverlay", () => {
    it("returns a handle with pop and dispose functions", () => {
      const handle = overlay.pushOverlay(() => {});
      expect(handle).toMatchObject({
        pop: expect.any(Function),
        dispose: expect.any(Function),
      });
    });

    it("pushes a synthetic history entry on the browser stack", () => {
      const before = history.length;
      overlay.pushOverlay(() => {});
      expect(history.length).toBe(before + 1);
    });

    it("assigns monotonic seqs to successive pushes", () => {
      const pushSpy = vi.spyOn(history, "pushState");
      overlay.pushOverlay(() => {});
      overlay.pushOverlay(() => {});
      overlay.pushOverlay(() => {});
      const seqs = pushSpy.mock.calls.map((c) => c[0].seq);
      expect(seqs).toEqual([0, 1, 2]);
      pushSpy.mockRestore();
    });
  });

  describe("Back press (popstate into prior state)", () => {
    it("invokes onClose of the topmost overlay", () => {
      const onClose = vi.fn();
      overlay.pushOverlay(onClose);
      popstateToRoot();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("unwinds multiple overlays in LIFO order as Back fires", () => {
      const calls = [];
      overlay.pushOverlay(() => calls.push("first"));
      overlay.pushOverlay(() => calls.push("second"));
      overlay.pushOverlay(() => calls.push("third"));
      // Third overlay is on top; Back fires popstate to seq 1, then 0, then null.
      popstateToSeq(1); // this is actually a Back relative to currentSeq=2
      popstateToSeq(0);
      popstateToRoot();
      expect(calls).toEqual(["third", "second", "first"]);
    });

    it("does nothing when the stack is empty", () => {
      expect(() => popstateToRoot()).not.toThrow();
    });

    it("swallows exceptions thrown by onClose", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      overlay.pushOverlay(() => {
        throw new Error("boom");
      });
      expect(() => popstateToRoot()).not.toThrow();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("skips onClose on a dead entry (UI already closed it)", () => {
      const onClose = vi.fn();
      const handle = overlay.pushOverlay(onClose);
      handle.pop(); // marks dead (replaceState, no popstate fired)
      onClose.mockClear();
      // A Back popstate arriving after a UI close must not re-fire onClose.
      popstateToRoot();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Forward press (popstate into higher seq)", () => {
    it("invokes onReopen when navigating forward into a closed overlay", () => {
      const onClose = vi.fn();
      const onReopen = vi.fn();
      overlay.pushOverlay(onClose, onReopen);
      popstateToRoot(); // closes it
      popstateToSeq(0); // forward back into it
      expect(onReopen).toHaveBeenCalledOnce();
    });

    it("does not invoke onReopen if the overlay is still alive", () => {
      const onReopen = vi.fn();
      overlay.pushOverlay(() => {}, onReopen);
      // No Back in between — a spurious popstate to the current seq
      // is an alias for "already here" and should be a no-op.
      popstateToSeq(0);
      expect(onReopen).not.toHaveBeenCalled();
    });

    it("does nothing when no onReopen was provided", () => {
      const onClose = vi.fn();
      overlay.pushOverlay(onClose);
      popstateToRoot();
      // No onReopen — Forward is a no-op (no throw, no resurrection).
      expect(() => popstateToSeq(0)).not.toThrow();
    });

    it("reopens the correct entry when multiple overlays were pushed", () => {
      const reopenA = vi.fn();
      const reopenB = vi.fn();
      overlay.pushOverlay(() => {}, reopenA);
      overlay.pushOverlay(() => {}, reopenB);
      // Back twice closes both (in order: B then A).
      popstateToSeq(0); // currentSeq was 1, now 0 → Back, closes B
      popstateToRoot(); // currentSeq was 0, now null → Back, closes A
      // Forward into seq 0 → reopens A only.
      popstateToSeq(0);
      expect(reopenA).toHaveBeenCalledOnce();
      expect(reopenB).not.toHaveBeenCalled();
    });
  });

  describe("Back → Forward → Back symmetry", () => {
    it("round-trips close and reopen via popstate alone", () => {
      const calls = [];
      overlay.pushOverlay(
        () => calls.push("close"),
        () => calls.push("reopen"),
      );
      popstateToRoot();
      popstateToSeq(0);
      popstateToRoot();
      popstateToSeq(0);
      expect(calls).toEqual(["close", "reopen", "close", "reopen"]);
    });
  });

  describe("handle.pop() — UI-initiated close", () => {
    it("replaces the overlay entry in-place when the overlay is topmost", () => {
      const replaceSpy = vi.spyOn(history, "replaceState");
      const onClose = vi.fn();
      const handle = overlay.pushOverlay(onClose);
      handle.pop();
      expect(replaceSpy).toHaveBeenCalledOnce();
      replaceSpy.mockRestore();
    });

    it("does not invoke onClose when the UI closed it first", () => {
      // UI-initiated close should not re-fire the onClose callback —
      // the caller is already handling the close path synchronously.
      const onClose = vi.fn();
      const handle = overlay.pushOverlay(onClose);
      handle.pop();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("is idempotent — second pop() in the same cycle is a no-op", () => {
      const replaceSpy = vi.spyOn(history, "replaceState");
      const handle = overlay.pushOverlay(() => {});
      handle.pop();
      handle.pop();
      handle.pop();
      // pushOverlay itself calls pushState once; pop() calls replaceState once
      expect(replaceSpy).toHaveBeenCalledOnce();
      replaceSpy.mockRestore();
    });

    it("replaces again after Forward-reopen re-arms the entry", () => {
      // pop() is gated on the alive flag, which onReopen flips back to true.
      // open → pop (replaceState #1) → Forward-reopen → pop (replaceState #2)
      const replaceSpy = vi.spyOn(history, "replaceState");
      const handle = overlay.pushOverlay(
        () => {},
        () => {},
      );
      handle.pop(); // replaceState #1
      // replaceState fires no popstate; simulate Forward directly
      popstateToSeq(0); // re-arms entry via onReopen
      handle.pop(); // replaceState #2
      // pushOverlay called pushState once; two pop()s call replaceState twice
      expect(replaceSpy).toHaveBeenCalledTimes(2);
      replaceSpy.mockRestore();
    });

    it("skips replaceState when the overlay is buried under a newer one", () => {
      const replaceSpy = vi.spyOn(history, "replaceState");
      const pushCount = replaceSpy.mock.calls.length; // pushOverlay uses pushState, not replaceState
      const buriedHandle = overlay.pushOverlay(() => {});
      overlay.pushOverlay(() => {});
      buriedHandle.pop();
      expect(replaceSpy).toHaveBeenCalledTimes(pushCount); // unchanged
      replaceSpy.mockRestore();
    });
  });

  describe("handle.dispose() — full teardown", () => {
    it("prevents onClose from firing on a subsequent Back", () => {
      const onClose = vi.fn();
      const handle = overlay.pushOverlay(onClose);
      handle.dispose();
      popstateToRoot();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("prevents onReopen from firing on a subsequent Forward", () => {
      const onClose = vi.fn();
      const onReopen = vi.fn();
      const handle = overlay.pushOverlay(onClose, onReopen);
      popstateToRoot(); // close first so we're in the forward-into-dead state
      handle.dispose();
      popstateToSeq(0);
      expect(onReopen).not.toHaveBeenCalled();
    });

    it("is idempotent", () => {
      const handle = overlay.pushOverlay(() => {});
      handle.dispose();
      expect(() => handle.dispose()).not.toThrow();
    });
  });

  describe("mixed paths", () => {
    it("Back still closes the topmost when a lower entry was UI-closed", () => {
      const lowerHandle = overlay.pushOverlay(() => {});
      const topClose = vi.fn();
      overlay.pushOverlay(topClose);
      lowerHandle.pop(); // dead, buried
      // Current topmost is seq 1.  popstate into seq 0 is a Back.
      popstateToSeq(0);
      expect(topClose).toHaveBeenCalledOnce();
    });

    it("Forward into a buried dead entry reopens it", () => {
      const buriedClose = vi.fn();
      const buriedReopen = vi.fn();
      const buriedHandle = overlay.pushOverlay(buriedClose, buriedReopen);
      overlay.pushOverlay(() => {});
      buriedHandle.pop(); // dead, buried under seq 1
      // Back unwinds through both; currentSeq becomes null.
      popstateToSeq(0); // Back: currentSeq 1 → 0
      popstateToRoot(); // Back: currentSeq 0 → null
      // Forward into seq 0 reopens the previously-dead buried entry.
      popstateToSeq(0);
      expect(buriedReopen).toHaveBeenCalledOnce();
    });
  });
});
