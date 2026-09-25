// GALLERY. The style sheet, drawn by the styles themselves: one tile per style, the LAST frame
// of its draw film — the finished piece every draw-on plate holds, and the whole of a still —
// rendered through the same machinery as still.mjs at scale 1. Tiles are labelled only when
// ffmpeg can set text in a system font; when it cannot, the names go in a legend file, because a
// sheet of unnamed tiles is a guessing game.
//   node tools/gallery.mjs [--only id,id] [--dry]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPage } from "./build-page.mjs";
import { detect } from "./detect.mjs";
import * as playwright from "./adapters/playwright.mjs";
import { loadRegistry, ENGINE, ROOT } from "./registry.mjs";

process.chdir(ENGINE); // buildPage and the host pages resolve src/ against cwd, like every tool here
const GALLERY = resolve(ROOT, "assets/gallery");
const CELL = 520, LH = 64;

const VAL = new Set(["only"]);
const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = VAL.has(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
const die = (m) => { console.error(`gallery: ${m}`); process.exit(1); };

const entries = loadRegistry().filter((s) => s.drawFilm);
const only = opt.only ? String(opt.only).split(",").map((s) => s.trim()) : null;
if (only) { const bad = only.filter((id) => !entries.some((s) => s.id === id)); if (bad.length) die(`--only: no style with a film named ${bad.join(", ")} (have: ${entries.map((s) => s.id).join(", ")})`); }
const tiles = entries.filter((s) => !only || only.includes(s.id));
if (!tiles.length) die("no styles with a draw film");

// Labels need drawtext AND a font file we can name. This ffmpeg has drawbox but no drawtext, so
// on this machine the sheet falls back to the legend; a machine with freetype gets real labels.
const FONTS = ["/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"];
const findFont = (ff) => {
  try { if (!execFileSync(ff, ["-hide_banner", "-filters"], { stdio: ["ignore", "pipe", "ignore"] }).toString().includes("drawtext")) return { ok: false, why: "ffmpeg was built without drawtext (no libfreetype)" }; }
  catch { return { ok: false, why: "could not query ffmpeg's filters" }; }
  const font = FONTS.find((p) => existsSync(p));
  return font ? { ok: true, font } : { ok: false, why: "drawtext exists but no known system font file was found" };
};

// A still.mjs-style probe: bundle the film, read meta, no browser. Enough for --dry to say which
// frame is the last.
const metaOf = async (film) => (await import("data:text/javascript;base64," + Buffer.from((await (await import("esbuild")).build({ stdin: { contents: `export { ${film} as film } from "./src/canvas-core/${film}";`, resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "esm", write: false, platform: "neutral" })).outputFiles[0].text).toString("base64"))).film.meta;

const cols = Math.ceil(Math.sqrt(tiles.length)), rows = Math.ceil(tiles.length / cols);
const plan = (font) => `grid ${cols}x${rows} of ${CELL}px tiles, ${font.ok ? `labels in ${font.font}` : `no labels (${font.why}) -> LEGEND.md`}`;

if (opt.dry) {
  const font = findFont(process.env.FFMPEG || "ffmpeg");
  console.log(`gallery (dry): ${tiles.length} styles with a film -> ${GALLERY}`);
  for (const s of tiles) {
    const page = existsSync(join(ENGINE, "src/hosts", `page-${s.drawFilm}.ts`));
    const last = page ? String((await metaOf(s.drawFilm)).durationFrames - 1) : "?";
    console.log(`  ${s.id.padEnd(14)} film ${s.drawFilm.padEnd(18)} last frame ${last.padEnd(5)} -> assets/gallery/${s.id}.jpg${page ? "" : "  (no host page, would be skipped)"}`);
  }
  console.log(`  sheet: assets/gallery/styles.jpg   ${plan(font)}`);
  process.exit(0);
}

const env = detect();
if (!env.pw.ok || !env.browser.ok) die(`no browser to draw in.\n  playwright: ${env.report.playwright}\n  browser:    ${env.report.browser}\n  fix: npm install, then npx playwright-core install chromium`);
if (!env.ffmpeg.ok) die(`no ffmpeg for the sheet.\n  ${env.ffmpeg.why}`);
mkdirSync(GALLERY, { recursive: true });

const drawn = [];
for (const s of tiles) {
  if (!existsSync(join(ENGINE, "src/hosts", `page-${s.drawFilm}.ts`))) { console.log(`  ${s.id}: draw film '${s.drawFilm}' has no host page yet, skipped`); continue; }
  const page = await buildPage({ entry: `src/hosts/page-${s.drawFilm}.ts`, out: resolve(`dist/${s.drawFilm}.html`), title: s.drawFilm });
  const session = await playwright.open(env, page.out, { scale: 1, workers: 1 });
  const meta = await session.info(), last = meta.durationFrames - 1;
  const f = await session.frame(last, 0);
  await session.close();
  const jpg = join(GALLERY, `${s.id}.jpg`);
  execFileSync(env.ffmpeg.bin, ["-y", "-loglevel", "error", "-i", "pipe:0", "-frames:v", "1", "-q:v", "3", jpg], { input: f.png }); // mjpeg q3 ~= jpeg quality 88
  console.log(`  ${s.id.padEnd(14)} ${s.name.padEnd(32)} ${s.drawFilm} frame ${last}  draw ${f.drawMs.toFixed(0)} ms  -> ${jpg}`);
  drawn.push(s);
}
if (!drawn.length) die("nothing rendered");

const font = findFont(env.ffmpeg.bin), esc = (s) => s.replace(/[\\:',%]/g, "\\$&"), rowH = CELL + (font.ok ? LH : 0);
const inputs = [], parts = drawn.flatMap((s, i) => {
  inputs.push("-i", join(GALLERY, `${s.id}.jpg`));
  return font.ok
    ? [`[${i}:v]scale=${CELL}:${CELL},pad=${CELL}:${rowH}:0:0:color=0xf7f5f0,drawtext=fontfile='${esc(font.font)}':text='${esc(s.name)}':fontsize=22:fontcolor=0x1b1a1a:x=(w-text_w)/2:y=${CELL + 18},format=yuv420p[t${i}]`]
    : [`[${i}:v]scale=${CELL}:${CELL},format=yuv420p[t${i}]`];
});
const cells = cols * rows, ins = drawn.map((_, i) => `[t${i}]`);
for (let b = drawn.length; b < cells; b++) { inputs.push("-f", "lavfi", "-i", `color=c=0xf7f5f0:s=${CELL}x${rowH}`); parts.push(`[${b}:v]format=yuv420p[b${b}]`); ins.push(`[b${b}]`); }
const layout = Array.from({ length: cells }, (_, i) => `${(i % cols) * CELL}_${Math.floor(i / cols) * rowH}`).join("|");
const sheet = join(GALLERY, "styles.jpg");
execFileSync(env.ffmpeg.bin, [...inputs, "-y", "-loglevel", "error", "-filter_complex", `${parts.join(";")};${ins.join("")}xstack=inputs=${cells}:layout=${layout},format=yuv420p[out]`, "-map", "[out]", "-frames:v", "1", "-q:v", "3", sheet]);

if (!font.ok) writeFileSync(join(GALLERY, "LEGEND.md"), [
  "# Gallery legend", "",
  `ffmpeg here cannot draw text (${font.why}), so styles.jpg carries no labels.`,
  `Grid is ${cols} across and ${rows} down, in reading order:`, "",
  ...drawn.map((s, i) => `${i + 1}. **${s.name}** (\`${s.id}\`) — assets/gallery/${s.id}.jpg`), "",
].join("\n"));
console.log(`\nsheet: ${sheet}  ${drawn.length} tiles, ${plan(font)}`);
