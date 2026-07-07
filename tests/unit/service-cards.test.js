import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Shared card-effects utility used by every theme. The load-bearing parts are
// the touch-only guard (no tilt where there's no hover) and enableCardEffects'
// cleanup contract — disable() must strip the class, custom props, listeners,
// and restore the shared activeTilt so the next theme starts clean. Module-level
// activeTilt means each test re-imports fresh.

describe("service-cards", () => {
  let mod;

  function setHover(hoverable) {
    // matchMedia("(hover: none)").matches === true means a touch-only device.
    window.matchMedia = vi.fn((q) => ({
      matches: q.includes("hover: none") ? !hoverable : false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }));
  }

  function makeCards(n = 2) {
    document.body.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const c = document.createElement("div");
      c.className = "service-card";
      c.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
      });
      document.body.appendChild(c);
    }
    return [...document.querySelectorAll(".service-card")];
  }

  beforeEach(async () => {
    vi.resetModules();
    setHover(true);
    mod = await import("../../js/service-cards.js");
  });

  afterEach(() => {
    delete window.matchMedia;
    vi.restoreAllMocks();
  });

  describe("initTilt", () => {
    it("binds a 3D tilt on hover-capable devices", () => {
      const [card] = makeCards();
      mod.initTilt();
      expect(card.style.willChange).toBe("transform");
      card.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 50, clientY: 50 }),
      );
      expect(card.style.transform).toContain("perspective");
    });

    it("no-ops on touch-only devices", () => {
      setHover(false);
      const [card] = makeCards();
      mod.initTilt();
      expect(card.style.willChange).toBe("");
      card.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 50, clientY: 50 }),
      );
      expect(card.style.transform).toBe("");
    });
  });

  describe("enableCardEffects", () => {
    it("adds the class and tracks the pointer via custom props", () => {
      const [card] = makeCards(1);
      card.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 200,
        height: 100,
      });
      mod.enableCardEffects({
        className: "frost-card",
        trackingPrefix: "frost",
      });
      expect(card.classList.contains("frost-card")).toBe(true);
      card.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 100, clientY: 50 }),
      );
      expect(card.style.getPropertyValue("--frost-x")).toBe("50%");
      expect(card.style.getPropertyValue("--frost-y")).toBe("50%");
      card.dispatchEvent(new MouseEvent("mouseleave"));
      expect(card.style.getPropertyValue("--frost-x")).toBe("");
    });

    it("disable() strips the class, extra classes, props, and listeners", () => {
      const [card] = makeCards(1);
      const onClick = vi.fn();
      const disable = mod.enableCardEffects({
        className: "frost-card",
        trackingPrefix: "frost",
        onClick,
      });
      card.classList.add("card-frozen");
      disable("card-frozen");
      expect(card.classList.contains("frost-card")).toBe(false);
      expect(card.classList.contains("card-frozen")).toBe(false);
      card.dispatchEvent(new MouseEvent("click"));
      expect(onClick).not.toHaveBeenCalled();
    });

    it("applies then restores the shared tilt config", () => {
      const [card] = makeCards(1);
      mod.initTilt(); // listeners read the active tilt config live
      const disable = mod.enableCardEffects({
        className: "x",
        tilt: { scale: 1.5 },
      });
      card.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 50, clientY: 50 }),
      );
      expect(card.style.transform).toContain("scale(1.5)");
      disable();
      card.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 60, clientY: 60 }),
      );
      expect(card.style.transform).toContain("scale(1.02)"); // default restored
    });
  });
});
