// FRAMECHECK. Design faults the determinism gate cannot see, found on the frames themselves, from the
// text and boxes every frame actually draws (the frame probe in hosts/page.ts follows text through
// offscreen layers, so a sheet composited later counts like text on the frame).
//   1. Cut by the edge. No line of text and no content box the art reports (probeRect) SITS cut by the
//      frame's edge: cut and unmoved on 3 checked frames in a row fails. Sliding across the edge while
//      the camera travels (one world, a pan) is motion, and is listed, not failed.
//   2. Reading time. EVERY block of text the film draws is a cue, timed from the frame it is complete
//      (a typed reply: after its last character) to the last frame it is up, and must stay up
//      max(0.7 s, 0.3 s per word); meta.captions are checked too. A film that draws text can never be
//      N/A: it was on a brand launch film, which shipped "text too fast" with this check printing N/A.
//      Words meant as texture (readable.ts texture()) are skipped and counted.
//   3. Phone safe zones, 9:16 only: no text in the platforms' top band, bottom band or right column.
//   4. Layout: too many text blocks, blocks packed into a corner, a centred stack, a gap under 3 % of
//      the height, text across the edge of a content box, text over text (framerules.mjs, held 0.5 s).
//   5. The last second: no text under 28 px at 1080. The end card lands once. Heads in one group
//      within 10 %. Font families listed (brand faces, stand-ins: meta.checks.fonts / standIns).
// The rules and their numbers are textrules.mjs and framerules.mjs.
//   node tools/framecheck.mjs <film>[-<shape>] [--every 1] [--from F] [--to T] [--zones fail|warn] [--json out.json]
// --zones warn lists safe-zone text as FLAG and does not fail the run. Everything else fails.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildPage } from "./build-page.mjs";
import { detect } from "./detect.mjs";
import * as playwright from "./adapters/playwright.mjs";
import { requireFilm } from "./names.mjs";
import { isMain } from "./is-main.mjs";
import { SAFE_ZONES, isPortrait916, safeZoneHits } from "./textrules.mjs";
import { autoCues, checkedFrames, edgeCuts, endCardRuns, endSizeFindings, fontReport, framesOf, headSpread, layoutFindings, readingFloor, readingVerdict } from "./framerules.mjs";

const USAGE = "node tools/framecheck.mjs <film>[-<shape>] [--every 1] [--from F] [--to T] [--zones fail|warn] [--json out.json]";
export const frameCheck = async (film, { every = 1, from = 0, to } = {}) => {
  const page = await buildPage({ entry: `src/hosts/page-${film}.ts`, out: resolve(`dist/${film}.html`), title: film });
  // the bake cache stays off: a plate frame read back from disk carries no text records
  const s = await playwright.open(detect(), page.out, { workers: 1, bakeCache: false }), meta = await s.info();
  let frames; try { frames = checkedFrames({ every, from, to }, meta.durationFrames); } catch (e) { await s.close(); throw new Error(`framecheck: ${e.message}`); }
  const recs = []; for (let i = 0; i < frames.length; i += 40) recs.push(...(await s.probe(frames.slice(i, i + 40), true)));
  await s.close();
  const scale = 1, W = meta.W * scale, H = meta.H * scale, byFrame = framesOf(recs, frames), ck = meta.checks ?? {};
  const auto = autoCues(byFrame, frames, { first: 0, last: meta.durationFrames, fps: meta.fps });
  return {
    meta, frames: frames.length, every, // every > 1: a quick look (holds measured in steps of `every` frames), never a ship PASS
    bad: recs.filter((r) => r.cut !== false), cuts: edgeCuts(recs.filter((r) => r.cut !== false), frames),
    reading: readingVerdict(auto, meta.captions, meta.fps, frames.length), auto,
    floor: readingFloor(auto.cues, meta.fps),
    zones: safeZoneHits(recs.filter((r) => r.cut === false), W, H),
    layout: layoutFindings(byFrame, frames, { W, H, fps: meta.fps, exemptRanges: ck.layoutExempt }),
    endSize: endSizeFindings(byFrame, frames, { W, H, fps: meta.fps, durationFrames: meta.durationFrames, scale }),
    endCard: endCardRuns(byFrame, frames),
    heads: headSpread(byFrame, frames),
    fonts: fontReport(byFrame, frames, ck),
  };
};

/** The verdict lines of a frameCheck result, and how many of them fail. Shared with ship.mjs. */
export const frameReport = (film, r, { warnZones = false } = {}) => {
  const lines = [], list = (fs) => `${fs.slice(0, 8).join(", ")}${fs.length > 8 ? " ..." : ""}`, out = (l) => lines.push(l);
  const cuts = r.cuts.filter((c) => c.fail), passing = r.cuts.length - cuts.length;
  out(`FRAMECHECK   ${film}   ${r.meta.W}x${r.meta.H}, ${r.frames} frames`);
  for (const c of cuts) out(`  FAIL  ${c.kind} "${String(c.label).slice(0, 48)}" cut by the frame's edge and held there ${c.held} frames (${c.frames.length} cut in all): ${list(c.frames)}   box ${c.box.map((v) => Math.round(v)).join(",")}`);
  const rd = r.reading, zn = r.zones;
  for (const b of rd.bad) out(`  FAIL  text "${b.text.slice(0, 48)}" is up ${b.seconds} s from frame ${b.from}; reading it takes ${b.need} s (hold it longer: readable.ts chatHold/readS, or mark texture() if it is not meant to be read)`);
  for (const h of zn.hits ?? []) out(`  ${warnZones ? "FLAG" : "FAIL"}  text "${h.label.slice(0, 48)}" sits in the ${h.zone} on ${h.frames.length} frame(s): ${list(h.frames)}`);
  for (const x of r.layout) out(`  FAIL  ${x.msg}   frames ${x.from}-${x.to} (declare a deliberate one in meta.checks.layoutExempt with a reason)`);
  for (const x of r.endSize) out(`  FAIL  ${x.msg}`);
  if (!r.endCard.ok) out(`  FAIL  ${r.endCard.msg}`);
  for (const g of r.heads) if (!g.ok) out(`  FAIL  heads in "${g.group}" differ by ${Math.round(g.spread * 100)}% (at most 10%): ${g.people.map((p) => `${p.name} ${p.h} px`).join(", ")}; place them with people.ts drawPerson and one headPx`);
  for (const f of r.fonts) if (f.standFor || f.offBrand) out(`  FLAG  ${f.lines} line(s) set in ${f.family}${f.standFor ? `, standing in for ${f.standFor} (the font file is missing: ask for it)` : ", not one of the brand's faces (meta.checks.fonts)"}`);
  const zp = (x) => Math.round(x * 100), a = r.auto;
  if (passing) out(`  EDGE:         ${passing} line(s) or box(es) crossed the edge while moving (a pan or a camera travel, not held there): not a fault`);
  out(`  READING-TIME: ${rd.status}${rd.reason ? `   ${rd.reason}` : `   ${rd.checked} cue(s) (${a.cues.length} drawn, the rest meta.captions), each at least max(0.7 s, 0.3 s per word)`}${a.texture ? `; ${a.texture} texture block(s) skipped` : ""}${a.skipped.partial ? `; ${a.skipped.partial} cut off by the range` : ""}${a.skipped.seen ? `; ${a.skipped.seen} return(s) of text already read` : ""}${a.skipped.exit ? `; ${a.skipped.exit} exit step(s)` : ""}`);
  if (a.cues.length) out(`  READING-FLOOR: text needs at least ${r.floor.floorS.toFixed(1)} s of the film's ${(r.meta.durationFrames / r.meta.fps).toFixed(1)} s; text stays up ${r.floor.spareS.toFixed(1)} s beyond its reading time in all (cut length from there, or from moves, never from reading)`);
  out(`  SAFE-ZONES:   ${zn.status === "FAIL" && warnZones ? "FLAG" : zn.status}${zn.status === "N/A" ? `   ${zn.reason}` : `   ${zn.hits.length ? `${zn.hits.length} text(s) inside` : "no text in"} the top ${zp(SAFE_ZONES.top)}%, bottom ${zp(SAFE_ZONES.bottom)}% or right ${zp(SAFE_ZONES.right)}% of the frame`}`);
  out(`  LAYOUT:       ${r.layout.length ? `FAIL   ${r.layout.length} finding(s)` : "PASS   density, gaps, stacks, overlaps"}; LAST SECOND ${r.endSize.length ? "FAIL" : "PASS"}; END CARD ${r.endCard.runs.length ? (r.endCard.ok ? "PASS (lands once)" : "FAIL") : "none reported"}; HEADS ${r.heads.length ? (r.heads.every((g) => g.ok) ? "PASS" : "FAIL") : "none reported"}`);
  const nz = zn.hits?.length ?? 0, readFail = rd.status === "FAIL" ? Math.max(1, rd.bad.length) : 0;
  const fails = cuts.length + readFail + (warnZones ? 0 : nz) + r.layout.length + r.endSize.length + (r.endCard.ok ? 0 : 1) + r.heads.filter((g) => !g.ok).length;
  out(fails ? `FRAMECHECK: FAIL   ${fails} problem(s): ${cuts.length} cut by the frame's edge, ${readFail} reading time, ${warnZones ? 0 : nz} in a phone safe zone, ${r.layout.length} layout, ${r.endSize.length} too small at the end` : `FRAMECHECK: PASS   no text or box cut by the edge; reading time ${rd.status}; layout clean; safe zones ${nz ? `FLAGGED (${nz} text(s))` : zn.status}`);
  return { lines, fails };
};

if (isMain(import.meta.url)) {
  const pos = [], opt = {};
  for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = process.argv[++i]; else pos.push(a); }
  const film = requireFilm(pos[0], "framecheck", USAGE), warnZones = opt.zones === "warn";
  if (opt.zones !== undefined && !["fail", "warn"].includes(opt.zones)) { console.error(`framecheck: --zones is fail or warn, got '${opt.zones}'\nusage: ${USAGE}`); process.exit(2); }
  let r; try { r = await frameCheck(film, { every: Number(opt.every ?? 1), from: Number(opt.from ?? 0), to: opt.to === undefined ? undefined : Number(opt.to) }); }
  catch (e) { if (!/^framecheck: --/.test(e.message)) throw e; console.error(`${e.message}\nusage: ${USAGE}`); process.exit(2); }
  const rep = frameReport(film, r, { warnZones });
  console.log(rep.lines.join("\n"));
  if (opt.json) writeFileSync(resolve(opt.json), JSON.stringify({ ...r, bad: r.bad.slice(0, 200) }, null, 1));
  process.exit(rep.fails ? 1 : 0);
}
