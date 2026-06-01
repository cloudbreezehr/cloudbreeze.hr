// ── Footer Copyright Year ──
// Keeps the footer copyright year current without an annual manual
// edit.  The markup ships with the year hardcoded (so there's never a
// flash of a wrong/empty value), and this swaps in the live year on
// load.  Only rewrites the leading year token, preserving whatever
// prose follows.

export function initFooterYear() {
  const el = document.querySelector("[data-copy-year]");
  if (!el) return;
  const year = String(new Date().getFullYear());
  // Replace the first 4-digit run; leaves "© " prefix and the company
  // name suffix intact.
  el.textContent = el.textContent.replace(/\d{4}/, year);
}
