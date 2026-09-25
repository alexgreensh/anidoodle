// THE CLUMP, AND WHAT IS BEHIND IT. Stage R holds for six bars, so this is the part of the film
// the eye has time to disbelieve. Nine heads and five buds, hand-placed at three heights and
// three depths, chosen so the flight zig-zags right, then left behind a stem, then down, then up
// (spec 6.1). Nothing is stamped: every plant has its own view, colour, size, nod and seed, and
// no view is used for more than a quarter of the clump. Nine heads over five views is two of
// each and one over, so every view sits at 22 percent and none of them reaches the 25 the spec
// allows: facing R1 and F3, three-quarter R2 and F1, profile R3 and F4, half-open R4 and F2, and
// one bud standing among them on its own tall stem.
//
// Behind them there is no sky yet. At S around 0.5 the camera is down among the stems, so the
// backdrop is the meadow itself thrown out of focus: a graded wash that runs cool and green at
// the bottom to warm and pale at the top where the light comes through, drifts of colour with no
// drawing in them at all, and two planes of grass that are only silhouette and value.
import { Gfx, P, jitter, oval, rng, tube } from "../../core";
import { GRASS_LIT, GRASS_MID, GRASS_SHADE } from "../finale/world";
import { Plant, Variety, View, basalLeaves, head, plant } from "./ranunculus";
import { Cam, projector } from "./view";

// world units, the same units as the plate: the ground the clump grows out of is at y = 1080
export const GROUND = 1080;
export const R_LOOK: P = [1760, 250]; // where the lens sits through stage R

// R1 to R4 are the four the creature visits, in order. The rest are the clump it visits them in.
export const CLUMP: (Plant & { id: string; z: number })[] = [
  { id: "R4", z: 0, at: [1965, -130], R: 310, v: "magenta", view: "half", tilt: -0.12, stemLen: 1180, seed: 2101 },
  { id: "R2", z: 0, at: [2210, 170], R: 330, v: "blush", view: "three", tilt: 0.16, stemLen: 980, seed: 2102, sideBud: -0.7 },
  { id: "F1", z: 0, at: [1145, 255], R: 300, v: "peach", view: "three", tilt: -0.22, stemLen: 900, seed: 2103 },
  { id: "R1", z: 0, at: [1720, 300], R: 350, v: "coral", view: "facing", tilt: 0.05, stemLen: 900, seed: 2104 },
  { id: "F2", z: 0, at: [2470, 520], R: 290, v: "coral", view: "half", tilt: 0.3, stemLen: 700, seed: 2105 },
  { id: "R3", z: 0, at: [1330, 640], R: 300, v: "butter", view: "profile", tilt: -0.3, stemLen: 620, seed: 2106, sideBud: 0.6 },
  { id: "F4", z: 0, at: [2345, 790], R: 260, v: "blush", view: "profile", tilt: 0.42, stemLen: 420, seed: 2107 },
  { id: "F3", z: 0, at: [1575, 810], R: 270, v: "butter", view: "facing", tilt: 0.1, stemLen: 400, seed: 2108 },
  { id: "F5", z: 0.3, at: [1380, 430], R: 150, v: "magenta", view: "bud", tilt: -0.08, stemLen: 760, seed: 2109 },
];
export const BUDS: (Plant & { z: number })[] = [
  { z: 0, at: [1450, 120], R: 90, v: "coral", view: "bud", tilt: -0.5, stemLen: 1100, seed: 2201 },
  { z: 0, at: [2120, 700], R: 80, v: "blush", view: "bud", tilt: 0.55, stemLen: 520, seed: 2202 },
  { z: 0.3, at: [1250, -60], R: 85, v: "magenta", view: "bud", tilt: -0.3, stemLen: 1300, seed: 2203 },
  { z: 0, at: [2600, 200], R: 75, v: "peach", view: "bud", tilt: 0.7, stemLen: 980, seed: 2204 },
  { z: 0, at: [1700, 900], R: 70, v: "butter", view: "bud", tilt: -0.62, stemLen: 300, seed: 2205 },
];
// Every head nods on its OWN period, 50 to 80 frames, never shared. A visited head also dips on
// the landing and rebounds on the take-off, which is the only synchronised motion in the clump.
export const nod = (seed: number, f: number) => { const per = 50 + (seed % 31); return Math.sin((f / per) * Math.PI * 2 + seed) * 0.12; };

// ---------------------------------------------------------------- the backdrop
const mixc = (a: string, b: string, t: number) => { const h = (x: string) => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]; const A = h(a), B = h(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };

export const backdrop = (g: Gfx, cam: Cam, W: number, H: number) => {
  const c = g.cur, gr = c.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#eee9cd"); gr.addColorStop(0.34, "#cfd8a2"); gr.addColorStop(0.72, "#9cb375"); gr.addColorStop(1, "#6e8b5d");
  g.touch(-20, -20, W + 20, H + 20); c.fillStyle = gr; c.fillRect(-20, -20, W + 40, H + 40);
  const r = rng(4400); /* drifts of colour with no drawing in them: other flowers, far too far back to be flowers */
  ([["#e8b8c8", 260, 300, 190, 6], ["#f2dc9a", 760, 210, 220, 7], ["#d9a0b4", 900, 620, 170, 5], ["#eae2c2", 420, 120, 150, 5]] as [string, number, number, number, number][]).forEach(([col, cx, cy, rad, n], i) => {
    for (let j = 0; j < n; j++) { const a = r() * 6.283, d = Math.sqrt(r()) * rad; g.wash(oval(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, 18 + r() * 26, 14 + r() * 20, 9), col, { alpha: 0.2 + r() * 0.18, seed: 4410 + i * 20 + j, shrink: 0.95, rim: false }); }
  });
};

// a plane of grass that is only silhouette and value: no blade is drawn sharply this far back
export const backGrass = (g: Gfx, cam: Cam, z: number, seed: number, n: number, fade: number, lean: number) => {
  const { at, k } = projector(cam, z), r = rng(seed);
  const air = (col: string) => mixc(col, "#dfe4d0", fade);
  for (let i = 0; i < n; i++) {
    const wx = R_LOOK[0] - 2600 + r() * 5200, wy = GROUND - 200 + r() * 900, p = at([wx, wy]), h = (260 + r() * 520) * k;
    if (p[0] < -160 || p[0] > 1240) continue;
    const ang = (r() - 0.5) * 0.5 + lean * 0.4, pts: P[] = [];
    for (let q = 0; q <= 5; q++) { const t = q / 5, a = ang + lean * t * t * 1.4; pts.push([p[0] + Math.sin(a) * h * t, p[1] - Math.cos(a) * h * t]); }
    g.fill(tube(pts, Math.max(0.8, h * 0.022), h * 0.004, false), air([GRASS_SHADE, GRASS_MID, GRASS_LIT][Math.floor(r() * 3)]), (0.2 + r() * 0.24) * (1 - fade * 0.4));
  }
};

// ---------------------------------------------------------------- the clump, composed
export const drawClump = (g: Gfx, cam: Cam, f: number, o: { dip?: Record<string, number>; lean?: number } = {}) => {
  const lean = o.lean ?? 0, dips = o.dip ?? {};
  const items = [...CLUMP.map((p) => ({ p, bud: false })), ...BUDS.map((p) => ({ p: p as typeof CLUMP[0], bud: true }))];
  const drawn = items.map((it) => { const pr = projector(cam, it.p.z), s = pr.at(it.p.at); return { ...it, s, k: pr.k, y: s[1] }; });
  const p0 = projector(cam, 0);
  g.group("plain", () => basalLeaves(g, p0.at([1780, GROUND + 130]), 1250 * p0.k, 2300, 11), { alpha: 0.9 }); /* the dark ferny mass at the foot of the clump */
  drawn.sort((a, b) => a.y - b.y).forEach((it) => {
    const dip = dips[(it.p as { id?: string }).id ?? ""] ?? 0, n = nod(it.p.seed, f);
    g.group("paint", () => plant(g, { ...it.p, at: it.s, R: it.p.R }, it.k, dip + n, lean + n * 0.4), { alpha: 0.99 }); /* a paint group softens the margin a hair and granulates it: the difference between cellophane and wet pigment */
  });
};

// ---------------------------------------------------------------- the near air
export const fringe = (g: Gfx, cam: Cam, lean: number) => {
  const { at, k } = projector(cam, -0.2), r = rng(4500);
  g.group("plain", () => {
    for (let i = 0; i < 7; i++) {
      const p = at([R_LOOK[0] - 1400 + r() * 2800, GROUND + 400 + r() * 300]), h = (900 + r() * 700) * k, a = (r() - 0.5) * 0.7;
      const pts: P[] = []; for (let q = 0; q <= 5; q++) { const t = q / 5, ang = a + (lean + 0.1) * t * t * 1.6; pts.push([p[0] + Math.sin(ang) * h * t, p[1] - Math.cos(ang) * h * t]); }
      g.fill(tube(pts, Math.max(2, h * 0.04), h * 0.006, false), [GRASS_SHADE, GRASS_MID, GRASS_LIT][i % 3], 0.34);
    }
  }, { alpha: 0.55, blur: 4.2 }); /* across the lens, huge and with no edge at all */
};
// seed fluff, from local 345: two of them, drifting, never crossing the creature's face
export const seedFluff = (g: Gfx, cam: Cam, f: number) => {
  const { k } = projector(cam, -0.05);
  ([[345, 120, 980, -0.9, 3110], [420, 860, 1120, -1.25, 3120]] as number[][]).forEach(([from, x0, y0, rise, seed]) => {
    if (f < from) return; const t = (f - from) / 300, r = rng(seed);
    const p: P = [x0 + t * 620 + Math.sin(t * 7 + seed) * 46, y0 + t * 560 * rise + Math.cos(t * 5.5) * 30], R = 17 * Math.max(0.6, k * 1.6);
    if (p[1] < -40 || p[0] > 1140) return;
    for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2 + t * 1.6; g.fill(tube([p, [p[0] + Math.cos(a) * R, p[1] + Math.sin(a) * R]], R * 0.09, R * 0.03, false), "#f6f1e2", 0.5); }
    g.fill(oval(p[0], p[1], R * 0.14, R * 0.14, 6), "#cdbfa2", 0.7);
  });
};
