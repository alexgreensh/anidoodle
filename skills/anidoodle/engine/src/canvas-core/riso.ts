// RISOGRAPH TOOLKIT for representational subjects. Volume comes from a halftone screen whose
// dots change size with a TONE FUNCTION, so realism is a matter of writing the right tone
// function for the form: a lit dome, a cylinder, distance to a fold.
import { Gfx, Medium, P, displace, halftone, poly, rng, sample } from "./core";

export const INK = { pink: "#ff48b0", blue: "#0078bf", yellow: "#ffd400", teal: "#00838a", red: "#f15060" }, PAPER = "#f5efe2";
export const LITHO: Medium = { nib: 1.5, taper: 0.95, pressure: 1.15, retrace: false, wobble: 0.9, rough: 0.9 }; // litho crayon: swells and thins
export const cut = (pts: P[]) => displace(displace(pts, 2.2, 0.07, 2, 6), 0.9, 0.45, 1, 9);
export const smooth = (pts: P[], per = 10) => cut(sample(pts, true, per));
export const straight = (pts: P[]) => cut(poly(pts, 6));
export const REG = { yellow: [-4.5, 3.5] as P, pink: [4.5, -3] as P, blue: [0, 0] as P };
export const drum = (g: Gfx, off: P, fn: () => void) => g.group("plain", fn, { blend: "multiply", off, textures: ["risoSpeck", "risoMottle"] });
export const screen = (g: Gfx, b: { x0: number; y0: number; x1: number; y1: number }, pitch: number, ang: number, tone: (x: number, y: number) => number, color: string, clip?: P[]) => {
  const c = g.cur; g.touch(b.x0 - 10, b.y0 - 10, b.x1 + 10, b.y1 + 10); c.save(); if (clip) { g.path(c, clip); c.clip(); } c.fillStyle = color; c.beginPath();
  halftone(b, pitch, ang, tone).forEach(([x, y, r]) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }); c.fill(); c.restore();
};
export const bounds = (pts: P[]) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }); return { x0, y0, x1, y1 }; };
export const inside = (pts: P[], x: number, y: number) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
// how far across the form is this point, 0..1, along one axis? (a cylinder lit from one side)
export const across = (pts: P[], axis: "x" | "y") => { const memo = new Map<number, [number, number]>(), a = axis === "x" ? 0 : 1, o = 1 - a; return (x: number, y: number) => { const q = [x, y], key = Math.round(q[o]); let span = memo.get(key); if (!span) { let lo = 1e9, hi = -1e9; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const p = pts[i], r = pts[j]; if (p[o] > key !== r[o] > key) { const v = p[a] + ((key - p[o]) * (r[a] - p[a])) / (r[o] - p[o]); lo = Math.min(lo, v); hi = Math.max(hi, v); } } span = [lo, hi]; memo.set(key, span); } return span[1] <= span[0] ? 0 : Math.max(0, Math.min(1, (q[a] - span[0]) / (span[1] - span[0]))); }; };
// nearest distance to a set of polylines, through a grid so 30k dots stay cheap
export const nearField = (lines: P[][], cell = 28) => {
  const grid = new Map<string, P[]>(), put = (p: P) => { const k = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(p); };
  lines.forEach((l) => { for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4)); for (let k = 0; k <= n; k++) put([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); } });
  return (x: number, y: number) => { const cx = Math.floor(x / cell), cy = Math.floor(y / cell); let d = cell * 1.5; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of grid.get(`${cx + i},${cy + j}`) ?? []) d = Math.min(d, Math.hypot(p[0] - x, p[1] - y)); return d; };
};
// a fold that wanders like a real one, plus the little side branches folds always have
export const wander = (pts: P[], amp: number, wl: number, seed: number): P[] => { const s = sample(pts, false, 14), r = rng(seed), ph = r() * 6.28; let len = 0; return s.map((p, i) => { const q = s[Math.min(s.length - 1, i + 1)], o = s[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1; if (i) len += Math.hypot(p[0] - o[0], p[1] - o[1]); const ends = Math.min(1, i / 8, (s.length - 1 - i) / 8), w = (Math.sin((len / wl) * 6.28 + ph) + 0.45 * Math.sin((len / wl) * 15.1 + ph * 2)) * amp * ends; return [p[0] - (dy / l) * w, p[1] + (dx / l) * w] as P; }); };
export const twigs = (line: P[], every: number, seed: number, lenLo = 16, lenHi = 38): P[][] => { const r = rng(seed), out: P[][] = []; let acc = every * r(); for (let i = 2; i < line.length - 2; i++) { acc += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]); if (acc < every) continue; acc = 0; if (r() < 0.25) continue; const dx = line[i + 1][0] - line[i - 1][0], dy = line[i + 1][1] - line[i - 1][1], a = Math.atan2(dy, dx) + (r() < 0.5 ? 1 : -1) * (1.1 + r() * 0.8), L = lenLo + r() * (lenHi - lenLo), b = (r() - 0.5) * 0.9; out.push([line[i], [line[i][0] + Math.cos(a) * L * 0.5, line[i][1] + Math.sin(a) * L * 0.5], [line[i][0] + Math.cos(a + b) * L, line[i][1] + Math.sin(a + b) * L]]); } return out; };
export const plateMarks = (g: Gfx, W: number, H: number, inks: string[]) => {
  g.group("plain", () => { const c = g.cur; c.strokeStyle = "#1b1b1b"; c.lineWidth = 1.1; [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.moveTo(x - 12, y); c.lineTo(x + 12, y); c.moveTo(x, y - 12); c.lineTo(x, y + 12); c.stroke(); }); }, { alpha: 0.9 });
  drum(g, [0, 0], () => inks.forEach((col, i) => { const c = g.cur; c.fillStyle = col; c.fillRect(W / 2 - inks.length * 16 + i * 32, H - 34, 28, 14); }));
  g.paper("paper", 0.26); g.paper("coldpress", 0.22);
};
