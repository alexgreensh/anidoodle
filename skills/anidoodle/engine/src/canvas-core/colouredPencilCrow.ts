import type { P } from "./core";
import { Sheet, contour, dot, edgeDist, ellipseR, hatch as hatchRaw, minus, poly, union, type Region } from "./colouredPencilKit";

// THE CROW, built the way a pencil artist builds a black bird: never one black mass.
// A warm-grey underlayer first, then blue-black laid FEATHER GROUP BY FEATHER GROUP (head, body,
// coverts, secondaries, primaries, tail), each group with its own value and its own stroke
// direction along the feathers, violet worked into the sheen, and cross-hatching only in the
// deepest places. The paper is RESERVED, not added: thin lines between primaries and secondaries,
// the scallop rows of the coverts, the top of the head and the ridge of the bill are simply where
// the pencil never went. The eye is cross-hatched dark round a catchlight of bare paper; the screw
// is light steel with a bare-paper glint, outlined dark so it reads against wall and bill alike.
//
// Anatomy (carrion crow, walking profile, head turned back over the shoulder): bill as long as the
// head with nasal bristles over its base; shaggy throat; folded wing = lesser/median coverts in
// scalloped rows, secondaries below them, primaries crossing over two-thirds of the tail; wedge
// tail; scaled (scutellate) tarsi; three toes forward, one back, claws hooked over the bench edge.
//
// All geometry is authored in the crow's own sheet coordinates, then placed by `cw` (the body) and
// `hw` (the head, 1.25x the body's scale: a crow's head, not a songbird's).

type Place = (p: P) => P;
const C = { warm: "#8b8279", bb: "#262a3f", ink: "#1d1f2c", violet: "#5b4d93", sheen: "#6d73b8", steel: "#b9c0cc", steelDk: "#565d6b", leg: "#34343c", scute: "#9aa0aa", claw: "#1d1f2c" };
const ANG = -1.02, X2 = 0.22;
const hatch: typeof hatchRaw = (S, reg, o) => hatchRaw(S, reg, { ...o, gap: o.gap * 0.55, len: o.len * 0.85, a: Math.min(1, o.a * 0.72) });

// thin reserved lines: a region that is every point within r of any of the polylines
const near = (lines: P[][], r: number): Region => {
  const segs: [P, P][] = []; lines.forEach((l) => l.forEach((p, i) => { if (i) segs.push([l[i - 1], p]); }));
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; segs.forEach(([a, b]) => [a, b].forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }));
  return { box: { x0: x0 - r, y0: y0 - r, x1: x1 + r, y1: y1 + r }, has: (x, y) => segs.some(([a, b]) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < r; }) };
};
const arcAt = (c: P, s = 1): P[] => [[c[0] - 9 * s, c[1] - 3 * s], [c[0] - 3 * s, c[1] + 4 * s], [c[0] + 7 * s, c[1] + 2 * s]];
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export const crowGeometry = (cw: Place, hw: Place) => {
  const m = (pts: number[][], f = cw) => (pts as P[]).map(f);
  const body = m([[920, 496], [900, 500], [880, 512], [856, 532], [828, 554], [798, 580], [768, 606], [742, 632], [718, 656], [694, 684], [676, 706], [670, 716], [680, 724], [702, 720], [730, 708], [754, 700], [780, 706], [812, 714], [842, 716], [870, 708], [898, 690], [924, 662], [944, 630], [958, 600], [966, 568], [966, 536], [958, 512], [944, 498]]);
  const head = m([[912, 462], [924, 452], [942, 450], [958, 458], [966, 474], [962, 494], [950, 508], [930, 512], [914, 504], [906, 488], [906, 472]], hw);
  const bill = m([[910, 462], [890, 465], [868, 472], [850, 482], [845, 488], [858, 491], [882, 494], [906, 498]], hw);
  const culmen = m([[908, 463], [890, 466], [868, 473], [852, 482]], hw);
  const coverts = m([[898, 542], [912, 574], [904, 606], [870, 620], [830, 628], [800, 628], [820, 594], [862, 562]]);
  const secondaries = m([[904, 606], [902, 622], [878, 656], [840, 678], [800, 688], [790, 660], [800, 628], [830, 628], [870, 620]]);
  const primaries = m([[800, 628], [790, 660], [800, 688], [796, 690], [748, 696], [716, 696], [740, 674], [778, 630]]);
  const tail = m([[742, 638], [718, 660], [694, 686], [676, 706], [670, 716], [680, 724], [702, 720], [730, 708], [754, 700], [760, 690], [744, 676], [752, 650]]);
  const primLines = [[[790, 652], [760, 676], [728, 692]], [[792, 640], [768, 664], [742, 684]], [[786, 632], [770, 650], [752, 668]], [[798, 668], [772, 684], [752, 692]]].map((l) => m(l));
  const secLines = [[[890, 612], [880, 640], [866, 662]], [[870, 622], [856, 652], [838, 674]], [[846, 626], [830, 656], [814, 682]], [[822, 628], [808, 660], [800, 684]]].map((l) => m(l));
  const covRows = [...[0, 1, 2, 3, 4].map((k) => arcAt(lerp([894, 572], [836, 606], k / 4))), ...[0, 1, 2, 3].map((k) => arcAt(lerp([896, 594], [838, 620], k / 3)))].map((l) => m(l));
  const tailLines = [[[744, 652], [704, 700]], [[752, 664], [716, 710]], [[758, 676], [732, 704]]].map((l) => m(l));
  const legBack = m([[858, 712], [855, 748], [850, 780]]), legFront = m([[892, 706], [899, 744], [904, 780]]);
  // toes: forward pair along the edge, the front claws hooked down over the bench's rounded nose
  const toes = [[[850, 780], [866, 781], [876, 786], [878, 792]], [[850, 780], [862, 784], [868, 790]], [[850, 780], [838, 781], [832, 783]], [[904, 780], [920, 781], [930, 786], [932, 792]], [[904, 780], [916, 784], [922, 790]], [[904, 780], [892, 781], [886, 783]]].map((l) => m(l));
  const eye = hw([922, 474]), eyeR = 6.2 * Math.hypot(hw([1, 0])[0] - hw([0, 0])[0], 0);
  const headTop = hw([940, 450])[1];
  const screw = { head: hw([862, 460]), a: hw([863.5, 466]), b: hw([869, 508]) };
  const gape = m([[908, 484], [884, 486], [860, 488], [846, 488]], hw);
  const bristles = [0, 1, 2, 3, 4, 5].map((k) => m([[912 - k * 2, 464 + k * 1.2], [902 - k * 2.6, 466 + k * 1.4], [892 - k * 2.4, 470 + k * 1.2]], hw));
  const hackles = [cw([958, 530]), cw([958, 596])];
  const belly = m([[780, 706], [812, 714], [842, 716], [870, 708], [898, 690], [924, 662]]);
  const k = Math.hypot(cw([1, 0])[0] - cw([0, 0])[0], 0);        // the body's scale, for mark sizes
  return { body, head, bill, culmen, coverts, secondaries, primaries, tail, primLines, secLines, covRows, tailLines, legBack, legFront, toes, eye, eyeR, headTop, screw, gape, bristles, hackles, belly, k };
};
export type Crow = ReturnType<typeof crowGeometry>;

const tube = (c: P[], r: number): P[] => { const L: P[] = [], R: P[] = []; c.forEach((p, i) => { const q = c[Math.min(c.length - 1, i + 1)], o = c[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1; L.push([p[0] - (dy / l) * r, p[1] + (dx / l) * r]); R.push([p[0] + (dy / l) * r, p[1] - (dx / l) * r]); }); return [...L, ...R.reverse()]; };
export const crowSilhouette = (G: Crow) => union(poly(G.body), poly(G.head), poly(G.bill), poly(tube(G.legBack, 3.6 * G.k)), poly(tube(G.legFront, 3.6 * G.k)), ...G.toes.map((t) => poly(tube(t, 1.6 * G.k))));

// the four moments the crow is worked on, each called while its pass is current
export const crowPasses = (G: Crow) => {
  const k = G.k, R = poly;
  const screwR = union(ellipseR(G.screw.head[0], G.screw.head[1], 6.5 * k, 4.2 * k), R(tube([G.screw.a, G.screw.b], 3.4 * k)));
  const eyeR = ellipseR(G.eye[0], G.eye[1], G.eyeR + 1, G.eyeR + 1);
  const wingR = union(R(G.coverts), R(G.secondaries), R(G.primaries));
  const headTopR: Region = { box: R(G.head).box, has: (x, y) => y < G.headTop + 5 * k && R(G.head).has(x, y) && edgeDist(G.head)(x, y) < 4.5 * k };
  const reserved = union(near(G.primLines, 0.9 * k), near(G.secLines, 0.9 * k), near(G.covRows, 0.8 * k), near(G.tailLines, 0.7 * k), near([G.culmen], 1.3 * k), headTopR);
  const bodyOnly = minus(R(G.body), wingR, R(G.tail));
  const headR = minus(R(G.head), R(G.bill), eyeR);
  const legs = union(R(tube(G.legBack, 3.4 * k)), R(tube(G.legFront, 3.4 * k)), ...G.toes.map((t) => R(tube(t, 1.7 * k))));
  const dBody = edgeDist(G.body);
  return {
    // 1 · the underlayer: warm grey everywhere the bird is, the reserved lines already kept clear
    base: (S: Sheet) => {
      hatch(S, minus(union(R(G.body), R(G.head)), eyeR, screwR, reserved), { ang: ANG, gap: 2.6, len: 20, w: 1.4, col: C.warm, a: 0.8, seed: 1600, dens: () => 0.75 });
      hatch(S, minus(R(G.bill), screwR, reserved), { ang: -0.42, gap: 2.4, len: 12, w: 1.3, col: C.warm, a: 0.8, seed: 1601, dens: () => 0.8 });
      hatch(S, legs, { ang: -1.5, gap: 1.2, len: 8, w: 1.3, col: C.leg, a: 1, seed: 1602, dens: () => 1 }); hatch(S, legs, { ang: X2, gap: 1.4, len: 6, w: 1.2, col: C.ink, a: 1, seed: 1604, dens: () => 1 });
      hatch(S, minus(screwR, ellipseR(G.screw.head[0] - 1.6 * k, G.screw.head[1] - 1.2 * k, 1.8 * k, 1.4 * k), R(tube([lerp(G.screw.a, G.screw.b, 0.1), lerp(G.screw.a, G.screw.b, 0.9)].map(([x, y]) => [x - 1.4 * k, y] as P), 0.7 * k))), { ang: ANG, gap: 1.5, len: 6, w: 1.1, col: C.steel, a: 1, seed: 1603, dens: () => 0.95 });
    },
    // 2 · blue-black, group by group, each along its own feathers; violet into the sheen
    layer: (S: Sheet) => {
      const g = (reg: Region, ang: number, d: number, seed: number, gap = 2.4, len = 18) => hatch(S, minus(reg, reserved, eyeR, screwR), { ang, gap, len, w: 1.4, col: C.bb, a: 0.95, seed, dens: () => d, jit: 0.06 });
      g(bodyOnly, ANG, 0.88, 1610);
      g(headR, ANG - 0.25, 0.7, 1611);
      g(R(G.coverts), ANG + 0.45, 0.42, 1612, 2.8, 10);
      g(R(G.secondaries), ANG + 0.15, 0.74, 1613);
      g(R(G.primaries), -0.52, 0.86, 1614, 2.2, 22);
      g(R(G.tail), -0.72, 0.9, 1615, 2.2, 22);
      g(minus(R(G.bill), screwR), -0.42, 0.75, 1616, 2.2, 12);
      hatch(S, minus(union(R(G.coverts), headR, R(G.secondaries)), reserved, screwR), { ang: ANG + 0.2, gap: 3.2, len: 14, w: 1.3, col: C.violet, a: 0.8, seed: 1617, dens: (x, y) => (R(G.secondaries).has(x, y) ? 0.3 : 0.6) });
    },
    // 3 · the deepest places, cross-hatched: belly and vent, under the wing, the tail's underside,
    //     the head below the eye; then the eye itself round its catchlight
    darks: (S: Sheet) => {
      hatch(S, minus(bodyOnly, reserved), { ang: X2, gap: 2.8, len: 16, w: 1.3, col: C.ink, a: 0.9, seed: 1620, dens: (x, y) => 0.4 + 0.55 * Math.max(0, Math.min(1, (y - G.body[0][1]) / (G.belly[2][1] - G.body[0][1]))) + 0.3 * (dBody(x, y) < 4 * k ? 1 : 0) });
      hatch(S, minus(R(G.primaries), reserved), { ang: X2 - 0.2, gap: 3, len: 14, w: 1.3, col: C.ink, a: 0.85, seed: 1621, dens: () => 0.55 });
      hatch(S, minus(R(G.tail), reserved), { ang: X2 + 0.3, gap: 3, len: 14, w: 1.3, col: C.ink, a: 0.85, seed: 1622, dens: () => 0.6 });
      hatch(S, minus(R(G.secondaries), reserved), { ang: X2, gap: 3.4, len: 12, w: 1.2, col: C.ink, a: 0.7, seed: 1623, dens: (x, y) => 0.5 * Math.max(0, Math.min(1, (y - G.secondaries[0][1]) / 30)) });
      hatch(S, minus(headR, reserved), { ang: X2, gap: 3.2, len: 12, w: 1.2, col: C.ink, a: 0.75, seed: 1624, dens: (x, y) => (y > G.eye[1] + 2 ? 0.55 : 0.15) });
      const iris = minus(ellipseR(G.eye[0], G.eye[1], G.eyeR, G.eyeR), ellipseR(G.eye[0] - G.eyeR * 0.36, G.eye[1] - G.eyeR * 0.36, G.eyeR * 0.3, G.eyeR * 0.3));
      [ANG, X2, ANG + 0.8].forEach((a, i) => hatch(S, iris, { ang: a, gap: 1.2, len: 6, w: 1.1, col: C.ink, a: 1, seed: 1630 + i, dens: () => 1 }));
    },
    // 4 · lines last and sparse: bill and gape, bristles, the eye's rim, feather tips, scutes, claws, the screw
    line: (S: Sheet) => {
      const ln = (pts: P[], seed: number, w: number, a: number, col = C.ink) => contour(S, pts, { w, col, a, seed, seg: 30, skip: 0 });
      ln(G.bill.slice(0, 5), 1640, 1.2, 0.9); ln(G.gape, 1641, 1.1, 0.9);
      G.bristles.forEach((b) => S.line(b, 0.8, C.ink, 0.8));
      ln(Array.from({ length: 12 }, (_, i) => { const a = Math.PI * 0.15 + (i / 11) * Math.PI * 1.1; return [G.eye[0] + Math.cos(a) * (G.eyeR + 1.8), G.eye[1] + Math.sin(a) * (G.eyeR + 1.8)] as P; }), 1642, 0.9, 0.7);
      for (let i = 0; i < 7; i++) { const p = lerp(G.hackles[0], G.hackles[1], i / 6); S.line([[p[0] - 3 * k, p[1] - 2 * k], [p[0] + 3 * k, p[1] + 1.5 * k], [p[0] - 0.5 * k, p[1] + 5 * k]], 0.9, C.ink, 0.85); }
      [G.secondaries.slice(1, 5), G.primaries.slice(2, 6)].forEach((l, i) => ln(l, 1650 + i, 1.1, 0.8));
      ln(G.belly, 1652, 1.1, 0.7);
      // scaled tarsi: pale rings across the dark leg, then the toes and hooked claws in near-black
      [G.legBack, G.legFront].forEach((l) => { for (let i = 1; i < 7; i++) { const p = lerp(l[1], l[2], i / 7), q = lerp(l[0], l[1], i / 7); [p, q].forEach((c) => S.line([[c[0] - 2.4 * k, c[1] - 0.3 * k], [c[0] + 2.4 * k, c[1] + 0.5 * k]], 0.8, C.scute, 0.85)); } });
      G.toes.forEach((t, i) => ln(t, 1660 + i, 1.4, 0.95, C.claw));
      // the screw: dark flanks so it reads against the pale wall and the black bill, threads, a slotted head
      const off = (d: number): P[] => [G.screw.a, G.screw.b].map(([x, y]) => [x + d * k, y] as P);
      S.line(off(-3.4), 0.9, C.steelDk, 0.95); S.line(off(3.4), 0.9, C.steelDk, 0.95);
      for (let i = 0; i < 8; i++) { const p = lerp(G.screw.a, G.screw.b, 0.18 + i * 0.1); S.line([[p[0] - 3.2 * k, p[1] - 0.6 * k], [p[0] + 3.2 * k, p[1] + 0.9 * k]], 0.7, C.steelDk, 0.85); }
      contour(S, Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return [G.screw.head[0] + Math.cos(a) * 6.5 * k, G.screw.head[1] + Math.sin(a) * 4.2 * k] as P; }), { w: 0.9, col: C.steelDk, a: 0.95, seed: 1670, seg: 40, skip: 0 });
      S.line([[G.screw.head[0] - 3.5 * k, G.screw.head[1] + 0.4 * k], [G.screw.head[0] + 3.5 * k, G.screw.head[1] - 0.4 * k]], 1, C.steelDk, 0.9);
      dot(S, G.eye[0] + G.eyeR * 0.3, G.eye[1] + G.eyeR * 0.3, 1.2, C.ink, 0.9, 1);
    },
  };
};
