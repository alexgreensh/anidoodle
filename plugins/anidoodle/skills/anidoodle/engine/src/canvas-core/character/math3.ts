// 3D MATH for characters. Vectors, rotation matrices, a pinhole camera with a REAL focal length,
// and the one 3D primitive everything is built from: an oriented ellipsoid ("blob").
//
// World frame: x to screen right, y up, z toward the camera for a front view. A character at
// yaw 0 faces +z. Its LEFT side is +x (facing us, her left hand is on our right).
// Pure functions only: no randomness, no clock.
import type { P } from "../core";

export type V3 = [number, number, number];
export type M3 = [number, number, number, number, number, number, number, number, number]; // row-major

export const DEG = Math.PI / 180;
export const v3 = (x = 0, y = 0, z = 0): V3 => [x, y, z];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const dist = (a: V3, b: V3) => len(sub(a, b));

export const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const mv = (m: M3, v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
export const mm = (a: M3, b: M3): M3 => {
  const o = new Array(9).fill(0) as M3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
};
export const tr = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
export const rx = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
export const ry = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
export const rz = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
export const rotAxis = (axis: V3, a: number): M3 => {
  const [x, y, z] = norm(axis), c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
};
// columns of a rotation = where the local axes point in the parent frame
export const col = (m: M3, i: number): V3 => [m[i], m[3 + i], m[6 + i]];
export const fromCols = (a: V3, b: V3, c: V3): M3 => [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
export const MIRROR_X: M3 = [-1, 0, 0, 0, 1, 0, 0, 0, 1];

// A rigid frame: rotation R (local -> world) and origin p.
export type Frame = { R: M3; p: V3 };
export const apply = (f: Frame, local: V3): V3 => add(f.p, mv(f.R, local));

// ---------------------------------------------------------------- camera
// A pinhole camera. `f` is the focal length IN PIXELS: f = (sensor-px / sensor-mm) * lens-mm.
// A long lens far away (f large, eye far) is near-orthographic, right for a turnaround; a short
// lens close up is what makes a hand pointed at the viewer grow and the arm behind it shrink.
export type Camera = { eye: V3; right: V3; up: V3; fwd: V3; f: number; cx: number; cy: number };
export const camera = (eye: V3, target: V3, f: number, cx: number, cy: number, upHint: V3 = [0, 1, 0]): Camera => {
  const fwd = norm(sub(target, eye)), right = norm(cross(fwd, upHint)), up = cross(right, fwd);
  return { eye, right, up, fwd, f, cx, cy };
};
// focal length in px for a lens in mm on a 36 mm-wide full-frame sensor rendered `widthPx` wide
export const lensPx = (mm: number, widthPx: number) => (mm / 36) * widthPx;
export type Proj = { x: number; y: number; z: number; s: number }; // screen px, depth, px per world unit at that depth
export const project = (c: Camera, p: V3): Proj => {
  const d = sub(p, c.eye), z = Math.max(1e-4, dot(d, c.fwd)), s = c.f / z;
  return { x: c.cx + dot(d, c.right) * s, y: c.cy - dot(d, c.up) * s, z, s };
};
export const toCam = (c: Camera, v: V3): V3 => [dot(v, c.right), dot(v, c.up), dot(v, c.fwd)]; // a DIRECTION in camera axes
export const pt = (q: Proj): P => [q.x, q.y];

// ---------------------------------------------------------------- blobs
// An oriented ellipsoid: centre c, local axes = columns of R, radii r. Every body volume in the
// mannequin is one of these; limbs are chains of them, swept pairwise.
export type Blob = { c: V3; R: M3; r: V3 };
const LAT = 7, LON = 14;
const UNIT: V3[] = (() => { const o: V3[] = []; for (let i = 0; i <= LAT; i++) { const ph = -Math.PI / 2 + (i / LAT) * Math.PI; const n = i === 0 || i === LAT ? 1 : LON; for (let j = 0; j < n; j++) { const th = (j / n) * Math.PI * 2; o.push([Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th)]); } } return o; })();
// surface samples, projected. The convex hull of these IS the ellipsoid's silhouette under
// perspective (to within the sampling), so foreshortening needs no special case.
export const blobPts = (cam: Camera, b: Blob): P[] => UNIT.map((u) => { const q = project(cam, add(b.c, mv(b.R, [u[0] * b.r[0], u[1] * b.r[1], u[2] * b.r[2]]))); return [q.x, q.y] as P; });
export const blobInFrame = (f: Frame, c: V3, r: V3, R: M3 = I3): Blob => ({ c: apply(f, c), R: mm(f.R, R), r });
