// CHECKS 3D. What a director runs on a frame of a 3D shot, from inside its draw, to catch the faults
// Alex caught by eye on the last 3D film: a prop through the hand meant to hold it (lesson 37), a
// claw holding nothing on screen (48), two characters clipping (38), a walk through a closed gate
// (22), a label covered by a claw (42), a contact beat too small to read (25).
//
// Every check is a plain function returning { ok, findings }. For a whole shot, register what the
// frame holds as it is posed, then runChecks() once the camera is set:
//
//   resetChecks();                      // first thing in the draw: nothing carries over from another frame
//   pose(robot, ...); grip(hand, lantern, 0.5, { hang: true });
//   registerRig("robot", robot); registerGrip(robot, robot.limbs["arms.right"], lantern);
//   if (checking()) runChecks(f, camera, env);   // the collector (a host, a test) gets the findings
//
// Checks sample real surfaces, not bounding boxes: boxes of curved tubes are mostly air and flagged
// thousands of points while rigs stood metres apart (lesson 38). Hidden objects never count (a
// carried jar that is switched off is not a collision).
//
// PERSISTENT VISUAL CHECK (a practice, not code): run the full check pass after EVERY batch of shot
// changes, not once at the end. On the last film a new jar swing broke a catch that had been clean,
// and only the re-run found it (lesson 48). Pair it with a 2x crop of each grip (still --scale 2):
// a green check with a prop through a hand is a failed gate, so look.
import * as THREE from "three";
import { gripFrame, handleOf, isLimb, meshesOf, type Limb, type Rig } from "./rig";

type V3 = THREE.Vector3;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export type Finding = { frame: number; kind: string; where: string; detail: string };
export type CheckResult = { ok: boolean; findings: Finding[] };
const result = (findings: Finding[]): CheckResult => ({ ok: findings.length === 0, findings });
const fmt = (p: V3) => p.toArray().map((x) => x.toFixed(2)).join(", ");
type Obj = THREE.Object3D;
const objOf = (x: Rig | Obj): Obj => ("hips" in x && "limbs" in x ? (x as Rig).root : (x as Obj));
const within = (o: Obj, anc: Obj) => { let n: Obj | null = o; while (n) { if (n === anc) return true; n = n.parent; } return false; };
// visible itself and every ancestor visible: what the renderer would actually draw
const shown = (o: Obj) => { let n: Obj | null = o; while (n) { if (!n.visible) return false; n = n.parent; } return true; };
const partName = (m: THREE.Mesh) => String(m.userData.part ?? (m.name || m.geometry.type));

// ---------------------------------------------------------------- surface sampling
// Points spread over every triangle at `spacing` (vertices alone miss a big flat face pushed through
// a small part). Cached per geometry in its own space: geometry never changes per frame, so the cache
// cannot carry frame state; the world positions are recomputed from the mesh's matrix every call.
const sampleCache = new WeakMap<THREE.BufferGeometry, Map<number, Float32Array>>();
const MAX_PTS = 6000;
const localSamples = (g: THREE.BufferGeometry, spacing: number): Float32Array => {
  let byS = sampleCache.get(g); if (!byS) sampleCache.set(g, (byS = new Map()));
  const hit = byS.get(spacing); if (hit) return hit;
  const pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count, tri = (i: number) => (idx ? idx.getX(i) : i);
  const A = v3(), B = v3(), C = v3();
  // The longest edge of each triangle, once. Then COUNT the points a spacing would make before making
  // any: a rig built in centimetres, or a prop scaled to almost nothing, asks for millions of points
  // at the spacing it was given. The spacing grows by 1.6x until the count fits the cap (or only the
  // vertices are left), so a tiny or non-finite spacing can never stall or overflow an array.
  const edge: number[] = [];
  for (let t = 0; t + 2 < n; t += 3) {
    A.fromBufferAttribute(pos, tri(t)); B.fromBufferAttribute(pos, tri(t + 1)); C.fromBufferAttribute(pos, tri(t + 2));
    edge.push(Math.max(A.distanceTo(B), B.distanceTo(C), C.distanceTo(A)));
  }
  const extra = (s: number) => { let c = 0; for (const e of edge) { const k = Math.ceil(e / s); if (k >= 2) c += ((k + 1) * (k + 2)) / 2 - 3; } return c; };
  const longest = edge.reduce((m, e) => Math.max(m, e), 0);
  let sp = Number.isFinite(spacing) && spacing > 0 ? spacing : longest || 1;
  for (let c = extra(sp); c > 0 && pos.count + c > MAX_PTS; c = extra(sp)) sp *= 1.6;
  // every vertex once, then extra points only inside triangles bigger than the spacing (a dense
  // sphere needs no more than its vertices; a two-triangle wall needs a grid)
  const out: number[] = [];
  for (let i = 0; i < pos.count; i++) out.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  for (let t = 0, e = 0; t + 2 < n; t += 3, e++) {
    const k = Math.ceil(edge[e] / sp);
    if (k < 2) continue;
    A.fromBufferAttribute(pos, tri(t)); B.fromBufferAttribute(pos, tri(t + 1)); C.fromBufferAttribute(pos, tri(t + 2));
    for (let i = 0; i <= k; i++) for (let j = 0; j <= k - i; j++) { if ((i === 0 && j === 0) || (i === k && j === 0) || (i === 0 && j === k)) continue; const a = i / k, b = j / k, c = 1 - a - b; out.push(A.x * c + B.x * a + C.x * b, A.y * c + B.y * a + C.y * b, A.z * c + B.z * a + C.z * b); }
  }
  const arr = new Float32Array(out); byS.set(spacing, arr); return arr;
};
/** World-space surface points of a mesh, about `spacing` apart. */
export const surfacePoints = (m: THREE.Mesh, spacing: number): V3[] => { const w = worldPts(m, spacing), out: V3[] = []; for (let i = 0; i < w.length; i += 3) out.push(v3(w[i], w[i + 1], w[i + 2])); return out; };
// the same as a flat array (the checks' hot path: no object per point)
const worldPts = (m: THREE.Mesh, spacing: number): Float32Array => {
  m.updateWorldMatrix(true, false);
  const s = localSamples(m.geometry, spacing), e = m.matrixWorld.elements, out = new Float32Array(s.length);
  for (let i = 0; i < s.length; i += 3) { const x = s[i], y = s[i + 1], z = s[i + 2]; out[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; out[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; out[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
  return out;
};
const segDist = (p: V3, a: V3, b: V3) => segDistXYZ(p.x, p.y, p.z, a, b);
const segDistXYZ = (px: number, py: number, pz: number, a: V3, b: V3) => {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, L = abx * abx + aby * aby + abz * abz;
  let t = L > 0 ? ((px - a.x) * abx + (py - a.y) * aby + (pz - a.z) * abz) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - a.x - abx * t, dy = py - a.y - aby * t, dz = pz - a.z - abz * t; return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

// Is a point INSIDE a closed mesh? Ray parity in the mesh's own space, both faces counted. A hand
// sunk wholly into a body touches no surface point, so surface distance alone misses it.
const CLOSED = new Set(["SphereGeometry", "CapsuleGeometry", "BoxGeometry", "IcosahedronGeometry", "OctahedronGeometry", "DodecahedronGeometry", "TetrahedronGeometry", "ExtrudeGeometry"]);
const isClosed = (m: THREE.Mesh) => {
  if (m.userData.closed !== undefined) return !!m.userData.closed;
  const g = m.geometry as THREE.BufferGeometry & { parameters?: Record<string, number | boolean> }, t = g.type, p = g.parameters ?? {};
  if (t === "CylinderGeometry") return !p.openEnded && (p.thetaLength === undefined || (p.thetaLength as number) >= Math.PI * 2 - 1e-6);
  if (t === "TorusGeometry") return (p.arc as number) >= Math.PI * 2 - 1e-6;
  if (t === "SphereGeometry") return (p.phiLength as number) >= Math.PI * 2 - 1e-6 && (p.thetaLength as number) >= Math.PI - 1e-6;
  return CLOSED.has(t);
};
// triangles of a geometry as one flat array, cached (geometry is static; the frame never is)
const triCache = new WeakMap<THREE.BufferGeometry, Float32Array>();
const trisOf = (g: THREE.BufferGeometry) => {
  let t = triCache.get(g); if (t) return t;
  const pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count; t = new Float32Array(Math.floor(n / 3) * 9);
  for (let i = 0, k = 0; i + 2 < n; i += 3) for (let j = 0; j < 3; j++) { const q = idx ? idx.getX(i + j) : i + j; t[k++] = pos.getX(q); t[k++] = pos.getY(q); t[k++] = pos.getZ(q); }
  triCache.set(g, t); return t;
};
const DX = 1, DY = 0.000713, DZ = 0.000419; // a skewed ray so it never runs exactly along an edge
type Solid = { box: THREE.Box3; lbox: THREE.Box3; inv: number[]; tris: Float32Array; name: string };
const solidOf = (m: THREE.Mesh): Solid => { m.updateWorldMatrix(true, false); const g = m.geometry; g.boundingBox ?? g.computeBoundingBox(); return { box: new THREE.Box3().copy(g.boundingBox!).applyMatrix4(m.matrixWorld), lbox: g.boundingBox!, inv: m.matrixWorld.clone().invert().elements, tris: trisOf(g), name: partName(m) }; };
const insideSolid = (s: Solid, x: number, y: number, z: number) => {
  if (x < s.box.min.x || x > s.box.max.x || y < s.box.min.y || y > s.box.max.y || z < s.box.min.z || z > s.box.max.z) return false;
  const e = s.inv, px = e[0] * x + e[4] * y + e[8] * z + e[12], py = e[1] * x + e[5] * y + e[9] * z + e[13], pz = e[2] * x + e[6] * y + e[10] * z + e[14];
  const lb = s.lbox; if (px < lb.min.x || px > lb.max.x || py < lb.min.y || py > lb.max.y || pz < lb.min.z || pz > lb.max.z) return false;
  const t = s.tris; let k = 0;
  for (let i = 0; i < t.length; i += 9) { // Moller-Trumbore, both faces
    const ax = t[i], ay = t[i + 1], az = t[i + 2], e1x = t[i + 3] - ax, e1y = t[i + 4] - ay, e1z = t[i + 5] - az, e2x = t[i + 6] - ax, e2y = t[i + 7] - ay, e2z = t[i + 8] - az;
    const hx = DY * e2z - DZ * e2y, hy = DZ * e2x - DX * e2z, hz = DX * e2y - DY * e2x, det = e1x * hx + e1y * hy + e1z * hz;
    if (det > -1e-12 && det < 1e-12) continue;
    const f = 1 / det, sx = px - ax, sy = py - ay, sz = pz - az, u = f * (sx * hx + sy * hy + sz * hz); if (u < 0 || u > 1) continue;
    const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = f * (DX * qx + DY * qy + DZ * qz); if (v < 0 || u + v > 1) continue;
    if (f * (e2x * qx + e2y * qy + e2z * qz) > 0) k++;
  }
  return (k & 1) === 1;
};

// ---------------------------------------------------------------- proximity (two rigs clipping)
export type ProximityOpts = { frame?: number; tol?: number; minPoints?: number; spacing?: number; exempt?: Obj[]; deep?: boolean; kind?: string };
/**
 * Do two things touch or pass through each other? A spatial hash of A's surface points; B's surface
 * points within `tol` of one are counted, and (deep) B's points sunk inside A's closed parts. A
 * finding names the hit centre and the parts on both sides. `exempt` subtrees (a held prop, the
 * holding hand) are skipped on either side. Default tol: 2% of the larger one's height.
 */
export const proximity = (rigA: Rig | Obj, rigB: Rig | Obj, exempt: Obj[] = [], o: ProximityOpts = {}): CheckResult => {
  const A = objOf(rigA), B = objOf(rigB), ex = [...exempt, ...(o.exempt ?? [])], skip = (m: THREE.Mesh) => ex.some((e) => within(m, e));
  A.updateWorldMatrix(true, true); B.updateWorldMatrix(true, true);
  let ma = meshesOf(A, skip).filter((m) => !within(m, B)), mb = meshesOf(B, skip).filter((m) => !within(m, A));
  if (!ma.length || !mb.length) return result([]);
  const boxOf = (ms: THREE.Mesh[]) => { const b = new THREE.Box3(); ms.forEach((m) => b.expandByObject(m)); return b; };
  const bA = boxOf(ma), bB = boxOf(mb);
  const tol = o.tol ?? 0.02 * Math.max(bA.getSize(v3()).y, bB.getSize(v3()).y), sp = o.spacing ?? tol * 0.75, minN = o.minPoints ?? 12;
  // boxes only PRUNE (a part whose box is nowhere near the other side cannot touch it); they never decide a hit
  bA.expandByScalar(tol); bB.expandByScalar(tol);
  ma = ma.filter((m) => new THREE.Box3().setFromObject(m).intersectsBox(bB)); mb = mb.filter((m) => new THREE.Box3().setFromObject(m).intersectsBox(bA));
  if (!ma.length || !mb.length) return result([]);
  const cell = new Map<number, number[]>(), c = (u: number) => Math.floor(u / tol), key = (x: number, y: number, z: number) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) | 0;
  const AP: number[] = [], AN: string[] = [];
  for (const m of ma) { const w = worldPts(m, sp), nm = partName(m); for (let i = 0; i < w.length; i += 3) { const id = AP.length / 3; AP.push(w[i], w[i + 1], w[i + 2]); AN.push(nm); const k = key(c(w[i]), c(w[i + 1]), c(w[i + 2])); let l = cell.get(k); if (!l) cell.set(k, (l = [])); l.push(id); } }
  let n = 0; const hitC = v3(), partsA: Record<string, number> = {}, partsB: Record<string, number> = {}, t2 = tol * tol;
  const solids = o.deep === false ? [] : ma.filter(isClosed).map(solidOf);
  for (const m of mb) {
    const w = worldPts(m, sp), pb = partName(m);
    for (let i = 0; i < w.length; i += 3) {
      const x = w[i], y = w[i + 1], z = w[i + 2], X = c(x), Y = c(y), Z = c(z); let near: string | null = null;
      for (let a = -1; a <= 1 && !near; a++) for (let b = -1; b <= 1 && !near; b++) for (let d = -1; d <= 1 && !near; d++) for (const id of cell.get(key(X + a, Y + b, Z + d)) ?? []) { const dx = AP[id * 3] - x, dy = AP[id * 3 + 1] - y, dz = AP[id * 3 + 2] - z; if (dx * dx + dy * dy + dz * dz < t2) { near = AN[id]; break; } }
      if (!near) for (const sd of solids) if (insideSolid(sd, x, y, z)) { near = sd.name + " (inside)"; break; }
      if (near) { n++; hitC.x += x; hitC.y += y; hitC.z += z; partsA[near] = (partsA[near] ?? 0) + 1; partsB[pb] = (partsB[pb] ?? 0) + 1; }
    }
  }
  if (n < minN) return result([]);
  const top = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, x]) => `${k} ${x}`).join(", ");
  return result([{ frame: o.frame ?? 0, kind: o.kind ?? "proximity", where: `${A.name || "A"} / ${B.name || "B"} at ${fmt(hitC.divideScalar(n))}`, detail: `${n} surface points within ${tol.toFixed(3)} (A: ${top(partsA)}; B: ${top(partsB)})` }]);
};

/** A rig's own limbs through its own body (an arm swung through the belly): lower bones and ends against the torso. */
export const selfClear = (rig: Rig, o: { frame?: number; tol?: number; minPoints?: number } = {}): CheckResult => {
  const f: Finding[] = [];
  for (const L of Object.values(rig.limbs)) {
    // the far half only: the upper bone and the root joint sit in the shoulder by design
    const meshes = [L.lower, ...meshesOf(L.end)];
    const r = proximityMeshes(meshes, meshesOf(rig.body), { tol: o.tol ?? 0.004, minPoints: o.minPoints ?? 6, frame: o.frame ?? 0, where: `${rig.name}: ${L.name} into its own body` });
    f.push(...r);
  }
  return result(f);
};
const proximityMeshes = (mb: THREE.Mesh[], ma: THREE.Mesh[], o: { tol: number; minPoints: number; frame: number; where: string }): Finding[] => {
  let n = 0; const at = v3(), parts: Record<string, number> = {}, solids = ma.filter(isClosed).map(solidOf);
  for (const m of mb) { const w = worldPts(m, o.tol * 3); for (let i = 0; i < w.length; i += 3) for (const sd of solids) if (insideSolid(sd, w[i], w[i + 1], w[i + 2])) { n++; at.x += w[i]; at.y += w[i + 1]; at.z += w[i + 2]; parts[sd.name] = (parts[sd.name] ?? 0) + 1; break; } }
  return n >= o.minPoints ? [{ frame: o.frame, kind: "self", where: `${o.where} at ${fmt(at.divideScalar(n))}`, detail: `${n} points inside ${Object.keys(parts).join(", ")}` }] : [];
};

// ---------------------------------------------------------------- grips
export type GripOpts = { tol?: number; contact?: number; minTouch?: number; closing?: boolean; others?: Obj[] };
const onScreen = (p: V3, cam: THREE.Camera, m = 0.98) => { const q = p.clone().project(cam); return q.z < 1 && q.z > -1 && Math.abs(q.x) < m && Math.abs(q.y) < m; };
const handPart = (prop: Obj, m: THREE.Mesh) => !!m.userData.handlePart || (within(m, prop) && !!(m.parent && m.parent.userData.handlePart));
/**
 * Is the prop really held? (1) the hand's grip point is on the handle (within tol); (2) the hand is
 * closed on it: enough of its surface just outside the handle; (3) the handle does not run through
 * the hand (points inside the handle's core) or (4) through the holder's own body; (5) the prop's
 * body is not pushed into the holder; and with a camera, (6) the grip is in frame when the prop is,
 * and (7) not hidden behind the holder, the prop or another rig. `closing`: the hand is still on its
 * way, so only "through the hand" and "through the holder" apply.
 */
export const checkGrip = (holder: Rig | Obj, hand: Limb | Obj, prop: Obj, frame = 0, camera?: THREE.Camera, o: GripOpts = {}): CheckResult => {
  const H = objOf(holder), end = isLimb(hand) ? hand.end : hand, F: Finding[] = [], where = `${H.name || "holder"} holding ${prop.name || "prop"}`;
  H.updateWorldMatrix(true, true); prop.updateWorldMatrix(true, true);
  // Hidden objects never count: a prop switched off, inside a hidden group, or still scaled to almost
  // nothing (popIn starts at 2.2e-16) is not held yet, so there is nothing to judge.
  const sc = prop.getWorldScale(v3()).x;
  if (!shown(prop) || !(Math.abs(sc) >= 1e-3 * Math.abs(H.getWorldScale(v3()).x))) return result([]);
  const h = handleOf(prop), a = prop.localToWorld(h.a.clone()), b = prop.localToWorld(h.b.clone()), r = h.r * sc;
  const { point: gp } = gripFrame(hand);
  const handMeshes = meshesOf(end), handPts = handMeshes.flatMap((m) => surfacePoints(m, r * 0.6));
  const handR = handPts.reduce((mx, p) => Math.max(mx, p.distanceTo(gp)), 0);
  const tol = o.tol ?? Math.max(r * 3, handR * 0.25);
  const gap = segDist(gp, a, b);
  let inside = 0, touch = 0;
  for (const p of handPts) { const d = segDist(p, a, b); if (d < r * 0.5) inside++; else if (d < r + (o.contact ?? Math.max(r * 2.5, handR * 0.6))) touch++; }
  if (!o.closing && gap > tol) F.push({ frame, kind: "grip-gap", where, detail: `the grip point is ${gap.toFixed(3)} from the handle (tolerance ${tol.toFixed(3)}): the prop floats off the hand` });
  if (!o.closing && touch < (o.minTouch ?? 8)) F.push({ frame, kind: "grip-open", where, detail: `only ${touch} hand points close on the handle: it reads as not held` });
  if (inside > 6) F.push({ frame, kind: "grip-through-hand", where, detail: `${inside} hand points inside the handle: the handle passes through the hand` });
  // the handle through the holder: body points on the handle's line, away from the hand
  const body = meshesOf(H, (m) => within(m, end) || within(m, prop));
  let thru = 0; const thruParts: Record<string, number> = {}, reachBox = new THREE.Box3().setFromPoints([a, b]).expandByScalar(r * 1.2);
  // along the handle: samples sunk inside a closed part of the holder (a body's big flat faces are
  // sampled sparsely, so this side of the test is the one that never misses a pole through a torso)
  const solids = body.filter((m) => isClosed(m) && new THREE.Box3().setFromObject(m).intersectsBox(reachBox)).map(solidOf), L = a.distanceTo(b), nS = Math.max(2, Math.ceil(L / r));
  for (let i = 0; i <= nS; i++) { const p = a.clone().lerp(b, i / nS); if (p.distanceTo(gp) <= handR) continue; for (const sd of solids) if (insideSolid(sd, p.x, p.y, p.z)) { thru++; thruParts[sd.name] = (thruParts[sd.name] ?? 0) + 1; break; } }
  for (const m of body) { if (!new THREE.Box3().setFromObject(m).intersectsBox(reachBox)) continue; const w = worldPts(m, r); for (let i = 0; i < w.length; i += 3) { const dx = w[i] - gp.x, dy = w[i + 1] - gp.y, dz = w[i + 2] - gp.z; if (dx * dx + dy * dy + dz * dz > handR * handR && segDistXYZ(w[i], w[i + 1], w[i + 2], a, b) < r * 1.2) { thru++; thruParts[partName(m)] = (thruParts[partName(m)] ?? 0) + 1; } } }
  if (thru > 3) F.push({ frame, kind: "grip-through-holder", where, detail: `the handle runs through the holder (${Object.entries(thruParts).map(([k, x]) => `${k} ${x}`).join(", ")})` });
  // the prop's body pushed into the holder (a lantern in the belly)
  const pr = proximity(H, prop, [end, ...meshesOf(prop).filter((m) => handPart(prop, m))], { frame, minPoints: 6, kind: "grip-prop-in-holder" });
  F.push(...pr.findings);
  if (camera) {
    camera.updateMatrixWorld();
    const eye = camera.getWorldPosition(v3());
    if (!o.closing && onScreen(new THREE.Box3().setFromObject(prop).getCenter(v3()), camera) && !onScreen(gp, camera)) F.push({ frame, kind: "grip-offscreen", where, detail: "the prop is in frame but the hand holding it is not: it reads as dropped" });
    if (onScreen(gp, camera)) {
      const occ = [...body, ...meshesOf(prop, (m) => handPart(prop, m)), ...(o.others ?? []).flatMap((x) => meshesOf(x))];
      const ax = b.clone().sub(a).normalize(); let hid = 0, centre = false, what = "";
      for (const t of [-1, -0.5, 0, 0.5, 1]) {
        const pt = gp.clone().addScaledVector(ax, t * handR * 0.8), dir = pt.clone().sub(eye), L = dir.length();
        const hit = new THREE.Raycaster(eye, dir.normalize(), 0, L - handR * 0.6).intersectObjects(occ, false)[0];
        if (hit) { hid++; if (t === 0) centre = true; what = partName(hit.object as THREE.Mesh); }
      }
      if (centre || hid >= 3) F.push({ frame, kind: "grip-hidden", where, detail: `the grip is hidden behind ${what} (${hid}/5 points along the hold)` });
    }
  }
  return result(F);
};

// ---------------------------------------------------------------- paths through set props
export type PathSpec = { at: (f: number) => V3; from: number; to: number; step?: number; radius: number; height?: number; name?: string };
export type PropBox = { name: string; box: THREE.Box3 | Obj; open?: boolean };
/**
 * Does a character walk through a set prop (a closed gate, a crate)? The character is an upright
 * cylinder of `radius` and `height` standing on path.at(f); props are boxes (or objects, boxed).
 * An `open` prop (a gate swung open) is skipped. One finding per run of colliding frames.
 */
export const pathClear = (path: PathSpec, props: PropBox[]): CheckResult => {
  const F: Finding[] = [], hgt = path.height ?? 1, st = path.step ?? 1;
  const boxes = props.filter((p) => !p.open).map((p) => ({ name: p.name, b: (p.box as THREE.Box3).isBox3 ? (p.box as THREE.Box3) : new THREE.Box3().setFromObject(p.box as Obj) }));
  for (const { name, b } of boxes) {
    let run: number[] = [], worst = 0;
    const flush = () => { if (run.length) F.push({ frame: run[0], kind: "path", where: `${path.name ?? "character"} through ${name}`, detail: `frames ${run[0]}-${run[run.length - 1]}: ${worst.toFixed(3)} into it` }); run = []; worst = 0; };
    for (let f = path.from; f <= path.to; f += st) {
      const p = path.at(f), dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x), dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z), d = Math.hypot(dx, dz);
      const yHit = p.y < b.max.y && p.y + hgt > b.min.y;
      if (yHit && d < path.radius) { run.push(f); worst = Math.max(worst, path.radius - d); } else flush();
    }
    flush();
  }
  return result(F);
};

// ---------------------------------------------------------------- labels
export type Label = { obj: Obj; w: number; h: number; name: string };
const LABEL_PTS: [number, number][] = [[0, 0], [-0.42, 0.38], [0.42, 0.38], [-0.42, -0.38], [0.42, -0.38], [-0.42, 0], [0.42, 0], [0, 0.38], [0, -0.38]];
/**
 * Can the label be read? Nine points on it (its local xy plane, w x h, facing +z) are raycast from
 * the camera past `occluders`; any hidden point, a label turned more than ~70 degrees from the lens,
 * or one out of frame is a finding.
 */
export const labelVisible = (label: Label, camera: THREE.Camera, occluders: Obj[], frame = 0): CheckResult => {
  const F: Finding[] = [], occ = occluders.flatMap((o) => meshesOf(o, (m) => within(m, label.obj)));
  label.obj.updateWorldMatrix(true, true); camera.updateMatrixWorld();
  const eye = camera.getWorldPosition(v3()); let hid = 0, off = 0; const what = new Set<string>();
  for (const [x, y] of LABEL_PTS) {
    const pt = label.obj.localToWorld(v3(x * label.w, y * label.h, 0.001)), dir = pt.clone().sub(eye), L = dir.length();
    if (!onScreen(pt, camera, 1)) { off++; continue; }
    const hit = new THREE.Raycaster(eye, dir.normalize(), 0, L - 1e-3).intersectObjects(occ, false)[0];
    if (hit) { hid++; what.add(partName(hit.object as THREE.Mesh)); }
  }
  const nrm = v3(0, 0, 1).transformDirection(label.obj.matrixWorld), toEye = eye.clone().sub(label.obj.getWorldPosition(v3())).normalize();
  if (off) F.push({ frame, kind: "label-offscreen", where: label.name, detail: `${off}/9 points of the label out of frame` });
  if (hid) F.push({ frame, kind: "label-hidden", where: label.name, detail: `${hid}/9 points hidden behind ${[...what].join(", ")}` });
  if (nrm.dot(toEye) < 0.35) F.push({ frame, kind: "label-turned", where: label.name, detail: `the label faces ${(Math.acos(Math.max(-1, Math.min(1, nrm.dot(toEye)))) * 180 / Math.PI).toFixed(0)} degrees from the lens` });
  return result(F);
};
/** Turn a label about its parent's up so its face points at the camera (a tag on a string, a sign). */
export const faceCamera = (obj: Obj, camera: THREE.Camera) => {
  obj.updateWorldMatrix(true, false); camera.updateMatrixWorld();
  const par = obj.parent, eye = camera.getWorldPosition(v3()), at = par ? par.worldToLocal(eye.clone()) : eye.clone();
  obj.rotation.set(0, Math.atan2(at.x - obj.position.x, at.z - obj.position.z), 0);
  obj.updateWorldMatrix(false, true);
};
/**
 * AFTER THE CAMERA: place a label where it reads. Each try sets the label's transform from scratch
 * (slide along a handle, swing round, shorten the string); the first that passes labelVisible wins.
 * If none passes, the last try stays and its findings are returned. Run it after the frame's camera
 * is set, never before (lesson 42: a tag reading "/co act" because a claw covered two letters).
 */
export const placeLabel = (label: Label, camera: THREE.Camera, occluders: Obj[], tries: ((obj: Obj, k: number) => void)[], frame = 0) => {
  let last = result([]);
  for (let k = 0; k < tries.length; k++) { tries[k](label.obj, k); label.obj.updateWorldMatrix(true, true); last = labelVisible(label, camera, occluders, frame); if (last.ok) return { ...last, pick: k }; }
  return { ...last, pick: -1 };
};

// ---------------------------------------------------------------- screen size
/**
 * Is it big enough to read? The object's box projected through the camera, its larger side in
 * pixels at 1080p (a 4K or 720p film is scaled to 1080 lines). A contact beat (a hand on a handle)
 * needs about 40 px, or the acting reads as nothing (lesson 25).
 */
export const screenSizeOk = (object: Obj, camera: THREE.Camera, env: { W: number; H: number }, minPx = 40, frame = 0): CheckResult & { px: number } => {
  object.updateWorldMatrix(true, true); camera.updateMatrixWorld();
  const pts = meshesOf(object).flatMap((m) => surfacePoints(m, 1e9));
  if (!pts.length) return { ...result([{ frame, kind: "screen-size", where: object.name || "object", detail: "nothing visible to measure" }]), px: 0 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { const q = p.clone().project(camera); const x = ((q.x + 1) / 2) * env.W, y = ((1 - q.y) / 2) * env.H; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const px = (Math.max(x1 - x0, y1 - y0) * 1080) / env.H;
  return { ...result(px >= minPx ? [] : [{ frame, kind: "screen-size", where: object.name || "object", detail: `${px.toFixed(0)} px at 1080p, under ${minPx}: the action will not read` }]), px };
};

// ---------------------------------------------------------------- the per-frame registry
// A draw registers what this frame holds; runChecks reads it and clears it. Module state, but reset
// at the start of every draw (resetChecks) and at the end of every run, so no frame sees another's.
type Reg = { rigs: { name: string; obj: Obj; rig?: Rig }[]; grips: { holder: Rig | Obj; hand: Limb | Obj; prop: Obj; o: GripOpts }[]; labels: Label[]; sizes: { obj: Obj; minPx: number }[]; paths: { path: PathSpec; props: PropBox[] }[] };
let REG: Reg = { rigs: [], grips: [], labels: [], sizes: [], paths: [] };
/** What a host learns besides the findings: each registered grip's point on screen (logical px), for crop boards and for sampling contact windows. */
export type CheckInfo = { grips: { name: string; x: number; y: number }[] };
const G = globalThis as { __ANIDOODLE_CHECK3D__?: (frame: number, findings: Finding[], info: CheckInfo) => void };
/** True while a host or a test is collecting 3D findings. Draws skip the checks otherwise: no cost. */
export const checking = () => typeof G.__ANIDOODLE_CHECK3D__ === "function";
export const resetChecks = () => { REG = { rigs: [], grips: [], labels: [], sizes: [], paths: [] }; };
/** A character (or any object) the proximity check pairs with every other registered one. */
export const registerRig = (name: string, rig: Rig | Obj) => { const obj = objOf(rig); obj.name ||= name; REG.rigs.push({ name, obj, rig: "limbs" in rig ? (rig as Rig) : undefined }); };
/** A held prop: checked by checkGrip, and exempt (with its hand) from proximity between holder and prop. */
export const registerGrip = (holder: Rig | Obj, hand: Limb | Obj, prop: Obj, o: GripOpts = {}) => { REG.grips.push({ holder, hand, prop, o }); };
export const registerLabel = (label: Label) => { REG.labels.push(label); };
export const registerSize = (obj: Obj, minPx = 40) => { REG.sizes.push({ obj, minPx }); };
export const registerPath = (path: PathSpec, props: PropBox[]) => { REG.paths.push({ path, props }); };
/**
 * Run every registered check on this frame and hand the findings to the collector (when one is
 * listening). Proximity runs for every pair of registered rigs, with held props and their hands
 * exempt between holder and prop; selfClear runs for every registered rig.
 */
export const runChecks = (frame: number, camera: THREE.Camera, env: { W: number; H: number }, o: { proximity?: ProximityOpts } = {}): CheckResult => {
  const F: Finding[] = [];
  const others = (h: Obj) => REG.rigs.map((r) => r.obj).filter((x) => x !== h && !REG.grips.some((g) => g.prop === x));
  for (const g of REG.grips) F.push(...checkGrip(g.holder, g.hand, g.prop, frame, camera, { others: others(objOf(g.holder)), ...g.o }).findings);
  for (let i = 0; i < REG.rigs.length; i++) for (let j = i + 1; j < REG.rigs.length; j++) {
    // two set props touching (a lantern standing on a crate) is staging; a pair needs a character in it
    if (!REG.rigs[i].rig && !REG.rigs[j].rig) continue;
    const A = REG.rigs[i].obj, B = REG.rigs[j].obj, ex: Obj[] = [];
    for (const g of REG.grips) { const H = objOf(g.holder); if ((H === A && g.prop === B) || (H === B && g.prop === A)) ex.push(isLimb(g.hand) ? g.hand.end : g.hand, ...meshesOf(g.prop).filter((m) => handPart(g.prop, m))); }
    F.push(...proximity(A, B, ex, { ...o.proximity, frame }).findings);
  }
  for (const r of REG.rigs) if (r.rig) F.push(...selfClear(r.rig, { frame }).findings);
  for (const l of REG.labels) F.push(...labelVisible(l, camera, REG.rigs.map((r) => r.obj), frame).findings);
  for (const s of REG.sizes) F.push(...screenSizeOk(s.obj, camera, env, s.minPx, frame).findings);
  for (const p of REG.paths) F.push(...pathClear({ ...p.path, from: frame, to: frame }, p.props).findings.map((x) => ({ ...x, frame })));
  const info: CheckInfo = { grips: REG.grips.map((g) => { const q = gripFrame(g.hand).point.project(camera); return { name: `${objOf(g.holder).name || "holder"}/${g.prop.name || "prop"}`, x: ((q.x + 1) / 2) * env.W, y: ((1 - q.y) / 2) * env.H }; }) };
  resetChecks();
  if (checking()) G.__ANIDOODLE_CHECK3D__!(frame, F, info);
  return result(F);
};
/** Collect the findings of everything `run` draws (a test, a host's check pass). */
export const collectChecks = (run: () => void): Finding[] => {
  const out: Finding[] = [], prev = G.__ANIDOODLE_CHECK3D__;
  G.__ANIDOODLE_CHECK3D__ = (_f, fs) => { out.push(...fs); };
  try { run(); } finally { if (prev) G.__ANIDOODLE_CHECK3D__ = prev; else delete G.__ANIDOODLE_CHECK3D__; }
  return out;
};
