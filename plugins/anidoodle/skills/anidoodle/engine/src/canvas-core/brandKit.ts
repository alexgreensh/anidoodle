// BRAND KIT. Draws a brand's own elements exactly as `tools/brand.mjs import` exported them, and only
// ever moves them. A brand mark redrawn by eye, morphed through a blur or squashed into an ellipse is a
// different mark to its owner: a launch film lost four rounds of notes to a goo "mitosis" of a logo and
// to brand dots squashed out of round. So the rule lives in the code, not only in the docs:
//   - parts are filled from their exported paths, never rebuilt;
//   - an element may be translated, rotated, uniformly scaled, clipped and layered;
//   - drawEl throws on a non-uniform scale or a skew in the current transform, unless the caller names the
//     gag the squash serves ({ allowSquash: "the dot is crushed by the falling chat window" });
//   - the caller's globalAlpha and transform are kept (a helper that resets alpha breaks every fade);
//   - each drawn element reports its on-screen box to the frame probe ("brand:<name>"), so the shape scans see it.
//
//   import { BRAND } from "./myBrand";            // written by brand.mjs import
//   ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
//   drawEl(ctx, BRAND.elements.mark); ctx.restore();
//   riseIn(ctx, BRAND.elements.lockup.parts[3], k);  // one letter rises from behind its own baseline
import { probeRect, type Ctx, type Env, type ProbeRec } from "./core";

export type BrandStop = [offset: number, colour: string, alpha: number];
export type BrandPaint =
  | { type: "solid"; c: string }
  | { type: "lin"; x1: number; y1: number; x2: number; y2: number; stops: BrandStop[]; m?: number[] }
  | { type: "rad"; cx: number; cy: number; r: number; fx: number; fy: number; stops: BrandStop[]; m?: number[] }
  | { type: "none" };
export type BrandPart = {
  d: string; fill: BrandPaint; rule: string; op: number; bb: number[]; m?: number[];
  stroke?: { paint: BrandPaint; w: number; cap: string; join: string; op: number };
  clip?: { paths: { d: string; m: number[] }[] };
};
export type BrandElement = { w: number; h: number; parts: BrandPart[] };

const P2 = new Map<string, Path2D>();
/** One Path2D per path string, built once (it never changes, so caching it keeps the draw pure). */
const path = (d: string) => { let p = P2.get(d); if (!p) { p = new Path2D(d); P2.set(d, p); } return p; };
const hexA = (h: string, a: number) => { if (a >= 1 || !/^#[0-9a-f]{6}$/i.test(h)) return h; const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

const gradient = (ctx: Ctx, f: BrandPaint): CanvasGradient | string => {
  if (f.type === "solid") return f.c;
  if (f.type === "none") return "rgba(0,0,0,0)";
  const g = f.type === "lin" ? ctx.createLinearGradient(f.x1, f.y1, f.x2, f.y2) : ctx.createRadialGradient(f.fx, f.fy, 0, f.cx, f.cy, f.r);
  for (const [o, c, a] of f.stops) g.addColorStop(Math.max(0, Math.min(1, o)), hexA(c, a));
  return g;
};
/** Fill a path with a paint. A gradient with its own matrix is drawn in gradient space under a clip, which is exact for any affine. */
const fillWith = (ctx: Ctx, p: Path2D, rule: CanvasFillRule, f: BrandPaint, bb: number[]) => {
  if (f.type === "none") return;
  const m = f.type !== "solid" ? f.m : undefined;
  if (!m) { ctx.fillStyle = gradient(ctx, f); ctx.fill(p, rule); return; }
  ctx.save(); ctx.clip(p, rule); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); ctx.fillStyle = gradient(ctx, f);
  const det = m[0] * m[3] - m[1] * m[2] || 1, inv = [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
  const pad = 2, corners = [[bb[0] - pad, bb[1] - pad], [bb[0] + bb[2] + pad, bb[1] - pad], [bb[0] - pad, bb[1] + bb[3] + pad], [bb[0] + bb[2] + pad, bb[1] + bb[3] + pad]].map(([x, y]) => [inv[0] * x + inv[2] * y + inv[4], inv[1] * x + inv[3] * y + inv[5]]);
  const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
  ctx.fillRect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  ctx.restore();
};

/** Draw one exported part as it is, times the caller's alpha. */
export function drawPart(ctx: Ctx, p: BrandPart, alpha = 1) {
  const g = ctx.globalAlpha;
  ctx.save();
  if (p.clip) clipIn(ctx, p);
  if (p.m) ctx.transform(p.m[0], p.m[1], p.m[2], p.m[3], p.m[4], p.m[5]);
  ctx.globalAlpha = g * alpha * (p.op ?? 1);
  // bb is in element space; the gradient fill wants it in the part's own space, so map it back through m
  fillWith(ctx, path(p.d), (p.rule === "evenodd" ? "evenodd" : "nonzero") as CanvasFillRule, p.fill, p.m ? localBox(p) : p.bb);
  if (p.stroke) {
    ctx.globalAlpha = g * alpha * (p.stroke.op ?? 1); ctx.lineWidth = p.stroke.w; ctx.lineCap = p.stroke.cap as CanvasLineCap; ctx.lineJoin = p.stroke.join as CanvasLineJoin;
    ctx.strokeStyle = gradient(ctx, p.stroke.paint); ctx.stroke(path(p.d));
  }
  ctx.restore();
  ctx.globalAlpha = g; // keeps any fade the caller set
}
/** Clip to the part's clip-path: its shapes (a union) carry their own matrices in element space. */
function clipIn(ctx: Ctx, p: BrandPart) {
  const c = new Path2D();
  for (const q of p.clip!.paths) c.addPath(path(q.d), { a: q.m[0], b: q.m[1], c: q.m[2], d: q.m[3], e: q.m[4], f: q.m[5] });
  ctx.clip(c);
}
const localBox = (p: BrandPart) => {
  const m = p.m!, det = m[0] * m[3] - m[1] * m[2] || 1, inv = [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
  const [x, y, w, h] = p.bb, pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([a, b]) => [inv[0] * a + inv[2] * b + inv[4], inv[1] * a + inv[3] * b + inv[5]]);
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
};

/**
 * How the current transform distorts a shape: the x and y scales and the skew (cosine of the angle between the axes).
 * A uniform scale with a rotation has sx = sy and skew 0.
 */
export const distortion = (m: { a: number; b: number; c: number; d: number }) => {
  const sx = Math.hypot(m.a, m.b), sy = Math.hypot(m.c, m.d), skew = sx && sy ? (m.a * m.c + m.b * m.d) / (sx * sy) : 0;
  return { sx, sy, skew, squash: Math.max(sx, sy) ? Math.abs(sx - sy) / Math.max(sx, sy) : 0 };
};
export type DrawElOpts = { alpha?: number; name?: string; allowSquash?: string; env?: Env; probe?: boolean };
/** The element's ink box in element space: the union of its parts' boxes. */
export const inkBox = (el: BrandElement) => {
  if (!el.parts.length) return [0, 0, el.w, el.h];
  const x0 = Math.min(...el.parts.map((p) => p.bb[0])), y0 = Math.min(...el.parts.map((p) => p.bb[1]));
  return [x0, y0, Math.max(...el.parts.map((p) => p.bb[0] + p.bb[2])) - x0, Math.max(...el.parts.map((p) => p.bb[1] + p.bb[3])) - y0];
};
/**
 * Tell the frame probe where a brand element landed (device pixels, kind "box", label "brand:<name>"), so the
 * scans that look for shapes (layerscan's shape-over-a-face check, framecheck's edge cuts) see brand marks too.
 * With the film's env it goes through probeRect (which reports only on the frame's own canvas); without one it
 * reports straight to the probe, which suits the usual case of a mark drawn on the frame. Off when no probe is installed.
 */
const reportBox = (ctx: Ctx, el: BrandElement, opts: DrawElOpts) => {
  if (opts.probe === false || (opts.alpha ?? 1) * ctx.globalAlpha < 0.1) return;
  const [x, y, w, h] = inkBox(el), label = `brand:${opts.name ?? "element"}`;
  if (opts.env) { probeRect(ctx, opts.env, x, y, w, h, label, "box"); return; }
  const p = (globalThis as { __ANIDOODLE_PROBE__?: (r: ProbeRec) => void }).__ANIDOODLE_PROBE__;
  if (!p || typeof ctx.getTransform !== "function") return;
  const m = ctx.getTransform(), pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([a, b]) => [m.a * a + m.c * b + m.e, m.b * a + m.d * b + m.f]);
  p({ kind: "box", label, x0: Math.min(...pts.map((q) => q[0])), y0: Math.min(...pts.map((q) => q[1])), x1: Math.max(...pts.map((q) => q[0])), y1: Math.max(...pts.map((q) => q[1])) });
};
/** Draw a whole brand element. Throws on a squash or skew of more than 1% unless `allowSquash` names the gag. */
export function drawEl(ctx: Ctx, el: BrandElement, opts: DrawElOpts = {}) {
  if (!opts.allowSquash && typeof ctx.getTransform === "function") {
    const t = distortion(ctx.getTransform());
    if (t.squash > 0.01 || Math.abs(t.skew) > 0.01) throw new Error(`brand: element ${opts.name ? `'${opts.name}' ` : ""}drawn with a non-uniform scale or skew (x ${t.sx.toFixed(3)}, y ${t.sy.toFixed(3)}, skew ${t.skew.toFixed(3)}). A brand mark is only moved, rotated, scaled evenly, clipped or layered; an ellipse of a brand circle is a redraw. If the squash IS the joke, pass { allowSquash: "<the gag it serves>" }.`);
  }
  for (const p of el.parts) drawPart(ctx, p, opts.alpha ?? 1);
  reportBox(ctx, el, opts);
}
/** Place an element by its box: centre at (x, y), height h (or width w), rotated by `rot` radians. Uniform by construction. */
export function placeEl(ctx: Ctx, el: BrandElement, at: { x: number; y: number; h?: number; w?: number; rot?: number; alpha?: number; name?: string; env?: Env }) {
  const s = at.h != null ? at.h / el.h : at.w != null ? at.w / el.w : 1;
  ctx.save(); ctx.translate(at.x, at.y); if (at.rot) ctx.rotate(at.rot); ctx.scale(s, s); ctx.translate(-el.w / 2, -el.h / 2);
  try { drawEl(ctx, el, { alpha: at.alpha, name: at.name, env: at.env }); } finally { ctx.restore(); }
}
/** A part rises into place from behind its own baseline (the clip is the line it sits on); k 0..1. */
export function riseIn(ctx: Ctx, p: BrandPart, k: number) {
  if (k <= 0) return; if (k >= 1) { drawPart(ctx, p); return; }
  const [x, y, w, h] = p.bb;
  ctx.save(); ctx.beginPath(); ctx.rect(x - w, y - h * 4, w * 3, h * 4 + h + 1.5); ctx.clip();
  ctx.translate(0, (1 - k) * h * 1.08); drawPart(ctx, p); ctx.restore();
}
/** Centre of a part's box, in element space. */
export const centreOf = (p: BrandPart): [number, number] => [p.bb[0] + p.bb[2] / 2, p.bb[1] + p.bb[3] / 2];
/** Tile an element along x every `period` units (a frieze whose repeat brand.mjs measured), across [0, span]. */
export function tileX(ctx: Ctx, el: BrandElement, period: number, offset: number, span: number) {
  if (period <= 0) throw new Error("brand: tileX needs the element's measured period (brand.mjs import prints it)");
  const start = Math.floor(-offset / period) - 1;
  for (let i = start; i * period + offset < span + period; i++) { ctx.save(); ctx.translate(i * period + offset, 0); drawEl(ctx, el, { name: "tile" }); ctx.restore(); }
}
