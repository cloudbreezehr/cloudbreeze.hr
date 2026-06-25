import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WHUD } from "../../../js/effects/weapon-hud.js";

// Drives the HUD through the public `weapon-select` event. Reduced motion is
// on so the select-pop (Web Animations) is skipped — the show/hide/render
// contract is what matters here.

describe("effects/weapon-hud", () => {
  let hud;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    window.matchMedia = vi.fn(() => ({
      matches: true, // prefers-reduced-motion: skip the pop animation
      addEventListener() {},
      removeEventListener() {},
    }));
  });

  afterEach(() => {
    if (hud) hud.stop();
    hud = null;
    vi.useRealTimers();
    delete window.matchMedia;
  });

  async function mount() {
    vi.resetModules();
    const mod = await import("../../../js/effects/weapon-hud.js");
    hud = mod.initWeaponHud();
  }

  function fire(icon, label) {
    window.dispatchEvent(
      new CustomEvent("weapon-select", { detail: { icon, label } }),
    );
  }

  it("shows the slot with the effect's icon and label", async () => {
    await mount();
    fire("<svg>rkt</svg>", "ROCKET");
    const slot = document.querySelector(".weapon-hud");
    expect(slot.classList.contains("show")).toBe(true);
    expect(slot.querySelector(".weapon-hud-icon").innerHTML).toBe(
      "<svg>rkt</svg>",
    );
    expect(slot.querySelector(".weapon-hud-name").textContent).toBe("ROCKET");
  });

  it("refreshes to the newest weapon and resets the hide timer", async () => {
    await mount();
    fire("<svg>a</svg>", "FIRST");
    vi.advanceTimersByTime(WHUD.HOLD_MS - 100);
    fire("<svg>b</svg>", "SECOND");
    const slot = document.querySelector(".weapon-hud");
    expect(slot.querySelector(".weapon-hud-name").textContent).toBe("SECOND");
    // The first hide would have fired by now; the second cast pushed it back.
    vi.advanceTimersByTime(200);
    expect(slot.classList.contains("show")).toBe(true);
  });

  it("hides after the hold window elapses", async () => {
    await mount();
    fire("<svg>a</svg>", "X");
    const slot = document.querySelector(".weapon-hud");
    vi.advanceTimersByTime(WHUD.HOLD_MS + 50);
    expect(slot.classList.contains("show")).toBe(false);
  });

  it("ignores a weapon-select with no icon", async () => {
    await mount();
    window.dispatchEvent(
      new CustomEvent("weapon-select", { detail: { label: "X" } }),
    );
    expect(
      document.querySelector(".weapon-hud").classList.contains("show"),
    ).toBe(false);
  });
});
