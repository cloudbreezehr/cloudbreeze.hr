import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// The stylesheet is split into partials, each loaded by its own <link> in
// index.html, with no build step. Link order is the cascade (see css/README.md),
// so the real risk isn't order — it's a partial that exists on disk but was
// never linked (silently dead), or a <link> pointing at a file that's gone
// (dangling). This guards both: every css/ partial except css/dev/ must be
// referenced by exactly one stylesheet <link>, and every link must resolve.

// Vitest runs from the repo root (no `root` override in vitest.config.mjs).
const root = process.cwd();

// Every .css path under css/, relative to repo root, excluding css/dev/
// (loaded dynamically by JS, never via index.html). Forward slashes so the
// paths compare directly against the href values in index.html.
function collectPartials(rel = "css", out = []) {
  for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
    const childRel = `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      if (childRel === "css/dev") continue;
      collectPartials(childRel, out);
    } else if (entry.name.endsWith(".css")) {
      out.push(childRel);
    }
  }
  return out;
}

// Stylesheet <link> hrefs that point at a local css/ file.
function linkedPartials() {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const hrefs = [];
  const re = /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="(css\/[^"]+\.css)"/g;
  let m;
  while ((m = re.exec(html)) !== null) hrefs.push(m[1]);
  return hrefs;
}

describe("css manifest", () => {
  it("links every css/ partial exactly once (no orphans, no duplicates)", () => {
    const onDisk = collectPartials().sort();
    const linked = linkedPartials();

    const dupes = linked.filter((h, i) => linked.indexOf(h) !== i);
    expect(dupes).toEqual([]);

    expect([...linked].sort()).toEqual(onDisk);
  });

  it("every linked stylesheet resolves to a file on disk", () => {
    const onDisk = new Set(collectPartials());
    for (const href of linkedPartials()) {
      expect(onDisk.has(href), `missing file for <link>: ${href}`).toBe(true);
    }
  });
});
