// MOGRAPH. Motion-graphics verbs for three objects, each a pure function of the frame:
//   popIn(mesh, f, 24, 12)   // at frame 24, over 12 frames
// A verb SETS the channels it owns from the object's rest pose every time it is called: before its
// start it writes the "before" state (usually hidden), after its end the exact rest ("after")
// state, so a frame never inherits anything from the frame drawn before it.
//
// - REST POSE. The pose an object was built in (position, rotation, scale, material opacity and
//   emissive) is recorded the first time any verb touches it (or call keepRest() in the build).
//   Verbs compute from that, never from the current values, so nothing accumulates.
// - ONE VERB PER CHANNEL. Two verbs that both write scale on one object: the later call wins. To
//   layer a pop with an indicate, nest the mesh in a Group and give each its own object.
// - Seeds, never Math.random: explode, wiggle and the noise draw from a pure hash of (seed, index).
import * as THREE from "three";
import { ease as E, seg, spring, type Ease } from "./time";
import { hash01, noise1 } from "./camera";

type V3 = [number, number, number];
type Rest = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3; visible: boolean };
type MatRest = { opacity: number; transparent: boolean; emissive?: THREE.Color };
const REST = "anidoodleRest";

/** record an object's pose as its rest pose now (verbs do this on first touch; call it in a build that moves things later) */
export const keepRest = (o: THREE.Object3D): Rest => {
  if (!o.userData[REST]) o.userData[REST] = { position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone(), visible: o.visible } as Rest;
  return o.userData[REST] as Rest;
};
const rest = keepRest;
const mats = (o: THREE.Object3D): THREE.Material[] => {
  const out: THREE.Material[] = [];
  o.traverse((c) => { const m = (c as THREE.Mesh).material; if (m) for (const x of Array.isArray(m) ? m : [m]) if (!out.includes(x)) out.push(x); });
  return out;
};
const matRest = (m: THREE.Material): MatRest => {
  if (!m.userData[REST]) { const em = (m as THREE.MeshStandardMaterial).emissive; m.userData[REST] = { opacity: m.opacity, transparent: m.transparent, emissive: em ? em.clone() : undefined } as MatRest; }
  return m.userData[REST] as MatRest;
};
const t01 = (f: number, at: number, len: number) => seg(f, at, at + len);
// a scale of exactly 0 gives singular normal matrices; hide instead
const showScaled = (o: THREE.Object3D, r: Rest, k: number, kz = k) => { o.visible = r.visible && k > 1e-4 && kz > 1e-4; o.scale.set(r.scale.x * k, r.scale.y * k, r.scale.z * kz); };

/** scale up from nothing with an overshoot that lands: the default entrance */
export const popIn = (o: THREE.Object3D, f: number, at: number, len = 12, e: Ease = E.outBack) => { const r = rest(o), t = t01(f, at, len); showScaled(o, r, t >= 1 ? 1 : Math.max(0, e(t))); };
/** scale down to nothing (anticipation first) */
export const popOut = (o: THREE.Object3D, f: number, at: number, len = 10) => { const r = rest(o), t = t01(f, at, len); showScaled(o, r, t <= 0 ? 1 : Math.max(0, 1 - E.inBack(t))); };
/**
 * Fall from `height` above rest, land at 40% of len, then squash and settle on a closed-form
 * spring (so it is seekable). Hidden before it starts.
 */
export const dropIn = (o: THREE.Object3D, f: number, at: number, len = 18, o2: { height?: number; squash?: number; fps?: number } = {}) => {
  const r = rest(o), land = at + Math.max(1, Math.round(len * 0.4)), h = o2.height ?? 3, sq = o2.squash ?? 0.28;
  o.position.copy(r.position);
  o.position.y += h * (1 - E.inQuad(seg(f, at, land)));
  // the spring rings from the landing; fade it to exactly 0 by the end so "after" is the rest pose
  const s = f >= at + len ? 0 : spring(f, land, o2.fps ?? 24, 3, 0.35) * sq * (1 - seg(f, land, at + len));
  o.scale.set(r.scale.x * (1 + s * 0.5), r.scale.y * (1 - s), r.scale.z * (1 + s * 0.5));
  o.visible = r.visible && f >= at;
};
/** rise out of the floor from `depth` below rest (hidden before it starts) */
export const riseFromFloor = (o: THREE.Object3D, f: number, at: number, len = 14, depth = 1, e: Ease = E.outCubic) => {
  const r = rest(o); o.position.copy(r.position); o.position.y -= depth * (1 - e(t01(f, at, len))); o.visible = r.visible && f >= at;
};
/** grow out of a point (in the parent's space): travel from it while scaling up */
export const growFrom = (o: THREE.Object3D, f: number, at: number, len: number, point: V3, e: Ease = E.outCubic) => {
  const r = rest(o), k = e(t01(f, at, len)); o.position.set(point[0], point[1], point[2]).lerp(r.position, k); showScaled(o, r, k);
};
const setOpacity = (o: THREE.Object3D, k: number) => {
  for (const m of mats(o)) {
    const mr = matRest(m);
    m.opacity = mr.opacity * k;
    // back to opaque when fully in, or sorting artefacts linger on a finished object
    const tr = k < 1 || mr.transparent;
    if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
  }
  o.visible = rest(o).visible && k > 0;
};
/** fade materials in (every material of every mesh below, arrays too) */
export const fadeIn = (o: THREE.Object3D, f: number, at: number, len = 12, e: Ease = E.inOutSine) => setOpacity(o, e(t01(f, at, len)));
/** fade materials out */
export const fadeOut = (o: THREE.Object3D, f: number, at: number, len = 12, e: Ease = E.inOutSine) => setOpacity(o, 1 - e(t01(f, at, len)));
/** type or a shape gaining its depth: scale z from a sliver to rest (real bevel-last extrusion is type3d's job) */
export const extrudeIn = (o: THREE.Object3D, f: number, at: number, len = 12, e: Ease = E.outCubic) => { const r = rest(o), t = t01(f, at, len); showScaled(o, r, t > 0 ? 1 : 0, 0.02 + 0.98 * e(t)); };

/**
 * Draw a path on from 0 to t (a fraction) with setDrawRange. A TubeGeometry draws whole tubular
 * segments (radialSegments * 6 indices each); a Line or Points draws whole vertices.
 */
export const drawTo = (mesh: THREE.Mesh | THREE.Line | THREE.Points, t: number) => {
  const g = mesh.geometry as THREE.BufferGeometry & { parameters?: { tubularSegments?: number; radialSegments?: number } };
  const k = Math.max(0, Math.min(1, t));
  if (g.parameters?.tubularSegments && g.parameters.radialSegments && g.index) g.setDrawRange(0, Math.round(k * g.parameters.tubularSegments) * g.parameters.radialSegments * 6);
  else g.setDrawRange(0, Math.round(k * (g.index ? g.index.count : g.attributes.position.count)));
  mesh.visible = k > 0;
};
/** write a path on over len frames */
export const writeOn = (mesh: THREE.Mesh | THREE.Line | THREE.Points, f: number, at: number, len: number, e: Ease = E.inOutCubic) => drawTo(mesh, e(t01(f, at, len)));
/** put an object at fraction t along a curve (constant speed by arc length); orient turns its +z along the travel */
export const moveAlongPath = (o: THREE.Object3D, curve: THREE.Curve<THREE.Vector3>, t: number, orient = false) => {
  const k = Math.max(0, Math.min(1, t));
  o.position.copy(curve.getPointAt(k));
  if (orient) o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangentAt(k).normalize());
};

// ---- morphs
/** n points spaced evenly by arc length along a polyline (closed adds the edge back to the start) */
export const resample = (pts: V3[], n: number, closed = false): V3[] => {
  if (!pts.length) throw new Error("resample: the shape has no points");
  // a single point (a dot that grows into a line) has no length to walk: it is that point n times
  if (pts.length === 1) return Array.from({ length: Math.max(0, n) }, () => [...pts[0]] as V3);
  const P = closed ? [...pts, pts[0]] : pts, cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
  const L = cum[cum.length - 1], out: V3[] = [], m = closed ? n : n - 1;
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = m > 0 ? (L * i) / m : 0;
    while (j < P.length - 2 && cum[j + 1] < d) j++;
    const span = cum[j + 1] - cum[j], u = span > 0 ? (d - cum[j]) / span : 0;
    out.push([0, 1, 2].map((k) => P[j][k] + (P[j + 1][k] - P[j][k]) * u) as V3);
  }
  return out;
};
/** one shape becoming another: both resampled to the same count by arc length, then mixed at t */
export const morph = (a: V3[], b: V3[], t: number, o: { n?: number; closed?: boolean } = {}): V3[] => {
  const n = o.n ?? Math.max(a.length, b.length), A = resample(a, n, o.closed), B = resample(b, n, o.closed);
  return A.map((p, i) => [p[0] + (B[i][0] - p[0]) * t, p[1] + (B[i][1] - p[1]) * t, p[2] + (B[i][2] - p[2]) * t] as V3);
};
/** write points into a Line/Points geometry's position attribute (same count every frame) */
export const writePoints = (g: THREE.BufferGeometry, pts: V3[]) => {
  const a = g.attributes.position as THREE.BufferAttribute;
  if (a.count !== pts.length) throw new Error(`writePoints: geometry holds ${a.count} points, got ${pts.length}`);
  pts.forEach((p, i) => a.setXYZ(i, p[0], p[1], p[2]));
  a.needsUpdate = true; g.computeBoundingSphere();
};
/** rebuild a TubeGeometry in place along new points (same segment counts, so the buffers keep their size) */
export const writeTube = (g: THREE.TubeGeometry, pts: V3[], closed = false) => {
  const { tubularSegments, radius, radialSegments } = g.parameters;
  const fresh = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, "centripetal"), tubularSegments, radius, radialSegments, closed);
  for (const k of ["position", "normal"] as const) { (g.attributes[k] as THREE.BufferAttribute).copyArray(fresh.attributes[k].array as Float32Array); g.attributes[k].needsUpdate = true; }
  g.computeBoundingSphere(); fresh.dispose();
};

// ---- groups
const kids = (g: THREE.Object3D | THREE.Object3D[]) => (Array.isArray(g) ? g : g.children);
const unit = (seed: number, i: number) => { const z = hash01(seed, i * 3) * 2 - 1, a = hash01(seed, i * 3 + 1) * Math.PI * 2, r = Math.sqrt(1 - z * z); return new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a)); };
/**
 * Fly children apart (k 0 = assembled, 1 = exploded): each shard leaves along its direction from
 * the group's centre plus a seeded spread, and tumbles by up to `spin` turns.
 */
export const shatter = (g: THREE.Object3D | THREE.Object3D[], k: number, o: { seed?: number; distance?: number; spin?: number; upward?: boolean } = {}) => {
  const cs = kids(g), seed = o.seed ?? 1, centre = new THREE.Vector3();
  cs.forEach((c) => centre.add(rest(c).position)); centre.divideScalar(Math.max(1, cs.length));
  cs.forEach((c, i) => {
    const r = rest(c), out = r.position.clone().sub(centre);
    const dir = (out.lengthSq() > 1e-9 ? out.normalize() : new THREE.Vector3(0, 1, 0)).add(unit(seed, i).multiplyScalar(0.6)).normalize();
    // upward: a block on the floor must not throw shards through it
    if (o.upward) { dir.y = Math.abs(dir.y) + 0.2; dir.normalize(); }
    const d = (o.distance ?? 3) * (0.6 + 0.8 * hash01(seed, i * 3 + 2));
    c.position.copy(r.position).addScaledVector(dir, d * k);
    c.quaternion.copy(r.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(unit(seed + 7, i), (o.spin ?? 0.5) * Math.PI * 2 * k * (0.5 + hash01(seed + 3, i))));
    c.scale.copy(r.scale);
  });
};
/** blow the children apart from frame `at` (assembled before, exploded after) */
export const explode = (g: THREE.Object3D | THREE.Object3D[], f: number, at: number, len = 18, o: { seed?: number; distance?: number; spin?: number; upward?: boolean; ease?: Ease } = {}) => shatter(g, (o.ease ?? E.outCubic)(t01(f, at, len)), o);
/** bring scattered children home (exploded before, assembled after) */
export const assemble = (g: THREE.Object3D | THREE.Object3D[], f: number, at: number, len = 18, o: { seed?: number; distance?: number; spin?: number; upward?: boolean; ease?: Ease } = {}) => shatter(g, 1 - (o.ease ?? E.inOutCubic)(t01(f, at, len)), o);
/** call attention: a scale pulse and an emissive flash that peak mid-way and return exactly to rest */
export const indicate = (o: THREE.Object3D, f: number, at: number, len = 12, o2: { scale?: number; color?: string; strength?: number } = {}) => {
  const r = rest(o), t = t01(f, at, len), b = t > 0 && t < 1 ? Math.sin(Math.PI * t) : 0, flash = new THREE.Color(o2.color ?? "#ffffff");
  showScaled(o, r, 1 + ((o2.scale ?? 1.15) - 1) * b);
  for (const m of mats(o)) { const mr = matRest(m), em = (m as THREE.MeshStandardMaterial).emissive; if (em && mr.emissive) em.copy(mr.emissive).lerp(flash, b * (o2.strength ?? 0.6)); }
};
/** a seeded wobble about z that swells and dies within [at, at + len] */
export const wiggle = (o: THREE.Object3D, f: number, at: number, len = 18, o2: { seed?: number; deg?: number; freq?: number } = {}) => {
  const r = rest(o), t = t01(f, at, len), env = t > 0 && t < 1 ? Math.sin(Math.PI * t) : 0;
  const a = env * (o2.deg ?? 10) * (Math.PI / 180) * noise1(o2.seed ?? 1, (f - at) * (o2.freq ?? 0.5));
  o.quaternion.copy(r.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a));
};
/** a bump that travels across the children in order, lifting each by `height` as it passes */
export const wave = (g: THREE.Object3D | THREE.Object3D[], f: number, at: number, len = 24, o: { height?: number; width?: number; axis?: V3 } = {}) => {
  const cs = kids(g), n = cs.length, w = o.width ?? 2, ax = new THREE.Vector3(...(o.axis ?? [0, 1, 0]));
  const head = t01(f, at, len) * (n - 1 + 2 * w) - w;
  cs.forEach((c, i) => { const r = rest(c), d = (i - head) / w, b = Math.abs(d) < 1 ? 0.5 + 0.5 * Math.cos(Math.PI * d) : 0; c.position.copy(r.position).addScaledVector(ax, (o.height ?? 0.4) * b); });
};

/**
 * Give each object its own copy of any material it shares with another one in the list. text3d puts
 * one material on every letter, so fading letter by letter wrote all of them, and the last letter's
 * opacity won (the whole word hid). The copy starts from the shared material's REST state, so it does
 * not matter which frame is drawn first. Done once per object; the material passed in is never changed.
 */
const OWN = "anidoodleOwnMaterials";
const ownMaterials = (objs: THREE.Object3D[]) => {
  if (objs.every((o) => o.userData[OWN])) return;
  const users = new Map<THREE.Material, Set<THREE.Object3D>>();
  for (const o of objs) for (const m of mats(o)) { let u = users.get(m); if (!u) users.set(m, (u = new Set())); u.add(o); }
  for (const o of objs) {
    if (o.userData[OWN]) continue;
    o.userData[OWN] = true;
    const copies = new Map<THREE.Material, THREE.Material>();
    const own = (m: THREE.Material) => {
      if ((users.get(m)?.size ?? 0) < 2) return m;
      let c = copies.get(m);
      if (!c) {
        const r = matRest(m); c = m.clone();
        c.opacity = r.opacity; c.transparent = r.transparent;
        const em = (c as THREE.MeshStandardMaterial).emissive; if (em && r.emissive) em.copy(r.emissive);
        c.userData[REST] = { opacity: r.opacity, transparent: r.transparent, emissive: r.emissive?.clone() } as MatRest;
        copies.set(m, c);
      }
      return c;
    };
    o.traverse((n) => { const mesh = n as THREE.Mesh; if (mesh.material) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material); });
  }
};

/** a verb as lagged() and grid() call it: one child, the frame, its own start frame, its index */
export type Verb = (o: THREE.Object3D, f: number, at: number, i: number) => void;
/** start a verb on each child `stagger` frames after the one before (Manim's LaggedStart) */
export const lagged = (g: THREE.Object3D | THREE.Object3D[], f: number, start: number, stagger: number, verb: Verb) => kids(g).forEach((c, i) => verb(c, f, start + i * stagger, i));
/**
 * Stagger a verb across a layout by distance: rings of children equally far from the centre (or
 * from the outside in, with from "edge") start together, `stagger` frames per ring.
 */
export const grid = (g: THREE.Object3D | THREE.Object3D[], f: number, start: number, stagger: number, verb: Verb, o: { from?: "center" | "edge" | V3 } = {}) => {
  const cs = kids(g), c = new THREE.Vector3();
  if (Array.isArray(o.from)) c.set(...o.from); else { cs.forEach((x) => c.add(rest(x).position)); c.divideScalar(Math.max(1, cs.length)); }
  const d = cs.map((x) => Math.round(rest(x).position.distanceTo(c) * 1000) / 1000), rings = [...new Set<number>(d)].sort((a, b) => a - b);
  cs.forEach((x, i) => { const ring = rings.indexOf(d[i]); verb(x, f, start + stagger * (o.from === "edge" ? rings.length - 1 - ring : ring), i); });
};
/**
 * Per-letter type motion for a group whose children are letters in reading order (type3d builds
 * them): each letter enters `stagger` frames after the last, by rise, pop, drop or spin.
 */
export const kinetic = (letters: THREE.Object3D, f: number, start: number, stagger = 2, o: { style?: "rise" | "pop" | "drop" | "spin"; len?: number } = {}) => {
  const len = o.len ?? 12, style = o.style ?? "rise";
  if (style === "rise") ownMaterials(kids(letters));
  lagged(letters, f, start, stagger, (c, ff, at) => {
    if (style === "pop") popIn(c, ff, at, len);
    else if (style === "drop") dropIn(c, ff, at, len, { height: 1 });
    else if (style === "spin") { const r = rest(c), t = t01(ff, at, len); c.quaternion.copy(r.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (1 - E.outCubic(t)) * Math.PI)); c.visible = r.visible && t > 0; }
    else { const r = rest(c), t = E.outCubic(t01(ff, at, len)); c.position.copy(r.position); c.position.y -= 0.5 * (1 - t); setOpacity(c, t); }
  });
};
