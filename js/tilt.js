const PERSPECTIVE = 600;
const HOVER_SCALE = 1.02;

export function initTilt(selector = '.service-card', intensity = 8) {
  if (matchMedia('(hover: none)').matches) return;

  document.querySelectorAll(selector).forEach(card => {
    card.style.willChange = 'transform';

    card.addEventListener('mouseenter', () => {
      card.style.transition = 'background 0.4s';
    });

    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform =
        `perspective(${PERSPECTIVE}px) rotateX(${-y * intensity}deg) rotateY(${x * intensity}deg) scale(${HOVER_SCALE})`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transition = 'background 0.4s, transform 0.4s ease';
      card.style.transform = '';
    });
  });
}
