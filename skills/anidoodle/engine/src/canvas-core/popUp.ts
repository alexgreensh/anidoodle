import { Gfx, rng, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { bounds, mix, smooth } from "./gallery";
import { clamp01, ease, easeOut, fibres, onGrid, path, shadowOf, tear } from "./scrapbookKit";

// A POP-UP CARD OPENS · paper engineering in cut and printed card.
//
// MEDIUM, physically. One sheet of heavy cream card, folded once down the middle, laid on a
// kraft-paper table and opened flat. Glued to the right page are the pop-ups: scissor-cut pieces
// of coloured and printed paper, each hinged on a valley fold along its bottom edge, each with
// the white core a knife leaves and a darker cut edge. Nothing is drawn with a line: the marks
// are flat colour, printed motifs and the shadows the folds throw.
// THE FOLD IS THE STYLE. A piece is drawn in its own plane and hinged about its crease: flat on
// the page it is foreshortened like the page, standing it faces the viewer (the projection is
// one line: picture height = d * sin(elevation + fold)). Three tones tell the fold: the face,
// lit a little more as it stands; a soft valley shadow in the crease; and the piece's own shadow
// on the page, sliding away down-right as the piece rises. The centre fold keeps its gutter
// shadow. Reference, from memory: Robert Sabuda's and Matthew Reinhart's pop-up books (valley
// fold layers, paper struts), a paper tulip, a small white butterfly's folded wing.
// ORDER. The table. The card's shadow. The cover, swinging open around the spine (the card is
// recentred as it opens, the way a hand adjusts it). The right page printed. The crease valleys.
// Then the pop-ups back to front: two hills, five flowers, a butterfly on a strut, a grass
// fringe. The red heart on the cover returns printed inside and at the middle bloom.
// MOTION GRAMMAR. Not stop-motion: card and folds glide and settle like real paper — an eased
// swing for the cover, a quick rise with a damped spring overshoot for each fold, back pieces
// first; then the held scene with the small sway of standing paper, and one flutter.

const N = 232;
const PEN: Medium = { nib: 1, taper: 0.3, pressure: 0.3, retrace: false, wobble: 0.3, rough: 0.2 };
const WHITE = "#fbf9f2", CREAM = "#f7f0e1", KRAFT = "#b8905f", RED = "#b8302c";

// the view: orthographic, elevation EL above the table. World x -> picture x; y (back along the
// table) compresses by sin EL; z (up) by cos EL. A fold at angle phi to the page then has
// picture height d * sin(EL + phi) about its crease — the whole illusion is that one line.
const EL = (35 * Math.PI) / 180, SIN_E = Math.sin(EL), COS_E = Math.cos(EL);
const FRONT_Y = 830, CARD_W = 400, CARD_H = 500, CX = 540, CY = 660;

// the timeline
const T0 = 20, T1 = 150, FLUTTER = 195;
const theta = (f: number) => 180 * ease(clamp01((f - T0) / (T1 - T0))); // degrees: 0 closed, 180 flat
const spineX = (th: number) => CX - CARD_W / 2 + (CARD_W / 2) * (th / 180); // recentred as it opens
const zoom = (f: number) => 1.1 - 0.1 * clamp01(f / T1); // a steady push-in, moving from the first frame
const lay = (f: number) => (1.4 * (1 - easeOut(clamp01(f / 25))) * Math.PI) / 180; // the closed card settles onto the table
const rotP = (pts: P[], cx: number, cy: number, a: number): P[] => { const c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c] as P); };

// ---- paper helpers
const sticker = (c: Ctx, s: P[], margin: number) => { if (margin <= 0) return; c.lineJoin = "round"; c.lineWidth = 2 * margin; c.strokeStyle = WHITE; path(c, s); c.stroke(); };
const dotPrint = (c: Ctx, b: { x0: number; y0: number; x1: number; y1: number }, col: string, gap = 13, rad = 1.9) => { c.fillStyle = col; c.globalAlpha = 0.8; for (let y = b.y0, row = 0; y < b.y1 + gap; y += gap * 0.87, row++) for (let x = b.x0 + (row % 2) * gap * 0.5; x < b.x1 + gap; x += gap) { c.beginPath(); c.arc(x, y, rad, 0, 6.28); c.fill(); } c.globalAlpha = 1; };
const confetti = (c: Ctx, clip: P[], w: number, h: number, seed: number) => {
  const r = rng(seed), cols = [RED, "#e1b54a", "#2f6f73", "#e58f6f", "#7fa25a"];
  c.save(); path(c, clip); c.clip();
  for (let i = 0; i < 42; i++) { const x = 14 + r() * (w - 28), y = 14 + r() * (h - 28); c.globalAlpha = 0.4 + r() * 0.25; c.fillStyle = cols[Math.floor(r() * cols.length)];
    if (r() < 0.5) { c.beginPath(); c.arc(x, y, 1.8 + r() * 1.6, 0, 6.28); c.fill(); }
    else { const a = r() * 6.28, s = 3 + r() * 2.4; c.beginPath(); c.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s); c.lineTo(x + Math.cos(a + 2.1) * s, y + Math.sin(a + 2.1) * s); c.lineTo(x + Math.cos(a + 4.2) * s, y + Math.sin(a + 4.2) * s); c.closePath(); c.fill(); } }
  c.restore(); c.globalAlpha = 1;
};
const border = (c: Ctx, w: number, h: number, col: string) => {
  c.strokeStyle = col; c.globalAlpha = 0.75; c.lineWidth = 2; c.strokeRect(14, 14, w - 28, h - 28); c.globalAlpha = 1;
  dotPrint(c, { x0: 20, y0: 20, x1: w - 20, y1: 26 }, col); dotPrint(c, { x0: 20, y0: h - 26, x1: w - 20, y1: h - 20 }, col);
  dotPrint(c, { x0: 20, y0: 26, x1: 26, y1: h - 26 }, col); dotPrint(c, { x0: w - 26, y0: 26, x1: w - 20, y1: h - 26 }, col);
};
const scallopDisc = (cx: number, cy: number, rad: number, seed: number): P[] => { const pts: P[] = [], n = 18; for (let i = 0; i < n; i++) { const a0 = (i / n) * 6.283, a1 = ((i + 1) / n) * 6.283; for (let k = 0; k <= 5; k++) { const a = a0 + ((a1 - a0) * k) / 5; pts.push([cx + Math.cos(a) * (rad + 7 * Math.sin((k / 5) * Math.PI)), cy + Math.sin(a) * (rad + 7 * Math.sin((k / 5) * Math.PI))]); } } return tear(pts, 0.5, seed); };
const heart = (cx: number, cy: number, s: number): P[] => Array.from({ length: 14 }, (_, i) => { const t = (i / 14) * 6.283; return [cx + s * Math.sin(t) ** 3, cy - (s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))) / 16] as P; });

// ---- a pop-up piece: a silhouette hinged on a horizontal valley fold at crease v
type Riser = { id: string; v: number; rest: number; sway: number; phase: number; shapes: (f: number) => P[][]; cols: string[]; margins: number[]; decor?: (c: Ctx, shapes: P[][]) => void };
const riserPhi = (r: Riser, th: number, f: number) => {
  const from = 95 + ((440 - r.v) / 440) * 30, u = clamp01((th - from) / (180 - from)); // back rows fold first
  let phi = r.rest * easeOut(u);
  if (u >= 1) phi += r.rest * 0.06 * Math.sin((f - T1) * 0.3 + r.phase) * Math.exp(-Math.max(0, f - T1) / 55); // the paper spring, settling slowly through the held scene
  if (f > T1 + 20) phi += r.sway * Math.sin((f * 6.283) / (70 + r.phase * 9) + r.phase); // standing sway
  return (phi * Math.PI) / 180;
};

const hillTop = (h: number, k: number[]): P[] => smooth(([[8, h * k[0]], [66, h * k[1]], [136, h * k[2]], [212, h * k[3]], [290, h * k[4]], [392, h * k[5]]] as P[]), false, 8);
const hillsBack: Riser = { id: "hillsBack", v: 398, rest: 86, sway: 0.7, phase: 0.4, cols: ["#a9cfa6"], margins: [6],
  shapes: () => [[...hillTop(170, [0.55, 0.85, 0.5, 1, 0.6, 0.78]), [392, 0], [8, 0]]],
  decor: (c, s) => { dotPrint(c, bounds(s[0]), "#c3ddb5", 15, 2); } };
const hillsFront: Riser = { id: "hillsFront", v: 336, rest: 88, sway: 0.9, phase: 1.3, cols: ["#7fa25a"], margins: [6],
  shapes: () => [[...hillTop(200, [0.64, 0.9, 0.56, 0.84, 0.62, 0.74]), [392, 0], [8, 0]]],
  decor: (c, s) => { dotPrint(c, bounds(s[0]), "#a6c77a", 13, 2); } };

// a flower: a stem-with-leaves piece, then its bloom piece, on the same crease
const stemShape = (bx: number, h: number): P[] => smooth(([[bx - 7, 0], [bx - 7, 52], [bx - 48, 64], [bx - 56, 116], [bx - 30, 104], [bx - 10, 84], [bx - 6, 96], [bx - 6, h - 52], [bx + 6, h - 52], [bx + 6, 108], [bx + 34, 124], [bx + 52, 84], [bx + 16, 70], [bx + 7, 58], [bx + 7, 0]] as P[]), true, 4);
const bloomShape = (bx: number, h: number): P[] => smooth(([[bx - 30, h - 4], [bx - 36, h - 36], [bx - 26, h - 72], [bx - 9, h - 52], [bx, h - 80], [bx + 9, h - 52], [bx + 26, h - 72], [bx + 36, h - 36], [bx + 30, h - 4], [bx, h + 6]] as P[]), true, 5);
const flower = (id: string, v: number, bx: number, h: number, col: string, phase: number, heartCentre: boolean): Riser[] => {
  const leafVeins = (c: Ctx) => { c.strokeStyle = "#4e6e38"; c.globalAlpha = 0.4; c.lineWidth = 2; c.lineCap = "round";
    [[bx - 10, 88, bx - 44, 108], [bx + 10, 96, bx + 42, 100]].forEach(([x0, y0, x1, y1]) => { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, y1 - 10, x1, y1); c.stroke(); }); c.globalAlpha = 1; };
  const stem: Riser = { id: `${id}Stem`, v, rest: 90, sway: 1.3, phase, cols: ["#5c8546"], margins: [5], shapes: () => [stemShape(bx, h)], decor: (c) => leafVeins(c) };
  const bloom: Riser = { id: `${id}Bloom`, v, rest: 90, sway: 1.3, phase, cols: [col], margins: [5], shapes: () => [bloomShape(bx, h)],
    decor: (c) => { const band = smooth(([[bx - 31, h - 6], [bx - 31, h - 26], [bx, h - 40], [bx + 31, h - 26], [bx + 31, h - 6], [bx, h + 4]] as P[]), true, 4);
      c.globalAlpha = 0.5; c.fillStyle = mix(col, "#1d2430", 0.22); path(c, band); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = mix(col, "#1d2430", 0.3); c.globalAlpha = 0.4; c.lineWidth = 2; c.lineCap = "round";
      [[-14, 0], [14, 0]].forEach(([dx]) => { c.beginPath(); c.moveTo(bx, h + 2); c.quadraticCurveTo(bx + dx * 0.6, h - 18, bx + dx, h - 32); c.stroke(); }); c.globalAlpha = 1;
      if (heartCentre) { const hh = heart(bx, h - 40, 9); c.fillStyle = WHITE; path(c, hh); c.fill(); } } };
  return [stem, bloom];
};
const FLOWERS: Riser[] = [
  ...flower("f1", 320, 86, 235, "#f3d577", 0.9, false),
  ...flower("f2", 282, 178, 290, RED, 1.7, true),
  ...flower("f3", 244, 276, 252, "#e58f6f", 2.5, false),
  ...flower("f4", 202, 124, 190, "#e9a3ad", 3.3, false),
  ...flower("f5", 162, 232, 158, "#fbf9f2", 4.1, false),
];

// the butterfly on its strut: wings fold twice, then rest open
const BX = 342, BH = 318;
const flap = (f: number) => { if (f < FLUTTER || f > FLUTTER + 30) return 1; const u = (f - FLUTTER) / 30; return 0.3 + 0.7 * Math.abs(Math.cos(u * 6.283)); };
const wing = (side: 1 | -1, top: boolean, k: number): P[] => {
  const ctrl: P[] = top ? [[BX + side * 3, BH - 18], [BX + side * 42, BH - 46], [BX + side * 54, BH - 28], [BX + side * 46, BH - 8], [BX + side * 6, BH - 6]] : [[BX + side * 3, BH - 12], [BX + side * 32, BH + 14], [BX + side * 42, BH + 2], [BX + side * 5, BH - 2]];
  return smooth(ctrl.map(([x, y]) => [BX + (x - BX) * k, y] as P[]), true, 5);
};
const strut: Riser = { id: "strut", v: 226, rest: 92, sway: 1.8, phase: 2.1, cols: ["#e9e2ce"], margins: [0], shapes: () => [[[BX - 2.5, 0], [BX + 2.5, 0], [BX + 2, BH - 30], [BX - 2, BH - 30]]] };
const butterfly: Riser = { id: "butterfly", v: 226, rest: 92, sway: 1.8, phase: 2.1, cols: ["#c7b3e0", "#c7b3e0", "#a98fd4", "#a98fd4", "#3d3437"], margins: [3, 3, 0, 0, 0],
  shapes: (f) => { const k = flap(f); return [wing(-1, true, k), wing(1, true, k), wing(-1, false, k), wing(1, false, k), smooth(([[BX - 3.5, BH - 22], [BX + 3.5, BH - 22], [BX + 3, BH + 8], [BX - 3, BH + 8]] as P[]), true, 4)]; },
  decor: (c) => { c.strokeStyle = "#3d3437"; c.lineWidth = 1.6; c.globalAlpha = 0.8; c.lineCap = "round"; [[-1, -3], [1, -3]].forEach(([s, dy]) => { c.beginPath(); c.moveTo(BX + s * 2, BH - 22); c.quadraticCurveTo(BX + s * 9, BH - 34, BX + s * 13, BH - 36 + dy); c.stroke(); }); c.globalAlpha = 1; } };

// the grass fringe, nearest the viewer
const grassShape = (): P[] => { const r = rng(77), pts: P[] = [[8, 0]]; let x = 8; while (x < 390) { const w = 7 + r() * 7, h = 20 + r() * 18; pts.push([x, h], [x + w / 2, 4 + r() * 8], [x + w, h * (0.7 + r() * 0.5)]); x += w; } pts.push([392, 22], [392, 0]); return pts; };
const grass: Riser = { id: "grass", v: 64, rest: 84, sway: 0.5, phase: 4.8, cols: ["#5c8546"], margins: [4], shapes: () => [grassShape()],
  decor: (c, s) => { c.save(); path(c, s[0]); c.clip(); c.strokeStyle = "#40602c"; c.globalAlpha = 0.4; c.lineWidth = 1.4; const r = rng(78); for (let x = 14; x < 388; x += 9 + r() * 8) { c.beginPath(); c.moveTo(x, 2); c.lineTo(x + (r() - 0.5) * 4, 24 + r() * 26); c.stroke(); } c.restore(); c.globalAlpha = 1; } };

const RISERS: Riser[] = [hillsBack, hillsFront, ...FLOWERS, strut, butterfly, grass];

// ---- the card
const pageRect: P[] = [[0, 0], [CARD_W, 0], [CARD_W, CARD_H], [0, CARD_H]];
const coverCorner = (sx: number, thR: number, d: number, v: number): P => { const zc = 7 * (1 - Math.abs(thR) / Math.PI); return [sx + d * Math.cos(thR), FRONT_Y - v * SIN_E - (zc + d * Math.sin(thR)) * COS_E]; };
const coverQuad = (sx: number, thR: number): P[] => [coverCorner(sx, thR, 0, 0), coverCorner(sx, thR, CARD_W, 0), coverCorner(sx, thR, CARD_W, CARD_H), coverCorner(sx, thR, 0, CARD_H)];

const coverArt = (c: Ctx, outside: boolean) => {
  c.fillStyle = CREAM; c.fillRect(0, 0, CARD_W, CARD_H);
  fibres(c, pageRect, CREAM, outside ? 301 : 302, 1.1, 0.25);
  border(c, CARD_W, CARD_H, RED); confetti(c, pageRect, CARD_W, CARD_H, outside ? 303 : 304);
  if (outside) {
    const disc = scallopDisc(170, 224, 108, 305); c.globalAlpha = 0.5; c.fillStyle = "#f3d577"; path(c, disc); c.fill(); c.globalAlpha = 1;
    const hh = heart(170, 224, 44); sticker(c, hh, 8); c.fillStyle = RED; path(c, hh); c.fill();
    const sh = heart(170, 226, 40); c.globalAlpha = 0.25; c.fillStyle = "#7c1c1a"; path(c, sh); c.fill(); c.globalAlpha = 1;
    const hi = heart(162, 212, 16); c.globalAlpha = 0.3; c.fillStyle = "#d9574a"; path(c, hi); c.fill(); c.globalAlpha = 1;
  } else {
    const disc = scallopDisc(170, 220, 96, 306); c.globalAlpha = 0.4; c.fillStyle = mix(CREAM, RED, 0.12); path(c, disc); c.fill(); c.globalAlpha = 1;
    const hh = heart(170, 220, 22); c.globalAlpha = 0.85; c.fillStyle = RED; path(c, hh); c.fill(); c.globalAlpha = 1;
  }
};
const rightPageArt = (c: Ctx) => {
  c.fillStyle = CREAM; c.fillRect(0, 0, CARD_W, CARD_H);
  fibres(c, pageRect, CREAM, 311, 1.1, 0.25);
  border(c, CARD_W, CARD_H, RED); confetti(c, pageRect, CARD_W, CARD_H, 312);
  const hh = heart(306, 28, 10); c.globalAlpha = 0.85; c.fillStyle = RED; path(c, hh); c.fill(); c.globalAlpha = 1;
};

const drawScene = (ctx: Ctx, f: number, env: Env) => {
  const g = new Gfx(ctx, env, f, PEN), z = zoom(f);
  g.push(CX * (1 - z), CY * (1 - z), z, 0);
  const th = theta(f), thR = (th * Math.PI) / 180, sx = spineX(th), open = th > 90, layA = lay(f);
  const withCard = (c: Ctx, fn: () => void) => { c.save(); space0(c, env, f); c.translate(CX, CY); c.rotate(layA); c.translate(-CX, -CY); fn(); c.restore(); };
  const pageSpace = (c: Ctx) => c.transform(1, 0, 0, -SIN_E, sx, FRONT_Y);
  const coverSpace = (c: Ctx) => { const zc = 7 * (1 - th / 180); c.transform(Math.cos(thR), -Math.sin(thR) * COS_E, 0, -SIN_E, sx, FRONT_Y - zc * COS_E); };

  // 1 · the table
  withCard(ctx, () => { ctx.fillStyle = KRAFT; ctx.fillRect(-800, -800, 2680, 2680); fibres(ctx, [[-800, -800], [1880, -800], [1880, 1880], [-800, 1880]], KRAFT, 201, 1.2, 0.3); });

  // 2 · shadows on the table: the spread, and the cover swinging (its shadow tracks the fold)
  const spread = rotP([[sx - CARD_W * (open ? 1 : 0), FRONT_Y + 8], [sx + CARD_W, FRONT_Y + 8], [sx + CARD_W, FRONT_Y - CARD_H * SIN_E + 8], [sx - CARD_W * (open ? 1 : 0), FRONT_Y - CARD_H * SIN_E + 8]], CX, CY, layA);
  shadowOf(g, [spread], [10, 14], 6, 0.2);
  const sinT = Math.sin(thR);
  if (sinT > 0.01) { const quad = coverQuad(sx, thR), flat = quad.map((p, i) => { const d = (i === 1 || i === 2) ? CARD_W : 0, v = (i >= 2) ? CARD_H : 0; const z = 7 * (1 - th / 180) + d * sinT; return [sx + d * Math.cos(thR) + z * 0.3, FRONT_Y - v * SIN_E + z * 0.5] as P; }); shadowOf(g, [rotP(flat, CX, CY, layA)], [0, 0], 4, 0.08 + 0.2 * sinT); }

  // 3 · the cover (when open it lies on the table to the left, under nothing)
  const drawCover = () => withCard(ctx, () => { ctx.save(); coverSpace(ctx);
    if (Math.abs(Math.cos(thR)) < 0.1) { ctx.fillStyle = mix(CREAM, "#6b4a22", 0.3); ctx.fillRect(0, 0, 7, CARD_H); } // edge-on: the card's thickness
    else { coverArt(ctx, !open); ctx.fillStyle = `rgba(20,14,8,${(0.22 * sinT).toFixed(3)})`; ctx.fillRect(0, 0, CARD_W, CARD_H); }
    ctx.restore(); });
  if (open) drawCover();

  // 4 · the right page, printed
  withCard(ctx, () => { ctx.save(); pageSpace(ctx); rightPageArt(ctx); ctx.restore();
    // the card's thickness along the front edge
    ctx.fillStyle = mix(CREAM, "#6b4a22", 0.3); path(ctx, rotP([[sx, FRONT_Y], [sx + CARD_W, FRONT_Y], [sx + CARD_W, FRONT_Y + 7 * COS_E], [sx, FRONT_Y + 7 * COS_E]], CX, CY, layA)); ctx.fill();
    ctx.save(); pageSpace(ctx);
    // the gutter: the centre fold's own shadow
    const gg = ctx.createLinearGradient(-30, 0, 30, 0), ga = 0.2 * (th / 180);
    gg.addColorStop(0, `rgba(40,28,14,0)`); gg.addColorStop(0.5, `rgba(40,28,14,${ga.toFixed(3)})`); gg.addColorStop(1, `rgba(40,28,14,0)`);
    ctx.fillStyle = gg; ctx.fillRect(-30, 0, 60, CARD_H);
    // the crease valleys, one per riser, deepening as the piece rises
    for (const r of RISERS) { if (r.id.endsWith("Bloom") || r.id === "butterfly") continue; const phi = riserPhi(r, th, f), sp = Math.sin(phi); if (sp < 0.02) continue;
      const all = r.shapes(f).flat(), b = bounds(all);
      ctx.fillStyle = `rgba(42,28,16,${(0.14 * sp).toFixed(3)})`; ctx.fillRect(b.x0 - 6, r.v - 1, b.x1 - b.x0 + 12, 14);
      ctx.fillStyle = `rgba(255,250,238,${(0.1 * sp).toFixed(3)})`; ctx.fillRect(b.x0 - 6, r.v + 13, b.x1 - b.x0 + 12, 2.5); }
    ctx.restore(); });

  // 5 · the pop-ups, back to front; each shadow first, so it lands on the page and the rows behind
  if (th > 20) for (const r of RISERS) {
    const phi = riserPhi(r, th, f), sinP = Math.sin(phi), K = SIN_E * Math.cos(phi) + COS_E * sinP, creasePy = FRONT_Y - r.v * SIN_E;
    const shapes = r.shapes(f);
    if (sinP > 0.02) { const flat = shapes.map((s) => rotP(s.map(([x, d]) => [sx + x + (6 + d * 0.3) * sinP, FRONT_Y - (r.v + d) * SIN_E + (8 + d * 0.45) * sinP] as P), CX, CY, layA)); shadowOf(g, flat, [0, 0], 3 + 2 * sinP, 0.26 * sinP); }
    withCard(ctx, () => { ctx.save(); ctx.transform(1, 0, 0, -K, sx, creasePy);
      shapes.forEach((s, i) => { const col = r.cols[i] ?? r.cols[0], m = r.margins[i] ?? r.margins[0];
        ctx.save(); ctx.translate(1.4, -1.9 / K); ctx.fillStyle = mix(col, "#1d2430", 0.4); path(ctx, s); ctx.fill(); ctx.restore(); // the cut edge
        sticker(ctx, s, m);
        ctx.fillStyle = faceTone(col, sinP); path(ctx, s); ctx.fill(); });
      r.decor?.(ctx, shapes);
      ctx.restore(); });
  }

  if (!open) drawCover();

  // 6 · the sheet over everything
  g.paper("paper", 0.1); g.vignette("rgba(60,36,14,0.3)");
};
const faceTone = (base: string, sinPhi: number) => mix(base, "#fff8ea", 0.1 * sinPhi);
const space0 = (c: Ctx, env: Env, f: number) => { const z = zoom(f), k = env.scale; c.setTransform(k * z, 0, 0, k * z, k * CX * (1 - z), k * CY * (1 - z)); };

onGrid("popUp", [T0, 95, T1, FLUTTER, 225], N);
export const drawPopUp = (ctx: Ctx, f: number, env: Env) => drawScene(ctx, f, env);
export const popUp: Film = {
  meta: { title: "A pop-up card opens · paper engineering", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N, raster: "cpu", poster: 230 },
  assets: { images: {} },
  shots: [{ id: "popUp", start: 0, end: N, draw: (ctx, f, env) => drawPopUp(ctx, f, env) }],
};
export const STYLE = { id: "popUp", name: "Pop-up card", family: "paper engineering", medium: "one folded sheet of cream card: scissor-cut printed papers hinged on valley folds, a white cut core, faces toned by their angle to the sun, shadows that track the folds", nearest: "paperCraft", hero: "A cream card on a kraft table opens flat; hills, a bouquet and a butterfly rise from the fold and stand" };
