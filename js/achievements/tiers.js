// ── Point Tiers ──
// The single source of truth for the rarity ladder. Each tier is one row: its
// name, its point threshold, and a celebration `level` (0 = a quiet low tier;
// 1+ = a rarity that earns fanfare on unlock, escalating with the number).
// Everything tier-shaped derives from this table — the POINT_TIERS map, the
// rarity a point value maps to, the fireworks volley, the toast pop — so adding
// a tier is one row here (plus its matching ROCKET_COUNT_* knob and CSS block).
export const TIERS = [
  { name: "trivial", points: 1, level: 0 },
  { name: "common", points: 5, level: 0 },
  { name: "uncommon", points: 10, level: 0 },
  { name: "rare", points: 25, level: 0 },
  { name: "epic", points: 50, level: 1 },
  { name: "legendary", points: 100, level: 2 },
  { name: "mythic", points: 500, level: 3 },
  { name: "celestial", points: 1000, level: 4 },
];

// NAME → points (e.g. POINT_TIERS.LEGENDARY === 100), so achievement
// definitions read `points: LEGENDARY`. Frozen so callers can't mutate it.
export const POINT_TIERS = Object.freeze(
  Object.fromEntries(TIERS.map((t) => [t.name.toUpperCase(), t.points])),
);

// The rarity name a point value earns — the highest fanfare tier (level ≥ 1) at
// or below it — or null for the quiet low tiers. Relies on TIERS being in
// ascending point order.
export function rarityTierFor(points) {
  let name = null;
  for (const t of TIERS) {
    if (t.level >= 1 && points >= t.points) name = t.name;
  }
  return name;
}
