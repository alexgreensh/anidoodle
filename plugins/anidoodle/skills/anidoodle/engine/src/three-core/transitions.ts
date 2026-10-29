// TRANSITIONS between two shots, pure in the frame. Each side draws a whole frame into its own
// offscreen layer (env.canvas), then the two are combined on the frame. Works with draw3d: draw3d
// targets whatever ctx it is handed, so a 3D shot renders into a layer like into the frame.
//
//   transition(ctx, env, t, crossfade(), (c) => shotA(c, fA), (c) => shotB(c, fB))
//
//   crossfade()            dissolve
//   wipe("right")          a soft straight edge travelling right (B enters from the left)
//   radialWipe({ x, y })   an iris opening from a point (0-1 of the frame), B inside it
//   noiseWipe(seed)        an ink-blot dissolve: B spreads in blots of seeded noise, with an ink rim
//   slide("left")          B pushes A out of frame, both moving left
//   zoomThrough()          the camera flies through A, which grows and fades, onto B settling in
//
// t is the transition's own progress, 0 to 1 (use time.ts seg(f, a, b)). Each kind eases it. At
// t <= 0 only A is drawn, straight onto the frame; at t >= 1 only B. So the frames either side of
// a transition are exactly the shots' own frames, bit for bit, never "almost".
// The mask maths (wipeAlpha, radialAlpha, noiseMask) are pure functions, held to numbers in
// test/threeTransitions.test.ts.
import type { Ctx, Env, Layer } from "../canvas-core/core";
import { fractal } from "../canvas-core/core";
import * as THREE from "three";
import { ease, type Ease } from "./time";

export type DrawInto = (ctx: Ctx, env: Env) => void;
export type Dir = "left" | "right" | "up" | "down";
type Base = { ease?: Ease };
export type TransitionKind =
  | (Base & { kind: "crossfade" })
  | (Base & { kind: "wipe"; dir: Dir; feather: number })
  | (Base & { kind: "radial"; x: number; y: number; feather: number })
  | (Base & { kind: "noise"; seed: number; scale: number; soft: number; ink: string | null; inkWidth: number })
  | (Base & { kind: "slide"; dir: Dir })
  | (Base & { kind: "zoom"; amount: number });

/** a plain dissolve */
export const crossfade = (o: Base = {}): TransitionKind => ({ kind: "crossfade", ...o });
/** a straight soft edge that travels in `dir`; feather in frame pixels */
export const wipe = (dir: Dir = "right", o: Base & { feather?: number } = {}): TransitionKind => ({ kind: "wipe", dir, feather: o.feather ?? 60, ease: o.ease });
/** an iris opening from (x, y), given as 0-1 of the frame; feather in frame pixels */
export const radialWipe = (o: Base & { x?: number; y?: number; feather?: number } = {}): TransitionKind => ({ kind: "radial", x: o.x ?? 0.5, y: o.y ?? 0.5, feather: o.feather ?? 80, ease: o.ease });
/** an ink-blot dissolve from seeded noise; scale = blot size in frame pixels; ink = rim colour (null for none) */
export const noiseWipe = (seed = 1, o: Base & { scale?: number; soft?: number; ink?: string | null; inkWidth?: number } = {}): TransitionKind => {
  const ink = o.ink === undefined ? "#1b1622" : o.ink;
  if (ink) inkRGB(ink); // a bad colour fails here, where the wipe is written, not mid-render
  return { kind: "noise", seed, scale: o.scale ?? 360, soft: o.soft ?? 0.02, ink, inkWidth: o.inkWidth ?? 0.014, ease: o.ease ?? ease.inOutSine };
};
/** B pushes A out: both move in `dir` */
export const slide = (dir: Dir = "left", o: Base = {}): TransitionKind => ({ kind: "slide", dir, ease: o.ease });
/** fly through A onto B; amount = how far A grows (4 = to four times its size); A is gone by 52 % so the middle never reads as a double exposure */
export const zoomThrough = (o: Base & { amount?: number } = {}): TransitionKind => ({ kind: "zoom", amount: o.amount ?? 4, ease: o.ease ?? ease.inOutCubic });

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// ---------------------------------------------------------------- pure mask maths
/**
 * B's opacity at (x, y) for a straight wipe at eased progress e. The edge runs from one feather
 * BEFORE the frame to one feather PAST it, so e = 0 shows none of B and e = 1 all of it.
 */
export const wipeAlpha = (x: number, y: number, w: number, h: number, e: number, dir: Dir, feather: number) => {
  const along = dir === "right" ? x : dir === "left" ? w - x : dir === "down" ? y : h - y, L = dir === "left" || dir === "right" ? w : h;
  const f = Math.max(1e-6, feather), edge = -f + (L + 2 * f) * e;
  return clamp01((edge - along) / f);
};
/** B's opacity at (x, y) for an iris from (cx, cy): the radius grows from 0 to the farthest corner plus one feather */
export const radialAlpha = (x: number, y: number, w: number, h: number, e: number, cx: number, cy: number, feather: number) => {
  const f = Math.max(1e-6, feather), far = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy));
  const r = (far + f) * e;
  return clamp01((r - Math.hypot(x - cx, y - cy)) / f);
};
/**
 * The ink-blot mask on a w x h grid (one cell per few frame pixels; the caller scales it up
 * smoothly, which softens the edge). Noise in [0, 1] per cell; B shows where the noise sits under
 * a threshold that sweeps from below 0 to above 1, so e = 0 is exactly none and e = 1 exactly all.
 * `ink` is a thin band riding the edge, like wet ink spreading.
 */
export const noiseMask = (seed: number, e: number, w: number, h: number, o: { cell?: number; scale?: number; soft?: number; inkWidth?: number; ink?: boolean } = {}) => {
  const cell = o.cell ?? 4, scale = o.scale ?? 360, soft = o.soft ?? 0.035, iw = o.ink === false ? 0 : (o.inkWidth ?? 0.03);
  const reach = soft + iw, thr = -reach + (1 + 2 * reach) * e;
  const alpha = new Uint8ClampedArray(w * h), ink = iw > 0 ? new Uint8ClampedArray(w * h) : null;
  const field = blotField(seed, w, h, cell / scale);
  for (let p = 0; p < w * h; p++) {
    const n = field[p], a = clamp01((thr - n) / soft + 0.5);
    alpha[p] = Math.round(a * 255);
    if (ink) { const d = n - thr; ink[p] = d > -iw && d < iw ? Math.round((1 - Math.abs(d) / iw) * 255) : 0; }
  }
  return { alpha, ink };
};
// The blot field: three octaves of gradient noise, then RANK-equalised to 0-1, so the share of
// the frame that has turned to B tracks the transition's progress evenly (raw noise bunches in the
// middle: the dissolve would stall, then rush). Kept per (seed, size): it does not depend on time.
const fields = new Map<string, Float32Array>();
const blotField = (seed: number, w: number, h: number, k: number) => {
  const key = `${seed}:${w}x${h}:${k}`, hit = fields.get(key); if (hit) return hit;
  const raw = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) raw[j * w + i] = fractal(seed, i * k, j * k, 1, 1, 3);
  const order = Array.from(raw.keys()).sort((a, b) => raw[a] - raw[b] || a - b), out = new Float32Array(w * h), last = Math.max(1, order.length - 1);
  order.forEach((p, r) => (out[p] = r / last));
  if (fields.size > 8) fields.delete(fields.keys().next().value!);
  fields.set(key, out); return out;
};
/** where each layer sits for a slide at eased e: offsets in frame pixels for A and B */
export const slideOffsets = (e: number, dir: Dir, w: number, h: number) => {
  const [dx, dy] = dir === "left" ? [-w, 0] : dir === "right" ? [w, 0] : dir === "up" ? [0, -h] : [0, h];
  return { a: [dx * e, dy * e] as [number, number], b: [dx * (e - 1), dy * (e - 1)] as [number, number] };
};

// ---------------------------------------------------------------- layers
let depth = 0; // a transition inside a transition gets its own layers (only during one call: no frame state)
const layer = (env: Env, slot: string, w: number, h: number): Layer => {
  const key = `three:tx:${depth}:${slot}:${w}x${h}`;
  let l = env.cache.get(key) as Layer | undefined;
  if (!l) { l = env.canvas(w, h); env.cache.set(key, l); }
  const c = l.ctx as Ctx & { reset?: () => void };
  if (typeof c.reset === "function") c.reset(); else { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; }
  c.clearRect(0, 0, w, h);
  return l;
};
const putMask = (env: Env, slot: string, w: number, h: number, a: Uint8ClampedArray, rgb: [number, number, number] = [0, 0, 0]) => {
  const l = layer(env, slot, w, h), img = l.ctx.createImageData(w, h);
  for (let p = 0; p < a.length; p++) { const q = p * 4; img.data[q] = rgb[0]; img.data[q + 1] = rgb[1]; img.data[q + 2] = rgb[2]; img.data[q + 3] = a[p]; }
  l.ctx.putImageData(img, 0, 0); return l;
};
/**
 * The rim colour as 0-255 sRGB. Hex is read exactly; any other CSS colour (a name, rgb(), hsl()) goes
 * through three's own CSS parser. Anything else throws: a hex-only parser read "red" as a dark teal
 * and drew it without a word.
 */
export const inkRGB = (s: string): [number, number, number] => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  if (m) { const v = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1]; return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number]; }
  const c = new THREE.Color(); c.r = -1; // three leaves an unknown colour untouched, so -1 marks "not parsed"
  const t = typeof s === "string" ? s.trim() : "";
  // only a CSS name, rgb() or hsl() reaches three's parser (so it never prints its own warning)
  if (/^(rgb|hsl)a?\(/i.test(t) || Object.hasOwn(THREE.Color.NAMES, t.toLowerCase())) c.setStyle(t);
  if (c.r === -1) throw new Error(`noiseWipe: ink "${s}" is not a colour (use hex like "#1b1622", a CSS name, rgb() or hsl())`);
  const h = c.getHex(); return [(h >> 16) & 255, (h >> 8) & 255, h & 255];
};

/**
 * Draw the frame of a transition at progress t (0-1) from what drawA and drawB paint. Each draw
 * gets a clean, full-size, untransformed context, exactly like a shot's draw gets the frame.
 */
export const transition = (ctx: Ctx, env: Env, t: number, kind: TransitionKind, drawA: DrawInto, drawB: DrawInto) => {
  if (t <= 0) { drawA(ctx, env); return; }
  if (t >= 1) { drawB(ctx, env); return; }
  const e = (kind.ease ?? ease.inOutCubic)(t), W = Math.round(env.W * env.scale), H = Math.round(env.H * env.scale), s = env.scale;
  depth++;
  try {
    const A = layer(env, "a", W, H); drawA(A.ctx, env);
    const B = layer(env, "b", W, H); drawB(B.ctx, env);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, W, H);
    const src = (l: Layer) => l.canvas as CanvasImageSource;
    switch (kind.kind) {
      case "crossfade": ctx.drawImage(src(A), 0, 0); ctx.globalAlpha = e; ctx.drawImage(src(B), 0, 0); break;
      case "slide": { const o = slideOffsets(e, kind.dir, W, H); ctx.drawImage(src(A), o.a[0], o.a[1]); ctx.drawImage(src(B), o.b[0], o.b[1]); break; }
      case "zoom": {
        // B settles from a little large to its own size underneath; A grows past the camera and fades
        const sb = 1 + 0.25 * (1 - e), sa = 1 + (kind.amount - 1) * e * e, fade = 1 - clamp01((e - 0.12) / 0.4);
        const at = (l: Layer, k: number) => ctx.drawImage(src(l), (W - W * k) / 2, (H - H * k) / 2, W * k, H * k);
        at(B, sb); ctx.globalAlpha = fade; at(A, sa); break;
      }
      case "wipe": case "radial": {
        // B keeps only what the mask lets through, then lands on A
        const g = kind.kind === "wipe" ? linearMask(B.ctx, W, H, e, kind.dir, kind.feather * s) : radialMask(B.ctx, W, H, e, kind.x * W, kind.y * H, kind.feather * s);
        B.ctx.save(); B.ctx.globalCompositeOperation = "destination-in"; B.ctx.fillStyle = g; B.ctx.fillRect(0, 0, W, H); B.ctx.restore();
        ctx.drawImage(src(A), 0, 0); ctx.drawImage(src(B), 0, 0); break;
      }
      case "noise": {
        const cell = 2 * s, mw = Math.ceil(W / cell), mh = Math.ceil(H / cell);
        const m = noiseMask(kind.seed, e, mw, mh, { cell: 2, scale: kind.scale, soft: kind.soft, inkWidth: kind.inkWidth, ink: !!kind.ink });
        const M = putMask(env, "m", mw, mh, m.alpha);
        B.ctx.save(); B.ctx.globalCompositeOperation = "destination-in"; B.ctx.imageSmoothingEnabled = true; B.ctx.imageSmoothingQuality = "high"; B.ctx.drawImage(src(M), 0, 0, mw * cell, mh * cell); B.ctx.restore();
        ctx.drawImage(src(A), 0, 0); ctx.drawImage(src(B), 0, 0);
        if (m.ink && kind.ink) { const I = putMask(env, "i", mw, mh, m.ink, inkRGB(kind.ink)); ctx.drawImage(src(I), 0, 0, mw * cell, mh * cell); }
        break;
      }
    }
    ctx.restore();
  } finally { depth--; }
};
// gradients that match wipeAlpha / radialAlpha exactly (alpha 1 behind the edge, 0 one feather ahead)
const linearMask = (c: Ctx, W: number, H: number, e: number, dir: Dir, f: number) => {
  const L = dir === "left" || dir === "right" ? W : H, edge = -f + (L + 2 * f) * e, a = edge - f, b = edge;
  const pt = (v: number): [number, number] => (dir === "right" ? [v, 0] : dir === "left" ? [W - v, 0] : dir === "down" ? [0, v] : [0, H - v]);
  const [x0, y0] = pt(a), [x1, y1] = pt(b), g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); return g;
};
const radialMask = (c: Ctx, W: number, H: number, e: number, cx: number, cy: number, f: number) => {
  const far = Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy)), r = (far + f) * e;
  const g = c.createRadialGradient(cx, cy, Math.max(0, r - f), cx, cy, Math.max(1e-3, r));
  // while r < f even the centre is only part-way in
  g.addColorStop(0, `rgba(0,0,0,${Math.min(1, r / f).toFixed(4)})`); g.addColorStop(1, "rgba(0,0,0,0)"); return g;
};
