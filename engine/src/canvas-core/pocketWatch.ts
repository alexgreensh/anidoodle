import { Gfx, fractal, rng, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { bounds, clamp, fillShape, hatchRuns, inside, lerp, lerpP, smooth } from "./gallery";

// POCKET WATCH · ballpoint sketch. One blue biro, near-constant line weight, tone built only from
// WHERE the hatch strokes are (single hatch, then cross, then a third direction in the darkest
// places), and the little ink blob a ballpoint leaves where a firm stroke stops.
//
// The watch lies on a table, tipped a little, showing a sliver of its case side. Open face with a
// reeded bezel, a minute track, radial Roman numerals (the watchmaker's IIII, not IV), Breguet
// "moon" hands at ten past ten, a sunk sub-seconds dial at six, the crown, pendant and bow, and a
// curb chain trailing off the page. Light from the upper left; the crystal keeps one clean glare.

const BIRO = "#23379f", PAPER = "#f6f2e6";
const BIRO_M: Medium = { nib: 0.98, taper: 0.12, pressure: 0.1, retrace: true, wobble: 1.15, rough: 0.3 };
const C: P = [468, 590], ROT = -0.2, SQ = 0.93, TH: P = [15, 19], LIGHT: P = [-0.72, -0.69];
const R_CASE = 292, R_BEZ = 256, R_TRACK = 238, R_TRACK2 = 224, R_NUM = 190, SUB: P = [0, 112], R_SUB = 50;

// dial frame -> page: the round watch tipped a little and turned
const W = ([x, y]: P): P => { const yy = y * SQ, c = Math.cos(ROT), s = Math.sin(ROT); return [C[0] + x * c - yy * s, C[1] + x * s + yy * c]; };
const polar = (r: number, a: number): P => [Math.sin(a) * r, -Math.cos(a) * r];           // a = 0 at twelve, clockwise
const ring = (r: number, n = 90, c: P = [0, 0]): P[] => Array.from({ length: n }, (_, i) => W([c[0] + polar(r, (i / n) * Math.PI * 2)[0], c[1] + polar(r, (i / n) * Math.PI * 2)[1]]));

// ---------------------------------------------------------------- the biro
const stroke = (g: Gfx, pts: P[], o: { w?: number; op?: number; seed: number; wob?: number; blob?: boolean; retrace?: boolean }) => {
  const { w = 1.1, op = 0.86, seed, wob = 0.35, blob = false, retrace = false } = o;
  g.pen(pts, { w, color: BIRO, seed, wobble: wob, boil: 0, taper: 1, opacity: op, retrace });
  if (blob) { // a firm stroke leaves a bead of ink where the ball stops, a smaller one where it started
    const e = pts[pts.length - 1], s0 = pts[0], c = g.cur, r = rng(seed * 7);
    g.touch(e[0] - 4, e[1] - 4, e[0] + 4, e[1] + 4); g.touch(s0[0] - 3, s0[1] - 3, s0[0] + 3, s0[1] + 3);
    c.fillStyle = BIRO; c.globalAlpha = 0.8; c.beginPath(); c.arc(e[0] + (r() - 0.5), e[1] + (r() - 0.5), 1.2 + r() * 0.8, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.5; c.beginPath(); c.arc(s0[0], s0[1], 0.8 + r() * 0.5, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
  }
};
// hatching: tone lives in where strokes are. Runs are cut into hand-length strokes with a flick.
const hatch = (g: Gfx, region: P[], angle: number, gap: number, keep: (x: number, y: number) => boolean, seed: number, op = 0.62) => {
  const b = bounds(region), r = rng(seed);
  hatchRuns(b, angle, gap, (x, y) => inside(region, x, y) && keep(x, y), 2.5, seed).forEach((run, k) => {
    let i = 0;
    while (i < run.length - 1) {
      const n = Math.min(run.length - 1 - i, 8 + Math.floor(r() * 22)), seg = run.slice(i, i + n + 1);
      if (seg.length > 1) { const a = seg[0], z = seg[seg.length - 1], m = lerpP(a, z, 0.5), bow = (r() - 0.5) * 1.6; stroke(g, [a, [m[0] + bow, m[1] - bow], z], { w: 0.82, op: op * (0.75 + r() * 0.35), seed: seed * 1000 + k * 37 + i, wob: 0.25 }); }
      i += n + (r() < 0.25 ? 1 : 0);
    }
  });
};

// ---------------------------------------------------------------- tone (0 = dark, 1 = paper)
const lit = (nx: number, ny: number) => clamp((nx * LIGHT[0] + ny * LIGHT[1]) * 0.5 + 0.5);
const ragged = (x: number, y: number, k: number) => (fractal(5, x, y, 0.035, 0.035, 2) - 0.5) * k;   // a hand stops its hatching at a slightly different place every stroke
const bezelTone = (x: number, y: number) => { const dx = x - C[0], dy = y - C[1], l = Math.hypot(dx, dy) || 1; return 0.18 + 0.82 * Math.pow(lit(dx / l, dy / l), 1.6) + ragged(x, y, 0.16); };
const dialTone = (x: number, y: number) => {
  const dx = x - C[0], dy = y - C[1], l = Math.hypot(dx, dy) || 1, edge = clamp((l - R_BEZ * 0.72) / (R_BEZ * 0.26));
  const bezelShadow = edge * clamp(-(dx / l) * LIGHT[0] * -1 - (dy / l) * LIGHT[1] * -1) * 0.55;      // the bezel shades the dial on the side toward the light
  const glassBand = clamp(((dx + dy) / Math.SQRT2 + 40) / 260) * 0.2;                             // the crystal darkens a touch away from the light
  const glare = Math.exp(-Math.pow((dx + 110) / 60, 2) - Math.pow((dy + 120) / 34, 2));
  return clamp(0.98 - bezelShadow - glassBand + glare + ragged(x, y, 0.14));
};

// ---------------------------------------------------------------- dial furniture
const numeral = (g: Gfx, txt: string, a: number, h: number, seed: number) => {
  // Roman numerals built from strokes, oriented radially (feet toward the centre), with serifs;
  // the thick stroke of each letter is laid down twice, the way a biro builds weight
  const glyphs: Record<string, { w: number; strokes: [P, P, boolean][] }> = {
    I: { w: 0.22, strokes: [[[0, -0.5], [0, 0.5], true]] },
    V: { w: 0.62, strokes: [[[-0.31, -0.5], [0, 0.5], true], [[0.31, -0.5], [0, 0.5], false]] },
    X: { w: 0.62, strokes: [[[-0.31, -0.5], [0.31, 0.5], true], [[0.31, -0.5], [-0.31, 0.5], false]] },
  };
  const gap = 0.1, total = [...txt].reduce((a2, ch) => a2 + glyphs[ch].w, 0) + gap * (txt.length - 1);
  const base = polar(R_NUM, a), up: P = [Math.sin(a), -Math.cos(a)], side: P = [Math.cos(a), Math.sin(a)];
  const at = (u: number, v: number): P => W([base[0] + side[0] * u * h - up[0] * v * h, base[1] + side[1] * u * h - up[1] * v * h]);
  let x = -total / 2, k = 0;
  for (const ch of txt) {
    const gl = glyphs[ch], cx = x + gl.w / 2;
    gl.strokes.forEach(([p, q, thick]) => {
      const A = at(cx + p[0], p[1]), B = at(cx + q[0], q[1]);
      stroke(g, [A, lerpP(A, B, 0.5), B], { w: 1.05, op: 0.92, seed: seed + k++, wob: 0.15 });
      if (thick) { const o = 0.035; stroke(g, [at(cx + p[0] + o, p[1]), at(cx + (p[0] + q[0]) / 2 + o, 0), at(cx + q[0] + o, q[1])], { w: 1.05, op: 0.9, seed: seed + k++, wob: 0.15 }); }
    });
    [-0.5, 0.5].forEach((v) => { const sx = gl.w / 2 + 0.07; stroke(g, [at(cx - sx, v), at(cx + sx, v)], { w: 0.9, op: 0.85, seed: seed + k++, wob: 0.1 }); });
    x += gl.w + gap;
  }
};

const breguet = (g: Gfx, a: number, len: number, moonR: number, moonAt: number, width: number, seed: number, alpha = 1, off: P = [0, 0]) => {
  // a Breguet hand: a slender tapering blade, a hollow "moon" ring near the tip, a needle point
  const d: P = [Math.sin(a), -Math.cos(a)], n: P = [Math.cos(a), Math.sin(a)], p = (t: number, s: number): P => { const q = W([d[0] * t + n[0] * s, d[1] * t + n[1] * s]); return [q[0] + off[0], q[1] + off[1]]; };
  const tail = -len * 0.18, m = len * moonAt;
  const blade = [p(tail, width * 1.1), p(0, width), p(m - moonR * 1.1, width * 0.55), p(m - moonR * 1.1, -width * 0.55), p(0, -width), p(tail, -width * 1.1)];
  fillShape(g, blade, BIRO, 0.9 * alpha);
  const moon: P[] = [], hole: P[] = [];
  for (let i = 0; i < 28; i++) { const t = (i / 28) * Math.PI * 2; moon.push(p(m + Math.cos(t) * moonR, Math.sin(t) * moonR)); hole.push(p(m + moonR * 0.12 + Math.cos(t) * moonR * 0.56, Math.sin(t) * moonR * 0.56)); }
  const c = g.cur, bb = bounds(moon); g.touch(bb.x0 - 2, bb.y0 - 2, bb.x1 + 2, bb.y1 + 2);
  c.fillStyle = BIRO; c.globalAlpha = 0.9 * alpha; c.beginPath(); moon.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); hole.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill("evenodd"); c.globalAlpha = 1;
  fillShape(g, [p(m + moonR * 0.9, width * 0.5), p(len, 0.4), p(m + moonR * 0.9, -width * 0.5)], BIRO, 0.9 * alpha);
  if (alpha < 1) return;
  stroke(g, [p(tail, 0), p(len * 0.5, 0), p(len, 0)], { w: 0.9, op: 0.5, seed, wob: 0.1 });
  stroke(g, [p(m + moonR * 0.95, 0), p(len, 0)], { w: 0.8, op: 0.9, seed: seed + 1, wob: 0.05, blob: true });
};

// ---------------------------------------------------------------- the chain
const chain = (g: Gfx, start: P, seed: number) => {
  // curb chain lying on the table: links alternate face-on (a ring) and edge-on (a short bar)
  const path = smooth([start, [start[0] + 60, start[1] - 96], [start[0] + 190, start[1] - 150], [start[0] + 330, start[1] - 112], [start[0] + 430, start[1] - 20], [start[0] + 520, start[1] + 120], [1120, start[1] + 190]], false, 20);
  const r = rng(seed);
  let d = 0; const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const atD = (s: number): [P, P] => { let i = 1; while (i < path.length - 1 && cum[i] < s) i++; const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), p = lerpP(path[i - 1], path[i], clamp(f)), dx = path[i][0] - path[i - 1][0], dy = path[i][1] - path[i - 1][1], l = Math.hypot(dx, dy) || 1; return [p, [dx / l, dy / l]]; };
  let k = 0;
  while (d < cum[cum.length - 1] - 20) {
    const [p, t] = atD(d + 13), n: P = [-t[1], t[0]], face = k % 2 === 0, L = 17, Wd = face ? 10.5 : 4.2;
    const o: P[] = [], iN: P[] = [];
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; o.push([p[0] + t[0] * Math.cos(a) * L + n[0] * Math.sin(a) * Wd, p[1] + t[1] * Math.cos(a) * L + n[1] * Math.sin(a) * Wd]); iN.push([p[0] + t[0] * Math.cos(a) * L * 0.6 + n[0] * Math.sin(a) * Wd * 0.34, p[1] + t[1] * Math.cos(a) * L * 0.6 + n[1] * Math.sin(a) * Wd * 0.34]); }
    // its shadow on the table, down and right
    hatch(g, o.map(([x, y]) => [x + 5, y + 7] as P), -0.95, 2.6, () => true, seed + k * 3, 0.5);
    fillShape(g, o, PAPER);
    if (face) fillShape(g, iN, PAPER);
    hatch(g, o, 0.6, 2.8, (x, y) => ((x - p[0]) * LIGHT[0] + (y - p[1]) * LIGHT[1]) < -1 && !(face && inside(iN, x, y)), seed + k * 3 + 1, 0.72);
    stroke(g, [...o.slice(0, 13)], { w: 1.05, op: 0.9, seed: seed + k * 5 + 2, wob: 0.2, retrace: true });
    stroke(g, [...o.slice(12), o[0]], { w: 1.05, op: 0.9, seed: seed + k * 5 + 3, wob: 0.2, retrace: true, blob: r() < 0.5 });
    if (face) stroke(g, [...iN, iN[0]], { w: 0.95, op: 0.85, seed: seed + k * 5 + 4, wob: 0.15 });
    d += face ? 27 : 23; k++;
  }
};

export const drawPocketWatch = (ctx: Ctx, _frame: number, env: Env) => {
  const g = new Gfx(ctx, env, 0, BIRO_M);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 1080, 1080);
  const caseF = ring(R_CASE, 120), caseB = caseF.map(([x, y]) => [x + TH[0], y + TH[1]] as P);

  g.group("plain", () => {
    // construction first, the way the sketch was started: centre lines and a looser ellipse
    stroke(g, [W([-340, 0]), W([0, 0]), W([340, 0])], { w: 0.8, op: 0.16, seed: 1, wob: 0.6 });
    stroke(g, [W([0, -400]), W([0, 0]), W([0, 340])], { w: 0.8, op: 0.16, seed: 2, wob: 0.6 });
    stroke(g, ring(R_CASE + 14, 40).map(([x, y]) => [x - 4, y + 3] as P), { w: 0.8, op: 0.13, seed: 3, wob: 1.2 });

    // the watch's shadow on the table: cross-hatched, heaviest where the case touches down
    const shadow = ring(R_CASE, 90).map(([x, y]) => [x + 46, y + 40] as P);
    const sd = (x: number, y: number) => Math.hypot(x - C[0] - 46, y - C[1] - 40) / R_CASE;
    hatch(g, shadow, -0.95, 4.6, () => true, 101, 0.55);
    hatch(g, shadow, 0.55, 4.8, (x, y) => sd(x, y) < 0.97 && (x - C[0]) + (y - C[1]) > 60, 102, 0.5);
    chain(g, W([10, -R_CASE - 108]), 300);

    // the case side, a sliver of cylinder: short strokes that follow its curve, dense in the shade
    fillShape(g, caseB, PAPER); fillShape(g, caseF, PAPER);
    const band: P[] = [...caseF, ...caseB.slice().reverse()];
    void band;
    for (let i = 0; i < 240; i++) {
      const a = (i / 240) * Math.PI * 2, f = W(polar(R_CASE, a)), b2: P = [f[0] + TH[0], f[1] + TH[1]], dx = f[0] - C[0], dy = f[1] - C[1], l = Math.hypot(dx, dy);
      const facing = (dx / l) * TH[0] + (dy / l) * TH[1];
      if (facing < 4) continue;                                          // only the side turned toward us shows its band
      const shade = 1 - bezelTone(f[0], f[1]);
      if (i % (shade > 0.55 ? 1 : shade > 0.3 ? 2 : 4)) continue;
      stroke(g, [lerpP(f, b2, 0.05), lerpP(f, b2, 1.02)], { w: 0.85, op: 0.55 + shade * 0.35, seed: 400 + i, wob: 0.1 });
    }
    { const n = caseB.length, vis = (i: number) => { const f = caseF[i], dx = f[0] - C[0], dy = f[1] - C[1], l = Math.hypot(dx, dy); return (dx / l) * TH[0] + (dy / l) * TH[1] > 2; };
      let s0 = 0; while (vis(s0) || !vis((s0 + 1) % n)) s0 = (s0 + 1) % n;            // the first index where the visible arc begins
      const arc: P[] = []; for (let k = 1; k <= n && vis((s0 + k) % n); k++) arc.push(caseB[(s0 + k) % n]);
      stroke(g, arc, { w: 1.15, op: 0.9, seed: 410, wob: 0.3, retrace: true, blob: true }); }

    // the bezel: reeded outer edge, cylinder tone laid in as hatching along the ring
    const bez: P[] = [...caseF, caseF[0], ...ring(R_BEZ, 120).reverse(), ring(R_BEZ, 120)[119]];
    const bezIn = ring(R_BEZ, 60);
    const inBez = (x: number, y: number) => { const q = Math.hypot((x - C[0]), (y - C[1])); return q > R_BEZ * 0.93 && q < R_CASE * 1.0; };
    hatch(g, caseF, -0.9, 3.6, (x, y) => inBez(x, y) && !inside(bezIn, x, y) && bezelTone(x, y) < 0.72, 111, 0.66);
    hatch(g, caseF, 0.62, 3.8, (x, y) => inBez(x, y) && !inside(bezIn, x, y) && bezelTone(x, y) < 0.42, 112, 0.62);
    hatch(g, caseF, 0.05, 4.0, (x, y) => inBez(x, y) && !inside(bezIn, x, y) && bezelTone(x, y) < 0.24, 113, 0.6);
    void bez;
    for (let i = 0; i < 180; i++) { const a = (i / 180) * Math.PI * 2, p0 = W(polar(R_CASE, a)), p1 = W(polar(R_CASE - 11, a)); stroke(g, [p0, p1], { w: 0.75, op: 0.35 + 0.5 * (1 - bezelTone(p0[0], p0[1])), seed: 500 + i, wob: 0.05 }); }
    stroke(g, caseF.slice(0, 61), { w: 1.25, op: 0.9, seed: 510, wob: 0.3, retrace: true, blob: true });
    stroke(g, [...caseF.slice(60), caseF[0], caseF[1]], { w: 1.25, op: 0.9, seed: 511, wob: 0.3, retrace: true, blob: true });
    stroke(g, [...ring(R_CASE - 12, 100), ring(R_CASE - 12, 100)[0]], { w: 0.8, op: 0.55, seed: 512, wob: 0.2 });
    stroke(g, [...ring(R_BEZ, 110), ring(R_BEZ, 110)[0], ring(R_BEZ, 110)[1]], { w: 1.15, op: 0.9, seed: 513, wob: 0.2, retrace: true });

    // the dial: paper, a soft bezel shadow and a crystal reflection in single hatching, one glare left bare
    const dial = ring(R_BEZ, 110);
    hatch(g, dial, -0.9, 4.4, (x, y) => dialTone(x, y) < 0.86, 121, 0.5);
    hatch(g, dial, 0.6, 4.6, (x, y) => dialTone(x, y) < 0.62, 122, 0.5);
    [R_TRACK, R_TRACK2].forEach((rr, k) => stroke(g, [...ring(rr, 110), ring(rr, 110)[0], ring(rr, 110)[1]], { w: 0.95, op: 0.88, seed: 130 + k, wob: 0.15 }));
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, five = i % 5 === 0; stroke(g, [W(polar(R_TRACK - 1, a)), W(polar(five ? R_TRACK2 - 6 : R_TRACK2 + 1, a))], { w: five ? 1.3 : 0.85, op: 0.9, seed: 140 + i, wob: 0.04 }); }
    const labels = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
    labels.forEach((t, i) => { if (i === 6) return; numeral(g, t, (i / 12) * Math.PI * 2, 34, 1000 + i * 20); });  // six is taken by the seconds dial
    // sub-seconds, sunk into the dial: a shadowed step on its upper-left rim
    const sub = ring(R_SUB, 70, SUB);
    hatch(g, sub, 0.6, 3.4, (x, y) => { const c0 = W(SUB), dx = x - c0[0], dy = y - c0[1], l = Math.hypot(dx, dy) || 1; return l > R_SUB * 0.72 && (dx / l) * LIGHT[0] + (dy / l) * LIGHT[1] > 0.1; }, 150, 0.7);
    stroke(g, [...sub, sub[0], sub[1]], { w: 1.05, op: 0.9, seed: 151, wob: 0.12, retrace: true });
    stroke(g, [...ring(R_SUB - 9, 60, SUB), ring(R_SUB - 9, 60, SUB)[0]], { w: 0.75, op: 0.7, seed: 152, wob: 0.1 });
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, c0 = SUB, p0 = polar(R_SUB - 1, a), p1 = polar(i % 5 ? R_SUB - 6 : R_SUB - 10, a); stroke(g, [W([c0[0] + p0[0], c0[1] + p0[1]]), W([c0[0] + p1[0], c0[1] + p1[1]])], { w: i % 5 ? 0.6 : 0.9, op: 0.85, seed: 160 + i, wob: 0.02 }); }
    const sa = 2.35, s0 = W(SUB), s1 = W([SUB[0] + polar(R_SUB - 8, sa)[0], SUB[1] + polar(R_SUB - 8, sa)[1]]), s2 = W([SUB[0] - polar(12, sa)[0], SUB[1] - polar(12, sa)[1]]);
    stroke(g, [s2, s0, s1], { w: 1.0, op: 0.95, seed: 170, wob: 0.03, blob: true });
    fillShape(g, ring(3, 12, SUB), BIRO, 0.9);

    // the hands at ten past ten, each throwing a hair of shadow onto the dial
    const hourA = (10 + 8 / 60) / 12 * Math.PI * 2, minA = (8 / 60) * Math.PI * 2;
    breguet(g, hourA, 138, 15, 0.7, 5.2, 180, 0.16, [5, 6]); breguet(g, minA, 206, 13, 0.76, 4.2, 190, 0.16, [6, 7]);
    breguet(g, hourA, 138, 15, 0.7, 5.2, 180);
    breguet(g, minA, 206, 13, 0.76, 4.2, 190);
    fillShape(g, ring(11, 16), BIRO, 0.95); fillShape(g, ring(4.5, 12), PAPER); fillShape(g, ring(2, 8), BIRO, 0.9);

    // pendant, crown and bow at twelve
    const pend = [W([-24, -R_CASE + 6]), W([-17, -R_CASE - 26]), W([17, -R_CASE - 26]), W([24, -R_CASE + 6])];
    fillShape(g, pend, PAPER);
    hatch(g, pend, 0.6, 3, (x, y) => (x - W([0, -R_CASE - 10])[0]) > -4, 200, 0.7);
    stroke(g, [pend[0], pend[1], pend[2], pend[3]], { w: 1.1, op: 0.92, seed: 201, wob: 0.15, retrace: true });
    const crown: P[] = [W([-21, -R_CASE - 26]), W([-21, -R_CASE - 64]), W([21, -R_CASE - 64]), W([21, -R_CASE - 26])];
    fillShape(g, crown, PAPER);
    for (let i = -18; i <= 18; i += 3.2) stroke(g, [W([i, -R_CASE - 28]), W([i, -R_CASE - 62])], { w: 0.8, op: i > 2 ? 0.9 : 0.55, seed: 210 + Math.round(i * 10), wob: 0.05 });  // the knurling
    stroke(g, [...crown, crown[0]], { w: 1.15, op: 0.92, seed: 220, wob: 0.12, retrace: true });
    const bowC: P = [0, -R_CASE - 78], bowO = ring(52, 70, bowC).filter((_, i) => i < 30 || i > 40), bowI = ring(41, 70, bowC).filter((_, i) => i < 30 || i > 40);
    hatch(g, [...ring(52, 70, bowC), ...ring(41, 70, bowC).reverse()], -0.9, 3, (x, y) => { const c0 = W(bowC); return (x - c0[0]) + (y - c0[1]) > -6; }, 230, 0.7);
    stroke(g, bowO, { w: 1.2, op: 0.92, seed: 231, wob: 0.2, retrace: true, blob: true });
    stroke(g, bowI, { w: 1.05, op: 0.85, seed: 232, wob: 0.2, retrace: true });
  });
  g.paper("paper", 0.07);
};

export const pocketWatch: Film = {
  meta: { title: "Pocket watch · ballpoint sketch", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "pocketWatch", start: 0, end: 1, draw: drawPocketWatch }],
};
void lerp;
