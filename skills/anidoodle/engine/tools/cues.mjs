#!/usr/bin/env node
// CUES. Writes a film's cue sheet (src/canvas-core/cues.ts: withCues) as JSON from the film's own
// source and time maps, so the sound mix never reads a hand-copied timing file again.
//   node tools/cues.mjs <film> [--out out/<film>.cues.json] [--check out/<film>.cues.json]
// --check: exit 1 when the film's cues moved since that sheet was written (the mix built from it is
// out of date: rebuild it). A film with no cue sheet exits 2 with how to declare one, never a quiet pass.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { isMain } from "./is-main.mjs";
import { loadFilmModule } from "./audio.mjs";

// fileURLToPath, never URL.pathname: a space in the path stays a space and a Windows drive stays C:\
export const loadCues = async () => { const r = await build({ stdin: { contents: `export * from "./src/canvas-core/cues";`, resolveDir: join(dirname(fileURLToPath(import.meta.url)), ".."), loader: "ts" }, bundle: true, write: false, format: "esm", platform: "neutral", logLevel: "error" }); return import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64")); };

/** The sheet as written to disk: the film, its frame rate and length, and every cue. */
export const exportCues = async (name) => {
  const { film } = await loadFilmModule(name);
  if (!Array.isArray(film.cues) || !film.cues.length) throw Object.assign(new Error(`${name} declares no cues. Wrap the film: export const ${name} = withCues(film, [{ name: "x-lock", at: { scene: 22, through: [master] } }, ...]) (src/canvas-core/cues.ts). Sound and sync are cued from these, never from a hand-copied timing file.`), { code: 2 });
  // a launch template film's cues are sound cues with no name and no time: sheetCues names and times them
  // (written raw, the print below crashed on c.t.toFixed and --check saw every cue as one)
  const { sheetCues } = await loadCues();
  return { film: name, fps: film.meta.fps, durationFrames: film.meta.durationFrames, durationS: +(film.meta.durationFrames / film.meta.fps).toFixed(4), cues: sheetCues(film.cues, film.meta.fps) };
};

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2), name = argv.find((a, i) => !a.startsWith("--") && !["--out", "--check"].includes(argv[i - 1]));
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  if (!name) { console.error("usage: node tools/cues.mjs <film> [--out out/<film>.cues.json] [--check old.cues.json]"); process.exit(2); }
  try {
    const sheet = await exportCues(name);
    if (opt("--check")) {
      const f = resolve(opt("--check")); if (!existsSync(f)) { console.error(`cues: no sheet at ${f}`); process.exit(2); }
      const { diffSheets } = await loadCues(), d = diffSheets(JSON.parse(readFileSync(f, "utf8")), sheet);
      if (d.length) { console.log(`CUES  ${name}: the sheet ${opt("--check")} is out of date, so is any mix built from it:`); for (const x of d) console.log(`  ${x}`); console.log(`fix: node tools/cues.mjs ${name} --out ${opt("--check")} and rebuild the mix (node tools/track.mjs mix ...)\nVERDICT: FAIL`); process.exit(1); }
      console.log(`CUES  ${name}: ${sheet.cues.length} cues match ${opt("--check")}\nVERDICT: PASS`); process.exit(0);
    }
    const out = resolve(opt("--out") ?? `out/${name}.cues.json`); mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(sheet, null, 1) + "\n");
    console.log(`CUES  ${name}: ${sheet.cues.length} cues over ${sheet.durationS} s -> ${out}`);
    for (const c of sheet.cues) console.log(`  ${String(c.frame).padStart(6)}  ${c.t.toFixed(3).padStart(8)} s  ${c.name.padEnd(24)} ${c.sound ?? ""}${c.sync ? "  (sync marker)" : ""}`);
  } catch (e) { console.error(`cues: ${e.message}`); process.exit(e.code === 2 ? 2 : 2); }
}
