// LESSON. Turn a drawing-score lesson module into its three deliverables and gate it.
//   node tools/lesson.mjs <lessonFilm> --out <dir> [--ref image.png [--ref-crop x,y,w,h]] [--no-mp4] [--workers 2]
// The module (src/canvas-core/<lessonFilm>.ts) exports the timelapse film and
//   export const LESSON = { score: () => Score, sheet: "<sheetFilm>", final: "<finalFilm>", source?: "..." }
// Writes into --out: <name>-steps.png (step sheet), <name>-timelapse.mp4, <name>-contact.png,
// LESSON.md, gates.txt. Gates (spec 14 section 5, the ones a machine can decide):
//   schema       ids unique, parts/layers resolve, dependencies acyclic and in order, corrections erased first
//   identity     the timelapse's LAST frame (prefix-cached replay) == the finished drawing rendered cold
//   time travel  sampled frames hash the same rendered forward, reversed, and each in a freshly mounted page
//   fidelity     (--ref) value-mass IoU and colour distance of the finished drawing against the user's image
// What no gate here can decide: whether the order reads as a hand working, and whether the teaching
// is right. Watch the timelapse and read the sheet.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { buildPage } from "./build-page.mjs";
import { detect } from "./detect.mjs";

const VAL = new Set(["out", "ref", "ref-crop", "workers"]);
const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = VAL.has(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
const die = (m) => { console.error(`lesson: ${m}`); process.exit(1); };
const name = pos[0] ?? die("usage: node tools/lesson.mjs <lessonFilm> --out <dir>");
const outDir = resolve(opt.out ?? `out/${name}`); mkdirSync(outDir, { recursive: true });
const log = []; const say = (s = "") => { console.log(s); log.push(s); };

// ---------------------------------------------------------------- 1. the score, in node
const probe = (await build({ stdin: { contents: `export { LESSON, ${name} as film } from "./src/canvas-core/${name}"; export { validate, PHASE_NAME } from "./src/canvas-core/drawingScore";`, resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "esm", write: false, platform: "neutral" })).outputFiles[0].text;
const M = await import("data:text/javascript;base64," + Buffer.from(probe).toString("base64"));
const S = M.LESSON.score(), V = M.validate(S), plan = M.film.plan(), fps = M.film.meta.fps, N = M.film.meta.durationFrames;
say(`LESSON ${S.title}  (${S.medium})`);
say(`\nschema: ${V.problems.length ? "FAIL" : "PASS"}  ${V.stats.marks} marks, ${V.stats.parts} parts, ${V.stats.steps} steps, ${S.layers.length} layers`);
V.problems.forEach((p) => say(`  problem: ${p}`)); V.warnings.forEach((w) => say(`  warning: ${w}`));
say(`  marks per part: ${Object.entries(V.stats.perPart).map(([k, v]) => `${k} ${v}`).join(", ")}`);
say(`  order: ${S.steps.map((s, i) => `${i + 1}.${s.phase}`).join(" > ")}`);
say(`  film: ${N} frames = ${(N / fps).toFixed(1)} s; steps at ${plan.steps.map((p) => (p.start / fps).toFixed(1) + "s").join(", ")}`);

// ---------------------------------------------------------------- 2. LESSON.md
const t = (f) => { const s = Math.round(f / fps); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const md = [`# ${S.title}`, "", `**Medium:** ${S.medium}`, ""];
if (S.note) md.push(`> ${S.note}`, "");
if (M.LESSON.source) md.push(`**Source image:** ${M.LESSON.source}`, "");
md.push(`**Files:** \`${name}-steps.png\` (one panel per step: earlier marks pale, the new ones strong), \`${name}-timelapse.mp4\` (${(N / fps).toFixed(0)} s, captions written on as pen strokes), this file.`, "", `The drawing is a score of ${S.marks.length} marks in ${S.steps.length} steps. Every mark was placed in this order on purpose; the timelapse is that order played back, not a recording of a person drawing.`, "");
S.steps.forEach((st, i) => {
  const parts = [...new Set(st.marks.map((m) => S.marks[m].part))].map((p) => S.parts.find((q) => q.id === p).label);
  md.push(`## ${i + 1}. ${st.title}  _(${M.PHASE_NAME[st.phase]}, ${t(plan.steps[i].start)} in the timelapse)_`, "", st.caption, "", `- **Look for:** ${st.look}`, `- **How:** ${st.how}`);
  if (st.mistake) md.push(`- **Common mistake:** ${st.mistake}`);
  md.push(`- **Marks:** ${st.marks.length}, on ${parts.join(", ")}${st.marks.some((m) => S.marks[m].kind === "erase") ? " (includes an eraser pass)" : ""}`, "");
});
md.push("## Layers", "", ...S.layers.map((l) => `- \`${l.id}\`${l.note ? `: ${l.note}` : ""}`), "");
writeFileSync(resolve(outDir, "LESSON.md"), md.join("\n"));
say(`\n-> ${resolve(outDir, "LESSON.md")}`);

// ---------------------------------------------------------------- 3. pages: sheet, identity, time travel
const env = detect(); if (!env.pw.ok || !env.browser.ok) die("no browser: npm install, then npx playwright-core install chromium");
const browser = await env.pw.lib.chromium.launch({ executablePath: env.browser.executablePath });
const ctx = await browser.newContext({ viewport: { width: 640, height: 640 } });
const open = async (film) => { const pg = await buildPage({ entry: `src/hosts/page-${film}.ts`, out: resolve(`dist/${film}.html`), title: film }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message)); await p.goto(pathToFileURL(pg.out).href + "?adapter=playwright"); await p.evaluate(async () => { await window.FILM.ready; window.FILM.mount(1); }); if (errs.length) die(`${film}: ${errs.join("; ")}`); return p; };
const shoot = (p, f) => p.evaluate((n) => { window.FILM.seek(n); return { png: window.FILM.png(), hash: window.FILM.hash() }; }, f);
const md5 = (b64) => createHash("md5").update(Buffer.from(b64, "base64")).digest("hex");

const sheetPage = await open(M.LESSON.sheet), sheet = await shoot(sheetPage, 0);
writeFileSync(resolve(outDir, `${name}-steps.png`), Buffer.from(sheet.png, "base64")); say(`-> ${resolve(outDir, `${name}-steps.png`)}  md5 ${md5(sheet.png)}`);

const filmA = await open(name), finalPage = await open(M.LESSON.final);
// warm the replay the way a render does: walk forward through every step end, then take the last frame
for (const s of plan.steps) await shoot(filmA, Math.min(N - 1, Math.round(s.markEnd)));
const last = await shoot(filmA, N - 1), cold = await shoot(finalPage, 0);
writeFileSync(resolve(outDir, `${name}-final.png`), Buffer.from(last.png, "base64"));
say(`\nidentity: ${last.hash === cold.hash ? "PASS" : "FAIL"}  timelapse frame ${N - 1} (cached replay) ${last.hash} vs cold render ${cold.hash}`);

const sample = [0, ...plan.steps.flatMap((s) => [Math.round((s.markStart + s.markEnd) / 2), Math.round(s.markEnd)]), N - 1].filter((f, i, a) => f < N && a.indexOf(f) === i);
const filmB = await open(name), fwd = [], rev = [], iso = [];
for (const f of sample) fwd.push((await shoot(filmB, f)).hash);
const filmC = await open(name); for (const f of [...sample].reverse()) rev.unshift((await shoot(filmC, f)).hash);
const filmD = await open(name); for (const f of sample) iso.push(await filmD.evaluate((n) => { window.FILM.mount(1); window.FILM.seek(n); return window.FILM.hash(); }, f)); // a fresh env (empty cache) per frame
const ok = sample.filter((_, i) => fwd[i] === rev[i] && fwd[i] === iso[i]).length;
say(`time travel: ${ok === sample.length ? "PASS" : "FAIL"}  ${ok}/${sample.length} sampled frames identical forward, reversed and cold-mounted (frames ${sample.join(", ")})`);
const timing = await filmB.evaluate((f) => window.FILM.seek(f).ms, Math.round(plan.steps[plan.steps.length - 2].markEnd));
say(`draw cost: ${timing.toFixed(0)} ms for a late frame at scale 1`);
await browser.close();

// ---------------------------------------------------------------- 4. fidelity against the user's image (recreate-and-teach)
if (opt.ref) {
  const art = M.film.meta.W; // the art square sits at the top of the lesson frame
  const grab = (file, crop, size = 128) => { const vf = [crop ? `crop=${crop.split(",")[2]}:${crop.split(",")[3]}:${crop.split(",")[0]}:${crop.split(",")[1]}` : null, `scale=${size}:${size}:flags=area`].filter(Boolean).join(","); return execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", vf, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 26 }); };
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lab = (r, g, b) => { const R = lin(r), G = lin(g), B = lin(b), l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B); return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; };
  const labs = (buf) => Array.from({ length: buf.length / 3 }, (_, i) => lab(buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]));
  const A = labs(grab(resolve(opt.ref), opt["ref-crop"])), B = labs(grab(resolve(outDir, `${name}-final.png`), `0,0,${art},${art}`));
  // value masses: the reference posterised to its own three values (1-D k-means on L, thresholds halfway
  // between the centres), the same thresholds applied to the recreation. Equal-area tertiles were tried
  // first and rejected: a big flat colour sitting on a tertile boundary splits into noise.
  const Ls = A.map((p) => p[0]).sort((a, b) => a - b); let cen = [Ls[Math.floor(Ls.length / 6)], Ls[Math.floor(Ls.length / 2)], Ls[Math.floor((5 * Ls.length) / 6)]];
  for (let it = 0; it < 30; it++) { const s = [0, 0, 0], n = [0, 0, 0]; for (const L of Ls) { const k = cen.reduce((b, c, j) => (Math.abs(L - c) < Math.abs(L - cen[b]) ? j : b), 0); s[k] += L; n[k]++; } cen = cen.map((c, j) => (n[j] ? s[j] / n[j] : c)); }
  const t1 = (cen[0] + cen[1]) / 2, t2 = (cen[1] + cen[2]) / 2, cls = (L) => (L < t1 ? 0 : L < t2 ? 1 : 2);
  const iou = [0, 1, 2].map((k) => { let i = 0, u = 0; A.forEach((p, j) => { const a = cls(p[0]) === k, b = cls(B[j][0]) === k; if (a && b) i++; if (a || b) u++; }); return u ? i / u : 1; });
  const dE = A.reduce((s, p, j) => s + Math.hypot(p[0] - B[j][0], p[1] - B[j][1], p[2] - B[j][2]), 0) / A.length;
  const mIoU = iou.reduce((a, b) => a + b, 0) / 3;
  say(`\nfidelity vs ${opt.ref}${opt["ref-crop"] ? ` [${opt["ref-crop"]}]` : ""}:\n  value-mass IoU dark ${iou[0].toFixed(2)} / mid ${iou[1].toFixed(2)} / light ${iou[2].toFixed(2)}, mean ${mIoU.toFixed(2)} (target >= 0.70 for a recreation)\n  mean OKLab dE at 128 px ${(dE * 100).toFixed(1)} (x100; under ~10 reads as the same colours)`);
}

// ---------------------------------------------------------------- 5. the timelapse and its contact sheet
if (!opt["no-mp4"]) {
  const mp4 = resolve(outDir, `${name}-timelapse.mp4`);
  const r = spawnSync(process.execPath, ["tools/render.mjs", name, "--workers", String(opt.workers ?? 2), "--out", mp4], { stdio: ["ignore", "pipe", "inherit"] });
  const tail = r.stdout.toString().trim().split("\n").filter((l) => /budget|determinism|draw median|output|stream|video/.test(l));
  say(`\ntimelapse: ${r.status === 0 ? "rendered" : "FAILED"} -> ${mp4}`); tail.forEach((l) => say(`  ${l.trim()}`));
  const picks = plan.steps.map((s) => Math.round(s.markStart + (s.markEnd - s.markStart) * 0.6)); picks.unshift(30); picks.push(N - 1);
  const sel = picks.slice(0, 12).map((f) => `eq(n\\,${f})`).join("+"), cols = 4, rows = Math.ceil(Math.min(12, picks.length) / cols);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", mp4, "-vf", `select='${sel}',scale=360:-2,tile=${cols}x${rows}:padding=6:color=0xe9e2d2`, "-frames:v", "1", "-vsync", "vfr", resolve(outDir, `${name}-contact.png`)]);
  say(`-> ${resolve(outDir, `${name}-contact.png`)} (frames ${picks.slice(0, 12).join(", ")})`);
}
writeFileSync(resolve(outDir, "gates.txt"), log.join("\n") + "\n");
