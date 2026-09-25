import { fractal, type P } from "./core";
import type { Film } from "./film";
import { crowGeometry, crowPasses, crowSilhouette } from "./colouredPencilCrow";
import { Sheet, contour, dot, edgeDist, ellipseR, hatch as hatchRaw, layLine, minus, poly, replay, smoothstep, union, type Cue, type Region } from "./colouredPencilKit";

// THE TIN REPAIRMAN · coloured pencil on cream paper.
//
// MEDIUM, physically: wax-based coloured pencils, sharpened but not needle-fine, on a cream
// cartridge sheet with a real tooth. The lead only deposits on the ridges of the tooth, so every
// passage of colour is speckled with the cream of the valleys; pressing harder fills more of them.
// MARKS: straight, slightly bowed hatching strokes, pressure arriving fast and flicking off,
// laid side by side in strips, almost all in ONE dominant diagonal (lower-left to upper-right, the
// natural swing of a right hand). EDGE: mostly none; an edge is where the hatching stops. A few
// thin contours in a darker pencil (sepia-graphite), broken, heavier on the shade side, drawn last.
// TONE: from pressure and from stacking: a second hue hatched over the first (blue over teal,
// violet over dusk blue, red-brown over ochre), darks CROSS-hatched in a second direction, never
// filled. Colour thickens toward the edge of every form; solid forms keep a paler band on their TOP
// face, because the light is above. ORDER: faint graphite lay-in, big local-colour passes light to
// dark, second-hue layering, darks, contours, then the lamp's halo in yellow over near-bare paper.
// PAPER: cream (#f3ecdc), its tooth one field shared by every layer.
//
// LIGHT: one warm desk lamp (an anglepoise, brick-red enamel shade) hanging over the music box;
// dusk in the open window is a weak cool fill only. Cast shadows: the robot's falls LEFT (the lamp
// is to its right), the box's falls right and forward, the crow's falls right.
//
// SUBJECT: a small wind-up tin robot (boxy tin toy: pressed-tin torso and head as true blocks with
// top faces, riveted seams, porthole eyes, ribbed hose arms, pincer hands, a brass wind-up key in
// its back) mends an open cylinder music box (pinned brass drum, steel comb, bedplate screws,
// butterfly winding key) on a plank workbench at dusk: its screwdriver is on one of the comb's two
// fixing screws; the other hole is empty. Nearer to us, on the bench's front edge with its tail
// across the box's corner, a carrion crow walks off toward the open window, head turned back over
// its shoulder, the missing screw crosswise in its bill.
// REFERENCE (from knowledge): tin toys of the 1950s Japanese "robot" type for construction and
// seams; a Swiss cylinder movement for the drum/comb layout; carrion crow in walking profile
// (bill as long as the head, nasal bristles, shaggy throat hackles, folded primaries reaching
// two-thirds down the tail, scaled tarsus, three toes forward one back); anglepoise lamp geometry.
// Style reference for the MARK only: a coloured-pencil children's-book film (Kevin Ngo's piano
// piece). Its scene, cast and staging are not used.

const D = 1080;                      // design units; the sheet is rescaled to meta W x H
const ANG = -1.02;                   // the dominant hatch diagonal: up and to the right
const X2 = 0.22;                     // the cross-hatch direction for darks
const PAPER = "#f3ecdc";

const C = {
  lay: "#8e8894", sepia: "#3e3134", graphite: "#34333d", blueBlack: "#262a3f",
  dusk: "#7f8dc2", violet: "#8f78b6", indigo: "#3d467f",
  skyTop: "#3f4b8f", skyMid: "#9272ad", skyLow: "#e8977a", skyGold: "#f1c47a", roof: "#4b3f6e",
  ochre: "#cf9557", woodRed: "#b35a31", walnut: "#5c3622", umberDk: "#3b2519", umber: "#7d4a2b",
  mahog: "#8a3822", lining: "#a8262f", brass: "#d6a63e", brassDk: "#8a6420", steel: "#626875",
  teal: "#3aa0a0", tBlue: "#2f5ea8", tDeep: "#22416a", tinRed: "#d1452e",
  shade: "#c5452e", shadeDk: "#7a2823", yellow: "#f6c93f", amber: "#f2a33a", pale: "#f8dc78",
  crow: "#27262e", sheen: "#4f58a3", screw: "#8d93a0", feather: "#9199cf",
};

// ---------------------------------------------------------------- projection for the solid things
const PITCH = 0.36, cP = Math.cos(PITCH), sP = Math.sin(PITCH);
type V3 = [number, number, number];
const proj = (ox: number, oy: number, yaw: number, k = 1) => ([x, y, z]: V3): P => { const X = x * Math.cos(yaw) + z * Math.sin(yaw), Z = -x * Math.sin(yaw) + z * Math.cos(yaw); return [ox + X * k, oy - (y * cP + Z * sP) * k]; };
const cuboid = (pr: (v: V3) => P, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => ({
  front: [pr([x0, y0, z0]), pr([x1, y0, z0]), pr([x1, y1, z0]), pr([x0, y1, z0])],
  top: [pr([x0, y1, z0]), pr([x1, y1, z0]), pr([x1, y1, z1]), pr([x0, y1, z1])],
  left: [pr([x0, y0, z1]), pr([x0, y0, z0]), pr([x0, y1, z0]), pr([x0, y1, z1])],
  right: [pr([x1, y0, z0]), pr([x1, y0, z1]), pr([x1, y1, z1]), pr([x1, y1, z0])],
});
const circ3 = (pr: (v: V3) => P, f: (a: number) => V3, n = 20): P[] => Array.from({ length: n }, (_, i) => pr(f((i / n) * Math.PI * 2)));
const ring = (cx: number, cy: number, rx: number, ry: number, n = 24, rot = 0): P[] => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)] as P; });
const tubeAlong = (c: P[], r: number): P[] => { const L: P[] = [], R: P[] = []; c.forEach((p, i) => { const q = c[Math.min(c.length - 1, i + 1)], o = c[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1; L.push([p[0] - (dy / l) * r, p[1] + (dx / l) * r]); R.push([p[0] + (dy / l) * r, p[1] - (dx / l) * r]); }); return [...L, ...R.reverse()]; };
// every hatch in this plate: short strokes, a firm hand
// the dominant diagonal, turned a few degrees per surface the way a hand re-settles for each patch
const hatch: typeof hatchRaw = (S, reg, o) => hatchRaw(S, reg, { ...o, ang: o.ang + ((((o.seed * 7919) % 13) + 13) % 13 - 6) * 0.018, gap: o.gap * 0.55, len: o.len * 0.85, a: Math.min(1, o.a * 0.72) });
// distance to one edge of a face: the top band of a solid is measured from its top edge
const segD = (a: P, b: P) => (x: number, y: number) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); };
const lerpP = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// ---------------------------------------------------------------- the scene, as geometry
const scene = () => {
  // the bench: plank top seen from above, a front apron with a drawer, darkness underneath
  const top: P[] = [[-10, 640], [D + 10, 640], [D + 10, 800], [-10, 800]];
  const nose: P[] = [[-10, 800], [D + 10, 800], [D + 10, 810], [-10, 810]];
  const apron: P[] = [[-10, 810], [D + 10, 810], [D + 10, 892], [-10, 892]];
  const drawer: P[] = [[640, 822], [900, 822], [900, 880], [640, 880]];
  const under: P[] = [[-10, 892], [D + 10, 892], [D + 10, D + 10], [-10, D + 10]];
  const legs: P[][] = [[[46, 892], [100, 892], [100, D + 10], [46, D + 10]], [[980, 892], [1034, 892], [1034, D + 10], [980, D + 10]]];

  // the open window the crow came in by
  const win = { x0: 700, x1: 988, y0: 74, y1: 418 };
  const frame: P[] = [[win.x0 - 16, win.y0 - 16], [win.x1 + 16, win.y0 - 16], [win.x1 + 16, win.y1 + 4], [win.x0 - 16, win.y1 + 4]];
  const opening: P[] = [[win.x0, win.y0], [win.x1, win.y0], [win.x1, win.y1], [win.x0, win.y1]];
  const sill: P[] = [[win.x0 - 30, win.y1 + 2], [win.x1 + 30, win.y1 + 2], [win.x1 + 36, win.y1 + 20], [win.x0 - 36, win.y1 + 20]];
  const leftSash: P[] = [[win.x0, win.y0], [846, win.y0], [846, win.y1], [win.x0, win.y1]];
  const leftGlass: P[] = [[win.x0 + 12, win.y0 + 12], [834, win.y0 + 12], [834, win.y1 - 12], [win.x0 + 12, win.y1 - 12]];
  const openSash: P[] = [[win.x1, win.y0 - 2], [1068, win.y0 - 34], [1068, win.y1 + 36], [win.x1, win.y1 + 2]];
  const openGlass: P[] = [[win.x1 + 10, win.y0 + 8], [1058, win.y0 - 18], [1058, win.y1 + 18], [win.x1 + 10, win.y1 - 8]];
  const roofs: P[] = [[win.x0, 372], [728, 372], [728, 350], [760, 328], [792, 350], [792, 366], [818, 366], [818, 340], [826, 340], [826, 358], [862, 358], [862, 344], [900, 318], [936, 344], [936, 376], [962, 376], [962, 360], [win.x1, 360], [win.x1, win.y1], [win.x0, win.y1]];
  const moon = minus(ellipseR(915, 142, 19, 19), ellipseR(924, 136, 17, 17));

  // the lamp: heavy round base on the back edge, two arms of paired rods, a bell shade over the box
  const pivot: P = [392, 196], A: P = [0.277, 0.961], B: P = [0.961, -0.277];
  const sh = (a: number, b: number): P => [pivot[0] + A[0] * a + B[0] * b, pivot[1] + A[1] * a + B[1] * b];
  const shadeProf: [number, number][] = [[-8, 12], [4, 18], [22, 24], [48, 33], [74, 44], [96, 56], [108, 64]];
  const shadeOut: P[] = [...shadeProf.map(([a, h]) => sh(a, -h)), ...[...shadeProf].reverse().map(([a, h]) => sh(a, h))];
  const mouthC = sh(108, 0), mouth = ring(mouthC[0], mouthC[1], 64, 15, 28, Math.atan2(B[1], B[0]));
  const glow = mouth.filter((p) => (p[0] - mouthC[0]) * A[0] + (p[1] - mouthC[1]) * A[1] >= -2);
  const bulb = ring(mouthC[0] + A[0] * 4, mouthC[1] + A[1] * 4, 22, 11, 16, Math.atan2(B[1], B[0]));
  const baseC: P = [724, 636], baseTop = ring(baseC[0], baseC[1] - 10, 46, 11, 28), baseSide: P[] = [...ring(baseC[0], baseC[1] - 10, 46, 11, 28).slice(0, 15), ...ring(baseC[0], baseC[1] + 5, 46, 11, 28).slice(0, 15).reverse()];
  const hinge: P = [726, 604], elbow: P = [612, 318];
  const armLo = tubeAlong([hinge, elbow], 5), armUp = tubeAlong([elbow, sh(-4, 0)], 4.5);
  const riser = tubeAlong([[baseC[0], baseC[1] - 14], hinge], 7);

  // the music box: yawed a little toward the robot, lid thrown back past upright
  const bp = proj(552, 756, 0.18), bx = { x0: -125, x1: 125, h: 78, z0: -55, z1: 55 };
  const box = cuboid(bp, bx.x0, bx.x1, 0, bx.h, bx.z0, bx.z1);
  const lidA = 0.42, lidL = 100, ly = bx.h + lidL * Math.cos(lidA), lz = bx.z1 + lidL * Math.sin(lidA), nY = -Math.sin(lidA) * 9, nZ = Math.cos(lidA) * 9;
  const lidIn: P[] = [bp([bx.x0, bx.h, bx.z1]), bp([bx.x1, bx.h, bx.z1]), bp([bx.x1, ly, lz]), bp([bx.x0, ly, lz])];
  const lidEdge: P[] = [bp([bx.x0, ly, lz]), bp([bx.x1, ly, lz]), bp([bx.x1, ly + nY, lz + nZ]), bp([bx.x0, ly + nY, lz + nZ])];
  const lidPanel: P[] = [[0.1, 0.16], [0.9, 0.16], [0.9, 0.86], [0.1, 0.86]].map(([u, v]) => bp([bx.x0 + (bx.x1 - bx.x0) * u, bx.h + lidL * Math.cos(lidA) * v, bx.z1 + lidL * Math.sin(lidA) * v]));
  const inner: P[] = [bp([-117, bx.h, -47]), bp([117, bx.h, -47]), bp([117, bx.h, 47]), bp([-117, bx.h, 47])];
  const bed: P[] = [bp([-104, 52, -40]), bp([100, 52, -40]), bp([100, 52, 38]), bp([-104, 52, 38])];
  const drumC = (x: number): V3 => [x, 75, 14];
  const drum: P[] = [...Array.from({ length: 9 }, (_, i) => bp([-82 + i * 20, 62 + 13, 14] as V3)), ...Array.from({ length: 9 }, (_, i) => bp([78 - i * 20, 62 - 9, 14 - 10] as V3))];
  const drumEnds = [circ3(bp, (a) => [-84, 62 + Math.sin(a) * 13, 14 + Math.cos(a) * 13], 16), circ3(bp, (a) => [80, 62 + Math.sin(a) * 13, 14 + Math.cos(a) * 13], 16)];
  const comb: P[] = [bp([-70, 64, -12]), bp([76, 64, -12]), bp([76, 66, 4]), bp([-70, 66, 4])];
  const drivePt = bp([-62, 64, -8]);                                  // the comb's fixing screw the robot is turning
  const emptyHole = bp([66, 64, -8]);                                 // its twin's hole, empty: that screw is in the crow's bill
  const keyShaft = [bp([bx.x1, 40, 0]), bp([bx.x1 + 24, 40, 0])];
  const keyBow = [circ3(bp, (a) => [bx.x1 + 30, 52 + Math.sin(a) * 12, Math.cos(a) * 5], 12), circ3(bp, (a) => [bx.x1 + 30, 28 + Math.sin(a) * 12, Math.cos(a) * 5], 12)];
  const escut = circ3(bp, (a) => [0 + Math.cos(a) * 9, 44 + Math.sin(a) * 11, bx.z0 - 0.5], 14);
  const inlay: P[] = [bp([-112, 10, bx.z0]), bp([112, 10, bx.z0]), bp([112, 68, bx.z0]), bp([-112, 68, bx.z0])];

  // the robot: yawed toward the box so its left flank shows, a little larger than life-size for a tin toy
  const rp = proj(300, 744, -0.44, 1.12);
  const feet = [cuboid(rp, -46, -6, 0, 12, -26, 22), cuboid(rp, 6, 46, 0, 12, -26, 22)];
  const legs2 = [cuboid(rp, -40, -12, 12, 52, -15, 15), cuboid(rp, 12, 40, 12, 52, -15, 15)];
  const torso = cuboid(rp, -56, 56, 52, 178, -36, 36);
  const neck = cuboid(rp, -14, 14, 178, 190, -12, 12);
  const head = cuboid(rp, -47, 47, 190, 268, -33, 33);
  const fr = (face: "torso" | "head", x: number, y: number): P => rp([x, y, face === "torso" ? -36.5 : -33.5]);
  const eyes = [-21, 21].map((ex) => circ3(rp, (a) => [ex + Math.cos(a) * 13, 236 + Math.sin(a) * 13, -33.5], 22));
  const pupils = [-21, 21].map((ex) => rp([ex + 5, 232, -34]));
  const mouthG: P[] = [fr("head", -20, 204), fr("head", 20, 204), fr("head", 20, 214), fr("head", -20, 214)];
  const plate: P[] = [fr("torso", -38, 92), fr("torso", 38, 92), fr("torso", 38, 162), fr("torso", -38, 162)];
  const dial = circ3(rp, (a) => [-14 + Math.cos(a) * 14, 140 + Math.sin(a) * 14, -37], 20), dialC = rp([-14, 140, -37]), needle = rp([-5, 149, -37]);
  const button = circ3(rp, (a) => [20 + Math.cos(a) * 7, 140 + Math.sin(a) * 7, -37], 14);
  const antenna = [rp([0, 268, 0]), rp([2, 296, 0])], bobble = rp([2, 302, 0]);
  const earL = circ3(rp, (a) => [-47.5, 230 + Math.sin(a) * 11, Math.cos(a) * 11], 16);
  // wind-up key out of the back, turned so its bow shows past the left flank
  const kS = rp([-8, 120, 36]), kE = rp([-8, 120, 70]);
  const kBow = [circ3(rp, (a) => [-8 + Math.cos(a) * 3, 136 + Math.sin(a) * 15, 76], 14), circ3(rp, (a) => [-8 + Math.cos(a) * 3, 104 + Math.sin(a) * 15, 76], 14)];
  // arms: the near-box arm reaches over the rim with a screwdriver; the other hangs, holding a spare cog
  const shR = rp([60, 164, -4]), shL = rp([-60, 164, -4]);
  const tip = drivePt, handR: P = [tip[0] - 24, tip[1] - 22], elbowR: P = [shR[0] + 30, shR[1] + 44];
  const armR = [shR, elbowR, handR], armL = [shL, [shL[0] - 10, shL[1] + 44] as P, [shL[0] - 6, shL[1] + 88] as P];
  const driverH = [lerpP(handR, tip, -0.22), lerpP(handR, tip, 0.42)], driverS = [lerpP(handR, tip, 0.42), tip];
  const cogL = armL[2];

  // the crow, NEARER than the box: walking right along the bench's front edge, tail across the
  // box's corner, head turned back over its shoulder (guilty) with the stolen screw crosswise in its bill
  const cw = (p: P): P => [872 + (p[0] - 853) * 0.74, 798 + (p[1] - 780) * 0.74];     // ~30% smaller than pass 2: the robot and the box stay the story's centre
  const hw = (p: P): P => cw([936 + (p[0] - 936) * 1.25, 500 + (p[1] - 500) * 1.25]);   // the head is a crow's, not a songbird's: big, with a long bill
  const CR = crowGeometry(cw, hw), crowOut = CR.body, headO = CR.head, bill = CR.bill, legBack = CR.legBack, legFront = CR.legFront;
  // cast shadows (hand-placed from the lamp's position) and the loose parts on the bench
  const shRobot: P[] = [[262, 738], [354, 745], [336, 762], [252, 772], [150, 768], [120, 756], [170, 746]];
  const shBox: P[] = [[426, 758], [676, 757], [700, 752], [738, 760], [764, 772], [724, 786], [560, 784], [436, 774]];
  const shCrow: P[] = [[846, 797], [880, 795], [930, 797], [966, 800], [880, 802], [846, 801]];
  const shLamp: P[] = [[748, 646], [780, 642], [792, 650], [764, 656], [730, 654]];
  const parts = { screws: [[[712, 780], [728, 774]], [[748, 790], [762, 790]]] as P[][], cog: [690, 790] as P };

  return { top, nose, apron, drawer, under, legs, win, frame, opening, sill, leftSash, leftGlass, openSash, openGlass, roofs, moon, shadeOut, mouthC, mouth, glow, bulb, baseC, baseTop, baseSide, armLo, armUp, riser, hinge, elbow, sh, box, lidIn, lidEdge, lidPanel, inner, bed, drum, drumEnds, drumC, comb, drivePt, emptyHole, keyShaft, keyBow, escut, inlay, bp, feet, legs2, rp, torso, neck, head, eyes, pupils, mouthG, plate, dial, dialC, needle, button, antenna, bobble, earL, kS, kE, kBow, armR, armL, driverH, driverS, cogL, cw, crowOut, bill, legBack, legFront, headO, CR, shRobot, shBox, shCrow, shLamp, parts };
};

// ---------------------------------------------------------------- the drawing, pass by pass
const draw = (): Sheet => {
  const G = scene(), S = new Sheet();
  const R = (p: P[]) => poly(p);
  const faces = (c: ReturnType<typeof cuboid>, keys: ("front" | "top" | "left" | "right")[]) => union(...keys.map((k) => R(c[k])));
  const robotSil = union(...G.feet.map((f) => faces(f, ["front", "top", "left"])), ...G.legs2.map((f) => faces(f, ["front", "left"])), faces(G.torso, ["front", "top", "left"]), faces(G.neck, ["front", "left"]), faces(G.head, ["front", "top", "left"]), R(tubeAlong(G.armR, 9)), R(tubeAlong(G.armL, 9)), R(tubeAlong(G.antenna, 2.5)), ellipseR(G.bobble[0], G.bobble[1], 7, 7), R(tubeAlong([G.kS, G.kE], 3)), ...G.kBow.map(R));
  const crowSil = crowSilhouette(G.CR), CP = crowPasses(G.CR);
  const inFront = union(crowSil, R(tubeAlong(G.armR, 9)), R(tubeAlong(G.driverH, 4.5)), R(tubeAlong(G.driverS, 2)));
  const RB = (p: P[]) => minus(R(p), inFront);                       // a box surface, minus whatever stands in front of it
  const boxSil = union(R(G.box.front), R(G.box.top), R(G.box.right), R(G.lidIn), R(G.lidEdge));
  const lampSil = union(R(G.shadeOut), R(G.mouth), R(G.armLo), R(G.armUp), R(G.riser), R(G.baseTop), R(G.baseSide));
  const M = G.mouthC, dM = (x: number, y: number) => Math.hypot(x - M[0], y - M[1]);

  // 1 · lay-in: faint graphite construction, ruled freehand past the corners
  S.pass("lay", 0);
  let sd = 1; const box4 = (q: P[]) => q.forEach((p, i) => layLine(S, p, q[(i + 1) % q.length], C.lay, sd++));
  layLine(S, [0, 640], [D, 640], C.lay, sd++); layLine(S, [0, 800], [D, 800], C.lay, sd++); layLine(S, [0, 892], [D, 892], C.lay, sd++);
  box4(G.opening);
  layLine(S, G.hinge, G.elbow, C.lay, sd++); layLine(S, G.elbow, G.sh(0, 0), C.lay, sd++);
  contour(S, G.shadeOut, { w: 1.0, col: C.lay, a: 0.42, seed: sd++, closed: true, seg: 90 });
  contour(S, G.baseTop, { w: 1.0, col: C.lay, a: 0.42, seed: sd++, closed: true, seg: 90 });
  box4(G.box.front); box4(G.box.top); box4(G.lidIn);
  box4(G.torso.front); box4(G.torso.left); box4(G.head.front); box4(G.head.left);
  G.legs2.forEach((l) => box4(l.front)); G.feet.forEach((f) => box4(f.front));
  layLine(S, G.armR[0], G.armR[1], C.lay, sd++); layLine(S, G.armR[1], G.armR[2], C.lay, sd++);
  // the crow found as a gesture: the long line of the back through the tail, head and body masses
  contour(S, ([[905, 500], [840, 566], [760, 626], [672, 712]] as P[]).map(G.cw), { w: 1.0, col: C.lay, a: 0.44, seed: sd++, seg: 120 });
  contour(S, G.headO, { w: 1.0, col: C.lay, a: 0.42, seed: sd++, closed: true, seg: 100 });
  contour(S, ([[905, 520], [930, 600], [900, 690], [820, 716], [760, 700], [800, 600]] as P[]).map(G.cw), { w: 1.0, col: C.lay, a: 0.4, seed: sd++, closed: true, seg: 120 });
  layLine(S, G.bill[0], G.bill[4], C.lay, sd++); layLine(S, G.legBack[0], G.legBack[2], C.lay, sd++); layLine(S, G.legFront[0], G.legFront[2], C.lay, sd++);

  // 2 · the wall at dusk: light pressure dusk-blue, the paper left nearly bare where the lamp spills
  const wall = minus(R([[-10, -10], [D + 10, -10], [D + 10, 640], [-10, 640]]), R(G.frame), R(G.sill), R(G.openSash), lampSil, robotSil, boxSil, crowSil);
  const wallD = (x: number, y: number) => { const lamp = 0.04 + 0.4 * smoothstep(120, 520, dM(x, y)), corner = 0.3 * smoothstep(380, 700, Math.hypot(x - 520, y - 420)), patch = 0.55 + 0.9 * (fractal(91, x, y, 0.006, 0.009, 2) - 0.5); return (lamp + corner) * patch + (y > 612 ? 0.15 : 0); };
  S.pass("wall", 0);
  hatch(S, wall, { ang: ANG, gap: 3.2, len: 38, w: 1.5, col: C.dusk, a: 0.7, seed: 100, dens: wallD });

  // 3 · the sky in the window: indigo above, violet, a rose-gold band; the moon left as paper; roofs
  const sky = minus(R(G.opening), R(G.leftSash), R(G.roofs), G.moon);
  const glass = minus(R(G.leftGlass), R(G.roofs), R([[G.win.x0, 238], [846, 238], [846, 252], [G.win.x0, 252]]));
  S.pass("sky", 1);
  const band = (y: number, c: number, s: number) => Math.exp(-(((y - c) / s) ** 2));
  const skyT = (y: number) => (y - G.win.y0) / (G.win.y1 - G.win.y0);
  hatch(S, union(sky, glass), { ang: ANG, gap: 2.4, len: 30, w: 1.5, col: C.skyTop, a: 0.75, seed: 110, dens: (x, y) => (1 - skyT(y) * 1.15) * (glass.has(x, y) ? 0.7 : 1) });
  hatch(S, union(sky, glass), { ang: ANG, gap: 2.6, len: 30, w: 1.5, col: C.skyMid, a: 0.6, seed: 111, dens: (x, y) => band(skyT(y), 0.55, 0.25) * (glass.has(x, y) ? 0.7 : 1) });
  hatch(S, union(sky, glass), { ang: ANG, gap: 2.4, len: 30, w: 1.5, col: C.skyLow, a: 0.62, seed: 112, dens: (x, y) => band(skyT(y), 0.86, 0.15) * (glass.has(x, y) ? 0.7 : 1) });
  hatch(S, union(sky, glass), { ang: ANG, gap: 2.8, len: 26, w: 1.4, col: C.skyGold, a: 0.6, seed: 113, dens: (x, y) => band(skyT(y), 0.92, 0.08) });
  hatch(S, R(G.roofs), { ang: ANG, gap: 2.2, len: 24, w: 1.5, col: C.roof, a: 0.85, seed: 114, dens: () => 0.95 });
  hatch(S, R(G.roofs), { ang: X2, gap: 3.2, len: 20, w: 1.3, col: C.indigo, a: 0.6, seed: 115, dens: (x, y) => 0.4 + (y - 330) / 160 });
  // the window's painted frame: barely touched, a grey-violet on its shade sides
  const frameWood = minus(union(R(G.frame), R(G.sill)), R(G.opening));
  hatch(S, frameWood, { ang: ANG, gap: 3.4, len: 22, w: 1.2, col: C.violet, a: 0.35, seed: 116, dens: (x, y) => (x > G.win.x1 || y > G.win.y1 + 8 ? 0.8 : 0.3) });
  hatch(S, minus(R(G.leftSash), R(G.leftGlass)), { ang: ANG, gap: 3.4, len: 22, w: 1.2, col: C.violet, a: 0.3, seed: 117, dens: () => 0.35 });
  hatch(S, minus(R(G.openSash), R(G.openGlass)), { ang: ANG, gap: 3, len: 22, w: 1.2, col: C.violet, a: 0.4, seed: 118, dens: () => 0.6 });
  hatch(S, R(G.openGlass), { ang: ANG, gap: 3.0, len: 30, w: 1.3, col: C.skyMid, a: 0.35, seed: 119, dens: (x, y) => 0.35 + 0.3 * skyT(y) });

  // 4 · wood: the bench top pale where the lamp pools, darker to the back and the ends; apron; underneath
  const benchTop = minus(R(G.top), robotSil, boxSil, crowSil, lampSil);
  const pool = (x: number, y: number) => Math.hypot((x - 520) / 330, (y - 715) / 95);
  S.pass("wood", 1);
  hatch(S, benchTop, { ang: ANG, gap: 2.5, len: 30, w: 1.5, col: C.ochre, a: 0.7, seed: 200, dens: (x, y) => 0.14 + 0.55 * smoothstep(0.35, 1.7, pool(x, y)) + 0.2 * smoothstep(700, 645, y) });
  hatch(S, R(G.nose), { ang: ANG, gap: 3, len: 14, w: 1.3, col: C.ochre, a: 0.5, seed: 201, dens: () => 0.5 });
  hatch(S, minus(R(G.apron), R(G.drawer)), { ang: ANG, gap: 2.2, len: 30, w: 1.6, col: C.ochre, a: 0.85, seed: 202, dens: () => 0.95 });
  hatch(S, R(G.drawer), { ang: ANG, gap: 2.4, len: 30, w: 1.5, col: C.ochre, a: 0.8, seed: 203, dens: (x, y) => 0.7 + 0.3 * smoothstep(850, 880, y) });
  const legsR = union(...G.legs.map(R)), underR = minus(R(G.under), legsR);
  hatch(S, underR, { ang: ANG, gap: 2.2, len: 36, w: 1.7, col: C.walnut, a: 0.8, seed: 204, dens: (x, y) => 0.75 + 0.25 * smoothstep(1000, 900, y) });
  hatch(S, legsR, { ang: -1.45, gap: 2.2, len: 40, w: 1.6, col: C.umber, a: 0.9, seed: 205, dens: () => 0.9 });
  // the lamp base and the far window sill are wood too? no: the base is enamel, done with the lamp

  // 5 · the music box: mahogany body, red felt in the lid, brass movement inside
  const boxFront = RB(G.box.front), boxRight = RB(G.box.right), rim = minus(RB(G.box.top), RB(G.inner));
  const dF = edgeDist(G.box.front);
  S.pass("box", 1);
  const tB = segD(G.box.front[3], G.box.front[2]);
  hatch(S, boxFront, { ang: ANG, gap: 2.3, len: 26, w: 1.5, col: C.mahog, a: 1, seed: 300, dens: (x, y) => 0.7 + 0.3 * smoothstep(14, 0, dF(x, y)) - 0.5 * smoothstep(12, 1, tB(x, y)) });
  hatch(S, boxRight, { ang: ANG, gap: 2.2, len: 20, w: 1.5, col: C.mahog, a: 0.9, seed: 301, dens: () => 1 });
  hatch(S, rim, { ang: ANG, gap: 3, len: 14, w: 1.2, col: C.mahog, a: 0.55, seed: 302, dens: () => 0.45 });
  hatch(S, minus(RB(G.lidIn), RB(G.lidPanel)), { ang: ANG, gap: 2.4, len: 22, w: 1.4, col: C.mahog, a: 1, seed: 303, dens: () => 0.9 });
  hatch(S, RB(G.lidEdge), { ang: ANG, gap: 3, len: 12, w: 1.2, col: C.mahog, a: 0.5, seed: 304, dens: () => 0.4 });
  hatch(S, RB(G.lidPanel), { ang: ANG, gap: 2.3, len: 24, w: 1.5, col: C.lining, a: 1, seed: 305, dens: (x, y) => { const q = G.lidPanel, t = (y - q[2][1]) / (q[0][1] - q[2][1]); return 0.5 + 0.5 * t; } });
  const interior = RB(G.inner);
  hatch(S, interior, { ang: ANG, gap: 2.4, len: 22, w: 1.4, col: C.umber, a: 0.8, seed: 306, dens: () => 0.85 });
  const inBox = (r: Region): Region => ({ box: r.box, has: (x, y) => r.has(x, y) && interior.has(x, y) });
  hatch(S, inBox(RB(G.bed)), { ang: ANG, gap: 2.4, len: 18, w: 1.4, col: C.brass, a: 0.85, seed: 307, dens: () => 0.9 });
  hatch(S, inBox(RB(G.drum)), { ang: ANG, gap: 2.2, len: 14, w: 1.4, col: C.brass, a: 0.9, seed: 308, dens: (x, y) => { const tp = G.drum[0][1]; return 0.35 + 0.65 * smoothstep(tp + 4, tp + 22, y); } });
  hatch(S, inBox(RB(G.comb)), { ang: ANG, gap: 2.6, len: 14, w: 1.3, col: C.steel, a: 0.7, seed: 309, dens: () => 0.7 });
  hatch(S, union(...G.keyBow.map(R), R(tubeAlong(G.keyShaft, 2.5))), { ang: ANG, gap: 2, len: 10, w: 1.3, col: C.brass, a: 0.9, seed: 310, dens: () => 0.9 });
  hatch(S, R(G.escut), { ang: ANG, gap: 2, len: 8, w: 1.2, col: C.brass, a: 0.9, seed: 311, dens: () => 0.9 });

  // 6 · the robot: teal tin, the top faces barely pressed, the lit front medium, the far flank full
  const rTop = union(R(G.head.top), R(G.torso.top), ...G.feet.map((f) => R(f.top)));
  const rFront = union(R(G.head.front), R(G.torso.front), R(G.neck.front), ...G.legs2.map((l) => R(l.front)), ...G.feet.map((f) => R(f.front)));
  const rLeft = union(R(G.head.left), R(G.torso.left), R(G.neck.left), ...G.legs2.map((l) => R(l.left)), ...G.feet.map((f) => R(f.left)));
  const eyesR = union(...G.eyes.map(R));
  const dT = edgeDist(G.torso.front), dH = edgeDist(G.head.front);
  const tT = segD(G.torso.front[3], G.torso.front[2]), tH = segD(G.head.front[3], G.head.front[2]);
  const frontD = (x: number, y: number) => { const e = Math.min(dT(x, y), dH(x, y)), top = Math.min(tT(x, y), tH(x, y)); return 0.5 + 0.4 * smoothstep(16, 0, e) + 0.1 * smoothstep(420, 700, y) - 0.45 * smoothstep(16, 2, top); };
  S.pass("robot", 1);
  hatch(S, rTop, { ang: ANG, gap: 3.2, len: 16, w: 1.2, col: C.teal, a: 0.55, seed: 400, dens: () => 0.4 });
  hatch(S, minus(rFront, eyesR, R(G.plate)), { ang: ANG, gap: 2.3, len: 24, w: 1.5, col: C.teal, a: 0.8, seed: 401, dens: frontD });
  hatch(S, R(G.plate), { ang: ANG, gap: 2.6, len: 20, w: 1.4, col: C.teal, a: 0.6, seed: 402, dens: () => 0.55 });
  const armLR = R(tubeAlong(G.armL, 9)), rLeftV = minus(rLeft, armLR);
  hatch(S, rLeftV, { ang: ANG, gap: 2.1, len: 22, w: 1.6, col: C.teal, a: 0.9, seed: 403, dens: () => 1 });
  hatch(S, union(R(tubeAlong(G.armR, 8)), R(tubeAlong(G.armL, 8))), { ang: ANG, gap: 2.2, len: 12, w: 1.3, col: C.steel, a: 0.8, seed: 404, dens: () => 0.8 });
  hatch(S, union(...G.kBow.map(R), R(tubeAlong([G.kS, G.kE], 3))), { ang: ANG, gap: 2, len: 10, w: 1.3, col: C.brass, a: 0.9, seed: 405, dens: () => 0.9 });
  hatch(S, union(ellipseR(G.bobble[0], G.bobble[1], 7, 7), R(G.button), R(tubeAlong(G.driverH, 4))), { ang: ANG, gap: 1.8, len: 8, w: 1.3, col: C.tinRed, a: 0.95, seed: 406, dens: () => 1 });
  hatch(S, R(G.dial), { ang: ANG, gap: 3, len: 10, w: 1.1, col: C.pale, a: 0.6, seed: 407, dens: () => 0.6 });
  hatch(S, eyesR, { ang: ANG, gap: 2.6, len: 10, w: 1.2, col: C.pale, a: 0.7, seed: 408, dens: () => 0.75 });
  hatch(S, R(G.earL), { ang: ANG, gap: 2, len: 8, w: 1.3, col: C.steel, a: 0.8, seed: 409, dens: () => 0.9 });

  // 7 · the lamp: brick-red enamel shade and base, steel arms, the bulb's mouth left almost paper
  const shadeR = minus(R(G.shadeOut), R(G.glow));
  const dS = edgeDist(G.shadeOut);
  S.pass("lamp", 1);
  hatch(S, shadeR, { ang: ANG, gap: 2.2, len: 22, w: 1.5, col: C.shade, a: 1, seed: 500, dens: (x, y) => 0.6 + 0.4 * smoothstep(12, 0, dS(x, y)) - 0.3 * smoothstep(40, 0, Math.hypot(x - G.sh(10, 0)[0], y - G.sh(10, 0)[1])) });
  hatch(S, union(R(G.baseTop), R(G.baseSide)), { ang: ANG, gap: 2.2, len: 18, w: 1.5, col: C.shade, a: 1, seed: 501, dens: (x, y) => (poly(G.baseTop).has(x, y) ? 0.55 : 1) });
  hatch(S, R(G.baseSide), { ang: X2, gap: 2.6, len: 14, w: 1.3, col: C.shadeDk, a: 0.8, seed: 504, dens: () => 0.8 });
  hatch(S, union(R(G.armLo), R(G.armUp), R(G.riser)), { ang: ANG, gap: 2, len: 10, w: 1.2, col: C.steel, a: 1, seed: 502, dens: () => 1 });
  hatch(S, R(G.glow), { ang: ANG, gap: 3.2, len: 14, w: 1.2, col: C.pale, a: 0.5, seed: 503, dens: () => 0.5 });

  // 8 · the crow: its own module (colouredPencilCrow.ts), worked feather group by feather group
  S.pass("crow", 1);
  CP.base(S);
  // the loose parts on the bench, same pencil family as the box's movement
  hatch(S, union(...G.parts.screws.map((s) => R(tubeAlong(s, 2)))), { ang: ANG, gap: 1.6, len: 6, w: 1.1, col: C.screw, a: 0.9, seed: 604, dens: () => 0.9 });
  hatch(S, ellipseR(G.parts.cog[0], G.parts.cog[1], 12, 5), { ang: ANG, gap: 1.8, len: 8, w: 1.2, col: C.brass, a: 0.9, seed: 605, dens: () => 0.9 });
  hatch(S, ellipseR(G.cogL[0] - 2, G.cogL[1] + 8, 10, 10), { ang: ANG, gap: 1.8, len: 8, w: 1.2, col: C.brass, a: 0.9, seed: 606, dens: () => 0.9 });

  // 9 · second hues, hatched over the first: this is where the colour gets its depth
  S.pass("layer", 1);
  hatch(S, wall, { ang: ANG + 0.08, gap: 3.4, len: 30, w: 1.4, col: C.violet, a: 0.5, seed: 700, dens: (x, y) => 0.7 * smoothstep(320, 640, dM(x, y)) * (0.4 + 0.6 * Math.min(1, Math.hypot(x - 540, y - 300) / 520)) });
  hatch(S, benchTop, { ang: ANG + 0.06, gap: 3, len: 28, w: 1.4, col: C.woodRed, a: 0.55, seed: 701, dens: (x, y) => 0.15 + 0.6 * smoothstep(0.7, 1.7, pool(x, y)) });
  hatch(S, minus(R(G.apron), R(G.drawer)), { ang: ANG + 0.06, gap: 2.6, len: 30, w: 1.5, col: C.woodRed, a: 0.7, seed: 702, dens: () => 0.75 });
  hatch(S, R(G.drawer), { ang: ANG + 0.06, gap: 3, len: 30, w: 1.4, col: C.woodRed, a: 0.6, seed: 703, dens: () => 0.5 });
  hatch(S, union(boxFront, boxRight), { ang: ANG + 0.05, gap: 2.8, len: 24, w: 1.4, col: C.lining, a: 0.55, seed: 704, dens: (x, y) => (boxRight.has(x, y) ? 0.9 : 0.35 + 0.4 * smoothstep(14, 0, dF(x, y))) });
  hatch(S, rLeftV, { ang: ANG + 0.07, gap: 2.4, len: 22, w: 1.5, col: C.tBlue, a: 0.8, seed: 705, dens: () => 0.9 });
  hatch(S, minus(rFront, eyesR, R(G.plate)), { ang: ANG + 0.07, gap: 2.8, len: 22, w: 1.4, col: C.tBlue, a: 0.6, seed: 706, dens: (x, y) => 0.1 + 0.55 * smoothstep(12, 0, Math.min(dT(x, y), dH(x, y))) + 0.25 * smoothstep(300, 250, x) });
  hatch(S, rTop, { ang: ANG, gap: 3.4, len: 14, w: 1.2, col: C.pale, a: 0.6, seed: 707, dens: () => 0.6 });
  hatch(S, shadeR, { ang: ANG + 0.06, gap: 2.8, len: 20, w: 1.4, col: C.shadeDk, a: 0.6, seed: 710, dens: (x, y) => smoothstep(0, 40, (x - G.mouthC[0]) * 0.96 - (y - G.mouthC[1]) * 0.28 + 30) });
  hatch(S, RB(G.lidPanel), { ang: ANG + 0.06, gap: 2.8, len: 20, w: 1.4, col: C.shadeDk, a: 0.5, seed: 711, dens: (x, y) => 0.6 * smoothstep(560, 640, y) });
  hatch(S, inBox(union(RB(G.drum), RB(G.bed))), { ang: ANG + 0.06, gap: 3, len: 12, w: 1.3, col: C.amber, a: 0.6, seed: 712, dens: () => 0.6 });

  // 10 · darks: cast shadows and the deepest places, cross-hatched in a second direction, never filled
  S.pass("darks", 2);
  const shadowTone = (col: string, seed: number, reg: Region, d = 0.9) => { hatch(S, reg, { ang: ANG, gap: 2.4, len: 22, w: 1.5, col, a: 0.75, seed, dens: () => d }); hatch(S, reg, { ang: X2, gap: 3, len: 22, w: 1.4, col, a: 0.6, seed: seed + 1, dens: () => d * 0.85 }); hatch(S, reg, { ang: ANG + 0.35, gap: 3.2, len: 20, w: 1.4, col: C.tBlue, a: 0.5, seed: seed + 50, dens: () => d * 0.75 }); };
  shadowTone(C.walnut, 800, minus(R(G.shRobot), robotSil));
  shadowTone(C.walnut, 802, minus(R(G.shBox), boxSil));
  shadowTone(C.walnut, 804, minus(R(G.shCrow), crowSil));
  shadowTone(C.walnut, 806, minus(R(G.shLamp), lampSil), 0.7);
  hatch(S, underR, { ang: X2, gap: 2.8, len: 34, w: 1.6, col: C.umberDk, a: 0.7, seed: 808, dens: (x, y) => 0.35 + 0.55 * smoothstep(1010, 900, y) });
  hatch(S, legsR, { ang: X2, gap: 3, len: 20, w: 1.3, col: C.umberDk, a: 0.6, seed: 807, dens: (x) => 0.7 * smoothstep(18, 54, x < 540 ? x - 46 : x - 980) });
  hatch(S, R([[-10, 892], [D + 10, 892], [D + 10, 920], [-10, 920]]), { ang: ANG + 0.5, gap: 3, len: 24, w: 1.4, col: C.blueBlack, a: 0.6, seed: 809, dens: () => 0.8 });
  hatch(S, interior, { ang: X2, gap: 2.6, len: 18, w: 1.4, col: C.walnut, a: 0.7, seed: 810, dens: (x, y) => 0.5 + 0.4 * smoothstep(G.inner[3][1], G.inner[0][1], y) });
  hatch(S, rLeftV, { ang: X2, gap: 2.8, len: 18, w: 1.3, col: C.tDeep, a: 0.7, seed: 813, dens: () => 0.75 });
  hatch(S, union(R(tubeAlong(G.armL, 8)), R(tubeAlong(G.armR, 8))), { ang: X2, gap: 3, len: 10, w: 1.2, col: C.tDeep, a: 0.6, seed: 819, dens: () => 0.6 });
  hatch(S, union(RB(G.box.right), R(tubeAlong([...G.box.front.slice(0, 2)], 5))), { ang: X2, gap: 2.8, len: 16, w: 1.3, col: C.walnut, a: 0.65, seed: 814, dens: () => 0.8 });
  hatch(S, R(G.mouthG), { ang: X2, gap: 1.8, len: 10, w: 1.3, col: C.tDeep, a: 0.9, seed: 815, dens: () => 1 });
  // the drawer's gap and the underside of the bench nose
  hatch(S, R([[640, 878], [900, 878], [900, 883], [640, 883]]), { ang: X2, gap: 1.6, len: 30, w: 1.3, col: C.walnut, a: 0.8, seed: 817, dens: () => 1 });
  hatch(S, R([[-10, 810], [D + 10, 810], [D + 10, 818], [-10, 818]]), { ang: X2, gap: 2, len: 30, w: 1.3, col: C.walnut, a: 0.6, seed: 818, dens: () => 0.8 });
  // the robot's pupils: tiny cross-hatched darks
  G.pupils.forEach((p, i) => { hatch(S, ellipseR(p[0], p[1], 5.5, 5.5), { ang: ANG, gap: 1.4, len: 8, w: 1.2, col: C.blueBlack, a: 0.95, seed: 820 + i, dens: () => 1 }); hatch(S, ellipseR(p[0], p[1], 5.5, 5.5), { ang: X2, gap: 1.6, len: 8, w: 1.1, col: C.blueBlack, a: 0.9, seed: 824 + i, dens: () => 1 }); });

  // 11 · contours: sparse, thin, a darker pencil; heavier on the shade side, lost where the light is
  S.pass("line", 1);
  const ln = (pts: P[], seed: number, o: { w?: number; a?: number; col?: string; closed?: boolean; keep?: (x: number, y: number) => boolean; seg?: number; skip?: number; smooth?: boolean } = {}) => contour(S, pts, { w: o.w ?? 1.25, col: o.col ?? C.sepia, a: o.a ?? 0.8, seed, closed: o.closed, keep: o.keep, seg: o.seg ?? 50, skip: o.skip ?? 0.08, smooth: o.smooth ?? true });
  const edge = (a: P, b: P, seed: number, o: { w?: number; a?: number; col?: string } = {}) => ln([a, b], seed, { ...o, smooth: false, skip: 0 });
  // bench: the top's front edge, two plank seams, a few grain lines, drawer and knob
  edge([-10, 800], [D + 10, 800], 900, { w: 1.3 }); edge([-10, 892], [D + 10, 892], 901, { w: 1.1, a: 0.6 });
  [[690, 0.5], [742, 0.6]].forEach(([y, a], i) => ln([[-10, y], [300, y + 1], [700, y - 1], [D + 10, y]], 902 + i, { w: 1.0, a, col: C.umber, skip: 0.25, seg: 80 }));
  [[660, 40, 330], [715, 380, 640], [770, 60, 280], [725, 820, 1070], [672, 700, 960]].forEach(([y, x0, x1], i) => ln([[x0, y], [(x0 + x1) / 2, y + 3], [x1, y - 1]], 910 + i, { w: 0.9, a: 0.45, col: C.umber, skip: 0.3, seg: 70 }));
  G.legs.forEach((l, i) => { edge(l[1], [l[1][0], D], 926 + i, { w: 1.1, a: 0.6 }); edge(l[0], [l[0][0], D], 928 + i, { w: 0.9, a: 0.4 }); });
  ln([...G.drawer, G.drawer[0]], 920, { w: 1.1, a: 0.7, smooth: false }); dot(S, 770, 850, 6, C.brassDk, 0.9, 1.6); dot(S, 770, 850, 3, C.sepia, 0.9);
  // window: the mullion, the glazing bar, the open casement's edges, sill underside
  ln([...G.leftSash, G.leftSash[0]], 921, { w: 1.0, a: 0.55, smooth: false, skip: 0.2 }); edge([G.win.x0, 245], [846, 245], 922, { w: 1, a: 0.5 });
  ln([...G.openSash, G.openSash[0]], 923, { w: 1.0, a: 0.55, smooth: false, skip: 0.15 }); edge(G.sill[3], G.sill[2], 924, { w: 1.1, a: 0.6 });
  ln([...G.frame, G.frame[0]], 925, { w: 0.9, a: 0.4, smooth: false, skip: 0.35 });
  // lamp: the shade's shaded side, the rim of the mouth, the arm's rods and the spring
  ln(G.shadeOut.slice(G.shadeOut.length / 2), 930, { w: 1.3, a: 0.8 }); ln(G.mouth.filter((_, i) => i < 16), 931, { w: 1.2, a: 0.75 });
  ln([G.hinge, G.elbow], 932, { w: 1.0, a: 0.7 }); ln([G.elbow, G.sh(-4, 0)], 933, { w: 1.0, a: 0.7 });
  const coil: P[] = []; { const dx = G.elbow[0] - G.hinge[0], dy = G.elbow[1] - G.hinge[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l; for (let k = 0; k <= 70; k++) { const t = k / 70, p = lerpP(G.hinge, G.elbow, 0.08 + t * 0.32), c = Math.cos(t * 60) * 3; coil.push([p[0] + nx * (7 + c), p[1] + ny * (7 + c)]); } }
  S.line(coil, 0.9, C.steel, 0.8); dot(S, G.elbow[0], G.elbow[1], 5, C.sepia, 0.8, 1.4); dot(S, G.hinge[0], G.hinge[1], 5, C.sepia, 0.8, 1.4);
  ln(G.baseSide.slice(15), 934, { w: 1.2, a: 0.75 });
  // box: base line, the lid's top edge, the rim, inlay, keyhole, comb teeth, drum pins
  edge(G.box.front[0], G.box.front[1], 940, { w: 1.4 }); edge(G.box.front[1], G.box.right[1], 941, { w: 1.3 }); edge(G.box.front[1], G.box.front[2], 942, { w: 1.1, a: 0.7 });
  edge(G.box.front[3], G.box.front[2], 943, { w: 1.0, a: 0.55 }); ln([...G.inner, G.inner[0]], 944, { w: 1.0, a: 0.6, smooth: false, skip: 0.1 });
  ln([...G.lidEdge, G.lidEdge[0]], 945, { w: 1.1, a: 0.7, smooth: false }); ln([...G.lidPanel, G.lidPanel[0]], 946, { w: 0.9, a: 0.5, smooth: false, skip: 0.2 });
  ln([...G.inlay, G.inlay[0]], 947, { w: 0.8, a: 0.45, col: C.brassDk, smooth: false, skip: 0.25 });
  dot(S, G.escut[0][0] - 9, (G.escut[3][1] + G.escut[10][1]) / 2, 2.4, C.sepia, 0.95, 1.4);
  for (let i = 0; i < 18; i++) { const a = G.bp([-66 + i * 8, 64, -10]), b = G.bp([-66 + i * 8, 66, 3]); if (interior.has(a[0], a[1]) && interior.has(b[0], b[1])) S.line([a, b], 0.9, C.sepia, 0.7); }
  for (let i = 0; i < 26; i++) { const p = G.bp(G.drumC(-78 + i * 6 + ((i * 7) % 5))), dy = ((i * 11) % 7) - 4; if (interior.has(p[0], p[1] + dy * 0.5)) dot(S, p[0], p[1] + dy * 0.5, 1.2, C.brassDk, 0.9, 1); }
  G.drumEnds.forEach((e, i) => ln([...e, e[0]], 948 + i, { w: 1, a: 0.6, keep: (x, y) => interior.has(x, y) }));
  ln([G.keyShaft[0], G.keyShaft[1]], 950, { w: 1, a: 0.7 }); G.keyBow.forEach((k, i) => ln([...k, k[0]], 951 + i, { w: 0.9, a: 0.7 }));
  dot(S, G.drivePt[0], G.drivePt[1], 3.4, C.sepia, 0.9, 1.3);
  { const h = ring(G.emptyHole[0], G.emptyHole[1], 3.4, 2.4, 12); ln([...h, h[0]], 1104, { w: 0.9, a: 0.9, skip: 0 }); dot(S, G.emptyHole[0], G.emptyHole[1], 1, C.blueBlack, 0.9, 1); }
  // robot: the edges between faces, silhouette on the shade side, eyes, plate, rivets, hose rings
  const cube = (c: ReturnType<typeof cuboid>, seed: number, w = 1.2) => { edge(c.front[3], c.front[0], seed, { w: w + 0.2 }); edge(c.front[0], c.front[1], seed + 1, { w }); edge(c.left[0], c.left[1], seed + 2, { w }); edge(c.left[0], c.left[3], seed + 3, { w: w + 0.2 }); edge(c.front[3], c.front[2], seed + 4, { w: w * 0.8, a: 0.55 }); edge(c.top[3], c.top[0], seed + 5, { w: w * 0.8, a: 0.5 }); edge(c.front[1], c.front[2], seed + 6, { w: w * 0.8, a: 0.45 }); };
  cube(G.head, 960); cube(G.torso, 970); cube(G.neck, 980, 0.9); G.legs2.forEach((l, i) => cube(l, 990 + i * 10, 1)); G.feet.forEach((f, i) => cube(f, 1010 + i * 10, 1.1));
  G.eyes.forEach((e, i) => ln([...e, e[0]], 1030 + i, { w: 1.3, a: 0.85, skip: 0 }));
  G.eyes.forEach((e, i) => { const c = e.reduce((s, p) => [s[0] + p[0] / e.length, s[1] + p[1] / e.length] as P, [0, 0] as P); ln(e.slice(1, 9).map(([x, y]) => [c[0] + (x - c[0]) * 0.72, c[1] + (y - c[1]) * 0.72] as P), 1032 + i, { w: 0.9, a: 0.45, skip: 0 }); });
  ln([...G.plate, G.plate[0]], 1034, { w: 1.0, a: 0.7, smooth: false }); ln([...G.dial, G.dial[0]], 1035, { w: 1.0, a: 0.8 }); S.line([G.dialC, G.needle], 1.1, C.tinRed, 0.9);
  ln([...G.button, G.button[0]], 1036, { w: 0.9, a: 0.7 }); ln([...G.mouthG, G.mouthG[0]], 1037, { w: 1.0, a: 0.8, smooth: false });
  for (let i = 1; i < 6; i++) { const a = lerpP(G.mouthG[0], G.mouthG[1], i / 6), b = lerpP(G.mouthG[3], G.mouthG[2], i / 6); S.line([a, b], 0.9, C.pale, 0.7); }
  // rivets down the torso's front seams and at the head's corners
  [[-50, 58], [50, 58], [-50, 172], [50, 172], [-50, 115], [50, 115]].forEach(([x, y]) => { const p = G.rp([x, y, -36.5]); dot(S, p[0], p[1], 1.7, C.tDeep, 0.9, 1.1); });
  [[-41, 196], [41, 196], [-41, 262], [41, 262]].forEach(([x, y]) => { const p = G.rp([x, y, -33.5]); dot(S, p[0], p[1], 1.6, C.tDeep, 0.9, 1.1); });
  // the chest plate's speaker slots
  [102, 110, 118].forEach((y) => S.line([G.rp([-30, y, -37]), G.rp([30, y, -37])], 1.1, C.tDeep, 0.7));
  ln(G.earL.concat([G.earL[0]]), 1038, { w: 1, a: 0.7 });
  ln([G.antenna[0], G.antenna[1]], 1039, { w: 1.1, a: 0.85 }); dot(S, G.bobble[0] - 2, G.bobble[1] - 2, 2, C.pale, 0.9);
  [G.armR, G.armL].forEach((sm) => { for (let k = 1; k < 9; k++) { const t = k / 9, seg = t < 0.5 ? 0 : 1, f = t < 0.5 ? t * 2 : (t - 0.5) * 2, a = sm[seg], b = sm[seg + 1], p = lerpP(a, b, f), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); S.line([[p[0] - (dy / l) * 8, p[1] + (dx / l) * 8], [p[0] + dx / l * 1.5, p[1] + dy / l * 1.5], [p[0] + (dy / l) * 8, p[1] - (dx / l) * 8]], 0.9, C.tDeep, 0.6); } });
  ln(tubeAlong(G.armR, 8).slice(0, 3), 1040, { w: 1.1, a: 0.7, smooth: false }); ln(tubeAlong(G.armL, 8).slice(0, 3), 1041, { w: 1.2, a: 0.75, smooth: false });
  // pincers: two short claws closing on the screwdriver; the other hand round a cog
  const pinc = (h: P, dir: number, seed: number) => { const c = Math.cos(dir), s = Math.sin(dir); ln([[h[0], h[1]], [h[0] + c * 10 - s * 6, h[1] + s * 10 + c * 6], [h[0] + c * 16 - s * 2, h[1] + s * 16 + c * 2]], seed, { w: 1.6, a: 0.9, col: C.tDeep, skip: 0 }); ln([[h[0], h[1]], [h[0] + c * 10 + s * 6, h[1] + s * 10 - c * 6], [h[0] + c * 16 + s * 2, h[1] + s * 16 - c * 2]], seed + 1, { w: 1.6, a: 0.9, col: C.tDeep, skip: 0 }); };
  pinc(G.armR[2], Math.atan2(G.drivePt[1] - G.armR[2][1], G.drivePt[0] - G.armR[2][0]), 1042); pinc(G.armL[2], 1.7, 1044);
  S.line(G.driverS, 1.6, C.steel, 0.95); ln([G.driverH[0], G.driverH[1]], 1046, { w: 1, a: 0.6 });
  const cogR = ring(G.cogL[0] - 2, G.cogL[1] + 8, 10, 10, 16); ln([...cogR, cogR[0]], 1047, { w: 0.9, a: 0.7, col: C.brassDk }); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; S.line([[G.cogL[0] - 2 + Math.cos(a) * 10, G.cogL[1] + 8 + Math.sin(a) * 10], [G.cogL[0] - 2 + Math.cos(a) * 13.5, G.cogL[1] + 8 + Math.sin(a) * 13.5]], 1.8, C.brassDk, 0.9); }
  ln([G.kS, G.kE], 1048, { w: 1, a: 0.7 }); G.kBow.forEach((k, i) => ln([...k, k[0]], 1049 + i, { w: 1, a: 0.8 }));
  // parts on the bench
  G.parts.screws.forEach((s, i) => { ln(s, 1110 + i, { w: 0.9, a: 0.8, skip: 0 }); dot(S, s[0][0], s[0][1], 2.6, C.sepia, 0.8, 1.1); });
  const cogB = ring(G.parts.cog[0], G.parts.cog[1], 12, 5, 18); ln([...cogB, cogB[0]], 1115, { w: 0.9, a: 0.7, col: C.brassDk }); dot(S, G.parts.cog[0], G.parts.cog[1], 2, C.sepia, 0.8);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; S.line([[G.parts.cog[0] + Math.cos(a) * 12, G.parts.cog[1] + Math.sin(a) * 5], [G.parts.cog[0] + Math.cos(a) * 15, G.parts.cog[1] + Math.sin(a) * 6.3]], 1.5, C.brassDk, 0.85); }

  // 12 · the lamp's halo: yellow over near-bare paper, strongest at the mouth, and the pool it throws
  S.pass("halo", 1);
  const haloR = minus(ellipseR(M[0], M[1] + 10, 210, 210), R(G.shadeOut), robotSil, boxSil, R(G.armUp));
  hatch(S, haloR, { ang: ANG, gap: 2.6, len: 22, w: 1.4, col: C.yellow, a: 0.7, seed: 1200, dens: (x, y) => Math.pow(1 - smoothstep(30, 210, dM(x, y)), 1.4) });
  hatch(S, haloR, { ang: ANG + 0.25, gap: 3.4, len: 18, w: 1.3, col: C.amber, a: 0.45, seed: 1201, dens: (x, y) => Math.pow(1 - smoothstep(40, 130, dM(x, y)), 1.6) });
  hatch(S, R(G.glow), { ang: ANG, gap: 2.4, len: 14, w: 1.3, col: C.yellow, a: 0.8, seed: 1202, dens: () => 0.8 });
  hatch(S, union(benchTop, minus(RB(G.box.top), RB(G.inner))), { ang: ANG, gap: 3, len: 26, w: 1.4, col: C.yellow, a: 0.5, seed: 1203, dens: (x, y) => 0.7 * (1 - smoothstep(0.2, 1.1, pool(x, y))) });
  hatch(S, union(rTop, RB(G.lidEdge)), { ang: ANG, gap: 3.4, len: 14, w: 1.2, col: C.yellow, a: 0.5, seed: 1204, dens: () => 0.5 });
  S.into("layer"); CP.layer(S); S.into("darks"); CP.darks(S); S.into("line"); CP.line(S);
  return S;
};

// ---------------------------------------------------------------- the process, on the beat grid
// 540 frames = 18 s at 30 fps. Frame 0 is the bare sheet; every pass starts on a multiple of 5;
// the drawing is finished at 505 and the last 35 frames hold the finished sheet.
const CUES: Cue[] = [
  { pass: "lay", start: 5, end: 45 },
  { pass: "wall", start: 50, end: 115 },
  { pass: "sky", start: 120, end: 150 },
  { pass: "wood", start: 155, end: 205 },
  { pass: "box", start: 210, end: 240 },
  { pass: "robot", start: 245, end: 285 },
  { pass: "lamp", start: 290, end: 305 },
  { pass: "crow", start: 310, end: 345 },
  { pass: "layer", start: 350, end: 395 },
  { pass: "darks", start: 400, end: 440 },
  { pass: "line", start: 445, end: 485 },
  { pass: "halo", start: 490, end: 505 },
];
const N = 540;
CUES.forEach((c, i) => { if (c.start % 5 || c.end % 5 || c.end <= c.start || c.end > N - 30 || (i && c.start < CUES[i - 1].end)) throw new Error(`colouredPencil cue ${c.pass} off the grid`); });

const R = replay({ D, ang: ANG, paper: PAPER, sheet: draw, cues: CUES, key: "tinRepairman-v3", view: { zoom: 1.34, cx: 580, cy: 568 } });

export const STYLE = { id: "colouredPencil", name: "Coloured pencil", family: "dry media", medium: "wax coloured pencils hatched in one diagonal on toothy cream cartridge paper, hues layered, darks cross-hatched", nearest: "balloon (crayon)", hero: "a wind-up tin robot mending a music box while a crow steals a screw" };

export const colouredPencil: Film = {
  meta: { title: "The tin repairman · coloured pencil", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N, raster: "cpu", kind: "drawing", holds: [[N - 35, N]] },
  assets: { images: {} },
  shots: [{ id: "drawing", start: 0, end: N, draw: (ctx, f, env) => R.draw(ctx, f, env) }],
};
