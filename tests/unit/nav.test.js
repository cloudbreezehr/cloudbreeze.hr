import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initNav } from "../../js/nav.js";
import { _resetForTests as resetScrollBus } from "../../js/scroll-bus.js";

// Focuses on the mobile menu's keyboard/AT-accessible dismissal paths added
// alongside aria-expanded: Escape closes and returns focus to the burger,
// and a pointerdown outside the nav closes it too. Scroll-driven appearance
// and active-link logic are exercised elsewhere; a dark-appearance stub
// keeps this file from depending on the light-mode sky-color math.

function darkAppearance() {
  return { isDark: () => true, onChange: () => {} };
}

function buildNav() {
  document.body.innerHTML = `
    <nav>
      <button class="nav-burger" aria-label="Menu" aria-expanded="false"></button>
      <ul class="nav-links">
        <li><a href="#services">Services</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
  `;
  const navEl = document.querySelector("nav");
  const burger = navEl.querySelector(".nav-burger");
  const navLinksEl = navEl.querySelector(".nav-links");
  return { navEl, burger, navLinksEl };
}

describe("nav — mobile menu dismissal", () => {
  beforeEach(() => {
    resetScrollBus();
  });

  afterEach(() => {
    resetScrollBus();
  });

  it("closes on Escape and returns focus to the burger", () => {
    const { navEl, burger, navLinksEl } = buildNav();
    initNav(navEl, darkAppearance());

    burger.click();
    expect(navLinksEl.classList.contains("open")).toBe(true);
    expect(burger.getAttribute("aria-expanded")).toBe("true");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(navLinksEl.classList.contains("open")).toBe(false);
    expect(burger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(burger);
  });

  it("ignores Escape when the menu is already closed", () => {
    const { navEl, burger, navLinksEl } = buildNav();
    initNav(navEl, darkAppearance());

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(navLinksEl.classList.contains("open")).toBe(false);
    expect(document.activeElement).not.toBe(burger);
  });

  it("closes on a pointerdown outside the nav", () => {
    const { navEl, burger, navLinksEl } = buildNav();
    initNav(navEl, darkAppearance());

    burger.click();
    expect(navLinksEl.classList.contains("open")).toBe(true);

    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );

    expect(navLinksEl.classList.contains("open")).toBe(false);
  });

  it("stays open on a pointerdown inside the nav", () => {
    const { navEl, burger, navLinksEl } = buildNav();
    initNav(navEl, darkAppearance());

    burger.click();
    navEl.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    expect(navLinksEl.classList.contains("open")).toBe(true);
  });
});
