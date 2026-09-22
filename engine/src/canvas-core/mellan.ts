import { fractal, rng, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import { clamp } from "./gallery";

// MELLAN SPIRAL · a lit moon. Claude Mellan's 1649 "Sudarium of Saint Veronica" is one unbroken
// engraved line, a spiral starting at the tip of the nose, whose weight alone makes the picture:
// the burin swells where the plate should print dark and runs to a hair where it should be light.
//
// This is that technique, asset-free. There is no source image: `tone(x, y)` is a procedural
// field (a sphere lit from the upper left, seeded maria, craters with a lit rim and a shadowed
// floor, earthshine on the night side, a dark engraved sky), and ONE Archimedean spiral is walked
// out from the centre, its width set at every step from the local tone. The whole picture is a
// single filled ribbon: one continuous stroke, never lifted.

const W = 1080, C: P = [540, 540], PLATE = 46;   // the copper plate's edge; nothing outside it prints
const PITCH = 6.2;                     // distance between neighbouring turns, px
const MOON_R = 380, MOON_C: P = [548, 526];
const LIGHT = (() => { const v = [-0.66, -0.52, 0.54]; const l = Math.hypot(...v); return v.map((x) => x / l); })();
const L2 = (() => { const l = Math.hypot(LIGHT[0], LIGHT[1]); return [LIGHT[0] / l, LIGHT[1] / l]; })();
const INKC = "#17130f", PAPER = "#f2ead8";
const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

type Crater = { u: number; v: number; r: number; depth: number; rays: boolean };
const craters: Crater[] = (() => {
  const r = rng(4411), out: Crater[] = [];
  for (let i = 0; i < 30; i++) out.push({ u: (r() - 0.5) * 2.2, v: (r() - 0.5) * 1.9, r: 0.065 + Math.pow(r(), 2) * 0.2, depth: 0.6 + r() * 0.4, rays: false });
  out.push({ u: -0.28, v: 0.52, r: 0.075, depth: 1, rays: true });   // one young crater throwing bright rays, the way Tycho does
  return out;
})();

// brightness of the plate at (x, y): 0 = print black, 1 = paper
export const tone = (x: number, y: number): number => {
  const dx = (x - MOON_C[0]) / MOON_R, dy = (y - MOON_C[1]) / MOON_R, d2 = dx * dx + dy * dy;
  const sky = 0.09 + 0.05 * fractal(91, x, y, 0.004, 0.004, 3);
  if (d2 >= 1) {
    const dd = Math.sqrt(d2), lit = clamp(-(dx * L2[0] + dy * L2[1]) / dd + 0.35);
    return clamp(sky + Math.exp(-(dd - 1) * 7) * 0.2 * lit);         // the moon lightens the sky a little at its lit limb
  }
  const z = Math.sqrt(1 - d2), u = Math.atan2(dx, z), v = Math.asin(clamp(dy, -1, 1));
  // albedo: dark maria are big soft-edged basins, the highlands bright
  const m = fractal(207, u * 60 + 200, v * 60 + 200, 0.016, 0.016, 4);
  let alb = 0.96 - 0.4 * smoothstep(0.44, 0.66, m) - 0.08 * fractal(208, u * 60, v * 60, 0.09, 0.09, 2);
  const lam = Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + z * LIGHT[2]);
  let shade = Math.pow(lam, 0.72);
  // craters: a shadow crescent inside the rim on the side FACING the light (the near wall hides
  // the floor), the far wall lit, a bright rim toward the light. Strongest near the terminator,
  // where the low sun throws the longest shadows.
  const low = 0.7 + 0.3 * (1 - smoothstep(0.15, 0.85, lam));   // craters read everywhere, longest shadows near the terminator
  for (const c of craters) {
    const du = (u - c.u) / c.r, dv = (v - c.v) / c.r, q = Math.sqrt(du * du + dv * dv);
    if (c.rays && q < 9) { const ang = Math.atan2(dv, du), ray = Math.pow(Math.abs(Math.sin(ang * 5.5 + 0.7)), 18) + Math.pow(Math.abs(Math.sin(ang * 3.2 + 2)), 30); alb += 0.22 * ray * Math.exp(-q * 0.28) * (q > 1.3 ? 1 : 0); }
    if (q > 1.4) continue;
    const toward = q > 1e-6 ? (du * L2[0] + dv * L2[1]) / q : 0;         // +1 on the side of the crater nearest the light
    if (q < 1) { const crescent = smoothstep(-0.2, 0.5, toward) * smoothstep(0.2, 0.9, q + 0.25); shade *= 1 - 0.85 * c.depth * low * crescent; shade *= 1 + 0.3 * c.depth * smoothstep(0.1, 0.7, -toward) * low; alb -= (c.r > 0.15 ? 0.14 : 0.05) * c.depth; }
    else { const rim = 1 - smoothstep(1, 1.4, q); alb += 0.12 * c.depth * rim * smoothstep(-0.2, 0.6, toward); shade *= 1 - 0.45 * c.depth * rim * smoothstep(0, 0.7, -toward) * low; }
  }
  const limb = Math.pow(1 - z, 3) * 0.3 * clamp(-(dx * L2[0] + dy * L2[1]) * 2);
  const earthshine = 0.24 + 0.06 * alb;
  return clamp(earthshine + (1 - earthshine) * clamp(shade) * clamp(alb) + limb);
};

// Walk ONE Archimedean spiral r = a*theta outward from the centre in near-constant arc steps,
// and turn it into a single ribbon whose half-width comes from the tone underneath. The walk is
// a pure function of nothing but the constants above, so it is done ONCE and cached; a frame of
// the unspooling film takes a prefix of it. (Re-walking and re-shading 70,000 steps every frame
// put the animation over its draw budget on half its frames.)
export type Ribbon = { L: P[]; R: P[]; ink: number[]; th: number[]; base: number[] };   // ink[k]: how much ink the line has laid by step k; th[k]: its spiral angle; base: the indices of the still's own samples
// maxStep caps the angle per step. The still never needs it (Infinity); the unspooling film opens
// at ~60x on the first turns, where 1.4 px chords around a 3 px circle show as polygon corners.
// It SUBDIVIDES between the still's own samples rather than re-walking, so every vertex past the
// first turns is the still's exact vertex, and the finished film frame can be the still itself.
const walk = (maxStep = Infinity): Ribbon => {
  const a = PITCH / (Math.PI * 2), rMax = Math.hypot(W / 2, W / 2) + PITCH, thMax = rMax / a;
  const L: P[] = [], R: P[] = [], ink: number[] = [], ths: number[] = [], base: number[] = [];
  let laid = 0;
  let th = 0.6;
  while (th < thMax) {
    const step = 1.4 / Math.max(a * th, 1.4), m = Math.max(1, Math.ceil(step / maxStep));   // ~1.4 px of line per step
    for (let j = 0; j < m; j++) {
      if (!j) base.push(L.length);
      const t = j ? th + (step * j) / m : th;
      const r = a * t, x = C[0] + Math.cos(t) * r, y = C[1] + Math.sin(t) * r;
      // outward normal of the spiral ~ radial; its weight is the engraver's only variable
      const dark = 1 - tone(x, y), grow = Math.min(1, r / 40);           // the first turns open gently from a point
      const w = PITCH * (0.05 + 0.86 * dark) * grow / 2;
      const tx = -Math.sin(t) * r + Math.cos(t) * a, ty = Math.cos(t) * r + Math.sin(t) * a, tl = Math.hypot(tx, ty), nx = ty / tl, ny = -tx / tl;
      L.push([x + nx * w, y + ny * w]); R.push([x - nx * w, y - ny * w]);
      const onPlate = x > PLATE && x < W - PLATE && y > PLATE && y < W - PLATE;
      laid += onPlate ? (2 * w * 1.4) / m : 0; ink.push(laid); ths.push(t);  // ink that lands OFF the plate is cut away by the clip: it must not cost the film any time
    }
    th += step;
  }
  return { L, R, ink, th: ths, base };
};
export const SPIRAL_A = PITCH / (Math.PI * 2);                          // r = SPIRAL_A * theta
export const ribbon = (cache?: Map<string, unknown>, maxStep = Infinity): Ribbon => {
  const key = `mellan:ribbon:${PITCH}:${MOON_R}:${maxStep}`;               // everything the ribbon depends on is a constant of this module
  let rb = cache?.get(key) as Ribbon | undefined;
  if (!rb) { rb = walk(maxStep); cache?.set(key, rb); }
  return rb;
};
// the closed outline of the first k steps: out along one edge, back along the other
export const outline = (rb: Ribbon, k: number): P[] => [...rb.L.slice(0, k), ...rb.R.slice(0, k).reverse()];
// the still's finished outline, taken from a subdivided ribbon without walking again
export const stillOutline = (rb: Ribbon): P[] => [...rb.base.map((i) => rb.L[i]), ...rb.base.map((i) => rb.R[i]).reverse()];
export const spiral = (progress = 1, cache?: Map<string, unknown>): P[] => {
  const rb = ribbon(cache);
  // progress is a fraction of the INK, not of the length: a hairline across the bright face adds
  // almost nothing to look at, so equal length per frame would be dead air. Equal ink per frame
  // means the burin races through the light and slows where it cuts deep, as a real one does.
  const n = rb.ink.length, want = rb.ink[n - 1] * clamp(progress);
  let k = n; if (progress < 1) { let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (rb.ink[m] < want) lo = m + 1; else hi = m; } k = Math.max(2, lo + 1); }
  return outline(rb, k);
};

// Print a ribbon outline (null = the clean, uninked plate) through a camera that looks at the
// spiral's centre with magnification `zoom` (1 = the whole plate, exactly the still's framing).
export const printPlate = (ctx: Ctx, env: Env, rib: P[] | null, zoom = 1) => {
  const s = env.scale * zoom, o = (1 - zoom) * C[0] * env.scale;
  ctx.setTransform(s, 0, 0, s, o, o);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, W);
  ctx.save();
  ctx.beginPath(); ctx.rect(PLATE, PLATE, W - 2 * PLATE, W - 2 * PLATE); ctx.clip();   // the plate: the spiral prints only inside it
  if (rib) {
    ctx.fillStyle = INKC; ctx.beginPath();
    rib.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // the plate mark: the copper's bevelled edge pressed into damp paper, a hair of shadow on two sides
  ctx.strokeStyle = "rgba(60,45,30,0.28)"; ctx.lineWidth = 2; ctx.strokeRect(40, 40, W - 80, W - 80);
  ctx.strokeStyle = "rgba(255,252,240,0.7)"; ctx.lineWidth = 1.2; ctx.strokeRect(38.5, 38.5, W - 80, W - 80);
};
export const drawMellan = (ctx: Ctx, frame: number, env: Env, progress = 1) => { void frame; printPlate(ctx, env, spiral(progress, env.cache)); };

export const mellan: Film = {
  meta: { title: "Mellan spiral · a lit moon", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "moon", start: 0, end: 1, draw: (ctx, f, env) => drawMellan(ctx, f, env, 1) }],
};
