// ACT 3, EDITORIAL CUTAWAY. The fourth construction: a page from a technical magazine. One
// confident thick-thin contour, flat limited colour laid with a swipe, paper cut faces with a
// hard section edge, and ONE accent, vermilion, on every part that MOVES and on nothing else.
// Force arrows and the travelling pulse are in the riso yellow, so the colour carries over.
import { Ctx, Gfx, P, arc, oval, rng, tube } from "../core";
import { letter, width } from "../drafting";
import { CX, CY, HEAD, K, THORAX, Wing, cen, lerp } from "./geom";
import { ARBOR, RC, armEnd, bellAngle, crankPin, outEnd, pivot } from "./linkage";
import { Train } from "./parts";

export const PAGE = "#f6f1e7", INK = "#2b2a28", HOUSE = "#8ca0a2", HOUSE2 = "#7a9092", FACE = "#e7e0d2", ACCENT = "#e2452b", PULSE = "#f2b705";
const swipeClip = (c: Ctx, g: Gfx, pts: P[], t: number, axis: "x" | "y" = "x") => { /* flat colour is LAID along the shape's long axis, never faded up */
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs) - 6, x1 = Math.max(...xs) + 6, y0 = Math.min(...ys) - 6, y1 = Math.max(...ys) + 6;
  c.beginPath(); if (axis === "x") c.rect(x0, y0, (x1 - x0) * t, y1 - y0); else c.rect(x0, y0, x1 - x0, (y1 - y0) * t); c.clip(); g.touch(x0, y0, x1, y1);
};
const flat = (g: Gfx, pts: P[], col: string, t = 1, axis: "x" | "y" = "x", alpha = 1) => { if (t <= 0) return; const c = g.cur; c.save(); swipeClip(c, g, pts, t, axis); c.globalAlpha = alpha; c.fillStyle = col; g.path(c, pts); c.fill(); c.restore(); };
// one brush-pen contour: thick where the form turns away from the light, thin on the lit side
export const contour = (g: Gfx, pts: P[], w0: number, w1: number, seed: number, t = 1, col = INK) => { if (t <= 0) return; const n = Math.max(2, Math.round(pts.length * Math.min(1, t))), s = pts.slice(0, n); if (s.length < 2) return; g.fill(tube(s, w0, w1, false), col, 0.96); };
export const hatchFace = (g: Gfx, pts: P[], seed: number, t = 1) => { /* a cut face is paper, with sparse section lines so it reads as CUT and not as a hole */
  if (t <= 0) return; const c = g.cur, r = rng(seed), b = { x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) };
  c.save(); g.path(c, pts); c.clip(); g.touch(b.x0, b.y0, b.x1, b.y1);
  c.strokeStyle = INK; c.globalAlpha = 0.33; c.lineWidth = 1.1; const span = b.x1 - b.x0 + (b.y1 - b.y0), n = Math.floor((span / 13) * t);
  for (let i = 0; i < n; i++) { const o = b.x0 - (b.y1 - b.y0) + i * 13 + r() * 2; c.beginPath(); c.moveTo(o, b.y1 + 4); c.lineTo(o + (b.y1 - b.y0) + 8, b.y0 - 4); c.stroke(); }
  c.globalAlpha = 1; c.restore();
};
export const page = (g: Gfx, W: number, H: number) => { const c = g.main, e = g.env, dw = Math.round(W * e.scale), dh = Math.round(H * e.scale); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = PAGE; c.fillRect(0, 0, dw, dh); c.restore(); g.paper("paper", 0.1); };

// ---------------------------------------------------------------- the creature, in section
export type A3 = { th: number; shell: number; faces: number; accent: number; wings: number; lift: P; bleed: number; ghostRod: number; arc: number; ghostSpar: number };
export const creature = (g: Gfx, w: Wing[], s: A3) => {
  const c = g.cur, acc = (i: number) => Math.min(1, Math.max(0, s.accent * 6 - i)); /* vermilion is laid part by part, in the order the force travels */
  w.forEach((wg, i) => { /* wings: flat pale colour, then the contour, then the leading spar in accent because it MOVES */
    flat(g, wg.out, "#dfe4e2", s.wings, i % 2 ? "x" : "x", 0.95);
    contour(g, [...wg.out, wg.out[0]], 3.4, 2.2, 400 + i, s.wings);
    const ribs = [0, Math.max(1, (wg.ends.length - 1) >> 1)];
    c.save(); g.path(c, wg.out); c.clip(); /* the frame belongs to the wing: never a ray across the page */
    ribs.forEach((j, r) => { const line = Array.from({ length: 7 }, (_, q) => wg.spar(j, 0.05 + (q / 6) * 0.9)), driven = r === 0 && i >= 2; g.fill(tube(line, driven ? 4.2 : 3, 1.3), driven ? ACCENT : INK, driven ? Math.max(0.15, acc(5)) : 0.85); }); /* the bell-crank drives the FOREWING leading spar: that is the part that moves */
    c.restore();
  });
  if (s.ghostSpar > 0) { const wg = w[2], gq = (t: number) => Array.from({ length: 7 }, (_, q) => wg.spar(0, 0.05 + (q / 6) * 0.9)).map((p) => [p[0], p[1] + t] as P); [-46, 0, 46].forEach((dy, i) => { if (s.ghostSpar * 3 < i) return; const pts = gq(dy); c.save(); c.setLineDash([7, 5]); c.strokeStyle = ACCENT; c.globalAlpha = 0.45; c.lineWidth = 1.6; c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; c.restore(); g.touch(pts[0][0] - 10, pts[0][1] - 10, pts[6][0] + 10, pts[6][1] + 10); }); } /* where the spar is at the top, the middle and the bottom of its stroke */
  /* body: the housing slides off up-left on two projection dashes, leaving the section open */
  const off: P = [-72 * s.shell, -58 * s.shell], shell = THORAX.map(([x, y]) => [x + off[0], y + off[1]] as P);
  if (s.shell > 0.02) [2, 8].forEach((k, i) => { const a = THORAX[k], b: P = [a[0] + off[0], a[1] + off[1]]; c.save(); c.setLineDash([6, 5]); c.strokeStyle = INK; c.globalAlpha = 0.5; c.lineWidth = 1.2; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; c.restore(); g.touch(Math.min(a[0], b[0]) - 4, Math.min(a[1], b[1]) - 4, Math.max(a[0], b[0]) + 4, Math.max(a[1], b[1]) + 4); });
  flat(g, shell, HOUSE, 1, "y"); contour(g, [...shell, shell[0]], 3.2, 2.4, 410);
  const inner = THORAX.map((p) => lerp(p, cen(THORAX), 0.1));
  flat(g, inner, FACE, s.faces, "x"); hatchFace(g, inner, 411, s.faces); contour(g, [...inner, inner[0]], 2.6, 1.8, 412, s.faces); /* the cut face, hard-edged */
  const abd: P[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10, y = 70 + 168 * t, hw = 23 * (1 - t) ** 0.8 + 6.5; abd.push([CX + hw * K, CY + y * K]); }
  for (let i = 10; i >= 0; i--) { const t = i / 10, y = 70 + 168 * t, hw = 23 * (1 - t) ** 0.8 + 6.5; abd.push([CX - hw * K, CY + y * K]); }
  flat(g, abd, HOUSE2, 1, "y"); contour(g, [...abd, abd[0]], 3, 2.2, 413);
  flat(g, HEAD, HOUSE, 1, "x"); contour(g, [...HEAD, HEAD[0]], 3, 2.2, 414);
};

// ---------------------------------------------------------------- the mechanism, all of it true
export const mechanism = (g: Gfx, s: A3, t: Train, show: number) => {
  if (show <= 0) return;
  const c = g.cur, acc = (i: number) => Math.min(1, Math.max(0, s.accent * 6 - i));
  const wheel = (cx: number, cy: number, r: number, teeth: number, ph: number, seed: number, a: number) => { if (a <= 0) return; const pts: P[] = []; for (let i = 0; i < teeth * 2; i++) { const an = ph + (i / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.84 : r; pts.push([cx + Math.cos(an) * rr, cy + Math.sin(an) * rr]); } g.fill(pts, ACCENT, a); g.fill(oval(cx, cy, r * 0.68, r * 0.68, 14), PAGE, a); g.fill(tube([...oval(cx, cy, r * 0.68, r * 0.68, 14), [cx + r * 0.68, cy]], 1.5, 1.5, false), INK, a * 0.8); for (let k = 0; k < 4; k++) { const an = ph + (k / 4) * Math.PI * 2; g.fill(tube([[cx + Math.cos(an) * r * 0.12, cy + Math.sin(an) * r * 0.12], [cx + Math.cos(an) * r * 0.64, cy + Math.sin(an) * r * 0.64]], 2.4, 1.8), ACCENT, a); } g.fill(oval(cx, cy, r * 0.13, r * 0.13, 9), INK, a); }; /* a wheel is a rim, a web and four spokes, not a red disc */
  const br: P = [ARBOR[0] - 44, ARBOR[1] - 10];
  g.fill(oval(br[0], br[1], 26, 26, 18), ACCENT, acc(0) * 0.92); g.fill(oval(br[0], br[1], 21, 21, 16), PAGE, acc(0)); /* mainspring barrel */
  { const pts: P[] = []; for (let i = 0; i <= 56; i++) { const q = i / 56, a = 0.6 - t.centre * 0.25 + q * 4.2 * Math.PI * 2, rr = 3 + 17 * q; pts.push([br[0] + Math.cos(a) * rr, br[1] + Math.sin(a) * rr]); } g.fill(tube(pts, 1.9, 1.3, false), ACCENT, acc(0)); }
  wheel(ARBOR[0], ARBOR[1], 25, 16, 0.2 + t.centre, 420, acc(1)); /* centre wheel */
  wheel(ARBOR[0] + 34, ARBOR[1] - 30, 13, 10, 0.5 + t.third, 421, acc(1) * 0.9);
  wheel(ARBOR[0] + 52, ARBOR[1] + 4, 10, 8, 0.1 + t.pinion, 422, acc(1) * 0.9); /* escapement end of the train */
  const P0 = crankPin(s.th);
  g.fill(tube([ARBOR, P0], 3.6, 3.6), ACCENT, acc(2)); g.fill(oval(P0[0], P0[1], 4.6, 4.6, 10), ACCENT, acc(2)); /* the crank */
  [-1, 1].forEach((side) => {
    const Q = pivot(side), R = armEnd(side, s.th), S = outEnd(side, s.th), i = side < 0 ? 4 : 5;
    if (s.ghostRod > 0 && side < 0) [0, Math.PI / 2, Math.PI].forEach((ph, k) => { if (s.ghostRod * 3 < k) return; const gp = crankPin(ph), gr = armEnd(side, ph); c.save(); c.setLineDash([6, 4]); c.strokeStyle = ACCENT; c.globalAlpha = 0.4; c.lineWidth = 1.5; c.beginPath(); c.moveTo(gp[0], gp[1]); c.lineTo(gr[0], gr[1]); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; c.restore(); g.touch(Math.min(gp[0], gr[0]) - 6, Math.min(gp[1], gr[1]) - 6, Math.max(gp[0], gr[0]) + 6, Math.max(gp[1], gr[1]) + 6); }); /* onion skin: the rod at three crank angles */
    g.fill(tube([P0, R], 3.2, 3.2), ACCENT, acc(3)); /* connecting rod */
    g.fill(tube([R, Q, S], 4.2, 4.2), ACCENT, acc(i)); g.fill(oval(Q[0], Q[1], 4.2, 4.2, 10), PAGE, acc(i)); /* bell-crank, pivot left as paper */
  });
  if (s.arc > 0) { const Q = pivot(-1), a0 = bellAngle(-1, 0), a1 = bellAngle(-1, Math.PI), pts = arc(Q[0], Q[1], 54, 54, a0, a0 + (a1 - a0) * s.arc, 12); g.fill(tube(pts, 1.8, 1.8, false), PULSE, 0.9); for (let i = 0; i <= 4; i++) { const a = a0 + (a1 - a0) * s.arc * (i / 4), p: P = [Q[0] + Math.cos(a) * 54, Q[1] + Math.sin(a) * 54], q: P = [Q[0] + Math.cos(a) * 61, Q[1] + Math.sin(a) * 61]; g.fill(tube([p, q], 1.5, 1.5), PULSE, 0.9); } } /* the stroke, measured */
};

// the pulse hops along the train, one wheel per tick: the force, made visible
export const pulse = (g: Gfx, s: { at: number; on: number }) => {
  if (s.on <= 0) return;
  const stops: P[] = [[ARBOR[0] - 44, ARBOR[1] - 10], ARBOR, crankPin(0), [ARBOR[0] + 34, ARBOR[1] - 30]];
  const i = Math.floor(s.at) % stops.length, j = (i + 1) % stops.length, f = s.at - Math.floor(s.at), p = lerp(stops[i], stops[j], f * f * (3 - 2 * f));
  g.fill(oval(p[0], p[1], 7.5, 7.5, 12), PULSE, 0.95 * s.on); g.fill(oval(p[0], p[1], 3.4, 3.4, 10), "#fff6d8", 0.9 * s.on);
};

// ---------------------------------------------------------------- the annotation
export type Label = { n: string; text: string; at: P; to: P; p: number };
export const labels = (g: Gfx, ls: Label[]) => ls.forEach((l, i) => {
  if (l.p <= 0) return;
  const q = (k: number) => Math.min(1, Math.max(0, l.p * 3 - k)), x0 = l.at[0];
  g.fill(oval(x0 - 11, l.at[1] - 4, 8.6, 8.6, 12), ACCENT, q(0)); letter(g, l.n, x0 - 11, l.at[1] - 0.4, { cap: 8.4, align: "center", seed: 470 + i, color: PAGE, w: 1.3, progress: q(0) });
  letter(g, l.text, x0 + 2, l.at[1] - 4.5, { cap: 9.5, seed: 480 + i, color: INK, w: 1.25, progress: q(1) });
  const a: P = [x0 + 2, l.at[1] + 5], b = l.to, t = q(2); if (t <= 0) return;
  g.fill(tube([a, lerp(a, b, t)], 1.1, 1.1), INK, 0.7); if (t >= 1) g.fill([b, [b[0] - 7, b[1] - 3], [b[0] - 6, b[1]], [b[0] - 7, b[1] + 3]], INK, 0.8);
});
export const caption = (g: Gfx, text: string, v: { cx: number; cy: number; zoom: number }, p: number) => { if (p <= 0) return; letter(g, text, v.cx, v.cy + 430 / v.zoom, { cap: 19 / v.zoom, align: "center", seed: 495, color: INK, w: 2.4 / v.zoom, progress: p }); }; /* written across the foot of the FRAME, at whatever zoom the camera is */
// a force arrow in the riso yellow: where the push goes next
export const force = (g: Gfx, a: P, b: P, p: number) => { if (p <= 0) return; const e = lerp(a, b, p), d = Math.atan2(e[1] - a[1], e[0] - a[0]); g.fill(tube([a, e], 3.4, 3.4), PULSE, 0.9); if (p >= 1) g.fill([b, [b[0] - Math.cos(d - 0.4) * 15, b[1] - Math.sin(d - 0.4) * 15], [b[0] - Math.cos(d) * 11, b[1] - Math.sin(d) * 11], [b[0] - Math.cos(d + 0.4) * 15, b[1] - Math.sin(d + 0.4) * 15]], PULSE, 0.95); };
// the explainer's one intervention: panel 2, pressed home, in an inset
export const inset = (g: Gfx, wg: Wing, p: number, seat: number, v: { cx: number; cy: number; zoom: number }) => {
  if (p <= 0) return;
  const c = g.cur, C: P = [v.cx + 330 / v.zoom, v.cy - 330 / v.zoom], R = (90 * Math.min(1, p * 1.4)) / v.zoom;
  g.fill(oval(C[0], C[1], R, R, 22), PAGE, 1); g.fill(tube([...oval(C[0], C[1], R, R, 22), [C[0] + R, C[1]]], 2.6 / v.zoom, 2.6 / v.zoom, false), INK, 0.9);
  if (p < 0.5) return;
  const pn = wg.panels[2], pc = cen(pn), k = R / 150, T = (q: P): P => [C[0] + (q[0] - pc[0]) * k, C[1] + (q[1] - pc[1]) * k];
  c.save(); g.path(c, oval(C[0], C[1], R - 3, R - 3, 22)); c.clip();
  const lift = 1 - seat, up = pn.map(([x, y]) => T([x + 58 * lift, y - 60 * lift]));
  if (lift > 0.02) [0, 2, 4, 6].forEach((j) => { const a = T(pn[j]), b = up[j]; c.save(); c.setLineDash([5, 4]); c.strokeStyle = ACCENT; c.globalAlpha = 0.6; c.lineWidth = 1.3; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; c.restore(); });
  g.fill(up, "#dfe4e2", 0.95); g.fill(tube([...up, up[0]], 2.2 / v.zoom, 2.2 / v.zoom, false), ACCENT, 0.9);
  c.restore(); g.touch(C[0] - R - 6, C[1] - R - 6, C[0] + R + 6, C[1] + R + 6);
};
export const cutLine = (g: Gfx, p: number) => { /* the dashed cut, struck across the body with a scissor mark */
  if (p <= 0) return; const c = g.cur, y = CY - 40, x0 = CX - 210, x1 = CX + 210, x = x0 + (x1 - x0) * p;
  c.save(); c.setLineDash([12, 7]); c.strokeStyle = INK; c.lineWidth = 1.8; c.globalAlpha = 0.8; c.beginPath(); c.moveTo(x0, y); c.lineTo(x, y); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; c.restore(); g.touch(x0 - 6, y - 22, x1 + 6, y + 22);
  const sx = x; g.fill(tube([[sx - 9, y - 7], [sx + 7, y + 5]], 1.8, 1.8), INK, 0.9); g.fill(tube([[sx - 9, y + 7], [sx + 7, y - 5]], 1.8, 1.8), INK, 0.9); g.fill(oval(sx - 11, y - 9, 3.4, 3.4, 9), INK, 0.9); g.fill(oval(sx - 11, y + 9, 3.4, 3.4, 9), INK, 0.9);
};
// the accent starts to run wet at its edges: the watercolour arriving
export const bleed = (g: Gfx, w: Wing[], s: A3) => {
  if (s.bleed <= 0) return;
  const c = g.cur, r = 6 * s.bleed;
  [-1, 1].forEach((side) => { const Q = pivot(side), R = armEnd(side, s.th); c.globalAlpha = 0.3 * s.bleed; g.fill(tube([crankPin(s.th), R], 3.2 + r, 3.2 + r), ACCENT, 0.3 * s.bleed); g.fill(oval(Q[0], Q[1], 10 + r, 10 + r, 12), ACCENT, 0.22 * s.bleed); c.globalAlpha = 1; });
  g.fill(oval(ARBOR[0], ARBOR[1], 27 + r, 27 + r, 18), ACCENT, 0.2 * s.bleed);
};
