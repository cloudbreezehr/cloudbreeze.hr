// ── Lightning ──
// A jagged bolt cracks from the top of the viewport down to a target point,
// with a bright flash. Self-cleaning SVG; skipped under reduced motion.

import { prefersReducedMotion } from "../motion.js";
import { screenFlash } from "./flash.js";
import { playSfx } from "../audio/sfx.js";
import { activeThemeColor } from "../themes/registry.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SEGMENTS = 9; // zigzag segments from top to target
const JITTER_PX = 36; // horizontal wander per interior segment
const STRIKE_MS = 90; // held bright
const FADE_MS = 240; // fade-out
const STROKE_WIDTH = 2.5;
const BOLT_COLOR = "#dce8ff";
const FLASH_PEAK = 0.45;

function boltPoints(targetX, targetY) {
  const pts = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const edge = i === 0 || i === SEGMENTS; // anchor the ends, jitter the middle
    const jitter = edge ? 0 : (Math.random() - 0.5) * 2 * JITTER_PX;
    pts.push(`${targetX + jitter},${targetY * t}`);
  }
  return pts.join(" ");
}

export function lightningStrike(targetX, targetY, { flash = true } = {}) {
  if (prefersReducedMotion()) return;
  playSfx("lightning");
  // Adopt the active theme's accent so a cast bolt matches the world it
  // strikes in; the icy-blue default stands in when no theme is active.
  const boltColor = activeThemeColor() || BOLT_COLOR;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "lightning");
  svg.setAttribute("aria-hidden", "true");
  const line = document.createElementNS(SVG_NS, "polyline");
  line.setAttribute("points", boltPoints(targetX, targetY));
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", boltColor);
  line.setAttribute("stroke-width", String(STROKE_WIDTH));
  line.setAttribute("stroke-linejoin", "round");
  line.setAttribute("stroke-linecap", "round");
  svg.appendChild(line);
  document.body.appendChild(svg);

  const total = STRIKE_MS + FADE_MS;
  svg.animate(
    [{ opacity: 1 }, { opacity: 1, offset: STRIKE_MS / total }, { opacity: 0 }],
    { duration: total, easing: "ease-out" },
  ).onfinish = () => svg.remove();

  if (flash) {
    screenFlash({ color: boltColor, peak: FLASH_PEAK, durationMs: total });
  }
}
