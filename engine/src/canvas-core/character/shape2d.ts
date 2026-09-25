// 2D SHAPE OPS for characters: convex hull, point-in-polygon, and the one that matters most,
// UNION CONTOURS. A body part is a union of convex polygons (a limb is a chain of swept blob
// pairs). Its outline is every boundary point of every polygon that is NOT inside another
// polygon of the same part, so the elbow of one arm has no seam, while a forearm crossing in
// front of its own upper arm (a separate part) still gets its overlap line.
import type { P } from "../core";

export const hull = (pts: P[]): P[] => {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (s.length < 3) return s;
  const x = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: P[] = [], hi: P[] = [];
  for (const p of s) { while (lo.length >= 2 && x(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (hi.length >= 2 && x(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
};
export const signedArea = (s: P[]) => s.reduce((a, p, i) => { const q = s[(i + 1) % s.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
// every polygon in a union must wind the same way, or nonzero filling punches holes
export const ccw = (s: P[]): P[] => (signedArea(s) < 0 ? [...s].reverse() : s);
export const insidePoly = (pts: P[], x: number, y: number) => { let k = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) k = !k; } return k; };
const segDist = (p: P, a: P, b: P) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
export const edgeDist = (poly: P[], p: P) => { let d = 1e9; for (let i = 0; i < poly.length; i++) d = Math.min(d, segDist(p, poly[i], poly[(i + 1) % poly.length])); return d; };
export const bbox = (polys: P[][]) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const s of polys) for (const [x, y] of s) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return { x0, y0, x1, y1 }; };
export const centroid = (s: P[]): P => { let x = 0, y = 0; s.forEach((p) => { x += p[0]; y += p[1]; }); return [x / s.length, y / s.length]; };

// walk a closed polygon at `step` px
export const densifyClosed = (s: P[], step: number): P[] => {
  const out: P[] = [];
  for (let i = 0; i < s.length; i++) { const a = s[i], b = s[(i + 1) % s.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); }
  return out;
};

// The outline of a union, as open runs. `hide(p)` removes extra points (seams where a part
// joins its parent). Coincident edges are kept once: the lower-index polygon owns them.
export const unionRuns = (polys: P[][], step: number, hide?: (p: P) => boolean, eps = 0.8): P[][] => {
  const runs: P[][] = [];
  const bbs = polys.map((s) => bbox([s]));
  polys.forEach((poly, i) => {
    if (poly.length < 3) return;
    const d = densifyClosed(poly, step), keep = d.map((p) => {
      if (hide && hide(p)) return false;
      for (let j = 0; j < polys.length; j++) {
        if (j === i || polys[j].length < 3) continue; const b = bbs[j];
        if (p[0] < b.x0 - eps || p[0] > b.x1 + eps || p[1] < b.y0 - eps || p[1] > b.y1 + eps) continue;
        const inn = insidePoly(polys[j], p[0], p[1]), e = edgeDist(polys[j], p);
        if (inn && e > eps) return false;            // buried inside a sibling
        if (e <= eps && j < i) return false;          // shared edge: the lower index draws it
      }
      return true;
    });
    const n = d.length; if (!n) return;
    if (keep.every(Boolean)) { runs.push([...d, d[0]]); return; }
    // rotate so we start on a hidden point, then collect kept stretches
    const s0 = keep.findIndex((k) => !k); let cur: P[] = [];
    for (let k = 1; k <= n; k++) { const i2 = (s0 + k) % n; if (keep[i2]) cur.push(d[i2]); else { if (cur.length > 1) runs.push(cur); cur = []; } }
    if (cur.length > 1) runs.push(cur);
  });
  return runs;
};

// thin a dense run for a pen that splines its own control points
export const thin = (s: P[], every: number): P[] => { if (s.length <= 3) return s; const o = s.filter((_, i) => i % every === 0); if (o[o.length - 1] !== s[s.length - 1]) o.push(s[s.length - 1]); return o; };
export const runLength = (s: P[]) => s.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1]) : 0), 0);
