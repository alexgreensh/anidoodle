// node tools/worldfilm.mjs <name> [--dir .] [--beats 4] [--format 16x9|9x16|1x1|4x5] [--fps 30] [--temperament calm|lively|snappy]
// A NEW MOTION FILM, STARTED AS ONE WORLD. Writes src/canvas-core/<name>.ts and src/hosts/page-<name>.ts:
// every beat is a region of one canvas, one camera travels between them (world.ts), each beat's title
// enters and leaves with setType (exit on an ease-in, 1.3x), sides alternate (alternate(i)), the camera
// breathes, and meta.motion names the temperament and the brand colours for motionscan and layerscan.
// It is the default for a launch or motion-graphics film because a brand launch film was built scene
// by scene and read as "a LITERAL SLIDE DECK". Replace the titles and the cards; keep the structure.
// Refuses to overwrite. Prints the next commands.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isMain } from "./is-main.mjs";

const SHAPES = { "16x9": [1920, 1080], "9x16": [1080, 1920], "1x1": [1080, 1080], "4x5": [1080, 1350] };

/** The source of a one-world film module: `beats` regions, a hold and a camera move each, on the beat grid. */
export const worldFilmSource = (name, { beats = 4, format = "16x9", fps = 30, bpm = 120, temperament = "calm" } = {}) => {
  const [W, H] = SHAPES[format] ?? (() => { throw new Error(`worldfilm: format is one of ${Object.keys(SHAPES).join(", ")}`); })();
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) throw new Error(`worldfilm: '${name}' must be a bare identifier (it becomes a module and an export name)`);
  if (!(Number.isInteger(beats) && beats >= 2 && beats <= 12)) throw new Error(`worldfilm: --beats is 2 to 12 (got ${beats})`);
  const beat = (60 / bpm) * fps; if (!Number.isInteger(beat)) throw new Error(`worldfilm: ${bpm} bpm at ${fps} fps is not a whole number of frames a beat`);
  const share = { calm: 0.35, lively: 0.55, snappy: 0.8 }[temperament]; if (!share) throw new Error(`worldfilm: temperament is calm, lively or snappy (got ${temperament})`);
  const portrait = H > W, zoom = 1 / 1.16, step = portrait ? Math.hypot(0.35 * W, 1.1 * H) : Math.hypot(1.1 * W, 0.35 * H);
  // the camera's move is long enough for the temperament: an in-out cubic peaks at 3x its mean speed (world.minTravel)
  const move = Math.ceil(Math.ceil((3 * step * zoom) / ((share * 2.5 * W) / fps)) / beat) * beat, hold = beat * 4, dur = beats * hold + (beats - 1) * move + beat * 2; // 4 beats on each region, then the move, 2 beats to land
  return `// ${name}: ONE WORLD. Every beat is a region of one canvas; one camera travels between them. Replace the
// titles and the card drawing; keep the structure: no beat is a slide, every seam is a camera move.
// Check it with: node tools/motionscan.mjs ${name}   and   node tools/layerscan.mjs ${name}
import type { Ctx, Env } from "./core";
import type { Film } from "./film";
import { setType } from "./kinetic";
import { alternate } from "./motionKit";
import { world, type Rect } from "./world";

const W = ${W}, H = ${H}, FPS = ${fps}, BPM = ${bpm}, HOLD = ${hold}, MOVE = ${move};
const INK = "#111214", PAPER = "#f4f1ea", ACCENT = "#ffde59"; // put the brand's own colours here (and in meta.motion.brandColors)
const TITLES = [${Array.from({ length: beats }, (_, i) => `"Beat ${i + 1}: one line that says it"`).join(", ")}];
const clamp = (v: number) => Math.max(0, Math.min(1, v));

// regions sit along a gentle path, ${portrait ? "stacked down the canvas for a phone frame" : "across the canvas"}; each is one frame big
const REGIONS = TITLES.map((_, i) => ({ id: \`b\${i}\`, rect: [${portrait ? "(i % 2) * W * 0.35, i * H * 1.1" : "i * W * 1.1, (i % 2) * H * 0.35"}, W, H] as Rect }));
const STOPS = TITLES.map((_, i) => ({ f: i * (HOLD + MOVE), at: \`b\${i}\`, hold: HOLD }));
const W0 = world({ W, H, regions: REGIONS, stops: STOPS, alive: { amp: 3, seed: 7 } });

const draw = (ctx: Ctx, f: number, env: Env) => {
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  W0.begin(ctx, env, f);
  TITLES.forEach((title, i) => W0.region(ctx, \`b\${i}\`, (r) => {
    const [x, y, w, h] = r.rect, left = alternate(i, [true, false]), t0 = i * (HOLD + MOVE);
    ctx.fillStyle = ACCENT; ctx.fillRect(left ? x + w * 0.06 : x + w * 0.54, y + h * 0.18, w * 0.4, h * 0.64); // the beat's card: opaque, moved by the camera, never faded
    const enter = clamp((f - t0 + MOVE * 0.4) / (FPS * 0.6)), leave = clamp((f - t0 - HOLD) / (FPS * 0.6));
    setType(ctx, env, title, left ? x + w * 0.52 : x + w * 0.06, y + h * 0.52, ${portrait ? 64 : 72}, enter, { color: INK, weight: 800, space: "world", out: i === TITLES.length - 1 ? 0 : leave });
  }));
  W0.end(ctx);
};

export const ${name}: Film = {
  meta: { title: "${name}", W, H, fps: FPS, bpm: BPM, durationFrames: ${dur}, motion: { temperament: "${temperament}", brandColors: [ACCENT] } },
  assets: { images: {} },
  shots: [{ id: "world", start: 0, end: ${dur}, draw }],
};
`;
};

if (isMain(import.meta.url)) {
  const pos = [], opt = {};
  for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = process.argv[++i]; else pos.push(a); }
  const name = pos[0], dir = resolve(opt.dir ?? ".");
  if (!name) { console.error("usage: node tools/worldfilm.mjs <name> [--dir .] [--beats 4] [--format 16x9|9x16|1x1|4x5] [--fps 30] [--temperament calm|lively|snappy]"); process.exit(2); }
  let src; try { src = worldFilmSource(name, { beats: Number(opt.beats ?? 4), format: opt.format ?? "16x9", fps: Number(opt.fps ?? 30), temperament: opt.temperament ?? "calm" }); } catch (e) { console.error(String(e.message ?? e)); process.exit(2); }
  const mod = join(dir, "src/canvas-core", `${name}.ts`), host = join(dir, "src/hosts", `page-${name}.ts`);
  if (existsSync(mod) || existsSync(host)) { console.error(`worldfilm: ${name} already exists in ${dir}; refusing to overwrite`); process.exit(2); }
  mkdirSync(join(dir, "src/canvas-core"), { recursive: true }); mkdirSync(join(dir, "src/hosts"), { recursive: true });
  writeFileSync(mod, src); writeFileSync(host, `import { ${name} } from "../canvas-core/${name}";\nimport { mountFilm } from "./page";\n\nmountFilm(${name});\n`);
  console.log(`one-world film ${name}\n  ${mod}\n  ${host}\nnext:\n  node tools/still.mjs ${name} --frames 0,${Math.round(0.5 * 30 * 4)} --sheet out/${name}-sheet.jpg\n  node tools/render.mjs ${name}\n  node tools/motionscan.mjs ${name}   node tools/layerscan.mjs ${name}`);
}
