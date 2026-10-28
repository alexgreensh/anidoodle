// THREE LOOK TESTS. src/three-core/look.ts: the parts that are numbers (toon ramp, contact shadow
// falloff, grain, shadow biases, hull normals, rig colours) are held here with no browser.
//   node tools/test.mjs threeLook
import * as THREE from "three";
import { contactShadow, emissiveGlow, glass, grainTile, hullNormals, interior, matte, night, outline, satin, shadowAlpha, softShadows, studio, sunset, toon, toonRamp } from "../src/three-core/look";

export const name = "threeLook";
export const run = (ok: (cond: boolean, label: string) => void) => {
  // 1. rigs: three lights and a sky, and a sky whose ground colour is not black (black crush)
  for (const [n, r] of [["studio", studio()], ["night", night()], ["interior", interior()], ["sunset", sunset()]] as const) {
    const lights: THREE.Light[] = []; r.group.traverse((o) => { if ((o as THREE.Light).isLight) lights.push(o as THREE.Light); });
    const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    ok(lights.length >= 4 && lights.every((l) => l.intensity > 0) && r.key.intensity > r.fill.intensity, `${n}: ${lights.length} lights, the key brighter than the fill`);
    ok(lum(r.sky.groundColor) > 0.005 && lum(r.sky.color) > 0.02, `${n}: the hemisphere fill keeps shadows off black`);
  }
  ok(!!interior().practical && interior().key.position.y > 6, "interior (lesson 35): a ceiling key and a warm practical");
  ok(studio({ intensity: 2 }).key.intensity === 2 * studio().key.intensity, "intensity scales the whole rig");
  const aimed = studio({ at: { x: 1, y: 2, z: 3 } });
  ok((aimed.key as THREE.DirectionalLight).target.position.equals(new THREE.Vector3(1, 2, 3)), "rigs aim at the point given");

  // 2. materials: no mirror finishes by default; glass is front-facing, thin, low IOR (lesson 47); glows ignore fog (lesson 45)
  ok(matte("#888").roughness > 0.85 && satin("#888").roughness >= 0.45 && satin("#888").specularIntensity < 0.5, "matte and satin keep the highlight soft (no plastic shine)");
  const gl = glass();
  ok(gl.side === THREE.FrontSide && gl.transmission === 1 && gl.thickness <= 0.1 && gl.ior <= 1.2, `glass: front side only, thin (${gl.thickness}), low IOR (${gl.ior})`);
  const glow = emissiveGlow("#ffd36b", 2);
  ok(glow.fog === false && glow.toneMapped === false && glow.color.r > 1, "emissiveGlow: fog off, outside tone mapping, can run brighter than white");

  // 3. toon ramp: hard bands, floor above black
  const r3 = toonRamp(3);
  ok(r3.length === 3 && Math.abs(r3[0] - 0.38) < 1e-9 && r3[2] === 1 && Math.abs(r3[1] - 0.69) < 1e-9, `toonRamp(3) = ${r3.map((v) => v.toFixed(2)).join(", ")}`);
  ok(toonRamp(1).length === 2, "fewer than 2 steps is raised to 2 (one band is no shading at all)");
  const tm = toon("#ff6b5b", 4), map = tm.gradientMap!;
  ok(map.magFilter === THREE.NearestFilter && map.minFilter === THREE.NearestFilter && !map.generateMipmaps && (map.image as { width: number }).width === 4, "the toon gradient map is 4 texels, nearest-filtered, no mipmaps");

  // 4. contact shadow: dense core, soft rim, exactly 0 at the edge, never rising outward
  ok(shadowAlpha(0) === 1 && shadowAlpha(1) === 0 && shadowAlpha(1.4) === 0, "shadowAlpha: 1 at the centre, 0 at and past the rim");
  let mono = true; for (let r = 0; r < 1; r += 0.01) if (shadowAlpha(r + 0.01) > shadowAlpha(r) + 1e-12) mono = false;
  ok(mono, "the falloff never rises outward");
  ok(shadowAlpha(0.5, 0.9) < shadowAlpha(0.5, 0.1), "more softness = a fainter middle (a haze, not a disc)");
  const cs = contactShadow(2, 0.6, { aspect: 2 }), cm = cs.material as THREE.MeshBasicMaterial;
  ok(cm.depthWrite === false && cm.transparent && cm.polygonOffset && Math.abs(cs.rotation.x + Math.PI / 2) < 1e-9, "the shadow plane lies flat, writes no depth and is offset off the floor (no z-fighting)");
  const d = (cm.map as THREE.DataTexture).image.data as Uint8Array, res = 64;
  ok(d[3] === 0 && d[((res / 2) * res + res / 2) * 4 + 3] > 120, "its texture is clear at the corner and dark in the middle");
  ok((cs.geometry as THREE.PlaneGeometry).parameters.width === 4, "aspect stretches it into an oval");

  // 5. soft shadows: biases from the texel size
  const sun = new THREE.DirectionalLight("#fff", 1), sb = softShadows(sun, { size: 5, mapSize: 2048 });
  ok(sun.castShadow && Math.abs(sb.texel - 10 / 2048) < 1e-12 && Math.abs(sun.shadow.normalBias - 1.5 * sb.texel) < 1e-12 && sun.shadow.bias < 0 && sun.shadow.bias > -0.001, `softShadows: normalBias 1.5 texels (${sun.shadow.normalBias.toFixed(5)}), small negative bias`);
  ok((sun.shadow.camera as THREE.OrthographicCamera).right === 5, "the shadow camera covers the size asked for");

  // 6. grain: repeatable per frame, new every frame, centred on mid-grey (overlay-neutral)
  const a = grainTile(7, 40, 64), b = grainTile(7, 40, 64), c = grainTile(7, 41, 64), s2 = grainTile(8, 40, 64);
  ok(a.every((v, i) => v === b[i]), "grain for frame 40 is the same every time it is drawn");
  let diff = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== c[i]) diff++;
  ok(diff > 0.9 * (a.length / 4), `frame 41 grain differs from frame 40 almost everywhere (${diff} of ${a.length / 4})`);
  ok(s2.some((v, i) => v !== a[i]), "another seed gives other grain");
  let mean = 0; for (let i = 0; i < a.length; i += 4) mean += a[i]; mean /= a.length / 4;
  ok(Math.abs(mean - 128) < 4 && a.every((v, i) => i % 4 !== 3 || v === 255), `grain averages mid-grey (${mean.toFixed(1)}) and is opaque`);

  // 7. outline: a hull with averaged normals, so it closes over hard edges; width is a live uniform
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matte("#ccc"));
  const hull = outline(box, 0.03, "#111");
  ok(box.children.includes(hull) && hull.geometry === box.geometry && (hull.material as THREE.Material).side === THREE.BackSide, "outline: a back-face child sharing the mesh's geometry");
  const on = hullNormals(box.geometry), pos = box.geometry.getAttribute("position");
  let closed = true, diag = true;
  for (let i = 0; i < pos.count; i++) for (let j = 0; j < pos.count; j++) if (pos.getX(i) === pos.getX(j) && pos.getY(i) === pos.getY(j) && pos.getZ(i) === pos.getZ(j) && (on.getX(i) !== on.getX(j) || on.getY(i) !== on.getY(j) || on.getZ(i) !== on.getZ(j))) closed = false;
  for (let i = 0; i < pos.count; i++) { const v = [on.getX(i), on.getY(i), on.getZ(i)].map(Math.abs); if (Math.abs(v[0] - v[1]) > 1e-6 || Math.abs(v[1] - v[2]) > 1e-6) diag = false; }
  ok(closed, "every copy of a corner gets the same hull normal (the box's own split normals would tear the hull)");
  ok(diag, "a box corner's hull normal points along the diagonal");
  hull.userData.width.value = 0.08;
  ok(hull.userData.width.value === 0.08, "the width uniform is exposed for outlinePulse");
  // red fixture: the box's OWN normals differ at a shared corner: what the hull must not use
  const own = box.geometry.getAttribute("normal"); let split = false;
  for (let i = 0; i < pos.count && !split; i++) for (let j = 0; j < pos.count; j++) if (i !== j && pos.getX(i) === pos.getX(j) && pos.getY(i) === pos.getY(j) && pos.getZ(i) === pos.getZ(j) && own.getX(i) !== own.getX(j)) { split = true; break; }
  ok(split, "red fixture: the geometry's own normals ARE split at corners, so the averaged set is needed");
};
