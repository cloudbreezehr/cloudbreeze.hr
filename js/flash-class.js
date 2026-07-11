// ── Flash Class ──
// Restart a one-shot CSS animation by re-adding `className`, then strip the
// class once that animation finishes.  The remove → reflow → re-add dance
// restarts the keyframes on rapid repeat calls (a bare re-add is a no-op
// while the class is still present).
//
// Teardown is scoped to the animation the class actually triggers — learned
// from its animationstart — so an unrelated animation's animationend bubbling
// up from a descendant can't strip the class early.  The animated element may
// be the target itself or a descendant the class selects.

export function flashClass(el, className) {
  if (!el) return;

  el.classList.remove(className);
  // Force a reflow so the class removal commits before the re-add.
  void el.offsetHeight;

  el.addEventListener(
    "animationstart",
    (start) => {
      const anim = start.animationName;
      el.addEventListener("animationend", function onEnd(end) {
        if (end.animationName !== anim) return;
        el.classList.remove(className);
        el.removeEventListener("animationend", onEnd);
      });
    },
    { once: true },
  );

  el.classList.add(className);
}
