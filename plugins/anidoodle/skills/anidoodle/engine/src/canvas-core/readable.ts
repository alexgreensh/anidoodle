// READABLE. Holds and type sizes from the reading rule, so a film's timing comes from its words, not
// from feel. A brand launch film typed its AI replies at 52 chars/s and held them a fixed 0.9 s after
// the last character; an 11-word reply was up about 2.5 s where the rule wants 3.3 s, and viewers said
// "too fast" twice, even after a 25 % slowdown. These helpers make the rule the default.
//   readS(text)            seconds a text needs: max(0.7 s, 0.3 s per word) (the same rule framecheck checks)
//   chatHold(text, o)      a typed reply: think + typing + reading AFTER the last character, times pace
//   paced(s, pace, part)   one pace scalar (or one per section) that every hold multiplies: "20 % slower" is pace 1.2
//   texture(ctx, draw)     text drawn inside is texture, not meant to be read ("blah blah"): framecheck skips it
//   fitText(ctx, text, maxW, o)  the largest size from maxPx down to minPx at which a line fits maxW
import type { Ctx } from "./core";

export const MIN_READ_S = 0.7, READ_S_PER_WORD = 0.3; // must equal tools/textrules.mjs (test/readable.test.ts holds them together)
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** Seconds a viewer needs to read `text`. */
export const readS = (text: string) => Math.max(MIN_READ_S, READ_S_PER_WORD * words(text));

/** A pace: one number for the whole film, or one per named section (`default` for the rest). 1 = the rule; 1.25 = 25 % longer holds. */
export type Pace = number | ({ default?: number } & Record<string, number>);
export const paceOf = (pace: Pace = 1, section?: string) => (typeof pace === "number" ? pace : (section !== undefined && pace[section] !== undefined ? pace[section] : pace.default ?? 1));
/** Seconds times the pace for a section. Every hold of a film goes through this, so length changes are one number. */
export const paced = (s: number, pace: Pace = 1, section?: string) => s * paceOf(pace, section);

/**
 * A typed reply's timeline in seconds: a think beat, the typing, then the full reading time after the
 * last character (a reader cannot start before the sentence exists). `cps` is characters per second.
 * Pace stretches the think and the read, never the typing speed (typing speed is a character trait).
 */
export const chatHold = (text: string, o: { cps?: number; think?: number; pace?: Pace; section?: string } = {}) => {
  const k = paceOf(o.pace ?? 1, o.section), think = (o.think ?? 0.6) * k, typing = text.length / (o.cps ?? 52), read = readS(text) * k;
  return { think, typing, read, total: think + typing + read };
};
/** chatHold in whole frames (rounded up, so the hold never lands a frame short of the rule). */
export const chatHoldFrames = (text: string, fps: number, o: Parameters<typeof chatHold>[1] = {}) => { const h = chatHold(text, o); return { think: Math.ceil(h.think * fps), typing: Math.ceil(h.typing * fps), read: Math.ceil(h.read * fps), total: Math.ceil(h.think * fps) + Math.ceil(h.typing * fps) + Math.ceil(h.read * fps) }; };

/** Draw words meant as texture, not reading (fast "blah" behind a joke): framecheck's reading time and layout rules skip them. */
export const texture = (ctx: Ctx, draw: () => void) => {
  const c = ctx as Ctx & { __texture?: boolean }, was = c.__texture;
  c.__texture = true;
  try { draw(); } finally { c.__texture = was; }
};

/**
 * The largest whole px size, from maxPx down to minPx, at which `text` fits `maxW` in this font; sets
 * ctx.font to it. `fits` is false when even minPx overflows (shorten the copy: never let it clip).
 */
export const fitText = (ctx: Ctx, text: string, maxW: number, o: { maxPx: number; minPx: number; font: (px: number) => string }) => {
  let lo = Math.ceil(o.minPx), hi = Math.floor(o.maxPx);
  const w = (px: number) => { ctx.font = o.font(px); return ctx.measureText(text).width; };
  if (w(hi) <= maxW) return { px: hi, fits: true };
  if (w(lo) > maxW) return { px: lo, fits: false };
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (w(mid) <= maxW) lo = mid; else hi = mid; }
  ctx.font = o.font(lo);
  return { px: lo, fits: true };
};
