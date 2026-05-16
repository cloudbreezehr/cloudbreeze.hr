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

const appearance = window.__cloudbreezeAppearance;
if (!appearance) {
  throw new Error(
    "[bootstrap] window.__cloudbreezeAppearance missing — critical-boot.js must run first",
  );
}

function load(path, run) {
  import(path)
    .then(run)
    .catch((err) => console.warn(`[bootstrap] ${path} failed:`, err));
}

// Strict production gate: only the prod hostname sends to PostHog.
// Other hostnames (localhost, IPs, preview subdomains) fall through
// to the default console adapter so stats stay clean.
load("./analytics/index.js", async ({ initAnalytics }) => {
  const isProd = location.hostname === PROD_HOSTNAME;
  if (!isProd) {
    initAnalytics();
    return;
  }
  const { createPostHogAdapter } =
    await import("./analytics/adapters/posthog.js");
  initAnalytics({ adapter: createPostHogAdapter({ apiKey: POSTHOG_API_KEY }) });
});

load("./nav.js", ({ initNav }) =>
  initNav(document.querySelector("nav"), appearance),
);
load("./service-cards.js", ({ initTilt }) => initTilt());
load("./effects/button-ripple.js", ({ initButtonRipple }) =>
  initButtonRipple(),
);
load("./effects/nav-sparkle.js", ({ initNavSparkle }) => initNavSparkle());
load("./effects/logo-breathing.js", ({ initLogoBreathing }) =>
  initLogoBreathing(),
);
load("./effects/logo-parallax.js", ({ initLogoParallax }) =>
  initLogoParallax(),
);
load("./effects/cursor-idle.js", ({ initCursorIdle }) =>
  initCursorIdle(
    document.getElementById("cursor"),
    document.getElementById("cursor-ring"),
  ),
);
load("./effects/footer-hint.js", ({ initFooterHint }) => initFooterHint());
load("./effects/first-paint-mote.js", ({ initFirstPaintMote }) =>
  initFirstPaintMote(),
);
load("./effects/theme-history-hud.js", ({ initThemeHistoryHud }) =>
  initThemeHistoryHud(),
);
load("./themes/upside-down.js", ({ initUpsideDown }) => initUpsideDown());
load("./themes/frozen.js", ({ initFrozen }) => initFrozen());
load("./themes/deep-sea.js", ({ initDeepSea }) => initDeepSea());
load("./themes/blocky.js", ({ initBlocky }) =>
  initBlocky(document.querySelector(".appearance-toggle")),
);
load("./themes/rainy.js", ({ initRainy }) => initRainy());
load("./themes/paper.js", ({ initPaper }) => initPaper());
load("./themes/vhs.js", ({ initVhs }) => initVhs());
load("./achievements/index.js", ({ initAchievements }) => initAchievements());

const PARALLAX_LAYERS = [
  { selector: ".hero-tag", rate: 0.12 },
  { selector: ".hero-title .line-1", rate: 0.06 },
  { selector: ".hero-title .line-2", rate: 0.1 },
  { selector: ".hero-sub", rate: 0.14 },
  { selector: ".hero-actions", rate: 0.18 },
];
const SCROLL_HINT_FADE_AT = 60;

// `subscribe()` only delivers on subsequent native scrolls — if the
// user already scrolled before this loader resolved (slow network),
// each handler runs once for the current position so parallax and
// the scroll-hint catch up to the page state.
load("./scroll-bus.js", async ({ subscribe: subscribeScroll, getScrollY }) => {
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
});

load("./keyboard.js", async ({ onKey }) => {
  const [{ toggleDevConsole, openDevConsole }, { toggleFps }] =
    await Promise.all([import("./dev/console.js"), import("./dev/fps.js")]);

  if (window.location.hash === "#dev") openDevConsole();
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#dev") openDevConsole();
  });
  onKey(".", toggleDevConsole, { ctrl: true, shift: true, allowInInput: true });
  onKey("F", toggleFps, { ctrl: true, shift: true, allowInInput: true });
});
