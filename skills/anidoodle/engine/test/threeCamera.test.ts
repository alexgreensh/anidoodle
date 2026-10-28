// THREE CAMERA TESTS. src/three-core/camera.ts: named moves are pure, a dolly runs at constant speed
// by arc length, a match cut keeps screen size across a lens change, handheld repeats for a seed
// and fitTo frames what it is given.
//   node tools/test.mjs threeCamera
import * as THREE from "three";
import { crane, dolly, dutch, fitTo, handheld, hold, look, matchCut, matchDistance, matchLens, orbit, pan, path, place, pullBack, pushIn, rackFocus, screenPx, screenSize, tilt, truck, whipPan, withMods, worldForPx, type CamState, type Move } from "../src/three-core/camera";
import { ease } from "../src/three-core/time";

export const name = "threeCamera";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const env = { W: 1920, H: 1080 };
  const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const base = look([0, 1, 10], [0, 0, 0], 35);

  // 1. purity: every move, shuffled frames vs sequential
  const curve = path([[-6, 1, 8], [-2, 2, 5], [0, 1.5, 4.5], [4, 1, 6], [6, 3, 9]]);
  const moves: [string, Move][] = [
    ["pushIn", pushIn(base, 0.4, 0, 48)], ["pullBack", pullBack(base, 0.5, 0, 48)], ["dolly", dolly(curve, 0, 48, { target: [0, 0, 0] })],
    ["orbit", orbit([0, 0, 0], -30, 60, 8, 2, 0, 48)], ["crane", crane(base, 3, 0, 48)], ["truck", truck(base, 2, 0, 48)], ["pan", pan(base, 20, 0, 48)], ["tilt", tilt(base, 10, 0, 48)],
    ["whipPan", whipPan(base, look([0, 1, 10], [8, 0, 4]), 0, 12)], ["handheld", withMods(hold(base), handheld(3, 1), dutch((f) => f * 0.1))],
  ];
  const frames = Array.from({ length: 60 }, (_, i) => i - 5);
  let s = 99; const shuffled = [...frames].sort(() => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5);
  const impure = moves.filter(([, m]) => { const a = frames.map((f) => JSON.stringify(m(f))), got = new Map(shuffled.map((f) => [f, JSON.stringify(m(f))])); return !frames.every((f, i) => got.get(f) === a[i]); }).map(([n]) => n);
  ok(impure.length === 0, `10 moves give the same state in shuffled order as in sequence${impure.length ? ` (impure: ${impure.join(", ")})` : ""}`);
  ok(moves.filter(([n]) => n !== "handheld").every(([, m]) => JSON.stringify(m(-5)) === JSON.stringify(m(0)) && JSON.stringify(m(48)) === JSON.stringify(m(200))), "every keyed move holds before it starts and after it ends (handheld is meant to keep breathing)");

  // 2. push / pull in log distance
  const flat = look([0, 0, 10], [0, 0, 0], 35), pi = pushIn(flat, 0.75, 0, 48, ease.linear);
  ok(near(dist(pi(48).pos, flat.target), 10 * 0.25) && near(dist(pi(24).pos, flat.target), 10 * 0.5), "pushIn 75% ends at a quarter of the distance and is at half way through (log-distance easing)");
  ok(near(dist(pullBack(flat, 1, 0, 10)(10).pos, flat.target), 20), "pullBack 100% doubles the distance");

  // 3. dolly runs at constant speed by arc length
  const lin = dolly(curve, 0, 100, { ease: ease.linear }), steps: number[] = [];
  for (let f = 0; f < 100; f++) steps.push(dist(lin(f).pos, lin(f + 1).pos));
  const mean = steps.reduce((a, b) => a + b, 0) / steps.length, spread = Math.max(...steps.map((x) => Math.abs(x / mean - 1)));
  ok(spread < 0.02, `a linear dolly moves the same distance every frame within 2% (worst ${(spread * 100).toFixed(2)}%) though its control points bunch up`);
  ok(dist(lin(0).pos, [-6, 1, 8]) < 1e-6 && dist(lin(100).pos, [6, 3, 9]) < 1e-6, "the dolly starts and ends on its path's ends");

  // 4. orbit keeps its radius and height
  const ob = orbit([1, 0, 1], 0, 90, 5, 2, 0, 24), mid = ob(12);
  ok(near(Math.hypot(mid.pos[0] - 1, mid.pos[2] - 1), 5) && near(mid.pos[1], 2) && near(ob(24).pos[0], 6) && near(ob(24).pos[2], 1), "orbit circles at radius 5 and height 2, ending at 90 degrees on +x");

  // 5. match cut: the subject keeps its screen size across a lens change
  const cam = new THREE.PerspectiveCamera(35, env.W / env.H, 0.1, 100), sub = 0.4;
  const dA = matchCut(sub, 120, 35, env);
  ok(near(screenSize({ fov: 35 }, sub, dA, env), 120), `matchCut puts a 0.4-unit subject at exactly 120 px at 35 deg (${dA.toFixed(3)} units out)`);
  const dB = matchDistance(dA, 35, 18);
  ok(near(screenSize({ fov: 18 }, sub, dB, env), 120) && dB > dA, "matchDistance keeps it at 120 px on an 18 deg lens, from farther away");
  const sA = look([0, 0, 4], [0, 0, 0], 50), sB = matchLens(sA, 20);
  const edge = (st: CamState) => { place(cam, st, env); return screenPx(cam, [0.5, 0, 0], env)[0] - screenPx(cam, [0, 0, 0], env)[0]; };
  ok(near(edge(sA), edge(sB), 1e-6), `matchLens keeps the subject's projected width when the fov changes 50 -> 20 (${edge(sA).toFixed(2)} px both)`);
  ok(near(worldForPx({ fov: 35 }, 2, 12, env) * 0 + screenSize({ fov: 35 }, worldForPx({ fov: 35 }, 2, 12, env), 12, env), 2), "worldForPx sizes a thread to exactly 2 px at its distance (lesson 27)");

  // 6. place + screenPx: the target lands on the frame's centre, roll turns it about the view axis
  place(cam, base, env); const c = screenPx(cam, base.target, env);
  ok(near(c[0], 960, 1e-6) && near(c[1], 540, 1e-6), "the target projects to the centre of a 1920x1080 frame");
  place(cam, { ...base, roll: 90 }, env); const r = screenPx(cam, [1, 0, 0], env);
  ok(near(r[0], 960, 1e-3) && Math.abs(r[1] - 540) > 50, "a 90 deg roll turns a point on the right to straight above or below centre");

  // 7. handheld: seeded and repeatable, different seeds differ, smooth (no per-frame jumps)
  const h1 = withMods(hold(base), handheld(7, 1)), h1b = withMods(hold(base), handheld(7, 1)), h2 = withMods(hold(base), handheld(8, 1));
  ok(frames.every((f) => JSON.stringify(h1(f)) === JSON.stringify(h1b(f))), "the same seed gives the same shake on every frame");
  ok(frames.some((f) => JSON.stringify(h1(f)) !== JSON.stringify(h2(f))), "another seed gives another shake");
  const jumps = frames.slice(1).map((f) => dist(h1(f).target, h1(f - 1).target)), wander = Math.max(...frames.map((f) => dist(h1(f).target, base.target)));
  ok(Math.max(...jumps) < wander * 0.25 && wander > 0.01 && wander < 0.3, `handheld wanders ${wander.toFixed(3)} units and never jumps more than a quarter of that in one frame (smooth, not static)`);

  // 8. whip pan holds posed frames on both ends
  const to = look([0, 1, 10], [8, 0, 4]), wp = whipPan(base, to, 0, 12, { hold: 2 });
  ok(JSON.stringify(wp(0)) === JSON.stringify(wp(2)) && JSON.stringify(wp(10)) === JSON.stringify(wp(12)) && JSON.stringify(wp(5)) !== JSON.stringify(wp(2)), "whipPan holds frames 0-2 and 10-12 still and moves between");
  ok(dist(wp(12).target, to.target) < 1e-6, "and lands exactly on its destination aim");
  let threw = false; try { whipPan(base, to, 0, 5, { hold: 2 }); } catch { threw = true; } ok(threw, "a whip too short for its held frames is refused");

  // 9. fitTo frames a box: every corner inside, the furthest one at the padding
  const box = new THREE.Box3(new THREE.Vector3(-2, 0, -1), new THREE.Vector3(3, 1.5, 1.2)), fit = fitTo(box, { padding: 1.2, aspect: env.W / env.H });
  place(cam, fit, env);
  const ndc = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(cam)), reach = Math.max(...ndc.map((n) => Math.max(Math.abs(n.x), Math.abs(n.y))));
  ok(near(reach, 1 / 1.2, 1e-4), `fitTo puts the box's furthest corner exactly at the 1.2 padding (reach ${reach.toFixed(5)} of the frame)`);
  const g = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1)); g.position.set(5, 2, 0); g.updateMatrixWorld(true);
  const fo = fitTo(g); ok(near(fo.target[0], 5) && near(fo.target[1], 2), "fitTo takes an object and aims at its bounds' centre");

  // 10. rack focus eases in dioptres
  ok(near(rackFocus(0, 0, 10, 2, 8), 2) && near(rackFocus(10, 0, 10, 2, 8), 8) && near(rackFocus(5, 0, 10, 2, 8, ease.linear), 1 / ((1 / 2 + 1 / 8) / 2)), "rackFocus lands on both distances and is linear in 1/d (3.2 at the midpoint, not 5)");
};
