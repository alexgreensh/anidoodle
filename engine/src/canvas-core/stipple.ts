import { Gfx, PENCIL, rng, type Ctx, type Env } from "./core";
import type { Film } from "./film";
import { NAUT, shellTone, type Tone } from "./stippleKit";

// NAUTILUS · pen-and-ink stipple. A technical pen (0.25 mm, one size, never changed) touched
// straight down onto hot-press bristol, thousands of times. Nothing is drawn with a line: there
// is no outline, no hatching, no wash. Every tone is the NUMBER of dots in a square centimetre,
// and every edge is only the place where that number changes. The pen is held a little off
// vertical, so each dot is a touch oval and a touch ragged; now and then the nib drags a tail as
// it lifts, and now and then it is running dry and the dot comes up grey.
//
// DISTRIBUTION. Weighted-Voronoi stippling (Secord, NPAR 2002) places dots so that density
// follows tone and no two dots crowd: a blue-noise field whose spacing is ~1.5 px / tone^0.64.
// It is built here as variable-radius Poisson-disk sampling (Bridson) over a 1-px tone raster,
// which gives the same no-clump, density = tone field without a GPU Lloyd loop.
//
// ORDER. The stippler works the darkest masses first (the cast shadow, the deep shadow inside
// the body chamber and each chamber's shaded wall), then walks out into the mid tones, then a
// few sparse passes over the lit nacre last. Each pass moves across the sheet in patches the way
// a hand does, not in a raster.
//
// PAPER. Bright hot-press bristol, a faint tooth. Ink: carbon black, a hair warm.
// LIGHT. One lamp, upper left, ~42 degrees up. It rakes into each cut chamber: the wall nearest
// the lamp throws its shadow across the chamber floor, the far wall is lit, nacre flashes where
// the floor turns to the lamp. The shell throws a cast shadow down-right on the table.
//
// SUBJECT & REFERENCE. Nautilus pompilius shell, sawn in the median plane and laid cut face up
// (the classic sectioned-shell specimen). Structure from knowledge of sectioned shells and
// Raup's coiling model: a logarithmic spiral whose whorl expands ~3x per revolution, involute
// (each whorl sits on the one before), a large body chamber (~1/3 whorl) open at the aperture,
// then ~11 camerae per whorl divided by thin septa that are concave toward the aperture, so in
// section every septum bows back toward the apex; a central siphuncle threads the septa, with
// short septal necks pointing back (adapically). Inner whorls shrink to a dot at the umbilicus.

const N = 450, HOLD = 30;
// THE CUE TABLE. Every frame number of the film. Events on multiples of 5, one shot, the hold last.
const CUES = { first: 0, passesEnd: N - HOLD, hold: N - HOLD } as const;
const PASSES = 6;                                            // key bands: darkest masses ... light nacre
(() => { for (const [k, v] of Object.entries(CUES)) if (v % 5 || v < 0 || v > N) throw new Error(`stipple cue ${k}=${v} off the 5-frame grid`); if (N % 15) throw new Error("stipple: duration off the beat"); })();

const INK = "#15120e", PAPER = "#fbfaf5";
const DOT = 1.22;                                            // the nib's radius in px at 1080: one pen, one size

type Dot = { x: number; y: number; t: number; pass: number; key: number };
type Stip = { dots: Dot[]; shape: Float32Array; alpha: Uint8Array; start: number[] };

// ---------------------------------------------------------------- the dot field (built once, cached)
const build = (env: Env): Stip => {
  const key = `stipple:dots:${env.W}x${env.H}`; let S = env.cache.get(key) as Stip | undefined; if (S) return S;
  const W = env.W, H = env.H, tone: Tone = shellTone(W, H);
  const T = tone.raster, at = (x: number, y: number) => { const i = (y | 0) * W + (x | 0); return x < 0 || y < 0 || x >= W || y >= H ? 0 : T[i]; };
  const MIN_T = 0.022, spacing = (t: number) => 1.5 / Math.pow(Math.max(t, MIN_T), 0.64);
  // variable-radius Poisson disk (Bridson), seeded from a jittered lattice so islands of tone are all reached
  const cell = 1.35, gw = Math.ceil(W / cell), gh = Math.ceil(H / cell), grid = new Int32Array(gw * gh).fill(-1);
  const xs: number[] = [], ys: number[] = [], rs: number[] = [], r = rng(20260925);
  const ok = (x: number, y: number, d: number) => {
    const reach = Math.ceil((d * 1.25) / cell), gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    for (let j = Math.max(0, gy - reach); j <= Math.min(gh - 1, gy + reach); j++) for (let i = Math.max(0, gx - reach); i <= Math.min(gw - 1, gx + reach); i++) {
      const k = grid[j * gw + i]; if (k < 0) continue; const dx = xs[k] - x, dy = ys[k] - y, m = 0.5 * (d + rs[k]); if (dx * dx + dy * dy < m * m) return false;
    }
    return true;
  };
  const add = (x: number, y: number, d: number) => { const k = xs.length; xs.push(x); ys.push(y); rs.push(d); grid[Math.floor(y / cell) * gw + Math.floor(x / cell)] = k; return k; };
  const grow = (k0: number) => {
    const active = [k0];
    while (active.length) {
      const ai = Math.floor(r() * active.length), k = active[ai]; let found = false;
      for (let n = 0; n < 18; n++) {
        const a = r() * Math.PI * 2, d0 = rs[k], rr = d0 * (1 + r()), x = xs[k] + Math.cos(a) * rr, y = ys[k] + Math.sin(a) * rr;
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue; const t = at(x, y); if (t < MIN_T) continue;
        const d = spacing(t); if (!ok(x, y, d)) continue; active.push(add(x, y, d)); found = true;
      }
      if (!found) { active[ai] = active[active.length - 1]; active.pop(); }
    }
  };
  for (let y = 3; y < H; y += 7) for (let x = 3; x < W; x += 7) { const px = x + (r() - 0.5) * 5, py = y + (r() - 0.5) * 5, t = at(px, py); if (t < MIN_T) continue; const d = spacing(t); if (ok(px, py, d)) grow(add(px, py, d)); }

  // ORDER: key = how light the dot's tone is, plus a random rank, so the dark masses go in first
  // and later passes both reach into mid tone and densify what is already dark.
  const PATCH = 84, dots: Dot[] = xs.map((x, i) => { const t = at(x, ys[i]), u = r(); return { x, y: ys[i], t, pass: 0, key: (1 - t) + 0.42 * u }; });
  let lo = 1e9, hi = -1e9; dots.forEach((d) => { lo = Math.min(lo, d.key); hi = Math.max(hi, d.key); });
  dots.forEach((d) => { d.pass = Math.min(PASSES - 1, Math.floor(((d.key - lo) / (hi - lo + 1e-9)) ** 1.25 * PASSES)); });
  // within a pass the hand works patch by patch, top-left to bottom-right in a snake
  const patchOf = (d: Dot) => { const py = Math.floor(d.y / PATCH), px0 = Math.floor(d.x / PATCH), px = py % 2 ? 100 - px0 : px0; return py * 128 + px; };
  dots.sort((a, b) => a.pass - b.pass || patchOf(a) - patchOf(b) || a.key - b.key);
  const start: number[] = []; for (let p = 0, i = 0; p <= PASSES; p++) { while (i < dots.length && dots[i].pass < p) i++; start.push(i); }
  // each dot's shape: a slightly oval, slightly ragged 7-gon, the nib tilted ~35 degrees
  const V = 7, shape = new Float32Array(dots.length * V * 2), alpha = new Uint8Array(dots.length), tilt = -0.62;
  dots.forEach((d, i) => {
    const s = rng(i * 7919 + 17), rad = DOT * (0.9 + s() * 0.24), el = 1.06 + s() * 0.12, ph = s() * 6.283, h2 = s() * 0.1, h3 = s() * 0.08, tail = s() < 0.035;
    alpha[i] = s() < 0.04 ? 150 : 236 + Math.floor(s() * 19);     // a few from a nib running dry
    for (let v = 0; v < V; v++) {
      const a = (v / V) * Math.PI * 2, k = 1 + h2 * Math.sin(2 * a + ph) + h3 * Math.sin(3 * a + ph * 1.7);
      let ex = Math.cos(a) * rad * k * el, ey = Math.sin(a) * rad * k;
      if (tail && v === 0) ex += rad * 1.3;                        // the nib dragged a hair as it lifted
      shape[(i * V + v) * 2] = d.x + ex * Math.cos(tilt) - ey * Math.sin(tilt); shape[(i * V + v) * 2 + 1] = d.y + ex * Math.sin(tilt) + ey * Math.cos(tilt);
    }
  });
  S = { dots, shape, alpha, start }; env.cache.set(key, S);
  return S;
};

// ---------------------------------------------------------------- when each dot goes down
// frames per pass in proportion to its dots; the hand never stops, one pass runs into the next
const schedule = (S: Stip) => {
  const counts = Array.from({ length: PASSES }, (_, p) => S.start[p + 1] - S.start[p]), total = counts.reduce((a, b) => a + b, 0);
  const gap = 0, span = CUES.passesEnd - CUES.first - gap * (PASSES - 1), win: [number, number][] = []; let f = CUES.first;
  counts.forEach((c) => { const len = Math.max(20, Math.round(((span - 20 * PASSES) * c) / total) + 20); win.push([f, f + len]); f += len + gap; });
  const k = (CUES.passesEnd - CUES.first) / (f - gap - CUES.first); return win.map(([a, b]) => [CUES.first + (a - CUES.first) * k, CUES.first + (b - CUES.first) * k] as [number, number]);
};
// how many dots are down at frame f: within a pass the hand starts slow, finds its rhythm, finishes the last patch quicker
const countAt = (S: Stip, f: number): number => {
  if (f >= CUES.hold) return S.dots.length;
  const win = schedule(S); let n = 0;
  win.forEach(([a, b], p) => { const c = S.start[p + 1] - S.start[p], u = Math.max(0, Math.min(1, (f - a) / (b - a))), e = u < 1 ? u * u * (3 - 2 * u) * 0.35 + u * 0.65 : 1; n += Math.floor(c * e); });
  return n;
};

// ---------------------------------------------------------------- the pen
const CHUNK = 600;
const inkDots = (ctx: Ctx, env: Env, S: Stip, n: number) => inkRange(ctx, env, S, 0, n);
const inkRange = (ctx: Ctx, env: Env, S: Stip, from: number, n: number) => {
  // completed chunks are cached as Path2D: the pixels of a chunk depend only on its index
  const V = 7, fillRange = (a: number, b: number, cls: number) => {
    const pk = `stipple:path:${a}:${b}:${cls}`; let path = env.cache.get(pk) as Path2D | undefined;
    if (!path) { path = new Path2D(); for (let i = a; i < b; i++) { if ((S.alpha[i] < 200 ? 1 : 0) !== cls) continue; const o = i * V * 2; path.moveTo(S.shape[o], S.shape[o + 1]); for (let v = 1; v < V; v++) path.lineTo(S.shape[o + v * 2], S.shape[o + v * 2 + 1]); path.closePath(); } if (b - a === CHUNK) env.cache.set(pk, path); }
    ctx.globalAlpha = cls ? 0.6 : 0.95; ctx.fill(path);
  };
  ctx.fillStyle = INK;
  for (let a = from; a < n; a += CHUNK) { const b = Math.min(n, a + CHUNK); fillRange(a, b, 0); fillRange(a, b, 1); }
  ctx.globalAlpha = 1;
};

const sheet = (ctx: Ctx, env: Env) => { ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, env.W, env.H); };
// hot-press bristol: almost no tooth. The core's paper tile, barely there, over dots and sheet alike.
const tooth = (ctx: Ctx, env: Env) => { new Gfx(ctx, env, 0, PENCIL).paper("paper", 0.05); };

export const drawStipple = (ctx: Ctx, frame: number, env: Env) => {
  const S = build(env), n = countAt(S, frame);
  if (n >= S.dots.length) {                                   // the finished plate: one cached bitmap for the hold
    const k = `stipple:final:${env.scale}`; let L = env.cache.get(k) as ReturnType<Env["canvas"]> | undefined;
    if (!L) { L = env.canvas(Math.round(env.W * env.scale), Math.round(env.H * env.scale)); sheet(L.ctx, env); inkDots(L.ctx, env, S, n); tooth(L.ctx, env); env.cache.set(k, L); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.canvas as CanvasImageSource, 0, 0); return;
  }
  // mid-process: the dots already down live on a checkpoint layer (a pure function of its dot
  // count), and only the newest few thousand are filled fresh, so a late frame costs a blit
  const CK = 4800, c = Math.floor(n / CK) * CK, layer = (m: number): ReturnType<Env["canvas"]> => {
    const k = `stipple:ck:${m}:${env.scale}`; let L = env.cache.get(k) as ReturnType<Env["canvas"]> | undefined; if (L) return L;
    L = env.canvas(Math.round(env.W * env.scale), Math.round(env.H * env.scale)); const lc = L.ctx; lc.setTransform(1, 0, 0, 1, 0, 0);
    if (m > CK) lc.drawImage(layer(m - CK).canvas as CanvasImageSource, 0, 0);
    lc.setTransform(env.scale, 0, 0, env.scale, 0, 0); inkRange(lc, env, S, m - CK, m); env.cache.set(k, L); return L;
  };
  sheet(ctx, env);
  if (c > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(layer(c).canvas as CanvasImageSource, 0, 0); ctx.restore(); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); }
  inkRange(ctx, env, S, c, n); tooth(ctx, env);
};

export const stipple: Film = {
  meta: { title: "Nautilus · stipple", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "stipple", start: 0, end: N, draw: drawStipple }],
};

export const STYLE = { id: "stipple", name: "Pen-and-ink stipple", family: "ink", medium: "one 0.25 mm technical pen dotted straight down onto hot-press bristol; tone is dot density only", nearest: "mellan", hero: "a nautilus shell sawn in half, chambers lit from the upper left, cast shadow in dots" };
void NAUT;
