// THREE MOTION DEMO. A 9.5 s tour of the 3D motion kit (three-core/timeline, camera, mograph) on
// simple bevelled shapes in one studio: four stations along x, one shot each, cuts on the beat.
//   grid     a 5x5 field of bevelled tiles pops in from the centre, then a wave rolls across it;
//            push-in with a light handheld
//   write    a ribbon writes itself through the air with a glowing bead riding its tip; pillars rise
//            from the floor; the camera dollies past on a constant-speed path
//   morph    a ring draws on, its beads pop in, and the ring morphs into a star while the camera
//            orbits; a whip pan (held frames, no smear) carries us to the next station
//   explode  a 3x3x3 block flashes, blows apart and reassembles under a crane up with a dutch roll
// Everything moving is set from the frame: the scene is built once (memo) and every draw re-poses it.
import type { Ctx, Env } from "./core";
import type { Film } from "./film";
import * as THREE from "three";
import { draw3d, memo } from "../three-core/stage";
import { checking, registerPath, registerSize, runChecks } from "../three-core/checks3d";
import { ease, seg, tween } from "../three-core/time";
import { crane, dolly, dutch, handheld, hash01, look, orbit, path, place, pushIn, then, whipPan, withMods, type CamState, type Move, type V3 } from "../three-core/camera";
import { assemble, dropIn, explode, grid, indicate, lagged, morph, moveAlongPath, popIn, riseFromFloor, wave, writeOn, writeTube } from "../three-core/mograph";

const W = 1920, H = 1080, FPS = 24, BEAT = 12, N = 19 * BEAT; // 228 frames, 9.5 s
const BG = "#15122a", FLOOR = "#221d3d";
const PAL = { coral: "#ff6b5b", sun: "#ffc53d", teal: "#2ec4b6", lilac: "#8c7dff", cream: "#f3ece0" };
const CUT = { write: 4 * BEAT, morph: 9 * BEAT, explode: 14 * BEAT };
const ST = { grid: [0, 0, 0] as V3, write: [17, 0, 0] as V3, morph: [34, 0, 0] as V3, explode: [51, 0, 0] as V3 };

const mat = (color: string, o: { emissive?: string; ei?: number; rough?: number } = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: o.rough ?? 0.42, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.35, emissive: o.emissive ?? "#000000", emissiveIntensity: o.ei ?? 1 });
// a rounded rectangle extruded with a soft bevel: the "designed object" look, never a raw box
const slab = (w: number, d: number, depth: number, r: number, bevel = 0.06) => {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 6 });
  return g;
};
const shadowy = (m: THREE.Object3D) => { m.traverse((c: THREE.Object3D) => { c.castShadow = true; c.receiveShadow = true; }); return m; };

const build = () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 22, 48);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const key = new THREE.DirectionalLight("#fff1dc", 2.4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight("#9fb4ff", 1.2); scene.add(rim, rim.target);
  scene.add(new THREE.HemisphereLight("#c9d2ff", "#2a2240", 0.85));

  // grid: 5x5 tiles in three heights, in a palette that walks the colours diagonally
  const tiles = new THREE.Group(), heights = [0.25, 0.5, 0.8].map((h) => { const g = slab(0.8, 0.8, h, 0.16, 0.05); g.rotateX(-Math.PI / 2); g.translate(0, 0.05, 0); return g; });
  const tileCols = [PAL.coral, PAL.sun, PAL.teal, PAL.lilac, PAL.cream].map((c) => mat(c));
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    const h = Math.floor(hash01(11, i * 5 + j) * 3), m = new THREE.Mesh(heights[h], tileCols[(i + j) % 5]);
    m.position.set((i - 2) * 1.02, 0, (j - 2) * 1.02); tiles.add(m);
  }
  tiles.position.set(...ST.grid); scene.add(shadowy(tiles));

  // write: a ribbon swooping through the air, a bead at its tip, pillars around it
  const swoop = path([[-4, 0.4, 2.2], [-2.6, 1.8, 0.4], [-0.6, 3.0, -1.4], [1.6, 2.4, -0.6], [1.2, 1.0, 1.4], [-0.4, 1.4, 0.8], [0.4, 2.6, -0.2], [2.6, 3.2, 0.2], [4.2, 1.6, 1.6]].map((p) => [p[0] + ST.write[0], p[1], p[2]] as V3));
  const ribbon = new THREE.Mesh(new THREE.TubeGeometry(swoop, 480, 0.13, 20), mat(PAL.coral, { rough: 0.3 }));
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 20), mat(PAL.sun, { emissive: PAL.sun, ei: 0.9 }));
  const pillars = new THREE.Group();
  [[-3.0, -2.0, 1.6, PAL.lilac], [3.4, -2.4, 2.4, PAL.teal], [-0.8, -3.4, 1.1, PAL.cream], [4.6, 0.2, 0.8, PAL.sun]].forEach(([x, z, h, c]) => {
    const g = new THREE.CylinderGeometry(0.42, 0.42, h as number, 40); g.translate(0, (h as number) / 2, 0);
    const m = new THREE.Mesh(g, mat(c as string)); m.position.set(ST.write[0] + (x as number), 0, z as number); pillars.add(m);
  });
  bead.position.copy(swoop.getPointAt(0));
  scene.add(shadowy(ribbon), shadowy(bead), shadowy(pillars));

  // morph: a ring of beads and a tube laid through them, standing up; a circle becoming a star
  const M = 64, cy = 2.3, ringR = 1.9;
  const circle: V3[] = Array.from({ length: M }, (_, i) => { const a = (i / M) * Math.PI * 2 + Math.PI / 2; return [ST.morph[0] + Math.cos(a) * ringR, cy + Math.sin(a) * ringR, 0]; });
  const star: V3[] = Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.95 : 2.25; return [ST.morph[0] + Math.cos(a) * r, cy + Math.sin(a) * r, 0]; });
  const ringTube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(circle.map((p) => new THREE.Vector3(...p)), true), 256, 0.07, 12, true), mat(PAL.teal, { rough: 0.3 }));
  const beads = new THREE.Group(), beadGeo = new THREE.SphereGeometry(0.15, 24, 16), beadMat = mat(PAL.sun, { emissive: "#ff9a1f", ei: 0.35 });
  for (let i = 0; i < 20; i++) beads.add(new THREE.Mesh(beadGeo, beadMat));
  const plinth = new THREE.Mesh(slab(5.6, 1.4, 0.3, 0.3, 0.06).rotateX(-Math.PI / 2), mat(PAL.lilac)); plinth.position.set(ST.morph[0], 0.06, 0);
  scene.add(shadowy(ringTube), shadowy(beads), shadowy(plinth));

  // explode: a 3x3x3 block of soft cubes, sun on the corners, coral on the edges, cream elsewhere
  const block = new THREE.Group(), cubeGeo = slab(0.52, 0.52, 0.52, 0.12, 0.05); cubeGeo.center();
  const cubeMat = { sun: mat(PAL.sun), coral: mat(PAL.coral), cream: mat(PAL.cream) };
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
    const ends = [i, j, k].filter((v) => v !== 1).length, m = new THREE.Mesh(cubeGeo, ends === 3 ? cubeMat.sun : ends === 2 ? cubeMat.coral : cubeMat.cream);
    m.position.set((i - 1) * 0.68, 0.34 + j * 0.68, (k - 1) * 0.68); block.add(m);
  }
  const blockWrap = new THREE.Group(); blockWrap.add(block); blockWrap.position.set(...ST.explode);
  scene.add(shadowy(blockWrap));

  const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 200);
  return { scene, key, rim, tiles, swoop, ribbon, bead, pillars, circle, star, ringTube, beads, block, blockWrap, cam };
};

// ---- camera, one move per shot, in film frames
const shot1 = withMods(pushIn(look([3.6, 4.4, 7.2], [0, 0.1, 0.2], 36), 0.22, 0, CUT.write, ease.inOutSine), handheld(2, 0.6));
const shot2 = withMods(dolly(path([[ST.write[0] - 5.5, 1.3, 7.6], [ST.write[0] - 2.5, 2.3, 7.8], [ST.write[0] + 1.5, 2.8, 8.0], [ST.write[0] + 4.5, 2.1, 8.4]]), CUT.write, CUT.morph, { target: [ST.write[0], 1.7, 0], fov: 38, ease: ease.inOutSine }), handheld(3, 0.4));
const D0: CamState = look([ST.explode[0] + 4.6, 2.4, 6.6], [ST.explode[0], 1.0, 0], 36);
const WHIP = CUT.explode - BEAT;
const orbitC = orbit([ST.morph[0], 1.9, 0], -38, 22, 10.6, 0.8, CUT.morph, WHIP + 2, { fov: 36, ease: ease.inOutSine });
const shot3: Move = then(orbitC, WHIP, whipPan(orbitC(WHIP), D0, WHIP, CUT.explode, { hold: 2 }));
const shot4 = withMods(crane(D0, 2.2, CUT.explode, N, { follow: 0.25, ease: ease.inOutSine }), dutch((f) => -7 * tween(f, CUT.explode, N, ease.inOutSine)), handheld(5, 0.5));
const camAt = (f: number) => (f < CUT.write ? shot1(f) : f < CUT.morph ? shot2(f) : f < CUT.explode ? shot3(f) : shot4(f));

const draw = (ctx: Ctx, f: number, env: Env) => {
  const s = memo(env, "threeMotionDemo", build);

  // grid: pops from the centre outwards (begun just before frame 0 so the film opens on motion), then a wave
  grid(s.tiles, f, -14, 3, (c, ff, at) => popIn(c, ff, at, 12));
  wave(s.tiles, f, 20, 26, { height: 0.45, width: 4 });

  // write: pillars rise on the beat, the ribbon writes on with the bead on its tip
  lagged(s.pillars, f, CUT.write - 6, 6, (c, ff, at) => riseFromFloor(c, ff, at, 14, 2.6));
  const w0 = CUT.write + 2, w1 = CUT.morph - 10, wt = ease.inOutSine(seg(f, w0, w1));
  writeOn(s.ribbon, f, w0, w1 - w0, ease.inOutSine);
  // the bead drops onto the ribbon's start (its rest pose), then rides the tip; dropIn's squash rings on
  dropIn(s.bead, f, w0 - 10, 14, { height: 2.5 });
  if (f >= w0) moveAlongPath(s.bead, s.swoop, wt);

  // morph: ring draws on, beads pop in around it, circle becomes star, star pulses
  const m0 = CUT.morph, mt = ease.inOutCubic(seg(f, m0 + 14, m0 + 34));
  const shape = morph(s.circle, s.star, mt, { n: 120, closed: true });
  writeTube(s.ringTube.geometry as THREE.TubeGeometry, shape, true);
  writeOn(s.ringTube, f, m0 - 4, 14, ease.outCubic);
  const ring20 = morph(s.circle, s.star, mt, { n: 20, closed: true });
  // popIn owns scale and visibility only, so the beads ride the morph through position freely
  lagged(s.beads, f, m0 + 2, 1, (b, ff, at, i) => { b.position.set(...ring20[i]); popIn(b, ff, at, 10); });
  indicate(s.beads, f, m0 + 36, 12, { scale: 1.0, color: "#ffffff", strength: 0.5 });

  // explode: flash in the whip's tail, blow apart on the beat, home again two beats later
  indicate(s.blockWrap, f, CUT.explode - 6, 12, { scale: 1.08, color: "#ffe9b0", strength: 0.45 });
  if (f < CUT.explode + 24) explode(s.block, f, CUT.explode + 6, 18, { seed: 9, distance: 1.9, spin: 0.35, upward: true });
  else assemble(s.block, f, CUT.explode + 26, 22, { seed: 9, distance: 1.9, spin: 0.35, upward: true, ease: ease.inOutCubic });

  // lights follow the station the camera is at, so one 16-unit shadow map covers every shot
  const c = camAt(f), at = c.target;
  s.key.position.set(at[0] + 5, 9, at[2] + 6); s.key.target.position.set(at[0], 0, at[2]);
  s.rim.position.set(at[0] - 4, 5, at[2] - 8); s.rim.target.position.set(at[0], 1, at[2]);
  place(s.cam, c, env);
  draw3d(ctx, env, s.scene, s.cam, { clear: BG, shadows: true });
  // what each station must keep true (checks3d, gate check 5): its subject big enough to read, and the bead
  // riding the ribbon never passes through a pillar (an upright cylinder the bead's size around its centre)
  if (checking()) {
    if (f < CUT.write) registerSize(s.tiles, 40);
    else if (f < CUT.morph) {
      registerSize(s.pillars, 40);
      if (f >= w0) registerPath({ at: (ff) => s.swoop.getPointAt(ease.inOutSine(seg(ff, w0, w1))).clone().setY(s.swoop.getPointAt(ease.inOutSine(seg(ff, w0, w1))).y - 0.24), from: f, to: f, radius: 0.24, height: 0.48, name: "bead" }, s.pillars.children.map((c: THREE.Object3D, i: number) => ({ name: `pillar ${i + 1}`, box: c })));
    } else if (f < WHIP) registerSize(s.ringTube, 40);
    else if (f >= CUT.explode) registerSize(s.blockWrap, 40);
    runChecks(f, s.cam, env);
  }
};

const shot = (id: string, start: number, end: number) => ({ id, start, end, draw: (ctx: Ctx, local: number, env: Env) => draw(ctx, start + local, env) });
export const threeMotionDemo: Film = {
  meta: { title: "three motion demo", W, H, fps: FPS, bpm: 120, durationFrames: N, kind: "explainer", poster: 130,
    // the whip pan opens on posed held frames (no smear, lesson 46); the star has finished, so they are truly still
    holds: [[WHIP, WHIP + 3, "whip pan: held pose before the whip"]] },
  assets: { images: {} },
  shots: [shot("grid", 0, CUT.write), shot("write", CUT.write, CUT.morph), shot("morph", CUT.morph, CUT.explode), shot("explode", CUT.explode, N)],
};
