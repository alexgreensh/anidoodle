// ACT 3, WATERCOLOUR. The third construction: nothing is ruled and nothing is printed. A soft
// pencil underdrawing goes down FIRST and stays visible under the paint, then washes are laid
// wet-in-wet and allowed to misbehave: they bloom out from where the brush touched, they pool
// darker at the wet edge, they granulate as they dry, and they never stay inside the pencil.
// The medium is the motion. Water spreads on the beat, pigment settles after it.
import { Ctx, Env, GRAPHITE, Gfx, P, TINT, jitter, oval, rng } from "../core";
import { CX, CY, HEAD, K, KC, THORAX, Wing, cen, lerp } from "./geom";

export const PAPER3 = "#fbf7ee";
const ROSE = TINT.rose, BLUSH = TINT.blush, BUTTER = TINT.butter, SKY = TINT.sky, DENIM = TINT.denim, PEACH = TINT.peach;

// a wash does not appear, it SPREADS: every point of the shape reaches its edge at its own
// moment, out from the point the brush was put down
const spread = (pts: P[], from: P, t: number, seed: number): P[] => { const r = rng(seed); return pts.map((p) => { const lag = 0.55 + r() * 0.45, u = Math.max(0, Math.min(1, (t * 1.5 - (1 - lag)) / lag)); return lerp(from, p, u * u * (3 - 2 * u)); }); };
const bodyShape = (): P[] => { const segs = 7, y0 = 70, y1 = 250, hw = (t: number) => 23 * (1 - t) ** 0.8 + 6.5, L: P[] = [], R: P[] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, y = y0 + (y1 - y0) * t; L.push([CX - hw(t) * K, CY + y * K]); R.push([CX + hw(t) * K, CY + y * K]); }
  return [...THORAX.slice(0, 7), ...R, ...L.reverse(), ...THORAX.slice(7)]; };

// ---------------------------------------------------------------- the pencil under the paint
export const pencil = (g: Gfx, w: Wing[], p: number) => {
  if (p <= 0) return;
  const st = (i: number, n: number, dur = 0.45) => (p >= 1 ? 1 : Math.max(0, Math.min(1, (p - (i * (1 - dur)) / Math.max(1, n - 1)) / dur)));
  g.group("ink", () => {
    w.forEach((wg, i) => {
      g.pen(wg.out, { w: 2.2, color: GRAPHITE, seed: 1200 + i, closed: true, wobble: 1.4, boil: 0, opacity: 0.72, progress: st(i, 9) });
      [0, 2, 4].forEach((j, r) => { if (j >= wg.ends.length) return; const line = Array.from({ length: 6 }, (_, q) => wg.spar(j, 0.05 + (q / 5) * 0.88)); g.pen(line, { w: 1.5, color: GRAPHITE, seed: 1220 + i * 4 + r, wobble: 1.1, boil: 0, opacity: 0.55, progress: st(4 + i, 9) }); });
    });
    g.pen(bodyShape(), { w: 2.4, color: GRAPHITE, seed: 1240, closed: true, wobble: 1.2, boil: 0, opacity: 0.75, progress: st(8, 9) });
    g.pen(HEAD, { w: 2, color: GRAPHITE, seed: 1241, closed: true, wobble: 1, boil: 0, opacity: 0.75, progress: st(8, 9) });
    const o = cen(THORAX); ([[o[0] + 2, o[1] + 8, 26], [o[0] - 18, o[1] - 32, 15], [o[0] + 22, o[1] - 24, 11]] as number[][]).forEach(([x, y, r], i) => g.pen(jitter(oval(x, y, r, r, 12), 1.4, 1260 + i), { w: 1.4, color: GRAPHITE, seed: 1260 + i, closed: true, wobble: 0.8, boil: 0, opacity: 0.8, progress: st(8, 9) })); /* it is still a clockwork butterfly: the train is drawn, then painted */
    g.pen(jitter(oval(KC[0], KC[1], 7, 7, 10), 0.8, 1270), { w: 1.6, color: GRAPHITE, seed: 1270, closed: true, wobble: 0.7, boil: 0, opacity: 0.6, progress: st(8, 9) });
    [-1, 1].forEach((sd) => g.pen(jitter(oval(KC[0] + sd * 21, KC[1] + 3, 16, 21, 11), 1.1, 1272 + sd), { w: 1.5, color: GRAPHITE, seed: 1272 + sd, closed: true, wobble: 0.9, boil: 0, opacity: 0.55, progress: st(8, 9) }));
    g.pen([[KC[0], KC[1] - 36], [KC[0], KC[1] - 4]], { w: 1.6, color: GRAPHITE, seed: 1274, wobble: 0.6, boil: 0, opacity: 0.6, progress: st(8, 9) });
    [-1, 1].forEach((sd) => { const a0: P = [CX + sd * 8 * K, CY - 127 * K], a1: P = [CX + sd * 56 * K, CY - 206 * K], a2: P = [CX + sd * 124 * K, CY - 246 * K]; g.pen(Array.from({ length: 9 }, (_, i) => { const t = i / 8; return lerp(lerp(a0, a1, t), lerp(a1, a2, t), t); }), { w: 1.6, color: GRAPHITE, seed: 1250 + sd, wobble: 0.9, boil: 0, opacity: 0.65, progress: st(8, 9) }); });
  }, { alpha: 0.9 });
};

// ---------------------------------------------------------------- the washes
export const washes = (g: Gfx, w: Wing[], s: { wet: number; settle: number; slip: P }) => {
  if (s.wet <= 0) return;
  const st = (i: number, n: number, dur = 0.5) => Math.max(0, Math.min(1, (s.wet - (i * (1 - dur)) / Math.max(1, n - 1)) / dur));
  const off = (pts: P[]): P[] => pts.map(([x, y]) => [x + s.slip[0], y + s.slip[1]] as P); /* the paint slides off its own drawing */
  const shrunk = (pts: P[], k: number): P[] => { const c = cen(pts); return pts.map((q) => lerp(q, c, k)); };
  // pigment does not dry flat: it pools where the water sat longest and lifts where it ran out
  const pools = (pts: P[], col: string, seed: number, n: number, a: number) => {
    const c0 = cen(pts), r = rng(seed);
    for (let i = 0; i < n; i++) { const k = 0.3 + r() * 0.45, dx = (r() - 0.5) * 46, dy = (r() - 0.5) * 40; g.wash(shrunk(pts, k).map(([x, y]) => [x + dx, y + dy] as P), col, { alpha: a * (0.55 + r() * 0.6), seed: seed + i * 3, dx: (r() - 0.5) * 8, dy: (r() - 0.5) * 8, shrink: 0.86 + r() * 0.2, rim: r() > 0.45 }); }
  };
  g.group("paint", () => {
    const c = g.cur;
    w.forEach((wg, i) => {
      const t = st(i, 6), root = wg.h, tip = wg.ends[Math.max(0, wg.ends.length - 3)];
      if (t <= 0) return;
      const shape = off(wg.out.map((p) => lerp(p, cen(wg.out), -0.02))), pig = i < 2 ? BLUSH : ROSE;
      c.globalCompositeOperation = "source-over";
      g.wash(spread(shape, root, t, 1300 + i), pig, { alpha: 0.3, seed: 1300 + i, dx: 3, dy: 2, shrink: 0.97, rim: t > 0.55 }); /* the first pass is thin: watercolour is built, never filled */
      if (t > 0.35) { c.globalCompositeOperation = "multiply";
        const q = Math.min(1, (t - 0.35) / 0.4);
        pools(spread(shape, root, t, 1300 + i), pig, 1310 + i * 7, 4, 0.22 * q); /* uneven drying, the whole charm of the medium */
        g.wash(spread(shrunk(shape, 0.1), lerp(root, tip, 0.3), q, 1316 + i), pig, { alpha: 0.2 * q, seed: 1316 + i, dx: -3, dy: 4, shrink: 0.9, rim: true });
      }
      if (t > 0.45) { c.globalCompositeOperation = "multiply"; /* a second pigment dropped into the first while it is still wet */
        const second = shrunk(off(wg.out.map((p) => lerp(p, wg.h, 0.22))), 0.12); /* the drop runs toward the root, it does not fill a panel */
        g.wash(spread(second, lerp(root, tip, 0.45), (t - 0.45) / 0.55, 1320 + i), i < 2 ? BUTTER : PEACH, { alpha: 0.26, seed: 1320 + i, dx: -4, dy: 3, shrink: 0.88 });
        pools(second, i < 2 ? BUTTER : PEACH, 1330 + i * 5, 2, 0.14);
      }
      if (t > 0.7 && s.settle > 0.2) { c.globalCompositeOperation = "multiply"; /* pigment walks to the wet edge and dries as a dark rim */
        g.wash(spread(off(wg.out.map((p) => lerp(p, cen(wg.out), 0.04))), lerp(root, tip, 0.6), 1, 1340 + i), SKY, { alpha: 0.1 * s.settle, seed: 1340 + i, dx: 2, dy: -3, shrink: 0.995, rim: true });
        g.wash(spread(off(wg.out.map((p) => lerp(p, cen(wg.out), 0.02))), lerp(root, tip, 0.8), 1, 1350 + i), pig, { alpha: 0.16 * s.settle, seed: 1350 + i, dx: 1, dy: 5, shrink: 1.0, rim: true });
        const edge = off(wg.out), inner = shrunk(edge, 0.055); g.mark(edge, 4); c.globalAlpha = 0.3 * s.settle; c.fillStyle = pig; c.beginPath(); edge.forEach(([x, y], q) => (q ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); [...inner].reverse().forEach(([x, y], q) => (q ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill("evenodd"); c.globalAlpha = 1; /* the hard wet edge: pigment stranded at the rim as the water left */
      }
      c.globalCompositeOperation = "source-over";
    });
  }, { alpha: 0.95 });
  const b = st(5, 6);
  if (b > 0) g.group("paint", () => {
    const c = g.cur, body = off(bodyShape());
    g.wash(spread(body, [CX, CY], b, 1360), DENIM, { alpha: 0.34, seed: 1360, dx: 2, dy: 3, shrink: 0.96 });
    c.globalCompositeOperation = "multiply";
    pools(body, DENIM, 1364, 3, 0.2);
    g.wash(spread(shrunk(body, 0.18), [CX + 9, CY + 30], b, 1366), DENIM, { alpha: 0.24, seed: 1366, dx: 5, dy: 2, shrink: 0.9, rim: true }); /* the shadow side of the body, wet into wet */
    g.wash(spread(off(HEAD.map((p) => lerp(p, cen(HEAD), -0.05))), [CX, CY - 110 * K], b, 1362), DENIM, { alpha: 0.4, seed: 1362, dx: -2, dy: 2, shrink: 0.94 });
    { const kb = [-1, 1].map((sd) => off(jitter(oval(KC[0] + sd * 21, KC[1] + 3, 16, 21, 11), 1.1, 1380 + sd))); kb.forEach((sh, i) => g.wash(spread(sh, KC, b, 1380 + i), DENIM, { alpha: 0.3, seed: 1380 + i, dx: 2, dy: 2, shrink: 0.9, rim: true })); } /* the key, painted where it lies */
    if (s.settle > 0.3) { const o = cen(THORAX), wheels: number[][] = [[o[0] + 2, o[1] + 8, 26], [o[0] - 18, o[1] - 32, 15], [o[0] + 22, o[1] - 24, 11]];
      c.globalCompositeOperation = "destination-out"; /* lift the pigment off the wheels with a damp brush, the way you would */
      wheels.forEach(([x, y, r], i) => g.wash(off(jitter(oval(x, y, r * 0.96, r * 0.96, 12), 1.4, 1366 + i)), "#000000", { alpha: 0.5 * s.settle, seed: 1366 + i, dx: 0, dy: 0, shrink: 0.98, rim: false }));
      c.globalCompositeOperation = "multiply";
      wheels.forEach(([x, y, r], i) => g.wash(off(jitter(oval(x, y, r, r, 12), 1.6, 1370 + i)), SKY, { alpha: 0.4 * s.settle, seed: 1370 + i, dx: 1, dy: 2, shrink: 0.92, rim: true })); } /* then drop a cooler pigment into the hollow: the train, seen through the body */
    c.globalCompositeOperation = "source-over";
  }, { alpha: 0.95 });
};

// a drop of clean water dropped into a drying wash pushes the pigment out in a ring
export const backrun = (g: Gfx, at: P, r: number, t: number, seed: number) => {
  if (t <= 0) return;
  const e = t * t * (3 - 2 * t), R = r * (0.25 + 0.75 * e), c = g.cur;
  c.globalCompositeOperation = "destination-out"; /* straight onto the paint: a group of its own would have nothing to lift */
  g.wash(jitter(oval(at[0], at[1], R, R * 0.86, 18), R * 0.2, seed), "#000000", { alpha: 0.6 * (1 - e * 0.2), seed, dx: 0, dy: 0, shrink: 1, rim: false });
  g.wash(jitter(oval(at[0] - R * 0.34, at[1] + R * 0.26, R * 0.44, R * 0.36, 14), R * 0.12, seed + 3), "#000000", { alpha: 0.5, seed: seed + 3, dx: 0, dy: 0, shrink: 1, rim: false });
  c.globalCompositeOperation = "multiply";
  g.wash(jitter(oval(at[0], at[1], R * 1.07, R * 0.94, 18), R * 0.24, seed + 7), TINT.rose, { alpha: 0.3 * e, seed: seed + 7, dx: 0, dy: 0, shrink: 1.02, rim: true }); /* and piles the pigment into a hard ring at the edge of the bloom */
  c.globalCompositeOperation = "source-over";
};

export const sheet3 = (g: Gfx, W: number, H: number) => { const c = g.main, e = g.env; c.setTransform(e.scale, 0, 0, e.scale, 0, 0); c.fillStyle = PAPER3; c.fillRect(0, 0, W, H); g.paper("coldpress", 0.17); };
export const dry = (g: Gfx) => { g.paper("washGran", 0.05); g.paper("coldpress", 0.11); g.vignette("rgba(120,96,64,0.055)"); }; /* the sheet keeps its light: three multiplies turned white paper into cardboard */
