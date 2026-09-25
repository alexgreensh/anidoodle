// STORYBOOK HAND (pencil + watercolour) for any character Scene. Per part, in paint order:
// a wash in the role's shadow colour, the lit colour laid over it shifted TOWARD the light and
// clipped to the form (so a band of shadow survives on the far side, softened by the paint
// layer), then graphite along the union contour, heavier where the part is bigger, then the
// part's own marks (eyes, mouth, seams of clothing). The same recipe as storybook.ts's Bit.
import { GRAPHITE, Gfx, P, displace, rng } from "../../core";
import { bbox, insidePoly, runLength, thin, unionRuns } from "../shape2d";
import type { Mark, Part, Scene } from "../types";

export type Swatch = { base: string; shade: string; line?: string };
export type Palette = Record<string, Swatch>;
export const hashId = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 100000; };

const pathPolys = (c: CanvasRenderingContext2D, polys: P[][], dx = 0, dy = 0) => { c.beginPath(); polys.forEach((s) => s.forEach(([x, y], i) => (i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy)))); polys.forEach(() => c.closePath()); };

// contour runs, minus seams where a part grows out of its parent
export const contourRuns = (part: Part, byId: Map<string, Part>, step = 1.5): P[][] => {
  const seams = (part.seams ?? []).map((s) => ({ ...s, polys: byId.get(s.with)?.polys ?? [] })).filter((s) => s.polys.length);
  const seamHide = (p: P) => seams.some((s) => Math.hypot(p[0] - s.at[0], p[1] - s.at[1]) < s.r && s.polys.some((q) => insidePoly(q, p[0], p[1])));
  const hide = seams.length || part.keepLine ? (p: P) => (part.keepLine ? !part.keepLine(p) : false) || seamHide(p) : undefined;
  return unionRuns(part.polys, step, hide).filter((r) => runLength(r) > 2.5);
};

// Hands that lay ALL their lines in one late pass (a key block, a brush pass, a pencil line pass)
// must cut each line where a later-painted part covers it, or hidden edges show through.
type Cover = { q: P[]; b: { x0: number; y0: number; x1: number; y1: number } }[];
export const occluders = (scene: Scene, idx: number): Cover => scene.parts.slice(idx + 1).filter((p) => p.fill !== false && p.polys.length).flatMap((p) => p.polys.map((q) => ({ q, b: bbox([q]) })));
export const occlude = (pts: P[], cover: Cover): P[][] => {
  const out: P[][] = []; let cur: P[] = [];
  pts.forEach((p) => { if (cover.some(({ q, b }) => p[0] >= b.x0 && p[0] <= b.x1 && p[1] >= b.y0 && p[1] <= b.y1 && insidePoly(q, p[0], p[1]))) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(p); });
  if (cur.length > 1) out.push(cur);
  return out;
};

export const inkWeight =(part: Part, k = 1) => Math.max(1.1, Math.min(4.2, 0.9 + part.size * 0.055)) * k;

export const drawMarks = (g: Gfx, marks: Mark[], col: (role: string) => string, seed: number, penW = 1) => {
  marks.forEach((m, i) => {
    const c = g.cur;
    if (m.kind === "line") g.pen(m.pts, { w: m.w * penW, color: col(m.role), seed: seed + i * 7, wobble: Math.min(0.5, m.w * 0.2), boil: 0.25, opacity: m.alpha ?? 0.92, retrace: false, closed: m.closed, taper: 0.8 });
    else if (m.kind === "fill") { g.fill(m.pts, col(m.role), m.alpha ?? 1); if (m.line) g.pen(m.pts, { w: m.line * penW, color: GRAPHITE, seed: seed + i * 7 + 1, wobble: 0.3, boil: 0.2, closed: true, retrace: false, taper: 0.4 }); }
    else { g.touch(m.at[0] - m.rx - 2, m.at[1] - m.ry - 2, m.at[0] + m.rx + 2, m.at[1] + m.ry + 2); c.globalAlpha = m.alpha ?? 1; c.fillStyle = col(m.role); c.beginPath(); c.ellipse(m.at[0], m.at[1], Math.max(0.3, m.rx), Math.max(0.3, m.ry), m.rot, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
  });
};

export const renderStorybook = (g: Gfx, scene: Scene, pal: Palette, o: { weight?: number; paintAlpha?: number } = {}) => {
  const byId = new Map(scene.parts.map((p) => [p.id, p])), L = scene.light, sw = (r: string) => pal[r] ?? { base: "#ff00ff", shade: "#990099" };
  const col = (r: string) => (r === "line" ? GRAPHITE : sw(r).base);
  if (scene.ground?.shadow.length) g.group("paint", () => g.wash(scene.ground!.shadow, "#7d6fa8", { alpha: 0.32, seed: 8, dx: 0, dy: 0, shrink: 1, rim: false }));
  for (const part of scene.parts) {
    const seed = hashId(part.id), s = sw(part.role), k = part.size, clipPolys = part.clipTo ? byId.get(part.clipTo)?.polys : undefined;
    const clipped = (fn: () => void) => { if (!clipPolys?.length) return fn(); const c = g.cur; c.save(); pathPolys(c, clipPolys); c.clip("nonzero"); fn(); c.restore(); };
    if (part.fill !== false && part.polys.length) {
      const wet = Math.min(3.2, 0.6 + k * 0.05), polys = part.polys.map((q, i) => displace(q, wet, 0.03, 2, seed + i));
      g.group("paint", () => {
        clipped(() => { const c = g.cur, b = bbox(polys); g.touch(b.x0 - 6, b.y0 - 6, b.x1 + 6, b.y1 + 6);
        c.globalAlpha = o.paintAlpha ?? 0.97; c.fillStyle = s.shade; pathPolys(c, polys); c.fill("nonzero");
        c.save(); pathPolys(c, polys); c.clip("nonzero"); c.fillStyle = s.base; pathPolys(c, polys, L[0] * k * 0.28, L[1] * k * 0.28); c.fill("nonzero");
        c.restore(); c.globalAlpha = 1; });
      });
    }
    g.group("ink", () => clipped(() => {
      if (part.outline !== false) {
        const w = inkWeight(part, o.weight ?? 1), r = rng(seed);
        contourRuns(part, byId).forEach((run, i) => { const every = Math.max(2, Math.round(run.length / 26)); g.pen(thin(run, every), { w, color: s.line ?? GRAPHITE, seed: seed + i * 13 + Math.floor(r() * 9), wobble: Math.min(1, 0.2 + k * 0.012), boil: 0.3, taper: 0.7, opacity: 0.95 }); });
      }
      drawMarks(g, part.marks, col, seed + 500, 1);
    }));
  }
};
