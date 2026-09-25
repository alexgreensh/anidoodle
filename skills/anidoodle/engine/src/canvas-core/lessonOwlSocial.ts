// THE OWL LESSON, SOCIAL CUT: vertical 1080 x 1920 (9:16), scored, ~49 s. Same drawing score as
// the README lesson (lessonOwl.ts), re-timed and re-laid-out for a phone:
//   0.0 s   HOOK card slot, 4 beats (2.4 s): a plain placeholder; a build can pass its own hook card
//   2.4 s   the drawing: 9 steps in ~40 s. Each step starts on a beat (100 bpm = 18 frames), is
//           2.4 to 4.8 s long, and long hatching passes are sped up (rate 70 against the README's 30)
//           so no step drags; captions are written on in the first 60 % of the step, then read
//   reveal  on the beat after the last mark: the "da-DAH" and "That's the rest of the owl."
//   end     END card slot, 7 beats (4.2 s): a plain placeholder; a build can pass its own end card
// LAYOUT, for a phone and the apps' overlays: a small title at the top, the drawing large in the
// middle (1130 px tall), the caption band under it with the step number big, and the bottom
// ~320 px left as quiet paper, where Reels/TikTok/Shorts draw their own captions and buttons.
// Every text block goes through fitLines (wrap to measured width, shrink only as a last resort).
// Frames are drawn cold (no replay cache): exact by construction, see lessonOwlLayout.ts.
import { type Ctx, type Env } from "./core";
import { letter } from "./drafting";
import type { Film } from "./film";
import { paperGrain, progressAt, renderArt, schedule, type Timing, type View } from "./drawingScore";
import { owlScore } from "./lessonOwl";
import { LOOK, block, fitLines, pen } from "./lessonOwlLayout";
import { owlSocialAudio, type FoleyEvent } from "./lessonOwlScore";

const W = 1080, H = 1920, FPS = 30, BPM = 100, BEAT = 18, AFTER = 4 * BEAT;
const S = owlScore();
const T: Timing = { intro: 0, captionLead: 9, pause: 6, hold: 0, rate: 70, minStep: 72, maxStep: 144, grid: BEAT };
const P = schedule(S, T), LAST = P.steps[P.steps.length - 1].markEnd, REVEAL = Math.ceil(LAST / BEAT) * BEAT, DRAW = REVEAL + AFTER;
const CROP = [96, 50, 904, 1134] as const, ART_TOP = 170, ART_H = 1130, BAND = 1318, BAND_BOTTOM = 1600;

const artView = (env: Env): View => {
  const sc = Math.min(W / (CROP[2] - CROP[0]), ART_H / (CROP[3] - CROP[1])), ox = (W - (CROP[2] - CROP[0]) * sc) / 2 - CROP[0] * sc, oy = ART_TOP - CROP[1] * sc, k = env.scale;
  return { x: Math.round(ox * k), y: Math.round(oy * k), w: Math.round(S.W * sc * k), h: Math.round(S.H * sc * k) };
};
const paper = (ctx: Ctx, env: Env) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = S.paper; ctx.fillRect(0, 0, W * env.scale, H * env.scale); ctx.restore(); };

// a slot another worker fills: plain cream with a label saying so
const placeholder = (label: string, note: string) => (ctx: Ctx, _f: number, env: Env) => {
  paper(ctx, env); const g = pen(ctx, env);
  letter(g, label, W / 2, 860, { cap: 64, color: LOOK.rule, seed: 5, w: 6, align: "center", slant: 0.1, opacity: 1 });
  letter(g, note, W / 2, 970, { cap: 28, color: LOOK.rule, seed: 6, w: 3, align: "center", slant: 0.1, opacity: 1 });
  paperGrain(ctx, env, 0.05);
};

const drawing = (ctx: Ctx, f: number, env: Env) => {
  paper(ctx, env);
  renderArt(ctx, env, S, progressAt(P, f), artView(env));
  const g = pen(ctx, env);
  block(g, [{ t: S.title.toUpperCase(), cap: 46, col: LOOK.ink, w: 5.2, gap: 0 }], 56, 84, 1, 3);
  g.pen([[44, BAND - 22], [W / 2, BAND - 23.5], [W - 44, BAND - 21]], { w: 1.8, color: LOOK.rule, seed: 7, opacity: 0.6, retrace: false, boil: 0, wobble: 0.3 });
  if (f >= REVEAL) { // the reveal
    const fit = fitLines([{ text: "That's the rest of the owl.", cap: 84, col: LOOK.ink, w: 9, gap: 26, maxW: W - 112 }], BAND_BOTTOM - BAND - 20);
    block(g, fit.lines, 56, BAND + 10, Math.min(1, (f - REVEAL) / 40), 990);
  } else {
    let k = 0; for (let i = 0; i < P.steps.length; i++) if (f >= P.steps[i].start) k = i;
    const st = S.steps[k], ps = P.steps[k], p = Math.min(1, (f - ps.start) / Math.max(24, (ps.markEnd - ps.start) * 0.6));
    block(g, [{ t: `${k + 1}`, cap: 150, col: LOOK.accent, w: 14, gap: 0 }], 50, BAND, Math.min(1, (f - ps.start) / 8), 500 + k);
    const title = fitLines([{ text: st.title, cap: 64, col: LOOK.ink, w: 7, gap: 18, maxW: W - 200 - 50 }], 150);
    block(g, title.lines, 200, BAND + (title.lines.length === 1 ? 44 : 4), p, 520 + k * 7);
    const cap = fitLines([{ text: st.caption, cap: 38, col: LOOK.body, w: 4.2, gap: 14, maxW: W - 112 }], BAND_BOTTOM - (BAND + 172));
    block(g, cap.lines, 56, BAND + 172, p, 560 + k * 7);
  }
  paperGrain(ctx, env, 0.05);
};

// The cut is a factory so a build can drop its own hook and end cards into the slots
// (and give them more beats); the public film keeps the plain placeholders.
type Slot = (ctx: Ctx, f: number, env: Env) => void;
export const OWL_SOCIAL = { W, H, FPS, BPM, BEAT };
export const owlSocial = (o: { hookBeats?: number; endBeats?: number; hook?: Slot; end?: Slot; title?: string } = {}): Film => {
  const HOOK = (o.hookBeats ?? 4) * BEAT, END = (o.endBeats ?? 7) * BEAT, TOTAL = HOOK + DRAW + END;
  // declared rests: the card slots, the pencil's rest between steps, the held finished owl
  const holds: [number, number][] = [[0, HOOK], ...P.steps.map((s) => [HOOK + Math.ceil(s.markEnd), HOOK + s.end] as [number, number]).filter(([a, b]) => b > a), [HOOK + Math.ceil(LAST), HOOK + REVEAL], [HOOK + REVEAL + 40, HOOK + DRAW], [HOOK + DRAW, TOTAL]].filter(([a, b]) => b > a) as [number, number][];
  const foley: FoleyEvent[] = S.marks.map((m, i) => ({ t0: (HOOK + P.s[i]) / FPS, t1: (HOOK + P.e[i]) / FPS, kind: m.kind, x: Math.max(0, Math.min(1, ((m.box[0] + m.box[2]) / 2) / S.W)) }));
  return {
    meta: { title: o.title ?? "How to draw an owl (social 9x16)", W, H, fps: FPS, bpm: BPM, durationFrames: TOTAL, raster: "cpu", kind: "drawing", holds },
    assets: { images: {} },
    shots: [
      { id: "hook", start: 0, end: HOOK, draw: o.hook ?? placeholder("HOOK CARD", "YOUR CARD HERE") },
      { id: "drawing", start: HOOK, end: HOOK + DRAW, draw: drawing },
      { id: "end", start: HOOK + DRAW, end: TOTAL, draw: o.end ?? placeholder("END CARD", "YOUR CARD HERE") },
    ],
    audio: owlSocialAudio({ bpm: BPM, seconds: TOTAL / FPS, stepBeats: P.steps.map((s) => (HOOK + s.start) / BEAT), revealBeat: (HOOK + REVEAL) / BEAT, endBeat: (HOOK + DRAW) / BEAT, foley }),
  };
};
export const lessonOwlSocial: Film = owlSocial();
