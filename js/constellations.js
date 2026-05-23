// ── Constellation Patterns ──
// Each constellation is an ordered list of unit-normalized (dx, dy)
// offsets. The first point is the anchor (0, 0); remaining points are
// relative to it. At planting time the offsets are scaled by
// `PLANTED_SCALE` and translated to a per-session anchor in the sky.
//
// The chain matching does not depend on the order in which the user
// clicks the stars — only on the set of unique tagged hits — so the
// offsets describe the visual shape, not a click sequence.
//
// Coordinate convention matches canvas pixel space: +x right, +y down.

export const PLANTED_SCALE = 70;
export const PLANTED_JITTER = 8;

export const CONSTELLATIONS = [
  {
    id: "orions-belt",
    name: "Orion's Belt",
    points: [
      [-2, 0],
      [0, 0.1],
      [2, 0.2],
    ],
  },
  {
    id: "cassiopeia",
    name: "Cassiopeia",
    points: [
      [-2.4, -0.2],
      [-1.2, 0.8],
      [0, -0.2],
      [1.2, 0.9],
      [2.4, 0],
    ],
  },
  {
    id: "ursa-major",
    name: "Ursa Major",
    points: [
      [-2.6, 1.4],
      [-1.4, 0.8],
      [-0.2, 0.6],
      [0.9, 0.2],
      [0.6, -0.9],
      [-0.5, -1.1],
      [-1.4, -0.4],
    ],
  },
  {
    id: "lyra",
    name: "Lyra",
    points: [
      [0, -1.6],
      [-1.2, 0],
      [1.2, 0],
      [-0.8, 1.4],
      [0.8, 1.4],
    ],
  },
];

const _byId = new Map(CONSTELLATIONS.map((c) => [c.id, c]));

export function getConstellation(id) {
  return _byId.get(id) || null;
}
