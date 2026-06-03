import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// nav-button.js owns the Cloudlog entry button in the site's top nav.
// Depends on storage (for getUnseenCount) and expects a `.nav-actions`
// element in the DOM.  Each test reconstructs the DOM scaffold.

describe("achievements/ui/nav-button", () => {
  let mod;

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    document.body.innerHTML = `
      <nav>
        <div class="nav-actions">
          <button class="appearance-toggle"></button>
        </div>
      </nav>
    `;
    mod = await import("../../../../js/achievements/ui/nav-button.js");
    const storage = await import("../../../../js/achievements/storage.js");
    storage.load();
  });

  afterEach(() => {
    mod._resetForTests();
    document.body.innerHTML = "";
  });

  it("returns null when no .nav-actions exists", () => {
    document.body.innerHTML = "";
    const result = mod.createNavButton(() => {});
    expect(result).toBeNull();
  });

  it("inserts the button before the appearance toggle", () => {
    mod.createNavButton(() => {});
    const actions = document.querySelector(".nav-actions");
    expect(actions.children[0].classList.contains("achievement-btn")).toBe(
      true,
    );
    expect(actions.children[1].classList.contains("appearance-toggle")).toBe(
      true,
    );
  });

  it("exposes the correct aria-label and tooltip, without hardcoding the keyboard binding", () => {
    // The button's aria-label is "Achievements" (what opens when the
    // button is activated) while the tooltip reads "Cloudlog" (the
    // feature name).  Both describe the same feature from different
    // angles — screen readers hear the content, sighted users see the
    // identity.  Keyboard shortcut is wired in one place
    // (js/achievements/index.js); neither label repeats the binding,
    // so changing the shortcut key is a single-file edit.
    const btn = mod.createNavButton(() => {});
    expect(btn.getAttribute("aria-label")).toEqual("Achievements");
    expect(btn.getAttribute("data-tooltip")).toEqual("Cloudlog");
    expect(btn.hasAttribute("aria-keyshortcuts")).toBe(false);
  });

  it("invokes onPanelToggle on click", () => {
    const onToggle = vi.fn();
    mod.createNavButton(onToggle);
    const btn = mod.getNavBtnEl();
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("show/hide toggle the display style", () => {
    mod.createNavButton(() => {});
    const btn = mod.getNavBtnEl();
    mod.hideNavButton();
    expect(btn.style.display).toEqual("none");
    mod.showNavButton();
    expect(btn.style.display).toEqual("");
  });

  it("setActive toggles the .active class", () => {
    mod.createNavButton(() => {});
    const btn = mod.getNavBtnEl();
    expect(btn.classList.contains("active")).toBe(false);
    mod.setActive(true);
    expect(btn.classList.contains("active")).toBe(true);
    mod.setActive(false);
    expect(btn.classList.contains("active")).toBe(false);
  });

  it("updateBadge reflects the unseen count and updates the tooltip", async () => {
    const storage = await import("../../../../js/achievements/storage.js");
    mod.createNavButton(() => {});
    const btn = mod.getNavBtnEl();
    expect(btn.getAttribute("data-tooltip")).toEqual("Cloudlog");

    // Zero unseen → badge hidden, tooltip plain.
    mod.updateBadge();
    expect(btn.getAttribute("data-tooltip")).toEqual("Cloudlog");
    expect(
      btn.querySelector(".achievement-badge").classList.contains("visible"),
    ).toBe(false);

    // Unlock an achievement and leave it unseen → badge visible, tooltip with count.
    storage.unlock("first-light");
    mod.updateBadge();
    expect(btn.querySelector(".achievement-badge").textContent).toEqual("1");
    expect(
      btn.querySelector(".achievement-badge").classList.contains("visible"),
    ).toBe(true);
    expect(btn.getAttribute("data-tooltip")).toEqual("Cloudlog (1 new)");
  });

  it("clamps the badge to 9+ past nine unseen and sets an aria-label", async () => {
    const storage = await import("../../../../js/achievements/storage.js");
    const { ACHIEVEMENTS } =
      await import("../../../../js/achievements/registry.js");
    mod.createNavButton(() => {});
    const badge = mod.getNavBtnEl().querySelector(".achievement-badge");
    // Unlock more than the display cap, leaving them all unseen.
    for (const ach of ACHIEVEMENTS.slice(0, 12)) storage.unlock(ach.id);
    mod.updateBadge();
    expect(badge.textContent).toEqual("9+");
    expect(badge.getAttribute("aria-label")).toMatch(/unread achievements$/);
  });

  it("updateBadge invokes the onBadgeChange callback", () => {
    const onBadgeChange = vi.fn();
    mod.createNavButton(() => {}, { onBadgeChange });
    // createNavButton calls updateBadge internally once; call again explicitly.
    mod.updateBadge();
    expect(onBadgeChange).toHaveBeenCalledTimes(2);
  });

  it("pulseBadge toggles the pulse class on/off for animation re-trigger", () => {
    mod.createNavButton(() => {});
    const badge = mod.getNavBtnEl().querySelector(".achievement-badge");
    badge.classList.add("pulse");
    mod.pulseBadge();
    expect(badge.classList.contains("pulse")).toBe(true);
  });

  describe("reveal pulse", () => {
    function countRings() {
      return document.querySelectorAll(".achievement-pulse-ring").length;
    }

    it("does not fire on createNavButton alone — visibility is the caller's call", () => {
      mod.createNavButton(() => {});
      expect(countRings()).toEqual(0);
    });

    it("fires once on the first showNavButton call", () => {
      mod.createNavButton(() => {});
      mod.showNavButton();
      expect(countRings()).toEqual(1);
    });

    it("does not re-fire on subsequent hide/show cycles within the same session", () => {
      mod.createNavButton(() => {});
      mod.showNavButton();
      mod.hideNavButton();
      mod.showNavButton();
      mod.hideNavButton();
      mod.showNavButton();
      expect(countRings()).toEqual(1);
    });

    it("markRevealPulseFired suppresses the pulse for the rest of the session", () => {
      mod.createNavButton(() => {});
      mod.markRevealPulseFired();
      mod.showNavButton();
      expect(countRings()).toEqual(0);
    });

    it("markRevealPulseFired is safe to call before the button is created", () => {
      mod.markRevealPulseFired();
      // No throw, no ring, and the latch must still apply once the
      // button does come up.
      expect(countRings()).toEqual(0);
      mod.createNavButton(() => {});
      mod.showNavButton();
      expect(countRings()).toEqual(0);
    });
  });
});
