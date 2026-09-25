import { Gfx, fractal, rng, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { bounds, mix, smooth } from "./gallery";
import { bee, rose, type Engraving } from "./scrapbookEngraving";
import { GLYPHS, advance, clamp01, easeOut, engrave, fibres, glyph, handWrite, measure, onGrid, path, rect, scissor, shadowOf, staged, tear, typed, type Face, type Step } from "./scrapbookKit";

// HOW A HONEYBEE FINDS FLOWERS · archival scrapbook explainer.
//
// MEDIUM, physically. A page from an old field-notes album: rag paper gone to parchment, foxed
// with rust spots where the iron in the sheet oxidised, darker toward its handled edges, folded
// once. On it, cards torn from other stock are laid down and held with yellowing cellulose tape
// or pegged to a twine line with a wooden clothespin. The pictures are COPPERPLATE ENGRAVINGS:
// every tone is a burin line that swells where it is pressed and comes to a point where it
// lifts, contour-hatched round the form, cross-hatched only in the darks, cast shadows ruled in
// horizontal lines; afterwards a few areas are hand-tinted with a thin wash, as plates were.
// Words come from three hands: a TYPEWRITER (slab-serif monospace strikes, each its own ink
// density, the ribbon printing faintly double), RANSOM-NOTE titles (each letter cut from a
// different printed page: a paper tile with its own colour, face, weight and tilt, pasted with a
// small lift), and a red HAND for annotation. A rubber stamp goes on last.
// MARK / EDGE / ORDER. Mark: the tapering burin line; the struck character; the cut tile. Edge:
// torn deckle on the cards, scissor-crisp on the tiles, no drawn outline round anything that is
// paper. Order: page, cards down and taped, engravings cut line by line (contour, shading passes,
// cross-hatch, fur, shadow), hand tint, captions typed, titles pasted letter by letter, the dance
// diagram drawn, the chart plotted and annotated, the stamp.
// NOT its neighbours: fox (cut paper) has no line and no type; pocketWatch (ballpoint) builds tone
// from a constant-width biro; mellan (engraving) is one spiral. Here tone is many swelling lines
// that follow the form, on collaged ephemera.
// PALETTE: parchment #e8d6b2, sepia-black ink #2a2019, teal #4f8f8a, dusty pink #d9a5a0, stamp
// red #b8322a, navy #22335a, mustard #d6a13c. LIGHT: one lamp, upper left: cards, tiles and
// clothespin shadow down-right; the engravings are shaded to it.
// SUBJECT: the forager (focal, largest), the flower she finds, the dance that tells the hive
// where it is, and the evidence that run length encodes distance.

const INK = "#2a2019", NAVY = "#22335a", RED = "#b8322a", REDPEN = "#c23a2a", TEAL = "#4f8f8a", PINK = "#d9a5a0", MUSTARD = "#d6a13c", PARCH = "#e8d6b2";
const PEN: Medium = { nib: 1, taper: 0.35, pressure: 0.35, retrace: false, wobble: 0.5, rough: 0.35 };
const N = 510;

// ---------------------------------------------------------------- the cue table (every frame number)
const CUE = {
  beeCard: [10, 30], beeTape1: [30, 35], beeTape2: [35, 40],
  chartCard: [40, 55], chartTape: [55, 60],
  waggleCard: [60, 75], waggleTape: [75, 80],
  string: [80, 90], flowerCard: [90, 105], peg: [100, 110],
  tag: [110, 120], tagType: [120, 135],
  bee: [[140, 165], [165, 195], [195, 220], [220, 245], [245, 265], [265, 285], [285, 295]],
  rose: [[295, 305], [305, 325], [325, 335], [335, 345], [345, 350]],
  tint: [350, 365], cap1: [360, 380], cap2: [370, 385],
  strip1: [385, 390], strip1Type: [390, 395], honey: [395, 420], strip2: [415, 420], strip2Type: [420, 425], flowers: [425, 445],
  waggle: [445, 470], chart: [455, 480], notes: [475, 490], stamp: [490, 495],
} as const;
onGrid("scrapbook", Object.values(CUE).flat(2) as number[], N);

// ---------------------------------------------------------------- the cards
type Card = { cx: number; cy: number; w: number; h: number; rot: number; color: string; seed: number; from: P; torn: number };
const CARDS = {
  bee: { cx: 300, cy: 560, w: 500, h: 470, rot: -0.028, color: "#f2eadb", seed: 11, from: [-40, 70], torn: 2.4 },
  chart: { cx: 300, cy: 942, w: 470, h: 205, rot: 0.024, color: "#efe5cf", seed: 12, from: [30, 80], torn: 2.2 },
  waggle: { cx: 812, cy: 850, w: 440, h: 360, rot: -0.02, color: "#c9d9d5", seed: 13, from: [80, 60], torn: 2.6 },
  flower: { cx: 772, cy: 488, w: 268, h: 330, rot: 0.045, color: "#f1ebe0", seed: 14, from: [0, -60], torn: 2 },
} satisfies Record<string, Card>;
const toPage = (cd: Card, [x, y]: P, dx = 0, dy = 0): P => { const c = Math.cos(cd.rot), s = Math.sin(cd.rot); return [cd.cx + dx + x * c - y * s, cd.cy + dy + x * s + y * c]; };
const cardXf = (c: Ctx, env: Env, cd: Card) => { c.setTransform(env.scale, 0, 0, env.scale, 0, 0); c.translate(cd.cx, cd.cy); c.rotate(cd.rot); };
const cardShape = (cd: Card) => tear(rect(cd.w, cd.h), cd.torn, cd.seed);
const drawCard = (ctx: Ctx, env: Env, cd: Card, p: number) => {
  const e = easeOut(p), dx = cd.from[0] * (1 - e), dy = cd.from[1] * (1 - e), lift = 1 + 6 * (1 - e) * (1 - e);
  const g = new Gfx(ctx, env, 0, PEN), sh = cardShape(cd).map((q) => toPage(cd, q, dx, dy));
  shadowOf(g, [sh], [2.5 * lift, 4 * lift], 3 + 2.5 * lift, 0.34 / Math.sqrt(lift));
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.fillStyle = cd.color; path(ctx, sh); ctx.fill();
  fibres(ctx, sh, cd.color, cd.seed + 5, 0.8, 0.28);
  ctx.strokeStyle = mix(cd.color, "#7a5a30", 0.35); ctx.globalAlpha = 0.35; ctx.lineWidth = 1.2; path(ctx, sh); ctx.stroke(); ctx.globalAlpha = 1;   // the handled, darkened deckle
};
// cellulose tape: yellowed, translucent, a torn zig-zag at each end, laid from one end
const tape = (ctx: Ctx, env: Env, at: P, ang: number, len: number, p: number, seed: number) => {
  if (p <= 0) return; const r = rng(seed), L = len * easeOut(p), h = 30, c = Math.cos(ang), s = Math.sin(ang), T = ([x, y]: P): P => [at[0] + x * c - y * s, at[1] + x * s + y * c];
  const top: P[] = [], bot: P[] = []; for (let k = 0; k <= 5; k++) { top.push([-len / 2 + (r() - 0.5) * 3, -h / 2 + (k * h) / 5]); }
  const endX = -len / 2 + L; for (let k = 5; k >= 0; k--) bot.push([endX + (k % 2 ? 3 : -2) * (p >= 1 ? 1 : 0), -h / 2 + (k * h) / 5]);
  const sh = [...top, ...bot].map(T); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  const g = new Gfx(ctx, env, 0, PEN); shadowOf(g, [sh], [1, 1.5], 1.5, 0.12); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.globalAlpha = 0.5; ctx.fillStyle = "#efe0a8"; path(ctx, sh); ctx.fill();
  ctx.globalAlpha = 0.28; ctx.fillStyle = "#fffbe8"; path(ctx, ([[-len / 2 + 4, -h / 2 + 4], [endX - 4, -h / 2 + 4], [endX - 4, -h / 2 + 8], [-len / 2 + 4, -h / 2 + 9]] as P[]).map(T)); ctx.fill();   // the sheen along one edge
  ctx.globalAlpha = 0.18; ctx.strokeStyle = "#8a6a2a"; ctx.lineWidth = 0.7; for (let k = 0; k < 3; k++) { const x = -len / 2 + 12 + r() * (L - 20); if (x < endX - 6) { ctx.beginPath(); const a = T([x, -h / 2 + 2]), b = T([x + (r() - 0.5) * 10, h / 2 - 2]); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }   // crinkles
  ctx.globalAlpha = 1;
};

// ---------------------------------------------------------------- the page
const page = (ctx: Ctx, env: Env) => {
  const { W, H } = env, r = rng(301); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.fillStyle = PARCH; ctx.fillRect(0, 0, W, H);
  // uneven age: broad pale and dark clouds, never a gradient you can see the centre of
  for (let i = 0; i < 14; i++) { const x = r() * W, y = r() * H, R = 120 + r() * 260, gr = ctx.createRadialGradient(x, y, 0, x, y, R), col = r() < 0.55 ? "#f4e7c9" : "#caa874"; gr.addColorStop(0, col); gr.addColorStop(1, col + "00"); ctx.globalAlpha = 0.28; ctx.fillStyle = gr; ctx.fillRect(x - R, y - R, R * 2, R * 2); }
  // handled edges darken; the corners most
  const eg = (x0: number, y0: number, x1: number, y1: number) => { const gr = ctx.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "rgba(120,78,30,0.34)"); gr.addColorStop(1, "rgba(120,78,30,0)"); ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); };
  eg(0, 0, 60, 0); eg(W, 0, W - 70, 0); eg(0, 0, 0, 55); eg(0, H, 0, H - 80);
  // a tide mark from an old spill, lower right, under where the chart will sit
  ctx.globalAlpha = 0.16; ctx.strokeStyle = "#9a6a30"; ctx.lineWidth = 2.2; path(ctx, smooth(Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * 6.28, k = 1 + (fractal(9, Math.cos(a) * 2, Math.sin(a) * 2, 0.8, 0.8, 2) - 0.5) * 0.25; return [610 + Math.cos(a) * 150 * k, 1010 + Math.sin(a) * 118 * k] as P; }), true, 6)); ctx.stroke();
  // the fold: a pale ridge and its dark valley across the page
  ctx.globalAlpha = 0.22; ctx.strokeStyle = "#fff6df"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 604); ctx.bezierCurveTo(300, 600, 700, 609, W, 603); ctx.stroke();
  ctx.globalAlpha = 0.16; ctx.strokeStyle = "#7a5424"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 606.5); ctx.bezierCurveTo(300, 602.5, 700, 611.5, W, 605.5); ctx.stroke();
  // foxing: rust spots in drifts (right margin, the lower-left corner, a scatter at the fold), bare elsewhere
  const drift = (cx: number, cy: number, sx: number, sy: number, n: number, big: number) => { for (let i = 0; i < n; i++) { const x = cx + (r() + r() - 1) * sx, y = cy + (r() + r() - 1) * sy, s = (0.6 + r() * r() * big) * 2.2; ctx.globalAlpha = 0.18 + r() * 0.25; ctx.fillStyle = "#a4652a"; path(ctx, smooth(Array.from({ length: 7 }, (_, k) => { const a = (k / 7) * 6.28; return [x + Math.cos(a) * s * (0.8 + r() * 0.4), y + Math.sin(a) * s * (0.8 + r() * 0.4)] as P; }), true, 4)); ctx.fill(); if (s > 3) { ctx.globalAlpha *= 0.5; ctx.beginPath(); ctx.arc(x, y, s * 2.2, 0, 6.28); ctx.fill(); } } };
  drift(1045, 360, 30, 220, 38, 3); drift(60, 1010, 70, 60, 34, 4); drift(540, 610, 160, 12, 16, 1.5); drift(980, 60, 60, 30, 10, 2);
  ctx.globalAlpha = 1;
};
const post = (ctx: Ctx, env: Env) => { const g = new Gfx(ctx, env, 0, PEN); g.paper("paper", 0.1); g.vignette("rgba(96,62,24,0.30)"); };

// ---------------------------------------------------------------- the engravings (cut once, cached)
const eng = (env: Env, id: "bee" | "rose"): Engraving => { const k = `scrapbook:eng:${id}`; let e = env.cache.get(k) as Engraving | undefined; if (!e) { e = id === "bee" ? bee(-8, -34, 28, 0.9) : rose(-4, -58, 84); env.cache.set(k, e); } return e; };
const cutPass = (ctx: Ctx, env: Env, cd: Card, id: "bee" | "rose", pass: number, p: number) => { cardXf(ctx, env, cd); engrave(ctx, eng(env, id).passes[pass], p, INK); };
// a hand tint: a thin wash that spreads from where the brush touched, multiplied over the lines
const tint = (ctx: Ctx, env: Env, cd: Card, id: "bee" | "rose", p: number) => {
  const g = new Gfx(ctx, env, 0, PEN), t = eng(env, id).tint;
  g.group("paint", () => { const c = g.cur; t.forEach((w, i) => { const q = clamp01(p * 1.6 - i * 0.08); if (q <= 0) return; const sh = w.shape.map((v) => toPage(cd, v)), b = bounds(sh), R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) * easeOut(q); c.save(); c.beginPath(); c.arc(b.x0 + (b.x1 - b.x0) * 0.3, b.y0 + (b.y1 - b.y0) * 0.35, R, 0, 6.28); c.clip(); c.globalAlpha = w.alpha; c.fillStyle = w.color; path(c, sh); c.fill(); c.globalAlpha = w.alpha * 0.5; c.strokeStyle = w.color; c.lineWidth = 2; c.stroke(); c.restore(); g.touch(b.x0 - 4, b.y0 - 4, b.x1 + 4, b.y1 + 4); }); c.globalAlpha = 1; }, { blend: "multiply" });
};

// ---------------------------------------------------------------- ransom-note titles
type Tile = { ch: string; x: number; y: number; cap: number; face: Face; bg: string; fg: string; rot: number; seed: number; news: boolean };
const FACES: Face[] = [
  { weight: 0.2 }, { weight: 0.15, serif: 0.9 }, { weight: 0.12, outline: "" }, { weight: 0.14, slant: 0.22 }, { weight: 0.075, serif: 0.7, wide: 0.78 },
  { weight: 0.17, wide: 1.25 }, { weight: 0.16, cap: "round", join: "round" }, { weight: 0.11, serif: 1.0, slant: 0.12 },
];
const PAIRS: [string, string][] = [[NAVY, "#f3ead6"], [TEAL, "#1c1a18"], ["#f1e9d8", "#1c1a18"], [PINK, NAVY], [RED, "#f6ecd9"], [MUSTARD, "#1c1a18"], ["#d8d2c4", "#1c1a18"], ["#1d1b19", "#efe6d0"], ["#e9c9b4", RED]];
const ransom = (word: string, x0: number, y0: number, capBase: number, seed: number): Tile[] => {
  const r = rng(seed), out: Tile[] = []; let x = x0, lastP = -1, lastF = -1;
  [...word].forEach((ch, i) => {
    let pi = Math.floor(r() * PAIRS.length); if (pi === lastP) pi = (pi + 3) % PAIRS.length; let fi = Math.floor(r() * FACES.length); if (fi === lastF) fi = (fi + 2) % FACES.length; lastP = pi; lastF = fi;
    const [bg, fg] = PAIRS[pi], face = { ...FACES[fi] }; if (face.outline !== undefined) face.outline = bg;
    const cap = capBase * (0.84 + r() * 0.3), gw = ((GLYPHS[ch]?.w ?? 4) * (face.wide ?? 1) + 6 * (face.slant ?? 0)) * (cap / 6), w = gw + cap * (0.5 + r() * 0.25);
    out.push({ ch, x: x + w / 2, y: y0 + (r() - 0.5) * capBase * 0.22, cap, face, bg, fg, rot: (r() - 0.5) * 0.2, seed: seed * 10 + i, news: r() < 0.4 });
    x += w + 3 + r() * 6;
  });
  return out;
};
const tileShape = (t: Tile): P[] => { const gw = ((GLYPHS[t.ch]?.w ?? 4) * (t.face.wide ?? 1) + 6 * (t.face.slant ?? 0)) * (t.cap / 6), r = rng(t.seed), w = gw + t.cap * 0.55, h = t.cap * (1.5 + r() * 0.2); return scissor([[-w / 2 + (r() - 0.5) * 4, -h / 2 + (r() - 0.5) * 4], [w / 2 + (r() - 0.5) * 4, -h / 2 + (r() - 0.5) * 4], [w / 2 + (r() - 0.5) * 4, h / 2 + (r() - 0.5) * 4], [-w / 2 + (r() - 0.5) * 4, h / 2 + (r() - 0.5) * 4]], t.seed, 0.8); };
const drawTile = (ctx: Ctx, env: Env, t: Tile, p: number) => {
  if (p <= 0) return; const e = easeOut(p), lift = 1 + 5 * (1 - e) * (1 - e), dx = -6 * (1 - e), dy = -12 * (1 - e), rot = t.rot + 0.25 * (1 - e) * (t.seed % 2 ? 1 : -1);
  const c = Math.cos(rot), s = Math.sin(rot), T = ([x, y]: P): P => [t.x + dx + x * c - y * s, t.y + dy + x * s + y * c], sh = tileShape(t).map(T);
  const g = new Gfx(ctx, env, 0, PEN); shadowOf(g, [sh], [1.5 * lift, 2.5 * lift], 1.5 + lift, 0.4 / Math.sqrt(lift));
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = t.bg; path(ctx, sh); ctx.fill(); fibres(ctx, sh, t.bg, t.seed, 0.6, 0.18);
  ctx.translate(t.x + dx, t.y + dy); ctx.rotate(rot);
  if (t.news) { const r = rng(t.seed + 9), b = bounds(tileShape(t)); ctx.save(); path(ctx, tileShape(t)); ctx.clip(); ctx.globalAlpha = 0.3; ctx.fillStyle = t.fg; for (let y = b.y0 + 3; y < b.y1; y += 5) { let x = b.x0 + 2; while (x < b.x1) { const l = 3 + r() * 14; ctx.fillRect(x, y, l, 1.4); x += l + 3; } } ctx.restore(); ctx.globalAlpha = 1; ctx.fillStyle = t.bg; ctx.globalAlpha = 0.8; const gw = measure(t.ch, t.cap, t.face); ctx.fillRect(-gw / 2 - t.cap * 0.12, -t.cap * 0.62, gw + t.cap * 0.24, t.cap * 1.24); ctx.globalAlpha = 1; }   // cut from a column of print: the letter sits on a cleared patch
  const gw = ((GLYPHS[t.ch]?.w ?? 4) * (t.face.wide ?? 1) + 6 * (t.face.slant ?? 0)) * (t.cap / 6);
  glyph(ctx, t.ch, -gw / 2, -t.cap / 2, t.cap, t.face, t.fg);
};
// a typed strip: a slip of white paper, the words struck one character at a time
type Strip = { text: string; x: number; y: number; cap: number; rot: number; color: string; seed: number };
const stripShape = (st: Strip): P[] => { const w = measure(st.text, st.cap, { weight: 0.1, mono: 4.2, track: 0.9 }) + st.cap * 1.6, h = st.cap * 2.3; return tear(rect(w, h), 1.2, st.seed); };
const drawStrip = (ctx: Ctx, env: Env, st: Strip, p: number, typedN: number) => {
  if (p <= 0) return; const e = easeOut(p), lift = 1 + 4 * (1 - e) * (1 - e), dy = -14 * (1 - e), c = Math.cos(st.rot), s = Math.sin(st.rot), T = ([x, y]: P): P => [st.x + x * c - y * s, st.y + dy + x * s + y * c], sh = stripShape(st).map(T);
  const g = new Gfx(ctx, env, 0, PEN); shadowOf(g, [sh], [1.5 * lift, 2.5 * lift], 1.5 + lift, 0.36 / Math.sqrt(lift));
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = st.color; path(ctx, sh); ctx.fill(); fibres(ctx, sh, st.color, st.seed, 0.6, 0.15);
  if (typedN > 0) { ctx.translate(st.x, st.y + dy); ctx.rotate(st.rot); const w = measure(st.text, st.cap, { weight: 0.1, mono: 4.2, track: 0.9 }); typed(ctx, st.text, -w / 2, -st.cap / 2, st.cap, "#221d1a", st.seed, typedN); }
};
const TAG: Strip = { text: "§3  FORAGING", x: 150, y: 58, cap: 15, rot: -0.012, color: "#f4efe4", seed: 71 };
const S1: Strip = { text: "HOW A", x: 150, y: 150, cap: 20, rot: -0.03, color: "#f7f2e8", seed: 72 };
const S2: Strip = { text: "FINDS", x: 360, y: 250, cap: 20, rot: 0.025, color: "#f7f2e8", seed: 73 };
const HONEY = ransom("HONEYBEE", 238, 148, 50, 91);
const FLOWERS = ransom("FLOWERS", 452, 246, 48, 94);

// ---------------------------------------------------------------- the string and the peg
const STRING: P[] = [[560, 312], [700, 322], [860, 324], [1000, 314], [1090, 306]];
const fillC = (g: Gfx, x: number, y: number, r: number, col: string) => { const c = g.cur; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill(); g.touch(x - r, y - r, x + r, y + r); };
const drawString = (ctx: Ctx, env: Env, p: number) => {
  const g = new Gfx(ctx, env, 0, PEN), s = smooth(STRING, false, 12);
  g.group("plain", () => { g.pen(s.map(([x, y]) => [x + 1.5, y + 3] as P), { w: 2, color: "#3b2a14", seed: 3, wobble: 0, boil: 0, taper: 0, opacity: 0.35, retrace: false, progress: p }); }, { blur: 1.5 });
  if (p > 0) { const [px, py] = STRING[0]; g.group("plain", () => fillC(g, px + 3, py + 4, 6.5, "#3b2a14"), { blur: 2, alpha: 0.4 }); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); const gr = ctx.createRadialGradient(px - 2, py - 2, 0.5, px, py, 6.5); gr.addColorStop(0, "#f3dc9a"); gr.addColorStop(0.5, "#c49a45"); gr.addColorStop(1, "#7a5a22"); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, 6.5, 0, 6.28); ctx.fill(); }
  g.pen(s, { w: 2.1, color: "#7a6446", seed: 4, wobble: 0.3, boil: 0, taper: 0, opacity: 1, retrace: false, progress: p });
  // the twist of the twine: little diagonal ticks along it
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.strokeStyle = "#4c3a24"; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.6; const n = Math.floor((s.length - 1) * p);
  for (let i = 2; i < n; i += 3) { const [x, y] = s[i]; ctx.beginPath(); ctx.moveTo(x - 1.2, y - 1.2); ctx.lineTo(x + 1.2, y + 1.2); ctx.stroke(); } ctx.globalAlpha = 1;
};
const drawPeg = (ctx: Ctx, env: Env, p: number) => {
  if (p <= 0) return; const e = easeOut(p), at = toPage(CARDS.flower, [0, -CARDS.flower.h / 2 + 10]), x = at[0], y = at[1] - 26 - 40 * (1 - e), a = 0.05;
  const c = Math.cos(a), s = Math.sin(a), T = ([u, v]: P): P => [x + u * c - v * s, y + u * s + v * c];
  const half = (sg: number): P[] => [[sg * 1, -40], [sg * 10, -40], [sg * 11, -30], [sg * 9, -6], [sg * 12, 14], [sg * 11, 40], [sg * 1, 40]].map(([u, v]) => T([u, v] as P));
  const g = new Gfx(ctx, env, 0, PEN); shadowOf(g, [half(-1), half(1)], [4, 6], 3, 0.35);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  [-1, 1].forEach((sg) => { const sh = half(sg); ctx.fillStyle = sg < 0 ? "#d9b88a" : "#c9a577"; path(ctx, sh); ctx.fill(); ctx.strokeStyle = "#8a6a44"; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.5; for (let k = 0; k < 3; k++) { const u = sg * (3 + k * 2.6); ctx.beginPath(); const a1 = T([u, -38]), b1 = T([u + sg * 0.8, 38]); ctx.moveTo(a1[0], a1[1]); ctx.quadraticCurveTo((a1[0] + b1[0]) / 2 + sg, (a1[1] + b1[1]) / 2, b1[0], b1[1]); ctx.stroke(); } ctx.globalAlpha = 0.8; ctx.strokeStyle = "#6b4e2c"; path(ctx, sh); ctx.stroke(); ctx.globalAlpha = 1; });
  // the steel spring: a coil across both prongs
  ctx.strokeStyle = "#5b5f63"; ctx.lineWidth = 1.6; for (let k = 0; k < 4; k++) { const a1 = T([-12, -4 + k * 2.6]), b1 = T([12, -2 + k * 2.6]); ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke(); }
  ctx.strokeStyle = "#c9ccd0"; ctx.lineWidth = 0.6; for (let k = 0; k < 4; k++) { const a1 = T([-11, -4.6 + k * 2.6]), b1 = T([11, -2.6 + k * 2.6]); ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke(); }
};

// ---------------------------------------------------------------- the waggle-dance card (drawn in navy pen)
type Stroke = { pts: P[]; w: number; color: string; dash?: boolean };
const waggleStrokes = (): Stroke[] => {
  const S: Stroke[] = [], deg = 40, a = (deg * Math.PI) / 180, dir: P = [Math.sin(a), -Math.cos(a)], nrm: P = [Math.cos(a), Math.sin(a)];
  // left: on the vertical comb. A few cells of comb in the corner, the UP arrow, the dance
  const hex = (cx: number, cy: number, R: number): P[] => Array.from({ length: 7 }, (_, i) => [cx + Math.cos((i / 6) * 6.28 + 0.52) * R, cy + Math.sin((i / 6) * 6.28 + 0.52) * R] as P);
  [[-190, 140], [-168, 153], [-146, 140], [-190, 114], [-168, 127], [-124, 153], [-212, 127]].forEach(([x, y]) => S.push({ pts: hex(x, y, 12.5), w: 0.8, color: "#6f8a90" }));
  S.push({ pts: [[-200, 90], [-200, -120]], w: 1.4, color: NAVY, dash: true }); S.push({ pts: [[-207, -108], [-200, -122], [-193, -108]], w: 1.4, color: NAVY });
  const c: P = [-100, 6], L = 70, A: P = [c[0] - dir[0] * L, c[1] - dir[1] * L], Bp: P = [c[0] + dir[0] * L, c[1] + dir[1] * L];
  // the return loops first (dashed), then the waggle run: a zig-zag, the bee's body shaking side to side
  const loop = (sg: number): P[] => { const pts: P[] = []; for (let k = 0; k <= 16; k++) { const u = (k / 16) * Math.PI, rr = L * 1.02; pts.push([c[0] + dir[0] * Math.cos(u) * rr + nrm[0] * Math.sin(u) * rr * 0.72 * sg, c[1] + dir[1] * Math.cos(u) * rr + nrm[1] * Math.sin(u) * rr * 0.72 * sg]); } return pts; };
  S.push({ pts: loop(1), w: 1.3, color: NAVY, dash: true }); S.push({ pts: loop(-1), w: 1.3, color: NAVY, dash: true });
  [1, -1].forEach((sg) => { const l = loop(sg), m = l[8], q = l[9], dx = q[0] - m[0], dy = q[1] - m[1], ll = Math.hypot(dx, dy), ux = dx / ll, uy = dy / ll; S.push({ pts: [[m[0] - ux * 7 - uy * 5, m[1] - uy * 7 + ux * 5], [m[0] + ux * 3, m[1] + uy * 3], [m[0] - ux * 7 + uy * 5, m[1] - uy * 7 - ux * 5]], w: 1.3, color: NAVY }); });
  const zz: P[] = []; for (let k = 0; k <= 16; k++) { const u = k / 16, amp = k === 0 || k === 16 ? 0 : (k % 2 ? 7 : -7); zz.push([A[0] + (Bp[0] - A[0]) * u + nrm[0] * amp, A[1] + (Bp[1] - A[1]) * u + nrm[1] * amp]); }
  S.push({ pts: zz, w: 2.1, color: NAVY });
  S.push({ pts: [[Bp[0] - dir[0] * 11 - nrm[0] * 7, Bp[1] - dir[1] * 11 - nrm[1] * 7], [Bp[0] + dir[0] * 4, Bp[1] + dir[1] * 4], [Bp[0] - dir[0] * 11 + nrm[0] * 7, Bp[1] - dir[1] * 11 + nrm[1] * 7]], w: 2, color: NAVY });
  // right: in the field. Hive, sun, the bearing to the flowers
  const hv: P = [60, 118], sun: P = [60, -112];
  const skep: P[] = []; for (let k = 0; k <= 14; k++) { const u = Math.PI + (k / 14) * Math.PI; skep.push([hv[0] + Math.cos(u) * 20, hv[1] + 4 + Math.sin(u) * 24]); } S.push({ pts: skep, w: 1.5, color: NAVY });
  S.push({ pts: [[hv[0] - 23, hv[1] + 4], [hv[0] + 23, hv[1] + 4]], w: 1.5, color: NAVY }); [-12, -3, 6].forEach((dy) => S.push({ pts: [[hv[0] - 18 + Math.abs(dy) * 0.2, hv[1] + dy - 6], [hv[0] + 18 - Math.abs(dy) * 0.2, hv[1] + dy - 6]], w: 0.9, color: NAVY }));
  S.push({ pts: [[hv[0], hv[1] - 20], sun], w: 1.3, color: NAVY, dash: true });
  const sunC: P[] = []; for (let k = 0; k <= 20; k++) { const u = (k / 20) * 6.28; sunC.push([sun[0] + Math.cos(u) * 12, sun[1] + Math.sin(u) * 12]); } S.push({ pts: sunC, w: 1.5, color: NAVY });
  for (let k = 0; k < 8; k++) { const u = (k / 8) * 6.28 + 0.2; S.push({ pts: [[sun[0] + Math.cos(u) * 17, sun[1] + Math.sin(u) * 17], [sun[0] + Math.cos(u) * 24, sun[1] + Math.sin(u) * 24]], w: 1.2, color: NAVY }); }
  const fl: P = [hv[0] + dir[0] * 150, hv[1] - 20 + dir[1] * 150];
  S.push({ pts: [[hv[0], hv[1] - 20], fl], w: 1.8, color: NAVY });
  S.push({ pts: [[fl[0] - dir[0] * 12 - nrm[0] * 6, fl[1] - dir[1] * 12 - nrm[1] * 6], fl, [fl[0] - dir[0] * 12 + nrm[0] * 6, fl[1] - dir[1] * 12 + nrm[1] * 6]], w: 1.8, color: NAVY });
  // a drift of small flowers where the bearing lands
  [[10, -6], [24, 8], [-6, 12], [30, -14], [16, 22]].forEach(([dx, dy], i) => { const q: P = [fl[0] + dx + 6, fl[1] + dy + 8]; for (let k = 0; k < 5; k++) { const u = (k / 5) * 6.28 + i; S.push({ pts: [q, [q[0] + Math.cos(u) * 4.5, q[1] + Math.sin(u) * 4.5]], w: 1.3, color: TEAL }); } });
  // the two angles, in the red hand
  const arc = (o: P, r: number): P[] => { const pts: P[] = []; for (let k = 0; k <= 10; k++) { const u = -Math.PI / 2 + (k / 10) * a; pts.push([o[0] + Math.cos(u) * r, o[1] + Math.sin(u) * r]); } return pts; };
  S.push({ pts: [[c[0], c[1] + 10], [c[0], c[1] - 86]], w: 1, color: REDPEN, dash: true });
  S.push({ pts: arc(c, 40), w: 1.6, color: REDPEN }); S.push({ pts: arc([hv[0], hv[1] - 20], 54), w: 1.6, color: REDPEN });
  S.push({ pts: [[0, -128], [0, 128]], w: 0.8, color: "#7d9a9c", dash: true });
  return S;
};
const dashes = (pts: P[], on = 7, off = 5): P[][] => { const out: P[][] = []; let cur: P[] = [], acc = 0, draw = true; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = 0; if (draw && !cur.length) cur.push(a); while (t < L) { const lim = draw ? on : off, step = Math.min(lim - acc, L - t); t += step; acc += step; const p: P = [a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L]; if (draw) cur.push(p); if (acc >= lim - 1e-9) { acc = 0; if (draw) { if (cur.length > 1) out.push(cur); cur = []; } else cur = [p]; draw = !draw; } } } if (draw && cur.length > 1) out.push(cur); return out; };
const penStrokes = (g: Gfx, cd: Card, strokes: Stroke[], p: number, seed: number) => {
  const n = p >= 1 ? strokes.length : p * strokes.length;
  strokes.forEach((s, i) => { const q = n >= i + 1 ? 1 : clamp01(n - i); if (q <= 0) return; const pts = s.pts.map((v) => toPage(cd, v)); if (s.dash) { const parts = dashes(pts.length > 2 ? smooth(pts, false, 6) : pts), m = q >= 1 ? parts.length : Math.floor(parts.length * q); parts.slice(0, m).forEach((d, k) => g.pen(d, { w: s.w, color: s.color, seed: seed + i * 13 + k, wobble: 0.2, boil: 0, taper: 0.2, opacity: 0.95, retrace: false })); } else g.pen(pts, { w: s.w, color: s.color, seed: seed + i * 13, wobble: 0.35, boil: 0, taper: 0.4, opacity: 0.95, retrace: false, progress: q }); });
};
const WAGGLE_LABELS: [string, number, number, number][] = [["UP", -224, -140, 11], ["ON THE COMB", -190, 168, 11], ["IN THE FIELD", 44, 168, 11], ["SUN", 82, -118, 11], ["HIVE", 88, 112, 11], ["FLOWERS", 116, -52, 10]];

// ---------------------------------------------------------------- the chart
const BARS: [string, number][] = [["0.5", 0.55], ["1", 1.05], ["2", 1.9], ["3", 2.6]];
const CH = { ox: -150, oy: 62, x1: 200, top: -52, px: 32, bx: [-96, -12, 72, 156], bw: 44 };
const drawChart = (ctx: Ctx, env: Env, p: number) => {
  const cd = CARDS.chart, g = new Gfx(ctx, env, 0, PEN), P2 = (v: P) => toPage(cd, v);
  const ax = clamp01(p / 0.3), bars = clamp01((p - 0.3) / 0.7);
  g.pen([P2([CH.ox, CH.top]), P2([CH.ox, CH.oy])], { w: 1.6, color: NAVY, seed: 81, wobble: 0.2, boil: 0, taper: 0.1, retrace: false, progress: clamp01(ax * 2) });
  g.pen([P2([CH.ox, CH.oy]), P2([CH.x1, CH.oy])], { w: 1.6, color: NAVY, seed: 82, wobble: 0.2, boil: 0, taper: 0.1, retrace: false, progress: clamp01(ax * 2 - 1) });
  [1, 2, 3].forEach((v, i) => { if (ax >= 1) g.pen([P2([CH.ox - 6, CH.oy - v * CH.px]), P2([CH.ox, CH.oy - v * CH.px])], { w: 1.2, color: NAVY, seed: 83 + i, wobble: 0.1, boil: 0, taper: 0, retrace: false }); });
  // bars are inked upward from the axis, one after another; the ink breaks on the paper's tooth
  g.group("plain", () => { const c = g.cur; BARS.forEach(([, v], i) => { const q = clamp01(bars * BARS.length - i); if (q <= 0) return; const h = v * CH.px * easeOut(q), x = CH.bx[i]; c.fillStyle = RED; path(c, [P2([x - CH.bw / 2, CH.oy - 1]), P2([x + CH.bw / 2, CH.oy - 1]), P2([x + CH.bw / 2, CH.oy - h]), P2([x - CH.bw / 2, CH.oy - h])]); c.fill(); const b = bounds([P2([x - CH.bw / 2, CH.oy]), P2([x + CH.bw / 2, CH.oy - h])]); g.touch(b.x0 - 2, b.y0 - 2, b.x1 + 2, b.y1 + 2); }); }, { textures: ["risoSpeck", "risoMottle"], blend: "multiply", alpha: 0.92 });
  cardXf(ctx, env, cd);
  if (ax >= 1) { [1, 2, 3].forEach((v) => typed(ctx, `${v}`, CH.ox - 20, CH.oy - v * CH.px - 5, 10, "#221d1a", 50 + v)); BARS.forEach(([k], i) => { const w = measure(k, 10, { weight: 0.1, mono: 4.2, track: 0.9 }); typed(ctx, k, CH.bx[i] - w / 2, CH.oy + 8, 10, "#221d1a", 60 + i); }); typed(ctx, "KM", CH.x1 - 8, CH.oy + 8, 10, "#221d1a", 70); typed(ctx, "SEC", CH.ox - 28, CH.top - 18, 10, "#221d1a", 71); }
  typed(ctx, "WAGGLE RUN VS DISTANCE", -212, -88, 12, "#221d1a", 72, Math.floor(clamp01(p * 3) * 22));
};
const drawNotes = (ctx: Ctx, env: Env, p: number) => {
  const cd = CARDS.chart, g = new Gfx(ctx, env, 0, PEN), P2 = (v: P) => toPage(cd, v);
  // the trend through the bar tops, a loop round the 1 km bar, and the reading in the red hand
  const tops: P[] = BARS.map(([, v], i) => [CH.bx[i], CH.oy - v * CH.px - 7]);
  const q1 = clamp01(p * 3), q2 = clamp01(p * 3 - 1), q3 = clamp01(p * 3 - 2);
  dashes(smooth(tops.map(P2), false, 6), 6, 4).forEach((d, k, arr) => { const m = q1 * arr.length; if (k < m) g.pen(d, { w: 1.6, color: REDPEN, seed: 90 + k, wobble: 0.3, boil: 0, taper: 0.2, retrace: false }); });
  const lp: P[] = []; for (let k = 0; k <= 22; k++) { const u = -0.4 + (k / 22) * 6.9, rr = 30 + k * 0.4; lp.push(P2([CH.bx[1] + Math.cos(u) * rr * 0.95, CH.oy - 1.05 * CH.px + 2 + Math.sin(u) * rr * 0.62])); }
  g.pen(lp, { w: 1.8, color: REDPEN, seed: 97, wobble: 0.6, boil: 0, taper: 0.6, retrace: false, progress: q2 });
  if (q3 > 0) { const base = P2([-52, -60]); handWrite(g, "~1 SEC PER KM", base[0], base[1], 15, REDPEN, 98, q3, 0.2, 1.9); }
};

// ---------------------------------------------------------------- the stamp
const drawStamp = (ctx: Ctx, env: Env, p: number) => {
  const x = 966, y = 100, rot = -0.14, w = 184, h = 74, g = new Gfx(ctx, env, 0, PEN), c0 = Math.cos(rot), s0 = Math.sin(rot);
  // a rubber stamp is rocked on: it meets the paper at one end first
  const reach = -w / 2 - 10 + (w + 20) * easeOut(clamp01(p * 1.5));
  g.group("plain", () => {
    const c = g.cur; c.save(); c.translate(x, y); c.rotate(rot); c.beginPath(); c.rect(-w / 2 - 12, -h / 2 - 12, reach + w / 2 + 12, h + 24); c.clip();
    c.strokeStyle = RED; c.lineWidth = 3.2; c.strokeRect(-w / 2, -h / 2, w, h); c.lineWidth = 1.2; c.strokeRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12);
    const big: Face = { weight: 0.17, serif: 0.6, wide: 1.05, track: 1.5 }, tw = measure("SPECIMEN", 23, big); let cx = -tw / 2; [..."SPECIMEN"].forEach((ch) => { glyph(c, ch, cx, -h / 2 + 13, 23, big, RED); cx += advance(ch, big) * (23 / 6); });
    const sm: Face = { weight: 0.11, track: 1.6 }, sw = measure("APIS MELLIFERA · L.", 10, sm); cx = -sw / 2; [..."APIS MELLIFERA · L."].forEach((ch) => { glyph(c, ch, cx, h / 2 - 22, 10, sm, RED); cx += advance(ch, sm) * (10 / 6); });
    c.restore(); g.touch(x - w, y - w, x + w, y + w);
  }, { textures: ["risoSpeck", "risoMottle"], blend: "multiply", alpha: 0.88 });
  void c0; void s0;
};

// ---------------------------------------------------------------- the steps, in painter order
const TAPES: [keyof typeof CARDS, P, number, number, readonly [number, number]][] = [
  ["bee", [-236, -222], -0.7, 96, CUE.beeTape1], ["bee", [232, -224], 0.66, 96, CUE.beeTape2],
  ["chart", [0, -104], 0.02, 84, CUE.chartTape], ["waggle", [-206, -170], -0.74, 90, CUE.waggleTape],
];
const card = (id: keyof typeof CARDS, cue: readonly [number, number]): Step => ({ id: `card-${id}`, start: cue[0], end: cue[1], draw: (c, e, p) => drawCard(c, e, CARDS[id], p) });
const steps: Step[] = [
  { id: "page", start: -1, end: 0, draw: (c, e) => page(c, e) },
  card("bee", CUE.beeCard), card("chart", CUE.chartCard), card("waggle", CUE.waggleCard),
  ...TAPES.map(([id, at, ang, len, cue], i): Step => ({ id: `tape${i}`, start: cue[0], end: cue[1], draw: (c, e, p) => { const cd = CARDS[id]; tape(c, e, toPage(cd, at), ang + cd.rot, len, p, 40 + i); } })),
  { id: "string", start: CUE.string[0], end: CUE.string[1], draw: (c, e, p) => drawString(c, e, p) },
  card("flower", CUE.flowerCard),
  { id: "peg", start: CUE.peg[0], end: CUE.peg[1], draw: (c, e, p) => drawPeg(c, e, p) },
  { id: "tag", start: CUE.tag[0], end: CUE.tagType[1], draw: (c, e, p, f) => drawStrip(c, e, TAG, p >= 1 ? 1 : clamp01((f - CUE.tag[0]) / 10), p >= 1 ? Infinity : Math.floor(clamp01((f - CUE.tagType[0]) / (CUE.tagType[1] - CUE.tagType[0])) * TAG.text.length)) },
  ...CUE.bee.map((cue, i): Step => ({ id: `bee${i}`, start: cue[0], end: cue[1], draw: (c, e, p) => cutPass(c, e, CARDS.bee, "bee", i, p) })),
  ...CUE.rose.map((cue, i): Step => ({ id: `rose${i}`, start: cue[0], end: cue[1], draw: (c, e, p) => cutPass(c, e, CARDS.flower, "rose", i, p) })),
  { id: "tint", start: CUE.tint[0], end: CUE.tint[1], draw: (c, e, p) => { tint(c, e, CARDS.bee, "bee", p); tint(c, e, CARDS.flower, "rose", clamp01(p * 1.2 - 0.2)); } },
  { id: "cap1", start: CUE.cap1[0], end: CUE.cap1[1], draw: (c, e, p) => { cardXf(c, e, CARDS.bee); const t = "FIG. 1   APIS MELLIFERA, THE FORAGER"; typed(c, t, -226, 196, 12, "#221d1a", 31, p >= 1 ? Infinity : Math.floor(p * t.length)); } },
  { id: "cap2", start: CUE.cap2[0], end: CUE.cap2[1], draw: (c, e, p) => { cardXf(c, e, CARDS.flower); const t = "FIG. 2   ROSA CANINA"; typed(c, t, -112, 140, 11, "#221d1a", 32, p >= 1 ? Infinity : Math.floor(p * t.length)); } },
  { id: "strip1", start: CUE.strip1[0], end: CUE.strip1Type[1], draw: (c, e, p, f) => drawStrip(c, e, S1, p >= 1 ? 1 : clamp01((f - CUE.strip1[0]) / 5), p >= 1 ? Infinity : Math.floor(clamp01((f - CUE.strip1Type[0]) / 5) * S1.text.length)) },
  ...HONEY.map((t, i): Step => ({ id: `h${i}`, start: CUE.honey[0] + i * 3, end: CUE.honey[0] + i * 3 + 4, draw: (c, e, p) => drawTile(c, e, t, p) })),
  { id: "strip2", start: CUE.strip2[0], end: CUE.strip2Type[1], draw: (c, e, p, f) => drawStrip(c, e, S2, p >= 1 ? 1 : clamp01((f - CUE.strip2[0]) / 5), p >= 1 ? Infinity : Math.floor(clamp01((f - CUE.strip2Type[0]) / 5) * S2.text.length)) },
  ...FLOWERS.map((t, i): Step => ({ id: `f${i}`, start: CUE.flowers[0] + i * 3, end: CUE.flowers[0] + i * 3 + 4, draw: (c, e, p) => drawTile(c, e, t, p) })),
  { id: "waggle", start: CUE.waggle[0], end: CUE.waggle[1], draw: (c, e, p) => { const cd = CARDS.waggle, g = new Gfx(c, e, 0, PEN); penStrokes(g, cd, waggleStrokes(), p, 200); cardXf(c, e, cd); const t = "FIG. 3   THE WAGGLE DANCE"; typed(c, t, -206, -160, 12, "#221d1a", 33, p >= 1 ? Infinity : Math.floor(clamp01(p * 2) * t.length)); if (p > 0.6) { const q = clamp01((p - 0.6) / 0.4); WAGGLE_LABELS.forEach(([s, x, y, cap], i) => typed(c, s, x, y, cap, NAVY, 34 + i, q >= 1 ? Infinity : Math.floor(q * s.length))); } if (p >= 0.9) { const g2 = new Gfx(c, e, 0, PEN), a = toPage(cd, [-86, -76]), b = toPage(cd, [68, 22]); handWrite(g2, "40°", a[0], a[1], 13, REDPEN, 41, clamp01((p - 0.9) * 10), 0.2, 1.7); handWrite(g2, "40°", b[0], b[1], 13, REDPEN, 42, clamp01((p - 0.9) * 10), 0.2, 1.7); } } },
  { id: "chart", start: CUE.chart[0], end: CUE.chart[1], draw: (c, e, p) => drawChart(c, e, p) },
  { id: "notes", start: CUE.notes[0], end: CUE.notes[1], draw: (c, e, p) => drawNotes(c, e, p) },
  { id: "stamp", start: CUE.stamp[0], end: CUE.stamp[1], draw: (c, e, p) => drawStamp(c, e, p) },
];

export const drawScrapbook = staged("scrapbook", steps, post);
export const scrapbook: Film = {
  meta: { title: "How a honeybee finds flowers · archival scrapbook", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N, raster: "cpu" },
  assets: { images: {} },
  shots: [{ id: "scrapbook", start: 0, end: N, draw: (ctx, f, env) => drawScrapbook(ctx, f, env) }],
};
export const STYLE = { id: "scrapbook", name: "Archival scrapbook", family: "collage + print", medium: "foxed rag-paper album page; torn cards, cellulose tape, a clothespin on twine; copperplate engravings hand-tinted; typewriter, ransom-note cut letters, red pen, rubber stamp", nearest: "fox", hero: "How a honeybee finds flowers: the forager, the rose, the waggle dance, the evidence" };
void MUSTARD; void rng;
