import { Gfx, fractal, rng, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import { INK, LITHO, PAPER, REG, across, drum, nearField, plateMarks, screen } from "./riso";
import { blob, clamp, fillShape, inside, smooth } from "./gallery";

// LIGHTHOUSE AT SUNSET · risograph. Printed the way a riso prints: one drum per ink, three
// passes. The YELLOW plate, the PINK plate and the BLUE plate are drawn separately below, each
// as its own layer that multiplies onto the paper through its own slightly-off registration.
// Every colour in the picture that is not one of those three is an OVERPRINT: blue over pink is
// the dusk violet, pink over yellow the sunset orange, yellow over blue the green of the turf.
// Tone is a halftone screen whose dots grow with a tone function, each ink on its own screen
// angle so they rosette instead of moiré. The paper is left bare wherever white is wanted: the
// tower's white bands, the foam where the swell hits the rocks, the light itself.
//
// The scene: a banded lighthouse on a grassy headland, a keeper's cottage beside it, the sun
// going down into the sea on the right and lighting everything from that side, the lamp just
// lit and throwing its beam out over the water, gulls, foam, sun-glitter on the swell.

const W = 1080, HY = 604, SUN: P = [790, 590], SR = 112, PITCH = 7.4;
const ANG = { yellow: 0, pink: 75, blue: 15 };

// ---------------------------------------------------------------- the geometry
const LAND: P[] = smooth([[-20, 498], [80, 486], [176, 552], [250, 572], [420, 578], [468, 598], [506, 636], [532, 684], [548, 728], [512, 752], [420, 762], [300, 754], [170, 746], [50, 742], [-20, 740]], true, 10);
const ROCKS: P[][] = [blob(872, 910, 74, 36, 81, 0.25, 16, -0.1), blob(150, 972, 92, 44, 82, 0.22, 16, 0.08), blob(600, 800, 34, 18, 83, 0.25, 12)];
const TOWER: P[] = [[278, 580], [382, 580], [364, 252], [296, 252]];
const GALLERY: P[] = [[280, 238], [380, 238], [380, 254], [280, 254]];
const LANTERN: P[] = [[302, 176], [358, 176], [358, 214], [302, 214]];
const DOME: P[] = Array.from({ length: 25 }, (_, i) => { const a = Math.PI + (i / 24) * Math.PI; return [330 + Math.cos(a) * 32, 178 + Math.sin(a) * 28] as P; });
const COTTAGE: P[] = [[132, 516], [252, 516], [252, 578], [132, 578]];
const ROOF: P[] = [[120, 520], [192, 470], [264, 520]];
const LAMP: P = [330, 195];
const occluders = [LAND, TOWER, GALLERY, LANTERN, DOME, COTTAGE, ROOF];
const rock = (x: number, y: number) => ROCKS.some((r) => inside(r, x, y));
const occluded = (x: number, y: number) => occluders.some((o) => inside(o, x, y));
const topOf = (() => { const t: number[] = []; for (let x = 0; x <= W; x++) { let m = 1e9; for (let i = 0, j = LAND.length - 1; i < LAND.length; j = i++) { const a = LAND[i], b = LAND[j]; if ((a[0] > x) !== (b[0] > x)) m = Math.min(m, a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0])); } t.push(m); } return (x: number) => t[Math.max(0, Math.min(W, Math.round(x)))]; })();
const shore = nearField([LAND.filter(([, y]) => y > HY - 10), ...ROCKS.map((r) => [...r, r[0]])], 24);
// turf only where the top of the land is nearly flat; where it drops away it is the cliff face
const turf = (x: number, y: number) => inside(LAND, x, y) && y - topOf(x) < 46 && Math.abs(topOf(x + 6) - topOf(x - 6)) < 9;
const cliff = (x: number, y: number) => inside(LAND, x, y) && !turf(x, y);
const towerX = across(TOWER, "x");
// the beam: a narrow wedge from the lamp out over the water to the left, fading with distance
const beam = (x: number, y: number) => { const dx = x - LAMP[0], dy = y - LAMP[1], d = Math.hypot(dx, dy); if (d < 30 || dx > 0) return 0; const a = Math.atan2(dy, dx), c = -2.94, spread = 0.07 + d * 0.0001; return Math.pow(clamp(1 - Math.abs(a - c) / spread), 0.7) * clamp(1.25 - d / 820); };
const sunD = (x: number, y: number) => Math.hypot(x - SUN[0], y - SUN[1]);
const inSun = (x: number, y: number) => sunD(x, y) < SR && y < HY;
const sea = (x: number, y: number) => y > HY && !inside(LAND, x, y) && !rock(x, y);
const glitter = (x: number, y: number) => { const col = clamp(1 - Math.abs(x - SUN[0]) / (70 + (y - HY) * 0.35)); return col * clamp((fractal(51, x * 0.5, y * 3, 0.06, 0.06, 2) - 0.46) * 5); };
const foam = (x: number, y: number) => sea(x, y) && shore(x, y) < Math.max(0, fractal(61, x, y, 0.035, 0.05, 3) - 0.38) * 70 + (fractal(62, x, y, 0.2, 0.2, 2) > 0.62 ? 5 : 0);   // broken, bunched where the swell breaks

// ---------------------------------------------------------------- the three plates
const yellowPlate = (g: Gfx) => drum(g, REG.yellow, () => {
  const all = { x0: 0, y0: 0, x1: W, y1: W };
  // sky: warmer toward the horizon and the sun, the beam laid in as light
  screen(g, all, PITCH, ANG.yellow, (x, y) => { if (y >= HY || occluded(x, y) || inSun(x, y)) return 0; return 0.12 + 0.62 * Math.pow(y / HY, 1.6) + 0.5 * Math.exp(-Math.pow(sunD(x, y) / 260, 2)) + 0.45 * beam(x, y); }, INK.yellow);
  fillShape(g, Array.from({ length: 48 }, (_, i) => [SUN[0] + Math.cos((i / 48) * Math.PI * 2) * SR, Math.min(HY, SUN[1] + Math.sin((i / 48) * Math.PI * 2) * SR)] as P), INK.yellow);
  // sea: the sun's path, and a warm cast on the near swell
  screen(g, all, PITCH, ANG.yellow, (x, y) => (sea(x, y) && !foam(x, y) ? 0.7 * glitter(x, y) + 0.1 : 0), INK.yellow);
  // turf: yellow under the blue makes the green, heavier where the sun rakes across it
  screen(g, all, PITCH, ANG.yellow, (x, y) => (turf(x, y) ? 0.74 + 0.25 * (x / 540) : cliff(x, y) || rock(x, y) ? 0.2 : 0), INK.yellow);
  // the warm side of the tower and cottage, the lit lantern, the cottage windows
  screen(g, all, PITCH, ANG.yellow, (x, y) => (inside(TOWER, x, y) ? 0.26 * Math.pow(towerX(x, y), 1.8) : 0), INK.yellow, TOWER);
  fillShape(g, LANTERN, INK.yellow); fillShape(g, blob(LAMP[0], LAMP[1], 40, 34, 7, 0.1, 16), INK.yellow, 0.5);
  [[150, 532, 26, 22], [212, 532, 26, 22]].forEach(([x, y, w, h]) => fillShape(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], INK.yellow));
});

const pinkPlate = (g: Gfx) => drum(g, REG.pink, () => {
  const all = { x0: 0, y0: 0, x1: W, y1: W };
  // sky: a band of pink across the middle of the dusk, deeper round the sun
  screen(g, all, PITCH, ANG.pink, (x, y) => { if (y >= HY || occluded(x, y)) return 0; if (inSun(x, y)) return 0.18 + 0.7 * clamp((y - (SUN[1] - SR * 0.3)) / (SR * 0.9)); return 0.3 * (1 - y / HY) + 0.6 * Math.exp(-Math.pow((y - 430) / 170, 2)) + 0.35 * Math.exp(-Math.pow(sunD(x, y) / 220, 2)) + 0.08; }, INK.pink);
  // sea: the sky's pink caught near the horizon, and the glitter
  screen(g, all, PITCH, ANG.pink, (x, y) => (sea(x, y) && !foam(x, y) ? 0.42 * clamp(1 - (y - HY) / 230) + 0.55 * glitter(x, y) : 0), INK.pink);
  // the tower's four red bands, the dome, the cottage roof
  const band = (y0: number, y1: number): P[] => { const hw = (y: number) => 52 - ((580 - y) / 328) * 18; return [[330 - hw(y1), y1], [330 + hw(y1), y1], [330 + hw(y0), y0], [330 - hw(y0), y0]]; };
  [[292, 334], [376, 418], [460, 502], [540, 580]].forEach(([a, b]) => fillShape(g, band(b, a), INK.pink));
  fillShape(g, DOME, INK.pink); fillShape(g, GALLERY, INK.pink, 0.6);
  fillShape(g, ROOF, INK.pink);
  // rock faces on the seaward cliff catching the last of the sun
  const r = rng(80);
  screen(g, all, PITCH, ANG.pink, (x, y) => (cliff(x, y) ? 0.2 + 0.55 * clamp((x - 220) / 320) * (0.6 + 0.6 * fractal(84, x, y, 0.04, 0.02, 2)) : 0), INK.pink);   // the cliff face warms toward the sun
  ROCKS.forEach((rk) => screen(g, all, PITCH, ANG.pink, (x) => { const b = rk.reduce((m, p) => Math.max(m, p[0]), -1e9), a = rk.reduce((m, p) => Math.min(m, p[0]), 1e9); return 0.15 + 0.6 * clamp((x - a) / (b - a)); }, INK.pink, rk));
});

const bluePlate = (g: Gfx) => drum(g, REG.blue, () => {
  const all = { x0: 0, y0: 0, x1: W, y1: W };
  // sky: night coming down from the top, pulled back where the beam cuts through
  screen(g, all, PITCH, ANG.blue, (x, y) => { if (y >= HY || occluded(x, y) || inSun(x, y)) return 0; return (0.05 + 0.66 * Math.pow(1 - y / HY, 1.4)) * (1 - 0.8 * beam(x, y)); }, INK.blue);
  // sea: deepening toward us, rolled into swells, left bare as foam against the rocks
  screen(g, all, PITCH, ANG.blue, (x, y) => { if (!sea(x, y) || foam(x, y)) return 0; const k = (y - HY) / (W - HY), swell = 0.5 + 0.5 * Math.sin(y * 0.09 + fractal(71, x, y, 0.004, 0.02, 2) * 6); return (0.34 + 0.34 * k) * (0.75 + 0.35 * swell) * (1 - 0.6 * glitter(x, y)); }, INK.blue);
  // land: the turf takes a light blue (for the green), the cliff below goes deep into shadow
  screen(g, all, PITCH, ANG.blue, (x, y) => (turf(x, y) ? 0.44 - 0.2 * (x / 540) : cliff(x, y) ? 0.5 + 0.25 * clamp((y - topOf(x)) / 160) - 0.25 * clamp((x - 300) / 260) : rock(x, y) ? 0.62 : 0), INK.blue);
  // the tower and cottage turned away from the sun: shadow on the left of every form
  screen(g, all, PITCH, ANG.blue, (x, y) => (inside(TOWER, x, y) ? 0.08 + 0.62 * Math.pow(1 - towerX(x, y), 1.8) : 0), INK.blue, TOWER);
  screen(g, all, PITCH, ANG.blue, (x) => 0.55 - 0.004 * (x - 132), INK.blue, COTTAGE);
  screen(g, all, PITCH, ANG.blue, (x) => (x < 192 ? 0.55 : 0.1), INK.blue, ROOF);
  screen(g, all, PITCH, ANG.blue, (x) => 0.1 + 0.6 * clamp((330 - x) / 32), INK.blue, DOME);
  // the key plate's solids: door, windows, gallery rail, mullions, chimney, finial
  const solid = (pts: P[]) => fillShape(g, pts, INK.blue);
  solid(smooth([[314, 580], [314, 548], [322, 538], [338, 538], [346, 548], [346, 580]], false, 4).concat([[314, 580]]));
  [[322, 460], [330, 380], [336, 300]].forEach(([x, y]) => solid([[x - 4, y - 12], [x + 4, y - 12], [x + 4, y + 10], [x - 4, y + 10]]));
  solid([[278, 250], [382, 250], [382, 256], [278, 256]]); solid([[282, 212], [378, 212], [378, 216], [282, 216]]);
  for (let x = 284; x <= 376; x += 9) solid([[x - 1, 214], [x + 1, 214], [x + 1, 240], [x - 1, 240]]);
  [308, 322, 338, 352].forEach((x) => solid([[x - 1.2, 176], [x + 1.2, 176], [x + 1.2, 214], [x - 1.2, 214]]));
  solid([[300, 174], [360, 174], [360, 178], [300, 178]]);
  solid(Array.from({ length: 12 }, (_, i) => [330 + Math.cos((i / 12) * Math.PI * 2) * 6, 146 + Math.sin((i / 12) * Math.PI * 2) * 6] as P)); solid([[329, 126], [331, 126], [331, 146], [329, 146]]);
  solid([[222, 474], [236, 474], [236, 500], [222, 500]]);                                                        // chimney
  solid([[178, 546], [198, 546], [198, 578], [178, 578]]);                                                        // cottage door
  [[150, 532], [212, 532]].forEach(([x, y]) => { solid([[x, y], [x + 26, y], [x + 26, y + 2.4], [x, y + 2.4]]); solid([[x + 12, y], [x + 14, y], [x + 14, y + 22], [x + 12, y + 22]]); solid([[x, y + 20], [x + 26, y + 20], [x + 26, y + 23], [x, y + 23]]); });
  // key lines in litho crayon: the tower's edges, the cliff's cracks, the swell, the gulls
  const pen = (pts: P[], w: number, seed: number, op = 0.9) => { g.pen(pts, { w, color: INK.blue, seed, wobble: 0.6, boil: 0, opacity: op, retrace: false }); };
  pen([[278, 580], [288, 420], [296, 252]], 1.6, 900); pen([[382, 580], [372, 420], [364, 252]], 1.2, 901, 0.7);
  const r = rng(910);
  for (let i = 0; i < 18; i++) { const x = 200 + r() * 340, y = 640 + r() * 110; if (!cliff(x, y)) continue; pen([[x, y], [x - 10 - r() * 20, y + 16 + r() * 20], [x - 4 - r() * 26, y + 40 + r() * 30]], 1.2, 920 + i, 0.75); }
  ROCKS.forEach((rk, i) => pen([...rk.slice(0, Math.round(rk.length * 0.6))], 1.6, 940 + i, 0.85));
  for (let i = 0; i < 38; i++) { const y = HY + 14 + Math.pow(r(), 1.3) * 460, x = 560 + r() * 520, l = 18 + (y - HY) * 0.12 + r() * 20; if (!sea(x, y) || foam(x, y) || Math.abs(x - SUN[0]) < 60) continue; pen([[x, y], [x + l * 0.5, y - 3], [x + l, y]], 1.1 + (y - HY) / 300, 960 + i, 0.8); }
  [[560, 300, 1], [612, 272, 0.8], [640, 330, 0.7], [180, 200, 0.9]].forEach(([x, y, s], i) => pen([[x - 16 * s, y - 2 * s], [x - 7 * s, y - 8 * s], [x, y], [x + 7 * s, y - 8 * s], [x + 16 * s, y - 2 * s]], 1.6, 1000 + i));
});

export const drawLighthouse = (ctx: Ctx, _frame: number, env: Env) => {
  const g = new Gfx(ctx, env, 0, LITHO);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, W);
  yellowPlate(g); pinkPlate(g); bluePlate(g);
  plateMarks(g, W, W, [INK.yellow, INK.pink, INK.blue]);
};

export const lighthouse: Film = {
  meta: { title: "Lighthouse at sunset · risograph", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "lighthouse", start: 0, end: 1, draw: drawLighthouse }],
};
