// PASTEL BLOTCH WATERCOLOUR · a hand ADAPTED from a reference the owner brought
// (~/Pictures/aquarelle/lightshot-aquarelle.png, a pastel watercolour backdrop behind a terminal
// window; the window is UI, not the hand, and was excluded from the analysis). Grown from the
// nearest plate by eye, ranunculus (pencil & watercolour), with the pencil taken OUT: this hand has
// no drawn line at all. The reference's picture (an abstract rainbow backdrop, the terminal) is not
// used: only its way of making marks. Subject here is new.
//
// MEDIUM RECIPE (written before any code, adapt-a-style.md step 3):
//   MARK   a blotch: one loaded round brush set down and pushed about, so each shape is ONE flat
//          puddle of dilute pigment with a jagged coastline (big lobes plus a fine torn fringe),
//          never an ellipse, never a stroke with a direction.
//   EDGE   hard-dry: the puddle dries with a crisp, slightly darker rim where pigment migrates to
//          the edge, a pale bloom inside. No soft blending into neighbours, no line.
//   ORDER  palest big puddles first, left to dry; smaller, stronger puddles GLAZED over them (the
//          overlaps multiply into deeper secondary colours); paper left bare between islands;
//          a few spatter dots flicked on; last, opaque white gouache sparkles with a halo.
//   PAPER  warm cream cold-press, a soft grain that shows in the washes.
//   PALETTE high key only (the darkest wash is still light): apricot, butter, blush, mauve,
//          lilac, mint, seafoam, powder blue, a clear teal for the deepest glaze.
//
// SUBJECT: a moon jellyfish (Aurelia aurita) drifting in sunlit water. Anatomy: a shallow
// translucent bell, wider than tall, seen a little from the side so its rim is an ellipse; FOUR
// horseshoe-shaped gonads (the pale rings that name it) showing through the bell's top; a fringe
// of many fine marginal tentacles hanging from the rim; four frilly oral arms trailing from the
// centre underneath, longer than the bell is wide. REFERENCE (from knowledge): aquarium and diver
// photographs of Aurelia; its structure only, never a photograph's composition.
// LIGHT: from the surface, above: the top of the bell is left as bare paper, the water deepens
// from apricot at the top to teal at the bottom, the arms catch the light on their upper folds.
import { Gfx, PENCIL, displace, fractal, rng, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";

export const STYLE = { id: "adaptAquarelle", name: "Pastel blotch watercolour", family: "watercolour", medium: "dilute watercolour puddles with hard pooled rims on cream cold-press, white gouache sparkles; no line", nearest: "ranunculus", hero: "a moon jellyfish in sunlit water", house: "styles/house/pastel-blotch.json" };

const PAPER = "#f5f1e6";
const J = { bell: "#c173b8", bell2: "#9d5fb8", gonad: "#a8418c", arm: "#e0708f", arm2: "#b15aa8", fringe: "#9a4e97" }; // the subject: warm magentas against a cool ground, a full value step darker than the water
const C = { apricot: "#f7a86a", butter: "#f7d77e", blush: "#f5b5a6", rose: "#eb97ad", mauve: "#cf95c6", lilac: "#b49ae0", mint: "#a6e0bd", sea: "#8fd3cc", powder: "#9dbdec", teal: "#5fb3b8", deep: "#4f8fc4" }; // the reference is pastel but CLEAN: high key, real chroma
const W = 1080, H = 1080;

const ellipse = (cx: number, cy: number, rx: number, ry: number, rot = 0, n = 72): P[] => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)] as P; });
const densify = (pts: P[], step: number): P[] => { const out: P[] = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); } return out; };
const size = (pts: P[]) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return Math.max(20, Math.min(x1 - x0, y1 - y0)); };
// the coastline: big lobes scaled to the puddle, then a fine torn fringe that is the same size on every puddle (it is the paper's, not the shape's)
// (fractal() sits near 0.5 with a spread of about +-0.15, so the amplitudes are ~3x the visible wobble)
const coast = (pts: P[], seed: number, lobes = 1): P[] => { const s = size(pts); return displace(displace(displace(densify(pts, 3), s * 0.9 * lobes, 1.4 / s, 2, seed), s * 0.22 * lobes, 5 / s, 2, seed + 7), 13, 0.06, 3, seed + 17); };
const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const darker = (c: string, k: number) => { const [r, g, b] = hex(c); return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`; };
const path = (c: Ctx, pts: P[]) => { c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };

// ONE puddle: flat pigment, a darker dried rim, a paler bloom inside. `holes` are reserved paper.
const puddle = (g: Gfx, shape: P[], col: string, o: { seed: number; a?: number; rim?: number; lobes?: number; holes?: P[][] }) => {
  const c = g.cur, edge = coast(shape, o.seed, o.lobes ?? 1), a = o.a ?? 0.55; g.mark(edge, 12);
  c.save(); if (o.holes?.length) { c.beginPath(); c.rect(-50, -50, W + 100, H + 100); o.holes.forEach((h) => path(c, h)); c.clip("evenodd"); } // reserved paper: the brush went round it
  c.beginPath(); path(c, edge); c.globalAlpha = a; c.fillStyle = col; c.fill();
  c.globalAlpha = (o.rim ?? 0.5) * a; c.strokeStyle = darker(col, 0.72); c.lineWidth = 3; c.lineJoin = "round"; c.beginPath(); path(c, edge); c.stroke();
  // the bloom: where the water pushed pigment outward as it dried, the middle is a shade paler (drawn as the paper colour, thin)
  const r = rng(o.seed * 7 + 3), s = size(shape), cx = shape.reduce((t, p) => t + p[0], 0) / shape.length, cy = shape.reduce((t, p) => t + p[1], 0) / shape.length;
  if (s > 60 && !o.holes?.length) { c.globalAlpha = 0.16; c.fillStyle = PAPER; c.beginPath(); path(c, coast(ellipse(cx + (r() - 0.5) * s * 0.2, cy + (r() - 0.5) * s * 0.2, s * 0.22, s * 0.17, r() * 3), o.seed + 9, 0.8)); c.fill(); }
  c.globalAlpha = 1; c.restore();
};
const sparkle = (c: Ctx, x: number, y: number, s: number, rot: number) => {
  const gr = c.createRadialGradient(x, y, 0, x, y, s * 1.6); gr.addColorStop(0, "rgba(255,255,250,0.85)"); gr.addColorStop(0.3, "rgba(255,255,250,0.35)"); gr.addColorStop(1, "rgba(255,255,250,0)"); c.fillStyle = gr; c.fillRect(x - s * 2, y - s * 2, s * 4, s * 4);
  c.fillStyle = "rgba(255,255,252,0.97)";
  for (const [ax, ay, len, wid] of [[Math.cos(rot), Math.sin(rot), s * 2.2, s * 0.16], [-Math.sin(rot), Math.cos(rot), s * 1.6, s * 0.14]] as number[][]) { c.beginPath(); c.moveTo(x - ax * len, y - ay * len); c.quadraticCurveTo(x - ay * wid, y + ax * wid, x + ax * len, y + ay * len); c.quadraticCurveTo(x + ay * wid, y - ax * wid, x - ax * len, y - ay * len); c.fill(); }
};

// ---------------------------------------------------------------- the jellyfish
const BELL = { cx: 548, top: 250, rimY: 452, rx: 232, ry: 58 };
const bellShape = (): P[] => { const out: P[] = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = Math.PI + t * Math.PI; out.push([BELL.cx + Math.cos(a) * BELL.rx, BELL.rimY + Math.sin(a) * (BELL.rimY - BELL.top) * (0.92 + 0.08 * Math.sin(t * Math.PI))]); } for (let i = 1; i < 30; i++) { const a = (i / 30) * Math.PI; out.push([BELL.cx + Math.cos(a) * BELL.rx, BELL.rimY + Math.sin(a) * BELL.ry]); } return out; };
// a horseshoe: a thick arc seen through the curved top of the bell
const horseshoe = (cx: number, cy: number, r: number, open: number, sq: number): P[] => { const o: P[] = [], i2: P[] = []; for (let k = 0; k <= 24; k++) { const a = open + 0.55 + (k / 24) * (Math.PI * 2 - 1.1); o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * sq]); i2.push([cx + Math.cos(a) * r * 0.52, cy + Math.sin(a) * r * 0.52 * sq]); } return [...o, ...i2.reverse()]; };
// an oral arm: a ribbon that wavers as it trails, its frilled edge given by the puddle's own coastline
// oral arms are frilled curtains, not limbs: wide and ruffled under the bell, twisting as they sway, thinning to wisps
const arm = (x0: number, y0: number, len: number, lean: number, w0: number, seed: number): P[] => { const r = rng(seed), L: P[] = [], R: P[] = [], n = 40, ph = r() * 6; for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + lean * t * len + Math.sin(t * 7 + ph) * 40 * t, y = y0 + t * len * (1 - 0.1 * t), twist = 0.55 + 0.45 * Math.abs(Math.cos(t * 6 + ph)), w = w0 * Math.pow(1 - t, 0.8) * twist + 2, fr = (k: number) => Math.sin(t * 60 + k + ph) * 6 * (1 - t); L.push([x - w + fr(0), y]); R.push([x + w + fr(2), y]); } return [...L, ...R.reverse()]; };
// all four drift the same way (the current carries them), one leads, never splayed like legs
const ARMS = [[528, 468, 380, 0.22, 36, 61], [556, 474, 450, 0.34, 42, 62], [582, 470, 330, 0.46, 34, 63], [544, 478, 270, 0.12, 28, 64]] as const;

const draw = (ctx: Ctx, _f: number, env: Env) => {
  const g = new Gfx(ctx, env, 0, PENCIL), r = rng(4242);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const bell = bellShape(), reserve: P[][] = [displace(densify(bell.map(([x, y]) => [BELL.cx + (x - BELL.cx) * 1.14, 470 + (y - 470) * 1.14] as P), 3), 20, 0.07, 3, 5)]; // the painter works AROUND the jellyfish's bell
  // 1. the water: pale big puddles, warm near the surface, cool below, islands of bare paper between
  const rows = [{ y: 90, cols: [C.apricot, C.butter, C.sea, C.apricot, C.butter, C.mint] }, { y: 300, cols: [C.butter, C.mint, C.sea, C.powder, C.apricot, C.sea] }, { y: 520, cols: [C.mint, C.lilac, C.sea, C.powder, C.mint, C.lilac] }, { y: 740, cols: [C.sea, C.powder, C.teal, C.mint, C.powder, C.sea] }, { y: 960, cols: [C.powder, C.teal, C.sea, C.deep, C.teal, C.powder] }];
  g.group("paint", () => rows.forEach((row, ri) => row.cols.forEach((col, ci) => {
    if ((ri * 7 + ci * 3) % 3 === 1) return; // a third of the places stay bare paper: rests the eye can breathe in // a bare rest: not every place gets a puddle
    const x = 40 + ci * 205 + (ri % 2) * 90 + (r() - 0.5) * 60, y = row.y + (r() - 0.5) * 60, rx = 115 + r() * 60, ry = 95 + r() * 45;
    puddle(g, ellipse(x, y, rx, ry, r() * 3), col, { seed: 100 + ri * 10 + ci, a: 0.62, rim: 0.8, holes: ri < 3 ? reserve : undefined });
  })), { blend: "multiply", blur: 1.6 }); // the first, wettest puddles dried with a slightly softer edge
  // 2. glazes: smaller, stronger puddles over the first, some crossing each other
  g.group("paint", () => { for (let i = 0; i < 5; i++) { const band = i % 5, x = 60 + r() * 960, y = 60 + band * 220 + (r() - 0.5) * 120, near = Math.hypot(x - BELL.cx, (y - 380) * 1.6) < 300; if (near && band < 2) continue; const col = [C.apricot, C.rose, C.lilac, C.sea, C.teal][band]; puddle(g, ellipse(x, y, 50 + r() * 50, 40 + r() * 40, r() * 3), col, { seed: 300 + i, a: 0.34, rim: 0.6, holes: reserve }); } }, { blend: "multiply" });
  // 3. the jellyfish: bell wash with the sunlit top left as paper, the gonads, the arms, the fringe
  const hi = coast(ellipse(BELL.cx - 70, BELL.top + 58, 105, 30, -0.18), 511, 0.15);
  g.group("paint", () => { puddle(g, bell, J.bell, { seed: 501, a: 0.62, rim: 1, lobes: 0.03, holes: [hi] }); puddle(g, ellipse(BELL.cx, BELL.rimY, BELL.rx * 0.96, BELL.ry * 0.9), J.bell2, { seed: 502, a: 0.45, rim: 0.9, lobes: 0.03 }); }, { blend: "multiply" });
  g.group("paint", () => { // four horseshoes in a clover round the bell's centre, each opening toward the middle, foreshortened by the tilt
    [0.8, 2.35, 3.9, 5.5].forEach((a, i) => { const x = BELL.cx + Math.cos(a) * 58, y = 392 + Math.sin(a) * 30; puddle(g, horseshoe(x, y, 42, a + Math.PI - 0.2, 0.58), J.gonad, { seed: 520 + i, a: 0.42, rim: 0.7, lobes: 0.03 } /* big soft rings touching in a clover: small dark ones read as a face */); }); }, { blend: "multiply" });
  g.group("paint", () => ARMS.forEach(([x, y, len, lean, w, s]) => puddle(g, arm(x, y, len, lean, w, s), s % 2 ? J.arm : J.arm2, { seed: s, a: 0.55, rim: 1, lobes: 0.04 })), { blend: "multiply" });
  // the marginal tentacles: the only thin marks, a rigger brush dragged down from the rim and lifted
  g.group("paint", () => { for (let i = 0; i < 46; i++) { const t = i / 45, a = Math.PI * (0.02 + t * 0.96), x = BELL.cx + Math.cos(a) * BELL.rx * 0.97, y = BELL.rimY + Math.sin(a) * BELL.ry * 0.9, len = 70 + r() * 110 + Math.sin(t * Math.PI) * 60, ph = r() * 6; const pts: P[] = Array.from({ length: 8 }, (_, k) => [x + Math.sin(k * 0.7 + ph) * 7 * (k / 7) + (k / 7) * (x - BELL.cx) * 0.08, y + (k / 7) * len] as P); g.pen(pts, { w: 1.2, color: i % 3 ? J.fringe : J.arm, seed: 700 + i, opacity: 0.8, boil: 0, wobble: 0.4, retrace: false, taper: 1 }); } }, { blend: "multiply" });
  // 4. spatter: pigment flicked off the brush, a few, in drifts
  const c = g.cur; ctx.save(); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  for (let i = 0; i < 38; i++) { const cluster = [[180, 220], [880, 160], [860, 720], [200, 820], [520, 900]][i % 5], x = cluster[0] + (r() - 0.5) * 260, y = cluster[1] + (r() - 0.5) * 200, s = 1.4 + r() * r() * 5.5; ctx.globalAlpha = 0.55; ctx.fillStyle = [C.rose, C.teal, C.apricot, C.lilac, C.deep][i % 5]; ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  // 5. white gouache sparkles last: bioluminescent glints round the bell and sunlight in the water
  [[330, 250, 17, 0.1], [800, 300, 12, 0.3], [700, 560, 21, 0.05], [410, 610, 10, 0.2], [940, 470, 16, 0.15], [140, 470, 13, 0.25], [860, 900, 18, 0.1], [260, 980, 12, 0.2], [620, 170, 9, 0.3], [470, 760, 9, 0.1], [90, 120, 14, 0.05]].forEach(([x, y, s, rt]) => sparkle(ctx, x, y, s, rt));
  ctx.restore(); void c; void fractal;
  g.paper("coldpress", 0.1); g.paper("paper", 0.05);
};

export const adaptAquarelle: Film = { meta: { title: "Moon jellyfish · pastel blotch watercolour (adapted hand)", W, H, fps: 30, bpm: 120, durationFrames: 1 }, assets: { images: {} }, shots: [{ id: "still", start: 0, end: 1, draw }] };
