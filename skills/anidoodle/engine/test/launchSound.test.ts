// LAUNCH SOUND TESTS. The template's sound cues come from the picture's own timing: a key per typed
// character, the press on the frame Generate goes down, the drop and its bloom, the card landing on
// its spring's first arrival, each panned to where it happens on screen; one riser and one impact at
// the big reveal and nothing on the other cuts; every cue heard over a real score.
import { makeLaunchFilm } from "../src/canvas-core/launchTemplate";
import { mixLaunch, panOf } from "../src/canvas-core/launchSound";
import { springLand } from "../src/canvas-core/productUI";
import type { Material } from "../src/canvas-core/music";
import type { Film } from "../src/canvas-core/film";

export const name = "launchSound";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const plate: Film = { meta: { title: "plate", W: 1080, H: 1080, fps: 30, bpm: 90, durationFrames: 60 }, assets: { images: {} }, shots: [{ id: "p", start: 0, end: 60, draw: () => {} }] };
  const mine = (): Material => ({
    style: "playful", title: "Tally, counted", seed: 5, mood: "curious", bpm: 90, key: "G", mode: "mixolydian",
    chords: { G: { voicing: "[D4 G4 B4]", bass: "G2:1.5 D3:.5 G2:1 F2:1" }, F: { voicing: "[C4 F4 A4]", bass: "F2:1.5 C3:.5 F2:1 E2:1" } },
    motifs: { a: "B4:.5 D5:.5 G5:1 r:.5 F5:.25 E5:.25 D5:1", b: "r:1 A4:.5 C5:.5 F5:1 E5:.5 C5:.5" },
    grooves: { main: { family: "shuffle", density: 0.45, variation: 0.35 } },
    sections: [{ kind: "groove", bars: 4, harmony: ["G", "F"], lead: ["a", "b", "a", "b"], groove: "main", stretch: true }, { kind: "outro", bars: 1, harmony: ["G"], lead: ["a"] }],
  });
  const prompts = ["a lighthouse at sunset", "now a fox at dusk"];
  const spec = { title: "Tally", asks: prompts.map((p) => ({ prompt: p, plate, label: "l" })), words: [[{ text: "IDEA IN.", style: "ink" as const, color: "#000" }]], tagline: "t", install: ["npm i tally"], bpm: 90, askBeats: 6, endBeats: 8, claimBar: 5, score: mine };
  const f = makeLaunchFilm(spec), cues = f.cues, at = (c: number) => Math.round(f.cut.cutOf(c));
  const by = (r: string) => cues.filter((c) => c.role === r);

  // keys: one per character typed on screen (the first prompt is under way at frame 0: only what is typed
  // after it; a later prompt starts as its composer travels in, and those keys are on screen and heard)
  const typed = f.timing.reduce((a, t) => a + t.times.filter((x) => x >= 0).length, 0);
  ok(by("key").length === typed, `a key cue for every character typed on screen (${by("key").length} of ${typed})`);
  const spaces = prompts.join("").split("").filter((c) => c === " ").length;
  ok(by("key").filter((c) => c.variant === "space").length <= spaces && by("key").some((c) => c.variant === "space"), "the space bar has its own sound");
  ok(f.timing.every((t, i) => by("key").filter((c) => c.frame >= at(t.base) && c.frame < at(t.base + t.len)).every((c, j, a) => j === 0 || c.frame >= a[j - 1].frame)), "keys land in typing order");
  // the press, the drop, the bloom, the landing: on the frames the picture does them
  f.timing.forEach((t, i) => {
    ok(by("press")[i]?.frame === at(t.base + t.down), `ask ${i}: the press is on the frame Generate goes down (${by("press")[i]?.frame})`);
    ok(by("drop")[i]?.frame === at(t.base + t.drop.t0) && by("bloom")[i]?.frame === at(t.base + t.drop.land), `ask ${i}: the drop lifts and blooms on its frames (${by("drop")[i]?.frame}, ${by("bloom")[i]?.frame})`);
    ok(by("land")[i]?.frame === at(springLand(t.base + t.drop.land, 4.163 / 21, 0.8)), `ask ${i}: the card lands on its spring's first arrival (${by("land")[i]?.frame})`);
  });
  // pan by screen x: Generate is right of centre, the answer card left of it (16x9)
  ok(by("press").every((c) => panOf(c.x, 1920) > 0.1) && by("bloom").every((c) => panOf(c.x, 1920) < -0.1), `panned to where it happens: press ${by("press").map((c) => panOf(c.x, 1920).toFixed(2)).join(", ")}, bloom ${by("bloom").map((c) => panOf(c.x, 1920).toFixed(2)).join(", ")}`);
  ok(cues.every((c) => c.x === undefined || (c.x >= 0 && c.x <= 1920)), "every cue's screen x is on screen");
  // restraint: one riser and one impact, at the big reveal only; no whoosh or swish at all; nothing on a type frame's cuts
  const reveal = f.cut.STARTS[f.cut.SEGS.length - 1];
  ok(by("riser").length === 1 && by("impact").length === 1 && by("riser")[0].frame === reveal && by("impact")[0].frame === reveal, `one riser and one impact, both at the reveal (frame ${reveal})`);
  ok(!cues.some((c) => c.kind === "whoosh" || c.kind === "swish"), "no whoosh or swish anywhere");
  const typeCuts = f.cut.SEGS.flatMap((s, k) => (s.kind === "type" ? [f.cut.STARTS[k], f.cut.STARTS[k] + s.len] : []));
  ok(typeCuts.length > 0 && !cues.some((c) => typeCuts.some((x) => Math.abs(c.frame - x) <= 2)), `nothing on the cuts into or out of a word page (${typeCuts.join(", ")})`);
  ok(!cues.some((c) => f.cut.SEGS.some((s, k) => s.kind === "type" && c.frame > f.cut.STARTS[k] && c.frame < f.cut.STARTS[k] + s.len)), "word pages are silent (no cue inside a type frame)");

  // every cue heard over a real score, the mix under -1 dBTP
  const [L, R] = f.audio!(48000);
  ok(L.length === Math.round((f.meta.durationFrames / 30) * 48000) && L.length === R.length, `the mix is the film's length (${(L.length / 48000).toFixed(2)} s)`);
  const bed = makeLaunchFilm({ ...spec, sfx: false }).audio!(48000);
  const mix = mixLaunch(bed, { fps: 30, frames: f.meta.durationFrames, W: 1920, cues, bpm: 90, seed: 7, key: "G" }, 48000);
  ok(mix.ok, `every cue audible over the score (${mix.audibility.length} cues, worst margin ${Math.min(...mix.audibility.map((a) => a.marginDb)).toFixed(1)} dB vs floor -6; ${mix.raised.length} raised)`);
  ok(mix.dbtp <= -1, `the mix's true peak is under the ceiling (${mix.dbtp.toFixed(2)} dBTP)`);
  const quiet = mixLaunch(bed, { fps: 30, frames: f.meta.durationFrames, W: 1920, cues: cues.map((c) => ({ ...c, gainDb: -30 })), bpm: 90, seed: 7, key: "G" }, 48000, 0);
  ok(!quiet.ok, "a cue buried 30 dB under the score is caught, not shipped");

  // one timeline at 60 fps: the same cues on the same instants, twice the frames
  const f60 = makeLaunchFilm({ ...spec, fps: 60 });
  ok(f60.meta.durationFrames === 2 * f.meta.durationFrames && f60.cues.length === cues.length && f60.cues.every((c, i) => Math.abs(c.frame - 2 * cues[i].frame) <= 1), `60 fps: ${f60.meta.durationFrames} frames, every cue on the same instant (within one 60 fps frame)`);
  // sync markers: the presses and the impact, for verify-export's audio-to-video check
  ok(f.meta.sync!.length === 3 && f.meta.sync!.every((s) => cues.some((c) => c.frame === s.frame && (c.role === "press" || c.role === "impact"))), `sync markers are the presses and the impact (${f.meta.sync!.map((s) => s.frame).join(", ")})`);
  // sfx: false leaves the score alone; a silent film still gets its cues (sound design without music)
  ok(makeLaunchFilm({ ...spec, sfx: false }).cues.length === 0, "sfx: false emits no cues");
  const silent = makeLaunchFilm({ ...spec, score: null });
  ok(silent.cues.some((c) => c.role === "riser" && c.variant === "air") && typeof silent.audio === "function", "a film with no score still has its cues (the riser untuned: air)");
};
