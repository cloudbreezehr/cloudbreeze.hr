import { lerpColor, multiLerp, toRgba, palettes } from './colors.js';

let canvas, ctx;

function getStreakParams(sp) {
  if (sp < 0.2) return { opMul: 1.0, speedMul: 1.0 };
  if (sp < 0.5) return { opMul: 1.3, speedMul: 1.2 };
  if (sp < 0.75) return { opMul: 0.8, speedMul: 1.5 };
  return { opMul: 0.3, speedMul: 0.5 };
}

class Cloud {
  constructor(i, total) {
    this.x = Math.random() * canvas.width * 1.4 - canvas.width * 0.2;
    this.baseY = (i / total) * canvas.height * 3 - canvas.height * 0.5;
    this.speedX = (Math.random() - 0.5) * 0.12;
    this.scale = 0.5 + Math.random() * 0.8;
    const count = 4 + Math.floor(Math.random() * 3);
    this.blobs = [];
    for (let j = 0; j < count; j++) {
      this.blobs.push({
        ox: (j - count / 2) * 30 * this.scale + (Math.random() - 0.5) * 25 * this.scale,
        oy: (Math.random() - 0.65) * 40 * this.scale,
        r: (30 + Math.random() * 40) * this.scale,
      });
    }
  }
  update() {
    this.x += this.speedX;
    const m = 250 * this.scale;
    if (this.x < -m) this.x += canvas.width + m * 2;
    if (this.x > canvas.width + m) this.x -= canvas.width + m * 2;
  }
  draw(yOffset, vis, pal) {
    if (vis <= 0) return;
    const y = this.baseY + yOffset;
    if (y < -150 || y > canvas.height + 150) return;
    const cw = pal.cloudWhite;
    const cm = pal.cloudMid;
    this.blobs.forEach(b => {
      const bx = this.x + b.ox;
      const by = y + b.oy;
      const op = (0.08 + 0.04 * this.scale) * vis;
      const grad = ctx.createRadialGradient(bx, by, b.r * 0.08, bx, by, b.r);
      grad.addColorStop(0, `rgba(${cw[0]},${cw[1]},${cw[2]},${op})`);
      grad.addColorStop(0.55, `rgba(${cm[0]},${cm[1]},${cm[2]},${op * 0.4})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, b.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

class Streak {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * canvas.width;
    this.y = init ? Math.random() * canvas.height : -10;
    this.len = 40 + Math.random() * 100;
    this.speed = 0.3 + Math.random() * 0.5;
    this.opacity = 0.02 + Math.random() * 0.05;
    this.width = 0.5 + Math.random() * 1;
    this.angle = -0.1 + Math.random() * 0.2;
  }
  update(sp) {
    this.y += this.speed * sp.speedMul;
    this.x += this.angle;
    if (this.y > canvas.height + this.len) this.reset(false);
  }
  draw(sp) {
    ctx.save();
    ctx.globalAlpha = this.opacity * sp.opMul;
    ctx.strokeStyle = 'rgba(120,190,240,1)';
    ctx.lineWidth = this.width;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.len);
    ctx.lineTo(this.x + this.angle * this.len, this.y);
    ctx.stroke();
    ctx.restore();
  }
}

class BreezeWisp {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = init ? Math.random() * canvas.width : -300;
    this.y = Math.random() * canvas.height;
    this.len = 100 + Math.random() * 200;
    this.speed = 0.3 + Math.random() * 0.5;
    this.waveAmp = 8 + Math.random() * 16;
    this.opacity = 0.04 + Math.random() * 0.08;
    this.width = 0.8 + Math.random() * 1.5;
    this.phase = Math.random() * Math.PI * 2;
  }
  update() {
    this.x += this.speed;
    this.phase += 0.01;
    if (this.x > canvas.width + this.len) this.reset(false);
  }
  draw(vis, pal, yOffset) {
    if (vis <= 0) return;
    const wc = pal ? pal.wispColor : [180,215,245];
    const dy = this.y + (yOffset || 0);
    if (dy < -50 || dy > canvas.height + 50) return;
    ctx.save();
    ctx.globalAlpha = this.opacity * vis;
    ctx.strokeStyle = `rgba(${wc[0]},${wc[1]},${wc[2]},1)`;
    ctx.lineWidth = this.width;
    ctx.beginPath();
    const sx = this.x - this.len;
    const sy = dy + Math.sin(this.phase) * this.waveAmp;
    const cy = dy + Math.sin(this.phase + 1) * this.waveAmp;
    const ey = dy + Math.sin(this.phase + 2) * this.waveAmp;
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(this.x - this.len * 0.5, cy, this.x, ey);
    ctx.stroke();
    ctx.restore();
  }
}

class ScrollMote {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = 0;
    this.vy = 0;
    this.r = 0.8 + Math.random() * 1.5;
    this.opacity = 0;
  }
  update(sv) {
    const absSv = Math.abs(sv);
    if (absSv > 0.3) {
      this.vy -= sv * 0.06;
      this.vx += (Math.random() - 0.5) * absSv * 0.04;
      this.opacity = Math.min(0.4, this.opacity + absSv * 0.008);
    }
    this.vy += 0.015;
    this.vx *= 0.975;
    this.vy *= 0.975;
    this.x += this.vx;
    this.y += this.vy;
    this.opacity *= 0.98;
    if (this.y < -30 || this.y > canvas.height + 30 ||
        this.x < -30 || this.x > canvas.width + 30) {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = 0;
      this.vy = 0;
    }
  }
  draw(dark) {
    if (this.opacity < 0.005) return;
    const c = dark ? [200,230,255] : [80,150,220];
    const g = dark ? [130,195,255] : [55,120,200];
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 4);
    grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${this.opacity})`);
    grad.addColorStop(0.3, `rgba(${g[0]},${g[1]},${g[2]},${this.opacity * 0.4})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

const defaults = {
  sky: true,       stars: true,     streaks: true,
  clouds: true,    wisps: true,     horizon: true,
  gusts: true,     motes: true,
  starCount: 120,  streakCount: 35, cloudCount: 18,
  wispCount: 12,   gustCount: 24,   moteCount: 35,
};

export function initCanvas(canvasEl, theme, options) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  const opts = Object.assign({}, defaults, options);

  let isDarkMode = theme.isDark();
  let scrollProgress = 0;
  let scrollVelocity = 0;
  let lastScrollTop = window.scrollY || 0;

  theme.onChange(dark => { isDarkMode = dark; });

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function updateScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
    scrollVelocity += (scrollTop - lastScrollTop) * 0.3;
    lastScrollTop = scrollTop;
  }

  resize();
  updateScroll();
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', updateScroll, { passive: true });

  const clouds = opts.clouds ? Array.from({length: opts.cloudCount}, (_, i) => new Cloud(i, opts.cloudCount)) : [];
  const streaks = opts.streaks ? Array.from({length: opts.streakCount}, () => new Streak()) : [];
  const wisps = opts.wisps ? Array.from({length: opts.wispCount}, () => new BreezeWisp()) : [];
  const motes = opts.motes ? Array.from({length: opts.moteCount}, () => new ScrollMote()) : [];

  const gusts = opts.gusts ? Array.from({length: opts.gustCount}, () => ({
    active: false, x: 0, y: 0, len: 0, angle: 0,
    opacity: 0, life: 0, maxLife: 0, width: 0
  })) : [];

  const stars = opts.stars ? Array.from({length: opts.starCount}, () => {
    const r = 0.3 + Math.random() * 1;
    return {
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      r,
      opacity: 0.1 + Math.random() * 0.4,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.008 + Math.random() * 0.03,
      flash: 0,
      depth: 0.1 + Math.random() * 0.9,
    };
  }) : [];

  // Shooting stars — small reusable pool
  const shootingStars = opts.stars ? Array.from({length: 3}, () => ({
    active: false, x: 0, y: 0, angle: 0, speed: 0,
    len: 0, life: 0, maxLife: 0, opacity: 0,
  })) : [];

  let t = 0;
  function render() {
    const sp = scrollProgress;
    const pal = palettes[isDarkMode ? 'dark' : 'light'];
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scroll-interpolated sky gradient
    if (opts.sky) {
      const skyTop = multiLerp(pal.skyTop, sp);
      const skyBot = multiLerp(pal.skyBot, sp);
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, toRgba(skyTop));
      bg.addColorStop(0.5, toRgba(lerpColor(skyTop, skyBot, 0.5)));
      bg.addColorStop(1, toRgba(skyBot));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Stars — fade out between 20-50% scroll
    if (opts.stars) {
      const starVis = sp < 0.2 ? 1.0 : sp < 0.5 ? 1.0 - (sp - 0.2) / 0.3 : 0.0;
      if (starVis > 0) {
        t += 0.008;
        stars.forEach(s => {
          s.twinkle += s.twinkleSpeed;
          // Random bright flash — rare, brief spike
          if (s.flash > 0) {
            s.flash *= 0.92;
            if (s.flash < 0.01) s.flash = 0;
          } else if (Math.random() < 0.0003) {
            s.flash = 0.6 + Math.random() * 0.4;
          }
          const base = s.opacity * (0.7 + 0.3 * Math.sin(s.twinkle));
          const op = Math.min(1, base + s.flash) * starVis;
          // Parallax — closer stars (higher depth) shift more on scroll
          const shift = s.depth * sp * canvas.height * 0.4;
          const py = ((s.y - shift) % canvas.height + canvas.height) % canvas.height;
          ctx.fillStyle = `rgba(180,210,255,${op})`;
          ctx.beginPath();
          ctx.arc(s.x % canvas.width, py, s.r, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    // Shooting stars — rare fast arcs across the sky
    if (opts.stars) {
      const starVis2 = sp < 0.2 ? 1.0 : sp < 0.5 ? 1.0 - (sp - 0.2) / 0.3 : 0.0;
      if (starVis2 > 0 && Math.random() < 0.003) {
        const ss = shootingStars.find(s => !s.active);
        if (ss) {
          ss.x = Math.random() * canvas.width * 0.8 + canvas.width * 0.1;
          ss.y = Math.random() * canvas.height * 0.4;
          ss.angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2;
          ss.speed = 6 + Math.random() * 8;
          ss.len = 40 + Math.random() * 60;
          ss.opacity = 0.3 + Math.random() * 0.4;
          ss.life = 0;
          ss.maxLife = 20 + Math.random() * 20;
          ss.active = true;
        }
      }
      shootingStars.forEach(ss => {
        if (!ss.active) return;
        ss.life++;
        if (ss.life > ss.maxLife) { ss.active = false; return; }
        const p = ss.life / ss.maxLife;
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        // Fade in quickly, fade out slowly
        const fade = p < 0.1 ? p / 0.1 : (1 - p) / 0.9;
        const op = ss.opacity * fade * starVis2;
        // Draw a tapered line with a bright head
        const tailX = ss.x - Math.cos(ss.angle) * ss.len * Math.min(1, p * 3);
        const tailY = ss.y - Math.sin(ss.angle) * ss.len * Math.min(1, p * 3);
        const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        grad.addColorStop(0, `rgba(180,210,255,0)`);
        grad.addColorStop(0.7, `rgba(200,225,255,${op * 0.3})`);
        grad.addColorStop(1, `rgba(230,240,255,${op})`);
        ctx.save();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.stroke();
        ctx.restore();
      });
    }

    // Streaks — evolve with scroll
    if (opts.streaks) {
      const streakP = getStreakParams(sp);
      streaks.forEach(s => { s.update(streakP); s.draw(streakP); });
    }

    // Cloud layer — clouds live at a fixed altitude, viewport scrolls past them
    if (opts.clouds) {
      const cloudYOffset = -(sp - 0.38) * canvas.height * 4;
      const cloudVis = sp < 0.12 ? 0 : sp < 0.22 ? (sp - 0.12) / 0.1
        : sp < 0.65 ? 1.0 : sp < 0.82 ? 1.0 - (sp - 0.65) / 0.17 : 0;
      clouds.forEach(c => { c.update(); c.draw(cloudYOffset, cloudVis, pal); });
    }

    // Breeze wisps — horizontal wind, also scroll with atmosphere
    if (opts.wisps) {
      const wispYOffset = -(sp - 0.45) * canvas.height * 2.5;
      const wispVis = sp < 0.15 ? 0 : sp < 0.25 ? (sp - 0.15) / 0.1
        : sp < 0.70 ? 1.0 : sp < 0.85 ? 1.0 - (sp - 0.70) / 0.15 : 0;
      wisps.forEach(w => { w.update(); w.draw(wispVis, pal, wispYOffset); });
    }

    // Horizon glow — shifts with descent
    if (opts.horizon) {
      const glowY = canvas.height * (0.75 - sp * 0.25);
      const glowIntensity = 0.12 + sp * 0.10 - Math.max(0, sp - 0.75) * 0.15;
      const hc = pal.horizonColor;
      const hg = ctx.createRadialGradient(canvas.width/2, glowY, 0, canvas.width/2, glowY, canvas.width * (0.7 + sp * 0.2));
      hg.addColorStop(0, `rgba(${hc[0]},${hc[1]},${hc[2]},${glowIntensity.toFixed(3)})`);
      hg.addColorStop(1, 'transparent');
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Edge breeze — wind lines from screen edges during scroll
    scrollVelocity *= 0.92;
    if (opts.gusts) {
      const absSv = Math.abs(scrollVelocity);
      if (absSv > 1.5) {
        const spawnCount = Math.min(2, Math.floor(absSv / 4));
        for (let i = 0; i < spawnCount; i++) {
          const g = gusts.find(g => !g.active);
          if (!g) break;
          const side = Math.random();
          if (side < 0.35) { g.x = Math.random() * 50; g.y = Math.random() * canvas.height; }
          else if (side < 0.7) { g.x = canvas.width - Math.random() * 50; g.y = Math.random() * canvas.height; }
          else if (side < 0.85) { g.x = Math.random() * canvas.width; g.y = Math.random() * 30; }
          else { g.x = Math.random() * canvas.width; g.y = canvas.height - Math.random() * 30; }
          const dir = scrollVelocity > 0 ? -Math.PI / 2 : Math.PI / 2;
          g.angle = dir + (Math.random() - 0.5) * 0.7;
          g.len = 25 + Math.random() * 45;
          g.opacity = 0.05 + Math.random() * 0.08;
          g.width = 0.4 + Math.random() * 0.6;
          g.life = 0;
          g.maxLife = 18 + Math.random() * 14;
          g.active = true;
        }
      }
      const gustCol = isDarkMode ? '180,220,255' : '80,150,220';
      gusts.forEach(g => {
        if (!g.active) return;
        g.life++;
        if (g.life > g.maxLife) { g.active = false; return; }
        const p = g.life / g.maxLife;
        const op = g.opacity * (p < 0.2 ? p / 0.2 : (1 - p) / 0.8);
        const progress = 0.4 + p * 0.6;
        ctx.save();
        ctx.globalAlpha = op;
        ctx.strokeStyle = `rgba(${gustCol},1)`;
        ctx.lineWidth = g.width;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(g.x + Math.cos(g.angle) * g.len * progress,
                   g.y + Math.sin(g.angle) * g.len * progress);
        ctx.stroke();
        ctx.restore();
      });
    }

    // Scroll-reactive particles — blown by scroll, settle with gravity
    if (opts.motes) {
      motes.forEach(m => { m.update(scrollVelocity); m.draw(isDarkMode); });
    }

    // Click burst particles
    clickParticles.forEach((p, i) => {
      p.life++;
      if (p.life > p.maxLife) { clickParticles.splice(i, 1); return; }
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.vy += 0.02; // gentle gravity
      // Breeze curve
      p.x += Math.sin(p.life * 0.08 + p.phase) * 0.3;
      const fade = 1 - p.life / p.maxLife;
      const op = p.opacity * fade;
      if (op < 0.005) return;
      const c = isDarkMode ? p.color : p.colorLight;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
      grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${op})`);
      grad.addColorStop(0.4, `rgba(${c[0]},${c[1]},${c[2]},${op * 0.4})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Drag breeze trail
    for (let i = trailSegments.length - 1; i >= 0; i--) {
      const s = trailSegments[i];
      s.life++;
      if (s.life > s.maxLife) { trailSegments.splice(i, 1); continue; }
      s.x += Math.sin(s.life * 0.06 + s.phase) * 0.4;
      s.y += Math.cos(s.life * 0.05 + s.phase) * 0.2;
      const fade = 1 - s.life / s.maxLife;
      const op = s.opacity * fade;
      if (op < 0.005 || !s.prev) continue;
      const c = isDarkMode ? [180, 220, 255] : [55, 120, 200];
      ctx.save();
      ctx.globalAlpha = op;
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},1)`;
      ctx.lineWidth = s.width * fade;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.prev.x, s.prev.y);
      ctx.quadraticCurveTo(
        (s.prev.x + s.x) / 2 + Math.sin(s.phase) * 6,
        (s.prev.y + s.y) / 2 + Math.cos(s.phase) * 6,
        s.x, s.y
      );
      ctx.stroke();
      ctx.restore();
    }

    requestAnimationFrame(render);
  }

  // Click burst — scatter luminous motes from click point
  const clickParticles = [];
  const isUpside = () => document.body.classList.contains('upside-down');

  document.addEventListener('click', e => {
    const count = 6 + Math.floor(Math.random() * 5);
    const upside = isUpside();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      clickParticles.push({
        x: e.clientX,
        y: e.clientY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 1 + Math.random() * 2,
        opacity: 0.3 + Math.random() * 0.4,
        life: 0,
        maxLife: 40 + Math.random() * 30,
        phase: Math.random() * Math.PI * 2,
        color: upside ? [255, 130, 130] : [150, 210, 255],
        colorLight: upside ? [200, 60, 60] : [55, 120, 200],
      });
    }
  });

  // Drag trail — flowing wispy segments along the drag path
  const trailSegments = [];
  let isDragging = false;
  let lastTrail = { x: 0, y: 0 };
  let trailDist = 0;

  document.addEventListener('mousedown', e => {
    isDragging = true;
    lastTrail = { x: e.clientX, y: e.clientY };
    trailDist = 0;
  });

  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - lastTrail.x;
    const dy = e.clientY - lastTrail.y;
    trailDist += Math.sqrt(dx * dx + dy * dy);
    if (trailDist > 8) {
      trailSegments.push({
        x: e.clientX,
        y: e.clientY,
        prev: { x: lastTrail.x, y: lastTrail.y },
        width: 1 + Math.random() * 1.5,
        opacity: 0.15 + Math.random() * 0.1,
        life: 0,
        maxLife: 25 + Math.random() * 15,
        phase: Math.random() * Math.PI * 2,
      });
      lastTrail = { x: e.clientX, y: e.clientY };
      trailDist = 0;
    }
  });

  document.addEventListener('mouseup', () => { isDragging = false; });

  render();
}
