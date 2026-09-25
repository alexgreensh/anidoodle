// THE CREATURE AS A NATURALIST PLATE (spec 5.7: more realistic, less abstract).
// The stained-glass direction is withdrawn and this file is rebuilt to it. A lepidopterist should
// be able to name every part: a closed discal cell, veins forking to a scalloped margin, the
// submarginal spot row, the apical patch, the discal spot, a furred thorax, seven abdominal
// segments, compound eyes with palps between them, clubbed antennae, a proboscis that is a tube
// and not a spring, and six jointed legs. The species stays ORIGINAL: the medium and the anatomy
// are borrowed, the pattern is not. The reference actually opened is named atop `anatomy.ts`.
//
// It still carries a WETNESS per part, because this is also the creature the water is making in
// beat 1. At 0 the blueprint shows through untouched; between 0 and 1 the paint reaches only as
// far as the water has, clipped to the front, never faded in over the whole shape.
import { Gfx, P, displace, jitter, oval, rng, sample, tube } from "../../core";
import { CX, CY, FW, FW_H, FW_T, HEAD, HW, HW_H, HW_T, Pose, THORAX, Wing, cen, lerp, wingGeom } from "../geom";
import { GRASS_SHADE, PAPER_W } from "../finale/world";

// RICHER PIGMENT (not washed out, real pigment depth). The finale's ROSE and
// PEACH are a value or two too weak to carry a naturalist plate, so the creature gets its own,
// deeper set here rather than an edit to `finale/world.ts`: that file feeds the approved finale
// still, which keeps re-rendering byte-identical, and this way the film gets the stronger paint
// without moving anything anyone has already signed off.
const ROSE = "#d96e80", ROSE_D = "#b04a5e", PEACH = "#ef9a5c", PEACH_L = "#f8c48c", CORNFLOWER = "#3f6fc4";
import { lift } from "../finale/paint";
import { venation } from "./anatomy";

export type Flight = { pose: Pose; heading: number; pitch: number; bank: number };
export const REST_FLIGHT: Flight = { pose: { flap: 1, sweep: 0 }, heading: 0, pitch: 1, bank: 0 };
// Wing order everywhere in movement 2: 0 port hind, 1 starboard hind, 2 port fore, 3 starboard fore.
export const wingsOf = (f: Flight): Wing[] => {
  const port = { ...f.pose, flap: Math.min(1, f.pose.flap + f.bank) }, star = { ...f.pose, flap: Math.max(0.2, f.pose.flap - f.bank) };
  return [wingGeom(-1, HW, HW_H, HW_T, 2000, port), wingGeom(1, HW, HW_H, HW_T, 2600, star), wingGeom(-1, FW, FW_H, FW_T, 1000, port), wingGeom(1, FW, FW_H, FW_T, 1600, star)];
};
export const mapper = (at: P, scale: number, f: Flight) => {
  const c = Math.cos(f.heading), s = Math.sin(f.heading);
  return (p: P): P => { const dx = (p[0] - CX) * scale, dy = (p[1] - CY) * scale * f.pitch; return [at[0] + dx * c - dy * s, at[1] + dx * s + dy * c]; };
};

export type Wetness = { panel: (wing: number, panel: number) => number; spar: (wing: number, spar: number) => number; body: (part: "shell" | "head" | "window" | "abdomen") => number; from: (wing: number, panel: number) => boolean };
export const ALL_WET: Wetness = { panel: () => 1, spar: () => 1, body: () => 1, from: () => true };

// The wet part of a panel. A half-taken panel is not a whole panel at half strength: it is paint
// up to the water's edge and blueprint past it.
export const wetPart = (p: P[], fromLow: boolean, t: number): P[] => {
  if (t >= 0.995) return p;
  const A = fromLow ? [p[0], p[1], p[2]] : [p[6], p[5], p[4]], B = fromLow ? [p[6], p[5], p[4]] : [p[0], p[1], p[2]];
  const f = A.map((q, i) => lerp(q, B[i], t));
  return [...A, ...(t > 0.55 ? [p[3]] : []), ...f.slice().reverse()];
};
export const frontLine = (p: P[], fromLow: boolean, t: number): P[] => {
  const A = fromLow ? [p[0], p[1], p[2]] : [p[6], p[5], p[4]], B = fromLow ? [p[6], p[5], p[4]] : [p[0], p[1], p[2]];
  return A.map((q, i) => lerp(q, B[i], t));
};

// ---------------------------------------------------------------- the paint box
export const UMBER = "#6d4a33", BAND = "#57402f", DUST = "#a08a70", SPOT = "#fcf5e7", FUR = "#c8a98c", FUR_D = "#7d6249";
export const EYE = "#3a3026", EYE_HI = "#fdfbf4", IRIS_B = "#4d72ae", IRIS_O = "#df8a3d", LEG = "#5e4b3a";
export const mixc = (a: string, b: string, t: number) => { const h = (x: string) => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]; const A = h(a), B = h(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, "0")).join(""); };

// A wash that wobbles in proportion to the thing it is painting. The core's `wash` displaces every
// outline by an ABSOLUTE thirteen units: right for a wing, porridge for a palp and a flat
// airbrushed ribbon for a macro cell. Everything here therefore carries its own scale.
export const ps = (g: Gfx, pts: P[], col: string, alpha: number, seed: number, s: number, rim = true): P[] => {
  const q = displace(sample(jitter(pts, s * 0.012, seed), true, 5), s * 0.035, 1.9 / Math.max(6, s), 2, (seed % 83) + 5);
  g.fill(q, col, alpha);
  if (rim) { const c = g.cur; c.globalAlpha = alpha * 0.5; c.strokeStyle = col; c.lineWidth = Math.max(1.1, s * 0.016); c.lineJoin = "round"; g.path(c, q); c.stroke(); c.globalAlpha = 1; }
  return q;
};
// WET ON DAMP. A marking dropped into a wash that has not dried has no edge of its own: it creeps
// a little and stops soft. Three passes, each smaller and stronger, is what that looks like.
export const damp = (g: Gfx, pts: P[], col: string, alpha: number, seed: number, s: number) => {
  const c = cen(pts);
  for (let k = 0; k < 3; k++) ps(g, pts.map((q) => lerp(q, c, k * 0.11)), col, alpha * (0.42 + k * 0.26), seed + k * 7, s * (1 - k * 0.12), false);
};
export const dilate = (pts: P[], d: number): P[] => { const c = cen(pts); return pts.map(([x, y]) => { const dx = x - c[0], dy = y - c[1], l = Math.hypot(dx, dy) || 1; return [x + (dx / l) * d, y + (dy / l) * d] as P; }); };
// a vein: heavier at the base, thinning to nothing, and BROKEN, because a rigger runs out of paint
export const rigger = (g: Gfx, pts: P[], w0: number, col: string, alpha: number, seed: number) => {
  const s = sample(pts, false, 11), r = rng(seed);
  for (let i = 0; i < s.length - 1; i++) {
    const t = i / (s.length - 1); if (r() < 0.035 + t * 0.13) continue; /* a rigger runs dry here and there; it does not draw a dash-dot rule */
    const w = w0 * (1 - t * 0.94) ** 1.7;
    g.fill(tube([s[i], s[i + 1]], Math.max(0.28, w), Math.max(0.24, w * 0.92), false), col, alpha * (0.55 + 0.45 * (1 - t)));
  }
};

export type PaintOpts = {
  wetness?: Wetness;
  groundLift?: boolean;
  shadow?: number; shadowOff?: P;
  proboscis?: number; probTo?: P;
  legs?: number; // 0 tucked in flight, 1 unfolded and gripping
  seed?: number;
  behind?: string; // what the wings are over, for the fifth of it that warms through them
};

export const paintCreature = (g: Gfx, at: P, scale: number, f: Flight, o: PaintOpts = {}) => {
  const T = mapper(at, scale, f), seed = o.seed ?? 900, W = wingsOf(f), sc = scale * 90;
  const wt = o.wetness ?? ALL_WET, gl = o.groundLift === true, lod = scale * 780; // wingspan on screen

  if ((o.shadow ?? 0) > 0) { const d = o.shadowOff ?? [-0.5, 0.55]; g.fill(oval(at[0] + sc * d[0], at[1] + sc * d[1], sc * 1.5, sc * 0.35, 10), GRASS_SHADE, 0.16 * (o.shadow ?? 0)); }
  if ((o.legs ?? 0) > 0 && lod > 120) legs(g, T, sc, o.legs ?? 1, seed, false);
  // hindwings first: the forewing OVERLAPS the hindwing's leading third, and the double layer is darker
  [0, 1, 2, 3].forEach((i) => paintWing(g, T, W[i], i, sc, lod, wt, gl, seed, o.behind));
  body(g, T, sc, lod, wt, seed);
  if ((o.legs ?? 0) > 0 && lod > 120) legs(g, T, sc, o.legs ?? 1, seed, true);
  headParts(g, T, sc, lod, wt, o.proboscis ?? 0, o.probTo, seed);
};

// ---------------------------------------------------------------- one wing
const paintWing = (g: Gfx, T: (p: P) => P, wg: Wing, i: number, sc: number, lod: number, wt: Wetness, gl: boolean, seed: number, behind?: string) => {
  const fore = i >= 2, star = i % 2 === 1, A = venation(wg, fore, seed + i * 77), r = rng(seed + i * 11);
  const c0 = cen(wg.out);
  // how wet a point of the wing is: which panel it falls in, and how far the front has crossed it
  const cents = wg.panels.map(cen);
  const wetAt = (q: P): number => {
    let bi = 0, bd = 1e18; cents.forEach((c, j) => { const d = (c[0] - q[0]) ** 2 + (c[1] - q[1]) ** 2; if (d < bd) { bd = d; bi = j; } });
    const u = wt.panel(i, bi); if (u <= 0 || u >= 1) return u;
    const p = wg.panels[bi], low = wt.from(i, bi);
    const Am = low ? lerp(p[0], p[2], 0.5) : lerp(p[6], p[4], 0.5), Bm = low ? lerp(p[6], p[4], 0.5) : lerp(p[0], p[2], 0.5);
    const vx = Bm[0] - Am[0], vy = Bm[1] - Am[1], L = vx * vx + vy * vy || 1;
    return ((q[0] - Am[0]) * vx + (q[1] - Am[1]) * vy) / L <= u ? 1 : 0;
  };
  if (!wg.panels.some((_, j) => wt.panel(i, j) > 0)) return;

  // ---- the paper. Either the ground LIFTED panel by panel as the water arrives, or one reserve.
  if (gl) wg.panels.forEach((pn, j) => { const u = wt.panel(i, j); if (u <= 0) return; const part = wetPart(pn, wt.from(i, j), u); ps(g, dilate(part, 15).map(T), PAPER_W, 0.93, seed + 800 + i * 9 + j, sc * 0.8, false); ps(g, jitter(dilate(part, 12).map(T), sc * 0.04, seed + 810 + i * 9 + j), "#6f8ea8", 0.1, seed + 820 + i * 9 + j, sc * 0.5, false); });
  else g.fill(dilate(A.out, 1.5).map(T), PAPER_W, 0.62);

  // ---- 1. the pale first wash, laid PANEL BY PANEL so the water's edge stays the edge of the
  // paint. Filtering an outline point by point instead tears the polygon into a rag: a shape has
  // to keep all of its vertices, so what gets clipped is the region, never the point list.
  let anyPaint = false;
  wg.panels.forEach((pn, j) => {
    const u = wt.panel(i, j); if (u <= 0) return;
    anyPaint = true;
    const q = dilate(wetPart(pn, wt.from(i, j), u), 4), p = q.map(T), pc = cen(p), root = T(wg.h);
    const far = Math.min(1, Math.hypot(pc[0] - root[0], pc[1] - root[1]) / (sc * 3.2));
    ps(g, p, ROSE, 0.62 + (1 - far) * 0.28, seed + i * 20 + j, sc);
    ps(g, p.map((z) => lerp(z, T(wg.h), 0.24)), ROSE_D, 0.3 * (1 - far), seed + 40 + i * 20 + j, sc * 0.9, false); /* the pigment pools deepest at the wing root */
    ps(g, p.map((z) => lerp(z, pc, 0.16)), PEACH, 0.4 + far * 0.38, seed + 60 + i * 20 + j, sc * 0.8, false);
    ps(g, p.map((z) => lerp(z, pc, 0.42)), PEACH_L, 0.24 + far * 0.2, seed + 70 + i * 20 + j, sc * 0.6, false);
    if (behind) ps(g, p.map((z) => lerp(z, pc, 0.3)), behind, 0.17, seed + 90 + i * 20 + j, sc * 0.7, false); /* a wing is TRANSLUCENT: a fifth of what is behind it warms through */
    for (let k = 0; k < 2; k++) { const rr = rng(seed + 700 + i * 30 + j * 5 + k), k2 = 0.3 + rr() * 0.4, off: P = [(rr() - 0.5) * sc * 0.45, (rr() - 0.5) * sc * 0.35]; ps(g, p.map((z) => [pc[0] + (z[0] - pc[0]) * k2 + off[0], pc[1] + (z[1] - pc[1]) * k2 + off[1]] as P), rr() > 0.5 ? mixc(ROSE_D, "#8f3a50", 0.4) : mixc(PEACH, "#e8843f", 0.45), 0.2 + rr() * 0.22, seed + 710 + i * 30 + j * 5 + k, sc * 0.6, false); }
    /* the marginal band lives on the OUTER edge of each panel, so it narrows toward the rear
       corner on its own, because the panels do */
    if (lod > 46 && wetAt(pn[3]) > 0.5) { const outerEdge = [pn[2], pn[3], pn[4]].map(T), innerEdge = outerEdge.map((z) => lerp(z, pc, 0.3)); damp(g, [...outerEdge, ...innerEdge.slice().reverse()], BAND, 0.5, seed + 160 + i * 9 + j, sc * 0.7); }
  });
  if (!anyPaint) return;

  // ---- 2. the pattern, dropped in WET ON DAMP so nothing but the eyespot's pupil has a hard edge
  const dustPts = wg.panels.filter((_, j) => wt.panel(i, j) > 0.5).map((pn) => lerp(cen(pn), wg.h, 0.62));
  if (dustPts.length > 2) damp(g, [...dustPts, wg.h].map(T), DUST, 0.46, seed + 120 + i, sc * 0.8); /* the warm grey-umber dusting at the base, where the wing is hairy */
  const disc = lerp(A.cell[4], A.cell[5], 0.5);
  if (lod > 120 && wetAt(disc) > 0.5) { const d = T(disc); damp(g, oval(d[0], d[1], sc * 0.085, sc * 0.065, 9), UMBER, 0.66, seed + 130 + i, sc * 0.22); } /* the discal spot, at the end of the cell */
  if (fore && lod > 120) {
    const apex = A.ends[Math.min(1, A.ends.length - 1)], apx = lerp(apex, c0, 0.22), second = A.ends[Math.min(2, A.ends.length - 1)];
    if (wetAt(apx) > 0.5) { /* the dark umber apical patch, holding three pale spots */
      damp(g, [apex, lerp(apex, A.ends[0], 0.55), lerp(apx, c0, 0.34), lerp(apex, second, 0.6)].map(T), UMBER, 0.56, seed + 140 + i, sc * 0.6);
      for (let k = 0; k < 3; k++) { const q = T(lerp(apx, lerp(A.ends[0], second, 0.15 + k * 0.3), 0.42)); ps(g, oval(q[0], q[1], sc * 0.034, sc * 0.028, 8), SPOT, 0.7, seed + 150 + i * 5 + k, sc * 0.1, false); }
    }
  }
  // the row of pale submarginal spots that the blueprint's rivets became
  if (lod > 120) A.ends.forEach((e, k) => { const p = lerp(e, c0, 0.19); if (wetAt(p) < 0.5) return; const q = T(p); ps(g, oval(q[0], q[1], sc * 0.03, sc * 0.025, 8), SPOT, 0.66, seed + 170 + i * 7 + k, sc * 0.1, false); });
  // the one mark no real butterfly has: an iridescent cornflower scale patch in the starboard forewing
  if (i === 3) { const u = wt.panel(3, 2); if (u > 0) { const q = dilate(wetPart(wg.panels[2], wt.from(3, 2), u), 4).map(T), qc = cen(q); ps(g, q, CORNFLOWER, 0.92, seed + 300, sc); ps(g, q.map((z) => lerp(z, qc, 0.34)), mixc(CORNFLOWER, "#8fb6e8", 0.5), 0.4, seed + 302, sc * 0.6, false); lift(g, q.map((z) => lerp(z, qc, 0.52)), seed + 304, 0.3); } }
  // the hindwing's eyespot at the base of the tail: the only hard edge on the whole creature
  if (!fore && lod > 120) {
    const tail = A.ends[Math.max(0, A.ends.length - 2)], e = lerp(tail, c0, 0.26);
    if (wetAt(e) > 0.5) { const q = T(e); damp(g, oval(q[0], q[1], sc * 0.105, sc * 0.09, 10), IRIS_O, 0.76, seed + 180 + i, sc * 0.24); ps(g, oval(q[0], q[1], sc * 0.066, sc * 0.056, 9), IRIS_B, 0.86, seed + 182 + i, sc * 0.16, false); g.fill(oval(q[0], q[1], sc * 0.028, sc * 0.024, 8), EYE, 0.86); g.fill(oval(q[0] + sc * 0.011, q[1] - sc * 0.011, sc * 0.009, sc * 0.007, 6), EYE_HI, 0.8); }
  }
  // ---- 3. VOLUME. The wing has a camber, so a soft shadow lies behind every main vein.
  if (lod > 120) A.veins.filter((v) => v.main).forEach((v) => { const sh = v.pts.map((q) => [q[0] + 2.6, q[1] + 2.8] as P).map(T); g.fill(tube(sh, sc * 0.021 * v.w, sc * 0.006, false), mixc(UMBER, ROSE, 0.55), 0.18); });
  // ---- 4. the VEINS, last, with a fine rigger: broken, tapering, heavier at the base
  A.veins.forEach((v, k) => {
    const n = 7; let cut = 0;
    for (let q = n - 1; q >= 0; q--) { const p = v.pts[Math.min(v.pts.length - 1, Math.round((q / (n - 1)) * (v.pts.length - 1)))]; if (wetAt(p) > 0.5) { cut = (q + 1) / n; break; } }
    if (cut <= 0) return;
    rigger(g, v.pts.slice(0, Math.max(2, Math.ceil(v.pts.length * cut))).map(T), sc * 0.021 * v.w, mixc(UMBER, ROSE_D, 0.3), (v.main ? 0.72 : 0.48) * (lod > 120 ? 1 : 0.7), seed + 400 + i * 20 + k);
  });
  // ---- 5. the fringe: tiny alternating ticks, pale then dark, outside the margin
  if (lod > 120) A.out.forEach((q, k) => {
    if (wetAt(q) < 0.5) return;
    const nx = q[0] - c0[0], ny = q[1] - c0[1], L = Math.hypot(nx, ny) || 1;
    g.fill(tube([T(q), T([q[0] + (nx / L) * A.span * 0.022, q[1] + (ny / L) * A.span * 0.022])], sc * 0.008, sc * 0.003, false), k % 2 ? SPOT : BAND, 0.6);
  });
  // ---- 6. the rim light on the sunward margin: paper LIFTED, never white paint
  if (star) { const rim = A.out.slice(0, Math.ceil(A.out.length * 0.36)).filter((q) => wetAt(q) > 0.5); if (rim.length > 2) lift(g, tube(rim.map(T), sc * 0.05, sc * 0.03, false), seed + 260 + i, 0.6); }
};

// ---------------------------------------------------------------- the body, painted as a FORM
const body = (g: Gfx, T: (p: P) => P, sc: number, lod: number, wt: Wetness, seed: number) => {
  const r = rng(seed + 5), ua = wt.body("abdomen");
  if (ua > 0) for (let i = 0; i < 7; i++) { /* seven visible segments, tapering, a paler band at each joint */
    const t0 = i / 7, t1 = (i + 1) / 7, hw = (t: number) => 23 * (1 - t) ** 0.8 + 6.5;
    const u = Math.min(1, ua * (1.4 - i * 0.06)); if (u <= 0) continue;
    const q: P[] = [T([CX - hw(t0) * 0.9, CY + (70 + 170 * t0) * 0.9]), T([CX + hw(t0) * 0.9, CY + (70 + 170 * t0) * 0.9]), T([CX + hw(t1) * 0.9, CY + (70 + 170 * t1) * 0.9]), T([CX - hw(t1) * 0.9, CY + (70 + 170 * t1) * 0.9])];
    ps(g, q, mixc(UMBER, DUST, 0.16 + i * 0.05), (0.8 - i * 0.02) * u, seed + 400 + i, sc * 0.4);
    ps(g, [q[0], q[1], lerp(q[1], q[2], 0.3), lerp(q[0], q[3], 0.3)], mixc(DUST, SPOT, 0.42), 0.4 * u, seed + 410 + i, sc * 0.3, false); /* the paler band at the joint, wrapping round the cylinder */
    ps(g, [lerp(q[0], q[3], 0.1), lerp(q[1], q[2], 0.1), lerp(q[1], q[2], 0.9), lerp(q[0], q[3], 0.9)].map((z) => lerp(z, cen(q), 0.45)), "#43352a", 0.16 * u, seed + 412 + i, sc * 0.3, false); /* the core shadow, so a segment is a cylinder and not a tile */
  }
  const us = wt.body("shell");
  if (us > 0) {
    const th = THORAX.map(T), c = cen(th);
    ps(g, th, mixc(UMBER, "#4a3a2c", 0.3), 0.84 * us, seed + 420, sc * 0.7);
    ps(g, th.map((q) => lerp(q, [c[0] + sc * 0.16, c[1] - sc * 0.14] as P, 0.42)), mixc(DUST, SPOT, 0.3), 0.44 * us, seed + 422, sc * 0.5, false); /* lit upper right */
    ps(g, th.map((q) => lerp(q, [c[0] - sc * 0.2, c[1] + sc * 0.2] as P, 0.5)), "#3b2f24", 0.3 * us, seed + 424, sc * 0.5, false); /* core shadow */
    ps(g, th.map((q) => lerp(q, [c[0] - sc * 0.26, c[1] + sc * 0.28] as P, 0.64)), mixc(DUST, "#8c7a63", 0.5), 0.24 * us, seed + 426, sc * 0.4, false); /* reflected light coming back up off the petal */
    if (lod > 120) for (let i = 0; i < 30; i++) { /* the fur, dry-brushed ALONG the thorax in the direction it grows, and over the old window */
      const t = r(), a = -1.62 + (r() - 0.5) * 1.5, p = T([CX + (r() - 0.5) * 88, CY - 88 + t * 156]), L = sc * (0.1 + r() * 0.13);
      g.fill(tube([p, [p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L]], sc * 0.012, sc * 0.003, false), r() > 0.45 ? FUR : FUR_D, 0.38 + r() * 0.3);
    }
  }
};

// ---------------------------------------------------------------- head: eyes, palps, antennae
const headParts = (g: Gfx, T: (p: P) => P, sc: number, lod: number, wt: Wetness, prob: number, probTo: P | undefined, seed: number) => {
  if (wt.body("head") <= 0) return;
  ps(g, HEAD.map(T), mixc(UMBER, "#493928", 0.35), 0.86, seed + 424, sc * 0.35);
  if (lod > 120) {
    [-1, 1].forEach((sd) => { /* two large compound eyes, one soft highlight each */
      const e = T([CX + sd * 20, CY - 112]);
      ps(g, oval(e[0], e[1], sc * 0.085, sc * 0.095, 12), EYE, 0.9, seed + 430 + sd, sc * 0.2, false);
      ps(g, oval(e[0] - sc * 0.02, e[1] + sc * 0.02, sc * 0.058, sc * 0.064, 10), mixc(EYE, "#6a5a45", 0.4), 0.42, seed + 432 + sd, sc * 0.14, false);
      g.fill(oval(e[0] + sc * 0.03, e[1] - sc * 0.035, sc * 0.021, sc * 0.017, 8), EYE_HI, 0.85);
    });
    [-1, 1].forEach((sd) => { /* the furry palps, between and below the eyes, pointing forward */
      const b = T([CX + sd * 9, CY - 116]), t = T([CX + sd * 15, CY - 154]);
      g.fill(tube([b, lerp(b, t, 0.55), t], sc * 0.033, sc * 0.012, false), FUR, 0.88);
      g.fill(tube([lerp(b, t, 0.62), t], sc * 0.018, sc * 0.007, false), FUR_D, 0.7);
    });
  }
  [-1, 1].forEach((sd) => { /* the antennae: slender, finely RINGED, ending in a true club */
    const a0 = T([CX + sd * 10, CY - 124]), a1 = T([CX + sd * 52, CY - 190]), a2 = T([CX + sd * 116, CY - 226]);
    const pts = Array.from({ length: 9 }, (_, i) => { const t = i / 8; return lerp(lerp(a0, a1, t), lerp(a1, a2, t), t); });
    g.fill(tube(pts, sc * 0.026, sc * 0.011, false), mixc(EYE, UMBER, 0.3), 0.82);
    if (lod > 120) for (let i = 1; i < 8; i++) g.fill(tube([pts[i], lerp(pts[i], pts[i + 1], 0.45)], sc * 0.016, sc * 0.014, false), FUR, 0.4);
    const cl = pts[8], cb = pts[7];
    ps(g, oval(cl[0] + (cl[0] - cb[0]) * 0.3, cl[1] + (cl[1] - cb[1]) * 0.3, sc * 0.046, sc * 0.03, 9), mixc(EYE, UMBER, 0.2), 0.88, seed + 440 + sd, sc * 0.1, false);
  });
  proboscis(g, T, sc, prob, probTo);
};

// coiled between the palps at rest, a fine double tube when it is out
export const proboscis = (g: Gfx, T: (p: P) => P, sc: number, p: number, to?: P) => {
  const base = T([CX, CY - 132]), tip: P = to ?? [base[0], base[1] + sc * 1.2], spir: P[] = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26, a = 1.4 + t * 2.6 * Math.PI * 2, rr = sc * (0.018 + 0.085 * t);
    const coiled: P = [base[0] + Math.cos(a) * rr, base[1] + Math.sin(a) * rr];
    const bw = Math.sin(t * Math.PI) * sc * 0.3;
    const straight: P = [base[0] + (tip[0] - base[0]) * t - bw * 0.45, base[1] + (tip[1] - base[1]) * t + bw];
    spir.push([coiled[0] + (straight[0] - coiled[0]) * p, coiled[1] + (straight[1] - coiled[1]) * p]);
  }
  g.fill(tube(spir, sc * 0.022, sc * 0.012, false), mixc(EYE, UMBER, 0.25), 0.72);
  if (p > 0.4) g.fill(tube(spir.map((q) => [q[0] + sc * 0.013, q[1] + sc * 0.006] as P), sc * 0.009, sc * 0.005, false), FUR, 0.3 * p); /* it is a DOUBLE tube: two galeae zipped together */
};

// ---------------------------------------------------------------- six legs: femur, tibia, tarsus
export const legs = (g: Gfx, T: (p: P) => P, sc: number, open: number, seed: number, front: boolean) => {
  const r = rng(seed + 77);
  ([[-1, -46, 0.95], [1, -46, 0.95], [-1, 4, 1.05], [1, 4, 1.05], [-1, 52, 1.15], [1, 52, 1.15]] as number[][]).forEach(([sd, y, len], k) => {
    if ((k % 2 === 0) === front) return; /* half of them are on the far side of the body and go under the wings */
    const hip = T([CX + sd * 26, CY + y]), a0 = sd * (0.5 + 0.55 * open) + (r() - 0.5) * 0.18, L = sc * 0.34 * len;
    const knee: P = [hip[0] + Math.cos(a0) * L * (0.5 + 0.5 * open), hip[1] + Math.abs(Math.sin(a0)) * L * 0.42 + L * 0.1];
    const a1 = a0 + sd * (0.9 - 0.4 * open);
    const foot: P = [knee[0] + Math.cos(a1) * L * 0.9 * (0.4 + 0.6 * open), knee[1] + L * (0.5 + 0.5 * open)];
    g.fill(tube([hip, knee], sc * 0.022, sc * 0.015, false), LEG, 0.8); /* femur */
    g.fill(tube([knee, foot], sc * 0.016, sc * 0.009, false), LEG, 0.78); /* tibia */
    g.fill(tube([foot, [foot[0] + Math.cos(a1) * L * 0.2, foot[1] + L * 0.1] as P], sc * 0.01, sc * 0.004, false), mixc(LEG, EYE, 0.5), 0.8); /* tarsus, ending in a claw */
    for (let i = 0; i < 3; i++) { const p = lerp(hip, knee, 0.3 + i * 0.25); g.fill(tube([p, [p[0] + (r() - 0.5) * sc * 0.05, p[1] - sc * 0.03] as P], sc * 0.005, sc * 0.002, false), FUR_D, 0.5); }
  });
};
