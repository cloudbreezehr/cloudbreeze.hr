import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// mode-history-hud is a DOM coordinator with module-level state for the
// discovered map, the HUD element, and the user-intent flag.  Each test
// resets modules + clears localStorage so a fresh import starts from a
// known-empty state.

const BOOT_TIME = new Date("2026-05-08T12:00:00Z").getTime();

async function importHud() {
  vi.resetModules();
  return await import("../../../js/effects/mode-history-hud.js");
}

function dispatchModeActivate(modeId) {
  window.dispatchEvent(
    new CustomEvent("achievement", {
      detail: { type: "mode-activate", mode: modeId },
    }),
  );
}

function dispatchModeDeactivate(modeId) {
  window.dispatchEvent(
    new CustomEvent("achievement", {
      detail: { type: "mode-deactivate", mode: modeId },
    }),
  );
}

describe("effects/mode-history-hud", () => {
  let hud;

  beforeEach(async () => {
    localStorage.clear();
    document.body.innerHTML = "";
    vi.useFakeTimers();
    vi.setSystemTime(BOOT_TIME);
    // Stub matchMedia for the prefers-reduced-motion query.
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    hud = await importHud();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("first-discovery flow", () => {
    it("does not render the HUD before any mode has been discovered", () => {
      hud.initModeHistoryHud();
      expect(document.querySelector(".mode-history-hud")).toBeNull();
    });

    it("renders the HUD on first mode-activate", () => {
      hud.initModeHistoryHud();
      dispatchModeActivate("frozen");
      expect(document.querySelector(".mode-history-hud")).not.toBeNull();
    });

    it("dispatches mode-history-reveal exactly on the first ever discovery", () => {
      hud.initModeHistoryHud();
      const listener = vi.fn();
      window.addEventListener("achievement", listener);

      dispatchModeActivate("frozen");
      const reveals = listener.mock.calls.filter(
        (c) => c[0].detail.type === "mode-history-reveal",
      );
      expect(reveals).toHaveLength(1);

      // A second activation in the same session does not re-dispatch.
      dispatchModeActivate("deep-sea");
      const revealsAfter = listener.mock.calls.filter(
        (c) => c[0].detail.type === "mode-history-reveal",
      );
      expect(revealsAfter).toHaveLength(1);

      window.removeEventListener("achievement", listener);
    });

    it("ignores mode-activate for unknown ids", () => {
      hud.initModeHistoryHud();
      dispatchModeActivate("not-a-real-mode");
      expect(document.querySelector(".mode-history-hud")).toBeNull();
      expect(localStorage.getItem(hud.STORAGE_KEY)).toBeNull();
    });
  });

  describe("persistence", () => {
    it("writes the discovered map to localStorage on first discovery", () => {
      hud.initModeHistoryHud();
      dispatchModeActivate("frozen");

      const raw = localStorage.getItem(hud.STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw);
      expect(parsed).toEqual({ frozen: BOOT_TIME });
    });

    it("appends new discoveries to the persisted map without losing prior entries", () => {
      hud.initModeHistoryHud();
      dispatchModeActivate("frozen");
      vi.advanceTimersByTime(60_000);
      dispatchModeActivate("deep-sea");

      const parsed = JSON.parse(localStorage.getItem(hud.STORAGE_KEY));
      expect(parsed).toEqual({
        frozen: BOOT_TIME,
        "deep-sea": BOOT_TIME + 60_000,
      });
    });

    it("does not overwrite the original discovery timestamp on re-activation", () => {
      hud.initModeHistoryHud();
      dispatchModeActivate("frozen");
      vi.advanceTimersByTime(60_000);
      dispatchModeActivate("frozen");

      const parsed = JSON.parse(localStorage.getItem(hud.STORAGE_KEY));
      expect(parsed.frozen).toEqual(BOOT_TIME);
    });

    it("rebuilds the HUD immediately at init when the discovered map is non-empty", async () => {
      // Seed a prior session's discoveries.
      localStorage.setItem(
        hud.STORAGE_KEY,
        JSON.stringify({ frozen: BOOT_TIME - 86_400_000 }),
      );
      hud = await importHud();

      hud.initModeHistoryHud();
      // No dispatch needed — the HUD is already present from the seeded state.
      expect(document.querySelector(".mode-history-hud")).not.toBeNull();
    });

    it("falls back to empty discovered map on invalid JSON", async () => {
      localStorage.setItem(hud.STORAGE_KEY, "not-json");
      hud = await importHud();
      hud.initModeHistoryHud();
      expect(document.querySelector(".mode-history-hud")).toBeNull();
    });
  });

  describe("slot rendering", () => {
    it("renders a discovered mode as a button with mode label and color", () => {
      hud.initModeHistoryHud();
      dispatchModeActivate("frozen");

      const slot = document.querySelector('.mhh-slot[data-mode="frozen"]');
      expect(slot).not.toBeNull();
      expect(slot.tagName).toEqual("BUTTON");
      expect(slot.classList.contains("discovered")).toBe(true);
      expect(slot.querySelector(".mhh-label").textContent).toEqual("Frozen");
    });

    it("renders undiscovered modes as non-button placeholders with ??? label", () => {
      hud.initModeHistoryHud();
      // Discover one mode so the HUD appears.
      dispatchModeActivate("frozen");

      const undiscovered = document.querySelectorAll(".mhh-slot.undiscovered");
      // Five remaining undiscovered modes from the registry.
      expect(undiscovered.length).toBeGreaterThan(0);
      for (const slot of undiscovered) {
        expect(slot.tagName).not.toEqual("BUTTON");
        expect(slot.querySelector(".mhh-label").textContent).toEqual("???");
        expect(slot.getAttribute("aria-label")).toEqual("Undiscovered mode");
      }
    });

    it("upgrades an undiscovered slot to discovered when its mode is activated", () => {
      hud.initModeHistoryHud();
      dispatchModeActivate("frozen");
      // deep-sea is still undiscovered.
      let deepSea = Array.from(document.querySelectorAll(".mhh-slot")).find(
        (s) => s.querySelector(".mhh-label").textContent === "???",
      );
      expect(deepSea).toBeTruthy();

      dispatchModeActivate("deep-sea");
      const deepSeaButton = document.querySelector(
        '.mhh-slot[data-mode="deep-sea"]',
      );
      expect(deepSeaButton).not.toBeNull();
      expect(deepSeaButton.tagName).toEqual("BUTTON");
    });
  });

  describe("active-state sync", () => {
    it("toggles slot.active to mirror body.classList", () => {
      hud.initModeHistoryHud();
      dispatchModeActivate("frozen");
      const slot = document.querySelector('.mhh-slot[data-mode="frozen"]');

      // body.frozen needs to be set by the test — the HUD just mirrors it.
      document.body.classList.add("frozen");
      dispatchModeActivate("frozen"); // re-trigger sync
      expect(slot.classList.contains("active")).toBe(true);

      document.body.classList.remove("frozen");
      dispatchModeDeactivate("frozen");
      expect(slot.classList.contains("active")).toBe(false);
    });
  });

  describe("just-discovered shimmer", () => {
    it("adds and removes just-discovered within NEW_DISCOVERY_HIGHLIGHT_MS", () => {
      hud.initModeHistoryHud();
      dispatchModeActivate("frozen");
      const slot = document.querySelector('.mhh-slot[data-mode="frozen"]');

      expect(slot.classList.contains("just-discovered")).toBe(true);

      // Just before the timeout — still highlighted.
      vi.advanceTimersByTime(hud.HUD.NEW_DISCOVERY_HIGHLIGHT_MS - 1);
      expect(slot.classList.contains("just-discovered")).toBe(true);

      // After the timeout — cleared.
      vi.advanceTimersByTime(2);
      expect(slot.classList.contains("just-discovered")).toBe(false);
    });

    it("re-adds just-discovered for a recently-discovered slot when the HUD is rebuilt", async () => {
      // Seed with a discovery within the highlight window.
      const recent = BOOT_TIME - hud.HUD.NEW_DISCOVERY_HIGHLIGHT_MS / 2;
      localStorage.setItem(hud.STORAGE_KEY, JSON.stringify({ frozen: recent }));
      hud = await importHud();
      hud.initModeHistoryHud();

      const slot = document.querySelector('.mhh-slot[data-mode="frozen"]');
      expect(slot.classList.contains("just-discovered")).toBe(true);
    });

    it("does not add just-discovered for older discoveries", async () => {
      const old = BOOT_TIME - hud.HUD.NEW_DISCOVERY_HIGHLIGHT_MS * 2;
      localStorage.setItem(hud.STORAGE_KEY, JSON.stringify({ frozen: old }));
      hud = await importHud();
      hud.initModeHistoryHud();

      const slot = document.querySelector('.mhh-slot[data-mode="frozen"]');
      expect(slot.classList.contains("just-discovered")).toBe(false);
    });
  });

  describe("active pulse", () => {
    it("adds and removes pulse within ACTIVE_PULSE_MS", () => {
      hud.initModeHistoryHud();
      dispatchModeActivate("frozen");
      const slot = document.querySelector('.mhh-slot[data-mode="frozen"]');

      expect(slot.classList.contains("pulse")).toBe(true);

      vi.advanceTimersByTime(hud.HUD.ACTIVE_PULSE_MS - 1);
      expect(slot.classList.contains("pulse")).toBe(true);

      vi.advanceTimersByTime(2);
      expect(slot.classList.contains("pulse")).toBe(false);
    });
  });

  describe("collapse delay", () => {
    it("collapses the expanded HUD after COLLAPSE_DELAY_MS on pointerleave", () => {
      // pointerenter only expands if the HUD isn't tucked, and tucked is
      // computed from body.classList — set the active class first so
      // updateTucked() leaves the HUD visible.
      document.body.classList.add("frozen");
      hud.initModeHistoryHud();
      dispatchModeActivate("frozen");
      const hudEl = document.querySelector(".mode-history-hud");
      expect(hudEl.classList.contains("tucked")).toBe(false);

      hudEl.dispatchEvent(
        new Event("pointerenter", { bubbles: true, cancelable: true }),
      );
      expect(hudEl.classList.contains("expanded")).toBe(true);

      hudEl.dispatchEvent(
        new Event("pointerleave", { bubbles: true, cancelable: true }),
      );
      // Still expanded just before the timeout.
      vi.advanceTimersByTime(hud.HUD.COLLAPSE_DELAY_MS - 1);
      expect(hudEl.classList.contains("expanded")).toBe(true);

      // After the timeout — collapsed.
      vi.advanceTimersByTime(2);
      expect(hudEl.classList.contains("expanded")).toBe(false);
    });
  });
});
