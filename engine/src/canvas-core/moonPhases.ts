import { Gfx, fractal, rng, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { letter } from "./drafting";
import { blob, clamp, fillShape, hatchRuns, inside, lerpP, smooth } from "./gallery";

// MOON PHASES · chalkboard. A teacher's board after a good lesson: the phases arc across the
// slate the way the moon crosses the sky, each one scumbled in with the side of the chalk and
// the lit limb worked over a second time, the terminator where the lit side and earthshine
// meet, maria left thin where the chalk skipped, a finger-smudged glow round the full moon.
// Chalk never makes a clean line: every stroke is broken by the board's tooth and sheds a haze
// of dust either side of itself. Behind it all, the ghosts of lessons not quite erased. A wooden
// frame, a ledge with a stub of chalk and a felt eraser.

const CHALK_M: Medium = { nib: 2.1, taper: 0.55, pressure: 0.95, retrace: true, wobble: 1.4, rough: 1.2 };
const CHALK = "#f4f0e6", YEL = "#f6e6a4", BLUE = "#a9d3e8", PINK = "#f3c1cf";
const B0 = 34, B1 = 1046, LEDGE = 958;                        // the board's inner edges

// chalk: one pass of dust (wide, soft, faint), then the stroke itself broken by the board's tooth
const chalk = (g: Gfx, draw: (dust: boolean) => void, dustAlpha = 0.2) => {
  g.group("plain", () => draw(true), { blur: 3.2, alpha: dustAlpha });
  g.group("plain", () => draw(false), { textures: ["pencilTooth", "risoSpeck"] });
};
const line = (g: Gfx, dust: boolean, pts: P[], w: number, color: string, seed: number, op = 0.92, wob = 1) =>
  g.pen(pts, { w: dust ? w * 2.6 : w, color, seed, wobble: wob, boil: 0, opacity: op, retrace: !dust, taper: 1 });
// the side of the chalk dragged back and forth: a scumble, clipped to a shape, thinning where `keep` says so
const scumble = (g: Gfx, dust: boolean, region: P[], color: string, o: { angle: number; gap: number; w: number; alpha: number; seed: number; keep?: (x: number, y: number) => boolean }) => {
  const { angle, gap, w, alpha, seed, keep = () => true } = o, r = rng(seed);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; region.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  const c = g.cur; g.touch(x0 - 12, y0 - 12, x1 + 12, y1 + 12);
  c.save(); c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = color; c.lineWidth = dust ? w * 2.2 : w;
  hatchRuns({ x0, y0, x1, y1 }, angle, gap, (x, y) => inside(region, x, y) && keep(x, y), 4, seed).forEach((run) => {
    c.globalAlpha = alpha * (0.86 + r() * 0.2); c.beginPath();   // a steady hand: grain comes from the board, not from stripes of pressure
    run.filter((_, k, a) => k % 2 === 0 || k === a.length - 1).forEach(([x, y], k) => (k ? c.lineTo(x + (r() - 0.5) * 1.5, y + (r() - 0.5) * 1.5) : c.moveTo(x, y)));
    c.stroke();
  });
  c.restore();
};

// ---------------------------------------------------------------- one moon
// `lit` is the illuminated fraction. The terminator is half an ellipse whose width is
// r * (1 - 2 * lit): a crescent's bulges toward the lit limb, a gibbous moon's away from it.
const moon = (g: Gfx, cx: number, cy: number, r: number, lit: number, waxing: boolean, seed: number) => {
  const s = waxing ? 1 : -1, tx = r * (1 - 2 * lit), N = 40;
  const disk: P[] = Array.from({ length: 72 }, (_, i) => [cx + Math.cos((i / 72) * Math.PI * 2) * r, cy + Math.sin((i / 72) * Math.PI * 2) * r]);
  const limb: P[] = [], term: P[] = [];
  for (let i = 0; i <= N; i++) { const a = -Math.PI / 2 + (i / N) * Math.PI; limb.push([cx + s * Math.cos(a) * r, cy + Math.sin(a) * r]); }
  for (let i = 0; i <= N; i++) { const a = Math.PI / 2 - (i / N) * Math.PI; term.push([cx + s * Math.cos(a) * tx, cy + Math.sin(a) * r]); }
  const litShape = [...limb, ...term];
  const mare = (x: number, y: number) => fractal(seed, (x - cx) * 60 / r, (y - cy) * 60 / r, 0.03, 0.03, 3) + (fractal(seed + 3, x, y, 0.45, 0.45, 2) - 0.5) * 0.16 < 0.52 + (lit > 0.95 ? 0.06 : 0);  // where the chalk skipped: the dark seas, their edges crumbling
  if (lit > 0.9) g.group("plain", () => g.glow(cx, cy, r * 1.1, "#fff6e0", 0.2));                   // the full moon, smudged out with a finger
  chalk(g, (dust) => {
    if (dust) scumble(g, dust, disk, CHALK, { angle: 0.7, gap: 5, w: 5, alpha: 0.32, seed: seed + 1 });  // earthshine: chalk rubbed into the board with a finger
    const lc = lit > 0.9 ? "#f8f0d6" : CHALK;
    scumble(g, dust, litShape, lc, { angle: -0.9 + (seed % 5) * 0.12, gap: 3, w: 4.4, alpha: 0.4, seed: seed + 2 });                        // the whole lit face, evenly
    scumble(g, dust, litShape, lc, { angle: 0.75 + (seed % 3) * 0.1, gap: 3.2, w: 4.2, alpha: 0.42, seed: seed + 8, keep: (x, y) => !mare(x, y) });  // the highlands built up across it: the seas are just less chalk
    scumble(g, dust, litShape, CHALK, { angle: 0.5, gap: 5, w: 3.6, alpha: 0.45, seed: seed + 3, keep: (x, y) => Math.hypot(x - cx, y - cy) > r * 0.62 && (x - cx) * s > -r * 0.2 });  // the limb, gone over again
    if (!dust) {
      const cr = rng(seed + 4);
      for (let k = 0; k < 5; k++) { const a = cr() * Math.PI * 2, d = cr() * r * 0.75, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d; if (!inside(litShape, px, py)) continue; const rr = 3 + cr() * r * 0.09; line(g, dust, Array.from({ length: 9 }, (_, i) => [px + Math.cos((i / 8) * Math.PI * 2) * rr, py + Math.sin((i / 8) * Math.PI * 2) * rr * 0.9] as P), 0.9, CHALK, seed + 10 + k, 0.55, 0.3); }
    }
    line(g, dust, limb.filter((_, i) => i % 3 === 0 || i === N), 2.3, CHALK, seed + 5, 0.95);            // the lit limb, firm
    const back: P[] = []; for (let i = 0; i <= N; i++) { const a = Math.PI / 2 + (i / N) * Math.PI; back.push([cx + s * Math.cos(a) * r, cy + Math.sin(a) * r]); }
    line(g, dust, back.filter((_, i) => i % 3 === 0 || i === N), 1.3, CHALK, seed + 6, 0.45);            // the dark limb, barely
    if (lit < 0.97) line(g, dust, term.filter((_, i) => i % 4 === 0 || i === N), 1.1, CHALK, seed + 7, 0.5, 0.5);
  });
};

// ---------------------------------------------------------------- the board
const board = (g: Gfx, ctx: Ctx) => {
  const gr = ctx.createRadialGradient(540, 470, 60, 540, 470, 720);
  gr.addColorStop(0, "#35493f"); gr.addColorStop(0.62, "#27352f"); gr.addColorStop(1, "#1b2622");
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 1080, 1080);
  g.paper("coldpress", 0.3);
  // the ghosts of erased lessons: wide swipes of haze, and old writing not quite gone
  g.group("plain", () => {
    const r = rng(5);
    for (let i = 0; i < 9; i++) { const cx = 120 + r() * 840, cy = 120 + r() * 760, rr = 120 + r() * 160, a0 = r() * 6; const pts: P[] = []; for (let k = 0; k <= 12; k++) { const a = a0 + (k / 12) * 2.2; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.55]); } g.pen(pts, { w: 40 + r() * 30, color: CHALK, seed: 6 + i, wobble: 3, boil: 0, opacity: 0.05, retrace: false, taper: 0.4 }); }
  }, { blur: 9 });
  g.group("plain", () => { letter(g, "HOMEWORK P 42", 140, 780, { cap: 28, color: CHALK, seed: 40, opacity: 0.12 }); letter(g, "NEWTON", 700, 796, { cap: 26, color: CHALK, seed: 41, opacity: 0.1 }); }, { blur: 2.4 });
};

const frame = (g: Gfx) => {
  g.group("plain", () => {
    const wood = "#7b5231", dark = "#553620", r = rng(70);
    fillShape(g, [[0, 0], [1080, 0], [1080, B0], [0, B0]], wood); fillShape(g, [[0, 0], [B0, 0], [B0, 1080], [0, 1080]], wood); fillShape(g, [[B1, 0], [1080, 0], [1080, 1080], [B1, 1080]], wood);
    fillShape(g, [[0, LEDGE], [1080, LEDGE], [1080, 1080], [0, 1080]], "#6a4526");
    fillShape(g, [[B0 - 8, LEDGE - 4], [B1 + 8, LEDGE - 4], [B1 + 20, LEDGE + 24], [B0 - 20, LEDGE + 24]], "#8c6139");   // the ledge's top face, catching the light
    for (let i = 0; i < 26; i++) { const y = r() * 1080, x = r() < 0.5 ? r() * B0 : B1 + r() * B0; g.pen([[x, y], [x + (r() - 0.5) * 3, y + 40 + r() * 60]], { w: 0.9, color: dark, seed: 71 + i, wobble: 0.6, boil: 0, opacity: 0.45, retrace: false }); }   // grain on the sides
    for (let i = 0; i < 16; i++) { const x = r() * 1080, y = r() < 0.5 ? r() * B0 : LEDGE + 30 + r() * 80; g.pen([[x, y], [x + 60 + r() * 90, y + (r() - 0.5) * 3]], { w: 0.9, color: dark, seed: 100 + i, wobble: 0.6, boil: 0, opacity: 0.45, retrace: false }); }
    // the inner bevel: a shadow along the top and left where the frame stands proud of the slate
    fillShape(g, [[B0, B0], [B1, B0], [B1 - 6, B0 + 8], [B0 + 8, B0 + 8], [B0 + 8, LEDGE - 4], [B0, LEDGE - 4]], "#0e1512", 0.55);
    // chalk dust fallen on the ledge, a worn stub of chalk, the felt eraser
    for (let i = 0; i < 140; i++) { const x = B0 + r() * (B1 - B0), y = LEDGE + 2 + r() * 20; fillShape(g, blob(x, y, 0.8 + r() * 1.8, 0.6 + r(), 110 + i, 0.3, 6), CHALK, 0.25 + r() * 0.45); }
    const st: P[] = [[690, LEDGE + 2], [790, LEDGE - 6], [794, LEDGE + 10], [694, LEDGE + 18]];
    fillShape(g, [[696, LEDGE + 20], [796, LEDGE + 12], [800, LEDGE + 20], [700, LEDGE + 26]], "#3a2616", 0.6);
    fillShape(g, st, CHALK); fillShape(g, [[690, LEDGE + 11], [794, LEDGE + 3], [794, LEDGE + 10], [694, LEDGE + 18]], "#d9d3c6");
    fillShape(g, blob(691, LEDGE + 10, 5, 8, 260, 0.2, 10), "#e9e4d8");
    const er: P[] = [[250, LEDGE - 16], [390, LEDGE - 22], [396, LEDGE + 14], [256, LEDGE + 20]];
    fillShape(g, [[256, LEDGE + 20], [396, LEDGE + 14], [404, LEDGE + 24], [262, LEDGE + 28]], "#2a1a0e", 0.6);
    fillShape(g, er, "#a0714a"); fillShape(g, [[252, LEDGE + 4], [394, LEDGE - 2], [396, LEDGE + 14], [256, LEDGE + 20]], "#8e8a86");
    for (let i = 0; i < 40; i++) { const x = 260 + r() * 130, y = LEDGE + 6 + r() * 12; fillShape(g, blob(x, y, 1.2 + r() * 2, 1, 300 + i, 0.3, 6), CHALK, 0.35); }
  });
};

// ---------------------------------------------------------------- the lesson
const lesson = (g: Gfx) => {
  const phases: { lit: number; waxing: boolean; label: [string, string] }[] = [
    { lit: 0.22, waxing: true, label: ["WAXING", "CRESCENT"] }, { lit: 0.5, waxing: true, label: ["FIRST", "QUARTER"] }, { lit: 0.8, waxing: true, label: ["WAXING", "GIBBOUS"] },
    { lit: 1, waxing: true, label: ["FULL", ""] },
    { lit: 0.8, waxing: false, label: ["WANING", "GIBBOUS"] }, { lit: 0.5, waxing: false, label: ["LAST", "QUARTER"] }, { lit: 0.22, waxing: false, label: ["WANING", "CRESCENT"] },
  ];
  const at = (i: number): [number, number, number] => { const f = i / 6, s = Math.sin(f * Math.PI); return [128 + i * 137, 612 - s * 222, 42 + s * 28]; };
  // stars first, so the moons sit over them
  chalk(g, (dust) => {
    const r = rng(500);
    for (let i = 0; i < 70; i++) { const x = 60 + r() * 960, y = 60 + r() * 860, ok = [0, 1, 2, 3, 4, 5, 6].every((k) => { const [mx, my, mr] = at(k); return Math.hypot(x - mx, y - my) > mr + 34 && Math.abs(y - (my + mr + 48)) > 32 || Math.abs(x - mx) > 70; }) && !(y < 180 && x > 170 && x < 910); if (!ok) continue; const big = r() < 0.12; if (big) { const s = 7 + r() * 5; line(g, dust, [[x - s, y], [x + s, y]], 1.4, CHALK, 501 + i, 0.85, 0.2); line(g, dust, [[x, y - s], [x, y + s]], 1.4, CHALK, 601 + i, 0.85, 0.2); } else fillShape(g, blob(x, y, 1 + r() * 1.6, 1 + r() * 1.4, 700 + i, 0.2, 6), CHALK, 0.5 + r() * 0.4); }
    // the Plough, low on the left, dotted and joined in blue chalk
    const dip: P[] = [[112, 846], [168, 822], [220, 830], [266, 858], [278, 910], [352, 916], [360, 862]];
    dip.slice(0, 7).forEach(([x, y], i) => fillShape(g, blob(x, y, 3.4, 3.4, 800 + i, 0.15, 8), CHALK, 0.95));
    line(g, dust, [...dip.slice(0, 5)], 1, BLUE, 810, 0.6, 0.4); line(g, dust, [dip[4], dip[5], dip[6], dip[3]], 1, BLUE, 811, 0.6, 0.4);
  }, 0.18);
  phases.forEach((p, i) => { const [x, y, r] = at(i); moon(g, x, y, r, p.lit, p.waxing, 1000 + i * 37); });
  chalk(g, (dust) => {
    // the title, underlined twice in yellow the way a teacher does when it matters
    letter(g, "PHASES OF THE MOON", 540, 86, { cap: 44, color: CHALK, seed: 20, align: "center", w: 2.6, opacity: 0.95 });
    line(g, dust, [[300, 152], [540, 148], [782, 154]], 2.4, YEL, 21, 0.9, 1.2); line(g, dust, [[330, 164], [560, 161], [760, 166]], 1.8, YEL, 22, 0.75, 1.4);
    // the arrow of the month over the moons
    const arc: P[] = []; for (let k = 0; k <= 16; k++) { const f = k / 16, s = Math.sin(f * Math.PI); arc.push([150 + f * 780, 470 - s * 196]); }
    line(g, dust, smooth(arc.filter((_, k) => k % 2 === 0), false, 3), 1.6, BLUE, 30, 0.85, 1);
    const tip = arc[16], pre = arc[15], a = Math.atan2(tip[1] - pre[1], tip[0] - pre[0]);
    line(g, dust, [[tip[0] - Math.cos(a - 0.5) * 20, tip[1] - Math.sin(a - 0.5) * 20], tip, [tip[0] - Math.cos(a + 0.5) * 20, tip[1] - Math.sin(a + 0.5) * 20]], 1.8, BLUE, 31, 0.9, 0.3);
    letter(g, "29.5 DAYS", 540, 230, { cap: 17, color: BLUE, seed: 32, align: "center", w: 1.7, opacity: 0.85 });
    // the labels under each moon, and a note about the far side, circled in pink
    phases.forEach((p, i) => { const [x, y, r] = at(i); letter(g, p.label[0], x, y + r + 26, { cap: 13, color: CHALK, seed: 40 + i * 3, align: "center", w: 1.35, opacity: 0.85 }); if (p.label[1]) letter(g, p.label[1], x, y + r + 48, { cap: 13, color: CHALK, seed: 41 + i * 3, align: "center", w: 1.35, opacity: 0.85 }); });
    letter(g, "SAME FACE", 870, 842, { cap: 16, color: PINK, seed: 70, align: "center", w: 1.6, opacity: 0.9 });
    letter(g, "ALWAYS", 870, 868, { cap: 16, color: PINK, seed: 71, align: "center", w: 1.6, opacity: 0.9 });
    line(g, dust, Array.from({ length: 11 }, (_, k) => { const a2 = -0.3 + (k / 10) * Math.PI * 2.1; return [870 + Math.cos(a2) * 92, 858 + Math.sin(a2) * 42] as P; }), 1.4, PINK, 72, 0.8, 1.5);
  }, 0.22);
  void lerpP; void clamp;
};

export const drawMoonPhases = (ctx: Ctx, _frame: number, env: Env) => {
  const g = new Gfx(ctx, env, 0, CHALK_M);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  board(g, ctx);
  lesson(g);
  frame(g);
};

export const moonPhases: Film = {
  meta: { title: "Moon phases · chalkboard", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "moonPhases", start: 0, end: 1, draw: drawMoonPhases }],
};
