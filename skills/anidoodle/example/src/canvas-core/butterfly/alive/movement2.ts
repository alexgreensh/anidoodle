// MOVEMENT 2, "ALIVE", all 1260 frames. One shot, no cuts: every change of scale is a camera
// move and every big move is released by a take-off. The whole movement is a pure function of the
// local frame, and every frame number it uses comes from `cues.ts`.
//
// The movement crosses two camera conventions. Stages M to R live in the NEAR world, in plate
// units, where the sheet is 1080 units across and the ranunculus clump grows beside it. Stages F
// and W live in the FINALE world, which is the approved destination's own coordinate system and
// carries the sky, the hills, the far field, the footpath and the signature. The handover is a
// 60-frame DISSOLVE under the climb out of the clump, which is the only place in the movement
// where two renderings of the same meadow are on screen at once. It is not a cut: nothing jumps,
// the camera keeps pulling back through it, and it is over before the hills arrive.
import { Ctx, Env, Gfx, Layer, P, PENCIL } from "../../core";
import { CX, CY, HEAD, THORAX, cen, lerp } from "../geom";
import { FULL, PlateState, drawPlate } from "../plate";
import { PAPER_F } from "../finale/compose";
import { Cam as FCam, projector as fprojector } from "../finale/world";
import { farField, footpath, grassBlades, grassWash, hills, sky } from "../finale/scene";
import { Drift, drift, flower } from "../finale/flora";
import { blueprintSheet } from "../finale/sheet";
import { clearCorner, signature } from "./sign";
import { clump as grassClump } from "../finale/paint";
import { GRASS_LIT, GRASS_MID, GRASS_SHADE } from "../finale/world";
import { APPROACH, CORNER_LIFT, DING, FANS, GUSTS, HOVER, LANDINGS, M0, PANEL2_HOME, SEED_FLUFF, SIGNATURE, SIPS, STIR, TAKEOFFS, WHITES } from "./cues";
import { Cam, projector, scaleOf } from "./view";
import { drop, frontRim, wetnessAt } from "./water";
import { ALL_WET, Flight, dilate, mapper, paintCreature, wingsOf } from "./wingpaint";
import { CLUMP, GROUND, R_LOOK, backGrass, backdrop, drawClump, fringe, nod, seedFluff } from "./meadow2";
import { PAINTS } from "./ranunculus";

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const ramp = (f: number, a: number, b: number) => ease(clamp((f - a) / (b - a)));
const HANDOVER: [number, number] = [575, 630]; // the dissolve out of the near world, under the climb

// ---------------------------------------------------------------- the camera spine (near world)
// Authored on bars. Stages M to R: it starts on the wing root, drifts across the thorax, then
// follows the creature off the sheet and over to the clump, where it settles and only creeps.
const LOOK: [number, P][] = [
  [0, M0], [120, [626, 382]], [200, [590, 440]], [240, [560, 500]], [270, [545, 535]],
  [285, [600, 520]], [320, [1080, 420]], [345, R_LOOK], [450, [1820, 262]], [540, [1700, 300]],
  [585, [1800, 220]], [640, [2400, 60]], [700, [3100, -140]],
];
const lookAt = (f: number): P => {
  let i = 0; while (i < LOOK.length - 2 && f > LOOK[i + 1][0]) i++;
  const [f0, a] = LOOK[i], [f1, b] = LOOK[i + 1], t = ease(clamp((f - f0) / (f1 - f0)));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
};
export const camAt = (f: number): Cam => ({ S: scaleOf(f), look: lookAt(f) });

// ---------------------------------------------------------------- the creature, beat by beat
// Stepped on the tick until 180, blending to continuous across the bar to 240, then free.
const poseAt = (f: number): Flight => {
  if (f < STIR.gears) return { pose: { flap: 1, sweep: 0 }, heading: 0, pitch: 1, bank: 0 };
  if (f < 180) { /* the gears catch, the antennae quiver, then a BREATH: one side leads */
    const n = Math.floor(f / 5), step = (n % 2 ? 0.012 : -0.008);
    const br = f >= STIR.breath ? Math.sin(((f - STIR.breath) / 30) * Math.PI) * 0.14 : 0;
    return { pose: { flap: 1 - br + step, sweep: step * 0.4 }, heading: 0, pitch: 1, bank: 0.03 + br * 0.4 };
  }
  if (f < 240) { /* three fans, opening wider each time, easing from hard-out to in and out */
    let flap = 1;
    FANS.forEach(([at, len, floor]) => { if (f >= at && f < at + len * 2) { const u = (f - at) / (len * 2); flap = Math.min(flap, 1 - (1 - floor) * Math.sin(u * Math.PI)); } });
    const u = clamp((f - 180) / 60), stepped = Math.floor(f / 5) % 2 ? 0.01 : -0.01;
    return { pose: { flap: flap + stepped * (1 - u), sweep: -0.02 * (1 - flap) }, heading: 0, pitch: 1 - 0.04 * (1 - flap), bank: 0.06 + 0.1 * (1 - flap) };
  }
  const cyc = f < 345 ? 10 : 30, ph = ((f - 240) % cyc) / cyc, flap = 0.62 + 0.38 * Math.cos(ph * Math.PI * 2);
  return { pose: { flap, sweep: -0.03 * (1 - flap) }, heading: 0, pitch: 0.92, bank: 0.07 + 0.05 * Math.sin(f * 0.11) };
};

// Where it is, in NEAR-WORLD units, from the take-off to the climb out of the clump. Hand-authored
// with detours: a butterfly never flies a straight line and never a clean sine.
const hostOf = (id: string) => CLUMP.find((c) => c.id === id)!;
const perchPoint = (id: string): P => { const h = hostOf(id); return [h.at[0] + h.R * 0.42, h.at[1] - h.R * 0.52]; };
const bob = (f: number, amp: number): number => Math.sin(f * 0.42) * amp;
export const whereAt = (f: number): { at: P; perched: boolean; on: string } => {
  if (f < 240) return { at: [CX, CY], perched: false, on: "" };
  if (f < 360) { /* off the sheet, up and right, with a detour: it is not going anywhere in particular yet */
    const t = ease(clamp((f - 240) / 120)), a: P = [CX, CY], b = perchPoint("R1");
    return { at: [a[0] + (b[0] - a[0]) * t + Math.sin(t * Math.PI * 1.6) * 210, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 420 + bob(f, 12)], perched: false, on: "" };
  }
  const legs: [number, number, string, string][] = [[360, 420, "R1", "R1"], [420, 450, "R1", "R2"], [450, 525, "R2", "R2"], [525, 540, "R2", "R3"], [540, 585, "R3", "R3"], [585, 645, "R3", ""]];
  for (const [a, b, from, to] of legs) {
    if (f < a || f >= b) continue;
    if (from === to) return { at: perchPoint(from), perched: true, on: from };
    const t = ease(clamp((f - a) / (b - a))), p = perchPoint(from), q = to ? perchPoint(to) : [p[0] + 900, p[1] - 1400] as P;
    const detour = Math.sin(t * Math.PI) * (to === "R2" ? 180 : to === "R3" ? -260 : 150);
    return { at: [p[0] + (q[0] - p[0]) * t + detour, p[1] + (q[1] - p[1]) * t - Math.sin(t * Math.PI) * 170 + bob(f, 9)], perched: false, on: "" };
  }
  const t = clamp((f - 645) / 90), p = perchPoint("R3");
  return { at: [p[0] + 1400 * t, p[1] - 2100 * t], perched: false, on: "" };
};

// ---------------------------------------------------------------- the sheet, as a world object
// The plate is drawn ONCE at 1:1 into its own surface with the butterfly-shaped BLANK knocked out
// of it, and from then on it is only ever downscaled and foreshortened onto the frame. Never
// scaled up: that is the rule, and it is also why the blank keeps the drawing's own edge.
const BLANK = "#e8e3d2";
const sheetLayer = (env: Env, blank: boolean): Layer => {
  const key = `alive:sheet:${blank}`, dw = Math.round(env.W * env.scale), dh = Math.round(env.H * env.scale);
  let L = env.cache.get(key) as Layer | undefined;
  if (L) return L;
  L = env.canvas(dw, dh);
  const st: PlateState = { wings: { flap: 1, sweep: 0 }, lift: 0, keyY: 0, keyTurn: 0, train: { centre: 0, third: 0, pinion: 0, escape: 0, fork: 0 }, shadow: [0, 0], boil: 0, inkedBoil: 0, boilIndex: 0, p: FULL, view: { cx: 540, cy: 540, zoom: 1 } };
  drawPlate(L.ctx, env, st);
  if (blank) knockOut(new Gfx(L.ctx, env, 0, PENCIL), (p: P) => p);
  env.cache.set(key, L);
  return L;
};
// the creature's own silhouette, lifted clean out of the plate: the drawing went with it
export const knockOut = (g: Gfx, T: (p: P) => P) => {
  const W = wingsOf({ pose: { flap: 1, sweep: 0 }, heading: 0, pitch: 1, bank: 0 });
  W.forEach((wg) => g.fill(dilate(wg.out, 4).map(T), BLANK, 0.97));
  g.fill(dilate(THORAX, 5).map(T), BLANK, 0.97);
  g.fill(dilate(HEAD, 4).map(T), BLANK, 0.97);
  const abd: P[] = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6, hw = 23 * (1 - t) ** 0.8 + 6.5; abd.push(T([CX + hw * 0.9, CY + (70 + 170 * t) * 0.9])); }
  for (let i = 6; i >= 0; i--) { const t = i / 6, hw = 23 * (1 - t) ** 0.8 + 6.5; abd.push(T([CX - hw * 0.9, CY + (70 + 170 * t) * 0.9])); }
  g.fill(abd, BLANK, 0.97);
};
// y-scale 1 to 0.45 about its centre with a slight keystone: the sheet is lying in the grass now
const sheetOnto = (ctx: Ctx, env: Env, cam: Cam, f: number) => {
  const L = sheetLayer(env, f >= TAKEOFFS[0]), pr = projector(cam, 0), c = pr.at([540, 540]);
  const yk = 1 - 0.55 * ramp(f, 285, 335), sk = 0.18 * ramp(f, 290, 340), k = cam.S * env.scale;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(c[0] * env.scale, c[1] * env.scale); ctx.transform(k, sk * k * 0.35, -sk * k, k * yk, 0, 0);
  ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(L.canvas as CanvasImageSource, -540 * env.scale, -540 * env.scale, env.W * env.scale, env.H * env.scale);
  ctx.restore();
};

// ---------------------------------------------------------------- the NEAR world, stages M to R
const nearFrame = (ctx: Ctx, env: Env, f: number) => {
  const cam = camAt(f), W = env.W, H = env.H, g = new Gfx(ctx, env, f, PENCIL);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = PAPER_F; ctx.fillRect(0, 0, W, H);
  g.paper("coldpress", 0.16);
  const meadow = ramp(f, 262, 330); /* the scenery arrives from behind the sheet as the camera rises */
  if (meadow > 0) {
    g.group("plain", () => backdrop(g, cam, W, H), { alpha: meadow });
    g.group("plain", () => backGrass(g, cam, 3.5, 4601, 26, 0.55, 0.06), { alpha: 0.9 * meadow, blur: 3.4 });
    g.group("plain", () => backGrass(g, cam, 2.2, 4602, 24, 0.34, 0.08), { alpha: 0.92 * meadow, blur: 2.2 });
    g.group("plain", () => backGrass(g, cam, 1.0, 4603, 20, 0.14, 0.1), { alpha: 0.95 * meadow, blur: 1.1 });
    const dips: Record<string, number> = {};
    LANDINGS.forEach((l) => { const off = TAKEOFFS.find((t) => t > l.at) ?? 1e9; if (f >= l.at && f <= off + 30) { const t = f - l.at, s = t < 12 ? 1.35 * (1 - Math.pow(1 - t / 12, 2)) : 1 + 0.35 * Math.cos((t - 12) * 0.34) * Math.exp(-(t - 12) / 14); dips[l.flower] = f <= off ? s : s * Math.max(0, 1 - (f - off) / 24); } });
    const gust = GUSTS.reduce((a, gt) => (f >= gt && f < gt + 70 ? a + 0.12 * Math.sin(((f - gt) / 70) * Math.PI) : a), 0);
    g.group("plain", () => drawClump(g, cam, f, { dip: dips, lean: 0.05 + gust }), { alpha: 0.99 * meadow });
  }
  // ---- the sheet: live at the macro, then its own cached surface, only ever downscaled
  if (f < 285) {
    const st: PlateState = { wings: { flap: 1, sweep: 0 }, lift: liftAt(f), keyY: 0, keyTurn: 0, train: trainAt(f), shadow: f > 180 && f < 240 ? [((f - 180) / 60) * 14, ((f - 180) / 60) * 20] : [0, 0], boil: 1, inkedBoil: 1, boilIndex: Math.floor(f / 4), p: FULL, view: { cx: cam.look[0], cy: cam.look[1], zoom: cam.S } };
    drawPlate(ctx, env, st);
    if (f >= TAKEOFFS[0]) { const pr = projector(cam, 0); g.group("plain", () => knockOut(g, pr.at), { alpha: 1 }); }
  } else if (f < 345) sheetOnto(ctx, env, cam, f);
  // ---- the water, only while it is still making the creature
  const wt = f < 130 ? wetnessAt(f) : ALL_WET;
  const w = whereAt(f), pose = poseAt(f), pr = projector(cam, 0), at = pr.at(w.at);
  if (w.perched && f >= 345) {
    const host = hostOf(w.on), hp = projector(cam, host.z), hs = hp.at(host.at), R = host.R * hp.k;
    const n = nod(host.seed, f), well: P = [hs[0] - R * 0.02, hs[1] + R * 0.11 + n * R * 0.1];
    const sip = SIPS.find(([a, b]) => f >= a - 20 && f <= b + 10), land = LANDINGS.find((l) => l.flower === w.on)!;
    const p = sip ? clamp((f - sip[0] + 10) / 10) : 0, beat = 0.5 - 0.5 * Math.cos(((f - land.at) / 15) * Math.PI * 2);
    /* TOP / three-quarter, wings OPEN. The head is turned down toward the throat so the proboscis
       reaches it without crossing the body, and the body's form shading is computed in SCREEN space,
       so turning the creature never moves the sun off the upper right. */
    const fan = 0.5 - 0.5 * Math.cos(((f - land.at) / 30) * Math.PI * 2);
    const head: Flight = { pose: { flap: 0.96 - 0.16 * fan, sweep: -0.02 - 0.02 * fan }, heading: 2.78 + 0.05 * Math.sin((f - land.at) * 0.06), pitch: 0.9, bank: 0.06 + 0.04 * Math.sin((f - land.at) * 0.19) };
    const sit: P = [well[0] - 58 * cam.S, well[1] - 168 * cam.S];
    g.group("plain", () => paintCreature(g, sit, cam.S * (1 + beat * 0.008), head, { proboscis: p, probTo: well, shadow: 1, shadowOff: [-0.55, 0.85], legs: 1, behind: PAINTS[host.v].mid, seed: 900 }), { alpha: 0.99 });
  } else {
    g.group("plain", () => paintCreature(g, at, cam.S, pose, { wetness: wt, groundLift: f < 130, shadow: f > 180 && f < 300 ? ramp(f, 180, 240) * (1 - ramp(f, 260, 300)) : 0, shadowOff: [-0.35, 0.45], legs: f >= 135 ? ramp(f, 135, 150) * (f > 240 ? 0.25 : 1) : 0, seed: 900 }), { alpha: 0.98 });
    if (f < 130) { const T = mapper(at, cam.S, pose), Wg = wingsOf(pose); g.group("plain", () => frontRim(g, T, cam.S * 90, Wg, f, wt), { alpha: 0.9 }); if (f < 60) { const c = cen(Wg[3].panels[2]), lp = liftAt(f); g.group("plain", () => drop(g, T([c[0] + 58 * lp, c[1] - 60 * lp]), cam.S * 26, f), { alpha: 1 }); } }
  }
  if (f >= SEED_FLUFF) g.group("plain", () => seedFluff(g, cam, f), { alpha: 0.7, blur: 1.4 });
  if (meadow > 0.4) fringe(g, cam, 0.05);
  g.paper("washGran", 0.05); g.paper("coldpress", 0.07);
};
const liftAt = (f: number): number => { if (f <= 45) return 1; if (f >= PANEL2_HOME + 6) return 0; const u = clamp((f - 45) / 15), e = 1 - Math.pow(1 - u, 3); return Math.max(-0.06, 1 - e) + (f > PANEL2_HOME ? -0.06 * Math.sin(((f - PANEL2_HOME) / 6) * Math.PI) : 0); };
const trainAt = (f: number) => { const n = Math.floor(f / 5) + (f >= 130 ? 1 : 0), th = n * 0.42; return { centre: th, third: th * 2.1, pinion: th * 4.4, escape: -th * 3.2, fork: Math.sin(n * 1.7) * 0.22 }; };

// ---------------------------------------------------------------- the FINALE world, stages F and W
const DRIFTS: [number, Drift][] = [
  [3.5, { sp: "buttercup", at: [470, 545], r: 150, n: 26, size: 5.5, seed: 7101 }],
  [3.5, { sp: "buttercup", at: [700, 560], r: 120, n: 16, size: 5, seed: 7102 }],
  [3.5, { sp: "daisy", at: [200, 560], r: 130, n: 12, size: 5, seed: 7103 }],
  [2.2, { sp: "poppy", at: [780, 655], r: 170, n: 20, size: 9, seed: 7201 }],
  [2.2, { sp: "cosmos", at: [640, 640], r: 90, n: 9, size: 11, seed: 7202 }],
  [2.2, { sp: "daisy", at: [250, 660], r: 120, n: 14, size: 8, seed: 7203 }],
  [1.0, { sp: "cornflower", at: [250, 690], r: 95, n: 13, size: 13, seed: 7301 }],
  [1.0, { sp: "daisy", at: [430, 720], r: 150, n: 16, size: 12, seed: 7302 }],
  [1.0, { sp: "cosmos", at: [760, 700], r: 110, n: 8, size: 13, seed: 7303 }],
];
// D runs from the clump out to the approved still's 0.8, and the look-at lands on its composition
const fcamAt = (f: number): FCam => {
  const t = ease(clamp((f - 575) / 175)), t2 = ease(clamp((f - 750) / 120));
  return { D: 0.26 + (0.8 - 0.26) * t + 0.012 * t2, look: [520 - 190 * t + 0 * t2, 800 - 190 * t] };
};
const POPPY: P = [800, 640]; // the field poppy it touches down on at 810, deeper in the field
const wideFrame = (ctx: Ctx, env: Env, f: number) => {
  const W = env.W, H = env.H, g = new Gfx(ctx, env, f, PENCIL), cam = fcamAt(f);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = PAPER_F; ctx.fillRect(0, 0, W, H);
  g.paper("coldpress", 0.16);
  const open = ramp(f, 570, 660); /* the sky and the hills arrive as the camera clears the stems */
  if (open > 0) { g.group("plain", () => sky(g, cam, W, H), { alpha: open }); g.group("plain", () => hills(g, cam), { alpha: open }); g.group("plain", () => farField(g, cam), { alpha: open }); }
  const gust = GUSTS.reduce((a, gt) => (f >= gt && f < gt + 90 ? a + 0.1 * Math.sin(((f - gt) / 90) * Math.PI) : a), 0);
  const lean = 0.05 + gust + 0.02 * Math.sin(f * 0.03);
  ([[3.5, 545, 61, 26, 0.06, 0.3], [2.2, 640, 67, 34, 0.08, 0.12], [1.0, 706, 71, 46, 0.1, 0]] as number[][]).forEach(([z, y0, seed, n, ln, fade]) => {
    g.group("plain", () => { grassWash(g, cam, z, y0, seed, { lean: ln + gust, fade, cool: z === 1 }); if (z === 3.5) footpath(g, cam); }, { alpha: 1 });
    g.group("plain", () => grassBlades(g, cam, z, y0, seed, { blades: n, lean: ln + gust, fade }), { alpha: 0.95 });
    const pr = fprojector(cam, z);
    g.group("plain", () => DRIFTS.filter(([dz]) => dz === z).forEach(([, d]) => drift(g, d, pr.at, pr.k, lean)), { alpha: 0.97 });
  });
  const h0 = fprojector(cam, 0), h1 = fprojector(cam, 0.3);
  g.group("plain", () => {
    if (f >= 700) blueprintSheet(g, h0.at([150, 965]), 150 * h0.k); /* what it left behind, back in frame lower left, never pointed at */
    ([[330, 830, 34, 7401, 0], [250, 880, 26, 7402, 1]] as number[][]).forEach(([x, y, s, sd, v]) => flower(g, "daisy", h0.at([x, y]), s * h0.k, sd, { variant: v, lean }));
    ([[560, 800, 30, 7403, 0], [650, 840, 22, 7404, 3]] as number[][]).forEach(([x, y, s, sd, v]) => flower(g, "poppy", h1.at([x, y]), s * h1.k, sd, { variant: v, lean }));
  }, { alpha: 0.98 });
  // ---- the creature: along the path, down on a poppy at 810, then up the field toward us
  const cr = creatureWide(f, cam);
  if (cr) g.group("plain", () => paintCreature(g, cr.at, cr.scale, cr.flight, { shadow: cr.low, shadowOff: [-0.5, 0.6], legs: cr.perched ? 1 : 0.2, proboscis: cr.sip, probTo: cr.probTo, seed: 900 }), { alpha: 0.99 });
  whites(g, f, cam);
  const fr = fprojector(cam, -0.2);
  if (f < 700) g.group("plain", () => { ([[-40, 1120], [180, 1160], [900, 1150], [1120, 1090], [620, 1180]] as P[]).forEach((w0, i) => grassClump(g, fr.at(w0), (240 + i * 34) * fr.k, 60 * fr.k, [GRASS_SHADE, GRASS_MID, GRASS_LIT][i % 3], 7500 + i, 0.06 + i * 0.02, 6, 0.3)); }, { alpha: 0.5 * (1 - ramp(f, 620, 700)), blur: 2.2 });
  if (f >= CORNER_LIFT[0]) g.group("plain", () => { clearCorner(g, ramp(f, CORNER_LIFT[0], CORNER_LIFT[1])); signature(g, clamp((f - SIGNATURE[0]) / (SIGNATURE[1] - SIGNATURE[0])), 0.75 - 0.15 * ramp(f, DING, 1245)); }, { alpha: 1 });
  g.paper("washGran", 0.05); g.paper("coldpress", 0.07);
};

// its flight through the last three stages, in finale-world coordinates
const creatureWide = (f: number, cam: FCam) => {
  const off = 620, arrive = HOVER, end: P = [246, 648];
  let world: P, z: number, k: number;
  if (f < off) { /* the climb out of the clump, along the field: stage F keeps its move and loses its stop */
    const t = ease(clamp((f - 575) / 45));
    world = [540 + (POPPY[0] - 540) * t + Math.sin(t * Math.PI * 1.7) * 90, 760 + (POPPY[1] - 760) * t - Math.sin(t * Math.PI) * 120];
    z = 1.2 + 1.0 * t; k = 0.2 - 0.06 * t;
  } else { /* it turns and comes UP the field to the foreground, GROWING as the world shrinks */
    const t = ease(clamp((f - off) / (arrive - off)));
    z = 2.2 + (1.0 - 2.2) * t; /* the depth the spec asks for, kept short of the camera plane: the
      finale projector divides by (D + z) and turns inside out at z = -D, so the approach is carried
      by the creature's own scale rather than by flying it through the lens */
    k = 0.14 + (0.36 - 0.14) * t;
    world = [POPPY[0] + (end[0] - POPPY[0]) * t + Math.sin(t * Math.PI * 2.3) * 60, POPPY[1] + (end[1] - POPPY[1]) * t - Math.sin(t * Math.PI) * 70];
    if (f >= arrive) { const u = (f - arrive) / 60; world = [end[0] + Math.sin(u * Math.PI * 2) * 16, end[1] + Math.sin(u * Math.PI * 4) * 9 - (f - arrive) * 0.05]; k = 0.36; z = 1.0; } /* the approved still's position, hovering */
  }
  const pr = fprojector(cam, z), ph = (f % 10) / 10, flap = 0.6 + 0.4 * Math.cos(ph * Math.PI * 2);
  const scale = Math.max(0.105, k * pr.k); /* readability floor: below about 80 px of wingspan it stops being a butterfly and becomes a speck */
  return { at: pr.at(world), scale, perched: false, low: 0, sip: 0, probTo: undefined as P | undefined, flight: { pose: { flap, sweep: -0.03 }, heading: 0.1 * Math.sin(f * 0.05), pitch: 0.94, bank: 0.08 * Math.sin(f * 0.09) } as Flight };
};
// two REAL white butterflies lift out of the grass and spiral round it, then peel away
const whites = (g: Gfx, f: number, cam: FCam) => {
  if (f < WHITES[0] || f > WHITES[1]) return;
  const pr = fprojector(cam, 1.6);
  for (let k = 0; k < 2; k++) {
    const t = (f - WHITES[0]) / (WHITES[1] - WHITES[0]), a = f * 0.08 + k * Math.PI;
    const w: P = [820 - t * 420 + Math.cos(a) * 60, 700 - t * 300 + Math.sin(a) * 40 - t * t * 260];
    const p = pr.at(w), s = 26 * pr.k * (1 - t * 0.3), fl = 0.4 + 0.6 * Math.abs(Math.cos(f * 0.32 + k));
    g.fill([[p[0] - s * fl, p[1] - s * 0.7], [p[0] - s * 0.1, p[1] - s * 0.2], [p[0] - s * 0.8 * fl, p[1] + s * 0.5]], "#fbf8ef", 0.85);
    g.fill([[p[0] + s * fl, p[1] - s * 0.7], [p[0] + s * 0.1, p[1] - s * 0.2], [p[0] + s * 0.8 * fl, p[1] + s * 0.5]], "#f4efe2", 0.8);
    g.fill([[p[0] - s * 0.09, p[1] - s * 0.34], [p[0] + s * 0.09, p[1] - s * 0.3], [p[0] + s * 0.06, p[1] + s * 0.3], [p[0] - s * 0.06, p[1] + s * 0.3]], "#6b6250", 0.7);
  }
};

// ---------------------------------------------------------------- the movement
export const drawAlive = (ctx: Ctx, env: Env, f: number) => {
  if (f < HANDOVER[0]) return nearFrame(ctx, env, f);
  if (f >= HANDOVER[1]) return wideFrame(ctx, env, f);
  const t = ease((f - HANDOVER[0]) / (HANDOVER[1] - HANDOVER[0]));
  nearFrame(ctx, env, f);
  const dw = Math.round(env.W * env.scale), dh = Math.round(env.H * env.scale);
  let L = env.cache.get("alive:dissolve") as Layer | undefined;
  if (!L) { L = env.canvas(dw, dh); env.cache.set("alive:dissolve", L); }
  L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.globalAlpha = 1; L.ctx.globalCompositeOperation = "source-over"; L.ctx.clearRect(0, 0, dw, dh);
  wideFrame(L.ctx, env, f);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = t; ctx.drawImage(L.canvas as CanvasImageSource, 0, 0); ctx.restore();
};
