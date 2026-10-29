// STAGE. The bridge between three.js and the film contract. A 3D shot is an ordinary shot: its
// draw(ctx, local, env) builds or updates a scene from the frame number alone, then calls
// draw3d(), which renders through WebGL and copies the pixels onto the frame's 2D canvas. So
// render, still, gate, captions, the player and the score all work on 3D films unchanged, and
// 2D layers (titles, subtitles, grain) can sit on top in the same draw.
//
// Purity is the whole game. The renderer is kept between frames (building one costs ~100 ms),
// and so may the scene graph (memo below), but every value that moves must be SET from the frame
// on every draw: a position left over from the frame drawn before makes frame N depend on the
// order frames were asked for, and parallel renders then disagree. gate.mjs seeks out of order
// and catches it. Never read a clock: AnimationMixer.setTime(f / fps), never mixer.update(dt).
// Import three as `import * as THREE from "three"` in each file and never re-export the namespace:
// esbuild then drops the parts a film never uses (the file loaders that could fetch, among them).
import * as THREE from "three";
import type { Ctx, Env } from "../canvas-core/core";
import { probeRect } from "../canvas-core/core";

// Hosts see this string in the page bundle and start Chrome with WebGL on (adapters/playwright.mjs).
export const WEBGL_MARKER = "__ANIDOODLE_WEBGL__";
(globalThis as Record<string, unknown>)[WEBGL_MARKER] = true;

export type StageOpts = {
  /** render at ss x the device size and scale down: smooth edges that never depend on MSAA support. 1 to 3, default 2 */
  ss?: number;
  /** soft shadow maps (PCFSoft). Off by default: a shadow is a choice, and acne is the first "cheap 3D" tell */
  shadows?: boolean;
  toneMapping?: THREE.ToneMapping;
  exposure?: number;
};
export type Stage = { renderer: THREE.WebGLRenderer; w: number; h: number; ss: number };

const KEY = "three:stage";
/** The film's one WebGL renderer, sized to the frame at env.scale (x ss). Built on first use, then kept. draw3d sets its tone mapping and exposure on every call. */
export const stage = (env: Env, opts: StageOpts = {}): Stage => {
  const ss = Math.max(1, Math.min(3, Math.round(opts.ss ?? 2)));
  const w = Math.round(env.W * env.scale * ss), h = Math.round(env.H * env.scale * ss);
  const key = `${KEY}:${w}x${h}:${opts.shadows ? 1 : 0}`;
  const hit = env.cache.get(key) as Stage | undefined;
  if (hit) return hit;
  if (!env.webgl) throw new Error("stage: this host has no WebGL surface (env.webgl). 3D shots need the page host or the interactive host.");
  const canvas = env.webgl(w, h);
  const renderer = new THREE.WebGLRenderer({ canvas: canvas as HTMLCanvasElement, antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = opts.toneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1;
  renderer.shadowMap.enabled = !!opts.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // shadow maps re-render only when asked; a frame-pure film asks every frame (draw3d sets needsUpdate)
  renderer.shadowMap.autoUpdate = false;
  const s: Stage = { renderer, w, h, ss };
  env.cache.set(key, s);
  return s;
};

/**
 * Build something once per page and keep it: geometry, materials, a whole scene graph. The
 * builder gets env and must not read the frame. Everything that changes over time is set by the
 * shot's draw on every frame, never left to persist.
 */
export const memo = <T>(env: Env, key: string, build: (env: Env) => T): T => {
  const k = `three:memo:${key}`;
  if (!env.cache.has(k)) env.cache.set(k, build(env));
  return env.cache.get(k) as T;
};

/**
 * Render scene through camera and copy the result onto the frame. The camera's aspect is set from
 * the film here, so a reshaped film (9x16, 1x1) keeps its proportions. `clear` paints the frame
 * first (pass null to composite over what the shot already drew, e.g. a painted 2D background).
 */
export const draw3d = (ctx: Ctx, env: Env, scene: THREE.Scene, camera: THREE.Camera, opts: StageOpts & { clear?: string | null } = {}) => {
  const st = stage(env, opts), { renderer } = st;
  // the renderer is shared by every shot of this size, but its look belongs to THIS shot: set it on
  // every call, or a shot inherits the exposure of whichever shot happened to build the renderer
  renderer.toneMapping = opts.toneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1;
  if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) { const c = camera as THREE.PerspectiveCamera; c.aspect = env.W / env.H; c.updateProjectionMatrix(); }
  scene.updateMatrixWorld(true);
  if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = true;
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  if (gl.isContextLost()) throw new Error("draw3d: WebGL context lost. The frame was NOT drawn; re-render it in a fresh page.");
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const W = Math.round(env.W * env.scale), H = Math.round(env.H * env.scale);
  if (opts.clear !== null) { ctx.fillStyle = opts.clear ?? "#000"; ctx.fillRect(0, 0, W, H); }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(renderer.domElement as CanvasImageSource, 0, 0, st.w, st.h, 0, 0, W, H);
  ctx.restore();
};

/** Seeded random for anything 3D: the same numbers on every machine. Never Math.random. */
export const rand = (seed: number) => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

/**
 * Report a 3D object's on-screen box to the frame probe, so framecheck.mjs catches 3D type or a
 * hero object cut by the frame edge (the 2D drawing code reports its boxes the same way). Call it
 * after positioning the camera, for anything the viewer must see whole. No cost unless framecheck
 * is running. The box is the projected corners of the object's world bounding box.
 */
const _box = new THREE.Box3(), _v = new THREE.Vector3();
export const probe3d = (ctx: Ctx, env: Env, object: THREE.Object3D, camera: THREE.Camera, label: string, kind: "text" | "box" = "text") => {
  if (!(globalThis as { __ANIDOODLE_PROBE__?: unknown }).__ANIDOODLE_PROBE__) return;
  if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) { const c = camera as THREE.PerspectiveCamera; c.aspect = env.W / env.H; c.updateProjectionMatrix(); }
  object.updateWorldMatrix(true, true); camera.updateMatrixWorld();
  _box.setFromObject(object); if (_box.isEmpty()) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    _v.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z).project(camera);
    if (_v.z > 1) continue; // behind the camera: not on screen
    const x = ((_v.x + 1) / 2) * env.W, y = ((1 - _v.y) / 2) * env.H;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (!Number.isFinite(x0)) return;
  ctx.save(); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.globalAlpha = 1;
  probeRect(ctx, env, x0, y0, x1 - x0, y1 - y0, label, kind);
  ctx.restore();
};
