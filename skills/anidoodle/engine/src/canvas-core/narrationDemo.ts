// NARRATION DEMO. A narrated 12 s piece that shows the voice path end to end: a script read by the
// macOS voice (assets/narration/narrationDemo.json), timed by whisper.cpp, checked by a second listen,
// baked into narrationDemoVoice.ts; every visual beat cued to a spoken word with cue(), phrase
// subtitles burned in and written as .srt/.vtt, and a small composed bed that ducks under the voice.
//   words  "Every film starts as a few plain words": WORDS writes itself as "words" is said
//   code   "...draws itself in code, at 24 frames a second": CODE, then 24 lands on "24", a strip of frames runs
//   duck   "The music steps back while I speak, then comes home": two meters, MUSIC dips under VOICE and comes back on "home"
// The cuts come from the timing: each shot starts on the beat at or before its line, and the film ends on
// the first beat after the voice's tail. Re-voice the script and the picture follows; no frame is hand-set.
// Rebuild the voice: node tools/narrate.mjs all assets/narration/narrationDemo.json
import type { Ctx, Env } from "./core";
import type { Film } from "./film";
import { writeOn, measure } from "./kinetic";
import { line, type Piece } from "./music/plan";
import { filmAudio } from "./music/render";
import { cue, cueEnd, drawSubtitles, phrases, toCaptions } from "./subtitles";
import { narrationAudio, syncMarks } from "./voice";
import { narrationDemoVoice as VOICE } from "./narrationDemoVoice";

const W = 1920, H = 1080, FPS = 24, BPM = 90, BEAT = (60 / BPM) * FPS; // a beat is 16 frames
const PAPER = "#f4efe6", INK = "#1d1b26", RULE = "#cdbfa6", MUSIC = "#2f6f9f", VOX = "#c8553d";
const T = VOICE.timing, EVENTS = phrases(T, { shape: "16x9" });
const onBeat = (f: number) => Math.floor(f / BEAT) * BEAT;
const CUT1 = onBeat(cue(T, "code")), CUT2 = onBeat(cue(T, "duck")), N = Math.ceil(T.totalFrames / BEAT) * BEAT;
const ease = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };
const span = (f: number, a: number, b: number) => ease((f - a) / Math.max(1, b - a));

// the page is ruled paper drifting slowly upward, so nothing in the film is ever a still frame
const ground = (ctx: Ctx, env: Env, f: number) => {
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = RULE; ctx.lineWidth = 4; const off = (f * 2.5) % 60;
  for (let y = -off; y < H + 60; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
};
const subs = (ctx: Ctx, env: Env, f: number) => drawSubtitles(ctx, env, f, EVENTS, { highlight: true, accent: "#FFD84D" });
const centred = (ctx: Ctx, env: Env, text: string, y: number, size: number, p: number, style: "ink" | "marker" | "crayon", seed: number, color = INK) =>
  writeOn(ctx, env, text, W / 2 - measure(text, size) / 2, y, size, p, style, { seed, color });

const opening = (ctx: Ctx, local: number, env: Env) => {
  const f = local; ground(ctx, env, f);
  // a few small words drift in first, then WORDS is written as the word is spoken
  const small = ["A", "FEW", "PLAIN"], gap = 60, total = small.reduce((a, w) => a + measure(w, 70), 0) + gap * 2;
  let x = W / 2 - total / 2;
  small.forEach((w, i) => { const at = cue(T, `open:${w.toLowerCase()}`); writeOn(ctx, env, w, x, 300, 70, span(f, at - 2, at + 10), "crayon", { seed: 11 + i, color: INK }); x += measure(w, 70) + gap; });
  const w0 = cue(T, "open:words"); centred(ctx, env, "WORDS", 640, 230, span(f, w0, w0 + 26), "ink", 5);
  subs(ctx, env, f);
};
const code = (ctx: Ctx, local: number, env: Env) => {
  const f = local + CUT1; ground(ctx, env, f);
  const c0 = cue(T, "code:code"), n0 = cue(T, "code:24");
  centred(ctx, env, "CODE", 330, 170, span(f, c0 - 4, c0 + 18), "marker", 7, MUSIC);
  centred(ctx, env, "24", 640, 240, span(f, n0, n0 + 14), "ink", 9, VOX);
  // a strip of 24 frames slides by once "24" is said, one cell per film frame
  const a = span(f, n0, n0 + 8); if (a > 0) {
    ctx.globalAlpha = a; ctx.fillStyle = INK; const cw = 90, y = 720, x0 = W / 2 - 12 * cw - ((f - n0) * 6) % cw;
    for (let i = -1; i < 26; i++) { ctx.fillRect(x0 + i * cw, y, cw - 10, 64); ctx.fillStyle = PAPER; ctx.fillRect(x0 + i * cw + 12, y + 12, cw - 34, 40); ctx.fillStyle = INK; }
    ctx.globalAlpha = 1;
  }
  subs(ctx, env, f);
};
// the meters are drawn from the timing, not the sound: the voice stands up on each spoken word, the
// music stands at full height and sits down 9 dB (to 35 %) while a line is spoken, as the mix does
const speaking = (f: number) => T.lines.some((l) => f >= l.start && f < l.end);
const meters = (ctx: Ctx, local: number, env: Env) => {
  const f = local + CUT2; ground(ctx, env, f);
  const word = T.lines.flatMap((l) => l.words).find((w) => f >= w.from && f < w.to);
  const vox = word ? 0.55 + 0.4 * Math.sin(Math.PI * Math.min(1, (f - word.from + 1) / Math.max(2, word.to - word.from))) : 0.06;
  // music: down over 1 frame (40 ms), back up over 11 frames (450 ms), like the duck
  let mus = 1; for (let k = 0; k <= 11; k++) if (speaking(f - k)) { mus = 0.35 + 0.65 * (k / 11); break; }
  if (speaking(f + 1)) mus = 0.35;
  const home = cue(T, "duck:home"), bars: [string, number, string, number][] = [["MUSIC", mus, MUSIC, 700], ["VOICE", vox, VOX, 1220]];
  for (const [label, v, col, x] of bars) {
    const top = 760 - 480 * v; ctx.fillStyle = col; ctx.fillRect(x - 70, top, 140, 760 - top);
    writeOn(ctx, env, label, x - measure(label, 46) / 2, 840, 46, span(f, CUT2, CUT2 + 24), "ink", { seed: label.length, color: INK });
  }
  if (f >= home) centred(ctx, env, "HOME", 200, 110, span(f, home, cueEnd(T, "duck:home") + 6), "crayon", 13, MUSIC);
  subs(ctx, env, f);
};

// the bed: 90 bpm in D, a soft pad and a plucked line over a sub, five bars; it sits 6 dB down and ducks 9 dB more under the voice
export const narrationDemoBed = (): Piece => {
  const B = 4;
  const pad = line(0, "[D4 F#4 A4]:4 | [B3 D4 F#4]:4 | [G3 B3 D4]:4 | [A3 C#4 E4]:4 | [D4 F#4 A4]:4", { role: "accomp", v: 0.5, bpb: B });
  const pluck = line(0, "F#5:1.5 E5:.5 D5:2 | r:1 B4:1 C#5:1 D5:1 | B4:2 G4:1 A4:1 | A4:1 B4:1 C#5:1 E5:1 | D5:4", { role: "melody", v: 0.55, bpb: B });
  const sub = line(0, "D2:4 | B1:4 | G1:4 | A1:4 | D2:4", { role: "bass", v: 0.6, bpb: B });
  return {
    title: "Narration demo bed (D major, 90 bpm)", seed: 41, tail: 2,
    harmony: [[0, "D"], [4, "Bm"], [8, "G"], [12, "A"], [16, "D"]].map(([t, name]) => ({ t: t as number, name: name as string })),
    plan: { style: "lofiElectronic", tempo: BPM, meter: "4/4", sections: [{ id: "a", bars: 5, mood: "hopeful", key: "D", mode: "major", melody: ["hook"], dyn: [0.5, 0.6], ending: "tail" }] },
    parts: [
      { id: "pad", inst: "warmPad", role: "accomp", notes: pad, gainDb: -4, opts: { cut: 2400, attack: 0.4, release: 1.2, spread: 0.5 } },
      { id: "pluck", inst: "softPluck", role: "melody", notes: pluck, gainDb: -2 },
      { id: "sub", inst: "sub", role: "bass", notes: sub, gainDb: -3 },
    ],
  };
};

export const narrationDemo: Film = {
  meta: {
    title: "narration · demo", W, H, fps: FPS, bpm: BPM, durationFrames: N, raster: "cpu", kind: "explainer", poster: cue(T, "code:24") + 14,
    captions: toCaptions(EVENTS, FPS), sync: syncMarks(T),
    score: { tempo: BPM, form: "5 bars, cut to the film: pad, pluck, sub", grid: true },
  },
  assets: { images: {} },
  shots: [
    { id: "words", start: 0, end: CUT1, draw: opening },
    { id: "code", start: CUT1, end: CUT2, draw: code },
    { id: "duck", start: CUT2, end: N, draw: meters },
  ],
  audio: narrationAudio({ voice: VOICE, music: filmAudio(narrationDemoBed(), N / FPS), frames: N, musicDb: -6, depthDb: -9 }),
};
