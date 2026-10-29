// OVERLAY. The engine's src/ and the worked example's example/src/ are ONE tree at build time,
// exactly as scaffold.mjs --example lays them out on disk: a relative import that is not found
// next to its importer is looked for at the same relative place under the other root. The
// example keeps importing "../core"; a launch film can import "./mechanicalLepidoptera" and get
// the committed example. Order matters: engine/src first, so the engine always wins a name clash.
// tsconfig.json says the same thing to tsc with "rootDirs", so the checker and the bundler agree.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ENGINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// A LINKED PROJECT (scaffold.mjs --linked): a folder of its own films that runs the installed engine's
// tools from its own working directory. Its src/ joins the tree first, so a project film's "./core"
// resolves to the engine's and a project never needs a copy of the engine (a brand launch film was
// built in a forked engine for exactly this reason). When cwd is the engine itself nothing changes.
// A folder counts as a linked project only when it carries the marker scaffold --linked writes: any other
// repo run from (one with its own src/hosts/page.ts, say) must never replace the engine's files.
export const PROJECT_MARKER = "anidoodle-project.json";
const PROJECT = resolve(process.cwd(), "src"), LINKED = PROJECT !== join(ENGINE, "src") && existsSync(PROJECT) && existsSync(resolve(process.cwd(), PROJECT_MARKER));
export const ROOTS = [...(LINKED ? [PROJECT] : []), join(ENGINE, "src"), resolve(ENGINE, "../example/src")];
/** An engine file by its path inside the engine (src/canvas-core/film.ts): a linked project's copy if it has one, else the engine's. */
export const enginePath = (rel) => (LINKED && existsSync(resolve(rel)) ? resolve(rel) : join(ENGINE, rel));
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
    // FONT FILES. A launch look imports its typefaces by path (import serif from "../../assets/fonts/X.ttf"):
    // the bytes are inlined as { path, format, data } so the film carries them and nothing is fetched. A path
    // that is not there is a build error that says where to put the file.
    b.onResolve({ filter: /\.(ttf|otf|woff2)$/i }, (a) => {
      const want = resolve(a.resolveDir, a.path), f = existsSync(want) ? want : resolveOverlay(a.path, a.resolveDir);
      if (!f) return { errors: [{ text: `font file not found: ${a.path} (looked for ${want}). Put the font file (.ttf) there, or fix the import's path; the engine's own fonts are in engine/assets/fonts` }] };
      return { path: f, namespace: "anidoodle-font" };
    });
    b.onLoad({ filter: /.*/, namespace: "anidoodle-font" }, (a) => {
      const format = a.path.toLowerCase().split(".").pop(), rel = relative(ENGINE, a.path).split(sep).join("/");
      return { contents: `export default ${JSON.stringify({ path: rel, format, data: readFileSync(a.path).toString("base64") })};`, loader: "js" };
    });
    b.onResolve({ filter: /^\.\.?\// }, (a) => {
      const f = resolveOverlay(a.path, a.resolveDir);
      return f ? { path: f } : undefined;
    });
  },
};
