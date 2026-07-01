export function initReveal(selector = ".reveal", threshold = 0.15) {
  const els = document.querySelectorAll(selector);
  // Without IntersectionObserver, reveal everything at once — hidden .reveal
  // content must never get stuck invisible. (Scripting fully off is handled by
  // a <noscript> style in index.html.)
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          observer.unobserve(e.target);
        }
      });
    },
    { threshold },
  );
  els.forEach((el) => observer.observe(el));
}
