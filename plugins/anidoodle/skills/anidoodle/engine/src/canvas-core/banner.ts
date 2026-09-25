import { Gfx, halftone, oval, rng, softBox, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { letter } from "./drafting";
import { blob, clipped, fillShape, hatchRuns, inside, lerpP, mix, smooth, trace } from "./gallery";
import { DOT, TAIL, WORD, inkStroke, outlineOf, place, type Nib } from "./lettering";

// ANIDOODLE · the working table. A wide top-down view of a designer's desk mid-session: graph
// paper, scraps and the bare table top all drawn on, tools dropped where they were last used,
// ink flicked about. The texture is GEOMETRY done by hand: compass rosettes, a golden spiral, a
// wireframe cube, triangles off a protractor, hatching, and the doodles a hand makes while it
// thinks (stars, arrows, squiggles, spirals, little faces). Code is one more doodle among them:
// braces, a short function, a Bezier with its handles on a torn scrap.
//
// It is almost all LINE: black fineliner, blue ballpoint, graphite. Colour appears three times
// only (a marker swatch, a riso patch, one red star), so the eye has somewhere to land.
//
// The name is the one clean thing on the table: a card with the letterer's pencil guides still
// on it, and "anidoodle" written over them in pointed-pen copperplate.

const W = 2000, H = 620, PAPER = "#f4efe6", IRON = "#2a1c14", SHADOW = "#5f4e3c";
const INK = "#221d1a", BLUE = "#2b3f8e", LEAD = "#6d6762", CARD = "#fbf8f1";
const FINE: Medium = { nib: 1, taper: 0.55, pressure: 0.7, retrace: false, wobble: 0.9, rough: 0.5 };
const NIB: Nib = { em: 88, slant: 0.3, origin: [614, 352], hair: 0.9, shade: 7 };
const LIGHT: P = [-3, -4], REST: P = [1402, 452];

// what moves. FINISHED is the approved still, exactly: every live element at progress 1, fade 1,
// the pen at rest, no glint, no ripple.
export type State = { write: number; glint: number; glintT: number; nibAt: P | null; nibAng: number; doodles: number[]; curve: number; arrows: [number, number]; ripple: number; fade: number; idle: number };
export const FINISHED: State = { write: 1, glint: 0, glintT: 0, nibAt: null, nibAng: -2.7, doodles: [1, 1, 1, 1], curve: 1, arrows: [1, 1], ripple: -1, fade: 1, idle: 211 };

// ---------------------------------------------------------------- the pen kit
const at = (o: P, deg: number, pts: P[]): P[] => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [o[0] + x * c - y * s, o[1] + x * s + y * c]); };
type Line = { w?: number; c?: string; op?: number; seed?: number; closed?: boolean; wob?: number };
let SEED = 1;
// a LIVE line draws itself in (LIVE.p = how much of it is down) and fades with the loop
const LIVE: { p?: number; fade: number } = { fade: 1 };
const live = (p: number, fn: () => void) => { LIVE.p = p; fn(); LIVE.p = undefined; };
// IDLE LIFE. Everything on the table moves a little, all the time, on one clock: every motion is
// a whole number of cycles per 240-frame loop (so the loop has no seam), each element's phase
// set by its own id and spaced by the golden angle (so nothing pulses in unison). Each offset is
// A * (sin(wt + phase) - sin(phase)): exactly ZERO at the rest frame, 211, where the table is
// the approved composition to the byte, and never zero all at once anywhere else.
const REST_F = 211, LOOP = 240;
let IDLE_F = REST_F;
const waveAt = (f: number, id: number, amp: number, k = 1 + (id % 2)) => { const ph = id * 2.39996323, a = (2 * Math.PI * k * (f - REST_F)) / LOOP; return amp * (Math.sin(a + ph) - Math.sin(ph)); };
const wave = (id: number, amp: number, k = 1 + (id % 2)) => waveAt(IDLE_F, id, amp, k);
// where the dip pen lies at frame f: it settles a hair too, and every flight lands exactly there
const restAt = (f: number): P => [REST[0] + waveAt(f, 481, 0.7, 1), REST[1] + waveAt(f, 482, 0.7, 1)];
const restAng = (f: number) => -2.7 + waveAt(f, 483, 0.004, 1);
// a point transform (rotate + scale about a centre, then shift), or null when it is the identity:
// cx + (x - cx) is not always exactly x in floating point, and the rest frame must be exact
type Tf = ((p: P) => P) | null;
const rs = (cx: number, cy: number, rot: number, sc: number, dx = 0, dy = 0): Tf => {
  if (rot === 0 && sc === 1 && dx === 0 && dy === 0) return null;
  const c = Math.cos(rot), sn = Math.sin(rot);
  return ([x, y]) => { const X = (x - cx) * sc, Y = (y - cy) * sc; return [cx + X * c - Y * sn + dx, cy + X * sn + Y * c + dy]; };
};
let IDLE_T: Tf = null;
const moving = (t: Tf, fn: () => void) => { const prev = IDLE_T; IDLE_T = t; fn(); IDLE_T = prev; };
const tfP = (t: Tf, p: P): P => (t ? t(p) : p);
// fine lines (hatching, construction, ticks, guides) shimmer: their opacity breathes a little,
// each on its own phase, so a hatched patch glints across rather than blinking as one
const ln = (g: Gfx, pts: P[], o: Line = {}) => { const seed = o.seed ?? SEED++, fine = (o.w ?? 1.1) <= 0.65; return g.pen(IDLE_T ? pts.map(IDLE_T) : pts, { progress: LIVE.p ?? 1, w: o.w ?? 1.1, color: o.c ?? INK, opacity: (o.op ?? 0.86) * (LIVE.p === undefined ? 1 : LIVE.fade) * (fine ? 1 + wave(seed * 7 + 3, 0.16) : 1), seed, closed: o.closed ?? false, wobble: o.wob ?? 0.7, boil: 0, taper: 0.6, retrace: false }); };
// straight edges: the pen smooths THROUGH its points, so a closed triangle comes out a guitar
// pick. A ruled shape is drawn edge by edge, each one its own stroke, as a draughtsman does.
const poly = (g: Gfx, pts: P[], o: Line = {}) => pts.forEach((a, i) => ln(g, [a, pts[(i + 1) % pts.length]], { wob: 0.25, ...o }));
const circ = (cx: number, cy: number, r: number, n = 44): P[] => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)] as P);
const arcP = (cx: number, cy: number, r: number, a0: number, a1: number, n = 24): P[] => Array.from({ length: n }, (_, i) => { const a = a0 + ((a1 - a0) * i) / (n - 1); return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as P; });
const shadow = (g: Gfx, pts: P[], off: P = [6, 8], blur = 6, alpha = 0.22) => g.group("plain", () => fillShape(g, pts, SHADOW), { blur, alpha, off });
// a sheet on the table: slightly ragged (torn on the sides given), cast shadow, faint edge line
const sheet = (g: Gfx, o: P, deg: number, w: number, h: number, seed: number, torn: number[] = [], color = CARD) => {
  const r = rng(seed), corners: P[] = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], pts: P[] = [];
  corners.forEach((a, i) => { const b = corners[(i + 1) % 4], n = torn.includes(i) ? 26 : 10; for (let k = 0; k < n; k++) { const t = k / n, j = torn.includes(i) ? (r() - 0.5) * 7 : (r() - 0.5) * 1.2; const nx = -(b[1] - a[1]), ny = b[0] - a[0], l = Math.hypot(nx, ny); pts.push([a[0] + (b[0] - a[0]) * t + (nx / l) * j, a[1] + (b[1] - a[1]) * t + (ny / l) * j]); } });
  const outline = at(o, deg, pts);
  shadow(g, outline, [5, 7], 5, 0.2);
  g.group("plain", () => fillShape(g, outline, color));
  g.group("ink", () => ln(g, outline, { closed: true, w: 0.55, op: 0.25, c: LEAD, wob: 0.3 }));
  return outline;
};

// ---------------------------------------------------------------- doodles
const star = (cx: number, cy: number, r: number, rot = -Math.PI / 2): P[] => Array.from({ length: 10 }, (_, i) => { const a = rot + (i * Math.PI) / 5, q = i % 2 ? r * 0.42 : r; return [cx + q * Math.cos(a), cy + q * Math.sin(a)] as P; });
const squiggle = (x: number, y: number, len: number, amp: number, waves: number, deg = 0): P[] => at([x, y], deg, Array.from({ length: Math.round(waves * 8) + 1 }, (_, i) => { const t = i / (waves * 8); return [t * len, Math.sin(t * waves * Math.PI * 2) * amp] as P; }));
const loops = (x: number, y: number, len: number, r: number, n: number, deg = 0): P[] => at([x, y], deg, Array.from({ length: n * 14 + 1 }, (_, i) => { const t = i / 14, a = t * Math.PI * 2; return [t * (len / n) - Math.sin(a) * r * 0.9, -Math.cos(a) * r + r] as P; }));
const spiral = (cx: number, cy: number, r: number, turns: number): P[] => Array.from({ length: Math.round(turns * 26) }, (_, i) => { const t = i / (turns * 26), a = t * turns * Math.PI * 2; return [cx + Math.cos(a) * r * t, cy + Math.sin(a) * r * t] as P; });
const arrow = (g: Gfx, pts: P[], o: Line = {}) => {
  const s = smooth(pts, false, 10), b = s[s.length - 1], a = s[s.length - 4], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), k = 11;
  ln(g, s, o); const p = LIVE.p; if (p !== undefined) LIVE.p = p >= 1 ? 1 : 0; ln(g, [[b[0] - k * Math.cos(ang - 0.45), b[1] - k * Math.sin(ang - 0.45)], b, [b[0] - k * Math.cos(ang + 0.45), b[1] - k * Math.sin(ang + 0.45)]], o); LIVE.p = p;
};
const face = (g: Gfx, cx: number, cy: number, r: number, mood: number, o: Line = {}) => {
  ln(g, circ(cx, cy, r, 22), { ...o, closed: true });
  [[-0.35, -0.2], [0.35, -0.2]].forEach(([x, y]) => ln(g, [[cx + x * r, cy + y * r - 1], [cx + x * r + 0.5, cy + y * r + 2]], { ...o, w: (o.w ?? 1.1) * 1.3 }));
  ln(g, arcP(cx, cy + r * 0.05, r * 0.5, Math.PI * (0.2 - 0.1 * mood), Math.PI * (0.8 + 0.1 * mood), 8), o);
};
const hatchSquare = (g: Gfx, cx: number, cy: number, s: number, deg: number, cross: boolean, o: Line = {}) => {
  const sq = at([cx, cy], deg, [[-s, -s], [s, -s], [s, s], [-s, s]]); poly(g, sq, o);
  const b = { x0: cx - s * 1.5, y0: cy - s * 1.5, x1: cx + s * 1.5, y1: cy + s * 1.5 }, keep = (x: number, y: number) => inside(sq, x, y);
  hatchRuns(b, 0.8, 5, keep, 3, SEED).forEach((run) => ln(g, [run[0], run[run.length - 1]], { ...o, w: 0.6, op: 0.7, wob: 0.2 }));
  if (cross) hatchRuns(b, -0.75, 6, keep, 3, SEED + 1).forEach((run) => ln(g, [run[0], run[run.length - 1]], { ...o, w: 0.55, op: 0.6, wob: 0.2 }));
};
// a wireframe cube in two-point-ish oblique projection, the hidden edges dashed
const cube = (g: Gfx, cx: number, cy: number, s: number, o: Line = {}) => {
  const v = (x: number, y: number, z: number): P => [cx + (x - z * 0.55) * s, cy + (-y + z * 0.38 - x * 0.12) * s];
  const V = [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0), v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)];
  const seen: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 7], [2, 6], [1, 5], [7, 6], [6, 5]], hid: [number, number][] = [[0, 4], [4, 5], [4, 7]];
  seen.forEach(([a, b]) => ln(g, [V[a], V[b]], { ...o, wob: 0.35 }));
  hid.forEach(([a, b]) => { for (let t = 0; t < 1; t += 0.14) ln(g, [lerpP(V[a], V[b], t), lerpP(V[a], V[b], t + 0.07)], { ...o, w: 0.7, op: 0.6, wob: 0.1 }); });
  // the face toward the light left clean, the one away from it hatched
  const side = [V[1], V[5], V[6], V[2]]; hatchRuns({ x0: Math.min(...side.map((p) => p[0])), y0: Math.min(...side.map((p) => p[1])), x1: Math.max(...side.map((p) => p[0])), y1: Math.max(...side.map((p) => p[1])) }, 1.2, 4.5, (x, y) => inside(side, x, y), 3, 9).forEach((r) => ln(g, [r[0], r[r.length - 1]], { ...o, w: 0.55, op: 0.55, wob: 0.15 }));
  return V;
};
// the golden spiral over its whirling squares
const golden = (g: Gfx, x: number, y: number, s: number, deg: number, o: Line = {}) => {
  const phi = 1.618034, sq: P[][] = [], arcs: P[] = [];
  let bx = 0, by = 0, bw = s * phi, bh = s;
  for (let i = 0; i < 7; i++) {
    const k = i % 4; let q: [number, number, number], c: P;
    if (k === 0) { const a = bh; q = [bx, by, a]; c = [bx + a, by + a]; bx += a; bw -= a; arcs.push(...arcP(c[0], c[1], a, Math.PI, Math.PI * 1.5, 12)); }
    else if (k === 1) { const a = bw; q = [bx, by, a]; c = [bx, by + a]; by += a; bh -= a; arcs.push(...arcP(c[0], c[1], a, Math.PI * 1.5, Math.PI * 2, 12)); }
    else if (k === 2) { const a = bh; q = [bx + bw - a, by, a]; c = [bx + bw - a, by]; bw -= a; arcs.push(...arcP(c[0], c[1], a, 0, Math.PI * 0.5, 12)); }
    else { const a = bw; q = [bx, by + bh - a, a]; c = [bx + a, by + bh - a]; bh -= a; arcs.push(...arcP(c[0], c[1], a, Math.PI * 0.5, Math.PI, 12)); }
    sq.push([[q[0], q[1]], [q[0] + q[2], q[1]], [q[0] + q[2], q[1] + q[2]], [q[0], q[1] + q[2]]]);
  }
  sq.forEach((p) => poly(g, at([x, y], deg, p), { ...o, w: 0.6, op: 0.55, c: LEAD, wob: 0.15 }));
  ln(g, at([x, y], deg, arcs), { ...o, w: 1.5 });
};

// ---------------------------------------------------------------- tools
type Seg = { t0: number; t1: number; r0: number; r1: number; c: string; sh: string; facets?: boolean; round?: boolean };
const rod = (g: Gfx, a: P, b: P, segs: Seg[]) => {
  const d: P = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]), u: P = [d[0] / L, d[1] / L], nv: P = [-u[1], u[0]];
  const up = nv[0] * LIGHT[0] + nv[1] * LIGHT[1] < 0 ? -1 : 1;
  const pt = (t: number, side: number): P => [a[0] + d[0] * t + nv[0] * side, a[1] + d[1] * t + nv[1] * side];
  const outline = (sg: Seg): P[] => { const n = 16, L1: P[] = [], R1: P[] = []; for (let i = 0; i <= n; i++) { const t = sg.t0 + ((sg.t1 - sg.t0) * i) / n, f = i / n, r = sg.r0 + (sg.r1 - sg.r0) * (sg.round ? Math.sqrt(Math.sin(Math.min(1, f * 1.02) * Math.PI / 2)) : f); L1.push(pt(t, r)); R1.push(pt(t, -r)); } return [...L1, ...R1.reverse()]; };
  const all = segs.map(outline);
  shadow(g, all.flat(), [7, 9], 4, 0.26);
  g.group("paint", () => segs.forEach((sg, i) => {
    const c = g.cur, rMax = Math.max(sg.r0, sg.r1), m = pt((sg.t0 + sg.t1) / 2, 0), p0 = [m[0] + nv[0] * rMax * up, m[1] + nv[1] * rMax * up], p1 = [m[0] - nv[0] * rMax * up, m[1] - nv[1] * rMax * up];
    const gr = c.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
    if (sg.facets) { gr.addColorStop(0, mix(sg.c, "#ffffff", 0.25)); gr.addColorStop(0.3, mix(sg.c, "#ffffff", 0.25)); gr.addColorStop(0.31, sg.c); gr.addColorStop(0.69, sg.c); gr.addColorStop(0.7, sg.sh); gr.addColorStop(1, sg.sh); }
    else { gr.addColorStop(0, mix(sg.c, sg.sh, 0.35)); gr.addColorStop(0.28, mix(sg.c, "#ffffff", 0.42)); gr.addColorStop(0.5, sg.c); gr.addColorStop(1, sg.sh); }
    fillShape(g, all[i], "#000", 0); c.fillStyle = gr; trace(c, all[i]); c.fill();
  }));
  g.group("ink", () => all.forEach((o) => ln(g, o, { closed: true, w: 0.75, op: 0.45, c: "#3e352f", wob: 0.2 })));
  return pt;
};
const pencil = (g: Gfx, a: P, b: P, body: string, shade: string) => rod(g, a, b, [
  { t0: 0, t1: 0.05, r0: 6.8, r1: 6.8, c: "#e39a9a", sh: "#a8605f" }, { t0: 0.05, t1: 0.1, r0: 7.2, r1: 7.2, c: "#cdbf9c", sh: "#857657" },
  { t0: 0.1, t1: 0.86, r0: 7.2, r1: 7.2, c: body, sh: shade, facets: true }, { t0: 0.86, t1: 0.97, r0: 7.2, r1: 1.8, c: "#ecd6ad", sh: "#b89868" }, { t0: 0.97, t1: 1, r0: 1.8, r1: 0.4, c: "#4a4148", sh: "#26222a" }]);
const fineliner = (g: Gfx, a: P, b: P) => rod(g, a, b, [
  { t0: 0, t1: 0.08, r0: 7.4, r1: 7.4, c: "#3a3a3c", sh: "#141416" }, { t0: 0.08, t1: 0.82, r0: 7, r1: 7, c: "#2c2c2e", sh: "#0d0d0f" },
  { t0: 0.82, t1: 0.95, r0: 7, r1: 2.6, c: "#8d8d90", sh: "#48484b" }, { t0: 0.95, t1: 1, r0: 1, r1: 0.7, c: "#bdbdbd", sh: "#6c6c6c" }]);
const brush = (g: Gfx, a: P, b: P, handle: string, hsh: string, tip: string) => rod(g, a, b, [
  { t0: 0, t1: 0.62, r0: 3, r1: 6, c: handle, sh: hsh }, { t0: 0.62, t1: 0.8, r0: 6.4, r1: 5.8, c: "#d6d0c4", sh: "#817b72" }, { t0: 0.8, t1: 1, r0: 5.8, r1: 0.4, c: tip, sh: mix(tip, "#000000", 0.5), round: true }]);
const dipPen = (g: Gfx, tip: P, ang: number, s: State) => {
  const back: P = [tip[0] - Math.cos(ang) * 340, tip[1] - Math.sin(ang) * 340];
  const pt = rod(g, back, tip, [{ t0: 0, t1: 0.66, r0: 3.2, r1: 6, c: "#4a2f26", sh: "#1f1411" }, { t0: 0.66, t1: 0.8, r0: 6.4, r1: 5, c: "#c2a063", sh: "#7a6234" }]);
  const nib = [pt(0.8, -4.8), pt(0.87, -5), pt(0.95, -2.5), pt(1, 0), pt(0.95, 2.5), pt(0.87, 5), pt(0.8, 4.8)];
  g.group("plain", () => { const c = g.cur, gr = c.createLinearGradient(...pt(0.82, -4), ...pt(0.82, 4)); gr.addColorStop(0, "#f4f1ea"); gr.addColorStop(0.45, "#a6a098"); gr.addColorStop(1, "#5d5953"); fillShape(g, nib, "#000", 0); c.fillStyle = gr; trace(c, nib); c.fill(); });
  g.group("ink", () => { ln(g, [pt(0.9, 0), pt(1, 0)], { w: 0.5, op: 0.8, wob: 0 }); ln(g, nib, { closed: true, w: 0.55, op: 0.5, wob: 0.1 }); });
  // the breather hole and the wet tines. The box is min/max padded: the pen points either way, and a
  // blot drawn outside its marked box is never composited or cleared (it lingers in the layer pool).
  g.group("plain", () => { const c = g.cur, v = pt(0.895, 0), w = pt(0.975, 0); g.touch(Math.min(v[0], w[0]) - 6, Math.min(v[1], w[1]) - 6, Math.max(v[0], w[0]) + 6, Math.max(v[1], w[1]) + 6); c.fillStyle = "#34302a"; c.beginPath(); c.arc(v[0], v[1], 1.5, 0, Math.PI * 2); c.fill(); c.fillStyle = IRON; c.globalAlpha = 0.85; c.beginPath(); c.ellipse(w[0], w[1], 3.4, 1.7, ang, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; });
  if (s.glint > 0) g.group("plain", () => g.glow(...pt(0.62 + 0.37 * s.glintT, -1.6), 16, "#fffdf5", s.glint), { blend: "screen" });
};
// a pair of compasses lying open exactly as wide as the circle it just drew
const compass = (g: Gfx, hinge: P, needle: P, lead: P) => {
  const leg = (to: P, r0: number, r1: number) => rod(g, hinge, to, [{ t0: 0.06, t1: 0.9, r0, r1, c: "#cfcac2", sh: "#6f6a64" }, { t0: 0.9, t1: 1, r0: r1, r1: 0.5, c: "#8a867f", sh: "#3c3935" }]);
  leg(needle, 4.4, 2.6); leg(lead, 4.4, 3.2);
  const knob = at(hinge, 0, oval(0, 0, 9, 9, 16)); shadow(g, knob, [5, 7], 3, 0.25);
  g.group("paint", () => g.form(knob, "#d9d4cc", "#77726b", { seed: 30, light: LIGHT })); g.group("ink", () => ln(g, knob, { closed: true, w: 0.7, op: 0.5 }));
  g.group("plain", () => { const c = g.cur; g.touch(hinge[0] - 20, hinge[1] - 30, hinge[0] + 20, hinge[1]); c.fillStyle = "#77726b"; c.fillRect(hinge[0] - 2.5, hinge[1] - 24, 5, 16); });
};
const ruler = (g: Gfx, o: P, deg: number, len: number) => {
  const body = at(o, deg, [[0, -17], [len, -17], [len, 17], [0, 17]]);
  shadow(g, body, [6, 8], 4, 0.24);
  g.group("paint", () => { fillShape(g, body, "#e7d3a6"); const c = g.cur; c.globalAlpha = 0.25; c.fillStyle = "#b8955a"; for (let k = 0; k < 7; k++) { trace(c, at(o, deg, squiggle(0, -12 + k * 4.2, len, 1.4, 3 + k, 0))); } c.globalAlpha = 1; });
  g.group("ink", () => {
    ln(g, body, { closed: true, w: 0.8, op: 0.55, wob: 0.15 });
    for (let mm = 0; mm <= (len - 20) / 4; mm++) { const x = 10 + mm * 4, h = mm % 10 === 0 ? 11 : mm % 5 === 0 ? 8 : 5; ln(g, at(o, deg, [[x, -17], [x, -17 + h]]), { w: 0.5, op: 0.7, wob: 0 }); }
  });
  for (let cm = 0; cm * 40 + 10 < len - 20; cm += 2) { const p = at(o, deg, [[10 + cm * 40 - 3, -2]])[0]; g.push(p[0], p[1], 1); letter(g, String(cm), 0, 0, { cap: 7, color: "#3a2f26", seed: 40 + cm, opacity: 0.8, w: 0.9 }); g.pop(); }
};
const eraser = (g: Gfx, o: P, deg: number) => {
  const b = at(o, deg, softBox(0, 0, 64, 30, 6, 20)); shadow(g, b, [5, 7], 3, 0.25);
  g.group("paint", () => { g.form(b, "#f2eee6", "#b9b2a6", { seed: 50, light: LIGHT }); g.form(at(o, deg, softBox(-18, 0, 26, 30, 6, 16)), "#f0a5a0", "#b8625f", { seed: 51, light: LIGHT }); });
  g.group("ink", () => ln(g, b, { closed: true, w: 0.7, op: 0.45 }));
  const r = rng(52); g.group("plain", () => { const c = g.cur; g.touch(o[0] - 80, o[1] - 50, o[0] + 80, o[1] + 60); for (let i = 0; i < 9; i++) { const x = o[0] + 30 + r() * 50, y = o[1] + 10 + r() * 36; c.fillStyle = "#cfc6b8"; c.globalAlpha = 0.8; trace(c, blob(x, y, 3 + r() * 3, 1.6 + r() * 1.5, 53 + i, 0.3, 8, r() * 3)); c.fill(); } c.globalAlpha = 1; });
};
const paperclip = (g: Gfx, o: P, deg: number) => {
  const pts = at(o, deg, [[0, 22], [0, -20], [5, -26], [11, -20], [11, 26], [5, 32], [-2, 32], [-7, 26], [-7, -14]]);
  shadow(g, smooth(pts, false, 6).flatMap(([x, y]) => [[x - 1.5, y] as P, [x + 1.5, y] as P]), [3, 4], 2, 0.3);
  g.group("plain", () => { const c = g.cur, s = smooth(pts, false, 8); g.touch(o[0] - 40, o[1] - 40, o[0] + 40, o[1] + 40); c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#5b5a5c"; c.lineWidth = 2.6; trace(c, s, false); c.stroke(); c.strokeStyle = "#dcdcde"; c.lineWidth = 1; trace(c, s.map(([x, y]) => [x - 0.6, y - 0.6] as P), false); c.stroke(); });
};
// ink flicked off a nib: one blot, satellites thrown along the flick, a few fine dots
const splat = (g: Gfx, cx: number, cy: number, size: number, dir: number, seed: number) => {
  const r = rng(seed);
  g.group("plain", () => {
    const pulse = (i: number, a: number) => 1 + wave(seed * 31 + i, a);
    fillShape(g, blob(cx, cy, size * pulse(0, 0.04), size * 0.86 * pulse(0, 0.04), seed, 0.28, 22), IRON, 0.92);
    for (let i = 0; i < 12; i++) { const d = size * (1.2 + r() * 3.2), a = dir + (r() - 0.5) * 1.1, s = size * (0.06 + r() * 0.2) * (1.4 - d / (size * 4.4)); const q = pulse(i + 1, 0.12); fillShape(g, blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s * 1.3 * q, s * q, seed + i + 1, 0.2, 10, a), IRON, 0.9); }
    for (let i = 0; i < 10; i++) { const a = r() * Math.PI * 2, d = size * (1.4 + r() * 2.6); const rr = (0.6 + r() * 1.2) * pulse(i + 20, 0.2); fillShape(g, circ(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, 8), IRON, 0.85); }
  }, { textures: ["draftTooth"] });
};

// an occasional new dab: pressed in over a few frames, then drying away into the paper. None is
// showing at the rest frame; each one's life wraps round the loop.
const DABS: [number, number, number, number][] = [[1452, 142, 4.2, 10], [96, 364, 3.4, 58], [1630, 356, 3, 104], [1530, 552, 3.8, 214]];
const dabs = (g: Gfx) => g.group("plain", () => DABS.forEach(([x, y, r, t0], i) => {
  const age = (IDLE_F - t0 + LOOP) % LOOP; if (age >= 96) return;
  const grow = Math.min(1, age / 5), fade = age < 5 ? 1 : 1 - (age - 5) / 91;
  fillShape(g, blob(x, y, r * (0.4 + 0.6 * grow), r * 0.9 * (0.4 + 0.6 * grow), 960 + i, 0.25, 14), IRON, 0.85 * fade);
}), { textures: ["draftTooth"] });

// ---------------------------------------------------------------- the clusters
const leftTable = (g: Gfx) => {
  // compass rosette drawn straight on the table in graphite, then gone over partly in ink
  g.group("ink", () => {
    const C: P = [150, 150], R = 64;
    ln(g, circ(C[0], C[1], R, 50), { closed: true, c: LEAD, w: 0.8, op: 0.75 });
    for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; ln(g, circ(C[0] + R * Math.cos(a), C[1] + R * Math.sin(a), R, 50), { closed: true, c: LEAD, w: 0.6, op: 0.45, wob: 0.4 }); }
    for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3 + Math.PI / 6; ln(g, arcP(C[0] + R * Math.cos(a) * 1.73, C[1] + R * Math.sin(a) * 1.73, R, a + Math.PI - 0.52, a + Math.PI + 0.52, 12), { w: 1.1 }); }
    moving(rs(C[0], C[1], wave(401, 0.07), 1 + wave(402, 0.04)), () => poly(g, star(C[0], C[1], 22), { w: 1.2 }));
    ln(g, [[C[0] - 90, C[1] + 92], [C[0] + 112, C[1] - 96]], { c: LEAD, w: 0.5, op: 0.4, wob: 0.1 });
  });
  const cr = rs(150, 150, wave(403, 0.018, 1), 1);                        // it rocks on its needle, never lifting it
  compass(g, tfP(cr, [214, 36]), [150, 150], tfP(cr, [214, 150]));
  // a golden spiral on a torn scrap
  sheet(g, [410, 124], -5, 226, 150, 60, [1, 2]);
  g.group("ink", () => { moving(rs(420, 128, wave(491, 0.025), 1 + wave(492, 0.025)), () => golden(g, 344, 84, 84, -5)); letter(g, "PHI 1.618", 400, 176, { cap: 8, color: LEAD, seed: 61, opacity: 0.8, w: 0.8 }); });
  // graph paper: a cube, its vanishing construction, a triangle and some hatching
  const gp = sheet(g, [262, 440], 4, 440, 260, 62, [2], "#f7f7f1");
  g.group("plain", () => clipped(g, gp, () => { const c = g.cur; c.strokeStyle = "#8fb3c9"; c.lineWidth = 0.6; for (let i = -40; i <= 40; i++) { c.globalAlpha = i % 5 === 0 ? 0.55 : 0.28; trace(c, at([262, 440], 4, [[i * 10, -200], [i * 10, 200]]), false); c.stroke(); trace(c, at([262, 440], 4, [[-300, i * 10], [300, i * 10]]), false); c.stroke(); } c.globalAlpha = 1; }));
  g.group("ink", () => {
    moving(rs(150, 450, wave(493, 0.015), 1, wave(494, 0.9), wave(495, 1.1)), () => {   // the cube and its construction move as one
      const V = cube(g, 120, 470, 78, { w: 1.3 });
      [V[2], V[6], V[3]].forEach((p) => ln(g, [p, [p[0] + (p[0] - 90) * 1.4, p[1] + (p[1] - 560) * 0.9]], { c: LEAD, w: 0.5, op: 0.5, wob: 0.1 }));
    });
    const T: P[] = [[268, 520], [392, 520], [330, 412]]; moving(rs(330, 484, wave(496, 0.02), 1 + wave(497, 0.015)), () => poly(g, T, { w: 1.2 }));
    ln(g, circ(330, 484, 71.6, 40), { closed: true, c: LEAD, w: 0.55, op: 0.5 });
    [[268, 520], [392, 520], [330, 412]].forEach(([x, y], i) => ln(g, [[x, y], lerpP(T[(i + 1) % 3], T[(i + 2) % 3], 0.5)], { c: LEAD, w: 0.5, op: 0.5, wob: 0.1 }));
    moving(rs(440, 380, wave(498, 0.03), 1), () => hatchSquare(g, 440, 380, 22, 4, true, { w: 1 }));
    letter(g, "A", 262, 526, { cap: 9, color: BLUE, seed: 63, w: 0.9 }); letter(g, "B", 394, 526, { cap: 9, color: BLUE, seed: 64, w: 0.9 }); letter(g, "C", 326, 392, { cap: 9, color: BLUE, seed: 65, w: 0.9 });
  });
  ruler(g, [18, 596], -12, 470);
  paperclip(g, [470, 336], 18);
  eraser(g, [498, 262], -14);
};
const rightTable = (g: Gfx) => {
  // the code scrap: a short function, braces, and the curve it describes with its handles
  const sc = sheet(g, [1668, 150], 3, 320, 226, 70, [0, 3]);
  g.group("plain", () => clipped(g, sc, () => { const c = g.cur; c.strokeStyle = "#9cc0d6"; c.lineWidth = 0.7; c.globalAlpha = 0.5; for (let k = 0; k < 9; k++) { trace(c, at([1668, 150], 3, [[-170, -86 + k * 22], [170, -86 + k * 22]]), false); c.stroke(); } c.strokeStyle = "#e39a9a"; trace(c, at([1668, 150], 3, [[-128, -120], [-128, 120]]), false); c.stroke(); c.globalAlpha = 1; }));
  g.group("ink", () => {
    const T = (pts: P[]) => at([1668, 150], 3, pts), B = BLUE;
    g.push(0, 0, 1);
    letter(g, "DRAW(T)", 1548, 56, { cap: 11, color: B, seed: 71, w: 1.1 });
    const br = (x: number, y: number, h: number, dir: number): P[] => smooth([[x + 6 * dir, y], [x + dir, y + 0.1 * h], [x + dir, y + 0.38 * h], [x - 4 * dir, y + 0.5 * h], [x + dir, y + 0.62 * h], [x + dir, y + 0.9 * h], [x + 6 * dir, y + h]], false, 8);
    ln(g, br(1616, 52, 22, 1), { c: B, w: 1.2 });
    letter(g, "PEN.CURVE(P0,P1,P2,P3)", 1568, 80, { cap: 9, color: B, seed: 72, w: 1 });
    ln(g, br(1552, 100, 22, -1), { c: B, w: 1.2 });
    g.pop();
    const Q = T([[-110, 90], [-60 + wave(411, 4), -10 + wave(412, 5)], [40 + wave(413, 4), 104 + wave(414, 5)], [110 + wave(415, 1.5), 20 + wave(416, 2)]]), bz = (t: number): P => { const u = 1 - t; return [u * u * u * Q[0][0] + 3 * u * u * t * Q[1][0] + 3 * u * t * t * Q[2][0] + t * t * t * Q[3][0], u * u * u * Q[0][1] + 3 * u * u * t * Q[1][1] + 3 * u * t * t * Q[2][1] + t * t * t * Q[3][1]]; };
    [[0, 1], [2, 3]].forEach(([a, b]) => { for (let t = 0; t < 1; t += 0.1) ln(g, [lerpP(Q[a], Q[b], t), lerpP(Q[a], Q[b], t + 0.05)], { w: 0.6, op: 0.7, wob: 0 }); });
    live(STATE.curve, () => ln(g, Array.from({ length: 40 }, (_, i) => bz(i / 39)), { w: 1.7 }));
    Q.forEach((p, i) => ln(g, i % 3 ? [[p[0] - 3, p[1] - 3], [p[0] + 3, p[1] - 3], [p[0] + 3, p[1] + 3], [p[0] - 3, p[1] + 3]] : circ(p[0], p[1], 3.2, 10), { closed: true, w: 0.9 }));
    letter(g, "P0", Q[0][0] - 20, Q[0][1] + 6, { cap: 7, color: LEAD, seed: 73, w: 0.8 }); letter(g, "P3", Q[3][0] + 6, Q[3][1] + 4, { cap: 7, color: LEAD, seed: 74, w: 0.8 });
  });
  paperclip(g, [1800, 58], -8);
  // triangles off a protractor, and the protractor's arc itself
  g.group("ink", () => {
    const O: P = [1910, 330]; ln(g, arcP(O[0], O[1], 78, Math.PI, Math.PI * 2, 40), { w: 1.1 }); ln(g, [[O[0] - 84, O[1]], [O[0] + 84, O[1]]], { w: 1.1 });
    for (let d = 0; d <= 180; d += 10) { const a = Math.PI + (d * Math.PI) / 180, k = d % 30 ? 6 : 12; ln(g, [[O[0] + Math.cos(a) * 78, O[1] + Math.sin(a) * 78], [O[0] + Math.cos(a) * (78 - k), O[1] + Math.sin(a) * (78 - k)]], { w: 0.6, wob: 0 }); }
    const ray = Math.PI * 1.3 + wave(421, 0.035); ln(g, [O, [O[0] + Math.cos(ray) * 100, O[1] + Math.sin(ray) * 100]], { w: 0.9 }); ln(g, arcP(O[0], O[1], 26, ray, Math.PI * 2, 10), { c: BLUE, w: 0.9 });
    letter(g, "54o", O[0] + 12, O[1] - 44, { cap: 8, color: BLUE, seed: 75, w: 0.9 });
    const T: P[] = [[1818, 402], [1930, 402], [1860, 520]]; poly(g, T, { w: 1.3 }); ln(g, [[1818, 402], [1878, 468]], { c: LEAD, w: 0.5, op: 0.6 });
    ln(g, arcP(1818, 402, 20, 0, 0.9, 8), { w: 0.8 });
    moving(rs(1575, 460, wave(441, 0.02), 1, wave(442, 1), wave(443, 1.2)), () => cube(g, 1575, 460, 46, { w: 1.1, c: BLUE }));
  });
  hatchSquare(g, 1726, 420, 20, -8, false, { w: 1 });
  g.group("ink", () => { moving(rs(1968, 548, wave(431, 0.12), 1 + wave(432, 0.05)), () => ln(g, spiral(1968, 548, 26, 3.2), { w: 1 })); moving(rs(1956, 64, wave(433, 0.06), 1, 0, wave(434, 1.6)), () => face(g, 1956, 64, 16, 1)); });
};
// doodle confetti in the gaps: the marks a hand makes while it thinks
const KEEP_OUT: [number, number, number, number][] = [];
const confetti = (g: Gfx) => {
  let nLive = 0; const r = rng(900), kinds = ["star", "arrow", "squiggle", "loops", "spiral", "face", "x", "dots", "tri", "circle"], placed: P[] = [];
  const free = (x: number, y: number) => KEEP_OUT.every(([x0, y0, x1, y1]) => x < x0 || x > x1 || y < y0 || y > y1) && placed.every(([px, py]) => Math.hypot(px - x, py - y) > 40);
  g.group("ink", () => {
    for (let tries = 0; tries < 1400 && placed.length < 112; tries++) {
      const x = 20 + r() * (W - 40), y = 16 + r() * (H - 32); if (!free(x, y)) continue; placed.push([x, y]);
      const k = kinds[Math.floor(r() * kinds.length)], c = r() < 0.22 ? BLUE : r() < 0.3 ? LEAD : INK, o: Line = { c, w: 0.9 + r() * 0.5, op: 0.72 + r() * 0.2 }, big = r() < 0.2 ? 1.7 : 1;
      g.push(x * (1 - big), y * (1 - big), big);
      const id = 500 + placed.length * 3, bob = wave(id + 1, 1.4), sway = wave(id + 2, 1);
      IDLE_T = k === "star" ? rs(x, y, wave(id, 0.08), 1 + wave(id + 1, 0.06))                 // twinkle: turn and swell
        : k === "spiral" ? rs(x, y, wave(id, 0.14), 1 + wave(id + 1, 0.05))                    // a slow wind and unwind
        : k === "squiggle" ? rs(x, y, wave(id, 0.035), 1, sway, bob)                            // a wiggle on the water
        : k === "loops" ? (([px, py]: P): P => { const c = wave(id, 0.08); return c === 0 && bob === 0 ? [px, py] : [x + (px - x) * (1 + c), py + bob * 0.5]; })   // the coil compresses and extends
        : k === "face" ? rs(x, y, wave(id, 0.07), 1, 0, bob)                                     // a little nod
        : k === "arrow" ? rs(x, y, wave(id, 0.03), 1, sway * 1.4, bob)                         // it nudges where it points
        : k === "dots" ? rs(x + 18, y, 0, 1 + wave(id, 0.07))
        : rs(x, y, wave(id, 0.05), 1 + wave(id + 1, 0.04), 0, bob * 0.6);
      if (IDLE_T && k === "loops" && wave(id, 0.08) === 0 && bob === 0) IDLE_T = null;
      const alive = nLive < 4 && (k === "spiral" || k === "squiggle" || k === "loops") && x > 600 && x < 1420; if (alive) LIVE.p = STATE.doodles[nLive++];
      if (k === "star") poly(g, star(x, y, 7 + r() * 8, r()), o);
      else if (k === "arrow") { const a = r() * 6.28, L = 40 + r() * 40; arrow(g, [[x, y], [x + Math.cos(a) * L * 0.5 + 10, y + Math.sin(a) * L * 0.5 - 10], [x + Math.cos(a) * L, y + Math.sin(a) * L]], o); }
      else if (k === "squiggle") ln(g, squiggle(x - 30, y, 60, 5 + r() * 4, 3 + r() * 2, (r() - 0.5) * 40), o);
      else if (k === "loops") ln(g, loops(x - 30, y, 64, 7, 5, (r() - 0.5) * 30), o);
      else if (k === "spiral") ln(g, spiral(x, y, 12 + r() * 8, 2.5), o);
      else if (k === "face") face(g, x, y, 10 + r() * 5, r() * 2 - 1, o);
      else if (k === "x") { ln(g, [[x - 6, y - 6], [x + 6, y + 6]], o); ln(g, [[x + 6, y - 6], [x - 6, y + 6]], o); }
      else if (k === "dots") for (let i = 0; i < 5; i++) ln(g, circ(x + i * 9, y + Math.sin(i) * 3, 1.4, 6), { ...o, closed: true, w: 1.4 });
      else if (k === "tri") poly(g, at([x, y], r() * 120, [[0, -12], [11, 8], [-11, 8]]), o);
      else ln(g, circ(x, y, 8 + r() * 10, 26), { ...o, closed: true });
      LIVE.p = undefined; IDLE_T = null;
      g.pop();
    }
  });
};
// the three colour pops
const colour = (g: Gfx) => {
  // marker swatch: three chisel strokes, laid over each other where they cross
  const sw = sheet(g, [700, 556], 4, 170, 62, 80, [0]);
  void sw;
  g.group("plain", () => [["#f6cf3a", 0], ["#f07360", 1], ["#2f9c8e", 2]].forEach(([c, i]) => { const y = 44 + (i as number) * 14; fillShape(g, at([700, 556], 4, [[-70, y - 64], [60 + (i as number) * 6, y - 66], [62 + (i as number) * 6, y - 56], [-68, y - 54]]), c as string, 0.85); }), { blend: "multiply", textures: ["risoMottle"] });
  // riso patch, pink and blue screens overprinted
  const rp = sheet(g, [1776, 548], 7, 118, 96, 81, [1, 2], "#f7f1e6");
  g.group("plain", () => clipped(g, rp, () => { const c = g.cur; ([["#ff48b0", 15, (x: number) => 0.18 + 0.5 * ((x - 1716) / 120)], ["#0078bf", 75, (_x: number, y: number) => 0.18 + 0.5 * ((y - 500) / 96)]] as [string, number, (x: number, y: number) => number][]).forEach(([col, ang, tone]) => { c.fillStyle = col; c.globalAlpha = 0.85; halftone({ x0: 1700, y0: 490, x1: 1850, y1: 610 }, 7, ang, tone).forEach(([x, y, rr]) => { c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.fill(); }); }); c.globalAlpha = 1; }), { blend: "multiply", textures: ["risoSpeck"] });
  // one doodle in colour: a red star with a little shading
  const rst = -1.4 + wave(451, 0.09);
  g.group("plain", () => fillShape(g, star(372, 26 + 8, 16, rst), "#e2453c", 0.9), { textures: ["risoMottle"] });
  g.group("ink", () => poly(g, star(372, 34, 16, rst), { w: 1.1 }));
};

// ---------------------------------------------------------------- the table under the card
// Big constructions drawn straight on the table before the card was put down: the card hides
// their middles, so only their ends show round it, and it reads as lying ON a worked surface.
const underCard = (g: Gfx) => {
  g.group("ink", () => {
    ln(g, arcP(1000, 300, 348, 0, Math.PI * 2, 90), { closed: true, c: LEAD, w: 0.7, op: 0.5 });
    ln(g, arcP(1000, 300, 296, 0, Math.PI * 2, 80), { closed: true, c: LEAD, w: 0.55, op: 0.35 });
    ln(g, arcP(760, 620, 250, Math.PI * 1.1, Math.PI * 1.9, 50), { w: 1 });
    ln(g, arcP(1260, 0, 230, Math.PI * 0.1, Math.PI * 0.9, 50), { w: 1 });
    ln(g, [[520, 590], [1500, 20]], { c: LEAD, w: 0.5, op: 0.4, wob: 0.1 }); ln(g, [[560, 10], [1480, 610]], { c: LEAD, w: 0.5, op: 0.4, wob: 0.1 });
    ln(g, [[600, 492], [1400, 492]], { c: BLUE, w: 0.9, op: 0.6, wob: 0.2 }); ln(g, [[640, 120], [1360, 120]], { c: BLUE, w: 0.9, op: 0.6, wob: 0.2 });
    for (let x = 640; x <= 1360; x += 40) ln(g, [[x, 116], [x, 124]], { c: BLUE, w: 0.7, wob: 0 });
    live(STATE.arrows[0], () => arrow(g, [[560, 560], [600, 520], [660, 506]], { w: 1.2 }));
    live(STATE.arrows[1], () => arrow(g, [[1470, 40], [1440, 80], [1400, 100]], { w: 1.2 }));
    hatchRuns({ x0: 1040, y0: 470, x1: 1260, y1: 530 }, 0.9, 5, (x, y) => y > 480 && y < 520 && x > 1060 && x < 1240, 3, 5).forEach((r) => ln(g, [r[0], r[r.length - 1]], { w: 0.6, op: 0.6, wob: 0.1 }));
  });
  // where the ink bottle stood: a dark ring, heavier on one side where it was set down tilted
  g.group("plain", () => { const c = g.cur; g.touch(520, 470, 680, 620); c.strokeStyle = IRON; for (let k = 0; k < 3; k++) { c.globalAlpha = 0.28 - k * 0.07; c.lineWidth = 3.2 - k; c.beginPath(); c.ellipse(600 + k * 2, 548 - k, 44 - k * 3, 44 - k * 3, 0, Math.PI * (0.1 + k * 0.3), Math.PI * (2.0 + k * 0.1)); c.stroke(); } c.globalAlpha = 1; }, { textures: ["draftTooth"] });
};

// ---------------------------------------------------------------- the name on its card
const STROKES = WORD.map((s, i) => inkStroke(NIB, s, TAIL[i]));
const BOX = (() => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; STROKES.forEach((k) => k.spine.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); })); return { x0, y0, x1, y1 }; })();
const heroCard = (g: Gfx) => {
  const cx = (BOX.x0 + BOX.x1) / 2, cy = (BOX.y0 + BOX.y1) / 2, w = BOX.x1 - BOX.x0 + 110, h = BOX.y1 - BOX.y0 + 90;
  sheet(g, [cx, cy], -1.2, w, h, 90, [], "#fcfaf4");
  // the letterer's pencil guides, never rubbed out: ascender, x-height, baseline, and the slant
  g.group("ink", () => {
    [1.95, 1, 0].forEach((y, i) => ln(g, [place(NIB, [-0.5, y]), place(NIB, [8.9 - y * 0.3, y])], { c: LEAD, w: 0.5, op: i === 2 ? 0.34 : 0.22, wob: 0.1 }));
    for (let x = -0.2; x < 8.6; x += 0.62) ln(g, [place(NIB, [x, -0.25]), place(NIB, [x, 2.1])], { c: LEAD, w: 0.4, op: 0.13, wob: 0.1 });
  });
  KEEP_OUT.push([cx - w / 2 - 34, cy - h / 2 - 34, cx + w / 2 + 34, cy + h / 2 + 34]);
};
// The writing path: each stroke in order, a flight through the air to the next one (faster than
// ink, so counted at half its distance), and the i's dot tapped in last.
type Leg = { ink: number; L: number; a: P; b: P };
const LEGS: Leg[] = (() => {
  const legs: Leg[] = [], dot = place(NIB, DOT);
  STROKES.forEach((k, i) => {
    const s0 = k.spine[0], s1 = k.spine[k.spine.length - 1], L = k.len[k.len.length - 1];
    legs.push({ ink: i, L, a: s0, b: s1 });
    const nx = i + 1 < STROKES.length ? STROKES[i + 1].spine[0] : dot;
    legs.push({ ink: -1, L: Math.hypot(nx[0] - s1[0], nx[1] - s1[1]) * 0.5, a: s1, b: nx });
  });
  legs.push({ ink: -2, L: 36, a: dot, b: dot });
  return legs;
})();
const PATH_LEN = LEGS.reduce((a, l) => a + l.L, 0);
export const NIB_START = STROKES[0].spine[0], NIB_DOT = place(NIB, DOT);
// where the ink has got to after `u` of the path: px laid per stroke, the nib's point, the dot
export const walk = (u: number) => {
  const laid = STROKES.map(() => 0); let left = u * PATH_LEN, nib: P = LEGS[0].a, dot = false;
  for (const l of LEGS) {
    const d = Math.min(left, l.L);
    if (l.ink >= 0) { laid[l.ink] = d; const k = STROKES[l.ink]; let j = 0; while (j < k.len.length - 1 && k.len[j] < d) j++; nib = k.spine[j]; }
    else if (l.ink === -1) nib = lerpP(l.a, l.b, l.L ? d / l.L : 1);
    else { nib = l.a; dot = d >= l.L * 0.5; }
    left -= l.L; if (left <= 0) break;
  }
  return { laid, nib, dot: u >= 1 || dot };
};
const name = (g: Gfx, s: State) => {
  if (s.write <= 0) return;
  const w = walk(s.write);
  g.group("plain", () => {
    const c = g.cur; c.fillStyle = IRON; g.touch(BOX.x0 - 20, BOX.y0 - 20, BOX.x1 + 20, BOX.y1 + 20);
    STROKES.forEach((k, i) => { if (w.laid[i] <= 0) return; trace(c, outlineOf(k, s.write >= 1 ? Infinity : w.laid[i])); c.fill(); });
    if (w.dot) { const d = place(NIB, DOT); c.beginPath(); c.ellipse(d[0], d[1], 5.6, 4.3, -0.5, 0, Math.PI * 2); c.fill(); }
  }, { textures: ["draftTooth"], alpha: s.fade });
};

let STATE: State = FINISHED;
export const drawBanner = (ctx: Ctx, frame: number, env: Env, s: State = FINISHED) => {
  const g = new Gfx(ctx, env, 0, FINE);
  void frame; SEED = 1; KEEP_OUT.length = 0; STATE = s; LIVE.fade = s.fade; LIVE.p = undefined; IDLE_F = s.idle; IDLE_T = null;
  KEEP_OUT.push([0, 0, 560, 620], [1500, 0, 2000, 620], [440, 0, 620, 110]);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  leftTable(g); rightTable(g); colour(g);
  underCard(g);
  heroCard(g);
  confetti(g);
  splat(g, 1468, 108, 11, -2.6, 910); splat(g, 60, 330, 7, 0.4, 920); splat(g, 1600, 330, 6, -0.6, 930);
  name(g, s);
  // tools dropped across the card's corners and the table
  // each tool settles a hair where it lies, and catches the light once a loop at its own moment
  const hair = (a: P, b: P, id: number): [P, P] => { const t = rs((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, wave(id, 0.0045, 1), 1, wave(id + 1, 0.8, 1), wave(id + 2, 0.8, 1)); return [tfP(t, a), tfP(t, b)]; };
  const glint = (pt: (t: number, side: number) => P, id: number, t0: number, len = 30) => { const age = (IDLE_F - t0 + LOOP) % LOOP; if (age >= len) return; const u = age / len; g.group("plain", () => g.glow(...pt(0.15 + 0.7 * u, -2), 9, "#fffdf5", 0.75 * Math.sin(u * Math.PI)), { blend: "screen" }); };
  glint(pencil(g, ...hair([1250, 22], [1560, 118], 461), "#e2b84f", "#9c7422"), 461, 24);
  glint(fineliner(g, ...hair([1990, 318], [1968, 28], 464)), 464, 70);
  glint(brush(g, ...hair([640, 30], [948, 12], 467), "#1f3b5c", "#0c1a2a", "#5a4032"), 467, 118);
  glint(brush(g, ...hair([860, 612], [1150, 578], 470), "#a3372e", "#561b17", "#6d4c3f"), 470, 150);
  splat(g, 1496, 520, 14, 2.3, 940);
  dabs(g);
  // a last drop let fall on the wet blot: rings run out across the pool of ink and die away
  if (s.ripple >= 0 && s.ripple < 1) g.group("plain", () => { const c = g.cur; g.touch(1420, 460, 1575, 585); for (let k = 0; k < 3; k++) { const t = (s.ripple - k * 0.2) / 0.6; if (t <= 0 || t >= 1) continue; c.strokeStyle = IRON; c.globalAlpha = 0.6 * (1 - t); c.lineWidth = 2.4 * (1 - t) + 0.5; c.beginPath(); c.ellipse(1496, 520, 12 + t * 52, 10 + t * 44, 0.3, 0, Math.PI * 2); c.stroke(); } c.fillStyle = "#fbf6ea"; c.globalAlpha = 0.5 * (1 - s.ripple); c.beginPath(); c.arc(1492, 516, 3, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; });
  dipPen(g, s.nibAt ?? restAt(IDLE_F), s.nibAt ? s.nibAng : restAng(IDLE_F), s);                                      // resting where it lifted off the swash
  paperclip(g, [604, 300], 94);
  g.paper("paper", 0.1); g.paper("coldpress", 0.1);
};

// ---------------------------------------------------------------- the loop (240 frames, 8 s)
// 0-16 the pen lifts off its rest and carries to the a. 16-150 it writes the word, pen lifts and
// all, and taps the dot; a few doodles draw themselves in meanwhile. 150-172 it flies home; a
// last drop falls on the wet blot and rings out (158-194) while one more doodle draws itself in
// (170-204), and a glint runs down the nib (186-210). 211 is the approved still, exactly. 212-239
// the new ink sinks back into the card, so the last frame is a breath away from the first and the
// loop has no seam. Something moves on every frame: the settle is slow, never frozen.
const N = 240;
const ease = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };
const ramp = (f: number, a: number, b: number) => Math.max(0, Math.min(1, (f - a) / (b - a)));
export const stateAt = (f: number): State => {
  const write = f < 16 ? 0 : f >= 150 ? 1 : 0.2 * ease((f - 16) / 134) + 0.8 * ((f - 16) / 134);
  let nibAt: P | null = null, nibAng = -2.3;
  if (f < 16) { const t = ease(f / 16); nibAt = lerpP(restAt(f), NIB_START, t); nibAng = restAng(f) + (-2.3 - restAng(f)) * t; }
  else if (f < 150) nibAt = walk(write).nib;
  else if (f < 172) { const t = ease((f - 150) / 22); nibAt = t >= 1 ? null : lerpP(NIB_DOT, restAt(f), t); nibAng = -2.3 + (restAng(f) + 2.3) * t; }
  const g = ramp(f, 186, 211);
  return {
    write, nibAt, nibAng, glint: f >= 186 && f < 211 ? Math.sin(Math.max(0.06, g) * Math.PI) : 0, glintT: g,
    doodles: [ramp(f, 30, 58), ramp(f, 62, 90), ramp(f, 96, 124), ramp(f, 170, 204)], curve: ramp(f, 40, 92), arrows: [ramp(f, 20, 44), ramp(f, 108, 132)],
    ripple: f >= 158 && f < 194 ? (f - 158) / 36 : -1, fade: f < 212 ? 1 : 1 - (f - 211) / 29, idle: f,
  };
};

export const banner: Film = {
  meta: { title: "anidoodle · the working table", W, H, fps: 30, bpm: 120, durationFrames: N, raster: "cpu" },
  assets: { images: {} },
  shots: [{ id: "studio", start: 0, end: N, draw: (ctx, f, env) => drawBanner(ctx, f, env, stateAt(f)) }],
};
