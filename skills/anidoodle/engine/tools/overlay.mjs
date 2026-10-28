// OVERLAY. The engine's src/ and the worked example's example/src/ are ONE tree at build time,
// exactly as scaffold.mjs --example lays them out on disk: a relative import that is not found
// next to its importer is looked for at the same relative place under the other root. The
// example keeps importing "../core"; a launch film can import "./mechanicalLepidoptera" and get
// the committed example. Order matters: engine/src first, so the engine always wins a name clash.
// tsconfig.json says the same thing to tsc with "rootDirs", so the checker and the bundler agree.
import { existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ENGINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ROOTS = [join(ENGINE, "src"), resolve(ENGINE, "../example/src")];
const EXT = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"];
const file = (p) => { for (const e of EXT) { const f = p + e; if (existsSync(f) && statSync(f).isFile()) return f; } return null; };
const rootOf = (p) => ROOTS.find((r) => p === r || p.startsWith(r + sep));

// Resolve a relative specifier asked from directory `dir` across the roots; null when it is not
// ours to answer. `dir` may sit outside the roots (a probe's stdin resolves from engine/).
export const resolveOverlay = (spec, dir) => {
  const want = resolve(dir, spec), root = rootOf(want); if (!root) return null;
  if (file(want)) return null; // found where it was asked for: esbuild's own resolver handles it
  const rel = relative(root, want);
  if (rel.startsWith("..")) return null; // left the tree: not an overlay question
  for (const r of ROOTS) { if (r === root) continue; const f = file(join(r, rel)); if (f) return f; }
  return null;
};

// THREE. A film imports "three" by its bare name and gets the vendored, hash-pinned build
// (vendor/three/PROVENANCE.md): no npm package, no network, the same bytes on every machine.
export const THREE_MODULE = join(ENGINE, "vendor/three/three.module.js");
export const overlay = {
  name: "anidoodle-overlay",
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: THREE_MODULE }));
    b.onResolve({ filter: /^\.\.?\// }, (a) => {
      const f = resolveOverlay(a.path, a.resolveDir);
      return f ? { path: f } : undefined;
    });
  },
};
