import { Gfx, rng, tube, type Medium, type P } from "./core";
import type { Film } from "./film";
import { blob, bounds, clamp, clipped, fillShape, lerpP, mix, smooth } from "./gallery";
import { drawWren } from "./wren";
import { fit, runProcess, timeline, type Op, type Proc } from "./sumiEKit";

// WREN ON A TWIG · drawing itself. The ink & line-wash plate (wren.ts) made the way a line-wash
// painter makes it: ALL the washes first, then the pen over them, then the spatter.
//
// A wash is laid as a bead: the loaded brush touches the top of the shape and the bead of wet
// paint is pulled DOWN it, a darker line of pigment riding the wet front; once the shape is
// covered the pigment settles and pools along the bottom edge; where a second, wetter drop
// touched the damp body it pushes a backrun outward, its pale middle growing and its crinkled
// dark rim riding the edge. Then the flexible nib: each line grows along its path, thick where it
// pressed, hair-thin where it lifted, contours left open. Last, the pen is shaken and spatters.
//
// wren.ts is NOT modified: its plate functions are private and its hero md5 must not move. This
// file re-authors the same geometry as timed marks, in the line-wash order. Because that order
// composites the bird's washes before the twig's ink (the still does the twig whole, then the
// bird), the finished process differs from the still by a few overlap pixels; the last 30
// frames are therefore drawWren itself, the still byte for byte.

const INK_M: Medium = { nib: 1.7, taper: 1, pressure: 1.75, retrace: false, wobble: 1.35, rough: 0.6 };
const INK = "#16131f", PAPER = "#fbf8f0";
const BROWN = "#a0693a", DARKB = "#5e3a20", BUFF = "#e6c794", RUFOUS = "#b8733a", UMBER = "#6e4a2c", SAP = "#6f8f3e", HAW = "#c3262d";
const N = 540;

// ---------------------------------------------------------------- wet media, with a clock
// p = 1 is wren's wash exactly. Below 1: the bead travels down (spread), the pigment settles to
// the bottom edge (settle), and the backrun opens (bloom), in that overlapping order.
type WetO = { alpha: number; seed: number; pool?: number; bloom?: P | null; bloomR?: number };
const wetBody = (g: Gfx, pts: P[], color: string, o: WetO, settle: number, bloomK: number) => {
  const { alpha, seed, pool = 0.55, bloom = null, bloomR = 22 } = o, b = bounds(pts);
  g.wash(pts, color, { alpha, seed, dx: 7, dy: 6, shrink: 1.07, rim: true });
  if (settle > 0) clipped(g, pts, () => {
    const c = g.cur, top = 0.45 + 0.35 * (1 - settle), gr = c.createLinearGradient(0, b.y0 + (b.y1 - b.y0) * top, 0, b.y1 + 2), a = alpha * pool * settle;
    gr.addColorStop(0, color + "00"); gr.addColorStop(0.75, color + Math.round(255 * a * 0.6).toString(16).padStart(2, "0")); gr.addColorStop(1, color + Math.round(255 * clamp(a * 1.3)).toString(16).padStart(2, "0"));
    c.fillStyle = gr; c.fillRect(b.x0 - 20, b.y0, b.x1 - b.x0 + 40, b.y1 - b.y0 + 20);
  });
  if (bloom && bloomK > 0) {
    const k = Math.sqrt(bloomK), bl0 = blob(bloom[0], bloom[1], bloomR, bloomR * 0.8, seed + 7, 0.32, 18), bl = bl0.map(([x, y]) => [bloom[0] + (x - bloom[0]) * k, bloom[1] + (y - bloom[1]) * k] as P);
    fillShape(g, bl, PAPER, 0.42);
    const c = g.cur; c.strokeStyle = mix(color, INK, 0.25); c.globalAlpha = alpha * 0.9; c.lineWidth = 1.6; c.beginPath(); bl.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke(); c.globalAlpha = 1;
  }
};
// wren's own wet(), byte for byte, for a finished wash
const wetFull = (g: Gfx, pts: P[], color: string, o: WetO) => {
  const { alpha, seed, pool = 0.55, bloom = null, bloomR = 22 } = o, b = bounds(pts);
  g.group("paint", () => {
    g.wash(pts, color, { alpha, seed, dx: 7, dy: 6, shrink: 1.07, rim: true });
    clipped(g, pts, () => {
      const c = g.cur, gr = c.createLinearGradient(0, b.y0 + (b.y1 - b.y0) * 0.45, 0, b.y1 + 2);
      gr.addColorStop(0, color + "00"); gr.addColorStop(0.75, color + Math.round(255 * alpha * pool * 0.6).toString(16).padStart(2, "0")); gr.addColorStop(1, color + Math.round(255 * clamp(alpha * pool * 1.3)).toString(16).padStart(2, "0"));
      c.fillStyle = gr; c.fillRect(b.x0 - 20, b.y0, b.x1 - b.x0 + 40, b.y1 - b.y0 + 20);
    });
    if (bloom) {
      const bl = blob(bloom[0], bloom[1], bloomR, bloomR * 0.8, seed + 7, 0.32, 18);
      fillShape(g, bl, PAPER, 0.42);
      const c = g.cur; c.strokeStyle = mix(color, INK, 0.25); c.globalAlpha = alpha * 0.9; c.lineWidth = 1.6; c.beginPath(); bl.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke(); c.globalAlpha = 1;
    }
  });
};
// the travelling bead: everything above a wobbling front is wet; the front itself carries a
// darker line of pigment
const beadFront = (b: { x0: number; y0: number; x1: number; y1: number }, t: number, seed: number): P[] => { const y = b.y0 - 14 + (b.y1 - b.y0 + 40) * t, out: P[] = []; for (let x = b.x0 - 30; x <= b.x1 + 30; x += 8) out.push([x, y + 5 * Math.sin(x * 0.045 + seed) + 3 * Math.sin(x * 0.13 + seed * 2)]); return out; };
const wetOp = (pts: P[], color: string, o: WetO) => (g: Gfx, p: number) => {
  if (p >= 1) return wetFull(g, pts, color, o);
  const spread = clamp(p / 0.55), settle = clamp((p - 0.4) / 0.45), bloomK = clamp((p - 0.7) / 0.3), b = bounds(pts);
  g.group("paint", () => {
    const c = g.cur, front = beadFront(b, spread, o.seed);
    c.save(); c.beginPath(); c.moveTo(b.x0 - 40, b.y0 - 60); c.lineTo(b.x1 + 40, b.y0 - 60); for (let i = front.length - 1; i >= 0; i--) c.lineTo(front[i][0], front[i][1]); c.closePath(); c.clip();
    wetBody(g, pts, color, o, settle, bloomK);
    c.restore();
    if (spread < 1) clipped(g, pts, () => { c.strokeStyle = color; c.globalAlpha = o.alpha * 0.55; c.lineWidth = 3.2; c.lineJoin = "round"; c.beginPath(); front.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.globalAlpha = 1; });
  });
};
const bgOp = (g: Gfx, p: number) => {
  // one loose wash behind the bird, cool, with a warm drop let into it lower down while it was
  // wet: laid top to bottom as one bead across the sheet
  const draw = () => {
    g.wash(blob(560, 500, 330, 250, 10, 0.3, 22, -0.35), "#9fb3c8", { alpha: 0.28, seed: 10, dx: 0, dy: 6, shrink: 1 });
    g.wash(blob(440, 700, 230, 120, 11, 0.35, 18, -0.2), "#d8b98a", { alpha: 0.25, seed: 11, dx: 0, dy: 4, shrink: 1 });
    g.wash(blob(700, 330, 120, 90, 12, 0.35, 16, 0.3), "#b8c7d6", { alpha: 0.22, seed: 12, dx: 0, dy: 4, shrink: 1 });
  };
  g.group("paint", () => {
    if (p >= 1) return draw();
    const c = g.cur, front = beadFront({ x0: 180, y0: 200, x1: 950, y1: 850 }, p, 3);
    c.save(); c.beginPath(); c.moveTo(-50, -50); c.lineTo(1130, -50); for (let i = front.length - 1; i >= 0; i--) c.lineTo(front[i][0], front[i][1]); c.closePath(); c.clip(); draw(); c.restore();
  });
};
// the pen: one loose stroke, growing along its path
const penOp = (pts: P[], w: number, seed: number, op = 0.95, wob = 0.9) => (g: Gfx, p: number) => g.group("plain", () => g.pen(pts, { w, color: INK, seed, wobble: wob, boil: 0, taper: 1, opacity: op, retrace: false, progress: p }));
const dabOp = (pts: P[], color: string, alpha = 1) => (g: Gfx, p: number) => { if (p > 0) g.group("plain", () => fillShape(g, pts, color, alpha)); };

// ---------------------------------------------------------------- the geometry (wren.ts, verbatim)
const twigLine: P[] = [[40, 806], [250, 752], [470, 712], [640, 690], [820, 652], [1080, 594]];
const side: P[] = [[792, 658], [846, 604], [884, 540], [930, 506]];
const lower: P[] = [[268, 748], [236, 806], [214, 868]];
const BODY: P[] = [[394, 450], [428, 416], [482, 420], [560, 448], [614, 494], [620, 536], [606, 582], [578, 624], [528, 650], [468, 634], [418, 590], [396, 540], [390, 492]];
const TAIL: P[] = [[590, 506], [606, 468], [626, 418], [646, 368], [662, 330], [690, 336], [684, 382], [664, 434], [644, 486], [622, 528]];
const WING: P[] = [[472, 476], [530, 468], [584, 500], [620, 552], [610, 584], [566, 598], [516, 580], [484, 540]];
const BELLY: P[] = [[410, 560], [452, 604], [506, 630], [560, 624], [548, 596], [488, 580], [440, 548]];
const leafOf = (base: P, ang: number, len: number, seed: number) => {
  const r = rng(seed), d: P = [Math.cos(ang), Math.sin(ang)], n: P = [-d[1], d[0]], at = (t: number, s: number): P => [base[0] + d[0] * t * len + n[0] * s * len, base[1] + d[1] * t * len + n[1] * s * len];
  const edge = [at(0, 0), at(0.2, 0.14), at(0.38, 0.3), at(0.5, 0.22), at(0.62, 0.34), at(0.78, 0.2), at(1, 0.02), at(0.8, -0.2), at(0.64, -0.3), at(0.5, -0.2), at(0.35, -0.28), at(0.18, -0.13)];
  const shape = smooth(edge, true, 5), color = mix(SAP, "#3f6c5e", r() * 0.4);
  return { shape, color, seed, mid: [at(0, 0), at(0.55, 0.01 * (r() - 0.5)), at(0.95, 0)] as P[], veins: [0.3, 0.5, 0.7].map((t, k) => [at(t, 0), at(t + 0.12, (k % 2 ? 1 : -1) * 0.22)] as P[]) };
};
const LEAVES = [leafOf([884, 540], -1.9, 96, 40), leafOf([860, 580], -0.25, 110, 41), leafOf([930, 506], -0.75, 88, 42), leafOf([1010, 612], -1.1, 80, 43), leafOf([236, 800], 2.2, 84, 44)];
const HAWS: P[] = [[318, 772], [344, 786], [300, 796], [330, 810], [356, 812], [312, 822]];

// ---------------------------------------------------------------- the process
const build = (k: number): Proc => {
  const tl = timeline(8, k, true), A = (d: number, fn: Op["draw"]) => tl.add(d, fn);
  // 1. washes: background, then the twig, its leaves and haws, then the bird, light to dark
  A(40, bgOp); tl.wait(10);
  A(18, wetOp(tube(twigLine, 17, 6, true), UMBER, { alpha: 0.62, seed: 30, pool: 0.8 })); A(9, wetOp(tube(side, 7, 3, true), UMBER, { alpha: 0.55, seed: 31 })); A(8, wetOp(tube(lower, 7, 3, true), UMBER, { alpha: 0.55, seed: 32 }));
  LEAVES.forEach((l) => A(8, wetOp(l.shape, l.color, { alpha: 0.6, seed: l.seed, pool: 0.7 })));
  HAWS.forEach(([x, y], i) => A(4, wetOp(blob(x, y, 12, 12.5, 60 + i, 0.06, 12), HAW, { alpha: 0.85, seed: 60 + i, pool: 0.9 })));
  A(4, (g, p) => { if (p > 0) g.group("plain", () => HAWS.forEach(([x, y], i) => fillShape(g, blob(x - 4, y - 5, 3.4, 2.6, 70 + i, 0.1, 8), PAPER, 0.9))); }); // highlights lifted out with a damp brush
  tl.wait(8);
  A(14, wetOp(smooth(TAIL, true, 8), UMBER, { alpha: 0.62, seed: 200, pool: 0.4 }));
  A(22, wetOp(smooth(BODY, true, 8), BROWN, { alpha: 0.55, seed: 201, pool: 0.75, bloom: [548, 470], bloomR: 20 }));
  A(12, wetOp(smooth(BELLY, true, 8), BUFF, { alpha: 0.5, seed: 202, pool: 0.3 }));
  A(10, wetOp(blob(520, 460, 70, 26, 203, 0.2, 12, 0.35), RUFOUS, { alpha: 0.35, seed: 204, pool: 0.2 }));
  A(14, wetOp(smooth(WING, true, 8), DARKB, { alpha: 0.45, seed: 205, pool: 0.6 }));
  A(3, dabOp(smooth([[398, 446], [430, 436], [470, 440], [494, 452], [470, 450], [432, 448], [402, 456]], true, 6), mix(BUFF, PAPER, 0.5), 0.9));
  A(8, wetOp(smooth([[398, 462], [428, 454], [466, 460], [490, 474], [462, 472], [428, 470], [400, 472]], true, 6), DARKB, { alpha: 0.55, seed: 206, pool: 0.2 }));
  tl.wait(14);
  // 2. the pen over the washes: the bird first (the focal thing), contour open where the light eats it
  const pen = (pts: P[], w: number, seed: number, op = 0.95, wob = 0.9, d?: number) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); A(d ?? Math.max(1.6, 1.2 + L / 70), penOp(pts, w, seed, op, wob)); };
  const b = smooth(BODY, true, 6), n = b.length;
  pen(b.slice(Math.round(n * 0.0), Math.round(n * 0.2)), 2.4, 300, 0.9); pen(b.slice(Math.round(n * 0.25), Math.round(n * 0.4)), 2.2, 301, 0.8);
  pen(b.slice(Math.round(n * 0.44), Math.round(n * 0.78)), 4.6, 302, 0.96); pen(b.slice(Math.round(n * 0.52), Math.round(n * 0.72)).map(([x, y]) => [x + 3, y + 4] as P), 2.2, 304, 0.55, 1.6);
  pen(b.slice(Math.round(n * 0.76), Math.round(n * 0.99)), 3.6, 303, 0.95);
  // the bill, the gape, the eyestripe and the eye
  A(2, dabOp([[397, 460], [362, 450], [364, 462], [397, 472]], "#d9806a", 0.8));
  pen([[400, 452], [376, 443], [346, 439]], 3.2, 370, 0.97, 0.15); pen([[398, 459], [374, 451], [348, 441]], 1.6, 371, 0.9, 0.15); pen([[400, 477], [378, 472], [352, 467]], 2.8, 372, 0.97, 0.15);
  pen([[402, 462], [432, 460], [470, 466], [492, 474]], 2.2, 375, 0.7, 0.4); pen([[392, 478], [398, 496], [404, 520]], 1.1, 373, 0.5, 0.4);
  A(3, (g, p) => { if (p > 0) g.group("plain", () => { fillShape(g, blob(432, 461, 7.2, 7, 380, 0.05, 10), INK); fillShape(g, blob(429.5, 458.5, 2.2, 2, 381, 0.05, 8), PAPER); }); });
  const r2 = rng(305); for (let i = 0; i < 9; i++) { const x = 420 + r2() * 90, y = 520 + r2() * 90; pen([[x, y], [x + 6, y + 5], [x + 9, y + 12]], 1.3, 306 + i, 0.4, 0.5, 1.2); }
  // tail and its barring, the wing, the covert spots, the flank
  const t = smooth(TAIL, true, 6), m = t.length;
  pen(t.slice(0, Math.round(m * 0.55)), 2.4, 310, 0.88); pen(t.slice(Math.round(m * 0.5), m - 2), 3.6, 311, 0.93);
  for (let i = 0; i < 9; i++) { const f = 0.12 + i * 0.1, a = lerpP(TAIL[1], TAIL[4], f), c = lerpP(TAIL[9], TAIL[6], f); pen([lerpP(a, c, 0.06), lerpP(lerpP(a, c, 0.5), [a[0] - 3, a[1] + 3], 0.3), lerpP(a, c, 0.94)], 1.5, 320 + i, 0.8, 0.4, 1.3); }
  const w2 = smooth(WING, true, 6), q = w2.length;
  pen(w2.slice(Math.round(q * 0.12), Math.round(q * 0.64)), 3.4, 330, 0.93); pen(w2.slice(Math.round(q * 0.6), Math.round(q * 0.9)), 2.2, 331, 0.8);
  for (let i = 0; i < 7; i++) { const x = 548 + i * 9, y = 526 + i * 7; pen([[x - 8, y - 12], [x - 2, y - 4], [x + 6, y + 6]], 1.6, 340 + i, 0.85, 0.3, 1.3); }
  const sp: P[] = [[486, 490], [503, 503], [519, 488], [534, 506], [552, 497], [568, 512], [512, 518]];
  sp.forEach(([x, y], i) => { A(1.2, dabOp(blob(x, y, 3.2, 2.2, 350 + i, 0.2, 8), PAPER, 0.95)); pen([[x - 5, y + 3], [x, y + 5], [x + 5, y + 3]], 0.9, 356 + i, 0.8, 0.2, 1.2); });
  for (let i = 0; i < 6; i++) { const x = 548 + i * 10, y = 596 + (i % 2) * 5; pen([[x - 7, y], [x, y + 4], [x + 7, y + 1]], 1.0, 360 + i, 0.55, 0.3, 1.2); }
  // legs and toes wrapped round the twig
  [[498, 640, 486, 700], [534, 644, 540, 696]].forEach(([x0, y0, x1, y1], i) => {
    A(1.5, dabOp([[x0 - 4, y0], [x0 + 4, y0], [x1 + 3, y1], [x1 - 3, y1]], "#b98468", 0.75));
    pen([[x0, y0], [lerpP([x0, y0], [x1, y1], 0.5)[0] + 2, lerpP([x0, y0], [x1, y1], 0.5)[1]], [x1, y1]], 2.6, 390 + i, 0.95, 0.2);
    pen([[x1, y1], [x1 - 14, y1 + 2], [x1 - 22, y1 + 12]], 1.6, 392 + i, 0.95, 0.2); pen([[x1, y1], [x1 - 4, y1 + 8], [x1 - 10, y1 + 18]], 1.5, 394 + i, 0.9, 0.2); pen([[x1, y1], [x1 + 12, y1 + 4], [x1 + 16, y1 + 14]], 1.5, 396 + i, 0.9, 0.2);
  });
  tl.wait(8);
  // 3. the twig: bark edges (the top one left open where the light hits), thorns, ticks, leaves, haws
  const top = twigLine.map(([x, y], i) => [x, y - lerpP([17, 0], [6, 0], i / (twigLine.length - 1))[0]] as P), bot = twigLine.map(([x, y], i) => [x, y + lerpP([17, 0], [6, 0], i / (twigLine.length - 1))[0]] as P);
  pen(top.slice(0, 3), 1.7, 80, 0.8); pen(top.slice(3), 1.5, 81, 0.75); pen(bot.slice(0, 4), 2.6, 82); pen(bot.slice(3), 2.2, 83);
  pen(side.map(([x, y]) => [x + 4, y + 3] as P), 1.9, 84); pen(lower.map(([x, y]) => [x + 4, y] as P), 1.9, 85);
  const r = rng(86);
  [[150, 770, -1], [410, 716, -1], [700, 676, 1], [960, 616, -1], [590, 700, 1]].forEach(([x, y, s], i) => pen([[x - 6, y], [x + 2, y + (s as number) * 14], [x + 7, y]], 1.4, 87 + i, 0.9, 0.3, 1.3));
  for (let i = 0; i < 16; i++) { const tt = r(), p = lerpP(twigLine[Math.floor(tt * 4)], twigLine[Math.floor(tt * 4) + 1], (tt * 4) % 1); pen([[p[0] - 5, p[1] - 2 + r() * 6], [p[0] + 6, p[1] + r() * 5]], 0.9, 100 + i, 0.55, 0.3, 1); }
  LEAVES.forEach((l, i) => { pen(l.shape.filter((_, k) => k % 2 === 0), 1.3, 120 + i, 0.8, 0.7); pen(l.mid, 1.1, 130 + i, 0.7, 0.3); l.veins.forEach((v, k) => pen(v, 0.7, 140 + i * 5 + k, 0.55, 0.2, 1)); });
  HAWS.forEach(([x, y], i) => { const bl = blob(x, y, 12, 12.5, 60 + i, 0.06, 12); pen(bl.slice(Math.floor(bl.length * 0.35)).concat(bl.slice(0, 2)), 1.3, 160 + i, 0.85, 0.4, 1.4); A(1, dabOp(blob(x + 1, y + 11, 2.2, 1.8, 170 + i, 0.1, 6), INK, 0.8)); });
  pen([[300, 752], [312, 764], [318, 772]], 1, 180, 0.8, 0.2); pen([[336, 752], [340, 772], [344, 786]], 1, 181, 0.8, 0.2); pen([[322, 752], [324, 790], [330, 810]], 1, 182, 0.8, 0.2);
  tl.wait(10);
  // 4. the pen shaken: spatters, flicked one after another away from the bird
  const rs = rng(13), dots: P[][] = []; for (let i = 0; i < 22; i++) { const x = 160 + rs() * 820, y = 280 + rs() * 640, big = rs() < 0.25; if (Math.hypot(x - 510, y - 530) < 170) continue; dots.push(blob(x, y, big ? 3.6 : 1.4 + rs(), big ? 3 : 1.2 + rs() * 0.8, 20 + i, 0.3, 8)); void (0.7 + rs() * 0.3); }
  const rs2 = rng(13), alphas: number[] = []; for (let i = 0; i < 22; i++) { const x = 160 + rs2() * 820, y = 280 + rs2() * 640; rs2(); rs2(); rs2(); if (Math.hypot(x - 510, y - 530) < 170) continue; alphas.push(0.7 + rs2() * 0.3); }
  A(12, (g, p) => { const n2 = p >= 1 ? dots.length : Math.floor(dots.length * p); if (n2 > 0) g.group("plain", () => dots.slice(0, n2).forEach((d, i) => fillShape(g, d, INK, alphas[i]))); });
  const ground = (g: Gfx) => { const c = g.cur, e = g.env; c.setTransform(e.scale, 0, 0, e.scale, 0, 0); c.fillStyle = PAPER; c.fillRect(0, 0, e.W, e.H); };
  return { id: "wrenDraw", medium: INK_M, ground, ops: tl.ops, finish: (g) => { g.paper("coldpress", 0.16); g.paper("paper", 0.08); } };
};
const PROC = fit(build, N - 32), END = PROC.ops[PROC.ops.length - 1].t1; // one frame of the finished process, then the still

// the hold is the still itself, drawn fresh: caching it on an offscreen surface and copying it
// back was measured NOT byte-identical (offscreen and on-screen canvases rasterise differently),
// so the 30 held frames pay the still's own draw cost (~130 ms) to stay exact
export const STYLE = { id: "wrenDraw", name: "Ink & line-wash, drawn", family: "ink", medium: "watercolour washes laid as a travelling bead, then a flexible steel nib in iron-gall-dark ink, on cold-press paper", nearest: "wren", hero: "a Eurasian wren singing on a hawthorn twig" };

export const wrenDraw: Film = {
  meta: { title: "Wren on a twig · drawing itself", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "draw", start: 0, end: N, draw: (ctx, f, env) => (f >= N - 30 ? drawWren(ctx, 0, env) : runProcess(PROC, ctx, Math.min(f, END), env)) }],
};
