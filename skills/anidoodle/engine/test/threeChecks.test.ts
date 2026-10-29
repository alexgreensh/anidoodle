// CHECKS 3D TESTS. Every check in src/three-core/checks3d.ts gets a GREEN scene it must pass and a
// RED scene (a known fault) it must fail, because a check that has never failed proves nothing
// (lesson 44). Then the demo film: all 192 frames clean, and two broken variants that must fail.
//   node tools/test.mjs threeChecks
import * as THREE from "three";
import { grip, gripFrame, handle, limb, makeRig, part, pose, type Rig } from "../src/three-core/rig";
import { checkGrip, checking, collectChecks, labelVisible, pathClear, placeLabel, faceCamera, proximity, registerGrip, registerRig, runChecks, screenSizeOk, selfClear, surfacePoints, type Finding } from "../src/three-core/checks3d";
import { rigDemoFrame } from "../src/canvas-core/threeRigDemo";

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const mat = new THREE.MeshStandardMaterial();
const ENV = { W: 1920, H: 1080 };
// a holder: box torso (hips at 1, torso 1.0-1.8), ring hands whose hole runs along the hand's x
const holder = (name = "h", at = v3()) => {
  const r = makeRig(name, { hipHeight: 1 });
  part(r, r.body, "torso", new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), mat)).position.y = 0.4;
  for (const [side, s] of [["left", 1], ["right", -1]] as const) limb(r, `arms.${side}`, { at: [0.36 * s, 0.75, 0], lengths: [0.35, 0.35], radius: 0.05, rest: [0.05 * s, -0.65, 0.05], pole: [0.2 * s, 0, -1], material: mat,
    end: () => { const g = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 10, 24), mat); ring.rotation.y = Math.PI / 2; ring.position.y = 0.1; g.add(ring); return g; }, gripPoint: [0, 0.1, 0], gripAxis: [1, 0, 0] });
  pose(r, { at });
  return r;
};
// a lantern-like prop: a body under a short handle (the handle meshes are marked as handle parts)
const lantern = (bodyLen = 0.2) => {
  const p = new THREE.Group(); p.name = "lantern";
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, bodyLen, 20), mat); body.position.y = 0.2 - bodyLen / 2; body.userData.part = "lantern.body"; p.add(body);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 10), mat); h.rotation.z = Math.PI / 2; h.position.y = 0.3; h.userData.handlePart = true; p.add(h);
  handle(p, [-0.04, 0.3, 0], [0.04, 0.3, 0], 0.01);
  return p;
};
const camAt = (pos: THREE.Vector3, look: THREE.Vector3, fov = 35) => { const c = new THREE.PerspectiveCamera(fov, 16 / 9, 0.05, 50); c.position.copy(pos); c.lookAt(look); c.updateMatrixWorld(); c.updateProjectionMatrix(); return c; };
const kinds = (fs: Finding[]) => new Set(fs.map((f) => f.kind));
const scene = (...o: THREE.Object3D[]) => { const s = new THREE.Scene(); o.forEach((x) => s.add(x)); s.updateMatrixWorld(true); return s; };
// pose a holder gripping `prop` at a world point along `axis`, then hang the prop from the hand
const holding = (h: Rig, prop: THREE.Object3D, point: THREE.Vector3, axis = v3(1, 0, 0)) => { pose(h, { arms: { right: { grip: { point, axis } } } }); grip(h.limbs["arms.right"], prop, 0.5, { hang: true }); };

export const name = "threeChecks";
export const run = (ok: (cond: boolean, label: string) => void) => {
  // ---- grip
  {
    const h = holder(), p = lantern(); scene(h.root, p); const cam = camAt(v3(0.2, 1.6, 3), v3(-0.3, 1.3, 0.3));
    holding(h, p, v3(-0.45, 1.35, 0.45));
    const g = checkGrip(h, h.limbs["arms.right"], p, 0, cam);
    ok(g.ok, `GREEN grip: the handle through the closed hand, the lantern clear of the body, in view (${g.findings.map((x) => x.kind).join(", ") || "no findings"})`);
    // RED: the prop offset through the hand (the demo's broken variant, in miniature)
    p.position.add(v3(0, -0.06, 0).applyQuaternion(h.limbs["arms.right"].end.getWorldQuaternion(new THREE.Quaternion()))); p.updateMatrixWorld(true);
    const t = checkGrip(h, h.limbs["arms.right"], p, 7, cam);
    ok(kinds(t.findings).has("grip-through-hand") && kinds(t.findings).has("grip-gap") && t.findings[0].frame === 7, `RED prop offset through the hand: ${[...kinds(t.findings)].join(", ")}`);
    // RED: the prop floating off the hand
    holding(h, p, v3(-0.45, 1.35, 0.45)); p.position.x -= 0.3; p.updateMatrixWorld(true);
    const fl = checkGrip(h, h.limbs["arms.right"], p, 0, cam);
    ok(kinds(fl.findings).has("grip-gap") && kinds(fl.findings).has("grip-open"), `RED prop floating off the hand: ${[...kinds(fl.findings)].join(", ")}`);
    // closing: the hand is on its way, so a gap is fine but a handle through the hand is not
    ok(checkGrip(h, h.limbs["arms.right"], p, 0, cam, { closing: true }).ok, "closing: a hand still on its way is not asked to hold yet");
  }
  {
    // RED: a long handle that runs on through the holder's own body
    const h = holder(), pole = new THREE.Group(); pole.name = "pole"; handle(pole, [0, 0, -0.6], [0, 0, 0.6], 0.015);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2, 10), mat); m.rotation.x = Math.PI / 2; m.userData.handlePart = true; pole.add(m); scene(h.root, pole);
    pose(h, { arms: { right: { grip: { point: v3(-0.2, 1.4, 0.4), axis: v3(0, 0, 1) } } } }); grip(h.limbs["arms.right"], pole, 0.5 + 0.4 / 1.2);
    const r = checkGrip(h, h.limbs["arms.right"], pole);
    ok(kinds(r.findings).has("grip-through-holder") && r.findings.some((x) => x.detail.includes("torso")), `RED handle through the holder's body, part named: ${r.findings.map((x) => x.detail).join(" | ")}`);
  }
  {
    // RED: the lantern's body pushed into the holder's belly
    const h = holder(), p = lantern(0.4); scene(h.root, p);
    holding(h, p, v3(-0.2, 1.45, 0.27));
    const r = checkGrip(h, h.limbs["arms.right"], p);
    ok(kinds(r.findings).has("grip-prop-in-holder"), `RED prop body in the holder: ${r.findings.map((x) => x.where + " " + x.detail).join(" | ")}`);
  }
  {
    // RED: the grip hidden behind something between it and the lens; GREEN once it moves away
    const h = holder(), p = lantern(), wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.05), mat); wall.userData.part = "sign";
    const cam = camAt(v3(-0.45, 1.4, 3), v3(-0.45, 1.3, 0.4)); wall.position.set(-0.45, 1.36, 1.2); scene(h.root, p, wall);
    holding(h, p, v3(-0.45, 1.35, 0.45));
    const r = checkGrip(h, h.limbs["arms.right"], p, 0, cam, { others: [wall] });
    ok(kinds(r.findings).has("grip-hidden") && r.findings.some((x) => x.detail.includes("sign")), `RED grip hidden behind another object, named: ${r.findings.map((x) => x.detail).join(" | ")}`);
    wall.position.x = 2; wall.updateMatrixWorld();
    ok(checkGrip(h, h.limbs["arms.right"], p, 0, cam, { others: [wall] }).ok, "GREEN the same grip with the sign moved aside");
  }
  {
    // RED: a long prop in frame whose holding hand is out of frame (reads as dropped, lesson 43)
    const h = holder(), sword = new THREE.Group(); sword.name = "sword"; handle(sword, [-0.04, 0, 0], [0.04, 0, 0], 0.012);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2, 0.04), mat); blade.position.y = -1.05; sword.add(blade); scene(h.root, sword);
    holding(h, sword, v3(-0.45, 1.35, 0.45));
    const c = new THREE.Box3().setFromObject(sword).getCenter(v3()), cam = camAt(c.clone().add(v3(0, 0, 1.2)), c, 30);
    const r = checkGrip(h, h.limbs["arms.right"], sword, 0, cam);
    ok(kinds(r.findings).has("grip-offscreen"), `RED prop in frame, hand out of frame: ${[...kinds(r.findings)].join(", ")}`);
    const wide = camAt(v3(-0.4, 0.6, 5), v3(-0.4, 0.6, 0), 40);
    ok(!kinds(checkGrip(h, h.limbs["arms.right"], sword, 0, wide).findings).has("grip-offscreen"), "GREEN a wider lens keeps the hand in frame");
  }

  // ---- proximity (two rigs)
  {
    const a = holder("a"), b = holder("b", v3(2, 0, 0)); scene(a.root, b.root);
    ok(proximity(a, b).ok, "GREEN two characters 2 units apart");
    pose(b, { at: v3(0.45, 0, 0.1) });
    const r = proximity(a, b, [], { frame: 12 });
    ok(!r.ok && r.findings[0].frame === 12 && /torso|arms/.test(r.findings[0].detail) && /at -?\d/.test(r.findings[0].where), `RED overlapping characters, with the hit centre and parts: ${r.findings[0]?.where} ${r.findings[0]?.detail}`);
    ok(proximity(a, b, [b.root]).ok, "exempt subtrees are skipped (a held prop, a planned hug)");
    // lesson 38: boxes of diagonal tubes overlap almost entirely while the tubes are far apart
    const tube = (x: number, rz: number) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3, 12, 30), mat); m.position.set(x, 0, 0); m.rotation.z = rz; const g = new THREE.Group(); g.add(m); return g; };
    const t1 = tube(0, Math.PI / 4), t2 = tube(0.7, Math.PI / 4); scene(t1, t2);
    ok(new THREE.Box3().setFromObject(t1).intersectsBox(new THREE.Box3().setFromObject(t2)) && proximity(t1, t2, [], { tol: 0.05 }).ok, "GREEN two parallel diagonal tubes 0.5 apart: their boxes overlap, the check is not fooled (lesson 38)");
    const t3 = tube(0, -Math.PI / 4); scene(t1, t3);
    ok(!proximity(t1, t3, [], { tol: 0.05, minPoints: 3 }).ok, "RED two crossing tubes touch where they cross");
    // a small part sunk wholly inside a big one touches no surface point; the inside test finds it
    const big = new THREE.Group(), small = new THREE.Group(); big.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), mat)); small.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), mat)); scene(big, small);
    const deep = proximity(big, small, [], { tol: 0.02 });
    ok(!deep.ok && deep.findings[0].detail.includes("inside"), `RED a hand sunk wholly inside a body: ${deep.findings[0]?.detail}`);
    ok(proximity(big, small, [], { tol: 0.02, deep: false }).ok, "(and without the inside test it would have passed: why the test exists)");
    small.visible = false; ok(proximity(big, small, [], { tol: 0.02 }).ok, "hidden objects never collide (a switched-off jar, lesson 38)");
  }

  // ---- selfClear (an arm through its own body)
  {
    const h = holder(); scene(h.root);
    ok(selfClear(h).ok, "GREEN arms at rest beside the body");
    pose(h, { arms: { right: { target: v3(0.05, 1.35, 0) } } });
    const r = selfClear(h, { frame: 3 });
    ok(!r.ok && r.findings[0].kind === "self" && r.findings[0].where.includes("arms.right"), `RED a hand driven into its own torso: ${r.findings[0]?.where}`);
  }
  // ---- L12: a rig built in centimetres (a 60 x 80 x 40 torso). The sampler kept 6 passes of 1.6x and
  // then gave up, so one 20-unit box at the self-check spacing came back with 307,800 points (cap 6000).
  {
    const big = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), mat);
    const t0 = Date.now(), n = surfacePoints(big, 0.012).length, ms = Date.now() - t0;
    ok(n <= 6000, `L12 a 20-unit box sampled at 0.012 stays under the 6000-point cap (${n} points, ${ms} ms)`);
    const cm = makeRig("cm", { hipHeight: 100 });
    part(cm, cm.body, "torso", new THREE.Mesh(new THREE.BoxGeometry(60, 80, 40), mat)).position.y = 40;
    for (const [side, s] of [["left", 1], ["right", -1]] as const) limb(cm, `arms.${side}`, { at: [36 * s, 75, 0], lengths: [35, 35], radius: 5, rest: [5 * s, -65, 5], pole: [20 * s, 0, -100], material: mat,
      end: () => new THREE.Mesh(new THREE.SphereGeometry(6, 12, 8), mat) });
    pose(cm, {}); scene(cm.root);
    const c0 = Date.now(), green = selfClear(cm), cms = Date.now() - c0;
    ok(green.ok && cms < 1500, `L12 GREEN a centimetre rig at rest is clean, and checked in ${cms} ms`);
    pose(cm, { arms: { right: { target: v3(5, 135, 0) } } });
    const red = selfClear(cm, { frame: 3 });
    ok(!red.ok && red.findings[0].where.includes("arms.right"), `L12 RED the same rig with a hand in its torso is still caught: ${red.findings[0]?.where}`);
  }
  // ---- H7: a held prop before its popIn starts (scale 2.2e-16, hidden). The sampler asked for
  // unbounded points at the handle's tiny radius: frame 0 stalled, then threw RangeError.
  {
    const h = holder(), p = lantern(); scene(h.root, p); holding(h, p, v3(-0.3, 1.2, 0.3));
    p.scale.setScalar(2.2e-16); p.visible = false; p.updateMatrixWorld(true);
    let res: ReturnType<typeof checkGrip> | null = null, err = ""; const t0 = Date.now();
    try { res = checkGrip(h, h.limbs["arms.right"], p, 0); } catch (e) { err = String(e); }
    ok(!!res && res.ok && Date.now() - t0 < 500, `H7 a hidden, popping-in prop is skipped, fast and without a crash (${err || `${Date.now() - t0} ms`})`);
    p.visible = true; p.scale.setScalar(1e-5); p.updateMatrixWorld(true);
    res = null; err = ""; const t1 = Date.now();
    try { res = checkGrip(h, h.limbs["arms.right"], p, 0); } catch (e) { err = String(e); }
    ok(!!res && res.ok && Date.now() - t1 < 500, `H7 a visible prop at a thousandth of its size is too small to judge: skipped (${err || `${Date.now() - t1} ms`})`);
    const box = new THREE.Group(); box.add(p); scene(h.root, box); box.visible = false; p.scale.setScalar(1);
    res = checkGrip(h, h.limbs["arms.right"], p, 0);
    ok(res.ok, "H7 a prop inside a hidden group never counts");
  }

  // ---- pathClear (walking through a closed prop, lesson 22)
  {
    const gate = new THREE.Box3(v3(-0.1, 0, -1), v3(0.1, 1.2, 1));
    const through = { name: "walker", at: (f: number) => v3(-2 + f * 0.1, 0, 0), from: 0, to: 40, radius: 0.25, height: 1.5 };
    const r = pathClear(through, [{ name: "gate", box: gate }]);
    ok(!r.ok && r.findings.length === 1 && r.findings[0].frame === 17 && r.findings[0].detail.startsWith("frames 17-23"), `RED a walk through a closed gate, one finding per run of frames: ${r.findings[0]?.detail}`);
    ok(pathClear(through, [{ name: "gate", box: gate, open: true }]).ok, "GREEN the same walk through the gate once it is open");
    ok(pathClear({ ...through, at: (f) => v3(-2 + f * 0.1, 0, 1.4) }, [{ name: "gate", box: gate }]).ok, "GREEN a walk that passes beside it");
    ok(pathClear({ ...through, at: (f) => v3(-2 + f * 0.1, 1.3, 0) }, [{ name: "gate", box: gate }]).ok, "GREEN a flight over it (height counts)");
  }

  // ---- labels (lesson 42)
  {
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), mat); tag.position.set(0, 1, 0); const label = { obj: tag, w: 0.4, h: 0.2, name: "tag" };
    const claw = new THREE.Group(); const cm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.05), mat); cm.userData.part = "claw"; claw.add(cm); claw.position.set(0.1, 1, 0.5);
    scene(tag, claw); const cam = camAt(v3(0, 1, 3), v3(0, 1, 0));
    claw.position.x = 3; claw.updateMatrixWorld(true);
    ok(labelVisible(label, cam, [claw]).ok, "GREEN a label facing the lens with nothing in front");
    claw.position.x = 0.1; claw.updateMatrixWorld(true);
    const hid = labelVisible(label, cam, [claw], 4);
    ok(kinds(hid.findings).has("label-hidden") && hid.findings[0].detail.includes("claw"), `RED a claw covering part of the label: ${hid.findings[0]?.detail}`);
    tag.rotation.y = Math.PI; tag.updateMatrixWorld(true); claw.position.x = 3; claw.updateMatrixWorld(true);
    ok(kinds(labelVisible(label, cam, [claw]).findings).has("label-turned"), "RED a label turned away from the lens");
    faceCamera(tag, cam); ok(labelVisible(label, cam, [claw]).ok, "faceCamera turns it back to read");
    tag.position.x = 3; tag.updateMatrixWorld(true);
    ok(kinds(labelVisible(label, cam, []).findings).has("label-offscreen"), "RED a label out of frame");
    // after the camera: slide along until it reads
    claw.position.set(0.1, 1, 0.5); claw.updateMatrixWorld(true);
    const tries = [0, 0.1, -0.5].map((dx) => (o: THREE.Object3D) => { o.position.set(dx, 1, 0); faceCamera(o, cam); });
    const pl = placeLabel(label, cam, [claw], tries);
    ok(pl.ok && pl.pick === 2, `placeLabel slides the label until no claw covers it (picked try ${pl.pick})`);
    const none = placeLabel(label, cam, [claw], [tries[0]]);
    ok(!none.ok && none.pick === -1, "and says so when no try reads");
  }

  // ---- screen size (lesson 25)
  {
    const cam = camAt(v3(0, 0, 3), v3(0, 0, 0), 30);
    const ball = (r: number) => { const g = new THREE.Group(); g.name = "hand"; g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat)); scene(g); return g; };
    const small = screenSizeOk(ball(0.02), cam, ENV, 40), big = screenSizeOk(ball(0.05), cam, ENV, 40);
    ok(!small.ok && small.px > 20 && small.px < 34, `RED a contact beat ${small.px.toFixed(0)} px tall at 1080p`);
    ok(big.ok && big.px > 55, `GREEN the same beat ${big.px.toFixed(0)} px tall`);
    ok(Math.abs(screenSizeOk(ball(0.05), cam, { W: 3840, H: 2160 }, 40).px - big.px) < 1e-6, "sizes are read at 1080 lines whatever the film's resolution");
  }

  // ---- the registry: per frame, collected, never carried over
  {
    ok(!checking(), "no collector: checking() is false and draws skip the checks");
    const h = holder(), p = lantern(); scene(h.root, p); const cam = camAt(v3(0.2, 1.6, 3), v3(-0.3, 1.3, 0.3));
    holding(h, p, v3(-0.45, 1.35, 0.45)); p.position.x -= 0.3; p.updateMatrixWorld(true);
    const got = collectChecks(() => { registerRig("h", h); registerRig("lantern", p); registerGrip(h, h.limbs["arms.right"], p); runChecks(42, cam, ENV); });
    ok(got.length > 0 && got.every((x) => x.frame === 42) && got.some((x) => x.kind === "grip-gap"), `collectChecks receives the frame's findings (${got.length}, all on frame 42)`);
    ok(!checking() && runChecks(43, cam, ENV).ok, "the registry is cleared after a run: the next frame starts empty");
    // what a host gets besides findings: each grip's point on screen (the gate samples contact windows with it, still --grips crops it)
    holding(h, p, v3(-0.45, 1.35, 0.45));
    const G = globalThis as { __ANIDOODLE_CHECK3D__?: unknown }; let info: { grips: { name: string; x: number; y: number }[] } | undefined;
    G.__ANIDOODLE_CHECK3D__ = (_f: number, _fs: Finding[], i: typeof info) => { info = i; };
    try { registerGrip(h, h.limbs["arms.right"], p); runChecks(44, cam, ENV); } finally { delete G.__ANIDOODLE_CHECK3D__; }
    const want = gripFrame(h.limbs["arms.right"]).point.project(cam), g0 = info?.grips[0];
    ok(!!g0 && g0.name === "h/lantern" && Math.abs(g0.x - ((want.x + 1) / 2) * ENV.W) < 1e-6 && Math.abs(g0.y - ((1 - want.y) / 2) * ENV.H) < 1e-6 && g0.x > 0 && g0.x < ENV.W, `the collector also gets each grip's point on screen (${g0?.name} at ${g0?.x.toFixed(0)}, ${g0?.y.toFixed(0)})`);
  }

  // ---- the demo film: every frame clean; two broken variants that must fail
  {
    const env = () => ({ W: 1920, H: 1080, scale: 1, cache: new Map(), canvas: () => { throw new Error("no canvas in a unit test"); } }) as never;
    const e = env(), all: Finding[] = [];
    for (let f = 0; f < 192; f++) { const s = rigDemoFrame(e, f); all.push(...runChecks(f, s.cam, ENV).findings); }
    ok(all.length === 0, `threeRigDemo: all 192 frames pass every check (${all.length} findings${all.length ? ": " + all.slice(0, 3).map((x) => `${x.frame} ${x.kind} ${x.detail}`).join(" | ") : ""})`);
    const off: Finding[] = []; for (let f = 120; f < 192; f += 4) { const s = rigDemoFrame(e, f, "offset"); off.push(...runChecks(f, s.cam, ENV).findings); }
    const offF = new Set(off.map((x) => x.frame)), held = Array.from({ length: 18 }, (_, i) => 120 + i * 4).filter((f) => f >= 126);
    ok(kinds(off).has("grip-through-hand") && held.every((f) => offF.has(f)) && ![120, 124].some((f) => offF.has(f)), `RED threeRigDemo "offset" (lantern shifted through the jaws): fails on every held frame, not before (${[...kinds(off)].join(", ")})`);
    const path: Finding[] = []; for (let f = 60; f < 100; f += 4) { const s = rigDemoFrame(e, f, "path"); path.push(...runChecks(f, s.cam, ENV).findings); }
    ok(path.some((x) => x.kind === "path" && x.where.includes("crate")) && path.filter((x) => x.kind === "path").every((x) => x.frame >= 60), `RED threeRigDemo "path" (stops 0.18 further on): walks into the crate (${path.filter((x) => x.kind === "path").map((x) => x.frame).join(",")})`);
  }
};
