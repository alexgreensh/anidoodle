// MECHANICAL LEPIDOPTERA. The whole film: 1800 frames, 60.0 s at 30 fps, 120 bpm, 1080x1080.
//
//   ACT 1      frames    0- 540   BLUEPRINT: the plate drafts itself, with camera. LOCKED.
//   MOVEMENT 2 frames  540-1800   ALIVE: one continuous coming-to-life, macro to wide.
//
// Act 1 is reused exactly as it was approved: its own cue table, its own composer, not a line
// changed. Movement 2 is one shot on top of it. The score is section 8, generated in pure JS on
// the same beat grid, so every onset sits on the frame that caused it.
import { DURATION as ACT1, SHOTS, gridProblems as act1Grid, stateAt } from "./butterfly/act1cues";
import { drawPlate } from "./butterfly/plate";
import { gridProblems as aliveGrid, LOCAL } from "./butterfly/alive/cues";
import { drawAlive } from "./butterfly/alive/movement2";
import { aliveScore, scoreProblems } from "./butterfly/alive/score";
import type { Film } from "./film";

const problems = [...act1Grid(), ...aliveGrid(), ...scoreProblems()];
if (problems.length) throw new Error("the film is off the grid:\n  " + problems.join("\n  "));

export const TOTAL = ACT1 + LOCAL; // 1800

export const mechanicalLepidoptera: Film = {
  meta: { title: "mechanicalLepidoptera", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: TOTAL },
  assets: { images: {} },
  shots: [
    ...SHOTS.map(([id, start, end]) => ({ id, start, end, draw: (ctx: CanvasRenderingContext2D, local: number, env: Parameters<typeof drawPlate>[1]) => drawPlate(ctx, env, stateAt(start + local)) })),
    { id: "movement2", start: ACT1, end: TOTAL, draw: (ctx, local, env) => drawAlive(ctx, env, local) },
  ],
  audio: aliveScore(TOTAL),
};
