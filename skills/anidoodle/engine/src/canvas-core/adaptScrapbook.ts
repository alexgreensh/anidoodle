// QUIET ARCHIVAL SCRAPBOOK · a hand ADAPTED from a reference the owner brought: frame 10 of
// Ritwika's explainer film (refs/ritwika-explainer/frames/f_10.png, a slide about a frozen LLM
// encoder). Its subject, its diagram and its layout are NOT used; what is borrowed is the hand.
// Nearest plate by eye: scrapbook (v1 wave), which is loud (foxed parchment, ransom titles,
// copperplate everywhere). This reference is its quiet sibling, and that difference IS the recipe.
//
// MEDIUM RECIPE (adapt-a-style.md step 3, written before code):
//   MARK   flat pieces of coloured stock with a torn deckle edge, laid on a pale page; words
//          struck by a typewriter (one weight, each strike its own ink density); diagrams in a
//          thin, steady technical pen; ONE small vintage engraving as ornament; annotations in a
//          red pen and a blue pencil, used once or twice, not everywhere.
//   EDGE   torn but tidy: the deckle is fine and even, never ragged; every piece throws the same
//          soft shadow down-right; the ink lines are clean and unhatched except in the engraving.
//   ORDER  page; cards laid down (big first); coloured label chips; the diagram inked on its card;
//          typed labels; the engraving; red and blue annotations last.
//   PAPER  a pale warm sheet, barely aged: a soft mottle and a slight darkening toward the edges.
//          No foxing, no tape, no pegs (those belong to the loud sibling).
//   PALETTE muted pastels on cream: duck-egg blue, dusty rose, sage-teal, one vermilion accent,
//          a sepia-black ink. Mostly empty page: the pieces are islands with air round them.
//
// SUBJECT (new): "why sourdough rises": a jar of starter with its rise marked by a rubber band,
// the two organisms that do the work as label chips, a small chart of height over hours with the
// peak annotated, and a wheat-ear engraving. Realism: a straight-sided glass jar with a screw
// thread at the neck; dough surface domed with bubbles pressed against the glass; the band sits at
// the level of the feed; the curve rises, peaks near hour six to eight and slumps as the acids win.
// LIGHT: a desk lamp upper left: every card's shadow falls down and right.
import { Gfx, displace, fractal, rng, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { letter, width } from "./drafting";

export const STYLE = { id: "adaptScrapbook", name: "Quiet archival scrapbook", family: "collage", medium: "torn pastel card pieces with soft shadows on a pale page, typewriter strikes, thin technical-pen diagrams, one small engraving, red-pen and blue-pencil notes", nearest: "scrapbook", hero: "why sourdough rises (an explainer slide)", house: "styles/house/quiet-scrapbook.json" };

const W = 1280, H = 720;
const PAGE = "#efe7d3", INK = "#35302d", RED = "#c44a36", BLUEP = "#4f86c6", DUCK = "#bcd3d6", ROSE = "#e3a3a6", SAGE = "#7fa99e", CREAM = "#f4efe3", CARD = "#e6e1d2";
const PENM: Medium = { nib: 1, taper: 0.3, pressure: 0.25, retrace: false, wobble: 0.35, rough: 0.25 };

const densify = (pts: P[], step: number): P[] => { const out: P[] = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); } return out; };
const rot = (pts: P[], cx: number, cy: number, a: number): P[] => pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
const path = (c: Ctx, pts: P[]) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
// a torn piece: a rectangle whose edge is bitten by a fine, even deckle (tidy, not ragged)
const piece = (cx: number, cy: number, w: number, h: number, a: number, seed: number, deckle = 3.2): P[] => rot(displace(densify([[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]], 2.2), deckle * 2.6, 0.32, 2, seed), cx, cy, a);

// lay a card: its soft shadow first (the lamp is upper left), then the stock, then its grain
const lay = (g: Gfx, pts: P[], col: string, lift = 1) => {
  g.group("plain", () => g.fill(pts.map(([x, y]) => [x + 4 * lift, y + 6 * lift] as P), "#5a4a38", 0.3), { blur: 5 * lift, alpha: 0.55 });
  g.group("plain", () => g.fill(pts, col, 1), { textures: [] });
};
// the typewriter: upright single-stroke capitals, one weight, each strike its own ink density and a hair off the line
const type = (g: Gfx, text: string, x: number, y: number, cap: number, seed: number, col = INK, align: "left" | "center" = "left") => {
  const r = rng(seed), cell = cap * 0.86, cx0 = align === "center" ? x - (text.length * cell) / 2 : x; // monospace: every strike gets the same cell
  [...text].forEach((ch, i) => { if (ch === " ") return; const w = width(ch, cap, 0); letter(g, ch, cx0 + i * cell + (cell - w) / 2, y + (r() - 0.5) * cap * 0.08, { cap, color: col, seed: seed + i, w: Math.max(1.3, cap * 0.13), opacity: 0.7 + r() * 0.28, slant: 0 }); });
};

const draw = (ctx: Ctx, _f: number, env: Env) => {
  const g = new Gfx(ctx, env, 0, PENM), r = rng(99);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = PAGE; ctx.fillRect(0, 0, W, H);
  // the page: a slow mottle, a little darker toward the handled edges
  g.group("plain", () => { const c = g.cur; for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) { const v = fractal(5, x, y, 0.004, 0.004, 3), e = Math.max(Math.abs(x - W / 2) / (W / 2), Math.abs(y - H / 2) / (H / 2)); c.globalAlpha = Math.max(0, (v - 0.5) * 0.45 + Math.pow(e, 3) * 0.22); c.fillStyle = "#b89d76"; c.fillRect(x, y, 16, 16); } g.touch(0, 0, W, H); }, { blur: 14 });

  // 1. cards, the big one first
  const jarCard = piece(420, 400, 430, 470, -0.018, 11), chartCard = piece(965, 470, 390, 290, 0.022, 12), tag = piece(1105, 185, 190, 200, -0.05, 13);
  lay(g, jarCard, DUCK, 1.1); lay(g, chartCard, CREAM); lay(g, tag, CARD, 0.8);
  // 2. label chips: a strip of coloured stock each, torn short ends
  const chipA = piece(760, 150, 220, 42, 0.012, 21, 2), chipB = piece(760, 212, 250, 42, -0.01, 22, 2), sect = piece(175, 64, 250, 40, -0.02, 23, 2);
  lay(g, chipA, ROSE, 0.6); lay(g, chipB, DUCK, 0.6); lay(g, sect, CARD, 0.6);

  // 3. the diagram, inked on the blue card: a jar of starter
  const jx = 420, top = 250, bot = 560, jw = 230;
  g.group("plain", () => {
    // dough: domed surface, with bubbles pressed against the glass
    const surf = 360, dough: P[] = [[jx - jw / 2 + 6, bot - 6], [jx - jw / 2 + 6, surf + 10], [jx - 60, surf - 6], [jx, surf - 12], [jx + 60, surf - 6], [jx + jw / 2 - 6, surf + 10], [jx + jw / 2 - 6, bot - 6]];
    g.fill(dough, "#efe4c8", 1);
    for (let i = 0; i < 26; i++) { const x = jx - jw / 2 + 16 + r() * (jw - 32), y = surf + 14 + r() * (bot - surf - 30), s = 2.5 + r() * r() * 9; g.pen(Array.from({ length: 8 }, (_, k) => [x + Math.cos((k / 8) * Math.PI * 2) * s, y + Math.sin((k / 8) * Math.PI * 2) * s] as P), { w: 1, closed: true, color: INK, seed: 40 + i, opacity: 0.55, boil: 0, retrace: false }); }
  });
  g.group("plain", () => {
    const L = jx - jw / 2, R = jx + jw / 2;
    g.pen([[L + 14, top + 26], [L, top + 44], [L, bot - 14], [L + 16, bot], [R - 16, bot], [R, bot - 14], [R, top + 44], [R - 14, top + 26]], { w: 1.6, color: INK, seed: 31, boil: 0 });
    [0, 1, 2].forEach((k) => g.pen([[L + 12, top + 4 + k * 8], [jx, top + k * 8 + 1], [R - 12, top + 4 + k * 8]], { w: 1.2, color: INK, seed: 32 + k, boil: 0, opacity: 0.8 })); // the screw thread
    g.pen([[L + 30, top + 60], [L + 26, bot - 40]], { w: 1.4, color: "#ffffff", seed: 35, boil: 0, opacity: 0.8 }); // glass catching the lamp
    g.pen([[L + 6, 360], [jx - 60, 348], [jx, 342], [jx + 60, 348], [R - 6, 360]], { w: 1.3, color: INK, seed: 36, boil: 0, opacity: 0.85 });
    // the rubber band at the feed line, and a dashed line where it has risen to
    g.pen([[L - 4, 452], [jx, 458], [R + 4, 452]], { w: 5, color: RED, seed: 37, boil: 0, opacity: 0.9, taper: 0 });
    for (let x = L - 30; x < R + 40; x += 18) g.pen([[x, 342], [x + 10, 342]], { w: 1.2, color: INK, seed: 38 + x, boil: 0, opacity: 0.7, taper: 0 });
    g.pen([[R + 52, 450], [R + 52, 350]], { w: 1.4, color: INK, seed: 39, boil: 0 }); g.pen([[R + 45, 360], [R + 52, 346], [R + 59, 360]], { w: 1.4, color: INK, seed: 40, boil: 0 });
  });
  type(g, "FED", jx + jw / 2 + 12, 460, 13, 51); type(g, "6 H LATER", jx + jw / 2 + 64, 386, 13, 52);
  type(g, "STARTER, FIG. 1", jx, 600, 15, 53, INK, "center");

  // 4. chips and section label, typed
  type(g, "YEAST: GAS", 670, 141, 17, 61); type(g, "BACTERIA: ACID", 655, 203, 17, 62); type(g, "NO. 2  FERMENTATION", 70, 55, 16, 63);
  type(g, "TWO WORKERS, ONE JAR.", 660, 262, 15, 64, "#5c524a");

  // 5. the chart: height over hours, on its cream card
  g.group("plain", () => {
    const x0 = 820, y0 = 575, x1 = 1120, y1 = 385; // axes
    for (let k = 1; k <= 4; k++) g.pen([[x0, y0 - (k * (y0 - y1)) / 4], [x1, y0 - (k * (y0 - y1)) / 4]], { w: 0.7, color: BLUEP, seed: 70 + k, boil: 0, opacity: 0.35, taper: 0 });
    g.pen([[x0, y1 - 10], [x0, y0]], { w: 1.5, color: INK, seed: 75, boil: 0, taper: 0.2 }); g.pen([[x0, y0], [x1 + 10, y0]], { w: 1.5, color: INK, seed: 74, boil: 0, taper: 0.2 });
    const curve: P[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => [x0 + (h / 12) * (x1 - x0), y0 - 10 - (y0 - y1 - 20) * (h < 7 ? 1 / (1 + Math.exp(-(h - 3.6) * 1.3)) : 1 - (h - 7) * 0.07)] as P);
    g.pen(curve, { w: 2.4, color: RED, seed: 76, boil: 0, taper: 0.4 });
    [0, 6, 12].forEach((h, i) => { g.pen([[x0 + (h / 12) * (x1 - x0), y0], [x0 + (h / 12) * (x1 - x0), y0 + 6]], { w: 1.2, color: INK, seed: 80 + i, boil: 0 }); });
  });
  type(g, "0", 815, 588, 11, 81); type(g, "6", 965, 588, 11, 82); type(g, "12 H", 1106, 588, 11, 83); type(g, "RISE", 790, 360, 12, 84);
  // the annotation: a blue-pencil ring round the peak and a red-pen note, once each
  g.group("plain", () => { const px = 820 + (7 / 12) * 300, py = 385 + 10; const ring: P[] = Array.from({ length: 30 }, (_, i) => { const a = -2 + (i / 29) * Math.PI * 2.15; return [px + Math.cos(a) * 34, py + Math.sin(a) * 20] as P; }); g.pen(ring, { w: 2, color: BLUEP, seed: 90, boil: 0, opacity: 0.8, taper: 0.8 }); });
  type(g, "BAKE HERE", 1010, 345, 14, 91, RED);

  // 6. the engraving on the tag: a wheat ear, grains in pairs, each shaded by a few swelling burin lines
  g.group("plain", () => {
    const sx = 1100, sy = 268; g.pen([[sx + 6, sy], [sx + 2, sy - 70], [sx - 4, sy - 130]], { w: 1.6, color: INK, seed: 100, boil: 0, taper: 0.6 });
    for (let k = 0; k < 7; k++) for (const side of [-1, 1]) { const y = sy - 70 - k * 13, x = sx + 2 - k * 0.9, gx = x + side * 11, gy = y - 6, grain: P[] = [[x, y], [gx - side * 2, gy - 9], [gx + side * 4, gy - 2], [x + side * 2, y + 2]]; g.pen(grain, { w: 1.1, color: INK, seed: 110 + k * 2 + (side > 0 ? 1 : 0), closed: true, boil: 0, opacity: 0.9 }); for (let h = 0; h < 3; h++) g.pen([[x + side * (3 + h * 2), y - 1 - h], [gx + side * (1 + h), gy - 5 + h]], { w: 0.6, color: INK, seed: 130 + k * 6 + h + (side > 0 ? 3 : 0), boil: 0, opacity: 0.7, taper: 1 }); if (k === 6) g.pen([[gx, gy - 8], [gx + side * 6, gy - 40]], { w: 0.7, color: INK, seed: 150 + side, boil: 0, opacity: 0.8 }); }
  });
  type(g, "TRITICUM", 1105, 262, 10, 160, INK, "center");

  g.paper("paper", 0.06);
};

export const adaptScrapbook: Film = { meta: { title: "Why sourdough rises · quiet archival scrapbook (adapted hand)", W, H, fps: 30, bpm: 120, durationFrames: 1 }, assets: { images: {} }, shots: [{ id: "still", start: 0, end: 1, draw }] };
