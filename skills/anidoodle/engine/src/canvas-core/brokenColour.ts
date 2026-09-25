// BROKEN COLOUR · a small harbour at sunrise, painted in dabs.
//
// MEDIUM, physically: oil paint straight from the tube on a lead-white primed linen canvas, worked
//   outdoors in one sitting. A flat hog-bristle brush, loaded and put down ONCE: it lands blunt,
//   pushes a ridge of paint up along one side, and drags thin where it lifts. Colours are not mixed
//   on the palette into the colour of the thing; two or three unmixed colours are laid side by side
//   and the eye mixes them at a distance (optical mixing). The linen's weave shows through the thin
//   lay-in and in the gaps between dabs.
// MARKS: short, separate, opaque dabs. Water: flat, horizontal, longer. Sky: varied, turning around
//   the sun, streaking along the cloud banks. Buildings: short and upright. Hulls: along the hull.
//   Masts and oars: one pull of a thin rigger.
// EDGE: no outlines anywhere. A form ends where its dabs stop; the boats are dark dabs against light
//   dabs. Edges are lost into the haze, found only on the sunlit rims.
// ORDER: (1) a thin warm imprimatura scrubbed over the white, (2) placement drawn with thinned
//   ultramarine, (3) the big masses in big dabs, (4) smaller broken dabs over everything, sky to
//   water, (5) boats, masts and the sun restated, (6) complementary accents, (7) reflections,
//   (8) the last sparkles on the sun's path.
// PALETTE (high key): lead white, cadmium orange + red, chrome yellow, rose madder, cobalt violet,
//   ultramarine, viridian. No black: the darkest dark is ultramarine + rose madder. Complementary
//   accents: orange dropped into blue shadow, violet into gold light.
// GROUND: primed linen, plain weave (brokenColourKit.weave), multiplied last.
// LIGHT: ONE sun, low in the east behind the harbour, a little right of centre, orange through
//   morning haze. Everything is contre-jour: boats and figures are dark silhouettes with a warm rim
//   on their sun side, their cast shadows and reflections fall toward the viewer on the water.
// SUBJECT + STRUCTURE: a working harbour. Left, the far town in haze: warehouse roofs, a campanile,
//   a chimney whose smoke drifts east (the wind), a stone breakwater with a lamp post running out
//   from the left edge, masts of moored boats. Right, a low headland. Centre, the sun's path on the
//   water, a vertical column made of horizontal ripples that break the reflection into bars.
//   Focal: a clinker rowing dinghy in the near water, three-quarter from the port side, bow to the
//   right and higher than the stern, transom stern, the far gunwale visible as a sliver of lit
//   interior; one oarsman on the centre thwart facing the stern (oarsmen face aft), both oars
//   squared at mid-drive, the near blade throwing a splash. Mid-distance right, a gaff-rigged
//   fishing boat with a rust lugsail half up. Far, in the sun's path, a skiff sculled standing.
// REFERENCE (from knowledge): plein-air harbour studies of the 1870s broken-colour painters (their
//   technique only: sun path as horizontal bars, boats as a few dark strokes); the construction of
//   a clinker dinghy and the rowing stroke (oarsman faces aft, blades square at the drive); how
//   reflections work on rippled water (each ripple faces a different slice of sky, so a reflection
//   stretches DOWN and breaks into bars; a vertical mast reflects as a wobbling zig-zag).
import { fractal, rng, type P } from "./core";
import type { Film } from "./film";
import { brush, checkOps, fromHsl, linen, mixC, schedule, smoothstep, staged, toHsl, type Mark, type Op, type RGB } from "./brokenColourKit";

const N = 450, HOLD = N - 30;
const META = { title: "Broken colour · harbour at sunrise", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N, raster: "cpu" as const };
const W = META.W, H = META.H;

// ---------------------------------------------------------------- the motif, in unit coordinates
const HZ = 0.5;                                    // horizon
const SUN: P = [0.62, 0.392], SUN_R = 0.031;
const inPoly = (poly: P[], x: number, y: number) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const interp = (knots: P[], u: number) => { if (u <= knots[0][0]) return knots[0][1]; for (let i = 1; i < knots.length; i++) if (u <= knots[i][0]) { const [a, va] = knots[i - 1], [b, vb] = knots[i]; return va + ((vb - va) * (u - a)) / (b - a || 1); } return knots[knots.length - 1][1]; };
// the far town: roof line, a campanile at 0.13, a chimney at 0.42, stepping down to the harbour mouth
const TOWN: P[] = [[0, 0.437], [0.03, 0.437], [0.031, 0.429], [0.068, 0.429], [0.07, 0.442], [0.1, 0.442], [0.124, 0.44], [0.125, 0.398], [0.1315, 0.384], [0.138, 0.398], [0.139, 0.441], [0.168, 0.445], [0.17, 0.434], [0.218, 0.431], [0.221, 0.447], [0.268, 0.452], [0.3, 0.455], [0.335, 0.451], [0.4, 0.458], [0.417, 0.457], [0.418, 0.409], [0.427, 0.409], [0.428, 0.461], [0.46, 0.47], [0.5, 0.481], [0.525, 0.493], [0.54, 0.5]];
const HEAD: P[] = [[0.66, 0.5], [0.7, 0.487], [0.76, 0.479], [0.86, 0.473], [1, 0.466]];
const town = (u: number, v: number) => u < 0.54 && v < HZ && v > interp(TOWN, u);
const head = (u: number, v: number) => u > 0.66 && v < HZ && v > interp(HEAD, u);
// breakwater: from the left edge out to 0.235, top face lit, sea face in shadow
const JETTY: P[] = [[0, 0.546], [0.12, 0.541], [0.235, 0.536], [0.237, 0.553], [0.12, 0.566], [0, 0.584]];
const JETTY_TOP = (u: number) => 0.546 - (0.01 * u) / 0.235;
// the dinghy (focal): hull, the lit sliver of its far gunwale, the oarsman
const HULL: P[] = [[0.255, 0.699], [0.3, 0.707], [0.35, 0.711], [0.4, 0.707], [0.44, 0.699], [0.468, 0.687], [0.463, 0.698], [0.451, 0.711], [0.4, 0.722], [0.35, 0.727], [0.3, 0.727], [0.262, 0.724]];
const INSIDE: P[] = [[0.26, 0.695], [0.31, 0.699], [0.36, 0.701], [0.41, 0.698], [0.45, 0.692], [0.466, 0.688], [0.44, 0.699], [0.4, 0.707], [0.35, 0.711], [0.3, 0.707], [0.256, 0.699]];
const ROWER: P[] = [[0.363, 0.706], [0.366, 0.686], [0.362, 0.664], [0.354, 0.652], [0.343, 0.653], [0.336, 0.66], [0.327, 0.672], [0.317, 0.681], [0.318, 0.688], [0.331, 0.682], [0.341, 0.692], [0.325, 0.697], [0.318, 0.704], [0.34, 0.706]];
const HEADC: P = [0.351, 0.641], HEAD_R = 0.0105;
const ROW_WL = 0.727;
// the fishing boat (mid right) and its lugsail; the far skiff
const SMACK: P[] = [[0.742, 0.582], [0.8, 0.587], [0.866, 0.577], [0.861, 0.588], [0.85, 0.597], [0.8, 0.6], [0.752, 0.596]];
const SAIL: P[] = [[0.79, 0.458], [0.793, 0.574], [0.748, 0.577], [0.764, 0.53], [0.772, 0.49]];
const SMACK_WL = 0.6, MAST_U = 0.792, MAST_TOP = 0.43;
const SKIFF: P[] = [[0.513, 0.537], [0.535, 0.54], [0.559, 0.534], [0.553, 0.543], [0.52, 0.544]];
const SKIFF_WL = 0.544;
const BOATS = [{ poly: [...HULL], wl: ROW_WL, top: 0.64, k: 1.25 }, { poly: SMACK, wl: SMACK_WL, top: 0.577, k: 1.3 }, { poly: SAIL, wl: SMACK_WL, top: 0.458, k: 1.1 }, { poly: SKIFF, wl: SKIFF_WL, top: 0.515, k: 1.3 }];
const inRower = (u: number, v: number) => inPoly(ROWER, u, v) || Math.hypot(u - HEADC[0], v - HEADC[1]) < HEAD_R;

// ---------------------------------------------------------------- palette
const C = {
  skyTop: [150, 154, 200] as RGB, skyMid: [205, 180, 206] as RGB, skyLow: [236, 198, 186] as RGB,
  glow: [246, 178, 110] as RGB, halo: [252, 206, 132] as RGB, sun: [246, 126, 52] as RGB, sunCore: [252, 184, 96] as RGB,
  cloud: [160, 150, 192] as RGB, cloudLit: [242, 160, 118] as RGB, smoke: [200, 172, 190] as RGB,
  town: [124, 122, 168] as RGB, townLit: [214, 150, 140] as RGB, head: [182, 164, 196] as RGB,
  far: [206, 186, 206] as RGB, mid: [150, 158, 204] as RGB, near: [82, 104, 158] as RGB, green: [96, 142, 146] as RGB,
  path: [246, 146, 66] as RGB, pathHot: [253, 206, 116] as RGB,
  hull: [58, 54, 98] as RGB, rim: [232, 128, 72] as RGB, wood: [176, 112, 96] as RGB, sail: [150, 82, 82] as RGB, sailLit: [226, 124, 78] as RGB,
  jetty: [88, 82, 134] as RGB, jettyTop: [228, 166, 138] as RGB, refl: [74, 72, 122] as RGB,
};
const mix3 = (a: RGB, b: RGB, c: RGB, t: number) => (t < 0.5 ? mixC(a, b, t * 2) : mixC(b, c, (t - 0.5) * 2));
const nz = (s: number, u: number, v: number, fu: number, fv: number, o = 3) => fractal(s, u * 1000, v * 1000, fu, fv, o);

// ---------------------------------------------------------------- the analytic colour field
// region: 0 sky, 1 town/headland, 2 water, 3 boat, 4 jetty, 5 sun, 6 sun path, 7 reflection
type Here = { c: RGB; region: number; ang: number; size: number };
const sunDist = (u: number, v: number) => Math.hypot(u - SUN[0], (v - SUN[1]) * 1.05);
const sky = (u: number, v: number): Here => {
  const t = Math.min(1, v / HZ), d = sunDist(u, v);
  let c = mix3(C.skyTop, C.skyMid, C.skyLow, Math.pow(t, 1.15));
  c = mixC(c, C.glow, 0.7 * Math.exp(-((d / 0.2) ** 2)));
  c = mixC(c, C.halo, 0.85 * Math.exp(-((d / 0.065) ** 2)));
  // cloud banks: long horizontal streaks, their undersides lit where they pass the sun
  let bank = 0;
  for (const [vb, th, s] of [[0.12, 0.024, 3], [0.205, 0.018, 5], [0.27, 0.014, 7], [0.322, 0.009, 9]] as [number, number, number][]) {
    const wav = vb + 0.018 * (nz(s, u, 0, 0.0025, 0.0025, 2) - 0.5), thick = th * smoothstep(0.35, 0.7, nz(s + 1, u, 0, 0.004, 0.004, 3)), k = thick < 1e-4 ? 0 : smoothstep(thick, thick * 0.3, Math.abs(v - wav));
    if (k > 0) { const lit = v > wav ? Math.exp(-(((u - SUN[0]) / 0.22) ** 2)) : 0.15 * Math.exp(-(((u - SUN[0]) / 0.3) ** 2)); c = mixC(c, mixC(C.cloud, C.cloudLit, lit), 0.75 * k); bank = Math.max(bank, k); }
  }
  // smoke from the chimney, drifting east and rising
  const sx = u - 0.422; if (sx > -0.01 && sx < 0.16 && v < 0.415) { const cy = 0.409 - 0.5 * sx - 1.2 * sx * sx, wdt = 0.006 + 0.1 * sx, k = smoothstep(wdt, 0, Math.abs(v - cy)) * smoothstep(0.16, 0.04, sx) * (0.6 + 0.4 * nz(13, u, v, 0.02, 0.02, 2)); c = mixC(c, C.smoke, 0.5 * k); }
  // strokes streak along the banks, loosen higher up, and turn part-way round the sun close to it
  // the hand changes direction patch by patch: some patches hatched up-right, some down-right, some flat
  const hatch = nz(21, u, v, 0.0035, 0.0045, 2), lean = hatch < 0.42 ? -0.55 : hatch > 0.58 ? 0.5 : 0;
  const free = (-0.06 + lean * smoothstep(0.02, 0.1, Math.abs(hatch - 0.5)) + (nz(19, u, v, 0.009, 0.012, 2) - 0.5) * (0.7 + 0.8 * (1 - t))) * (1 - 0.8 * bank), tang = Math.atan2(v - SUN[1], u - SUN[0]) + Math.PI / 2, diff = ((tang - free + Math.PI * 2.5) % Math.PI) - Math.PI / 2;
  const ang = free + diff * 0.5 * smoothstep(0.13, 0.045, d);
  if (d < SUN_R * 1.35) { const sc = mixC(mixC(C.sun, c, smoothstep(0.8, 1.35, d / SUN_R)), [255, 236, 176], smoothstep(0.7, 0.2, d / SUN_R)); return { c: sc, region: d < SUN_R * 1.05 ? 5 : 0, ang: ang + (nz(23, u, v, 0.05, 0.05, 1) - 0.5) * 2, size: 0.45 }; }
  return { c, region: 0, ang, size: 1 };
};
const land = (u: number, v: number): Here => {
  const hz = 1 - Math.exp(-(((u - SUN[0]) / 0.22) ** 2)) * 0.4;           // haze thicker toward the sun
  if (head(u, v)) return { c: mixC(C.head, C.skyLow, 0.25), region: 1, ang: (nz(23, u, v, 0.02, 0.02) - 0.5) * 0.4, size: 0.7 };
  const top = interp(TOWN, u), edge = smoothstep(0.006, 0, v - top), lit = edge * Math.exp(-(((u - SUN[0]) / 0.35) ** 2));
  let c = mixC(C.town, C.skyLow, 0.28 * (1 - hz) + 0.12); c = mixC(c, C.townLit, 0.7 * lit);
  c = mixC(c, mixC(C.town, [96, 94, 150], 0.5), 0.3 * smoothstep(0.35, 0.65, nz(29, u, v, 0.03, 0.006, 2)));   // gables and gaps in shadow
  return { c, region: 1, ang: (nz(31, u, v, 0.02, 0.02) - 0.5) * 0.5, size: 0.5 };
};
const ripple = (u: number, v: number, s = 41) => nz(s, u, v, 0.0045, 0.075 + 0.05 * (1 - (v - HZ) * 2), 3);
const water = (u: number, v: number): Here => {
  const t = (v - HZ) / (1 - HZ), rp = ripple(u, v);
  let c = mix3(C.far, C.mid, C.near, Math.pow(t, 0.75));
  c = mixC(c, C.green, 0.28 * t * smoothstep(0.4, 0.7, nz(43, u, v, 0.0015, 0.004, 2)));
  c = mixC(c, C.glow, 0.35 * Math.exp(-(((u - SUN[0]) / 0.28) ** 2)) * (1 - t) ** 2);           // the glow of the sky in the far water
  c = mixC(c, rp > 0.5 ? [240, 222, 226] : C.near, Math.abs(rp - 0.5) * 0.5);                     // each ripple faces another slice of sky
  let region = 2;
  // the sun's path: widening toward us, broken into horizontal bars by the ripples
  const uc = SUN[0] + 0.006 * (nz(47, 0, v, 0.01, 0.01, 2) - 0.5), hw = 0.012 + 0.15 * Math.pow(v - HZ, 0.85), k = Math.exp(-(((u - uc) / hw) ** 2)), bar = smoothstep(0.44, 0.6, ripple(u, v, 53)), inten = k * (0.25 + 0.75 * bar) * (1 - 0.4 * t);
  if (inten > 0.08) { c = mixC(c, mixC(C.path, C.pathHot, smoothstep(0.55, 0.95, k * bar)), Math.min(1, inten * 1.25)); if (inten > 0.3) region = 6; }
  // the town and headland, mirrored and broken just under the horizon
  const wob = 0.012 * (ripple(u, v, 59) - 0.5), vm = HZ - (v - HZ) * 1.05;
  if (v < HZ + 0.07 && (town(u + wob, vm) || head(u + wob, vm)) && ripple(u, v, 61) > 0.36) { c = mixC(c, mixC(C.town, C.far, 0.35), 0.75); region = 7; }
  // the breakwater's reflection
  if (u < 0.24 && v > JETTY_TOP(u) + 0.02 && v < 0.62 && inPoly(JETTY, u + wob, 2 * 0.566 - v + (0.584 - 0.566) * (1 - u / 0.235))) { c = mixC(c, C.refl, 0.55); region = 7; }
  // boats stretch DOWN in the water and break into bars
  for (const b of BOATS) {
    if (v <= b.wl || v > b.wl + (b.wl - b.top) * b.k) continue;
    const vm2 = b.wl - (v - b.wl) / b.k, w2 = 0.004 * (v - b.wl) * 60 * (ripple(u, v, 67) - 0.5);
    if ((inPoly(b.poly, u + w2, vm2) || (b.poly === BOATS[0].poly && inRower(u + w2, vm2))) && ripple(u, v, 71) > 0.3) { c = mixC(c, C.refl, 0.8); region = 7; }
  }
  if (v > SMACK_WL && v < SMACK_WL + (SMACK_WL - MAST_TOP) * 0.9) { const zz = MAST_U + 0.006 * Math.sin((v - SMACK_WL) * 260) * smoothstep(0, 0.05, v - SMACK_WL); if (Math.abs(u - zz) < 0.0022 && ripple(u, v, 73) > 0.35) { c = mixC(c, C.refl, 0.7); region = 7; } }
  return { c, region, ang: (nz(79, u, v, 0.01, 0.01, 2) - 0.5) * 0.08, size: 1 };
};
export const field = (u: number, v: number): Here => {
  if (v >= JETTY_TOP(u) && inPoly(JETTY, u, v)) { const top = v < JETTY_TOP(u) + 0.007; return { c: top ? C.jettyTop : mixC(C.jetty, C.skyLow, 0.12 * (1 - u)), region: 4, ang: -0.04, size: 0.6 }; }
  if (inRower(u, v)) { const rim = inRower(u + 0.004, v) ? 0 : 1; return { c: mixC(C.hull, C.rim, rim * 0.8), region: 3, ang: Math.PI / 2, size: 0.3 }; }
  if (inPoly(INSIDE, u, v)) return { c: C.wood, region: 3, ang: -0.06, size: 0.35 };
  if (inPoly(HULL, u, v)) { const rim = inPoly(HULL, u, v - 0.004) ? 0 : 1; return { c: mixC(C.hull, C.rim, rim * 0.75), region: 3, ang: -0.05, size: 0.4 }; }
  if (inPoly(SAIL, u, v)) { const e = inPoly(SAIL, u - 0.005, v) ? 0 : 1; return { c: mixC(C.sail, C.sailLit, 0.25 + 0.6 * e + 0.2 * (v - 0.46) * 5), region: 3, ang: Math.PI / 2 + 0.1, size: 0.4 }; }
  if (inPoly(SMACK, u, v)) return { c: mixC(C.hull, C.rim, inPoly(SMACK, u, v - 0.003) ? 0.05 : 0.6), region: 3, ang: 0, size: 0.35 };
  if (inPoly(SKIFF, u, v)) return { c: mixC(C.hull, C.path, 0.15), region: 3, ang: 0, size: 0.3 };
  if (v < HZ) { if (town(u, v) || head(u, v)) return land(u, v); return sky(u, v); }
  return water(u, v);
};

// ---------------------------------------------------------------- turning the field into brush marks
const ACC_WARM: RGB[] = [[238, 138, 82], [242, 170, 128], [228, 112, 92]];      // orange and rose, into blue shadow
const ACC_COOL: RGB[] = [[150, 128, 204], [172, 150, 214], [128, 120, 190]];     // violet and lilac, into gold light
const broken = (c: RGB, r: () => number, hj: number, lj: number, sat: [number, number]): RGB => { const [h, s, l] = toHsl(c); return fromHsl([h + (r() - 0.5) * 2 * hj, Math.min(1, s * (sat[0] + r() * (sat[1] - sat[0]))), Math.max(0.04, Math.min(0.97, l + (r() - 0.5) * 2 * lj))]); };
const mk = (x: number, y: number, ang: number, L: number, w: number, rgb: RGB, alpha: number, seed: number, kind: 0 | 1 | 2 = 0, bend = 0): Mark => ({ a: [x - (Math.cos(ang) * L) / 2, y - (Math.sin(ang) * L) / 2], b: [x + (Math.cos(ang) * L) / 2, y + (Math.sin(ang) * L) / 2], bend, w, rgb, alpha, seed, kind });
const line = (pts: P[], w: number, rgb: RGB, alpha: number, seed: number, kind: 0 | 1 | 2 = 1): Mark[] => pts.slice(1).map((p, i) => ({ a: [pts[i][0] * W, pts[i][1] * H], b: [p[0] * W, p[1] * H], bend: 0, w, rgb, alpha, seed: seed + i, kind }));
type Pass = { marks: Mark[]; f0: number; f1: number; dur: number; pace?: (u: number) => number };
// grid points, jittered, visited in a sweep that wanders patch by patch the way a hand moves round a canvas
const sweep = (step: number, seed: number, patch: number, keyOf: (x: number, y: number, h: Here) => number) => {
  const r = rng(seed), out: { x: number; y: number; h: Here; key: number }[] = [];
  for (let y = -step / 2; y < H + step; y += step) for (let x = -step / 2; x < W + step; x += step) {
    const px = x + (r() - 0.5) * step * 1.3, py = y + (r() - 0.5) * step * 1.3, h = field(Math.max(0, Math.min(1, px / W)), Math.max(0, Math.min(1, py / H)));
    out.push({ x: px, y: py, h, key: keyOf(px, py, h) + fractal(seed + 2, px, py, 1 / patch, 1 / patch, 2) * patch * 1.4 + r() * patch * 0.25 });
  }
  return out.sort((a, b) => a.key - b.key);
};
const regionOrder = (h: Here) => (h.region === 0 || h.region === 5 ? 0 : h.region === 1 ? 1 : h.region === 4 ? 3 : h.region === 3 ? 4 : 2);

const passes = (): Pass[] => {
  const r = rng(1874);
  // (1) imprimatura: thin warm rose-ochre, scrubbed with a big brush, the white still breathing through
  const tone: Mark[] = [];
  for (let i = 0; i < 16; i++) { const y = (i + 0.5) * (H / 16) + (r() - 0.5) * 20, x0 = -60 + r() * 80, x1 = W + 60 - r() * 80, ya = y + (r() - 0.5) * 50, yb = y + (r() - 0.5) * 50, back = i % 2 === 1; tone.push({ a: back ? [x1, yb] : [x0, ya], b: back ? [x0, ya] : [x1, yb], bend: (r() - 0.5) * 40, w: 90 + r() * 40, rgb: i < 8 ? [218, 172, 146] : [200, 164, 156], alpha: 0.62, seed: 100 + i, kind: 2 }); }
  // (2) placement in thinned ultramarine: horizon, town, breakwater, the three boats, the sun
  const U: RGB = [96, 104, 168], draw: Mark[] = [];
  draw.push(...line([[0.02, HZ + 0.001], [0.3, HZ - 0.001], [0.62, HZ + 0.002], [0.98, HZ]], 3, U, 0.6, 200));
  draw.push(...line(TOWN.filter((_, i) => i % 3 === 0).concat([[0.54, 0.5]]), 3, U, 0.55, 210));
  draw.push(...line([[0.66, 0.5], [0.8, 0.476], [1, 0.466]], 3, U, 0.5, 230));
  draw.push(...line([[0, 0.546], [0.235, 0.536], [0.237, 0.553], [0, 0.584]], 3, U, 0.55, 240));
  draw.push(...line([[0.255, 0.699], [0.35, 0.711], [0.468, 0.687], [0.451, 0.711], [0.35, 0.727], [0.262, 0.724], [0.255, 0.699]], 3.2, U, 0.65, 250));
  draw.push(...line([[0.34, 0.706], [0.345, 0.66], [0.35, 0.641]], 2.4, U, 0.5, 260), ...line([[0.336, 0.708], [0.305, 0.775]], 2, U, 0.45, 263), ...line([[0.345, 0.701], [0.372, 0.676]], 2, U, 0.45, 265));
  draw.push(...line([[0.742, 0.582], [0.866, 0.577], [0.8, 0.6], [0.742, 0.582]], 2.2, U, 0.45, 270), ...line([[MAST_U, 0.585], [MAST_U, MAST_TOP]], 2, U, 0.45, 274));
  draw.push(...line([[0.513, 0.538], [0.559, 0.535]], 2, U, 0.45, 276));
  draw.push(...Array.from({ length: 6 }, (_, i) => { const a0 = -1.2 + i * 1.05, a1 = a0 + 1.0; return { a: [(SUN[0] + Math.cos(a0) * SUN_R) * W, (SUN[1] + Math.sin(a0) * SUN_R) * H] as P, b: [(SUN[0] + Math.cos(a1) * SUN_R) * W, (SUN[1] + Math.sin(a1) * SUN_R) * H] as P, bend: -SUN_R * W * 0.14, w: 2.2, rgb: U, alpha: 0.45, seed: 280 + i, kind: 1 as const }; }));
  // (3) the big masses: large dabs, colour taken from a wide neighbourhood, little breaking yet
  const mass: Mark[] = sweep(W * 0.022, 300, W * 0.2, (x, y, h) => regionOrder(h) * 1e5 + y).map(({ x, y, h }, i) => {
    let acc: RGB = [0, 0, 0]; if (h.region === 3) acc = h.c; else for (const [dx, dy] of [[0, 0], [-22, 0], [22, 0], [0, -14], [0, 14]]) { const q = field(Math.max(0, Math.min(1, (x + dx) / W)), Math.max(0, Math.min(1, (y + dy) / H))).c; acc = [acc[0] + q[0] / 5, acc[1] + q[1] / 5, acc[2] + q[2] / 5]; }
    const water = h.region >= 2 && h.region !== 3 && h.region !== 4 && h.region !== 5, k = h.region === 3 ? 0.45 : h.region === 1 ? 0.6 : 1;
    return mk(x, y, h.ang, (water ? 64 : 50) * k * (0.8 + r() * 0.4), (water ? 17 : 22) * k * (0.8 + r() * 0.4), broken(acc, r, 0.01, 0.025, [0.9, 1.05]), 0.9, 1000 + i, 0, (r() - 0.5) * 6);
  });
  // (4) broken colour: small dabs everywhere, hue and value broken, the eye does the mixing
  const brk: Mark[] = [];
  sweep(W * 0.0095, 400, W * 0.12, (x, y, h) => regionOrder(h) * 1e5 + y).forEach(({ x, y, h }, i) => {
    const water = h.region === 2 || h.region === 6 || h.region === 7, sky = h.region === 0;
    if (sky && r() < 0.3) return;                                                       // the sky breathes: the mass shows between dabs
    const len = W * (water ? 0.028 : sky ? 0.026 : 0.021) * h.size * (0.6 + r() * 0.7), wd = W * (water ? 0.0058 : sky ? 0.0078 : 0.0072) * Math.max(0.55, h.size) * (0.7 + r() * 0.5);
    let c = broken(h.c, r, sky ? 0.025 : 0.035, water ? 0.07 : sky ? 0.05 : 0.03, [0.95, water ? 1.4 : 1.25]); const [, , l] = toHsl(h.c), warm = h.c[0] > h.c[2] + 20;
    if (h.region !== 3 && h.region !== 5 && r() < (water ? 0.025 : 0.018)) c = warm ? ACC_COOL[Math.floor(r() * 3)] : l < 0.6 ? ACC_WARM[Math.floor(r() * 3)] : c;
    brk.push(mk(x, y, h.ang + (r() - 0.5) * (water ? 0.08 : sky ? 0.55 : 0.35), len, wd, c, 0.95, 5000 + i, 0, (r() - 0.5) * (water ? 1.5 : 5)));
  });
  // (5) restate the boats, masts, breakwater and the sun, each stroke following its form
  const det: Mark[] = [], inside = (poly: P[], n: number, seed: number, f: (x: number, y: number, h: Here, rr: () => number) => Mark | null) => { const rr = rng(seed); let x0 = 1, y0 = 1, x1 = 0, y1 = 0; poly.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }); for (let k = 0, got = 0; k < n * 20 && got < n; k++) { const u = x0 + rr() * (x1 - x0), v = y0 + rr() * (y1 - y0); if (!inPoly(poly, u, v)) continue; const m = f(u * W, v * H, field(u, v), rr); if (m) { det.push(m); got++; } } };
  // the town restated as one hazy mass: flat roofs laid horizontally, the campanile and chimney upright
  const TOWN_POLY: P[] = [...TOWN, [0.54, HZ], [0, HZ]];
  inside(TOWN_POLY, 480, 590, (x, y, h, rr) => mk(x, y, (rr() - 0.5) * 0.25, 15 * (0.7 + rr() * 0.6), 6.5, broken(h.c, rr, 0.02, 0.035, [0.9, 1.15]), 0.95, 5900 + Math.floor(x * 5 + y)));
  det.push(...line([[0.1315, 0.44], [0.1315, 0.39]], 6, mixC(C.town, C.townLit, 0.15), 0.95, 596, 0), ...line([[0.4225, 0.458], [0.4225, 0.411]], 5, mixC(C.town, C.townLit, 0.1), 0.95, 598, 0));
  // masts of the moored boats behind the breakwater: one pull of the rigger each, lost in the haze
  [[0.245, 0.452, 0.385], [0.262, 0.453, 0.36], [0.287, 0.455, 0.402], [0.31, 0.455, 0.378], [0.352, 0.453, 0.395]].forEach(([u, v0, v1], i) => det.push(...line([[u, v0], [u + 0.001, v1]], 1.9, mixC(C.town, C.skyLow, 0.2), 0.8, 600 + i)));
  inside(JETTY, 70, 610, (x, y, h, rr) => mk(x, y, -0.04 + (rr() - 0.5) * 0.1, 22 * (0.7 + rr() * 0.5), 6.5, broken(h.c, rr, 0.02, 0.05, [0.9, 1.2]), 0.95, 6100 + Math.floor(x * 7 + y)));
  det.push(...line([[0.226, 0.537], [0.2265, 0.49]], 3, [70, 66, 112], 0.95, 620), ...line([[0.2215, 0.49], [0.2315, 0.49]], 5, [250, 196, 120], 0.95, 622, 0));
  // the far skiff, sculled standing, dead in the sun's path
  inside(SKIFF, 14, 630, (x, y, _h, rr) => mk(x, y, 0.02, 12, 4.4, mixC(C.hull, [120, 70, 90], rr() * 0.4), 0.96, 6300 + Math.floor(x + y * 3)));
  det.push(...line([[0.537, 0.538], [0.536, 0.514]], 4.2, [60, 52, 92], 0.96, 640), ...line([[0.536, 0.52], [0.567, 0.55]], 1.8, [60, 52, 92], 0.9, 642));
  // the fishing boat: hull along its length, lugsail in upright dabs with its lit leech, mast and gaff
  inside(SMACK, 40, 650, (x, y, h, rr) => mk(x, y, (rr() - 0.5) * 0.12, 16 * (0.7 + rr() * 0.5), 5, broken(h.c, rr, 0.02, 0.05, [0.9, 1.2]), 0.96, 6500 + Math.floor(x * 3 + y)));
  inside(SAIL, 55, 660, (x, y, h, rr) => mk(x, y, Math.PI / 2 + 0.12 + (rr() - 0.5) * 0.2, 17 * (0.7 + rr() * 0.5), 6, broken(h.c, rr, 0.03, 0.07, [0.9, 1.3]), 0.96, 6600 + Math.floor(x * 3 + y)));
  det.push(...line([[MAST_U, 0.588], [MAST_U - 0.0015, MAST_TOP]], 3, [64, 56, 96], 0.96, 670), ...line([[MAST_U, 0.572], [0.747, 0.576]], 2.4, [64, 56, 96], 0.9, 672), ...line([[0.79, 0.458], [0.772, 0.49]], 2, [226, 124, 78], 0.9, 674));
  // the dinghy: interior sliver, hull planks along the sheer, a sunlit rim on the gunwale
  inside(INSIDE, 26, 680, (x, y, _h, rr) => mk(x, y, -0.06 + (rr() - 0.5) * 0.1, 13, 3.6, broken(C.wood, rr, 0.03, 0.08, [0.9, 1.3]), 0.96, 6800 + Math.floor(x * 3 + y)));
  inside(HULL, 95, 690, (x, y, h, rr) => { const u = x / W, slope = u > 0.43 ? -0.35 : u < 0.28 ? 0.1 : -0.04; return mk(x, y, slope + (rr() - 0.5) * 0.08, 19 * (0.7 + rr() * 0.5), 5.4, broken(h.c, rr, 0.03, 0.05, [0.9, 1.25]), 0.97, 6900 + Math.floor(x * 3 + y)); });
  det.push(...line([[0.258, 0.7], [0.3, 0.7075], [0.35, 0.7115], [0.4, 0.7075], [0.44, 0.6995], [0.467, 0.688]], 3.2, C.rim, 0.95, 700, 0));
  det.push(...line([[0.265, 0.7235], [0.3, 0.7265], [0.35, 0.7265], [0.4, 0.7215], [0.45, 0.7105]], 3.6, [40, 40, 80], 0.9, 710, 0));
  // the oarsman: upright dabs, a warm rim down his sun side, cap and head last
  inside(ROWER, 75, 720, (x, y, h, rr) => mk(x, y, Math.PI / 2 + (rr() - 0.5) * 0.4, 10 * (0.7 + rr() * 0.5), 6.5, broken(h.c, rr, 0.02, 0.04, [0.9, 1.1]), 0.97, 7200 + Math.floor(x * 3 + y)));
  det.push(...line([[0.3655, 0.704], [0.3665, 0.686], [0.3625, 0.665], [0.356, 0.654]], 2.6, C.rim, 0.9, 730, 0));
  for (let k = 0; k < 7; k++) { const a = (k / 6) * Math.PI * 2, rr = k === 6 ? 0 : HEAD_R * 0.32; det.push(mk((HEADC[0] + Math.cos(a) * rr) * W, (HEADC[1] + Math.sin(a) * rr) * H, a + Math.PI / 2, 9, 7, k === 0 ? mixC(C.hull, C.rim, 0.6) : C.hull, 0.97, 740 + k)); }
  det.push(mk((HEADC[0] - 0.004) * W, (HEADC[1] - 0.008) * H, -0.1, 12, 4.5, [52, 50, 88], 0.97, 748));                       // the cap's brim, toward the stern
  // oars squared at the drive: near blade toward us throwing a splash, far blade beyond the hull

  // the sun, all dabs: a hot core of cream and yellow laid every which way, orange round it, and orange and
  // pink dabs breaking the edge out into the haze so there is never a clean circle
  { const sr = rng(760), SX = SUN[0] * W, SY = SUN[1] * H, R = SUN_R * W;
    const at = (rad: number, spread: number) => { const a = sr() * Math.PI * 2, q = rad + (sr() - 0.5) * spread; return [SX + Math.cos(a) * q * R, SY + Math.sin(a) * q * R * 0.95, a] as const; };
    for (let k = 0; k < 16; k++) { const [x, y, a] = at(0.62, 0.5); det.push(mk(x, y, a + Math.PI / 2 + (sr() - 0.5) * 0.9, 11 + sr() * 9, 6 + sr() * 3, [[246, 128, 56], [240, 110, 60], [250, 150, 70]][k % 3] as RGB, 0.95, 760 + k)); }
    for (let k = 0; k < 18; k++) { const [x, y, a] = at(1.05, 0.7); det.push(mk(x, y, (sr() < 0.5 ? a + Math.PI / 2 : a) + (sr() - 0.5) * 0.8, 8 + sr() * 10, 4 + sr() * 3, [[246, 146, 80], [240, 158, 150], [250, 176, 120], [236, 136, 128]][k % 4] as RGB, 0.9, 780 + k)); }
    for (let k = 0; k < 22; k++) { const [x, y] = at(0.22, 0.55); det.push(mk(x, y, (sr() - 0.5) * 2.4, 8 + sr() * 7, 5 + sr() * 3, [[255, 238, 180], [255, 226, 140], [252, 206, 110]][k % 3] as RGB, 0.97, 800 + k)); } }
  // (6) accents: orange into the blue shadow of the near water and the town, violet into the gold
  const acc: Mark[] = [];
  for (let k = 0, got = 0; k < 6000 && got < 150; k++) {
    const x = r() * W, y = r() * H, h = field(x / W, y / H), [, , l] = toHsl(h.c); let c: RGB | null = null;
    if (h.region === 6 && r() < 0.8) c = ACC_COOL[Math.floor(r() * 3)];
    else if ((h.region === 2 && y > 0.62 * H) || h.region === 1) { if (l < 0.5 && r() < 0.2) c = ACC_WARM[Math.floor(r() * 3)]; }
    else if (h.region === 0 && h.c[0] > h.c[2] + 30 && sunDist(x / W, y / H) > 0.13 && r() < 0.15) c = ACC_COOL[Math.floor(r() * 3)];
    if (!c) continue; got++;
    acc.push(mk(x, y, h.ang, W * 0.016 * (0.6 + r() * 0.6), W * 0.0052, c, 0.95, 8000 + got));
  }
  // (7) reflections: horizontal bars, sun's path first, then the boats' dark stretched shapes
  const refl: Mark[] = [];
  for (let k = 0, got = 0; k < 60000 && got < 700; k++) {
    const u = SUN[0] + (r() - 0.5) * 0.36, v = HZ + 0.004 + r() * (1 - HZ), h = field(u, v); if (h.region !== 6) continue; got++;
    refl.push(mk(u * W, v * H, (r() - 0.5) * 0.05, W * (0.012 + 0.02 * r()) * (0.6 + (v - HZ)), W * 0.0042 * (0.7 + 0.6 * (v - HZ)), broken(h.c, r, 0.02, 0.05, [1, 1.3]), 0.97, 9000 + got));
  }
  const refDark: Mark[] = [];
  for (let k = 0, got = 0; k < 90000 && got < 420; k++) {
    const u = 0.2 + r() * 0.7, v = HZ + r() * 0.35, h = field(u, v); if (h.region !== 7) continue; got++;
    refDark.push(mk(u * W, v * H, (r() - 0.5) * 0.06, W * (0.01 + 0.014 * r()), W * 0.0045, broken(h.c, r, 0.02, 0.04, [0.9, 1.1]), 0.95, 11000 + got));
  }
  refDark.sort((a, b) => a.a[1] - b.a[1]);
  // (8) the last sparkles: near-white bars on the crests of the path
  const spark: Mark[] = [];
  for (let k = 0, got = 0; k < 40000 && got < 110; k++) {
    const u = SUN[0] + (r() - 0.5) * 0.25, v = HZ + 0.01 + r() * 0.4, h = field(u, v); if (h.region !== 6 || ripple(u, v, 53) < 0.62) continue; got++;
    spark.push(mk(u * W, v * H, 0, W * (0.006 + 0.01 * r()), W * 0.0032, r() < 0.7 ? [255, 238, 190] : [255, 214, 150], 0.98, 12000 + got));
  }
  // (9) last touches over the water: the oars, squared at the drive, the near blade throwing a splash
  const oars: Mark[] = [...line([[0.318, 0.684], [0.337, 0.707], [0.322, 0.745], [0.306, 0.776]], 3.8, [56, 52, 92], 0.96, 750), mk(0.304 * W, 0.779 * H, 1.25, 20, 9, [60, 58, 100], 0.96, 754),
    ...line([[0.321, 0.683], [0.35, 0.697], [0.393, 0.682]], 2.4, [60, 56, 96], 0.94, 756), mk(0.398 * W, 0.6815 * H, -0.12, 15, 4.2, [84, 80, 128], 0.96, 758),
    ...[[-14, 2], [-6, -4], [4, 3], [12, -2], [-2, 7]].map(([dx, dy], k) => mk(0.304 * W + dx, 0.781 * H + dy, (k - 2) * 0.1, 9, 3.4, k % 2 ? [236, 232, 240] : [214, 206, 232], 0.95, 760 + k))];
  const up = (u: number) => u * u * (3 - 2 * u) * 0.35 + u * 0.65;   // a hand settling into the rhythm
  return [
    { marks: tone, f0: 0.5, f1: 40, dur: 10 },
    { marks: draw, f0: 39, f1: 70, dur: 5 },
    { marks: mass, f0: 69, f1: 186, dur: 4, pace: up },
    { marks: brk, f0: 185, f1: 330, dur: 3, pace: up },
    { marks: det, f0: 329, f1: 378, dur: 3 },
    { marks: acc, f0: 377, f1: 392, dur: 3 },
    { marks: [...refl, ...refDark], f0: 391, f1: 413, dur: 3 },
    { marks: [...oars, ...spark], f0: 412, f1: HOLD, dur: 2 },
  ];
};

const OPS_KEY = "brokenColour:ops:v1";
const ops = (cache: Map<string, unknown>) => () => {
  let o = cache.get(OPS_KEY) as Op[] | undefined; if (o) return o;
  o = [];
  for (const p of passes()) { const t = schedule(p.marks.length, p.f0, p.f1, p.dur, p.pace); p.marks.forEach((m, i) => o!.push({ t0: t[i].t0, t1: t[i].t1, draw: (ctx, env, pr) => brush(ctx, env, m, pr) })); }
  cache.set(OPS_KEY, checkOps(o, HOLD)); return o;
};
const GROUND: RGB = [240, 234, 222];
export const drawBrokenColour = (ctx: CanvasRenderingContext2D, frame: number, env: import("./core").Env) =>
  staged("brokenColour", ops(env.cache), (c, e) => { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgb(${GROUND.join(",")})`; c.fillRect(0, 0, Math.round(e.W * e.scale), Math.round(e.H * e.scale)); }, (c, e) => linen(c, e, 0.26))(ctx, frame, env);

export const STYLE = { id: "brokenColour", name: "Broken colour", family: "oil", medium: "opaque oil dabs from a loaded flat hog brush on primed linen, unmixed colours side by side for the eye to mix", nearest: "ranunculus", hero: "a small harbour at sunrise" };
export const brokenColour: Film = { meta: META, assets: { images: {} }, shots: [{ id: "brokenColour", start: 0, end: N, draw: drawBrokenColour }] };
