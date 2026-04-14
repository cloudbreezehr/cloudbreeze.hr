export function initTheme(toggleEl) {
  let isDarkMode = !document.body.classList.contains("light-mode");
  const callbacks = [];
  const themeOrder = ["auto", "light", "dark"];
  const themeTooltips = {
    auto: "System theme",
    light: "Light mode",
    dark: "Dark mode",
  };

  function applyTheme(pref) {
    if (pref === "light") isDarkMode = false;
    else if (pref === "dark") isDarkMode = true;
    else
      isDarkMode = !window.matchMedia("(prefers-color-scheme: light)").matches;
    document.body.classList.toggle("light-mode", !isDarkMode);
    toggleEl.setAttribute("data-theme", pref);
    toggleEl.setAttribute("data-tooltip", themeTooltips[pref]);
    callbacks.forEach((cb) => cb(isDarkMode));
  }

  applyTheme(localStorage.getItem("theme") || "dark");

  toggleEl.addEventListener("click", () => {
    const current = localStorage.getItem("theme") || "dark";
    const next =
      themeOrder[(themeOrder.indexOf(current) + 1) % themeOrder.length];
    localStorage.setItem("theme", next);
    applyTheme(next);
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "theme-change", theme: next },
      }),
    );
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if ((localStorage.getItem("theme") || "dark") === "auto") {
        isDarkMode = e.matches;
        document.body.classList.toggle("light-mode", !isDarkMode);
        callbacks.forEach((cb) => cb(isDarkMode));
      }
    });

  return {
    isDark: () => isDarkMode,
    onChange: (cb) => callbacks.push(cb),
  };
}
