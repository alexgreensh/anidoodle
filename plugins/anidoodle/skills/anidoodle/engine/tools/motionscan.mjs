// node tools/motionscan.mjs <film|path.mp4> [--checks slidecut,repeat,dissolve,temperament] [--temperament calm] [--json]
// MOTION SCAN. Reads the RENDERED film (any MP4, made by anidoodle or not) and fails the motion that
// made a brand launch film read as a slide deck:
//   slidecut     most of the frame replaced within 6 frames with no camera move; more than 2 in any minute fails
//   repeat       three or more beats in a row settle into the same layout with new content (a carousel)
//   dissolve     a cross-dissolve over a quarter of the frame or more (smaller element fades are listed)
//   temperament  stretches faster than the film's motion temperament allows (meta.motion.temperament or --temperament)
// The film's meta comes from the render's sidecar (<file>.film.json, written by render.mjs), so a
// renamed or versioned file still knows its exceptions (meta.motion.allow) and its temperament.
// Exit 0 pass, 1 fail, 2 usage. The detectors are motionscan-core.mjs (pure, unit-tested).
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { greyFrames } from "./motion.mjs";
import { isMain } from "./is-main.mjs";
import { TEMPERAMENT_MAX, scanTarget, scanDissolves, scanRepeats, scanSlideCuts, scanTemperament, speedProfile } from "./motionscan-core.mjs";

export const CHECKS = ["slidecut", "repeat", "dissolve", "temperament"];
const ranges = (xs) => (xs ?? []).map(([a, b]) => [a, b]);

/** The sidecar render.mjs writes beside a delivered file, or null. */
export const sidecarOf = (file) => { const p = `${file}.film.json`; try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; } catch { return null; } };

/** Run the motion checks on a rendered file. Returns { checks: { name: { status, ... } }, fail }. */
export const motionScan = async (file, { checks = CHECKS, temperament, size = 192, meta: given } = {}) => {
  const st = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,avg_frame_rate", "-of", "json", file])).streams[0];
  const [fn, fd] = st.avg_frame_rate.split("/").map(Number), fps = fn / fd, W = size, H = Math.max(24, Math.round((size * st.height) / st.width / 2) * 2);
  const meta = given ?? sidecarOf(file)?.meta ?? {}, motion = meta.motion ?? {}, allow = motion.allow ?? {};
  const frames = []; for await (const f of greyFrames(file, W, H)) frames.push(f);
  const out = {}, o = { width: W, height: H, fps };
  if (checks.includes("slidecut")) { const r = scanSlideCuts(frames, { ...o, allow: ranges(allow.slideCut) }); out.slidecut = { status: r.fail ? "FAIL" : "PASS", ...r }; }
  if (checks.includes("repeat")) { const r = scanRepeats(frames, o); out.repeat = { status: r.fail ? "FAIL" : "PASS", ...r }; }
  if (checks.includes("dissolve")) { const r = scanDissolves(frames, { ...o, allow: ranges(allow.dissolve) }); out.dissolve = { status: r.fail ? "FAIL" : "PASS", ...r }; }
  if (checks.includes("temperament")) {
    const t = temperament ?? motion.temperament, share = typeof t === "string" ? TEMPERAMENT_MAX[t] : t?.maxSpeed;
    if (t !== undefined && !share) throw new Error(`motionscan: temperament '${JSON.stringify(t)}' is not one of ${Object.keys(TEMPERAMENT_MAX).join(", ")} or { maxSpeed }`);
    if (!share) out.temperament = { status: "N/A", reason: "the film declares no motion temperament (meta.motion.temperament); pass --temperament calm|lively|snappy to judge it" };
    else {
      const sw = 128, sh = Math.max(24, Math.round((sw * st.height) / st.width / 2) * 2), small = []; for await (const f of greyFrames(file, sw, sh)) small.push(f);
      const maxPx = share * (2.5 * st.width) / fps, speeds = speedProfile(small, { width: sw, height: sh, scale: st.width / sw, R: 10 }), r = scanTemperament(speeds, { maxPx });
      out.temperament = { status: r.fail ? "FAIL" : "PASS", temperament: t, top: +Math.max(...speeds).toFixed(1), ...r };
    }
  }
  return { file, fps, frames: frames.length, checks: out, fail: Object.values(out).some((c) => c.status === "FAIL") };
};

export const printScan = (r) => {
  const s = (f) => (f / r.fps).toFixed(2), c = r.checks;
  console.log(`MOTIONSCAN   ${r.file}   ${r.frames} frames @ ${r.fps.toFixed(2)} fps`);
  if (c.slidecut) {
    for (const e of c.slidecut.events) console.log(`  ${c.slidecut.fail ? "FAIL" : "NOTE"}  slide cut at frame ${e.frame} (${s(e.frame)} s): ${Math.round(e.replaced * 100)} % of the frame replaced in 6 frames with no camera move`);
    console.log(`  SLIDE-CUTS:  ${c.slidecut.status}   ${c.slidecut.events.length} found${c.slidecut.fail ? `, ${c.slidecut.worst.length} inside one minute (limit ${c.slidecut.perMinute}): carry the eye with a camera move into the next region (world.ts), or declare the cut in meta.motion.allow.slideCut` : ""}`);
  }
  if (c.repeat) {
    for (const run of c.repeat.runs) console.log(`  FAIL  ${run.length} beats in a row settle into the same layout: ${run.map(([a, b]) => `${s(a)}-${s(b)} s`).join(", ")}`);
    console.log(`  REPEATS:     ${c.repeat.status}   ${c.repeat.beats.length} settled beats${c.repeat.fail ? ": give each beat its own layout and entry (motionKit alternate(i), entryFrom(i))" : ""}`);
  }
  if (c.dissolve) {
    for (const d of c.dissolve.findings) console.log(`  ${d.seam && !d.allowed ? "FAIL" : "NOTE"}  ${d.seam ? "dissolve or fade-in" : "small fade"} frames ${d.from}-${d.to - 1} (${s(d.from)}-${s(d.to)} s): ${Math.round(d.area * 100)} % of the frame blends, ${Math.round(d.share * 100)} % of what changes there${d.allowed ? " (declared)" : ""}`);
    console.log(`  DISSOLVES:   ${c.dissolve.status}${c.dissolve.fail ? "   a fade is not a transition: move the camera, mask a wipe, or let the outgoing element leave" : ""}`);
  }
  if (c.temperament) {
    if (c.temperament.status === "N/A") console.log(`  TEMPERAMENT: N/A   ${c.temperament.reason}`);
    else { for (const t of c.temperament.stretches) console.log(`  FAIL  frames ${t.from}-${t.to} (${s(t.from)} s) move at up to ${t.top} px a frame; the ${JSON.stringify(c.temperament.temperament)} temperament allows ${c.temperament.maxPx.toFixed(0)}`); console.log(`  TEMPERAMENT: ${c.temperament.status}   fastest ${c.temperament.top} px a frame, limit ${c.temperament.maxPx.toFixed(0)}${c.temperament.fail ? ": lengthen the move or travel less" : ""}`); }
  }
  console.log(`MOTIONSCAN: ${r.fail ? "FAIL" : "PASS"}`);
};

if (isMain(import.meta.url)) {
  const pos = [], opt = {};
  for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a === "--json") opt.json = true; else if (a.startsWith("--")) opt[a.slice(2)] = process.argv[++i]; else pos.push(a); }
  const usage = "usage: node tools/motionscan.mjs <film|path.mp4> [--checks slidecut,repeat,dissolve,temperament] [--temperament calm|lively|snappy] [--json]";
  if (!pos[0]) { console.error(usage); process.exit(2); }
  const file = resolve(scanTarget(pos[0]));
  if (!existsSync(file)) { console.error(`motionscan: no such file ${file}; render it first (node tools/render.mjs ${pos[0]}) or give the video file's path\n${usage}`); process.exit(2); }
  const checks = opt.checks ? String(opt.checks).split(",") : CHECKS, bad = checks.filter((c) => !CHECKS.includes(c));
  if (bad.length) { console.error(`motionscan: unknown check ${bad.join(", ")}; the checks are ${CHECKS.join(", ")}`); process.exit(2); }
  const r = await motionScan(file, { checks, temperament: opt.temperament });
  if (opt.json) console.log(JSON.stringify(r, (k, v) => (v instanceof Set ? [...v] : v), 1)); else printScan(r);
  process.exit(r.fail ? 1 : 0);
}
