// THREE HELLO. The smallest 3D film: a bevelled star turning under a key light. It proves the
// stage bridge (WebGL -> the frame), purity (every value set from the frame) and the gate.
import type { Ctx, Env } from "./core";
import type { Film } from "./film";
import * as THREE from "three";
import { draw3d, memo } from "../three-core/stage";

const W = 1280, H = 720, FPS = 24, N = 96;
const build = () => {
  const scene = new THREE.Scene();
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.45 : 1; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) shape.lineTo(x, y); else shape.moveTo(x, y); }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4 });
  geo.center();
  const star = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#ffde59", roughness: 0.45, metalness: 0.1 }));
  scene.add(star);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.MeshStandardMaterial({ color: "#1d1a2b", roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.3; scene.add(floor);
  const key = new THREE.DirectionalLight("#fff2e0", 2.6); key.position.set(3, 4, 5); scene.add(key);
  scene.add(new THREE.HemisphereLight("#b9c8ff", "#2a2033", 0.9));
  const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
  return { scene, star, cam };
};
const turn = (ctx: Ctx, f: number, env: Env) => {
  const { scene, star, cam } = memo(env, "threeHello", build);
  const t = f / N;
  star.rotation.set(0.25 * Math.sin(t * Math.PI * 2), t * Math.PI * 2, 0);
  star.position.y = 0.15 * Math.sin(t * Math.PI * 4);
  cam.position.set(Math.sin(t * Math.PI * 2) * 0.8, 0.6, 5.2); cam.lookAt(0, 0, 0);
  draw3d(ctx, env, scene, cam, { clear: "#0f0d1a" });
};
export const threeHello: Film = {
  meta: { title: "three hello", W, H, fps: FPS, bpm: 120, durationFrames: N, kind: "loop",
    // gate check 5 FAILS a 3D film that registers nothing; this one has nothing physical to go wrong
    checks: { none: { "3d": "one star turning alone in the middle of the frame: no character, nothing held, nothing for it to pass through" } } },
  assets: { images: {} },
  shots: [{ id: "turn", start: 0, end: N, draw: turn }],
};
