// THE WALK, from footsteps. A walk is a list of heel strikes (which foot, when, where); every
// frame is solved from it: each foot is either PLANTED (heel strike, rolling flat, heel lifting,
// pushing off the ball) or SWINGING on an arc to its next strike; the pelvis rides over the
// planted foot, lowest at double support and highest at mid-stance; the pelvis turns toward the
// swinging leg and the ribcage turns against it; the arms swing against the legs; the head stays
// level. Legs are solved with the analytic IK, so a foot never slides while it is planted.
//
// Reference opened: Richard Williams, "The Animator's Survival Kit" (2001), the walk chapter
// (contact, down, passing, up; the arms opposite the legs; the down position just after contact);
// Perry & Burnfield, "Gait Analysis" (2010) for the timing: stance ~60% and swing ~40% of the
// cycle, heel rocker / ankle rocker / forefoot rocker, knee ~15 deg at loading, ~60 deg in swing.
import { DEG, V3, add, mul } from "../math3";
import type { Pose } from "../types";
import { stand } from "./balance";
import type { Dims, Side } from "./skeleton";

export type Strike = { side: Side; t: number; s: number };                  // frame, distance along the path of the HEEL contact
export type WalkPlan = { strikes: Strike[]; cycle: number; stance: number; lift: number; stride: number; rootS: (t: number) => number; stopAt: number; lateral: number };

const ease = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

// Walk `n` steps from s0, first foot `first`, a step every `cycle/2` frames starting at t0, then
// bring the trailing foot up beside the leading one and settle.
export const planWalk = (o: { t0: number; s0: number; step: number; cycle: number; n: number; first: Side; lateral: number }): WalkPlan => {
  const half = o.cycle / 2, v = o.step / half, strikes: Strike[] = [];
  const other = (s: Side): Side => (s === "L" ? "R" : "L");
  let side = o.first;
  // the root is a little behind the leading heel at strike (the heel lands ~40% of a step ahead)
  const ahead = o.step * 0.42;
  for (let k = 0; k < o.n; k++) { const t = o.t0 + k * half; strikes.push({ side, t, s: o.s0 + v * (t - o.t0) + ahead }); side = other(side); }
  // the closing step: the trailing foot comes up level with the leading one
  const last = strikes[strikes.length - 1], tClose = last.t + half;
  strikes.push({ side, t: tClose, s: last.s });
  const tStop = tClose + half * 0.9, sStop = last.s - o.step * 0.12, tDec = last.t - half * 0.2, sDec = o.s0 + v * (tDec - o.t0);
  const rootS = (t: number) => {
    if (t <= tDec) return o.s0 + v * (t - o.t0);
    if (t >= tStop) return sStop;
    // Hermite from (tDec, sDec, v) to (tStop, sStop, 0)
    const T = tStop - tDec, u = (t - tDec) / T, h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u;
    return h00 * sDec + h10 * T * v + h01 * sStop;
  };
  return { strikes, cycle: o.cycle, stance: o.cycle * 0.6, lift: 0, stride: o.step * 2, rootS, stopAt: tStop, lateral: o.lateral };
};

// the foot's pitch (toes up +) and which point it pivots on, through stance
const stancePitch = (phi: number): { pitch: number; pivot: "heel" | "flat" | "ball" } => {
  if (phi < 0.12) return { pitch: 14 * (1 - ease(phi / 0.12)), pivot: "heel" };                 // heel rocker
  if (phi < 0.5) return { pitch: 0, pivot: "flat" };                                         // ankle rocker
  return { pitch: -38 * Math.pow((phi - 0.5) / 0.5, 1.4), pivot: "ball" };                     // forefoot rocker, push-off
};

// sagittal (forward f, up u) position of the ankle for a foot whose heel contact is at f = s
const ankleAt = (d: Dims, s: number, pitch: number, pivot: "heel" | "flat" | "ball"): [number, number] => {
  const p = pitch * DEG, rot = (f: number, u: number): [number, number] => [f * Math.cos(p) - u * Math.sin(p), f * Math.sin(p) + u * Math.cos(p)];
  const heelToAnkle: [number, number] = [d.heel * 0.9, d.ankleH], ball = s + d.heel * 0.9 + d.ball;
  if (pivot === "ball") { const r = rot(-d.ball, d.ankleH); return [ball + r[0], r[1]]; }
  const r = rot(heelToAnkle[0], heelToAnkle[1]); return [s + r[0], r[1]];
};

export type WalkFrame = { pose: Pose; phase: number; amp: number };
// Pose at frame t. `path` is where s = 0 is, and which way is forward (a unit vector on the floor).
export const walkAt = (d: Dims, plan: WalkPlan, t: number, base: Pose, path: { origin: V3; dir: V3 }, style: { armSwing?: number; bob?: number; twist?: number } = {}): WalkFrame => {
  const fwd = path.dir, yaw = Math.atan2(fwd[0], fwd[2]) / DEG, left: V3 = [Math.cos(yaw * DEG), 0, -Math.sin(yaw * DEG)];
  const at = (s: number, l: number, u: number): V3 => add(add(path.origin, mul(fwd, s)), add(mul(left, l), [0, u, 0]));
  const feet = {} as Record<Side, V3>, pitch = {} as Record<Side, number>;
  const lastStrike = plan.strikes[plan.strikes.length - 1];
  for (const side of ["L", "R"] as Side[]) {
    const mine = plan.strikes.filter((k) => k.side === side), lat = (side === "L" ? 1 : -1) * plan.lateral;
    let k = -1; for (let i = 0; i < mine.length; i++) if (mine[i].t <= t) k = i;
    const next = mine[k + 1];
    if (k < 0) { // before this foot's first strike: planted where it stood, one step back, lifting at the end
      const s0 = next.s - plan.stride, tOff = next.t - (plan.cycle - plan.stance);
      if (t < tOff) { const phi = 0.5 + 0.5 * clamp01((t - (tOff - plan.stance * 0.5)) / (plan.stance * 0.5)), sp = stancePitch(phi), a = ankleAt(d, s0, sp.pitch, sp.pivot); feet[side] = at(a[0], lat, a[1]); pitch[side] = sp.pitch; }
      else { const u = clamp01((t - tOff) / (next.t - tOff)), A = ankleAt(d, s0, -38, "ball"), B = ankleAt(d, next.s, 14, "heel"), e = ease(u); feet[side] = at(A[0] + (B[0] - A[0]) * e, lat, A[1] + (B[1] - A[1]) * e + d.ankleH * 0.55 * Math.sin(Math.PI * Math.pow(u, 0.8))); pitch[side] = -38 + 52 * e; }
      continue;
    }
    const cur = mine[k], isLast = cur === lastStrike || !next;
    const stanceEnd = isLast ? Infinity : cur.t + plan.stance;
    if (t < stanceEnd) {
      const phi = isLast ? Math.min(0.49, (t - cur.t) / plan.stance) : (t - cur.t) / plan.stance, sp = stancePitch(phi), a = ankleAt(d, cur.s, sp.pitch, sp.pivot);
      feet[side] = at(a[0], lat, a[1]); pitch[side] = sp.pitch;
    } else {
      const u = clamp01((t - stanceEnd) / (next.t - stanceEnd)), A = ankleAt(d, cur.s, -38, "ball"), closing = next === lastStrike, B = ankleAt(d, next.s, closing ? 4 : 14, "heel"), e = ease(u);
      feet[side] = at(A[0] + (B[0] - A[0]) * e, lat, A[1] + (B[1] - A[1]) * e + d.ankleH * (closing ? 0.35 : 0.55) * Math.sin(Math.PI * Math.pow(u, 0.8)));
      pitch[side] = -38 + (closing ? 42 : 52) * e;
    }
  }
  // the gait phase: 0 at a left heel strike, 0.5 at a right one; the amplitude fades as she stops
  const Ls = plan.strikes.filter((k) => k.side === "L"), prevL = [...Ls].reverse().find((k) => k.t <= t) ?? Ls[0];
  const phase = ((t - prevL.t) / plan.cycle) % 1, amp = clamp01((plan.stopAt - t) / (plan.cycle * 0.75)), c = Math.cos(2 * Math.PI * phase) * amp, s2 = Math.cos(4 * Math.PI * phase) * amp;
  const A = style.armSwing ?? 22, tw = style.twist ?? 6;
  const arm = (a: number) => { const side = 7, r = Math.hypot(a, side); return { raise: r, swing: (Math.atan2(a, side) / DEG) }; };
  const aL = arm(-A * c), aR = arm(A * c);
  const joints = { ...base.joints,
    pelvisTwist: -tw * c, spineTwist: tw * 1.7 * c, neckTwist: -tw * 0.6 * c, pelvisSide: 2.5 * Math.sin(2 * Math.PI * phase) * amp,
    shoulderRaiseL: aL.raise, shoulderSwingL: aL.swing, shoulderRaiseR: aR.raise, shoulderSwingR: aR.swing,
    elbowL: 14 + 16 * Math.max(0, -c), elbowR: 14 + 16 * Math.max(0, c), spineBend: (base.joints.spineBend ?? 0) + 3 * amp };
  const bob = (style.bob ?? 0.022) * amp;
  const root: V3 = at(plan.rootS(t), 0, base.root[1] - bob * (0.5 + 0.5 * s2) - 0.012 * amp);
  const pose = stand(d, { ...base, root, yaw, joints, plant: false }, feet, null, pitch, 1);
  return { pose, phase, amp };
};
