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
  // ── Exploration: Cloudlog ──
  {
    id: "cloudlog-activated",
    title: "Cloudlog Activated",
    description: "You found the hidden logbook.",
    hint: "Triple-click anywhere on the page",
    set: "exploration",
    points: UNCOMMON,
    hidden: false,
  },
  {
    id: "cloud-reader",
    title: "Cloud Reader",
    description: "The first page turns.",
    hint: "Open the Cloudlog panel",
    set: "exploration",
    points: COMMON,
    hidden: false,
  },
  {
    id: "time-warp",
    title: "Time Warp",
    description: "Time stands still when you look closely.",
    hint: "Click a relative timestamp to see absolute time",
    set: "exploration",
    points: COMMON,
    hidden: true,
  },
  {
    id: "shortcut-master",
    title: "Shortcut Master",
    description: "You found the quick way in.",
    hint: "Open the Cloudlog with a keyboard shortcut",
    set: "exploration",
    points: COMMON,
    hidden: true,
  },
  // ── Exploration: Interaction ──
  {
    id: "first-light",
    title: "First Light",
    description: "A ripple in the stillness.",
    hint: "Click anywhere on the canvas",
    set: "exploration",
    points: TRIVIAL,
    hidden: false,
  },
  {
    id: "spark",
    title: "Spark",
    description: "Something stirs where you touched.",
    hint: "Click to create a particle burst",
    set: "exploration",
    points: COMMON,
    hidden: true,
  },
  {
    id: "trail-blazer",
    title: "Trail Blazer",
    description: "You leave a mark wherever you go.",
    hint: "Click and drag across the canvas",
    set: "exploration",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "the-long-drag",
    title: "The Long Drag",
    description: "A trail across the sky.",
    hint: "Drag across 40% of the screen in one motion",
    set: "exploration",
    points: UNCOMMON,
    hidden: true,
  },
  // ── Exploration: Scroll ──
  {
    id: "stargazer",
    title: "Stargazer",
    description: "The sky responds to your gaze.",
    hint: "Scroll past 25% of the page",
    set: "exploration",
    points: COMMON,
    hidden: false,
  },
  {
    id: "down-to-earth",
    title: "Down to Earth",
    description: "You've seen it all — from stars to horizon.",
    hint: "Scroll to the bottom of the page",
    set: "exploration",
    points: COMMON,
    hidden: false,
  },
  {
    id: "zenith",
    title: "Zenith",
    description: "The journey there and back again.",
    hint: "Scroll to the bottom, then back to the top",
    set: "exploration",
    points: COMMON,
    hidden: false,
  },
  {
    id: "scroll-surge",
    title: "Scroll Surge",
    description: "The page blurs past.",
    hint: "Scroll fast enough to blur the particles",
    set: "exploration",
    points: UNCOMMON,
    hidden: true,
  },
  // ── Exploration: Theme ──
  {
    id: "daybreak",
    title: "Daybreak",
    description: "Light breaks through.",
    hint: "Switch to light mode",
    set: "exploration",
    points: TRIVIAL,
    hidden: false,
  },
  {
    id: "nightfall",
    title: "Nightfall",
    description: "The sky darkens at your command.",
    hint: "Switch to dark mode",
    set: "exploration",
    points: TRIVIAL,
    hidden: false,
  },
  {
    id: "dusk-and-dawn",
    title: "Dusk and Dawn",
    description: "You've seen both sides of the sky.",
    hint: "Toggle the theme at least 3 times",
    set: "exploration",
    points: UNCOMMON,
    hidden: false,
  },
  {
    id: "full-spectrum",
    title: "Full Spectrum",
    description: "Every shade of sky, sampled.",
    hint: "Use dark, light, and auto theme modes",
    set: "exploration",
    points: UNCOMMON,
    hidden: false,
  },
  // ── Exploration: Social ──
  {
    id: "landfall",
    title: "Landfall",
    description: "A message sent into the cloud.",
    hint: "Click the email contact link",
    set: "exploration",
    points: COMMON,
    hidden: false,
  },
  {
    id: "connected",
    title: "Connected",
    description: "You found us out there.",
    hint: "Click the LinkedIn link",
    set: "exploration",
    points: COMMON,
    hidden: false,
  },
  // ── Exploration: Time ──
  {
    id: "moonlit",
    title: "Moonlit",
    description: "The sky is different at night.",
    hint: "Visit the site between midnight and 5 AM",
    set: "exploration",
    points: UNCOMMON,
    hidden: true,
  },
  // ── Exploration: Dev ──
  {
    id: "reverse-engineer",
    title: "Reverse Engineer",
    description: "Behind the curtain.",
    hint: "Open the developer console",
    set: "exploration",
    points: RARE,
    hidden: true,
  },

  // ── Mastery: Hold / Gravity Progression ──
  {
    id: "gathering-storm",
    title: "Gathering Storm",
    description: "The particles sense your presence.",
    hint: "Hold click until particles begin to gather",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "eye-of-the-storm",
    title: "Eye of the Storm",
    description: "Everything orbits around you now.",
    hint: "Hold click until a full orbit forms",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  {
    id: "orbit-lock",
    title: "Orbit Lock",
    description: "They circle endlessly.",
    hint: "Hold click until particles lock into orbit",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "event-horizon",
    title: "Event Horizon",
    description: "A well opened in the fabric of the sky.",
    hint: "Hold click long enough to open a gravity well",
    set: "mastery",
    points: EPIC,
    hidden: true,
  },
  {
    id: "singularity",
    title: "Singularity",
    description: "The well consumed everything in its reach.",
    hint: "Fill the gravity well to maximum strength",
    set: "mastery",
    points: LEGENDARY,
    hidden: true,
  },
  {
    id: "void-caller",
    title: "Void Caller",
    description: "The well opens again.",
    hint: "Open the gravity well 3 times in one session",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  // ── Mastery: Fury ──
  {
    id: "fury-unleashed",
    title: "Fury Unleashed",
    description: "Lightning answered your call.",
    hint: "Trigger a lightning strike",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "northern-lights",
    title: "Northern Lights",
    description: "The aurora ripples above.",
    hint: "Trigger the aurora effect",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  {
    id: "chain-lightning",
    title: "Chain Lightning",
    description: "The sky won't stop flashing.",
    hint: "Trigger lightning 5 times in one session",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  {
    id: "aftershock",
    title: "Aftershock",
    description: "The click echoes.",
    hint: "Click within 2 seconds of a lightning strike",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  // ── Mastery: Shake ──
  {
    id: "snow-globe",
    title: "Snow Globe",
    description: "You shook the sky.",
    hint: "Rapidly reverse scroll direction",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  // ── Mastery: Click Skill ──
  {
    id: "rapid-fire",
    title: "Rapid Fire",
    description: "A flurry of sparks.",
    hint: "Click 10 times within 3 seconds",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "cartographer",
    title: "Cartographer",
    description: "Every corner explored.",
    hint: "Click in all four quadrants of the screen",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "pixel-perfect",
    title: "Pixel Perfect",
    description: "Bullseye.",
    hint: "Click the exact center of the viewport",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  // ── Mastery: Time / Dedication ──
  {
    id: "idle-hands",
    title: "Idle Hands",
    description: "The cursor stirs on its own.",
    hint: "Leave the cursor idle long enough to see it animate",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "idle-watcher",
    title: "Idle Watcher",
    description: "Every idle animation, witnessed.",
    hint: "See all cursor idle animations",
    set: "mastery",
    points: RARE,
    hidden: true,
    progressKey: "idle-animations",
  },
  {
    id: "night-owl",
    title: "Night Owl",
    description: "Still here? The sky notices.",
    hint: "Stay on the page for 10 minutes",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "persistent-explorer",
    title: "Persistent Explorer",
    description: "You keep coming back.",
    hint: "Visit the site on 3 different days",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  {
    id: "elemental",
    title: "Elemental",
    description: "Every sky, one session.",
    hint: "Activate all 5 modes in a single session",
    set: "mastery",
    points: EPIC,
    hidden: true,
  },

  // ── Deep Sea ──
  {
    id: "the-depths",
    title: "The Depths",
    description: "You sank beneath the surface.",
    hint: "Activate deep-sea mode",
    set: "deep-sea",
    points: EPIC,
    hidden: true,
  },
  {
    id: "bioluminescent",
    title: "Bioluminescent",
    description: "Life glows in the darkness below.",
    hint: "Click anywhere in deep-sea mode",
    set: "deep-sea",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "jellyfish-drift",
    title: "Jellyfish Drift",
    description: "They pulse with ancient rhythm.",
    hint: "Watch 5 jellyfish complete their pulse",
    set: "deep-sea",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "pressure-drop",
    title: "Pressure Drop",
    description: "The ocean floor trembles.",
    hint: "Open a gravity well in deep-sea mode",
    set: "deep-sea",
    points: RARE,
    hidden: true,
  },
  {
    id: "resurface",
    title: "Resurface",
    description: "You clawed your way back to the light.",
    hint: "Leave deep-sea mode",
    set: "deep-sea",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "deep-orbit",
    title: "Deep Orbit",
    description: "They spiral in the current.",
    hint: "Lock particles into orbit in deep-sea mode",
    set: "deep-sea",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "storm-surge",
    title: "Storm Surge",
    description: "Thunder in the deep.",
    hint: "Trigger lightning in deep-sea mode",
    set: "deep-sea",
    points: RARE,
    hidden: true,
  },
  {
    id: "permafrost",
    title: "Permafrost",
    description: "The ocean freezes.",
    hint: "Shake the sky in deep-sea mode",
    set: "deep-sea",
    points: RARE,
    hidden: true,
  },
  {
    id: "abyssal-explorer",
    title: "Abyssal Explorer",
    description: "The deep sea holds no more secrets.",
    hint: "Unlock all other deep-sea achievements",
    set: "deep-sea",
    points: LEGENDARY,
    hidden: true,
  },

  // ── Frozen ──
  {
    id: "first-frost",
    title: "First Frost",
    description: "The air turned cold.",
    hint: "Activate frozen mode",
    set: "frozen",
    points: EPIC,
    hidden: true,
  },
  {
    id: "frost-breath",
    title: "Frost Breath",
    description: "Your breath crystallizes in the chill.",
    hint: "Exhale frost in frozen mode",
    set: "frozen",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "snowdrift",
    title: "Snowdrift",
    description: "The flakes obey the wind.",
    hint: "Drag through the snow in frozen mode",
    set: "frozen",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "blizzard",
    title: "Blizzard",
    description: "A whiteout engulfs the sky.",
    hint: "Shake the sky in frozen mode",
    set: "frozen",
    points: RARE,
    hidden: true,
  },
  {
    id: "thaw",
    title: "Thaw",
    description: "The ice recedes.",
    hint: "Leave frozen mode",
    set: "frozen",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "frozen-lightning",
    title: "Frozen Lightning",
    description: "Ice and fire.",
    hint: "Trigger lightning in frozen mode",
    set: "frozen",
    points: RARE,
    hidden: true,
  },
  {
    id: "glacial-mastery",
    title: "Glacial Mastery",
    description: "The frozen sky bends to your will.",
    hint: "Unlock all other frozen achievements",
    set: "frozen",
    points: LEGENDARY,
    hidden: true,
  },

  // ── Blocky ──
  {
    id: "resolution-drop",
    title: "Resolution Drop",
    description: "Reality pixelated.",
    hint: "Activate blocky mode",
    set: "blocky",
    points: EPIC,
    hidden: true,
  },
  {
    id: "pixel-burst",
    title: "Pixel Burst",
    description: "Blocks scatter like fragments of a broken screen.",
    hint: "Click anywhere in blocky mode",
    set: "blocky",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "8-bit-storm",
    title: "8-Bit Storm",
    description: "A retro tempest brews.",
    hint: "Trigger lightning in blocky mode",
    set: "blocky",
    points: RARE,
    hidden: true,
  },
  {
    id: "defrag",
    title: "Defrag",
    description: "Resolution restored.",
    hint: "Leave blocky mode",
    set: "blocky",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "voxel-master",
    title: "Voxel Master",
    description: "Every block accounted for.",
    hint: "Unlock all other blocky achievements",
    set: "blocky",
    points: LEGENDARY,
    hidden: true,
  },

  // ── Rainy ──
  {
    id: "first-drop",
    title: "First Drop",
    description: "The clouds opened.",
    hint: "Activate rainy mode",
    set: "rainy",
    points: EPIC,
    hidden: true,
  },
  {
    id: "puddle-jump",
    title: "Puddle Jump",
    description: "Splashes follow your steps.",
    hint: "Click anywhere in rainy mode",
    set: "rainy",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "thunder-roll",
    title: "Thunder Roll",
    description: "The sky rumbles and flashes.",
    hint: "Trigger lightning in rainy mode",
    set: "rainy",
    points: RARE,
    hidden: true,
  },
  {
    id: "rainbow",
    title: "Rainbow",
    description: "The storm breaks.",
    hint: "Leave rainy mode",
    set: "rainy",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "monsoon",
    title: "Monsoon",
    description: "The rain has weight now.",
    hint: "Open a gravity well in rainy mode",
    set: "rainy",
    points: RARE,
    hidden: true,
  },
  {
    id: "storm-chaser",
    title: "Storm Chaser",
    description: "You danced through every drop.",
    hint: "Unlock all other rainy achievements",
    set: "rainy",
    points: LEGENDARY,
    hidden: true,
  },

  // ── Upside Down ──
  {
    id: "the-flip",
    title: "The Flip",
    description: "The world inverted.",
    hint: "Activate upside-down mode",
    set: "upside-down",
    points: EPIC,
    hidden: true,
  },
  {
    id: "disoriented",
    title: "Disoriented",
    description: "Everything is wrong and you like it.",
    hint: "Scroll to the bottom while upside-down",
    set: "upside-down",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "rift-walker",
    title: "Rift Walker",
    description: "You move through the inverted world with purpose.",
    hint: "Click anywhere in upside-down mode",
    set: "upside-down",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "boundary-break",
    title: "Boundary Break",
    description: "The wall between worlds is thin here.",
    hint: "Reach the tipping point for upside-down mode",
    set: "upside-down",
    points: RARE,
    hidden: true,
  },
  {
    id: "restoration",
    title: "Restoration",
    description: "The world rights itself.",
    hint: "Leave upside-down mode",
    set: "upside-down",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "vertigo",
    title: "Vertigo",
    description: "Rapid fire, wrong side up.",
    hint: "Rapid-fire click 10 times while upside-down",
    set: "upside-down",
    points: RARE,
    hidden: true,
  },
  {
    id: "glitch",
    title: "Glitch",
    description: "Reality errors in the rift.",
    hint: "Trigger lightning in upside-down mode",
    set: "upside-down",
    points: RARE,
    hidden: true,
  },
  {
    id: "world-turner",
    title: "World Turner",
    description: "Both sides of reality explored.",
    hint: "Unlock all other upside-down achievements",
    set: "upside-down",
    points: LEGENDARY,
    hidden: true,
  },

  // ── Meta / Milestones ──
  {
    id: "curious-mind",
    title: "Curious Mind",
    description: "Five discoveries and counting.",
    hint: "Unlock 5 achievements",
    set: "meta",
    points: UNCOMMON,
    hidden: false,
  },
  {
    id: "dedicated",
    title: "Dedicated",
    description: "You're not stopping, are you?",
    hint: "Unlock 15 achievements",
    set: "meta",
    points: RARE,
    hidden: true,
  },
  {
    id: "completionist",
    title: "Completionist",
    description: "The sky holds no more secrets.",
    hint: "Unlock every non-milestone achievement",
    set: "meta",
    points: LEGENDARY,
    hidden: true,
  },
  {
    id: "mode-hopper",
    title: "Mode Hopper",
    description: "A different sky every time.",
    hint: "Activate 3 different modes in one session",
    set: "meta",
    points: EPIC,
    hidden: true,
  },
  {
    id: "hundred-club",
    title: "Hundred Club",
    description: "Triple digits.",
    hint: "Reach 100 total points",
    set: "meta",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "five-hundred",
    title: "Five Hundred",
    description: "Halfway to mastery.",
    hint: "Reach 500 total points",
    set: "meta",
    points: RARE,
    hidden: true,
  },
  {
    id: "thousand-club",
    title: "Thousand Club",
    description: "Four digits.",
    hint: "Reach 1,000 total points",
    set: "meta",
    points: EPIC,
    hidden: true,
  },
  {
    id: "tenacious",
    title: "Tenacious",
    description: "Seven days, still drawn to the sky.",
    hint: "Visit the site on 7 different days",
    set: "meta",
    points: EPIC,
    hidden: true,
  },
  {
    id: "halfway-there",
    title: "Halfway There",
    description: "Half the sky explored.",
    hint: "Unlock half of all non-milestone achievements",
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

/**
 * Return all achievements that track progressive (cumulative) progress.
 */
export function getProgressiveAchievements() {
  return ACHIEVEMENTS.filter((a) => a.progressKey);
}
