// ── Clickable ──
// Promotes a non-button, non-anchor element to a clickable control:
// `role="button"` for assistive tech and any selector keyed on the
// role, `tabindex="0"` for keyboard reachability, click + keyboard
// (Enter/Space) activation matching the ARIA-button contract.
//
// Contract:
//   - The only correct way to bind a click on an element other than
//     `<a>` or `<button>`. Native elements carry their own role and
//     focusability and should keep using `addEventListener` directly.
//   - A pre-existing tabindex is preserved so callers can opt into
//     -1 (programmatic-only focus) or a positive value for ordering.

export function bindClickable(el, handler) {
  if (!el || typeof handler !== "function") return;

  el.setAttribute("role", "button");
  if (!el.hasAttribute("tabindex")) {
    el.tabIndex = 0;
  }

  el.addEventListener("click", handler);
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    handler(e);
  });
}
