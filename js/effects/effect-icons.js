// ── Effect icons ──
// Hand-drawn line/silhouette art, one unique glyph per incantation and cheat.
// Each effect carries its own `icon` from this set (like themes carry an icon),
// so the glyph travels with the effect and is reused anywhere — the GTA weapon
// slot, the cheatsheet, and beyond. Cohesive set: a 48×48 viewBox, currentColor
// so callers tint them, bold enough to read small. Dark interior cut-outs use a
// near-black fill so they read as recessed detail on a dark panel.

const SVG_ATTRS =
  'viewBox="0 0 48 48" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';
const wrap = (inner) => `<svg ${SVG_ATTRS}>${inner}</svg>`;

const HOLE = "#121212"; // recessed-detail fill, matches the slot panel

export const ICONS = {
  // ── Incantations ──

  // BOOM — a rocket lifting off beside a spark.
  boom: wrap(
    `<path d="M22 8c4 3 6.5 7.5 6.5 14 0 2.9-.6 5.4-1.6 7.3H17.1c-1-1.9-1.6-4.4-1.6-7.3C15.5 15.5 18 11 22 8z"/>` +
      `<circle cx="22" cy="18.5" r="2.4" fill="${HOLE}"/>` +
      `<path d="M15.5 27 10 34l6.8-2.4z"/><path d="M28.5 27 34 34l-6.8-2.4z"/>` +
      `<path d="M18.5 30h7l-1.6 5.4L22 41l-1.9-5.6z"/>` +
      `<path d="M36 7l1.5 3.9L41.5 12l-4 1.6L36 17.5l-1.5-3.9L30.5 12l4-1.1z"/>`,
  ),
  // STAR — a single five-point star.
  star: wrap(
    `<path d="M24 4l5.7 12.6 13.8 1.4-10.3 9.2 2.9 13.6L24 33.6 11.9 40.4l2.9-13.6L4.5 18l13.8-1.4z"/>`,
  ),
  // PULSE — full concentric rings.
  pulse: wrap(
    `<g fill="none" stroke="currentColor" stroke-width="3">` +
      `<circle cx="24" cy="24" r="6"/><circle cx="24" cy="24" r="13" opacity=".55"/>` +
      `<circle cx="24" cy="24" r="20" opacity=".28"/></g>` +
      `<circle cx="24" cy="24" r="2.6"/>`,
  ),
  // DEPLOY — an up-arrow shipping out of a crate.
  deploy: wrap(
    `<path d="M9 27h30v13H9z" fill="none" stroke="currentColor" stroke-width="3"/>` +
      `<path d="M24 4l9.5 12h-6v11h-7V16h-6z"/>`,
  ),
  // NOVA — an eight-point burst.
  nova: wrap(
    `<path d="M24 3l3.2 12.4 9-7.6-4.8 11.4 12.2 1.8-12.2 1.8 4.8 11.4-9-7.6L24 49l-3.2-12.4-9 7.6 4.8-11.4-12.2-1.8 12.2-1.8-4.8-11.4 9 7.6z"/>`,
  ),
  // CONFETTI — scattered pieces.
  confetti: wrap(
    `<g>` +
      `<rect x="7" y="9" width="6.5" height="6.5" rx="1" transform="rotate(22 10 12)"/>` +
      `<rect x="30" y="7" width="6.5" height="6.5" rx="1" transform="rotate(-16 33 10)"/>` +
      `<rect x="19" y="19" width="6.5" height="6.5" rx="1" transform="rotate(38 22 22)"/>` +
      `<rect x="33" y="25" width="6.5" height="6.5" rx="1" transform="rotate(12 36 28)"/>` +
      `<rect x="9" y="29" width="6.5" height="6.5" rx="1" transform="rotate(-28 12 32)"/>` +
      `<rect x="22" y="35" width="6.5" height="6.5" rx="1" transform="rotate(16 25 38)"/>` +
      `</g>`,
  ),
  // PARTY — a popper cone flinging bits.
  party: wrap(
    `<path d="M6 42 15 19l14 14z"/>` +
      `<g><circle cx="31" cy="11" r="2.2"/><circle cx="39" cy="9" r="1.8"/>` +
      `<rect x="34" y="17" width="4.5" height="4.5" rx="1" transform="rotate(20 36 19)"/>` +
      `<rect x="26" y="6" width="4.5" height="4.5" rx="1" transform="rotate(-18 28 8)"/>` +
      `<circle cx="42" cy="18" r="1.6"/></g>`,
  ),
  // SNOW — a six-spoke snowflake.
  snow: wrap(
    `<g stroke="currentColor" stroke-width="3" stroke-linecap="round">` +
      `<line x1="24" y1="4" x2="24" y2="44"/><line x1="6.7" y1="14" x2="41.3" y2="34"/>` +
      `<line x1="6.7" y1="34" x2="41.3" y2="14"/></g>` +
      `<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">` +
      `<path d="M24 4l-4 4M24 4l4 4M24 44l-4-4M24 44l4-4"/></g>`,
  ),
  // SUDO — a terminal prompt.
  sudo: wrap(
    `<rect x="5" y="9" width="38" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="3"/>` +
      `<path d="M13 19l6 5-6 5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<line x1="24" y1="30" x2="33" y2="30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  ),
  // GLOW — a glowing lightbulb.
  glow: wrap(
    `<path d="M24 6a12 12 0 0 0-7 21.7c1.3 1 2 2 2 3.3v1h10v-1c0-1.3.7-2.3 2-3.3A12 12 0 0 0 24 6z"/>` +
      `<rect x="19.5" y="33" width="9" height="3.5" rx="1.5"/>` +
      `<rect x="21" y="39" width="6" height="3" rx="1.5"/>`,
  ),
  // QUAKE — a seismograph tremor.
  quake: wrap(
    `<path fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" d="M4 25l5-11 5 22 6-29 5 30 5-23 4 11h5"/>`,
  ),
  // ORBIT — a planet with an orbit ring.
  orbit: wrap(
    `<circle cx="24" cy="24" r="8"/>` +
      `<ellipse cx="24" cy="24" rx="20" ry="7.5" fill="none" stroke="currentColor" stroke-width="3" transform="rotate(-25 24 24)"/>`,
  ),
  // SUN — a disc with triangular rays.
  sun: wrap(
    `<circle cx="24" cy="24" r="9"/>` +
      `<g><path d="M24 2l2.6 6h-5.2z"/><path d="M24 46l2.6-6h-5.2z"/>` +
      `<path d="M2 24l6 2.6v-5.2z"/><path d="M46 24l-6 2.6v-5.2z"/>` +
      `<path d="M8.3 8.3l5.5 3-2.5 2.5z"/><path d="M39.7 39.7l-5.5-3 2.5-2.5z"/>` +
      `<path d="M39.7 8.3l-3 5.5-2.5-2.5z"/><path d="M8.3 39.7l3-5.5 2.5 2.5z"/></g>`,
  ),
  // DISCO — a mirror ball on a cord.
  disco: wrap(
    `<line x1="24" y1="3" x2="24" y2="11" stroke="currentColor" stroke-width="2"/>` +
      `<circle cx="24" cy="11" r="2"/>` +
      `<circle cx="24" cy="27" r="13" fill="none" stroke="currentColor" stroke-width="2.5"/>` +
      `<g fill="none" stroke="currentColor" stroke-width="1.5">` +
      `<line x1="11" y1="27" x2="37" y2="27"/><line x1="24" y1="14" x2="24" y2="40"/>` +
      `<path d="M13 21c7 4 15 4 22 0M13 33c7-4 15-4 22 0"/>` +
      `<path d="M18 15v24M30 15v24"/></g>`,
  ),
  // RAINBOW — arcs springing from two clouds.
  rainbow: wrap(
    `<g fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round">` +
      `<path d="M8 36a16 16 0 0 1 32 0"/><path d="M14 36a10 10 0 0 1 20 0" opacity=".6"/>` +
      `<path d="M20 36a4 4 0 0 1 8 0" opacity=".35"/></g>` +
      `<circle cx="8" cy="37" r="3"/><circle cx="40" cy="37" r="3"/>`,
  ),
  // BOLT — a lightning bolt.
  bolt: wrap(`<path d="M27 3 11 27h9.5l-3.5 18 20-26H28z"/>`),
  // STORM — a cloud spitting a bolt.
  storm: wrap(
    `<path d="M14 21a8 8 0 0 1 15.6-2.4A6.5 6.5 0 0 1 34 31H15a7 7 0 0 1-1-10z"/>` +
      `<path d="M24 31l-5 9h4.5l-3 7 9.5-11h-5z"/>`,
  ),
  // COMET — an icy head with a tail.
  comet: wrap(
    `<circle cx="33" cy="15" r="7.5"/>` +
      `<path d="M27.5 20.5 6 42l8.5-23z" opacity=".75"/>` +
      `<circle cx="14" cy="34" r="1.6"/>`,
  ),
  // WARP — chevrons converging on a point.
  warp: wrap(
    `<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M6 10l10 6-10 6"/><path d="M42 10l-10 6 10 6"/>` +
      `<path d="M6 28l10 6-10 6"/><path d="M42 28l-10 6 10 6"/></g>` +
      `<circle cx="24" cy="24" r="3.5"/>`,
  ),
  // GUST — curling wind lines.
  gust: wrap(
    `<g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round">` +
      `<path d="M6 16h22a5 5 0 1 0-5-5"/><path d="M6 26h28a5 5 0 1 1-5 5"/>` +
      `<path d="M6 36h16a4 4 0 1 0-4-4"/></g>`,
  ),
  // WISH — a shooting star with a fading sparkle trail.
  wish: wrap(
    `<path d="M32 6l2.6 5.8 6.4.6-4.8 4.3 1.4 6.3L32 19.8l-5.6 3.2 1.4-6.3-4.8-4.3 6.4-.6z"/>` +
      `<g><circle cx="20" cy="26" r="2"/><circle cx="14" cy="32" r="1.6"/><circle cx="9" cy="38" r="1.2"/></g>`,
  ),
  // METEOR — a cratered rock with a burning trail.
  meteor: wrap(
    `<circle cx="31" cy="17" r="8"/>` +
      `<circle cx="29" cy="15" r="1.6" fill="${HOLE}"/><circle cx="33.5" cy="19" r="1.3" fill="${HOLE}"/>` +
      `<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">` +
      `<path d="M24 23 9 38"/><path d="M28 26 16 39"/><path d="M21 19 8 30"/></g>`,
  ),
  // SUPERNOVA — a core with rays inside an outer ring.
  supernova: wrap(
    `<g stroke="currentColor" stroke-width="2.6" stroke-linecap="round">` +
      `<line x1="24" y1="2" x2="24" y2="12"/><line x1="24" y1="36" x2="24" y2="46"/>` +
      `<line x1="2" y1="24" x2="12" y2="24"/><line x1="36" y1="24" x2="46" y2="24"/>` +
      `<line x1="9" y1="9" x2="15.5" y2="15.5"/><line x1="32.5" y1="32.5" x2="39" y2="39"/>` +
      `<line x1="39" y1="9" x2="32.5" y2="15.5"/><line x1="15.5" y1="32.5" x2="9" y2="39"/></g>` +
      `<circle cx="24" cy="24" r="6.5"/>` +
      `<circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" stroke-width="2" opacity=".5"/>`,
  ),
  // ECHO — sonar arcs rippling off a point.
  echo: wrap(
    `<circle cx="13" cy="24" r="3"/>` +
      `<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">` +
      `<path d="M21 16a12 12 0 0 1 0 16" opacity=".8"/>` +
      `<path d="M28 11a19 19 0 0 1 0 26" opacity=".5"/>` +
      `<path d="M35 7a26 26 0 0 1 0 34" opacity=".3"/></g>`,
  ),
  // BLOOM — a four-petal flower.
  bloom: wrap(
    `<g><circle cx="24" cy="12" r="6.2"/><circle cx="36" cy="24" r="6.2"/>` +
      `<circle cx="24" cy="36" r="6.2"/><circle cx="12" cy="24" r="6.2"/></g>` +
      `<circle cx="24" cy="24" r="5" fill="${HOLE}"/>`,
  ),
  // DRIP — a single falling raindrop with a glint.
  drip: wrap(
    `<path d="M24 5c7 11 11 18 11 26a11 11 0 0 1-22 0c0-8 4-15 11-26z"/>` +
      `<circle cx="19" cy="31" r="2.6" fill="${HOLE}"/>`,
  ),
  // AURORA — rippling curtains of light.
  aurora: wrap(
    `<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">` +
      `<path d="M6 17q9-9 18 0t18 0"/>` +
      `<path d="M6 26q9-9 18 0t18 0" opacity=".6"/>` +
      `<path d="M6 35q9-9 18 0t18 0" opacity=".35"/></g>`,
  ),
  // SHATTER — cracks radiating from an impact point.
  shatter: wrap(
    `<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M24 24 13 7"/><path d="M24 24 40 11"/><path d="M24 24 42 28"/>` +
      `<path d="M24 24 29 43"/><path d="M24 24 7 35"/></g>` +
      `<circle cx="24" cy="24" r="2.4"/>`,
  ),

  // ── Cheats ──

  // FULL POCKETS — a banknote with a medallion.
  money: wrap(
    `<rect x="5" y="13" width="38" height="22" rx="2.5"/>` +
      `<circle cx="24" cy="24" r="6.5" fill="${HOLE}"/>` +
      `<circle cx="11" cy="18" r="1.7" fill="${HOLE}"/><circle cx="37" cy="30" r="1.7" fill="${HOLE}"/>`,
  ),
  // MAX HEAT — a police beacon.
  siren: wrap(
    `<path d="M13.5 30a10.5 10.5 0 0 1 21 0z"/>` +
      `<rect x="10.5" y="30" width="27" height="5" rx="1.5"/>` +
      `<rect x="22" y="9" width="4" height="8" rx="2"/>` +
      `<g stroke="currentColor" stroke-width="2.6" stroke-linecap="round">` +
      `<line x1="8" y1="20" x2="3.5" y2="17.5"/><line x1="40" y1="20" x2="44.5" y2="17.5"/></g>`,
  ),
  // TAKE OFF — a jetpack firing.
  jetpack: wrap(
    `<rect x="16" y="9" width="16" height="20" rx="5"/>` +
      `<rect x="11" y="27" width="6.5" height="9" rx="2.5"/><rect x="30.5" y="27" width="6.5" height="9" rx="2.5"/>` +
      `<rect x="22" y="5" width="4" height="6" rx="2"/>` +
      `<path d="M11.5 36l2.8 8 2.8-8z"/><path d="M30.7 36l2.8 8 2.8-8z"/>`,
  ),
  // ROLL OUT — a tank.
  tank: wrap(
    `<rect x="7" y="30" width="34" height="9" rx="4.5" fill="none" stroke="currentColor" stroke-width="3"/>` +
      `<g fill="${HOLE}"><circle cx="14" cy="34.5" r="1.7"/><circle cx="24" cy="34.5" r="1.7"/><circle cx="34" cy="34.5" r="1.7"/></g>` +
      `<rect x="11" y="22" width="26" height="8" rx="2"/>` +
      `<rect x="22" y="15" width="11" height="7" rx="1.5"/>` +
      `<rect x="31" y="17" width="14" height="3" rx="1.5"/>`,
  ),
  // RIOT — an emergency warning.
  riot: wrap(
    `<path d="M24 5 44 41H4z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>` +
      `<line x1="24" y1="18" x2="24" y2="30" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>` +
      `<circle cx="24" cy="36" r="2.2"/>`,
  ),
  // PINK SLIP — a car.
  car: wrap(
    `<path d="M6 34v-4l4-1 4-9h14l6 9 4 1v4z"/>` +
      `<circle cx="15" cy="34" r="4.5"/><circle cx="33" cy="34" r="4.5"/>` +
      `<circle cx="15" cy="34" r="1.8" fill="${HOLE}"/><circle cx="33" cy="34" r="1.8" fill="${HOLE}"/>`,
  ),
  // STORM ROLLS IN — a cloud with driving rain.
  downpour: wrap(
    `<path d="M14 22a8 8 0 0 1 15.6-2.4A6.5 6.5 0 0 1 34 32H15a7 7 0 0 1-1-10z"/>` +
      `<g stroke="currentColor" stroke-width="2.6" stroke-linecap="round">` +
      `<line x1="16" y1="36" x2="13" y2="43"/><line x1="24" y1="36" x2="21" y2="43"/>` +
      `<line x1="32" y1="36" x2="29" y2="43"/></g>`,
  ),
  // LOW GRAVITY — an up-arrow over rising motes.
  float: wrap(
    `<path d="M24 5l9.5 12.5h-6V28h-7V17.5h-6z"/>` +
      `<circle cx="11" cy="38" r="3.4"/><circle cx="24" cy="42.5" r="3.4"/><circle cx="37" cy="36" r="3.4"/>`,
  ),
};
