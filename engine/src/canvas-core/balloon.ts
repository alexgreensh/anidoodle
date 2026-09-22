import { Gfx, fractal, rng, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { blob, bounds, clamp, fillShape, hatchRuns, inside, lerp, lerpP, mix, smooth } from "./gallery";

// HOT-AIR BALLOON · crayon. Wax on toothy paper: every fill is a back-and-forth scribble that
// skips the valleys of the sheet, a second, darker crayon is worked across the shade side, a
// white crayon burnishes the highlight, and the contour is a fat wobbly line gone over twice.
//
// Structure first, though: the envelope is a surface of revolution (round crown, widest just
// above the middle, tapering to the throat), seen a little from below so its latitudes bow. Its
// gores are meridians of that surface, so they crowd together at the limbs and meet at the crown
// ring and the throat. Load tapes on the seams, a skirt, cables to a wicker basket, the burner
// flame roaring up into the throat. Light from the upper left, where the sun is.

const CRAYON_M: Medium = { nib: 2.9, taper: 0.3, pressure: 0.8, retrace: true, wobble: 2.2, rough: 1.3 };
const K = { red: "#e5392d", orange: "#f68b1f", yellow: "#ffd21f", green: "#3dae49", blue: "#2f7de1", sky: "#69c3f2", purple: "#8d4fc7", pink: "#ff78ae", brown: "#8b5a3c", white: "#fffdf4", black: "#262233", leaf: "#2f8a3b" };
const PAPER = "#fdf8ea";
const dark = (c: string) => mix(c, "#2a1d3a", 0.45);

// ---------------------------------------------------------------- the crayon
// A scribble fill: hatch runs joined end to end into one back-and-forth stroke, drawn in short
// passes so the pressure (alpha) wanders the way a child's hand does.
const scribble = (g: Gfx, region: P[], color: string, o: { angle: number; gap: number; w: number; alpha: number; seed: number; keep?: (x: number, y: number) => boolean; over?: number }) => {
  const { angle, gap, w, alpha, seed, keep = () => true, over = 1.035 } = o, r = rng(seed), b = bounds(region);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, grown = region.map(([x, y]) => [cx + (x - cx) * over, cy + (y - cy) * over] as P);
  const runs = hatchRuns({ x0: b.x0 - 8, y0: b.y0 - 8, x1: b.x1 + 8, y1: b.y1 + 8 }, angle, gap, (x, y) => inside(grown, x, y) && keep(x, y), 5, seed);
  const c = g.cur; g.touch(b.x0 - 14, b.y0 - 14, b.x1 + 14, b.y1 + 14);
  c.save(); c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = color; c.lineWidth = w;
  let prev: P | null = null;
  runs.forEach((run, i) => {
    const pts = (i % 2 ? [...run].reverse() : run).filter((_, k, a) => k % 3 === 0 || k === a.length - 1).map(([x, y]) => [x + (r() - 0.5) * 1.6, y + (r() - 0.5) * 1.6] as P);
    const jump = prev ? Math.hypot(pts[0][0] - prev[0], pts[0][1] - prev[1]) : 0;
    c.globalAlpha = alpha * (0.72 + r() * 0.4);
    c.beginPath();
    if (prev && jump < gap * 3.2) { c.moveTo(prev[0], prev[1]); pts.forEach(([x, y]) => c.lineTo(x, y)); }   // the turn of the zigzag
    else { pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); }
    c.stroke(); prev = pts[pts.length - 1];
  });
  c.restore();
};
const line = (g: Gfx, pts: P[], color: string, w: number, seed: number, op = 0.92, wob = 1) => g.pen(pts, { w, color, seed, wobble: wob, boil: 0, opacity: op, retrace: true, taper: 1 });
// wax skips the valleys of the sheet: every crayon layer is punched by the paper's tooth
const wax = (g: Gfx, fn: () => void) => g.group("plain", fn, { textures: ["pencilTooth"] });

// ---------------------------------------------------------------- the envelope
const CX = 540, R = 236, EQ = 352, TILT = 0.11;
const profile = smooth([[0, EQ - R], [R * 0.52, EQ - R * 0.86], [R * 0.87, EQ - R * 0.5], [R, EQ - R * 0.02], [R * 0.95, EQ + R * 0.4], [R * 0.76, EQ + R * 0.86], [R * 0.47, EQ + R * 1.24], [R * 0.2, EQ + R * 1.48]], false, 12);
const merid = (phi: number): P[] => profile.map(([w, y]) => [CX + w * Math.sin(phi), y + w * Math.cos(phi) * TILT]);
const GORES = 12, phiAt = (k: number) => -Math.PI / 2 + (k / GORES) * Math.PI;
const RAINBOW = [K.red, K.orange, K.yellow, K.green, K.blue, K.purple];

const envelope = (g: Gfx) => {
  const outline = [...merid(-Math.PI / 2), ...merid(Math.PI / 2).reverse()];
  g.group("plain", () => fillShape(g, outline, PAPER));
  for (let k = 0; k < GORES; k++) {
    const a = merid(phiAt(k)), b2 = merid(phiAt(k + 1)), gore = [...a, ...[...b2].reverse()], col = RAINBOW[k % 6];
    const phiC = (phiAt(k) + phiAt(k + 1)) / 2, litG = clamp(Math.cos(phiC + 0.62) * 0.9 + 0.1);
    wax(g, () => {
      scribble(g, gore, col, { angle: 1.25 + (k % 3) * 0.12, gap: 5.2, w: 6.2, alpha: 0.9, seed: 100 + k * 7 });
      scribble(g, gore, col, { angle: -0.35 + (k % 2) * 0.2, gap: 9, w: 5, alpha: 0.5, seed: 101 + k * 7 });
      // the shade crayon, worked across the side away from the light and under the belly
      const sh = (x: number, y: number) => { const u = (x - CX) / R, v = (y - EQ) / R; return u * 0.9 + v * 0.8 + (fractal(9, x, y, 0.02, 0.02, 2) - 0.5) * 0.35 > 0.15 + litG * 0.4; };
      scribble(g, gore, dark(col), { angle: 0.55, gap: 6.5, w: 5, alpha: 0.72, seed: 102 + k * 7, keep: sh });
      const deep = (x: number, y: number) => { const u = (x - CX) / R, v = (y - EQ) / R; return u * 0.9 + v * 0.9 > 0.75 + litG * 0.35; };
      scribble(g, gore, mix(dark(col), K.black, 0.3), { angle: -0.6, gap: 7, w: 4.4, alpha: 0.6, seed: 103 + k * 7, keep: deep });
      // burnished highlight: white crayon pressed hard over the colour, upper left
      const hi = (x: number, y: number) => { const u = (x - CX) / R + 0.42, v = (y - EQ) / R + 0.52; return u * u * 1.4 + v * v < 0.1 + (fractal(10, x, y, 0.03, 0.03, 2) - 0.5) * 0.06; };
      scribble(g, gore, K.white, { angle: 1.0, gap: 5, w: 4.5, alpha: 0.75, seed: 104 + k * 7, keep: hi, over: 1 });
    });
  }
  // seams: load tapes down every meridian, a few latitude tapes, the crown ring, the outline twice
  wax(g, () => {
    for (let k = 1; k < GORES; k++) line(g, merid(phiAt(k)).filter((_, i) => i % 4 === 0), mix(K.black, RAINBOW[k % 6], 0.2), 1.1, 200 + k, 0.8, 0.8);
    [0.3, 0.55].forEach((f, j) => { const i = Math.round(f * (profile.length - 1)), [w, y] = profile[i], pts: P[] = []; for (let q = 0; q <= 24; q++) { const ph = -Math.PI / 2 + (q / 24) * Math.PI; pts.push([CX + w * Math.sin(ph), y + w * Math.cos(ph) * TILT]); } line(g, pts, K.black, 1.1, 230 + j, 0.7, 0.9); });
    const top = merid(0)[0]; fillShape(g, blob(top[0], top[1] + 6, 20, 8, 240, 0.1, 10), K.blue); line(g, [...blob(top[0], top[1] + 6, 20, 8, 240, 0.1, 10)], dark(K.blue), 1.5, 241, 0.9, 0.6);
    line(g, merid(-Math.PI / 2).filter((_, i) => i % 3 === 0), K.black, 2.2, 250, 0.92);
    line(g, merid(Math.PI / 2).filter((_, i) => i % 3 === 0), K.black, 2.5, 251, 0.95);
  });
};

// ---------------------------------------------------------------- below the envelope
const rigging = (g: Gfx) => {
  const throatY = EQ + R * 1.48, tw = R * 0.2, skirt: P[] = [[CX - tw, throatY - 4], [CX + tw, throatY - 4], [CX + tw * 0.9, throatY + 34], [CX - tw * 0.9, throatY + 34]];
  const bk = { x0: CX - 62, x1: CX + 62, y0: 812, y1: 880 };
  // cables from the skirt to the basket corners, and the burner frame
  wax(g, () => {
    [[-tw * 0.9, bk.x0 + 4], [-tw * 0.3, bk.x0 + 40], [tw * 0.3, bk.x1 - 40], [tw * 0.9, bk.x1 - 4]].forEach(([a, b2], i) => line(g, [[CX + a, throatY + 30], [lerp(CX + a, b2, 0.5), lerp(throatY + 30, bk.y0, 0.5)], [b2, bk.y0]], "#4a3a36", 0.9, 300 + i, 0.85, 0.6));
    fillShape(g, skirt, PAPER);
    scribble(g, skirt, K.red, { angle: 1.4, gap: 5, w: 5.5, alpha: 0.9, seed: 310 });
    scribble(g, skirt, dark(K.red), { angle: 0.4, gap: 6, w: 4.5, alpha: 0.65, seed: 311, keep: (x) => x > CX });
    line(g, [...skirt, skirt[0]], K.black, 1.8, 312, 0.9, 0.8);
    // the burner, and its flame roaring up into the throat
    const burner: P[] = [[CX - 26, 790], [CX + 26, 790], [CX + 22, 806], [CX - 22, 806]];
    fillShape(g, burner, "#aab4c4"); scribble(g, burner, "#7f8aa0", { angle: 0.3, gap: 4, w: 3.5, alpha: 0.8, seed: 320, keep: (x) => x > CX - 4 });
    line(g, [...burner, burner[0]], K.black, 1.4, 321, 0.9, 0.5);
    const flame = smooth([[CX - 17, 792], [CX - 19, 772], [CX - 8, 754], [CX + 1, 736], [CX + 9, 752], [CX + 19, 770], [CX + 17, 792]], true, 8);  // it disappears up into the skirt
    fillShape(g, flame, PAPER);
    scribble(g, flame, K.orange, { angle: 1.5, gap: 4.5, w: 5, alpha: 0.9, seed: 330 });
    scribble(g, flame, K.yellow, { angle: 1.4, gap: 4.5, w: 4.5, alpha: 0.95, seed: 331, keep: (x, y) => Math.abs(x - CX) < 10 - (792 - y) * 0.08 && y > 748 });
    scribble(g, flame, K.red, { angle: 0.2, gap: 6, w: 3.5, alpha: 0.55, seed: 332, keep: (x) => Math.abs(x - CX) > 12 });
    line(g, flame.filter((_, i) => i % 3 === 0), K.red, 1.4, 333, 0.8, 1.2);
  });
  // the basket: wicker weave in two browns, a padded leather rim, two people, one waving
  wax(g, () => {
    const basket: P[] = [[bk.x0, bk.y0], [bk.x1, bk.y0], [bk.x1 - 8, bk.y1], [bk.x0 + 8, bk.y1]];
    // two passengers first, so the basket rim hides their bodies
    [[CX - 40, K.pink, 1], [CX + 40, K.blue, -1]].forEach(([x, c, s], i) => {
      const hx = x as number, hy = bk.y0 - 30;
      fillShape(g, blob(hx, hy + 18, 13, 14, 340 + i, 0.1, 10), PAPER); scribble(g, blob(hx, hy + 18, 13, 14, 340 + i, 0.1, 10), c as string, { angle: 1.2, gap: 4, w: 4, alpha: 0.9, seed: 341 + i });
      fillShape(g, blob(hx, hy, 11, 12, 345 + i, 0.08, 10), "#f6c8a0"); scribble(g, blob(hx, hy, 11, 12, 345 + i, 0.08, 10), "#e8a37c", { angle: 0.4, gap: 5, w: 3.4, alpha: 0.6, seed: 346 + i, keep: (xx) => xx > hx });
      line(g, blob(hx, hy, 11, 12, 345 + i, 0.08, 10), "#6b3e2e", 1.3, 347 + i, 0.85, 0.5);
      fillShape(g, blob(hx - 2, hy - 9, 11, 5, 348 + i, 0.2, 10), i ? K.brown : K.orange);
      if (s === 1) { line(g, [[hx - 9, hy + 16], [hx - 24, hy + 2], [hx - 30, hy - 20]], "#e8a37c", 2.6, 349, 0.95, 0.5); fillShape(g, blob(hx - 31, hy - 24, 5, 5, 356, 0.1, 8), "#f6c8a0"); } // waving
      else { line(g, [[hx + 8, hy + 16], [hx + 22, hy + 6], [hx + 18, hy - 4]], "#e8a37c", 2.4, 357, 0.95, 0.5); } // pointing at the view
    });
    fillShape(g, basket, PAPER);
    scribble(g, basket, "#c98f4e", { angle: 1.4, gap: 4.5, w: 5, alpha: 0.9, seed: 350 });
    for (let yy = bk.y0 + 8; yy < bk.y1 - 3; yy += 8) for (let xx = bk.x0 + 4 + ((yy / 8) % 2) * 6; xx < bk.x1 - 6; xx += 12) line(g, [[xx, yy], [xx + 7, yy + 3]], K.brown, 1.0, 351 + xx * 3 + yy, 0.75, 0.3); // the weave
    scribble(g, basket, K.brown, { angle: 0.35, gap: 6, w: 4, alpha: 0.6, seed: 352, keep: (x) => x > CX + 12 });
    const rim: P[] = [[bk.x0 - 5, bk.y0 - 9], [bk.x1 + 5, bk.y0 - 9], [bk.x1 + 5, bk.y0 + 5], [bk.x0 - 5, bk.y0 + 5]];
    fillShape(g, rim, "#7a4a2c"); scribble(g, rim, "#5a3420", { angle: 0.1, gap: 3, w: 3, alpha: 0.7, seed: 353, keep: (x) => x > CX });
    line(g, [...basket, basket[0]], "#4a2c1c", 1.9, 354, 0.9, 0.7); line(g, [...rim, rim[0]], "#3a2216", 1.6, 355, 0.9, 0.6);
  });
};

// ---------------------------------------------------------------- the world around it
const sky = (g: Gfx) => {
  wax(g, () => {
    const all: P[] = [[0, 0], [1080, 0], [1080, 1080], [0, 1080]];
    scribble(g, all, K.sky, { angle: 0.38, gap: 7, w: 6, alpha: 0.62, seed: 10, over: 1 });
    scribble(g, all, mix(K.sky, K.blue, 0.4), { angle: -0.5, gap: 12, w: 5, alpha: 0.4, seed: 11, over: 1, keep: (x, y) => y < 380 + (fractal(12, x, y, 0.01, 0.01, 2) - 0.5) * 200 });
  });
  // the sun, where the light comes from
  wax(g, () => {
    const sun = blob(150, 140, 62, 60, 20, 0.05, 16);
    fillShape(g, sun, PAPER); scribble(g, sun, K.yellow, { angle: 0.9, gap: 4.5, w: 5.5, alpha: 0.95, seed: 21 }); scribble(g, sun, K.orange, { angle: -0.7, gap: 7, w: 4, alpha: 0.45, seed: 22, keep: (x, y) => (x - 150) + (y - 140) > 20 });
    line(g, sun.filter((_, i) => i % 3 === 0), K.orange, 1.8, 23, 0.9, 1);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.15, r0 = 80, r1 = 106 + (i % 2) * 16; line(g, [[150 + Math.cos(a) * r0, 140 + Math.sin(a) * r0], [150 + Math.cos(a) * (r0 + r1) / 2, 140 + Math.sin(a) * (r0 + r1) / 2 + 2], [150 + Math.cos(a) * r1, 140 + Math.sin(a) * r1]], K.yellow, 2.4, 24 + i, 0.95, 1.2); }
  });
  // clouds: the paper left bare, a grey-blue crayon under their bellies, a blue outline
  const cloud = (cx: number, cy: number, s: number, seed: number) => {
    const r = rng(seed), puffs: P[][] = [];
    for (let i = 0; i < 6; i++) puffs.push(blob(cx + (i - 2.5) * 32 * s + (r() - 0.5) * 10, cy - Math.sin((i / 5) * Math.PI) * 28 * s + (r() - 0.5) * 8, (34 + r() * 16) * s, (28 + r() * 10) * s, seed + i, 0.08, 12));
    wax(g, () => {
      puffs.forEach((p) => fillShape(g, p, PAPER));
      puffs.forEach((p, i) => scribble(g, p, "#b9cde6", { angle: 0.2, gap: 6, w: 4.5, alpha: 0.55, seed: seed + 10 + i, keep: (x, y) => y > cy + 4 * s }));
      puffs.forEach((p, i) => {
        // walk this puff's edge and keep only the stretches no other puff covers: the silhouette
        let run: P[] = []; const runs: P[][] = [];
        p.forEach((q) => { const hidden = puffs.some((o, j) => j !== i && inside(o, q[0], q[1])); if (!hidden) run.push(q); else if (run.length) { runs.push(run); run = []; } });
        if (run.length) runs.push(run);
        runs.filter((r2) => r2.length > 3).forEach((r2, k) => line(g, r2.filter((_, m) => m % 3 === 0 || m === r2.length - 1), "#7fa9d8", 1.5, seed + 20 + i * 5 + k, 0.8, 0.9));
      });
    });
  };
  cloud(250, 470, 1.0, 40); cloud(870, 150, 0.85, 60); cloud(930, 560, 0.7, 80);
  // a second balloon, far off: fewer gores, softer, smaller
  wax(g, () => {
    const cx = 868, cy = 318, r = 44, env: P[] = [];
    const prof = smooth([[0, cy - r], [r * 0.87, cy - r * 0.5], [r, cy], [r * 0.7, cy + r * 0.85], [r * 0.22, cy + r * 1.35]], false, 8);
    const m = (ph: number) => prof.map(([w, y]) => [cx + w * Math.sin(ph), y] as P);
    for (let k = 0; k < 6; k++) { const a = m(-Math.PI / 2 + (k / 6) * Math.PI), b2 = m(-Math.PI / 2 + ((k + 1) / 6) * Math.PI), gore = [...a, ...[...b2].reverse()]; fillShape(g, gore, PAPER); scribble(g, gore, [K.pink, K.yellow, K.sky][k % 3], { angle: 1.3, gap: 4, w: 3.6, alpha: 0.75, seed: 90 + k }); env.push(...a); }
    line(g, m(-Math.PI / 2).filter((_, i) => i % 3 === 0), "#5a4a6a", 1.1, 97, 0.8, 0.6); line(g, m(Math.PI / 2).filter((_, i) => i % 3 === 0), "#5a4a6a", 1.1, 98, 0.8, 0.6);
    const bx = cx, by = cy + r * 1.35 + 16; fillShape(g, [[bx - 9, by], [bx + 9, by], [bx + 7, by + 11], [bx - 7, by + 11]], K.brown);
    line(g, [[cx - r * 0.2, cy + r * 1.35], [bx - 8, by]], "#5a4a6a", 0.7, 99, 0.7, 0.3); line(g, [[cx + r * 0.2, cy + r * 1.35], [bx + 8, by]], "#5a4a6a", 0.7, 100, 0.7, 0.3);
  });
  // birds
  wax(g, () => [[700, 170, 1], [742, 196, 0.8], [668, 214, 0.7]].forEach(([x, y, s], i) => line(g, [[x - 14 * s, y - 5 * s], [x - 5 * s, y - 2 * s], [x, y + 3 * s], [x + 5 * s, y - 2 * s], [x + 14 * s, y - 6 * s]], "#3a3450", 1.3, 110 + i, 0.9, 0.5)));
};

const land = (g: Gfx) => {
  const back: P[] = smooth([[0, 900], [180, 868], [420, 884], [700, 852], [900, 866], [1080, 846], [1080, 1080], [0, 1080]], true, 10);
  const front: P[] = smooth([[0, 968], [220, 930], [480, 958], [760, 936], [1080, 972], [1080, 1080], [0, 1080]], true, 10);
  wax(g, () => {
    fillShape(g, back, PAPER); scribble(g, back, "#8ccf5a", { angle: 0.15, gap: 5.5, w: 6, alpha: 0.9, seed: 400, over: 1 }); scribble(g, back, K.green, { angle: -0.4, gap: 8, w: 5, alpha: 0.5, seed: 401, over: 1, keep: (x, y) => y > 890 + Math.sin(x * 0.01) * 12 });
    line(g, back.filter((_, i) => i % 4 === 0 && back[i][1] < 1000), "#2f7a33", 1.8, 402, 0.85, 1);
    // trees on the far hill: round crowns on stubby trunks, each shaded on its right
    [[160, 872, 1], [214, 880, 0.8], [760, 858, 0.9], [982, 852, 1.1]].forEach(([x, y, s], i) => {
      line(g, [[x, y + 2], [x + 1, y - 18 * s]], K.brown, 2.2, 410 + i, 0.95, 0.4);
      const c = blob(x, y - 34 * s, 22 * s, 24 * s, 420 + i, 0.12, 12);
      fillShape(g, c, PAPER); scribble(g, c, K.green, { angle: 1.1, gap: 4, w: 4.5, alpha: 0.9, seed: 430 + i }); scribble(g, c, K.leaf, { angle: 0.3, gap: 5, w: 3.6, alpha: 0.7, seed: 440 + i, keep: (xx) => xx > x + 2 });
      line(g, c.filter((_, k) => k % 3 === 0), "#1f5a28", 1.4, 450 + i, 0.85, 0.8);
    });
    fillShape(g, front, PAPER); scribble(g, front, K.green, { angle: -0.12, gap: 5, w: 6.5, alpha: 0.92, seed: 460, over: 1 }); scribble(g, front, K.leaf, { angle: 0.5, gap: 7, w: 5, alpha: 0.55, seed: 461, over: 1, keep: (x, y) => y > 985 });
    // a winding path, and grass flicked up along the hill's edge
    const path = smooth([[610, 1080], [560, 1030], [620, 990], [590, 950]], false, 10);
    const pw: P[] = [...path.map(([x, y], i) => [x - 22 + i * 0.35, y] as P), ...path.map(([x, y], i) => [x + 22 - i * 0.35, y] as P).reverse()];
    scribble(g, pw, "#f3c77a", { angle: 0.2, gap: 4, w: 4.5, alpha: 0.9, seed: 462, over: 1 });
    line(g, front.filter((_, i) => i % 4 === 0 && front[i][1] < 1060), "#1f5a28", 2, 463, 0.9, 1);
    const r = rng(464); for (let i = 0; i < 70; i++) { const x = r() * 1080, y = 940 + r() * 130; line(g, [[x, y], [x + 2, y - 6 - r() * 7]], K.leaf, 1.1, 470 + i, 0.8, 0.3); }
  });
};

export const drawBalloon = (ctx: Ctx, _frame: number, env: Env) => {
  const g = new Gfx(ctx, env, 0, CRAYON_M);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 1080, 1080);
  sky(g); land(g); envelope(g); rigging(g);
  g.paper("paper", 0.08);
};

export const balloon: Film = {
  meta: { title: "Hot-air balloon · crayon", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "balloon", start: 0, end: 1, draw: drawBalloon }],
};
void lerpP;
