// 2.5D CARTOON PARTS (Rivers, Igarashi & Durand, "2.5D Cartoon Models", SIGGRAPH 2010).
// A part that a volume cannot describe well (a fringe, a cowlick, a hood's opening) is DRAWN by
// hand in a few views, each a 2D polygon with the SAME number of points in the same order, and
// hung on a 3D anchor. The view angle picks the two nearest drawings and blends them point for
// point; negative yaw mirrors. So the part turns with the head, and every in-between is a blend
// of two drawings someone authored, never a squash of one.
import type { P } from "../core";
import { Camera, Frame, V3, apply, project, toCam, col } from "./math3";

export type Views = { yaw: number[]; shapes: P[][] }; // yaw ascending, 0..180; shapes in anchor units, x right, y DOWN
export const checkViews = (id: string, v: Views) => {
  const n = v.shapes[0].length;
  v.shapes.forEach((s, i) => { if (s.length !== n) throw new Error(`2.5D part '${id}': view ${v.yaw[i]} has ${s.length} points, view ${v.yaw[0]} has ${n}; every view must correspond point for point`); });
  if (v.yaw.length !== v.shapes.length) throw new Error(`2.5D part '${id}': ${v.yaw.length} angles for ${v.shapes.length} shapes`);
};

// the anchor's frame as the camera sees it: which way it faces (yaw, pitch) and its roll on screen
export const viewOf = (cam: Camera, f: Frame) => {
  const fwd = toCam(cam, col(f.R, 2)), up = toCam(cam, col(f.R, 1));
  const yaw = (Math.atan2(fwd[0], -fwd[2]) * 180) / Math.PI;                       // +: faces screen right
  const pitch = (Math.asin(Math.max(-1, Math.min(1, fwd[1]))) * 180) / Math.PI;     // +: faces up
  const roll = Math.atan2(up[0], up[1]);                                           // screen tilt of the head's up axis
  return { yaw, pitch, roll };
};

export const blendViews = (v: Views, yawDeg: number): P[] => {
  const mirror = yawDeg < 0, a = Math.min(Math.abs(yawDeg), v.yaw[v.yaw.length - 1]);
  let i = 0; while (i < v.yaw.length - 2 && a > v.yaw[i + 1]) i++;
  const t = Math.max(0, Math.min(1, (a - v.yaw[i]) / (v.yaw[i + 1] - v.yaw[i] || 1))), s = t * t * (3 - 2 * t); // ease so the held drawings dominate
  const A = v.shapes[i], B = v.shapes[i + 1] ?? A;
  return A.map((p, k) => [(mirror ? -1 : 1) * (p[0] + (B[k][0] - p[0]) * s), p[1] + (B[k][1] - p[1]) * s]);
};

// place a blended drawing on screen: anchor point in the frame, unit = `unit` metres
export const place25d = (cam: Camera, f: Frame, anchor: V3, unit: number, v: Views, o: { pitchShift?: number } = {}): { pts: P[]; yaw: number; px: number } => {
  const vw = viewOf(cam, f), q = project(cam, apply(f, anchor)), k = q.s * unit, c = Math.cos(vw.roll), s = Math.sin(vw.roll);
  const dy = -(o.pitchShift ?? 0) * Math.sin((vw.pitch * Math.PI) / 180), sy = Math.cos((vw.pitch * Math.PI) / 180) * 0.25 + 0.75;
  const pts = blendViews(v, vw.yaw).map(([x, y]) => { const X = x * k, Y = (y * sy + dy) * k; return [q.x + X * c - Y * s, q.y + X * s + Y * c] as P; });
  return { pts, yaw: vw.yaw, px: k };
};
