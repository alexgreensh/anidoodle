#!/usr/bin/env node
// END-TO-END TESTS for ship.mjs on real rendered files: every check ship wires in has a case that must go
// red, and the green fixture must ship. Fixtures: src/canvas-core/fixtureShip.ts.
//   fixtureShipGreen   ships (every row PASS, NONE or FLAG), even renamed: its sidecar names it; every check
//                      looks (temperament, brand colours), and the two with nothing there say why (meta.checks.none)
//   fixtureShipBlind   the same beat with no temperament, brand colours, ledger, claims or budget: those rows
//                      FAIL (a check that cannot look), where they used to FLAG and ship printed PASS
//   no sidecar         a file with no sidecar is scanned with the film's own meta (temperament, allow)
//   --every            abc is refused (exit 2); 2 is a QUICK run, never PASS
//   fixtureShipRed     frame FAILs (reading time, density, end card twice, 14 px CTA); motion:slidecut FAILs
//   fixtureShipLocked  locks FAILs (an approved shot whose sha no render produces)
//   fixtureShipTrack   an external track: verify FAILs without the mix sidecar, track FAILs on music that
//                      stops early, sfx FAILs without a stem, cues FAILs without a sheet; with the pinned take
//                      the provenance passes, and soundcheck --sfx tells a pitched stem from a click stem
//   gate               the external-track exception holds the file to the pinned take (red without it)
//   input              an empty file and a renamed file with no sidecar are refused, never judged
// Everything is written under .tmp/ship-e2e/.   node tools/ship-e2e.mjs
import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const dir = resolve(".tmp/ship-e2e"); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
let pass = 0; const ok = (label) => console.log(`PASS ${++pass} ${label}`);
const node = (args) => spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 1 << 27 });
const render = (film, name = film) => { const out = `${dir}/${name}.mp4`; execFileSync(process.execPath, ["tools/render.mjs", film, "--out", out], { stdio: "pipe" }); return out; };
const ship = (target, ...extra) => { const out = `${dir}/sheet-${pass}-${Math.abs(target.length)}`; const r = node(["tools/ship.mjs", target, "--out", out, ...extra]); let j = null; try { j = JSON.parse(readFileSync(`${out}/ship.json`, "utf8")); } catch { /* refused before any row */ } return { code: r.status, out: r.stdout + r.stderr, j, row: (step) => j?.rows.find((x) => x.step === step) }; };
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");

// ---- green: ships from a renamed file, through its sidecar
const green = render("fixtureShipGreen", "green-v3");
const g = ship(green);
assert.equal(g.j?.verdict, "PASS", g.out.split("\n").filter((l) => /FAIL/.test(l)).join("\n"));
assert.equal(g.row("motion:temperament").status, "PASS", JSON.stringify(g.row("motion:temperament"))); assert.equal(g.row("layers:translucent").status, "PASS", JSON.stringify(g.row("layers:translucent")));
assert.equal(g.row("review").status, "NONE"); assert.ok(/no critic/.test(g.row("review").detail), g.row("review").detail);
ok(`GREEN fixtureShipGreen ships from a renamed file (${g.j.rows.length} rows, none FAIL; temperament and brand colours looked)`);

// ---- blind: checks that cannot look FAIL (H3), never FLAG into a PASS
const bl = ship(render("fixtureShipBlind"), "--quick");
for (const step of ["motion:temperament", "layers:translucent", "review", "facts", "length"]) assert.equal(bl.row(step)?.status, "FAIL", `${step}: ${JSON.stringify(bl.row(step))}`);
assert.equal(bl.j.verdict, "FAIL");
ok("RED fixtureShipBlind: no temperament, brand colours, ledger, claims or budget: each row FAILS and the ship FAILS");

// ---- no sidecar (M5): the film's own meta reaches motionscan
copyFileSync(green, `${dir}/no-sidecar.mp4`);
const ns = ship("fixtureShipGreen", "--file", `${dir}/no-sidecar.mp4`, "--quick");
assert.equal(ns.row("motion:temperament")?.status, "PASS", JSON.stringify(ns.row("motion:temperament")));
ok("fixtureShipGreen with no sidecar: motionscan still judges the film's calm temperament (meta passed in, not N/A)");

// ---- --every (M2)
const ea = ship(green, "--every", "abc"); assert.equal(ea.code, 2, ea.out.slice(-300)); assert.ok(/--every/.test(ea.out));
const e2 = ship(green, "--every", "2"); assert.equal(e2.j?.verdict, "QUICK", e2.out.slice(-300)); assert.notEqual(e2.code, 0);
ok("RED ship --every abc is refused (exit 2); --every 2 is QUICK, never PASS");

// ---- red: frame and motion
const red = ship(render("fixtureShipRed", "brandLaunch-v12"), "--quick");
assert.equal(red.row("frame").status, "FAIL"); assert.ok(red.row("frame").lines.some((l) => /reading it takes 3\.3 s/.test(l)), "the 0.9 s reply hold");
assert.ok(red.row("frame").lines.some((l) => /14 px at 1080/.test(l)) && red.row("frame").lines.some((l) => /density/.test(l)), "tiny CTA and density");
assert.equal(red.row("motion:slidecut").status, "FAIL"); assert.equal(red.j.verdict, "FAIL");
ok("RED fixtureShipRed: frame FAILs (3.3 s reply held 0.9 s, density, 14 px CTA, card twice) and motion:slidecut FAILs");
const quick = ship(green, "--quick");
assert.equal(quick.j.verdict, "QUICK"); assert.notEqual(quick.code, 0);
ok("RED --quick never passes: the verdict is QUICK and the exit code is 1");

// ---- locks
const lk = ship(render("fixtureShipLocked"), "--quick");
assert.equal(lk.row("locks").status, "FAIL", JSON.stringify(lk.row("locks")));
ok("RED fixtureShipLocked: an approved shot that changed fails the locks row");

// ---- external track
const pic = render("fixtureShipTrack"), take = `${dir}/take.wav`;
ff(["-f", "lavfi", "-i", "anoisesrc=d=10:c=pink:a=0.25", "-af", "lowpass=f=3000", "-ar", "48000", "-ac", "2", take]);
assert.equal(node(["tools/track.mjs", "import", take, "--provider", "fixture", "--cost", "0", "--licence", "test only"]).status, 0, "track import");
const short = `${dir}/track-short.mp4`; ff(["-i", pic, "-i", take, "-t", "10", "-af", "atrim=0:6,apad=whole_dur=10", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", short]);
copyFileSync(`${pic}.film.json`, `${short}.film.json`); const sc = JSON.parse(readFileSync(`${short}.film.json`, "utf8")); sc.sha256 = sha(short); writeFileSync(`${short}.film.json`, JSON.stringify(sc));
const t1 = ship(short, "--quick");
assert.equal(t1.row("verify").status, "FAIL"); assert.ok(t1.row("verify").lines.some((l) => /pinned|mix sidecar/.test(l)), JSON.stringify(t1.row("verify")));
assert.equal(t1.row("track").status, "FAIL"); assert.equal(t1.row("sfx").status, "FAIL"); assert.equal(t1.row("cues").status, "FAIL");
ok("RED fixtureShipTrack: no mix sidecar (verify), music stopping at 6 s of 10 (track), no effects stem (sfx), no cue sheet (cues): all FAIL");
const full = `${dir}/track-full.mp4`; ff(["-i", pic, "-i", take, "-t", "10", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", full]);
copyFileSync(`${pic}.film.json`, `${full}.film.json`); const sf = JSON.parse(readFileSync(`${full}.film.json`, "utf8")); sf.sha256 = sha(full); writeFileSync(`${full}.film.json`, JSON.stringify(sf));
// the mix record names the cue sheet it was made from (sidecar.mjs trackProvenance: a stale effects mix fails)
const cueSheet = `${dir}/fixtureShipTrack.cues.json`; writeFileSync(cueSheet, JSON.stringify({ film: "fixtureShipTrack", fps: 30, durationFrames: 300, durationS: 10, cues: [] }));
writeFileSync(`${full}.mix.json`, JSON.stringify({ music: take, musicSha256: sha(take), cues: cueSheet, cuesSha256: sha(cueSheet), quiet: [] }));
const pitched = `${dir}/stem-pitched.wav`, clicks = `${dir}/stem-clicks.wav`;
ff(["-f", "lavfi", "-i", "sine=f=440:d=0.4", "-af", "apad=pad_dur=1.6,aloop=loop=4:size=96000", "-ar", "48000", "-ac", "2", "-t", "10", pitched]);
ff(["-f", "lavfi", "-i", "anoisesrc=d=0.015:c=white:a=0.9", "-af", "apad=pad_dur=1.985,aloop=loop=4:size=96000", "-ar", "48000", "-ac", "2", "-t", "10", clicks]);
const t2 = ship(full, "--quick", "--sfx", pitched), t3 = ship(full, "--quick", "--sfx", clicks);
assert.ok(!t2.row("verify").lines.some((l) => /pinned take/.test(l)), `provenance passes with the pinned take: ${JSON.stringify(t2.row("verify"))}`);
assert.ok(t2.row("sound").lines.some((l) => /pitch|note/i.test(l)), `the pitched stem is caught: ${JSON.stringify(t2.row("sound"))}`);
assert.ok(!t3.row("sound").lines.some((l) => /effects pitch|carry a note|carry notes/i.test(l)), `the click stem is not: ${JSON.stringify(t3.row("sound"))}`);
ok("fixtureShipTrack: the mix from the pinned take passes provenance; soundcheck --sfx fails a 440 Hz stem and passes a click stem");

const gs = node(["tools/gate.mjs", "fixtureShipTrack", "--mp4", short]), gf = node(["tools/gate.mjs", "fixtureShipTrack", "--mp4", full]);
assert.equal(gs.status, 1, gs.stdout.slice(-400)); assert.equal(gf.status, 0, gf.stdout.slice(-400)); assert.ok(/EXTERNAL TRACK/.test(gf.stdout));
ok("gate on an external-track film: FAIL with no mix sidecar, PASS when the mix comes from the pinned take");

// ---- input
writeFileSync(`${dir}/empty.mp4`, "");
const e = ship("fixtureShipGreen", "--file", `${dir}/empty.mp4`);
assert.equal(e.row("input").status, "FAIL"); assert.equal(e.j.verdict, "FAIL");
ok("RED an empty file is a FAIL row, never judged");
copyFileSync(green, `${dir}/renamed.mp4`);
const rn = node(["tools/ship.mjs", `${dir}/renamed.mp4`]);
assert.equal(rn.status, 2); assert.ok(/--file/.test(rn.stderr), rn.stderr);
ok("RED a renamed file with no sidecar is refused with the --file form to run");
// ---- a linked project (scaffold --linked, X4) whose photo has not arrived yet (placeholders, X11)
{
  const proj = `${dir}/linked`, E = resolve("."), run = (args, env = {}) => spawnSync(process.execPath, args, { cwd: proj, encoding: "utf8", env: { ...process.env, ...env }, maxBuffer: 1 << 27 });
  assert.equal(node(["tools/scaffold.mjs", proj, "--linked", "--film", "promoFilm", "--duration", "2", "--format", "16x9"]).status, 0);
  const mod = `${proj}/src/canvas-core/promoFilm.ts`; writeFileSync(mod, readFileSync(mod, "utf8").replace("assets: { images: {} }", 'assets: { images: { speaker: "photos/speaker.png" } }'));
  const refused = run([`${E}/tools/still.mjs`, "promoFilm", "--frame", "0", "--out", "out/a.png"]);
  assert.notEqual(refused.status, 0, "a missing photo stops the build without placeholders");
  const ph = run([`${E}/tools/render.mjs`, "promoFilm", "--out", "out/promo.mp4"], { ANIDOODLE_PLACEHOLDERS: "1" });
  assert.equal(ph.status, 0, ph.stdout.slice(-600) + ph.stderr.slice(-600));
  const v = run([`${E}/tools/verify-export.mjs`, "out/promo.mp4", "--delivery"], { ANIDOODLE_PLACEHOLDERS: "1" });
  assert.equal(v.status, 1); assert.ok(/placeholder asset/.test(v.stdout), v.stdout.slice(-800));
  ok("linked project: its film renders from the engine with no copy; a missing photo renders as a labelled placeholder and --delivery refuses the file");
}
console.log(`\nSHIP-E2E: PASS   ${pass} cases`);
