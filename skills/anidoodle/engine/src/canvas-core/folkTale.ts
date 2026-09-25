import { rng, type Ctx, type Gfx, type Medium, type P } from "./core";
import type { Film } from "./film";
import { clamp, mix } from "./gallery";
import { fit, runProcess, timeline, type Proc } from "./sumiEKit";
import {
  bell, bbox, daisy, darken, dogRose, faded, far, glowBand, gouache, gourdLeaf, grass, HAZE, leaf, leafGeom, lighten, limb, lineLeaf, lineLimb, pencil, pumpkin,
  radial, ramp, reveal, rgba, ribbonOf, sheet, sketch, smooth, stroke, sunflower, tendril, trace, umbel, type Box, type Gouache, type Grass, type Leaf, type Line, type Sun,
} from "./folkTaleKit";

// THE BOY WITH THE ROOSTER · a Russian folk-tale storybook painting.
//
// MEDIUM, physically: gouache and transparent watercolour over an HB graphite drawing on a warm
// cream cartridge sheet. The whole picture is drawn in pencil first. Then it is painted from the
// back to the front, and the paint gets thicker and richer the nearer the thing is: the far
// village is never painted at all (bare pencil on the cream), the middle distance is a thin pale
// wash that lets the drawing through and dissolves into a golden haze, and the foreground is
// opaque body colour laid with a half-dry round brush, so every leaf, petal and blade shows its
// brush drag. DEPTH IS THE MEDIUM: nearness is said by how much paint there is.
// MARKS: pencil lines that breathe with the hand's pressure and are gone over twice; flat opaque
// fills cut by the brush; dry-brush drags inside them; sponge-like mottle in the dark leaves;
// painted veins (a lighter midrib, side veins leaving it toward the margin); sunflower rays laid
// one by one, creased, the sun half lighter; grass as thousands of single blades.
// EDGE: foreground edges crisp and slightly darker where the gouache settles; middle-distance
// edges soft, the paint stopping short of the line; far edges are the pencil line itself.
// ORDER: bare sheet; the whole scene in pencil, big shapes first; a warm glow wash in the sky;
// the meadow laid back to front; the birch wood from far (line) to near (paint); the cottage,
// thinning out into its own drawing; the haze; the fence; the path; the boy and his rooster;
// the pumpkin patch; the sunflowers; foreground grass and flowers; last accents (cheeks, eyes,
// highlights, florets).
// PALETTE: cream paper, sap and olive greens, yellow ochre, cadmium yellow and orange, vermilion,
// cobalt violet for the bellflowers, burnt umber, Payne's grey only in the far pencil.
// LIGHT: a late-summer afternoon sun, low and to the upper left, seen as a golden haze in the
// middle distance; every cast shadow falls to the lower right.
// SUBJECT: a village kitchen garden at the edge of a birch wood. A small boy (about six years
// old, a little under six heads tall: big round head, short neck, short limbs, feet planted
// apart) carries a rooster against his chest on the path through the wattle fence; behind him
// the log cottage (izba) with carved window frames and a horse-head ridge, and far off the
// onion domes of the village church, a bell tower and a post mill.
// REFERENCE (from knowledge): Russian folk-tale book illustration in the storybook-painting
// tradition (gouache over pencil, the drawing left bare at the back); Russian wooden
// architecture (the izba's log corners, carved nalichniki, the konyok ridge; onion domes on
// drums, a tented bell tower, the Orthodox cross); the botany of Helianthus annuus, Cucurbita
// pepo, Betula pendula (white bark with dark lenticels, pendulous twigs, serrate leaves),
// Campanula, Rosa canina, ox-eye daisy; a Russian Orloff-type farmyard cock; children's
// proportions (a six-year-old: ~5.8 heads, the navel near half height).

export const W = 1920, H = 1080;
const N = 540;                 // 18 s; the last 30 frames are the finished painting
const FT_M: Medium = { nib: 1, taper: 1, pressure: 1, retrace: false, wobble: 0, rough: 0 };

// ---------------------------------------------------------------- the far distance: pencil only
const onion = (cx: number, base: number, w: number, h: number, seed: number, a = 0.55): Line[] => {
  const L: P[] = [[cx - w * 0.32, base], [cx - w * 0.5, base - h * 0.28], [cx - w * 0.44, base - h * 0.52], [cx - w * 0.16, base - h * 0.8], [cx, base - h]];
  const R = L.slice(0, -1).reverse().map(([x, y]) => [2 * cx - x, y] as P);
  const top = base - h;
  return [
    { pts: [...L, ...R], seed, a, w: 0.9 },
    { pts: [[cx, top], [cx, top - h * 0.45]], seed: seed + 1, a, w: 0.8, retrace: false },
    { pts: [[cx - w * 0.14, top - h * 0.33], [cx + w * 0.14, top - h * 0.33]], seed: seed + 2, a, w: 0.7, retrace: false },
    { pts: [[cx - w * 0.1, top - h * 0.14], [cx + w * 0.1, top - h * 0.2]], seed: seed + 3, a, w: 0.7, retrace: false },
    { pts: [[cx - w * 0.26, base - h * 0.2], [cx, base - h * 0.16], [cx + w * 0.26, base - h * 0.2]], seed: seed + 4, a: a * 0.5, w: 0.6, retrace: false },
  ];
};
const box4 = (x0: number, y0: number, x1: number, y1: number, seed: number, a = 0.5): Line[] => [
  { pts: [[x0, y1], [x0, y0]], seed, a }, { pts: [[x1, y0], [x1, y1]], seed: seed + 1, a }, { pts: [[x0 - 2, y0], [x1 + 2, y0]], seed: seed + 2, a },
];
const house = (x: number, y: number, w: number, h: number, seed: number, a = 0.45): Line[] => [
  ...box4(x, y - h, x + w, y, seed, a),
  { pts: [[x - 5, y - h + 2], [x + w / 2, y - h - h * 0.8], [x + w + 5, y - h + 2]], seed: seed + 5, a },
  { pts: [[x + w / 2, y - h - h * 0.8], [x + w * 1.6, y - h - h * 0.72], [x + w * 1.62, y - h * 0.9]], seed: seed + 6, a: a * 0.8 },
  { pts: [[x + w, y], [x + w * 1.6, y - 3]], seed: seed + 7, a: a * 0.6 },
  ...box4(x + w * 0.35, y - h * 0.7, x + w * 0.65, y - h * 0.3, seed + 8, a * 0.7),
];
// a tree in line, the way the far trees in this tradition are drawn: a scalloped crown and a trunk
const lineTree = (cx: number, base: number, rx: number, ry: number, seed: number, a = 0.45): Line[] => {
  const r = rng(seed), pts: P[] = [], n = 13 + Math.floor(r() * 5), cy = base - ry * 1.25;
  for (let i = 0; i <= n; i++) { const th = Math.PI * 0.62 + (i / n) * Math.PI * 1.76, bump = 0.86 + 0.14 * Math.abs(Math.sin(i * 1.7 + r())); pts.push([cx + Math.cos(th) * rx * bump, cy + Math.sin(th) * ry * bump]); }
  const inner: P[] = []; for (let i = 0; i < 4; i++) { const th = -Math.PI * 0.8 + i * 0.5; inner.push([cx + Math.cos(th) * rx * 0.5, cy + Math.sin(th) * ry * 0.45]); }
  return [
    { pts, seed, a, w: 0.85 },
    { pts: inner, seed: seed + 1, a: a * 0.45, w: 0.7, retrace: false },
    { pts: [[cx - rx * 0.1, base], [cx - rx * 0.08, cy + ry * 0.75]], seed: seed + 2, a, w: 0.8 },
    { pts: [[cx + rx * 0.1, base], [cx + rx * 0.06, cy + ry * 0.75]], seed: seed + 3, a, w: 0.8 },
  ];
};
const FAR: Line[] = (() => {
  const L: Line[] = [];
  // the far ridge the village sits on
  L.push({ pts: [[0, 598], [180, 590], [380, 596], [560, 584], [760, 590], [980, 582], [1180, 590], [1380, 584], [1560, 592], [1760, 586], [1920, 590]], seed: 11, a: 0.45, w: 1 });
  L.push({ pts: [[520, 604], [700, 612], [900, 606], [1100, 614], [1250, 608]], seed: 12, a: 0.25, w: 0.8, retrace: false });
  // the church: a cube, four small domes, a drum and a big onion
  L.push(...box4(812, 522, 912, 590, 20, 0.55));
  L.push({ pts: [[806, 524], [862, 500], [918, 524]], seed: 24, a: 0.5 });
  L.push(...box4(846, 470, 878, 505, 25, 0.55));
  L.push(...onion(862, 472, 50, 58, 30, 0.6));
  L.push(...box4(818, 488, 832, 520, 36, 0.45), ...onion(825, 490, 20, 26, 40, 0.5));
  L.push(...box4(892, 488, 906, 520, 46, 0.45), ...onion(899, 490, 20, 26, 50, 0.5));
  L.push(...box4(840, 548, 852, 572, 55, 0.35), ...box4(872, 548, 884, 572, 56, 0.35));
  // the tented bell tower, left of the church
  L.push(...box4(744, 486, 776, 592, 60, 0.55), ...box4(748, 486, 772, 458, 62, 0.5));
  L.push({ pts: [[744, 458], [760, 404], [776, 458]], seed: 64, a: 0.55 });
  L.push(...onion(760, 404, 14, 20, 66, 0.5));
  L.push(...box4(754, 468, 766, 482, 69, 0.35));
  // log houses and gardens round the church
  L.push(...house(620, 598, 46, 26, 70), ...house(688, 596, 40, 22, 80), ...house(944, 594, 50, 28, 90), ...house(1020, 598, 38, 22, 100), ...house(1080, 596, 34, 20, 110, 0.35));
  L.push(...lineTree(586, 598, 26, 20, 120), ...lineTree(716, 592, 22, 18, 130, 0.4), ...lineTree(930, 588, 30, 22, 140), ...lineTree(1000, 590, 20, 16, 150, 0.4), ...lineTree(1135, 594, 28, 22, 160, 0.4), ...lineTree(1180, 596, 22, 17, 170, 0.35));
  // a post mill on the rise to the right
  L.push(...box4(1228, 520, 1252, 556, 180, 0.45), { pts: [[1224, 522], [1240, 506], [1256, 522]], seed: 184, a: 0.45 }, { pts: [[1240, 556], [1240, 588]], seed: 185, a: 0.45 }, { pts: [[1226, 590], [1240, 570], [1254, 590]], seed: 186, a: 0.35 });
  for (let k = 0; k < 4; k++) { const a0 = 0.5 + k * (Math.PI / 2), ex = 1240 + Math.cos(a0) * 50, ey = 526 + Math.sin(a0) * 50, nx = -Math.sin(a0) * 6, ny = Math.cos(a0) * 6; L.push({ pts: [[1240, 526], [ex, ey]], seed: 190 + k, a: 0.45, retrace: false }, { pts: [[1240 + Math.cos(a0) * 14 + nx, 526 + Math.sin(a0) * 14 + ny], [ex + nx, ey + ny]], seed: 195 + k, a: 0.3, w: 0.7, retrace: false }); }
  // far line trees along the ridge, right
  L.push(...lineTree(1330, 590, 34, 26, 200, 0.35), ...lineTree(1400, 586, 24, 20, 210, 0.3), ...lineTree(1720, 590, 40, 30, 220, 0.35), ...lineTree(1800, 592, 30, 24, 230, 0.3));
  return L.map((l) => ({ ...l, a: Math.min(0.85, (l.a ?? 0.5) * 1.45) }));
})();

// ---------------------------------------------------------------- the birch wood
type Birch = { x: number; base: number; w: number; lean: number; d: number; seed: number };
const BIRCHES: Birch[] = [
  { x: 640, base: 668, w: 7, lean: 6, d: 1, seed: 301 }, { x: 588, base: 676, w: 9, lean: -4, d: 1, seed: 302 },
  { x: 520, base: 688, w: 11, lean: 10, d: 0.85, seed: 303 }, { x: 444, base: 704, w: 15, lean: -8, d: 0.66, seed: 304 },
  { x: 356, base: 726, w: 20, lean: 12, d: 0.48, seed: 305 }, { x: 246, base: 756, w: 28, lean: -10, d: 0.28, seed: 306 },
  { x: 118, base: 792, w: 36, lean: 16, d: 0.12, seed: 307 }, { x: 22, base: 830, w: 42, lean: -6, d: 0.05, seed: 308 },
];
const trunkOf = (b: Birch): P[] => { const r = rng(b.seed), H0 = b.base + 30; return [[b.x, b.base + 6], [b.x + b.lean * 0.2 + (r() - 0.5) * b.w * 0.8, b.base - H0 * 0.25], [b.x + b.lean * 0.45 + (r() - 0.5) * b.w * 1.4, b.base - H0 * 0.5], [b.x + b.lean * 0.75 + (r() - 0.5) * b.w * 1.6, b.base - H0 * 0.76], [b.x + b.lean * 1.3 + (r() - 0.5) * b.w * 2, -30]]; };
const trunkAt = (b: Birch, t: number): P => { const s = smooth(trunkOf(b), 10), i = Math.min(s.length - 1, Math.round(t * (s.length - 1))); return s[i]; };
// pendulous birch twigs: out from the trunk, then hanging, leaves alternate along them
type Spray = { twig: P[]; leaves: Leaf[]; d: number; seed: number };
const spray = (x: number, y: number, dir: number, l: number, d: number, seed: number, col = "#7c9c36"): Spray => {
  const r = rng(seed), twig: P[] = [[x, y]]; let a = dir, px = x, py = y;
  for (let i = 0; i < 7; i++) { a += (Math.PI / 2 - a) * 0.22 + (r() - 0.5) * 0.12; px += Math.cos(a) * l / 7; py += Math.sin(a) * l / 7; twig.push([px, py]); }
  const s = smooth(twig, 6), leaves: Leaf[] = [];
  for (let i = 3; i < s.length; i += 3) {
    const side = (i / 3) % 2 ? 1 : -1, q = s[i], nx = s[Math.min(s.length - 1, i + 1)][0] - s[i - 1][0], ny = s[Math.min(s.length - 1, i + 1)][1] - s[i - 1][1], ta = Math.atan2(ny, nx);
    const hue = r(), lc = hue < 0.3 ? lighten(col, 0.15) : hue < 0.6 ? col : mix(col, "#4f6d2a", 0.5);
    leaves.push({ x: q[0], y: q[1], a: ta + side * (0.5 + r() * 0.5), len: 15 + r() * 9, wid: 11 + r() * 5, col: lc, seed: seed * 50 + i, d, serr: 0.1, stalk: 3, round: 0.62 });
  }
  return { twig, leaves, d, seed };
};
const SPRAYS: Spray[] = (() => {
  const out: Spray[] = [], r = rng(401);
  BIRCHES.forEach((b, bi) => {
    const nS = b.d >= 0.95 ? 5 : b.d > 0.6 ? 7 : 10;
    for (let k = 0; k < nS; k++) {
      const t = 0.62 + (k / nS) * 0.36 + r() * 0.04, [x, y] = trunkAt(b, t), side = k % 2 ? 1 : -1, dir = side > 0 ? -0.5 - r() * 0.5 : Math.PI + 0.5 + r() * 0.5;
      out.push(spray(x, y, dir, 60 + r() * 70 + (1 - b.d) * 40, b.d, 500 + bi * 40 + k));
    }
  });
  // the canopy that hangs into the top of the picture from the nearest birches, out over the garden
  for (let k = 0; k < 16; k++) { const x = 40 + k * 44 + r() * 20, y = -10 + r() * 60, d = clamp((x - 150) / 700) * 0.9; out.push(spray(x, y, Math.PI / 2 + (r() - 0.5) * 1.2, 90 + r() * 90, d, 900 + k)); }
  return out.sort((a, b) => b.d - a.d);
})();
const birchLines = (b: Birch): Line[] => { const s = trunkOf(b); return lineLimb(b.w, b.w * 0.6, s, b.seed, 0.55); };
const paintBirch = (g: Gfx, b: Birch, p: number) => {
  const s = trunkOf(b), d = b.d, r = rng(b.seed + 1);
  if (d >= 0.95) return;
  const body = (c: Ctx) => {
    limb(c, s, b.w, b.w * 0.6, "#efeadb", b.seed, d * 0.6, p, 0.28, 0);
    if (p < 1) return;
    // lenticels: dark dashes across the bark, crowded and fissured toward the foot
    const sm = smooth(s, 10), n = sm.length;
    for (let i = 0; i < Math.round(30 + b.w * 1.6); i++) {
      const t = Math.pow(r(), 1.2), idx = Math.min(n - 2, Math.floor(t * (n - 1))), [x, y] = sm[n - 1 - idx], w = b.w * (1 - 0.4 * (1 - t)), big = r() < 0.12, l = w * (big ? 0.35 + r() * 0.4 : 0.12 + r() * 0.4), off = (r() - 0.5) * w * 0.75, th = big ? w * (0.05 + r() * 0.06) : Math.max(0.4, w * (0.012 + r() * 0.02));
      c.globalAlpha = (big ? 0.8 : 0.45 + r() * 0.4) * (1 - 0.5 * d); c.fillStyle = far(big ? "#1f1c19" : "#3a342e", d * 0.8);
      const x0 = x + off - l / 2, x1 = x + off + l / 2, tilt = (r() - 0.5) * 2; c.beginPath(); c.moveTo(x0, y + tilt * 0.3); c.quadraticCurveTo(x + off, y - th - tilt, x1, y - tilt * 0.3); c.quadraticCurveTo(x + off + (r() - 0.5) * l * 0.3, y + th * (big ? 1.4 : 1), x0, y + tilt * 0.3); c.fill();
    }
    for (let i = 0; i < Math.round(b.w * 1.2); i++) { const t = r(), idx = Math.min(n - 2, Math.floor(t * (n - 1))), [x, y] = sm[idx], w = b.w * 0.9, off = (r() - 0.5) * w * 0.6; c.globalAlpha = 0.25 * (1 - d); c.strokeStyle = r() < 0.5 ? "#b8b2a6" : "#fffaf0"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + off - w * 0.2, y); c.lineTo(x + off + w * 0.2, y + (r() - 0.5) * 2); c.stroke(); }
    const [bx, by] = s[0]; // the dark fissured foot of an old birch
    c.save(); trace(c, [[bx - b.w * 0.6, by], [bx - b.w * 0.5, by - b.w * 2.2], [bx + b.w * 0.5, by - b.w * 1.6], [bx + b.w * 0.6, by]]); c.clip();
    for (let k = 0; k < 14; k++) { const x = bx - b.w * 0.5 + r() * b.w, y0 = by - r() * b.w * 2.2; stroke(c, [[x, y0], [x + (r() - 0.5) * 3, y0 + b.w * 0.6]], 2.2, 0.8, far("#2e2923", d * 0.8), 0.7 * (1 - 0.5 * d)); }
    c.restore();
  };
  if (d > 0.3) { const bb: Box = [b.x - 60, -40, b.x + 60, b.base + 20]; faded(g, bb, (m) => ramp(m, bb, [0, b.base], [0, b.base - 520 * (1 - d * 0.4)], [[0, 1 - d * 0.5], [0.55, 0.9 - d * 0.6], [1, 0]]), body); }
  else body(g.cur);
};
const paintSpray = (g: Gfx, S: Spray, p: number) => {
  const c = g.cur, d = S.d;
  if (d >= 0.93) { S.leaves.forEach((L, i) => lineLeaf(c, L, clamp(p * S.leaves.length - i), undefined)); return; }
  stroke(c, S.twig, 1.8, 0.6, far("#4b3f33", d), 0.9 * (1 - 0.5 * d), clamp(p * 2), 4);
  S.leaves.forEach((L, i) => leaf(c, L, clamp((p - 0.2) / 0.8 * S.leaves.length - i)));
};
const sprayLines = (S: Spray): Line[] => [{ pts: S.twig, seed: S.seed, a: 0.4, w: 0.7, retrace: false }, ...(S.d > 0.55 ? S.leaves.map((L) => ({ pts: leafGeom(L).outline.filter((_, i) => i % 3 === 0), seed: L.seed, a: 0.4, w: 0.7, closed: true, retrace: false, per: 3 } as Line)) : [])];

// ---------------------------------------------------------------- the cottage (izba), middle distance
const COT = { x0: 1300, x1: 1480, gy: 662, ey: 546, peak: 420, bx: 1600, lift: 14 };
const cottageLines = (): Line[] => {
  const { x0, x1, gy, ey, peak, bx, lift } = COT, cx = (x0 + x1) / 2, L: Line[] = [], a = 0.62;
  L.push({ pts: [[x0, gy], [x0, ey]], seed: 601, a }, { pts: [[x1, gy], [x1, ey]], seed: 602, a }, { pts: [[x0, gy], [x1, gy]], seed: 603, a });
  L.push({ pts: [[x1, gy], [bx, gy - lift]], seed: 604, a }, { pts: [[bx, gy - lift], [bx, ey - lift]], seed: 605, a: a * 0.8 });
  L.push({ pts: [[x0 - 18, ey + 6], [cx, peak], [x1 + 18, ey + 6]], seed: 606, a, w: 1.2 });
  L.push({ pts: [[cx, peak], [bx + 16, peak - lift]], seed: 607, a }, { pts: [[x1 + 18, ey + 6], [bx + 30, ey - lift + 2]], seed: 608, a });
  for (let k = 1; k < 10; k++) { const y = ey + ((gy - ey) * k) / 10; L.push({ pts: [[x0 + 2, y], [x1 - 2, y]], seed: 610 + k, a: 0.32, w: 0.8, retrace: false }, { pts: [[x1 + 2, y], [bx - 2, y - lift * ((y - ey) / (gy - ey)) - lift * (1 - (y - ey) / (gy - ey))]], seed: 630 + k, a: 0.25, w: 0.7, retrace: false }); }
  // carved window frame (nalichnik) on the gable end, the attic window, the ridge horse
  L.push(...box4(cx - 22, 566, cx + 22, 618, 650, 0.6), { pts: [[cx - 30, 566], [cx, 548], [cx + 30, 566]], seed: 655, a: 0.6 }, { pts: [[cx - 28, 626], [cx + 28, 626]], seed: 656, a: 0.5 });
  L.push(...box4(cx - 10, 476, cx + 10, 500, 660, 0.5));
  L.push({ pts: [[cx - 2, peak + 2], [cx - 8, peak - 16], [cx - 20, peak - 22], [cx - 26, peak - 16], [cx - 16, peak - 12], [cx - 10, peak - 2]], seed: 665, a: 0.6 });
  L.push(...box4(1508, 572, 1540, 610, 670, 0.45), ...box4(1556, 568, 1584, 604, 675, 0.4));
  L.push({ pts: [[1530, 468], [1530, 420], [1552, 416], [1552, 462]], seed: 680, a: 0.5 });
  return L;
};
const paintCottage = (g: Gfx, p: number) => {
  const c = g.cur, { x0, x1, gy, ey, peak, bx, lift } = COT, cx = (x0 + x1) / 2, d = 0.42, r = rng(700);
  const bb: Box = [x0 - 40, peak - 60, bx + 50, gy + 30];
  faded(g, bb, (m) => radial(m, bb, 1370, 640, 40, 300, [[0, 0.95], [0.45, 0.8], [0.8, 0.25], [1, 0]], 0.9), (k) => reveal(k, bb, -2.4, p, 710, () => {
    const logs = (poly: P[], cols: [string, string], y0: number, y1: number, slope: number, xA: number, xB: number) => {
      gouache(k, poly, far(cols[0], d), { seed: 720, tex: { cols: [far(cols[1], d), far(lighten(cols[0], 0.3), d)], n: 90, len: 40, w: 4, ang: slope, jit: 0.08, a: 0.35 } });
      k.save(); trace(k, poly); k.clip();
      for (let i = 0; i < 10; i++) { const y = y0 + ((y1 - y0) * (i + 1)) / 10; k.globalAlpha = 0.55; k.strokeStyle = far(darken(cols[0], 0.45), d); k.lineWidth = 2.6; k.beginPath(); k.moveTo(xA, y); k.lineTo(xB, y + slope * (xB - xA)); k.stroke(); k.globalAlpha = 0.35; k.strokeStyle = far(lighten(cols[0], 0.35), d); k.lineWidth = 1.6; k.beginPath(); k.moveTo(xA, y - 4); k.lineTo(xB, y - 4 + slope * (xB - xA)); k.stroke(); }
      k.restore(); k.globalAlpha = 1;
    };
    // the long wall in shade, the gable end in the sun
    logs([[x1, gy], [bx, gy - lift], [bx, ey - lift], [x1, ey]], ["#8a6f4c", "#5c4630"], ey, gy, -lift / (bx - x1), x1, bx);
    logs([[x0, gy], [x1, gy], [x1, ey], [x0, ey]], ["#b8925e", "#7a5a38"], ey, gy, 0, x0, x1);
    // the log ends at the corners
    for (let i = 0; i < 10; i++) { const y = ey + ((gy - ey) * (i + 0.5)) / 10; for (const x of [x0, x1]) { k.globalAlpha = 1; k.fillStyle = far("#c9a472", d); k.beginPath(); k.ellipse(x, y, 7, 6, 0, 0, Math.PI * 2); k.fill(); k.globalAlpha = 0.6; k.strokeStyle = far("#6d5234", d); k.lineWidth = 1; k.beginPath(); k.ellipse(x, y, 4, 3.4, 0, 0, Math.PI * 2); k.stroke(); } }
    // the gable (vertical boards) and the roof planes of weathered grey planks
    gouache(k, [[x0 - 6, ey], [cx, peak + 10], [x1 + 6, ey]], far("#a88a5e", d), { seed: 730, tex: { cols: [far("#735a3a", d), far("#c9ab7c", d)], n: 60, len: 50, w: 3, ang: -Math.PI / 2, jit: 0.05, a: 0.4 } });
    gouache(k, [[cx, peak], [bx + 16, peak - lift], [bx + 30, ey - lift + 2], [x1 + 18, ey + 6]], far("#8f8e86", d), { seed: 731, tex: { cols: [far("#5f5e58", d), far("#bdbab0", d)], n: 110, len: 46, w: 4, ang: 0.95, jit: 0.1, a: 0.45 } });
    gouache(k, [[x0 - 18, ey + 6], [cx, peak], [cx + 4, peak + 12], [x0 - 6, ey + 12]], far("#9a968a", d), { seed: 732, tex: { cols: [far("#6a675e", d)], n: 30, len: 30, w: 3, ang: -0.9, a: 0.4 } });
    gouache(k, [[x1 + 18, ey + 6], [cx, peak], [cx - 4, peak + 12], [x1 + 6, ey + 12]], far("#9a968a", d), { seed: 733 });
    // the carved window: white frame, blue shutters, dark glass with the sky in it
    gouache(k, [[cx - 30, 566], [cx, 546], [cx + 30, 566], [cx + 28, 628], [cx - 28, 628]], far("#f1ece0", d), { seed: 740 });
    gouache(k, [[cx - 20, 568], [cx + 20, 568], [cx + 20, 616], [cx - 20, 616]], far("#34414a", d), { seed: 741 });
    k.fillStyle = far("#7b8fa0", d); k.globalAlpha = 0.6; k.fillRect(cx - 18, 570, 15, 20); k.globalAlpha = 1;
    k.strokeStyle = far("#f1ece0", d); k.lineWidth = 2.5; k.beginPath(); k.moveTo(cx, 568); k.lineTo(cx, 616); k.moveTo(cx - 20, 590); k.lineTo(cx + 20, 590); k.stroke();
    gouache(k, [[cx - 44, 568], [cx - 30, 568], [cx - 30, 618], [cx - 44, 618]], far("#4f78a8", d), { seed: 742 }); gouache(k, [[cx + 30, 568], [cx + 44, 568], [cx + 44, 618], [cx + 30, 618]], far("#4f78a8", d), { seed: 743 });
    for (let i = 0; i < 7; i++) { k.fillStyle = far(i % 2 ? "#c43b27" : "#f1ece0", d); k.beginPath(); k.arc(cx - 24 + i * 8, 560 - Math.abs(i - 3) * 2.5, 2.2, 0, Math.PI * 2); k.fill(); }
    gouache(k, [[cx - 10, 476], [cx + 10, 476], [cx + 10, 500], [cx - 10, 500]], far("#3a4248", d), { seed: 744 });
    // side windows in the shaded wall
    gouache(k, [[1508, 572], [1540, 571], [1540, 609], [1508, 610]], far("#e2dccd", d), { seed: 745 }); gouache(k, [[1512, 576], [1536, 575], [1536, 605], [1512, 606]], far("#2e373d", d), { seed: 746 });
    gouache(k, [[1556, 568], [1584, 567], [1584, 603], [1556, 604]], far("#d8d2c3", d), { seed: 747 }); gouache(k, [[1560, 572], [1580, 571], [1580, 599], [1560, 600]], far("#2e373d", d), { seed: 748 });
    // the carved ridge horse (konyok) and the chimney
    stroke(k, [[cx - 2, peak + 2], [cx - 8, peak - 16], [cx - 20, peak - 22], [cx - 26, peak - 16]], 6, 3, far("#7a5a38", d), 1);
    gouache(k, [[1530, 468], [1530, 420], [1552, 416], [1552, 462]], far("#b0674a", d), { seed: 749 });
    // the sill of grass and the cast shadow to the lower right
    k.globalAlpha = 0.35; k.fillStyle = far("#4a5a2a", d); trace(k, [[x0 - 10, gy], [bx + 40, gy - lift + 4], [bx + 70, gy + 12], [x0 + 20, gy + 16]]); k.fill(); k.globalAlpha = 1;
    void r;
  }));
};

// ---------------------------------------------------------------- the wattle fence
// Split stakes driven in a row; willow withies woven in front of one stake and behind the next,
// each course alternating, so the fabric reads as woven and not as rails.
type Fence = { x0: number; x1: number; y0: number; y1: number; h: number; n: number; d: number; seed: number };
const FENCES: Fence[] = [{ x0: 300, x1: 880, y0: 772, y1: 752, h: 104, n: 11, d: 0.22, seed: 800 }, { x0: 1045, x1: 1930, y0: 750, y1: 722, h: 100, n: 15, d: 0.26, seed: 840 }];
const stakesOf = (F: Fence) => { const r = rng(F.seed); return Array.from({ length: F.n }, (_, i) => { const t = i / (F.n - 1), x = F.x0 + (F.x1 - F.x0) * t + (r() - 0.5) * 10, y = F.y0 + (F.y1 - F.y0) * t, top = y - F.h - 8 - r() * 22, lean = (r() - 0.5) * 6; return { x, y, top, lean, w: 8 + r() * 4 }; }); };
const courseY = (F: Fence, k: number, x: number) => { const t = (x - F.x0) / (F.x1 - F.x0); return F.y0 + (F.y1 - F.y0) * t - 16 - k * 10.5; };
const fenceLines = (F: Fence): Line[] => {
  const S = stakesOf(F), L: Line[] = [];
  S.forEach((s, i) => L.push({ pts: [[s.x, s.y + 4], [s.x + s.lean, s.top]], seed: F.seed + i, a: 0.55, w: 1.1 }));
  for (let k = 0; k < 8; k += 2) L.push({ pts: Array.from({ length: 12 }, (_, j) => { const x = F.x0 + ((F.x1 - F.x0) * j) / 11; return [x, courseY(F, k, x) + Math.sin(j * 2.1) * 2] as P; }), seed: F.seed + 60 + k, a: 0.35, w: 0.8, retrace: false });
  return L;
};
const paintFence = (g: Gfx, F: Fence, p: number) => {
  const c = g.cur, S = stakesOf(F), d = F.d, r = rng(F.seed + 7), bb: Box = [F.x0 - 30, Math.min(F.y0, F.y1) - F.h - 40, F.x1 + 30, Math.max(F.y0, F.y1) + 20];
  reveal(c, bb, 0, p, F.seed, () => {
    const withy = (k: number, i: number, front: boolean) => {
      const a = S[i], b = S[i + 1]; if (!b) return; const ya = courseY(F, k, a.x) + (r() - 0.5) * 5, yb = courseY(F, k, b.x) + (r() - 0.5) * 5, sag = front ? 2 + r() * 3 : -1 - r() * 2, col = far(mix(mix("#a08a62", "#6e5c40", r()), "#8a8a7a", r() * 0.5), d), tw = 5 + r() * 3;
      const ctrl: P[] = [[a.x - 4, ya + (front ? 0 : 1)], [(a.x + b.x) / 2, (ya + yb) / 2 + sag], [b.x + 4, yb + (front ? 1 : 0)]];
      stroke(c, ctrl, tw, tw * 0.85, col, 1 - 0.4 * d); stroke(c, ctrl.map(([x, y]) => [x, y - 2.2] as P), 2, 1.5, far("#c9b48a", d), 0.5); stroke(c, ctrl.map(([x, y]) => [x, y + 2.6] as P), 2, 1.5, far("#4e402c", d), 0.45);
    };
    // courses behind the stakes first, then stakes, then the courses that pass in front
    for (let k = 0; k < 8; k++) for (let i = 0; i < S.length - 1; i++) if ((i + k) % 2) withy(k, i, false);
    S.forEach((s, i) => { limb(c, [[s.x, s.y + 4], [s.x + s.lean * 0.5, (s.y + s.top) / 2], [s.x + s.lean, s.top]], s.w, s.w * 0.8, "#8d7c62", F.seed + i * 3, d, 1, 0.35, 1.2); c.globalAlpha = 0.9; c.fillStyle = far("#5b4c38", d); trace(c, [[s.x + s.lean - s.w * 0.4, s.top + 2], [s.x + s.lean, s.top - 3], [s.x + s.lean + s.w * 0.4, s.top + 3]]); c.fill(); c.globalAlpha = 1; });
    for (let k = 0; k < 8; k++) for (let i = 0; i < S.length - 1; i++) if (!((i + k) % 2)) withy(k, i, true);
    // the fence's shadow on the grass, lower right
    c.globalAlpha = 0.18; c.fillStyle = far("#304018", d); trace(c, [[F.x0, F.y0 + 4], [F.x1, F.y1 + 4], [F.x1 + 40, F.y1 + 22], [F.x0 + 40, F.y0 + 24]]); c.fill(); c.globalAlpha = 1;
  });
};

// ---------------------------------------------------------------- the boy and his rooster
// Local frame: origin between his feet, 1 unit = 1 px at the figure's scale; he is 290 tall.
const BOY = { x: 972, y: 868, s: 1.1 };
const loc = (pts: P[]): P[] => pts.map(([x, y]) => [BOY.x + x * BOY.s, BOY.y + y * BOY.s]);
const SHAPES = {
  legL: [[-30, -140], [-3, -140], [-4, -96], [-7, -44], [-24, -44], [-30, -96]] as P[],
  legR: [[3, -140], [31, -140], [30, -94], [23, -44], [6, -44], [4, -96]] as P[],
  wrapL: [[-24, -46], [-7, -46], [-8, -12], [-22, -12]] as P[],
  wrapR: [[7, -46], [23, -46], [22, -12], [8, -12]] as P[],
  shoeL: [[-24, -14], [-6, -14], [-3, -6], [-8, 0], [-30, 1], [-35, -4], [-31, -10]] as P[],
  shoeR: [[8, -14], [22, -14], [30, -9], [34, -3], [28, 1], [6, 0], [4, -7]] as P[],
  shirt: [[-9, -238], [9, -238], [30, -226], [35, -196], [36, -160], [39, -138], [0, -134], [-39, -138], [-36, -160], [-35, -196], [-31, -226]] as P[],
  sleeveR: [[-31, -226], [-24, -216], [-26, -190], [-22, -172], [-34, -160], [-44, -182], [-42, -214]] as P[],   // his right arm, on the viewer's left
  sleeveL: [[31, -224], [44, -214], [48, -190], [42, -178], [20, -198], [30, -206], [34, -214]] as P[],          // his left arm, across the bird's back
  head: [[0, -291], [15, -287], [24, -274], [25, -258], [21, -244], [11, -236], [0, -234], [-11, -236], [-21, -244], [-25, -258], [-24, -274], [-15, -287]] as P[],
  hair: [[-25, -258], [-26, -272], [-18, -287], [-3, -293], [12, -291], [23, -282], [27, -268], [26, -257], [21, -262], [15, -266], [9, -263], [3, -267], [-4, -264], [-10, -267], [-16, -263], [-21, -266]] as P[],
  // the rooster
  body: [[-26, -214], [-10, -224], [12, -224], [34, -218], [44, -206], [40, -190], [22, -176], [2, -172], [-16, -176], [-28, -188], [-31, -202]] as P[],
  neck: [[-42, -238], [-34, -246], [-28, -240], [-22, -228], [-14, -216], [-6, -210], [-12, -206], [-9, -200], [-17, -200], [-16, -193], [-24, -197], [-26, -189], [-31, -198], [-36, -194], [-36, -206], [-40, -214], [-43, -226]] as P[],
  wing: [[-12, -214], [8, -218], [30, -212], [42, -202], [38, -190], [22, -186], [4, -190], [-10, -198]] as P[],
  headR: [[-50, -246], [-44, -252], [-35, -250], [-31, -242], [-34, -234], [-43, -233], [-49, -238]] as P[],
  comb: [[-49, -249], [-50, -257], [-46, -253], [-44, -262], [-41, -254], [-38, -262], [-36, -253], [-32, -258], [-32, -249], [-36, -246], [-46, -246]] as P[],
  wattle: [[-48, -236], [-45, -238], [-42, -234], [-43, -226], [-47, -227]] as P[],
  beak: [[-50, -246], [-58, -243], [-50, -240]] as P[],
};
const TAIL: P[][] = [
  [[36, -214], [52, -242], [70, -252], [84, -238], [88, -214]],
  [[38, -210], [58, -236], [78, -236], [90, -216], [92, -194]],
  [[38, -206], [60, -222], [78, -214], [86, -196]],
  [[36, -212], [48, -236], [58, -250], [68, -250]],
  [[36, -204], [54, -210], [70, -198], [76, -184]],
];
const boyLines = (): Line[] => {
  const L: Line[] = [], add = (pts: P[], seed: number, a = 0.55, closed = true) => L.push({ pts: loc(pts), seed, a, w: 1, closed, per: 4 });
  add(SHAPES.head, 1001); add(SHAPES.hair, 1002, 0.4); add(SHAPES.shirt, 1003); add(SHAPES.sleeveR, 1004); add(SHAPES.sleeveL, 1005);
  add(SHAPES.legL, 1006); add(SHAPES.legR, 1007); add(SHAPES.shoeL, 1008); add(SHAPES.shoeR, 1009);
  add(SHAPES.body, 1010); add(SHAPES.neck, 1011); add(SHAPES.headR, 1012); add(SHAPES.comb, 1013, 0.45);
  TAIL.forEach((t, i) => add(t, 1020 + i, 0.45, false));
  return L;
};
const paintBoy = (g: Gfx, p: number) => {
  const c = g.cur, r = rng(1100), ph = (i: number, n: number) => clamp(p * n - i), G = (pts: P[], col: string, o: Partial<Gouache> = {}) => gouache(c, loc(pts), col, { seed: 1100, ...o });
  const S = SHAPES, tx = (x: number) => BOY.x + x * BOY.s, ty = (y: number) => BOY.y + y * BOY.s, n = 9;
  // 0: his cast shadow, the trousers and wrappings and bast shoes
  if (ph(0, n) > 0) {
    c.globalAlpha = 0.3 * ph(0, n); c.fillStyle = "#2f3d15"; c.beginPath(); c.ellipse(tx(26), ty(2), 58, 9, 0.04, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    reveal(c, [tx(-40), ty(-145), tx(40), ty(4)], Math.PI / 2, ph(0, n), 1101, () => {
      const TR = "#6a7a9c", stripes = (pts: P[]) => { c.save(); trace(c, loc(pts)); c.clip(); for (let x = -34; x < 34; x += 5.5) { c.globalAlpha = 0.45; c.strokeStyle = "#3f4c6c"; c.lineWidth = 1.3; c.beginPath(); c.moveTo(tx(x), ty(-140)); c.quadraticCurveTo(tx(x + 1.5), ty(-95), tx(x * 0.7), ty(-44)); c.stroke(); } c.restore(); c.globalAlpha = 1; };
      G(S.legL, TR, { tex: { cols: ["#8a98b8", "#4a5878"], n: 40, len: 26, w: 3, ang: Math.PI / 2, a: 0.35 }, rim: "#343f5a", rimA: 0.5 }); stripes(S.legL);
      G(S.legR, darken(TR, 0.15), { tex: { cols: ["#7a88a8", "#3a4868"], n: 40, len: 26, w: 3, ang: Math.PI / 2, a: 0.35 }, rim: "#2a334a", rimA: 0.5 }); stripes(S.legR);
      for (const [pts, sh] of [[S.wrapL, 0], [S.wrapR, 0.12]] as [P[], number][]) { G(pts, darken("#ece3cb", sh), { tex: { cols: ["#c9bc9c"], n: 12, len: 12, w: 3, ang: 0, a: 0.4 }, rim: "#9a8a68", rimA: 0.5 }); const b = bbox(pts); for (let k = 0; k < 3; k++) { const y = b[1] + 6 + k * 11; stroke(c, loc([[b[0] + 1, y], [b[2] - 1, y + 7]]), 2, 2, "#7a5a2e", 0.9); stroke(c, loc([[b[2] - 1, y], [b[0] + 1, y + 7]]), 2, 2, "#8a6a3a", 0.8); } }
      for (const [pts, sh] of [[S.shoeL, 0], [S.shoeR, 0.12]] as [P[], number][]) { G(pts, darken("#c9a45e", sh), { rim: "#6e5226", rimA: 0.7, rimW: 1.2 }); c.save(); trace(c, loc(pts)); c.clip(); const b = bbox(pts); for (let x = b[0]; x < b[2]; x += 4) { c.globalAlpha = 0.5; c.strokeStyle = "#7d5d2c"; c.lineWidth = 0.9; c.beginPath(); c.moveTo(tx(x), ty(b[1])); c.lineTo(tx(x + 5), ty(b[3])); c.moveTo(tx(x + 5), ty(b[1])); c.lineTo(tx(x), ty(b[3])); c.stroke(); } c.restore(); c.globalAlpha = 1; }
    });
  }
  // 1: the red shirt with its embroidered hem and side placket, the sash
  if (ph(1, n) > 0) reveal(c, [tx(-50), ty(-240), tx(50), ty(-130)], Math.PI / 2, ph(1, n), 1102, () => {
    const RED = "#c9321f";
    G(S.sleeveR, lighten(RED, 0.05), { tex: { cols: ["#e05a3a", "#8e1f16"], n: 30, len: 20, w: 3, ang: 1.9, a: 0.35 }, rim: "#6e1810", rimA: 0.5 });
    G(S.shirt, RED, { tex: { cols: ["#e0583a", "#9a2216", "#b82a1a"], n: 120, len: 26, w: 4, ang: 1.75, jit: 0.4, a: 0.35 }, rim: "#6e1810", rimA: 0.55, rimW: 2 });
    // the shadow side of the shirt, away from the sun
    c.save(); trace(c, loc(S.shirt)); c.clip(); c.globalAlpha = 0.55; c.fillStyle = "#8a1d14"; trace(c, loc([[14, -238], [40, -224], [42, -130], [18, -130], [22, -180]])); c.fill(); c.restore(); c.globalAlpha = 1;
    // embroidered hem: a white band with red and green folk crosses
    const hem: P[] = [[-39, -148], [36, -148], [39, -138], [0, -134], [-39, -138]]; G(hem, "#efe7d4", { rim: "#9a8a68", rimA: 0.4 });
    for (let i = 0; i < 12; i++) { const x = -34 + i * 6.2, y = -141.5; c.fillStyle = i % 2 ? "#2f6a3a" : "#c9321f"; for (const [dx, dy] of [[0, -2.2], [0, 2.2], [-2.2, 0], [2.2, 0], [0, 0]] as P[]) { c.beginPath(); c.arc(tx(x + dx), ty(y + dy), 1.05, 0, Math.PI * 2); c.fill(); } }
    G([[-12, -238], [-5, -238], [-7, -212], [-13, -212]], "#efe7d4", { rim: "#9a8a68", rimA: 0.4 }); for (let i = 0; i < 4; i++) { c.fillStyle = "#c9321f"; c.beginPath(); c.arc(tx(-9), ty(-233 + i * 6), 1.3, 0, Math.PI * 2); c.fill(); }
    G([[-37, -170], [37, -170], [37, -163], [-37, -163]], "#d9a631", { tex: { cols: ["#f2cc5a", "#9a6e1a"], n: 14, len: 12, w: 2, ang: 0, a: 0.4 }, rim: "#7a561a", rimA: 0.5 });
    stroke(c, loc([[28, -165], [31, -150], [29, -140]]), 3.5, 2, "#c99526", 1); stroke(c, loc([[32, -165], [37, -152], [37, -142]]), 3.5, 2, "#b2841f", 1);
    for (const [x, y] of [[29, -139], [37, -141]] as P[]) { c.fillStyle = "#c9321f"; c.beginPath(); c.ellipse(tx(x), ty(y + 3), 2.4, 4, 0, 0, Math.PI * 2); c.fill(); }
  });
  // 2: the rooster's tail (behind his arm), then body, wing, hackles, head
  if (ph(2, n) > 0) TAIL.forEach((t, i) => { const pp = clamp(ph(2, n) * TAIL.length - i); stroke(c, loc(t), 9 - i * 0.6, 2, i === 4 ? "#7a3a1a" : "#1d2a26", 1, pp); if (pp >= 1 && i < 3) stroke(c, loc(t.map(([x, y]) => [x - 1, y - 2.5] as P)).slice(1), 2.2, 0.6, "#4e8c7a", 0.7); });
  if (ph(3, n) > 0) reveal(c, [tx(-60), ty(-265), tx(50), ty(-165)], 0.3, ph(3, n), 1103, () => {
    G(S.body, "#8a3418", { tex: { cols: ["#b4502a", "#5a1e0e"], n: 60, len: 16, w: 3, ang: 0.3, a: 0.4 }, rim: "#3e150a", rimA: 0.5 });
    G(S.wing, "#6a2410", { tex: { cols: ["#9a4424", "#2e1208"], n: 40, len: 14, w: 3, ang: 0.15, a: 0.4 }, rim: "#2a0e06", rimA: 0.6 });
    for (let k = 0; k < 5; k++) stroke(c, loc([[14 + k * 5, -206 + k * 1.5], [26 + k * 4, -196 + k], [34 + k * 2, -190 + k]]), 4, 1.5, k % 2 ? "#1f2a24" : "#2e3a30", 0.9);   // the primaries' dark tips
    for (let k = 0; k < 3; k++) stroke(c, loc([[-8 + k * 6, -214], [4 + k * 6, -208], [14 + k * 6, -202]]), 1.2, 0.5, "#c9703a", 0.6);   // covert edges
    G(S.neck, "#e08a2a", { tex: { cols: ["#f6c25a", "#b35a18"], n: 50, len: 14, w: 2.5, ang: 1.1, a: 0.5 }, rim: "#7a3a10", rimA: 0.4 });
    for (let k = 0; k < 11; k++) { const t = k / 10; stroke(c, loc([[-40 + t * 18, -236 + t * 4], [-36 + t * 22, -220 + t * 6], [-32 + t * 24, -200 + t * 4 - Math.abs(t - 0.5) * 8]]), 2.4, 0.3, k % 3 ? "#f6c65e" : "#a8501a", 0.8); }   // hackle feathers falling over the shoulder
  });
  if (ph(4, n) > 0) {
    const q = ph(4, n);
    G(S.headR, "#c4481c", { a: clamp(q * 3), rim: "#5a1a08", rimA: 0.5 });
    if (q > 0.3) { G(S.comb, "#d8231c", { rim: "#7a0e0a", rimA: 0.6, tex: { cols: ["#f0503a"], n: 8, len: 6, w: 2, ang: -1.4, a: 0.5 } }); G(S.wattle, "#cf221a", { rim: "#7a0e0a", rimA: 0.6 }); }
    if (q > 0.6) { G(S.beak, "#e0b040", { rim: "#8a6a1a", rimA: 0.6 }); c.fillStyle = "#f2b030"; c.beginPath(); c.arc(tx(-43), ty(-245), 2.6, 0, Math.PI * 2); c.fill(); c.fillStyle = "#1a0e08"; c.beginPath(); c.arc(tx(-43.4), ty(-245.2), 1.4, 0, Math.PI * 2); c.fill(); }
    if (q > 0.8) for (const x of [4, 12]) { stroke(c, loc([[x, -174], [x - 1, -160], [x - 2, -152]]), 3, 2.4, "#d9a63a", 1); for (const dx of [-5, 0, 4]) stroke(c, loc([[x - 2, -152], [x - 2 + dx, -147]]), 1.6, 1, "#c9962e", 1); }
  }
  // 5: his arms round the bird: the right hand cupped under the breast, the left hand on its back
  if (ph(5, n) > 0) {
    const q = ph(5, n), SKIN = "#f0c29a", SK2 = "#d6926c";
    G(S.sleeveL, "#b92c1c", { a: clamp(q * 2), tex: { cols: ["#e05a3a", "#7e1a12"], n: 30, len: 18, w: 3, ang: 2.6, a: 0.35 }, rim: "#6e1810", rimA: 0.5 });
    if (q > 0.4) {
      // right hand: palm under the breast, four finger tips curled up over it, the thumb along the side
      G([[-36, -168], [-24, -176], [-14, -176], [-12, -168], [-22, -162], [-34, -160]], SKIN, { rim: "#a0603e", rimA: 0.5 });
      for (let k = 0; k < 4; k++) stroke(c, loc([[-26 + k * 4, -172], [-24 + k * 4, -179], [-22 + k * 4, -181]]), 3.6, 2.8, k % 2 ? SK2 : SKIN, 1);
      stroke(c, loc([[-34, -166], [-36, -176], [-33, -182]]), 4, 3, SKIN, 1);
      // left hand on the back: back of the hand, four fingers over the wing, thumb tucked toward us
      G([[20, -206], [30, -204], [32, -196], [22, -192], [14, -196]], SKIN, { rim: "#a0603e", rimA: 0.5 });
      for (let k = 0; k < 4; k++) stroke(c, loc([[16 - k * 0.5, -205 + k * 3.4], [8 - k * 0.5, -203 + k * 3.6], [2 - k * 0.3, -199 + k * 3.6]]), 3.6, 2.8, k % 2 ? SK2 : SKIN, 1);
      stroke(c, loc([[22, -193], [16, -188], [11, -187]]), 4, 3, SKIN, 1);
      c.globalAlpha = 0.5; c.strokeStyle = "#e05a3a"; c.lineWidth = 2; c.beginPath(); c.moveTo(tx(33), ty(-206)); c.lineTo(tx(30), ty(-192)); c.stroke(); c.globalAlpha = 1;   // the gathered cuff
    }
  }
  // 6: his head: skin, the shadow side, ears, the bowl-cut straw hair
  if (ph(6, n) > 0) reveal(c, [tx(-30), ty(-296), tx(30), ty(-230)], Math.PI / 2, ph(6, n), 1106, () => {
    G([[-6, -240], [6, -240], [7, -230], [-6, -230]], "#d9a07a");
    G(S.head, "#f2c59c", { tex: { cols: ["#f8d8b4", "#e0a47c"], n: 26, len: 10, w: 3, ang: 1.2, a: 0.3 }, rim: "#b0704a", rimA: 0.45, rimW: 1.4 });
    c.save(); trace(c, loc(S.head)); c.clip(); c.globalAlpha = 0.45; c.fillStyle = "#d8916a"; c.beginPath(); c.ellipse(tx(20), ty(-252), 14, 24, 0.2, 0, Math.PI * 2); c.fill(); c.restore(); c.globalAlpha = 1;
    for (const x of [-24, 24]) { G([[x - 4, -262], [x + 4 * Math.sign(x), -260], [x + 4 * Math.sign(x), -250], [x, -247]], x < 0 ? "#f2c09a" : "#dea27c", { rim: "#a0603e", rimA: 0.5 }); }
    G(S.hair, "#e9c265", { tex: { cols: ["#f7dc8c", "#b88a34", "#d0a445"], n: 70, len: 16, w: 2.2, ang: 1.5, jit: 0.9, a: 0.55 }, rim: "#8a6424", rimA: 0.5 });
    c.save(); trace(c, loc(S.hair)); c.clip(); c.globalAlpha = 0.4; c.fillStyle = "#a47a2c"; c.beginPath(); c.ellipse(tx(18), ty(-270), 14, 24, 0.3, 0, Math.PI * 2); c.fill(); c.globalAlpha = 0.5; c.fillStyle = "#fbe7a8"; c.beginPath(); c.ellipse(tx(-10), ty(-284), 10, 5, -0.3, 0, Math.PI * 2); c.fill(); c.restore(); c.globalAlpha = 1;
    for (let k = 0; k < 9; k++) { const x = -20 + k * 5; stroke(c, loc([[x, -288 + Math.abs(x) * 0.2], [x + 1, -276], [x + (k % 2 ? 2 : -1), -265]]), 1.2, 0.4, k % 2 ? "#b88a34" : "#8a6424", 0.55); }
  });
  // 7-8: the face, last: rosy cheeks, two dot eyes, a button nose, a small smile
  if (ph(7, n) > 0) {
    const q = ph(7, n);
    for (const x of [-12, 13]) { const gr = c.createRadialGradient(tx(x), ty(-247), 0, tx(x), ty(-247), 8); gr.addColorStop(0, rgba("#e8584a", 0.75 * q)); gr.addColorStop(0.6, rgba("#ec7a62", 0.4 * q)); gr.addColorStop(1, rgba("#f2a080", 0)); c.fillStyle = gr; c.fillRect(tx(x) - 9, ty(-256), 18, 18); }
    c.globalAlpha = q; c.fillStyle = "#e0987a"; c.beginPath(); c.ellipse(tx(1), ty(-251), 3.8, 3.2, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = "#fbe0c8"; c.beginPath(); c.arc(tx(0), ty(-252.4), 1.2, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
  }
  if (ph(8, n) > 0) {
    const q = ph(8, n);
    for (const x of [-8, 9]) { c.globalAlpha = clamp(q * 2); c.fillStyle = "#2a1a10"; c.beginPath(); c.ellipse(tx(x), ty(-257), 2.4, 2.9, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = "#fff6e6"; c.beginPath(); c.arc(tx(x - 0.8), ty(-258.2), 0.8, 0, Math.PI * 2); c.fill(); }
    for (const x of [-8, 9]) stroke(c, loc([[x - 4, -263], [x, -264.5], [x + 4, -263]]), 1.2, 0.8, "#9a6a34", 0.7 * clamp(q * 2));
    if (q > 0.5) { c.globalAlpha = 0.85; c.strokeStyle = "#8a3a2a"; c.lineWidth = 1.5; c.lineCap = "round"; c.beginPath(); c.moveTo(tx(-5), ty(-243.5)); c.quadraticCurveTo(tx(1), ty(-239), tx(6), ty(-243.5)); c.stroke(); c.globalAlpha = 1; }
  }
  void r;
};

// ---------------------------------------------------------------- the garden: pumpkins, sunflowers
const PUMPKINS: [number, number, number, number, number][] = [[706, 936, 46, 34, 1201], [338, 958, 88, 62, 1202], [582, 1010, 72, 52, 1203], [150, 1050, 100, 68, 1204]];
const GOURD_LEAVES: [number, number, number, number, number, number][] = [
  [470, 912, 96, -0.3, 0.62, 1301], [230, 905, 104, 0.4, 0.66, 1302], [800, 975, 84, 0.25, 0.6, 1303], [60, 940, 110, 0.3, 0.66, 1305], [640, 905, 70, -0.5, 0.6, 1309],
  [455, 1050, 100, -0.2, 0.7, 1304], [700, 1065, 92, 0.15, 0.7, 1306], [880, 1040, 70, -0.35, 0.62, 1307], [300, 1075, 86, 0.55, 0.7, 1308],
];
type SunPlant = { head: Sun; stalk: P[]; leaves: Leaf[]; petioles: P[][] };
// Helianthus: a thick bristly stalk, alternate heart-shaped leaves hanging on long petioles
// (the lower ones largest), the head turned to the sun on a stalk bent just under it.
const SUN_PLANTS: SunPlant[] = (() => {
  const mk = (hx: number, hy: number, r: number, rot: number, sq: number, base: P, d: number, seed: number, droop = 0, nl = 5): SunPlant => {
    const rr = rng(seed), stalk: P[] = [base, [base[0] + (hx - base[0]) * 0.4 + (rr() - 0.5) * 20, base[1] + (hy - base[1]) * 0.45], [hx + Math.sin(rot) * r * 0.4 + droop, hy + r * 0.9]];
    const leaves: Leaf[] = [], petioles: P[][] = []; const s = smooth(stalk, 8);
    for (let k = 0; k < nl; k++) {
      const t = 0.14 + k * (0.62 / nl), i = Math.round(t * (s.length - 1)), [x, y] = s[i], side = (k + seed) % 2 ? 1 : -1, size = r * (1 - k * 0.1);
      const pl = size * (0.55 + rr() * 0.25), pa = -Math.PI / 2 + side * (0.9 + rr() * 0.3), px = x + Math.cos(pa) * pl, py = y + Math.sin(pa) * pl * 0.8;
      petioles.push([[x, y], [x + Math.cos(pa) * pl * 0.55, y + Math.sin(pa) * pl * 0.55 - 4], [px, py]]);
      leaves.push({ x: px, y: py, a: side > 0 ? 0.55 + rr() * 0.55 : Math.PI - 0.55 - rr() * 0.55, len: size * (2.1 + rr() * 0.4), wid: size * (1.7 + rr() * 0.3), col: k % 2 ? "#4b7628" : "#557f2e", seed: seed * 10 + k, d, bend: side * 0.14, serr: 0.03, round: 0.7, cord: 0.14, tri: true, vein: "#86a860" });
    }
    return { head: { x: hx, y: hy, r, rot, sq, seed, d }, stalk, leaves, petioles };
  };
  return [
    mk(676, 640, 22, -0.15, 0.85, [684, 880], 0.36, 1401, 0, 2), mk(1790, 580, 24, -0.2, 0.85, [1775, 860], 0.36, 1402, 0, 2), mk(560, 620, 27, 0.1, 0.85, [548, 900], 0.3, 1403, 0, 3),
    mk(1700, 320, 58, -0.25, 0.9, [1690, 1090], 0.02, 1404, 0, 5), mk(1860, 470, 50, 0.35, 0.72, [1870, 1090], 0.0, 1405, 0, 4), mk(1540, 470, 44, -0.5, 0.78, [1580, 1090], 0.06, 1406, -10, 4),
  ];
})();
const paintSunPlant = (g: Gfx, S: SunPlant, p: number) => {
  const c = g.cur, d = S.head.d ?? 0, r = rng(S.head.seed + 3), sp = clamp(p * 3);
  limb(c, S.stalk, S.head.r * 0.32, S.head.r * 0.22, "#6a9234", S.head.seed, d, sp, 0.32, 0.8);
  if (sp >= 1 && d < 0.2) { const sm = smooth(S.stalk, 10); c.strokeStyle = far("#d6e0a0", d); c.lineWidth = 0.8; for (let i = 2; i < sm.length - 1; i += 1) for (const sg of [-1, 1]) { const w = S.head.r * 0.15 * sg, [x, y] = sm[i]; c.globalAlpha = 0.5 * r(); c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w * 1.35 + sg * 2, y - 3); c.stroke(); } c.globalAlpha = 1; }
  S.petioles.forEach((q, i) => stroke(c, q, S.head.r * 0.09, S.head.r * 0.05, far("#5f8a30", d), 1 - 0.5 * d, clamp(p * 3 - 1 - i * 0.2)));
  S.leaves.forEach((L, i) => leaf(c, L, clamp(p * 3 - 1.2 - i * 0.2)));
  sunflower(c, S.head, clamp(p * 1.6 - 0.6));
};
const sunLines = (S: SunPlant): Line[] => {
  const h = S.head, disc: P[] = []; for (let i = 0; i < 10; i++) { const th = (i / 10) * Math.PI * 2, x = Math.cos(th) * h.r, y = Math.sin(th) * h.r * h.sq; disc.push([h.x + x * Math.cos(h.rot) - y * Math.sin(h.rot), h.y + x * Math.sin(h.rot) + y * Math.cos(h.rot)]); }
  return [{ pts: S.stalk, seed: h.seed, a: 0.5 }, { pts: disc, seed: h.seed + 1, a: 0.55, closed: true }, ...S.leaves.map((L) => ({ pts: leafGeom(L).outline.filter((_, i) => i % 3 === 0), seed: L.seed, a: 0.45, closed: true, per: 3 } as Line))];
};

// ---------------------------------------------------------------- ground, grass, flowers
const meadowTop = (x: number) => 606 + Math.sin(x * 0.004) * 6;
const PATH: P[] = ribbonOf(smooth([[1060, 1100], [990, 980], [962, 880], [986, 800], [986, 756]], 10), (t) => 150 * (1 - t) ** 1.3 + 17);
const inPath = (x: number, y: number) => { for (let i = 0, j = PATH.length - 1, k = false; ; j = i++) { if (i >= PATH.length) return k; const a = PATH[i], b = PATH[j]; if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) k = !k; } };
const paintMeadow = (g: Gfx, p: number) => {
  const c = g.cur, bb: Box = [0, 590, W, H];
  reveal(c, bb, 1.2, p, 1501, () => {
    const poly: P[] = [[0, meadowTop(0)], ...Array.from({ length: 21 }, (_, i) => [(W * i) / 20, meadowTop((W * i) / 20)] as P), [W, H], [0, H]];
    c.save(); trace(c, poly); c.clip();
    glowBand(c, bb, "#bcc56e", [[0, 0], [0.06, 0.25], [0.2, 0.45], [0.45, 0.7], [1, 0.85]]);
    glowBand(c, bb, "#6f9a3a", [[0, 0], [0.25, 0], [0.5, 0.45], [0.8, 0.8], [1, 0.95]]);
    glowBand(c, bb, "#3f6a26", [[0, 0], [0.55, 0], [0.8, 0.35], [1, 0.7]]);
    // the wood's shade under the birches
    const gr = c.createRadialGradient(200, 820, 20, 200, 820, 520); gr.addColorStop(0, rgba("#3f5e26", 0.45)); gr.addColorStop(1, rgba("#3f5e26", 0)); c.fillStyle = gr; c.fillRect(0, 590, 900, 490);
    // the brush's drag across the ground
    const rr = rng(1509); c.lineCap = "round"; for (let i = 0; i < 700; i++) { const x = rr() * W, y = 640 + rr() ** 0.7 * 440, near = (y - 640) / 440; c.strokeStyle = rr() < 0.5 ? rgba("#2e5418", 0.25 * near) : rgba("#c8d27a", 0.2 * (1 - near * 0.5)); c.lineWidth = 1.5 + near * 4; const l = 6 + near * 26 + rr() * 10, an = -1.35 + (rr() - 0.5) * 0.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); c.stroke(); }
    c.restore();
  });
};
const paintPath = (g: Gfx, p: number) => {
  const c = g.cur, bb = bbox(PATH) as Box;
  reveal(c, bb, -Math.PI / 2, p, 1502, () => {
    gouache(c, PATH, "#c9b283", { seed: 1503, wob: 14, tex: { cols: ["#e6d6a8", "#9e8a5e", "#b8a272"], n: 160, len: 40, w: 4, ang: -1.3, jit: 0.5, a: 0.4 }, rim: "#7e8a44", rimA: 0.35, rimW: 5 });
    c.save(); trace(c, PATH); c.clip(); for (const o of [-0.45, 0.45]) stroke(c, smooth([[1060, 1100], [990, 980], [962, 880], [986, 800], [986, 756]], 10).map(([x, y]) => [x + o * (150 * Math.max(0, (y - 756) / 344) ** 1.3 + 17) * 1.2, y] as P), 7, 2, "#9a845a", 0.35); c.restore();
  });
  c.globalAlpha = 1;
};
const GRASS_BANDS: Grass[] = (() => {
  const out: Grass[] = [];
  for (let b = 0; b < 4; b++) out.push({ x0: (W * b) / 4, x1: (W * (b + 1)) / 4, base: (x) => meadowTop(x) + 30, n: 700, h: [5, 16], w: 1.6, cols: ["#a9b86a", "#c2c985", "#8fa458"], lean: 0.1, seed: 1600 + b, d: 0.55, spread: 120, a: 0.8 });
  for (let b = 0; b < 6; b++) out.push({ x0: (W * b) / 6, x1: (W * (b + 1)) / 6, base: (x) => 752 - (x - 300) * 0.03, n: 900, h: [12, 38], w: 2.6, cols: ["#7fa044", "#9cb455", "#5f8634", "#b9c56a"], tip: "#d8dc8e", lean: 0.2, seed: 1620 + b, d: 0.2, spread: 120, clump: 4, skip: inPath, dry: "#c9b060" });
  return out;
})();
const FORE_GRASS: Grass[] = Array.from({ length: 8 }, (_, b) => ({ x0: (W * b) / 8 - 20, x1: (W * (b + 1)) / 8 + 20, base: () => 860, n: 1100, h: [34, 120], w: 4.4, cols: ["#5e8a30", "#76a03c", "#4a7428", "#8cb04a", "#3c6222"], tip: "#c9d880", lean: 0.22, seed: 1700 + b, d: 0, spread: 220, clump: 6, skip: inPath, dry: "#b8a050" }));
const FRINGE: Grass[] = Array.from({ length: 4 }, (_, b) => ({ x0: (W * b) / 4, x1: (W * (b + 1)) / 4, base: () => 1045, n: 360, h: [18, 60], w: 5, cols: ["#4a7428", "#5e8a30", "#3c6222", "#6f9a38"], tip: "#b9cc70", lean: 0.2, seed: 1760 + b, d: 0, spread: 40, clump: 5 }));
const DAISIES: [number, number, number][] = (() => { const r = rng(1800), out: [number, number, number][] = []; for (let i = 0; i < 110; i++) { const x = 60 + r() * 1800, y = 640 + r() * 430, near = (y - 640) / 430; if (x > 1500 && y < 900) continue; if (x < 900 && y > 880) continue; if (inPath(x, y)) continue; out.push([x, y, 2 + near * near * 13]); } return out.sort((a, b) => a[1] - b[1]); })();
const BELLS: [number, number, number, number][] = [[1160, 1000, 52, 0.3], [1236, 950, 44, -0.2], [1290, 1030, 62, 0.15], [1356, 960, 40, 0.4], [1420, 1040, 56, -0.1], [1100, 1060, 48, 0.25]];
const ROSES: [number, number, number, number][] = [[1410, 872, 24, 0.2], [1478, 836, 21, -0.4], [1356, 842, 18, 0.6], [1500, 900, 23, 0.1], [1448, 918, 16, 0.9]];
const paintFlowers = (g: Gfx, p: number) => {
  const c = g.cur;
  ROSES.forEach(([x, y, r, rot], i) => dogRose(c, x, y, r, rot, 0.8, 1950 + i, 0.02, clamp(p * 2 - i * 0.15)));
  BELLS.forEach(([x, y, s, a], i) => { const q = clamp(p * 2 - 1 + 0.4 - i * 0.05); if (q <= 0) return; const top: P = [x - 12 * Math.sign(a || 1), y - s * 1.7]; stroke(c, [[x + 6, 1090], [x, y + 20], [top[0] - 6, top[1] + 10], top], 2.6, 1.3, "#4a6a2a", 1, q); if (q > 0.4) { bell(c, top[0], top[1] + 2, s, a, 1900 + i, 0, "#5a6cc6", clamp((q - 0.4) / 0.6)); if (s > 32) bell(c, top[0] + s * 0.5, top[1] + s * 0.9, s * 0.7, a + 0.5, 1920 + i, 0, "#5264bc", clamp((q - 0.6) / 0.4)); } });
};
const ROSE_LEAVES: Leaf[] = (() => { const r = rng(1960), out: Leaf[] = []; for (let i = 0; i < 30; i++) out.push({ x: 1330 + r() * 210, y: 810 + r() * 130, a: r() * 6.28, len: 24 + r() * 12, wid: 15 + r() * 6, col: r() < 0.5 ? "#3f6a2c" : "#4d7a32", seed: 1961 + i, serr: 0.12, stalk: 3 }); return out; })();
// burdock by the bottom corner: the nearest thing in the picture, the richest paint
const BURDOCK: Leaf[] = [
  { x: 1560, y: 1090, a: -2.0, len: 170, wid: 118, col: "#3d6a28", seed: 2501, bend: -0.1, serr: 0.03, round: 0.75, cord: 0.18, vein: "#86a860", stalk: 10 },
  { x: 1640, y: 1095, a: -1.2, len: 190, wid: 124, col: "#46732c", seed: 2502, bend: 0.08, serr: 0.03, round: 0.75, cord: 0.18, vein: "#8eae66", stalk: 10 },
  { x: 1760, y: 1090, a: -0.6, len: 180, wid: 118, col: "#3a6426", seed: 2503, bend: 0.12, serr: 0.03, round: 0.75, cord: 0.18, vein: "#80a05a", stalk: 10 },
  { x: 1900, y: 1085, a: -1.7, len: 160, wid: 110, col: "#44702a", seed: 2504, bend: -0.1, serr: 0.03, round: 0.75, cord: 0.18, vein: "#86a860", stalk: 10 },
];

// a haystack (stog) raised round a pole in the meadow: a middle-distance thing, so thin paint that stops short of its own drawing
const STOG = { x: 1150, y: 648, w: 64, h: 92 };
const stogPoly = (): P[] => { const { x, y, w, h } = STOG; return smooth([[x - w / 2, y], [x - w * 0.52, y - h * 0.35], [x - w * 0.36, y - h * 0.75], [x - w * 0.08, y - h * 0.97], [x + w * 0.1, y - h * 0.96], [x + w * 0.38, y - h * 0.72], [x + w * 0.53, y - h * 0.3], [x + w / 2, y]], 6, true); };
const stogLines = (): Line[] => [{ pts: stogPoly(), seed: 2701, a: 0.55, closed: true, per: 2 }, { pts: [[STOG.x - 1, STOG.y - STOG.h * 0.96], [STOG.x + 2, STOG.y - STOG.h - 18]], seed: 2702, a: 0.55 }];
const paintStog = (g: Gfx, p: number) => {
  const { x, y, w, h } = STOG, bb: Box = [x - w, y - h - 30, x + w, y + 14], d = 0.45;
  faded(g, bb, (m) => ramp(m, bb, [0, y], [0, y - h * 1.1], [[0, 0.9], [0.6, 0.7], [1, 0.15]]), (k) => reveal(k, bb, -Math.PI / 2, p, 2703, () => {
    gouache(k, stogPoly(), far("#c9a860", d), { seed: 2704, tex: { cols: [far("#8a6c30", d), far("#ecd49a", d)], n: 70, len: 26, w: 2.5, ang: 1.35, jit: 0.5, a: 0.5 } });
    k.save(); trace(k, stogPoly()); k.clip(); k.globalAlpha = 0.5; k.fillStyle = far("#8a6a34", d); k.beginPath(); k.ellipse(x + w * 0.35, y - h * 0.4, w * 0.35, h * 0.6, 0.2, 0, Math.PI * 2); k.fill(); k.restore(); k.globalAlpha = 1;
    stroke(k, [[x - 1, y - h * 0.96], [x + 2, y - h - 18]], 3, 2, far("#6a5436", d), 0.9);
    k.globalAlpha = 0.25; k.fillStyle = far("#4a5a2a", d); k.beginPath(); k.ellipse(x + w * 0.35, y + 3, w * 0.7, 6, 0, 0, Math.PI * 2); k.fill(); k.globalAlpha = 1;
  }));
};
// swallows skimming low before the evening: three pencil ticks over the cottage
const swallow = (x: number, y: number, s: number, tilt: number, seed: number): Line[] => { const c = Math.cos(tilt), sn = Math.sin(tilt), T = (px: number, py: number): P => [x + (px * c - py * sn) * s, y + (px * sn + py * c) * s]; return [{ pts: [T(-10, -3), T(-5, -1), T(0, 1), T(5, -1), T(10, -4)], seed, a: 0.7, w: 1.1, retrace: false }, { pts: [T(0, 1), T(0.6, 4), T(-0.8, 6)], seed: seed + 1, a: 0.6, w: 0.9, retrace: false }]; };
const SWALLOWS: Line[] = [...swallow(1250, 300, 1.6, 0.15, 2801), ...swallow(1330, 262, 1.2, -0.2, 2803), ...swallow(1196, 352, 1.0, 0.3, 2805)];

// ---------------------------------------------------------------- the process
const SKETCH: Line[][] = [
  [...FAR, ...SWALLOWS],
  BIRCHES.flatMap(birchLines),
  stogLines(),
  cottageLines(),
  FENCES.flatMap(fenceLines),
  [{ pts: PATH.slice(0, PATH.length / 2).filter((_, i) => i % 4 === 0), seed: 2601, a: 0.35 }, { pts: PATH.slice(PATH.length / 2).filter((_, i) => i % 4 === 0), seed: 2602, a: 0.35 }],
  boyLines(),
  [...PUMPKINS.map(([x, y, rx, ry, s]) => ({ pts: Array.from({ length: 12 }, (_, i) => [x + Math.cos((i / 12) * 6.283) * rx, y + Math.sin((i / 12) * 6.283) * ry] as P), seed: s, a: 0.5, closed: true } as Line)), ...GOURD_LEAVES.map(([x, y, s, rot, , seed]) => ({ pts: Array.from({ length: 9 }, (_, i) => { const th = -2.9 + (i / 8) * 5.8; return [x + Math.sin(th + rot) * s, y - Math.cos(th + rot) * s * 0.6] as P; }), seed, a: 0.35 } as Line))],
  SUN_PLANTS.flatMap(sunLines),
  BURDOCK.map((L) => ({ pts: leafGeom(L).outline.filter((_, i) => i % 3 === 0), seed: L.seed, a: 0.45, closed: true, per: 3 } as Line)),
  SPRAYS.filter((s) => s.d > 0.3).flatMap(sprayLines),
];
const ground = (g: Gfx) => sheet(g, [[980, 600, 820, "#fbf3d6"]]);
const finish = (g: Gfx) => { g.paper("paper", 0.14); g.paper("coldpress", 0.07); };
const build = (k: number): Proc => {
  const tl = timeline(4, k, true), add = (dur: number, fn: (g: Gfx, p: number) => void) => tl.add(dur, fn);
  // 1. the pencil drawing of the whole picture, big shapes first
  SKETCH.forEach((lines, i) => { const L = lines.reduce((a, l) => a + l.pts.length, 0); add(Math.max(10, Math.min(38, L / 14)), (g, p) => sketch(g.cur, lines, p)); if (i === 0) tl.wait(4); });
  tl.wait(10);
  // 2. paint, back to front
  add(14, (g, p) => reveal(g.cur, [0, 0, W, 640], 0.2, p, 2001, () => { const c = g.cur, gr = c.createRadialGradient(960, 600, 30, 960, 600, 760); gr.addColorStop(0, rgba("#f7e2a0", 0.42)); gr.addColorStop(0.5, rgba("#f6ebc4", 0.18)); gr.addColorStop(1, rgba("#f3e3a8", 0)); c.fillStyle = gr; c.fillRect(0, 0, W, 640); }));
  add(16, paintMeadow);
  GRASS_BANDS.slice(0, 4).forEach((G) => add(5, (g, p) => grass(g.cur, G, p)));
  BIRCHES.forEach((b) => { if (b.d < 0.95) add(4 + (1 - b.d) * 6, (g, p) => paintBirch(g, b, p)); });
  add(20, paintCottage);
  add(10, paintStog);
  add(10, (g, p) => reveal(g.cur, [0, 540, W, 760], 0, p, 2002, () => glowBand(g.cur, [0, 540, W, 760], "#faf0d4", [[0, 0], [0.3, 0.55], [0.5, 0.7], [0.8, 0.25], [1, 0]])));   // the golden haze
  SUN_PLANTS.slice(0, 3).forEach((S) => add(10, (g, p) => paintSunPlant(g, S, p)));
  FENCES.forEach((F) => add(14, (g, p) => paintFence(g, F, p)));
  for (let i = 0; i < SPRAYS.length; i += 3) { const batch = SPRAYS.slice(i, i + 3); add(3.2, (g, p) => batch.forEach((S, j) => paintSpray(g, S, clamp(p * batch.length - j)))); }
  add(10, paintPath);
  GRASS_BANDS.slice(4).forEach((G) => add(4, (g, p) => grass(g.cur, G, p)));
  add(8, (g, p) => DAISIES.filter(([, y]) => y < 840).forEach(([x, y, r], i, A) => daisy(g.cur, x, y, r, 2100 + i, clamp(1 - (y - 640) / 260) * 0.5, 0.6, clamp(p * A.length - i))));
  add(46, paintBoy);
  tl.wait(6);
  FORE_GRASS.forEach((G) => add(4.5, (g, p) => grass(g.cur, G, p)));
  GOURD_LEAVES.slice(0, 5).forEach(([x, y, s, rot, sq, seed]) => add(5, (g, p) => gourdLeaf(g.cur, x, y, s, rot, sq, "#3f6c26", seed, 0.04, p)));
  PUMPKINS.forEach(([x, y, rx, ry, seed], i) => add(8, (g, p) => pumpkin(g.cur, x, y, rx, ry, seed, i === 0 ? 0.18 : 0, p)));
  GOURD_LEAVES.slice(5).forEach(([x, y, s, rot, sq, seed]) => add(5, (g, p) => gourdLeaf(g.cur, x, y, s, rot, sq, "#3a6624", seed, 0, p)));
  add(8, (g, p) => [[420, 930, -0.4], [640, 960, 3.6], [820, 1000, -0.9], [260, 990, 3.9]].forEach(([x, y, a], i) => tendril(g.cur, x, y, 60, a, 2200 + i, "#6a8a34", 0, clamp(p * 4 - i))));
  SUN_PLANTS.slice(3).forEach((S) => add(24, (g, p) => paintSunPlant(g, S, p)));
  add(12, (g, p) => ROSE_LEAVES.forEach((L, i) => leaf(g.cur, L, clamp(p * ROSE_LEAVES.length / 3 - i / 3))));
  add(14, paintFlowers);
  BURDOCK.forEach((L) => add(8, (g, p) => leaf(g.cur, L, p)));
  FRINGE.forEach((G) => add(3, (g, p) => grass(g.cur, G, p)));
  add(10, (g, p) => DAISIES.filter(([, y]) => y >= 840).forEach(([x, y, r], i, A) => daisy(g.cur, x, y, r, 2300 + i, 0, 0.6, clamp(p * A.length - i))));
  add(8, (g, p) => [[800, 900, 38], [860, 930, 30], [760, 950, 26]].forEach(([x, y, r], i) => { stroke(g.cur, [[x + 10, 1080], [x + 4, y + 60], [x, y]], 2, 1.2, "#2f3320", 0.8, clamp(p * 3 - i)); umbel(g.cur, x, y, r, 2400 + i, "#2f3320", clamp(p * 3 - i - 0.5)); }));
  return { id: "folkTale", medium: FT_M, ground, ops: tl.ops, finish };
};
const PROC = fit(build, N - 31), END = PROC.ops[PROC.ops.length - 1].t1;

export const STYLE = { id: "folkTale", name: "Folk-tale storybook", family: "paint", medium: "gouache and watercolour over an HB pencil drawing on cream cartridge: opaque, dry-brushed paint in the foreground thinning to a pale wash and then to bare pencil in the distance", nearest: "storybook", hero: "a boy carrying a rooster through a village kitchen garden at the edge of a birch wood" };

export const folkTale: Film = {
  meta: { title: "The boy with the rooster · folk-tale storybook", W, H, fps: 30, bpm: 120, durationFrames: N, raster: "cpu", kind: "drawing", holds: [[N - 30, N]] },
  assets: { images: {} },
  shots: [{ id: "paint", start: 0, end: N, draw: (ctx, f, env) => runProcess(PROC, ctx, Math.min(f, END), env) }],
};
void HAZE; void lineLeaf; void pencil;
