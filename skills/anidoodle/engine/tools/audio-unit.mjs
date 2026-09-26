#!/usr/bin/env node
import { strict as assert } from "node:assert";
import { build } from "esbuild";
import { join } from "node:path";
const src = join(import.meta.dirname, "../src/canvas-core/music/index.ts");
const js = (await build({ entryPoints: [src], bundle: true, write: false, platform: "neutral", format: "esm" })).outputFiles[0].text;
const M = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const sr = 16000, fps = 25, frames = 100;
const base = { fps, frames, cues: [] };
for (const invalid of [
  { frame: -1, kind: "click" }, { frame: frames, kind: "impact" }, { frame: 10.4, kind: "impact" },
  { frame: 20, kind: "whoosh", lengthFrames: 0 }, { frame: 20, kind: "ink", strength: -0.1 },
  { frame: 20, kind: "paper", pan: 1.2 }, { frame: 20, kind: "paper", pitch: 0 },
]) assert.throws(() => M.renderSound({ ...base, cues: [invalid] }, sr));
assert.throws(() => M.renderSound({ ...base, ambience: { level: Infinity } }, sr));
assert.throws(() => M.renderSound({ ...base, duckDb: -1 }, sr));
for (const kind of ["impact", "click", "flutter", "ink", "paper", "whoosh", "riser"]) {
  const c = { frame: 50, kind, lengthFrames: 25, strength: 0.7 }, plan = { ...base, cues: [c] };
  const a = M.renderSound(plan, sr), b = M.renderSound(plan, sr);
  const buf = kind === "whoosh" || kind === "riser" ? a.transition : a.foley;
  const buf2 = kind === "whoosh" || kind === "riser" ? b.transition : b.foley;
  const onset = M.frameSample(M.cueStart(c, fps), fps, sr);
  assert.equal(buf[0][onset - 1], 0);
  let loud = 0; for (let i = onset; i < Math.min(onset + (kind === "whoosh" || kind === "riser" ? sr : 1000), buf[0].length); i++) loud = Math.max(loud, Math.abs(buf[0][i]));
  assert(loud > 0.001, `${kind} inaudible`);
  for (let i = 0; i < buf[0].length; i++) assert.equal(buf[0][i], buf2[0][i], `${kind} not deterministic`);
}
const first = { frame: 50, kind: "paper" }, earlier = { frame: 5, kind: "click" };
const single = M.renderSound({ ...base, cues: [first] }, sr).foley[0];
const withEarlier = M.renderSound({ ...base, cues: [earlier, first] }, sr).foley[0];
for (let i = M.frameSample(50, fps, sr); i < single.length; i++) assert.equal(single[i], withEarlier[i], "cue seed depends on array position");
const p = { fps, frames, cues: [{ frame: 0, kind: "click" }, { frame: 99, kind: "impact" }] };
assert.equal(M.renderSound(p, sr).foley[0].length, sr * 4);
assert.equal(M.filmSound(null, p)(sr)[0].length, sr * 4);
for (const mk of [M.lofiBeat, M.synthPopHouse, M.brokenBeat, M.ambientElectronic]) assert.deepEqual(M.planProblems(mk()), [], `${mk.name}: plan warnings`);
console.log("audio unit: invalid plan bounds, seven deterministic cues, frame boundaries, foley-only, four score plans PASS");
