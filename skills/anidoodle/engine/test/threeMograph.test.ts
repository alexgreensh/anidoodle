// THREE MOGRAPH TESTS. src/three-core/mograph.ts: every verb writes a "before" state before it
// starts and the exact rest state after it ends, frames agree in any order, and morph resamples
// both shapes to equal counts by arc length.
//   node tools/test.mjs threeMograph
import * as THREE from "three";
import type { Env } from "../src/canvas-core/core";
import { defaultFont, text3d } from "../src/three-core/type3d";
import { assemble, dropIn, explode, extrudeIn, fadeIn, fadeOut, grid, growFrom, indicate, kinetic, lagged, morph, moveAlongPath, popIn, popOut, resample, riseFromFloor, wave, wiggle, writeOn, writePoints, writeTube } from "../src/three-core/mograph";

export const name = "threeMograph";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
  const mk = (x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#ff0000", emissive: "#000000" })); m.position.set(x, y, z); m.rotation.set(0.1, 0.2, 0.3); m.scale.set(1, 2, 1); return m; };
  const pose = (o: THREE.Object3D) => JSON.stringify([o.position.toArray(), o.quaternion.toArray(), o.scale.toArray(), o.visible, ...((o as THREE.Mesh).material ? [((o as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity, ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.getHex()] : [])]);
  const restOf = (o: THREE.Object3D) => { const c = mk(); c.position.copy(o.position); c.quaternion.copy(o.quaternion); c.scale.copy(o.scale); return pose(c); };

  // 1. before / after states, verb by verb
  const verbs: [string, (o: THREE.Object3D, f: number) => void, (o: THREE.Object3D) => boolean][] = [
    ["popIn", (o, f) => popIn(o, f, 10, 12), (o) => !o.visible],
    ["dropIn", (o, f) => dropIn(o, f, 10, 18), (o) => !o.visible],
    ["riseFromFloor", (o, f) => riseFromFloor(o, f, 10, 14, 1), (o) => !o.visible && near(o.position.y, 2 - 1)],
    ["growFrom", (o, f) => growFrom(o, f, 10, 12, [0, 0, 0]), (o) => !o.visible && o.position.length() === 0],
    ["fadeIn", (o, f) => fadeIn(o, f, 10, 12), (o) => !o.visible && ((o as THREE.Mesh).material as THREE.Material).opacity === 0],
    ["extrudeIn", (o, f) => extrudeIn(o, f, 10, 12), (o) => !o.visible],
    ["indicate", (o, f) => indicate(o, f, 10, 12), (o) => o.visible],
    ["wiggle", (o, f) => wiggle(o, f, 10, 12, { seed: 4 }), (o) => o.visible],
  ];
  for (const [n, verb, before] of verbs) {
    const o = mk(1, 2, 3), want = restOf(o);
    verb(o, 40); const after = pose(o);
    verb(o, 0); const isBefore = before(o);
    verb(o, 16); verb(o, 40);
    ok(after === want && pose(o) === want && isBefore, `${n}: hidden-or-rest before it starts, exactly the rest pose after it ends, even after a mid-way frame`);
  }
  const outO = mk(); popOut(outO, 40, 10); const outB = mk(); fadeOut(outB, 40, 10);
  ok(!outO.visible && !outB.visible && ((outB.material as THREE.Material).opacity === 0), "popOut and fadeOut end hidden");
  const fm = mk(); fadeIn(fm, 15, 10, 10); ok((fm.material as THREE.Material).transparent && fm.visible, "fadeIn mid-way is transparent"); fadeIn(fm, 99, 10, 10); ok(!(fm.material as THREE.Material).transparent, "and opaque again once fully in (no sorting artefacts left on)");
  const multi = new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial({ opacity: 0.5, transparent: true })]);
  fadeIn(multi, 15, 10, 10, (t) => t); const ms = multi.material as THREE.Material[];
  ok(near(ms[0].opacity, 0.5) && near(ms[1].opacity, 0.25), "fadeIn scales every material in an array by its own rest opacity");
  const pop = mk(); popIn(pop, 18, 10, 12); ok(pop.scale.x > 1, "popIn overshoots on the way");
  const ind = mk(); indicate(ind, 16, 10, 12); ok((ind.material as THREE.MeshStandardMaterial).emissive.r > 0.5 && ind.scale.x > 1.1, "indicate flashes and swells at its peak");

  // 2. purity: shuffled frames equal sequential frames, on one shared object
  const frames = Array.from({ length: 50 }, (_, i) => i - 2);
  let s = 7; const shuffled = [...frames].sort(() => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5);
  const impure = verbs.filter(([, verb]) => { const o = mk(1, 2, 3), seq = frames.map((f) => (verb(o, f), pose(o))), got = new Map(shuffled.map((f) => [f, (verb(o, f), pose(o))])); return !frames.every((f, i) => got.get(f) === seq[i]); }).map(([n]) => n);
  // RED: a verb that nudges instead of setting (position += ...) must be caught by the same harness
  const leaky = (o: THREE.Object3D, f: number) => { o.position.x += f > 10 ? 0.1 : 0; };
  const lo = mk(), lseq = frames.map((f) => (leaky(lo, f), pose(lo))), lgot = new Map(shuffled.map((f) => [f, (leaky(lo, f), pose(lo))]));
  ok(!frames.every((f, i) => lgot.get(f) === lseq[i]), "RED: an accumulating verb (position += 0.1) fails the shuffled-order check");
  ok(impure.length === 0, `8 verbs on one object give the same pose in shuffled order as in sequence${impure.length ? ` (impure: ${impure.join(", ")})` : ""}`);

  // 3. groups: explode / assemble, lagged, grid, wave, kinetic
  const g = new THREE.Group(); for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) g.add(mk(x, y, 0));
  const restG = g.children.map(restOf);
  explode(g, 0, 10, 12, { seed: 3 }); const pre = g.children.map(pose);
  explode(g, 30, 10, 12, { seed: 3 }); const blown = g.children.map(pose);
  ok(pre.every((p, i) => p === restG[i]) && blown.every((p, i) => p !== restG[i]), "explode: assembled before, every shard moved after");
  explode(g, 30, 10, 12, { seed: 3 }); ok(g.children.map(pose).every((p, i) => p === blown[i]), "explode is seeded: the same shards land in the same places");
  explode(g, 30, 10, 12, { seed: 4 }); ok(g.children.map(pose).some((p, i) => p !== blown[i]), "another seed scatters differently");
  assemble(g, 0, 10, 12, { seed: 3 }); ok(g.children.map(pose).every((p, i) => p === blown[i]), "assemble starts from exactly the exploded pose of the same seed");
  assemble(g, 22, 10, 12, { seed: 3 }); ok(g.children.map(pose).every((p, i) => p === restG[i]), "and ends exactly at rest");
  const starts: number[] = []; lagged(g, 0, 5, 3, (_c, _f, at) => starts.push(at)); ok(starts.join() === "5,8,11,14,17,20,23,26,29", "lagged starts each child 3 frames after the last");
  const gs: number[] = []; grid(g, 0, 0, 4, (_c, _f, at) => gs.push(at));
  ok(gs[4] === 0 && [1, 3, 5, 7].every((i) => gs[i] === 4) && [0, 2, 6, 8].every((i) => gs[i] === 8), "grid from the centre: middle first, edges one ring later, corners last");
  const ge: number[] = []; grid(g, 0, 0, 4, (_c, _f, at) => ge.push(at), { from: "edge" }); ok(ge[4] === 8 && ge[0] === 0, "grid from the edge reverses the rings");
  wave(g, 0, 10, 24); const w0 = g.children.map(pose); wave(g, 99, 10, 24); ok(w0.every((p, i) => p === restG[i]) && g.children.map(pose).every((p, i) => p === restG[i]), "wave leaves every child at rest before and after");
  wave(g, 22, 10, 24); ok(g.children.some((c) => c.position.y > (c.userData.anidoodleRest.position.y as number) + 0.1), "and lifts some mid-way");
  const word = new THREE.Group(); for (let i = 0; i < 4; i++) word.add(mk(i * 0.6, 0, 0));
  const wr = word.children.map(restOf);
  kinetic(word, 0, 2, 3); const k0 = word.children.map((c) => c.visible);
  kinetic(word, 50, 2, 3); ok(k0.every((v) => !v) && word.children.map(pose).every((p, i) => p === wr[i]), "kinetic: letters hidden before, all at rest after");
  kinetic(word, 9, 2, 3); ok(word.children.map((c) => c.visible).join() === "true,true,true,false", "and each letter enters 3 frames after the one before");
  // M1: text3d letters share one material, so "rise" set every letter's opacity to the last letter's.
  // The old test looked at .visible only; this one reads the opacity each letter is drawn with.
  {
    const env = { W: 1920, H: 1080, scale: 1, cache: new Map(), canvas: () => { throw new Error("no canvas in node"); } } as unknown as Env;
    const own = new THREE.MeshStandardMaterial({ color: "#336699" });
    for (const [label, abcd] of [["default material", text3d(env, defaultFont(), "ABCD")], ["one material passed in", text3d(env, defaultFont(), "ABCD", { material: own })]] as const) {
      const L = abcd.userData.letters, op = () => L.map((l) => (l.material as THREE.Material).opacity);
      kinetic(abcd, 9, 2, 3); const mid = op();
      ok(mid[0] > 0.5 && mid[1] > 0.2 && mid[2] > 0 && mid[3] === 0 && mid[0] > mid[1] && mid[1] > mid[2], `M1 kinetic rise on text3d (${label}): each letter fades in on its own (${mid.map((x) => x.toFixed(2)).join(", ")})`);
      kinetic(abcd, 0, 2, 3); kinetic(abcd, 50, 2, 3);
      ok(op().every((x) => x === 1) && L.every((l) => !(l.material as THREE.Material).transparent && l.visible), `M1 and after the last letter lands every letter is fully opaque again, drawn opaque (${label})`);
      kinetic(abcd, 9, 2, 3); ok(op().join() === mid.join(), `M1 the same frame drawn again gives the same opacities (${label})`);
    }
    ok(own.opacity === 1 && !own.transparent, "M1 the material passed in is left as it was (each letter fades its own copy)");
  }
  // L14: a one-point shape (a dot morphing into a line) threw a TypeError in resample
  {
    let err = ""; let r1: number[][] = [];
    try { r1 = resample([[1, 2, 3]], 4); } catch (e) { err = String(e); }
    ok(!err && r1.length === 4 && r1.every((p) => p.join() === "1,2,3"), `L14 resample of a one-point shape gives that point n times (${err || r1.length})`);
    let m: number[][] = []; err = "";
    try { m = morph([[0, 0, 0]], [[0, 0, 0], [2, 0, 0]], 0.5); } catch (e) { err = String(e); }
    ok(!err && m.length === 2 && m[1][0] === 1, `L14 a dot morphs into a line (${err || JSON.stringify(m)})`);
    let threw = ""; try { resample([], 3); } catch (e) { threw = String(e); }
    ok(threw.includes("resample"), `L14 an empty shape is refused with a clear error (${threw})`);
  }

  // 4. paths: writeOn draws whole tube segments, moveAlongPath runs at constant speed
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 2, 0), new THREE.Vector3(1.2, 2.1, 0), new THREE.Vector3(5, 0, 1)]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.05, 8));
  writeOn(tube, 0, 10, 20); const r0 = tube.geometry.drawRange.count, v0 = tube.visible;
  writeOn(tube, 20, 10, 20, (t) => t); const rMid = tube.geometry.drawRange.count;
  writeOn(tube, 40, 10, 20);
  ok(r0 === 0 && !v0 && rMid === 20 * 8 * 6 && tube.geometry.drawRange.count === tube.geometry.index!.count, `writeOn: nothing before, half the tube's segments at the midpoint (${rMid} indices), the whole index after`);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(99))); writeOn(line, 15, 10, 10, (t) => t); ok(line.geometry.drawRange.count === 50, "writeOn on a Line draws half its vertices at half way");
  const bead = new THREE.Object3D(), gaps: number[] = []; let last = new THREE.Vector3();
  for (let i = 0; i <= 50; i++) { moveAlongPath(bead, curve, i / 50, true); if (i) gaps.push(bead.position.distanceTo(last)); last = bead.position.clone(); }
  const mean = gaps.reduce((a, b) => a + b) / gaps.length; ok(Math.max(...gaps.map((x) => Math.abs(x / mean - 1))) < 0.03, "moveAlongPath covers equal distance per equal step in t (within 3%)");
  moveAlongPath(bead, curve, 0.5, true); ok(new THREE.Vector3(0, 0, 1).applyQuaternion(bead.quaternion).angleTo(curve.getTangentAt(0.5)) < 1e-6, "orient turns +z along the travel");

  // 5. morph: equal counts by arc length
  const sq: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], tri: [number, number, number][] = [[0, 0, 0], [2, 0, 0], [1, 2, 0], [0.5, 1, 0], [0.2, 0.4, 0], [0.1, 0.2, 0], [0.05, 0.1, 0]];
  const rs = resample(sq, 8, true), steps = rs.map((p, i) => { const q = rs[(i + 1) % 8]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
  ok(rs.length === 8 && steps.every((d) => near(d, 0.5, 1e-9)), "resample spaces 8 points 0.5 apart round a unit square (closed)");
  const m0 = morph(sq, tri, 0, { closed: true }), m1 = morph(sq, tri, 1, { closed: true }), mh = morph(sq, tri, 0.5, { closed: true });
  ok(m0.length === 7 && m1.length === 7 && mh.length === 7, "morph resamples both shapes to the larger count (7)");
  ok(JSON.stringify(m0) === JSON.stringify(resample(sq, 7, true)) && JSON.stringify(m1) === JSON.stringify(resample(tri, 7, true)), "and is exactly shape A at 0 and shape B at 1");
  ok(near(mh[0][0], (m0[0][0] + m1[0][0]) / 2), "with a straight mix between");
  const lg = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 7 }, () => new THREE.Vector3())); writePoints(lg, mh); ok(near(lg.attributes.position.getX(1), mh[1][0], 1e-6), "writePoints puts a morph into a geometry");
  let threw = false; try { writePoints(lg, m0.slice(0, 3)); } catch { threw = true; } ok(threw, "and refuses a point count the buffer was not built for");
  const tg = new THREE.TubeGeometry(curve, 20, 0.1, 6), size = tg.attributes.position.count; writeTube(tg, [[0, 0, 0], [0, 3, 0], [3, 3, 0]]);
  ok(tg.attributes.position.count === size && Math.abs(tg.attributes.position.getY(tg.attributes.position.count - 1) - 3) < 0.2, "writeTube re-lays a tube along new points in the same buffers");
};
