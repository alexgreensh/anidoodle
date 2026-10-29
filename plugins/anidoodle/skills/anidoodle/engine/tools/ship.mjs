// SHIP. The one command a film passes before anyone is shown it, for ANY film (hand-built or template),
// on the exact file that will be delivered. On a brand launch film nine versions reached the director with no
// check at all, and the checks that did run passed while blind (reading time "N/A", verify-export unable
// to resolve a renamed file). Ship runs every check on the file, prints one table and writes a critic-
// ready sheet. Its rule: a check that cannot look is a FAIL, never a pass.
//
//   node tools/ship.mjs <film|file.mp4> [--file out/x.mp4] [--shapes 16x9,9x16 [--file out/x-{shape}.mp4]]
//                       [--every 1] [--zones warn] [--quick] [--sfx stem.wav]
//                       [--review reviews/<film>.json] [--out <dir>]
//
//   input     the file exists, is not empty, decodes; its sidecar (render's <file>.film.json) names this
//             film and covers the whole film (a range render never ships)
//   frame     framecheck: edges, reading time on every drawn text, safe zones, layout, the last second,
//             the end card landing once, head sizes, fonts (framerules.mjs)
//   verify    verify-export --delivery on the file: size, frames, duration, score, sync, true peak,
//             loudness, a legible frame 0, no placeholder assets
//   gate      determinism, the contract scan, dead air on the file (skipped only with --quick, and then
//             the verdict is QUICK, never PASS)
//   motion    motionscan on the file (slide cuts, carousels, dissolves, temperament) and layerscan on the
//             film (exit residue, fast type, shapes over faces, translucent brand colour), lock (approved
//             shots unchanged): Lane MOTION's scanners, one row per check; a check that reports N/A did not look
//             and FAILS, unless the film names why there is nothing to check in meta.checks.none (then NONE)
//   sound     the engine's score: soundcheck on the file. An external track (meta.checks.music.track):
//             track.mjs check on the file (holes, the ending against the track's own last note) and
//             soundcheck --sfx <stem> (effects carry no pitch under someone else's music); verify-export
//             checks the mix came from the pinned take. cues --check whenever the film declares cues
//   facts     every claim the film declares is in its facts ledger with a source
//   review    reviews/<film>.json: an open P0 from a critic fails; open P1s are listed; the person's last
//             three notes are printed to re-read against the new sheet
//   length    meta.checks.length: over max fails, over target flags, and the reading floor is printed
//   sheet     <file>.ship/sheet.jpg beside the file (a frame every 2 s, every shot start, the last frame),
//             SHIP.md and ship.json: the table to attach whenever a version is shown
// A check that cannot look (no temperament, no brand colours, no review ledger, no length budget, text with
// no claims) FAILS; a film that truly has nothing there declares it, with a reason, in meta.checks.none
// { "<row>": "<reason>" }, and the row is NONE with the reason printed. --every above 1 is a QUICK run.
// Exit 0 PASS, 1 FAIL (or QUICK), 2 bad input.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isMain } from "./is-main.mjs";
import { knownFilms, requireFilm, SHAPE_NAMES } from "./names.mjs";
import { filmOfFile, readSidecar } from "./sidecar.mjs";
import { frameCheck, frameReport } from "./framecheck.mjs";
import { blindRow, lengthRow, reviewRows, row, scannerRows, sheetFrames, shipEvery, verdict } from "./shiprules.mjs";

const TOOLS = dirname(fileURLToPath(import.meta.url));
const USAGE = "node tools/ship.mjs <film|file.mp4> [--file out/x.mp4] [--shapes 16x9,9x16] [--every 1] [--zones warn] [--quick] [--review reviews/<film>.json] [--out dir]";


/** Run a tool, read its verdict from the exit code. A tool that could not run (exit 2, or missing) is a FAIL. */
export const runTool = (script, args, { label = script, none = /\bN\/A\b/ } = {}) => {
  const path = join(TOOLS, script);
  if (!existsSync(path)) return row(label, "FAIL", `tools/${script} is not installed: this check cannot look, so it fails`);
  const r = spawnSync(process.execPath, [path, ...args], { encoding: "utf8", maxBuffer: 1 << 27 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`, lines = out.split("\n"), verdict = [...lines].reverse().find((l) => /^[A-Z][A-Z-]+:\s/.test(l.trim())) ?? lines.filter(Boolean).pop() ?? "";
  const fails = lines.filter((l) => /^\s*FAIL\b/.test(l)).map((l) => l.trim());
  if (r.status === 0) return row(label, none.test(verdict) ? "NONE" : "PASS", verdict.trim());
  if (r.status === 1) return row(label, "FAIL", verdict.trim(), fails.length ? fails : lines.filter(Boolean).slice(-6));
  return row(label, "FAIL", `could not run (exit ${r.status}): ${out.trim().split("\n").slice(-2).join(" ")}`);
};

/**
 * A scanner from another lane, run in-process: one row per check it reports (shiprules.mjs scannerRows).
 * FAIL fails, PASS passes, NONE (looked, nothing there) is NONE, and N/A (did not look) FAILS unless the
 * film declares why there is nothing to check (meta.checks.none). A scanner that is missing or throws is a
 * FAIL row: a check that cannot look is not a pass.
 */
export const scanner = async (label, script, fn, printer, call, shape, meta = null) => {
  const path = join(TOOLS, script);
  if (!existsSync(path)) return [row(label, "FAIL", `tools/${script} is not installed: this check cannot look, so it fails`)];
  // a file URL, never a bare path: on Windows C:\\... is not a module specifier, and every scanner row failed there
  let mod, r; try { mod = await import(pathToFileURL(path).href); r = await call(mod[fn]); } catch (e) { return [row(label, "FAIL", `${script} could not run: ${String(e.message ?? e).split("\n")[0]}`)]; }
  if (shape) return shape(r);
  const printed = []; if (printer && mod[printer]) { const log = console.log; console.log = (...a) => printed.push(a.join(" ")); try { mod[printer](r); } finally { console.log = log; } }
  return scannerRows(label, r, meta, printed.filter((l) => /^\s*FAIL\b/.test(l)).map((l) => l.trim()));
};

const audioStreams = (file) => { const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file], { encoding: "utf8" }); return r.status === 0 ? r.stdout.split("\n").filter(Boolean).length : -1; };
const videoFrames = (file) => { const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "csv=p=0", file], { encoding: "utf8" }); return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null; };

/** Every check on one (film, file). -> { rows, meta } */
export const shipOne = async (film, file, o = {}) => {
  const rows = [];
  // ---- input: never judge an empty or wrong file
  if (!existsSync(file)) return { rows: [row("input", "FAIL", `${file} does not exist: render it first (node tools/render.mjs ${film})`)] };
  if (statSync(file).size === 0) return { rows: [row("input", "FAIL", `${file} is empty (0 bytes): an empty input is never a pass`)] };
  const codec = videoFrames(file); if (!codec) return { rows: [row("input", "FAIL", `${file} has no decodable video stream`)] };
  const sc = readSidecar(file);
  if (sc?.error) rows.push(row("input", "FAIL", sc.error));
  else if (sc && sc.film !== film) rows.push(row("input", "FAIL", `${basename(file)} was rendered from '${sc.film}' (its sidecar), not '${film}'`));
  else if (sc?.stale) rows.push(row("input", "FAIL", `${basename(file)} changed after render wrote its sidecar: re-render it`));
  else rows.push(row("input", "PASS", `${basename(file)} (${codec}, ${(statSync(file).size / 1e6).toFixed(1)} MB)${sc ? ", sidecar matches" : ", no sidecar (an older render): the film is the one named"}`));

  // ---- frame
  let fc; try { fc = await frameCheck(film, { every: o.every ?? 1 }); } catch (e) { rows.push(row("frame", "FAIL", `the film did not draw: ${String(e.message ?? e).split("\n")[0]}${/one shape/.test(String(e.message)) ? " (a hand-built film takes --shapes once it has film.reshape: compose each shape from one timeline, never a crop)" : ""}`)); return { rows }; }
  const meta = fc.meta, rep = frameReport(film, fc, { warnZones: o.zones === "warn" });
  if (sc?.frames && Array.isArray(sc.frames) && (sc.frames[0] !== 0 || sc.frames[1] !== meta.durationFrames)) rows.push(row("input", "FAIL", `a range render (frames ${sc.frames.join("-")} of ${meta.durationFrames}) cannot ship`));
  rows.push(row("frame", rep.fails ? "FAIL" : "PASS", rep.lines[rep.lines.length - 1].replace(/^FRAMECHECK:\s*/, ""), rep.lines.filter((l) => /^\s+(FAIL|FLAG)\b/.test(l)).map((l) => l.trim())));
  if (meta.placeholders?.length) rows.push(row("assets", "FAIL", `placeholder asset(s): ${meta.placeholders.join(", ")}`));

  // ---- the file
  rows.push(runTool("verify-export.mjs", [film, "--file", file, "--delivery"], { label: "verify" }));
  if (o.quick) rows.push(row("gate", "FLAG", "skipped (--quick): determinism, contract and dead air not run, so this run cannot pass"));
  else rows.push(runTool("gate.mjs", [film, "--mp4", file], { label: "gate" }));
  // Lane MOTION's scanners, one row per check: N/A comes back as FLAG with its reason (listed, never a pass)
  // the film's own meta goes to motionscan: a file with no sidecar (an older render, track.mjs master) used to
  // be scanned with no temperament and no meta.motion.allow, so declared cuts and fades failed falsely
  rows.push(...await scanner("motion", "motionscan.mjs", "motionScan", "printScan", (m) => m(file, { meta }), null, meta));
  rows.push(...await scanner("layers", "layerscan.mjs", "layerScan", "printLayers", (m) => m(film), null, meta));
  rows.push(...await scanner("locks", "lock.mjs", "checkLocks", null, (m) => m(film), (r) => (r.none ? [row("locks", "NONE", "no approved shots yet (meta.motion.approved): lock one with lock.mjs --shot <id> once the person approves it")] : [row("locks", r.fail ? "FAIL" : "PASS", `${r.checked.length} approved shot(s)`, r.checked.filter((c) => c.status !== "same").map((c) => `${c.status === "unlocked" ? "FLAG" : "FAIL"}  ${c.shot} (${c.note}) ${c.status}`))])));
  // sound: the engine's own score, or an external track (meta.checks.music.track: Lane SOUND's route)
  const na = audioStreams(file), ext = meta.checks?.music?.track, base = film.replace(/-(16x9|1x1|4x5|9x16)$/, "");
  if (na < 0) rows.push(row("sound", "FAIL", "ffprobe could not read the audio streams"));
  else if (na === 0) rows.push(meta.hasAudio || ext ? row("sound", "FAIL", "the film has music but the file has no audio stream") : row("sound", "NONE", "no audio stream, and the film declares no score (verify checks the same)"));
  else if (ext) {
    rows.push(runTool("track.mjs", ["check", file], { label: "track" }));
    if (!o.sfx) rows.push(row("sfx", "FAIL", "an external track needs its effects stem measured for pitch: pass --sfx <stem.wav> (track.mjs mix --stem wrote it)"));
    else rows.push(runTool("soundcheck.mjs", [file, "--sfx", o.sfx], { label: "sound" }));
  } else rows.push(runTool("soundcheck.mjs", [file], { label: "sound" }));
  // cues: a film that declares cues must have its sheet exported and current (the mix reads it)
  let cuesDeclared = false; try { const { loadFilm } = await import("./captions.mjs"); cuesDeclared = ((await loadFilm(base)).cues ?? []).length > 0; } catch { /* the facts row below reports a film that will not load */ }
  const cueSheet = resolve(`out/${base}.cues.json`);
  if (existsSync(cueSheet)) rows.push(runTool("cues.mjs", [base, "--check", cueSheet], { label: "cues" }));
  else if (cuesDeclared || ext) rows.push(row("cues", "FAIL", `the film's cue sheet ${cueSheet} is missing: export it with node tools/cues.mjs ${base} (the mix and the sync are cued from it)`));

  // ---- the film's own records
  try {
    const { loadFilm } = await import("./captions.mjs"), { checkFacts, claimsOf } = await import("./factsrules.mjs"), { factsFile, readFacts } = await import("./facts.mjs");
    const fx = readFacts(factsFile(film)), res = fx.error ? { status: "FAIL", checked: 0, problems: [{ claim: "(facts.json)", why: fx.error }] } : checkFacts(claimsOf(await loadFilm(film)), fx.facts);
    const drawn = fc.auto.cues.length;
    rows.push(res.status === "N/A" ? (drawn ? blindRow(meta, "facts", `the film declares no claims (film.claims) but draws ${drawn} text cue(s): list every claim with its source (references/workflows/facts.md)`) : row("facts", "NONE", "the film declares no claims and draws no text")) : row("facts", res.status, `${res.checked} claim(s)`, res.problems.map((p) => `FAIL  "${String(p.claim).slice(0, 60)}" ${p.why}`)));
  } catch (e) { rows.push(row("facts", "FAIL", `could not read the film's claims: ${e.message}`)); }
  { const rp = resolve(o.review ?? `reviews/${film.replace(/-(16x9|1x1|4x5|9x16)$/, "")}.json`); let j = null, err = null; if (existsSync(rp)) try { j = JSON.parse(readFileSync(rp, "utf8")); } catch (e) { err = e.message; } rows.push(...reviewRows(j, rp, err, meta)); }
  rows.push(lengthRow(meta, fc.auto.cues.length ? fc.floor : null));

  // ---- the critic sheet
  if (o.out) {
    mkdirSync(o.out, { recursive: true });
    const fr = sheetFrames(meta), sheet = join(o.out, "sheet.jpg");
    const st = spawnSync(process.execPath, [join(TOOLS, "still.mjs"), film, "--frames", fr.join(","), "--out", join(o.out, "frames", "f-{frame}.png"), "--sheet", sheet], { encoding: "utf8", maxBuffer: 1 << 26 });
    rows.push(row("sheet", st.status === 0 && existsSync(sheet) ? "PASS" : "FAIL", st.status === 0 ? `${sheet} (${fr.length} frames: every 2 s, every shot start, the last frame)` : `still.mjs failed: ${(st.stderr || st.stdout).trim().split("\n").pop()}`));
  }
  return { rows, meta, frame: rep.lines };
};

const table = (name, rows) => [`SHIP ${name}`, ...rows.flatMap((r) => [`  ${r.step.padEnd(18)} ${r.status.padEnd(5)} ${r.detail}`, ...r.lines.slice(0, 12).map((l) => `                ${l}`), ...(r.lines.length > 12 ? [`                ... ${r.lines.length - 12} more`] : [])])];

if (isMain(import.meta.url)) {
  const pos = [], opt = {}, FLAGS = new Set(["quick"]);
  for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) { const k = a.slice(2); opt[k] = FLAGS.has(k) ? true : process.argv[++i]; } else pos.push(a); }
  if (!pos[0]) { console.error(`usage: ${USAGE}`); process.exit(2); }
  let film = pos[0];
  if (/\.(mp4|mov|m4v)$/i.test(film)) { if (opt.file) { console.error("ship: give the file once"); process.exit(2); } opt.file = film; const who = filmOfFile(film, knownFilms()); if (!who.film) { console.error(`ship: ${who.why.replace("verify-export.mjs", "ship.mjs")}`); process.exit(2); } film = who.film; }
  requireFilm(film, "ship", USAGE);
  if (opt.zones !== undefined && !["fail", "warn"].includes(opt.zones)) { console.error(`ship: --zones is fail or warn, got '${opt.zones}'`); process.exit(2); }
  // --every: checked here, before any row (abc used to reach framecheck as NaN and check frame 0 alone); above 1 the run is QUICK
  let ev; try { ev = shipEvery(opt.every); } catch (e) { console.error(`ship: ${e.message}\nusage: ${USAGE}`); process.exit(2); }
  const quick = !!opt.quick || ev.quick;
  const shapes = opt.shapes ? String(opt.shapes).split(",").map((s) => s.trim()).filter(Boolean) : [null];
  const badShape = shapes.filter((s) => s && !SHAPE_NAMES.includes(s)); if (badShape.length) { console.error(`ship: --shapes wants ${SHAPE_NAMES.join(", ")}, got '${opt.shapes}'`); process.exit(2); }
  const results = [];
  for (const sh of shapes) {
    const f = sh ? `${film}-${sh}` : film, file = resolve(opt.file ? String(opt.file).replace("{shape}", sh ?? "") : `out/${f}.mp4`);
    if (sh && opt.file && !String(opt.file).includes("{shape}") && shapes.length > 1) { console.error("ship: with several --shapes, --file needs {shape} in it (out/x-{shape}.mp4)"); process.exit(2); }
    const out = resolve(opt.out ? String(opt.out).replace("{shape}", sh ?? "") + (sh && !String(opt.out).includes("{shape}") ? `-${sh}` : "") : join(dirname(file), `${basename(file).replace(/\.[^.]+$/, "")}.ship`));
    console.log(`\n==================== ${f}  ${file}`);
    const r = await shipOne(f, file, { every: ev.every, zones: opt.zones, quick: !!opt.quick, review: opt.review, sfx: opt.sfx ? resolve(String(opt.sfx).replace("{shape}", sh ?? "")) : undefined, out });
    const v = verdict(r.rows, quick), t = table(f, r.rows);
    console.log(t.join("\n")); console.log(`SHIP ${f}: ${v}`);
    { mkdirSync(out, { recursive: true }); // the table is written even when the input was refused: that refusal is the record
      writeFileSync(join(out, "ship.json"), JSON.stringify({ film: f, file, verdict: v, rows: r.rows }, null, 1) + "\n");
      writeFileSync(join(out, "SHIP.md"), [`# Ship: ${f}`, "", `File: \`${file}\`  `, `Verdict: **${v}**`, "", "| check | status | detail |", "|---|---|---|", ...r.rows.map((x) => `| ${x.step} | ${x.status} | ${x.detail.replace(/\|/g, "/")} |`), "", "## Findings", "", ...r.rows.flatMap((x) => x.lines.map((l) => `- ${x.step}: ${l}`)), "", "![sheet](sheet.jpg)", ""].join("\n"));
      console.log(`critic sheet and table: ${join(out, "SHIP.md")}`);
    }
    results.push(v);
  }
  const all = results.every((v) => v === "PASS") ? "PASS" : results.includes("FAIL") ? "FAIL" : "QUICK";
  console.log(`\nSHIP: ${all}${all === "QUICK" ? `   (${opt.quick ? "--quick skips the gate" : `--every ${ev.every} checks every ${ev.every}th frame`}: run without it before showing anyone)` : ""}`);
  process.exit(all === "PASS" ? 0 : all === "FAIL" ? 1 : 1);
}
