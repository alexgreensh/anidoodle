import { Gfx, PENCIL, rng, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import { area, blob, body, clipped, fillShape, ink, lerpP, mix, profile, resample, smooth, type Body, type InkOpts } from "./gallery";
import { cut, part, stagger, streakClip, streaks } from "./koiDrawKit";

// KOI · marker comic. Bold cel fills with a hard shadow edge, one heavy confident contour that
// thickens away from the light, and a single dramatic C-curve for the whole fish.
//
// Anatomy, seen from above: a blunt snout with two pairs of barbels, eyes set on the sides of the
// head, gill covers, the body widest just behind the pectorals and tapering to a narrow caudal
// peduncle; big paddle pectorals (black at the base, "motoguro"), small pelvics mid-body, a
// dorsal fin running down the spine, and a long flowing caudal fin. Markings are Sanke-style:
// red "hi" patches on white with a few black "sumi" spots, placed in the body's own (t, s) frame
// so they bend with it. Light from the upper left.

const INK = "#15122a", LIGHT: P = [-0.62, -0.78];
const WATER = "#137582", WATER_D = "#0c5360", WATER_L = "#3aa6ad";
const WHITE = "#fdf8ee", WHITE_S = "#c9d6e0", HI = "#ec4a22", HI_S = "#b72c1a", SUMI = "#1b1830";
const FIN = "#f7efe4", FIN_S = "#d5dde2";

// THE PROCESS HOOK (koiDraw). drawKoi takes an optional clock: progress 0..1 for each (element,
// pass) of a marker comic being made: "pencil" lay-in, "flat" cel fills laid in marker streaks,
// "shade" hard shadow shapes, "detail" (scales, rays, gel-pen whites), "line" the heavy contour.
// With no clock every gate is 1 and every branch below takes the ORIGINAL call, byte for byte.
export type KoiClock = (el: string, pass: string) => number;
const ALL: KoiClock = () => 1;
// a flat laid by a chisel marker: draw fn only where the marker has been by p
const lay = (g: Gfx, p: number, shapes: P[][], fn: () => void, seed: number, w = 30, ang = -0.5, reach = 1e9) => {
  if (p >= 1) return fn(); if (p <= 0) return;
  const c = g.cur; c.save(); streakClip(c, streaks(shapes, w, ang, seed, reach), p); fn(); c.restore();
};
// the contour grows along its centreline; a closed one is drawn open until it closes
const inkP = (g: Gfx, center: P[], color: string, o: InkOpts, alpha: number | undefined, q: number) => {
  if (q >= 1) return alpha === undefined ? ink(g, center, color, o) : ink(g, center, color, o, alpha); if (q <= 0) return;
  const path = o.closed ? [...center, center[0]] : center, side = o.closed ? (area(center) > 0 ? -1 : 1) : o.side;
  ink(g, cut(path, q), color, { ...o, closed: false, side, taper: [o.closed ? 0.04 : (o.taper?.[0] ?? 0.12), 0.08] }, alpha ?? 1);
};

const koiBody = (): Body => body(
  [[300, 222], [404, 292], [502, 408], [556, 556], [534, 694], [468, 792]],
  profile([[0, 0], [0.012, 27], [0.035, 46], [0.08, 64], [0.16, 80], [0.27, 90], [0.4, 88], [0.55, 78], [0.7, 60], [0.82, 40], [0.92, 26], [1, 22]]),
);

// a fin in the body's frame: rays fan from a root between two edge points out to a rounded paddle
const fin = (root0: P, root1: P, tip: P, spread: number, bulge: number, seed: number, rays = 8): { shape: P[]; rays: P[][] } => {
  const r = rng(seed), mid = lerpP(root0, root1, 0.5), dx = tip[0] - mid[0], dy = tip[1] - mid[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const tipAt = (a: number): P => { const k = len * (1 - a * a * 0.34) * (0.985 + r() * 0.03); return [mid[0] + ux * k + nx * (a * spread + bulge * (1 - a * a)), mid[1] + uy * k + ny * (a * spread + bulge * (1 - a * a))]; };
  const tips = Array.from({ length: rays }, (_, i) => tipAt(-1 + (2 * i) / (rays - 1)));
  const edge: P[] = [];
  tips.forEach((t, i) => { edge.push(t); if (i < tips.length - 1) { const m = lerpP(t, tips[i + 1], 0.5); edge.push(lerpP(mid, m, 0.992)); } }); // the membrane sags only a touch between rays
  const shape = smooth([root0, ...edge, root1], true, 6);
  const out = tips.map((t, i) => { const base = lerpP(root0, root1, i / (rays - 1)); return smooth([base, lerpP(lerpP(base, t, 0.5), mid, -0.04), t], false, 6); });
  return { shape, rays: out };
};

// the caudal fin: a centreline that keeps turning at the body's own curvature, two long lobes
// either side of it that open out, wave, and part at a notch
const tail = (b: Body): { shape: P[]; rays: P[][] } => {
  const t1 = b.tan(1), t0 = b.tan(0.9), th0 = Math.atan2(t1[1], t1[0]), dTh = Math.atan2(t0[1] * t1[0] - t0[0] * t1[1], t0[0] * t1[0] + t0[1] * t1[1]);
  const kappa = (-dTh / 60) * 2.6, root = b.at(0.955, 0), line: P[] = [root], heads: number[] = [th0];
  for (let i = 1; i <= 26; i++) { const th = th0 + kappa * i * 10; heads.push(th); const q = line[i - 1]; line.push([q[0] + Math.cos(th) * 10, q[1] + Math.sin(th) * 10]); }
  const off = (i: number, w: number): P => { const th = heads[i]; return [line[i][0] - Math.sin(th) * w, line[i][1] + Math.cos(th) * w]; };
  const up = (i: number) => 22 + Math.pow(i / 26, 0.85) * 124 + Math.sin(i * 0.42) * 11, lo = (i: number) => 22 + Math.pow(i / 26, 1.0) * 104 + Math.sin(i * 0.47 + 2) * 10;
  const upper: P[] = [], lower: P[] = [];
  for (let i = 0; i <= 24; i++) { upper.push(off(i, up(i))); lower.push(off(Math.min(26, i + 2), -lo(Math.min(26, i + 2)))); }
  const notch = off(19, 14), edge = smooth([upper[24], lerpP(lerpP(upper[24], notch, 0.5), off(23, 60), 0.35), notch, lerpP(lerpP(lower[24], notch, 0.5), off(24, -44), 0.3), lower[24]], false, 8);
  const shape = [...upper, ...edge, ...[...lower].reverse()];
  const rays: P[][] = [];
  for (let k = 0; k <= 14; k++) { const f = k / 14, e = edge[Math.round(f * (edge.length - 1))], s0 = lerpP(off(0, 16), off(0, -16), f); rays.push(smooth([s0, lerpP(lerpP(s0, e, 0.5), line[12], 0.12), e], false, 8)); }
  return { shape, rays };
};

const water = (g: Gfx, k: KoiClock = ALL) => {
  const fl = k("water", "flat"), dt = k("water", "detail");
  g.group("plain", () => {
    const sq: P[] = [[0, 0], [1080, 0], [1080, 1080], [0, 1080]], b1 = blob(560, 540, 610, 470, 401, 0.1, 20, -0.75), b2 = blob(520, 520, 400, 290, 402, 0.12, 18, -0.9);
    lay(g, part(fl, 0, 3), [sq], () => fillShape(g, sq, WATER_D), 4001, 64, -0.62, 300);
    // the colourist's flats: a lit body of water through the middle, deep water in the corners
    lay(g, part(fl, 1, 3), [b1], () => fillShape(g, b1, WATER), 4002, 60, -0.62, 300);
    lay(g, part(fl, 2, 3), [b2], () => fillShape(g, b2, mix(WATER, WATER_L, 0.22)), 4003, 56, -0.62, 280);
    const r = rng(311);
    for (let i = 0; i < 12; i++) { const x = 60 + r() * 960, y = 60 + r() * 960, l = 70 + r() * 150, a = -0.42 + (r() - 0.5) * 0.12; const ln = smooth([[x, y], [x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + 3], [x + Math.cos(a) * l, y + Math.sin(a) * l]], false, 6); inkP(g, ln, WATER_L, { w: 5 + r() * 5, shadow: 0, taper: [0.4, 0.4], seed: 500 + i }, 0.45, part(dt, i, 12)); }
  });
};

export const padShape = (cx: number, cy: number, rr: number, notch: number, seed: number): P[] => {
  const r = rng(seed), rim: P[] = [];
  for (let i = 0; i <= 40; i++) { const a = notch + 0.2 + (i / 40) * (Math.PI * 2 - 0.4); rim.push([cx + Math.cos(a) * rr * (1 + (r() - 0.5) * 0.03), cy + Math.sin(a) * rr * 0.93 * (1 + (r() - 0.5) * 0.03)]); }
  return [[cx, cy], ...rim];
};
const lilyPad = (g: Gfx, cx: number, cy: number, rr: number, notch: number, seed: number, k: KoiClock = ALL, el = "pad") => {
  const pad = padShape(cx, cy, rr, notch, seed), rim = pad.slice(1);
  const fl = k(el, "flat"), sh = k(el, "shade"), dt = k(el, "detail"), ln = k(el, "line");
  g.group("plain", () => {
    const shadow = pad.map(([x, y]) => [x + 16, y + 22] as P);
    lay(g, sh, [shadow], () => fillShape(g, shadow, "#0a3f49", 0.55), seed + 71, 26, 0.9); // its shadow on the water
    const cel = () => { fillShape(g, pad, "#2f9a4f"); clipped(g, pad, () => { fillShape(g, pad.map(([x, y]) => [x - 20, y - 18] as P), "#56bb5c"); fillShape(g, blob(cx - rr * 0.35, cy - rr * 0.35, rr * 0.35, rr * 0.16, seed + 3, 0.2, 12, -0.6), "#9ee07f", 0.8); }); };
    if (sh >= 1) cel(); else { lay(g, fl, [pad], () => fillShape(g, pad, "#56bb5c"), seed + 72, 30, -0.5); lay(g, sh, [pad], cel, seed + 73, 24, 0.7); }
    for (let i = 0; i < 11; i++) { const a = notch + 0.35 + (i / 10) * (Math.PI * 2 - 0.7); inkP(g, smooth([[cx, cy], [cx + Math.cos(a) * rr * 0.5, cy + Math.sin(a) * rr * 0.46], [cx + Math.cos(a + 0.05) * rr * 0.9, cy + Math.sin(a + 0.05) * rr * 0.84]], false, 6), "#1c6a3a", { w: 2.4, seed: seed + i, shadow: 0, taper: [0.1, 0.5] }, 0.7, part(dt, i, 11)); }
    inkP(g, rim, INK, { w: 5.5, light: LIGHT, shadow: 0.9, seed: seed + 20, taper: [0.02, 0.02] }, undefined, part(ln, 0, 1.25));
    inkP(g, [rim[rim.length - 1], [cx, cy], rim[0]], INK, { w: 4.5, light: LIGHT, shadow: 0.9, seed: seed + 21, taper: [0.08, 0.08] }, undefined, stagger(ln, 0.8, 0.2));
  });
};

const waterLily = (g: Gfx, cx: number, cy: number, s: number, seed: number, kc: KoiClock = ALL, el = "lily") => {
  const r = rng(seed), fl = kc(el, "flat"), shd = kc(el, "shade"), dt = kc(el, "detail"), ln = kc(el, "line");
  let j = 0; // petals are laid in the order they stack: back row first
  const petal = (a: number, len: number, wid: number, col: string, sh: string, k: number) => {
    const tip: P = [cx + Math.cos(a) * len, cy + Math.sin(a) * len], nx = -Math.sin(a), ny = Math.cos(a);
    const shape = smooth([[cx + nx * 3, cy + ny * 3], [cx + Math.cos(a) * len * 0.45 + nx * wid, cy + Math.sin(a) * len * 0.45 + ny * wid], tip, [cx + Math.cos(a) * len * 0.45 - nx * wid, cy + Math.sin(a) * len * 0.45 - ny * wid], [cx - nx * 3, cy - ny * 3]], true, 6);
    const pf = part(fl, j, 21), ps = part(shd, j, 20), pl = part(ln, j, 21); j++;
    const cel = () => { fillShape(g, shape, sh); clipped(g, shape, () => fillShape(g, shape.map(([x, y]) => [x - 5 - nx * 4 * k, y - 6 - ny * 4 * k] as P), col)); };
    if (ps >= 1) cel(); else { lay(g, pf, [shape], () => fillShape(g, shape, col), seed + j * 7, 12, a + 1.57); lay(g, ps, [shape], cel, seed + j * 7 + 3, 10, a); }
    inkP(g, shape, INK, { w: 3.2, closed: true, light: LIGHT, shadow: 0.8, seed: seed + Math.round(a * 100) }, undefined, pl);
  };
  g.group("plain", () => {
    for (let i = 0; i < 8; i++) petal(i * 0.785 + 0.2 + (r() - 0.5) * 0.1, 70 * s, 22 * s, "#ffc3d6", "#e886a6", 1);
    for (let i = 0; i < 7; i++) petal(i * 0.9 + 0.55 + (r() - 0.5) * 0.1, 54 * s, 18 * s, "#ffe0ea", "#f2a2bd", -1);
    for (let i = 0; i < 5; i++) petal(i * 1.26 + 0.1, 34 * s, 13 * s, "#fff1f5", "#f6bfd0", 1);
    const eye = blob(cx, cy, 15 * s, 13 * s, seed + 9, 0.15, 12);
    lay(g, part(fl, 20, 21), [eye], () => fillShape(g, blob(cx, cy, 15 * s, 13 * s, seed + 9, 0.15, 12), "#ffcc2e"), seed + 90, 9, 0.3);
    inkP(g, blob(cx, cy, 15 * s, 13 * s, seed + 9, 0.15, 12), INK, { w: 2.6, closed: true, seed: seed + 10 }, undefined, part(ln, 20, 21));
    for (let i = 0; i < 14; i++) { const a = i * 0.45, d = 6 + (i % 3) * 3; if (part(dt, i, 14) >= 1) fillShape(g, blob(cx + Math.cos(a) * d * s, cy + Math.sin(a) * d * s, 2.2, 2.2, seed + 30 + i, 0.1, 8), "#c98a00"); }
  });
};

const ripples = (g: Gfx, cx: number, cy: number, seed: number, kc: KoiClock = ALL) => {
  // surface rings, broken where the light catches them: the one place the water shows its skin
  const r = rng(seed), dt = kc("ripples", "detail");
  g.group("plain", () => {
    [58, 104, 156].forEach((rad, k) => {
      let a = r() * 6;
      for (let s = 0; s < 5; s++) { const span = 0.55 + r() * 0.6, pts: P[] = []; for (let i = 0; i <= 12; i++) { const t = a + (i / 12) * span; pts.push([cx + Math.cos(t) * rad * 1.35, cy + Math.sin(t) * rad * 0.62]); } inkP(g, pts, "#d9fbf6", { w: 4.4 - k * 1.1, shadow: 0, taper: [0.3, 0.3], seed: seed + k * 10 + s }, 0.85 - k * 0.18, part(dt, k * 5 + s, 15)); a += span + 0.35 + r() * 0.5; }
    });
  });
};

// the lay-in, in non-photo blue: the gesture of the spine first, then the masses, then the parts
const BLUE = "#6b98cc";
const pencilLayIn = (g: Gfx, k: KoiClock, b: Body, fins: { shape: P[] }[], cau: { shape: P[] }, pads: P[][], lily: [number, number, number]) => {
  const fish = k("fish", "pencil"), pk = k("pads", "pencil"), lk = k("lily", "pencil");
  const n = b.outline.length / 2, left = b.outline.slice(0, n), right = b.outline.slice(n).reverse();
  const eyes = [-1, 1].map((sd) => { const e = b.at(0.085, sd * 0.8); return Array.from({ length: 9 }, (_, i) => [e[0] + Math.cos(i * 0.8) * 14, e[1] + Math.sin(i * 0.8) * 12] as P); });
  const fishStrokes: P[][] = [b.spine, left, right, cau.shape, ...fins.map((f) => f.shape), ...eyes];
  const padStrokes: P[][] = pads.map((p) => p.slice(1));
  const [lx, ly, ls] = lily, lilyStrokes: P[][] = [Array.from({ length: 15 }, (_, i) => [lx + Math.cos(i * 0.47) * 76 * ls, ly + Math.sin(i * 0.47) * 72 * ls] as P), ...Array.from({ length: 8 }, (_, i) => { const a = i * 0.785 + 0.2; return [[lx, ly], [lx + Math.cos(a) * 70 * ls, ly + Math.sin(a) * 70 * ls]] as P[]; })];
  g.group("ink", () => {
    const run = (list: P[][], p: number, seed: number) => list.forEach((s, i) => { const q = part(p, i, list.length); if (q > 0) g.pen(resample(s, Math.max(3, Math.min(40, Math.round(s.length / 5)))), { w: 1.25, color: BLUE, seed: seed + i, wobble: 1.8, opacity: 0.9, progress: q }); });
    run(fishStrokes, fish, 6100); run(padStrokes, pk, 6200); run(lilyStrokes, lk, 6300);
  });
};

export const drawKoi = (ctx: Ctx, _frame: number, env: Env, clock?: KoiClock) => {
  const g = new Gfx(ctx, env, 0, PENCIL), k = clock ?? ALL;
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  const b = koiBody();
  // pectorals on the outside of the curve spread wide; the inside one is tucked and foreshortened
  const pecR = fin(b.at(0.17, 0.9), b.at(0.285, 0.9), b.at(0.33, 2.85), 70, 16, 71, 9);
  const pecL = fin(b.at(0.18, -0.9), b.at(0.27, -0.9), b.at(0.35, -2.25), 44, -10, 72, 8);
  const pelR = fin(b.at(0.53, 0.9), b.at(0.6, 0.9), b.at(0.66, 1.95), 30, 6, 73, 6);
  const pelL = fin(b.at(0.54, -0.9), b.at(0.6, -0.9), b.at(0.67, -1.8), 26, -5, 74, 6);
  const cau = tail(b);
  const fins = [pecR, pecL, pelR, pelL];
  if (clock) { // the process only: a bare sheet of marker paper, and the lay-in on it
    ctx.fillStyle = "#fbf9f3"; ctx.fillRect(0, 0, 1080, 1080);
    pencilLayIn(g, k, b, fins, cau, [padShape(905, 205, 168, 2.3, 3100), padShape(890, 905, 120, 3.6, 3300), padShape(120, 640, 88, 0.2, 3400)], [880, 195, 1.15]);
  }
  water(g, k);

  // the fish's shadow on the pond floor, flat and hard, down-right away from the light
  const floor = [b.outline, cau.shape, ...fins.map((f) => f.shape)].map((s) => s.map(([x, y]) => [x + 30, y + 40] as P));
  g.group("plain", () => lay(g, k("floor", "shade"), floor, () => floor.forEach((s) => fillShape(g, s, "#083b45", 0.5)), 5001, 34, 0.9));

  // fins under the body: translucent, cel-shaded, a black base on the pectorals
  g.group("plain", () => {
    fins.forEach((f, i) => {
      const el = `fin${i}`, fl = k(el, "flat"), sh = k(el, "shade"), dt = k(el, "detail"), ln = k(el, "line");
      const moto = () => { if (i < 2) fillShape(g, blob(...(i === 0 ? b.at(0.25, 1.35) : b.at(0.245, -1.25)), i === 0 ? 46 : 32, i === 0 ? 30 : 22, 80 + i, 0.2, 12, i === 0 ? 1.0 : -0.8), SUMI, 0.95); }; // motoguro: black at the base of the pectorals
      const cel = () => { fillShape(g, f.shape, FIN_S, 0.88); clipped(g, f.shape, () => { fillShape(g, f.shape.map(([x, y]) => [x - 9, y - 11] as P), FIN, 0.92); moto(); }); };
      if (sh >= 1) cel();
      else { lay(g, part(fl, 0, 2), [f.shape], () => fillShape(g, f.shape, FIN, 0.92), 5100 + i, 18, -0.9); lay(g, part(fl, 1, 2), [f.shape], () => clipped(g, f.shape, moto), 5110 + i, 14, -0.9); lay(g, sh, [f.shape], cel, 5120 + i, 13, 0.7); }
      f.rays.forEach((ray, kk) => inkP(g, ray, mix(INK, FIN_S, 0.35), { w: 1.7, shadow: 0, taper: [0.05, 0.5], seed: 900 + i * 40 + kk }, 0.75, part(dt, kk, f.rays.length)));
      inkP(g, f.shape, INK, { w: 4.2, closed: true, light: LIGHT, shadow: 0.85, seed: 700 + i * 7 }, undefined, ln);
    });
  });

  // the body: shade cel underneath, the lit white pushed toward the light, then the markings
  const bs = b.outline, bsL = bs.map(([x, y]) => [x + LIGHT[0] * 22, y + LIGHT[1] * 22] as P);
  const bfl = k("body", "flat"), bsh = k("body", "shade");
  g.group("plain", () => {
    if (bsh >= 1) fillShape(g, bs, WHITE_S);
    else { lay(g, bfl, [bs], () => fillShape(g, bs, WHITE), 5201, 34, -0.35); lay(g, bsh, [bs], () => { fillShape(g, bs, WHITE_S); clipped(g, bs, () => fillShape(g, bsL, WHITE)); }, 5202, 24, 0.62); }
    clipped(g, bs, () => {
      if (bsh >= 1) fillShape(g, bsL, WHITE);
      // red hi: head crown, a saddle across the back, a patch toward the tail. Crisp back edges.
      const hf = k("hi", "flat"), hs = k("hi", "shade");
      const patches: [number, number, number, number, number][] = [[0.105, -0.05, 0.075, 0.95, 11], [0.36, -0.25, 0.1, 1.2, 12], [0.47, 0.35, 0.07, 0.9, 13], [0.66, -0.1, 0.085, 1.15, 14], [0.82, 0.3, 0.05, 0.9, 15]];
      patches.forEach(([t, s, dt, ds, seed], pi) => {
        const r = rng(seed * 17), pts: P[] = [];
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, kk = 0.8 + r() * 0.35; pts.push(b.at(t + Math.cos(a) * dt * kk, s + Math.sin(a) * ds * kk)); }
        const sh = smooth(pts, true, 6), ps = part(hs, pi, 5);
        const cel = () => { fillShape(g, sh, HI_S); clipped(g, sh, () => fillShape(g, bsL, HI)); };
        if (ps >= 1) cel(); else { lay(g, part(hf, pi, 5), [sh], () => fillShape(g, sh, HI), 5300 + pi, 24, -0.35); lay(g, ps, [sh], cel, 5310 + pi, 18, 0.62); }
      });
      // sumi: a few black spots, never on the head
      const sf = k("sumi", "flat");
      ([[0.3, 0.55, 0.028, 0.32, 31], [0.55, -0.55, 0.03, 0.3, 32], [0.61, 0.42, 0.018, 0.22, 33], [0.78, -0.2, 0.026, 0.4, 34], [0.43, 0.02, 0.016, 0.18, 35]] as number[][]).forEach(([t, s, dt, ds, seed], si) => {
        const r = rng(seed), pts: P[] = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, kk = 0.8 + r() * 0.4; pts.push(b.at(t + Math.cos(a) * dt * kk, s + Math.sin(a) * ds * kk)); }
        const sp = smooth(pts, true, 5); lay(g, part(sf, si, 5), [sp], () => fillShape(g, sp, SUMI), 5400 + si, 12, -0.3);
      });
      // scales: a loose lattice of arcs, strongest on the lit back, gone into the shade
      const r = rng(55), sc = k("scales", "detail");
      for (let t = 0.2; t < 0.93; t += 0.034) for (let s = -0.75; s <= 0.8; s += 0.3) {
        const tt = t + (Math.round(s / 0.3) % 2 ? 0.017 : 0), ss = s + (r() - 0.5) * 0.06, p = b.at(tt, ss), q = b.at(tt + 0.014, ss - 0.13), u = b.at(tt + 0.014, ss + 0.13), m = b.at(tt + 0.022, ss);
        const lit = ss < 0.35 && !(r() < 0.3);
        if (lit) inkP(g, smooth([q, m, u], false, 5), "#2a1f3a", { w: 1.5, shadow: 0, taper: [0.3, 0.3], seed: 2000 + Math.round(t * 1000 + s * 50) }, 0.28, stagger(sc, ((tt - 0.2) / 0.75) * 0.85, 0.15));
        void p;
      }
      // the wet highlight along the back, and a glint on the head
      const hl = k("gloss", "detail");
      [[0.2, 0.3, -0.6, 7], [0.335, 0.42, -0.64, 6], [0.46, 0.5, -0.66, 4.5], [0.58, 0.6, -0.66, 3]].forEach(([t0, t1, sv, w], kk) => { const pts: P[] = []; for (let i = 0; i <= 8; i++) pts.push(b.at(t0 + ((t1 - t0) * i) / 8, sv)); inkP(g, pts, "#ffffff", { w, shadow: 0, taper: [0.35, 0.45], seed: 1800 + kk }, 0.9, part(hl, kk, 5)); });
      const glint = blob(...b.at(0.075, -0.35), 22, 9, 91, 0.1, 10, -0.7);
      lay(g, part(hl, 4, 5), [glint], () => fillShape(g, blob(...b.at(0.075, -0.35), 22, 9, 91, 0.1, 10, -0.7), "#ffffff", 0.85), 5501, 8, 0);
    });
    // dorsal fin down the spine: a narrow flutter of translucent fin with ray ticks
    const df: P[] = [], dfr: P[] = [];
    for (let i = 0; i <= 16; i++) { const f = i / 16, t = 0.36 + f * 0.3, h = Math.pow(Math.sin(Math.min(1, f * 2.6) * Math.PI / 2), 1.2) * (1 - f * 0.78); df.push(b.at(t, 0.0)); dfr.push(b.at(t + 0.04 * h, h * 0.72 + Math.sin(i * 1.4) * 0.02 * h)); }
    const dorsal = [...smooth(df, false, 3), ...smooth(dfr, false, 3).reverse()], dsh = dorsal.map(([x, y]) => [x + 6, y + 8] as P);
    const dfl = k("dorsal", "flat"), dsd = k("dorsal", "shade"), ddt = k("dorsal", "detail"), dln = k("dorsal", "line");
    lay(g, dsd, [dsh], () => fillShape(g, dsh, "#2a1f3a", 0.18), 5601, 10, 0.4); // the fin's own shadow on the back
    const dcel = () => { fillShape(g, dorsal, FIN_S, 0.95); clipped(g, dorsal, () => fillShape(g, dorsal.map(([x, y]) => [x - 6, y - 7] as P), FIN, 0.95)); };
    if (dsd >= 1) dcel(); else { lay(g, dfl, [dorsal], () => fillShape(g, dorsal, FIN, 0.95), 5602, 10, 0.3); lay(g, dsd, [dorsal], dcel, 5603, 9, -0.6); }
    for (let i = 1; i < 16; i += 2) inkP(g, [df[i], lerpP(df[i], dfr[i], 0.5), dfr[i]], mix(INK, FIN_S, 0.4), { w: 1.4, shadow: 0, taper: [0.1, 0.5], seed: 1300 + i }, 0.7, part(ddt, (i - 1) / 2, 8));
    inkP(g, dorsal, INK, { w: 3.4, closed: true, light: LIGHT, shadow: 0.8, seed: 1400 }, undefined, dln);

    // head: gill covers, eyes set into the sides, nostrils, barbels
    const hln = k("head", "line"), efl = k("eyes", "flat"), edt = k("eyes", "detail");
    [-1, 1].forEach((sd) => {
      const hi = sd < 0 ? 0 : 1;
      const gill: P[] = []; for (let i = 0; i <= 6; i++) gill.push(b.at(0.155 - Math.sin((i / 6) * Math.PI) * 0.03, sd * (0.98 - i * 0.1)));
      inkP(g, gill, INK, { w: 3.4, shadow: 0, taper: [0.08, 0.7], seed: 1500 + sd }, undefined, part(hln, hi * 4, 8));
      const e = b.at(0.085, sd * 0.8), ew = sd > 0 ? 12 : 10, iris = blob(e[0], e[1], ew + 3, ew, 1600 + sd, 0.05, 12);
      lay(g, part(efl, hi * 2, 4), [iris], () => fillShape(g, blob(e[0], e[1], ew + 3, ew, 1600 + sd, 0.05, 12), "#e6cf8c"), 5700 + hi, 7, 0.3);
      lay(g, part(efl, hi * 2 + 1, 4), [iris], () => fillShape(g, blob(e[0] + 1, e[1] + 1, ew * 0.78, ew * 0.74, 1610 + sd, 0.05, 12), "#1a1427"), 5710 + hi, 6, -0.3);
      if (part(edt, hi * 2, 4) >= 1) fillShape(g, blob(e[0] - 3, e[1] - 4, 3.2, 2.6, 1620 + sd, 0.05, 8), "#ffffff");
      inkP(g, blob(e[0], e[1], ew + 3, ew, 1600 + sd, 0.05, 12), INK, { w: 3, closed: true, light: LIGHT, shadow: 0.7, seed: 1630 + sd }, undefined, part(hln, hi * 4 + 1, 8));
      if (part(edt, hi * 2 + 1, 4) >= 1) fillShape(g, blob(...b.at(0.03, sd * 0.36), 4, 3, 1640 + sd, 0.1, 8), "#3a1e22");
      const m = b.at(0.006, sd * 0.5), m2 = b.at(-0.02, sd * 1.2), m3 = b.at(-0.035, sd * 1.9);
      inkP(g, smooth([m, lerpP(m2, b.at(-0.01, sd * 1.1), 0.5), m3], false, 8), INK, { w: 3, shadow: 0, taper: [0.02, 0.9], seed: 1650 + sd }, undefined, part(hln, hi * 4 + 2, 8));
      const k0 = b.at(0.02, sd * 0.78), k1 = b.at(0.0, sd * 1.25);
      inkP(g, smooth([k0, lerpP(k0, k1, 0.5), k1], false, 6), INK, { w: 2.4, shadow: 0, taper: [0.02, 0.9], seed: 1660 + sd }, undefined, part(hln, hi * 4 + 3, 8));
    });
  });
  // the tail goes on over the body's end, so fin and peduncle are one continuous piece
  const tf = k("tail", "flat"), tsd = k("tail", "shade"), tdt = k("tail", "detail"), tln = k("tail", "line"), bln = k("body", "line");
  g.group("plain", () => {
    const tcel = () => { fillShape(g, cau.shape, FIN_S, 0.9); clipped(g, cau.shape, () => fillShape(g, cau.shape.map(([x, y]) => [x - 10, y - 12] as P), FIN, 0.93)); };
    if (tsd >= 1) tcel(); else { lay(g, tf, [cau.shape], () => fillShape(g, cau.shape, FIN, 0.93), 5801, 22, 0.35); lay(g, tsd, [cau.shape], tcel, 5802, 16, -0.8); }
    cau.rays.forEach((ray, kk) => inkP(g, ray, mix(INK, FIN_S, 0.35), { w: 1.7, shadow: 0, taper: [0.05, 0.5], seed: 1100 + kk }, 0.72, part(tdt, kk, cau.rays.length)));
    const n = b.outline.length / 2, L = b.outline.slice(0, n), R = b.outline.slice(n).reverse(), cut = Math.round(n * 0.965);
    const open = [...L.slice(0, cut).reverse(), ...R.slice(0, cut)];
    inkP(g, open, INK, { w: 6.4, light: LIGHT, shadow: 0.95, seed: 1700, side: -1, taper: [0.06, 0.06], min: 0.3 }, undefined, bln);
    const tailEdge = cau.shape.slice(3, cau.shape.length - 3);
    inkP(g, tailEdge, INK, { w: 4.4, light: LIGHT, shadow: 0.85, seed: 1710, side: -1, taper: [0.04, 0.04], min: 0.3 }, undefined, tln);
  });

  ripples(g, 300, 196, 2100, k);
  lilyPad(g, 905, 205, 168, 2.3, 3100, k, "pad0");
  waterLily(g, 880, 195, 1.15, 3200, k);
  lilyPad(g, 890, 905, 120, 3.6, 3300, k, "pad1");
  lilyPad(g, 120, 640, 88, 0.2, 3400, k, "pad2");
  g.paper("paper", 0.05);
};

export const koi: Film = {
  meta: { title: "Koi · marker comic", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "koi", start: 0, end: 1, draw: drawKoi }],
};
