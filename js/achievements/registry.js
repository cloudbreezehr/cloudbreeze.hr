// ── Achievement Registry ──
// All achievement definitions as pure data. No logic, no conditions.
// Conditions live in tracker.js where they have access to event state.

// ── Point Tiers ──
const TRIVIAL = 1;
const COMMON = 5;
const UNCOMMON = 10;
const RARE = 25;
const EPIC = 50;
const LEGENDARY = 100;

// ── Achievement Sets ──
export const SETS = [
  { id: "exploration", label: "Exploration", color: null },
  { id: "mastery", label: "Mastery", color: null },
  { id: "deep-sea", label: "Deep Sea", color: "#00ffc8" },
  { id: "frozen", label: "Frozen", color: "#88d4f7" },
  { id: "blocky", label: "Blocky", color: "#ffa040" },
  { id: "rainy", label: "Rainy", color: "#6a9fc0" },
  { id: "upside-down", label: "Upside Down", color: "#e04050" },
  { id: "meta", label: "Milestones", color: null },
];

// ── Achievement Definitions ──

export const ACHIEVEMENTS = [
  // ── Exploration ──
  {
    id: "cloudlog-activated",
    title: "Cloudlog Activated",
    description: "You found the hidden logbook.",
    set: "exploration",
    points: UNCOMMON,
    hidden: false,
  },
  {
    id: "first-light",
    title: "First Light",
    description: "A ripple in the stillness.",
    set: "exploration",
    points: TRIVIAL,
    hidden: false,
  },
  {
    id: "stargazer",
    title: "Stargazer",
    description: "The sky responds to your gaze.",
    set: "exploration",
    points: COMMON,
    hidden: false,
  },
  {
    id: "down-to-earth",
    title: "Down to Earth",
    description: "You've seen it all — from stars to horizon.",
    set: "exploration",
    points: COMMON,
    hidden: false,
  },
  {
    id: "zenith",
    title: "Zenith",
    description: "The journey there and back again.",
    set: "exploration",
    points: COMMON,
    hidden: false,
  },
  {
    id: "nightfall",
    title: "Nightfall",
    description: "The sky darkens at your command.",
    set: "exploration",
    points: TRIVIAL,
    hidden: false,
  },
  {
    id: "daybreak",
    title: "Daybreak",
    description: "Light breaks through.",
    set: "exploration",
    points: TRIVIAL,
    hidden: false,
  },
  {
    id: "dusk-and-dawn",
    title: "Dusk and Dawn",
    description: "You've seen both sides of the sky.",
    set: "exploration",
    points: UNCOMMON,
    hidden: false,
  },
  {
    id: "full-spectrum",
    title: "Full Spectrum",
    description: "Every shade of sky, sampled.",
    set: "exploration",
    points: UNCOMMON,
    hidden: false,
  },
  {
    id: "spark",
    title: "Spark",
    description: "Something stirs where you touched.",
    set: "exploration",
    points: COMMON,
    hidden: true,
  },
  {
    id: "trail-blazer",
    title: "Trail Blazer",
    description: "You leave a mark wherever you go.",
    set: "exploration",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "cloud-reader",
    title: "Cloud Reader",
    description: "The first page turns.",
    set: "exploration",
    points: COMMON,
    hidden: false,
  },

  // ── Mastery ──
  {
    id: "gathering-storm",
    title: "Gathering Storm",
    description: "The particles sense your presence.",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "eye-of-the-storm",
    title: "Eye of the Storm",
    description: "Everything orbits around you now.",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  {
    id: "event-horizon",
    title: "Event Horizon",
    description: "A well opened in the fabric of the sky.",
    set: "mastery",
    points: EPIC,
    hidden: true,
  },
  {
    id: "singularity",
    title: "Singularity",
    description: "The well consumed everything in its reach.",
    set: "mastery",
    points: LEGENDARY,
    hidden: true,
  },
  {
    id: "fury-unleashed",
    title: "Fury Unleashed",
    description: "Lightning answered your call.",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "northern-lights",
    title: "Northern Lights",
    description: "The aurora ripples above.",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  {
    id: "snow-globe",
    title: "Snow Globe",
    description: "You shook the sky.",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  {
    id: "rapid-fire",
    title: "Rapid Fire",
    description: "A flurry of sparks.",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "cartographer",
    title: "Cartographer",
    description: "Every corner explored.",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "night-owl",
    title: "Night Owl",
    description: "Still here? The sky notices.",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "persistent-explorer",
    title: "Persistent Explorer",
    description: "You keep coming back.",
    set: "mastery",
    points: RARE,
    hidden: true,
  },

  // ── Deep Sea ──
  {
    id: "the-depths",
    title: "The Depths",
    description: "You sank beneath the surface.",
    set: "deep-sea",
    points: EPIC,
    hidden: true,
  },
  {
    id: "bioluminescent",
    title: "Bioluminescent",
    description: "Life glows in the darkness below.",
    set: "deep-sea",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "jellyfish-drift",
    title: "Jellyfish Drift",
    description: "They pulse with ancient rhythm.",
    set: "deep-sea",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "pressure-drop",
    title: "Pressure Drop",
    description: "The ocean floor trembles.",
    set: "deep-sea",
    points: RARE,
    hidden: true,
  },
  {
    id: "resurface",
    title: "Resurface",
    description: "You clawed your way back to the light.",
    set: "deep-sea",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "abyssal-explorer",
    title: "Abyssal Explorer",
    description: "The deep sea holds no more secrets.",
    set: "deep-sea",
    points: LEGENDARY,
    hidden: true,
  },

  // ── Frozen ──
  {
    id: "first-frost",
    title: "First Frost",
    description: "The air turned cold.",
    set: "frozen",
    points: EPIC,
    hidden: true,
  },
  {
    id: "frost-breath",
    title: "Frost Breath",
    description: "Your breath crystallizes in the chill.",
    set: "frozen",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "snowdrift",
    title: "Snowdrift",
    description: "The flakes obey the wind.",
    set: "frozen",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "blizzard",
    title: "Blizzard",
    description: "A whiteout engulfs the sky.",
    set: "frozen",
    points: RARE,
    hidden: true,
  },
  {
    id: "thaw",
    title: "Thaw",
    description: "The ice recedes.",
    set: "frozen",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "glacial-mastery",
    title: "Glacial Mastery",
    description: "The frozen sky bends to your will.",
    set: "frozen",
    points: LEGENDARY,
    hidden: true,
  },

  // ── Blocky ──
  {
    id: "resolution-drop",
    title: "Resolution Drop",
    description: "Reality pixelated.",
    set: "blocky",
    points: EPIC,
    hidden: true,
  },
  {
    id: "pixel-burst",
    title: "Pixel Burst",
    description: "Blocks scatter like fragments of a broken screen.",
    set: "blocky",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "8-bit-storm",
    title: "8-Bit Storm",
    description: "A retro tempest brews.",
    set: "blocky",
    points: RARE,
    hidden: true,
  },
  {
    id: "defrag",
    title: "Defrag",
    description: "Resolution restored.",
    set: "blocky",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "voxel-master",
    title: "Voxel Master",
    description: "Every block accounted for.",
    set: "blocky",
    points: LEGENDARY,
    hidden: true,
  },

  // ── Rainy ──
  {
    id: "first-drop",
    title: "First Drop",
    description: "The clouds opened.",
    set: "rainy",
    points: EPIC,
    hidden: true,
  },
  {
    id: "puddle-jump",
    title: "Puddle Jump",
    description: "Splashes follow your steps.",
    set: "rainy",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "thunder-roll",
    title: "Thunder Roll",
    description: "The sky rumbles and flashes.",
    set: "rainy",
    points: RARE,
    hidden: true,
  },
  {
    id: "rainbow",
    title: "Rainbow",
    description: "The storm breaks.",
    set: "rainy",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "storm-chaser",
    title: "Storm Chaser",
    description: "You danced through every drop.",
    set: "rainy",
    points: LEGENDARY,
    hidden: true,
  },

  // ── Upside Down ──
  {
    id: "the-flip",
    title: "The Flip",
    description: "The world inverted.",
    set: "upside-down",
    points: EPIC,
    hidden: true,
  },
  {
    id: "disoriented",
    title: "Disoriented",
    description: "Everything is wrong and you like it.",
    set: "upside-down",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "rift-walker",
    title: "Rift Walker",
    description: "You move through the inverted world with purpose.",
    set: "upside-down",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "boundary-break",
    title: "Boundary Break",
    description: "The wall between worlds is thin here.",
    set: "upside-down",
    points: RARE,
    hidden: true,
  },
  {
    id: "restoration",
    title: "Restoration",
    description: "The world rights itself.",
    set: "upside-down",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "world-turner",
    title: "World Turner",
    description: "Both sides of reality explored.",
    set: "upside-down",
    points: LEGENDARY,
    hidden: true,
  },

  // ── Meta / Milestones ──
  {
    id: "curious-mind",
    title: "Curious Mind",
    description: "Five discoveries and counting.",
    set: "meta",
    points: UNCOMMON,
    hidden: false,
  },
  {
    id: "dedicated",
    title: "Dedicated",
    description: "You're not stopping, are you?",
    set: "meta",
    points: RARE,
    hidden: true,
  },
  {
    id: "completionist",
    title: "Completionist",
    description: "The sky holds no more secrets.",
    set: "meta",
    points: LEGENDARY,
    hidden: true,
  },
  {
    id: "mode-hopper",
    title: "Mode Hopper",
    description: "A different sky every time.",
    set: "meta",
    points: EPIC,
    hidden: true,
  },
  {
    id: "hundred-club",
    title: "Hundred Club",
    description: "Triple digits.",
    set: "meta",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "five-hundred",
    title: "Five Hundred",
    description: "Halfway to mastery.",
    set: "meta",
    points: RARE,
    hidden: true,
  },
];

// ── Lookup helpers ──

const _byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id) {
  return _byId.get(id) || null;
}

/**
 * Sum point values for a list of unlocked entries [{id, ts}, ...].
 * Lives here so both tracker and UI can use it without duplication.
 */
export function sumPoints(unlockedList) {
  let pts = 0;
  for (const u of unlockedList) {
    const a = _byId.get(u.id);
    if (a) pts += a.points;
  }
  return pts;
}

// Mode set IDs for "unlock all in set" meta-achievements
const MODE_SETS = ["deep-sea", "frozen", "blocky", "rainy", "upside-down"];

// Map from mode set id to its "unlock all" achievement id
export const SET_MASTERY_MAP = {
  "deep-sea": "abyssal-explorer",
  frozen: "glacial-mastery",
  blocky: "voxel-master",
  rainy: "storm-chaser",
  "upside-down": "world-turner",
};

/**
 * Get all non-mastery achievements for a mode set.
 * Used to check if all prerequisite achievements are unlocked.
 */
export function getSetPrereqs(setId) {
  const masteryId = SET_MASTERY_MAP[setId];
  return ACHIEVEMENTS.filter((a) => a.set === setId && a.id !== masteryId).map(
    (a) => a.id,
  );
}

/**
 * Get all non-meta achievement IDs (for completionist check).
 */
export function getAllNonMeta() {
  return ACHIEVEMENTS.filter((a) => a.set !== "meta").map((a) => a.id);
}

/**
 * Check if a set is a mode set (has mode-specific achievements).
 */
export function isModeSet(setId) {
  return MODE_SETS.includes(setId);
}
