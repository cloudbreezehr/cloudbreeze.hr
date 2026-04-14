import { multiLerp, palettes } from "./colors.js";

const NAV_BG_DARK = "rgba(10,22,40,0.97)";
const NAV_BG_ALPHA = 0.85;
const NAV_BG_OPAQUE = 0.97;
const LUMINANCE_THRESHOLD = 80;
const BORDER_BRIGHT = "rgba(0,0,0,0.06)";
const BORDER_DARK = "rgba(255,255,255,0.05)";
const ACTIVE_OFFSET = 0.4;

export function initNav(navEl, theme) {
  let scrollProgress = 0;

  function updateNavTheme() {
    if (theme.isDark()) {
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

  function updateScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress =
      docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
    updateNavTheme();
    updateActiveLink();
  }

  updateScroll();
  window.addEventListener("scroll", updateScroll, { passive: true });
  theme.onChange(() => updateNavTheme());

  // Hamburger menu
  const burger = navEl.querySelector(".nav-burger");
  const navLinksEl = navEl.querySelector(".nav-links");

  burger.addEventListener("click", () => {
    burger.classList.toggle("active");
    navLinksEl.classList.toggle("open");
  });

  navLinksEl.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      burger.classList.remove("active");
      navLinksEl.classList.remove("open");
    });
  });

  window.addEventListener(
    "scroll",
    () => {
      if (navLinksEl.classList.contains("open")) {
        burger.classList.remove("active");
        navLinksEl.classList.remove("open");
      }
    },
    { passive: true },
  );
}
