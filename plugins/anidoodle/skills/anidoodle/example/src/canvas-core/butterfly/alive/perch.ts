// BEATS 3 AND 4, THE RANUNCULUS CLOSE-UP. The heart of the film, held for six bars so it has
// time to be believed. The camera only creeps and drifts sideways with the creature, stepping
// back a little on each take-off; the creature lands, sips, and goes on to the next head.
//
// This composes stage R for any frame. The approval still is local 390: thirty frames after the
// landing on R1, with the proboscis down in the tight green centre and the head still carrying
// the dip it took when the creature arrived on it.
import { Ctx, Env, Gfx, P, PENCIL } from "../../core";
import { PAPER_F } from "../finale/compose";
import { LANDINGS, SIPS, PROBOSCIS, TAKEOFFS } from "./cues";
import { PAINTS, head } from "./ranunculus";

export const LATERAL = ["R1", "R3"]; // spec 5.7: at least two of the four visits are the lateral figure
import { CLUMP, R_LOOK, backGrass, backdrop, drawClump, fringe, nod, seedFluff } from "./meadow2";
import { Cam, projector, scaleOf } from "./view";
import { Flight, paintCreature } from "./wingpaint";
import { drawLateral } from "./lateral";

export const camAt = (f: number): Cam => ({ S: scaleOf(f), look: R_LOOK });

// A visited head dips when the creature lands on it and rebounds when it leaves: stem bends about
// six degrees, one settle, and nothing else in the clump moves with it.
const dipOf = (f: number) => {
  const out: Record<string, number> = {};
  LANDINGS.forEach((l, i) => {
    const off = TAKEOFFS.find((t) => t > l.at) ?? 1e9;
    if (f < l.at || f > off + 30) return;
    const t = f - l.at;
    const settle = t < 12 ? 1.35 * (1 - Math.pow(1 - t / 12, 2)) : 1 + 0.35 * Math.cos((t - 12) * 0.34) * Math.exp(-(t - 12) / 14);
    out[l.flower] = f <= off ? settle : settle * Math.max(0, 1 - (f - off) / 24);
  });
  return out;
};
// It is never still. Wings fan on a 30-frame cycle at an amplitude of about a third, one side
// leads the other, and the abdomen pulses once a beat: the tick has become a heartbeat.
const perched = (f: number, landed: number): Flight => {
  const t = f - landed, fan = 0.5 - 0.5 * Math.cos((t / 30) * Math.PI * 2);
  return { pose: { flap: 1 - 0.35 * fan, sweep: -0.02 - 0.03 * fan }, heading: -2.35 + 0.05 * Math.sin(t * 0.08), pitch: 0.9, bank: 0.07 + 0.03 * Math.sin(t * 0.21) };
};

export type PerchState = { f: number; on: string };
export const drawPerch = (ctx: Ctx, env: Env, f: number, on = "R1") => {
  const W = env.W, H = env.H, g = new Gfx(ctx, env, f, PENCIL), cam = camAt(f), c = ctx;
  c.setTransform(env.scale, 0, 0, env.scale, 0, 0); c.fillStyle = PAPER_F; c.fillRect(0, 0, W, H);
  g.paper("coldpress", 0.16);
  g.group("plain", () => backdrop(g, cam, W, H), { alpha: 1 });
  g.group("plain", () => backGrass(g, cam, 3.5, 4601, 46, 0.55, 0.06), { alpha: 0.9, blur: 3.4 }); /* aerial perspective is the only way distance reads in paint: paler, bluer, softer, no drawing */
  g.group("plain", () => backGrass(g, cam, 2.2, 4602, 40, 0.34, 0.08), { alpha: 0.92, blur: 2.2 });
  g.group("plain", () => backGrass(g, cam, 1.0, 4603, 32, 0.14, 0.1), { alpha: 0.95, blur: 1.1 });

  const land = LANDINGS.find((l) => l.flower === on), dips = dipOf(f);
  g.group("plain", () => drawClump(g, cam, f, { dip: dips, lean: 0.05 }), { alpha: 0.99 });

  // ---- the creature, perched on the head it landed on. Spec 5.7: at least two of the four
  // ranunculus visits are LATERAL, wings closed over the back, which is how a butterfly actually
  // sips and what a plate shows beside the dorsal figure. R1 and R3 are the two.
  const host = CLUMP.find((p) => p.id === on);
  if (host && land && f >= land.at) {
    const pr = projector(cam, host.z), hs = pr.at(host.at), R = host.R * pr.k;
    const dip = dips[on] ?? 0, n = nod(host.seed, f);
    const well: P = [hs[0] + (dip + n) * R * 0.12 - R * 0.02, hs[1] + (dip + n) * R * 0.1 + R * 0.11];
    const sip = SIPS.find(([a, b]) => f >= a - 20 && f <= b + 10);
    const p = sip ? Math.max(0, Math.min(1, (f - PROBOSCIS[0]) / (PROBOSCIS[1] - PROBOSCIS[0]))) : 0;
    const beat = 0.5 - 0.5 * Math.cos(((f - land.at) / 15) * Math.PI * 2); /* one soft pulse per beat while it sips: the heartbeat */
    if (LATERAL.includes(on)) {
      const at: P = [well[0] + R * 0.5, well[1] - R * 0.5];
      const grip: P[] = [[well[0] + R * 0.16, well[1] - R * 0.04], [well[0] + R * 0.42, well[1] + R * 0.06], [well[0] + R * 0.68, well[1] + R * 0.1]];
      g.group("plain", () => drawLateral(g, { at, scale: cam.S * (1 + beat * 0.008), face: -1, lean: 0.52 + 0.03 * Math.sin((f - land.at) * 0.07), open: 0.16 + 0.1 * (0.5 - 0.5 * Math.cos(((f - land.at) / 30) * Math.PI * 2)), proboscis: p, probTo: well, grip, seed: 900 }), { alpha: 0.98 });
    } else {
      const at: P = [well[0] + R * 0.42, well[1] - R * 0.56];
      g.group("plain", () => paintCreature(g, at, cam.S * (1 + beat * 0.008), perched(f, land.at), { proboscis: p, probTo: well, shadow: 1, shadowOff: [-0.8, 0.95], legs: 1, behind: PAINTS[host.v].mid, seed: 900 }), { alpha: 0.98 });
    }
  }

  g.group("plain", () => seedFluff(g, cam, f), { alpha: 0.7, blur: 1.4 });
  fringe(g, cam, 0.05);
  g.paper("washGran", 0.05); g.paper("coldpress", 0.07);
};

// ---------------------------------------------------------------- G-R, the study sheet
// The five hand-authored views in three colours at full level of detail, which is the sheet a
// painter would put on the wall before starting the picture. Nothing here is in the film.
export const drawViews = (ctx: Ctx, env: Env) => {
  const W = env.W, H = env.H, g = new Gfx(ctx, env, 0, PENCIL), c = ctx;
  c.setTransform(env.scale, 0, 0, env.scale, 0, 0); c.fillStyle = PAPER_F; c.fillRect(0, 0, W, H);
  g.paper("coldpress", 0.18);
  const views = ["facing", "three", "profile", "half", "bud"] as const, cols = ["coral", "blush", "butter"] as const;
  const x0 = 118, y0 = 190, dx = 202, dy = 300;
  cols.forEach((v, row) => views.forEach((view, col) => {
    const at: P = [x0 + col * dx, y0 + row * dy], R = view === "bud" ? 52 : 86;
    g.group("paint", () => head(g, at, R, v, { view, tilt: (col - 2) * 0.09 + (row - 1) * 0.05, seed: 3000 + row * 41 + col * 7, reserve: false }), { alpha: 0.99 });
  }));
  g.paper("coldpress", 0.07);
};
