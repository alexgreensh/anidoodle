// THE STANDARD HOST PAGE. A film with no src/hosts/page-<film>.ts of its own is still a known film and builds
// with the standard page (import it, mountFilm), so the installed plugin can leave those identical files out.
const proc = (globalThis as any).process;
const { standardHost, filmModule, knownFilms } = await import(`file://${proc.cwd()}/tools/names.mjs`);

export const name = "a film without its own host page builds with the standard one";
export function run(ok: (cond: boolean, label: string) => void) {
  ok(standardHost("koi") === 'import { koi } from "../canvas-core/koi";\nimport { mountFilm } from "./page";\n\nmountFilm(koi);\n', "the standard page is the four lines every plain host has");
  ok(typeof filmModule("koi") === "string" && filmModule("koi").endsWith("canvas-core/koi.ts"), "koi's module is found by its name");
  ok(filmModule("koi-9x16") === filmModule("koi"), "a shape suffix finds the same module");
  ok(filmModule("core") === undefined, "NEGATIVE: a module that does not export a Film under its own name is not a film");
  ok(filmModule("noSuchFilm") === undefined, "NEGATIVE: an unknown name is not a film");
  const k = knownFilms();
  ok(k.includes("koi") && k.includes("launchExampleBrand"), "known films include films with and without a host page file");
  ok(!k.includes("core") && !k.includes("film"), "NEGATIVE: helper modules are not listed as films");
}
