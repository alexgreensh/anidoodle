// BEAT 1, THE MACRO: the mechanical creature turns into a real watercolour butterfly. One shot,
// no cut, at S = 4.0 creeping to 3.4, so the frame holds one forewing root, panel 2 on its
// projection lines, and the edge of the thorax window with its wheels still stepping on the tick.
//
// The order of the picture is the order of the event. The BLUEPRINT is drawn first, in full, by
// Act 1's own composer at a close view, so what the water is lifting is genuinely the same
// drawing. Then the water takes the creature, panel by panel, and only the creature: the sheet
// around it stays a blueprint for ever, which is the line the whole film turns on.
import { Ctx, Env, Gfx, P, PENCIL } from "../../core";
import { CX, CY } from "../geom";
import { FULL, PlateState } from "../plate";
import { drawPlate } from "../plate";
import { IDLE } from "../parts";
import { M0, PANEL2_HOME, DROP } from "./cues";
import { Cam, projector, scaleOf } from "./view";
import { drop, frontRim, wetnessAt } from "./water";
import { paintCreature, wingsOf, REST_FLIGHT, mapper } from "./wingpaint";

// The lifted panel seats on 60 with the last mechanical overshoot in the film, and the flaw
// becomes the mark of the individual: that blue panel is the one on the approved finale still.
const liftAt = (f: number): number => {
  if (f <= 45) return 1;
  if (f >= PANEL2_HOME + 6) return 0;
  const u = Math.min(1, (f - 45) / 15), e = 1 - Math.pow(1 - u, 3);
  return Math.max(-0.06, 1 - e) + (f > PANEL2_HOME ? -0.06 * Math.sin(((f - PANEL2_HOME) / 6) * Math.PI) : 0);
};
// the train steps on the tick, one notch per five frames, all the way through the macro
const trainAt = (f: number) => { const n = Math.floor(f / 5) + (f >= 130 ? 1 : 0), th = n * 0.42; return { centre: th, third: th * 2.1, pinion: th * 4.4, escape: -th * 3.2, fork: Math.sin(n * 1.7) * 0.22 }; };

export const camAt = (f: number): Cam => {
  const S = scaleOf(f), u = Math.max(0, Math.min(1, (f - 60) / 60)); /* 60-120: a slow drift left across the thorax to the port wing roots */
  return { S, look: [M0[0] - 78 * u * u * (3 - 2 * u) * 0.5, M0[1] + 10 * u] as P };
};

export const drawTransform = (ctx: Ctx, env: Env, f: number) => {
  const cam = camAt(f), pr = projector(cam, 0);
  // ---- the blueprint, at this view, by Act 1's composer
  const st: PlateState = { wings: { flap: 1, sweep: 0 }, lift: liftAt(f), keyY: 0, keyTurn: 0, train: trainAt(f), shadow: f > 180 ? [((f - 180) / 60) * 14, ((f - 180) / 60) * 20] : [0, 0], boil: 1, inkedBoil: 1, boilIndex: Math.floor(f / 4), p: FULL, view: { cx: cam.look[0], cy: cam.look[1], zoom: cam.S } };
  drawPlate(ctx, env, st);

  // ---- the water, and what it leaves behind
  const g = new Gfx(ctx, env, f, PENCIL), wt = wetnessAt(f), at = pr.at([CX, CY]);
  g.group("plain", () => paintCreature(g, at, cam.S, REST_FLIGHT, { wetness: wt, groundLift: true, shadow: f > 180 ? (f - 180) / 60 : 0, shadowOff: [-0.35, 0.45], seed: 900 }), { alpha: 0.98 });
  const T = mapper(at, cam.S, REST_FLIGHT), W = wingsOf(REST_FLIGHT);
  g.group("plain", () => frontRim(g, T, cam.S * 90, W, f, wt), { alpha: 0.9 });
  if (f >= DROP && f < DROP + 55) { const liftedPanel = W[3].panels[2], c = liftedPanel.reduce((a, p) => [a[0] + p[0] / liftedPanel.length, a[1] + p[1] / liftedPanel.length] as P, [0, 0] as P); const lp = liftAt(f); g.group("plain", () => drop(g, T([c[0] + 58 * lp, c[1] - 60 * lp]), cam.S * 26, f), { alpha: 1 }); }
  g.paper("coldpress", 0.07); /* the tooth of the sheet, over the paint as well as over the ink */
};
