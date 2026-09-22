// THE PAGE. Editorial cutaway: the art on one surface, the annotation on another, so labels can
// be written while the mechanism runs without redrawing the mechanism, and the camera can push
// in on either without a bitmap ever being scaled up.
import { Ctx, Env, Gfx, Medium, P, PENCIL } from "../core";
import { FW, FW_H, FW_T, HW, HW_H, HW_T, Pose, Wing, wingGeom } from "./geom";
import { A3, Label, bleed, caption, creature, cutLine, force, inset, labels, mechanism, page, pulse } from "./act3art";
import { Train } from "./parts";
import { View, blit, kk, part } from "./surface";

export type EditState = {
  view: View; poses: Pose[]; th: number; train: Train; art: A3;
  cut: number; labels: Label[]; caption: [string, number]; pulseAt: number; pulseOn: number;
  forceP: number; inset: number; seat: number; lift: P; shadow: [number, number]; mech: number;
};
const BRUSH: Medium = { nib: 1, taper: 0.5, pressure: 0.5, retrace: false, wobble: 0.35, rough: 0.5 }; // a brush pen: it swells, it does not scratch
const nibFor = (z: number): Medium => (z === 1 ? BRUSH : { ...BRUSH, nib: (BRUSH.nib * Math.pow(z, 0.35)) / z });

export const drawEdit = (ctx: Ctx, env: Env, s: EditState) => {
  const W = env.W, H = env.H, v = s.view, vk = kk(v.cx, v.cy, v.zoom), med = nibFor(v.zoom), a = s.art;
  const w: Wing[] = [wingGeom(-1, HW, HW_H, HW_T, 2000, s.poses[0]), wingGeom(1, HW, HW_H, HW_T, 2600, s.poses[1]), wingGeom(-1, FW, FW_H, FW_T, 1000, s.poses[2]), wingGeom(1, FW, FW_H, FW_T, 1600, s.poses[3])];
  const pk = kk(...s.poses.flatMap((p) => [p.flap, p.sweep]));
  const pt = (name: string, key: string, fn: (g: Gfx) => void) => part(env, med, name, key + "|" + vk, 0, fn, v);

  const sheet = pt("page3", "page3", (g) => page(g, W, H));
  const art = pt("edit", kk(pk, a.th, a.shell, a.faces, a.accent, a.wings, a.bleed, a.ghostRod, a.arc, a.ghostSpar, s.mech, s.train.centre), (g) => { creature(g, w, a); mechanism(g, a, s.train, s.mech); bleed(g, w, a); });
  const note = pt("notes3", kk(s.cut, s.caption[1], s.inset, s.seat, s.forceP, s.pulseAt, s.pulseOn, a.th, pk, ...s.labels.map((l) => l.p), ...s.labels.flatMap((l) => l.to)), (g) => { /* two leaders point AT the crank, so the crank angle is part of what this surface is */
    cutLine(g, s.cut); labels(g, s.labels); if (s.caption[1] > 0) caption(g, s.caption[0], v, s.caption[1]);
    if (s.forceP > 0) { const from: P = [540 + 6, 380], to: P = [540 + 96, 330]; force(g, from, to, s.forceP); }
    pulse(g, { at: s.pulseAt, on: s.pulseOn }); inset(g, w[3], s.inset, s.seat, v);
  });

  blit(ctx, sheet);
  const sc = env.scale, L = s.lift;
  if (s.shadow[0] || s.shadow[1]) blit(ctx, art, Math.round((L[0] + s.shadow[0]) * sc), Math.round((L[1] + s.shadow[1]) * sc), 0.16); /* it lifts off the page, and the page keeps its diagram */
  blit(ctx, art, Math.round(L[0] * sc), Math.round(L[1] * sc));
  blit(ctx, note); /* every label and leader stays exactly where it was put, pointing at paper */
  const g = new Gfx(ctx, env, 0, PENCIL); g.paper("paper", 0.12);
};
