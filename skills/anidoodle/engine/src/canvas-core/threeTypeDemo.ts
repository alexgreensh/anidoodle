// THREE TYPE DEMO. Extruded type as motion graphics, eight seconds, three looks and two
// transitions: "anidoodle" drops onto a warm studio cove (satin, studio light, contact shadows),
// an ink-blot wipe opens on "now in 3D" in toon shading with an ink outline, and the camera flies
// through it onto the end card (the wordmark and the repo URL as flat type in 3D space). Grain and
// a vignette finish every frame. It exercises type3d.ts, look.ts and transitions.ts together.
import type { Ctx, Env } from "./core";
import type { Film } from "./film";
import * as THREE from "three";
import { draw3d, memo, probe3d } from "../three-core/stage";
import { checking, registerSize, runChecks } from "../three-core/checks3d";
import { ease, lerp, seg, spring, tween } from "../three-core/time";
import { defaultFont, text3d, textPlane, type Letter } from "../three-core/type3d";
import { contactShadow, grain, matte, outline, satin, studio, toon, vignette } from "../three-core/look";
import { noiseWipe, transition, zoomThrough } from "../three-core/transitions";

const W = 1920, H = 1080, FPS = 24, N = 192;
// cuts on the 12-frame beat (120 bpm at 24 fps)
const WIPE = [72, 96] as const, ZOOM = [144, 168] as const;

// A photographer's cove: a floor that curves up into the back wall, so there is no horizon line
// and the light falls off smoothly behind the type (the "infinite white" of a product shot).
const cove = (color: THREE.ColorRepresentation, mat?: THREE.Material) => {
  const geo = new THREE.PlaneGeometry(40, 1, 1, 96), pos = geo.getAttribute("position");
  const floorLen = 40, r = 4, wall = 16, total = floorLen + (Math.PI / 2) * r + wall;
  for (let i = 0; i < pos.count; i++) {
    const s = (pos.getY(i) + 0.5) * total; let y: number, z: number;
    if (s < floorLen) { y = 0; z = 30 - s; }
    else if (s < floorLen + (Math.PI / 2) * r) { const a = (s - floorLen) / r; y = r - r * Math.cos(a); z = 30 - floorLen - r * Math.sin(a); }
    else { y = r + (s - floorLen - (Math.PI / 2) * r); z = 30 - floorLen - r; }
    pos.setXYZ(i, pos.getX(i), y, z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat ?? matte(color));
};

const font = () => defaultFont();
const SIZE = 1.25, BASE = -0.3525 * SIZE; // Poppins caps are 0.705 em; type3d centres them on y 0

// ---------------------------------------------------------------- scene A: "anidoodle" drops in
const buildA = (env: Env) => {
  const scene = new THREE.Scene();
  const floor = cove("#f6ecdd"); floor.position.y = BASE; scene.add(floor);
  const word = text3d(env, font(), "anidoodle", { size: SIZE, depth: 0.32, bevel: 0.022, letterSpacing: 0.01, material: satin("#f0642f") });
  scene.add(word);
  const shadows = word.userData.letters.map((l) => { const s = contactShadow(0.95 * SIZE * 0.62, 0.6, { aspect: 1.4, color: "#5a3426" }); s.position.set(l.userData.home.x, BASE + 0.002, 0); scene.add(s); return s; });
  scene.add(studio({ at: { x: 0, y: 0, z: 0 } }).group);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
  return { scene, letters: word.userData.letters, shadows, cam };
};
// a letter dropped at frame `at`: falls 2.6 units in 11 frames, lands with a squash that springs back
const drop = (l: Letter, f: number, at: number, i: number, sh: THREE.Mesh) => {
  const p = seg(f, at, at + 11), h = l.userData.home, fall = 2.6 * (1 - p * p), land = spring(f, at + 11, FPS, 2.6, 0.3);
  // a hop that ripples along the word once everything has landed: the type stays alive
  const hop = Math.max(0, Math.sin(Math.PI * seg(f, 46 + i * 2.2, 58 + i * 2.2))) * 0.32;
  l.visible = f >= at - 1;
  l.position.set(h.x, h.y + fall + hop, h.z);
  l.rotation.set(0, 0, (1 - ease.outCubic(p)) * (i % 2 ? 0.5 : -0.45));
  const sq = f >= at + 11 ? land * 0.22 : 0;
  // squash about the letter's foot, not its centre: shift down by what the scale removes
  l.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
  l.position.y -= (sq * SIZE * 0.705) / 2;
  const up = fall + hop, near = 1 - Math.min(1, up / 2.6);
  sh.visible = l.visible;
  sh.scale.setScalar(lerp(1.7, 1, near));
  (sh.material as THREE.MeshBasicMaterial).opacity = lerp(0.12, 1, near * near);
};
const sceneA = (ctx: Ctx, env: Env, f: number) => {
  const { scene, letters, shadows, cam } = memo(env, "typeDemo:A", buildA);
  letters.forEach((l, i) => drop(l, f, -6 + i * 3.2, i, shadows[i]));
  const t = tween(f, 0, 96, ease.outCubic);
  cam.position.set(lerp(-0.7, 0.5, t), lerp(2.9, 2.2, t), lerp(12.6, 11.2, t)); cam.lookAt(0, -0.05, 0);
  draw3d(ctx, env, scene, cam, { clear: "#efe3d2" }); if (f >= 48) { probe3d(ctx, env, letters[0].parent!, cam, "anidoodle"); sizeCheck(f, letters[0].parent!, cam, env); } /* the letters drop in from above the frame on purpose; the word must read whole once it has landed */
};

// what the type must keep true (checks3d, gate check 5): the word, once it has landed, is big enough to read
const sizeCheck = (f: number, word: THREE.Object3D, cam: THREE.Camera, env: Env) => { if (!checking()) return; registerSize(word, 60); runChecks(f, cam, env); };

// ---------------------------------------------------------------- scene B: "now in 3D", toon and ink
const buildB = (env: Env) => {
  const scene = new THREE.Scene();
  const floor = cove("#3a52c4"); floor.position.y = BASE; scene.add(floor);
  const cream = toon("#fff3dc", 3), yellow = toon("#ffd23f", 3);
  const word = text3d(env, font(), "now in 3D", { size: SIZE, depth: 0.42, bevel: 0.015, letterSpacing: 0.02, material: [cream, cream, cream, cream, cream, yellow, yellow] });
  scene.add(word);
  // ink outline 4.5 px at 1080 on every letter, whatever the camera distance (screen width, lesson 27)
  word.userData.letters.forEach((l) => outline(l, 4.5, "#14112a", { screen: true, frameH: H }));
  const shadows = word.userData.letters.map((l) => { const s = contactShadow(SIZE * 0.62, 0.5, { aspect: 1.5, color: "#0e1440", opacity: 0.6 }); s.position.set(l.userData.home.x, BASE + 0.002, 0); scene.add(s); return s; });
  scene.add(studio({ intensity: 1.1 }).group);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
  return { scene, word, letters: word.userData.letters, shadows, cam };
};
const sceneB = (ctx: Ctx, env: Env, f: number) => {
  const { scene, word, letters, shadows, cam } = memo(env, "typeDemo:B", buildB);
  letters.forEach((l, i) => {
    // pop up from the floor: scale from nothing with an overshoot, staggered two frames a letter
    const at = 2 + i * 2.5, p = seg(f, at, at + 12), s = ease.outBack(p), h = l.userData.home;
    l.visible = p > 0;
    l.scale.setScalar(Math.max(0.0001, s));
    l.position.set(h.x, h.y - (1 - s) * SIZE * 0.35, h.z);
    // "3D" spins round once on its own axis to show it has a back
    const spin = i >= 5 ? tween(f, 40 + (i - 5) * 3, 62 + (i - 5) * 3, ease.inOutCubic) * Math.PI * 2 : 0;
    l.rotation.set(0, spin + (1 - ease.outCubic(p)) * -0.9, 0);
    shadows[i].visible = l.visible; shadows[i].scale.setScalar(Math.max(0.0001, s));
  });
  word.rotation.y = lerp(-0.22, 0.16, tween(f, 0, 96, ease.inOutSine));
  const t = tween(f, 0, 96, ease.inOutSine);
  cam.position.set(lerp(0.8, -0.4, t), lerp(2.8, 2.1, t), lerp(12.2, 11.0, t)); cam.lookAt(0, -0.1, 0);
  draw3d(ctx, env, scene, cam, { clear: "#2d3f8f" }); probe3d(ctx, env, word, cam, "now in 3D");
  if (f >= 2 + (letters.length - 1) * 2.5 + 12) sizeCheck(f, word, cam, env); // every letter has popped up
};

// ---------------------------------------------------------------- scene C: the end card
const buildC = (env: Env) => {
  const scene = new THREE.Scene();
  const base = -0.3525 * 1.0;
  const floor = cove("#efe3d2"); floor.position.y = base; scene.add(floor);
  const word = text3d(env, font(), "anidoodle", { size: 1.0, depth: 0.3, bevel: 0.022, letterSpacing: 0.01, material: satin("#f0642f") });
  word.position.y = 0.42; scene.add(word);
  const url = textPlane(env, "github.com/alexgreensh/anidoodle", { size: 0.16, color: "#3a2b2a", letterSpacing: 0.01 });
  url.position.set(0, -0.16, 1.0); scene.add(url);
  const made = textPlane(env, "3D type, drawn in code", { size: 0.17, color: "#8a5a3c" });
  made.position.set(0, 1.3, 0.3); scene.add(made);
  const sh = contactShadow(6.4, 0.75, { aspect: 1, color: "#5a3426", opacity: 0.35 }); sh.scale.set(1, 0.3, 1); sh.position.set(0, base + 0.002, 0); scene.add(sh);
  scene.add(studio().group);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
  return { scene, letters: word.userData.letters, url, made, cam };
};
const sceneC = (ctx: Ctx, env: Env, f: number) => {
  const { scene, letters, url, made, cam } = memo(env, "typeDemo:C", buildC);
  // a slow wave through the wordmark: each letter floats a little, one after the other
  letters.forEach((l, i) => { const h = l.userData.home; l.position.set(h.x, h.y + 0.06 * Math.sin((f / FPS) * Math.PI * 1.2 - i * 0.55), h.z); l.rotation.set(0, 0.08 * Math.sin((f / FPS) * Math.PI * 0.8 - i * 0.4), 0); });
  const pu = tween(f, 6, 22, ease.outCubic), pm = tween(f, 12, 28, ease.outCubic);
  (url.material as THREE.MeshBasicMaterial).opacity = pu; url.position.y = -0.16 - (1 - pu) * 0.1;
  (made.material as THREE.MeshBasicMaterial).opacity = pm; made.position.y = 1.3 + (1 - pm) * 0.12;
  const t = tween(f, 0, 48, ease.outCubic);
  cam.position.set(0, lerp(0.7, 0.55, t), lerp(9.2, 8.6, t)); cam.lookAt(0, 0.2, 0);
  draw3d(ctx, env, scene, cam, { clear: "#efe3d2" }); probe3d(ctx, env, letters[0].parent!, cam, "anidoodle"); sizeCheck(f, letters[0].parent!, cam, env);
};

// ---------------------------------------------------------------- finish and shots
const finish = (ctx: Ctx, env: Env, f: number, dark = false) => { vignette(ctx, env, dark ? 0.32 : 0.22, dark ? "#0b0f2a" : "#3a2420"); grain(ctx, env, f); };
const shotA = (ctx: Ctx, f: number, env: Env) => { sceneA(ctx, env, f); finish(ctx, env, f); };
const shotWipe = (ctx: Ctx, f: number, env: Env) => {
  const F = WIPE[0] + f;
  transition(ctx, env, seg(F, WIPE[0], WIPE[1]), noiseWipe(11, { scale: 420, ink: "#14112a" }), (c, e) => sceneA(c, e, F), (c, e) => sceneB(c, e, F - WIPE[0]));
  finish(ctx, env, F, seg(F, WIPE[0], WIPE[1]) > 0.5);
};
const shotB = (ctx: Ctx, f: number, env: Env) => { const F = WIPE[1] + f; sceneB(ctx, env, F - WIPE[0]); finish(ctx, env, F, true); };
const shotZoom = (ctx: Ctx, f: number, env: Env) => {
  const F = ZOOM[0] + f;
  transition(ctx, env, seg(F, ZOOM[0], ZOOM[1]), zoomThrough(), (c, e) => sceneB(c, e, F - WIPE[0]), (c, e) => sceneC(c, e, F - ZOOM[0]));
  finish(ctx, env, F, seg(F, ZOOM[0], ZOOM[1]) < 0.5);
};
const shotC = (ctx: Ctx, f: number, env: Env) => { const F = ZOOM[1] + f; sceneC(ctx, env, F - ZOOM[0]); finish(ctx, env, F); };

export const threeTypeDemo: Film = {
  meta: { title: "three type demo", W, H, fps: FPS, bpm: 120, durationFrames: N, kind: "explainer", poster: 48 },
  assets: { images: {} },
  shots: [
    { id: "drop", start: 0, end: WIPE[0], draw: shotA },
    { id: "inkWipe", start: WIPE[0], end: WIPE[1], draw: shotWipe },
    { id: "toon", start: WIPE[1], end: ZOOM[0], draw: shotB },
    { id: "zoomThrough", start: ZOOM[0], end: ZOOM[1], draw: shotZoom },
    { id: "endCard", start: ZOOM[1], end: N, draw: shotC },
  ],
};
