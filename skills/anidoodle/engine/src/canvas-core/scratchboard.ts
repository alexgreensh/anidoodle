import { Gfx, PENCIL, rng, sample, type Ctx, type Env, type Layer, type P } from "./core";
import type { Film } from "./film";
import { BODY, EAR_F, EAR_N, EYE_F, EYE_N, HEAD, MOON, NOSE_LEATHER, TUFT_F, TUFT_N, eyeOutline, insidePoly, lynxField, type Eye, type LynxField } from "./scratchboardKit";

// LYNX IN MOONLIGHT · scratchboard. A board of white china clay under a coat of black India ink.
// Nothing is added: every mark is the ink SCRAPED AWAY with a steel knife or a scratch nib, so
// every mark is white on black and the picture is found by removing the dark. The knife cuts a
// clean-edged line that is widest where it bites in and tapers as it lifts; the clay chips a hair
// at the edges. Fur is a tapered white flick cut in the direction the hair grows; hatching runs
// parallel to the form; a second, crossing set of cuts gives the mid tones; the lights are cut so
// densely they become bold scraped areas, and the brightest are scraped flat with the blade.
//
// ORDER. The knife reveals from black: first the contour highlights where the moon catches the
// edges (ears, the lit cheek and ruff, the crown, the far shoulder); then a sparse layer of fur
// flicks everywhere the light reaches, only to set the direction of the coat; then the light
// mass is built, mid tones first, the crossing cuts, then the lights until they close up; last
// the details: the nose leather hatched, the irises, the whiskers, and the catchlights.
//
// PALETTE. Black board (#0c0b0a) and the clay's warm white. No colour, no grey ink: grey is only
// how close together the white cuts are.
// LIGHT. A low moon off the upper right. It rakes across the face: the right cheek, ruff and ear
// catch it, the left side of the face falls away into the board, and the head throws its shadow
// down across the throat and the near shoulder. The only white on the far side is what the moon
// grazes and what a little skylight lifts.
// SUBJECT & REFERENCE: see scratchboardKit.ts (lynx anatomy, markings, and the fields).

const N = 480, HOLD = 30;
// THE CUE TABLE: every frame number of the film. Events on multiples of 5.
const CUES = { rim: [0, 100], direction: [100, 230], mids: [230, 305], cross: [305, 345], lights: [345, 415], detail: [415, 445], catchlight: [445, 450], hold: N - HOLD } as const;
(() => { const bad = Object.entries(CUES).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).filter((f) => f % 5 || f < 0 || f > N).map((f) => `${k}:${f}`)); if (bad.length || N % 15) throw new Error("scratchboard cue off the grid: " + bad.join(",")); })();

export const BOARD = "#0c0b0a", CLAY = "#ebe5d8";
const TAU = Math.PI * 2, clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

// A cut: a centreline and a width profile. `t0..t1` is when the knife makes it (frames).
export type Cut = { pts: P[]; w: number[]; t0: number; t1: number; alpha: number; fill?: boolean };

// ---------------------------------------------------------------- field sampling
const fieldAt = (F: LynxField) => {
  const idx = (x: number, y: number) => Math.max(0, Math.min(F.gh - 1, Math.floor(y / F.G))) * F.gw + Math.max(0, Math.min(F.gw - 1, Math.floor(x / F.G)));
  const bil = (arr: Float32Array, x: number, y: number) => { const fx = x / F.G - 0.5, fy = y / F.G - 0.5, i = Math.max(0, Math.min(F.gw - 2, Math.floor(fx))), j = Math.max(0, Math.min(F.gh - 2, Math.floor(fy))), a = clamp(fx - i), b = clamp(fy - j), q = j * F.gw + i; return (arr[q] * (1 - a) + arr[q + 1] * a) * (1 - b) + (arr[q + F.gw] * (1 - a) + arr[q + F.gw + 1] * a) * b; };
  const dir = (x: number, y: number): P => { const fx = x / F.G - 0.5, fy = y / F.G - 0.5, i = Math.max(0, Math.min(F.gw - 2, Math.floor(fx))), j = Math.max(0, Math.min(F.gh - 2, Math.floor(fy))), a = clamp(fx - i), b = clamp(fy - j), q = j * F.gw + i; let cx = 0, cy = 0; [[q, (1 - a) * (1 - b)], [q + 1, a * (1 - b)], [q + F.gw, (1 - a) * b], [q + F.gw + 1, a * b]].forEach(([k, w]) => { if (F.part[k]) { cx += Math.cos(F.ang[k]) * w; cy += Math.sin(F.ang[k]) * w; } }); const l = Math.hypot(cx, cy) || 1; return [cx / l, cy / l]; };
  return { part: (x: number, y: number) => F.part[idx(x, y)], tone: (x: number, y: number) => (F.part[idx(x, y)] ? bil(F.tone, x, y) : 0), len: (x: number, y: number) => bil(F.len, x, y), dir };
};

// ---------------------------------------------------------------- building every cut, once
const buildCuts = (env: Env): Cut[] => {
  const key = `scratch:cuts:${env.W}`; let C = env.cache.get(key) as Cut[] | undefined; if (C) return C;
  const W = env.W, H = env.H, k = W / 1080, F = lynxField(W, H), fa = fieldAt(F), r = rng(4711);
  const ml = Math.hypot(...MOON), LX = MOON[0] / ml, LY = MOON[1] / ml, lxy = Math.hypot(LX, LY), ux = LX / lxy, uy = LY / lxy;
  const S = (pts: P[]) => pts.map(([x, y]) => [x * k, y * k] as P);
  const cuts: { c: Cut; phase: number; order: number }[] = [];
  const taper = (n: number, w0: number, a = 0.12, b = 0.75) => Array.from({ length: n }, (_, i) => { const t = n > 1 ? i / (n - 1) : 0; return w0 * Math.sqrt(clamp(t / a)) * Math.pow(clamp((1 - t) / b), 0.8) + 0.05; });

  // 1 CONTOUR HIGHLIGHTS: along each silhouette where it faces the moon, a knife line just inside the edge
  const rims = (outline: P[], inset: number, wmax: number, minFace: number, only?: (p: P) => boolean) => {
    const s = sample(S(outline), true, 10), n = s.length, area = s.reduce((a, p, i) => a + p[0] * s[(i + 1) % n][1] - s[(i + 1) % n][0] * p[1], 0), out = area > 0 ? 1 : -1;
    const face = s.map((p, i) => { const a = s[(i - 1 + n) % n], b = s[(i + 1) % n], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, nx = (ty / l) * out, ny = (-tx / l) * out; return { nx, ny, f: nx * ux + ny * uy }; });
    let run: P[] = [], fs: number[] = [];
    const flush = () => { if (run.length > 6) { let i = 0; while (i < run.length - 3) { const m = Math.min(run.length - i, 6 + Math.floor(r() * 9)), seg = run.slice(i, i + m), fav = fs.slice(i, i + m).reduce((a, b) => a + b, 0) / m; cuts.push({ c: { pts: seg, w: taper(seg.length, wmax * (0.6 + 0.6 * fav), 0.2, 0.4), t0: 0, t1: 0, alpha: 0.97 }, phase: 0, order: cuts.length }); i += m - 1 - (r() < 0.5 ? 1 : 0); } } run = []; fs = []; };
    s.forEach((p, i) => { const { nx, ny, f } = face[i]; const q: P = [p[0] - nx * inset * k + (r() - 0.5), p[1] - ny * inset * k + (r() - 0.5)]; if (f > minFace && (!only || only(p)) && fa.part(q[0], q[1])) { run.push(q); fs.push(f); } else flush(); });
    flush();
  };
  rims(EAR_N, 2.5, 1.6, 0.05); rims(EAR_F, 2.5, 2.0, 0.0);
  // on fur the contour highlight is not a line: it is a row of short bright flicks cut along the lie of the hair, right at the lit edge
  const rimFur = (outline: P[], minFace: number, only: (p: P) => boolean) => {
    const s = sample(S(outline), true, 24), n = s.length, area = s.reduce((a, p, i) => a + p[0] * s[(i + 1) % n][1] - s[(i + 1) % n][0] * p[1], 0), out = area > 0 ? 1 : -1;
    s.forEach((p, i) => { const a = s[(i - 1 + n) % n], b = s[(i + 1) % n], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, nx = (ty / l) * out, ny = (-tx / l) * out, f = nx * ux + ny * uy; if (f < minFace || ny > 0.35 || p[0] > W - 8 || p[1] > H - 8 || !only(p) || r() > 0.85) return;   /* not along the underside: the moon cannot reach it */
      const d = 2 + r() * 7, x = p[0] - nx * d, y = p[1] - ny * d; if (!fa.part(x, y)) return; const [fx, fy] = fa.dir(x, y), L = Math.max(5, fa.len(x, y) * (0.35 + 0.45 * r())), ang = Math.atan2(fy + ny * 0.35, fx + nx * 0.35) + (r() - 0.5) * 0.3, pts: P[] = [];
      for (let q = 0; q <= 6; q++) pts.push([x + Math.cos(ang) * L * q / 6 + (r() - 0.5) * 0.4, y + Math.sin(ang) * L * q / 6 + (r() - 0.5) * 0.4]);
      cuts.push({ c: { pts, w: taper(pts.length, 1.1 + 1.1 * f, 0.15, 0.8), t0: 0, t1: 0, alpha: 0.97 }, phase: 0, order: cuts.length }); });
  };
  rimFur(HEAD, 0.2, (p) => p[0] > 600 * k || p[1] > 420 * k); rimFur(BODY, 0.25, (p) => p[1] < 1060 * k && p[0] > 780 * k);
  [TUFT_N, TUFT_F].forEach((t, ti) => [-1.6, 0, 1.4].forEach((o, j) => { const pts = sample(S(t.map(([x, y], i) => [x + o * (1 - i / 3) + (ti ? 1.2 : 0.6), y] as P)), false, 8); cuts.push({ c: { pts, w: taper(pts.length, ti ? 1.3 : 0.9, 0.1, 0.9), t0: 0, t1: 0, alpha: ti ? 0.95 : 0.7 }, phase: 0, order: cuts.length }); }));   // tufts: black hair, only its lit edge caught
  // the lit ridges inside the silhouette: the right edge of the nose bridge, the far brow, the top of the far whisker pad
  ([[[584, 430], [588, 470], [592, 506]], [[616, 392], [642, 386], [668, 392]], [[590, 560], [614, 556], [640, 560]], [[608, 604], [590, 618], [566, 626]]] as P[][]).forEach((pl) => { const pts = sample(S(pl), false, 8); cuts.push({ c: { pts, w: taper(pts.length, 1.4, 0.15, 0.6), t0: 0, t1: 0, alpha: 0.9 }, phase: 0, order: cuts.length }); });

  // 2 FUR: variable-radius Poisson seeds (density follows tone), each a streamline flick along the coat
  const cell = 1.3, gw = Math.ceil(W / cell), gh = Math.ceil(H / cell), grid = new Int32Array(gw * gh).fill(-1), xs: number[] = [], ys: number[] = [], ds: number[] = [];
  const wOf = (t: number) => (t < 0.03 ? 0 : 0.34 + 2.3 * Math.pow(t, 1.6));   // the knife bites wider where the light is stronger
  const spacing = (x: number, y: number) => { const t = fa.tone(x, y); if (t < 0.06) return 0; const L = Math.max(4, fa.len(x, y)), w0 = wOf(t), area = L * w0 * 0.5, cov = Math.pow(t, 1.15) * (0.85 + 0.5 * t * t); return clamp(Math.sqrt((0.9 * area) / cov), 1.9, 26); };
  const ok = (x: number, y: number, d: number) => { const reach = Math.ceil((d * 1.2) / cell), gx = Math.floor(x / cell), gy = Math.floor(y / cell); for (let j = Math.max(0, gy - reach); j <= Math.min(gh - 1, gy + reach); j++) for (let i = Math.max(0, gx - reach); i <= Math.min(gw - 1, gx + reach); i++) { const q = grid[j * gw + i]; if (q < 0) continue; const dx = xs[q] - x, dy = ys[q] - y, m = 0.5 * (d + ds[q]); if (dx * dx + dy * dy < m * m) return false; } return true; };
  const add = (x: number, y: number, d: number) => { const q = xs.length; xs.push(x); ys.push(y); ds.push(d); grid[Math.floor(y / cell) * gw + Math.floor(x / cell)] = q; return q; };
  const grow = (q0: number) => { const act = [q0]; while (act.length) { const ai = Math.floor(r() * act.length), q = act[ai]; let found = false; for (let t = 0; t < 16; t++) { const a = r() * TAU, rr = ds[q] * (1 + r()), x = xs[q] + Math.cos(a) * rr, y = ys[q] + Math.sin(a) * rr; if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue; const p = fa.part(x, y); if (!p || p === 4 || p === 5) continue; const d = spacing(x, y); if (!d || !ok(x, y, d)) continue; act.push(add(x, y, d)); found = true; } if (!found) { act[ai] = act[act.length - 1]; act.pop(); } } };
  for (let y = 4; y < H; y += 9) for (let x = 4; x < W; x += 9) { const px = x + (r() - 0.5) * 6, py = y + (r() - 0.5) * 6, p = fa.part(px, py); if (!p || p === 4 || p === 5) continue; const d = spacing(px, py); if (d && ok(px, py, d)) grow(add(px, py, d)); }
  const flick = (x0: number, y0: number, L: number, bend: number, dev: number): P[] => {
    const pts: P[] = [[x0, y0]]; let x = x0, y = y0, s = 0; const step = Math.max(1.2, L / 14);
    while (s < L) { const [dx, dy] = fa.dir(x, y), a = Math.atan2(dy, dx) + dev + bend * (s / L); x += Math.cos(a) * step; y += Math.sin(a) * step; s += step; const p = fa.part(x, y); if (p === 4 || p === 5) break; pts.push([x, y]); }
    return pts;
  };
  xs.forEach((x, i) => {
    const y = ys[i], t = fa.tone(x, y), L = Math.max(4, fa.len(x, y)) * (0.7 + r() * 0.6), rank = r();
    const pts = flick(x, y, L, (r() - 0.5) * 0.5, (r() - 0.5) * 0.24); if (pts.length < 2) return;
    const w0 = wOf(t), tp = taper(pts.length, 1), w = pts.map((p, j) => tp[j] * wOf(fa.tone(p[0], p[1])));   // a hair that crosses a dark bar thins out as it crosses it
    cuts.push({ c: { pts, w, t0: 0, t1: 0, alpha: 0.9 + 0.08 * r() }, phase: rank < 0.34 ? 1 : t < 0.5 ? 2 : 4, order: 0 });
    // 3 CROSS-HATCH for the mid tones: a shorter, straighter cut across the lie of the fur
    const mid = clamp(1 - Math.abs(t - 0.38) / 0.22);
    if (mid > 0 && r() < 0.6 * mid) { const [dx, dy] = fa.dir(x, y), a = Math.atan2(dy, dx) + (r() < 0.5 ? 0.62 : -0.62), l = L * 0.5, cx = x + dx * L * 0.3, cy = y + dy * L * 0.3; const cp = [[cx - Math.cos(a) * l / 2, cy - Math.sin(a) * l / 2], [cx, cy], [cx + Math.cos(a) * l / 2, cy + Math.sin(a) * l / 2]] as P[]; cuts.push({ c: { pts: cp, w: taper(3, 0.75 * w0, 0.2, 0.6), t0: 0, t1: 0, alpha: 0.85 }, phase: 3, order: 0 }); }
  });

  // 4 DETAIL. Nose leather: parallel cuts that follow its dome, lit toward the moon, nostrils left black
  const nose = S(NOSE_LEATHER), nb = { x0: 530 * k, x1: 604 * k, y0: 512 * k, y1: 560 * k };
  for (let yy = nb.y0 + 1; yy < nb.y1; yy += 1.9 * k) { const run: P[] = []; for (let xx = nb.x0; xx <= nb.x1; xx += 1.5 * k) { const yb = yy + Math.pow((xx - 567 * k) / (38 * k), 2) * 6 * k, lit = clamp(0.2 + ((xx - 560 * k) * ux - (yb - 520 * k) * -uy) / (40 * k)), nostril = Math.hypot((xx - 553 * k) / 7, (yb - 544 * k) / 4) < k || Math.hypot((xx - 582 * k) / 7, (yb - 543 * k) / 4) < k; if (insidePoly(nose, xx, yb) && !nostril && lit + 0.35 * (1 - (yb - nb.y0) / (nb.y1 - nb.y0)) > 0.3 + 0.3 * r()) run.push([xx, yb]); else if (run.length) { if (run.length > 2) cuts.push({ c: { pts: run.slice(), w: taper(run.length, 0.8, 0.2, 0.5), t0: 0, t1: 0, alpha: 0.8 }, phase: 5, order: 0 }); run.length = 0; } } if (run.length > 2) cuts.push({ c: { pts: run.slice(), w: taper(run.length, 0.8, 0.2, 0.5), t0: 0, t1: 0, alpha: 0.8 }, phase: 5, order: 0 }); }
  // irises: wide round moonlight pupils, the iris a ring of radial cuts, lit on the side AWAY from the catchlight
  const iris = (e: Eye, bright: number, seed: number) => {
    const out = S(eyeOutline(e, 56)), c: P = [e.pupil[0] * k, e.pupil[1] * k], pr = e.pr * k, rr = rng(seed), litA = Math.atan2(uy * -1, ux * -1);
    for (let i = 0; i < 90; i++) { const a = (i / 90) * TAU + (rr() - 0.5) * 0.05, g = 0.2 + 0.8 * Math.pow(Math.max(0, Math.cos(a - litA)), 1.4); if (rr() > g * bright + 0.12) continue; const pts: P[] = []; for (let d = pr + 1.4; d < pr + 30 * k; d += 1.2) { const p: P = [c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d]; if (!insidePoly(out, p[0], p[1])) break; pts.push(p); } if (pts.length > 2) { const inner = pts.slice(0, Math.max(2, pts.length - 2)); cuts.push({ c: { pts: inner, w: taper(inner.length, 0.55 + 0.4 * g * bright, 0.2, 0.4), t0: 0, t1: 0, alpha: 0.85 }, phase: 6, order: 0 }); } }
  };
  iris(EYE_N, 0.55, 81); iris(EYE_F, 1, 82);
  // whiskers: long, fine, slightly curved, from the spot rows out past the ruff; brow whiskers above each eye
  const whisk = (from: P, to: P, sag: number, w: number, al: number) => { const m: P = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + sag], pts = sample(S([from, m, to]), false, 18); cuts.push({ c: { pts, w: taper(pts.length, w, 0.05, 0.95), t0: 0, t1: 0, alpha: al }, phase: 7, order: 0 }); };
  [[498, 574, 318, 566, 14], [502, 584, 300, 616, 18], [506, 594, 330, 668, 18], [496, 566, 350, 526, 10]].forEach(([x0, y0, x1, y1, s]) => whisk([x0, y0], [x1, y1], s, 0.95, 0.6));
  [[634, 572, 870, 552, 14], [636, 580, 886, 600, 18], [632, 588, 866, 648, 20], [628, 595, 830, 690, 16], [636, 564, 840, 508, 10]].forEach(([x0, y0, x1, y1, s]) => whisk([x0, y0], [x1, y1], s, 1.25, 0.95));
  [[470, 396, 400, 326, -8], [490, 392, 440, 312, -6], [650, 392, 716, 318, -8], [634, 390, 672, 308, -6]].forEach(([x0, y0, x1, y1, s]) => whisk([x0, y0], [x1, y1], s, 0.9, 0.85));
  // catchlights: the moon in each cornea, scraped flat with the blade. Last cut of all.
  [[EYE_F, 1], [EYE_N, 0.7]].forEach(([e0, sc]) => { const e = e0 as Eye, s = sc as number, c: P = [(e.pupil[0] + e.pr * 0.5) * k, (e.pupil[1] - e.pr * 0.5) * k], R = 5.2 * s * k, pts: P[] = Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * TAU; return [c[0] + Math.cos(a) * R * (1 + 0.12 * Math.sin(a * 2)), c[1] + Math.sin(a) * R * 0.85] as P; }); cuts.push({ c: { pts, w: [], t0: 0, t1: 0, alpha: 0.98, fill: true }, phase: 8, order: 0 }); const c2: P = [(e.pupil[0] - e.pr * 0.55) * k, (e.pupil[1] + e.pr * 0.6) * k], p2: P[] = Array.from({ length: 7 }, (_, i) => [c2[0] + Math.cos((i / 7) * TAU) * 1.6 * s * k, c2[1] + Math.sin((i / 7) * TAU) * 1.3 * s * k] as P); cuts.push({ c: { pts: p2, w: [], t0: 0, t1: 0, alpha: 0.8, fill: true }, phase: 8, order: 0 }); });

  // SCHEDULE: within a phase the hand works region by region (patches, snaking), then the timeline
  const PATCH = 96 * k, patch = (p: P) => { const py = Math.floor(p[1] / PATCH), px = Math.floor(p[0] / PATCH); return py * 64 + (py % 2 ? 63 - px : px); };
  const win: [number, number][] = [[CUES.rim[0], CUES.rim[1]], [CUES.direction[0], CUES.direction[1]], [CUES.mids[0], CUES.mids[1]], [CUES.cross[0], CUES.cross[1]], [CUES.lights[0], CUES.lights[1]], [CUES.detail[0], CUES.detail[0] + 10], [CUES.detail[0] + 5, CUES.detail[0] + 15], [CUES.detail[0] + 10, CUES.detail[1]], [CUES.catchlight[0], CUES.catchlight[1]]];
  for (let ph = 0; ph < win.length; ph++) {
    const list = cuts.filter((c) => c.phase === ph); if (!list.length) continue;
    if (ph > 0) list.sort((a, b) => patch(a.c.pts[0]) - patch(b.c.pts[0]) || a.c.pts[0][1] - b.c.pts[0][1]);
    const [a, b] = win[ph], lens = list.map((c) => { let l = 0; for (let i = 1; i < c.c.pts.length; i++) l += Math.hypot(c.c.pts[i][0] - c.c.pts[i - 1][0], c.c.pts[i][1] - c.c.pts[i - 1][1]); return l; });
    if (ph === 0 || ph === 7) {                                  // the long knife lines are watched being cut: time ~ length, long strokes quicker per pixel
      const cost = lens.map((l) => 1.5 + Math.pow(l, 0.7)), tot = cost.reduce((x, y) => x + y, 0); let t = a;
      list.forEach((c, i) => { const d = ((b - a) * cost[i]) / tot; c.c.t0 = t; c.c.t1 = t + Math.max(d, 0.5); t += d; });
    } else list.forEach((c, i) => { const f = a + ((b - a) * (i + 1)) / list.length; c.c.t0 = f - 1; c.c.t1 = f; });
  }
  C = cuts.map((c) => c.c).sort((x, y) => x.t1 - y.t1);
  env.cache.set(key, C);
  return C;
};

// ---------------------------------------------------------------- the knife
export const ribbon = (c0: Cut, prog = 1): P[] => {
  let c = c0;
  if (prog < 1) { const n0 = c0.pts.length, u = (n0 - 1) * prog, i = Math.floor(u), f = u - i, a = c0.pts[i], b = c0.pts[Math.min(n0 - 1, i + 1)]; c = { ...c0, pts: [...c0.pts.slice(0, i + 1), [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]], w: [...c0.w.slice(0, i + 1), c0.w[Math.min(n0 - 1, i + 1)] ?? 0.5] }; prog = 1; }   /* the tip travels continuously, not point to point */
  const n = c.pts.length, m = prog >= 1 ? n : Math.max(2, Math.floor(n * prog) + 1), L: P[] = [], R: P[] = [];
  for (let i = 0; i < Math.min(m, n); i++) { const a = c.pts[Math.max(0, i - 1)], b = c.pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = (c.w[i] ?? 0.5) / 2 * (prog < 1 && i === m - 1 ? 0.4 : 1); L.push([c.pts[i][0] - (dy / l) * w, c.pts[i][1] + (dx / l) * w]); R.push([c.pts[i][0] + (dy / l) * w, c.pts[i][1] - (dx / l) * w]); }
  return [...L, ...R.reverse()];
};
export const trace = (path: Path2D, pts: P[]) => { path.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]); path.closePath(); };
const CHUNK = 500;
const cutRange = (ctx: Ctx, env: Env, C: Cut[], from: number, to: number) => {
  ctx.fillStyle = CLAY;
  for (let a = from; a < to; a += CHUNK) {
    const b = Math.min(to, a + CHUNK);
    for (const hi of [0, 1]) {                               // two alpha classes: a fine hair cut is a touch greyer than a bold one
      const pk = `scratch:path:${a}:${b}:${hi}`; let path = env.cache.get(pk) as Path2D | undefined;
      if (!path) { path = new Path2D(); for (let i = a; i < b; i++) if ((C[i].alpha > 0.9 ? 1 : 0) === hi) trace(path, C[i].fill ? C[i].pts : ribbon(C[i])); if (b - a === CHUNK) env.cache.set(pk, path); }
      ctx.globalAlpha = hi ? 0.97 : 0.8; ctx.fill(path);
    }
  }
  ctx.globalAlpha = 1;
};

const layerOf = (env: Env, key: string): Layer => { let L = env.cache.get(key) as Layer | undefined; if (!L) { L = env.canvas(Math.round(env.W * env.scale), Math.round(env.H * env.scale)); env.cache.set(key, L); } return L; };

export const drawScratchboard = (ctx: Ctx, frame: number, env: Env) => {
  const C = buildCuts(env), DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale), f = Math.min(frame, CUES.hold);
  const fk = `scratch:final:${env.scale}`, done = f >= CUES.hold;
  if (done && env.cache.has(fk)) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage((env.cache.get(fk) as Layer).canvas as CanvasImageSource, 0, 0); return; }
  let lo = 0, hi = C.length; while (lo < hi) { const m = (lo + hi) >> 1; if (C[m].t1 <= f) lo = m + 1; else hi = m; }
  const n = done ? C.length : lo;
  // everything already cut sits on a checkpoint layer that is a pure function of its cut count
  const CK = 4000, c = Math.floor(n / CK) * CK;
  const ck = (m: number): Layer => { const key = `scratch:ck:${m}:${env.scale}`; let L = env.cache.get(key) as Layer | undefined; if (L) return L; L = env.canvas(DW, DH); L.ctx.setTransform(1, 0, 0, 1, 0, 0); if (m > CK) L.ctx.drawImage(ck(m - CK).canvas as CanvasImageSource, 0, 0); L.ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); cutRange(L.ctx, env, C, m - CK, m); env.cache.set(key, L); return L; };
  const S = layerOf(env, `scratch:work:${env.scale}`), sc = S.ctx;
  sc.setTransform(1, 0, 0, 1, 0, 0); sc.globalCompositeOperation = "source-over"; sc.globalAlpha = 1; sc.clearRect(0, 0, DW, DH);
  if (c > 0) sc.drawImage(ck(c).canvas as CanvasImageSource, 0, 0);
  sc.setTransform(env.scale, 0, 0, env.scale, 0, 0); cutRange(sc, env, C, c, n);
  if (!done) { sc.fillStyle = CLAY; for (let i = n; i < C.length && C[i].t0 < f; i++) { const p = (f - C[i].t0) / (C[i].t1 - C[i].t0); if (p <= 0 || C[i].fill) continue; const path = new Path2D(); trace(path, ribbon(C[i], p)); sc.globalAlpha = C[i].alpha > 0.9 ? 0.97 : 0.8; sc.fill(path); } sc.globalAlpha = 1; }   // the cuts the knife is in the middle of
  const out = done ? layerOf(env, fk) : null, o = out ? out.ctx : ctx;
  o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.globalCompositeOperation = "source-over"; o.fillStyle = BOARD; o.fillRect(0, 0, DW, DH);
  o.globalAlpha = 0.55; o.drawImage(S.canvas as CanvasImageSource, 0, 0); o.globalAlpha = 1;       // the cut, clean
  new Gfx(sc, env, 0, PENCIL).tooth(S as never, "draftTooth", [0, 0, DW, DH]);        // and the clay chipping at its edges, so a cut is never a vector line
  o.drawImage(S.canvas as CanvasImageSource, 0, 0);
  if (out) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(out.canvas as CanvasImageSource, 0, 0); }
};

export const scratchboard: Film = {
  meta: { title: "Lynx in moonlight · scratchboard", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "scratchboard", start: 0, end: N, draw: drawScratchboard }],
};

export const STYLE = { id: "scratchboard", name: "Scratchboard", family: "ink", medium: "white china clay under black India ink; every mark is ink scraped away with a knife or scratch nib", nearest: "mellan", hero: "a lynx, head and shoulders, in moonlight" };
