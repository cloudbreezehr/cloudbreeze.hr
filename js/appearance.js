// ── Appearance ──
// Light / dark / auto color preference.  Paired with js/appearance-boot.js:
// the boot file runs a minimal subset of this logic synchronously before
// first paint so light-appearance users don't flash dark colors.  If the
// default-preference fallback here ("dark") ever changes, update
// appearance-boot.js to match.

const STORAGE_KEY = "appearance";
const DEFAULT_PREFERENCE = "dark";

/**
 * Read the user's appearance preference — one of "auto", "light", "dark".
 * Falls back to the default when no preference has been stored.
 */
export function getAppearancePreference() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_PREFERENCE;
}

export function initAppearance(toggleEl) {
  let isDark = !document.body.classList.contains("light-appearance");
  const callbacks = [];
  const order = ["auto", "light", "dark"];
  const tooltips = {
    auto: "System appearance",
    light: "Light appearance",
    dark: "Dark appearance",
  };

  function apply(pref) {
    if (pref === "light") isDark = false;
    else if (pref === "dark") isDark = true;
    else isDark = !window.matchMedia("(prefers-color-scheme: light)").matches;
    document.body.classList.toggle("light-appearance", !isDark);
    toggleEl.setAttribute("data-appearance", pref);
    toggleEl.setAttribute("data-tooltip", tooltips[pref]);
    callbacks.forEach((cb) => cb(isDark));
  }

  apply(getAppearancePreference());

  toggleEl.addEventListener("click", () => {
    const current = getAppearancePreference();
    const next = order[(order.indexOf(current) + 1) % order.length];
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "appearance-change", appearance: next },
      }),
    );
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (getAppearancePreference() === "auto") {
        isDark = e.matches;
        document.body.classList.toggle("light-appearance", !isDark);
        callbacks.forEach((cb) => cb(isDark));
      }
    });

  return {
    isDark: () => isDark,
    onChange: (cb) => callbacks.push(cb),
  };
}
