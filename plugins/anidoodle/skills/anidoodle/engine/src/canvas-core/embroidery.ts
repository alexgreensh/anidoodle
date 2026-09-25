import { Gfx, rng, type Ctx, type Env, type Layer, type Medium, type P } from "./core";
import type { Film } from "./film";
import { clamp, lerp, lerpP, mix, polyLen, resample, smooth } from "./gallery";
import { LIGHT, drawShadows, drawThreads, fishbone, headOf, knot, knots, linenLayer, longShort, runningStitch, satin, splitStitch, stemStitch, straight, type St } from "./embroideryKit";

// A WREATH AND A BEE · hand embroidery in a hoop.
//
// MEDIUM, physically: six-stranded cotton floss, split to two or three strands, and one gold
// thread for the flight line, worked with a crewel needle through natural linen, plain weave with
// slubs, stretched drum-tight in a beech hoop with a brass screw clamp.
// MARKS: a stitch is a length of twisted thread between two holes. Stem stitch (overlapping,
// slanted: a rope) for stems; split stitch (each stitch coming up through the last) for the outlines
// the fills butt against; satin stitch laid side by side ACROSS a form, the direction following it
// (across a petal, from a leaf's edge to its midrib, round a bee's abdomen); long-and-short rows
// shading one thread colour into another; French knots for flower centres, lavender and stamens;
// running stitch for the bee's flight line; single straight stitches for legs and wing veins.
// EDGE: the edge of every shape is the ends of its stitches, a row of tiny pinches into the
// cloth. Nothing is outlined by ink; outlines are thread too.
// ORDER: outlines first (stems in stem stitch, then the split-stitch edges), then the fills
// (leaves, poppy, daisies, forget-me-nots), then the knots, then the bee, last, and the needle is
// parked in the cloth. Each stitch appears as the needle pulls the thread through, one by one.
// PALETTE: oatmeal linen; sage, olive and moss greens; white and shell for daisies; butter and
// ochre centres; cornflower blue; two lavenders; poppy coral to oxblood; bee gold and umber.
// GROUND: the linen, a woven plain weave (warp over weft, weft over warp) you can count.
// LIGHT: a window upper left. Every stitch has a lit side and a shade side, its sheen depends on
// which way it lies to the light (so satin reads the form), and it casts a hair of shadow down and
// right. The hoop's ring casts a shadow onto the cloth inside it at upper left, outside at lower right.
// SUBJECT and STRUCTURE (from knowledge of botanical embroidery and of the plants): an open wreath,
// two stems rising from a crossing at the bottom; oxeye daisy (white rays round a domed yellow
// disc, seen face on, three-quarter and as a bud in its green calyx); field poppy (four crumpled
// petals, a green seed pod with a dark stigma disc and a ring of black stamens); forget-me-nots
// (five round petals, yellow eye, in small coiled clusters); lavender (knotted spikes on bare
// stems); lanceolate and ovate leaves. The bee is a honeybee: head with compound eyes and elbowed
// antennae, furred thorax, banded six-segment abdomen, two pairs of veined wings (the forewing
// larger), six legs, a pollen load on the hind leg; flying in toward the smallest daisy.
// WHAT MAKES IT NOT ITS NEIGHBOUR (fox, cut paper): nothing here is a flat piece; every mark is a
// line with a direction, and tone comes from the direction of the stitches, not from colour fills.

const W = 1080, H = 1080, N = 540, HOLD = 30;
const EMB_M: Medium = { nib: 1, taper: 0, pressure: 0, retrace: false, wobble: 0, rough: 0 };
const HC: P = [540, 548], RO = 470, RI = 446;           // the hoop
const C: P = [540, 584], R = 294;                       // the wreath
const G = { dark: "#4d6636", olive: "#6c7f3e", sage: "#8ea46a", light: "#b3c690", stem: "#5b6f3b", grey: "#8c9a79" };
const WHITE = "#f7f3eb", SHELL = "#dcd4c3", BUTTER = "#f1c33d", OCHRE = "#cf8a1e";
const BLUE = "#6f98d2", BLUE2 = "#a2bfe6", LAV = "#8f7bc0", LAV2 = "#66529a";
const POPPY = ["#f08566", "#e2553b", "#c43b2d", "#8b211c"];
const GOLD = "#e4a62c", UMBER = "#2e231c", FUZZ = "#b0782f", SILVER = "#cfd6db";

const rad = (d: number) => (d * Math.PI) / 180;
const polar = (deg: number, r = R): P => [C[0] + Math.cos(rad(deg)) * r, C[1] + Math.sin(rad(deg)) * r];
const unit = (x: number, y: number): P => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
const rot = (p: P, a: number): P => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const add = (a: P, b: P, k = 1): P => [a[0] + b[0] * k, a[1] + b[1] * k];
// the wreath line: a gentle wave on the circle. dir = +1 grows with increasing angle (left branch)
const wreathR = (deg: number) => R + 7 * Math.sin(rad(deg) * 3);
const onWreath = (deg: number): P => polar(deg, wreathR(deg));
const grow = (deg: number, dir: 1 | -1): P => { const a = onWreath(deg), b = onWreath(deg + dir * 1); return unit(b[0] - a[0], b[1] - a[1]); };
const outward = (deg: number): P => [Math.cos(rad(deg)), Math.sin(rad(deg))];

// ---------------------------------------------------------------- plants
type Section = { id: string; a: number; b: number; sts: St[] };
const LEFT = { from: 102, to: 262, dir: 1 as const }, RIGHT = { from: 78, to: -30, dir: -1 as const };
const branchPath = (b: typeof LEFT | typeof RIGHT): P[] => { const out: P[] = []; for (let d = b.from; b.dir > 0 ? d <= b.to : d >= b.to; d += b.dir * 2) out.push(onWreath(d)); return out; };
// the two stems cross at the bottom, where they were tied
const tails = (): P[][] => { const l = onWreath(LEFT.from), r = onWreath(RIGHT.from); return [[l, [l[0] + 26, l[1] + 22], [l[0] + 70, l[1] + 40], [l[0] + 112, l[1] + 50]], [r, [r[0] - 26, r[1] + 20], [r[0] - 72, r[1] + 42], [r[0] - 116, r[1] + 48]]]; };
const TIE: P = [540, 906];   // where the two stems cross: bound with a few wraps of gold

type Leaf = { mid: P[]; half: (t: number) => number; big: boolean; side: number; deg: number };
const LEAVES: [number, number, number, number][] = [   // [deg on the wreath, side (+1 out, -1 in), length, width ratio]: authored, largest near the base
  [108, 1, 70, 0.2], [114, -1, 80, 0.26], [131, -1, 64, 0.2], [140, 1, 56, 0.16], [157, -1, 82, 0.27], [163, 1, 44, 0.2], [173, -1, 60, 0.18], [180, 1, 42, 0.14], [197, -1, 58, 0.2],
  [206, 1, 52, 0.16], [221, 1, 50, 0.2], [226, -1, 48, 0.18], [238, -1, 42, 0.16], [244, 1, 36, 0.22], [253, 1, 34, 0.2], [258, -1, 30, 0.18], [262, 1, 24, 0.2],
  [120, 1, 34, 0.2], [148, -1, 36, 0.2], [186, -1, 34, 0.2], [213, 1, 30, 0.22], [232, 1, 28, 0.2], [249, -1, 26, 0.2],
  [60, 1, 36, 0.22], [49, 1, 32, 0.2], [26, 1, 34, 0.2], [8, -1, 30, 0.22], [-19, 1, 28, 0.2],
  [74, 1, 72, 0.2], [67, -1, 68, 0.24], [55, 1, 84, 0.27], [44, -1, 56, 0.18], [36, 1, 48, 0.16], [20, -1, 60, 0.2], [14, 1, 50, 0.18], [2, -1, 52, 0.2], [-2, 1, 38, 0.24], [-9, 1, 44, 0.16], [-15, -1, 40, 0.18], [-24, -1, 30, 0.2], [-28, 1, 26, 0.2],
];
const BIG = new Set([1, 4, 30]);
const leafOf = ([deg, side, len0, wr]: [number, number, number, number], i: number): Leaf => {
  const len = len0 * 1.12;
  const dir = deg > 90 || deg < -90 ? 1 : (deg >= 90 ? 1 : -1), g = grow(deg, deg >= 90 ? 1 : -1), o = outward(deg), sp = rad(38 + (i % 3) * 6), r = rng(900 + i);
  void dir;
  const d = unit(g[0] * Math.cos(sp) + o[0] * side * Math.sin(sp), g[1] * Math.cos(sp) + o[1] * side * Math.sin(sp)), perp: P = [-d[1], d[0]], bend = (r() - 0.5) * 0.5 + side * 0.12, base = onWreath(deg);
  const mid = resample(smooth([base, add(add(base, d, len * 0.5), perp, bend * len * 0.14), add(add(base, d, len), perp, bend * len * 0.3)], false, 8), 24);
  const W0 = len * wr, pw = 0.7 + (i % 4) * 0.08;
  return { mid, half: (t) => W0 * Math.pow(Math.sin(Math.PI * Math.pow(clamp(t), pw)), 0.85), big: BIG.has(i), side, deg };
};
const outlineOf = (l: Leaf): P[] => {
  const n = l.mid.length, L: P[] = [], Rr: P[] = [];
  l.mid.forEach((p, i) => { const q = l.mid[Math.min(n - 1, i + 1)], pr = l.mid[Math.max(0, i - 1)], u = unit(q[0] - pr[0], q[1] - pr[1]), h = l.half(i / (n - 1)); L.push([p[0] - u[1] * h, p[1] + u[0] * h]); Rr.push([p[0] + u[1] * h, p[1] - u[0] * h]); });
  return [...L, ...Rr.reverse()];
};
// which half of a leaf faces the window: that half gets the lighter green
const litSide = (l: Leaf): number => { const a = l.mid[0], b = l.mid[l.mid.length - 1], u = unit(b[0] - a[0], b[1] - a[1]); return -u[1] * LIGHT[0] + u[0] * LIGHT[1] > 0 ? -1 : 1; };

// POPPY: four petals seen three-quarter from above, the back pair larger, the front pair overlapping
const PC: P = add(polar(127, R + 8), [0, 0]);
const petal = (cDeg: number, half: number, rad0: number, seed: number) => {
  const arc: P[] = [], r = rng(seed), ph = r() * 6;
  for (let k = 0; k <= 18; k++) { const f = k / 18, a = rad(cDeg - half + f * 2 * half), rr = rad0 * (1 + 0.07 * Math.sin(a * 7 + ph) - 0.2 * Math.pow(Math.abs(f - 0.5) * 2, 2.4)); const v = rot([Math.cos(a) * rr, Math.sin(a) * rr * 0.8], rad(-12)); arc.push(add(PC, v)); }
  const inner = (a: number): P => add(PC, rot([Math.cos(rad(a)) * 11, Math.sin(rad(a)) * 9], rad(-12)));
  return { arc, outline: [inner(cDeg - half * 0.5), ...arc, inner(cDeg + half * 0.5)], target: (p: P): P => lerpP(PC, p, 0.2) };
};
const PETALS = [petal(-128, 62, 80, 1), petal(-42, 58, 76, 2), petal(150, 60, 70, 3), petal(48, 62, 72, 4)];

// DAISY: rays from an inner to an outer radius, satin across each ray, then a knotted disc.
// `T` maps the flower's own disc into the page, which is how the three-quarter view is authored.
const daisy = (T: (p: P) => P, n: number, r0: number, r1: number, seed: number, face = 1): St[] => {
  const out: St[] = [], r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.12, len = (r1 - r0) * (0.86 + r() * 0.2), dir: P = [Math.cos(a), Math.sin(a)], bend = (r() - 0.5) * 0.3;
    const axis = [0, 0.5, 1].map((f) => { const rr = r0 + len * f, b = bend * f * f * 8; return T([dir[0] * rr - dir[1] * b, dir[1] * rr + dir[0] * b]); });
    const pa = T([0, 0]), pb = T(dir), away = (pb[0] - pa[0]) * LIGHT[0] + (pb[1] - pa[1]) * LIGHT[1] < -0.15 * face;
    out.push(...satin(axis, (t) => 4.6 * Math.pow(Math.sin(Math.PI * clamp(t * 0.92 + 0.08)), 0.55) * (0.75 + 0.25 * face), 2.3, 2.2, (t) => (t < 0.12 ? SHELL : away && t < 0.7 ? SHELL : WHITE), { skew: 0.15 }));
  }
  return out;
};
const disc = (T: (p: P) => P, r: number, seed: number): St[] => knots(0, 0, r, r, 2.3, (u, v) => (u * 0.6 + v * 0.8 > 0.25 ? OCHRE : BUTTER), seed).map((k) => ({ ...k, a: T(k.a) }));
const faceOn = (c: P, k = 1, squash = 1, tilt = 0) => (p: P): P => add(c, rot([p[0] * k, p[1] * k * squash], rad(tilt)));

// FORGET-ME-NOTS: five round petals, a yellow eye, clustered on short stalks
const forgetMeNots = (deg: number, side: number, seed: number): { stems: St[]; petals: St[]; eyes: St[] } => {
  const r = rng(seed), base = onWreath(deg), o = outward(deg), g = grow(deg, deg > 90 || deg < -90 ? 1 : deg >= 90 ? 1 : -1), c0 = add(add(base, o, side * 38), g, 12), stems: St[] = [], petals: St[] = [], eyes: St[] = [];
  const spots: P[] = [];
  for (let k = 0; k < 7; k++) { let p: P = c0; for (let tries = 0; tries < 12; tries++) { p = [c0[0] + (r() - 0.5) * 60, c0[1] + (r() - 0.5) * 52]; if (spots.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 19)) break; } spots.push(p); }
  spots.forEach((p, k) => {
    stems.push(...stemStitch([base, lerpP(base, p, 0.55), p], 7, 1.6, G.stem, seed + k));
    if (k >= 5) { petals.push(knot(p, 2.4, k === 5 ? "#e7a3b8" : BLUE2)); return; }   // buds: pink before they open, as the real plant does
    const tw = r() * 1.2, sq = 0.7 + r() * 0.3;
    for (let q = 0; q < 5; q++) { const a = tw + (q / 5) * Math.PI * 2, d = rot([1, 0], a), pp = (f: number): P => add(p, [d[0] * f, d[1] * f * sq]); const lit = d[0] * LIGHT[0] + d[1] * LIGHT[1] > 0; petals.push(...satin([pp(1.8), pp(5.4), pp(9)], (t) => 3.9 * Math.sin(Math.PI * clamp(t * 0.85 + 0.12)), 1.9, 1.9, () => (lit ? BLUE2 : BLUE))); }
    eyes.push(knot(p, 2, BUTTER));
  });
  return { stems, petals, eyes };
};
// LAVENDER: a bare stem, then a spike of knots in whorls, tighter to the tip
const lavender = (deg: number, seed: number): { stem: St[]; spike: St[] } => {
  const r = rng(seed), base = onWreath(deg), o = outward(deg), g = grow(deg, deg >= 90 ? 1 : -1), d = unit(o[0] * 0.8 + g[0] * 0.6, o[1] * 0.8 + g[1] * 0.6), n: P = [-d[1], d[0]], len = 96 + r() * 16, bend = (r() - 0.5) * 0.3;
  const path = [base, add(add(base, d, len * 0.5), n, bend * 10), add(add(base, d, len), n, bend * 22)], spine = resample(smooth(path, false, 6), 40);
  const spike: St[] = [];
  for (let k = 0; k < 13; k++) { const f = 0.42 + (k / 12) * 0.58, p = spine[Math.min(39, Math.round(f * 39))], s = k % 2 ? 1 : -1, wd = 6.5 * (1 - (k / 12) * 0.5); spike.push(knot(add(p, n, s * wd), 2.8, k % 3 === 0 ? LAV2 : LAV)); if (k % 2 === 0 && k < 11) spike.push(knot(add(p, n, -s * wd * 0.3), 2.5, LAV2)); }
  const leaves = [straight(spine[8], add(spine[8], rot(d, 0.6), 18), 1.8, G.grey), straight(spine[12], add(spine[12], rot(d, -0.55), 16), 1.8, G.grey)];
  return { stem: [...stemStitch(spine, 7, 1.8, G.grey, seed), ...leaves], spike };
};

// ---------------------------------------------------------------- the bee
const BEE: P = [650, 300], HEAD = rad(33), BS = 1.42;
const B = (x: number, y: number): P => add(BEE, rot([x * BS, y * BS], HEAD));
const bee = () => {
  const abdomen: St[] = [], thorax: St[] = [], head: St[] = [], legs: St[] = [], wings: St[] = [], r = rng(77);
  // abdomen: six bands, satin across the body, the band edges bowing toward the tail with the roundness
  const x0 = 1, x1 = -66, hw = (u: number) => 21 * Math.pow(Math.sin(Math.PI * clamp(0.1 + u * 0.88)), 0.6) * (1 - 0.25 * u);
  const band = (u: number) => [0.14, 0.26, 0.41, 0.54, 0.68, 0.8].filter((e) => u > e).length % 2 === 0 ? GOLD : UMBER;
  for (let x = x0; x >= x1; x -= 2.3 / BS) { const u = (x0 - x) / (x0 - x1), h = hw(u); if (h < 1) continue; for (const s of [-1, 1]) { const ym = (s * h) / 2, bow = 0.05 * (ym / 21) ** 2; abdomen.push({ k: "flat", a: B(x + (s < 0 ? 0.3 : -0.3), 0), b: B(x - s * 0.8, s * h), w: 2.3, c: band(u - bow * 4 + (s > 0 ? 0.006 : 0)), t: 1 }); } }
  // thorax: fur, short stitches radiating from a darker centre
  thorax.push(...satin([B(4, 0), B(18, 0), B(32, 0)], (t) => 14 * BS * Math.pow(Math.sin(Math.PI * clamp(t * 0.9 + 0.05)), 0.55), 2.2, 2.2, (t) => (t > 0.25 && t < 0.75 ? "#4a3119" : "#7a5226")));   // the thorax laid in first, dark, so the fur has a body under it
  for (let k = 0; k < 120; k++) { const a = r() * Math.PI * 2, d0 = 5 + r() * 7, d1 = 14 + r() * 7, c = d0 < 6 ? "#5e3d1c" : r() < 0.5 ? FUZZ : "#d19a3e"; thorax.push({ k: "flat", a: B(18 + Math.cos(a) * d0, Math.sin(a) * d0 * 0.95), b: B(18 + Math.cos(a) * d1, Math.sin(a) * d1 * 0.95), w: 1.8, c, t: 0.7 }); }
  // head: satin, then the compound eyes, then a glint in each
  head.push(...satin([B(34, 0), B(42, 0), B(50, 0), B(55, 0)], (t) => 11.5 * BS * Math.pow(Math.sin(Math.PI * clamp(t * 0.94 + 0.03)), 0.5) * (1 - 0.35 * t), 2.2, 2.2, () => "#3b2b1f"));   // broad at the eyes, narrowing to the jaws
  for (const s of [-1, 1]) { head.push(...satin([B(38, s * 9), B(44, s * 10.5), B(50, s * 9)], (t) => 4.4 * BS * Math.sin(Math.PI * clamp(t * 0.8 + 0.1)), 1.9, 1.9, () => "#15110e")); head.push(straight(B(41, s * 9.5 - 1.5), B(44, s * 9.5 - 2), 1.2, "#f4f1ea")); }
  // antennae: elbowed, scape then flagellum
  for (const s of [-1, 1]) head.push(...stemStitch([B(52, s * 3.5), B(56, s * 8), B(58, s * 10.5), B(64, s * 13.5), B(70, s * 16)], 6, 1.5, UMBER, 80 + s));
  // legs: three pairs, femur-tibia-tarsus, the hind pair longest with its pollen load
  const LEG: [number, number, number][] = [[28, 0.9, 0.8], [20, 1.35, 1], [12, 1.9, 1.3]];
  LEG.forEach(([x, sweep, k], j) => { for (const s of [-1, 1]) { const p0 = B(x, s * 12), p1 = B(x - 6 * sweep, s * (17 * k)), p2 = B(x - 12 * sweep - 5, s * (18.5 * k)), p3 = B(x - 17 * sweep - 7, s * (18 * k)); legs.push(straight(p0, p1, 2, UMBER), straight(p1, p2, 1.7, UMBER), straight(p2, p3, 1.3, UMBER)); if (j === 2) legs.push(knot(lerpP(p1, p2, 0.5), 3.2, "#e9892c"), knot(lerpP(p1, p2, 0.2), 2.6, "#f0a83a")); } });
  // wings: forewing larger, overlapping the hindwing's leading edge; split-stitch edges, a few veins, sparse fill so the body shows through
  const wing = (s: number, len: number, wd: number, back: number, rootX: number) => {
    const root = B(rootX, s * 9), tipDir = rot([-Math.cos(rad(back)), s * Math.sin(rad(back))], HEAD), nrm: P = [-tipDir[1] * s, tipDir[0] * s];
    const pt = (f: number, g: number): P => add(add(root, tipDir, len * f), nrm, wd * g);
    const edge = smooth([pt(0, 0), pt(0.3, 0.55), pt(0.7, 0.62), pt(0.98, 0.25), pt(0.95, -0.15), pt(0.6, -0.32), pt(0.25, -0.22), pt(0, 0)], false, 6);
    wings.push(...splitStitch(edge, 6, 1.5, "#a9b3ba"));
    wings.push(straight(pt(0.05, 0.05), pt(0.7, 0.3), 1.2, SILVER), straight(pt(0.1, 0), pt(0.85, 0.02), 1.2, SILVER), straight(pt(0.3, 0.15), pt(0.55, -0.2), 1.1, SILVER));
    for (let k = 0; k < 7; k++) { const f = 0.2 + k * 0.1, g0 = -0.25 + (k % 2) * 0.1; wings.push(straight(pt(f, g0), pt(f + 0.12, 0.5 - (k % 3) * 0.08), 1.1, k % 2 ? "#eef1f2" : SILVER)); }
  };
  for (const s of [-1, 1]) { wing(s, 58, 26, 64, 12); wing(s, 82, 34, 40, 16); }
  return { abdomen, thorax, head, legs, wings };
};
const FLIGHT: P[] = [[262, 300], [290, 226], [352, 186], [398, 222], [372, 262], [334, 232], [366, 176], [436, 146], [500, 160], [542, 196], [566, 226]];

// ---------------------------------------------------------------- the timeline: one cue table
const build = (): Section[] => {
  const leaves = LEAVES.map(leafOf), bigLeaves = leaves.filter((l) => l.big), small = leaves.filter((l) => !l.big);
  const fmn = [forgetMeNots(150, 1, 11), forgetMeNots(213, -1, 12), forgetMeNots(47, 1, 13), forgetMeNots(-3, -1, 14)];
  const lav = [lavender(167, 21), lavender(233, 22), lavender(63, 23), lavender(8, 24)];
  const D1 = faceOn(polar(189, R + 20), 1.22), D2 = faceOn(polar(27, R + 16), 1.18, 0.52, -24), D3 = faceOn(polar(-21, R + 8), 0.92, 0.92, 8);
  const budC = polar(247, R + 10), budD = unit(outward(247)[0] * 0.55 + grow(247, 1)[0] * 0.85, outward(247)[1] * 0.55 + grow(247, 1)[1] * 0.85), budN: P = [-budD[1], budD[0]];
  const flowerStem = (deg: number, to: P, seed: number) => stemStitch([onWreath(deg), lerpP(onWreath(deg), to, 0.5), to], 8, 2.2, G.stem, seed);
  const b = bee(), dir = (l: Leaf) => litSide(l);
  const bud: St[] = [
    ...satin([add(budC, budD, -6), add(budC, budD, 2), add(budC, budD, 9)], (t) => 8 * Math.sin(Math.PI * clamp(t * 0.8 + 0.15)), 2.2, 2.2, (t, s) => (s < 0 ? G.light : G.olive)),
    ...[-0.5, -0.2, 0.1, 0.4].map((f, k) => satin([add(add(budC, budD, 8), budN, f * 14), add(add(budC, budD, 14 + (k % 2) * 3), budN, f * 16)], (t) => 2.4 * Math.sin(Math.PI * clamp(t * 0.8 + 0.1)), 1.9, 1.9, () => (k < 2 ? WHITE : SHELL))).flat(),
  ];
  const secs: Section[] = [
    // OUTLINES
    { id: "stems", a: 5, b: 70, sts: [...stemStitch(branchPath(LEFT), 10, 2.8, G.stem, 1), ...stemStitch(branchPath(LEFT).map((p, i, a) => { const q = a[Math.min(a.length - 1, i + 1)], o = a[Math.max(0, i - 1)], u = unit(q[0] - o[0], q[1] - o[1]); return [p[0] + u[1] * 2.6, p[1] - u[0] * 2.6] as P; }), 10, 2.4, G.olive, 5),
      ...stemStitch(branchPath(RIGHT), 10, 2.8, G.stem, 2), ...stemStitch(branchPath(RIGHT).map((p, i, a) => { const q = a[Math.min(a.length - 1, i + 1)], o = a[Math.max(0, i - 1)], u = unit(q[0] - o[0], q[1] - o[1]); return [p[0] - u[1] * 2.6, p[1] + u[0] * 2.6] as P; }), 10, 2.4, G.olive, 6), ...tails().flatMap((t, i) => stemStitch(smooth(t, false, 6), 9, 2.8, G.stem, 3 + i)), ...[-6, -3, 0, 3, 6].map((d) => straight(add(TIE, [d - 2, -9]), add(TIE, [d + 2, 9]), 2.2, GOLD))] },
    { id: "stalks", a: 70, b: 100, sts: [...flowerStem(186, D1([0, 0]), 30), ...flowerStem(30, D2([0, 0]), 31), ...flowerStem(-16, D3([0, 0]), 32), ...flowerStem(242, budC, 33), ...flowerStem(122, PC, 34), ...lav.flatMap((l) => l.stem), ...fmn.flatMap((f) => f.stems)] },
    { id: "edges", a: 100, b: 150, sts: [...bigLeaves.flatMap((l) => splitStitch(outlineOf(l), 5.5, 2, G.dark, true)), ...PETALS.flatMap((p) => splitStitch(p.arc, 5, 2, POPPY[3]))] },
    // FILLS
    { id: "leaves", a: 150, b: 235, sts: small.flatMap((l) => fishbone(l.mid, (t) => l.half(t) * 0.92, 2.3, 2.2, (s) => (s === dir(l) ? G.sage : G.olive))) },
    { id: "shaded", a: 235, b: 265, sts: bigLeaves.flatMap((l, i) => { const out = outlineOf(l), n = out.length, half = Math.floor(n / 2); return [out.slice(0, half), out.slice(half)].flatMap((edge, s) => longShort(edge, (p) => { let best = l.mid[0], bd = 1e9; for (const q of l.mid) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = q; } } return lerpP(p, best, 1); }, 3, 2.4, 2.1, (s === 0) === (dir(l) < 0) ? [G.light, G.sage, G.olive] : [G.sage, G.olive, G.dark], 200 + i * 2 + s)); }) },
    { id: "poppy", a: 265, b: 300, sts: PETALS.flatMap((p, i) => longShort(p.arc, p.target, 4, 2.3, 2.2, POPPY, 300 + i)) },
    { id: "daisies", a: 300, b: 335, sts: [...daisy(D1, 19, 11, 48, 40), ...daisy(D2, 17, 11, 46, 41, 0.6), ...daisy(D3, 15, 9, 38, 42), ...bud] },
    { id: "forgetmenots", a: 335, b: 355, sts: fmn.flatMap((f) => f.petals) },
    // KNOTS
    { id: "knots", a: 355, b: 400, sts: [...disc(D1, 11, 50), ...disc(D2, 11, 51), ...disc(D3, 9, 52), ...fmn.flatMap((f) => f.eyes), ...lav.flatMap((l) => l.spike),
      ...satin([add(PC, [-9, 0]), PC, add(PC, [9, 0])], (t) => 8 * Math.sin(Math.PI * clamp(t * 0.85 + 0.08)), 2.1, 2, () => "#7d8f4b"),
      ...Array.from({ length: 8 }, (_, k) => straight(PC, add(PC, rot([7, 0], (k / 8) * Math.PI * 2)), 1.3, "#2d2723")),
      ...Array.from({ length: 16 }, (_, k) => knot(add(PC, rot([15 + (k % 2) * 3, 0], (k / 16) * Math.PI * 2 + 0.2)), 2.2, "#221d1a"))] },
    // THE BEE
    { id: "flight", a: 400, b: 420, sts: runningStitch(smooth(FLIGHT, false, 8), 7, 5, 1.6, GOLD) },
    { id: "abdomen", a: 420, b: 450, sts: b.abdomen },
    { id: "thorax", a: 450, b: 465, sts: b.thorax },
    { id: "head", a: 465, b: 475, sts: b.head },
    { id: "legs", a: 475, b: 490, sts: b.legs },
    { id: "wings", a: 490, b: 505, sts: b.wings },
  ];
  for (const s of secs) if (s.a % 5 || s.b % 5) throw new Error(`embroidery: cue ${s.id} off the grid`);
  return secs;
};
// the hand's pace: a stitch takes a moment plus a little per millimetre; a knot takes three wraps
type Timed = St & { f0: number; f1: number };
const timeline = (secs: Section[]): Timed[] => secs.flatMap((s) => {
  const wts = s.sts.map((st) => (st.k === "knot" ? 2.4 : 0.55 + Math.hypot(st.b[0] - st.a[0], st.b[1] - st.a[1]) / 16)), T = wts.reduce((a, b) => a + b, 0), span = (s.b - s.a) * 0.94;
  let acc = 0; return s.sts.map((st, i) => { const f0 = s.a + (acc / T) * span; acc += wts[i]; return { ...st, f0, f1: s.a + (acc / T) * span }; });
});
((): void => { let t = 5; for (const s of build()) { if (s.a !== t || s.b <= s.a) throw new Error(`embroidery: section ${s.id} ${s.a}-${s.b} does not follow ${t}`); t = s.b; } if (t !== 505 || N % 15 || N - HOLD !== 510) throw new Error("embroidery: timeline does not end at 505 before the park and hold"); })();

// ---------------------------------------------------------------- the sheet in the hoop
const cached = <T,>(env: Env, key: string, fn: () => T): T => { let v = env.cache.get(key) as T | undefined; if (v === undefined) { v = fn(); env.cache.set(key, v); } return v; };
const DWH = (env: Env): [number, number] => [Math.round(env.W * env.scale), Math.round(env.H * env.scale)];
const STRIDE = 180;                                                    // stitches per cached checkpoint
const drawRun = (L: Layer, env: Env, sts: St[], lastP = 1) => {
  if (!sts.length) return;
  const g = new Gfx(L.ctx, env, 0, EMB_M); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const s of sts) { x0 = Math.min(x0, s.a[0], s.b[0]); y0 = Math.min(y0, s.a[1], s.b[1]); x1 = Math.max(x1, s.a[0], s.b[0]); y1 = Math.max(y1, s.a[1], s.b[1]); }
  g.group("plain", () => { g.touch(x0 - 8, y0 - 8, x1 + 10, y1 + 10); drawShadows(g.cur, sts, lastP); }, { blur: 0.9 });
  g.group("plain", () => { g.touch(x0 - 6, y0 - 6, x1 + 6, y1 + 6); drawThreads(g.cur, sts, lastP); });
};
const checkpoint = (env: Env, all: Timed[], k: number): Layer | null => {
  if (k <= 0) return null;
  const key = `emb:ck:${k}:${env.scale}:${env.W}x${env.H}`, hit = env.cache.get(key) as Layer | undefined; if (hit) return hit;
  const prev = checkpoint(env, all, k - 1), [dw, dh] = DWH(env), L = env.canvas(dw, dh); L.ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (prev) { L.ctx.globalCompositeOperation = "copy"; L.ctx.drawImage(prev.canvas as CanvasImageSource, 0, 0); L.ctx.globalCompositeOperation = "source-over"; }
  drawRun(L, env, all.slice((k - 1) * STRIDE, k * STRIDE));
  env.cache.set(key, L); env.cache.delete(`emb:ck:${k - 3}:${env.scale}:${env.W}x${env.H}`);
  return L;
};

const ground = (env: Env): Layer => linenLayer(env, "hoop", 4.2, [224, 211, 186], (x, y) => {
  const d = Math.hypot(x - HC[0], y - HC[1]);
  if (d < RI) return 1.03 - 0.05 * (d / RI) ** 2;                    // drum-tight inside the hoop
  const fold = Math.sin((x * 0.8 + y * 0.35) * 0.012 + Math.sin(y * 0.01) * 1.6);   // slack cloth outside it, in soft folds
  return 0.84 + 0.07 * fold;
});
const hoop = (env: Env): Layer => cached(env, `emb:hoop:${env.scale}:${env.W}x${env.H}`, () => {
  const [dw, dh] = DWH(env), L = env.canvas(dw, dh), c = L.ctx, s = env.scale; c.setTransform(s, 0, 0, s, 0, 0);
  const ring = (dx: number, dy: number, r0: number, r1: number) => { c.beginPath(); c.arc(HC[0] + dx, HC[1] + dy, r1, 0, Math.PI * 2); c.arc(HC[0] + dx, HC[1] + dy, r0, 0, Math.PI * 2, true); };
  // the ring's shadow: inside at upper left, outside at lower right; soft by stacking offset copies
  for (let k = 0; k < 6; k++) { c.globalAlpha = 0.07; c.fillStyle = "#2b1d10"; ring(5 + k * 1.6, 7 + k * 2.2, RI - k * 0.8, RO + k * 0.8); c.fill("evenodd"); }
  c.globalAlpha = 1;
  const gr = c.createLinearGradient(HC[0] - RO, HC[1] - RO, HC[0] + RO, HC[1] + RO); gr.addColorStop(0, "#e2b67c"); gr.addColorStop(0.5, "#c89960"); gr.addColorStop(1, "#a97a45");
  c.fillStyle = gr; ring(0, 0, RI, RO); c.fill("evenodd");
  const r = rng(515); c.lineCap = "round";                               // beech grain: long broken arcs following the steamed bend
  for (let k = 0; k < 30; k++) { const rr = RI + 2 + r() * (RO - RI - 4), a0 = r() * Math.PI * 2, a1 = a0 + 0.3 + r() * 1.3; c.strokeStyle = r() < 0.5 ? "#96683a" : "#b5854f"; c.globalAlpha = 0.35 + r() * 0.3; c.lineWidth = 0.6 + r() * 0.9; c.beginPath(); c.arc(HC[0], HC[1], rr, a0, a1); c.stroke(); }
  c.globalAlpha = 0.55; c.strokeStyle = "#f6dcae"; c.lineWidth = 2.2; c.beginPath(); c.arc(HC[0], HC[1], RO - 1.5, rad(160), rad(290)); c.stroke();   // the rounded outer edge catching the window
  c.globalAlpha = 0.5; c.strokeStyle = "#7c5530"; c.lineWidth = 1.6; c.beginPath(); c.arc(HC[0], HC[1], RI + 1, 0, Math.PI * 2); c.stroke();   // where the cloth tucks under
  // the clamp: two end-grain lugs and a brass screw with its thumb nut
  const top = HC[1] - RO;
  c.globalAlpha = 0.28; c.fillStyle = "#2b1d10"; c.fillRect(519, top - 36, 52, 52); c.fillRect(520, top - 12, 98, 22); c.globalAlpha = 1;
  for (const x of [512, 546]) { const lg = c.createLinearGradient(x, 0, x + 22, 0); lg.addColorStop(0, "#d9a96b"); lg.addColorStop(1, "#a47440"); c.fillStyle = lg; c.beginPath(); c.roundRect(x, top - 40, 22, 52, 4); c.fill(); c.strokeStyle = "#8a5e33"; c.globalAlpha = 0.5; c.lineWidth = 1; c.strokeRect(x + 3, top - 36, 16, 44); c.globalAlpha = 1; }
  const sg = c.createLinearGradient(0, top - 26, 0, top - 12); sg.addColorStop(0, "#f3dc8e"); sg.addColorStop(0.45, "#c9a043"); sg.addColorStop(1, "#7d5f1f"); c.fillStyle = sg; c.fillRect(500, top - 25, 96, 12);
  c.strokeStyle = "#6e531b"; c.globalAlpha = 0.6; c.lineWidth = 0.8; for (let x = 572; x < 596; x += 3) { c.beginPath(); c.moveTo(x, top - 25); c.lineTo(x + 2, top - 13); c.stroke(); } c.globalAlpha = 1;
  const ng = c.createLinearGradient(596, 0, 614, 0); ng.addColorStop(0, "#f0d27f"); ng.addColorStop(1, "#8a6a24"); c.fillStyle = ng; c.beginPath(); c.roundRect(596, top - 36, 16, 34, 5); c.fill();
  c.strokeStyle = "#6e531b"; c.globalAlpha = 0.5; for (let y = top - 32; y < top - 4; y += 3) { c.beginPath(); c.moveTo(598, y); c.lineTo(610, y); c.stroke(); } c.globalAlpha = 1;
  c.fillStyle = "#c9a043"; c.beginPath(); c.arc(498, top - 19, 6, 0, Math.PI * 2); c.fill();
  return L;
});

// the needle, and the working thread from its eye
const needle = (c: Ctx, tip: P, dir: P, colour: string, parked: boolean) => {
  const len = 52, back = add(tip, dir, -len), n: P = [-dir[1], dir[0]], tail = add(back, dir, -4);
  c.save(); c.lineCap = "round";
  const thread = parked ? [tail, add(tail, [-40, 30]), add(tail, [-10, 76]), add(tail, [-62, 96])] : [tail, add(add(tail, dir, -30), n, 18), add(add(tail, dir, -58), n, 8), add(add(tail, dir, -84), n, 30)];
  const th = smooth(thread, false, 10);
  c.globalAlpha = 0.3; c.strokeStyle = "#3b2c1c"; c.lineWidth = 2.4; c.beginPath(); th.forEach(([x, y], i) => (i ? c.lineTo(x + 2, y + 3) : c.moveTo(x + 2, y + 3))); c.stroke();
  c.globalAlpha = 1; c.strokeStyle = colour; c.lineWidth = 2; c.beginPath(); th.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  const seg = (a: P, b: P) => { c.globalAlpha = 0.35; c.strokeStyle = "#2b1d10"; c.lineWidth = 3; c.beginPath(); c.moveTo(a[0] + 2, a[1] + 3); c.lineTo(b[0] + 2, b[1] + 3); c.stroke(); c.globalAlpha = 1; c.strokeStyle = "#8d949a"; c.lineWidth = 2.6; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.strokeStyle = "#f5f7f8"; c.lineWidth = 0.9; c.beginPath(); c.moveTo(a[0] + n[0] * 0.6, a[1] + n[1] * 0.6); c.lineTo(b[0] + n[0] * 0.6, b[1] + n[1] * 0.6); c.stroke(); };
  if (parked) { seg(back, add(back, dir, 17)); seg(add(back, dir, 35), tip); }        // woven into the cloth: under three threads in the middle
  else seg(back, tip);
  c.globalAlpha = 1; c.fillStyle = "#3b3f42"; c.beginPath(); c.ellipse(back[0] + dir[0] * 4, back[1] + dir[1] * 4, 2.6, 0.7, Math.atan2(dir[1], dir[0]), 0, Math.PI * 2); c.fill();   // the eye
  c.restore();
};
const PARK: [P, P] = [[642, 742], [0.84, -0.54]];

export const drawEmbroidery = (ctx: Ctx, f: number, env: Env) => {
  const all = cached(env, "emb:timeline", () => timeline(build()));
  const [dw, dh] = DWH(env);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(ground(env).canvas as CanvasImageSource, 0, 0);
  // how far the hand has got: every stitch started by now, the newest one part-pulled
  let n = 0; while (n < all.length && all[n].f0 <= f) n++;
  const last = n ? all[n - 1] : null, p = last ? clamp((f - last.f0) / Math.max(0.01, last.f1 - last.f0)) : 1;
  const k = Math.floor(Math.max(0, n - 1) / STRIDE), base = checkpoint(env, all, k);
  const wkey = `emb:work:${env.scale}:${env.W}x${env.H}`, work = cached(env, wkey, () => env.canvas(dw, dh));
  work.ctx.setTransform(1, 0, 0, 1, 0, 0); if (base) { work.ctx.globalCompositeOperation = "copy"; work.ctx.drawImage(base.canvas as CanvasImageSource, 0, 0); work.ctx.globalCompositeOperation = "source-over"; } else work.ctx.clearRect(0, 0, dw, dh);
  drawRun(work, env, all.slice(k * STRIDE, n), p);
  ctx.drawImage(work.canvas as CanvasImageSource, 0, 0);
  ctx.drawImage(hoop(env).canvas as CanvasImageSource, 0, 0);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  if (f >= 505) {                                          // the last stitch is in: the needle goes into the cloth to wait, the thread left trailing
    const t = clamp((f - 505) / 5), from = last ? headOf(last, 1) : PARK[0], tip = lerpP(from, PARK[0], t * t * (3 - 2 * t));
    needle(ctx, tip, t >= 1 ? PARK[1] : [lerp(0.7, PARK[1][0], t), lerp(0.7, PARK[1][1], t)], GOLD, t >= 1);
  } else if (last) { const a = last.a, h = headOf(last, p), dir = last.k === "knot" ? ([0.7, 0.7] as P) : (() => { const d = Math.hypot(last.b[0] - a[0], last.b[1] - a[1]) || 1; return [(last.b[0] - a[0]) / d, (last.b[1] - a[1]) / d] as P; })(); needle(ctx, add(h, dir, last.k === "knot" ? 4 : 10), dir, last.c, false); }
  void mix; void polyLen;
};

export const embroidery: Film = {
  meta: { title: "A wreath and a bee · hand embroidery", W, H, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "stitching", start: 0, end: N, draw: drawEmbroidery }],
};

export const STYLE = { id: "embroidery", name: "Hand embroidery", family: "textile", medium: "stranded cotton floss stitched through natural plain-weave linen in a beech hoop", nearest: "fox", hero: "a botanical wreath with a honeybee" };
