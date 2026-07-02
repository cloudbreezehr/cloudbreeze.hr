// Vitest configuration.
//
// `happy-dom` gives us a lightweight Window + DOM for the modules that touch
// document.body / localStorage / matchMedia.  Pure-function tests work fine in
// that environment too, so we use it globally rather than per-file.
//
// Tests live in `tests/` to keep the site's distributed /js tree untouched —
// no build step on the production side cares about a co-located spec file.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.js"],
    // Repairs Web Storage on Node ≥25, where an inert built-in global
    // shadows happy-dom's Storage (see the shim's header).
    setupFiles: ["tests/setup/webstorage.js"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
