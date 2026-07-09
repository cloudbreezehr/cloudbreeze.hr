// Every module under js/ must parse and evaluate. In production a broken
// module can die silently — bootstrap loads features via dynamic import()
// and catches the rejection so one bad module doesn't take the site down —
// which means the test suite is the only place a SyntaxError gets loud.
//
// Boot entry points run their side effects at import time against the real
// document (they are the app's <script type="module"> roots), so they're
// exercised on every real page load and excluded here.
import { describe, it } from "vitest";

const BOOT_ENTRIES = [
  /\/critical-boot\.js$/,
  /\/canvas-boot\.js$/,
  /\/bootstrap\.js$/,
  /\/appearance-boot\.js$/,
];

const modules = import.meta.glob("../../js/**/*.js");

describe("module smoke", () => {
  for (const [path, load] of Object.entries(modules)) {
    if (BOOT_ENTRIES.some((re) => re.test(path))) continue;
    const name = path.replace("../../", "");
    it(`imports ${name}`, async () => {
      await load();
    });
  }
});
