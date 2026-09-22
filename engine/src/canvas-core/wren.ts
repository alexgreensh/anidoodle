import { Gfx, rng, tube, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { blob, bounds, clamp, clipped, fillShape, lerpP, mix, smooth } from "./gallery";

// WREN ON A TWIG · ink + line-wash. The washes go down first and wet: they flood a little past
// where the line will be, the pigment slides down and settles along the BOTTOM edge of every
// shape, and where a second drop hit damp paper it pushed a pale backrun with a dark crinkled
// rim. Then the pen: a flexible nib, loose, thick where it pressed and hair-thin where it lifted,
// contours left open where the light eats the edge. A few spatters where the pen was shaken.
//
// The bird is a Eurasian wren, singing: round as a ball, tail cocked straight up, a pale
// eyebrow over a dark eyestripe, a thin decurved bill wide open, fine dark barring across the
// wing and tail, and pale spots on the coverts. It grips a hawthorn twig with its toes wrapped
// round the bark. A cluster of haws for the only red. Light from the upper left.

const INK_M: Medium = { nib: 1.7, taper: 1, pressure: 1.75, retrace: false, wobble: 1.35, rough: 0.6 };
const INK = "#16131f", PAPER = "#fbf8f0";
const BROWN = "#a0693a", DARKB = "#5e3a20", BUFF = "#e6c794", RUFOUS = "#b8733a", UMBER = "#6e4a2c", SAP = "#6f8f3e", HAW = "#c3262d";

// ---------------------------------------------------------------- wet media
// a wash: the core's displaced wet edge, then pigment pooled along the bottom of the same shape
const wet = (g: Gfx, pts: P[], color: string, o: { alpha: number; seed: number; pool?: number; bloom?: P | null; bloomR?: number }) => {
  const { alpha, seed, pool = 0.55, bloom = null, bloomR = 22 } = o, b = bounds(pts);
  g.group("paint", () => {
    g.wash(pts, color, { alpha, seed, dx: 7, dy: 6, shrink: 1.07, rim: true });
    clipped(g, pts, () => {
      const c = g.cur, gr = c.createLinearGradient(0, b.y0 + (b.y1 - b.y0) * 0.45, 0, b.y1 + 2);
      gr.addColorStop(0, color + "00"); gr.addColorStop(0.75, color + Math.round(255 * alpha * pool * 0.6).toString(16).padStart(2, "0")); gr.addColorStop(1, color + Math.round(255 * clamp(alpha * pool * 1.3)).toString(16).padStart(2, "0"));
      c.fillStyle = gr; c.fillRect(b.x0 - 20, b.y0, b.x1 - b.x0 + 40, b.y1 - b.y0 + 20);
    });
    if (bloom) { // a backrun: a pale cauliflower where a wetter drop pushed the pigment out to a dark crinkled rim
      const bl = blob(bloom[0], bloom[1], bloomR, bloomR * 0.8, seed + 7, 0.32, 18);
      fillShape(g, bl, PAPER, 0.42);
      const c = g.cur; c.strokeStyle = mix(color, INK, 0.25); c.globalAlpha = alpha * 0.9; c.lineWidth = 1.6; c.beginPath(); bl.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke(); c.globalAlpha = 1;
    }
  });
};
// the pen: one loose stroke through a few control points, pressure making it thick and thin
const pen = (g: Gfx, pts: P[], w: number, seed: number, op = 0.95, wob = 0.9) => g.pen(pts, { w, color: INK, seed, wobble: wob, boil: 0, taper: 1, opacity: op, retrace: false });
const inked = (g: Gfx, fn: () => void) => g.group("plain", fn);

// ---------------------------------------------------------------- the twig and its haws
const twigLine: P[] = [[40, 806], [250, 752], [470, 712], [640, 690], [820, 652], [1080, 594]];
const side: P[] = [[792, 658], [846, 604], [884, 540], [930, 506]];
const lower: P[] = [[268, 748], [236, 806], [214, 868]];

const twig = (g: Gfx) => {
  const main = tube(twigLine, 17, 6, true), sb = tube(side, 7, 3, true), lb = tube(lower, 7, 3, true);
  wet(g, main, UMBER, { alpha: 0.62, seed: 30, pool: 0.8 }); wet(g, sb, UMBER, { alpha: 0.55, seed: 31 }); wet(g, lb, UMBER, { alpha: 0.55, seed: 32 });
  // leaves on the side shoot and at the tip: hawthorn-lobed, a green that goes blue in the shade
  const leaf = (base: P, ang: number, len: number, seed: number) => {
    const r = rng(seed), d: P = [Math.cos(ang), Math.sin(ang)], n: P = [-d[1], d[0]], at = (t: number, s: number): P => [base[0] + d[0] * t * len + n[0] * s * len, base[1] + d[1] * t * len + n[1] * s * len];
    const edge = [at(0, 0), at(0.2, 0.14), at(0.38, 0.3), at(0.5, 0.22), at(0.62, 0.34), at(0.78, 0.2), at(1, 0.02), at(0.8, -0.2), at(0.64, -0.3), at(0.5, -0.2), at(0.35, -0.28), at(0.18, -0.13)];
    const shape = smooth(edge, true, 5);
    wet(g, shape, mix(SAP, "#3f6c5e", r() * 0.4), { alpha: 0.6, seed, pool: 0.7 });
    return { shape, mid: [at(0, 0), at(0.55, 0.01 * (r() - 0.5)), at(0.95, 0)] as P[], veins: [0.3, 0.5, 0.7].map((t, k) => [at(t, 0), at(t + 0.12, (k % 2 ? 1 : -1) * 0.22)] as P[]) };
  };
  const leaves = [leaf([884, 540], -1.9, 96, 40), leaf([860, 580], -0.25, 110, 41), leaf([930, 506], -0.75, 88, 42), leaf([1010, 612], -1.1, 80, 43), leaf([236, 800], 2.2, 84, 44)];
  // haws hanging under the branch: crimson, a bare-paper highlight, dark where the pigment sank
  const haws: P[] = [[318, 772], [344, 786], [300, 796], [330, 810], [356, 812], [312, 822]];
  haws.forEach(([x, y], i) => wet(g, blob(x, y, 12, 12.5, 60 + i, 0.06, 12), HAW, { alpha: 0.85, seed: 60 + i, pool: 0.9 }));
  g.group("plain", () => haws.forEach(([x, y], i) => fillShape(g, blob(x - 4, y - 5, 3.4, 2.6, 70 + i, 0.1, 8), PAPER, 0.9)));
  inked(g, () => {
    // the bark: the top edge left open where the light hits, the underside pressed firmly
    const top = twigLine.map(([x, y], i) => [x, y - lerpP([17, 0], [6, 0], i / (twigLine.length - 1))[0]] as P), bot = twigLine.map(([x, y], i) => [x, y + lerpP([17, 0], [6, 0], i / (twigLine.length - 1))[0]] as P);
    pen(g, top.slice(0, 3), 1.7, 80, 0.8); pen(g, top.slice(3), 1.5, 81, 0.75);
    pen(g, bot.slice(0, 4), 2.6, 82); pen(g, bot.slice(3), 2.2, 83);
    pen(g, side.map(([x, y]) => [x + 4, y + 3] as P), 1.9, 84); pen(g, lower.map(([x, y]) => [x + 4, y] as P), 1.9, 85);
    // thorns and bark ticks
    const r = rng(86);
    [[150, 770, -1], [410, 716, -1], [700, 676, 1], [960, 616, -1], [590, 700, 1]].forEach(([x, y, s], i) => pen(g, [[x - 6, y], [x + 2, y + (s as number) * 14], [x + 7, y]], 1.4, 87 + i, 0.9, 0.3));
    for (let i = 0; i < 16; i++) { const t = r(), p = lerpP(twigLine[Math.floor(t * 4)], twigLine[Math.floor(t * 4) + 1], (t * 4) % 1); pen(g, [[p[0] - 5, p[1] - 2 + r() * 6], [p[0] + 6, p[1] + r() * 5]], 0.9, 100 + i, 0.55, 0.3); }
    leaves.forEach((l, i) => { pen(g, l.shape.filter((_, k) => k % 2 === 0), 1.3, 120 + i, 0.8, 0.7); pen(g, l.mid, 1.1, 130 + i, 0.7, 0.3); l.veins.forEach((v, k) => pen(g, v, 0.7, 140 + i * 5 + k, 0.55, 0.2)); });
    haws.forEach(([x, y], i) => { const bl = blob(x, y, 12, 12.5, 60 + i, 0.06, 12); pen(g, bl.slice(Math.floor(bl.length * 0.35)).concat(bl.slice(0, 2)), 1.3, 160 + i, 0.85, 0.4); fillShape(g, blob(x + 1, y + 11, 2.2, 1.8, 170 + i, 0.1, 6), INK, 0.8); });
    pen(g, [[300, 752], [312, 764], [318, 772]], 1, 180, 0.8, 0.2); pen(g, [[336, 752], [340, 772], [344, 786]], 1, 181, 0.8, 0.2); pen(g, [[322, 752], [324, 790], [330, 810]], 1, 182, 0.8, 0.2);
  });
};

// ---------------------------------------------------------------- the wren
const BODY: P[] = [[394, 450], [428, 416], [482, 420], [560, 448], [614, 494], [620, 536], [606, 582], [578, 624], [528, 650], [468, 634], [418, 590], [396, 540], [390, 492]];
const TAIL: P[] = [[590, 506], [606, 468], [626, 418], [646, 368], [662, 330], [690, 336], [684, 382], [664, 434], [644, 486], [622, 528]];
const WING: P[] = [[472, 476], [530, 468], [584, 500], [620, 552], [610, 584], [566, 598], [516, 580], [484, 540]];
const BELLY: P[] = [[410, 560], [452, 604], [506, 630], [560, 624], [548, 596], [488, 580], [440, 548]];

const bird = (g: Gfx) => {
  const body = smooth(BODY, true, 8), tail = smooth(TAIL, true, 8), wing = smooth(WING, true, 8), belly = smooth(BELLY, true, 8);
  // washes: warm brown all over, buff under, the wing and tail a darker umber, rufous on the back
  wet(g, tail, UMBER, { alpha: 0.62, seed: 200, pool: 0.4 });
  wet(g, body, BROWN, { alpha: 0.55, seed: 201, pool: 0.75, bloom: [548, 470], bloomR: 20 });
  wet(g, belly, BUFF, { alpha: 0.5, seed: 202, pool: 0.3 });
  wet(g, blob(520, 460, 70, 26, 203, 0.2, 12, 0.35), RUFOUS, { alpha: 0.35, seed: 204, pool: 0.2 });
  wet(g, wing, DARKB, { alpha: 0.45, seed: 205, pool: 0.6 });
  // the face: a pale eyebrow lifted out, a dark stripe through the eye
  g.group("plain", () => fillShape(g, smooth([[398, 446], [430, 436], [470, 440], [494, 452], [470, 450], [432, 448], [402, 456]], true, 6), mix(BUFF, PAPER, 0.5), 0.9));
  wet(g, smooth([[398, 462], [428, 454], [466, 460], [490, 474], [462, 472], [428, 470], [400, 472]], true, 6), DARKB, { alpha: 0.55, seed: 206, pool: 0.2 });

  inked(g, () => {
    // the contour: open where the light eats the edge (crown, back), pressed at the belly and under the tail
    const b = smooth(BODY, true, 6), n = b.length;
    pen(g, b.slice(Math.round(n * 0.0), Math.round(n * 0.2)), 2.4, 300, 0.9);                     // crown to nape, light
    pen(g, b.slice(Math.round(n * 0.25), Math.round(n * 0.4)), 2.2, 301, 0.8);                    // a broken back line
    pen(g, b.slice(Math.round(n * 0.44), Math.round(n * 0.78)), 4.6, 302, 0.96);                  // rump, vent, belly: firm
    pen(g, b.slice(Math.round(n * 0.52), Math.round(n * 0.72)).map(([x, y]) => [x + 3, y + 4] as P), 2.2, 304, 0.55, 1.6);   // a second searching stroke under the belly
    pen(g, b.slice(Math.round(n * 0.76), Math.round(n * 0.99)), 3.6, 303, 0.95);                 // breast and throat
    const r2 = rng(305); for (let i = 0; i < 9; i++) { const x = 420 + r2() * 90, y = 520 + r2() * 90; pen(g, [[x, y], [x + 6, y + 5], [x + 9, y + 12]], 1.3, 306 + i, 0.4, 0.5); }   // loose feather flicks on the breast
    const t = smooth(TAIL, true, 6), m = t.length;
    pen(g, t.slice(0, Math.round(m * 0.55)), 2.4, 310, 0.88); pen(g, t.slice(Math.round(m * 0.5), m - 2), 3.6, 311, 0.93);
    for (let i = 0; i < 9; i++) { const f = 0.12 + i * 0.1, a = lerpP(TAIL[1], TAIL[4], f), c = lerpP(TAIL[9], TAIL[6], f); pen(g, [lerpP(a, c, 0.06), lerpP(lerpP(a, c, 0.5), [a[0] - 3, a[1] + 3], 0.3), lerpP(a, c, 0.94)], 1.5, 320 + i, 0.8, 0.4); }  // tail barring
    // the folded wing: its lower edge firm, primaries barred, pale spots on the coverts
    const w2 = smooth(WING, true, 6), q = w2.length;
    pen(g, w2.slice(Math.round(q * 0.12), Math.round(q * 0.64)), 3.4, 330, 0.93); pen(g, w2.slice(Math.round(q * 0.6), Math.round(q * 0.9)), 2.2, 331, 0.8);
    for (let i = 0; i < 7; i++) { const x = 548 + i * 9, y = 526 + i * 7; pen(g, [[x - 8, y - 12], [x - 2, y - 4], [x + 6, y + 6]], 1.6, 340 + i, 0.85, 0.3); }
    const sp: P[] = [[486, 490], [503, 503], [519, 488], [534, 506], [552, 497], [568, 512], [512, 518]]; for (let i = 0; i < sp.length; i++) { const [x, y] = sp[i]; fillShape(g, blob(x, y, 3.2, 2.2, 350 + i, 0.2, 8), PAPER, 0.95); pen(g, [[x - 5, y + 3], [x, y + 5], [x + 5, y + 3]], 0.9, 356 + i, 0.8, 0.2); }
    // flank barring, faint
    for (let i = 0; i < 6; i++) { const x = 548 + i * 10, y = 596 + (i % 2) * 5; pen(g, [[x - 7, y], [x, y + 4], [x + 7, y + 1]], 1.0, 360 + i, 0.55, 0.3); }
    // the bill, wide open in song, and the pink gape inside it
    g.group("plain", () => fillShape(g, [[397, 460], [362, 450], [364, 462], [397, 472]], "#d9806a", 0.8));
    pen(g, [[400, 452], [376, 443], [346, 439]], 3.2, 370, 0.97, 0.15); pen(g, [[398, 459], [374, 451], [348, 441]], 1.6, 371, 0.9, 0.15);
    pen(g, [[400, 477], [378, 472], [352, 467]], 2.8, 372, 0.97, 0.15);
    pen(g, [[402, 462], [432, 460], [470, 466], [492, 474]], 2.2, 375, 0.7, 0.4);                        // the eyestripe, drawn
    pen(g, [[392, 478], [398, 496], [404, 520]], 1.1, 373, 0.5, 0.4);                                  // throat feathers parting as it sings
    // the eye: a bead with a catchlight, half-lidded by the eyestripe
    fillShape(g, blob(432, 461, 7.2, 7, 380, 0.05, 10), INK); fillShape(g, blob(429.5, 458.5, 2.2, 2, 381, 0.05, 8), PAPER);
    // legs and toes wrapped round the twig
    [[498, 640, 486, 700], [534, 644, 540, 696]].forEach(([x0, y0, x1, y1], i) => {
      fillShape(g, [[x0 - 4, y0], [x0 + 4, y0], [x1 + 3, y1], [x1 - 3, y1]], "#b98468", 0.75);
      pen(g, [[x0, y0], [lerpP([x0, y0], [x1, y1], 0.5)[0] + 2, lerpP([x0, y0], [x1, y1], 0.5)[1]], [x1, y1]], 2.6, 390 + i, 0.95, 0.2);
      pen(g, [[x1, y1], [x1 - 14, y1 + 2], [x1 - 22, y1 + 12]], 1.6, 392 + i, 0.95, 0.2);            // front toes curl over the bark
      pen(g, [[x1, y1], [x1 - 4, y1 + 8], [x1 - 10, y1 + 18]], 1.5, 394 + i, 0.9, 0.2);
      pen(g, [[x1, y1], [x1 + 12, y1 + 4], [x1 + 16, y1 + 14]], 1.5, 396 + i, 0.9, 0.2);             // the hind toe grips from behind
    });
  });
};

const background = (g: Gfx) => {
  // one loose wash behind the bird, cool, with a warm drop let into it lower down while it was wet
  g.group("paint", () => {
    g.wash(blob(560, 500, 330, 250, 10, 0.3, 22, -0.35), "#9fb3c8", { alpha: 0.28, seed: 10, dx: 0, dy: 6, shrink: 1 });
    g.wash(blob(440, 700, 230, 120, 11, 0.35, 18, -0.2), "#d8b98a", { alpha: 0.25, seed: 11, dx: 0, dy: 4, shrink: 1 });
    g.wash(blob(700, 330, 120, 90, 12, 0.35, 16, 0.3), "#b8c7d6", { alpha: 0.22, seed: 12, dx: 0, dy: 4, shrink: 1 });
  });
  // spatters flicked off the nib
  g.group("plain", () => { const r = rng(13); for (let i = 0; i < 22; i++) { const x = 160 + r() * 820, y = 280 + r() * 640, big = r() < 0.25; if (Math.hypot(x - 510, y - 530) < 170) continue; fillShape(g, blob(x, y, big ? 3.6 : 1.4 + r(), big ? 3 : 1.2 + r() * 0.8, 20 + i, 0.3, 8), INK, 0.7 + r() * 0.3); } });
};

export const drawWren = (ctx: Ctx, _frame: number, env: Env) => {
  const g = new Gfx(ctx, env, 0, INK_M);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 1080, 1080);
  background(g);
  twig(g);
  bird(g);
  g.paper("coldpress", 0.16);
  g.paper("paper", 0.08);
};

export const wren: Film = {
  meta: { title: "Wren on a twig · ink + line-wash", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "wren", start: 0, end: 1, draw: drawWren }],
};
