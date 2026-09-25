import { Gfx, rng, fractal, type Medium, type P } from "./core";
import type { Film } from "./film";
import { bounds, clamp, inside, mix, profile } from "./gallery";
import { fit, runProcess, timeline, type Proc } from "./sumiEKit";
import { darken, fill, lighten, oilStroke, weave, type OStroke } from "./paintedOilKit";

// TWO PEARS AND A COPPER POT BY A WINDOW · oil on canvas.
//
// MEDIUM, physically: oil paint on a stretched linen canvas, primed white, then toned with a thin
// rub of burnt sienna and umber (the imprimatura). Hog-bristle flats and filberts, loaded with
// paint that is lean (thinned) in the first passes and fat (straight from the tube) in the last.
// THE MARK: a flat bristle stroke. It lands square and full, drags as the paint runs out (the
// outer bristles first) and breaks into streaks over the layer below. Bristles leave grooves down
// its length and shove ridges up at both edges: the ridge turned to the window catches a thin
// light, the far one a thin dark. Highlights are impasto: short, thick dabs that stand off the
// canvas, ridged, with a hairline shadow on the side away from the light.
// THE EDGE: found on the lit side (the object's colour is clipped crisply against the ground
// already laid), lost in shadow (the shadow colour is dragged out into the dark wall wet into wet
// until there is no line at all). Turning edges are blended wet into wet: a stroke loaded with
// one value picks up the next as it crosses the form, so each stroke carries two colours.
// ORDER: toned ground; a thin burnt-umber drawing with a small brush; the dark masses blocked in
// with a big brush and lean paint; then the mid tones; then the lights; then the impasto highlights
// and the last dark accents (stems, the pot's mouth, contact shadows) and the lost-edge drags.
// PALETTE: a Chardin kitchen palette: raw and burnt umber, burnt sienna, yellow ochre, a little
// terre verte and Naples yellow, lead white; copper is burnt sienna, cadmium orange and white;
// the pears yellow ochre, terre verte and Naples yellow with a sienna blush.
// CANVAS: plain-weave linen, the thread bumps multiplied through everything, strongest where the
// paint is thin.
// LIGHT: one north window just out of frame left, a little above the table: everything is lit from the
// left; cast shadows fall to the right along the table.
// SUBJECT and STRUCTURE: a hammered copper cooking pot, a body of revolution (rolled rim, shoulder,
// belly widest a third of the way down, a narrower foot), two ear handles riveted at the shoulder;
// copper is a mirror, so it shows the window as a narrow bright band left of centre, the dark room
// elsewhere, and the warm table in its lower belly. Two Williams (Bartlett) pears: asymmetric
// bulb, a waisted neck set off-axis, a woody stem, the calyx a dry dark star at the blossom end;
// one stands, one lies on its side in front of the pot. Lambert shading toward the one window,
// a core shadow, warm reflected light from the table in the shadow side, cast shadows.
// REFERENCE (from knowledge): Chardin's kitchen still lifes (the copper cauldron and cistern
// pictures) for the copper's reflections and the dark warm room; Manet's late small still lifes
// for the loaded, dragged bristle mark; the Williams pear's botanical form.

// SIZE HIERARCHY (the painter's, and the plate's first rule): the wall and table are laid with a
// big flat in few broad directional passes, the toned ground left showing between them; the pot
// and pears with a medium brush that follows their form; a small brush only for accents.

const OIL_M: Medium = { nib: 1, taper: 1, pressure: 1, retrace: false, wobble: 0, rough: 0 };
const W = 1080, H = 1080;
const N = 540; // 18 s; the last 30 frames are the finished painting
const L3 = (() => { const v = [-0.72, -0.42, 0.55], l = Math.hypot(...v); return v.map((x) => x / l); })(); // the window, as a light vector

// ---------------------------------------------------------------- colour
const ramp = (stops: string[], t: number) => { const f = clamp(t) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)); return mix(stops[i], stops[i + 1], f - i); };
const COPPER = ["#100503", "#260a04", "#4e1b0b", "#8a3514", "#c9621c", "#ea9636", "#f8d488"];   // near-black red-brown to saturated orange-gold
const PEAR = ["#243019", "#3b4a26", "#62702e", "#949539", "#c2b248", "#e0cf78", "#f3e9b8"];   // cool green shadow to warm yellow light
const WALL = ["#18130d", "#241d15", "#33291d", "#463a2a", "#5c4e3a", "#74654c"];
const TABLE = ["#2a1c10", "#46301b", "#6a4828", "#94673a", "#b98852", "#d6aa72"];
const UMBER = "#4a2c1a", TONE = "#9a6a44";

// ---------------------------------------------------------------- structure
const TABLE_BACK = 660, TABLE_FRONT = 940, WIN_X = -40; // the window itself is out of frame, left: only its light arrives
const ell = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): P[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as P; });
// The eye is a little above the table, so every horizontal circle is an ellipse that opens as it
// drops further below eye level: the rim at 0.17, the foot at 0.205. Rim, hoops and foot all use it.
const OPEN = (y: number) => 0.17 + (0.035 * (y - 508)) / 282;
// the pot: radius at each height, about a vertical axis
const AX = 660, RIM_Y = 508, FOOT_Y = 790;
const PROFILE: [number, number][] = [[508, 150], [530, 146], [556, 160], [585, 176], [620, 188], [652, 192], [690, 188], [730, 176], [765, 158], [790, 140]];
const R = (y: number) => { if (y <= PROFILE[0][0]) return PROFILE[0][1]; for (let i = 1; i < PROFILE.length; i++) if (y <= PROFILE[i][0]) { const [y0, r0] = PROFILE[i - 1], [y1, r1] = PROFILE[i], f = (y - y0) / (y1 - y0); return r0 + (r1 - r0) * (f * f * (3 - 2 * f)); } return PROFILE[PROFILE.length - 1][1]; };
const RIM_RY = 150 * OPEN(RIM_Y), FOOT_RY = 140 * OPEN(FOOT_Y);
const POT: P[] = (() => {
  const right: P[] = [], left: P[] = [];
  for (let y = RIM_Y; y <= FOOT_Y; y += 6) { right.push([AX + R(y), y]); left.push([AX - R(y), y]); }
  return [...ell(AX, RIM_Y, 150, RIM_RY, Math.PI, 2 * Math.PI, 30), ...right, ...ell(AX, FOOT_Y, 140, FOOT_RY, 0, Math.PI, 24), ...left.reverse()];
})();
const MOUTH = ell(AX, RIM_Y + 1, 137, 137 * OPEN(RIM_Y), 0, 2 * Math.PI, 40);
// ear handles riveted at the shoulder: loops standing out sideways, so they are seen nearly flat
const HANDLE_L: P[] = [[AX - R(556) + 2, 556], [474, 551], [454, 564], [457, 590], [476, 603], [AX - R(600) + 2, 600]];
const HANDLE_R: P[] = HANDLE_L.map(([x, y]) => [2 * AX - x, y] as P);

// the pears as bodies of revolution: a spherical bulb, then a waist and neck along an axis
type Pear = { C: P; d: P; rb: number; neck: [number, number][]; lean: number };
const unit = (x: number, y: number): P => { const l = Math.hypot(x, y); return [x / l, y / l]; };
// Williams pear standing: a slightly off-axis neck, the right shoulder fuller than the left
const PA: Pear = { C: [388, 806], d: unit(0.13, -1), rb: 82, neck: [[0, 82], [34, 74], [70, 50], [98, 36], [124, 29], [138, 22], [146, 9]], lean: 0.05 };
// the same pear lying down, blossom end toward us: its bulb nearly round, the neck turning away
// to the back right, so foreshortened to about half its length
const PB: Pear = { C: [578, 874], d: unit(1, -0.42), rb: 62, neck: [[0, 62], [24, 57], [48, 43], [66, 31], [82, 24], [94, 17], [100, 7]], lean: 0 };
const pearR = (p: Pear, s: number) => (s <= 0 ? Math.sqrt(Math.max(0, p.rb * p.rb - s * s)) : profile(p.neck)(s));
const pearTop = (p: Pear) => p.neck[p.neck.length - 1][0];
const nrm = (p: Pear): P => [-p.d[1], p.d[0]];
const pearAt = (p: Pear, s: number, q: number): P => { const n = nrm(p); return [p.C[0] + p.d[0] * s + n[0] * q, p.C[1] + p.d[1] * s + n[1] * q]; };
const outline = (p: Pear): P[] => { const L: P[] = [], Rr: P[] = []; for (let s = -p.rb; s <= pearTop(p); s += 3) { const r = pearR(p, s), k = s > 0 ? p.lean : 0; L.push(pearAt(p, s, -r * (1 - k))); Rr.push(pearAt(p, s, r * (1 + k))); } return [...L, ...Rr.reverse()]; };
const PEAR_A = outline(PA), PEAR_B = outline(PB);
const pearLocal = (p: Pear, x: number, y: number) => { const dx = x - p.C[0], dy = y - p.C[1], n = nrm(p); return { s: dx * p.d[0] + dy * p.d[1], q: dx * n[0] + dy * n[1] }; };
const pearNormal = (p: Pear, x: number, y: number) => {
  const { s, q } = pearLocal(p, x, y), r = Math.max(4, pearR(p, s)), u = clamp(q / r, -1, 1), n = nrm(p);
  const a = s <= 0 ? clamp(s / p.rb, -1, 1) * Math.sqrt(1 - u * u) : -clamp((pearR(p, s + 3) - pearR(p, s - 3)) / 6, -1, 1) * Math.sqrt(1 - u * u) * 0.8;
  const z = Math.sqrt(Math.max(0.02, 1 - u * u - a * a)), v = [n[0] * u + p.d[0] * a, n[1] * u + p.d[1] * a, z], l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const SHADOWS: P[][] = [
  ell(496, 880, 112, 15, 0, 2 * Math.PI, 30),   // pear A's, falling right, under pear B
  ell(724, 918, 104, 14, 0, 2 * Math.PI, 30),   // pear B's
  ell(878, 797, 180, 33, 0, 2 * Math.PI, 36),   // the pot's, running off into the dark right
];
const SHADOW_FROM = [400, 628, 760];            // where each shadow leaves its object: darkest there
const inShadow = (x: number, y: number) => SHADOWS.findIndex((s) => inside(s, x, y));

// ---------------------------------------------------------------- the light model
const dot = (n: number[]) => n[0] * L3[0] + n[1] * L3[1] + n[2] * L3[2];
// Copper, the way a painter sees it rather than a renderer: a warm orange body where it turns to
// the window, a dark core, a band of warm reflected light at the shadow edge from the table, the
// shoulder darker (it reflects the dark room above), the lower belly warmed by the table. The cool
// window reflections and the specular are laid as separate, deliberate strokes, not computed.
// hard value shapes, as metal has: the lit side saturated orange-gold, a quick turn, a near-black core and shadow side
// with one dark band inside the lit side: the dark room reflected between window and wall
const COPPER_ACROSS = profile([[-1, 0.26], [-0.86, 0.5], [-0.66, 0.66], [-0.5, 0.6], [-0.36, 0.34], [-0.24, 0.36], [-0.12, 0.54], [-0.02, 0.4], [0.1, 0.1], [0.3, 0.03], [0.7, 0.02], [0.88, 0.13], [1, 0.05]]);
const copperI = (x: number, y: number) => { const nx = clamp((x - AX) / R(y), -1, 1); return clamp(COPPER_ACROSS(nx) - (y < 565 ? 0.12 * (565 - y) / 57 : 0) + (y > 715 && nx < 0.1 ? 0.05 * (y - 715) / 75 : 0)); };
const copper = (x: number, y: number) => {
  if (inside(MOUTH, x, y)) { const inner = clamp((x - AX + 10) / 120); return ramp(COPPER, 0.01 + 0.3 * inner * inner * inner); }   // the far inner wall, lit through the mouth
  const c = ramp(COPPER, copperI(x, y));
  return c;
};
const pearCol = (p: Pear, blush: [number, number, number] | null, shade: (x: number, y: number) => number) => (x: number, y: number) => {
  const n = pearNormal(p, x, y), d = dot(n), bounce = n[0] > 0.3 && n[1] > 0.1 ? 0.12 * n[1] : 0;
  const I = clamp((0.08 + 0.84 * Math.max(0, d) + bounce) * shade(x, y));
  let c = ramp(PEAR, I * 0.9);
  if (bounce > 0.02) c = mix(c, "#7a6428", 0.3);                                                    // warm light back up from the table
  if (blush) { const k = clamp(1 - Math.hypot(x - blush[0], y - blush[1]) / blush[2]); if (k > 0) c = mix(c, "#b04428", 0.45 * k * k); }
  return c;
};
const pearI = (p: Pear, x: number, y: number) => clamp(0.08 + 0.84 * Math.max(0, dot(pearNormal(p, x, y))));
const shadeB = (x: number) => (x < 552 ? 0.62 : 1);                                                 // pear A's shadow over pear B's blossom end
const pearA = pearCol(PA, [352, 842, 34], () => 1);
const pearB = pearCol(PB, [566, 900, 18], shadeB);
// the wall: darker the further from the window, a slow lift at mid-height where the light lands
const wallI = (x: number, y: number) => clamp(0.64 - 0.56 * Math.pow(clamp(x / W), 0.7) + 0.06 * Math.exp(-((y - 420) ** 2) / (2 * 220 ** 2)));
const tableI = (x: number, y: number) => {
  let I = 0.9 - 0.6 * (x / W) - 0.2 * (1 - (y - TABLE_BACK) / (TABLE_FRONT - TABLE_BACK));
  const k = inShadow(x, y); if (k >= 0) I = Math.min(I, 0.04 + 0.22 * clamp((x - SHADOW_FROM[k]) / 180));   // the shadow's core is at the object, fading outward
  return clamp(I);
};

// ---------------------------------------------------------------- stroke paths that follow the forms
const WALL_R: P[] = [[WIN_X - 4, -40], [W + 40, -40], [W + 40, TABLE_BACK + 8], [WIN_X - 4, TABLE_BACK + 8]];
const TABLE_R: P[] = [[-40, TABLE_BACK - 4], [W + 40, TABLE_BACK - 4], [W + 40, TABLE_FRONT + 4], [-40, TABLE_FRONT + 4]];
const FRONT_R: P[] = [[-40, TABLE_FRONT - 2], [W + 40, TABLE_FRONT - 2], [W + 40, H + 40], [-40, H + 40]];
const steep = (x: number, y: number) => -1.2 + (fractal(91, x, y, 0.002, 0.002, 1) - 0.5) * 0.3;   // the wall: steep diagonal passes, top right to bottom left
// a hoop round the pot at the height of (x, y): the stroke curves round the belly like a lathe line
const potHoop = (x: number, y: number, len: number, flip: boolean): P[] | null => {
  const r = R(y), e = OPEN(y) * 1.9, u = clamp((x - AX) / r, -0.999, 0.999), th = Math.acos(u), yc = y - e * r * Math.sin(th), dth = len / (2 * r);
  const at = (t: number): P => [AX + R(yc) * Math.cos(t), yc + e * R(yc) * Math.sin(t)];
  const a = flip ? th + dth : th - dth, b = flip ? th - dth : th + dth; return [at(a), at((a + b) / 2), at(b)];
};
// a hoop round a pear: the cross-section circle at that point of its axis, seen a little from above
const pearHoop = (p: Pear) => (x: number, y: number, len: number, flip: boolean): P[] | null => {
  const { s, q } = pearLocal(p, x, y), r = Math.max(6, pearR(p, s)), th = Math.acos(clamp(q / r, -0.999, 0.999)), dth = Math.min(1.4, len / (2 * r)), e = 0.62;
  const at = (t: number): P => pearAt(p, s - e * r * (Math.sin(t) - Math.sin(th)), r * 0.98 * Math.cos(t));
  const a = flip ? th + dth : th - dth, b = flip ? th - dth : th + dth; return [at(a), at((a + b) / 2), at(b)];
};
// PEARS IN PLANES, the way a painter models a fruit: four value planes, each a flat mixed colour
// (core shadow, reflected light, half tone, light), laid with a few broad strokes that follow the
// surface, then small strokes dragged across each plane edge wet into wet. No gradient, no bands.
const PLANE_V = [0.14, 0.3, 0.54, 0.82];
const planeOf = (p: Pear, shade: (x: number) => number) => (x: number, y: number) => {
  const n = pearNormal(p, x, y), I = pearI(p, x, y) * shade(x);
  if (I >= 0.62) return 3; if (I >= 0.36) return 2; return n[0] > 0.3 && n[1] > 0.05 && I < 0.3 ? 1 : 0;
};
const planeCol = (p: Pear, blush: [number, number, number] | null, shade: (x: number) => number) => { const pl = planeOf(p, shade); return (x: number, y: number) => {
  const k = pl(x, y); let c = ramp(PEAR, PLANE_V[k] * 0.95 + (fractal(77, x, y, 0.02, 0.02, 1) - 0.5) * 0.05);
  if (k === 1) c = mix(c, "#7a6428", 0.35);                                                           // warm light back up from the table
  if (blush && k >= 2) { const b = clamp(1 - Math.hypot(x - blush[0], y - blush[1]) / blush[2]); if (b > 0) c = mix(c, "#b04428", 0.5 * b); }
  return c;
}; };
// a stroke laid ON the surface: up the axis on the neck; on the bulb a curved diagonal, travelling
// round and along at once, the way a brush follows a fruit's curvature
const surf = (p: Pear) => (x: number, y: number, len: number, flip: boolean): P[] | null => {
  const { s, q } = pearLocal(p, x, y), r = Math.max(6, pearR(p, s)), u = clamp(q / r, -0.999, 0.999), th = Math.acos(u), top = pearTop(p) - 6;
  const S = (t: number) => clamp(s + t, -p.rb + 4, top);
  if (s > 24) return [-1, 0, 1].map((t) => { const ss = S((t * len) / 2); return pearAt(p, ss, u * pearR(p, ss)); });
  const a = len * 0.36, b = ((len * 0.36) / r) * (u < 0 ? 1 : -1) * (flip ? 1 : 0.7), e = 0.4;
  return [-1, 0, 1].map((t) => { const ss = S(t * a), tt = th + t * b; return pearAt(p, ss - e * r * (Math.sin(tt) - Math.sin(th)), pearR(p, ss) * Math.cos(tt)); });
};
// the blending strokes: short drags straight across each plane edge, carrying one plane's paint into the next
const blends = (p: Pear, outlinePts: P[], col: (x: number, y: number) => string, shade: (x: number) => number, seed: number): OStroke[] => {
  const pl = planeOf(p, shade), r = rng(seed), out: OStroke[] = [], b = bounds(outlinePts), I = (x: number, y: number) => pearI(p, x, y) * shade(x);
  for (let y = b.y0; y < b.y1; y += 9) for (let x = b.x0; x < b.x1; x += 9) {
    const px = x + (r() - 0.5) * 8, py = y + (r() - 0.5) * 8, keep = r(); if (!inside(outlinePts, px, py)) continue;
    const gx = I(px + 2, py) - I(px - 2, py), gy = I(px, py + 2) - I(px, py - 2), gl = Math.hypot(gx, gy); if (gl < 1e-4) continue;
    const ux = gx / gl, uy = gy / gl, a: P = [px - ux * 12, py - uy * 12], c: P = [px + ux * 12, py + uy * 12];
    if (pl(a[0], a[1]) === pl(c[0], c[1]) || keep > 0.55) continue;
    out.push({ ctrl: [a, [px - uy * 2, py + ux * 2], c], w: 10, c0: col(a[0], a[1]), c1: col(c[0], c[1]), load: 1, dry: 0.3, impasto: 0.15, jit: 0.03, soft: 0.25, seed: seed * 100 + out.length });
  }
  return out;
};
// objects shrunk a few px toward their middles: the background may run just under their edges
const inset = (pts: P[], k: number): P[] => { let cx = 0, cy = 0; pts.forEach(([x, y]) => { cx += x; cy += y; }); cx /= pts.length; cy /= pts.length; return pts.map(([x, y]) => { const d = Math.hypot(x - cx, y - cy) || 1; return [cx + (x - cx) * (1 - k / d), cy + (y - cy) * (1 - k / d)] as P; }); };
const shift = (pts: P[], dx: number, dy: number): P[] => pts.map(([x, y]) => [x + dx, y + dy] as P);
const HOLES = [POT, PEAR_A, PEAR_B].map((p) => inset(p, 3));   // not the handles: the wall shows through their loops

// EDGES: an object's paint is clipped to its outline on the side facing the window (found edge)
// but allowed to spill past it on the shadow side (the outline plus a copy shifted away from the
// light), so the shadow side's dark is dragged over the equally dark ground and the edge is lost.
type Clip = { keep?: P[][]; out?: P[][] };
type Stage = { name: string; clip?: Clip; strokes: OStroke[]; per: number };  // per = frames per stroke
const BG: Clip = { out: HOLES };
const lost = (pts: P[], dx = 9, dy = 3): Clip => ({ keep: [pts, shift(pts, dx, dy)] });
const stages = (): Stage[] => {
  const S: Stage[] = [];
  // 1. the toned ground: a thin rub of sienna-umber scrubbed over the white priming
  const tr = rng(3), toning: OStroke[] = [];
  for (let i = 0; i < 16; i++) { const y = -40 + i * 76 + tr() * 30, a = (i % 2 ? 0.12 : -0.1) + (tr() - 0.5) * 0.1; toning.push({ ctrl: [[-80, y - a * 600], [W / 2, y + (tr() - 0.5) * 40], [W + 80, y + a * 600]], w: 150, c0: mix(TONE, "#7e5636", tr() * 0.5), c1: mix(TONE, "#a87a50", tr() * 0.5), load: 1.1, dry: 0.5, impasto: 0, alpha: 0.82, jit: 0.06, seed: 10 + i }); }
  S.push({ name: "tone", strokes: toning, per: 2.6 });
  // 2. the drawing: thin burnt umber, a small round brush, searching lines
  const ln = (ctrl: P[], seed: number, w = 3.2, alpha = 0.78): OStroke => ({ ctrl, w, c0: UMBER, load: 1, dry: 0.15, impasto: 0, alpha, seed });
  const part = (pts: P[], a: number, b: number) => pts.slice(Math.floor(pts.length * a), Math.ceil(pts.length * b));
  const drawing: OStroke[] = [
    ln([[0, TABLE_BACK], [540, TABLE_BACK + 2], [W, TABLE_BACK - 1]], 40, 2.6), ln([[0, TABLE_FRONT], [540, TABLE_FRONT + 1], [W, TABLE_FRONT]], 41, 3),
    ln(part(POT, 0, 0.3), 45), ln(part(POT, 0.28, 0.55), 46), ln(part(POT, 0.53, 0.78), 47), ln(part(POT, 0.76, 1), 48), ln(MOUTH.slice(0, 22), 49, 2.6), ln(MOUTH.slice(20), 50, 2.6),
    ln(HANDLE_L, 51, 2.6), ln(HANDLE_R, 52, 2.6),
    ln(part(PEAR_A, 0, 0.52), 53), ln(part(PEAR_A, 0.48, 1), 54), ln([pearAt(PA, 140, 0), pearAt(PA, 158, 4), pearAt(PA, 172, 12)], 55, 3.6),
    ln(part(PEAR_B, 0, 0.52), 56), ln(part(PEAR_B, 0.48, 1), 57), ln([pearAt(PB, 80, 0), pearAt(PB, 94, -4), pearAt(PB, 106, -10)], 58, 3.6),
    ...SHADOWS.map((s, i) => ({ ctrl: [s[0], s[8], s[15]] as P[], w: 12, c0: UMBER, load: 0.9, dry: 0.6, impasto: 0, alpha: 0.4, seed: 60 + i })),
    { ctrl: [[836, 560], [850, 660], [820, 760]], w: 22, c0: UMBER, load: 0.9, dry: 0.7, impasto: 0, alpha: 0.4, seed: 64 },
  ];
  S.push({ name: "drawing", strokes: drawing, per: 2.4 });
  // 3. the dark masses: the BIG flat, few broad passes, lean paint, ground peeking between
  S.push({ name: "wall", clip: BG, per: 2, strokes: fill({ region: WALL_R, step: 96, len: 340, w: 130, dir: steep, seed: 100, load: 1.05, dry: 0.42, impasto: 0.04, bend: 0.12, jit: 0.035, soft: 0.25, color: (x, y) => ramp(WALL, wallI(x, y)), sweep: 0 }) });
  S.push({ name: "front", per: 1.6, strokes: fill({ region: FRONT_R, step: 80, len: 380, w: 96, dir: () => 0.015, seed: 110, load: 1.05, dry: 0.4, impasto: 0.05, jit: 0.035, soft: 0.25, color: (x) => ramp(TABLE, 0.02 + 0.14 * (1 - x / W)) }) });
  S.push({ name: "table", clip: BG, per: 1.6, strokes: fill({ region: TABLE_R, step: 58, len: 360, w: 74, dir: () => 0.008, seed: 120, load: 1.05, dry: 0.4, impasto: 0.05, bend: 0.03, jit: 0.035, soft: 0.25, color: (x, y) => ramp(TABLE, tableI(x, y) * 0.8), sweep: 0 }) });
  // the pot's and pears' shadow sides, medium brush, strokes wrapping the forms
  S.push({ name: "pot dark", clip: lost(POT), per: 0.4, strokes: fill({ region: POT, step: 34, len: 300, w: 44, dir: () => 0, path: potHoop, seed: 130, dry: 0.3, impasto: 0.08, jit: 0.03, soft: 0.3, color: (x, y) => (inside(MOUTH, x, y) || copperI(x, y) > 0.3 ? null : copper(x, y)), sweep: 0 }) });
  S.push({ name: "mouth", clip: { keep: [MOUTH] }, per: 0.6, strokes: fill({ region: inset(MOUTH, -6), step: 14, len: 110, w: 20, dir: () => 0, seed: 135, dry: 0.2, impasto: 0.08, jit: 0.06, color: (x, y) => copper(x, y), sweep: 0 }) });
  const colA = planeCol(PA, [350, 842, 30], () => 1), colB = planeCol(PB, [564, 902, 16], shadeB), plA = planeOf(PA, () => 1), plB = planeOf(PB, shadeB);
  S.push({ name: "pear A shadow planes", clip: lost(PEAR_A, 7, 3), per: 0.8, strokes: fill({ region: inset(PEAR_A, -4), step: 19, len: 74, w: 26, dir: () => 0, path: surf(PA), seed: 150, dry: 0.2, impasto: 0.12, jit: 0.03, soft: 0.25, color: (x, y) => (plA(x, y) <= 1 ? colA(x, y) : null), sweep: 3.14 }) });
  S.push({ name: "pear B shadow planes", clip: lost(PEAR_B, 7, 3), per: 0.8, strokes: fill({ region: inset(PEAR_B, -4), step: 17, len: 64, w: 22, dir: () => 0, path: surf(PB), seed: 160, dry: 0.2, impasto: 0.12, jit: 0.03, soft: 0.25, color: (x, y) => (plB(x, y) <= 1 ? colB(x, y) : null), sweep: 3.14 }) });
  // 4. the window as light, the mid tones: the wall's glow near the window laid over the dark in
  //    broad scumbles, the table's lit plane, the forms' half tones
  S.push({ name: "wall glow", clip: BG, per: 2, strokes: fill({ region: [[-40, -40], [560, -40], [460, TABLE_BACK + 8], [-40, TABLE_BACK + 8]], step: 92, len: 300, w: 110, dir: steep, seed: 180, load: 0.95, dry: 0.6, impasto: 0.04, bend: 0.12, jit: 0.035, soft: 0.25, color: (x, y) => ramp(WALL, clamp(wallI(x, y) + 0.16 * clamp(1 - x / 560))), sweep: 0 }) });
  S.push({ name: "handles", per: 1.4, strokes: [HANDLE_L, HANDLE_R].map((h, i) => ({ ctrl: h, w: 12, c0: ramp(COPPER, i ? 0.06 : 0.5), c1: ramp(COPPER, i ? 0.03 : 0.3), load: 1.1, dry: 0.15, impasto: 0.35, seed: 140 + i })) });
  S.push({ name: "table light", clip: BG, per: 1.3, strokes: fill({ region: TABLE_R, step: 44, len: 300, w: 52, dir: () => 0.008, seed: 190, dry: 0.45, impasto: 0.1, bend: 0.03, jit: 0.04, soft: 0.25, color: (x, y) => { const I = tableI(x, y); return I < 0.45 ? null : ramp(TABLE, I); }, sweep: 0 }) });
  S.push({ name: "pot body", clip: lost(POT), per: 0.4, strokes: fill({ region: POT, step: 28, len: 260, w: 36, dir: () => 0, path: potHoop, seed: 200, dry: 0.35, impasto: 0.12, jit: 0.03, soft: 0.3, color: (x, y) => (!inside(MOUTH, x, y) && copperI(x, y) > 0.2 ? copper(x, y) : null), sweep: 0 }) });
  S.push({ name: "pear A half tone", clip: lost(PEAR_A, 7, 3), per: 0.8, strokes: fill({ region: PEAR_A, step: 18, len: 70, w: 25, dir: () => 0, path: surf(PA), seed: 210, dry: 0.2, impasto: 0.18, jit: 0.03, soft: 0.25, color: (x, y) => (plA(x, y) === 2 ? colA(x, y) : null), sweep: 3.14 }) });
  S.push({ name: "pear B half tone", clip: lost(PEAR_B, 7, 3), per: 0.8, strokes: fill({ region: PEAR_B, step: 16, len: 60, w: 21, dir: () => 0, path: surf(PB), seed: 220, dry: 0.2, impasto: 0.18, jit: 0.03, soft: 0.25, color: (x, y) => (plB(x, y) === 2 ? colB(x, y) : null), sweep: 3.14 }) });
  // cast shadows laid back into the lit table: dark and crisp where each thing meets the table, fading out
  SHADOWS.forEach((sh, i) => S.push({ name: `cast shadow ${i}`, clip: BG, per: 0.7, strokes: fill({ region: sh, step: 13, len: 90, w: 18, dir: () => 0.01, seed: 235 + i, dry: 0.35, impasto: 0.08, bend: 0.04, jit: 0.04, color: (x, y) => ramp(TABLE, tableI(x, y) * 0.9), sweep: 0 }) }));
  // 5. the lights: the forms' lit planes, fatter paint, still following the form
  S.push({ name: "pot light", clip: { keep: [POT] }, per: 0.6, strokes: fill({ region: POT, step: 24, len: 200, w: 26, dir: () => 0, path: potHoop, seed: 240, dry: 0.4, impasto: 0.22, jit: 0.03, soft: 0.3, color: (x, y) => (!inside(MOUTH, x, y) && copperI(x, y) > 0.6 ? copper(x, y) : null), sweep: 0 }) });
  S.push({ name: "pear A light plane", clip: { keep: [PEAR_A] }, per: 0.9, strokes: fill({ region: PEAR_A, step: 18, len: 62, w: 23, dir: () => 0, path: surf(PA), seed: 250, dry: 0.22, impasto: 0.3, jit: 0.03, soft: 0.25, color: (x, y) => (plA(x, y) === 3 ? colA(x, y) : null), sweep: 3.14 }) });
  S.push({ name: "pear B light plane", clip: { keep: [PEAR_B] }, per: 0.9, strokes: fill({ region: PEAR_B, step: 16, len: 54, w: 20, dir: () => 0, path: surf(PB), seed: 260, dry: 0.22, impasto: 0.3, jit: 0.03, soft: 0.25, color: (x, y) => (plB(x, y) === 3 ? colB(x, y) : null), sweep: 3.14 }) });
  S.push({ name: "pear edges blended", clip: { keep: [PEAR_A, PEAR_B] }, per: 0.7, strokes: [...blends(PA, PEAR_A, colA, () => 1, 265), ...blends(PB, PEAR_B, colB, shadeB, 266)] });
  // 6. the window in the copper, the lip, the specular, the accents: the small brush, deliberate strokes
  const arc = (y: number, nx0: number, nx1: number) => { const r = R(y), e = OPEN(y) * 1.9, t0 = Math.acos(nx0), t1 = Math.acos(nx1); return [0, 0.5, 1].map((k) => { const t = t0 + (t1 - t0) * k; return [AX + r * Math.cos(t), y + e * r * (Math.sin(t) - 1)] as P; }); };
  const st = (ctrl: P[], w: number, c0: string, seed: number, c1 = c0, imp = 0.5, dry = 0.25, load = 1.1): OStroke => ({ ctrl, w, c0, c1, load, dry, impasto: imp, jit: 0.05, seed });
  S.push({ name: "window in the copper", per: 4, strokes: [
    // three confident strokes of cool sky, each following the belly round, warming as they turn into the copper
    st(arc(598, -0.6, -0.26), 11, "#c6cdca", 300, "#dc9c70", 0.45, 0.55, 1), st(arc(636, -0.64, -0.2), 13, "#d6dbd5", 301, "#e4a678", 0.5, 0.5, 1.05), st(arc(680, -0.58, -0.3), 9, "#b3bdbb", 302, "#c9855a", 0.4, 0.65, 0.95),
  ] });
  // the metal: two pale-gold reflection bands dragged down the belly's curve (the lit wall beside
  // the window, seen in the copper), one broad band near the lit limb, clear of the sky strokes
  const band = (nx: number, y0: number, y1: number): P[] => [y0, (y0 + y1) / 2, y1].map((y) => [AX + nx * R(y), y] as P);
  S.push({ name: "gold bands", clip: { keep: [POT] }, per: 5, strokes: [
    { ctrl: band(-0.8, 560, 748), w: 20, c0: "#f3cd80", c1: "#e39a3a", load: 1.05, dry: 0.55, impasto: 0.35, jit: 0.04, soft: 0.35, seed: 290 },
  ] });
  S.push({ name: "lip", per: 3, strokes: [
    // the inner lip of the far rim, turned up to the light: one bright line
    st(ell(AX, RIM_Y + 1, 136, 136 * OPEN(RIM_Y), Math.PI * 1.12, Math.PI * 1.7, 16), 3.5, "#f7cf86", 284, "#d9913e", 0.6, 0.2, 1.1),
    // the rolled lip, one ellipse at eye level: the back lip dark against the mouth, the front lip lit on the window side
    st(ell(AX, RIM_Y, 146, 146 * OPEN(RIM_Y), Math.PI * 1.04, Math.PI * 1.96, 16), 5, "#6a2c14", 280, "#3a160a", 0.3, 0.15, 1),
    st(ell(AX, RIM_Y, 147, 147 * OPEN(RIM_Y) + 1, Math.PI * 0.97, Math.PI * 0.03, 22), 8, "#e39a5c", 281, "#3e170a", 0.55, 0.1, 1.1),
    st([[AX - 118, RIM_Y + 15], [AX - 92, RIM_Y + 21], [AX - 60, RIM_Y + 24.5]], 4.5, "#f6d7a8", 282, "#e8b47e", 0.8, 0.3),
    st([[476, 551], [460, 556], [454, 572]], 4, "#e0a46e", 283, "#a8582a", 0.7, 0.3),
  ] });
  S.push({ name: "specular", per: 6, strokes: [
    ({ ctrl: [[586, 632], [591, 630.6], [596, 630.4]], w: 7, c0: "#fffdf6", c1: "#fff6e2", load: 1.4, dry: 0, impasto: 1, jit: 0.01, soft: 0, seed: 305 }),        // the one sharp glint of the window, thick
    st([[344, 772], [349, 765], [356, 761]], 5.5, "#f2eabc", 306, "#e0d38c", 0.8, 0.3, 1.2),    // pear A's lit shoulder
    st([[545, 846], [550, 840], [557, 837]], 5, "#efe6b4", 307, "#dccd84", 0.8, 0.3, 1.2),    // pear B's
  ] });
  S.push({ name: "accents", per: 3, strokes: [
    // stems, woody, dark, a lit edge; the calyx a dry dark star at the lying pear's blossom end
    st([pearAt(PA, 140, 0), pearAt(PA, 156, 3), pearAt(PA, 172, 12)], 5.5, "#3a2412", 320, "#6a4424", 0.4, 0.2, 1),
    st([pearAt(PB, 78, 0), pearAt(PB, 92, -3), pearAt(PB, 104, -9)], 5, "#3a2412", 321, "#6a4424", 0.4, 0.2, 1),
    st([pearAt(PB, -52, -8), pearAt(PB, -56, 2)], 5, "#2a2010", 322, "#2a2010", 0.5, 0.6, 1), st([pearAt(PB, -50, 4), pearAt(PB, -57, -4)], 4, "#3a2e14", 323, "#3a2e14", 0.5, 0.6, 1),
    st([pearAt(PA, 150, 1), pearAt(PA, 158, 4)], 2.5, "#8a6440", 324, "#8a6440", 0.3, 0.2, 1),
  ] });
  S.push({ name: "contact", clip: BG, per: 2, strokes: [
    // the crisp dark where each thing presses on the table, tucked under it
    st([[336, 874], [390, 887], [444, 876]], 10, "#1e140b", 325, "#2e1f12", 0.08, 0.45, 1), st([[548, 924], [594, 934], [640, 922]], 9, "#1e140b", 326, "#2e1f12", 0.08, 0.45, 1),
    st([[740, 812], [772, 806], [800, 798]], 10, "#1e140b", 327, "#2e1f12", 0.08, 0.45, 1),
  ] });
  return S;
};

// ---------------------------------------------------------------- the process
const ground = (g: Gfx) => {
  const c = g.cur, e = g.env; c.setTransform(e.scale, 0, 0, e.scale, 0, 0); c.fillStyle = "#efe8da"; c.fillRect(0, 0, e.W, e.H);   // lead-white priming
  weave(g, 0.55);
};
const finish = (g: Gfx) => weave(g, 0.3);
const withClip = (g: Gfx, clip: Clip | undefined, fn: () => void) => {
  if (!clip) return fn();
  const c = g.cur; c.save(); c.beginPath();
  if (clip.keep) { clip.keep.forEach((p) => { c.moveTo(p[0][0], p[0][1]); p.forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); }); c.clip("nonzero"); }
  else { c.rect(-50, -50, W + 100, H + 100); (clip.out ?? []).forEach((p) => { c.moveTo(p[0][0], p[0][1]); p.forEach(([x, y]) => c.lineTo(x, y)); c.closePath(); }); c.clip("evenodd"); }
  fn(); c.restore();
};
const build = (k: number): Proc => {
  const tl = timeline(10, k, true);
  stages().forEach((st, si) => {
    const B = Math.max(1, Math.round(2 / st.per));   // a batch is about two frames of work
    for (let a = 0; a < st.strokes.length; a += B) {
      const batch = st.strokes.slice(a, a + B);
      tl.add(batch.length * st.per, (g, p) => withClip(g, st.clip, () => { const f = p * batch.length; batch.forEach((s, i) => { if (p >= 1 || i < Math.floor(f)) oilStroke(g, s, 1); else if (i === Math.floor(f)) oilStroke(g, s, f - i); }); }));
    }
    tl.wait(si < 2 ? 12 : 5);
  });
  return { id: "paintedOil", medium: OIL_M, ground, ops: tl.ops, finish };
};
const PROC = fit(build, N - 31), END = PROC.ops[PROC.ops.length - 1].t1;

export const STYLE = { id: "paintedOil", name: "Oil on canvas", family: "paint", medium: "opaque oil paint with hog-bristle brushes on a toned linen canvas, lean block-in to fat impasto", nearest: "ranunculus", hero: "two pears and a copper pot by a window" };

export const paintedOil: Film = {
  meta: { title: "Two pears and a copper pot · oil", W, H, fps: 30, bpm: 120, durationFrames: N, raster: "cpu" },
  assets: { images: {} },
  shots: [{ id: "paint", start: 0, end: N, draw: (ctx, f, env) => runProcess(PROC, ctx, Math.min(f, END), env) }],
};
export { lighten, darken };
