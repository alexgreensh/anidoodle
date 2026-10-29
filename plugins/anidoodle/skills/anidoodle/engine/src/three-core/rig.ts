// RIG. Posable characters from primitives: a biped, a quadruped, a crab, a mascot. A rig is a tree
// of groups built ONCE (memo it), and pose(rig, p) sets every joint from the pose alone, so any frame
// can be posed first. Nothing here reads a clock or keeps a value from the pose before.
//
//   makeRig(name)               root (placed in the world) > hips (bob, lean) > body (the squashable torso)
//   part(rig, parent, name, m)  add a mesh with a part name (the checks report hits by part name)
//   limb(rig, name, opts)       a two-bone chain (arm, leg, claw) with its own end (hand, foot), posable at once
//   head(rig, name, opts)       a head that can turn to look at things
//   flag(rig, name, apply)      a custom pose flag (blink, antenna) that THIS rig supports
//   handle(prop, a, b, r)       declare the segment of a prop a hand can hold (grip and the checks read it)
//   pose(rig, p)                put the whole character in a pose; unknown limbs or flags THROW
//
// Why limbs are the default: a rig whose arms are fixed geometry plays every shot with frozen hands,
// and retrofitting an arm rig after shots are rendered costs a reshoot (lessons 10 and 23). Why
// unknown flags throw: a flag built into one variant of a rig silently did nothing on the other
// variant, and only a render showed it (lesson 32).
//
// Verbs for the director: solveTwoBone (the IK), grip (a prop held along the hand's axis through
// the grip), bodyMatrix (where the body will be, without posing meshes), lookAt, followThrough,
// squashStretch, walkCycle, anticipate.
import * as THREE from "three";
import { clamp01, ease, lerp, seg, spring, type Ease } from "./time";

type V3 = THREE.Vector3;
export type Vec = [number, number, number];
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const vec = (a: Vec | V3) => (Array.isArray(a) ? v3(a[0], a[1], a[2]) : a.clone());
const UP = v3(0, 1, 0);

// ---------------------------------------------------------------- two-bone IK
export type TwoBone = { mid: V3; end: V3; reached: boolean; bend: number };
/**
 * Analytic two-bone IK (law of cosines). root, mid, end give the bone lengths; the answer puts the
 * end on the target when it can, and the middle joint on the side of the pole point. A target out
 * of reach gives a straight limb pointing at it; one too close folds the limb as far as it goes.
 * Deterministic and exact: no iterations, so no frame ever depends on the frame before.
 */
export const solveTwoBone = (root: V3, mid: V3, end: V3, target: V3, pole: V3): TwoBone => {
  const L1 = root.distanceTo(mid), L2 = mid.distanceTo(end);
  const d = target.clone().sub(root);
  let D = d.length();
  const dir = D > 1e-9 ? d.divideScalar(D) : end.clone().sub(root).normalize();
  const maxD = L1 + L2, minD = Math.abs(L1 - L2);
  const reached = D <= maxD + 1e-9 && D >= minD - 1e-9;
  D = Math.min(maxD, Math.max(minD + 1e-9, D));
  const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  // the bend plane: the pole's offset from the root, minus its part along the limb
  const p = pole.clone().sub(root), perp = p.sub(dir.clone().multiplyScalar(p.dot(dir)));
  if (perp.lengthSq() < 1e-12) perp.copy(v3().crossVectors(dir, Math.abs(dir.y) < 0.9 ? UP : v3(1, 0, 0)));
  perp.normalize();
  const m = root.clone().addScaledVector(dir, a).addScaledVector(perp, h), e = root.clone().addScaledVector(dir, D);
  const bend = m.clone().sub(root).angleTo(e.clone().sub(m)); // 0 = straight
  return { mid: m, end: e, reached, bend };
};

// ---------------------------------------------------------------- the rig
export type LimbPose = {
  /** where the end goes, in WORLD space (a hand on a bar, a foot on a step) */
  target?: V3;
  /** an offset from the rest end, in the limb's parent space (a swing, a wave) */
  offset?: Vec | V3;
  /** 0..1 blend from the rest (or offset) end to `target`: ease a reach in and out with it */
  weight?: number;
  /** a different bend direction for this pose, in the parent's space (a world point is NOT expected) */
  pole?: Vec | V3;
  /** put the hand's grip point on `point` with its grip axis along `axis` (world): reachFor a handle */
  grip?: { point: V3; axis: V3 };
  /** wrist: pitch and twist of the end in radians, after it is aimed (a flick, a toe lift) */
  wrist?: [pitch: number, twist: number];
};
export type Limb = {
  name: string; rig: Rig;
  root: THREE.Group; upper: THREE.Mesh; lower: THREE.Mesh; joints: THREE.Mesh[]; end: THREE.Group;
  L1: number; L2: number; base: V3; rest: V3; pole: V3; endMode: "forearm" | "level";
  gripPoint: V3; gripAxis: V3;
  /** the last solve (read it to know whether the target was reached) */
  solved: TwoBone;
};
export type Head = { name: string; pivot: THREE.Group; max: [yaw: number, pitch: number] };
export type Rig = {
  name: string; root: THREE.Group; hips: THREE.Group; body: THREE.Group;
  hipHeight: number;
  limbs: Record<string, Limb>; heads: Record<string, Head>;
  flags: Record<string, (rig: Rig, value: number, p: Pose) => void>;
  /** groups whose rest position rides the squash of the body (shoulders, the neck) */
  anchors: { obj: THREE.Object3D; base: V3 }[];
};
export type Pose = {
  at?: Vec | V3; yaw?: number;
  /** hip height offset (a bob, a crouch); legs solved to world feet stay planted */
  lift?: number;
  /** forward pitch of the hips (radians), side tilt, and twist about the spine */
  lean?: number; tilt?: number; twist?: number;
  /** volume-preserving squash (negative) or stretch (positive) of the body */
  squash?: number;
  /** turn a head to a world point: amount 0..1 blends from straight ahead */
  look?: { target: V3; amount?: number; head?: string };
  /** limbs by full name ("arms.left", "claws.big") */
  limbs?: Record<string, LimbPose>;
  /** sugar: arms.left is limbs["arms.left"], legs.right is limbs["legs.right"] */
  arms?: Record<string, LimbPose>; legs?: Record<string, LimbPose>;
  /** this rig's own flags (registered with flag()); a flag it does not have throws */
  flags?: Record<string, number | boolean>;
};

/** A new empty character: root > hips (at hipHeight) > body. Add parts, limbs and heads to it. */
export const makeRig = (name: string, opts: { hipHeight?: number } = {}): Rig => {
  const root = new THREE.Group(), hips = new THREE.Group(), body = new THREE.Group();
  root.name = `${name}`; hips.name = `${name}.hips`; body.name = `${name}.body`;
  root.add(hips); hips.add(body);
  const hipHeight = opts.hipHeight ?? 0;
  hips.position.y = hipHeight;
  hips.rotation.order = "YXZ";
  const r: Rig = { name, root, hips, body, hipHeight, limbs: {}, heads: {}, flags: {}, anchors: [] };
  root.userData.rig = r;
  return r;
};

/** Add a mesh under `parent` with a part name the checks will print ("visor", "arms.left.hand"). */
export const part = <T extends THREE.Object3D>(rig: Rig, parent: THREE.Object3D, name: string, obj: T): T => {
  (obj as THREE.Object3D).traverse((o: THREE.Object3D) => { if ((o as THREE.Mesh).isMesh) { o.userData.part ??= name; o.castShadow = true; o.receiveShadow = true; } });
  (obj as THREE.Object3D).name ||= name;
  parent.add(obj);
  void rig;
  return obj;
};

/** Make a group ride the body's squash: its rest position scales with the torso (shoulders, the neck). */
export const anchor = (rig: Rig, obj: THREE.Object3D, at: Vec | V3) => { const b = vec(at); obj.position.copy(b); rig.anchors.push({ obj, base: b }); return obj; };

export type LimbOpts = {
  /** what the limb hangs from (default: the hips). Its root rides the squash when it hangs from the hips */
  parent?: THREE.Object3D;
  /** the root joint (shoulder, hip) in the parent's space */
  at: Vec;
  /** upper and lower bone lengths */
  lengths: [number, number];
  /** bone radius (one number, or [upper, lower]) */
  radius?: number | [number, number];
  /** where the end rests, relative to the root joint, in the parent's space */
  rest: Vec;
  /** which way the middle joint bends at rest (elbows back, knees forward): a direction in the parent's space */
  pole: Vec;
  material: THREE.Material;
  jointMaterial?: THREE.Material;
  /** the end (a hand, a foot, a claw), built in its own frame: +y runs along the forearm out of the wrist */
  end?: (limb: Limb) => THREE.Object3D;
  /** the point a handle passes through, and the axis it runs along, in the end's frame (default: 1.6 radii out, along x) */
  gripPoint?: Vec; gripAxis?: Vec;
  /** "forearm": the end follows the lower bone (hands). "level": it stays level with the parent (feet) */
  endMode?: "forearm" | "level";
  /** smoothness of the bones */
  segments?: number;
};
/** Add a two-bone limb. It is posable at once: pose(rig, { limbs: { [name]: { target } } }). */
export const limb = (rig: Rig, name: string, o: LimbOpts): Limb => {
  if (rig.limbs[name]) throw new Error(`limb: ${rig.name} already has a limb called "${name}"`);
  const [L1, L2] = o.lengths, [r1, r2] = typeof o.radius === "number" ? [o.radius, o.radius * 0.9] : o.radius ?? [0.1 * L1, 0.09 * L2];
  const parent = o.parent ?? rig.hips, seg = o.segments ?? 12;
  const root = new THREE.Group(); root.name = `${name}.root`; parent.add(root);
  if (parent === rig.hips) anchor(rig, root, o.at); else root.position.set(...o.at);
  const bone = (r: number, L: number, nm: string) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(1e-4, L - r * 0.2), 4, seg), o.material); m.userData.part = nm; m.castShadow = m.receiveShadow = true; root.add(m); return m; };
  const upper = bone(r1, L1, `${name}.upper`), lower = bone(r2, L2, `${name}.lower`);
  const jm = o.jointMaterial ?? o.material;
  const joints = [r1 * 1.15, r2 * 1.15].map((r, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), jm); m.userData.part = `${name}.${i ? "mid" : "root"}joint`; m.castShadow = m.receiveShadow = true; root.add(m); return m; });
  const end = new THREE.Group(); end.name = `${name}.end`; root.add(end);
  const rest = vec(o.rest), pole = vec(o.pole).normalize();
  const L: Limb = { name, rig, root, upper, lower, joints, end, L1, L2, base: vec(o.at), rest, pole, endMode: o.endMode ?? "forearm",
    gripPoint: o.gripPoint ? vec(o.gripPoint) : v3(0, r2 * 1.6, 0), gripAxis: (o.gripAxis ? vec(o.gripAxis) : v3(1, 0, 0)).normalize(), solved: { mid: v3(), end: rest.clone(), reached: true, bend: 0 } };
  if (o.end) { const e = o.end(L); e.traverse((n) => { if ((n as THREE.Mesh).isMesh) { n.userData.part ??= `${name}.end`; n.castShadow = n.receiveShadow = true; } }); end.add(e); }
  rig.limbs[name] = L;
  setLimb(L, rest);
  return L;
};

const Q = new THREE.Quaternion();
const restMid = (L: Limb) => { const d = L.rest.clone(), n = d.length() || 1; return d.clone().multiplyScalar(L.L1 / (L.L1 + L.L2)).addScaledVector(L.pole, 0.3 * n); };
/** Solve a limb so its end sits at `endLocal` (in the limb root's space) and place its meshes. */
const setLimb = (L: Limb, endLocal: V3, lp: LimbPose = {}, axisLocal?: V3, endQ?: THREE.Quaternion) => {
  const root = v3(), mid0 = restMid(L).setLength(L.L1), end0 = mid0.clone().add(L.rest.clone().sub(mid0).setLength(L.L2));
  const pole = lp.pole ? vec(lp.pole).normalize() : L.pole;
  const s = solveTwoBone(root, mid0, end0, endLocal, pole.clone().multiplyScalar(L.L1 + L.L2));
  L.solved = s;
  const put = (m: THREE.Mesh, a: V3, b: V3) => { m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize()); };
  put(L.upper, root, s.mid); put(L.lower, s.mid, s.end);
  L.joints[0].position.copy(root); L.joints[1].position.copy(s.mid);
  L.end.position.copy(s.end);
  L.end.quaternion.copy(endQ ?? endFrame(L, s, pole, axisLocal));
  if (lp.wrist) L.end.quaternion.multiply(Q.setFromEuler(new THREE.Euler(lp.wrist[0], lp.wrist[1], 0, "YXZ")));
};
// The end's frame. A hand: +y along the forearm; its grip axis across it, on the side away from the
// bend (so a fist's handle runs across the knuckles), or turned to a requested axis. A foot: level.
const endFrame = (L: Limb, s: TwoBone, pole: V3, axisLocal?: V3) => {
  if (L.endMode === "level") return new THREE.Quaternion();
  let y = s.end.clone().sub(s.mid).normalize(), x: V3;
  if (axisLocal && axisLocal.lengthSq() > 1e-10) {
    // a grip: the axis is honoured exactly and the wrist bends (a handle off the jaw axis clips the jaw)
    x = axisLocal.clone().normalize(); const yy = y.clone().sub(x.clone().multiplyScalar(y.dot(x)));
    y = yy.lengthSq() > 1e-10 ? yy.normalize() : v3().crossVectors(x, Math.abs(x.z) < 0.9 ? v3(0, 0, 1) : v3(1, 0, 0)).normalize();
  } else {
    x = v3().crossVectors(y, pole);
    if (x.lengthSq() < 1e-10) x = v3().crossVectors(y, Math.abs(y.z) < 0.9 ? v3(0, 0, 1) : v3(1, 0, 0));
    x.normalize();
  }
  // the declared grip axis sits along end-local gripAxis; build the basis so gripAxis maps to x
  const z = v3().crossVectors(x, y).normalize(), basis = new THREE.Matrix4().makeBasis(x, y, z), q = new THREE.Quaternion().setFromRotationMatrix(basis);
  const toAxis = new THREE.Quaternion().setFromUnitVectors(v3(1, 0, 0), L.gripAxis);
  return q.multiply(toAxis.invert());
};

// the hand's turn for a grip: grip axis along the handle, fingers pointing from the root joint to it
const gripTurn = (L: Limb, ptLocal: V3, axisLocal: V3) => {
  const x = axisLocal.clone().normalize(); let y = ptLocal.clone().sub(x.clone().multiplyScalar(ptLocal.dot(x)));
  if (y.lengthSq() < 1e-10) y = L.rest.clone().sub(x.clone().multiplyScalar(L.rest.dot(x)));
  if (y.lengthSq() < 1e-10) y = v3().crossVectors(x, Math.abs(x.z) < 0.9 ? v3(0, 0, 1) : v3(1, 0, 0));
  y.normalize();
  const z = v3().crossVectors(x, y).normalize(), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  return q.multiply(new THREE.Quaternion().setFromUnitVectors(v3(1, 0, 0), L.gripAxis).invert());
};

/** A head: a pivot at `at` (in the parent's space, riding the squash) that lookAt and pose.look turn. */
export const head = (rig: Rig, name: string, o: { parent?: THREE.Object3D; at: Vec; max?: [number, number] }): Head => {
  const pivot = new THREE.Group(); pivot.name = name; pivot.rotation.order = "YXZ";
  const parent = o.parent ?? rig.hips; parent.add(pivot);
  if (parent === rig.hips) anchor(rig, pivot, o.at); else pivot.position.set(...o.at);
  const h: Head = { name, pivot, max: o.max ?? [1.2, 0.6] };
  rig.heads[name] = h;
  return h;
};

/** Register a pose flag this rig supports. pose() calls apply(rig, value) and throws on any other flag. */
export const flag = (rig: Rig, name: string, apply: (rig: Rig, value: number, p: Pose) => void) => { rig.flags[name] = apply; };

const HIPS_EULER = new THREE.Euler(0, 0, 0, "YXZ");
/**
 * Where the body goes for a pose, as matrices, WITHOUT touching a mesh: root and hips in world
 * space, and toWorld() for any point in hips space (a shoulder, the chest). Plan a reach or a camera
 * from it before posing anything (lesson 24: a world-space grip used to cost a whole extra build).
 */
export const bodyMatrix = (rig: Rig, p: Pose = {}) => {
  const root = new THREE.Matrix4().compose(p.at ? vec(p.at) : v3(), new THREE.Quaternion().setFromAxisAngle(UP, p.yaw ?? 0), v3(1, 1, 1));
  if (rig.root.parent) { rig.root.parent.updateWorldMatrix(true, false); root.premultiply(rig.root.parent.matrixWorld); }
  HIPS_EULER.set(p.lean ?? 0, p.twist ?? 0, p.tilt ?? 0, "YXZ");
  const hips = root.clone().multiply(new THREE.Matrix4().compose(v3(0, rig.hipHeight + (p.lift ?? 0), 0), new THREE.Quaternion().setFromEuler(HIPS_EULER), v3(1, 1, 1)));
  const sq = squashStretch(p.squash ?? 0);
  return { root, hips, squash: sq, toWorld: (local: Vec | V3, rides = true) => { const q = vec(local); if (rides) q.multiply(sq); return q.applyMatrix4(hips); } };
};

const LIMB_KEYS = new Set(["target", "offset", "weight", "pole", "grip", "wrist"]);
const POSE_KEYS = new Set(["at", "yaw", "lift", "lean", "tilt", "twist", "squash", "look", "limbs", "arms", "legs", "flags"]);
/**
 * Put the rig in a pose. Every joint is SET (limbs not named go to rest), so the pose depends on
 * nothing but `p`. Unknown keys, limbs, heads and flags throw: a pose a rig cannot show must say so.
 */
export const pose = (rig: Rig, p: Pose = {}) => {
  for (const k of Object.keys(p)) if (!POSE_KEYS.has(k)) throw new Error(`pose: unknown pose key "${k}" for ${rig.name}`);
  const limbs: Record<string, LimbPose> = { ...(p.limbs ?? {}) };
  for (const [grp, m] of [["arms", p.arms], ["legs", p.legs]] as const) for (const [side, lp] of Object.entries(m ?? {})) limbs[`${grp}.${side}`] = lp;
  for (const [n, lp] of Object.entries(limbs)) {
    if (!rig.limbs[n]) throw new Error(`pose: ${rig.name} has no limb "${n}" (it has: ${Object.keys(rig.limbs).join(", ") || "none"})`);
    for (const k of Object.keys(lp)) if (!LIMB_KEYS.has(k)) throw new Error(`pose: unknown limb key "${k}" on ${n}`);
  }
  for (const n of Object.keys(p.flags ?? {})) if (!rig.flags[n]) throw new Error(`pose: ${rig.name} has no flag "${n}" (it has: ${Object.keys(rig.flags).join(", ") || "none"}). Build the flag into every variant or leave it out of the pose.`);
  if (p.look && !Object.keys(rig.heads).length) throw new Error(`pose: ${rig.name} has no head to look with`);
  if (p.look?.head && !rig.heads[p.look.head]) throw new Error(`pose: ${rig.name} has no head "${p.look.head}"`);

  // the body
  rig.root.position.copy(p.at ? vec(p.at) : v3()); rig.root.rotation.set(0, p.yaw ?? 0, 0);
  rig.hips.position.set(0, rig.hipHeight + (p.lift ?? 0), 0); rig.hips.rotation.set(p.lean ?? 0, p.twist ?? 0, p.tilt ?? 0, "YXZ");
  const sq = squashStretch(p.squash ?? 0); rig.body.scale.copy(sq);
  for (const a of rig.anchors) a.obj.position.copy(a.base).multiply(sq);
  for (const h of Object.values(rig.heads)) h.pivot.rotation.set(0, 0, 0);
  rig.root.updateWorldMatrix(true, true);

  // flags (blink, antenna...) before the look, so a flag may move a head's parent
  for (const [n, val] of Object.entries(p.flags ?? {})) rig.flags[n](rig, typeof val === "boolean" ? (val ? 1 : 0) : val, p);
  if (p.look) { const h = rig.heads[p.look.head ?? Object.keys(rig.heads)[0]]; lookAt(h, p.look.target, 0, { weight: p.look.amount ?? 1 }); }

  // limbs, every one of them: rest unless posed
  for (const L of Object.values(rig.limbs)) {
    const lp = limbs[L.name] ?? {};
    L.root.updateWorldMatrix(true, false);
    const inv = L.root.matrixWorld.clone().invert(), rotInv = new THREE.Quaternion().setFromRotationMatrix(L.root.matrixWorld).invert();
    const from = L.rest.clone().add(lp.offset ? vec(lp.offset) : v3());
    let to = from, axisLocal: V3 | undefined, endQ: THREE.Quaternion | undefined;
    if (lp.grip) {
      // reachFor: the hand is aimed from the shoulder toward the handle (known BEFORE the solve), so
      // the wrist is exactly the handle point minus the turned grip offset: one solve, no iteration
      const pt = lp.grip.point.clone().applyMatrix4(inv); axisLocal = lp.grip.axis.clone().applyQuaternion(rotInv).normalize();
      endQ = gripTurn(L, pt, axisLocal);
      if (lp.wrist) endQ.multiply(Q.setFromEuler(new THREE.Euler(lp.wrist[0], lp.wrist[1], 0, "YXZ")));
      to = pt.clone().sub(L.gripPoint.clone().applyQuaternion(endQ));
    } else if (lp.target) to = lp.target.clone().applyMatrix4(inv);
    const w = lp.weight ?? 1;
    // endQ already carries the wrist; a partial reach turns the hand from the forearm and bends the wrist after
    setLimb(L, w >= 1 ? to : from.clone().lerp(to, clamp01(w)), endQ && w >= 1 ? { ...lp, wrist: undefined } : lp, axisLocal, endQ && w >= 1 ? endQ : undefined);
  }
  rig.root.updateWorldMatrix(true, true);
  return rig;
};

/** Every mesh of a rig (or of any object), visible ones only: what the checks sample. */
export const meshesOf = (o: THREE.Object3D, skip?: (m: THREE.Mesh) => boolean) => { const out: THREE.Mesh[] = []; o.traverseVisible((n) => { const m = n as THREE.Mesh; if (m.isMesh && m.geometry?.attributes?.position && !(skip && skip(m))) out.push(m); }); return out; };

// ---------------------------------------------------------------- holding props
/** Declare a prop's handle: a segment a..b of radius r in the prop's own space. grip() and the checks read it. */
export const handle = (prop: THREE.Object3D, a: Vec, b: Vec, r: number) => { prop.userData.handle = { a: vec(a), b: vec(b), r }; return prop; };
export type Handle = { a: V3; b: V3; r: number };
export const handleOf = (prop: THREE.Object3D): Handle => { const h = prop.userData.handle as Handle | undefined; if (!h) throw new Error(`grip: prop "${prop.name || prop.type}" has no handle (call handle(prop, a, b, r) when you build it)`); return h; };
/** The hand's grip point and axis in world space (for a limb, or any object carrying userData.gripPoint/gripAxis). */
export const gripFrame = (hand: Limb | THREE.Object3D) => {
  const end = isLimb(hand) ? hand.end : hand, gp = isLimb(hand) ? hand.gripPoint : vec(end.userData.gripPoint ?? [0, 0, 0]), ga = isLimb(hand) ? hand.gripAxis : vec(end.userData.gripAxis ?? [1, 0, 0]);
  end.updateWorldMatrix(true, false);
  return { point: end.localToWorld(gp.clone()), axis: ga.clone().transformDirection(end.matrixWorld).normalize(), end };
};
export const isLimb = (x: unknown): x is Limb => !!x && typeof x === "object" && "L1" in (x as object) && "end" in (x as object);
/**
 * Hold a prop: its handle, at `at` (0..1 along it), sits on the hand's grip point and runs along the
 * hand's grip axis, through the grip (lesson 37: a handle glued to a palm passes through the hand).
 * hang: the prop turns about the handle so its +y points up (a lantern, a bucket), then swings by
 * `swing` radians. Without hang it turns with the hand (a mug, a sword), rolled by `roll`.
 * Sets the prop's transform in its parent's space; the prop stays wherever it lives in the scene.
 */
export const grip = (hand: Limb | THREE.Object3D, prop: THREE.Object3D, at = 0.5, o: { hang?: boolean; swing?: number; roll?: number } = {}) => {
  const h = handleOf(prop), { point, axis, end } = gripFrame(hand);
  const ha = h.b.clone().sub(h.a).normalize(), hp = h.a.clone().lerp(h.b, at);
  let q: THREE.Quaternion;
  if (o.hang) {
    q = new THREE.Quaternion().setFromUnitVectors(ha, axis);
    // roll about the handle until the prop's up is as close to world up as it can get
    const up = UP.clone().applyQuaternion(q), want = UP.clone().sub(axis.clone().multiplyScalar(UP.dot(axis)));
    if (want.lengthSq() > 1e-8) { want.normalize(); const cur = up.sub(axis.clone().multiplyScalar(up.dot(axis))).normalize(); const ang = Math.atan2(v3().crossVectors(cur, want).dot(axis), cur.dot(want)); q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, ang)); }
    if (o.swing) q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, o.swing));
  } else {
    const eq = end.getWorldQuaternion(new THREE.Quaternion()), ga = isLimb(hand) ? hand.gripAxis : vec(end.userData.gripAxis ?? [1, 0, 0]);
    q = eq.multiply(new THREE.Quaternion().setFromUnitVectors(ha, ga.clone().normalize()));
    if (o.roll) q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, o.roll));
  }
  const pos = point.clone().sub(hp.clone().multiply(prop.getWorldScale(v3())).applyQuaternion(q));
  const par = prop.parent;
  if (par) { par.updateWorldMatrix(true, false); const pq = par.getWorldQuaternion(new THREE.Quaternion()).invert(); prop.quaternion.copy(pq.multiply(q)); prop.position.copy(par.worldToLocal(pos)); }
  else { prop.quaternion.copy(q); prop.position.copy(pos); }
  prop.updateWorldMatrix(false, true);
  return { a: prop.localToWorld(h.a.clone()), b: prop.localToWorld(h.b.clone()), point };
};

// ---------------------------------------------------------------- motion verbs (all closed form)
/**
 * Turn a head (or any object whose +z is its face) toward a world point, eased: weight from
 * tween(f, at, at + dur) when `at` is given, else opts.weight (default 1). Clamped to the head's
 * max yaw and pitch, so a target behind the character gives a shoulder check, not an owl.
 */
export const lookAt = (h: Head | THREE.Object3D, target: V3, f: number, o: { at?: number; dur?: number; ease?: Ease; weight?: number; from?: [number, number]; max?: [number, number] } = {}) => {
  const obj = "pivot" in h ? h.pivot : h, max = o.max ?? ("pivot" in h ? h.max : [1.2, 0.6]);
  const par = obj.parent; if (par) par.updateWorldMatrix(true, false);
  const t = par ? par.worldToLocal(target.clone()) : target.clone(); t.sub(obj.position);
  let yaw = Math.atan2(t.x, t.z), pitch = -Math.atan2(t.y, Math.hypot(t.x, t.z));
  yaw = Math.max(-max[0], Math.min(max[0], yaw)); pitch = Math.max(-max[1], Math.min(max[1], pitch));
  const w = o.at !== undefined ? (o.ease ?? ease.inOutCubic)(seg(f, o.at, o.at + (o.dur ?? 12))) : clamp01(o.weight ?? 1);
  const [y0, p0] = o.from ?? [0, 0];
  obj.rotation.order = "YXZ"; obj.rotation.set(lerp(p0, pitch, w), lerp(y0, yaw, w), 0);
  obj.updateWorldMatrix(false, true);
  return { yaw: lerp(y0, yaw, w), pitch: lerp(p0, pitch, w), weight: w };
};

export type Kick = { at: number; amp: number; freq?: number; damping?: number; held?: number };
/**
 * Secondary motion: the sum of springs kicked at each event (a stop, a lift, a hop). Before its kick
 * an event contributes amp x held (a lag held while moving, 0 by default); from the kick on it rings
 * down from amp to 0. Closed form (time.ts spring): frame 300 never needs frames 0-299.
 */
export const followThrough = (f: number, fps: number, kicks: Kick[]) => {
  let s = 0;
  for (const k of kicks) s += k.amp * (f < k.at ? (k.held ?? 0) : spring(f, k.at, fps, k.freq, k.damping));
  return s;
};

/** Volume-preserving squash (s < 0) or stretch (s > 0) as a scale: y = 1 + s, x = z = 1 / sqrt(1 + s). */
export const squashStretch = (s: number) => { const y = 1 + Math.max(-0.9, s), xz = 1 / Math.sqrt(y); return v3(xz, y, xz); };

/**
 * Anticipation: a move from `at` to `at + dur` that first goes the other way. Returns progress in
 * [-amount, 1]: easing down to -amount over the `lead` frames before `at`, then over to 1. Multiply
 * a move vector by it (a wind-up before a reach, a crouch before a hop).
 */
export const anticipate = (f: number, o: { at: number; dur: number; lead?: number; amount?: number; ease?: Ease }) => {
  const lead = o.lead ?? Math.max(1, Math.round(o.dur * 0.5)), amt = o.amount ?? 0.15;
  if (f < o.at) return -amt * ease.inOutSine(seg(f, o.at - lead, o.at));
  return lerp(-amt, 1, (o.ease ?? ease.inOutCubic)(seg(f, o.at, o.at + o.dur)));
};

export type WalkOpts = {
  fps?: number;
  /** full cycles (two steps for a biped) per second, when the walk runs on the frame */
  cadence?: number;
  /** distance travelled: when given, the phase is distance / stride, so planted feet never slide at any speed, eases and stops included */
  distance?: number;
  /** distance the body travels in one full cycle */
  stride?: number;
  /** body bob: the hips dip this far at each contact */
  bob?: number;
  /** fraction of the cycle a foot is planted (0.6 walks, under 0.5 runs) */
  stance?: number;
  /** how high a swinging foot lifts */
  lift?: number;
  /** side sway of the hips over the planted foot */
  sway?: number;
  /** arm counter-swing amplitude (the arms[] values are -1..1 times this) */
  armSwing?: number;
  /** phase offset of each foot (biped [0, 0.5]; a quadruped walk [0, 0.5, 0.25, 0.75]) */
  offsets?: number[];
  /** 0..1: blends every output toward standing still (a start or a stop) */
  moving?: number;
};
export type WalkFoot = { u: number; stance: boolean; fwd: number; lift: number };
export type Walk = { phase: number; feet: WalkFoot[]; bob: number; sway: number; twist: number; arms: number[] };
/**
 * A walk, as numbers: per foot its place along the travel relative to the hips (fwd) and its lift,
 * the hip bob, sway and twist, and each foot's arm counter-swing (arms[i] swings against foot i:
 * forward while that foot is back). Periodic in the phase. Feet are planted for `stance` of the cycle
 * and travel back under the body exactly as fast as the body moves, so with `distance` they stick.
 */
export const walkCycle = (f: number, o: WalkOpts = {}): Walk => {
  const stride = o.stride ?? 1, S = o.stance ?? 0.6, mv = clamp01(o.moving ?? 1), offs = o.offsets ?? [0, 0.5];
  const phase = o.distance !== undefined ? o.distance / stride : (f / (o.fps ?? 24)) * (o.cadence ?? 1);
  const frac = (x: number) => x - Math.floor(x);
  const feet = offs.map((off): WalkFoot => {
    const u = frac(phase + off);
    if (u < S) return { u, stance: true, fwd: mv * stride * (S / 2 - u), lift: 0 };
    const s = (u - S) / (1 - S), e = s * s * (3 - 2 * s);
    return { u, stance: false, fwd: mv * stride * lerp(-S / 2, S / 2, e), lift: mv * (o.lift ?? 0.1 * stride) * Math.sin(Math.PI * s) };
  });
  const arms = feet.map((ft) => { const u = ft.u, a = u < S ? -Math.cos((Math.PI * u) / S) : Math.cos(Math.PI * ((u - S) / (1 - S))); return mv * (o.armSwing ?? 1) * a; });
  // hips: lowest at each contact (u = 0 of a foot), highest as the other leg passes (mid stance)
  const k = offs.length > 2 ? 2 : offs.length;
  const bob = -mv * (o.bob ?? 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * k * (phase - S / 2)));
  const sway = mv * (o.sway ?? 0) * Math.cos(2 * Math.PI * (phase - S / 2));
  const twist = mv * 0.5 * (feet[0].fwd - (feet[1]?.fwd ?? 0)) / Math.max(1e-6, stride);
  return { phase, feet, bob, sway, twist, arms };
};
