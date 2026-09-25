// TOY BRICK KIT. Studded toy bricks as geometry, rendered flat-plastic in orthographic view.
// Units: LDU (1 stud pitch = 20, plate = 8, brick = 24, stud d = 12, stud h = 4), so the 5:6
// brick proportion is right by construction. Parts are prisms over a convex footprint (studs on
// every whole stud cell inside it) or 1x1 rounds. Painter's order is solved per frame by
// pairwise separating axes on the parts' boxes; no z-buffer.
import type { Ctx } from "./core";

export const STUD = 20, PLATE = 8, BRICK = 24, STUD_R = 6, STUD_H = 4;
export type V3 = [number, number, number];
export type Part = {
  id: number; color: string; kind: "prism" | "round";
  foot: [number, number][];            // footprint, studs (x along X, z along Z), convex, CCW seen from above
  y0: number; h: number;               // bottom in plates, height in plates
  studs: boolean; step: number; alpha?: number;
};

// ---------------------------------------------------------------- colour
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const shade = (h: string, t: number) => { const c = hex(h).map((v) => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t))); return `rgb(${c[0]},${c[1]},${c[2]})`; };

// ---------------------------------------------------------------- camera: ortho, azimuth 45, elevation 30
export class Cam {
  constructor(public s: number, public ox: number, public oy: number) {}
  p(X: number, Y: number, Z: number): [number, number] { return [this.ox + (X - Z) * 0.70711 * this.s, this.oy + (X + Z) * 0.35355 * this.s - Y * 0.86603 * this.s]; }
}
// light (toward the light), from the upper left and a little in front: +Z faces are the lit sides
export const LIGHT: V3 = (() => { const v: V3 = [-0.25, 1, 0.55]; const l = Math.hypot(...v); return v.map((c) => c / l) as V3; })();

// world box of a part, in LDU, with a vertical offset dy (LDU)
export const aabb = (p: Part, dy = 0) => {
  const xs = p.foot.map((q) => q[0] * STUD), zs = p.foot.map((q) => q[1] * STUD);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: p.y0 * PLATE + dy, y1: (p.y0 + p.h) * PLATE + dy + (p.studs ? STUD_H : 0) };
};

// stud cells: whole cells inside the footprint
const inside = (foot: [number, number][], x: number, z: number) => { for (let i = 0; i < foot.length; i++) { const [ax, az] = foot[i], [bx, bz] = foot[(i + 1) % foot.length]; if ((bx - ax) * (z - az) - (bz - az) * (x - ax) < -1e-9) return false; } return true; };
export const studCells = (p: Part): [number, number][] => {
  if (!p.studs) return []; if (p.kind === "round") { const [x, z] = p.foot[0]; return [[x + 0.5, z + 0.5]]; }
  const xs = p.foot.map((q) => q[0]), zs = p.foot.map((q) => q[1]), out: [number, number][] = [];
  for (let x = Math.floor(Math.min(...xs)); x < Math.max(...xs); x++) for (let z = Math.floor(Math.min(...zs)); z < Math.max(...zs); z++)
    if ([[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]].every(([a, b]) => inside(p.foot, a, b))) out.push([x + 0.5, z + 0.5]);
  return out.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));          // back to front
};

// ---------------------------------------------------------------- drawing one part
const polyPath = (c: Ctx, pts: [number, number][]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
const ellipse = (c: Ctx, x: number, y: number, rx: number, ry: number) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); };

// tone for a vertical face with outward normal (nx, nz): +Z lit side ~0, +X dark side ~-0.22
const sideTone = (nx: number, nz: number) => -0.11 - 0.11 * (nx - nz);

export const drawPart = (c: Ctx, cam: Cam, p: Part, dy: number, hair: number) => {
  const Y0 = p.y0 * PLATE + dy, Y1 = (p.y0 + p.h) * PLATE + dy, s = cam.s, col = p.color;
  if (p.kind === "round") { const [x, z] = p.foot[0]; cylinder(c, cam, (x + 0.5) * STUD, Y0, Y1, (z + 0.5) * STUD, STUD * 0.48, col, hair); if (p.studs) stud(c, cam, (x + 0.5) * STUD, Y1, (z + 0.5) * STUD, col, hair); return; }
  const F = p.foot.map(([x, z]) => [x * STUD, z * STUD] as [number, number]), n = F.length;
  const seam = shade(col, -0.45), bev = shade(col, 0.32);
  // side faces that look at the camera (outward normal has +X or +Z)
  const faces: { pts: [number, number][]; t: number; a: [number, number]; b: [number, number] }[] = [];
  for (let i = 0; i < n; i++) {
    const a = F[i], b = F[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez), nx = ez / l, nz = -ex / l;   // CCW from above: outward = (ez, -ex)
    if (nx + nz <= 1e-6) continue;
    faces.push({ pts: [cam.p(a[0], Y0, a[1]), cam.p(b[0], Y0, b[1]), cam.p(b[0], Y1, b[1]), cam.p(a[0], Y1, a[1])], t: sideTone(nx, nz), a, b });
  }
  faces.forEach((f) => { polyPath(c, f.pts); c.fillStyle = shade(col, f.t); c.fill(); c.strokeStyle = shade(col, f.t); c.lineWidth = 0.6; c.stroke(); });
  const top = F.map(([x, z]) => cam.p(x, Y1, z)); polyPath(c, top); c.fillStyle = shade(col, 0.1); c.fill();
  // bevels: a light strip along every top edge that meets a visible side, and the vertical corners
  c.lineCap = "round";
  faces.forEach((f) => { const a = cam.p(f.a[0], Y1, f.a[1]), b = cam.p(f.b[0], Y1, f.b[1]); c.strokeStyle = bev; c.lineWidth = Math.max(1, 0.9 * s); c.beginPath(); c.moveTo(a[0], a[1] + 0.5 * s); c.lineTo(b[0], b[1] + 0.5 * s); c.stroke(); });
  for (let i = 0; i < faces.length; i++) for (let j = 0; j < faces.length; j++) if (i !== j && faces[i].b === faces[j].a) { const q0 = cam.p(faces[i].b[0], Y0, faces[i].b[1]), q1 = cam.p(faces[i].b[0], Y1, faces[i].b[1]); c.strokeStyle = shade(col, faces[i].t + 0.16); c.lineWidth = Math.max(1, 0.7 * s); c.beginPath(); c.moveTo(q0[0], q0[1]); c.lineTo(q1[0], q1[1]); c.stroke(); }
  // seams: a dark hairline round the silhouette of the side faces (where this part meets the next)
  c.strokeStyle = seam; c.lineWidth = hair; faces.forEach((f) => { c.beginPath(); c.moveTo(f.pts[0][0], f.pts[0][1]); c.lineTo(f.pts[1][0], f.pts[1][1]); c.moveTo(f.pts[3][0], f.pts[3][1]); c.lineTo(f.pts[2][0], f.pts[2][1]); c.stroke(); });
  if (faces.length) { const fl = faces[0], la = faces[faces.length - 1]; c.beginPath(); c.moveTo(fl.pts[0][0], fl.pts[0][1]); c.lineTo(fl.pts[3][0], fl.pts[3][1]); c.moveTo(la.pts[1][0], la.pts[1][1]); c.lineTo(la.pts[2][0], la.pts[2][1]); c.stroke(); }
  c.globalAlpha = 0.55; polyPath(c, top); c.stroke(); c.globalAlpha = 1;
  studCells(p).forEach(([x, z]) => stud(c, cam, x * STUD, Y1, z * STUD, col, hair));
};

// a stud: soft shadow crescent on the top it stands on, cylinder side lit left / dark right, top
// ellipse, a highlight crescent toward the light. Axis-aligned ellipses: rx = r*s, ry = r*s/2.
export const stud = (c: Ctx, cam: Cam, X: number, Y: number, Z: number, col: string, hair: number) => {
  const s = cam.s, r = STUD_R * s, b = cam.p(X, Y, Z), t = cam.p(X, Y + STUD_H, Z), hh = b[1] - t[1];
  c.fillStyle = shade(col, -0.2); c.globalAlpha = 0.55; ellipse(c, b[0] + r * 0.35, b[1] + r * 0.12, r * 1.02, r * 0.52); c.fill(); c.globalAlpha = 1;
  c.fillStyle = shade(col, -0.12); c.beginPath(); c.ellipse(b[0], b[1], r, r / 2, 0, 0, Math.PI); c.lineTo(t[0] - r, t[1]); c.ellipse(t[0], t[1], r, r / 2, 0, Math.PI, 0, true); c.closePath(); c.fill();
  c.fillStyle = shade(col, 0.02); c.beginPath(); c.ellipse(b[0], b[1], r, r / 2, 0, Math.PI * 0.55, Math.PI); c.lineTo(t[0] - r, t[1]); c.lineTo(t[0] - r * 0.3, t[1] + r * 0.48); c.closePath(); c.fill();
  c.fillStyle = shade(col, -0.3); c.beginPath(); c.ellipse(b[0], b[1], r, r / 2, 0, 0, Math.PI * 0.3); c.lineTo(t[0] + r * 0.62, t[1] + r * 0.4); c.lineTo(t[0] + r, t[1]); c.closePath(); c.fill();
  c.fillStyle = shade(col, 0.14); ellipse(c, t[0], t[1], r, r / 2); c.fill();
  c.strokeStyle = shade(col, 0.5); c.lineWidth = Math.max(1, 0.8 * s); c.lineCap = "round"; c.beginPath(); c.ellipse(t[0], t[1], r * 0.82, r * 0.4, 0, Math.PI * 1.08, Math.PI * 1.62); c.stroke();
  c.strokeStyle = shade(col, -0.45); c.lineWidth = hair * 0.8; c.globalAlpha = 0.5; c.beginPath(); c.ellipse(b[0], b[1], r, r / 2, 0, 0, Math.PI); c.stroke(); c.globalAlpha = 1;
  void hh;
};
// a 1x1 round: a cylinder with the same tone rule as the studs
export const cylinder = (c: Ctx, cam: Cam, X: number, Y0: number, Y1: number, Z: number, R: number, col: string, hair: number) => {
  const s = cam.s, r = R * s, b = cam.p(X, Y0, Z), t = cam.p(X, Y1, Z);
  c.fillStyle = shade(col, -0.11); c.beginPath(); c.ellipse(b[0], b[1], r, r / 2, 0, 0, Math.PI); c.lineTo(t[0] - r, t[1]); c.ellipse(t[0], t[1], r, r / 2, 0, Math.PI, 0, true); c.closePath(); c.fill();
  c.fillStyle = shade(col, 0.0); c.beginPath(); c.ellipse(b[0], b[1], r, r / 2, 0, Math.PI * 0.6, Math.PI); c.lineTo(t[0] - r, t[1]); c.lineTo(t[0] - r * 0.35, t[1]); c.lineTo(b[0] - r * 0.35, b[1] + r * 0.47); c.closePath(); c.fill();
  c.fillStyle = shade(col, -0.26); c.beginPath(); c.ellipse(b[0], b[1], r, r / 2, 0, 0, Math.PI * 0.28); c.lineTo(t[0] + r * 0.6, t[1] + r * 0.4); c.lineTo(t[0] + r, t[1]); c.closePath(); c.fill();
  c.strokeStyle = shade(col, 0.28); c.lineWidth = Math.max(1, 0.8 * s); c.beginPath(); c.moveTo(b[0] - r * 0.62, b[1] + r * 0.39); c.lineTo(t[0] - r * 0.62, t[1] + r * 0.39); c.stroke();
  c.fillStyle = shade(col, 0.1); ellipse(c, t[0], t[1], r, r / 2); c.fill();
  c.strokeStyle = shade(col, 0.34); c.lineWidth = Math.max(1, 0.9 * s); c.beginPath(); c.ellipse(t[0], t[1], r * 0.92, r * 0.44, 0, Math.PI * 0.95, Math.PI * 1.7); c.stroke();
  c.strokeStyle = shade(col, -0.45); c.lineWidth = hair; c.beginPath(); c.ellipse(b[0], b[1], r, r / 2, 0, 0, Math.PI); c.stroke();
};

// ---------------------------------------------------------------- painter's order
// B must be drawn after A if B is nearer along the first axis that separates them (X, then Z,
// then Y). Only pairs whose screen boxes overlap get an edge. Kahn's sort, ties by build order.
export const order = (parts: { p: Part; dy: number }[], cam: Cam): number[] => {
  const n = parts.length, bb = parts.map(({ p, dy }) => aabb(p, dy));
  const sb = bb.map((b) => { const xs: number[] = [], ys: number[] = []; for (const X of [b.x0, b.x1]) for (const Y of [b.y0, b.y1]) for (const Z of [b.z0, b.z1]) { const q = cam.p(X, Y, Z); xs.push(q[0]); ys.push(q[1]); } return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; });
  const after: number[][] = Array.from({ length: n }, () => []), indeg = new Array(n).fill(0), E = 0.01;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = sb[i], b = sb[j]; if (a[1] <= b[0] || b[1] <= a[0] || a[3] <= b[2] || b[3] <= a[2]) continue;
    const A = bb[i], B = bb[j]; let front = -1;
    if (A.x1 <= B.x0 + E) front = j; else if (B.x1 <= A.x0 + E) front = i;
    else if (A.z1 <= B.z0 + E) front = j; else if (B.z1 <= A.z0 + E) front = i;
    else if (A.y1 - STUD_H * (parts[i].p.studs ? 1 : 0) <= B.y0 + E) front = j; else if (B.y1 - STUD_H * (parts[j].p.studs ? 1 : 0) <= A.y0 + E) front = i;
    if (front < 0) continue; const back = front === i ? j : i; after[back].push(front); indeg[front]++;
  }
  const out: number[] = [], ready: number[] = []; for (let i = 0; i < n; i++) if (!indeg[i]) ready.push(i);
  while (out.length < n) {
    if (!ready.length) { for (let i = 0; i < n; i++) if (indeg[i] > 0 && !out.includes(i)) { indeg[i] = 0; ready.push(i); break; } }   // a cycle: break it by build order
    ready.sort((a, b) => a - b); const k = ready.shift()!; out.push(k); for (const m of after[k]) if (--indeg[m] === 0) ready.push(m);
  }
  return out;
};
