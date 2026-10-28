// LOOK. Light rigs, materials and finishing passes that read as DESIGNED, not as default CG. Every
// default here answers one of the "cheap 3D" tells (lessons 8, 35, 45, 47 in the Clawd film notes):
//
//   shadow acne         -> contactShadow() (a soft blob, no shadow map at all), and softShadows()
//                          with a bias worked out from the shadow map's texel size when a shot wants
//                          real cast shadows
//   harsh self-shadow   -> rigs are three lights + a sky fill, so no side of a form drops to black
//   plastic shine       -> matte/satin keep specular low and wide; nothing defaults to a mirror
//   jaggies             -> draw3d supersamples (stage ss 2); outlines are hulls, not 1 px GL lines
//   black crush         -> every rig carries a hemisphere fill, toon ramps start at 0.38, the
//                          vignette darkens toward a tinted colour, never to pure black
//
//   lights:     studio() night() interior() sunset()          -> a LightRig; scene.add(rig.group)
//   materials:  matte(c) satin(c) toon(c, steps) glass(o) emissiveGlow(c, k)
//   ink:        outline(mesh, width, color, o)                -> inverted hull, animatable width
//   ground:     contactShadow(size, softness, o)              -> a soft shadow plane, no shadow map
//   shadows:    softShadows(light, o)                         -> acne-free cast shadows when wanted
//   post (2D):  grain(ctx, env, frame, amount, seed, cell)  vignette(ctx, env, amount)   after draw3d
import * as THREE from "three";
import type { Ctx, Env, Layer } from "../canvas-core/core";
import { rand } from "./stage";

// ---------------------------------------------------------------- light rigs
export type LightRig = { group: THREE.Group; key: THREE.Light; fill: THREE.Light; rim: THREE.Light; sky: THREE.HemisphereLight; practical?: THREE.PointLight };
export type RigOpts = { /** multiplies every light. Default 1 */ intensity?: number; /** where the directional lights aim. Default the origin */ at?: THREE.Vector3Like };

const dir = (g: THREE.Group, name: string, color: THREE.ColorRepresentation, k: number, p: [number, number, number], at: THREE.Vector3Like) => {
  const l = new THREE.DirectionalLight(color, k); l.name = name; l.position.set(p[0] + at.x, p[1] + at.y, p[2] + at.z);
  l.target.position.set(at.x, at.y, at.z); g.add(l, l.target); return l;
};
const rig = (name: string, o: RigOpts, build: (g: THREE.Group, k: number, at: THREE.Vector3Like) => Omit<LightRig, "group">): LightRig => {
  const g = new THREE.Group(); g.name = `rig:${name}`;
  const parts = build(g, o.intensity ?? 1, o.at ?? { x: 0, y: 0, z: 0 });
  return { group: g, ...parts };
};

/** Product-shot light: a warm key high and to the right, a cool fill from the left, a rim from behind that separates the form from the backdrop, and a soft sky so the shadow side keeps its colour. */
export const studio = (o: RigOpts = {}): LightRig => rig("studio", o, (g, k, at) => {
  const key = dir(g, "key", "#fff1de", 2.4 * k, [4, 6, 6], at);
  const fill = dir(g, "fill", "#dfe8ff", 0.75 * k, [-6, 2, 4], at);
  const rim = dir(g, "rim", "#ffffff", 1.9 * k, [-1.5, 4, -7], at);
  const sky = new THREE.HemisphereLight("#f3f1ff", "#6b5a52", 0.85 * k); sky.name = "sky"; g.add(sky);
  return { key, fill, rim, sky };
});
/** Night exterior: a cool, low moon key, a blue sky fill that keeps shadows readable (blue, not black), and a warm rim like a street lamp behind. */
export const night = (o: RigOpts = {}): LightRig => rig("night", o, (g, k, at) => {
  const key = dir(g, "moon", "#b8c8ff", 1.3 * k, [-5, 7, 4], at);
  const fill = dir(g, "fill", "#5a6aa8", 0.5 * k, [6, 1, 3], at);
  const rim = dir(g, "lamp", "#ffc27a", 1.6 * k, [3, 3, -6], at);
  const sky = new THREE.HemisphereLight("#33407a", "#1d1a2b", 0.9 * k); sky.name = "sky"; g.add(sky);
  return { key, fill, rim, sky };
});
/** Interior (lesson 35): the key comes DOWN from a ceiling, a warm practical (a lamp) sits near the subject, and a warm hemisphere fill lifts the room. An outdoor rig left inside reads muddy. */
export const interior = (o: RigOpts = {}): LightRig => rig("interior", o, (g, k, at) => {
  const key = dir(g, "ceiling", "#fff4e6", 1.8 * k, [0.5, 8, 2], at);
  const fill = dir(g, "window", "#e4ecff", 0.6 * k, [-6, 3, 3], at);
  const rim = dir(g, "rim", "#ffe2bf", 1.1 * k, [2, 3, -6], at);
  const sky = new THREE.HemisphereLight("#ffe9d2", "#5a4337", 0.9 * k); sky.name = "sky"; g.add(sky);
  // decay 2 is physical: the lamp's pool falls off like a real lamp's; distance 0 = no hard cut-off
  const practical = new THREE.PointLight("#ffb86b", 6 * k, 0, 2); practical.name = "practical"; practical.position.set(at.x + 1.6, at.y + 1.4, at.z + 1.2); g.add(practical);
  return { key, fill, rim, sky, practical };
});
/** Golden hour: a low orange key from the side, a lilac sky fill, and a hot rim that outlines the form. */
export const sunset = (o: RigOpts = {}): LightRig => rig("sunset", o, (g, k, at) => {
  const key = dir(g, "sun", "#ffb070", 2.6 * k, [7, 1.6, 3], at);
  const fill = dir(g, "fill", "#b9a3ff", 0.7 * k, [-6, 3, 4], at);
  const rim = dir(g, "rim", "#ffd29a", 2.2 * k, [-3, 2.5, -7], at);
  const sky = new THREE.HemisphereLight("#ffd6c2", "#4a3550", 0.8 * k); sky.name = "sky"; g.add(sky);
  return { key, fill, rim, sky };
});

// ---------------------------------------------------------------- materials
/** chalky, no highlight to speak of: paper, clay, felt-ish props, floors */
export const matte = (color: THREE.ColorRepresentation) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0 });
/** a soft, wide sheen that catches a rim light without the hard white dot of plastic */
export const satin = (color: THREE.ColorRepresentation) => {
  const c = new THREE.Color(color);
  return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, metalness: 0, specularIntensity: 0.35, sheen: 0.35, sheenRoughness: 0.55, sheenColor: c.clone().lerp(new THREE.Color("#ffffff"), 0.5) });
};
/**
 * The toon ramp as numbers: `steps` flat bands of light from `floor` (the shadow side, kept well
 * above black so it never crushes) up to full light. Pure, so the test can hold it.
 */
export const toonRamp = (steps: number, floor = 0.38): number[] => {
  const n = Math.max(2, Math.round(steps));
  return Array.from({ length: n }, (_, i) => floor + ((1 - floor) * i) / (n - 1));
};
/** cel shading in `steps` flat bands (2 = graphic, 3 = classic cartoon, 4-5 = soft) */
export const toon = (color: THREE.ColorRepresentation, steps = 3, floor = 0.38) => {
  const ramp = toonRamp(steps, floor), data = new Uint8Array(ramp.length * 4);
  ramp.forEach((v, i) => data.set([Math.round(v * 255), Math.round(v * 255), Math.round(v * 255), 255], i * 4));
  const tex = new THREE.DataTexture(data, ramp.length, 1, THREE.RGBAFormat);
  // Nearest, no mipmaps: the bands must stay hard-edged; linear filtering blends them into a gradient
  tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  return new THREE.MeshToonMaterial({ color, gradientMap: tex });
};
export type GlassOpts = { tint?: THREE.ColorRepresentation; ior?: number; thickness?: number; roughness?: number };
/**
 * Glass that reads as glass (lesson 47): ONE front-facing refracting surface, thin, low IOR. A
 * double-sided thick transmission draws the back wall as a second, offset outline.
 */
export const glass = (o: GlassOpts = {}) => new THREE.MeshPhysicalMaterial({
  color: "#ffffff", metalness: 0, roughness: o.roughness ?? 0.04, transmission: 1, thickness: o.thickness ?? 0.06, ior: o.ior ?? 1.15,
  attenuationColor: new THREE.Color(o.tint ?? "#eaf4ff"), attenuationDistance: 1.5, specularIntensity: 1, side: THREE.FrontSide,
});
/** a light that IS its colour (a firefly, a screen, a lamp bulb): unlit, outside tone mapping, and never fogged (lesson 45: far glows told by size, not by greying) */
export const emissiveGlow = (color: THREE.ColorRepresentation, intensity = 1) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), fog: false, toneMapped: false });

// ---------------------------------------------------------------- outline (inverted hull)
/**
 * Averaged normals per POSITION, so the hull is pushed out as one closed skin. With the geometry's
 * own split normals (every extruded letter, every box) the hull tears open at hard edges.
 */
export const hullNormals = (geo: THREE.BufferGeometry): THREE.BufferAttribute => {
  const have = geo.getAttribute("outlineNormal") as THREE.BufferAttribute | undefined; if (have) return have;
  const pos = geo.getAttribute("position"), idx = geo.getIndex(), n = pos.count, sum = new Map<string, THREE.Vector3>();
  const key = (i: number) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  const tri = idx ? idx.count / 3 : n / 3, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < tri; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    // ANGLE-weighted: each face counts by the corner angle it makes at the vertex, so a box corner
    // points along the true diagonal however its faces were cut into triangles (area weighting does not)
    const f = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b));
    if (f.lengthSq() === 0) continue;
    f.normalize();
    const corner = [[a, b, c], [b, c, a], [c, a, b]] as const;
    [i0, i1, i2].forEach((i, n2) => { const [p, q, r] = corner[n2]; const ang = new THREE.Vector3().subVectors(q, p).angleTo(new THREE.Vector3().subVectors(r, p)); const w = f.clone().multiplyScalar(ang), k = key(i), s = sum.get(k); if (s) s.add(w); else sum.set(k, w); });
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const s = (sum.get(key(i)) ?? new THREE.Vector3()).clone(); if (s.lengthSq() === 0) s.set(0, 0, 1); s.normalize(); out.set([s.x, s.y, s.z], i * 3); }
  const attr = new THREE.BufferAttribute(out, 3); geo.setAttribute("outlineNormal", attr); return attr;
};
export type OutlineOpts = {
  /** width in FRAME PIXELS (of a frameH-tall frame) instead of world units: stays the same on screen near and far (lesson 27) */
  screen?: boolean;
  /** the film's logical height for screen widths. Default 1080 */
  frameH?: number;
};
export type Outline = THREE.Mesh & { userData: { width: { value: number } } };
/**
 * An ink line around a mesh's silhouette: a slightly larger copy, back faces only, flat colour. It
 * is pushed out in VIEW space after the model transform, so a scaled letter keeps the same line
 * (no fat outline on a popped-up letter). Set `hull.userData.width.value` per frame to animate it
 * (outlinePulse). Added as a child of the mesh, so it follows every move.
 */
export const outline = (mesh: THREE.Mesh, width = 0.02, color: THREE.ColorRepresentation = "#1b1622", o: OutlineOpts = {}): Outline => {
  hullNormals(mesh.geometry);
  const uWidth = { value: width }, uScreen = { value: o.screen ? 1 : 0 }, uFrameH = { value: o.frameH ?? 1080 };
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, toneMapped: false, fog: false });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.outlineWidth = uWidth; sh.uniforms.outlineScreen = uScreen; sh.uniforms.outlineFrameH = uFrameH;
    sh.vertexShader = "attribute vec3 outlineNormal;\nuniform float outlineWidth;\nuniform float outlineScreen;\nuniform float outlineFrameH;\n" + sh.vertexShader.replace("#include <project_vertex>", `
      vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
      vec3 hullN = normalize( normalMatrix * outlineNormal );
      // screen mode: a pixel at depth -z spans 2 * z / (P[1][1] * frameH) world units
      float hullW = outlineScreen > 0.5 ? outlineWidth * 2.0 * max( -mvPosition.z, 0.0 ) / ( projectionMatrix[1][1] * outlineFrameH ) : outlineWidth;
      mvPosition.xyz += hullN * hullW;
      // and push the whole hull AWAY from the camera by more than it grew: long thin cap triangles
      // (every extruded letter has them) flip when their corners move apart, and a flipped one
      // would draw in front of the face as a black crack. Behind the face it is hidden; at the
      // silhouette, where the hull is seen beside the mesh, the push only moves it in depth.
      mvPosition.xyz += normalize( mvPosition.xyz ) * hullW * 2.5;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => "anidoodle-outline";
  const hull = new THREE.Mesh(mesh.geometry, mat) as unknown as Outline;
  hull.name = "outline"; hull.userData = { width: uWidth }; hull.castShadow = false; hull.receiveShadow = false;
  hull.raycast = () => {}; // never picked: it is ink, not an object
  mesh.add(hull);
  return hull;
};

// ---------------------------------------------------------------- contact shadow
/**
 * The contact shadow's opacity at normalised radius r (0 centre, 1 rim). `softness` 0 gives a
 * dense core with a quick edge, 1 an all-falloff haze. Exactly 0 from r = 1 on: no square edge.
 */
export const shadowAlpha = (r: number, softness = 0.6) => {
  if (r >= 1) return 0;
  const inner = (1 - Math.min(1, Math.max(0, softness))) * 0.55, t = r <= inner ? 0 : (r - inner) / (1 - inner);
  const s = t * t * (3 - 2 * t);
  return (1 - s) ** 1.6;
};
export type ContactOpts = { color?: THREE.ColorRepresentation; opacity?: number; /** x stretch: 2 = an oval twice as wide as deep (a word, a car) */ aspect?: number; res?: number };
/**
 * A soft shadow pool under an object: a flat plane with a radial falloff, no shadow map, so no
 * acne and no hard edge. Warm-dark by default (lesson 8: a coloured shadow band reads as designed;
 * grey-black reads as CG). Lay it a hair above the floor; it never writes depth.
 */
export const contactShadow = (size = 1, softness = 0.6, o: ContactOpts = {}): THREE.Mesh => {
  const res = o.res ?? 64, data = new Uint8Array(res * res * 4), c = new THREE.Color(o.color ?? "#3a2a35"), op = o.opacity ?? 0.55;
  for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
    const u = ((x + 0.5) / res) * 2 - 1, v = ((y + 0.5) / res) * 2 - 1, a = shadowAlpha(Math.hypot(u, v), softness) * op;
    data.set([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), Math.round(a * 255)], (y * res + x) * 4);
  }
  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * (o.aspect ?? 1), size), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.name = "contactShadow"; mesh.renderOrder = 1;
  return mesh;
};

// ---------------------------------------------------------------- real shadows, acne-free
export type SoftShadowOpts = { /** half-width of the area the shadow covers, world units. Default 6 */ size?: number; mapSize?: number; near?: number; far?: number };
/**
 * Turn on cast shadows for a directional or spot light with values that do not acne. The biases
 * come from the shadow map's texel size (world units per texel = 2 * size / mapSize):
 *   normalBias = 1.5 texels   moves each lookup off the surface along its normal; this is what
 *                             kills acne on curved and grazing surfaces without detaching shadows
 *   bias       = -0.0002      a tiny depth offset for flat floors facing the light
 * Also draw3d(..., { shadows: true }), receiveShadow on floors, and (lesson 8) NOT on characters
 * or type, whose self-shadow creases read as cheap: give them contactShadow() instead.
 */
export const softShadows = (light: THREE.DirectionalLight | THREE.SpotLight, o: SoftShadowOpts = {}) => {
  const size = o.size ?? 6, map = o.mapSize ?? 2048, texel = (2 * size) / map;
  light.castShadow = true;
  light.shadow.mapSize.set(map, map);
  light.shadow.bias = -0.0002;
  light.shadow.normalBias = 1.5 * texel;
  light.shadow.radius = 3; // used by PCFShadowMap; PCFSoft (the stage default) softens on its own
  const cam = light.shadow.camera as THREE.OrthographicCamera;
  if ((cam as THREE.OrthographicCamera).isOrthographicCamera) { cam.left = -size; cam.right = size; cam.top = size; cam.bottom = -size; }
  cam.near = o.near ?? 0.5; cam.far = o.far ?? 40; cam.updateProjectionMatrix();
  return { texel, bias: light.shadow.bias, normalBias: light.shadow.normalBias };
};

// ---------------------------------------------------------------- 2D post on the finished frame
/**
 * The grain tile for one frame, as RGBA bytes: grey around 128 (no change under "overlay"), with a
 * triangular spread (two uniforms summed) that looks like film rather than TV static. Pure: the
 * same (seed, frame) always gives the same bytes; the next frame gives different ones.
 */
export const grainTile = (seed: number, frame: number, size = 256): Uint8ClampedArray => {
  const r = rand((seed * 2654435761 + Math.round(frame) * 40503) >>> 0), out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < out.length; i += 4) { const v = 128 + (r() + r() - 1) * 127; out[i] = out[i + 1] = out[i + 2] = v; out[i + 3] = 255; }
  return out;
};
/**
 * Film grain over the whole frame, new every frame, seeded by the frame (so frame 40 drawn first
 * or last is the same). amount 0-1: 0.03-0.06 is felt, not seen. Call after draw3d and any 2D
 * layers; overlay blending keeps mid-tones and leaves pure black and white alone.
 * cell: logical pixels per grain value (default 2). The tile is stretched with smoothing, so each
 * grain is a soft clump rather than a one-pixel speck: it still reads as film at 1x, and the encoder
 * no longer spends its bits on per-pixel noise (an 8 s 1080p film went from 69 MB to well under 25).
 */
export const grain = (ctx: Ctx, env: Env, frame: number, amount = 0.035, seed = 7, cell = 2) => {
  if (amount <= 0) return;
  const T = 256, key = `three:grain:${T}`, k = Math.max(1, cell);
  let layer = env.cache.get(key) as Layer | undefined;
  if (!layer) { layer = env.canvas(T, T); env.cache.set(key, layer); }
  const img = layer.ctx.createImageData(T, T); img.data.set(grainTile(seed, frame, T)); layer.ctx.putImageData(img, 0, 0);
  const pat = ctx.createPattern(layer.canvas as CanvasImageSource, "repeat"); if (!pat) return;
  ctx.save(); ctx.setTransform(env.scale * k, 0, 0, env.scale * k, 0, 0);
  ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = Math.min(1, amount * 3); ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = pat; ctx.fillRect(0, 0, env.W / k, env.H / k);
  ctx.restore();
};
/** darken the corners toward a tinted dark (not black: lesson 8, black crush). amount 0-1, 0.3 is gentle */
export const vignette = (ctx: Ctx, env: Env, amount = 0.3, color = "#160f1e") => {
  if (amount <= 0) return;
  const c = new THREE.Color(color), rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  const cx = env.W / 2, cy = env.H / 2, R = Math.hypot(cx, cy);
  ctx.save(); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(cx, cy, R * 0.45, cx, cy, R);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.6, `rgba(${rgb},${(amount * 0.45).toFixed(3)})`); g.addColorStop(1, `rgba(${rgb},${amount.toFixed(3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, env.W, env.H);
  ctx.restore();
};
