// ── Page Bootstrap ──
// Wires the page up using dynamic imports — each module fetches and
// inits independently as its own promise resolves.  Failures in one
// module don't block the others.
//
// Must run after critical-boot.js — reads the appearance singleton
// from `window.__cloudbreezeAppearance` set there.  The <script> tag
// order in index.html enforces this; the assert below traps any
// future reordering loudly instead of letting `undefined` propagate.
//
// External module so the page can ship with a strict script-src
// 'self' CSP — inline scripts would force 'unsafe-inline' and undo
// most of the policy's value.

const PROD_HOSTNAME = "cloudbreeze.hr";
const POSTHOG_API_KEY = "phc_DkjMmwyEb9HyRG6kwmabdvkhmjZm2tid95gBK7sJkw3i";

const PARALLAX_LAYERS = [
  { selector: ".hero-tag", rate: 0.12 },
  { selector: ".hero-title .line-1", rate: 0.06 },
  { selector: ".hero-title .line-2", rate: 0.1 },
  { selector: ".hero-sub", rate: 0.14 },
  { selector: ".hero-actions", rate: 0.18 },
];
const SCROLL_HINT_FADE_AT = 60;

const appearance = window.__cloudbreezeAppearance;
if (!appearance) {
  throw new Error(
    "[bootstrap] window.__cloudbreezeAppearance missing — critical-boot.js must run first",
  );
}

function load(path, init) {
  import(path)
    .then(init)
    .catch((err) => console.warn(`[bootstrap] ${path} failed:`, err));
}

// Strict production gate: only the prod hostname sends to PostHog.
// Other hostnames (localhost, IPs, preview subdomains) fall through
// to the default console adapter so stats stay clean.
async function wireAnalytics({ initAnalytics }) {
  const isProd = location.hostname === PROD_HOSTNAME;
  if (!isProd) {
    initAnalytics();
    return;
  }
  const { createPostHogAdapter } =
    await import("./analytics/adapters/posthog.js");
  initAnalytics({ adapter: createPostHogAdapter({ apiKey: POSTHOG_API_KEY }) });
}

// `subscribe()` only delivers on subsequent native scrolls — if the
// user already scrolled before this loader resolved (slow network),
// each handler runs once for the current position so parallax and
// the scroll-hint catch up to the page state.
async function wireScrollBus({ subscribe: subscribeScroll, getScrollY }) {
  const { mirrorYWhenInverted } = await import("./viewport.js");

  const parallaxEls = PARALLAX_LAYERS.map(({ selector, rate }) => ({
    el: document.querySelector(selector),
    rate,
  }));
  function applyParallax(scrollY) {
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    const y = mirrorYWhenInverted(scrollY, maxScroll);
    if (y > window.innerHeight) return;
    for (const p of parallaxEls) {
      if (p.el) p.el.style.translate = `0 ${y * p.rate}px`;
    }
  }
  applyParallax(getScrollY());
  subscribeScroll(({ scrollY }) => applyParallax(scrollY));

  const scrollHint = document.querySelector(".scroll-hint");
  if (scrollHint) {
    function fadeScrollHint() {
      scrollHint.style.animation = "none";
      scrollHint.style.opacity = "1";
      void scrollHint.offsetHeight;
      scrollHint.style.transition = "opacity 0.6s";
      scrollHint.style.opacity = "0";
    }
    if (getScrollY() > SCROLL_HINT_FADE_AT) {
      fadeScrollHint();
    } else {
      const unsub = subscribeScroll(({ scrollY }) => {
        if (scrollY > SCROLL_HINT_FADE_AT) {
          fadeScrollHint();
          unsub();
        }
      });
    }
  }
}

async function wireKeyboardHotkeys({ onKey }) {
  const [{ toggleDevConsole, openDevConsole }, { toggleFps }] =
    await Promise.all([import("./dev/console.js"), import("./dev/fps.js")]);

  if (window.location.hash === "#dev") openDevConsole();
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#dev") openDevConsole();
  });
  onKey(".", toggleDevConsole, { ctrl: true, shift: true, allowInInput: true });
  onKey("F", toggleFps, { ctrl: true, shift: true, allowInInput: true });
}

// Registry of every module loaded after the critical phase.  Adding a
// new theme, effect, or feature is one entry: { path, init }.  Each
// entry's `init` receives the imported module's exports and may
// itself be async (resolved through the same load() error handler).
const MODULES = [
  // Analytics
  { path: "./analytics/index.js", init: wireAnalytics },

  // Page chrome
  {
    path: "./nav.js",
    init: (m) => m.initNav(document.querySelector("nav"), appearance),
  },
  { path: "./service-cards.js", init: (m) => m.initTilt() },

  // Audio
  { path: "./audio/index.js", init: (m) => m.initAudio() },

  // Effects
  { path: "./effects/button-ripple.js", init: (m) => m.initButtonRipple() },
  { path: "./effects/nav-sparkle.js", init: (m) => m.initNavSparkle() },
  { path: "./effects/logo-breathing.js", init: (m) => m.initLogoBreathing() },
  { path: "./effects/logo-parallax.js", init: (m) => m.initLogoParallax() },
  { path: "./effects/logo-sparkle.js", init: (m) => m.initLogoSparkle() },
  {
    path: "./effects/cursor-idle.js",
    init: (m) =>
      m.initCursorIdle(
        document.getElementById("cursor"),
        document.getElementById("cursor-ring"),
      ),
  },
  { path: "./effects/footer-hint.js", init: (m) => m.initFooterHint() },
  { path: "./effects/footer-year.js", init: (m) => m.initFooterYear() },
  { path: "./effects/keyboard-help.js", init: (m) => m.initKeyboardHelp() },
  { path: "./effects/cheatsheet.js", init: (m) => m.initCheatsheet() },
  {
    path: "./effects/first-paint-mote.js",
    init: (m) => m.initFirstPaintMote(),
  },
  {
    path: "./effects/theme-history-hud.js",
    init: (m) => m.initThemeHistoryHud(),
  },

  // Themes
  { path: "./themes/upside-down.js", init: (m) => m.initUpsideDown() },
  { path: "./themes/frozen.js", init: (m) => m.initFrozen() },
  { path: "./themes/deep-sea.js", init: (m) => m.initDeepSea() },
  {
    path: "./themes/blocky.js",
    init: (m) => m.initBlocky(document.querySelector(".appearance-toggle")),
  },
  { path: "./themes/rainy.js", init: (m) => m.initRainy() },
  { path: "./themes/paper.js", init: (m) => m.initPaper() },
  { path: "./themes/vhs.js", init: (m) => m.initVhs() },
  { path: "./themes/constellation.js", init: (m) => m.initConstellation() },
  { path: "./themes/matrix.js", init: (m) => m.initMatrix() },
  { path: "./themes/konami.js", init: (m) => m.initKonami() },
  { path: "./themes/lights-out.js", init: (m) => m.initLightsOut() },
  { path: "./themes/spell-trigger.js", init: (m) => m.initSpellTrigger() },
  { path: "./themes/scribble-clear.js", init: (m) => m.initScribbleClear() },

  // Achievements
  { path: "./achievements/index.js", init: (m) => m.initAchievements() },

  // Wired modules with multi-step setup
  { path: "./scroll-bus.js", init: wireScrollBus },
  { path: "./keyboard.js", init: wireKeyboardHotkeys },
];

for (const { path, init } of MODULES) load(path, init);

// ── URL-driven theme preview ──
// `?theme=frozen` activates the named theme on load for demos and
// screenshots.  Silent so it doesn't award the discovery achievement —
// this is a shortcut, not a found easter egg.  Theme toggles register
// during each theme module's async init, so poll briefly until the
// toggle exists rather than racing it.
const THEME_PARAM_POLL_MS = 50;
const THEME_PARAM_MAX_ATTEMPTS = 40; // poll window = POLL_MS * MAX_ATTEMPTS
const themeParam = new URLSearchParams(window.location.search).get("theme");
if (themeParam) {
  load("./themes/registry.js", (m) => {
    if (!m.isThemeRegistered(themeParam)) return;
    let attempts = 0;
    const poll = setInterval(() => {
      if (m.hasToggle(themeParam) || attempts++ >= THEME_PARAM_MAX_ATTEMPTS) {
        clearInterval(poll);
        if (m.hasToggle(themeParam))
          m.toggleTheme(themeParam, { silent: true });
      }
    }, THEME_PARAM_POLL_MS);
  });
}
