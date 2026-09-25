// THE LINKAGE. What actually drives the wings, and the reason Act 3 can be honest: a CRANK on
// the centre-wheel arbor, a CONNECTING ROD, and a rocking BELL-CRANK at each wing root that
// lifts the leading spar. `flap` is computed FROM the bell-crank angle, which is computed from
// the crank angle, so a rod and a wing can never disagree on screen.
import { P } from "../core";
import { CX, CY, THORAX, cen } from "./geom";

const O = cen(THORAX);
export const ARBOR: P = [O[0] + 2, O[1] + 4]; // the centre wheel's arbor, the same one Act 1 and 2 draw
export const RC = 17, ARM = 26, ROD = 58, OUT = 21, LAG = (8 * Math.PI) / 180; // crank throw, input arm, rod, output arm, and the starboard side's lag in crank angle
export const pivot = (side: number): P => [CX + side * 44, CY - 52]; // the bell-crank pivot, just inboard of the forewing hinge
export const crankPin = (th: number): P => [ARBOR[0] + Math.cos(th) * RC, ARBOR[1] + Math.sin(th) * RC];

// the bell-crank angle that puts the rod's far end exactly ROD from the crank pin
export const bellAngle = (side: number, th: number): number => {
  const P0 = crankPin(th - (side > 0 ? LAG : 0)), Q = pivot(side), dx = P0[0] - Q[0], dy = P0[1] - Q[1], d = Math.hypot(dx, dy) || 1;
  const c = Math.max(-1, Math.min(1, (ARM * ARM + d * d - ROD * ROD) / (2 * ARM * d)));
  return Math.atan2(dy, dx) + side * Math.acos(c); /* one branch per side, so the two arms mirror */
};
export const armEnd = (side: number, th: number): P => { const a = bellAngle(side, th), Q = pivot(side); return [Q[0] + Math.cos(a) * ARM, Q[1] + Math.sin(a) * ARM]; };
export const outEnd = (side: number, th: number): P => { const a = bellAngle(side, th) + side * Math.PI * 0.62, Q = pivot(side); return [Q[0] + Math.cos(a) * OUT, Q[1] + Math.sin(a) * OUT]; }; /* the arm that actually lifts the spar */

// the swing of the bell-crank over one revolution, measured once, so flap can be mapped onto it
const swing = (side: number) => { let lo = 1e9, hi = -1e9; for (let i = 0; i < 360; i++) { const a = bellAngle(side, (i / 360) * Math.PI * 2); lo = Math.min(lo, a); hi = Math.max(hi, a); } return [lo, hi] as const; };
const SW = [swing(-1), swing(1)];
export const flapOf = (side: number, th: number): number => { const [lo, hi] = SW[side > 0 ? 1 : 0], a = bellAngle(side, th), t = (a - lo) / (hi - lo || 1); return 1 - 0.62 * (side > 0 ? 1 - t : t); };
// the crank angle whose flap is closest to a wanted one: how Act 3 starts on Act 2's last pose
export const crankFor = (flap: number): number => { let best = 0, bd = 9; for (let i = 0; i < 720; i++) { const th = (i / 720) * Math.PI * 2, d = Math.abs(flapOf(-1, th) - flap); if (d < bd) { bd = d; best = th; } } return best; };
