// ACT 2, RISOGRAPH. The same creature, built a completely different way: no ruling pen, no
// section lines, no drafting furniture. Three spot inks on cream stock, each laid by its own
// drum pass. Volume is a halftone SCREEN whose dots change size with a tone function, edges are
// torn rather than ruled, and the plates never quite register, which is the charm of the machine.
//
// BLUE plate   = the machine: body segments, head, wing ribs, rivets, the key, the imprint.
// PINK plate   = the wings as screen gradients, the going train through the body, antennae, eyes.
// YELLOW plate = the sun behind it, and the lit side of the body. Overprints multiply.
import { Ctx, Gfx, P, oval, rng, tube } from "../core";
import { letter } from "../drafting";
import { INK, PAPER, cut, screen, smooth } from "../riso";
import { CX, CY, HEAD, K, KC, THORAX, Wing, cen, lerp } from "./geom";
import { Train } from "./parts";
import { inside } from "../riso";

const BLUE = INK.blue, PINK = INK.pink, YELLOW = INK.yellow;
export const SUN: [number, number, number] = [700, 290, 210]; // upper right, behind it, and it agrees with the finale's sun

// each abdominal segment is its own printed shape, with paper showing in the joints; `flex`
// is the ripple that runs down the body when it wakes
const seg = (i: number, flex = 0): P[] => { const segs = 7, y0 = 70, y1 = 238, hw = (t: number) => 23 * (1 - t) ** 0.8 + 6.5, t0 = i / segs, t1 = (i + 1) / segs, g = 2.4, s = 1 + flex * 0.16, dy = flex * 5; /* FABLE review: 0.06 and 2.2 were invisible at viewing size, the wake second read as a still */
  return [[-hw(t0) * s + g, y0 + (y1 - y0) * t0 + g + dy], [hw(t0) * s - g, y0 + (y1 - y0) * t0 + g + dy], [hw(t1) * s - g, y0 + (y1 - y0) * t1 - g + dy], [-hw(t1) * s + g, y0 + (y1 - y0) * t1 - g + dy]].map(([x, y]) => [CX + x * K, CY + y * K] as P); };
const gearDisc = (cx: number, cy: number, r: number, teeth: number, ph: number, seed: number): P[] => { const rn = rng(seed), out: P[] = []; for (let i = 0; i < teeth * 2; i++) { const a = ph + (i / (teeth * 2)) * Math.PI * 2, rr = (i % 2 ? r * 0.82 : r) * (0.985 + rn() * 0.03); out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return out; };
const BODY: P[] = (() => { const segs = 7, y0 = 70, y1 = 238, hw = (t: number) => 23 * (1 - t) ** 0.8 + 6.5, L: P[] = [], R: P[] = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14, y = y0 + (y1 - y0) * t; L.push([CX - hw(t) * K, CY + y * K]); R.push([CX + hw(t) * K, CY + y * K]); }
  return [...THORAX.slice(0, 7), ...R, ...L.reverse(), ...THORAX.slice(7)]; })();
const antenna = (sd: number, q: number): P[] => { const a0: P = [CX + sd * 8 * K, CY - 127 * K], c = Math.cos(sd * q), s = Math.sin(sd * q), R = (p: P): P => [a0[0] + (p[0] - a0[0]) * c - (p[1] - a0[1]) * s, a0[1] + (p[0] - a0[0]) * s + (p[1] - a0[1]) * c];
  const a1 = R([CX + sd * 56 * K, CY - 206 * K]), a2 = R([CX + sd * 124 * K, CY - 246 * K]);
  return Array.from({ length: 9 }, (_, i) => { const t = i / 8; return lerp(lerp(a0, a1, t), lerp(a1, a2, t), t); }); };

export type BlueS = { key: number; flex: number[]; imprint: number };
export const bluePlate = (g: Gfx, w: Wing[], s: BlueS) => {
  const c = g.cur, fill = (pts: P[], col = BLUE, a = 1) => { g.mark(pts, 3); c.globalAlpha = a; c.fillStyle = col; g.path(c, pts); c.fill(); c.globalAlpha = 1; };
  w.forEach((wg) => { /* the wing frame: three ribs carry it, and they stay inside the membrane */
    const n = wg.ends.length, inset = smooth(wg.out.map((p) => lerp(p, cen(wg.out), 0.045))), ribs = [0, Math.max(1, (n - 1) >> 1), n - 2].filter((v, i, a) => a.indexOf(v) === i);
    c.save(); g.path(c, inset); c.clip();
    ribs.forEach((j, r) => { const a0 = r === 0 ? 0.04 : 0.1, a1 = r === 0 ? 0.95 : 0.82, line = Array.from({ length: 7 }, (_, q) => wg.spar(j, a0 + (q / 6) * (a1 - a0))); fill(cut(tube(line, r === 0 ? 6.5 : 5, 1.5))); });
    ribs.forEach((j, r) => { for (let q = 1; q <= (r === 0 ? 4 : 2); q++) { const t = r === 0 ? 0.16 + q * 0.19 : 0.3 + q * 0.2, p = wg.spar(j, t); fill(oval(p[0], p[1], r === 0 ? 3.6 : 2.8, r === 0 ? 3.6 : 2.8, 9), PAPER); } }); /* rivets are holes in the ink: riso cannot print white, it leaves the sheet */
    c.restore();
    fill(cut(oval(wg.h[0], wg.h[1], 13, 13, 12))); fill(oval(wg.h[0], wg.h[1], 4.5, 4.5, 9), PAPER);
  });
  for (let i = 0; i < 7; i++) fill(cut(seg(i, s.flex[i] ?? 0)));
  fill(cut(THORAX.map((p) => lerp(p, cen(THORAX), -0.06))));
  fill(cut(HEAD.map((p) => lerp(p, cen(HEAD), -0.08))));
  const sp: P = [CX, CY + 244 * K], sq: P = [CX, CY + 272 * K]; fill(cut(tube([sp, sq], 5, 5)));
  const dy = -38 * s.key; fill(cut(tube([[KC[0], KC[1] - 36 + dy], [KC[0], KC[1] + dy]], 4.6, 4.6))); [-1, 1].forEach((sd) => { fill(cut(oval(KC[0] + sd * 21, KC[1] + 3 + dy, 16, 21, 12))); fill(oval(KC[0] + sd * 21, KC[1] + 3 + dy, 7, 10, 10), PAPER); });
  if (s.imprint > 0) { letter(g, "MECHANICAL LEPIDOPTERA", 92, 966, { cap: 15, seed: 900, color: BLUE, w: 2.2, opacity: 0.92, progress: Math.min(1, s.imprint * 1.6) }); letter(g, "PLATE II - RISOGRAPH, THREE PASSES ON CREAM", 92, 992, { cap: 8.4, seed: 901, color: BLUE, w: 1.1, opacity: 0.8, progress: Math.max(0, s.imprint * 1.6 - 0.6) }); }
  c.save(); g.path(c, smooth(BODY)); c.clip(); /* the shadow lives INSIDE the body, or it is a smear */
  screen(g, { x0: CX - 70, y0: CY - 150, x1: CX + 70, y1: CY + 250 }, 5.2, 22, (x, y) => 0.9 * Math.max(0, (CX + 4 - x) / 34) * Math.max(0, 1 - Math.abs(y - CY - 30) / 260), BLUE); /* the sun is upper right, so the body's shadow side is to port */
  c.restore();
};

export type PinkS = { train: Train; wheels: number; panel2: number; quiver: [number, number]; proboscis: number; vel: number[] };
export const pinkPlate = (g: Gfx, w: Wing[], s: PinkS) => {
  const c = g.cur, fill = (pts: P[], col = PINK, a = 1) => { g.mark(pts, 3); c.globalAlpha = a; c.fillStyle = col; g.path(c, pts); c.fill(); c.globalAlpha = 1; };
  w.forEach((wg, i) => {
    const b = { x0: Math.min(...wg.out.map((p) => p[0])) - 6, y0: Math.min(...wg.out.map((p) => p[1])) - 6, x1: Math.max(...wg.out.map((p) => p[0])) + 6, y1: Math.max(...wg.out.map((p) => p[1])) + 6 };
    const R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) * 0.66, spars = wg.ends.map((_, j) => Array.from({ length: 7 }, (_, q) => wg.spar(j, q / 6)));
    const near = (x: number, y: number) => { let d = 1e9; for (const line of spars) for (const p of line) { const q = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y); if (q < d) d = q; } return Math.sqrt(d); };
    const swell = 1 + Math.min(0.55, (s.vel[i] ?? 0) * 3.2); /* dots SWELL with wing velocity: the riso answer to a smear frame */
    const hole = i === 3 && s.panel2 < 1 ? wg.panels[2] : null; /* panel 2 does not print with this pass */
    screen(g, b, 5.6, i < 2 ? 75 : 15, (x, y) => { if (hole && inside(hole, x, y)) return 0; const t = Math.min(1, Math.hypot(x - wg.h[0], y - wg.h[1]) / R), lead = Math.min(1, Math.max(0, (near(x, y) - 6) / 26)); return Math.min(1, (1 - t * 0.97) ** 1.25 * 1.15 * swell) * (0.4 + 0.6 * lead); }, PINK, smooth(wg.out));
    fill(cut(tube([...wg.out, wg.out[0]], 5.5, 5.5, false))); /* the margin: one heavy printed band */
    if (hole) { c.save(); c.globalCompositeOperation = "destination-out"; g.path(c, smooth(hole.map((q) => lerp(q, cen(hole), -0.06)))); c.fill(); c.globalCompositeOperation = "source-over"; c.restore(); } /* the sheet shows through where panel 2 has not printed yet */
    if (i === 3 && s.panel2 > 0) { const pn = wg.panels[2], pb = { x0: Math.min(...pn.map((p) => p[0])) - 4, y0: Math.min(...pn.map((p) => p[1])) - 4, x1: Math.max(...pn.map((p) => p[0])) + 4, y1: Math.max(...pn.map((p) => p[1])) + 4 };
      c.save(); g.path(c, smooth(pn)); c.clip(); screen(g, pb, 5.6, 15, (x, y) => 0.8 * s.panel2 * Math.min(1, Math.max(0, (near(x, y) - 6) / 22)), PINK); c.restore(); fill(cut(tube([...pn, pn[0]], 3.4, 3.4, false)), PINK, s.panel2); } /* it prints alone, a beat late, with no blue under it */
  });
  c.save(); c.globalCompositeOperation = "destination-out"; g.path(c, smooth(BODY)); c.fill(); g.path(c, smooth(HEAD)); c.fill(); c.globalCompositeOperation = "source-over"; c.restore(); /* knock the body out of the wing screens so the inks stay clean */
  if (s.wheels > 0) { const o = cen(THORAX), t = s.train; /* the going train printed straight through the body: two inks, so you can see inside the machine */
    ([[o[0] + 1, o[1] + 10, 27, 14, 0.2 + t.centre], [o[0] - 19, o[1] - 34, 16, 10, 0.5 + t.third], [o[0] + 22, o[1] - 24, 11, 8, 0.1 + t.pinion]] as number[][]).forEach(([x, y, r, teeth, ph], i) => { const q = Math.min(1, Math.max(0, s.wheels * 3 - i)); if (q <= 0) return; fill(gearDisc(x, y, r * q, teeth, ph, 700 + i)); fill(oval(x, y, r * q * 0.3, r * q * 0.3, 10), PAPER); fill(oval(x, y, r * q * 0.1, r * q * 0.1, 8)); }); }
  [-1, 1].forEach((sd, i) => { const a = antenna(sd, s.quiver[i]); fill(cut(tube(a, 3.6, 1.6))); fill(cut(oval(a[8][0], a[8][1], 9, 9, 10))); });
  if (s.proboscis > 0) { const pr: P = [CX, CY - 150 * K], turns = 3.2 - s.proboscis * 1.4, pts: P[] = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = 1.4 + t * turns * Math.PI * 2, rr = 1.5 + 10 * t * (1 + s.proboscis * 0.6); pts.push([pr[0] + Math.cos(a) * rr, pr[1] + Math.sin(a) * rr * 0.97]); } fill(cut(tube(pts, 2.6, 1.4, false))); } /* the hairspring uncoils to taste the air */
  [-1, 1].forEach((sd) => { fill(cut(oval(CX + sd * 17 * K, CY - 112 * K, 8, 10.5, 10))); fill(oval(CX + sd * 17 * K, CY - 113 * K, 3.4, 4.2, 9), PAPER); });
};

export const yellowPlate = (g: Gfx, w: Wing[], s: { sun: number; lit: number }) => {
  const c = g.cur, fill = (pts: P[], a = 1) => { g.mark(pts, 3); c.globalAlpha = a; c.fillStyle = YELLOW; g.path(c, pts); c.fill(); c.globalAlpha = 1; };
  if (s.sun > 0) { const [sx, sy, sr] = SUN, r = sr * (0.35 + 0.65 * s.sun); fill(cut(oval(sx, sy, r, r, 22)), 0.78); c.globalCompositeOperation = "destination-out"; c.fillStyle = "#000"; [smooth(BODY), smooth(HEAD)].forEach((k) => { g.path(c, k); c.fill(); }); c.globalCompositeOperation = "source-over"; } /* hand-cut sun disc, behind the creature, transparent ink so it prints last and reads first. FABLE review: the disc is KNOCKED OUT under the body, or blue x yellow turns the whole machine green and the pink train goes black */
  if (s.lit <= 0) return;
  c.save(); g.path(c, smooth(BODY)); c.clip();
  screen(g, { x0: CX - 70, y0: CY - 160, x1: CX + 70, y1: CY + 250 }, 5.2, 68, (x, y) => s.lit * 0.85 * Math.max(0, 1 - Math.abs(x - (CX + 14)) / 15) * Math.max(0, 1 - Math.abs(y - CY - 20) / 250), YELLOW); /* the sun is upper right, so the lit edge is a band, and the body stays the machine's colour */
  c.restore();
  c.save(); g.path(c, smooth(HEAD)); c.clip(); screen(g, { x0: CX - 40, y0: CY - 140, x1: CX + 40, y1: CY - 80 }, 5, 68, (x) => s.lit * 0.8 * Math.max(0, 1 - Math.abs(x - (CX + 12)) / 13), YELLOW); c.restore();
};

export const stock = (g: Gfx, W: number, H: number) => { const c = g.main, e = g.env, dw = Math.round(W * e.scale), dh = Math.round(H * e.scale); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = PAPER; c.fillRect(0, 0, dw, dh); c.restore(); g.paper("coldpress", 0.3); };
export const marks = (g: Gfx, W: number, H: number, p: number, bars: number) => {
  if (p > 0) g.group("plain", () => { const c = g.cur, n = 4; g.touch(0, 0, W, H); c.strokeStyle = "#2a2a2a"; c.lineWidth = 1.1; [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]].forEach(([x, y], i) => { if (p * n < i) return; const q = Math.min(1, p * n - i); c.beginPath(); c.arc(x, y, 7 * q, 0, Math.PI * 2); c.moveTo(x - 13 * q, y); c.lineTo(x + 13 * q, y); c.moveTo(x, y - 13 * q); c.lineTo(x, y + 13 * q); c.stroke(); }); }, { alpha: 0.85 });
  [BLUE, PINK, YELLOW].forEach((col, i) => { const q = Math.min(1, Math.max(0, bars * 3 - i)); if (q <= 0) return; g.group("plain", () => { const c = g.cur, x = W / 2 - 52 + i * 36, y = H - 42; g.touch(x, y, x + 28, y + 16); c.fillStyle = col; c.fillRect(x, y, 28 * q, 16); }, { blend: "multiply", textures: ["risoSpeck"] }); });
};
export const grain = (g: Gfx) => { g.paper("paper", 0.3); g.paper("coldpress", 0.18); };
// the drum sweeps the sheet: everything above the roller line has been printed
export const rollerPath = (c: Ctx, W: number, H: number, r: number) => { const y = -50 + r * (H + 100); c.beginPath(); c.moveTo(-10, -10); c.lineTo(W + 10, -10); c.lineTo(W + 10, y); for (let x = W + 10; x >= -10; x -= 30) c.lineTo(x, y + Math.sin(x * 0.021 + 1.3) * 3.5 + Math.sin(x * 0.006) * 2.5); c.closePath(); return y; };
export const wetEdge = (c: Ctx, W: number, H: number, r: number, col: string) => { if (r <= 0 || r >= 1) return; const y = -50 + r * (H + 100); c.save(); c.globalAlpha = 0.5; c.strokeStyle = col; c.lineWidth = 6; c.beginPath(); for (let x = -10; x <= W + 10; x += 30) { const yy = y + Math.sin(x * 0.021 + 1.3) * 3.5 + Math.sin(x * 0.006) * 2.5; x === -10 ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.stroke(); c.restore(); }; /* the ink is still wet at the roller line */
