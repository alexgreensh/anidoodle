// MIRA WALKS IN. 8 s at 30 fps, storybook pencil + watercolour. She walks in from the left on a
// diagonal toward us, heel strikes landing on the beat (120 bpm = a step every 15 frames), brings
// her feet together, turns her head to the camera with a blink, and waves.
//
// Everything is posed from the one character module; the walk comes from footsteps
// (character/human/walk.ts), so a planted foot never slides. One cue table holds every frame
// number, checked at load against the 15-frame beat grid.
import { Gfx, PENCIL, type Ctx, type Env, oval } from "./core";
import type { Film } from "./film";
import { V3, add, camera, dot, lensPx, mul, mv, norm, project, sub } from "./character/math3";
import { rigFor } from "./character/human/figure";
import { MIRA_SPEC } from "./characters/mira";
import type { Pose } from "./character/types";
import { renderStorybook } from "./character/render/storybook";
import { mira } from "./characters/mira";
import { MIRA_STORYBOOK } from "./characters/mira/palettes";
import { MIRA_DIMS, base } from "./characters/mira/poses";
import { planWalk, walkAt } from "./character/human/walk";

const W = 1920, H = 1080, FPS = 30, N = 240;
// ---- the cue table: every event on the grid (beats of 15 frames, events on multiples of 5)
export const CUES = { walkIn: 0, lastStep: 105, feetTogether: 120, settled: 135, headTurn: 135, blink: 145, armUp: 180, waveStart: 195, hi: 200, waveEnd: 240 } as const;
Object.entries(CUES).forEach(([k, f]) => { if (f % 5) throw new Error(`cue ${k} at ${f} is off the 5-frame event grid`); });
[CUES.walkIn, CUES.feetTogether, CUES.headTurn, CUES.armUp, CUES.waveStart].forEach((f) => { if (f % 15) throw new Error(`beat cue at ${f} is off the 15-frame beat`); });

const YAW = 70, DIR: V3 = [Math.sin((YAW * Math.PI) / 180), 0, Math.cos((YAW * Math.PI) / 180)];
const PLAN = planWalk({ t0: CUES.walkIn, s0: 0, step: 0.4, cycle: 30, n: 8, first: "L", lateral: 0.065 });
const S_END = PLAN.rootS(1e6), ORIGIN: V3 = mul(DIR, -S_END);                  // she stops at the world origin
const EYE0: V3 = [0.55, 0.82, 4.6], TARGET: V3 = [-0.05, 0.63, 0];
const ease = (u: number) => { const t = Math.max(0, Math.min(1, u)); return t * t * (3 - 2 * t); };
const span = (f: number, a: number, b: number) => ease((f - a) / (b - a));

export const miraAt = (f: number): Pose => {
  const w = walkAt(MIRA_DIMS, PLAN, f, base(YAW, {}, {}), { origin: ORIGIN, dir: DIR });
  const p = w.pose, j = { ...p.joints };
  // after the stop: breathing, the head coming round to camera, then the wave
  const settle = span(f, CUES.lastStep, CUES.settled), turn = span(f, CUES.headTurn, CUES.headTurn + 30), up = span(f, CUES.armUp, CUES.armUp + 16);
  const breath = Math.sin(((f - CUES.settled) / 45) * Math.PI * 2) * settle;
  j.spineBend = (j.spineBend ?? 0) + 1.2 * breath;
  j.spineTwist = (j.spineTwist ?? 0) - 16 * turn; j.neckTwist = (j.neckTwist ?? 0) - 26 * turn; j.headTurn = -8 * turn;
  j.headTilt = 7 * up + 2 * breath * (1 - up);
  // the wave: the upper arm lifts, then the forearm rocks at 2 Hz; the hand follows 3 frames late
  const rock = (ff: number) => Math.sin(((ff - CUES.waveStart) / 15) * Math.PI * 2) * span(ff, CUES.waveStart - 5, CUES.waveStart + 5);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  // she waves with her LEFT hand: the far arm, so from this camera the hand clears her face
  j.shoulderRaiseL = lerp(j.shoulderRaiseL ?? 12, 124, up); j.shoulderSwingL = lerp(j.shoulderSwingL ?? 20, 12, up); j.shoulderTwistL = 34 * up;
  j.elbowL = lerp(j.elbowL ?? 16, 62, up) + 16 * rock(f); j.pronationL = 25 * up; j.wristDevL = -10 * rock(f - 3); j.clavLiftL = 12 * up;
  j.spineSide = 4 * up; j.shoulderRaiseR = lerp(j.shoulderRaiseR ?? 12, 10, up);
  // a wave SHOWS the palm: turn the forearm (within its range) until the palm faces the lens
  if (up > 0) {
    let best = 0, bestDot = -2;
    for (let pr = -80; pr <= 80; pr += 5) { const r = rigFor(MIRA_SPEC, { ...p, joints: { ...j, pronationL: pr } }), n = mv(r.hand.L.R, [-1, 0, 0]), d = dot(n, norm(sub(EYE0, r.joints.wristL))); if (d > bestDot) { bestDot = d; best = pr; } }
    j.pronationL = 25 * (1 - up) + best * up;
  }
  // the face: a blink rides the head turn; the smile grows; she says "hi"
  const blink = f >= CUES.blink && f < CUES.blink + 5 ? Math.sin(((f - CUES.blink) / 5) * Math.PI) : 0;
  const hi = f >= CUES.hi && f < CUES.hi + 18 ? Math.sin(((f - CUES.hi) / 18) * Math.PI) : 0;
  const ex = { smile: 0.25 + 0.7 * turn, cheek: 0.6 * turn, lidLower: 0.2 * turn, browRaise: 0.35 * up, lidUpper: blink, mouthOpen: 0.45 * hi, lookX: -0.35 * turn * 0 };
  return { ...p, joints: j, expression: ex, hands: { R: "relaxed", L: up > 0.5 ? "wave" : { relaxed: 1 - up * 2 + 1e-3, wave: up * 2 + 1e-3 } }, aux: { bagSwing: 9 * Math.sin(2 * Math.PI * w.phase * 2 - 0.9) * w.amp + 6 * Math.exp(-(f - CUES.feetTogether) / 12) * Math.sin((f - CUES.feetTogether) / 3.5) * (f > CUES.feetTogether ? 1 : 0) } };
};

const drawWorld = (g: Gfx, cam: ReturnType<typeof camera>) => {
  const P = (v: V3) => { const q = project(cam, v); return [q.x, q.y] as [number, number]; };
  g.group("paint", () => {
    g.wash([[-40, -40], [W + 40, -40], [W + 40, P([0, 0, -9])[1] + 10], [-40, P([0, 0, -9])[1] + 10]], "#cfe2ee", { alpha: 0.55, seed: 2, dx: 0, dy: 0, shrink: 1, rim: false });
    g.wash(oval(W * 0.72, 180, 170, 140, 10), "#fbe7a8", { alpha: 0.5, seed: 3 });
    // a low garden wall far behind, then the lawn, then a path on the diagonal she walks
    const wall = [P([-12, 0, -6]), P([12, 0, -6]), P([12, 0.9, -6]), P([-12, 0.9, -6])];
    g.wash(wall, "#e7b89a", { alpha: 0.55, seed: 4, dx: 2, dy: 1, shrink: 1, rim: true });
    g.wash([P([-12, 0, -6]), P([12, 0, -6]), P([12, 0, 4.2]), P([-12, 0, 4.2])], "#a8cf9c", { alpha: 0.62, seed: 5, dx: 0, dy: 0, shrink: 1, rim: false });
    const a = add(ORIGIN, mul(DIR, -1)), b = add(ORIGIN, mul(DIR, S_END + 2)), side: V3 = [DIR[2] * 0.45, 0, -DIR[0] * 0.45];
    g.wash([P(add(a, side)), P(add(b, side)), P(add(b, mul(side, -1))), P(add(a, mul(side, -1)))], "#e9dcc3", { alpha: 0.75, seed: 6, dx: 0, dy: 0, shrink: 1, rim: true });
    // a puddle she stops beside, catching the sky
    const pc: V3 = [0.55, 0, 0.55], pud = Array.from({ length: 12 }, (_, i) => { const t = (i / 12) * Math.PI * 2; return P(add(pc, [Math.cos(t) * 0.45, 0, Math.sin(t) * 0.24])); });
    g.wash(pud, "#9dbfd8", { alpha: 0.7, seed: 7, dx: 0, dy: 0, shrink: 1, rim: true });
  });
  g.group("ink", () => {
    const hz = P([0, 0, -6]);
    g.pen([[-20, hz[1] + 2], [W * 0.5, hz[1] - 3], [W + 20, hz[1] + 1]], { w: 1.4, seed: 9, opacity: 0.5, wobble: 2 });
    [[-1.7, -2.4], [1.9, -3.2], [-3.4, -1.1], [2.8, 0.9], [-0.9, 1.8]].forEach(([x, z], i) => { const q = P([x, 0, z]); g.pen([[q[0], q[1]], [q[0] + 4, q[1] - 16], [q[0] + 7, q[1] - 26]], { w: 1.8, color: "#5f8f62", seed: 20 + i, retrace: false }); g.pen([[q[0] + 10, q[1]], [q[0] + 12, q[1] - 13], [q[0] + 17, q[1] - 20]], { w: 1.6, color: "#5f8f62", seed: 30 + i, retrace: false }); });
  });
};

export const drawMiraWalk = (ctx: Ctx, f: number, env: Env) => {
  const g = new Gfx(ctx, env, f, PENCIL);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = "#fbf6ea"; ctx.fillRect(0, 0, W, H);
  // the camera creeps in a little over the whole film: never quite a hold
  const u = f / (N - 1), eye: V3 = add(EYE0, [-0.1 * u, -0.03 * u, -0.45 * u]), cam = camera(eye, add(TARGET, [0.08 * u, 0.02 * u, 0]), lensPx(46, W), W * 0.5, H * 0.52);
  drawWorld(g, cam);
  renderStorybook(g, mira.toScene(miraAt(f), cam), MIRA_STORYBOOK);
  g.paper("paper", 0.12); g.vignette("rgba(90,50,50,0.08)"); g.paper("coldpress", 0.16);
};
export const miraWalk: Film = { meta: { title: "Mira walks in", W, H, fps: FPS, bpm: 120, durationFrames: N }, assets: { images: {} }, shots: [{ id: "walkIn", start: 0, end: N, draw: drawMiraWalk }] };
