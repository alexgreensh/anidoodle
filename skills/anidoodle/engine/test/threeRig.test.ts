// RIG TESTS. src/three-core/rig.ts: the IK is exact where it can be and sensible where it cannot,
// a pose reaches its world targets in one pass, unknown pose flags throw on every variant, the walk
// is periodic with planted feet, the motion verbs are closed form, and the demo film poses the same
// frame whatever order frames are asked in.   node tools/test.mjs threeRig
import * as THREE from "three";
import { rand } from "../src/three-core/stage";
import { spring } from "../src/three-core/time";
import { anticipate, bodyMatrix, flag, followThrough, grip, gripFrame, handle, head, limb, lookAt, makeRig, part, pose, solveTwoBone, squashStretch, walkCycle } from "../src/three-core/rig";
import { rigDemoFrame } from "../src/canvas-core/threeRigDemo";

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const mat = new THREE.MeshStandardMaterial();
// a small test character: a box torso, two arms with ring hands, a head, optional antenna
export const testRig = (name = "t", o: { antenna?: boolean } = {}) => {
  const r = makeRig(name, { hipHeight: 1 });
  part(r, r.body, "torso", new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), mat)).position.y = 0.4;
  for (const [side, s] of [["left", 1], ["right", -1]] as const) limb(r, `arms.${side}`, { at: [0.36 * s, 0.75, 0], lengths: [0.35, 0.35], radius: 0.05, rest: [0.05 * s, -0.65, 0.05], pole: [0.2 * s, 0, -1], material: mat,
    end: () => { const g = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 10, 24), mat); ring.rotation.y = Math.PI / 2; ring.position.y = 0.1; g.add(ring); return g; }, gripPoint: [0, 0.1, 0], gripAxis: [1, 0, 0] });
  const h = head(r, "head", { at: [0, 0.85, 0], max: [1.0, 0.5] });
  part(r, h.pivot, "skull", new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat)).position.y = 0.2;
  if (o.antenna) { const a = new THREE.Group(); h.pivot.add(a); flag(r, "antenna", (_r, v) => a.rotation.set(v, 0, 0)); }
  return r;
};

export const name = "threeRig";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const R = rand(7), rv = (s = 1) => v3((R() * 2 - 1) * s, (R() * 2 - 1) * s, (R() * 2 - 1) * s);

  // ---- 1. two-bone IK
  let worst = 0, lenErr = 0, poleBad = 0;
  for (let i = 0; i < 400; i++) {
    const root = rv(2), L1 = 0.2 + R(), L2 = 0.2 + R(), dir = rv().normalize(), D = Math.abs(L1 - L2) + 0.02 + R() * (L1 + L2 - Math.abs(L1 - L2) - 0.04);
    const target = root.clone().addScaledVector(dir, D), mid = root.clone().add(v3(L1, 0, 0)), end = mid.clone().add(v3(0, L2, 0)), pole = root.clone().add(rv(3));
    const s = solveTwoBone(root, mid, end, target, pole);
    worst = Math.max(worst, s.end.distanceTo(target)); lenErr = Math.max(lenErr, Math.abs(s.mid.distanceTo(root) - L1), Math.abs(s.end.distanceTo(s.mid) - L2));
    // the elbow is on the pole's side of the root-end line
    const ax = s.end.clone().sub(root).normalize(), off = (p: THREE.Vector3) => p.clone().sub(root).sub(ax.clone().multiplyScalar(p.clone().sub(root).dot(ax)));
    if (off(pole).lengthSq() > 1e-6 && off(s.mid).dot(off(pole)) <= 0) poleBad++;
  }
  ok(worst < 1e-3, `IK puts the end on 400 reachable targets (worst miss ${worst.toExponential(1)})`);
  ok(lenErr < 1e-6, `IK keeps both bone lengths (worst ${lenErr.toExponential(1)})`);
  ok(poleBad === 0, `the middle joint bends toward the pole every time (${poleBad} wrong sides)`);
  {
    const root = v3(0, 1, 0), s = solveTwoBone(root, v3(0.4, 1, 0), v3(0.4, 1.5, 0), v3(3, 2, 1), v3(0, 0, -1)), dir = v3(3, 1, 1).normalize();
    ok(!s.reached && s.end.distanceTo(root.clone().addScaledVector(dir, 0.9)) < 1e-6, "a target out of reach gives a fully extended limb pointing at it");
    ok(s.mid.distanceTo(root.clone().addScaledVector(dir, 0.4)) < 1e-6 && s.bend < 1e-6, "the out-of-reach limb is straight (no bend at the middle joint)");
    const c = solveTwoBone(root, v3(0.4, 1, 0), v3(0.4, 1.3, 0), root.clone().add(v3(0.01, 0, 0)), v3(0, 0, 1));
    ok(!c.reached && Math.abs(c.end.distanceTo(root) - 0.1) < 1e-6, "a target closer than the limb can fold gives the limb folded as far as it goes");
  }

  // ---- 2. a rig reaches world targets in one pose, from any placement
  const r = testRig();
  let miss = 0;
  for (let i = 0; i < 40; i++) {
    const at = rv(3).setY(0), yaw = R() * 6.28, lean = (R() - 0.5) * 0.6;
    const bm = bodyMatrix(r, { at, yaw, lean }), shoulder = bm.toWorld([-0.36, 0.75, 0]);
    const target = shoulder.clone().add(rv().normalize().multiplyScalar(0.15 + R() * 0.5));
    pose(r, { at, yaw, lean, arms: { right: { target } } });
    miss = Math.max(miss, r.limbs["arms.right"].end.getWorldPosition(v3()).distanceTo(target));
  }
  ok(miss < 1e-3, `pose.arms.right = { target } puts the hand on a world point at any place, turn and lean (worst ${miss.toExponential(1)})`);
  {
    pose(r, { at: [1, 0, 2], yaw: 0.7, lean: 0.2, twist: 0.1 });
    const bm = bodyMatrix(r, { at: [1, 0, 2], yaw: 0.7, lean: 0.2, twist: 0.1 });
    const d = bm.hips.elements.reduce((m, x, i) => Math.max(m, Math.abs(x - r.hips.matrixWorld.elements[i])), 0);
    ok(d < 1e-9, "bodyMatrix gives exactly the hips matrix pose() builds");
    const before = r.root.position.clone(); bodyMatrix(r, { at: [9, 9, 9] });
    ok(r.root.position.equals(before), "bodyMatrix touches no mesh (lesson 24: plan a reach without a second build)");
    const restHand = (() => { pose(r, {}); return r.limbs["arms.left"].end.getWorldPosition(v3()); })();
    ok(restHand.distanceTo(v3(0.41, 1.1, 0.05)) < 1e-6, "an unposed limb goes to its rest (no value kept from the pose before)");
  }
  // reachFor: the GRIP POINT on a handle, along its axis
  {
    let gm = 0, ga = 0;
    for (let i = 0; i < 30; i++) {
      const at = rv(2).setY(0), yaw = R() * 6.28; const sh = bodyMatrix(r, { at, yaw }).toWorld([-0.36, 0.75, 0]);
      const point = sh.clone().add(rv().normalize().multiplyScalar(0.25 + R() * 0.3)), axis = rv().normalize();
      pose(r, { at, yaw, arms: { right: { grip: { point, axis } } } });
      const g = gripFrame(r.limbs["arms.right"]); gm = Math.max(gm, g.point.distanceTo(point)); ga = Math.max(ga, 1 - Math.abs(g.axis.dot(axis)));
    }
    ok(gm < 1e-3, `a grip pose puts the hand's grip point on the handle (worst ${gm.toExponential(1)})`);
    ok(ga < 1e-6, `and turns the hand so the handle runs along its grip axis (worst 1-cos ${ga.toExponential(1)})`);
  }
  // grip(): the handle sits in the hand, along its axis; hang keeps the prop upright
  {
    const scene = new THREE.Scene(); scene.add(r.root);
    const prop = new THREE.Group(); prop.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3), mat)); handle(prop, [-0.05, 0.3, 0], [0.05, 0.3, 0], 0.01); scene.add(prop);
    pose(r, { arms: { right: { target: v3(-0.6, 1.3, 0.4) } } });
    const g = grip(r.limbs["arms.right"], prop, 0.5, { hang: true }), gf = gripFrame(r.limbs["arms.right"]);
    ok(g.a.clone().lerp(g.b, 0.5).distanceTo(gf.point) < 1e-6 && Math.abs(g.b.clone().sub(g.a).normalize().dot(gf.axis)) > 1 - 1e-9, "grip() puts the handle's middle on the grip point, running along the grip axis");
    const up = v3(0, 1, 0).applyQuaternion(prop.quaternion), want = v3(0, 1, 0).sub(gf.axis.clone().multiplyScalar(gf.axis.y)).normalize();
    ok(up.dot(want) > 1 - 1e-9, "hang turns the prop about the handle until its top points as far up as it can");
    grip(r.limbs["arms.right"], prop, 0.5, { hang: true, swing: 0.3 }); const up2 = v3(0, 1, 0).applyQuaternion(prop.quaternion);
    ok(Math.abs(up2.angleTo(up) - 0.3) < 1e-6, "swing turns it about the handle by exactly that angle");
    scene.remove(r.root);
  }

  // ---- 3. pose flags work on every variant or throw (lesson 32)
  const plain = testRig("plain"), withAnt = testRig("ant", { antenna: true });
  const throws = (fn: () => void, has: string) => { try { fn(); return false; } catch (e) { return String(e).includes(has); } };
  ok(throws(() => pose(plain, { flags: { antenna: 0.3 } }), 'has no flag "antenna"'), "a flag the variant does not have throws, naming it (never silently ignored)");
  ok(!throws(() => pose(withAnt, { flags: { antenna: 0.3 } }), "antenna"), "the variant that has it takes it");
  ok(throws(() => pose(plain, { limbs: { "claws.big": { target: v3() } } }), 'no limb "claws.big"'), "a limb the rig does not have throws");
  ok(throws(() => pose(plain, { arms: { right: { reach: 1 } as never } }), 'unknown limb key "reach"'), "a misspelt limb key throws");
  ok(throws(() => pose(plain, { leen: 0.2 } as never), 'unknown pose key "leen"'), "a misspelt pose key throws");
  ok(throws(() => pose(makeRig("headless"), { look: { target: v3() } }), "no head"), "a look on a rig with no head throws");
  ok(Object.keys(plain.limbs).length === 2 && !!plain.limbs["arms.left"].end, "a rig built with limb() has posable arms from the start (lesson 23)");

  // ---- 4. head turns
  {
    const t = testRig("look"); pose(t, {});
    const h = t.heads.head, tgt = v3(1, 1.85, 1), res = lookAt(h, tgt, 0, {});
    const fwd = v3(0, 0, 1).transformDirection(h.pivot.matrixWorld), want = tgt.clone().sub(h.pivot.getWorldPosition(v3())).normalize();
    ok(fwd.dot(want) > 0.9999 && res.weight === 1, "lookAt faces the head at a world point");
    const half = lookAt(h, tgt, 6, { at: 0, dur: 12, ease: (x) => x });
    ok(Math.abs(half.weight - 0.5) < 1e-9 && Math.abs(half.yaw - res.yaw / 2) < 1e-9, "eased: half way through its frames it is half way round");
    const behind = lookAt(h, v3(0, 1.85, -3), 0, {});
    ok(Math.abs(Math.abs(behind.yaw) - 1.0) < 1e-9, "a target behind is clamped to the head's max turn (a shoulder check, not an owl)");
  }

  // ---- 5. walk, follow-through, squash, anticipation
  {
    let per = 0;
    for (let f = 0; f < 48; f += 0.7) { const a = walkCycle(f, { fps: 24, cadence: 1.2, stride: 0.6, bob: 0.03, sway: 0.01 }), b = walkCycle(f + 24 / 1.2, { fps: 24, cadence: 1.2, stride: 0.6, bob: 0.03, sway: 0.01 });
      per = Math.max(per, Math.abs(a.bob - b.bob), Math.abs(a.sway - b.sway), ...a.feet.map((x, i) => Math.abs(x.fwd - b.feet[i].fwd) + Math.abs(x.lift - b.feet[i].lift)), ...a.arms.map((x, i) => Math.abs(x - b.arms[i]))); }
    ok(per < 1e-9, `walkCycle repeats exactly every cycle (worst ${per.toExponential(1)})`);
    // planted feet stay put in the world while the body moves at changing speed
    let slide = 0;
    for (let i = 0; i < 300; i++) { const d0 = 0.01 * i * (1 + 0.5 * Math.sin(i * 0.1)), d1 = d0 + 0.004, a = walkCycle(0, { distance: d0, stride: 0.5 }), b = walkCycle(0, { distance: d1, stride: 0.5 });
      a.feet.forEach((ft, k) => { if (ft.stance && b.feet[k].stance && b.feet[k].u > ft.u) slide = Math.max(slide, Math.abs(d0 + ft.fwd - (d1 + b.feet[k].fwd))); }); }
    ok(slide < 1e-9, `with distance, a planted foot never slides in the world (worst ${slide.toExponential(1)})`);
    let corr = 0; for (let p = 0; p < 1; p += 0.01) { const w = walkCycle(0, { distance: p, stride: 1 }); corr += w.arms[0] * w.feet[0].fwd; }
    ok(corr < 0, "each arm swings against its own leg (counter-swing, lesson 10)");
    const bobs = Array.from({ length: 100 }, (_, i) => walkCycle(0, { distance: i / 100, stride: 1, bob: 0.03 }).bob);
    ok(Math.abs(Math.min(...bobs) + 0.03) < 1e-3 && Math.max(...bobs) <= 1e-12, "the body bobs down by `bob` at contact and back up as the legs pass");
    const still = walkCycle(10, { fps: 24, cadence: 1, stride: 0.5, bob: 0.03, moving: 0 });
    ok(still.feet.every((x) => x.fwd === 0 && x.lift === 0) && still.bob === 0 && still.arms.every((x) => x === 0), "moving 0 is standing still");
  }
  {
    ok(spring(10, 12, 24) === 0 && Math.abs(spring(12, 12, 24) - 1) < 1e-12, "spring: nothing before its kick, the full displacement at it");
    const late = Array.from({ length: 24 }, (_, i) => Math.abs(spring(12 + 48 + i, 12, 24))), early = Array.from({ length: 24 }, (_, i) => Math.abs(spring(12 + i, 12, 24)));
    ok(Math.max(...late) < 0.05 * Math.max(...early) && Math.max(...late) < 0.05, `spring decays: 2 s after the kick under 5% (${Math.max(...late).toFixed(4)})`);
    const ft = (f: number) => followThrough(f, 24, [{ at: 20, amp: 0.3, held: 1 }, { at: 40, amp: -0.1 }]);
    ok(ft(5) === 0.3 && Math.abs(ft(20) - 0.3) < 1e-12 && Math.abs(ft(200)) < 1e-4, "followThrough holds the lag until the stop, springs through it, settles to rest");
    ok(Math.abs(ft(45) - (0.3 * spring(45, 20, 24) - 0.1 * spring(45, 40, 24))) < 1e-12, "kicks add up, each from its own frame");
    let vol = 0; for (const s of [-0.5, -0.2, 0, 0.3, 1]) { const k = squashStretch(s); vol = Math.max(vol, Math.abs(k.x * k.y * k.z - 1)); }
    ok(vol < 1e-12, "squashStretch keeps the volume");
    const an = (f: number) => anticipate(f, { at: 20, dur: 10, lead: 6, amount: 0.2 });
    ok(an(10) === 0 && Math.abs(an(20) + 0.2) < 1e-12 && an(30) === 1 && an(17) < 0 && an(17) > -0.2, "anticipate dips the other way first, then goes all the way");
  }

  // ---- 6. purity: the demo film poses frame N the same whatever came before
  {
    const env = () => ({ W: 1920, H: 1080, scale: 1, cache: new Map(), canvas: () => { throw new Error("no canvas in a unit test"); } }) as never;
    const print = (s: ReturnType<typeof rigDemoFrame>) => { const out: number[] = []; s.scene.updateMatrixWorld(true); s.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(...o.matrixWorld.elements.map((x) => Math.round(x * 1e7))); }); out.push(...s.cam.matrixWorld.elements.map((x) => Math.round(x * 1e7))); return out.join(","); };
    const frames = [0, 13, 48, 84, 90, 101, 115, 122, 126, 131, 146, 150, 163, 175, 191];
    const e1 = env(), seq = frames.map((f) => print(rigDemoFrame(e1, f)));
    const order = [...frames.keys()]; const rr = rand(3); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const e2 = env(), shuffled: string[] = []; for (const i of order) shuffled[i] = print(rigDemoFrame(e2, frames[i]));
    // and with other frames drawn in between (a chunked render that starts mid-film)
    const e3 = env(); rigDemoFrame(e3, 140); rigDemoFrame(e3, 20);
    ok(seq.every((x, i) => x === shuffled[i]), `the demo poses identically in shuffled order (${frames.length} frames, every mesh and the camera)`);
    ok(print(rigDemoFrame(e3, 126)) === seq[frames.indexOf(126)], "and after unrelated frames (the grip frame after 140 and 20)");
  }
};
