// THE SHEET OF PAPER. Pencil first, washes over it, blooms and settling on top, and the paper's
// own tooth over everything. The washes are their own surface, so the paint can slide off the
// drawing while it flies without either being redrawn.
import { Ctx, Env, Gfx, P, PENCIL } from "../core";
import { FW, FW_H, FW_T, HW, HW_H, HW_T, Pose, REST, Wing, wingGeom } from "./geom";
import { backrun, dry, pencil, sheet3, washes } from "./act4art";
import { blit, kk, part } from "./surface";

export type WaterState = { pose: Pose; pencil: number; wet: number; settle: number; slip: P; bloom: number };
export const WATER_REST: WaterState = { pose: REST, pencil: 1, wet: 1, settle: 1, slip: [0, 0], bloom: 1 };

export const drawWater = (ctx: Ctx, env: Env, s: WaterState) => {
  const W = env.W, H = env.H;
  const wings = (pose: Pose): Wing[] => [wingGeom(-1, HW, HW_H, HW_T, 2000, pose), wingGeom(1, HW, HW_H, HW_T, 2600, pose), wingGeom(-1, FW, FW_H, FW_T, 1000, pose), wingGeom(1, FW, FW_H, FW_T, 1600, pose)];
  const w = wings(s.pose), pk = kk(s.pose.flap, s.pose.sweep);
  const paper = part(env, PENCIL, "sheet3", "sheet3", 0, (g) => sheet3(g, W, H));
  const draw = s.pencil > 0 ? part(env, PENCIL, "pencil", kk(pk, s.pencil), 0, (g) => pencil(g, w, s.pencil)) : null;
  const paint = s.wet > 0 ? part(env, PENCIL, "wash", kk(pk, s.wet, s.settle, s.slip[0], s.slip[1], s.bloom), 0, (g) => {
    washes(g, w, { wet: s.wet, settle: s.settle, slip: s.slip });
    if (s.bloom > 0) { const b = w[2], at: P = [b.spar(2, 0.55)[0] + s.slip[0], b.spar(2, 0.55)[1] + s.slip[1]]; backrun(g, at, 78, s.bloom, 1400); } /* one drop of clean water, into the port forewing */
  }) : null;

  blit(ctx, paper); blit(ctx, paint); blit(ctx, draw, 0, 0, 0.95); /* graphite reads THROUGH the paint, so it goes on top at low opacity */
  dry(new Gfx(ctx, env, 0, PENCIL));
};
