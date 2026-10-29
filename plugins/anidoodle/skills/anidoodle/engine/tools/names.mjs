// Names shared by the tools: where a film's MP4 lands by default, and which films exist.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOTS } from "./overlay.mjs";

export const defaultOutput = (film) => `out/${film}.mp4`;

// A film in another frame shape: <film>-<shape> (launchExample-9x16). The host page is the film's own;
// the page reshapes the film (film.reshape, which a launch template film has). One timeline, many shapes.
export const SHAPE_NAMES = ["16x9", "1x1", "4x5", "9x16"];
export const splitShape = (film) => { const m = /^(.+)-(16x9|1x1|4x5|9x16)$/.exec(film ?? ""); return m ? { base: m[1], shape: m[2] } : { base: film, shape: null }; };

// THE STANDARD HOST PAGE. Most films need nothing but "import the film, mount it". A film with no host page
// of its own gets exactly that page, built in memory (build-page.mjs): the installed plugin leaves those
// identical pages out to stay under the plugin directory's 512-file limit. A film that needs more (fixtures,
// a social card) keeps its own src/hosts/page-<film>.ts, which always wins.
export const standardHost = (name) => `import { ${name} } from "../canvas-core/${name}";\nimport { mountFilm } from "./page";\n\nmountFilm(${name});\n`;
const SRC_ROOTS = () => [join(process.cwd(), "src"), ...ROOTS];
const exportsFilm = (file, name) => new RegExp(`export\\s+const\\s+${name.replace(/\$/g, "\\$")}\\s*:\\s*Film\\b`).test(readFileSync(file, "utf8"));
/** The module that exports <film> as a Film under the same name (src/canvas-core/<film>.ts), or undefined. */
export const filmModule = (film) => { const b = splitShape(film).base; return SRC_ROOTS().map((r) => join(r, "canvas-core", `${b}.ts`)).find((f) => existsSync(f) && exportsFilm(f, b)); };
/** Every film this project can build: one with a host page src/hosts/page-<film>.ts, or a module that exports a Film under its own name. */
export const knownFilms = () => [...new Set(SRC_ROOTS().flatMap((r) => {
  const h = join(r, "hosts"), c = join(r, "canvas-core");
  const hosts = existsSync(h) ? readdirSync(h).filter((f) => /^page-.+\.ts$/.test(f)).map((f) => f.slice(5, -3)) : [];
  const mods = existsSync(c) ? readdirSync(c).filter((f) => /^[A-Za-z_$][\w$]*\.ts$/.test(f)).map((f) => f.slice(0, -3)).filter((n) => exportsFilm(join(c, `${n}.ts`), n)) : [];
  return [...hosts, ...mods];
}))].sort();
const hostOf = (film) => SRC_ROOTS().map((r) => join(r, "hosts", `page-${splitShape(film).base}.ts`)).find((f) => existsSync(f)) ?? filmModule(film);

/** The film named on the command line, or a clear exit: the usage when none is given, the known films when it is not one. */
export const requireFilm = (film, tool, usage) => {
  const list = () => { const k = knownFilms(); return `known films (${k.length}): ${k.join(", ")}`; };
  if (!film || film.startsWith("--")) { console.error(`usage: ${usage}\n${list()}`); process.exit(2); }
  if (!/^[A-Za-z_$][\w$]*$/.test(splitShape(film).base) || !hostOf(film)) {
    const path = /[\\/.]/.test(film) ? `: '${film}' looks like a file path; ${tool} takes a film name (the module src/canvas-core/<film>.ts with its host page src/hosts/page-<film>.ts)` : `: no host page src/hosts/page-${film}.ts`;
    console.error(`${tool}: unknown film '${film}'${path}\n${list()}`); process.exit(2);
  }
  return film;
};
