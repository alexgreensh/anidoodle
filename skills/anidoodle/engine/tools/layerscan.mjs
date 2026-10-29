// node tools/layerscan.mjs <film> [--checks exits,fasttext,faces,translucent] [--every 1] [--from F] [--to T] [--json]
// LAYER SCAN. Watches what each frame DRAWS (hosts/instrument.ts: every line of text, every photo, every
// box the art reports, every fill in a brand colour) and fails the faults that pixels alone cannot pin
// on an element. Each one is a note from a brand launch film:
//   exits        a line of text leaves slivers behind at its clip edge for 0.2 s or more ("pixels are
//                left for about half a second longer than they should... check each and every frame")
//   fasttext     type moving faster than half the speed ceiling: a whip that blurs ("violent exits")
//   faces        a moving shape drawn over a real person's face ("whack-a-mole", "swallowing the head")
//   translucent  a brand colour filled between 5 % and 95 % alpha ("olive mud"); needs meta.motion.brandColors
// Exceptions live in meta.motion.allow. Exit 0 pass, 1 fail, 2 usage. Detectors: motionscan-core.mjs.
import { resolve } from "node:path";
import { buildPage } from "./build-page.mjs";
import { detect } from "./detect.mjs";
import * as playwright from "./adapters/playwright.mjs";
import { requireFilm } from "./names.mjs";
import { isMain } from "./is-main.mjs";
import { checkedFrames } from "./framerules.mjs";
import { scanExits, scanFaceCover, scanFastText, scanTranslucent, textLines } from "./motionscan-core.mjs";

export const LAYER_CHECKS = ["exits", "fasttext", "faces", "translucent"];
const pad = (b, k = 0.45) => { const h = b.y1 - b.y0, w = b.x1 - b.x0; return { x0: b.x0 - w * 0.02, y0: b.y0 - h * k, x1: b.x1 + w * 0.02, y1: b.y1 + h * k }; };

export const layerScan = async (film, { checks = LAYER_CHECKS, every = 1, from = 0, to } = {}) => {
  const page = await buildPage({ entry: `src/hosts/page-${film}.ts`, out: resolve(`dist/${film}.html`), title: film });
  const s = await playwright.open(detect(), page.out, { workers: 1 }), meta = await s.info(), motion = meta.motion ?? {}, allow = motion.allow ?? {};
  // a bad --every/--from/--to is refused (framerules.mjs checkedFrames): --every 0 looped forever, and zero frames checked passed
  let frames; try { frames = checkedFrames({ every, from, to }, meta.durationFrames); } catch (e) { await s.close(); throw new Error(`layerscan: ${e.message}`); }
  const N = Math.min(to ?? meta.durationFrames, meta.durationFrames);
  const layers = []; for (let i = 0; i < frames.length; i += 40) layers.push(...(await s.layers(frames.slice(i, i + 40), motion.brandColors ?? [])));
  const out = {};
  try {
    if (checks.includes("exits")) {
      // the ink each line shows over the last 2 s of its life, measured frame by frame (every frame, whatever --every says)
      const lines = textLines(layers), tailF = Math.round(2 * meta.fps), want = new Map();
      for (const [label, pts] of Object.entries(lines)) { const last = pts[pts.length - 1].frame, first = pts[0].frame; for (let f = Math.max(first, last - tailF); f <= Math.min(N - 1, last + every); f++) { const box = pts.filter((p) => p.frame <= f).pop() ?? pts[0]; (want.get(f) ?? want.set(f, []).get(f)).push({ label, box: pad(box) }); } }
      const series = {};
      // the box at each frame is the line's own box that frame when it was drawn, else its last one
      const detail = new Map(); for (const l of layers) detail.set(l.frame, l);
      for (const [f, items] of [...want].sort((a, b) => a[0] - b[0])) {
        const here = textLines(detail.has(f) ? [detail.get(f)] : (await s.layers([f], [])));
        const boxes = items.map((it) => (here[it.label] ? pad(here[it.label][0]) : it.box));
        const ink = await s.ink(f, boxes);
        items.forEach((it, i) => (series[it.label] ??= []).push({ frame: f, ink: here[it.label] ? ink[i] : 0 }));
      }
      const r = scanExits(series, { fps: meta.fps }); out.exits = { status: Object.keys(lines).length ? (r.fail ? "FAIL" : "PASS") : "NONE", lines: Object.keys(lines).length, ...r };
      if (!Object.keys(lines).length) out.exits.reason = "the film draws no lines of text: looked, none there";
    }
    if (checks.includes("fasttext")) { const r = scanFastText(layers, { W: meta.W, fps: meta.fps, scale: 1, step: every }); out.fasttext = { status: r.fail ? "FAIL" : "PASS", ...r }; }
    if (checks.includes("faces")) { const photos = layers.some((l) => l.recs.some((r) => r.kind === "photo")); const r = scanFaceCover(layers); out.faces = photos ? { status: r.fail ? "FAIL" : "PASS", ...r } : { status: "NONE", reason: "the film draws no photos (film assets): looked, none there", ...r }; }
    if (checks.includes("translucent")) { const r = scanTranslucent(layers, { allow: (allow.translucent ?? []).map(([a, b]) => [a, b]) }); out.translucent = layers[0]?.unread?.length ? { status: "FAIL", reason: `brand colour(s) ${layers[0].unread.join(", ")} in meta.motion.brandColors cannot be read: give #rrggbb, rgb() or hsl()`, ...r, findings: [], fail: true } : motion.brandColors?.length ? { status: r.fail ? "FAIL" : "PASS", ...r } : { status: "N/A", reason: "the film declares no brand colours (meta.motion.brandColors)", ...r }; }
  } finally { await s.close(); }
  return { film, meta, frames: frames.length, checks: out, fail: Object.values(out).some((c) => c.status === "FAIL") };
};

export const printLayers = (r) => {
  const c = r.checks, s = (f) => (f / r.meta.fps).toFixed(2), list = (fs) => `${fs.slice(0, 8).join(", ")}${fs.length > 8 ? " ..." : ""}`;
  console.log(`LAYERSCAN   ${r.film}   ${r.meta.W}x${r.meta.H}, ${r.frames} frames`);
  if (c.exits) { for (const e of c.exits.findings) console.log(`  FAIL  text "${e.label.slice(0, 48)}" leaves slivers for ${e.frames} frames (${e.seconds} s, frames ${e.from}-${e.to - 1}) as it exits: sink it with setType's out (ease-in, 1.3x its size) so it clears the clip`); console.log(`  EXITS:       ${c.exits.status}${c.exits.status === "NONE" ? `   ${c.exits.reason}` : `   ${c.exits.lines} line(s), residue limit ${c.exits.limit} frames`}`); }
  if (c.fasttext) { for (const t of c.fasttext.findings) console.log(`  FAIL  text "${t.label.slice(0, 48)}" moves at up to ${t.top} px a frame, frames ${t.from}-${t.to - 1} (${s(t.from)} s): type leaves over 0.5-0.7 s; the fast whip is for the camera`); console.log(`  FAST-TEXT:   ${c.fasttext.status}   limit ${c.fasttext.cap} px a frame (half the speed ceiling)`); }
  if (c.faces) { for (const f of c.faces.findings) console.log(`  FAIL  "${f.shape}" moves across the face of "${f.photo}" on ${f.frames.length} frame(s): ${list(f.frames)}: a person enters and leaves with their stage; draw the shape behind them or move it with them`); console.log(`  FACES:       ${c.faces.status}${c.faces.status === "NONE" ? `   ${c.faces.reason}` : ""}`); }
  if (c.translucent) { if (c.translucent.status === "FAIL" && c.translucent.reason) console.log(`  FAIL  ${c.translucent.reason}`); for (const t of c.translucent.findings) console.log(`  FAIL  brand colour ${t.colour} filled at ${t.alphas.join(", ")} % alpha on ${t.frames.length} frame(s): ${list(t.frames)}: cut it in or out whole, or declare the fade in meta.motion.allow.translucent`); console.log(`  TRANSLUCENT: ${c.translucent.status}${c.translucent.status === "N/A" || c.translucent.reason ? `   ${c.translucent.reason}` : ""}`); }
  console.log(`LAYERSCAN: ${r.fail ? "FAIL" : "PASS"}`);
};

if (isMain(import.meta.url)) {
  const pos = [], opt = {};
  for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a === "--json") opt.json = true; else if (a.startsWith("--")) opt[a.slice(2)] = process.argv[++i]; else pos.push(a); }
  const usage = "node tools/layerscan.mjs <film> [--checks exits,fasttext,faces,translucent] [--every 1] [--from F] [--to T] [--json]";
  const film = requireFilm(pos[0], "layerscan", usage), checks = opt.checks ? String(opt.checks).split(",") : LAYER_CHECKS, bad = checks.filter((c) => !LAYER_CHECKS.includes(c));
  if (bad.length) { console.error(`layerscan: unknown check ${bad.join(", ")}; the checks are ${LAYER_CHECKS.join(", ")}\nusage: ${usage}`); process.exit(2); }
  let r; try { r = await layerScan(film, { checks, every: Number(opt.every ?? 1), from: Number(opt.from ?? 0), to: opt.to === undefined ? undefined : Number(opt.to) }); }
  catch (e) { if (!/^layerscan: --/.test(e.message)) throw e; console.error(`${e.message}\nusage: ${usage}`); process.exit(2); }
  if (opt.json) console.log(JSON.stringify(r, null, 1)); else printLayers(r);
  process.exit(r.fail ? 1 : 0);
}
