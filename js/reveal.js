export function initReveal(selector = '.reveal', threshold = 0.15) {
  const els = document.querySelectorAll(selector);
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold });
  els.forEach(el => observer.observe(el));
}
