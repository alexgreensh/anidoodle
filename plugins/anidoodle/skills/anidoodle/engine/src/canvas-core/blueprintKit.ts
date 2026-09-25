// THE DRAFTSMAN'S KIT, ported into the engine from the worked film (example/…/butterfly/kit.ts and
// parts.ts) so a plate can draw a cyanotype without importing the example. Every mark on a
// blueprint sheet is made with one of these: a ruling pen that is never quite straight, a swung
// compass ring, a chain line, section lining that starts and stops inside the part, an arrowhead,
// inclined gothic lettering (drafting.ts). Bound to one Gfx, so the same kit draws on the frame or
// into a cached surface without knowing the difference.
//
// Additions over the example: `circle` (a compass circle that can be swung part-way, starting
// where the needle-leg swings from), `chainRing` (a pitch circle as a long-dash-short-dash line),
// `dim` (a whole linear dimension: witness lines, dimension line, arrows, figure, in drafting
// order), and the surface slot (`slot`/`blit`) for cached part layers.
import { type Ctx, type Env, Gfx, type Layer, type Medium, type P, arc, jitter, line, oval, poly, rng } from "./core";
import { letter, width } from "./drafting";
import { bounds, inside } from "./riso";

export const WHITE = "#f1f7fb", CYAN = "#a7d8ec", DIM = "#7fbcd8", GROUND = "#123a63";
export const DRAFT: Medium = { nib: 1, taper: 0.6, pressure: 0.75, retrace: false, wobble: 0.5, rough: 0.55 }; // a ruling pen in a human hand
export type PenO = { color?: string; seed?: number; opacity?: number; closed?: boolean; taper?: number; wobble?: number; progress?: number };
export type Kit = ReturnType<typeof kit>;

export const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const cen = (pts: P[]): P => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
// element i of a run of n, drawn in order, each taking `dur` of the whole: the hand works down the part
export const stagger = (p: number, n: number, dur = Math.min(1, 2 / n)) => { const step = n > 1 ? (1 - dur) / (n - 1) : 0; return (i: number) => (p >= 1 ? 1 : Math.max(0, Math.min(1, (p - i * step) / dur))); };
export const cut = (p: number, a: number, b: number) => (p >= 1 ? 1 : Math.max(0, Math.min(1, (p - a) / (b - a))));

export const kit = (g: Gfx) => {
  const ink = (fn: () => void) => g.inkGroup(fn, { blur: 1.8, alpha: 0.28, textures: ["draftTooth"] }); // white ink on blue always blooms a little
  const pen = (pts: P[], w: number, p: PenO = {}) => g.pen(pts, { w, color: p.color ?? WHITE, seed: p.seed ?? 1, opacity: p.opacity ?? 0.95, closed: p.closed, taper: p.taper ?? 0.6, wobble: p.wobble ?? 0.5, boil: 0, progress: p.progress });
  const ln = (a: P, b: P, w: number, p: PenO = {}) => pen(line(a, b, (((p.seed ?? 1) % 3) - 1) * 0.6), w, p); // nobody rules a dead straight line freehand
  // a run of pieces along a line, each drawn as the pen reaches it (progress runs along the whole line)
  const pieces = (a: P, b: P, segs: [number, number][], w: number, p: PenO) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), q = (p.progress ?? 1) * L; segs.forEach(([d0, d1], i) => { if (q <= d0) return; const e = Math.min(d1, q); ln(lerp(a, b, d0 / L), lerp(a, b, e / L), w, { ...p, seed: (p.seed ?? 1) + i, taper: 0.3, progress: 1 }); }); };
  const dash = (a: P, b: P, on: number, off: number, w: number, p: PenO = {}) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), s: [number, number][] = []; for (let d = 0; d < L; d += on + off) s.push([d, Math.min(L, d + on)]); pieces(a, b, s, w, p); };
  const chain = (a: P, b: P, w: number, p: PenO = {}) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), s: [number, number][] = []; for (let d = 0; d < L; d += 34) { s.push([d, Math.min(L, d + 22)]); if (d + 29 < L) s.push([d + 26, d + 29]); } pieces(a, b, s, w, p); }; // long dash, short dash: a centre line
  const arrow = (tip: P, ang: number, size = 11, color = WHITE) => g.fill([tip, [tip[0] - Math.cos(ang - 0.17) * size, tip[1] - Math.sin(ang - 0.17) * size], [tip[0] - Math.cos(ang) * size * 0.82, tip[1] - Math.sin(ang) * size * 0.82], [tip[0] - Math.cos(ang + 0.17) * size, tip[1] - Math.sin(ang + 0.17) * size]], color, 0.95);
  const fill = (pts: P[], color: string, alpha = 1) => g.fill(pts, color, alpha);
  const ring = (cx: number, cy: number, r: number, w: number, seed: number, p: PenO = {}) => pen(jitter(oval(cx, cy, r, r * (0.97 + (seed % 5) * 0.012), 12, -1.9 + seed), r * 0.03, seed), w, { ...p, seed, closed: true, taper: 0.4 }); // hand-swung, never a true circle
  // a compass circle: true round (the compass does not wobble), swung from angle a0, part-way by progress
  const circle = (cx: number, cy: number, r: number, w: number, p: PenO & { a0?: number } = {}) => { const q = p.progress ?? 1; if (q <= 0) return; const a0 = p.a0 ?? -2.2, n = Math.max(24, Math.round(r * 0.5)), pts: P[] = []; for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI * 2 * 1.02; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } g.pen(pts, { w, color: p.color ?? WHITE, seed: p.seed ?? 1, opacity: p.opacity ?? 0.95, taper: 0.25, wobble: 0.08, boil: 0, progress: q }); };
  const chainRing = (cx: number, cy: number, r: number, w: number, p: PenO & { a0?: number } = {}) => { const q = p.progress ?? 1; if (q <= 0) return; const L = Math.PI * 2 * r, a0 = p.a0 ?? -2.2, n = Math.max(1, Math.round(L / 34)), per = (Math.PI * 2) / n, drawn = q * n; for (let i = 0; i < n && i < drawn; i++) { const a = a0 + i * per, fr = Math.min(1, drawn - i); const seg = (s: number, e: number, k: number) => { const m = Math.max(3, Math.round((e - s) * r / 5)); const pts: P[] = []; for (let j = 0; j <= m; j++) { const t = a + s + ((e - s) * j) / m; pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); } g.pen(pts, { w, color: p.color ?? CYAN, seed: (p.seed ?? 1) + i * 2 + k, opacity: p.opacity ?? 0.85, taper: 0.3, wobble: 0.05, boil: 0, progress: 1 }); }; const d1 = per * (22 / 34) * Math.min(1, fr * 1.3); seg(0, d1, 0); if (fr >= 0.85) seg(per * (26 / 34), per * (29 / 34), 1); } };
  // section lines / cross-hatch: parallel strokes that start and stop inside the part
  const hatch = (pts: P[], ang: number, gap: number, w: number, seed: number, p: { color?: string; opacity?: number; progress?: number } = {}) => {
    const c = Math.cos(ang), s = Math.sin(ang), r = rng(seed), proj = pts.map(([x, y]) => -s * x + c * y), lo = Math.min(...proj), hi = Math.max(...proj), segs: [P, P, number][] = [];
    for (let off = lo + gap * 0.5, n = 0; off < hi; off += gap * (0.9 + r() * 0.2), n++) {
      const ox = -s * off, oy = c * off, ts: number[] = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[j], b = pts[i], ex = b[0] - a[0], ey = b[1] - a[1], den = c * ey - s * ex; if (Math.abs(den) < 1e-9) continue; const t = ((a[0] - ox) * ey - (a[1] - oy) * ex) / den, u = ((a[0] - ox) * s - (a[1] - oy) * c) / den; if (u >= 0 && u < 1) ts.push(t); }
      ts.sort((a, b) => a - b);
      for (let k = 0; k + 1 < ts.length; k += 2) { const t0 = ts[k] + 0.6 + r() * 1.2, t1 = ts[k + 1] - 0.6 - r() * 1.2; if (t1 - t0 < 2) continue; segs.push([[ox + c * t0, oy + s * t0], [ox + c * t1, oy + s * t1], seed + n * 7 + k]); }
    }
    const vis = (p.progress ?? 1) * segs.length; /* section lines run on one stroke at a time, the last one half made */
    segs.forEach(([a, b, sd], i) => { const q = Math.min(1, vis - i); if (q > 0) ln(a, b, w, { seed: sd, color: p.color ?? CYAN, opacity: p.opacity ?? 0.8, taper: 0.7, progress: q }); });
  };
  const stipple = (pts: P[], n: number, seed: number, dens: (x: number, y: number) => number, color = WHITE) => { const b = bounds(pts), r = rng(seed), c = g.cur; g.touch(b.x0, b.y0, b.x1, b.y1); c.fillStyle = color; for (let i = 0; i < n; i++) { const x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0); if (!inside(pts, x, y) || r() > dens(x, y)) continue; c.globalAlpha = 0.6 + r() * 0.35; c.beginPath(); c.ellipse(x, y, 0.7 + r() * 0.7, 0.6 + r() * 0.5, r() * 3, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1; };
  const k0text = (s: string, x: number, y: number, p: { cap?: number; seed?: number; align?: "left" | "center" | "right"; w?: number; progress?: number }) => letter(g, s, x, y, { ...p, color: "#eef6fb" });
  const text = (s: string, x: number, y: number, p: { cap?: number; color?: string; seed?: number; align?: "left" | "center" | "right"; w?: number; opacity?: number; progress?: number } = {}) => letter(g, s, x, y, { ...p, color: p.color ?? "#eef6fb" });
  const balloon = (n: string, at: P, to: P, seed: number, q = 1) => { if (q <= 0) return; const a = Math.atan2(to[1] - at[1], to[0] - at[0]), s3 = (i: number) => Math.min(1, Math.max(0, q * 3 - i)); ring(at[0], at[1], 12.5, 1.5, seed, { progress: s3(0) }); text(n, at[0] - 0.5, at[1] - 6, { cap: 12, align: "center", seed, w: 1.6, progress: s3(1) }); ln([at[0] + Math.cos(a) * 13, at[1] + Math.sin(a) * 13], to, 1.05, { seed: seed + 1, color: CYAN, progress: s3(2) }); if (q >= 1) fill(oval(to[0], to[1], 2.4, 2.4, 7), WHITE, 0.95); };
  // a note with its leader: the word first, the rule under it, then the leader out to the part
  const callout = (t: string, at: P, to: P, seed: number, align: "left" | "right" = "left", q = 1, cap = 10) => { if (q <= 0) return; const wd = width(t, cap), x0 = align === "left" ? at[0] : at[0] - wd, s3 = (i: number) => Math.min(1, Math.max(0, q * 3 - i)); text(t, x0, at[1] - cap - 1, { cap, seed, color: WHITE, progress: s3(0) }); ln([x0 - 2, at[1] + 4], [x0 + wd + 2, at[1] + 4], 1, { seed: seed + 1, color: CYAN, progress: s3(1) }); const from: P = align === "left" ? [x0 - 2, at[1] + 4] : [x0 + wd + 2, at[1] + 4]; ln(from, to, 1, { seed: seed + 2, color: CYAN, progress: s3(2) }); if (q >= 1) fill(oval(to[0], to[1], 2.2, 2.2, 7), WHITE, 0.95); };
  // A LINEAR DIMENSION between a and b, measured along the unit direction `u`, set off by `off`
  // along the normal. Order a draftsman uses: witness lines, the dimension line, arrows, the figure.
  const dim = (a: P, b: P, off: number, label: string, seed: number, q = 1, o: { cap?: number; gap?: number; ext?: number; textSide?: number } = {}) => {
    if (q <= 0) return; const cap = o.cap ?? 10, gap = o.gap ?? 4, ext = o.ext ?? 5, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, u: P = [dx / L, dy / L], n: P = [u[1], -u[0]];
    const A: P = [a[0] + n[0] * off, a[1] + n[1] * off], B: P = [b[0] + n[0] * off, b[1] + n[1] * off], sg = Math.sign(off) || 1;
    const wit = (p0: P, i: number, qq: number) => ln([p0[0] + n[0] * gap * sg, p0[1] + n[1] * gap * sg], [p0[0] + n[0] * (off + ext * sg), p0[1] + n[1] * (off + ext * sg)], 0.85, { seed: seed + i, color: CYAN, progress: qq });
    wit(a, 0, cut(q, 0, 0.25)); wit(b, 1, cut(q, 0.1, 0.35));
    ln(A, B, 0.95, { seed: seed + 2, color: CYAN, progress: cut(q, 0.3, 0.6) });
    if (cut(q, 0.6, 0.7) >= 1) { const ang = Math.atan2(u[1], u[0]); arrow(A, ang + Math.PI, 10, CYAN); arrow(B, ang, 10, CYAN); }
    const m = lerp(A, B, 0.5), ts = o.textSide ?? 1, tq = cut(q, 0.7, 1), wd = width(label, cap); /* unidirectional dimensioning: every figure reads from the bottom of the sheet */
    if (Math.abs(u[0]) >= Math.abs(u[1])) k0text(label, m[0], m[1] - cap - 3.5, { cap, align: "center", seed: seed + 3, w: Math.max(1, cap * 0.11), progress: tq });
    else k0text(label, ts > 0 ? m[0] + 6 : m[0] - 6 - wd, m[1] - cap / 2, { cap, seed: seed + 3, w: Math.max(1, cap * 0.11), progress: tq });
  };
  const raw = (): Ctx => g.cur;
  return { g, ink, pen, ln, dash, chain, arrow, fill, ring, circle, chainRing, hatch, stipple, text, balloon, callout, dim, raw, arc, poly, oval, jitter, rng };
};

// ---------------------------------------------------------------- the sheet (the ground: frame 0)
export const sheet = (k: Kit) => {
  const c = k.g.main, e = k.g.env, W = e.W, H = e.H, dw = Math.round(W * e.scale), dh = Math.round(H * e.scale);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = GROUND; c.fillRect(0, 0, dw, dh); c.restore();
  c.save(); c.setTransform(e.scale, 0, 0, e.scale, 0, 0); /* the exposure is never even: brighter where the arc lamp stood */
  const glow = c.createRadialGradient(W * 0.46, H * 0.4, 60, W * 0.5, H * 0.5, W * 0.78); glow.addColorStop(0, "rgba(58,120,178,0.34)"); glow.addColorStop(0.55, "rgba(30,84,140,0.1)"); glow.addColorStop(1, "rgba(4,16,36,0.5)"); c.fillStyle = glow; c.fillRect(0, 0, W, H);
  c.restore();
  k.g.paper("blueMottle", 0.55);
  c.save(); c.setTransform(e.scale, 0, 0, e.scale, 0, 0); /* two old fold lines: a sheet that has lived in a drawer */
  [[W * 0.5 + 3, 0, W * 0.5 - 2, H], [0, H * 0.5 - 4, W, H * 0.5 + 2]].forEach(([x0, y0, x1, y1]) => { c.strokeStyle = "rgba(190,225,245,0.07)"; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = "rgba(2,10,26,0.16)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0 + 2, y0 + 2); c.lineTo(x1 + 2, y1 + 2); c.stroke(); });
  c.restore();
  dust(k);
};
export const dust = (k: Kit) => k.g.group("plain", () => { const c = k.raw(), r = k.rng(77), W = k.g.env.W, H = k.g.env.H; k.g.touch(0, 0, W, H); for (let i = 0; i < 260; i++) { c.globalAlpha = 0.1 + r() * 0.3; c.fillStyle = r() < 0.75 ? "#dff1fb" : "#06142c"; c.beginPath(); c.arc(r() * W, r() * H, 0.4 + r() * r() * 1.8, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1; });
export const tooth = (g: Gfx) => { g.paper("paper", 0.34); g.paper("coldpress", 0.2); };

// the border is ruled stroke by stroke, outer frame first, inner rule chasing it; zone marks after
export const border = (k: Kit, p = 1) => { if (p <= 0) return; const W = k.g.env.W, H = k.g.env.H; k.ink(() => {
  const q = stagger(cut(p, 0, 0.7), 8, 0.42);
  [[22, 2.6], [34, 1.2]].forEach(([m, w], j) => [[[m, m], [W - m, m]], [[W - m, m], [W - m, H - m]], [[W - m, H - m], [m, H - m]], [[m, H - m], [m, m]]].forEach(([a, b], i) => k.ln(a as P, b as P, w, { seed: 900 + j * 4 + i, taper: 0.15, progress: q(i * 2 + j) })));
  const z = cut(p, 0.65, 1);
  ["A", "B", "C", "D"].forEach((t, i) => { const y = 34 + ((H - 68) * (i + 0.5)) / 4, qq = stagger(z, 8, 0.4)(i); k.text(t, 24.5, y - 4, { cap: 7, seed: 910 + i, color: CYAN, w: 1, progress: qq }); if (i) k.ln([22, 34 + ((H - 68) * i) / 4], [34, 34 + ((H - 68) * i) / 4], 1, { seed: 920 + i, progress: qq }); });
  ["1", "2", "3", "4"].forEach((t, i) => { const x = 34 + ((W - 68) * (i + 0.5)) / 4, qq = stagger(z, 8, 0.4)(i + 4); k.text(t, x, 24.5, { cap: 7, seed: 930 + i, color: CYAN, w: 1, align: "center", progress: qq }); if (i) k.ln([34 + ((W - 68) * i) / 4, 22], [34 + ((W - 68) * i) / 4, 34], 1, { seed: 940 + i, progress: qq }); });
}); };

// ---------------------------------------------------------------- cached part surfaces
// A slot holds one surface and the key its pixels were drawn under. The key must name everything
// the pixels depend on; a slot redrawn under the same key gives the same pixels.
export type Slot = { L: Layer; key: string | null };
export const slot = (env: Env, name: string): Slot => {
  const dw = Math.round(env.W * env.scale), dh = Math.round(env.H * env.scale), id = `bp:${name}:${dw}x${dh}`; let s = env.cache.get(id) as Slot | undefined;
  if (!s) { s = { L: env.canvas(dw, dh), key: null }; env.cache.set(id, s); }
  return s;
};
export const blit = (ctx: Ctx, L: Layer) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.drawImage(L.canvas as CanvasImageSource, 0, 0); ctx.restore(); };
export { arc, poly };
