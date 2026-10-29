// CAMERA (3D). Named moves a director would call, each a pure function of the frame that returns a
// whole camera state: where it stands, what it looks at, the lens and the roll. place() writes a
// state onto a THREE.PerspectiveCamera. Nothing is stepped, so any frame can be drawn first.
//
//   const base = look([0, 1.2, 8], [0, 0.6, 0], 35);
//   const move = withMods(pushIn(base, 0.3, 0, 48), handheld(7, 0.6));
//   place(cam, move(f), env);
//
// Same vocabulary as the 2D camera (canvas-core/camera.ts) and the same craft:
// - A PUSH IS EASED IN log(distance). Halving the distance twice should take twice as long as
//   halving it once; easing the distance itself sprints at the near end.
// - A DOLLY ALONG A PATH RUNS AT CONSTANT SPEED BY ARC LENGTH (getPointAt), then the ease shapes
//   it. Curve parameter u bunches up wherever the control points do, which reads as a stutter.
// - HANDHELD IS SMOOTH SEEDED NOISE, MOSTLY ROTATION. Per-frame random reads as static; a slow
//   aim wander and a little roll is what sells an operator. Never Math.random.
// - A WHIP PAN HOLDS POSED FRAMES ON BOTH ENDS AND HAS NO SMEAR (lesson 46): sharp drawings at each
//   end and a fast move between make the cut without a motion-blur bible break.
// - A MATCH CUT KEEPS SCREEN SIZE: on-screen size is worldSize * H / (2 * D * tan(fov / 2)), so
//   across a lens change keep D * tan(fov / 2) fixed (matchDistance) and the subject holds its size.
// - LEGIBILITY IS MEASURED IN PIXELS (lessons 25, 27): a contact beat needs ~40 px at 1080p, a
//   story-critical line ~2 px. screenSize() and worldForPx() turn a camera into those numbers.
import * as THREE from "three";
import { ease as E, seg, type Ease } from "./time";

export type V3 = [number, number, number];
/** a whole camera: position, the point it looks at, vertical fov in degrees, roll in degrees */
export type CamState = { pos: V3; target: V3; fov: number; roll: number };
/** a camera move: frame in, camera out */
export type Move = (f: number) => CamState;
/** something layered on top of a move (handheld, dutch): state and frame in, new state out */
export type Mod = (s: CamState, f: number) => CamState;
type Size = { W: number; H: number };

const D2R = Math.PI / 180;
const v = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
const arr = (p: THREE.Vector3): V3 => [p.x, p.y, p.z];
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const p = (f: number, f0: number, f1: number, e: Ease) => e(seg(f, f0, f1));

/** a camera state from where it stands and what it looks at */
export const look = (pos: V3, target: V3, fov = 35, roll = 0): CamState => ({ pos: [...pos], target: [...target], fov, roll });
/** a move that never moves (a locked-off shot; add handheld to keep it alive) */
export const hold = (s: CamState): Move => () => ({ ...s, pos: [...s.pos], target: [...s.target] });
/** layer modifiers over a move, in order */
export const withMods = (move: Move, ...mods: Mod[]): Move => (f) => mods.reduce((s, m) => m(s, f), move(f));
/** run one move until frame `at`, then another (a move that hands over without a cut) */
export const then = (a: Move, at: number, b: Move): Move => (f) => (f < at ? a(f) : b(f));

/** write a state onto a three camera: position, lookAt, roll about the view axis, fov (and aspect from env) */
export const place = (cam: THREE.PerspectiveCamera, s: CamState, env?: Size) => {
  cam.position.set(s.pos[0], s.pos[1], s.pos[2]);
  cam.up.set(0, 1, 0);
  cam.lookAt(s.target[0], s.target[1], s.target[2]);
  if (s.roll) cam.rotateZ(s.roll * D2R);
  cam.fov = s.fov;
  if (env) cam.aspect = env.W / env.H;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return cam;
};

// distance moved in log space: equal time per halving
const pushTo = (base: CamState, factor: number, f: number, f0: number, f1: number, e: Ease): CamState => {
  const k = Math.exp(Math.log(factor) * p(f, f0, f1, e)), t = base.target;
  return { ...base, pos: [t[0] + (base.pos[0] - t[0]) * k, t[1] + (base.pos[1] - t[1]) * k, t[2] + (base.pos[2] - t[2]) * k], target: [...t] };
};
/** move toward the target: amount 0.3 ends 30% closer */
export const pushIn = (base: CamState, amount: number, f0: number, f1: number, e: Ease = E.inOutCubic): Move => (f) => pushTo(base, 1 - amount, f, f0, f1, e);
/** move away from the target: amount 0.3 ends 30% farther */
export const pullBack = (base: CamState, amount: number, f0: number, f1: number, e: Ease = E.inOutCubic): Move => (f) => pushTo(base, 1 + amount, f, f0, f1, e);

/** a path for the camera through points (centripetal Catmull-Rom: no loops or overshoot at tight keys) */
export const path = (points: V3[], closed = false) => new THREE.CatmullRomCurve3(points.map(v), closed, "centripetal");
/** travel along a curve at constant speed by arc length; aim at a fixed point, along a second curve, or ahead along the path */
export const dolly = (curve: THREE.Curve<THREE.Vector3>, f0: number, f1: number, o: { target?: V3 | THREE.Curve<THREE.Vector3> | "ahead"; fov?: number; ease?: Ease; lead?: number } = {}): Move => {
  // arc-length table built once here, not on the first draw: getPointAt caches it on the curve
  curve.getLengths();
  return (f) => {
  const t = p(f, f0, f1, o.ease ?? E.inOutSine), pos = arr(curve.getPointAt(t));
  let target: V3;
  // "ahead": look along the travel direction, `lead` units out (the tangent, so it never stalls at the end)
  if (o.target === undefined || o.target === "ahead") target = arr(curve.getPointAt(t).add(curve.getTangentAt(t).multiplyScalar(o.lead ?? 3)));
  else if (Array.isArray(o.target)) target = [o.target[0], o.target[1], o.target[2]];
  else target = arr(o.target.getPointAt(t));
  return { pos, target, fov: o.fov ?? 35, roll: 0 };
  };
};
/** circle a point at a radius and height above it, fromDeg to toDeg (0 deg = on +z, looking toward -z) */
export const orbit = (center: V3, fromDeg: number, toDeg: number, radius: number, height: number, f0: number, f1: number, o: { fov?: number; ease?: Ease } = {}): Move => (f) => {
  const a = (fromDeg + (toDeg - fromDeg) * p(f, f0, f1, o.ease ?? E.inOutSine)) * D2R;
  return { pos: [center[0] + Math.sin(a) * radius, center[1] + height, center[2] + Math.cos(a) * radius], target: [...center], fov: o.fov ?? 35, roll: 0 };
};
/** rise (or sink, negative) by `rise`; follow 0 keeps the aim point (the camera tilts), 1 lifts it too */
export const crane = (base: CamState, rise: number, f0: number, f1: number, o: { follow?: number; ease?: Ease } = {}): Move => (f) => {
  const d = rise * p(f, f0, f1, o.ease ?? E.inOutCubic);
  return { ...base, pos: [base.pos[0], base.pos[1] + d, base.pos[2]], target: [base.target[0], base.target[1] + d * (o.follow ?? 0), base.target[2]] };
};
// the camera's right and up axes for a state (world up is +y)
const axes = (s: CamState) => {
  const fwd = v(s.target).sub(v(s.pos)).normalize(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  return { fwd, right, up: new THREE.Vector3().crossVectors(right, fwd) };
};
/** slide sideways (positive = camera right), aim point and all */
export const truck = (base: CamState, dx: number, f0: number, f1: number, e: Ease = E.inOutCubic): Move => {
  const r = arr(axes(base).right);
  return (f) => { const d = dx * p(f, f0, f1, e); return { ...base, pos: lerp3(base.pos, [base.pos[0] + r[0], base.pos[1] + r[1], base.pos[2] + r[2]], d), target: lerp3(base.target, [base.target[0] + r[0], base.target[1] + r[1], base.target[2] + r[2]], d) }; };
};
const turnAim = (s: CamState, axis: THREE.Vector3, deg: number): V3 => arr(v(s.target).sub(v(s.pos)).applyAxisAngle(axis, deg * D2R).add(v(s.pos)));
/** turn the camera on its head left or right (positive = left) */
export const pan = (base: CamState, deg: number, f0: number, f1: number, e: Ease = E.inOutCubic): Move => (f) => ({ ...base, pos: [...base.pos], target: turnAim(base, new THREE.Vector3(0, 1, 0), deg * p(f, f0, f1, e)) });
/** nod the camera up or down (positive = up) */
export const tilt = (base: CamState, deg: number, f0: number, f1: number, e: Ease = E.inOutCubic): Move => { const r = axes(base).right; return (f) => ({ ...base, pos: [...base.pos], target: turnAim(base, r, deg * p(f, f0, f1, e)) }); };
/**
 * A fast pan from one aim to another: the first `hold` frames sit on `from`, the last `hold` on `to`,
 * the move between is an expo in-out with no smear. Both states may differ in position too.
 */
export const whipPan = (from: CamState, to: CamState, f0: number, f1: number, o: { hold?: number } = {}): Move => {
  const h = o.hold ?? 2;
  if (f1 - f0 < 2 * h + 2) throw new Error(`whipPan: ${f1 - f0} frames is too short for ${h} held frames each end plus a move`);
  // aim swings on a sphere around the moving position, so the pan reads as a turn, not a slide
  return (f) => {
    const t = E.inOutExpo(seg(f, f0 + h, f1 - h)), pos = lerp3(from.pos, to.pos, t);
    const da = v(from.target).sub(v(from.pos)), db = v(to.target).sub(v(to.pos)), la = da.length(), lb = db.length();
    const q = new THREE.Quaternion().setFromUnitVectors(da.clone().normalize(), db.clone().normalize()), dir = da.clone().normalize().applyQuaternion(new THREE.Quaternion().slerp(q, t));
    return { pos, target: arr(dir.multiplyScalar(la + (lb - la) * t).add(v(pos))), fov: from.fov + (to.fov - from.fov) * t, roll: from.roll + (to.roll - from.roll) * t };
  };
};
/** roll the frame: a fixed angle, or a function of the frame for an eased dutch */
export const dutch = (roll: number | ((f: number) => number)): Mod => (s, f) => ({ ...s, roll: s.roll + (typeof roll === "number" ? roll : roll(f)) });
/** change the lens over time (deg): a zoom, which unlike a push keeps every depth's proportion */
export const zoom = (fromFov: number, toFov: number, f0: number, f1: number, e: Ease = E.inOutCubic): Mod => (s, f) => ({ ...s, fov: fromFov + (toFov - fromFov) * p(f, f0, f1, e) });

// ---- seeded smooth noise
/** a pure hash of (seed, i) to [0, 1): no sequence, so any i can be asked first */
export const hash01 = (seed: number, i: number) => {
  let h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i | 0, 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
/** smooth 1D value noise in [-1, 1]: quintic between seeded lattice values one unit apart */
export const noise1 = (seed: number, x: number) => {
  const i = Math.floor(x), t = x - i, s = t * t * t * (t * (t * 6 - 15) + 10);
  const a = hash01(seed, i) * 2 - 1, b = hash01(seed, i + 1) * 2 - 1;
  return a + (b - a) * s;
};
/**
 * An operator holding the camera: aim wander, roll and a little sway, all seeded smooth noise.
 * amount 1 = about 0.5 deg of aim wander; freq in wobbles per second at 24 fps (default 0.6).
 */
export const handheld = (seed: number, amount = 1, o: { freq?: number; fps?: number } = {}): Mod => (s, f) => {
  const x = (f / (o.fps ?? 24)) * (o.freq ?? 0.6), n = (k: number) => noise1(seed * 31 + k, x + k * 0.37) * 0.7 + noise1(seed * 31 + k + 9, x * 2.3) * 0.3;
  const { right, up } = axes(s), dist = v(s.target).sub(v(s.pos)).length(), aim = Math.tan(0.5 * amount * D2R) * dist, sway = 0.004 * amount * dist;
  const dt = right.clone().multiplyScalar(n(1) * aim).add(up.clone().multiplyScalar(n(2) * aim));
  const dp = right.clone().multiplyScalar(n(3) * sway).add(up.clone().multiplyScalar(n(4) * sway));
  return { pos: arr(v(s.pos).add(dp)), target: arr(v(s.target).add(dt).add(dp)), fov: s.fov, roll: s.roll + n(5) * 0.35 * amount };
};

// ---- framing and legibility
/**
 * Frame a box (or an object's bounds): look from `dir` (pointing from the subject toward the
 * camera) at the box centre, at the distance where the box's furthest corner sits `padding` in
 * from the frame edge (padding 1.15 = 15% margin). Solved by bisection on the projected corners,
 * so it is exact for this aspect, not the loose bounding-sphere fit.
 */
export const fitTo = (subject: THREE.Box3 | THREE.Object3D, o: { padding?: number; dir?: V3; fov?: number; aspect?: number } = {}): CamState => {
  const box = (subject as THREE.Box3).isBox3 ? (subject as THREE.Box3) : new THREE.Box3().setFromObject(subject as THREE.Object3D);
  if (box.isEmpty()) throw new Error("fitTo: the subject has no bounds");
  const c = box.getCenter(new THREE.Vector3()), dir = v(o.dir ?? [0, 0.25, 1]).normalize(), fov = o.fov ?? 35, aspect = o.aspect ?? 16 / 9, pad = o.padding ?? 1.15;
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.01, 1e5);
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  const reach = (d: number) => {
    cam.position.copy(c).addScaledVector(dir, d); cam.lookAt(c); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
    let m = 0; for (const k of corners) { const q = k.clone().applyMatrix4(cam.matrixWorldInverse); if (-q.z <= cam.near) return Infinity; const n = k.clone().project(cam); m = Math.max(m, Math.abs(n.x), Math.abs(n.y)); }
    return m;
  };
  let lo = 1e-3, hi = Math.max(1, box.getSize(new THREE.Vector3()).length()) * 2;
  while (reach(hi) > 1 / pad) hi *= 2;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (reach(mid) > 1 / pad) lo = mid; else hi = mid; }
  return { pos: arr(c.clone().addScaledVector(dir, hi)), target: arr(c), fov, roll: 0 };
};
/** a focus distance racked from one subject distance to another, eased in dioptres (1/d): how a real focus ring moves */
export const rackFocus = (f: number, f0: number, f1: number, fromDist: number, toDist: number, e: Ease = E.inOutCubic) => 1 / (1 / fromDist + (1 / toDist - 1 / fromDist) * p(f, f0, f1, e));
/** pixels an object worldSize tall covers at `distance` from the camera, at the film's height */
export const screenSize = (cam: { fov: number }, worldSize: number, distance: number, env: Size) => (worldSize * env.H) / (2 * distance * Math.tan((cam.fov * D2R) / 2));
/** the world size that covers `px` pixels at `distance`: size a thin story line by its screen width (lesson 27) */
export const worldForPx = (cam: { fov: number }, px: number, distance: number, env: Size) => (px * 2 * distance * Math.tan((cam.fov * D2R) / 2)) / env.H;
/** the camera distance that shows a subject worldSize tall at `px` pixels through this fov (D = K / tan(fov/2)) */
export const matchCut = (worldSize: number, px: number, fovDeg: number, env: Size) => (worldSize * env.H) / (2 * px * Math.tan((fovDeg * D2R) / 2));
/** the distance through fovB that keeps the size a subject had at distance dA through fovA */
export const matchDistance = (dA: number, fovA: number, fovB: number) => (dA * Math.tan((fovA * D2R) / 2)) / Math.tan((fovB * D2R) / 2);
/** a state through a new lens with the subject at its target holding its screen size (the camera slides along its view axis) */
export const matchLens = (s: CamState, fov: number): CamState => {
  const d = v(s.pos).sub(v(s.target)), k = matchDistance(d.length(), s.fov, fov) / d.length();
  return { ...s, fov, pos: arr(v(s.target).add(d.multiplyScalar(k))), target: [...s.target] };
};
/** where a world point lands on the film, in film pixels [x, y] (call place() first); z > 1 means behind the camera */
export const screenPx = (cam: THREE.PerspectiveCamera, world: V3 | THREE.Vector3, env: Size): [number, number, number] => {
  const q = (Array.isArray(world) ? v(world as V3) : world.clone()).project(cam);
  return [((q.x + 1) / 2) * env.W, ((1 - q.y) / 2) * env.H, q.z];
};
/** distance from the camera to a world point along its view axis (what screenSize wants) */
export const depthOf = (cam: THREE.Camera, world: V3) => -v(world).applyMatrix4(cam.matrixWorldInverse).z;
