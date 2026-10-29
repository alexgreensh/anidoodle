// LAUNCH TEMPLATE. Your product's launch film from data: a product name, the asks a user would
// make, the answers, the words for the type frames, and the exact install lines. It is the launch
// film's grammar (references/workflows/launch-video-kit.md) with nothing of anidoodle's own left in it:
//
//   ask (plate): the prompt is already being typed at frame 0 (a silent-readable hook), the camera
//         eases out from the composer, the pointer presses Generate, an ink drop arcs into the thread
//         and blooms open into a card where the plate draws itself, live. Earlier answers stay and the
//         thread scrolls. The camera then leans in on the new card.
//   ask (ui): the product's own interface, drawn from data (productUI.ts): its before state, the
//         ask typed into its command bar (optional), the pointer presses its action, and every item
//         springs to the after state. `split` puts words in their own column beside it.
//   ask (film): any film of this engine (a webTour, a loop) played in a card, `split` as above.
//   type: a full-frame word page inside an ink bloom (launchCut.ts). Words never sit on the art.
//   end:  the motif relay: an ink drop lifts off Generate (or the product's action) and lands as
//         the dot of the end card's mark, and the page blooms open FROM it and stays: the name, one
//         line, the install lines in a dark panel, held for `endBeats` (3 s or more).
//
// One timeline, any shape (launchLayout.ts), 30 or 60 fps, two looks (preset "drawn" or "clean"),
// sound cues from the picture's own timing (launchSound.ts), captions from its words.
// Everything is timed on a beat grid (bpm from the brief). With `claimBar`, the last ask's length is
// solved so the end card lands on that bar's downbeat, or the build throws.
//
//   export const myLaunch = makeLaunchFilm({ title: "Tally", asks: [...], words: [...], ... });
//   (or: node tools/launch.mjs new myLaunch; then node tools/launch.mjs ship myLaunch --shapes 16x9,9x16)
import { probeRect, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import {
  C, TEXT_SHOWN, camLerp, caretAt, charTimes, clamp, drawChatFrame, expo, inOut, inkCard, inkDrop,
  lerp, lerpP, out3, plateLayer, pointer, press, ramp, rr, spring, toScreen, typedAt, useCam, type Cam, type Drop, type ChatGeom, type Rect,
} from "./launchKit";
import { launchLayout, estWidth, installRows, SHAPES, type LaunchLayout, type Shape } from "./launchLayout";
import { resolveLook, registerFaces, CLEAN as LOOK_CLEAN, type LaunchLook } from "./launchLook";
import { chatGeom, inkDropAt } from "./launchKit";
import { beatGrid, bloomFrame, bloomRadius, makeCut, pic, type, type Seg, type TypeLine } from "./launchCut";
import { inkSpan, measure, writeOn, setType } from "./kinetic";
import { drawProductUI, springLand, uiActionAt, uiActionRect, uiCommandAt, uiSettles, uiWindow, type ProductUI, type UiTheme } from "./productUI";
import { relay, checkRelay, type MotifPose, type Seam } from "./motif";
import { launchAudio, type LaunchCue } from "./launchSound";
import { fitScore, limiter, renderPiece } from "./music/render";
import { loudness, truePeak } from "./music/meter";
import * as families from "./music/pieces/families";
import * as launchPieces from "./music/pieces/launch";
import * as nocturnePieces from "./music/pieces/nocturne";
import * as samplers from "./music/pieces/samplers";
import type { Piece } from "./music/plan";
import { composePiece, stretchIndex, withStretch, type Material } from "./music/compose";
import { perform } from "./music/perform";
import { beatsPerBar } from "./music/plan";
import { novelty } from "./music/novelty";
import { drawEndCard, endCardLayout, type EndCardSpec } from "./endCard";
import { drawEl } from "./brandKit";
import type { ShipMeta } from "./shipMeta";
import type { MotionMeta } from "./motionMeta";
import { readS } from "./readable";
import { TEMPERAMENTS } from "./motionKit";
import { speedCeiling } from "./seams";

/** chat -> Generate -> a plate drawing itself in the answer card (the default kind) */
export type PlateAsk = {
  kind?: "plate";
  prompt: string;            // what the user types, in their words
  plate: Film;               // the answer: any film of this engine, drawn live into the card
  label: string;             // the card's byline ("marker comic", "your dashboard, redrawn")
  from?: number; to?: number; // the plate frames to play while the card is up (default: all of it)
  crop?: [number, number, number, number]; // a source rectangle of the plate, in plate pixels at 1080 across
};
/** the product's own UI from data: before -> (the ask typed, the action pressed) -> after */
export type UiAsk = { kind: "ui"; ui: ProductUI; prompt?: string; split?: TypeLine[] };
/** any film (a webTour, a loop, a plate) in a card */
export type FilmAsk = { kind: "film"; film: Film; from?: number; to?: number; split?: TypeLine[] };
export type LaunchAsk = PlateAsk | UiAsk | FilmAsk;
export type LaunchSpec = {
  title: string;             // the product name: the thread's name, the end card, the corner mark
  subtitle?: string;         // the thread's subline
  placeholder?: string;      // the empty composer
  genLabel?: string;         // the button's word (default "Generate")
  accent?: string;           // the button and caret colour (and the clean preset's one accent), hex
  asks: LaunchAsk[];         // 1 to 3 beats: prompt-to-plate, product UI, or any film
  words?: TypeLine[][];      // words[i] is a type frame after asks[i], for i < asks.length - 1
  tagline: string;           // the one line under the name on the end card
  install: string[];         // the exact lines a viewer copies; held on screen for the whole end card
  footer?: string;           // small print under the panel (where it runs, the repo)
  // the clean end card's layout: "stack" (default) centres name, line, install panel and footer on one
  // axis; "grid" lays them on endCard.ts's asymmetric grid: the name top-left with the drop as its full
  // stop, the line and the install lines under it, the footer as a stamp on the right. Clean preset only.
  endCard?: "stack" | "grid";
  checks?: ShipMeta;         // what the film tells the ship checks (shipMeta.ts): its length budget { target, max } in seconds, layoutExempt for a deliberately dense UI beat, and in `none` only a check with truly nothing to look at
  motion?: MotionMeta;       // what the film tells the motion scans (motionMeta.ts): the brand's temperament ("calm", "lively", "snappy") and its colours (#rrggbb), both from the brief
  bpm: number;               // the beat grid: bpm comes from the brief (the score composed for it)
  fps?: 30 | 60;             // 60 for UI-heavy films (smoother scrolls and springs); the timing is the same
  askBeats?: number; typeBeats?: number; endBeats?: number; // default 6, 6 (a word page has a travel in, the words' own arrival, their read and their sink), 8
  claimBar?: number;         // land the end card on this bar's downbeat, counting from bar 0 (solves the last ask)
  // The score: a piece COMPOSED for this product's brief (references/music/compose.md), or null for
  // a silent film. Required, so no film inherits a score by default. anidoodle's own pieces are
  // refused: every user's film gets its own music, never ours.
  // A Material (what compose.md writes) is composed here; a finished Piece is used as is.
  score: (() => Piece | Material) | null;
  audio?: Film["audio"];     // or your own finished mix; wins over score and sfx
  limit?: boolean;           // let a look-ahead limiter take the score's last peaks so it reaches -14 LUFS (default off: the peak ceiling wins)
  shape?: Shape;             // the frame: 16x9 (default), 1x1, 4x5, 9x16. Every shape is re-composed by launchLayout, never cropped; film.reshape(s) gives the same film in another shape
  preset?: string;           // the shorthand for look.base: "drawn" (ink, blooms and hand lettering, default) or "clean" (a quiet canvas, one accent and set type)
  look?: LaunchLook;         // how the film looks like YOUR product: base, palette, fonts, shape, chat, from (launchLook.ts; references/workflows/launch-video-kit.md, Looks)
  sfx?: boolean;             // sound cues from the picture's timing (default true; false = the score alone)
  motif?: boolean;           // the relay into the end card (default true): the drop becomes the mark's dot
  captions?: "sidecar" | "burn"; // .srt/.vtt only (default), or also burned into their own band (phone shapes)
  claims?: string[];         // any other on-screen or narrated claim (a number in the UI, a spoken line); the words, split words and tagline are claims already
};

// the clean preset: a quiet canvas, one accent, type as the design. Our own palette, drawn for it.
// (it lives in launchLook.ts with the other looks)
export const CLEAN = LOOK_CLEAN;

// anidoodle's own pieces (the demos and our launch score) are examples of the composer, never a
// user's soundtrack. Refused by identity, by title and by content (the novelty gate), so a thin or
// retitled wrapper does not slip through. `audio` is the caller's own finished mix and is not checked.
const OURS: (() => Piece)[] = [...Object.values(families), ...Object.values(launchPieces), ...Object.values(nocturnePieces), ...Object.values(samplers)].filter((v): v is () => Piece => typeof v === "function");
const asPiece = (score: () => Piece | Material) => (): Piece => { const x = score(); return "plan" in x ? x : composePiece(x); };
const refuseOurs = (score: () => Piece | Material) => {
  const ours = () => new Set(OURS.map((f) => { try { return f().title; } catch { return null; } }).filter(Boolean));
  if ((OURS as unknown[]).includes(score) || ours().has(score().title)) throw new Error(`launchTemplate: "${score().title}" is one of anidoodle's own pieces; compose a score for this product's brief (references/music/compose.md) or pass score: null`);
  // by content too: a retitled copy, a transposition or a quoted line of ours fails the same novelty gate `music.mjs check` runs
  const corpus: Record<string, () => Piece> = {};
  OURS.forEach((f, i) => { try { const p = asPiece(f)(); corpus[`${p.title} #${i}`] = () => p; } catch { /* not a piece */ } });
  const v = novelty(asPiece(score)(), corpus);
  if (!v.pass) throw new Error(`launchTemplate: "${score().title}" is too close to anidoodle's own "${v.worst.name.replace(/ #\d+$/, "")}" (similarity ${v.worst.score}, ${v.worst.reusedFragments} reused 6-note fragments); compose a score for this product's brief (references/music/compose.md) or pass score: null`);
};
// THE CLEAN PRESET'S SEAMS TRAVEL (references/motion-grammar.md, 5. Continuous canvas). Its asks and its
// word pages are places on one canvas, each the size of the frame, and the camera travels from one to the
// next: the next place is in the world before the move starts, nothing is swapped in place, so no seam
// reads as a slide (motionscan slidecut) and no text is left in slivers by an iris crawling over it
// (layerscan exits). The drawn preset keeps its ink blooms. TRV is how long a travel takes, in frames at
// 30 fps: type may never move faster than half the speed ceiling (layerscan fasttext: 0.5 x 2.5 frame
// widths a second), and a travel of one frame width on a sine ease peaks at pi/2 x its mean speed, so
// with a tenth in hand it takes (pi/2) / (0.9 x 1.25) s = 1.4 s. It is the same in every shape, so the
// cut and the sound never change with the shape. (The glide below peaks lower, at 1.11 x its mean, so
// the bound is generous.)
const TRV = Math.ceil((Math.PI / 2 / (0.9 * 0.5 * 2.5)) * 30);
/**
 * The travel's ease, a GLIDE: its speed rises in a straight line over the first tenth, cruises, and falls
 * over the last tenth (no step at either end, peak 1.11 x the mean). A sine ease crept under a pixel a
 * frame for its first and last frames, and a dense screen of type shifted that slowly reads as swapped,
 * not moved (motionscan slidecut cannot tell the camera is travelling).
 */
const GLIDE = 0.1;
const glide = (q: number) => { const c = clamp(q), r = GLIDE, v = 1 / (1 - r); return c < r ? (v * c * c) / (2 * r) : c > 1 - r ? 1 - (v * (1 - c) * (1 - c)) / (2 * r) : v * (c - r / 2); };
/**
 * A scene drawn at another place in the one world. Every transform the scene sets is scaled by z about
 * (cx, cy) and moved by (dx, dy) first, so a scene that sets its own camera (setTransform) can sit beside
 * another on one canvas, or creep closer as a whole. With `fade`, each line of text gets an opacity from
 * where it lands (logical px), so a phone shape's travel fades text before it reaches a platform zone.
 */
const placed = (ctx: Ctx, env: Env, o: { z?: number; c?: P; d?: P; fade?: (x0: number, y0: number, x1: number, y1: number, d: P) => number }): Ctx => {
  const z = o.z ?? 1, S = env.scale, [cx, cy] = o.c ?? [0, 0], [dx, dy] = o.d ?? [0, 0], ox = (cx * (1 - z) + dx) * S, oy = (cy * (1 - z) + dy) * S, fade = o.fade;
  if (z === 1 && !ox && !oy && !fade) return ctx;
  const setT = (a: number, b: number, c: number, d: number, e: number, f: number) => ctx.setTransform(z * a, z * b, z * c, z * d, z * e + ox, z * f + oy);
  return new Proxy(ctx, {
    get(t, k) {
      if (k === "setTransform") return (...a: unknown[]) => { if (typeof a[0] === "object" && a[0]) { const m = a[0] as DOMMatrix2DInit; return setT(m.a ?? 1, m.b ?? 0, m.c ?? 0, m.d ?? 1, m.e ?? 0, m.f ?? 0); } return setT(...(a as [number, number, number, number, number, number])); };
      if (k === "resetTransform") return () => setT(1, 0, 0, 1, 0, 0);
      if (k === "fillText" && fade) return (s: string, x: number, y: number, mw?: number) => {
        const m = t.getTransform(), q = t.measureText(s), x0 = x - q.actualBoundingBoxLeft, x1 = x + q.actualBoundingBoxRight, y0 = y - q.actualBoundingBoxAscent, y1 = y + q.actualBoundingBoxDescent;
        const xs = [m.a * x0 + m.c * y0 + m.e, m.a * x1 + m.c * y1 + m.e], ys = [m.b * x0 + m.d * y0 + m.f, m.b * x1 + m.d * y1 + m.f];
        const k = fade(Math.min(...xs) / S, Math.min(...ys) / S, Math.max(...xs) / S, Math.max(...ys) / S, [dx, dy]), was = t.globalAlpha;
        (t as unknown as Record<symbol, number>)[TEXT_SHOWN] = Math.max(0, k); // (inkCard fades a byline's dot with its words)
        if (k <= 0) return; t.globalAlpha = was * k; if (mw === undefined) t.fillText(s, x, y); else t.fillText(s, x, y, mw); t.globalAlpha = was;
      };
      const v = Reflect.get(t, k); return typeof v === "function" ? v.bind(t) : v;
    },
    set(t, k, v) { return Reflect.set(t, k, v); },
  });
};
// THE DRAWN LOOK'S WORDS WRITE THEMSELVES, with no pen in the frame. A hand-lettering pen crosses a line in
// 18 frames, at up to 90 px a frame on a phone frame: nearly twice what a lively brand allows (motionscan
// temperament), and the eye follows the pen, not the word. The ink still goes down stroke by stroke.
const PEN = false;
const DL0 = 14;  // the motif relay: the drop's flight into the end card, in frames (it lands ON the end card's first frame); DL in the film
const LIFT = 6;  // ...after a bead of ink swells on its source for this many frames
const isChat = (a: LaunchAsk): a is PlateAsk => !a.kind || a.kind === "plate";

// the timing inside one chat ask, from its prompt and its length (`a0` delays the typing: after a travel
// in, typing starts halfway through it, as the composer arrives, the way a split beat's words rise)
// SETTLE: once the prompt is typed, the hook's composer docks (or the close-up eases out to the room) over
// this many frames, and Generate is pressed only once it has landed: a button is never pressed on the move.
// An in-out over a second keeps type under half the speed ceiling on every shape (layerscan fasttext); the
// expo ease it replaced moved the docking prompt at 118 px a frame on a phone frame.
const SETTLE = 30;
/**
 * THE CLEAN HOOK'S DOCK travels as one object and stays that object: the big composer glides down whole (its
 * own size, its own line breaks) to the foot of the window in MOVE frames, and that is the dock. It never
 * shrinks: a composer that shrank as it moved, its words rewrapping halfway, replaced 64 % of a clean frame in
 * 0.1 s (a slide cut to motionscan), and one that scaled down once it had landed read to a fresh critic as a
 * second move (cc1-1). MOVE is short enough that the glide reads to motionscan as a move (over 10 px a frame
 * at 60 fps on 16:9) and long enough that its type stays under half the speed ceiling on a phone frame
 * (layerscan fasttext). (`shrink` stays in the record, at 0 frames, for the grammar's dock window.)
 */
// REST: once landed it rests 15 frames before Ask is pressed (the room's creep still moving), the time the
// scale used to take: the typed question is read whole before it is sent (framecheck reading time, 1.5 s).
const CLEAN_DOCK = { at: -2, move: 14, shrink: 0, rest: 15 };
/**
 * The first prompt is already being typed at frame 0 (a silent-readable hook), so frame 0, the thumbnail,
 * shows what is typed so far. It must end on a whole word ("a lighthouse at", never "a lighthouse at s":
 * a fresh critic read the broken word as a broken frame). Typing runs from `a` to `b`, keeping each key's
 * share of the line (`raw`); this returns the start nearest `want` at which frame 0 falls between the last
 * key of a word and the space after it.
 */
export const wholeWordStart = (prompt: string, raw: number[], b: number, want: number) => {
  const last = raw[raw.length - 1] || 1, r = (j: number) => raw[j] / last;
  let best = want, gap = Infinity;
  for (let e = 1; e < prompt.length; e++) {
    if (prompt[e] !== " " || prompt[e - 1] === " ") continue;
    // key e-1 (the word's last) at or before frame 0, key e (the space) after it
    const hi = (-r(e - 1) * b) / (1 - r(e - 1)), lo = (-r(e) * b) / (1 - r(e)) + 0.25;
    if (lo > hi) continue;
    const a = clamp(want, lo, hi), d = Math.abs(a - want); if (d < gap) { gap = d; best = a; }
  }
  return best;
};
// `dock`: where the composer's settle starts against the last key, and how long it takes (the clean hook's
// dock, CLEAN_DOCK, is its own); `fly`: the ink drop's flight to the answer card, in frames (14, or the clean
// look's, from its distance)
const askTiming = (prompt: string, i: number, ASK: number, a0 = 0, dock: { at: number; len: number } = { at: -8, len: SETTLE }, fly = 14) => {
  const raw = charTimes(prompt, 0, 1, 7 + i * 4), last = raw[raw.length - 1] || 1;
  const b = Math.round(ASK * 0.25) + a0, a = i === 0 ? wholeWordStart(prompt, raw, b, -Math.round(b * 1.2)) : 4 + a0; // the first prompt is under way at frame 0, on a whole word
  const times = raw.map((t) => a + (t / last) * (b - a));
  const down = b + dock.at + dock.len + 2, up = down + 5, drop: Drop = { t0: up + 5, land: up + 5 + fly, full: up + 26 + fly };
  return { times, b, down, up, drop };
};
// a UI ask: the ask typed into the product's command bar (if it has a prompt), then its action pressed
const uiTiming = (prompt: string | undefined, i: number, ASK: number, a0: number, split = false, travelled = false) => {
  // a split beat's words are the wait: its press follows them. After a travel (clean) they rose on the way
  // in and are read as it lands, so the press comes 2 frames after: the after state then has the rest of
  // the beat to be read (a row's new tag needs its own reading time before the next seam)
  const b = split && travelled ? a0 + 2 : Math.round(ASK * (prompt ? 0.3 : split ? 0.13 : 0.2)) + a0;
  let times: number[] = [];
  if (prompt) { const raw = charTimes(prompt, 0, 1, 11 + i * 4), last = raw[raw.length - 1] || 1, a = i === 0 ? wholeWordStart(prompt, raw, b, -Math.round(b * 0.8)) : 6 + a0; times = raw.map((t) => a + (t / last) * (b - a)); }
  const down = b + 14, up = down + 5;
  return { times, b, down, up, drop: { t0: up + 2, land: up + 2, full: up + 2 } as Drop };
};

export type LaunchFilm = Omit<Film, "reshape"> & {
  cut: ReturnType<typeof makeCut>; layout: LaunchLayout; reshape: (shape: string) => LaunchFilm;
  cues: LaunchCue[];     // the sound cues the picture emits (frames of this film)
  heroPx: number | null; // the hook's prompt size (px at the delivered size), when the film opens on a chat ask
  seams: Seam[];         // the motif's seams, each checked (checkRelay)
  timing: { base: number; len: number; tin: number; b: number; down: number; up: number; drop: Drop; times: number[] }[]; // each ask's own timing, content frames at 30 fps
  captions: { from: number; to: number; text: string }[]; // = meta.captions
  claims: string[];      // every claim the film makes, each to be listed in facts.json with its source (tools/facts.mjs)
  // the moves the film is built from, as data (content frames at 30 fps, world px), for tests and critics:
  // each chat ask's thread scroll, every travel's direction, each word page's sink, the end card's bloom,
  // and where the motif's drop swells before it flies
  grammar: {
    scrolls: { i: number; d: number; from: number; len: number }[];
    travels: { seam: string; ax: P }[];
    pages: { i: number; set: number; out: number }[];
    endBloom: { frames: number; radius: number };
    lift: P;
    endCard: { creep: P; cx: number; group: [number, number]; logo: Rect | null; tagline: string[]; taglineW: number[]; room: [number, number] }; // + the clean card's tagline lines, their measured widths, and the x span they may use (inside the phone-safe rectangle) // the point the end card's settle zooms about, the card's axis, and its name-and-dot group's ink, left and right
    rests: { i: number; tip: P; win: Rect; s: number }[];
    splits: { i: number; lines: string[]; size: number; tall: number; room: Rect }[];
    // the clean hook's dock (null without one): the frames it glides whole and the frames it then scales in, the
    // hook's and the dock's prompt size, the docked composer, the chat window, and where the thread's view ends
    dock: { move: [number, number]; shrink: [number, number]; creep: number; heroPx: number; dockPx: number; composer: Rect; window: Rect; viewBottom: number } | null; // each split beat's words as set: their lines, size, the height they take, and their column
    // the drawn hook's dock (null without one): its frames (30 fps units) and its fastest point on screen, px a
    // 30 fps frame, read off the composer's corners, its button and its type as the camera sees them
    heroDock: { frames: [number, number]; peak: number; wraps: number } | null;
    // the last ask's words with the motif (null without): the content frame they have sunk by, and the frames the
    // drop flies over (it leaves its bead at the first, lands as the end card's dot at the second)
    lastWords: { gone: number; flight: [number, number] } | null;
    // each chat ask's ink drop: its flight (content frames) and its fastest point on screen, px a 30 fps frame
    drops: { i: number; flight: [number, number]; peak: number; landing: number }[];
  };
};
/** A travelled string's opacity on a phone shape (its box x0..x1, y0..y1 on screen, its place moved by d):
 * none inside a zone (the top band, the bottom band, the right-hand column; the left side has none), and a
 * fade over `band` px before one, measured from where it rests, so it leaves in some five frames of the
 * travel, never in one, and a string resting near a safe edge does not dim the moment a travel starts. */
export const zoneFadeOf = (S: { x: number; y: number; w: number; h: number }, band = 120) => {
  const dist = (y0: number, x1: number, y1: number) => Math.min(S.x + S.w - x1, y0 - S.y, S.y + S.h - y1);
  return (_x0: number, y0: number, x1: number, y1: number, d: P) => {
    const now = dist(y0, x1, y1); if (now < 0) return 0;
    const rest = dist(y0 - d[1], x1 - d[0], y1 - d[1]);
    return clamp(now / Math.max(1e-6, rest > 0 ? Math.min(band, rest) : band));
  };
};
/** How far line j of nL has sunk (0..1) at q (0..1) of a page's sink: the last line leaves first, and each
 * next one starts while the one below is 40 % from gone, so some line is always moving. Back to back, each
 * line's ease-in start left still frames between two lines (identical frames at 60 fps, the gate). */
export const sinkOf = (q: number, j: number, nL: number) => { const D = 1 / (1 + (nL - 1) * 0.6), start = (nL - 1 - j) * 0.6 * D; return clamp((q - start) / D); };
export const makeLaunchFilm = (spec: LaunchSpec): LaunchFilm => {
  const fps = spec.fps ?? 30, m = fps / 30, n = spec.asks.length, shape = spec.shape ?? "16x9", LK = resolveLook(spec), clean = LK.clean;
  if (fps !== 30 && fps !== 60) throw new Error(`launchTemplate: fps ${fps}; a launch film runs at 30, or 60 for a UI-heavy film`);
  if (!(shape in SHAPES)) throw new Error(`launchTemplate: shape '${shape}' is not one of ${Object.keys(SHAPES).join(", ")}`);
  if (!(spec.bpm > 0)) throw new Error("launchTemplate: set bpm from the brief (the tempo of the score composed for this film)");
  if (spec.score === undefined && !spec.audio) throw new Error("launchTemplate: `score` is required: a piece composed for this product (references/music/compose.md), or null for silence");
  if (n < 1 || n > 3) throw new Error("launchTemplate: 1 to 3 asks; more is a feature list, not a story");
  if (spec.score) refuseOurs(spec.score);
  if (spec.endCard !== undefined && spec.endCard !== "stack" && spec.endCard !== "grid") throw new Error(`launchTemplate: endCard '${spec.endCard}' is not "stack" or "grid"`);
  if (spec.endCard === "grid" && !clean) throw new Error('launchTemplate: endCard "grid" is the clean preset\'s card; the drawn look keeps its written name');
  const chatIdx = spec.asks.map((a, i) => (isChat(a) ? i : -1)).filter((i) => i >= 0), chatOrd = (i: number) => chatIdx.indexOf(i);
  const burn = spec.captions === "burn" && shape !== "16x9";
  const L = launchLayout(shape, { prompts: chatIdx.map((i) => (spec.asks[i] as PlateAsk).prompt), install: spec.install, tagline: spec.tagline, title: spec.title, band: burn, wrap: LK.wrap });
  // THE LOOK (launchLook.ts): the stock looks draw exactly as before; a custom one brings its palette, faces,
  // shapes and chat. Its font files are registered as FontFaces before the first frame (in a page).
  registerFaces(LK.faces);
  const PAL = clean || LK.custom ? LK.palette : C;
  const ACC = clean || LK.custom ? PAL.accent : spec.accent, INK = clean ? PAL.accent : PAL.ink; // the drop, the motif: ink, or the one accent
  const G0: ChatGeom = clean ? { ...L.chat, theme: PAL, drop: INK, iris: true, look: LK.custom ? LK : undefined } : LK.custom ? { ...L.chat, theme: PAL, look: LK } : L.chat;
  const W = L.W, H = L.stage.h, CAM = L.cam, k = G0.k, minPx = L.phone ? 32 : 18;
  const UI_FULL: Rect = L.uiFull;
  const CALM = (spec.motion?.temperament ?? "lively") === "calm" || (typeof spec.motion?.temperament === "object" && spec.motion.temperament.maxSpeed <= TEMPERAMENTS.calm.maxSpeed);
  const DL = DL0;
  // 9x16: text stays inside the platforms' safe rectangle SAFE (launchLayout.PHONE_SAFE). The camera's
  // close-ups zoom about a point that stays put, and whatever a move carries toward a zone fades first.
  const ZONES = L.zones, SAFE = L.safe, SC: P = [SAFE.x + SAFE.w / 2, SAFE.y + SAFE.h / 2];
  // the empty state: on a phone the first ask's composer starts in the middle of the empty thread (the
  // way a chat app opens) and docks at the bottom as Generate is pressed; the hook is the prompt, centred
  // THE HOOK: the first prompt is the hero. It is typed in a big composer in the middle of the frame
  // (at least 64 px type on a phone frame, 56 px on 16x9, wrapping to 2-3 lines, never clipped),
  // which shrinks and docks at the bottom of the chat as Generate is pressed.
  // (clean: it holds as many lines as the longest prompt needs at its size, since the dock is this same
  // composer scaled down, and a later prompt is typed into it)
  // (clean, on 9x16: 40 px narrower, since the hook's composer is also the dock, and docked at the window's
  // foot under the hook's 4 % creep its right edge reached the phone's right-hand zone, where seen() faded
  // it: its accent caret and button see-through, layerscan translucent)
  const HERO = (() => {
    if (!isChat(spec.asks[0])) return null;
    const prompt = spec.asks[0].prompt, min = L.phone ? 64 : 56, inW = ZONES ? G0.CHAT.w - (clean ? 64 : 24) : Math.min(L.phone ? W * 0.9 : W * 0.72, G0.CHAT.w - 60 * k); // most of the width, inside the chat window (on 9x16 all of it: the window is narrower there)
    // (clean: from the smallest size, since this composer is the dock all film long; larger, it left the answer
    // card a thumbnail on 16:9, cc3-1)
    for (let px = clean ? min : L.phone ? 76 : 68; px >= min; px -= 2) {
      const kh = px / 34, genW = 166 * kh, textW = inW - 44 * kh - genW - 44 * kh, lines = LK.wrap(prompt, px, textW).length;
      if (lines > 3 && px > min) continue;
      if (lines > 3) throw new Error(`launchTemplate ${shape}: the first prompt "${prompt}" needs ${lines} lines at the hook's ${min} px; shorten it (the hook must read muted in the first 2 s)`);
      const rows = clean ? Math.min(3, Math.max(lines, ...chatIdx.map((j) => LK.wrap((spec.asks[j] as PlateAsk).prompt, px, textW).length))) : lines;
      // centred in the frame, or on 9x16 in the chat window (which is centred in the safe rectangle)
      const h = 104 * kh + (rows - 1) * Math.round(px * 1.3), fake = ZONES
        ? { x: G0.CHAT.x + (G0.CHAT.w - inW) / 2 - 60 * kh, y: G0.CHAT.y + G0.CHAT.h / 2 - H * 0.5, w: inW + 120 * kh, h: H * 0.5 + h / 2 + 36 * kh }
        : { x: (W - inW) / 2 - 60 * kh, y: 0, w: inW + 120 * kh, h: H * 0.5 + h / 2 + 36 * kh };
      const g = chatGeom(fake, kh, { ...G0.px, gen: 24 * kh }, px, rows, genW);
      return { ...g, CHAT: G0.CHAT, theme: G0.theme, drop: G0.drop, iris: G0.iris } as ChatGeom;
    }
    return null;
  })();
  // the hook's composer, its foot (the middle of its bottom edge) moved to `to` and scaled by s about it: every
  // part of it at once, its type size and its line breaks with it (the clean look's dock)
  const footOf = (g: ChatGeom): P => [g.INPUT.x + g.INPUT.w / 2, g.INPUT.y + g.INPUT.h];
  const scaledComposer = (g: ChatGeom, s: number, to: P): ChatGeom => {
    const [fx, fy] = footOf(g), X = (x: number) => to[0] + (x - fx) * s, Y = (y: number) => to[1] + (y - fy) * s;
    const R = (r: Rect & { r: number }) => ({ x: X(r.x), y: Y(r.y), w: r.w * s, h: r.h * s, r: r.r * s });
    return { ...g, INPUT: R(g.INPUT), GEN: R(g.GEN), TEXT: { x: X(g.TEXT.x), base: Y(g.TEXT.base), px: g.TEXT.px * s }, k: g.k * s, px: { ...g.px, gen: g.px.gen * s }, lineH: g.lineH * s };
  };
  // THE CLEAN DOCK is the hook's composer itself, at its own size, standing on the laid-out composer's foot:
  // one composer all film long, so the dock is one move of one object, never a re-layout or a rescale
  const DOCK_S = 1;
  const G: ChatGeom = clean && HERO ? (() => { const d = scaledComposer(HERO, DOCK_S, footOf(G0)); return { ...G0, INPUT: d.INPUT, GEN: d.GEN, TEXT: d.TEXT, wrap: d.wrap, lineH: d.lineH, px: { ...G0.px, gen: d.px.gen } }; })() : G0;
  // (the thread's view ends above the dock: on a phone the dock can stand taller than the laid-out composer,
  // and the answer card then shrinks, on every shape, to keep a card and the prompt above it in view together)
  const TH = (() => {
    const T0 = L.thread, vb = Math.min(T0.viewBottom, G.INPUT.y - 26 * k), d = T0.viewBottom - vb; if (d <= 0) return T0;
    // (on every shape: on 16:9 a card kept at its size made the thread scroll the question off, cc2-1)
    const card = Math.round(T0.card - d);
    return { ...T0, viewBottom: vb, clip: [T0.clip[0], T0.clip[1], T0.clip[2], T0.clip[3] - d] as [number, number, number, number], card, cardX: L.phone ? G.CHAT.x + (G.CHAT.w - card) / 2 : T0.cardX };
  })();
  const CARD = TH.card, VIEW_BOTTOM = TH.viewBottom;
  // THE CLEAN DROP'S FLIGHT follows its distance: 14 frames, or more when the streak (one solid, coherent thing
  // to motionscan, unlike the drawn look's fading trail) would top out past nine tenths of what the brand's
  // temperament allows, flown to where the thread's first card sits (later ones scroll in to sit lower; a
  // flight sized to the top of the view instead was so slow that a phone frame stood still: the gate's dead
  // air). With the hook's
  // composer docked at its own size
  // on a phone frame, the 14-frame flight moved at 45 px a frame against snappy's 36.
  const FLY = (() => {
    if (!clean || !TH.bubbles.length) return 14; // (no chat ask, no drop)
    const t = spec.motion?.temperament ?? "lively", share = typeof t === "string" ? (TEMPERAMENTS[t] ?? TEMPERAMENTS.lively).maxSpeed : t.maxSpeed, cap = 0.85 * share * speedCeiling(W, 30); // (0.85: the room creeps in a few per cent around it)
    // (the drop's own path, inkDropAt's, flown at each length until its fastest step is under the cap)
    const to: P = [TH.cardX + CARD / 2, TH.top + TH.bubbleH + (TH.bubbles[0].length - 1) * TH.bubbleLineH + TH.gap + TH.cardDy + CARD / 2], d0 = { t0: 0, land: 14 };
    for (let N = 14; N < 60; N++) {
      d0.land = N; let peak = 0;
      for (let c = 0; c < N - 0.5; c += 0.5) { const a = inkDropAt(c, d0, to, G), b = inkDropAt(c + 0.5, d0, to, G); if (a && b) peak = Math.max(peak, 2 * Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1])); }
      if (peak <= cap) return N;
    }
    return 60;
  })();
  // THE DRAWN DOCK'S LENGTH follows the distance it covers: an in-out over SETTLE frames, or longer when the
  // hook's composer travels far enough that its fastest point would pass nine tenths of what the brand's
  // temperament allows (or of half the speed ceiling, the type's own limit). A calm brand's hook on a phone
  // frame docked at 44 px a frame against calm's 31 (motionscan temperament, layerscan fasttext on the
  // drawn scaffold); a lively one keeps its second on a wide frame. (The cubic in-out tops out at 3 times its average.)
  const DOCK_SHARE = (() => { const t = spec.motion?.temperament ?? "lively"; return Math.min(0.5, typeof t === "string" ? (TEMPERAMENTS[t] ?? TEMPERAMENTS.lively).maxSpeed : t.maxSpeed); })();
  const DOCK_LEN = (() => {
    if (!HERO || clean) return SETTLE;
    const pts = (g: ChatGeom): P[] => [[g.INPUT.x, g.INPUT.y], [g.INPUT.x + g.INPUT.w, g.INPUT.y], [g.INPUT.x, g.INPUT.y + g.INPUT.h], [g.INPUT.x + g.INPUT.w, g.INPUT.y + g.INPUT.h], [g.GEN.x, g.GEN.y], [g.TEXT.x, g.TEXT.base]];
    const a = pts(HERO), b = pts(G), D = Math.max(...a.map((p, j) => Math.hypot(p[0] - b[j][0], p[1] - b[j][1]))) * (ZONES ? 1.04 : 1.02); // (at the hook's creep zoom)
    return Math.max(SETTLE, Math.ceil((3 * D) / (0.9 * DOCK_SHARE * speedCeiling(W, 30))));
  })();
  // (a longer dock starts its extra frames sooner, over the prompt's last words, and lands when a one-second
  // dock would: everything after it keeps its time. Landing later squeezed the lean onto the answer card
  // into fewer frames, 55 px a frame on the calm scaffold's phone frame)
  const DOCK_AT = -8 - (DOCK_LEN - SETTLE);
  const GEN_C: P = [G.GEN.x + G.GEN.w / 2, G.GEN.y + G.GEN.h / 2];
  const about = (p: P, z: number): P => [p[0] - (p[0] - W / 2) / z, p[1] - (p[1] - H / 2) / z]; // a camera at zoom z that leaves world point p where it is on screen
  const THEME: UiTheme = { bg: PAL.bg, card: PAL.card, ink: PAL.ink, soft: PAL.soft, mute: PAL.mute, line: PAL.line, chip: PAL.chip, accent: ACC ?? PAL.accent, paper: PAL.paper, ...(LK.custom ? { font: LK.fonts.text, onAccent: LK.onAccent, radius: LK.shape.radius, button: LK.shape.button } : {}) };

  // ---------------------------------------------------------------- the beat grid and the asks' lengths (30 fps units; 60 fps draws between them)
  const grid = beatGrid(spec.bpm, 30);
  const ASK = Math.round((spec.askBeats ?? 6) * grid.beat), TYPE = Math.round((spec.typeBeats ?? 6) * grid.beat), END0_HOLD = Math.round((spec.endBeats ?? 8) * grid.beat);
  let END = END0_HOLD; // the end card is a hold: a scored film sets it so the film is whole bars of its score
  if (ASK < 100) throw new Error(`launchTemplate: an ask beat needs 100 frames or more (it has ${ASK}); raise askBeats`);
  if (END < MIN_END(30)) throw new Error("launchTemplate: the end card must hold the install lines 3 s or more; raise endBeats");
  const words = spec.words ?? [];
  // claimBar solves the last ask's length. A longer ask is really longer (the card holds, the plate
  // draws over the extra time); it is never the same ask slowed down, which would repeat frames.
  const typeCount = spec.asks.slice(0, -1).filter((_, i) => words[i]?.length).length;
  const SOLVED = spec.claimBar !== undefined ? grid.solve(spec.claimBar, (n - 1) * ASK + typeCount * TYPE, 60) : ASK;
  const LEN = spec.asks.map((_, i) => (i === n - 1 ? Math.max(ASK, SOLVED) : ASK)); // content frames per ask
  const BASE = LEN.map((_, i) => LEN.slice(0, i).reduce((a, b) => a + b, 0));
  // a seam between two kinds (or into a UI or a film) with no word page on it opens with a bloom-in
  // (clean: every seam into an ask is a travel, from the word page before it or from the ask before it;
  // chat to chat with no word page stays in the one thread, with no seam at all)
  const TIN = spec.asks.map((a, i) => (i === 0 ? 0 : words[i - 1]?.length || !(isChat(a) && isChat(spec.asks[i - 1])) ? TRV : 0));
  const T = spec.asks.map((a, i) => ({ ...(isChat(a) ? askTiming(a.prompt, i, ASK, Math.round(TIN[i] / 2), HERO && i === 0 ? (clean ? { at: CLEAN_DOCK.at, len: CLEAN_DOCK.move + CLEAN_DOCK.shrink + CLEAN_DOCK.rest } : { at: DOCK_AT, len: DOCK_LEN }) : undefined, FLY) : a.kind === "ui" ? uiTiming(a.prompt, i, ASK, TIN[i], !!a.split?.length, TIN[i] > 0) : { times: [], b: 0, down: 0, up: 0, drop: { t0: 0, land: 0, full: 0 } }), base: BASE[i], len: LEN[i], tin: TIN[i] }));
  const END0 = BASE[n - 1] + LEN[n - 1]; // content frame where the end card starts
  const askOf = (f: number) => { let i = n - 1; while (i > 0 && T[i].base > f) i--; return i; };

  // ---------------------------------------------------------------- the thread (the chat asks share one)
  type Item = { at: number; h: number; user?: string; lines?: string[]; card?: number };
  const items: Item[] = [];
  chatIdx.forEach((i) => { const t = T[i], o = chatOrd(i); items.push({ at: t.base + t.up, h: TH.bubbleH + (TH.bubbles[o].length - 1) * TH.bubbleLineH, user: (spec.asks[i] as PlateAsk).prompt, lines: TH.bubbles[o] }); items.push({ at: t.base + t.drop.land, h: CARD + TH.cardDy, card: i }); });
  const ys = (() => { let y = TH.top; return items.map((it) => { const r = y; y += it.h + TH.gap; return r; }); })();
  // THE THREAD SCROLLS ONCE PER ASK, as Generate is pressed: one move makes room for the sent prompt and
  // its answer card together (two overlapping scrolls added up). It is a glide (peak 1.11 times its mean)
  // whose length follows the distance, so the thread's type moves at three quarters of half the speed
  // ceiling at most (layerscan fasttext; the rest is the sent prompt's own rise, which rides on it), never
  // in under a second (an expo here moved the thread at 150 px a frame on a phone frame), and the camera
  // leans onto the card only once it has settled (cardSettled): a scroll and a lean at once carried the
  // thread's type past the ceiling on a phone frame.
  const scrolls = (() => { let done = 0; return chatIdx.map((i) => { const want = Math.max(0, ...items.map((it, k) => (it.card === i || it.user === (spec.asks[i] as PlateAsk).prompt && items[k + 1]?.card === i ? ys[k] + it.h - VIEW_BOTTOM : 0))), d = Math.max(0, want - done); done = Math.max(done, want);
    return { i, d, from: T[i].base + T[i].down - 2, len: Math.max(30, Math.ceil((1.12 * d) / (0.75 * 0.5 * speedCeiling(W, 30)))) }; }); })();
  const scrollAt = (f: number) => scrolls.reduce((s, q) => s + q.d * glide(ramp(f, q.from, q.from + q.len)), 0);
  const cardSettled = (i: number) => { const q = scrolls.find((x) => x.i === i)!; return q.from + q.len - T[i].base; }; // local frame its scroll lands
  const cardY = (i: number, f: number) => ys[items.findIndex((it) => it.card === i)] + TH.cardDy - scrollAt(f);
  const plateFrame = (i: number, f: number) => { const a = spec.asks[i] as PlateAsk, t = T[i], from = a.from ?? 0, to = a.to ?? a.plate.meta.durationFrames - 1; return lerp(from, to, ramp(f, t.base + t.drop.land, t.base + t.len - 8)); };
  // the card opens on a spring and lands on its first arrival (its sound sits on that frame)
  const OMEGA = 4.163 / 21, ZETA = 0.8, arrive = (i: number) => springLand(T[i].base + T[i].drop.land, OMEGA, ZETA);
  const growAt = (i: number) => (f: number) => (f >= arrive(i) ? 1 : spring(f, T[i].base + T[i].drop.land, OMEGA, ZETA));

  let quietBug = false; // while a travel draws two places, the corner mark is drawn once, where it sits on the screen
  const bug = (c: Ctx, env: Env) => {
    if (quietBug) return;
    if (clean) { c.setTransform(env.scale, 0, 0, env.scale, 0, 0); c.font = LK.fonts.text(600, L.bug.px * 0.8); c.fillStyle = PAL.soft; c.textAlign = "right"; c.textBaseline = "alphabetic"; c.fillText(spec.title, L.bug.x, L.bug.y); c.textAlign = "left"; return; }
    writeOn(c, env, spec.title, L.bug.x, L.bug.y, L.bug.px, 1, "ink", { color: C.soft, align: "right", seed: 3 });
  };
  // focus: while the camera is close on the composer the thread recedes (it would be cut by the frame's
  // edge), and while it leans on a card everything but that card does; nothing is ever half off-frame
  // And whatever the camera's edge is about to cut fades before it does: an element's opacity is how
  // far inside the view it sits (full at 24 px in, none at the edge), so nothing shows half off-frame.
  type Focus = { lean: number; keep: number; cam: Cam };
  // (on 9x16 the edge that counts is the safe rectangle's, so text fades before it reaches a zone; the fade
  // is short, ZONE_FADE px, because the hook's composer spans the window and a zone's line is not a visible edge)
  const ZONE_FADE = 8;
  const seenSafe = (cam: Cam, x0: number, y0: number, x1: number, y1: number) => { const [a, b] = toScreen(cam, [x0, y0], W, H), [c, d] = toScreen(cam, [x1, y1], W, H); return clamp(Math.min(a - SAFE.x, SAFE.x + SAFE.w - c, b - SAFE.y, SAFE.y + SAFE.h - d) / ZONE_FADE); };
  const seen = ZONES ? seenSafe : (cam: Cam, x0: number, y0: number, x1: number, y1: number) => { const hw = W / 2 / cam.z, hh = H / 2 / cam.z, d = Math.min(x0 - (cam.c[0] - hw), cam.c[0] + hw - x1, y0 - (cam.c[1] - hh), cam.c[1] + hh - y1) * cam.z; return clamp(d / (24 * k)); };
  // (on a phone the close-up is nearly the whole window, so the header and thread stay, cut only by `seen`)
  // a card's width with its byline, which can run past the card (an estimate that errs wide)
  const cardSpan = (i: number) => Math.max(CARD, 26 * k + LK.measure.text((spec.asks[i] as PlateAsk).label, G.px.label));
  const chat = (ctx: Ctx, env: Env, f: number, typed: string, caret: boolean, pr: number, hot: number, fo: Focus = { lean: 0, keep: -1, cam: CAM.home }, Gc: ChatGeom = G) => {
    // (the thread stays drawn under the composer's close-up: it used to fade out there and back in as the
    // camera eased out, and a thread fading in while the camera moves is content swapped, not carried: a
    // slide cut to motionscan. What the close-up's edge would cut, seen() fades as the camera reaches it.)
    // (the header recedes with the rest of the window while the camera leans on a card, as the thread does:
    // left at 60 %, the travel that follows carried it off the frame's top edge in a frame, a cut)
    // (clean: the window stays whole and opaque while the camera leans on a card, the lean a pure camera move;
    // the header and the thread receding in brand ink were see-through fills to layerscan and, with the move,
    // most of a sparse frame replaced in 0.1 s: a slide cut to motionscan)
    const recede = clean ? 0 : fo.lean;
    const C0 = G.CHAT, headA = (1 - recede) * seen(fo.cam, C0.x + 40 * k, C0.y + 30 * k, C0.x + C0.w - 40 * k, C0.y + 76 * k), compA = seen(fo.cam, Gc.INPUT.x, Gc.INPUT.y, Gc.INPUT.x + Gc.INPUT.w, Gc.INPUT.y + Gc.INPUT.h);
    drawChatFrame(ctx, { typed, full: ((a) => (isChat(a) ? a.prompt : undefined))(spec.asks[askOf(f)]), caret, placeholder: spec.placeholder ?? "Describe what you want…", genPress: pr, genHot: hot, title: spec.title, subtitle: spec.subtitle ?? "", genLabel: LK.shape.buttonLabel ?? spec.genLabel, accent: ACC, head: headA, composer: compA, composerGeom: Gc === G ? undefined : Gc }, G);
    const sc = scrollAt(f), rest = 1 - recede, [, cyT, , chH] = TH.clip;
    ctx.save(); ctx.beginPath(); ctx.rect(...TH.clip); ctx.clip();
    items.forEach((it, k) => {
      if (f < it.at) return;
      const y = ys[k] - sc; if (y > VIEW_BOTTOM || y + it.h < (ZONES ? cyT : 100)) return; // (on 9x16 an item scrolled wholly under the window's top is not drawn)
      // what of it the thread's window shows, and whether the camera shows all of that
      const vy0 = Math.max(y, cyT), vy1 = Math.min(y + it.h, cyT + chH), x0 = it.card !== undefined ? TH.cardX : TH.bubbleR - TH.bubbleMaxW, x1 = it.card !== undefined ? TH.cardX + (ZONES ? cardSpan(it.card) : CARD) : TH.bubbleR;
      const A = (it.card === fo.keep ? 1 : rest) * (vy1 > vy0 ? seen(fo.cam, x0, vy0, x1, vy1) : 1); if (A < 0.01) return;
      if (it.user !== undefined) {
        // the sent prompt rises into the thread from the composer it left (a bubble that only faded in was a dissolve to motionscan)
        const by = y + (1 - out3(ramp(f, it.at, it.at + 14))) * it.h * 0.3;
        ctx.globalAlpha = A * ramp(f, it.at, it.at + 3); ctx.font = LK.fonts.text(500, G.px.bubble);
        // (a custom look's bubble: its colours, square corners, or no bubble at all, the words alone)
        const bw = Math.max(...it.lines!.map((l) => ctx.measureText(l).width)) + 2 * TH.bubblePad, BS = LK.custom ? LK.shape.bubble : "rounded";
        if (BS !== "none") { ctx.fillStyle = LK.chat.bubble?.fill ?? PAL.chip; rr(ctx, TH.bubbleR - bw, by, bw, it.h - 2, BS === "square" ? 4 * k : TH.bubbleRad); ctx.fill(); }
        ctx.fillStyle = LK.chat.bubble?.ink ?? PAL.ink; ctx.textBaseline = "middle"; it.lines!.forEach((l, j) => ctx.fillText(l, TH.bubbleR - bw + TH.bubblePad, by + TH.bubbleH / 2 + j * TH.bubbleLineH)); ctx.globalAlpha = 1;
      } else {
        const i = it.card!, a = spec.asks[i] as PlateAsk;
        const d = T[i].drop, b = T[i].base;
        { const py0 = Math.max(y + TH.cardDy, cyT), py1 = Math.min(y + TH.cardDy + CARD, cyT + chH); ctx.globalAlpha = A; if (py1 > py0) probeRect(ctx, env, TH.cardX, py0, CARD, py1 - py0, `answer card ${i}`); } // the part the thread's window shows
        inkCard(ctx, TH.cardX, y + TH.cardDy, CARD, f, { t0: b + d.t0, land: b + d.land, full: b + d.full }, plateLayer(env, `ask${i}`, a.plate, plateFrame(i, f), 1080), a.label, a.crop, G, growAt(i), clamp((y + TH.cardDy - 30 * k - cyT) / (14 * k))); // a byline nearing the window's top fades out, dot and words together
        ctx.globalAlpha = 1;
      }
    });
    ctx.restore();
    chatIdx.forEach((i) => { const t = T[i]; inkDrop(ctx, f, { t0: t.base + t.drop.t0, land: t.base + t.drop.land }, [TH.cardX + CARD / 2, cardY(i, t.base + t.drop.land) + CARD / 2], G); });
  };
  // the camera: close on the composer while typing (the WHOLE composer in frame, so the typed words
  // never leave it), out to the room for the press, then a lean onto the new card, which stays whole
  // with a margin on every side
  const HOME = CAM.home;
  const inView = (c: P, z: number): P => { const hw = W / 2 / z, hh = H / 2 / z; return [clamp(c[0], Math.min(hw, W - hw), Math.max(hw, W - hw)), clamp(c[1], Math.min(hh, H - hh), Math.max(hh, H - hh))]; };
  // A later ask is typed with the whole room in view, the camera creeping 3 % toward its composer (as it
  // always was on a phone, where the composer is nearly the frame's width). A close-up on the composer had
  // to ease back out before the press, and the thread above it could only arrive whole: each earlier card
  // stayed hidden until the move had brought it wholly inside the view, then appeared in two frames (a
  // slide cut to motionscan, and a pop to the eye).
  const leanOn = (i: number): Cam => {
    const cy = cardY(i, T[i].base + T[i].len), lab = 44 * k, box = { x: TH.cardX, y: cy - lab, w: ZONES ? cardSpan(i) : CARD, h: CARD + lab }, m = 36 * k;
    if (ZONES) {
      // 9x16: the card and its byline centred in the safe rectangle, as large as it allows up to leanZ
      const S = SAFE, z = Math.max(1, Math.min(CAM.leanZ, (0.86 * S.w) / box.w, (0.86 * S.h) / box.h)), bc: P = [box.x + box.w / 2, box.y + box.h / 2];
      const c: P = [bc[0] - (SC[0] - W / 2) / z, bc[1] - (SC[1] - H / 2) / z];
      return { c: [clamp(c[0], box.x + box.w - (S.x + S.w - m - W / 2) / z, box.x - (S.x + m - W / 2) / z), clamp(c[1], box.y + box.h - (S.y + S.h - m - H / 2) / z, box.y - (S.y + m - H / 2) / z)], z };
    }
    const z = Math.max(1, Math.min(CAM.leanZ, (0.86 * W) / box.w, (0.86 * H) / box.h)), hw = W / 2 / z, hh = H / 2 / z;
    const c = lerpP(HOME.c, [box.x + box.w / 2, box.y + box.h / 2], 0.55);
    return { c: [clamp(c[0], box.x + box.w + m - hw, box.x - m + hw), clamp(c[1], box.y + box.h + m - hh, box.y - m + hh)], z };
  };
  type CaretFn = (typed: string) => P;
  // the hook's creep: 2 % on a wide frame, 4 % on 9x16, 5 % there in the clean look (its composer, the dock
  // too, is narrower, so its typing changed too little of the tall frame: dead air to the gate, frames 13 to 46)
  const HOOK_CREEP = 1 + (ZONES ? (clean ? 0.05 : 0.04) : 0.02);

  const prevChat = (i: number) => i > 0 && isChat(spec.asks[i - 1]) && T[i].tin === 0;
  // (the drawn dock's two sets of line breaks: the hook's, then halfway, as its rows change, the dock's own, kept
  // to the landing; a one-line dock never wraps)
  const HERO_WRAP = HERO ? { px: HERO.TEXT.px, maxW: HERO.GEN.x - 20 * HERO.k - HERO.TEXT.x } : undefined;
  const DOCK_WRAP = { px: G.TEXT.px, maxW: G.wrap > 0 ? G.GEN.x - 20 * G.k - G.TEXT.x : Infinity };
  const heroAt = (i: number, l: number): ChatGeom => {
    if (!HERO || i !== 0) return G;
    if (clean) { // the clean dock: a glide down whole, at its own size (CLEAN_DOCK)
      const a0 = T[i].b + CLEAN_DOCK.at, q1 = glide(ramp(l, a0, a0 + CLEAN_DOCK.move));
      if (q1 >= 1) return G;
      return scaledComposer(HERO, DOCK_S, lerpP(footOf(HERO), footOf(G), q1));
    }
    const u = inOut(ramp(l, T[i].b + DOCK_AT, T[i].b + DOCK_AT + DOCK_LEN)); if (u >= 1) return G;
    const mix = (a: number, b: number) => a + (b - a) * u, R = <T extends Record<string, number>>(a: T, b: T) => Object.fromEntries(Object.keys(a).map((key) => [key, mix(a[key], b[key])])) as T;
    // (wrapped as the hook, then as the dock, never afresh at each eased width: words jumped between lines three
    // times on the move; now the breaks change once, halfway, with the composer's rows)
    const dockLines = Math.max(1, G.wrap);
    return { ...G, INPUT: R(HERO.INPUT, G.INPUT), GEN: R(HERO.GEN, G.GEN), TEXT: R(HERO.TEXT, G.TEXT), k: mix(HERO.k, G.k), px: R(HERO.px, G.px), lineH: mix(HERO.lineH, G.lineH), wrap: u < 0.5 ? HERO.wrap : dockLines, wrapAs: u < 0.5 ? HERO_WRAP : DOCK_WRAP };
  };
  // `lean` (0..1) is how far the camera leans in; the corner mark steps aside while it leans, since the
  // lean carries the composer under the corner
  const camAt = (_caret: CaretFn, f: number, i: number): { cam: Cam; lean: number; keep: number } => {
    const t = T[i], l = f - t.base;
    // the room, creeping in while the words arrive and on through the press: the frame is never a still (a
    // camera that stopped as the pointer arrived left two identical frames before Generate went down, a
    // freeze to the gate). The hook creeps 2 % on the whole frame (4 % on 9x16, where typing alone changes too
    // little of a tall frame to read as motion), a later ask 3 % toward its composer.
    const hero = !!HERO && i === 0, mz = hero ? 1 + (HOOK_CREEP - 1) * ramp(l, -20, t.up + 10) : 1 + 0.03 * ramp(l, -20, t.up + 10);
    // (9x16: the creep is about the window's centre for the hook, the composer's otherwise, so neither moves toward a zone;
    // on a wide frame it is about the window's bottom right corner, so the window never grows into the corner mark beside it)
    const room: Cam = ZONES ? { c: inView(about(hero ? [G.CHAT.x + G.CHAT.w / 2, G.CHAT.y + G.CHAT.h / 2] : [G.INPUT.x + G.INPUT.w / 2, G.INPUT.y + G.INPUT.h / 2], mz), mz), z: mz } : { c: inView(about([G.CHAT.x + G.CHAT.w, G.CHAT.y + G.CHAT.h], mz), mz), z: mz };
    // (from the card before to this composer: in-out until the settle begins, never a 16-frame whip)
    if (prevChat(i) && l < t.b - 8) { const q = inOut(ramp(l, 0, t.b - 8)); return { cam: camLerp(leanOn(i - 1), room, q), lean: 1 - q, keep: i - 1 }; }
    const lean0 = Math.max(t.drop.full - 10, cardSettled(i));
    // (clean: when a travel or the end card follows, the lean is still moving as the ask ends, so the camera
    // never crawls to rest on a sparse frame before it moves again: its last slow frames, a near-still camera
    // over thin type, replaced most of the frame in 0.1 s with too little move to explain it, a slide cut)
    const leanEnd = clean && !(i < n - 1 && T[i + 1].tin === 0) ? t.len + 12 : t.len;
    if (l > lean0) { const q = inOut(ramp(l, lean0, leanEnd)); return { cam: camLerp(room, leanOn(i), q), lean: q, keep: i }; }
    return { cam: room, lean: 0, keep: -1 };
  };
  // the same camera without a canvas (for the sound's pan): the caret from the build-time width estimate
  const caretEst: CaretFn = (typed) => {
    if (G.wrap > 0) { const ls = LK.wrap(typed, G.TEXT.px, G.GEN.x - 20 * k - G.TEXT.x); return [G.TEXT.x + LK.measure.text(ls[ls.length - 1], G.TEXT.px), G.TEXT.base + (ls.length - 1) * G.lineH - 0.35 * G.TEXT.px]; }
    return [G.TEXT.x + LK.measure.text(typed, G.TEXT.px), G.TEXT.base - 12];
  };
  // THE POINTER comes in for the press (from `from`, off the frame), and once the press is up it eases a
  // step aside, off the button's word, and rests there for the rest of the ask: a hand that clicked and let
  // go. It used to glide back out of frame and read as drifting into empty space after every click.
  const pointerPath = (ctx: Ctx, l: number, t: { b: number; down: number; up: number }, on: P, pr: number, from: P = CAM.pointerOff, restAt?: P) => {
    if (l < t.b - 4) return;
    const rest: P = restAt ?? [on[0] + 26 * k, on[1] + 30 * k];
    // (it arrives still moving a little, and the press stops it: an out-cubic came to rest a frame early and
    // left two identical frames before the press at 60 fps)
    const arrive = (q: number) => 0.85 * out3(q) + 0.15 * q;
    pointer(ctx, l < t.up + 4 ? lerpP(from, on, arrive(ramp(l, t.b - 4, t.down))) : lerpP(on, rest, inOut(ramp(l, t.up + 4, t.up + 22))), pr * 0.8, CAM.pointerS, LK.pointer);
  };
  const chatScene = (ctx: Ctx, env: Env, f: number, i: number) => {
    const t = T[i], l = f - t.base, Gc = heroAt(i, l), caret: CaretFn = (s) => caretAt(ctx, s, Gc, (spec.asks[i] as PlateAsk).prompt);
    const { cam, lean, keep } = camAt(caret, f, i);
    useCam(ctx, env, cam);
    const typed = typedAt((spec.asks[i] as PlateAsk).prompt, l, t.times), pr = press(l, t.down, t.up);
    chat(ctx, env, f, l < t.up ? typed : "", l < t.up, pr, ramp(l, t.down - 10, t.down - 2), { lean, keep, cam }, Gc);
    // the pointer comes in for the press and glides back out; it never pops (it fades as the camera leans on
    // the new card, so the travel that follows starts without it instead of dropping it in one frame)
    { const pa = keep === i ? 1 - lean : 1; if (pa > 0.01) { ctx.globalAlpha = pa; pointerPath(ctx, l, t, [Gc.GEN.x + Gc.GEN.w / 2 + 18 * Gc.k, Gc.GEN.y + Gc.GEN.h / 2 + 6 * Gc.k], pr); ctx.globalAlpha = 1; } }
    // the mark is gone BEFORE the lean moves the composer under it, and back only once the camera has left
    const show = lean > 0 && l > ASK / 2 ? 0 : l > ASK / 2 && l > t.drop.full - 18 ? 1 - ramp(l, t.drop.full - 18, t.drop.full - 10) : prevChat(i) && l < t.b ? ramp(l, t.b - 8, t.b) : 1;
    if (show > 0) { ctx.globalAlpha = show; bug(ctx, env); ctx.globalAlpha = 1; }
  };
  // ---------------------------------------------------------------- the product UI, a film in a card, and a split beat's words
  const panelOf = (i: number): Rect => ((spec.asks[i] as UiAsk | FilmAsk).split?.length ? L.split.ui : UI_FULL);
  // never a still: a panel beside its words creeps closer about its own centre all through the ask
  // (8 %) and leans 4 % more once its items land (it never grows into the words' column)
  const pushZ = (l: number, len: number, t0: number) => 1 + 0.08 * ramp(l, 0, len) + 0.04 * inOut(ramp(l, t0, len + 30));
  const push = (ctx: Ctx, env: Env, r: Rect, l: number, len: number, t0 = 0) => { const z = pushZ(l, len, t0 || len), cx = r.x + r.w / 2, cy = r.y + r.h / 2; ctx.setTransform(env.scale * z, 0, 0, env.scale * z, env.scale * cx * (1 - z), env.scale * cy * (1 - z)); };
  // a full-frame UI ask has the chat's camera grammar: close on the command bar while the ask is typed
  // (creeping in), out to the whole window for the press, then a lean onto the items as they land
  const uiCam = (i: number, l: number): Cam => {
    // the window stays whole in frame on every frame: the camera creeps toward it, eases back for the
    // press, then leans in as the items land, never closer than the window's own fit
    const a = spec.asks[i] as UiAsk, t = T[i], win = uiWindow(panelOf(i), a.ui, minPx), wc: P = [win.x + win.w / 2, win.y + win.h / 2];
    // (9x16: fitted to the safe rectangle, and zooming about the window's centre, which never moves)
    const fit = ZONES ? Math.max(1, Math.min((0.94 * SAFE.w) / win.w, (0.92 * SAFE.h) / win.h)) : Math.max(1, Math.min((0.94 * W) / win.w, (0.92 * H) / win.h));
    const toward = (z: number): Cam => (ZONES ? { c: inView(about(wc, z), z), z } : { c: inView(lerpP(HOME.c, wc, clamp((z - 1) / (fit - 1 || 1))), z), z });
    if (l >= t.down) return toward(1 + (fit - 1) * 0.9 * inOut(ramp(l, t.down, t.len + 40))); // from the press on, never resting; still moving when the ask ends
    // (on 9x16 a window that already fills the safe rectangle has little fit left to creep into, and the
    // typing alone changed too little of a tall frame: dead air to the gate. There it creeps 6 % at least
    // while the words arrive, about its centre: fitted to 94 % of the safe rectangle, it stays inside it
    // with its padding, and eases back to the whole window for the press)
    const open = toward(1 + (ZONES ? Math.max((fit - 1) * 0.35, 0.06) : (fit - 1) * 0.35) * ramp(l, -20, t.b)); // already creeping on frame 0
    // the ease back for the press is one long in-out, never a snap: an expo here took most of the zoom in
    // 3 frames, and a text-dense window zoomed that fast is replaced pixel for pixel (a slide cut to
    // motionscan). Kept this gentle, typing, ease-back and press read as ONE beat of one screen, not
    // three stills of the same layout (motionscan repeat: the carousel)
    return camLerp(open, HOME, inOut(ramp(l, t.b - 24, t.down)));
  };
  let quietGround = false; // inside a travel the ground is already laid, once, under both places
  const ground = (ctx: Ctx, env: Env) => { ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); if (quietGround) return; ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, W, H); };
  // where the pointer rests after a product's click: up off the window, just above its header, so it never
  // settles on a row's figure (down and right of the button, as the chat's rest, it sat on "$1,208" on 9:16)
  const uiRest = (i: number) => {
    const a = spec.asks[i] as UiAsk, r = panelOf(i), [ax, ay] = uiActionAt(r, a.ui, minPx), on: P = [ax + 14 * k, ay + 8 * k], win = uiWindow(r, a.ui, minPx);
    return { i, tip: [on[0] + 20 * k, win.y - 29 * CAM.pointerS - 10 * k] as P, win, s: CAM.pointerS };
  };
  const uiScene = (ctx: Ctx, env: Env, f: number, i: number) => {
    const a = spec.asks[i] as UiAsk, t = T[i], l = f - t.base, r = panelOf(i), pr = press(l, t.down, t.up);
    ground(ctx, env); if (a.split?.length) push(ctx, env, r, l, t.len, t.drop.t0); else useCam(ctx, env, uiCam(i, l));
    const typed = a.prompt ? typedAt(a.prompt, l, t.times) : "";
    { const w = uiWindow(r, a.ui, minPx); probeRect(ctx, env, w.x, w.y, w.w, w.h, "product window"); }
    drawProductUI(ctx, r, a.ui, { f: l, t0: t.drop.t0 }, THEME, { minPx, typed, caret: !!a.prompt && l < t.down, press: pr, hot: ramp(l, t.down - 10, t.down - 2), accent: ACC });
    // (into a product's action from the right, along its header: a path up from the corner crossed the rows and paused on a figure)
    { const [ax, ay] = uiActionAt(r, a.ui, minPx), q = uiRest(i); pointerPath(ctx, l, t, [ax + 14 * k, ay + 8 * k], pr, [ax + 0.5 * W, ay - 20 * k], q.tip); }
    if (a.split?.length) splitWords(ctx, env, a.split, l, wordsAt(t.tin), wordsOut(i, l));
    bug(ctx, env);
  };
  // TYPE ARRIVES WITH ITS PLACE AND LEAVES IN PLACE (clean). A split beat's words rise halfway through the
  // travel in (a word rising while the camera is still is a slide to motionscan; carried by the move it is
  // part of the move), and sink out (setType's out: typeExit, ease-in, 1.3x their size), bottom line first,
  // in the last SINK frames before the camera leaves, so no line is carried across a platform zone or
  // sliced by the frame's edge (framecheck zones, layerscan exits). The last ask's words stay: the end card
  // blooms over them.
  const SINK = 18; // 0.6 s: type leaves in 0.5 to 0.7 s (motion-grammar.md)
  const wordsAt = (tin: number) => Math.round(tin / 2);
  // 0..1 over the sink, staggered per line by sunk(). The last ask's words sink too, before the motif's
  // drop starts to swell, so the drop flies and the end card blooms over clear canvas, never over a word
  // (a fresh critic saw the drop land on the headline's last letter and the bloom eat it mid-word)
  // (the last ask's words finish sinking halfway through the drop's flight, still gone before it lands and the
  // end card blooms; they sink while the bead swells beside the product's action and the drop leaves it, away
  // from them. Gone before the swell, and then before the flight, they left a phone frame its small product
  // window alone for over half a second: "6 text blocks packed into 25 % of the frame")
  const sinkAt = (i: number) => (i < n - 1 ? T[i].len - SINK - 1 : MOTIF ? T[i].len - Math.floor(DL / 2) - SINK - 1 : T[i].len);
  const wordsOut = (i: number, l: number) => (i < n - 1 || MOTIF ? (l - sinkAt(i)) / SINK : 0);
  /** Line j of nL leaving at sink progress q: the bottom line first, each in its own share of the sink with no overlap, so a sinking line never drops into the band of a line still leaving (a reader sees the two run together as one line). */
  const sunk = sinkOf;
  const filmCard = (i: number): Rect => { const a = spec.asks[i] as FilmAsk, r = panelOf(i), s = Math.min(r.w / a.film.meta.W, r.h / a.film.meta.H), w = a.film.meta.W * s, h = a.film.meta.H * s; return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h }; };
  const filmScene = (ctx: Ctx, env: Env, f: number, i: number) => {
    const a = spec.asks[i] as FilmAsk, t = T[i], l = f - t.base, c = filmCard(i), from = a.from ?? 0, to = a.to ?? a.film.meta.durationFrames - 1;
    ground(ctx, env); push(ctx, env, c, l, t.len);
    for (let q = 5; q >= 1; q--) { ctx.fillStyle = `rgba(40,30,20,${0.022})`; rr(ctx, c.x - q * 2, c.y + q * 3, c.w + q * 4, c.h + q * 3, 22 * k + q * 2); ctx.fill(); }
    ctx.save(); rr(ctx, c.x, c.y, c.w, c.h, 22 * k); ctx.clip();
    ctx.drawImage(plateLayer(env, `film${i}`, a.film, lerp(from, to, ramp(l, 0, t.len - 1)), Math.round(c.w * env.scale)).canvas, c.x, c.y, c.w, c.h);
    ctx.restore();
    if (a.split?.length) splitWords(ctx, env, a.split, l, wordsAt(t.tin), wordsOut(i, l));
    bug(ctx, env);
  };
  // words in their own column beside the live UI (stacked above it on a phone): sized to the column, written or set on
  // the words are the design of the beat: as large as their column allows (set type is wider than it is tall, so its cap is higher)
  const wordsCap = clean ? L.split.wordsPx * 1.6 : L.split.wordsPx, wOf = (t: string, sz: number) => (clean ? LK.measure.display(t, sz) : measure(t, sz));
  const splitLines = (lines: TypeLine[]) => { const col = L.split.words, out: TypeLine[] = []; for (const ln of lines) { const size = Math.min(wordsCap, (col.w / wOf(ln.text, 100)) * 100); if (size >= wordsCap * 0.62 || !ln.text.includes(" ")) out.push(ln); else LK.wrapDisplay(ln.text, wordsCap, col.w * 1.05).forEach((t) => out.push({ ...ln, text: t })); } return out; };
  // ...and as tall as their column allows: on a phone the column is a third of the window, and the
  // scaffold's stand-in words, wrapped to four lines at the width's size, ran down over the product window
  // (framecheck: text over text, text over the window's edge). Words too tall for it are set smaller and
  // wrapped again at that size until they fit; under the phone-safe size it is an error
  const splitFit = (lines0: TypeLine[]): { lines: TypeLine[]; size: number } => {
    const col = L.split.words, gk = clean ? 1.08 : 1.3, tall = (nL: number, sz: number) => (L.split.vertical ? sz * 1.25 : sz * 1.05) + (nL - 1) * sz * gk;
    const at = (cap: number) => { const ls: TypeLine[] = []; for (const ln of lines0) { if ((col.w / wOf(ln.text, 100)) * 100 >= cap * 0.62 || !ln.text.includes(" ")) ls.push(ln); else LK.wrapDisplay(ln.text, cap, col.w * 1.05).forEach((t) => ls.push({ ...ln, text: t })); } return { lines: ls, size: Math.min(cap, ...ls.map((x) => (col.w / wOf(x.text, 100)) * 100)) }; };
    const first = { lines: splitLines(lines0), size: 0 }; first.size = Math.min(wordsCap, ...first.lines.map((x) => (col.w / wOf(x.text, 100)) * 100));
    if (tall(first.lines.length, first.size) <= col.h) return first;
    for (let cap = wordsCap * 0.95; cap >= L.split.wordsPx * 0.5; cap *= 0.95) { const f = at(cap); if (tall(f.lines.length, f.size) <= col.h && f.size >= minWords) return f; }
    throw new Error(`launchTemplate ${shape}: the split words "${lines0.map((x) => x.text).join(" ")}" do not fit their column (${Math.round(col.w)} x ${Math.round(col.h)} px) at the phone-safe size; use fewer words`);
  };
  const minWords = L.type.minPx * 0.75;
  const splitWords = (ctx: Ctx, env: Env, lines0: TypeLine[], l: number, tin: number, out = 0) => {
    const col = L.split.words, { lines, size } = splitFit(lines0), gap = size * (clean ? 1.08 : 1.3);
    const y0 = L.split.vertical ? col.y + size : col.y + col.h / 2 - ((lines.length - 1) * gap) / 2 + size * 0.35;
    lines.forEach((x, j) => {
      const p = ramp(l, tin + j * 12, tin + 18 + j * 12);
      if (clean) { if (lineShown(ctx, env, x.text, col.x, y0 + j * gap, size)) setType(ctx, env, x.text, col.x, y0 + j * gap, size, p, { font: LK.fonts.display, color: x.color === C.accent ? THEME.accent : x.color ?? PAL.ink, weight: 800, out: sunk(out, j, lines.length) }); }
      else if (lineShown(ctx, env, x.text, col.x, y0 + j * gap, size, measure(x.text, size))) writeOn(ctx, env, x.text, col.x, y0 + j * gap, size, p, x.style, { color: x.color, align: "left", seed: 21 + j, out: sunk(out, j, lines.length), tool: PEN });
    });
  };
  // where a UI ask's world point is on screen at content frame f (its camera, or the split panel's push)
  const uiScreen = (i: number, f: number, p: P): P => { const a = spec.asks[i] as UiAsk, l = f - T[i].base; if (!a.split?.length) return toScreen(uiCam(i, l), p, W, H); const r = panelOf(i), t = T[i], z = pushZ(l, t.len, t.drop.t0), cx = r.x + r.w / 2, cy = r.y + r.h / 2; return [cx + (p[0] - cx) * z, cy + (p[1] - cy) * z]; };
  const sceneOf = (ctx: Ctx, env: Env, f: number, i: number) => { const a = spec.asks[i]; if (isChat(a)) chatScene(ctx, env, f, i); else if (a.kind === "ui") uiScene(ctx, env, f, i); else filmScene(ctx, env, f, i); };
  const bloomOpts = clean ? { shape: "circle" as const, rim: 0, bg: PAL.bg } : {};
  const CLEAN_ST = 12; // a clean word page's lines follow each other closer: set type settles sooner than a brush

  // ---------------------------------------------------------------- the clean preset's travels and word pages
  // where the next place is: below on a wide frame; on a tall one to the left, the one side of a phone
  // frame with no platform zone, so everything ARRIVES clear of the zones (strings that arrived through the
  // right-hand column popped in on the last frame). Tall places sit one safe width apart, not one frame
  // width: they overlap only in the right-hand column, which holds nothing at rest, so the next place's
  // content is in view from the first frame of the move and no frame between two places is empty. Either
  // way no travel is longer than one frame width, so TRV holds for every shape.
  // (a wide or square frame alternates between travels: down, then up, then down, in the order the seams come.
  // Every travel going down read as one move repeated: "two travels from below", a fresh critic. Sideways
  // was tried: a wide place a frame width away is wholly out of view until the move brings it in, so the
  // frame emptied and then filled, a slide cut to motionscan)
  const SEAMS: string[] = []; spec.asks.forEach((_, i) => { if (i > 0 && TIN[i] > 0) SEAMS.push(`ask:${i}`); if (i < n - 1 && words[i]?.length) SEAMS.push(`page:${i}`); });
  const axOf = (seam: string): P => (W < H ? [-(SAFE.x + SAFE.w), 0] : SEAMS.indexOf(seam) % 2 ? [0, -H] : [0, H]);
  // on a phone shape the UI's own strings (its labels and figures) that the travel carries through a
  // platform zone (the top band, the bottom band, the right-hand column) are not drawn there: each fades,
  // whole, as it reaches one, as the chat's seen() does. The left side has no zone; there the frame's edge
  // is a clean cut while the camera moves. Set words never travel (wordsOut, the page's sink).
  // (a string fades over the ZONE_BAND px before it reaches a zone, so it leaves in about five frames of the
  // travel, never in one. The band is measured from where the string rests (the place at its own spot, d = 0):
  // one that rests nearer the zone than the band fades from its rest distance, so nothing near a safe edge
  // dims the moment a travel starts or snaps back when it ends. Inside a zone it is never drawn.)
  const inSafe = (y0: number, x1: number, y1: number) => x1 <= SAFE.x + SAFE.w && y0 >= SAFE.y && y1 <= SAFE.y + SAFE.h;
  // (on a frame with no zones the drawn look fades a carried string the same way before the frame's own
  // top and bottom edges, so a byline never leaves in one frame there either; the clean look's strings are
  // its brand ink, which never goes see-through, so they stay cut by the edge as the camera carries them)
  const zoneFade = ZONES ? zoneFadeOf(SAFE) : clean ? undefined : zoneFadeOf({ x: 0, y: 0, w: W, h: H });
  /** A set line inside a travel on a phone shape: drawn whole only while it is wholly inside the safe area (else not at all, so no line is ever half in a zone). */
  const lineShown = (c: Ctx, env: Env, text: string, x: number, y: number, size: number, width = LK.measure.display(text, size)) => {
    if (!ZONES || !quietGround) return true;
    c.setTransform(env.scale, 0, 0, env.scale, 0, 0); const m = c.getTransform(), S = env.scale, w = width;
    const xs = [x, x + w].map((v) => (m.a * v + m.e) / S), ys = [y - size * 0.8, y + size * 0.25].map((v) => (m.d * v + m.f) / S);
    return inSafe(Math.min(...ys), Math.max(...xs), Math.max(...ys));
  };
  /** The camera travels from one place to the next over q 0..1: both drawn where they sit in the world, each inside its own frame-sized place. */
  // (the ground is laid once under both places, so where two places overlap neither paints over the other)
  // (`hidden`: the place it leaves ended with the corner mark stepped aside, as a chat ask's lean does; the
  // mark then comes back over the travel's second half, never popping in on its first frame)
  // (callers sample a travel at mid-frame, (l + 0.5) / length: its first frame then already moves off the
  // place's last frame, which a place held still (a chat ask's lean) drew identically, a frozen pair to the gate)
  const travel = (ctx: Ctx, env: Env, q: number, from: (c: Ctx) => void, to: (c: Ctx) => void, AX: P, hidden = false) => {
    const u = glide(q), side = (k: number, draw: (c: Ctx) => void) => {
      const d: P = [AX[0] * k, AX[1] * k]; if (Math.abs(d[0]) >= W || Math.abs(d[1]) >= H) return;
      ctx.save(); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.beginPath(); ctx.rect(d[0], d[1], W, H); ctx.clip();
      draw(placed(ctx, env, { d, fade: zoneFade })); ctx.restore();
    };
    ground(ctx, env);
    quietBug = quietGround = true; try { side(-u, from); side(1 - u, to); } finally { quietBug = quietGround = false; }
    const a = hidden ? ramp(q, 0.5, 0.9) : 1; if (a > 0) { ctx.globalAlpha = a; bug(ctx, env); ctx.globalAlpha = 1; }
  };
  // a word page as a place: the camera comes in to it as its lines rise into place at the margin, they are read, and
  // sink out (typeExit) as the camera starts to leave; the page creeps closer (6 %) all the time it is on
  const PAGE_ON = Math.round(TRV / 2); // local frame the first line starts to rise: halfway, at the travel's top speed, so the rise is part of the move
  // local frame the lines start to sink: on a frame with no zones as the travel out starts, so they sink as
  // the camera carries them off; on a phone so the last line is gone at the last frame before the move
  // could carry the widest line (the page's full measure, crept 3 %) into the right-hand column
  // (a phone's word page sets its lines to three quarters of the measure, from the same left margin: the
  // room it leaves before the right-hand column lets the lines sink while the camera already moves)
  const PAGE_MEASURE = ZONES ? 0.75 : 1;
  // A sideways travel (a tall frame) carries the page right, and two edges then cross its lines: the right-hand
  // column (or the frame's right edge) ahead of them, and behind them the left edge of the page's own place,
  // which the next place is uncovering. The lines are gone before the move reaches either: a line sliced by
  // the edge of its place reads as a cut, not a move (a fresh look at the drawn example's 9:16 page found
  // "IDEA IN." still standing, its first letter shaved off, as the chat came in from the left).
  const pageRoom = () => {
    const at = L.type.at, cx = at ? at[0] : W / 2, x0 = at ? at[0] - L.type.maxW / 2 : (W - L.type.maxW) / 2, right = cx + (x0 + L.type.maxW * PAGE_MEASURE - cx) * 1.03, left = cx + (x0 - cx) * 1.03;
    return Math.min((ZONES ? SAFE.x + SAFE.w : W) - right, left) - 2;
  };
  const pageOut = (i: number) => { // (word page i: the travel that leaves it is the one into ask i + 1)
    const AX = axOf(`ask:${i + 1}`);
    // a travel down: the lines sink as it starts, carried off with the camera. A calm brand's lines do not
    // sink: the camera carries them off whole. Sinking while carried they moved at the travel's pace plus
    // their own, past what calm allows on a wide frame (motionscan temperament, 30 px a frame against 28),
    // and sunk before the travel they left its first frames a blank page moving (identical frames to the gate)
    if (!AX[0]) return CALM ? TYPE + TRV : TYPE;
    const room = pageRoom();
    let l = 0; while (l < TRV && glide((l + 1) / TRV) * Math.abs(AX[0]) <= room) l++;
    return TYPE + l - SINK;
  };
  // (the drawn look's lines are written in ink, left on the same margin: a hand line is narrower than its
  // set width estimate, so it is measured by its own glyphs. Each takes 12 frames, 10 after the one before,
  // so the page is written by the time the travel lands: ink alone changes too little of a phone frame to
  // read as motion (the gate's dead air), and the page must be done moving before it holds to be read)
  const ST = clean ? CLEAN_ST : 10, WR = clean ? 18 : 12, lineW = (t: string, size: number) => (clean ? LK.measure.display(t, size) : measure(t, size));
  const pageFit = (lines: TypeLine[]) => {
    const nL = lines.length, at = L.type.at, x0 = at ? at[0] - L.type.maxW / 2 : (W - L.type.maxW) / 2, maxW = L.type.maxW * PAGE_MEASURE;
    const size = Math.min(nL === 1 ? 220 : 170, ...lines.map((l) => (maxW / lineW(l.text, 100)) * 100)), gap = size * (clean ? 1.12 : 1.3), y0 = (at ? at[1] : H / 2) - ((nL - 1) * gap) / 2 + size * 0.36;
    return { x0, y0, size, gap, c: (at ?? [W / 2, H / 2]) as P };
  };
  const pageSet = (n: number) => PAGE_ON + WR + (n - 1) * ST - (clean ? 9 : 0); // local frame the last line is set (set type's out-cubic settles to the pixel 9 frames early; a pen line is done when its last stroke is)
  const pageScene = (ctx: Ctx, env: Env, lines: TypeLine[], local: number, k: number) => {
    const PAGE_OUT = pageOut(k);
    ground(ctx, env);
    const g = pageFit(lines), c = placed(ctx, env, { z: 1 + 0.06 * ramp(local, 0, TYPE + TRV), c: g.c });
    lines.forEach((l, i) => {
      const y = g.y0 + i * g.gap, p = ramp(local, PAGE_ON + i * ST, PAGE_ON + WR + i * ST), out = sunk((local - PAGE_OUT) / SINK, i, lines.length);
      if (!lineShown(c, env, l.text, g.x0, y, g.size, lineW(l.text, g.size))) return;
      if (clean) setType(c, env, l.text, g.x0, y, g.size, p, { font: LK.fonts.display, color: l.color === C.accent ? THEME.accent : l.color ?? PAL.ink, weight: 800, out });
      else writeOn(c, env, l.text, g.x0, y, g.size, p, l.style, { color: l.color, align: "left", seed: 7 + i, out, tool: PEN });
    });
    bug(ctx, env);
  };
  // the place a travel into ask i leaves: the word page before it (still creeping), or the ask before it, on its last frame
  const fitted = words.map((w) => (w?.length ? fitWords(w, L) : null));
  // a word page is read from the frame its last line is set until its lines start to sink: that must be
  // the reading rule's time (readable.ts readS), or the beat is too short for its words
  fitted.forEach((wl, i) => {
    if (!wl || i >= n - 1) return;
    const need = Math.ceil(readS(wl.map((x) => x.text).join(" ")) * 30), have = Math.min(TYPE, pageOut(i)) - pageSet(wl.length); // (read until the sink, or until the travel carries the page off)
    if (have < need) throw new Error(`launchTemplate: the word page "${wl.map((x) => x.text).join(" ")}" is up ${(have / 30).toFixed(2)} s once set and needs ${(need / 30).toFixed(2)} s to be read (readS), after ${(TRV / 30).toFixed(1)} s of travel in and before its 0.6 s sink; raise typeBeats or use fewer words`);
  });
  const prevPlace = (c: Ctx, env: Env, i: number, l: number) => { const wl = fitted[i - 1]; if (wl) pageScene(c, env, wl, TYPE + l, i - 1); else sceneOf(c, env, T[i].base - 1, i - 1); };

  // ---------------------------------------------------------------- the motif: the drop that becomes the mark's dot
  const MOTIF = spec.motif !== false;
  // a split beat's words are read too: from the frame the last line is set until they have sunk (the frame
  // check reads a line until it leaves; a beat shorter than its words' reading time is an error here, early)
  spec.asks.forEach((a, i) => {
    if (isChat(a) || !a.split?.length) return;
    const lines = splitFit(a.split).lines, set = wordsAt(TIN[i]) + 18 + (lines.length - 1) * 12, sink = sinkAt(i);
    const text = a.split.map((x) => x.text).join(" "), need = Math.ceil(readS(text) * 30), have = sink + SINK - set;
    if (have < need) throw new Error(`launchTemplate: the split words "${text}" of ask ${i} are up ${(have / 30).toFixed(2)} s once set, to the end of their sink, and need ${(need / 30).toFixed(2)} s to be read (readS); raise ${i === n - 1 && spec.claimBar !== undefined ? "claimBar (a later bar for the end card)" : "askBeats"} or use fewer words`);
  });
  // THE LOGO SIGNS THE CLEAN END CARD (a look with a logo, the stacked card): it stands before the name on its
  // baseline, LOGO_H of the name's size tall, and the group (logo, name, dot) shares the name's width budget
  const END_LOGO = clean && spec.endCard !== "grid" ? LK.chat.logo : undefined, LOGO_H = 0.86, LOGO_GAP = 0.24;
  const logoW1 = END_LOGO ? (LOGO_H * END_LOGO.w) / END_LOGO.h + LOGO_GAP : 0; // per unit of the name's size
  const titleSize = clean ? Math.min(L.end.titleMax * 1.6, (L.end.titleW / ((LK.customDisplay ? LK.measure.display(spec.title, 100) : estWidth(spec.title, 100) * 1.1) + 100 * logoW1)) * 100) : Math.min(L.end.titleMax, (L.end.titleW / measure(spec.title, 100)) * 100);
  // the clean end card is ONE centred group with presence: the wordmark large, the line under it,
  // the install block, the footer, stacked and centred in the frame (the drawn one keeps its layout)
  const END_L = (() => {
    if (!clean) return L.end;
    // (9x16: measured on the safe rectangle's width and centred on its height)
    // (on a phone the card is centred on the frame's axis, which sits left of the safe rectangle's: each line
    // gets the width the axis leaves it inside that rectangle, 10 px clear on each side, never 90 % of the
    // whole safe width: a line set in a real face ran into the button column)
    const AW = ZONES ? SAFE.w - 24 : W, E = L.end, axisW = ZONES ? 2 * Math.min(SAFE.x + SAFE.w - E.cx, E.cx - SAFE.x) - 20 : Infinity;
    const tp = E.taglinePx * 1.5, tl = LK.wrap(spec.tagline, tp, Math.min(axisW, AW * (ZONES ? 0.9 : 0.8))), tLH = Math.round(tp * 1.3);
    const inst = installRows(spec.install, Math.min(axisW, AW * 0.86) - 2 * E.padX, minPx, E.monoPx * 1.35), mono = inst.px, rowH = Math.round(mono * 2), ph = rowH * inst.rows.length + 50 * k;
    if (mono < minPx - 1e-9) throw new Error(`launchTemplate ${shape}: the install lines would be ${mono.toFixed(1)} px on the clean end card (phone-safe minimum ${minPx} px). Shorten the install line, or ship this shape without it`);
    const g1 = titleSize * 0.42, g2 = tLH * 0.9, g3 = spec.footer ? 44 * k : 0, block = titleSize * 0.74 + g1 + tl.length * tLH + g2 + ph + g3 + (spec.footer ? E.footerPx : 0);
    const titleY = (ZONES ? SAFE.y * 2 + SAFE.h - block : H - block) / 2 + titleSize * 0.74, taglineY = titleY + g1 + tLH / 2, panelY = taglineY + (tl.length - 0.5) * tLH + g2;
    return { ...E, titleY, tagline: tl, taglinePx: tp, taglineLH: tLH, taglineY, panelY, monoPx: mono, rows: inst.rows, wrapped: inst.wrapped, rowH, lineY0: panelY + 25 * k + rowH / 2, footerY: panelY + ph + g3 + E.footerPx / 2, caret: [Math.round(mono * 0.53), Math.round(mono * 1.13)] as [number, number] };
  })();
  const titleW = clean ? (LK.customDisplay ? LK.measure.display(spec.title, titleSize) : estWidth(spec.title, titleSize) * 1.08) : measure(spec.title, titleSize);
  // the grid end card (endCard.ts): its lockup is the name set right up to the drop, which sits on the
  // baseline as the name's full stop. The lockup's box is fixed by its aspect, so the dot's place is
  // known here, before anything is drawn, and the motif's drop can fly to it.
  const GRID = spec.endCard === "grid", GRID_ON = 30, LOCK = { cap: 0.74, dot: 0.1, gap: 0.1 }; // per unit of the name's type size
  const CARD_SPEC: EndCardSpec | null = GRID ? {
    // (the name sits on the box's foot: a descender hangs about 0.3 of the box below it, and the line under
    // it keeps its air under the letters: a fresh critic saw the y's tail 15 px over the tagline)
    lockup: { aspect: ((LK.customDisplay ? LK.measure.display(spec.title, 100) : estWidth(spec.title, 100)) + 100 * (LOCK.gap + 2 * LOCK.dot)) / (100 * LOCK.cap), descent: /[gjpqy,;]/.test(spec.title) ? 0.3 : 0, draw: (c, b) => {
      const size = b.h / LOCK.cap, room = b.w - size * (LOCK.gap + 2 * LOCK.dot); // the dot is drawn by the end page: it is where the drop lands
      // the box comes from an estimate of the name's width: the real face is scaled to fill it exactly, so
      // the name starts on the card's margin and ends one gap before the dot (within 25 % either way)
      c.font = LK.fonts.display(800, size); const k = clamp(room / c.measureText(spec.title).width, 0.75, 1.25);
      c.font = LK.fonts.display(800, size * k); c.fillStyle = PAL.ink; c.textAlign = "right"; c.textBaseline = "alphabetic"; c.fillText(spec.title, b.x + room, b.y + b.h); c.textAlign = "left";
    } },
    date: spec.tagline, venue: spec.install.join("  ·  "), cta: spec.footer ?? `Get ${spec.title}`,
    // no sponsor band under this card: the stamp sits one gap after the text block, not at the far edge
    stamp: "inline",
    // the install line is set in mono, as a viewer would type it: it sits in the card's venue slot, its only 600-weight line
    colors: { ink: PAL.ink, accent: ACC ?? PAL.accent, ctaInk: LK.custom ? LK.onAccent : "#ffffff" }, font: (w, px) => (w === 600 ? LK.fonts.mono(px) : w >= 800 ? LK.fonts.display(w, px) : LK.fonts.text(w, px)),
  } : null;
  const CARD_L = CARD_SPEC ? endCardLayout(W, L.H, CARD_SPEC, (t, font) => LK.measureFont(t, font)) : null, LOCKUP = CARD_L?.lockup ?? null;
  // with no sponsor band at its foot the card's group is centred on the height (9:16: on the platforms'
  // safe band), so it does not hang from the top margin over an empty lower half
  const CARD_DY = CARD_L ? (() => { const top = CARD_L.lockup.y, bottom = Math.max(CARD_L.venue.y + CARD_L.venue.h, CARD_L.cta.y + CARD_L.cta.h), [lo, hi] = CARD_L.shape === "tall" ? [L.H * 0.17, L.H * 0.74] : [0, L.H]; return CARD_L.logos.length ? 0 : Math.round((lo + hi - (bottom - top)) / 2 - top); })() : 0;
  const dotR = LOCKUP ? (LOCKUP.h / LOCK.cap) * LOCK.dot : titleSize * (clean ? 0.1 : 0.085), dotGap = titleSize * 0.1;
  // the name and its dot are centred on the card's axis by their INK: a written name's first stroke starts a
  // side bearing after its advance width does, and centred by the advance it sat that far right of the axis
  const titleInkL = clean ? 0 : inkSpan(spec.title, titleSize, { seed: 11 })[0];
  const LOGO_W = logoW1 * titleSize; // the logo and its gap, in px
  const P1: P = LOCKUP ? [LOCKUP.x + LOCKUP.w - dotR, LOCKUP.y + CARD_DY + LOCKUP.h - dotR * 1.05] : [END_L.cx + (titleW + dotGap - titleInkL + LOGO_W) / 2, END_L.titleY - dotR * 1.05];
  // the logo's box: its left edge opens the group, its foot on the name's baseline
  const LOGO_BOX = END_LOGO ? (() => { const h = LOGO_H * titleSize, w = (h * END_LOGO.w) / END_LOGO.h, right = MOTIF ? P1[0] - dotR - dotGap - titleW - LOGO_GAP * titleSize : END_L.cx + (titleW + LOGO_W) / 2 - titleW - LOGO_GAP * titleSize; return { x: right - w, y: END_L.titleY - h, w, h }; })() : null;
  const coverFrom = (p: P) => Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - p[0], y - p[1])));
  // THE END CARD'S BLOOM opens at an even pace, its rim never faster than nine tenths of the brand's
  // temperament allows (motionKit.TEMPERAMENTS; lively when the brief names none), so the frames it takes
  // follow the distance it covers: about 30 on a wide frame, 43 on a phone one. The expo it had took most
  // of the frame in four, then the name's first strokes on the bare page were a second swap: two slide
  // cuts in a row on a phone frame (motionscan), and its rim swept past at 200 px a frame.
  const RAD = coverFrom(P1) * 1.14, TEMPER = spec.motion?.temperament ?? "lively", RIM_PACE = 0.9 * (typeof TEMPER === "string" ? TEMPERAMENTS[TEMPER] ?? TEMPERAMENTS.lively : TEMPER).maxSpeed * speedCeiling(W, 30);
  // (the page is drawn from local frame 2, so the even opening starts there, from nothing: the landed drop is
  // its first size, never a disc already 150 px across that the drop had to swell into on its way)
  const BLOOM_N = Math.ceil(RAD / RIM_PACE), END_BLOOM = { inF: BLOOM_N, ease: (t: number) => clamp((t * (BLOOM_N + 2) - 2) / BLOOM_N), close: false };
  const R0 = bloomRadius(2, 1e6, { ...END_BLOOM, radius: RAD }), RIM = Math.max(1, dotR - R0);
  // where the drop lifts off: Generate as the viewer sees it on the last chat ask (the card's centre if the lean hid it), the product's action, or the film's card
  const liftAt = (f: number): P => {
    const i = n - 1, a = spec.asks[i];
    // (a product's drop swells beside its action, to the left on the header, never on the button's word)
    if (!isChat(a)) return a.kind === "ui" ? uiScreen(i, f, (({ x, y, h }) => [x - 56 * k, y + h / 2] as P)(uiActionRect(panelOf(i), a.ui, minPx))) : ((c) => [c.x + c.w / 2, c.y + c.h / 2] as P)(filmCard(i));
    const cam = camAt(caretEst, f, i).cam, g = toScreen(cam, GEN_C, W, H), inFrame = g[0] > 60 && g[0] < W - 60 && g[1] > 60 && g[1] < H - 60;
    return inFrame ? g : toScreen(cam, [TH.cardX + CARD / 2, cardY(i, f) + CARD / 2], W, H);
  };
  const S0 = liftAt(END0 - DL), camZ = isChat(spec.asks[n - 1]) ? camAt(caretEst, END0 - DL, n - 1).cam.z : 1;
  const path = relay([{ at: END0 - DL, p: S0, r: 30 * k * camZ }, { at: END0, p: P1, r: R0 + RIM, arc: 140 * k }]);
  const motifDrop = (ctx: Ctx, env: Env, f: number) => {
    if (!MOTIF || f < END0 - DL - LIFT || f >= END0) return;
    ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = INK;
    if (f < END0 - DL) { const w = out3(ramp(f, END0 - DL - LIFT, END0 - DL)); ctx.beginPath(); ctx.arc(S0[0], S0[1], 30 * k * camZ * (0.2 + 0.8 * w), 0, Math.PI * 2); ctx.fill(); return; }
    // the drawn look trails ghosts of ink; the clean look's one accent is never see-through (layerscan
    // translucent: a brand colour at a part alpha reads as mud), so its drop stretches into one solid,
    // tapering streak along its path instead
    for (let j = 24; j >= 0; j--) { const q = path(Math.max(END0 - DL, f - j * 0.1)); if (!q) continue; ctx.globalAlpha = clean || j === 0 ? 1 : 0.22 * (1 - j / 25); ctx.beginPath(); ctx.arc(q.p[0], q.p[1], q.r * (clean ? 1 - j * 0.034 : 1 - j * 0.02), 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  };
  // the seam, checked: the drop's pose as it lands (the ask's side) is the ink the end card blooms from
  const seams: Seam[] = MOTIF ? [{ frame: END0, label: "last ask -> end card", out: path(END0) as MotifPose, into: { p: P1, r: R0 + RIM } }] : [];
  checkRelay(seams);

  const askScene = (ctx: Ctx, env: Env, f: number, withDrop = true) => {
    const i = askOf(f), t = T[i], l = f - t.base;
    // a seam between kinds: the new scene blooms open over the last frame of the one before
    // (+4: a bloom's first frames open by less than a pixel)
    if (t.tin && l < t.tin) travel(ctx, env, (l + 0.5) / t.tin, (c) => prevPlace(c, env, i, l), (c) => sceneOf(c, env, f, i), axOf(`ask:${i}`), !fitted[i - 1] && isChat(spec.asks[i - 1]));
    else sceneOf(ctx, env, f, i);
    if (withDrop) motifDrop(ctx, env, f);
  };
  // ---------------------------------------------------------------- the end card
  // the stacked card's name: end-card frames it writes (or sets) over; with the motif it starts as the page
  // opens from the dot, without it a little later. NAME_ON is the frame it is all on (set type's out-cubic
  // settles to the pixel 9 frames early; an ink line is done when its last stroke is). The drawn name is
  // written in 24 frames, as the bloom opens: written slower, its last strokes on the open page were too
  // small a change to read as motion and too early to be the hold (the gate's dead air)
  const NAME_W: [number, number] = clean ? (MOTIF ? [4, 26] : [8, 30]) : MOTIF ? [4, 28] : [10, 34], NAME_ON = NAME_W[1] - (clean ? 9 : 0) + 1;
  const endPage = (c: Ctx, env: Env, e: number) => {
    if (CARD_SPEC) { // the grid card: its parts rise into place in turn beside the landed drop
      // once it is all on, the card settles (endZ) and then rests: the frame people read and screenshot
      const k = c;
      k.setTransform(env.scale, 0, 0, env.scale, 0, env.scale * CARD_DY); drawEndCard(k, env, CARD_SPEC, ramp(e, 4, GRID_ON));
      k.setTransform(env.scale, 0, 0, env.scale, 0, 0); k.fillStyle = INK; k.beginPath(); k.arc(P1[0], P1[1], dotR, 0, Math.PI * 2); k.fill();
      c.textAlign = "left"; c.textBaseline = "alphabetic"; return;
    }
    const E = END_L, cx = E.cx, size = titleSize, [n0, n1] = NAME_W;
    // (with the motif the page blooms from the dot, wider and sooner: the name starts as it opens, so no frame waits)
    if (MOTIF) { const tx = P1[0] - dotR - dotGap; if (clean) setType(c, env, spec.title, tx, E.titleY, size, ramp(e, n0, n1), { font: LK.fonts.display, align: "right", color: PAL.ink, weight: 800 }); else writeOn(c, env, spec.title, tx, E.titleY, size, ramp(e, n0, n1), "ink", { color: C.ink, align: "right", seed: 11, tool: PEN }); c.setTransform(env.scale, 0, 0, env.scale, 0, 0); c.fillStyle = INK; c.beginPath(); c.arc(P1[0], P1[1], dotR, 0, Math.PI * 2); c.fill(); }
    else if (clean) setType(c, env, spec.title, cx + LOGO_W / 2, E.titleY, size, ramp(e, n0, n1), { font: LK.fonts.display, align: "center", color: PAL.ink, weight: 800 });
    else writeOn(c, env, spec.title, cx, E.titleY, size, ramp(e, n0, n1), "ink", { color: C.ink, align: "center", seed: 11, tool: PEN });
    // the logo grows in about its own foot with the name (whole, never see-through: a brand element is opaque)
    if (END_LOGO && LOGO_BOX) { const g = out3(ramp(e, n0, n0 + 12)); if (g > 0.01) { const B = LOGO_BOX, sc = (B.h / END_LOGO.h) * g; c.setTransform(env.scale, 0, 0, env.scale, 0, 0); c.save(); c.translate(B.x + B.w / 2, B.y + B.h); c.scale(sc, sc); c.translate(-END_LOGO.w / 2, -END_LOGO.h); drawEl(c, END_LOGO, { name: "logo" }); c.restore(); } }
    c.setTransform(env.scale, 0, 0, env.scale, 0, 0); c.textAlign = "center"; c.textBaseline = "middle";
    // THE LINE, THE INSTALL PANEL AND THE FOOTER OPEN WITH THE PAGE: the bloom reveals them whole, and only the
    // name writes itself. Each used to fade in after the name (a dissolve to motionscan), and a big dark panel
    // arriving on an empty page in a few frames was a second slide cut after the bloom's. Open from the
    // first frame, the install lines are on screen for the whole end card.
    c.fillStyle = PAL.soft; c.font = LK.fonts.text(500, E.taglinePx); E.tagline.forEach((t, j) => c.fillText(t, cx, E.taglineY + j * E.taglineLH));
    c.font = LK.fonts.mono(E.monoPx);
    // one row per install line, every row set left in the panel as a terminal sets them (centred rows started
    // at different places and read as a caption); a wrapped line's continuation is indented
    const rows = E.rows, nI = rows.length, cw = c.measureText("0").width, rowW = (r: { text: string; indent: number }) => c.measureText(r.text).width + r.indent * cw;
    const pw = (E.wrapped ? Math.max(...rows.map(rowW)) : Math.max(...spec.install.map((s) => c.measureText(s).width))) + 2 * E.padX, ph = E.rowH * nI + 2 * (E.lineY0 - E.panelY) - E.rowH, py = E.panelY, x0 = cx - pw / 2 + E.padX;
    c.fillStyle = clean ? PAL.ink : "#1f1c18"; rr(c, cx - pw / 2, py, pw, ph, 22 * L.k); c.fill();
    // (a custom look's panel is its ink with its ground's colour for the words: a light ink took white words)
    c.fillStyle = clean ? (LK.custom ? PAL.bg : "#ffffff") : "#ece4d6";
    c.textAlign = "left"; rows.forEach((r, j) => c.fillText(r.text, x0 + r.indent * cw, E.lineY0 + j * E.rowH)); c.textAlign = "center";
    // a terminal caret blinks after the last row: the hold reads as live, never as a freeze
    const lastW = c.measureText(rows[nI - 1].text).width, caretX = x0 + rowW(rows[nI - 1]) + 8 * (E.monoPx / 30);
    if (Math.floor((e - NAME_ON) / 15) % 2 === 0) { if (clean) c.fillStyle = THEME.accent; c.fillRect(caretX, E.lineY0 + (nI - 1) * E.rowH - E.caret[1] / 2, E.caret[0], E.caret[1]); }
    if (spec.footer) { c.fillStyle = PAL.soft; c.font = LK.fonts.text(500, E.footerPx); c.fillText(spec.footer, cx, E.footerY); }
    c.globalAlpha = 1; c.textAlign = "left"; c.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  };
  // THE END CARD SETTLES, never a dead hold: as its last part lands the page leans in 3 % (END_CREEP),
  // easing out to rest a second before the end (the frame people screenshot). A fresh critic read four
  // seconds of a still card as the film stopping. The install lines stay put to the eye: at its fastest the
  // lean moves a line's end by under a pixel a frame. It starts while the parts still land and only slows
  // from there: a creep that started from still (linear, or an in-out) left still stretches on both sides of
  // its move, and motionscan read them on 9x16 as one layout settling three times in a row.
  // (the stacked card leans in about a point on its own axis, level with the dot: about the dot itself, which
  // sits at the name's right end, the lean carried every line of the card left by 3 % of the dot's distance
  // from the axis, 20 px on 16:9, a fresh critic's d4-1. The grid card is not centred: it leans about its dot)
  const END_CREEP: P = GRID ? P1 : [END_L.cx, P1[1]];
  const ALL_ON = GRID ? GRID_ON : NAME_ON, endZ = (e: number) => 1 + 0.03 * out3(ramp(e, ALL_ON - 10, END - 30));
  const content = (ctx: Ctx, env: Env, f: number, exact: boolean) => {
    const g = clamp(exact ? Math.round(f) : f, 0, END0 + END - 1);
    if (g < END0) return askScene(ctx, env, g);
    const e = g - END0;
    bloomFrame(ctx, env, e + 2, END + 2, () => askScene(ctx, env, END0 - 1, false), (c) => endPage(placed(c, env, { z: endZ(e), c: END_CREEP }), env, e), { ...END_BLOOM, W, H, ...bloomOpts, ...(MOTIF ? { center: P1, radius: RAD, rim: lerp(RIM, clean ? 0 : 26, out3(ramp(e, 0, 7))), ink: INK } : {}) });
  };

  // ---------------------------------------------------------------- the cut, as data
  const segs: Seg[] = [];
  spec.asks.forEach((_, i) => {
    const last = i === n - 1;
    const b = BASE[i], e = b + LEN[i];
    segs.push(last && spec.claimBar !== undefined ? pic(b, e, SOLVED) : pic(b, e)); // SOLVED < ASK plays the ask faster; never slower
    if (!last && words[i]?.length) segs.push(type(fitted[i]!, TYPE, e - 1, e)); // (the fitted lines themselves: a page knows its index by them)
  });
  // the score plays at the film's bpm, exactly: the cuts sit on this grid. Sync wins over length, so
  // the end-card hold (not the tempo) takes up the difference: the film becomes whole bars of the score.
  const bed = !spec.audio && spec.score ? gridScore(spec.score, spec.bpm, 30, segs.reduce((a, x) => a + x.len, 0), END) : null;
  if (bed) END = bed.end;
  segs.push(pic(END0, END0 + END));
  const cut = makeCut(segs);
  const drawStage = (ctx: Ctx, env: Env, t: number) => {
    const { s, local } = cut.at(t), exact = Number.isInteger(t);
    if (s.kind === "pic") content(ctx, env, cut.contentOf(s, local), exact);
    // offset by 2 frames at each end so the bloom is already moving on the first and last frame
    // (clean: the camera travels from the ask to the word page; it travels on to the next ask in that ask's own first frames)
    else { const k = fitted.indexOf(s.lines); if (local < TRV) travel(ctx, env, (local + 0.5) / TRV, (c) => content(c, env, s.before, true), (c) => pageScene(c, env, s.lines, local, k), axOf(`page:${k}`), isChat(spec.asks[k])); else pageScene(ctx, env, s.lines, local, k); }
  };

  // ---------------------------------------------------------------- captions: the words a viewer reads, in cut frames
  const cutAt = (c: number) => cut.cutOf(c);
  const caps: { from: number; to: number; text: string }[] = [];
  spec.asks.forEach((a, i) => {
    const t = T[i], lo = cut.STARTS[cut.SEGS.findIndex((sg) => sg.kind === "pic" && sg.from === t.base)] ?? 0;
    if (isChat(a) || (a.kind === "ui" && a.prompt)) { const from = Math.max(lo, cutAt(t.base + Math.max(t.tin, t.times[0] ?? 0))), to = cutAt(t.base + Math.min(t.len - 1, isChat(a) ? t.drop.full : t.drop.t0 + 24)); if (from >= 0 && to > from) caps.push({ from, to, text: isChat(a) ? a.prompt : a.prompt! }); }
    const split = !isChat(a) ? a.split : undefined;
    if (split?.length) { const from = cutAt(t.base + wordsAt(t.tin) + 4), to = cutAt(t.base + t.len - 1) + 1; caps.push({ from, to, text: split.map((x) => x.text).join(" ") }); }
  });
  cut.SEGS.forEach((sg, k) => { if (sg.kind === "type") caps.push({ from: cut.STARTS[k] + 12, to: cut.STARTS[k] + sg.len, text: sg.lines.map((x) => x.text).join(" ") }); });
  const endAt = cut.STARTS[cut.SEGS.length - 1];
  caps.push({ from: endAt + 10, to: cut.N, text: `${spec.title}. ${spec.tagline}` });
  caps.sort((a, b) => a.from - b.from);
  for (let j = 0; j + 1 < caps.length; j++) caps[j].to = Math.min(caps[j].to, caps[j + 1].from); // one caption at a time
  const capAt = (t: number) => caps.find((c) => t >= c.from && t < c.to);
  const band = (ctx: Ctx, env: Env, t: number) => {
    const B = L.band!; ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
    if (B.y + B.h < L.H) { ctx.fillStyle = PAL.bg; ctx.fillRect(0, B.y + B.h, W, L.H - B.y - B.h); } // 9x16: under the band, the platforms' bottom zone: background only
    ctx.fillStyle = PAL.card; ctx.fillRect(B.x, B.y, B.w, B.h); ctx.fillStyle = PAL.line; ctx.fillRect(B.x, B.y, B.w, 2);
    const c = capAt(t); if (!c) return;
    const TX = ZONES ? { x: SAFE.x, w: SAFE.w } : B; // the caption's own column: on 9x16 clear of the right-hand buttons
    const px = Math.max(36, Math.round(B.h * 0.2)), lines = LK.wrap(c.text, px, TX.w - 120).slice(0, 2), a = Math.min(ramp(t, c.from, c.from + 6), 1 - ramp(t, c.to - 6, c.to));
    ctx.globalAlpha = a; ctx.fillStyle = PAL.ink; ctx.font = LK.fonts.text(600, px); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    lines.forEach((l, j) => ctx.fillText(l, TX.x + TX.w / 2, B.y + B.h / 2 + (j - (lines.length - 1) / 2) * px * 1.25)); ctx.globalAlpha = 1; ctx.textAlign = "left";
  };
  const draw = (ctx: Ctx, F: number, env: Env) => {
    const t = F / m;
    if (!L.band) return drawStage(ctx, env, t);
    const stage = { ...env, H }; ctx.save(); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    drawStage(ctx, stage, t); ctx.restore(); band(ctx, env, t);
  };

  // declared holds: the words' reading time on each type frame, and the end card once it is all on
  const holds: [number, number][] = [];
  cut.SEGS.forEach((s, k) => {
    if (s.kind !== "type") return;
    // the page is fully set (or written) from pageSet until its lines sink; it creeps, but slowly enough to read as a hold
    holds.push([cut.STARTS[k] + pageSet(s.lines.length), cut.STARTS[k] + Math.min(TYPE, pageOut(fitted.indexOf(s.lines))) + 6]); // (+6: a sink's first frames are an ease-in, still to the eye)
  });
  // a solved ask longer than the grid's: the finished card rests on screen until the end card blooms
  // (with the motif the drop is in flight over those frames, so they are not a hold)
  if (LEN[n - 1] > ASK && isChat(spec.asks[n - 1]) && !MOTIF) { const S = cut.STARTS[cut.SEGS.length - 2]; holds.push([S + LEN[n - 1] - 18, S + LEN[n - 1] + 6]); }
  holds.push([cut.N - END + (GRID ? GRID_ON - 2 : NAME_ON), cut.N]); // the end card, all on: read it, screenshot it (the grid card's out-cubic rise settles to the pixel 2 frames before GRID_ON)
  // a UI ask's action button bottoms out: the press lands before the items move (a stationary point by
  // design, one or two frames; at 60 fps and in small shapes the gate reads it as a still)
  spec.asks.forEach((a, i) => { if (isChat(a) || a.kind !== "ui") return; const F = cut.cutOf(T[i].base + T[i].up); if (F > 0) holds.push([F - 1, F + 2]); });
  // a split beat's words, once they are set and the product beside them has landed, are read until they
  // sink, as a word page's are: the panel creeps, but over a sparse product screen (a scaffold's stand-in,
  // two rows) the creep alone changes too little of the frame to be told from a freeze (the gate's dead air)
  spec.asks.forEach((a, i) => {
    if (isChat(a) || !a.split?.length) return;
    // (set type's out-cubic settles to the pixel 9 frames before its rise ends, as pageSet counts it; an item
    // has landed at its spring's first arrival, its overshoot after it under what the eye reads as moving)
    const t = T[i], set = wordsAt(t.tin) + 18 + (splitFit(a.split).lines.length - 1) * 12 - (clean ? 9 : 0), landed = a.kind === "ui" ? Math.max(t.drop.t0, ...uiSettles(a.ui, { t0: t.drop.t0 }).map((q) => q.frame)) : 0;
    // (reached by a travel, the words are set before the press and read while the product rests in its before
    // state: the hold starts with them, or that rest is dead air to the gate; otherwise once both have landed)
    const sink = sinkAt(i), from = cut.cutOf(t.base + (t.tin > 0 && t.drop.t0 > set ? set : Math.max(set, landed))), to = cut.cutOf(t.base + sink) + 6;
    if (from >= 0 && to > from) holds.push([from, to]);
  });

  // ---------------------------------------------------------------- sound: the picture's own cues
  const cues: LaunchCue[] = [];
  const at = (c: number) => { const F = cut.cutOf(c); return F < 0 ? -1 : Math.round(F * m); };
  const add = (c: number | { F: number }, cue: Omit<LaunchCue, "frame">) => { const fr = typeof c === "number" ? at(c) : Math.round(c.F * m); if (fr >= 0 && fr < cut.N * m) cues.push({ ...cue, frame: fr } as LaunchCue); };
  const screenX = (i: number, c: number, p: P) => toScreen(camAt(caretEst, c, i).cam, p, W, H)[0];
  if (!spec.audio && spec.sfx !== false) {
    spec.asks.forEach((a, i) => {
      const t = T[i], b = t.base;
      const prompt = isChat(a) ? a.prompt : a.kind === "ui" ? a.prompt : undefined;
      // a key for every character typed, a word's first key a touch firmer, the space bar its own sound
      if (prompt) t.times.forEach((tm, j) => { if (tm < 0) return; /* a key typed before frame 0 is not heard; one typed as the composer travels in is */ const ch = prompt[j], first = j === 0 || prompt[j - 1] === " ";
        const x = isChat(a) ? screenX(i, b + tm, caretEst(prompt.slice(0, j + 1))) : ((r) => (r ? r.x + 26 * k + LK.measure.text(prompt.slice(0, j + 1), 26) : W / 2))(uiCommandAt(panelOf(i), (a as UiAsk).ui, minPx));
        add(b + tm, { kind: "tick", variant: ch === " " ? "space" : "key", gainDb: first && ch !== " " ? 1.5 : 0, x, role: "key", label: `key ${JSON.stringify(ch)}` }); });
      if (isChat(a)) {
        const card = (c: number): P => [TH.cardX + CARD / 2, cardY(i, c) + CARD / 2];
        add(b + t.down, { kind: "press", variant: "thock", x: screenX(i, b + t.down, GEN_C), role: "press", label: "Generate" });
        add(b + t.drop.t0, { kind: "ink", variant: "plip", x: screenX(i, b + t.drop.t0, GEN_C), role: "drop", label: "the drop lifts" });
        add(b + t.drop.land, { kind: "ink", variant: "bloom", x: screenX(i, b + t.drop.land, card(b + t.drop.land)), role: "bloom", label: "it blooms into the card" });
        add(arrive(i), { kind: "pop", variant: "cork", x: screenX(i, arrive(i), card(arrive(i))), role: "land", label: "the card lands (spring)" });
      } else if (a.kind === "ui") {
        const r = panelOf(i);
        add(b + t.down, { kind: "press", variant: "thock", x: uiScreen(i, b + t.down, uiActionAt(r, a.ui, minPx))[0], role: "press", label: a.ui.action });
        // the items land on their springs: one cue per landing, never two within 4 frames, at most 4
        let last = -99, count = 0;
        for (const s of uiSettles(a.ui, { t0: b + t.drop.t0 }).sort((x, y) => x.frame - y.frame)) { if (s.kind === "out" || s.frame - last < 4 || count >= 4) continue; last = s.frame; count++; add(s.frame, { kind: "pop", variant: s.kind === "in" ? "tiny" : "cork", x: r.x + r.w / 2, role: s.kind === "in" ? "arrive" : "land", label: `${s.id} lands` }); }
      }
    });
    // the big reveal, once: a riser that ends as the drop lands on the end card, and one impact there
    const reveal = { F: endAt }, withKey = !!bed;
    add(reveal, { kind: "riser", variant: withKey ? "soft" : "air", beats: 4, ...(withKey ? {} : { lengthS: (4 * 60) / spec.bpm }), x: P1[0], role: "riser", label: "into the reveal" });
    add(reveal, { kind: "impact", variant: withKey ? "bloom" : "boom", x: P1[0], role: "impact", label: "the reveal" });
  }
  const plan = { fps, frames: cut.N * m, W, cues, bpm: spec.bpm, seed: 7, ...(bed ? { score: { piece: bed.piece, tempo: spec.bpm } } : {}) };
  const scoreBed = bed ? musicBed(() => bed.piece, cut.N, 30, -14, { limit: spec.limit, tempo: spec.bpm }) : null;
  const audio = spec.audio ?? (cues.length ? launchAudio(scoreBed, plan) : scoreBed ?? undefined);
  const sync = cues.filter((c) => c.role === "press" || c.role === "impact").map((c) => ({ frame: c.frame, label: c.label ?? c.role }));

  let memo: Map<string, LaunchFilm> | null = null;
  const self: LaunchFilm = {
    meta: { title: `${spec.title} · launch${shape === "16x9" ? "" : ` · ${shape}`}`, W, H: L.H, fps, bpm: spec.bpm, durationFrames: cut.N * m, raster: "cpu", kind: "launch", holds: holds.map(([a, b]) => [a * m - (m - 1), b * m] as [number, number]), ...(bed ? { score: { tempo: spec.bpm, form: bed.form, grid: true } } : {}),
      sync, captions: caps.map((c) => ({ from: Math.round(c.from * m), to: Math.round(c.to * m), text: c.text })), poster: Math.round((cut.N - END + 60) * m), ...(spec.checks ? { checks: spec.checks } : {}), ...(spec.motion ? { motion: spec.motion } : {}) },
    assets: { images: {} },
    shots: [{ id: "cut", start: 0, end: cut.N * m, draw }],
    audio,
    claims: [...new Set([...words.flat().map((x) => x.text), ...spec.asks.flatMap((a) => (isChat(a) ? [] : (a.split ?? []).map((x) => x.text))), spec.tagline, ...(spec.claims ?? [])].map((x) => x.trim()).filter(Boolean))],
    grammar: { scrolls, travels: SEAMS.map((seam) => ({ seam, ax: axOf(seam) })), pages: fitted.flatMap((wl, i) => (wl ? [{ i, set: pageSet(wl.length), out: pageOut(i) }] : [])), endBloom: { frames: BLOOM_N, radius: RAD }, lift: S0, endCard: { creep: END_CREEP, cx: END_L.cx, group: [LOGO_BOX ? LOGO_BOX.x : P1[0] - dotR - dotGap - titleW + titleInkL, P1[0] + dotR], logo: LOGO_BOX, tagline: END_L.tagline, taglineW: END_L.tagline.map((t) => LK.measure.text(t, END_L.taglinePx)), room: ZONES ? [SAFE.x, SAFE.x + SAFE.w] : [0, W] }, rests: spec.asks.flatMap((a, i) => (isChat(a) || a.kind !== "ui" ? [] : [uiRest(i)])), dock: clean && HERO ? (() => { const a0 = T[0].b + CLEAN_DOCK.at; return { move: [a0, a0 + CLEAN_DOCK.move] as [number, number], shrink: [a0 + CLEAN_DOCK.move, a0 + CLEAN_DOCK.move + CLEAN_DOCK.shrink] as [number, number], creep: HOOK_CREEP, heroPx: HERO.TEXT.px, dockPx: G.TEXT.px, composer: { x: G.INPUT.x, y: G.INPUT.y, w: G.INPUT.w, h: G.INPUT.h }, window: { x: G.CHAT.x, y: G.CHAT.y, w: G.CHAT.w, h: G.CHAT.h }, viewBottom: VIEW_BOTTOM }; })() : null, drops: chatIdx.map((i) => {
      const t = T[i], d = { t0: t.base + t.drop.t0, land: t.base + t.drop.land }, to: P = [TH.cardX + CARD / 2, cardY(i, t.base + t.drop.land) + CARD / 2];
      const at = (c: number) => { const q = inkDropAt(c, d, to, G); return q ? toScreen(camAt(caretEst, c, i).cam, q.p, W, H) : null; };
      // (`landing`: the slowest it moves over the last 30 % of the flight, where an in-out crawled)
      let peak = 0, landing = Infinity; for (let c = d.t0; c < d.land - 1; c += 0.5) { const a = at(c), b = at(c + 0.5); if (!a || !b) continue; const v = 2 * Math.hypot(b[0] - a[0], b[1] - a[1]); peak = Math.max(peak, v); if (c >= d.land - 0.3 * (d.land - d.t0)) landing = Math.min(landing, v); }
      return { i, flight: [d.t0, d.land] as [number, number], peak, landing };
    }), lastWords: MOTIF && !isChat(spec.asks[n - 1]) && (spec.asks[n - 1] as UiAsk | FilmAsk).split?.length ? { gone: T[n - 1].base + sinkAt(n - 1) + SINK, flight: [END0 - DL, END0] } : null, heroDock: HERO && !clean ? (() => {
      const a0 = T[0].b + DOCK_AT, pts = (l: number): P[] => { const g = heroAt(0, l), cam = camAt(caretEst, T[0].base + l, 0).cam; return ([[g.INPUT.x, g.INPUT.y], [g.INPUT.x + g.INPUT.w, g.INPUT.y], [g.INPUT.x, g.INPUT.y + g.INPUT.h], [g.INPUT.x + g.INPUT.w, g.INPUT.y + g.INPUT.h], [g.GEN.x, g.GEN.y], [g.TEXT.x, g.TEXT.base]] as P[]).map((p) => toScreen(cam, p, W, H)); };
      let peak = 0; for (let l = a0; l < a0 + DOCK_LEN + 1; l++) { const p = pts(l), q = pts(l + 1); peak = Math.max(peak, ...p.map((x, j) => Math.hypot(q[j][0] - x[0], q[j][1] - x[1]))); }
      const seen = new Set<string>(); for (let l = a0; l < a0 + DOCK_LEN; l++) { const g = heroAt(0, l); seen.add(g.wrapAs ? `${g.wrapAs.px}/${g.wrapAs.maxW}` : `fresh ${l}`); }
      return { frames: [a0, a0 + DOCK_LEN] as [number, number], peak, wraps: seen.size };
    })() : null, splits: spec.asks.flatMap((a, i) => (isChat(a) || !a.split?.length ? [] : [(({ lines, size }) => ({ i, lines: lines.map((x) => x.text), size, tall: (L.split.vertical ? size * 1.25 : size * 1.05) + (lines.length - 1) * size * (clean ? 1.08 : 1.3), room: L.split.words }))(splitFit(a.split))])) },
    cut, layout: L, cues, seams, heroPx: HERO ? HERO.TEXT.px : null, timing: T, captions: caps.map((c) => ({ from: Math.round(c.from * m), to: Math.round(c.to * m), text: c.text })),
    // the same film composed for another frame shape (one timeline: the cut, the timing and the sound do not change)
    reshape: (s: string) => { if (s === shape) return self; memo ??= new Map(); let f = memo.get(s); if (!f) { f = makeLaunchFilm({ ...spec, shape: s as Shape }); memo.set(s, f); } return f; },
  };
  return self;
};

// Words sized for the frame: a line that would come out under the phone-safe type size is broken at
// its middle space (a word page holds at most three lines); one that still cannot is an error.
export const fitWords = (lines: TypeLine[], L: LaunchLayout): TypeLine[] => {
  const sizeOf = (ls: TypeLine[]) => Math.min(ls.length === 1 ? 190 : 130, ...ls.map((l) => (L.type.maxW / measure(l.text, 100)) * 100));
  let out = lines;
  while (sizeOf(out) < L.type.minPx && out.length < 3) {
    const k = out.reduce((b, l, i) => (measure(l.text, 100) > measure(out[b].text, 100) ? i : b), 0), words = out[k].text.split(" ");
    if (words.length < 2) break;
    let best = 1, bw = Infinity; for (let j = 1; j < words.length; j++) { const w = Math.max(measure(words.slice(0, j).join(" "), 100), measure(words.slice(j).join(" "), 100)); if (w < bw) { bw = w; best = j; } }
    out = [...out.slice(0, k), { ...out[k], text: words.slice(0, best).join(" ") }, { ...out[k], text: words.slice(best).join(" ") }, ...out.slice(k + 1)];
  }
  if (sizeOf(out) < L.type.minPx) throw new Error(`launchTemplate ${L.shape}: the words "${lines.map((l) => l.text).join(" / ")}" would be ${sizeOf(out).toFixed(0)} px on a word page (phone-safe minimum ${L.type.minPx} px): use fewer words`);
  return out;
};

type Fit = ReturnType<typeof fitScore>;
const MIN_END = (fps: number) => 3 * fps + 40; // the install lines held 3 s or more, after the card writes on

/**
 * The score for a beat-grid film: played at the film's bpm exactly (the cuts sit on that grid), and
 * the film made whole bars of it. A Material's stretch section is repeated 0..n times; each form is
 * `bars` long plus whole bars for its tail to ring out, and the form whose length puts the end-card
 * hold nearest the one asked for wins (the hold stays between 3 s and the asked hold + 4 bars).
 * No tempo is changed; if no form fits, it throws. Bars before the final ritard are checked against
 * the grid to half a frame, so a rubato or a breath can never pull a downbeat off a cut.
 */
export const gridScore = (score: () => Piece | Material, bpm: number, fps: number, before: number, hold: number) => {
  const x = score(), barF = (4 * 60 * fps) / bpm, lo = MIN_END(fps), hi = hold + 4 * barF;
  const forms: (() => Piece)[] = "plan" in x ? [() => x] : stretchIndex(x) < 0 ? [() => composePiece(x)] : Array.from({ length: 33 }, (_, r) => () => composePiece(withStretch(x, r)));
  let best: { piece: Piece; end: number; bars: number; ring: number } | null = null, tried: string[] = [];
  for (const make of forms) {
    const p = make(), bpb = beatsPerBar(p.plan.meter);
    if (bpb !== 4) throw new Error(`launchTemplate: the score is in ${p.plan.meter}; a launch film's cuts sit on 4-beat bars, so compose it in 4/4`);
    if (p.plan.pickupBeats) throw new Error(`launchTemplate: the score opens with a ${p.plan.pickupBeats}-beat pickup; frame 0 is a downbeat, so start the score on the bar`);
    const bars = p.plan.sections.reduce((a, q) => a + q.bars, 0), ring = Math.ceil((p.tail * bpm) / 60 / 4 - 1e-9), end = Math.round((bars + ring) * barF) - before;
    tried.push(`${bars}+${ring} bars -> hold ${(end / fps).toFixed(1)} s`);
    if (end >= lo && end <= hi && (!best || Math.abs(end - hold) < Math.abs(best.end - hold))) best = { piece: p, end, bars, ring };
    if (end > hi) break; // more repeats only make it longer
  }
  if (!best) throw new Error(`launchTemplate: the score cannot end on a bar of this film at ${bpm} bpm without changing its tempo. The cut before the end card is ${(before / fps).toFixed(1)} s and the end-card hold must be ${(lo / fps).toFixed(1)}-${(hi / fps).toFixed(1)} s; the score's forms give ${tried.join(", ")}. Compose a 1-bar stretch section (stretch: true), or change askBeats/endBeats/claimBar.`);
  const piece: Piece = { ...best.piece, plan: { ...best.piece.plan, tempo: bpm, rubato: 0 } }, perf = perform(piece, bpm, { expressive: true }), spb = 60 / bpm;
  const lastBar = Math.floor((perf.lastOnset / spb - 6) / 4); // the final ritard lives in the last 6 beats, inside the end card
  for (let k = 0; k <= lastBar; k++) { const drift = perf.sec(4 * k) - 4 * k * spb; if (Math.abs(drift) > 0.5 / fps) throw new Error(`launchTemplate: the score's bar ${k} lands ${(drift * 1000).toFixed(0)} ms off the film's grid (a breath or a caesura in the score); a launch film's cuts need every downbeat on the grid: even out the section dynamics there`); }
  return { piece, end: best.end, bars: best.bars, form: `${best.bars} bars + ${best.ring} to ring, at the film's ${bpm} bpm` };
};

// A music bed: the piece FITTED to the film, never cut and faded. With `tempo` (a beat-grid film, as
// the launch template passes it) the piece plays at exactly that tempo and the film is already whole
// bars of it (gridScore); without, fitScore fits it as filmAudio does (its stretch section repeated or
// dropped, the tempo trimmed so the tail rings out on the last frame). Then it is set to `lufs` integrated (default -14, the one published
// cross-platform target) with the true peak held at or under -1 dBTP. A dynamic piece stops at the
// peak ceiling first (render prints how far short); `limit: true` lets a look-ahead limiter take
// those few peaks instead so the bed reaches the target. Compose the piece for this film at the
// film's bpm, so the cuts sit on its downbeats. `piece` may return a Piece or a fitScore result.
export const musicBed = (piece: () => Piece | Fit, frames: number, fps = 30, lufs = -14, o: { limit?: boolean; tempo?: number } = {}) => {
  const source = piece(), score = "order" in source ? source.piece : o.tempo ? source : fitScore(source, frames / fps).piece;
  return Object.assign((sr: number): [Float32Array, Float32Array] => {
  const seconds = frames / fps, x = piece(), fit = "order" in x ? x : o.tempo ? { piece: x, tempo: o.tempo } : fitScore(x, seconds);
  const m = renderPiece(fit.piece, sr, { seconds, tempo: fit.tempo }), n = Math.round(seconds * sr);
  const L = new Float32Array(n), R = new Float32Array(n); L.set(m.L.subarray(0, n)); R.set(m.R.subarray(0, n));
  const gain = (dB: number) => { const g = Math.pow(10, dB / 20); for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; } };
  const now = loudness([L, R], sr).integrated, peak = truePeak([L, R]).dbtp;
  if (!o.limit || lufs - now <= -1 - peak) { gain(Math.min(lufs - now, -1 - peak)); return [L, R]; } // loudness first, never past -1 dBTP
  gain(lufs - now); limiter(L, R, sr, Math.pow(10, -1.3 / 20));                                     // the limiter takes the peaks
  const again = lufs - loudness([L, R], sr).integrated; if (again > 0) { gain(Math.min(again, 1)); limiter(L, R, sr, Math.pow(10, -1.3 / 20)); }
  const tp = truePeak([L, R]).dbtp; if (tp > -1) gain(-1.05 - tp);                                    // an inter-sample overshoot: a last static trim
  return [L, R];
  }, { scores: [score] });
};
