// THREE STAGE TESTS. src/three-core/stage.ts keeps one renderer per size and shadow setting. Its
// tone mapping and exposure belong to the SHOT, so each draw3d must set them: a renderer cached from
// an earlier shot must not lend that shot's look to the next one (or the look depends on draw order).
//   node tools/test.mjs threeStage
import * as THREE from "three";
import type { Ctx, Env } from "../src/canvas-core/core";
import { draw3d, stage } from "../src/three-core/stage";

export const name = "threeStage";
export const run = (ok: (cond: boolean, label: string) => void) => {
  // a stand-in renderer: records what each render saw (no WebGL in node)
  const seen: string[] = [];
  const renderer = { toneMapping: THREE.ACESFilmicToneMapping as THREE.ToneMapping, toneMappingExposure: 1, shadowMap: { enabled: false, needsUpdate: false }, domElement: {},
    setClearColor() {}, getContext: () => ({ isContextLost: () => false }), render() { seen.push(`${renderer.toneMapping}@${renderer.toneMappingExposure}`); } };
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true }) as unknown as Ctx;
  const env = { W: 64, H: 36, scale: 1, cache: new Map(), webgl: () => { throw new Error("the renderer is already cached"); } } as unknown as Env;
  env.cache.set(`three:stage:${64 * 2}x${36 * 2}:0`, { renderer, w: 128, h: 72, ss: 2 });
  ok(stage(env).renderer === (renderer as unknown), "GREEN the stand-in is the cached renderer draw3d will use");
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera();
  draw3d(ctx, env, scene, cam, { exposure: 1.6 });
  draw3d(ctx, env, scene, cam, { exposure: 0.7, toneMapping: THREE.NeutralToneMapping });
  draw3d(ctx, env, scene, cam);
  const want = [`${THREE.ACESFilmicToneMapping}@1.6`, `${THREE.NeutralToneMapping}@0.7`, `${THREE.ACESFilmicToneMapping}@1`];
  ok(seen.join() === want.join(), `M12 every draw3d renders with its own exposure and tone mapping, whatever was drawn before (${seen.join(" ")})`);
  seen.length = 0;
  draw3d(ctx, env, scene, cam); draw3d(ctx, env, scene, cam, { exposure: 1.6 });
  ok(seen.join() === [want[2], want[0]].join(), "M12 the same shots drawn in the other order look the same");
};
