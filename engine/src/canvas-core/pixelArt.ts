// PIXEL ART · "the pounce". A cat mid-leap after fireflies in a moonlit garden.
//
// MEDIUM (physical): pixels are LAID, not drawn. A 120 x 120 grid of cells, each exactly one of
// sixteen palette colours declared below, blown up by a whole number with smoothing off. No
// anti-aliasing, no taper, no wobble, no paper: the machine crispness every other plate fights
// is the medium here. A half tint is a 2x2 ordered dither, never an alpha blend.
// MARKS: the single cell (pencil tool), the bucket fill, the dither cluster. EDGE: the staircase,
// kept clean: consistent run lengths along a curve (1-1-2-2-3, never 2-1-3), no doubled corners,
// no orphan cells. ORDER (how a pixel artist works, and how the film plays): flat mid-colour
// blocking with the pencil + bucket -> line cleanup of the silhouettes -> shading clusters and
// the sky's dither bands -> highlights and moon rim light -> fireflies and their glow dither LAST.
// Each pass advances in cels held for 3 frames (a 10 fps feel, 3 divides the 15-frame beat).
// PALETTE: sixteen, below. GROUND: the empty screen (colour 0).
// LIGHT: the fireflies are the light. The moon behind upper left gives only a cool rim along the
// cat's back and the hedge top, so the cat reads as a near-silhouette lit warm where it meets
// the fireflies (paw, whiskers, eyeshine).
// SUBJECT + REALISM: a domestic cat in a rising leap, side view facing right (reference: from
// knowledge of Muybridge's cat plates and the common leap: hind legs fully extended behind at
// push-off, spine stretched, forelegs reaching forward-up with the paws opening, ears pricked
// forward, tail trailing as a counterweight). Long lean body, small head (about a fifth of body
// length), ears triangular with the far ear showing behind.
// NOT ITS NEAREST NEIGHBOUR (koi, marker comic): no contour stroke at all, no thick-thin, no hard
// cel shadow painted as a shape: the cell is the mark, the staircase the edge, the dither the tone.
import type { Film } from "./film";
import { blit, celPlan, cleanMask, limb, PixelDraft } from "./pixelArtKit";

export const PALETTE = [
  "#07080f", // 0 void
  "#10152b", // 1 deep sky
  "#1a2446", // 2 sky
  "#283a66", // 3 low sky
  "#3f5b8c", // 4 moon haze
  "#8ea9d0", // 5 cool rim, stars
  "#e8eef5", // 6 moon
  "#0c1a17", // 7 lawn
  "#16302a", // 8 foliage dark
  "#255040", // 9 foliage mid
  "#5b8f47", // 10 leaf lit by a firefly
  "#1c1626", // 11 cat body
  "#3a2c42", // 12 cat lit fur
  "#a86424", // 13 glow outer
  "#f0b848", // 14 glow
  "#fff4bf", // 15 firefly core
];
const G = 120;
type Pt = [number, number];

// ---------------------------------------------------------------- the cat, in grid coordinates
// Authored in a body frame: u runs hip -> shoulder along the spine, v is perpendicular, + toward
// the belly. The spine is pitched 16 degrees up: a rising leap, the head lifted a further 12.
const HIP: Pt = [38, 64], TH = (16 * Math.PI) / 180, du: Pt = [Math.cos(TH), -Math.sin(TH)], dv: Pt = [Math.sin(TH), Math.cos(TH)];
const US = 0.8;                                              // the spine's length, tuned by eye against the head
const B = (u: number, v: number): Pt => [HIP[0] + u * US * du[0] + v * dv[0], HIP[1] + u * US * du[1] + v * dv[1]];
const bp = (pts: Pt[]): Pt[] => pts.map(([u, v]) => B(u, v));
const CAT = {
  farFore: limb([[67, 57], [76, 61], [84, 49], [86.4, 45]], 2.2, 1.5),
  farPaw: <Pt[]>[[84, 45.6], [85.4, 42.4], [87.6, 41.8], [89, 43.6], [88, 46.4], [85.6, 47]],
  farHind: bp(limb([[0, 0.5], [-5, 9], [-12, 13], [-19, 16.5]], 3.8, 1.1)),
  tail: bp(limb([[-2, -3], [-7, -5], [-11, -9], [-13, -14], [-12, -18.5], [-9.4, -21.2]], 1.9, 1.3)),
  torso: bp([[-3, -3.6], [2, -5.4], [10, -5.1], [18, -4.7], [26, -5.1], [33, -6], [38, -6.6], [42, -7.2], [45.4, -8.6], [48, -3], [46.4, 1.2], [43.6, 5.4], [39.6, 7.8], [34, 8.2], [27, 7], [20, 5.3], [14, 4.5], [8, 4.9], [3, 5.7], [-1, 4.7], [-3.6, 1]]),
    nearFore: limb([[69, 57], [80.5, 59], [89, 42], [90.6, 38.4]], 2.6, 1.6),
  nearPaw: <Pt[]>[[88.2, 39], [89, 35.2], [90.6, 33.6], [92.8, 34], [94, 36.4], [93, 39.4], [90.6, 40.6]],
  throat: [[66, 50], [72, 47.5], [77, 50.5], [79, 55], [74, 57.5], [67, 57]] as Pt[],
  nearHind: bp(limb([[1.5, 1.5], [-4, 8.2], [-12, 10.8], [-20, 12.8]], 4.7, 1.2)),
};
// The head is laid by hand, cell by cell, the way a pixel artist does a face: a formula cannot
// place an ear tip or an eye. Profile facing right, chin lifted toward the fireflies, both ears
// pricked forward (far ear behind, near ear with its thin inner skin), eye, nose, mouth line.
// '#' fur  'w' inner ear (lit through)  'E' eye  'e' eye shine  'n' nose  'd' mouth / jaw shadow
const HEAD = [
  "...........#........",
  "....#.....##........",
  "...##....#w#........",
  "...#w#..##w#........",
  "..##w#.###w#........",
  "..#ww####ww##.......",
  "...############.....",
  "..###############...",
  ".#################..",
  ".#######Ee#########.",
  ".##################.",
  "..##################",
  "..#################n",
  "...###############d.",
  "...##############d..",
  "..##############d...",
  ".##############.....",
  "##############......",
];
const HA: Pt = [65, 34];   // sprite anchor (top-left cell)
const headCells = (() => { const m = new Map<number, string>(); HEAD.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") m.set((HA[1] + j) * 120 + HA[0] + i, ch); })); return m; })();
const TARGET: Pt = [99, 27];                                  // the firefly the paws are closing on
const FIREFLIES: { x: number; y: number; big: boolean }[] = [  // a drift: the cluster the cat is after, then strays with bare sky between
  { x: TARGET[0], y: TARGET[1], big: true }, { x: 104, y: 22, big: false }, { x: 101, y: 41, big: false },
  { x: 84, y: 16, big: false }, { x: 12, y: 60, big: false }, { x: 30, y: 97, big: false }, { x: 108, y: 90, big: false },
];

const author = (): PixelDraft => {
  const d = new PixelDraft(G, G, 0);
  const fillPoly = (pts: Pt[], c: number, kind: "fill" | "pencil" = "fill") => { d.begin(kind); PixelDraft.cover(pts, G, G).forEach((i) => d.px(i % G, (i / G) | 0, c)); };
  const mask = (polys: Pt[][]) => { const m = new Uint8Array(G * G); polys.forEach((p) => PixelDraft.cover(p, G, G).forEach((i) => (m[i] = 1))); return m; };
  const at = (m: Uint8Array, x: number, y: number) => (x < 0 || y < 0 || x >= G || y >= G ? 0 : m[y * G + x]);
  const HORIZON = 96, mx = 22, my = 21, mR = 10;

  // ================= PASS 0: blocking in flat mid colours (pencil the edge, bucket the mass)
  d.setPass(0);
  d.begin("fill"); d.rect(0, 0, G, HORIZON, 2);                                                        // sky, one bucket
  d.begin("pencil"); d.line(0, HORIZON, G - 1, HORIZON, 7); d.begin("fill"); d.rect(0, HORIZON + 1, G, G - HORIZON - 1, 7); // horizon, lawn
  const hedgeTop: Pt[] = [[0, 86], [5, 84], [11, 85], [16, 82], [23, 83], [29, 85], [35, 84], [41, 86], [47, 85], [53, 87], [60, 85], [66, 82], [73, 83], [80, 85], [87, 84], [93, 81], [100, 82], [107, 84], [113, 82], [120, 83]];
  d.begin("pencil"); for (let i = 0; i + 1 < hedgeTop.length; i++) d.line(...hedgeTop[i], Math.min(G - 1, hedgeTop[i + 1][0]), hedgeTop[i + 1][1], 8);
  fillPoly([...hedgeTop, [120, HORIZON], [0, HORIZON]], 8);
  d.begin("pencil"); for (let a = 0; a < 64; a++) d.px(mx + Math.cos((a / 64) * Math.PI * 2) * mR, my + Math.sin((a / 64) * Math.PI * 2) * mR, 6);
  d.begin("fill"); for (let y = -mR; y <= mR; y++) for (let x = -mR; x <= mR; x++) if (x * x + y * y <= mR * mR + mR * 0.8) d.px(mx + x, my + y, 6);
  // the cat, blocked coarse (2x2 cells) in bands, the way a first silhouette goes down
  const exact = cleanMask(mask(Object.values(CAT)), G, G), under = d.buf.slice();
  headCells.forEach((_, i) => (exact[i] = 1));
  const coarse = new Uint8Array(G * G);
  for (let y = 0; y < G; y += 2) for (let x = 0; x < G; x += 2) { const n = at(exact, x, y) + at(exact, x + 1, y) + at(exact, x, y + 1) + at(exact, x + 1, y + 1); if (n >= 2) coarse[y * G + x] = coarse[y * G + x + 1] = coarse[(y + 1) * G + x] = coarse[(y + 1) * G + x + 1] = 1; }
  for (let y = 0; y < G; y += 4) { d.begin("fill"); for (let yy = y; yy < y + 4; yy++) for (let x = 0; x < G; x++) if (coarse[yy * G + x]) d.px(x, yy, 11); }
  // foreground grasses: tall blades at both corners, single-cell pencil lines on clean slopes
  const blades: [Pt, Pt][] = [[[3, 119], [5, 99]], [[6, 119], [10, 102]], [[9, 119], [9, 105]], [[12, 119], [17, 108]], [[1, 119], [0, 104]],
    [[108, 119], [104, 101]], [[111, 119], [111, 98]], [[114, 119], [118, 103]], [[117, 119], [119, 108]], [[105, 119], [99, 108]]];
  blades.forEach(([a, b]) => { d.begin("pencil"); d.line(...a, ...b, 8); d.line(a[0] + 1, a[1], (a[0] + b[0]) / 2 + 1, (a[1] + b[1]) / 2 + 2, 8); });

  // ================= PASS 1: cleanup. The silhouette swept once round, cells taken off and put on.
  d.setPass(1);
  const cc = B(20, 0), fix: { i: number; c: number; a: number }[] = [];
  for (let i = 0; i < G * G; i++) if (coarse[i] !== exact[i]) { const x = i % G, y = (i / G) | 0; fix.push({ i, c: exact[i] ? 11 : under[i], a: Math.atan2(y - cc[1], x - cc[0]) }); }
  fix.sort((p, q) => p.a - q.a);
  for (let k = 0; k < fix.length; k += 12) { d.begin("pencil"); fix.slice(k, k + 12).forEach((f) => d.px(f.i % G, (f.i / G) | 0, f.c)); }

  // ================= PASS 2: shading clusters
  d.setPass(2);
  // sky: deep at the zenith, lifting toward the horizon in 2x2 ordered steps (never a blend)
  d.begin("cluster"); for (let y = 0; y < 46; y++) for (let x = 0; x < G; x++) { const lv = y < 38 ? 4 : y < 40 ? 3 : y < 42 ? 2 : y < 44 ? 1 : 0; if (lv && PixelDraft.dith(x, y, lv) && d.get(x, y) === 2) d.px(x, y, 1); }
  d.begin("cluster"); for (let y = 62; y < HORIZON; y++) for (let x = 0; x < G; x++) { const lv = y > 76 ? 4 : y > 74 ? 3 : y > 72 ? 2 : y > 70 ? 1 : 0; if (lv && PixelDraft.dith(x, y, lv) && d.get(x, y) === 2) d.px(x, y, 3); }
  // moon: the maria as irregular authored clusters, and the terminator side a shade down
  const maria = ["..##..", ".####.", "#####.", ".###..", "..#..."], mar2 = [".##", "###", "##."], mar3 = ["##.", ".##"];
  const stamp = (rows: string[], x0: number, y0: number, c: number) => { d.begin("cluster"); rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === "#" && d.get(x0 + i, y0 + j) === 6) d.px(x0 + i, y0 + j, c); })); };
  stamp(maria, 15, 15, 5); stamp(mar2, 23, 22, 5); stamp(mar3, 18, 25, 5); stamp(["#"], 26, 15, 5);
  d.begin("cluster"); for (let y = -mR; y <= mR; y++) for (let x = -mR; x <= mR; x++) { const r = Math.hypot(x, y); if (d.get(mx + x, my + y) === 6 && x + y > 6 && r > mR - 3 && PixelDraft.dith(mx + x, my + y, r > mR - 1.5 ? 4 : 2)) d.px(mx + x, my + y, 5); }
  // cat: body frame lets form follow the animal. Far limbs sink into the void colour; the belly
  // and underside of every limb turn away from both lights and go dark in a two-cell band.
  const vOf = (x: number, y: number) => (x + 0.5 - HIP[0]) * dv[0] + (y + 0.5 - HIP[1]) * dv[1];
  const cellSet = (p: Pt[]) => { const s = new Set(PixelDraft.cover(p, G, G)); return (i: number) => s.has(i) && exact[i] === 1; };
  const near = [CAT.torso, CAT.throat, CAT.nearFore, CAT.nearPaw, CAT.nearHind, CAT.tail].map(cellSet), isNear = (i: number) => headCells.has(i) || near.some((f) => f(i));
  d.begin("cluster"); headCells.forEach((ch, i) => { if (ch === "n" || ch === "d") d.px(i % G, (i / G) | 0, 0); });
  d.begin("cluster"); for (let i = 0; i < G * G; i++) if (exact[i] && !isNear(i)) d.px(i % G, (i / G) | 0, 0);
  d.begin("cluster"); for (let i = 0; i < G * G; i++) if (exact[i] && isNear(i)) { const x = i % G, y = (i / G) | 0; const o1 = !at(exact, x + 1, y + 1) || !at(exact, x, y + 1), o2 = !at(exact, x + 1, y + 2) || !at(exact, x, y + 2) || !at(exact, x + 2, y + 2); if (o1 || (o2 && PixelDraft.dith(x, y, 2))) if (vOf(x, y) > 1.5) d.px(x, y, 0); }
  // near hind thigh: its front edge against the flank, so the leg reads over the body
  d.begin("cluster"); { const th = cellSet(CAT.nearHind); for (let i = 0; i < G * G; i++) if (th(i)) { const x = i % G, y = (i / G) | 0; if (!th((y - 1) * G + x + 1) && exact[(y - 1) * G + x + 1] && d.get(x, y) === 11) d.px(x, y, 0); } }
  // hedge: every lump's moon-side shoulder in mid green, clusters that follow the lump
  for (let k = 0; k + 1 < hedgeTop.length; k++) {
    const [x0, y0] = hedgeTop[k], [x1, y1] = hedgeTop[k + 1]; if (y1 > y0) continue; d.begin("cluster");  // only lumps rising to the right face the moon's side... and the viewer
    for (let x = x0; x < x1; x++) { const top = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); for (let y = Math.ceil(top) + 1; y < top + 5; y++) if (d.get(x, y) === 8 && PixelDraft.dith(x, y, y - top < 2.5 ? 4 : 2)) d.px(x, y, 9); }
  }
  for (let k = 0; k + 1 < hedgeTop.length; k++) { const [x0, y0] = hedgeTop[k], [x1, y1] = hedgeTop[k + 1]; if (y1 <= y0) continue; d.begin("cluster"); for (let x = x0 + 1; x < x1 - 1; x++) { const top = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); for (let y = Math.ceil(top) + 2; y < top + 4; y++) if (d.get(x, y) === 8 && PixelDraft.dith(x, y, 1)) d.px(x, y, 9); } }
  // lawn: the cat's moon shadow thrown forward-right of the leap, dithered at its soft end
  d.begin("cluster"); for (let y = 100; y < 108; y++) for (let x = 36; x < 84; x++) { const u = (x - 60) / 24, v = (y - 103.5) / 3.6, r = u * u + v * v; if (r < 1 && PixelDraft.dith(x, y, r < 0.4 ? 4 : r < 0.75 ? 2 : 1)) d.px(x, y, 0); }
  // the lawn itself: mown stripes as sparse dither, darker toward the viewer
  d.begin("cluster"); for (let y = HORIZON + 1; y < G; y++) for (let x = 0; x < G; x++) if (d.get(x, y) === 7 && y < 102 && PixelDraft.dith(x, y, 1) && ((x >> 3) + (y >> 1)) % 3 === 0) d.px(x, y, 8);
  // clover tufts on the lawn, blade clusters with bare lawn between
  ([[24, 113], [44, 116], [70, 112], [88, 117], [52, 108]] as Pt[]).forEach(([tx, ty], k) => { d.begin("cluster"); for (let b = -2; b <= 2; b++) d.line(tx + b, ty, tx + b + Math.sign(b) * (1 + (k % 2)), ty - 3 + Math.abs(b), 8); });

  // ================= PASS 3: highlights and the moon's rim light
  d.setPass(3);
  d.begin("cluster"); for (let y = my - 16; y <= my + 16; y++) for (let x = mx - 16; x <= mx + 16; x++) { const r = Math.hypot(x - mx, y - my); if (r > mR + 0.9 && r < mR + 4 && PixelDraft.dith(x, y, r < mR + 2 ? 2 : 1) && d.get(x, y) !== 6) d.px(x, y, 4); }
  // cat rim: every body cell whose up-left side is open sky catches the moon (the back, the
  // crown, the ear rims, the tail's top). Swept from tail to nose like one pass of the pencil.
  const rim: { x: number; y: number; t: number }[] = [];
  for (let i = 0; i < G * G; i++) if (exact[i]) { const x = i % G, y = (i / G) | 0; if (!at(exact, x - 1, y - 1) && (!at(exact, x, y - 1) || !at(exact, x - 1, y)) && vOf(x, y) < 1) rim.push({ x, y, t: x - y }); }
  rim.sort((a, b) => a.t - b.t);
  for (let k = 0; k < rim.length; k += 6) { d.begin("pencil"); rim.slice(k, k + 6).forEach((e) => d.px(e.x, e.y, 5)); }
  // lit fur just inside the rim, broken like fur rather than drawn like a stroke
  d.begin("cluster"); rim.forEach((e, k) => { if (at(exact, e.x + 1, e.y + 1) && d.get(e.x + 1, e.y + 1) === 11 && k % 4 !== 2) d.px(e.x + 1, e.y + 1, 12); if (k % 3 === 0 && at(exact, e.x + 1, e.y + 2) && d.get(e.x + 1, e.y + 2) === 11) d.px(e.x + 1, e.y + 2, 12); });
  // hedge crown: moon catches the rising shoulders, sparingly
  d.begin("cluster"); for (let k = 0; k + 1 < hedgeTop.length; k++) { const [x0, y0] = hedgeTop[k], [x1, y1] = hedgeTop[k + 1]; if (y1 > y0 || k % 2) continue; for (let x = x0; x < Math.min(x1, x0 + 3); x++) { const top = Math.ceil(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)); d.px(x, top, 5); } }
  // grass blade tips catch the moon
  d.begin("cluster"); blades.forEach(([, b]) => { d.px(b[0], b[1], 5); });
  // stars: a few, drifted into the dark sky away from the moon, bare rests between
  ([[48, 6], [63, 13], [79, 4], [104, 9], [114, 23], [57, 33], [7, 46], [96, 58], [41, 18]] as Pt[]).forEach(([x, y]) => { d.begin("pencil"); d.px(x, y, 5); });
  // moonflowers on the hedge face, open to the sky
  ([[38, 90], [45, 93], [57, 89], [90, 91], [96, 88]] as Pt[]).forEach(([x, y]) => { d.begin("cluster"); d.px(x, y, 6); d.px(x - 1, y, 5); d.px(x + 1, y, 5); d.px(x, y - 1, 5); d.px(x, y + 1, 9); });

  // ================= PASS 4: fireflies, then the light they throw; glow dither last of all
  d.setPass(4);
  const isCat = (x: number, y: number) => at(exact, x, y) === 1;
  const warmLeaf = (x: number, y: number, r: number) => { for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) { const q = Math.hypot(xx, yy); if (q > r) continue; const c = d.get(x + xx, y + yy); if (c === 8 && PixelDraft.dith(x + xx, y + yy, q < r * 0.55 ? 2 : 1)) d.px(x + xx, y + yy, 9); else if (c === 9 && q < r * 0.7) d.px(x + xx, y + yy, 10); } };
  // glow stamps, authored: core, a lit ring, then a falloff that thins cell by cell (Y glow, o outer, : sparse outer)
  const GLOW_BIG = ["....:....", "..:...:..", "...oYo...", ".:oYCYo:.", "..YCCCY..", ".:oYCYo:.", "...oYo...", "..:...:..", "....:...."];
  const GLOW_SMALL = ["..:..", ".oYo.", ":YCY:", ".oYo.", "..:.."];
  FIREFLIES.forEach(({ x, y, big }) => {
    const st = big ? GLOW_BIG : GLOW_SMALL, h = (st.length - 1) / 2;
    const put = (want: string, c: number) => st.forEach((r, j) => [...r].forEach((ch, i) => { const X = x + i - h, Y = y + j - h; if (ch === want && !isCat(X, Y) && d.get(X, Y) !== 6) d.px(X, Y, c); }));
    d.begin("pencil"); put("C", 15);
    d.begin("cluster"); put("Y", 14);
    d.begin("cluster"); put("o", 13); put(":", 13);
    d.begin("cluster"); warmLeaf(x, y, big ? 9 : 6);
  });
  // warm light where the cat faces the cluster: paws, forearms, the muzzle; then the inner ear
  // (thin skin, lit through) and the eye's shine: the fireflies are the only warm thing in the night
  d.begin("cluster");
  for (let i = 0; i < G * G; i++) if (exact[i]) { const x = i % G, y = (i / G) | 0, q = Math.hypot(x - TARGET[0], y - TARGET[1]); if (q < 18 && (!isCat(x + 1, y) || !isCat(x + 1, y - 1) || !isCat(x, y - 1))) d.px(x, y, q < 10 ? 14 : 13); }
  d.begin("cluster"); headCells.forEach((ch, i) => { if (ch === "w") d.px(i % G, (i / G) | 0, 13); });
  d.begin("pencil"); headCells.forEach((ch, i) => { if (ch === "E" || ch === "e") d.px(i % G, (i / G) | 0, ch === "E" ? 14 : 15); });
  d.begin("pencil"); d.line(HA[0] + 17, HA[1] + 11, HA[0] + 21, HA[1] + 9, 5); d.begin("pencil"); d.line(HA[0] + 16, HA[1] + 13, HA[0] + 20, HA[1] + 14, 4); // whiskers, silver in the moon
  d.end();
  return d;
};

const N = 450, HOLD = 30, CEL = 3;
const cached = (env: { cache: Map<string, unknown> }) => {
  let v = env.cache.get("pixelArt/draft") as { d: PixelDraft; plan: number[] } | undefined;
  if (!v) {
    const d = author(), raw = celPlan(d, [36, 22, 30, 22, 20], 4), cels = Math.floor((N - HOLD - 1) / CEL);
    // fit the plan to the cels the film has: stretch or squeeze by resampling, keeping the end exact
    const plan = Array.from({ length: cels }, (_, c) => raw[Math.min(raw.length - 1, Math.round((c * (raw.length - 1)) / (cels - 1)))]);
    v = { d, plan }; env.cache.set("pixelArt/draft", v);
  }
  return v;
};

export const pixelArt: Film = {
  meta: { title: "Pixel art · the pounce", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{
    id: "pounce", start: 0, end: N, draw: (ctx, f, env) => {
      const { d, plan } = cached(env);
      let n: number;
      if (f === 0) n = 0; else if (f >= N - HOLD) n = d.ops.length; else n = plan[Math.min(plan.length - 1, Math.floor((f - 1) / CEL))];
      const buf = new Uint8Array(G * G);                         // frame 0 ground = colour 0
      for (let k = 0; k < n; k++) { const o = d.ops[k]; buf[o >> 4] = o & 15; }
      blit(ctx, buf, G, G, PALETTE, Math.round(env.W * env.scale), Math.round(env.H * env.scale), PALETTE[0]);
    },
  }],
};

export const STYLE = { id: "pixelArt", name: "Pixel art", family: "digital", medium: "a 120x120 grid of cells, each one of 16 declared palette colours, laid one cell at a time and blown up by a whole number, no smoothing", nearest: "koi", hero: "a cat mid-pounce after fireflies in a moonlit garden" };
