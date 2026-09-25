// RANUNCULUS ASIATICUS, the Persian buttercup. Spec 6.1 is binding and it is a craft brief, not
// a shape brief: the head is painted FROM THE CENTRE OUT as short overlapping C-strokes circling
// a tight green button, each ring larger and looser than the last, with slivers of bare paper
// LEFT between the strokes. Those slivers are the petal edges. There is no concentric scallop,
// no mathematical spiral, and no ring of separate ovals anywhere in this file.
//
// PHOTOGRAPHS STUDIED before a point was moved (spec 6.1 asks which; these are the three I
// actually opened, not a list from memory):
//   1. Alamy HX5F8J, "close up of Ranunculus asiaticus petals opening": a macro straight into the
//      centre of a red-on-yellow bloom. What it settles: the centre is NOT a flat yellow button.
//      It is a dark green-black domed receptacle, finely stippled, with a pale green star at its
//      apex, sitting at the bottom of a WELL. The innermost whorl stands almost vertical around
//      that well as narrow creased strips; petals widen and flatten ring by ring outward; every
//      ring sits in the gaps of the one inside it; each petal carries a darker edge, and the
//      overlap between two petals reads as a bright hairline.
//   2. TopTropicals `ranunculus_asiaticus3857`, a white bloom from above and slightly in front.
//      What it settles: the head is TWO ZONES, and this is the whole read. A broad outer SKIRT of
//      a few large, pale, nearly flat petals that reflex downward, and a much smaller, tighter,
//      GREEN-hearted inner cup raised inside it. Also: the foliage is dark, deeply cut and
//      parsley-like, and a bud on the same plant is a clasped green ball.
//   3. BigCommerce "Wholesale Coral Ranunculus", one whole cut stem. What it settles: the
//      proportions. The stem runs about three and a half head-widths long, has its own S-curve,
//      thickens toward the base, swells green at the neck, carries its deeply cut leaves around
//      the middle of its length with a side bud on a short branch, and the head NODS a few
//      degrees off the stem's axis rather than sitting square on it.
//
// The head is built as real cup geometry, not as a flat pattern: a petal knows its radius, its
// angle and its HEIGHT in the bowl, and the view is that bowl seen at an elevation. Which is why
// the three-quarter view gets its stacked crescents and the profile gets its cup for free.
import { Gfx, P, displace, jitter, oval, rng, sample, tube } from "../../core";
import { lift } from "../finale/paint";

export type View = "facing" | "three" | "profile" | "half" | "bud";
export type Variety = "coral" | "blush" | "butter" | "magenta" | "peach";

// Colour sets read off the references: a mid, a dark for the wells and the shadow side, a pale
// for the lit rim of the skirt, and the edge tint that rides the outer margin (the picotee).
type Paints = { mid: string; dark: string; pale: string; edge: string; heart: string };
export const PAINTS: Record<Variety, Paints> = {
  coral: { mid: "#ee8a70", dark: "#cf5a3f", pale: "#f9c6b0", edge: "#d9603f", heart: "#dfa86a" },
  blush: { mid: "#f6ece4", dark: "#c9b4ac", pale: "#fffbf5", edge: "#e0819a", heart: "#e6dcab" }, // blush white with a pink picotee edge
  butter: { mid: "#f3d577", dark: "#d8a83c", pale: "#fbeeb6", edge: "#dfae3f", heart: "#c9c657" },
  magenta: { mid: "#b8417e", dark: "#7c2154", pale: "#d98cb0", edge: "#8d2a63", heart: "#c98f6a" },
  peach: { mid: "#f5b98a", dark: "#dd8a5f", pale: "#fbdcc0", edge: "#e0906a", heart: "#e2c37e" },
};
export const SEPAL = "#7d9a52", STEM_G = "#88a457", STEM_SHADE = "#5e7a42", LEAF = "#55713f", LEAF_LIT = "#7b9455";
const BUTTON = "#b7c150", BUTTON_DARK = "#3f4a28", BUTTON_STAR = "#e6e6a6", WELL = "#6d7a42", PAPER = "#fbf7ee", COOL = "#8ea3c4";

// Elevation of the camera above the flower's own plane, per view. 1 = straight down the throat,
// 0 = edge on. Everything else about a view follows from this one number, the ring set and the
// sepals: there is no per-view special casing of shape anywhere below.
const ELEV: Record<View, number> = { facing: 0.95, three: 0.6, profile: 0.16, half: 0.82, bud: 0.5 };

// The bowl, in units of the head radius: height above the rim plane at radius t. A deep dark well
// at the centre, a crest about three quarters out where the skirt is widest, and only a SLIGHT
// reflex past it. This one curve is what makes the three-quarter view stack its crescents and
// the profile view sit up as a cup, so it is the shape of the flower and not a lighting trick.
const bowl = (t: number): number => (t < 0.74 ? -0.70 + 0.80 * Math.pow(t / 0.74, 1.5) : 0.10 - 0.20 * Math.pow((t - 0.74) / 0.26, 1.7));

// The rings, centre out. `r` is the fraction of the head radius the petal's MARGIN reaches, `n`
// the count, `w` its tangential half-width as a multiple of the even spacing, `into` how far back
// toward the centre it is attached, and `lift` how far it curls up out of the bowl.
// The two zones are the whole read (reference 2): a HEART of many small tight greener petals, and
// a SKIRT of a few big pale ones. A ranunculus with one uniform zone is a pompom.
type Ring = { r: number; n: number; w: number; into: number; lift: number; heart: boolean };
const RINGS: Ring[] = [
  { r: 0.62, n: 5, w: 1.38, into: 0.50, lift: 0.09, heart: false },
  { r: 0.76, n: 6, w: 1.34, into: 0.54, lift: 0.07, heart: false },
  { r: 0.89, n: 6, w: 1.34, into: 0.58, lift: 0.05, heart: false },
  { r: 1.00, n: 7, w: 1.32, into: 0.60, lift: 0.04, heart: false },
];
// A petal is a BLADE, not a fan: its inner edge is nearly as wide as its margin, because what
// narrows a real petal toward its base is hidden behind the ring inside it. Fans that all
// converge on the centre make a pinwheel, and a pinwheel is a mathematical spiral with extra
// steps. What breaks the four rings up instead is that no petal is the same size as its
// neighbour and none of them sits at quite the radius its ring says.
// The HEART is not rings. Concentric annuli of petals nest into a moulded shell, which is the
// scalloped-circle failure the spec rejects on sight. A real heart is a ROLLED WHORL: broad
// crescents that each wrap a third of the way round the centre, overlapping like a rose, laid
// biggest and lowest first and finishing on the small upright ones standing over the button.
// These twelve turn offsets are HAND PLACED, not a golden angle and not a step: no two gaps
// between consecutive petals are the same, which is what stops the eye finding the rule.
const TURNS = [0, 0.41, 0.77, 0.19, 0.6, 0.93, 0.33, 0.7, 0.08, 0.52, 0.86, 0.26];
// A half-open bloom has not let its skirt down yet: the outer rings are still drawn in and stood
// up round the green heart, so what you see is a cup closing rather than a disc.
const halfOpen = (rg: Ring): Ring => (rg.heart ? { ...rg, lift: rg.lift + 0.06 } : { ...rg, r: rg.r * 0.66, lift: rg.lift + 0.34, w: rg.w * 0.96, into: rg.into * 0.8 });

const mix = (a: string, b: string, t: number) => { const h = (x: string) => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]; const A = h(a), B = h(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, "0")).join(""); };

// A C-STROKE. The core's `wash` wobbles every outline by an ABSOLUTE thirteen units, which is
// right for a wing panel three hundred units across and turns a twenty-pixel petal into porridge.
// A petal therefore gets its own wash, wobbled in proportion to its own width, so a small one
// keeps the crisp dried edge that makes the stack of tissue read.
const cstroke = (g: Gfx, pts: P[], col: string, alpha: number, seed: number, w: number) => {
  const s = displace(sample(jitter(pts, w * 0.035, seed), true, 4), w * 0.07, 1.7 / Math.max(3, w), 2, (seed % 89) + 3);
  g.fill(s, col, alpha);
  return s;
};

// One head. `R` is its radius ON SCREEN, `tilt` the nod off the stem's axis in radians, and the
// sun is upper right, so the lit side of every petal is the side facing about -0.9 rad.
export type HeadOpts = { view?: View; tilt?: number; seed?: number; reserve?: boolean; dip?: number };
export const head = (g: Gfx, at: P, R: number, v: Variety, o: HeadOpts = {}) => {
  const view = o.view ?? "facing", seed = o.seed ?? 1, r = rng(seed), C = PAINTS[v], tilt = (o.tilt ?? 0) + (o.dip ?? 0) * 0.16;
  if (view === "bud") return budHead(g, at, R, v, seed, tilt);
  // ---- level of detail, spec 6.1. Below these sizes a painter stops drawing the flower and
  // starts putting down what the flower does to the picture: two tones, then one dab.
  if (R < 7) { g.fill(oval(at[0], at[1], R * 1.15, R * 0.95, 8), C.mid, 0.8); return; }
  if (R < 20) { g.fill(oval(at[0] - R * 0.22, at[1] + R * 0.24, R * 1.05, R * 0.86, 9), C.dark, 0.5); g.fill(oval(at[0], at[1], R * 1.1, R * 0.92, 9), C.mid, 0.9); g.fill(oval(at[0], at[1], R * 0.28, R * 0.24, 7), mix(BUTTON, WELL, 0.4), 0.85); return; }
  const set = (R < 60 ? [RINGS[0], RINGS[2], RINGS[3]] : RINGS).map((rg) => (view === "half" ? halfOpen(rg) : rg)); // 40 to 120 px: three rings of strokes and the button

  const e = ELEV[view], ce = Math.sqrt(Math.max(0, 1 - e * e)), ct = Math.cos(tilt), st = Math.sin(tilt);
  // bowl point -> screen. X across, Y away from the camera, Z up out of the cup, then the nod.
  const T = (ang: number, rad: number, z: number): P => {
    const X = Math.cos(ang) * rad, Y = Math.sin(ang) * rad, sy = -(Y * e + z * ce);
    return [at[0] + (X * ct - sy * st) * R, at[1] + (X * st + sy * ct) * R];
  };
  if (view === "profile" || view === "half") sepals(g, T, R, seed, view === "profile" ? 1 : 0.5);
  const edgeR = set[set.length - 1].r;
  if (o.reserve !== false) { const sil: P[] = []; for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; sil.push(T(a, edgeR * 0.93, bowl(edgeR) + 0.02)); } g.fill(jitter(sil, R * 0.03, seed + 1), PAPER, 0.5); } /* the paper is LEFT for it: a wash over white glows, a wash over green does not */

  const ring = (rg: Ring, i: number) => {
    const t = rg.r, phase = r() * Math.PI * 2, step = (Math.PI * 2) / rg.n, half = step * 0.5 * rg.w;
    const zIn = bowl(t * rg.into), zOut = bowl(t) + rg.lift, outermost = i === set.length - 1;
    const pw = 2 * half * t * R; /* the petal's own width on screen: everything wobbles in proportion to this */
    const petals = Array.from({ length: rg.n }, (_, k) => phase + k * step + (r() - 0.5) * step * 0.22);
    petals.sort((a, b) => T(a, t, zOut)[1] - T(b, t, zOut)[1]); /* the far side of the bowl is behind the near side */
    petals.forEach((a, k) => {
      const lit = 0.5 + 0.5 * Math.cos(a + 0.9 - tilt), s2 = seed + i * 31 + k * 7, rr = rng(s2);
      const ruf = 0.03 + rr() * 0.045, skew = (rr() - 0.5) * 0.3, notch = outermost ? 0.045 + rr() * 0.04 : 0, size = 0.82 + rr() * 0.38, shove = (rr() - 0.5) * 0.13; /* hand-placed: no two petals in a ring reach the same distance, so the margin is never a circle */ /* one side always leads, and the big outer petals are notched at the top */
      const N = 9, outer: P[] = [], band: P[] = [];
      for (let q = 0; q < N; q++) {
        const u = q / (N - 1), ang = a + (u - 0.5) * 2 * half * (1 + skew * (u - 0.5));
        const rad = t * size + t * shove + t * size * (ruf * Math.sin(u * Math.PI * 2.2 + s2) - notch * Math.exp(-Math.pow((u - 0.5) * 4, 2)));
        outer.push(T(ang, rad, zOut)); band.push(T(ang, rad * 0.86, zOut * 0.95));
      }
      const inner: P[] = []; for (let q = 3; q >= 0; q--) { const u = q / 3, ang = a + (u - 0.5) * 2 * half * 0.84; inner.push(T(ang, (t * size + t * shove) * rg.into, zIn)); }
      // Value. The heart is CREAM AND GREEN, lighter than the throat it stands in, which is the
      // only way the tight inner whorl reads as petals instead of one dark mass; the dark in the
      // heart is the throat showing between the strokes, never paint on the strokes themselves.
      const vary = (rr() - 0.5) * 0.2; /* no two petals in a ring are the same value: that is what stops a ring reading as one moulded shell */
      const base = rg.heart ? mix(mix(C.pale, C.heart, 0.5 + vary), BUTTON_STAR, 0.24 - t * 0.35) : mix(C.mid, C.pale, (t - 0.5) * 0.95 + lit * 0.42 + vary);
      const col = mix(base, C.dark, (1 - lit) * (rg.heart ? 0.3 : 0.38) + Math.max(0, vary));
      cstroke(g, [...outer, ...inner], col, rg.heart ? 0.93 : 0.9, s2, pw);
      /* a petal is darker where it folds down into the cup and paler at the margin the light hits:
         one more stroke on the inner half, not a gradient */
      const half2: P[] = []; for (let q = 0; q < N; q++) { const u = q / (N - 1), ang = a + (u - 0.5) * 2 * half * 0.9; half2.push(T(ang, (t * size + t * shove) * (rg.into + (1 - rg.into) * 0.42), (zIn + zOut) / 2)); }
      cstroke(g, [...half2, ...inner], mix(col, rg.heart ? WELL : C.dark, rg.heart ? 0.4 : 0.3), rg.heart ? 0.72 : 0.5, s2 + 2, pw * 0.7);
      /* pigment settles where the water stopped: a darker rim along the outer margin only, which
         is a dried edge and not an outline, because it never goes round the sides */
      g.fill(tube(outer.slice(1, N - 1), pw * 0.025, pw * 0.012, false), mix(col, C.dark, 0.55), 0.34 + (1 - lit) * 0.2);
      /* and the shadow the petal in front throws on it: this is what opens the stack up */
      g.fill(tube([T(a + (skew > 0 ? -half : half) * 0.92, t * 0.62, (zIn + zOut) / 2), outer[skew > 0 ? 0 : N - 1]], pw * 0.045, pw * 0.014, false), mix(col, WELL, 0.38), 0.26);
      if (R > 50 && !rg.heart) { const crease = [T(a, t * rg.into, zIn), T(a + skew * 0.12, t * 0.82, (zIn + zOut) / 2), T(a, t * 0.96, zOut)]; g.fill(tube(crease, pw * 0.012, pw * 0.005, false), mix(col, C.dark, 0.4), 0.2); }
      /* the picotee: a BAND of colour along the outer margin, which is what a picotee is. Every
         other variety gets the same band, quieter, as the colour its own margin dries to. */
      if (outermost && R > 40) cstroke(g, [...outer, ...band.slice().reverse()], C.edge, v === "blush" ? 0.55 : 0.25, s2 + 11, pw);
    });
  };

  for (let i = set.length - 1; i >= 0; i--) ring(set[i], i); /* the skirt was laid first and let dry */
  // the THROAT: the darkest value in the picture of this flower, and it goes UNDER the heart so
  // that what shows between the tight inner petals is depth rather than paper
  const cz = bowl(0), c0 = T(0, 0.001, cz), well: P[] = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; well.push(T(a, 0.42, bowl(0.42))); }
  cstroke(g, well, mix(C.dark, WELL, 0.22), 0.6, seed + 600, R * 0.75);
  cstroke(g, well.map((p) => [at[0] + (p[0] - at[0]) * 0.6, at[1] + (p[1] - at[1]) * 0.6] as P), mix(C.dark, "#4a4426", 0.45), 0.55, seed + 602, R * 0.45);
  whorl(g, T, R, C, seed, tilt, R >= 60 ? 9 : 5, view === "half" ? 0.78 : 1);

  // ---- the centre. A domed receptacle at the bottom of the well, finely stippled, with a pale
  // star at its apex and a ring of stamens round its foot (reference 1). Never a flat button.
  const cr = R * 0.08;
  if (R > 30 && view !== "profile") {
    const green = view === "half" ? mix(BUTTON, WELL, 0.68) : mix(BUTTON, WELL, 0.3);
    cstroke(g, oval(c0[0], c0[1], cr * 1.3, cr * (0.36 + e * 0.8), 11), green, 0.94, seed + 610, cr * 2);
    cstroke(g, oval(c0[0] - cr * 0.3, c0[1] + cr * 0.38, cr * 0.9, cr * 0.46 * (0.36 + e * 0.7), 10), mix(BUTTON_DARK, WELL, 0.45), 0.5, seed + 615, cr * 1.6);
    if (R > 60) {
      g.fill(oval(c0[0] + cr * 0.06, c0[1] - cr * 0.14, cr * 0.32, cr * 0.26 * (0.4 + e * 0.6), 9), BUTTON_STAR, 0.78);
      const rs = rng(seed + 620), n = view === "half" ? 8 : 18;
      for (let k = 0; k < n; k++) { const a = rs() * Math.PI * 2, d = cr * (1.4 + rs() * 0.55), p: P = [c0[0] + Math.cos(a) * d, c0[1] + Math.sin(a) * d * (0.3 + e * 0.65)]; g.fill(oval(p[0], p[1], R * 0.0075, R * 0.006, 6), BUTTON_DARK, 0.5 + rs() * 0.34); }
    }
  }
  // ---- one cool wash over the side away from the sun, laid as an annulus that hugs the rim, so
  // it never puts a chord across the middle of the flower. No outline anywhere on the head.
  for (let pass = 0; pass < 2; pass++) {
    const a0 = 1.15 + pass * 0.3, a1 = a0 + Math.PI * (0.95 - pass * 0.18), out: P[] = [], inn: P[] = [];
    for (let i = 0; i <= 8; i++) { const a = a0 + (i / 8) * (a1 - a0); out.push(T(a, edgeR * 0.98, bowl(edgeR))); inn.push(T(a, edgeR * (0.44 + pass * 0.2), bowl(0.55))); }
    cstroke(g, [...out, ...inn.reverse()], COOL, 0.09, seed + 700 + pass, R * 1.2);
  }
  g.fill(oval(at[0] - R * 0.5, at[1] + R * (0.38 + 0.4 * e), R * 0.62, R * 0.13, 9), "#6d7f55", 0.11); /* the dab of shadow it throws below itself */
};

// The rolled heart. Each crescent knows its radius, how far round it wraps, and how high it
// stands, so the three-quarter view stacks it into the overlapping arcs the reference shows and
// the facing view rolls it into a cone. The darkness between them is the throat, not paint.
const whorl = (g: Gfx, T: (a: number, r: number, z: number) => P, R: number, C: Paints, seed: number, tilt: number, n: number, squeeze: number) => {
  const r0 = rng(seed + 900), phase = r0();
  for (let k = n - 1; k >= 0; k--) {
    const u = n > 1 ? k / (n - 1) : 1, rr = rng(seed + 910 + k * 13);
    const t = (0.26 + 0.2 * Math.pow(u, 0.7) + (rr() - 0.5) * 0.09) * squeeze; /* a tight rosette of crescents at nearly one radius, each with its own reach: a monotone radius against a turning angle is a nautilus */
    const a = (TURNS[k % TURNS.length] + phase) * Math.PI * 2 + (rr() - 0.5) * 0.34;
    const half = 0.78 + 0.28 * u + (rr() - 0.5) * 0.26; /* it wraps between a third and a half of the way round */
    const zOut = bowl(t) + 0.3 * (1 - u) + 0.06, zIn = bowl(t * 0.5) + 0.34 * (1 - u);
    const lit = 0.5 + 0.5 * Math.cos(a + 0.9 - tilt), vary = (rr() - 0.5) * 0.22;
    const N = 11, outer: P[] = [], free: P[] = [], inner: P[] = [];
    for (let q = 0; q < N; q++) { const w = q / (N - 1), ang = a + (w - 0.5) * 2 * half, rad = t * (1 + 0.05 * Math.sin(w * 5.1 + k) - 0.07 * Math.pow(Math.abs(w - 0.5) * 2, 3)); outer.push(T(ang, rad, zOut)); free.push(T(ang, rad * 0.9, zOut * 0.99)); }
    for (let q = 4; q >= 0; q--) { const w = q / 4, ang = a + (w - 0.5) * 2 * half * 0.86; inner.push(T(ang, t * 0.5, zIn)); }
    const pw = 2 * half * t * R;
    const body = mix(mix(C.pale, C.mid, 0.46 + vary), BUTTON_STAR, Math.max(0, 0.38 * (1 - t / 0.22))); /* it keeps the flower's own hue and only goes green in the last few petals over the button */
    const col = mix(body, C.dark, (1 - lit) * 0.26 + Math.max(0, vary * 0.8));
    cstroke(g, [...outer, ...inner], col, 0.94, seed + 920 + k, pw);
    cstroke(g, [...inner, ...inner.map((p) => p).reverse().slice(0, 1), ...free.slice(2, N - 2).reverse()], mix(col, WELL, 0.42), 0.6, seed + 930 + k, pw * 0.8); /* the shade where it folds down into the throat */
    g.fill(tube(outer.slice(1, N - 1), pw * 0.022, pw * 0.01, false), mix(col, C.dark, 0.5), 0.3); /* pigment dried along the free edge */
    lift(g, tube(free.slice(2, N - 2), pw * 0.02, pw * 0.009, false), seed + 940 + k, 0.34); /* and the light sitting on the fold just inside it */
  }
};

// the green sepals a cup sits in, reflexed beneath it: only ever seen from the side
const sepals = (g: Gfx, T: (a: number, r: number, z: number) => P, R: number, seed: number, amt: number) => {
  const r = rng(seed + 77);
  for (let i = 0; i < 3; i++) {
    const a = -0.35 + (i / 2) * (Math.PI + 0.7) + (r() - 0.5) * 0.18;
    const base = T(a, 0.2, bowl(0.2) - 0.14), mid = T(a, 0.66, bowl(0.66) - 0.22 * amt), tip = T(a, 0.94, bowl(0.94) - 0.34 * amt);
    g.fill(tube([base, mid, tip], R * 0.075, R * 0.025, false), i === 1 ? SEPAL : STEM_SHADE, 0.88); /* broad straps that lie under the cup, not legs */
  }
};

// A BUD: a tight green ovoid clasped by sepals that hug it and flick out at their tips, nodding
// on its own stalk, with the first sliver of the petal colour showing at the crown. Every
// reference carries one on the plant, so the clump does too.
const budHead = (g: Gfx, at: P, R: number, v: Variety, seed: number, tilt: number) => {
  const C = PAINTS[v], r = rng(seed), ct = Math.cos(tilt), st = Math.sin(tilt);
  const T = (x: number, y: number): P => [at[0] + (x * ct - y * st) * R, at[1] + (x * st + y * ct) * R];
  if (R < 6) { g.fill(oval(at[0], at[1], R, R * 1.1, 7), SEPAL, 0.85); return; }
  const ball = jitter([...Array(13)].map((_, i) => { const a = (i / 13) * Math.PI * 2; return T(Math.cos(a) * 0.8, Math.sin(a) * 1.0 - 0.08); }), R * 0.045, seed);
  g.fill(ball, PAPER, 0.92);
  g.wash(ball, mix(C.pale, SEPAL, 0.5), { alpha: 0.8, seed, shrink: 0.95, rim: true });
  g.wash(ball.map((p) => [p[0] - R * 0.22, p[1] + R * 0.2] as P), STEM_SHADE, { alpha: 0.32, seed: seed + 4, shrink: 0.8, rim: false });
  /* the sepals do not radiate: they lie ON the bud from its foot and only their points leave it */
  for (let i = 0; i < 5; i++) {
    const a = -2.5 + i * 0.78 + (r() - 0.5) * 0.22, w = Math.cos(a), h = Math.sin(a);
    const foot = T(w * 0.18, 0.86), mid = T(w * 0.62, 0.86 - Math.abs(h) * 0.7), tip = T(w * 1.02, 0.5 - h * 0.66);
    g.fill(tube([foot, mid, tip], R * 0.15, R * 0.025, false), i % 2 ? SEPAL : STEM_SHADE, 0.88);
  }
  if (R > 16) { g.wash([T(-0.34, -0.86), T(0.1, -1.02), T(0.4, -0.78), T(0.0, -0.66)], C.mid, { alpha: 0.5, seed: seed + 8, shrink: 0.9, rim: true }); } /* the first sliver of colour, breaking out at the crown */
};

// ---------------------------------------------------------------- stem, leaves, the whole plant
// Every stem gets its OWN S-curve and thickness. Nothing here is straight (rejected on sight).
export const stem = (g: Gfx, root: P, neck: P, w: number, seed: number, lean = 0) => {
  const r = rng(seed), dx = neck[0] - root[0], dy = neck[1] - root[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const bow = (0.05 + r() * 0.07) * len * (r() > 0.5 ? 1 : -1) + lean * len * 0.1, bow2 = -bow * (0.3 + r() * 0.4);
  const spine: P[] = [root, [root[0] + dx * 0.32 + nx * bow, root[1] + dy * 0.32 + ny * bow], [root[0] + dx * 0.7 + nx * bow2, root[1] + dy * 0.7 + ny * bow2], neck];
  g.fill(tube(spine, w * 1.2, w * 0.7, false), STEM_SHADE, 0.62);
  g.fill(tube(spine.map((p) => [p[0] - w * 0.34, p[1]] as P), w * 0.8, w * 0.44, false), STEM_G, 0.82); /* a stem is a cylinder: a shadow side, a lit side and the paper between them */
  for (let i = 0; i < 5; i++) { const t = 0.15 + i * 0.18, p: P = [root[0] + dx * t + nx * bow * Math.sin(t * Math.PI), root[1] + dy * t + ny * bow * Math.sin(t * Math.PI)]; g.fill(oval(p[0] + w * 0.5, p[1], w * 0.16, w * 0.5, 6), mix(STEM_G, PAPER, 0.5), 0.3); } /* faintly hairy: the light catches down one side */
  g.fill(tube([[neck[0] - w * 0.8, neck[1] + w * 1.6], [neck[0], neck[1] + w * 0.2]], w * 1.5, w * 1.1, false), SEPAL, 0.8); /* the green swell at the neck */
  return spine;
};
// A leaf: basal, deeply cut, parsley-like. Three lobes, each lobe notched twice, never a blob.
export const leaf = (g: Gfx, at: P, len: number, ang: number, seed: number, alpha = 0.9) => {
  const r = rng(seed), pts: P[] = [], lobes = 3;
  const put = (d: number, off: number) => { const a = ang + off; pts.push([at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d]); };
  put(len * 0.1, -0.1);
  for (let i = 0; i < lobes; i++) { const o = (i / (lobes - 1) - 0.5) * 1.5; put(len * (0.42 + r() * 0.12), o * 1.25); put(len * (0.86 + r() * 0.2), o * 0.95); put(len * (0.6 + r() * 0.12), o * 0.72); put(len * (0.92 + r() * 0.14), o * 0.5); put(len * (0.52 + r() * 0.1), o * 0.3); }
  put(len * 0.12, 0.1);
  g.wash(pts, LEAF, { alpha: alpha * 0.85, seed, dx: 1, dy: 1, shrink: 0.94, rim: true });
  g.wash(pts.map((p) => [at[0] + (p[0] - at[0]) * 0.72 - len * 0.05, at[1] + (p[1] - at[1]) * 0.72 - len * 0.04] as P), LEAF_LIT, { alpha: alpha * 0.4, seed: seed + 5, shrink: 0.9, rim: false });
  g.fill(tube([at, [at[0] + Math.cos(ang) * len * 0.5, at[1] + Math.sin(ang) * len * 0.5]], len * 0.03, len * 0.015, false), LEAF_LIT, 0.5);
};
// the dark ferny mass a clump sits in: leaves at the foot, smaller and cooler as they go back
export const basalLeaves = (g: Gfx, at: P, spread: number, seed: number, n = 7) => {
  const r = rng(seed), set: { p: P; L: number; a: number; s: number }[] = [];
  for (let i = 0; i < n; i++) { const t = (i / (n - 1) - 0.5) * 2; set.push({ p: [at[0] + t * spread * 0.55 + (r() - 0.5) * spread * 0.14, at[1] + (r() - 0.5) * spread * 0.1], L: spread * (0.2 + r() * 0.2), a: -Math.PI / 2 + t * 0.95 + (r() - 0.5) * 0.3, s: seed + i * 13 }); }
  set.sort((a, b) => a.p[1] - b.p[1]).forEach((s, i) => leaf(g, s.p, s.L, s.a, s.s, 0.55 + (i / n) * 0.4));
};

// ---------------------------------------------------------------- a whole plant at one position
export type Plant = { at: P; R: number; v: Variety; view: View; tilt: number; stemLen: number; seed: number; sideBud?: number };
export const plant = (g: Gfx, pl: Plant, k: number, dip = 0, lean = 0) => {
  const R = pl.R * k, w = Math.max(0.7, R * 0.05), neck: P = [pl.at[0], pl.at[1] + R * 0.86];
  const root: P = [neck[0] - pl.stemLen * k * lean * 0.5, neck[1] + pl.stemLen * k];
  if (R > 5) {
    stem(g, root, [neck[0] + dip * R * 0.2, neck[1] + dip * R * 0.1], w, pl.seed + 3, lean);
    if (R > 22) { const r = rng(pl.seed + 9), ly = 0.45 + r() * 0.2, at: P = [root[0] + (neck[0] - root[0]) * ly, root[1] + (neck[1] - root[1]) * ly]; leaf(g, at, R * 0.62, r() > 0.5 ? -0.5 : Math.PI + 0.5, pl.seed + 11, 0.85); }
    if (pl.sideBud !== undefined && R > 18) { const b: P = [neck[0] + Math.cos(pl.sideBud) * R * 1.35, neck[1] + R * 0.5 + Math.sin(pl.sideBud) * R * 0.7]; g.fill(tube([[neck[0], neck[1] + R * 0.5], b], w * 0.9, w * 0.5, false), STEM_G, 0.85); head(g, b, R * 0.3, pl.v, { view: "bud", seed: pl.seed + 17, tilt: pl.sideBud * 0.4 }); }
  }
  head(g, [pl.at[0] + dip * R * 0.12, pl.at[1] + dip * R * 0.1], R, pl.v, { view: pl.view, tilt: pl.tilt + dip * 0.1 + lean * 0.3, seed: pl.seed, dip });
};
