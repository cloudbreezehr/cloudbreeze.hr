import { multiLerp, palettes } from "./colors.js";
import { subscribe as subscribeScroll } from "./scroll-bus.js";

const NAV_BG_DARK = "rgba(10,22,40,0.97)";
const NAV_BG_ALPHA = 0.85;
const NAV_BG_OPAQUE = 0.97;
const LUMINANCE_THRESHOLD = 80;
const BORDER_BRIGHT = "rgba(0,0,0,0.06)";
const BORDER_DARK = "rgba(255,255,255,0.05)";
const ACTIVE_OFFSET = 0.4;
// Pixels scrolled before the nav lifts off the top with a shadow.
const ELEVATE_AT = 8;

export function initNav(navEl, appearance) {
  let scrollProgress = 0;

  function updateNavAppearance() {
    if (appearance.isDark()) {
      navEl.style.background = "";
      navEl.style.borderBottomColor = "";
      navEl.style.setProperty("--nav-bg", NAV_BG_DARK);
      navEl.classList.remove("nav-light");
      return;
    }
    const sky = multiLerp(palettes.light.skyTop, scrollProgress);
    const r = Math.round(sky[0]);
    const g = Math.round(sky[1]);
    const b = Math.round(sky[2]);
    navEl.style.background = `rgba(${r},${g},${b},${NAV_BG_ALPHA})`;
    navEl.style.setProperty(
      "--nav-bg",
      `rgba(${r},${g},${b},${NAV_BG_OPAQUE})`,
    );
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    const bright = lum > LUMINANCE_THRESHOLD;
    navEl.style.borderBottomColor = bright ? BORDER_BRIGHT : BORDER_DARK;
    navEl.classList.toggle("nav-light", bright);
  }

  // Active section highlighting
  const sectionIds = ["services", "about", "contact"];
  const sectionLinks = sectionIds.map((id) =>
    navEl.querySelector(`a[href="#${id}"]`),
  );
  const sectionEls = sectionIds.map((id) => document.getElementById(id));

  function updateActiveLink() {
    const scrollY = window.scrollY + window.innerHeight * ACTIVE_OFFSET;
    let activeIdx = -1;
    sectionEls.forEach((el, i) => {
      if (el && el.offsetTop <= scrollY) activeIdx = i;
    });
    sectionLinks.forEach((link, i) => {
      if (link) link.classList.toggle("active", i === activeIdx);
    });
  }

  function updateScroll(snapshot) {
    const scrollY = snapshot?.scrollY ?? window.scrollY ?? 0;
    const docHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress =
      docHeight > 0 ? Math.min(1, Math.max(0, scrollY / docHeight)) : 0;
    navEl.classList.toggle("scrolled", scrollY > ELEVATE_AT);
    updateNavAppearance();
    updateActiveLink();
  }

  updateScroll();
  subscribeScroll(updateScroll);
  appearance.onChange(() => updateNavAppearance());

  // Hamburger menu
  const burger = navEl.querySelector(".nav-burger");
  const navLinksEl = navEl.querySelector(".nav-links");

  // Stagger index for menu item entrance animation
  navLinksEl.querySelectorAll("li").forEach((li, i) => {
    li.style.setProperty("--i", i);
  });

  // Mobile dropdown state — every open/close path routes through the
  // same three helpers so the burger and nav-links classes can't drift
  // out of sync.  isMenuOpen() reads the "open" class as the single
  // source of truth; no parallel boolean to keep aligned.
  function isMenuOpen() {
    return navLinksEl.classList.contains("open");
  }

  function openMenu() {
    if (isMenuOpen()) return;
    burger.classList.add("active");
    navLinksEl.classList.add("open");
    burger.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    if (!isMenuOpen()) return;
    burger.classList.remove("active");
    navLinksEl.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
  }

  burger.addEventListener("click", () => {
    if (isMenuOpen()) closeMenu();
    else openMenu();
  });

  navLinksEl.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // Dismiss the open dropdown on Escape or a tap/click outside the nav, so it
  // can't strand keyboard/AT users or sit over the page after a mis-tap.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isMenuOpen()) {
      closeMenu();
      burger.focus();
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (isMenuOpen() && !navEl.contains(e.target)) closeMenu();
  });

  subscribeScroll(closeMenu);
}
