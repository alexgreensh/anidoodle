// LAUNCH, CUT 3. Alex on cut 2: "every frame has ugly text overlaying visual elements... text must be
// a frame: white, big animated text, then the show." So the words never sit on the art. Cut 3 is
// cut 2's pictures (launch2.content2, all type removed) spliced with TYPE FRAMES: a sheet of paper
// sweeps in over the picture, one big word letters itself on in its own medium, and the paper sweeps
// off to reveal the next scene. (Chosen: the ink bloom, and every word in ink.) 29 bars of the score (launchLofi3), 77 s.
import type { Ctx, Env } from "./core";
import type { Film } from "./film";
import { C, frozenNone } from "./launchKit";
import { content2, SFX2, T2, WEB_SKIP } from "./launch2";
import { logoBug } from "./kinetic";
import { beatGrid, makeCut, pic, type, typeFrame, type Seg, type TypeSeg } from "./launchCut";
import { launchLofi3 } from "./music/pieces/launch";
import { renderPiece } from "./music/render";
import { rng } from "./core";

const W = 1920, H = 1080, FPS = 30;
// The cut is data (launchCut.ts): pic(from, to, len) plays a span of content2, type(...) is a full-frame
// word page. Re-timing the film is an edit to HEAD, never to scene code.
// Alex on cut 3: gentler pacing; ANIMATIONS before the swim request; the koi-and-code beat much
// shorter; the embroidery long enough to see; the site from Bit's hero on. The film beat's length is
// solved so "All in pure code." (content T2.words[0] + 140) lands on bar 26, the score's home chord.
const WEB_FROM = T2.web[0] + 10, WEB_LEN = 360 - WEB_SKIP;
const HEAD: Seg[] = [
  pic(0, 200),
  pic(200, 360, 90), // the koi and its code, twice as fast
  type([{ text: "NO IMAGE MODEL.", style: "ink", color: C.ink }, { text: "JUST CODE.", style: "ink", color: C.accent }], 64, 359, 360),
  pic(360, 372),
  type([{ text: "ANIMATIONS", style: "ink", color: C.ink }], 50, 371, 372),
  pic(372, 560),
  type([{ text: "31 STYLES", style: "ink", color: C.ink }], 50, 559, 570),
  pic(570, 800),
  pic(800, 1040, 200),
  pic(1040, 1200),
  type([{ text: "LOOPS", style: "ink", color: C.ink }], 50, 1199, 1200),
  pic(1200, 1360),
  type([{ text: "INTERACTIVE", style: "ink", color: C.ink }], 50, 1359, WEB_FROM),
  pic(WEB_FROM, WEB_FROM + WEB_LEN),
  type([{ text: "FILMS", style: "ink", color: C.ink }], 60, WEB_FROM + WEB_LEN - 1, T2.film[0]),
];
// the claim lands on bar 26 (the score's home chord): the film beat takes whatever is left
const headLen = HEAD.reduce((a, s) => a + s.len, 0), FILM_LEN = beatGrid(90, FPS).solve(26, 140 + headLen, 90);
const SEGS: Seg[] = [...HEAD, pic(T2.film[0], T2.film[1], FILM_LEN), pic(T2.words[0], T2.words[1]), pic(T2.end[0], T2.end[1]), pic(T2.end[1] - 1, T2.end[1], 60)];
const CUT = makeCut(SEGS), { STARTS, at, contentOf } = CUT;
export const N3 = CUT.N;
// a content frame, mapped to the cut (for the sound events); events inside a cut-away go to its start
export const cutOf = CUT.cutOf;

// ---------------------------------------------------------------- a type frame
const IN = 14, OUT = 14; // gentle: the bloom opens and closes over half a second
// Alex's pick: B, the ink bloom. The Generate drop's own ink blooms from the centre over the picture,
// the page is inside the bloom, the word is written on it in ink by the pointed pen, and the ink
// shrinks back to a point to show the next scene.
const drawType = (ctx: Ctx, env: Env, s: TypeSeg, local: number, F: number) =>
  typeFrame(ctx, env, s.lines, local, s.len, (first) => content2(ctx, env, first ? s.before : s.after), (c) => logoBug(c, env, F, 1700, 1040, 0.9, { t0: -100, fps: FPS }), { inF: IN, outF: OUT });

// ---------------------------------------------------------------- the sound
const audio3 = (sr: number): [Float32Array, Float32Array] => {
  const n = Math.round((N3 / FPS) * sr), L = new Float32Array(n), R = new Float32Array(n), m = renderPiece(launchLofi3(), sr);
  for (let i = 0; i < n && i < m.L.length; i++) { L[i] = m.L[i]; R[i] = m.R[i]; }
  const fade = Math.round(1.2 * sr); for (let i = 0; i < fade; i++) { const g = i / fade; L[n - 1 - i] *= g; R[n - 1 - i] *= g; }
  const r = rng(4242), add = (fr: number, len: number, fn: (s: number) => number, gain: number, pan = 0) => { if (fr < 0) return; const i0 = Math.round((fr / FPS) * sr); for (let i = 0; i < len * sr && i0 + i < n; i++) { const v = fn(i / sr) * gain; L[i0 + i] += v * (1 - Math.max(0, pan)); R[i0 + i] += v * (1 + Math.min(0, pan)); } };
  const click = (fr: number) => { const f0 = 2600 + r() * 1400, ph = r() * 6; add(fr, 0.03, (s) => Math.sin(2 * Math.PI * f0 * s + ph) * Math.exp(-s / 0.004) + (r() - 0.5) * Math.exp(-s / 0.002) * 0.6, 0.05, (r() - 0.5) * 0.4); };
  const thock = (fr: number) => add(fr, 0.14, (s) => Math.sin(2 * Math.PI * (70 + 90 * Math.exp(-s / 0.02)) * s) * Math.exp(-s / 0.05), 0.2);
  const plip = (fr: number) => add(fr, 0.16, (s) => Math.sin(2 * Math.PI * (320 + 700 * Math.exp(-s / 0.03)) * s) * Math.exp(-s / 0.06), 0.12);
  const whoosh = (fr: number, len = 0.4, g = 0.5) => { let z = 0; add(fr, len, (s) => { z += 0.14 * ((r() - 0.5) - z); return z * Math.sin((Math.PI * s) / len) ** 2; }, g); };
  const scratch = (fr: number, len: number, g = 0.05) => { let z = 0; add(fr, len, (s) => { z += 0.5 * ((r() - 0.5) - z); return z * (0.6 + 0.4 * Math.sin(s * 70)) * Math.min(1, s * 20) * Math.min(1, (len - s) * 20); }, g); };
  const e = SFX2();
  e.clicks.forEach((c) => click(cutOf(c))); e.thocks.forEach((c) => thock(cutOf(c))); e.plips.forEach((c) => plip(cutOf(c)));
  e.punches.forEach((c) => whoosh(cutOf(c), 0.3, 0.4)); whoosh(cutOf(e.flip), 0.3, 0.4); whoosh(cutOf(T2.brick[0] + 120), 0.9); whoosh(cutOf(T2.hand[0]), 0.5);
  scratch(2, 1.6);
  SEGS.forEach((s, i) => { if (s.kind !== "type") return; whoosh(STARTS[i], 0.32, 0.55); s.lines.forEach((_, k) => scratch(STARTS[i] + IN - 2 + k * 10, 0.6, 0.07)); whoosh(STARTS[i] + s.len - OUT, 0.32, 0.55); });
  return [L, R];
};

// ---------------------------------------------------------------- holds (the approved cut, reviewed frame by frame)
// Every stretch the dead-air gate measures as still, looked at on a contact sheet and named. HOLDS are
// meant: something is being read or watched. ACCEPTED are the four stretches the review flagged; Alex
// approved the film as shipped, so they are declared holds with that reason (pixels and audio unchanged).
const HOLDS3: [number, number, string?][] = [
  // every word page: the bloom opens, the word is written, it is read, the bloom closes onto the scene
  ...SEGS.flatMap((s, i): [number, number][] => (s.kind === "type" ? [[STARTS[i], STARTS[i] + s.len + 1]] : [])),
  [1, 161],      // the hook: the first prompt typed in close-up and sent; the words are the motion
  [416, 443],    // the follow-up "now make it swim" typed into the thread
  [884, 902],    // the crayon balloon seen whole before the wave turns it to bricks (brickBalloon's own hold, at 2x)
  [921, 926],    // the finished mosaic rests before it lets go (brickBalloon's hold, at 2x)
  [978, 982],    // the built balloon stands complete before the burner lights (brickBalloon's hold, at 2x)
  [1109, 1139],  // "my koi, painted in this hand" typed, the Van Gogh reference attached
  [1175, 1236],  // the almond-blossom koi laid in stroke by stroke inside its card: real, but small in frame
  [1238, 1246],  // the finished almond koi seen whole before LOOPS
  [1303, 1310],  // the embroidery loop opens on the bee resting on the poppy (embroideryAlive's own hold)
  [1975, 2141],  // the sentence written word by word in five media, then the claim read
  [2141, N3],    // the end card blooms open and holds, install lines on screen (the last 60 frames frozen)
];
const ACCEPTED3: [number, number, string][] = [
  [354, 367, "approved as shipped: the koi card sits unchanged for 13 frames between two word pages"],
  [1080, 1092, "approved as shipped: the brick flight stops and the frame holds for 12 frames before the chat returns"],
  [1102, 1103, "approved as shipped: the returned chat settles for one frame before the reference is attached"],
  [1806, 1943, "approved as shipped: the butterfly film plays at 0.6x by repeating frames"],
  [1955, 1975, "approved as shipped: the butterfly fades to empty paper and the page waits before the sentence"],
];

export const launch3: Film = {
  meta: { title: "anidoodle · launch, cut 3", W, H, fps: FPS, bpm: 90, durationFrames: N3, raster: "cpu", kind: "launch", holds: [...HOLDS3, ...ACCEPTED3],
    // the code composition: the editor slides in over the chat, so its title bar crosses the sent prompt.
    // The overlap is the move (the koi IS this code); the editor is opaque, the probe cannot see that.
    checks: { layoutExempt: [[205, 283, "the code editor slides in over the chat: an opaque panel crossing the sent prompt, by design"]], none: frozenNone(["gate:identical"]) } },
  assets: { images: { almond: "assets/refs/vangogh-almond-blossom.jpg" } }, // public domain; provenance in engine/assets/refs/PROVENANCE.json
  shots: [{ id: "cut", start: 0, end: N3, draw: (ctx, F, env) => { const { s, local } = at(F); if (s.kind === "pic") content2(ctx, env, contentOf(s, local)); else drawType(ctx, env, s, local, F); } }],
  audio: Object.assign(audio3, { scores: [launchLofi3()] }),
};
export const SEGS3 = () => SEGS.map((s, i) => [s.kind, STARTS[i], s.len, s.kind === "type" ? s.lines.map((l) => l.text).join(" / ") : `${s.from}-${s.to}`]);
