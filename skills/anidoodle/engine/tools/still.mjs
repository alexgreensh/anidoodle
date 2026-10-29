// STILL. Frames of one film, at full resolution, to paths a human can open.
//   node tools/still.mjs <film> [--shot <id>] [--frame N] [--out out/x.png] [--scale 1]
//   node tools/still.mjs <film> --frames 0,700,1500 [--out out/dir/ | --out out/x-{frame}.png] [--sheet out/sheet.jpg]
// The look still is rendered many times before a single frame of motion is, so this does exactly
// that and nothing else: build the page, draw the frames, write the PNGs, print the draw cost and
// each frame's hash so a re-render can be proved identical. Every frame is drawn twice, because a
// still that is not reproducible is not a gate.
//   --frames a,b,c   many frames in ONE browser session (one build, one launch, one warm-up, and
//                    plates baked once): the cheap way to review a cut. Ranges work: 0-300:50.
//   --sheet file     also lay the frames out as one contact sheet at --sheet-scale (default 0.4)
//   --no-bake-cache  draw every finished plate cold instead of reading .cache/bakes
//   --grips          3D films: a 2x crop of every grip the film registers (three-core/checks3d) on each
//                    frame, plus one board of them all, each labelled PASS or with its findings. A green
//                    check with a prop through a hand is still a failure: look at the crops (lesson 37).
// With no --frame/--frames, one still per shot, at the shot's first frame.
import { gripFindings } from "./gaterules.mjs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { buildPage } from "./build-page.mjs";
import { requireFilm } from "./names.mjs";
import { detect } from "./detect.mjs";
import * as playwright from "./adapters/playwright.mjs";

const VAL = new Set(["shot", "out", "scale", "frame", "frames", "sheet", "sheet-scale"]);
const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = VAL.has(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
const die = (m) => { console.error(`still: ${m}`); process.exit(1); };
const film = requireFilm(pos[0], "still", "node tools/still.mjs <film> [--shot <id>] [--frame N | --frames a,b,c] [--out out/x.png] [--scale 1] [--sheet out/sheet.jpg]");
const scale = Number(opt.scale ?? 1);
if (!(scale > 0)) die(`--scale wants a number > 0, got '${opt.scale}'`);
if (opt.frame !== undefined && opt.frames !== undefined) die("give --frame N or --frames a,b,c, not both");

// "0,700,1500" or "0-300:50" (from-to inclusive, every 50) or a mix
const parseFrames = (s) => String(s).split(",").map((t) => t.trim()).filter(Boolean).flatMap((t) => {
  const m = t.match(/^(\d+)-(\d+)(?::(\d+))?$/);
  if (m) { const [a, b, st] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 1)]; if (b < a || st < 1) die(`bad range '${t}'`); return Array.from({ length: Math.floor((b - a) / st) + 1 }, (_, i) => a + i * st); }
  if (!/^\d+$/.test(t)) die(`--frames wants frame numbers like 0,700,1500 or 0-300:50, got '${t}'`);
  return [Number(t)];
});

const env = detect();
// A still needs a browser and nothing else: ffmpeg only matters once there is motion to encode.
if (!env.pw.ok || !env.browser.ok) die(`no browser to draw in.\n  playwright: ${env.report.playwright}\n  browser:    ${env.report.browser}\n  fix: npm install, then npx playwright-core install chromium`);
const page = await buildPage({ entry: `src/hosts/page-${film}.ts`, out: resolve(`dist/${film}.html`), title: film });
const session = await playwright.open(env, page.out, { scale, workers: 1, bakeCache: opt["no-bake-cache"] ? false : undefined });
const meta = await session.info(), N = meta.durationFrames;
const shotOf = (n) => meta.shots.find((s) => n >= s.start && n < s.end) ?? meta.shots[meta.shots.length - 1];

// the jobs: [frame, output path]
let jobs;
if (opt.frames !== undefined || opt.frame !== undefined) {
  const list = [...new Set(opt.frames !== undefined ? parseFrames(opt.frames) : parseFrames(opt.frame))];
  for (const n of list) if (n >= N) die(`frame ${n} is past the film's last frame ${N - 1}`);
  const outFor = (n) => {
    if (!opt.out) return list.length === 1 && opt.frame !== undefined ? `out/still-${film}-${shotOf(n).id}.png` : `out/still-${film}-${n}.png`;
    if (String(opt.out).includes("{frame}")) return String(opt.out).replaceAll("{frame}", String(n));
    if (String(opt.out).endsWith("/")) return join(opt.out, `${film}-${n}.png`);
    if (list.length === 1) return opt.out;
    die(`--out for ${list.length} frames must be a folder ending in / or contain {frame}`);
  };
  jobs = list.map((n) => [n, resolve(outFor(n)), shotOf(n).id]);
} else {
  const shots = opt.shot ? [meta.shots.find((s) => s.id === opt.shot) ?? die(`no shot '${opt.shot}' (has: ${meta.shots.map((s) => s.id).join(", ")})`)] : meta.shots;
  jobs = shots.map((s) => [s.start, resolve(shots.length === 1 && opt.out ? opt.out : `out/still-${film}-${s.id}.png`), s.id]);
}

const b = session.bakes();
console.log(`film: "${meta.title}" ${meta.W}x${meta.H}, scale ${scale}, ${jobs.length} still${jobs.length === 1 ? "" : "s"}${b.on ? `, bake cache: ${b.loaded} plate frame(s) loaded` : ", bake cache off"}`);
const h = (p) => createHash("md5").update(p).digest("hex"), t0 = Date.now(), written = [];
for (const [n, out, id] of jobs) {
  const a = await session.frame(n, 0);
  const c = await session.frame(n, 0); // drawn twice: a still that is not reproducible is not a gate
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, a.png); written.push(out);
  console.log(`  ${id.padEnd(12)} frame ${String(n).padEnd(5)} draw ${a.drawMs.toFixed(0).padStart(5)} ms  md5 ${h(a.png)}  ${h(a.png) === h(c.png) ? "reproducible" : "NOT REPRODUCIBLE"}  -> ${out} (${(a.png.length / 1024).toFixed(0)} KB)`);
}
const saved = await session.close();
console.log(`  ${jobs.length} frame(s) in ${((Date.now() - t0) / 1000).toFixed(1)} s${saved ? `; ${saved} finished plate frame(s) stored in .cache/bakes for next time` : ""}`);

if (opt.sheet) {
  const k = Number(opt["sheet-scale"] ?? 0.4), cols = Math.ceil(Math.sqrt(written.length)), rows = Math.ceil(written.length / cols), tmp = resolve(".tmp/sheet");
  rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  const args = ["-v", "error", "-y"]; written.forEach((f) => args.push("-i", f));
  const w = Math.max(2, Math.round((meta.W * scale * k) / 2) * 2), hh = Math.max(2, Math.round((meta.H * scale * k) / 2) * 2);
  const pads = Array.from({ length: cols * rows - written.length }, (_, i) => `color=c=white:s=${w}x${hh}:d=1[p${i}]`);
  const labels = written.map((_, i) => `[${i}:v]scale=${w}:${hh}:flags=area,setsar=1[v${i}]`);
  const padIds = pads.map((p) => p.match(/\[(p\w+)\]$/)[1]);
  const all = [...written.map((_, i) => `[v${i}]`), ...padIds.map((p) => `[${p}]`)];
  const layout = all.map((_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * hh}`).join("|");
  const graph = [...labels, ...pads, `${all.join("")}xstack=inputs=${all.length}:layout=${layout}:fill=white`].join(";");
  const out = resolve(opt.sheet); mkdirSync(dirname(out), { recursive: true });
  const r = spawnSync("ffmpeg", [...args, "-filter_complex", all.length === 1 ? `[0:v]scale=${w}:${hh}` : graph, "-frames:v", "1", "-q:v", "3", out], { encoding: "utf8" });
  if (r.status !== 0) die(`contact sheet failed: ${r.stderr.trim()}`);
  console.log(`  contact sheet ${cols}x${rows} at ${k}x -> ${out}`);
}

// GRIP CROP BOARD. A page of its own at 2x with the 3D checks listening (hosts/page.ts FILM.checks3d):
// each frame is drawn once, its registered grips come back as points on screen, and a crop around
// each one is cut from that same 2x frame. Never touches the stills above.
if (opt.grips) {
  if (!readFileSync(page.out, "utf8").includes("__ANIDOODLE_WEBGL__")) die("--grips is for 3D films (this page draws no WebGL, so nothing registers a grip)");
  const K = 2, CW = 240, CH = 170, dir = resolve(String(opt.out ?? "out/").endsWith("/") ? opt.out ?? "out/" : dirname(resolve(opt.out)), "grips");
  mkdirSync(dir, { recursive: true });
  const browser = await env.pw.lib.chromium.launch({ executablePath: env.browser.executablePath, args: ["--disable-background-timer-throttling", ...playwright.glArgs(page.out)] });
  const crops = [];
  try {
    const gp = await (await browser.newContext({ viewport: { width: 640, height: 640 } })).newPage();
    await gp.goto(pathToFileURL(page.out).href + "?adapter=still-grips");
    await gp.evaluate(async (k) => { await window.FILM.ready; window.FILM.mount(k); }, K);
    for (const [n] of jobs) {
      const r = await gp.evaluate((f) => { const rec = window.FILM.checks3d([f]); return { rec, png: window.FILM.png() }; }, n);
      const rec = r.rec[0]; if (!rec?.grips.length) { console.log(`  grips        frame ${String(n).padEnd(5)} none registered`); continue; }
      const full = resolve(dir, `.frame-${n}.png`); writeFileSync(full, Buffer.from(r.png, "base64"));
      rec.grips.forEach((g, i) => {
        const w = CW * K, h = CH * K, x = Math.max(0, Math.min(meta.W * K - w, Math.round(g.x * K - w / 2))), y = Math.max(0, Math.min(meta.H * K - h, Math.round(g.y * K - h / 2)));
        const out = resolve(dir, `${film}-${n}-grip${i}.png`), bad = gripFindings(g, rec.findings); // this grip's own findings, not every grip's on the frame
        const cr = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", full, "-vf", `crop=${w}:${h}:${x}:${y}`, out], { encoding: "utf8" });
        if (cr.status !== 0) die(`grip crop failed: ${cr.stderr.trim()}`);
        crops.push(out);
        console.log(`  grips        frame ${String(n).padEnd(5)} ${g.name}  ${bad.length ? "FINDINGS: " + bad.map((x) => x.kind).join(", ") : "PASS"}  -> ${out}`);
      });
      rmSync(full, { force: true });
    }
  } finally { await browser.close(); }
  if (crops.length > 1) {
    const cols = Math.ceil(Math.sqrt(crops.length)), rows = Math.ceil(crops.length / cols), w = CW * K, h = CH * K, args = ["-v", "error", "-y"];
    crops.forEach((f) => args.push("-i", f));
    const pads = Array.from({ length: cols * rows - crops.length }, (_, i) => `color=c=white:s=${w}x${h}:d=1[p${i}]`), ids = [...crops.map((_, i) => `[${i}:v]`), ...pads.map((_, i) => `[p${i}]`)];
    const layout = ids.map((_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join("|"), board = resolve(dir, `${film}-grips.png`);
    const r = spawnSync("ffmpeg", [...args, "-filter_complex", [...pads, `${ids.join("")}xstack=inputs=${ids.length}:layout=${layout}:fill=white`].join(";"), "-frames:v", "1", board], { encoding: "utf8" });
    if (r.status !== 0) die(`grip board failed: ${r.stderr.trim()}`);
    console.log(`  grip board ${cols}x${rows} -> ${board}`);
  }
}
