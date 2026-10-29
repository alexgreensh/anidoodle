// THREE RIG DEMO. Nib, a little lamp-lighter robot built from primitives with three-core/rig.ts,
// walks in (arms counter-swinging, body bobbing), stops (antenna and body follow through), winds up,
// reaches for a lantern on a crate with two-bone IK, takes the handle in its jaws, lifts it (the
// lantern lags, then swings through), turns to the camera and waves. Every frame is posed from the
// frame number alone, and every frame passes checks3d (grip, proximity, self, path, screen size):
// test/threeChecks.test.ts runs them on all 192 frames, and on two broken variants that must fail.
import type { Ctx, Env } from "./core";
import type { Film } from "./film";
import * as THREE from "three";
import { draw3d, memo } from "../three-core/stage";
import { ease, lerp, seg, spring, tween } from "../three-core/time";
import { anticipate, bodyMatrix, flag, followThrough, grip, handle, head, limb, makeRig, part, pose, walkCycle, type Limb, type LimbPose } from "../three-core/rig";
import { checking, registerGrip, registerPath, registerRig, registerSize, resetChecks, runChecks } from "../three-core/checks3d";

const W = 1920, H = 1080, FPS = 24, N = 192;
type V3 = THREE.Vector3;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- the beats (frames)
export const BEATS = { stop: 84, windup: 92, reach: 100, approach: 114, onBar: 121, closed: 126, lift: 128, lifted: 146, turn: 140, wave: 156, giggle: 160 };
const STRIDE = 0.56, CYCLES = 3.55; // the walk ends at phase .55: both feet planted (stance 0.6), so the stop never freezes a foot mid-air
const STOP_X = 0.05;
// the carry: the lantern lags AWAY from the arm as it rises, and the wrist bends over it so the
// forearm stays clear of the lid (an upright wrist put the forearm through the lid: checks3d found it)
const LAG = 0.1, WR = -0.4;
export type Variant = "clean" | "offset" | "path";

// ---------------------------------------------------------------- materials and parts
const std = (color: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
const glow = (color: string, k = 1.6) => new THREE.MeshStandardMaterial({ color: "#000000", emissive: color, emissiveIntensity: k, roughness: 1 });

// Nib's hand: a palm and two jaws hinged at the back of a ring. Closed, the jaws make a ring whose
// hole runs along the hand's x axis: a handle passes THROUGH it (lesson 37), never through the palm.
const RING_R = 0.035, RING_T = 0.0125, GRIP_Y = 0.074;
const makeHand = (jaws: Record<string, THREE.Group[]>, name: string, cream: THREE.Material, coral: THREE.Material) => () => {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.038, 20, 14), cream); palm.scale.set(1.15, 1, 1); g.add(palm);
  const hingeY = GRIP_Y - RING_R, list: THREE.Group[] = [];
  // the ring lies in the hand's y-z plane; a point at angle a: centre + R (cos a y + sin a z)
  const basis = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v3(0, 1, 0), v3(0, 0, 1), v3(1, 0, 0)));
  for (const s of [1, -1]) {
    const hinge = new THREE.Group(); hinge.position.set(0, hingeY, 0);
    const a0 = s > 0 ? 0.035 * Math.PI : -Math.PI + 0.06, len = 0.93 * Math.PI;
    const m = new THREE.Mesh(new THREE.TorusGeometry(RING_R, RING_T, 10, 28, len), coral);
    m.position.set(0, RING_R, 0); m.quaternion.copy(basis).multiply(new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), a0));
    m.userData.part = `${name}.jaw`; hinge.add(m); hinge.userData.side = s; list.push(hinge); g.add(hinge);
  }
  jaws[name] = list;
  return g;
};

const build = () => {
  const scene = new THREE.Scene();
  const cream = std("#f4eee3", { roughness: 0.42 }), coral = std("#ff7656", { roughness: 0.45 }), slate = std("#5c6a80", { roughness: 0.5, metalness: 0.15 });
  const visorM = std("#18202f", { roughness: 0.16, metalness: 0.35 }), eyeM = glow("#8ff4ff", 2.2), cheekM = glow("#ff8f80", 0.9);

  // ---- Nib
  const nib = makeRig("nib", { hipHeight: 0.515 });
  const torso = part(nib, nib.body, "torso", new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.2, 10, 32), cream)); torso.position.y = 0.25; torso.scale.set(1.05, 1, 0.92);
  const bib = part(nib, nib.body, "bib", new THREE.Mesh(new THREE.CylinderGeometry(0.203, 0.203, 0.15, 32, 1, true, -0.5, 1.0), coral)); bib.position.y = 0.22; bib.scale.set(1.05, 1, 0.92);
  const button = part(nib, nib.body, "button", new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), std("#ffd25e", { emissive: "#ffb000", emissiveIntensity: 0.35 }))); button.position.set(0, 0.235, 0.19);
  const neck = new THREE.Group(); nib.hips.add(neck); nib.anchors.push({ obj: neck, base: v3(0, 0.56, 0) });
  part(nib, neck, "neck", new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.09, 20), slate)).position.y = 0.03;
  const hd = head(nib, "head", { at: [0, 0.6, 0], max: [1.15, 0.55] });
  const skull = part(nib, hd.pivot, "head", new THREE.Mesh(new THREE.SphereGeometry(0.2, 40, 28), cream)); skull.position.y = 0.17; skull.scale.set(1.12, 0.92, 1);
  const visor = part(nib, skull, "visor", new THREE.Mesh(new THREE.SphereGeometry(0.204, 40, 20, Math.PI / 2 - 0.95, 1.9, 1.0, 1.05), visorM)); void visor;
  const eyes: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const e = part(nib, hd.pivot, "eye", new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.028, 6, 14), eyeM)); e.position.set(0.064 * s, 0.195, 0.196); e.rotation.x = -0.12; eyes.push(e);
    const c = part(nib, hd.pivot, "cheek", new THREE.Mesh(new THREE.CircleGeometry(0.017, 20), cheekM)); c.position.set(0.112 * s, 0.14, 0.186); c.rotation.set(-0.15, 0.5 * s, 0);
    const ear = part(nib, hd.pivot, "ear", new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.045, 24), coral)); ear.rotation.z = Math.PI / 2; ear.position.set(0.222 * s, 0.17, 0);
  }
  const mouth = part(nib, hd.pivot, "mouth", new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0055, 8, 24, Math.PI), eyeM)); mouth.position.set(0, 0.142, 0.203); mouth.rotation.set(-0.2, 0, Math.PI);
  const antenna = new THREE.Group(); antenna.position.set(0, 0.352, -0.01); hd.pivot.add(antenna);
  part(nib, antenna, "antenna", new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.12, 10), slate)).position.y = 0.06;
  part(nib, antenna, "antenna.tip", new THREE.Mesh(new THREE.SphereGeometry(0.03, 18, 12), std("#ff7656", { emissive: "#ff5a36", emissiveIntensity: 0.5 }))).position.y = 0.14;

  const jaws: Record<string, THREE.Group[]> = {};
  const arm = (side: "left" | "right", s: number) => limb(nib, `arms.${side}`, { at: [0.235 * s, 0.4, 0], lengths: [0.19, 0.19], radius: [0.032, 0.029], rest: [0.05 * s, -0.34, 0.04], pole: [0.3 * s, -0.1, -1], material: slate, jointMaterial: coral, end: makeHand(jaws, `arms.${side}`, cream, coral), gripPoint: [0, GRIP_Y, 0], gripAxis: [1, 0, 0] });
  const leg = (side: "left" | "right", s: number) => limb(nib, `legs.${side}`, { at: [0.1 * s, -0.02, 0], lengths: [0.23, 0.23], radius: [0.042, 0.038], rest: [0, -0.42, 0.02], pole: [0, 0, 1], material: slate, jointMaterial: coral, endMode: "level",
    end: () => { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.09, 6, 18), coral); f.rotation.x = Math.PI / 2; f.position.set(0, -0.002, 0.035); f.scale.set(1.05, 1, 0.8); return f; } });
  // left is +x in Nib's own space (it faces +z), right is -x
  arm("left", 1); arm("right", -1); leg("left", 1); leg("right", -1);
  flag(nib, "blink", (_r, val) => eyes.forEach((e) => e.scale.set(1, Math.max(0.08, 1 - 0.92 * val), 1)));
  flag(nib, "antenna", (_r, val) => antenna.rotation.set(val, 0, 0));
  for (const n of ["arms.left", "arms.right"]) flag(nib, `jaws.${n.slice(5)}`, (_r, val) => jaws[n].forEach((h) => h.rotation.set(h.userData.side * 0.62 * val, 0, 0)));
  scene.add(nib.root);

  // ---- the crate and the lantern
  const crate = new THREE.Group(); crate.name = "crate"; crate.position.set(0.56, 0, -0.2);
  const wood = std("#c9935c", { roughness: 0.8 }), woodDark = std("#9a6a3e", { roughness: 0.85 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.4), wood); box.position.y = 0.17; crate.add(box);
  for (const y of [0.012, 0.115, 0.225, 0.328]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.408, 0.022, 0.408), woodDark); b.position.y = y; crate.add(b); }
  crate.traverse((o: THREE.Object3D) => { o.castShadow = o.receiveShadow = true; o.userData.part ??= "crate"; });
  scene.add(crate);

  const lantern = new THREE.Group(); lantern.name = "lantern";
  const iron = std("#3a4150", { roughness: 0.45, metalness: 0.5 }), glass = new THREE.MeshStandardMaterial({ color: "#ffe6b0", emissive: "#ffae45", emissiveIntensity: 1.25, roughness: 0.3 });
  const add = (m: THREE.Mesh, y: number, nm: string) => { m.position.y = y; m.userData.part = nm; m.castShadow = true; lantern.add(m); return m; };
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.076, 0.03, 28), iron), 0.015, "lantern.base");
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.13, 28), glass), 0.095, "lantern.glass").castShadow = false;
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2, p = add(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.13, 8), iron), 0.095, "lantern.post"); p.position.x = Math.cos(a) * 0.062; p.position.z = Math.sin(a) * 0.062; }
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.074, 0.024, 28), iron), 0.172, "lantern.lid");
  add(new THREE.Mesh(new THREE.ConeGeometry(0.056, 0.036, 28), iron), 0.202, "lantern.roof");
  // the bail: a wire arc from rim to rim with a wooden grip across its top. The grip is the handle
  const bail = new THREE.Group(); bail.userData.handlePart = true; lantern.add(bail);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.0055, 8, 32, Math.PI), iron); arc.position.y = 0.176; arc.userData.part = "lantern.bail"; arc.userData.handlePart = true; bail.add(arc);
  const gripM = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 16), std("#6b4428", { roughness: 0.7 })); gripM.rotation.z = Math.PI / 2; gripM.position.y = 0.25; gripM.userData.part = "lantern.handle"; gripM.userData.handlePart = true; bail.add(gripM);
  handle(lantern, [-0.035, 0.25, 0], [0.035, 0.25, 0], 0.012);
  const flame = new THREE.PointLight("#ffb35c", 0.5, 3, 2); flame.position.y = 0.1; lantern.add(flame);
  scene.add(lantern);

  // ---- the set: a photo-studio sweep (floor curving up into a wall) turned to face the lens
  const prof: [number, number][] = []; // (z, y): floor from the front to the cove, a quarter circle, the wall
  for (let i = 0; i <= 12; i++) prof.push([8 - (i / 12) * 10, 0]);
  for (let i = 1; i <= 16; i++) { const a = (i / 16) * (Math.PI / 2); prof.push([-2 - Math.sin(a) * 2, 2 - Math.cos(a) * 2]); }
  for (let i = 1; i <= 6; i++) prof.push([-4, 2 + i]);
  const pos: number[] = [], idx: number[] = [], XS = [-12, -4, 4, 12];
  prof.forEach(([z, y]) => XS.forEach((x) => pos.push(x, y, z)));
  for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < XS.length - 1; j++) { const a = i * XS.length + j, b = a + 1, c = a + XS.length, d = c + 1; idx.push(a, c, b, b, c, d); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals();
  const sweep = new THREE.Mesh(sg, std("#efe6d8", { roughness: 0.95, side: THREE.DoubleSide })); sweep.receiveShadow = true; sweep.rotation.y = 0.5; sweep.position.set(-0.4, 0, 0.3);
  scene.add(sweep);

  // ---- light: a warm key with soft shadows, a cool sky, a cool rim from behind
  scene.add(new THREE.HemisphereLight("#e8efff", "#d6c6ae", 1.1));
  const fill = new THREE.DirectionalLight("#fff6ea", 0.75); fill.position.set(2.2, 1.6, 4.5); scene.add(fill);
  const key = new THREE.DirectionalLight("#fff0da", 2.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
  const sc = key.shadow.camera as THREE.OrthographicCamera; sc.left = -2.4; sc.right = 2.4; sc.top = 2.4; sc.bottom = -2.4; sc.near = 0.5; sc.far = 14;
  key.target.position.set(-0.8, 0, 0.1); key.position.set(-0.8 - 1.6, 4.2, 0.1 + 3.2); scene.add(key, key.target);
  const rim = new THREE.DirectionalLight("#cfe0ff", 1.3); rim.position.set(-2.5, 2.6, -2.8); scene.add(rim);

  const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 60);
  return { scene, nib, crate, lantern, cam, jaws };
};
type Built = ReturnType<typeof build>;

// ---------------------------------------------------------------- the motion, from the frame alone
const distAt = (f: number) => {
  const D = STRIDE * CYCLES, f1 = 66, T = BEATS.stop - f1, v = D / (f1 + T / 2);
  if (f <= f1) return v * f;
  if (f < BEATS.stop) { const t = f - f1; return v * f1 + v * (t - (t * t) / (2 * T)); }
  return D;
};
const rootAt = (f: number, variant: Variant) => v3(STOP_X + (variant === "path" ? 0.18 : 0) - STRIDE * CYCLES + distAt(f), 0, 0);
const BLINKS = [36, 140, 183];
const blinkAt = (f: number) => { for (const b of BLINKS) if (f >= b && f < b + 4) return [0.6, 1, 1, 0.5][f - b]; return 0; };

/** Pose the whole scene for frame f (no rendering): what the draw and the checks both use. */
export const rigDemoFrame = (env: Env, f: number, variant: Variant = "clean") => {
  const B = memo(env, "threeRigDemo", build) as Built, { nib, lantern, cam } = B;
  resetChecks();
  const at = rootAt(f, variant), yaw = Math.PI / 2;

  // the walk: phase from distance, so planted feet never slide through the ease-out
  const wk = walkCycle(f, { distance: distAt(f), stride: STRIDE, bob: 0.022, lift: 0.07, sway: 0.012, armSwing: 1 });
  const S = BEATS;
  // body: walk lean that rocks through the stop, the wind-up and the reach, then straightens for the lift
  const reachP = anticipate(f, { at: S.reach, dur: S.approach - S.reach, lead: S.reach - S.windup, amount: 0.25 });
  const settle = followThrough(f, FPS, [{ at: S.stop, amp: 0.07, held: 1, freq: 1.4, damping: 0.32 }]);
  const lean = settle + 0.2 * Math.max(-0.25, reachP) * (1 - tween(f, S.lift, S.lifted)) + 0.02 * tween(f, S.lift, S.lifted);
  const giggle = f >= S.giggle ? 0.04 * Math.sin((2 * Math.PI * (f - S.giggle)) / 8) * (1 - seg(f, S.giggle, S.giggle + 22)) : 0;
  const lift = wk.bob - 0.05 * Math.max(0, reachP) * (1 - tween(f, S.lift, S.lifted)) + giggle * 0.4;
  const twist = f < S.stop ? wk.twist * 0.12 : -0.22 * tween(f, S.turn + 6, S.turn + 24);

  // feet: planted in the world from the walk; toes lift a little as a foot swings
  const bm = bodyMatrix(nib, { at, yaw });
  const feet: Record<string, LimbPose> = {};
  (["left", "right"] as const).forEach((side, i) => { const ft = wk.feet[i], s = side === "left" ? 1 : -1; feet[side] = { target: v3(0.1 * s, 0.052 + ft.lift, ft.fwd).applyMatrix4(bm.root), wrist: [-4.5 * ft.lift, 0] }; });

  // arms: counter-swing that dies into the stop and springs through it
  const mvA = 1 - 0.6 * seg(f, 66, S.stop);
  const swing = (i: number) => f < S.stop ? wk.arms[i] * mvA : walkCycle(S.stop, { distance: distAt(S.stop), stride: STRIDE }).arms[i] * 0.4 * spring(f, S.stop, FPS, 1.6, 0.3);
  const armSwing = (i: number): LimbPose => ({ offset: [0, 0.025 * Math.abs(swing(i)), 0.13 * swing(i)] });

  // the reach: rest > a point just short of the handle (jaws opening) > onto the handle > lift to show it
  const hb = lantern.userData.handle as { a: V3; b: V3 };
  const onCrate = () => { lantern.position.set(0.42, 0.34, -0.2); lantern.rotation.set(0, Math.PI / 2, 0); lantern.updateWorldMatrix(true, true); };
  onCrate();
  const bar = lantern.localToWorld(hb.a.clone().lerp(hb.b, 0.5)), axis = v3(0, 0, 1);
  const approachPt = bar.clone().add(v3(-0.08, 0.1, 0)), showPt = v3(STOP_X + 0.35, 0.95, -0.24);
  let carry: LimbPose = armSwing(0), jawsC = 0;
  if (f >= S.reach && f < S.lift) {
    if (f < S.approach) carry = { grip: { point: approachPt, axis }, weight: ease.inOutCubic(seg(f, S.reach, S.approach)) };
    else carry = { grip: { point: approachPt.clone().lerp(bar, ease.inOutSine(seg(f, S.approach, S.onBar))), axis } };
    jawsC = seg(f, S.reach + 4, S.approach) - seg(f, S.onBar, S.closed);
  } else if (f >= S.lift) {
    const u = ease.inOutCubic(seg(f, S.lift, S.lifted)), p = bar.clone().lerp(showPt, u); p.y += 0.06 * Math.sin(Math.PI * u);
    carry = { grip: { point: p, axis }, wrist: [WR * Math.min(1, 2 * u + seg(f, S.closed, S.lift)), 0] };
  }
  if (f >= S.reach - 6 && f < S.reach) carry = { offset: [0, 0.03 * -reachP, -0.08 * -reachP / 0.25] }; // the wind-up: the hand draws back first
  // the free hand (the lens side) balances during the reach, then waves at the lens
  let free: LimbPose = armSwing(1), jawsF = 0;
  if (f >= S.windup && f < S.wave) { const b = Math.max(0, reachP) * (1 - seg(f, S.lift, S.lifted)); free = { offset: [-0.06 * b, 0.05 * b, -0.1 * b] }; }
  if (f >= S.wave) { const w = ease.inOutCubic(seg(f, S.wave, S.wave + 10)), osc = Math.sin((2 * Math.PI * (f - S.wave - 10)) / 11) * seg(f, S.wave + 8, S.wave + 14); free = { offset: [-0.07 * w - 0.045 * osc, 0.62 * w, 0.06 * w], wrist: [0, -0.35 * osc] }; jawsF = 0.6 * w; }

  // the head: ahead, then the lantern, then the lens
  const ahead = at.clone().add(v3(1.6, 0.55, 0));
  const lanternC = v3(); // the lantern, wherever it is this frame (set after the grip below, read by the look)
  const camPos = cameraAt(f, B);
  const lookFor = (lc: V3) => { const t1 = ease.inOutSine(seg(f, 44, 64)), t2 = ease.inOutCubic(seg(f, S.turn + 4, S.turn + 18)); return ahead.clone().lerp(lc, t1).lerp(camPos, t2); };

  // antenna: trails while walking, swings through at the stop, the lift and the giggle
  const ant = -0.2 * (f < S.stop ? 1 : 0) * Math.min(1, f / 6) + 0.05 * Math.sin(4 * Math.PI * wk.phase) * (f < S.stop ? 1 : 0)
    + followThrough(f, FPS, [{ at: S.stop, amp: -0.2, freq: 1.8, damping: 0.22 }, { at: S.lifted, amp: 0.14, freq: 1.8, damping: 0.25 }, { at: S.giggle + 4, amp: -0.12, freq: 2.2, damping: 0.25 }]);

  // pose once with the look on the lantern's resting place, grip, then re-aim the look (cheap: head only)
  const p = { at, yaw, lift, lean, twist, squash: giggle, look: { target: lookFor(bar) }, arms: { left: carry, right: free }, legs: feet,
    flags: { blink: blinkAt(f), antenna: ant, "jaws.left": jawsC, "jaws.right": jawsF } };
  pose(nib, p);

  // the lantern: on the crate until the jaws close on it, then hanging from them, lagging and swinging
  const hand = nib.limbs["arms.left"] as Limb;
  if (f >= S.closed) {
    const lag = f < S.lifted ? LAG * ease.inOutSine(seg(f, S.lift, S.lift + 9)) : LAG * spring(f, S.lifted, FPS, 1.3, 0.18);
    grip(hand, lantern, 0.5, { hang: true, swing: lag });
    if (variant === "offset") { const back = v3(0, -0.05, 0).transformDirection(hand.end.matrixWorld).multiplyScalar(0.05); lantern.position.add(back); lantern.updateWorldMatrix(false, true); }
  }
  lantern.getWorldPosition(lanternC).add(v3(0, 0.12, 0));
  if (f >= S.lift) pose(nib, { ...p, look: { target: lookFor(lanternC) } });

  // the camera follows Nib in, then pushes in for the look
  cam.position.copy(camPos); cam.lookAt(camTarget(f)); cam.updateMatrixWorld();

  // what this frame must keep true (checks3d): nothing through anything, the grip held and seen
  registerRig("nib", nib); registerRig("crate", B.crate); registerRig("lantern", lantern);
  if (f >= S.approach - 2) registerGrip(nib, hand, lantern, { closing: f < S.closed });
  if (f >= S.approach && f < S.lifted + 12) registerSize(hand.end, 40);
  registerPath({ name: "nib", at: (g) => rootAt(g, variant), from: f, to: f, radius: 0.22, height: 1.4 }, [{ name: "crate", box: B.crate }]);
  return { ...B, hand };
};
// the camera keeps Nib a little left of centre while walking, then settles on the reach and pushes in
const camTarget = (f: number) => v3(lerp(rootAt(f, "clean").x + 0.3, 0.2, tween(f, 64, 118)), lerp(0.72, 0.68, tween(f, 70, 110)) + 0.04 * tween(f, 120, 170), lerp(0.05, -0.02, tween(f, 64, 118)));
// a side-on three-quarter for the walk, an arc round toward Nib's front for the reach (so its face reads
// while it looks at the lantern on its far side), then a push in for the look and the wave
const CAM_A = v3(1.45, 0.5, 3.3), CAM_B = v3(3.1, 0.6, 2.3), CAM_C = v3(2.85, 0.5, 2.45);
const cameraAt = (f: number, _b?: Built) => { const t = camTarget(f), a = ease.inOutSine(seg(f, 46, 134)), b = ease.inOutCubic(seg(f, 128, 176)); return t.add(CAM_A.clone().lerp(CAM_B, a).lerp(CAM_C, b)); };

// ---------------------------------------------------------------- the film
const shotFor = (variant: Variant) => (ctx: Ctx, f: number, env: Env) => {
  const s = rigDemoFrame(env, f, variant);
  if (checking()) runChecks(f, s.cam, env); else resetChecks();
  draw3d(ctx, env, s.scene, s.cam, { clear: "#e9e1d4", shadows: true });
};
const filmOf = (title: string, variant: Variant): Film => ({
  meta: { title, W, H, fps: FPS, bpm: 120, durationFrames: N, kind: "story", poster: 150 },
  assets: { images: {} },
  shots: [{ id: "nib", start: 0, end: N, draw: shotFor(variant) }],
});
export const threeRigDemo = filmOf("three rig demo", "clean");
/** TEST FIXTURE, not a film: the demo with the lantern shifted through Nib's jaws. The gate's 3D CHECKS must FAIL it. */
export const fixtureRigBrokenGrip = filmOf("fixture: broken grip", "offset");
