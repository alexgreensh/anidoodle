// THE PRESS. Three plates, one sheet, and the sheet underneath is still Act 1. Each plate is
// drawn on its own surface and printed with MULTIPLY at its own registration offset, so the
// offset can lag, jog and be corrected without redrawing a dot, and each drum pass is revealed
// by its own roller line at composite time.
import { Ctx, Env, Gfx, Medium, P } from "../core";
import { INK, LITHO } from "../riso";
import { FW, FW_H, FW_T, HW, HW_H, HW_T, Pose, REST, Wing, wingGeom } from "./geom";
import { BlueS, PinkS, bluePlate, grain, marks, pinkPlate, rollerPath, stock, wetEdge, yellowPlate } from "./act2art";
import { Train } from "./parts";
import { View, WIDE, blit, kk, part, slotOf } from "./surface";
import { stateAt as act1StateAt } from "./act1cues";
import { drawPlate } from "./plate";

export type RisoState = {
  poses: Pose[]; view: View;
  blue: number; pink: number; yellow: number; /* roller pass progress, 0 = not printed */
  reg: P; lift: P; ghost: number; marks: number; bars: number; imprint: number;
  train: Train; wheels: number; panel2: number; quiver: [number, number]; proboscis: number; key: number;
  flex: number[]; vel: number[]; sun: number; lit: number;
};
const nibFor = (z: number): Medium => (z === 1 ? LITHO : { ...LITHO, nib: (LITHO.nib * Math.pow(z, 0.35)) / z }); // weight tracks zoom^0.35, never the transform

export const drawRiso = (ctx: Ctx, env: Env, s: RisoState) => {
  const W = env.W, H = env.H, v = s.view, vk = kk(v.cx, v.cy, v.zoom), med = nibFor(v.zoom);
  const P4 = (p: Pose[]): Wing[] => [wingGeom(-1, HW, HW_H, HW_T, 2000, p[0]), wingGeom(1, HW, HW_H, HW_T, 2600, p[1]), wingGeom(-1, FW, FW_H, FW_T, 1000, p[2]), wingGeom(1, FW, FW_H, FW_T, 1600, p[3])];
  const w = P4(s.poses), pk = kk(...s.poses.flatMap((p) => [p.flap, p.sweep]));
  const pt = (name: string, key: string, fn: (g: Gfx) => void) => part(env, med, name, key + "|" + vk, 0, fn, v);

  const sheet = pt("stock", "stock", (g) => stock(g, W, H));
  const blueS: BlueS = { key: s.key, flex: s.flex, imprint: s.imprint };
  const blue = s.blue > 0 ? pt("blue", kk("b", pk, s.key, s.imprint, ...s.flex), (g) => bluePlate(g, w, blueS)) : null;
  const pinkS: PinkS = { train: s.train, wheels: s.wheels, panel2: s.panel2, quiver: s.quiver, proboscis: s.proboscis, vel: s.vel };
  const pink = s.pink > 0 ? pt("pink", kk("p", pk, s.wheels, s.panel2, s.train.centre, s.train.escape, s.quiver[0], s.quiver[1], s.proboscis, ...s.vel.map((x) => Math.round(x * 40) / 40)), (g) => pinkPlate(g, w, pinkS)) : null;
  const yellow = s.yellow > 0 ? pt("yellow", kk("y", s.sun, s.lit), (g) => yellowPlate(g, w, { sun: s.sun, lit: s.lit })) : null;
  const furn = pt("marks", kk(s.marks, s.bars), (g) => marks(g, W, H, s.marks, s.bars));
  /* the sheet underneath is Act 1's last frame: the transition is a drum pass over the blueprint */
  const under = s.blue < 1 ? part(env, med, "blueprint", "act1-539", 0, (g) => drawPlate(g.main, env, act1StateAt(539)), WIDE) : null;

  const pass = (r: number, draw: () => void) => { if (r <= 0) return; ctx.save(); if (r < 1) { ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); rollerPath(ctx, W, H, r); ctx.clip(); } draw(); ctx.restore(); };
  const L: P = s.lift, sc = env.scale;
  blit(ctx, under);
  pass(s.blue, () => { blit(ctx, sheet); if (s.ghost > 0 && blue) blit(ctx, blue, 0, 0, 0.3 * s.ghost, "multiply"); blit(ctx, blue, Math.round(L[0] * sc), Math.round(L[1] * sc), 1, "multiply"); }); /* the ghost is the print it left on the stock where it sat */
  pass(s.pink, () => blit(ctx, pink, Math.round((L[0] + s.reg[0]) * sc), Math.round((L[1] + s.reg[1]) * sc), 1, "multiply"));
  pass(s.yellow, () => blit(ctx, yellow, Math.round(L[0] * sc), Math.round(L[1] * sc), 1, "multiply"));
  ctx.save(); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); wetEdge(ctx, W, H, s.blue, INK.blue); wetEdge(ctx, W, H, s.pink, INK.pink); wetEdge(ctx, W, H, s.yellow, INK.yellow); ctx.restore();
  blit(ctx, furn); /* register crosses and colour bars stay exactly where they were struck */
  if (s.blue > 0) { ctx.save(); if (s.blue < 1) { ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); rollerPath(ctx, W, H, s.blue); ctx.clip(); } grain(new Gfx(ctx, env, 0, LITHO)); ctx.restore(); } /* the cream stock only has tooth where the cream stock is: frame 0 must still be Act 1 exactly */
};
