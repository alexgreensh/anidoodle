// PIXEL ART KIT. A palette-indexed grid that RECORDS every pixel an artist lays, in order, so the
// finished picture and the process that made it come from the same list. Plain TypeScript, pure.
//
// A draft is a list of ops (cell index, palette index), grouped into strokes; a stroke belongs to a
// pass (blocking, cleanup, shading, highlights, fireflies...). `replay(n)` gives the grid after the
// first n ops. `blit` paints a grid onto the canvas as whole cells: integer cell size, integer
// offsets, fillRect only, so every device pixel is exactly one palette colour (no AA, no smoothing).
import type { Ctx } from "./core";

export type Stroke = { pass: number; kind: "fill" | "pencil" | "cluster"; a: number; b: number }; // ops [a, b)

export class PixelDraft {
  readonly buf: Uint8Array; ops: number[] = []; strokes: Stroke[] = [];
  private pass = 0; private open: Stroke | null = null;
  constructor(readonly G: number, readonly H: number, ground: number) { this.buf = new Uint8Array(G * H).fill(ground); }
  // ---- recording
  setPass(p: number) { this.end(); this.pass = p; }
  begin(kind: Stroke["kind"]) { this.end(); this.open = { pass: this.pass, kind, a: this.ops.length, b: this.ops.length }; }
  end() { if (this.open) { this.open.b = this.ops.length; if (this.open.b > this.open.a) this.strokes.push(this.open); this.open = null; } }
  get(x: number, y: number) { return x < 0 || y < 0 || x >= this.G || y >= this.H ? -1 : this.buf[y * this.G + x]; }
  px(x: number, y: number, c: number) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.G || y >= this.H) return;
    const i = y * this.G + x; if (this.buf[i] === c) return;           // an invisible op is not a mark
    this.buf[i] = c; this.ops.push(i * 16 + c);
  }
  // ---- marks, all palette-only
  rect(x0: number, y0: number, w: number, h: number, c: number) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.px(x, y, c); }
  // Bresenham: one pixel per step on the major axis, never a double
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (;;) { this.px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  // cells whose centre is inside the polygon (even-odd), row by row
  static cover(pts: [number, number][], G: number, H: number): number[] {
    const out: number[] = [];
    for (let y = 0; y < H; y++) {
      const yc = y + 0.5, xs: number[] = [];
      for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; if ((y0 <= yc) !== (y1 <= yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0)); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(G - 1, Math.floor(xs[k + 1] - 0.5)); x++) out.push(y * G + x);
    }
    return out;
  }
  // 2x2 ordered dither: level 0..4 of colour b over the cell's colour a (2 = the checker half tint)
  static bayer = [[0, 2], [3, 1]];
  static dith(x: number, y: number, level: number) { return PixelDraft.bayer[y & 1][x & 1] < level; }
}

// thick polyline -> closed polygon (a limb, a stem, a tail), radius tapering r0 -> r1
export const limb = (pts: [number, number][], r0: number, r1: number): [number, number][] => {
  const L: [number, number][] = [], R: [number, number][] = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, r = r0 + ((r1 - r0) * i) / (pts.length - 1);
    L.push([p[0] - (dy / l) * r, p[1] + (dx / l) * r]); R.push([p[0] + (dy / l) * r, p[1] - (dx / l) * r]);
  });
  return [...L, ...R.reverse()];
};

// Cell mask cleanup, the pixel artist's pass over a blocked silhouette: remove one-cell nubs
// (a cell with at most one 4-neighbour inside) and fill one-cell notches (an empty cell with three
// or more 4-neighbours inside), repeated to rest. Returns the cleaned mask.
export const cleanMask = (m: Uint8Array, G: number, H: number): Uint8Array => {
  const o = m.slice(); const at = (x: number, y: number) => (x < 0 || y < 0 || x >= G || y >= H ? 0 : o[y * G + x]);
  for (let pass = 0, changed = true; changed && pass < 6; pass++) {
    changed = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < G; x++) {
      const n = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1), i = y * G + x;
      if (o[i] && n <= 1) { o[i] = 0; changed = true; } else if (!o[i] && n >= 3) { o[i] = 1; changed = true; }
    }
  }
  return o;
};

// Timeline: every stroke gets a number of cels by its kind and size, passes get their budget, a
// beat of rest sits between passes. Returns ops-applied per cel (monotone, ends at ops.length).
export const celPlan = (d: PixelDraft, budgets: number[], rest: number): number[] => {
  const plan: number[] = [0];
  budgets.forEach((budget, p) => {
    const ss = d.strokes.filter((s) => s.pass === p); if (!ss.length) return;
    const w = ss.map((s) => (s.kind === "fill" ? 1 : s.kind === "cluster" ? 1 + Math.sqrt(s.b - s.a) * 0.35 : 1 + Math.sqrt(s.b - s.a) * 0.8));
    const sw = w.reduce((a, b) => a + b, 0);
    ss.forEach((s, k) => {
      const cels = Math.max(1, Math.round((budget * w[k]) / sw));
      for (let c = 1; c <= cels; c++) plan.push(s.a + Math.round(((s.b - s.a) * c) / cels));
    });
    for (let r = 0; r < rest; r++) plan.push(plan[plan.length - 1]);
  });
  return plan;
};

// Paint an indexed grid as whole cells, one fillRect per horizontal run. cell = integer device px.
export const blit = (ctx: Ctx, buf: Uint8Array, G: number, H: number, palette: string[], devW: number, devH: number, letterbox: string) => {
  const cell = Math.floor(Math.min(devW / G, devH / H)), ox = Math.floor((devW - cell * G) / 2), oy = Math.floor((devH - cell * H) / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = letterbox; ctx.fillRect(0, 0, devW, devH);
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < G) {
      const c = buf[y * G + x]; let e = x + 1; while (e < G && buf[y * G + e] === c) e++;
      ctx.fillStyle = palette[c]; ctx.fillRect(ox + x * cell, oy + y * cell, (e - x) * cell, cell); x = e;
    }
  }
};
