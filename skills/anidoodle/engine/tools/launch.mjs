// LAUNCH. The launch film's two commands: start one, and ship it in every shape.
//
//   node tools/launch.mjs new <name> [--preset drawn|clean]
//       writes src/canvas-core/<name>.ts (a launch template spec to fill from the brief: every line
//       that must come from the product is marked TODO) and its host page src/hosts/page-<name>.ts,
//       and an empty facts.json beside the project (kept if one is there) for the claims and their sources.
//       It renders as it is (placeholder plates and UI), so the pipeline can be proved before the art.
//
//   node tools/launch.mjs ship <name> [--shapes 16x9,1x1,4x5,9x16] [--blur auto] [--shutter 180]
//                                     [--poster-frame N] [--gate] [--zones warn]
//       for each shape, from ONE timeline (launchLayout re-composes it, never a crop):
//         1 render   out/<name>-<shape>.mp4 (render.mjs; --blur/--shutter/--poster-frame pass through)
//         2 poster   out/<name>-<shape>.poster.png, the film's own legible frame (meta.poster: the end card)
//         3 captions out/<name>-<shape>.srt and .vtt (the sidecar; captions: "burn" also burns them in)
//         4 verify   verify-export --delivery: size, frame count, duration, the score, the sync of every
//                    marker, the true peak after the encode, a legible frame 0
//         5 frame    framecheck.mjs: no text and no card or window cut by the frame's edge, every frame;
//                    each text cue up for max(0.7 s, 0.3 s per word) (N/A without cues); on 9:16 no text in
//                    the platforms' top, bottom or right-hand zones (it fails the shape; --zones warn only flags it)
//         6 gate     with --gate: gate.mjs (determinism, contract, dead air) on the rendered file
//       and once for the film, before the shapes: facts.mjs, every claim it makes is listed in facts.json
//       with its source (a film that makes no claims is N/A). Then one table. Exit 1 if anything fails.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { knownFilms, requireFilm, SHAPE_NAMES } from "./names.mjs";
import { filmMeta, loadFilm, writeCaptions } from "./captions.mjs";
import { checkFacts, claimsOf } from "./factsrules.mjs";
import { factsFile, initFacts, readFacts } from "./facts.mjs";

const [cmd, name, ...rest] = process.argv.slice(2);
const arg = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : d; };
const die = (m) => { console.error(`launch: ${m}`); process.exit(2); };
const USAGE = "node tools/launch.mjs new <name> [--preset drawn|clean]\n       node tools/launch.mjs ship <name> [--shapes 16x9,1x1,4x5,9x16] [--blur auto] [--shutter 180] [--poster-frame N] [--gate] [--zones warn]";

const DRAWN = (n) => `// ${n}: a launch film on the template (references/workflows/launch-video-kit.md).
// Fill every TODO from the sourced brief (references/workflows/launch-video.md, "Ground it in the real
// product first"): the words on screen quote the brief, never memory. The plates below are STAND-INS
// (anidoodle's stock plates) so the film renders today; replace each with a plate drawn for YOUR
// product's subject, in the style the brief chose (references/styles.md).
// Every claim the film makes (the words, the tagline) is listed in facts.json with its source sentence
// and URL or file, or labelled generated (references/workflows/facts.md); ship checks it.
//   node tools/still.mjs ${n}-9x16 --frames 0,120,330 --sheet out/${n}-9x16.jpg   one look per shape, one browser
//   node tools/launch.mjs ship ${n} --shapes 16x9,1x1,9x16
import { C } from "./launchKit";
import { makeLaunchFilm } from "./launchTemplate";
import { lighthouseDraw } from "./lighthouseDraw"; // TODO: your plate
import { foxDraw } from "./foxDraw";               // TODO: your plate

export const ${n} = makeLaunchFilm({
  title: "TODO Product",                         // the exact product name
  subtitle: "TODO the one line it lives by",
  placeholder: "Ask for anything…",
  // THE LOOK: your product's own, field by field (launch-video-kit.md, Looks). Uncomment what you need;
  // every field is optional and the base's value stands for the rest. launchExampleBrand.ts is a worked example.
  // look: {
  //   base: "drawn",                              // a registered look: "drawn" or "clean" (or one you registerLook)
  //   from: brandJson,                             // import brandJson from "../../brand/brand.json" (node tools/brand.mjs import): fills palette, logo
  //   palette: { bg: "#rrggbb", card: "#rrggbb", ink: "#rrggbb", soft: "#rrggbb", mute: "#rrggbb", line: "#rrggbb", chip: "#rrggbb", accent: "#rrggbb", accentDeep: "#rrggbb", paper: "#rrggbb" }, // checked for contrast (WCAG AA)
  //   fonts: { display: { family: "Your Serif", file: yourSerif }, text: { family: "Your Sans", file: yourSans } }, // import yourSans from "../../assets/fonts/YourSans.ttf" (a local .ttf, no network)
  //   shape: { radius: 12, bubble: "rounded", composer: "box", button: "pill", buttonLabel: "Send" }, // bubble rounded|square|none, composer box|bar, button pill|square
  //   chat: { header: true, title: "Product", subtitle: "its line", logo: undefined, bubble: { fill: "#rrggbb", ink: "#rrggbb" }, reply: { fill: "#rrggbb", ink: "#rrggbb" } },
  // },
  asks: [
    { prompt: "TODO what a user types", plate: lighthouseDraw, label: "TODO the card's byline" },
    { prompt: "TODO the follow-up", plate: foxDraw, label: "TODO byline" },
  ],
  words: [[{ text: "TODO CLAIM.", style: "ink", color: C.ink }, { text: "TODO PROOF.", style: "ink", color: C.accent }]],
  tagline: "TODO one sentence that says what it is",
  install: ["TODO the exact install line"],       // shown exactly as given, held 3 s or more
  footer: "TODO where it lives",
  bpm: 90,                                         // TODO the tempo of the score composed for this brief
  // THE DECLARATIONS ship reads (node tools/ship.mjs): a check with nothing declared cannot look, and
  // a check that cannot look fails. Fill each from the brief (launchExample.ts is a worked example).
  motion: {
    temperament: "calm",                           // TODO how the brand moves: "calm", "lively" or "snappy"
    brandColors: [C.accent],                // TODO the brand's own colours, #rrggbb (no see-through fills in them; the drawn look's ink is its pen, not a brand colour unless yours is ink)
  },
  claims: [],                                     // TODO every claim beyond the words and tagline (a real number on screen), each in facts.json
  checks: { length: { target: 30, max: 45 } },     // TODO the length budget in seconds: over max fails, over target flags
  // the review is yours: a fresh critic's findings go in reviews/${n}.json (references/workflows/review.md)
  askBeats: 6, typeBeats: 6, endBeats: 8, claimBar: 5,
  score: null,                                     // TODO the score composed for this product (references/music/compose.md; launchExampleScore.ts is a worked example)
  sfx: false,                                      // TODO true once the score is in: the sound cues ride the score, and alone they are clicks on silence (soundcheck fails their loudness)
});
`;
const CLEAN = (n) => `// ${n}: a UI-first launch film on the template, in the clean preset (a quiet canvas, one accent,
// type as the design). Fill every TODO from the sourced brief and list each claim in facts.json
// (references/workflows/facts.md); the UI data below is a STAND-IN:
// replace it with your product's real screens and states (references/workflows/launch-video-kit.md).
//   node tools/launch.mjs ship ${n} --shapes 16x9,9x16
import { makeLaunchFilm } from "./launchTemplate";
import type { ProductUI } from "./productUI";

// (the stand-in is three plain rows on purpose, and the split beat shows it without its command bar: it renders
// and ships as it is. Your real screen will have more on it,
// its nav, its figures, its tags; a frame of it over 7 text blocks is dense, and framecheck says so: declare
// those beats in checks.layoutExempt below once you see them)
const main: ProductUI = {                          // TODO your product's own UI, its before and after
  title: "TODO", action: "TODO action",
  before: { items: [{ id: "a", label: "TODO first item", tag: "TODO" }, { id: "b", label: "TODO second item" }, { id: "c", label: "TODO third item" }] },
  after: { items: [{ id: "b", label: "TODO second item", done: true, accent: true }, { id: "a", label: "TODO first item", tag: "TODO", done: true }, { id: "c", label: "TODO third item", done: true }] },
};

export const ${n} = makeLaunchFilm({
  title: "TODO Product", preset: "clean", fps: 60,
  // THE LOOK: your product's own, field by field (launch-video-kit.md, Looks). Uncomment what you need;
  // every field is optional and the base's value stands for the rest. launchExampleBrand.ts is a worked example.
  // look: {
  //   base: "clean",                              // a registered look (preset: "clean" above is its shorthand; keep one of the two)
  //   from: brandJson,                             // import brandJson from "../../brand/brand.json" (node tools/brand.mjs import): fills palette, logo
  //   palette: { bg: "#rrggbb", card: "#rrggbb", ink: "#rrggbb", soft: "#rrggbb", mute: "#rrggbb", line: "#rrggbb", chip: "#rrggbb", accent: "#rrggbb", accentDeep: "#rrggbb", paper: "#rrggbb" }, // checked for contrast (WCAG AA)
  //   fonts: { display: { family: "Your Serif", file: yourSerif }, text: { family: "Your Sans", file: yourSans } }, // import yourSans from "../../assets/fonts/YourSans.ttf" (a local .ttf, no network)
  //   shape: { radius: 12, bubble: "rounded", composer: "box", button: "pill", buttonLabel: "Send" }, // bubble rounded|square|none, composer box|bar, button pill|square
  //   chat: { header: true, title: "Product", subtitle: "its line", logo: undefined, bubble: { fill: "#rrggbb", ink: "#rrggbb" }, reply: { fill: "#rrggbb", ink: "#rrggbb" } },
  // },
  asks: [
    { kind: "ui", ui: { ...main, command: "TODO Ask…" }, prompt: "TODO what a user asks the product" }, // the ask typed into its command bar
    { kind: "ui", ui: main, split: [{ text: "TODO the feature,", style: "ink", color: "#15161a" }, { text: "in five words.", style: "ink", color: "#2f54eb" }] }, // TODO the feature in about five words
  ],
  words: [[{ text: "TODO CLAIM.", style: "ink", color: "#15161a" }]],
  tagline: "TODO one sentence that says what it is",
  install: ["TODO the exact install line"],
  footer: "TODO where it lives",
  // THE DECLARATIONS ship reads (node tools/ship.mjs): a check with nothing declared cannot look, and
  // a check that cannot look fails. Fill each from the brief (launchExampleClean.ts is a worked example).
  motion: {
    temperament: "calm",                           // TODO how the brand moves: "calm", "lively" or "snappy"
    brandColors: ["#15161a", "#2f54eb"],         // TODO the brand's own colours, #rrggbb (no see-through fills in them)
  },
  claims: [],                                     // TODO every claim beyond the words and tagline (a real number on screen), each in facts.json
  checks: {
    length: { target: 30, max: 45 },               // TODO the length budget in seconds: over max fails, over target flags
    // a product screen dense with rows is the point of its beat, not a layout fault: once you see the beats,
    // declare each as [from, to, "why"] in film frames (ship's frame row names them; launchExampleClean.ts shows how)
    // layoutExempt: [[0, 330, "TODO the first ask shows the product's whole inbox: dense UI is the subject"]],
  },
  // the review is yours: a fresh critic's findings go in reviews/${n}.json (references/workflows/review.md)
  // (claimBar 6: the split beat's words need their reading time before the end card; the template says so if not)
  bpm: 90, askBeats: 6, typeBeats: 6, endBeats: 8, claimBar: 6,
  score: null,                                     // TODO the score composed for this product (launchExampleCleanScore.ts is a worked example)
  sfx: false,                                      // TODO true once the score is in: the sound cues ride the score, and alone they are clicks on silence (soundcheck fails their loudness)
});
`;

if (cmd === "new") {
  if (!name || !/^[A-Za-z_$][\w$]*$/.test(name)) die(`'${name ?? ""}' is not a film name (a JS identifier, e.g. myLaunch)\nusage: ${USAGE}`);
  const src = resolve(`src/canvas-core/${name}.ts`), host = resolve(`src/hosts/page-${name}.ts`), preset = arg("preset", "drawn");
  if (!["drawn", "clean"].includes(preset)) die(`--preset is drawn or clean, got '${preset}'`);
  if (existsSync(src) || existsSync(host) || knownFilms().includes(name)) die(`${name} already exists; pick another name (never overwritten)`);
  writeFileSync(src, (preset === "clean" ? CLEAN : DRAWN)(name));
  writeFileSync(host, `import { ${name} } from "../canvas-core/${name}";\nimport { mountFilm } from "./page";\n\nmountFilm(${name});\n`);
  const made = initFacts(resolve("facts.json"));
  console.log(`new launch film: ${src}\n            host: ${host}\n           facts: ${resolve("facts.json")}${made ? "" : " (already there, kept)"}\nnext: fill the TODOs from the brief and list every claim in facts.json, then\n  node tools/still.mjs ${name} --frames 0,120,330 --sheet out/${name}.jpg\n  node tools/launch.mjs ship ${name} --shapes 16x9,9x16`);
  process.exit(0);
}
if (cmd !== "ship") die(`unknown command '${cmd ?? ""}'\nusage: ${USAGE}`);

const film = requireFilm(name, "launch ship", USAGE);
const shapes = String(arg("shapes", "16x9")).split(",").map((s) => s.trim()).filter(Boolean);
const bad = shapes.filter((s) => !SHAPE_NAMES.includes(s)); if (bad.length || !shapes.length) die(`--shapes wants ${SHAPE_NAMES.join(", ")}, got '${arg("shapes")}'`);
const pass = ["blur", "shutter", "poster-frame", "blur-max", "blur-px"].flatMap((k) => (arg(k) !== undefined ? [`--${k}`, arg(k)] : []));
const node = (args) => spawnSync(process.execPath, args, { stdio: "inherit" }).status === 0;
const quiet = (args) => { const r = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 1 << 26 }); return { ok: r.status === 0, out: (r.stdout ?? "") + (r.stderr ?? "") }; };
mkdirSync(resolve("out"), { recursive: true });
const zoneMode = arg("zones", "fail"); if (!["fail", "warn"].includes(zoneMode)) die(`--zones is fail or warn, got '${zoneMode}'\nusage: ${USAGE}`);
const rows = [];
const fx = readFacts(factsFile(film)), factsRes = fx.error ? { status: "FAIL", checked: 0, problems: [{ claim: "(facts.json)", why: fx.error }] } : checkFacts(claimsOf(await loadFilm(film)), fx.facts);
console.log(`\nFACTS ${film}: ${factsRes.status}${factsRes.status === "N/A" ? `   ${factsRes.reason}` : `   ${factsRes.checked} claim(s)`}`);
for (const p of factsRes.problems) console.log(`  FAIL  "${p.claim.slice(0, 60)}" ${p.why}`);
for (const sh of shapes) {
  const f = `${film}-${sh}`, mp4 = `out/${f}.mp4`, row = { shape: sh, mp4, render: false, poster: "", captions: 0, verify: "", frame: "", gate: "" };
  console.log(`\n==================== ${f} ====================`);
  row.render = node(["tools/render.mjs", f, ...pass]);
  if (row.render) {
    const meta = await filmMeta(f), pf = meta.poster ?? Math.max(0, meta.durationFrames - 1), png = `out/${f}.poster.png`;
    row.poster = quiet(["tools/still.mjs", f, "--frame", String(pf), "--out", png]).ok ? `${png} (frame ${pf})` : "FAIL";
    row.captions = (await writeCaptions(f)).count;
    const v = quiet(["tools/verify-export.mjs", f, "--file", mp4, "--delivery"]); console.log(v.out.split("\n").filter((l) => /FAIL|PASS  (frame|true peak|decoded)|VERIFY-EXPORT/.test(l)).join("\n"));
    row.verify = (v.out.match(/VERIFY-EXPORT: (PASS|FAIL)[^\n]*/) ?? ["", "FAIL"])[0].replace("VERIFY-EXPORT: ", "");
    const fc = quiet(["tools/framecheck.mjs", f, "--zones", zoneMode]); row.frame = (fc.out.match(/FRAMECHECK: (PASS|FAIL)[^\n]*/) ?? ["", "FAIL"])[0].replace("FRAMECHECK: ", ""); console.log(fc.out.split("\n").filter((l) => /FAIL|FLAG/.test(l) && !/^FRAMECHECK/.test(l)).slice(0, 12).join("\n"));
    if (rest.includes("--gate")) { const g = quiet(["tools/gate.mjs", f, "--mp4", mp4]); row.gate = (g.out.match(/GATE: (PASS|FAIL)[^\n]*/) ?? [g.ok ? "PASS" : "FAIL"])[0]; if (!g.ok) console.log(g.out.split("\n").filter((l) => /FAIL/.test(l)).join("\n")); }
  }
  rows.push(row);
}
console.log(`\nSHIP ${film}\n  facts  ${factsRes.status}${factsRes.status === "N/A" ? ` (${factsRes.reason})` : ` ${factsRes.checked} claim(s)${factsRes.problems.length ? `, ${factsRes.problems.length} problem(s)` : ""}`}`);
for (const r of rows) console.log(`  ${r.shape.padEnd(5)} ${r.render ? r.mp4 : "RENDER FAILED"}\n        verify ${r.verify || "-"}\n        frame  ${r.frame || "-"}${r.gate ? `\n        gate   ${r.gate}` : ""}\n        poster ${r.poster || "-"}   captions ${r.captions} cues -> out/${film}-${r.shape}.srt/.vtt`);
const ok = factsRes.status !== "FAIL" && rows.every((r) => r.render && /^PASS/.test(r.verify) && /^PASS/.test(r.frame) && r.poster !== "FAIL" && (!r.gate || /PASS/.test(r.gate)));
console.log(ok ? `\nSHIP: PASS  ${rows.length} shape(s)` : "\nSHIP: FAIL");
process.exit(ok ? 0 : 1);
