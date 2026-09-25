// LESSON: HOW TO DRAW A CAT SITTING, in graphite pencil. A basic-drawing lesson from a plain
// request, written as a drawing score (drawingScore.ts): blue construction first, a checked and
// corrected ear, the outline committed in graphite, the blue lifted, then value masses, details
// and the darkest accents last.
//
// MEDIUM, physically: an HB graphite pencil on warm cartridge paper, and a blue col-erase pencil
// for construction (it erases cleanly and does not smear under graphite). Graphite deposits on
// the paper's tooth, so light pressure leaves the valleys white and pressing harder fills them.
// Tone is hatching in one diagonal (lower left to upper right, the natural swing of a right hand),
// cross-hatched only in the deepest darks. A kneaded eraser lifts the blue and leaves a ghost.
//
// SUBJECT: a domestic short-haired cat sitting, three-quarter view, head turned toward us and a
// little to our left, tail wrapped round the front paws. Anatomy that makes it read as a cat and
// not an icon: the head is a slightly flattened ball, wider than tall, with the eyes ON the middle
// line of the head and the ears set on the top corners (not on top, not on the sides); the ear is
// a rounded triangle about as tall as the gap between the eyes is wide; the muzzle is two small
// puffs under a short nose; the chest is an egg tipped back; the haunch (the folded hind leg) is
// the biggest mass in the drawing and sits BESIDE the chest, not under it; the front legs are
// straight columns that come down from the chest to small oval paws; the hind foot lies flat along
// the ground in front of the haunch; the tail comes from the base of the spine behind the haunch.
// REFERENCE (from knowledge): sitting domestic cats in three-quarter view; the standard teaching
// construction of head ball + chest egg + haunch circle used in animal-drawing primers. The
// proportions are measured in head heights, which is what the lesson teaches.
// LIGHT: from the upper left. Shade side: under the chin, the right of the chest, the lower right
// of the haunch, the tail's underside. Cast shadow falls to the lower right, on the floor.
import { type P } from "./core";
import { ScoreBuilder, type Score } from "./drawingScore";
import { contour, edgeDist, ellR, ellipsePts, eraserPath, guideLine, hatch, inter, minus, polyR, scribbleDot, sketchEllipse, stroke, union } from "./drawingMarks";
import { lessonFilm } from "./lesson";

const BLUE = "#4f7fcc", LEAD = "#3b3638", DARK = "#221d20", PAPER = "#f5f0e6";
const HATCH = -0.95; // the right hand's diagonal
const G = (seed: number) => ({ w: 2.1, col: BLUE, a: 0.62, seed }); // construction pencil

// ---------------------------------------------------------------- the cat, as geometry
const HEAD = { cx: 430, cy: 330, rx: 97, ry: 86 };
const CHEST = { cx: 445, cy: 560, rx: 100, ry: 150, rot: -0.12 };
const HAUNCH = { cx: 612, cy: 748, r: 146 };
const GROUND = 905;

const headOutline: P[] = [[352, 286], [336, 322], [338, 358], [352, 388], [378, 410], [414, 419], [452, 412], [488, 392], [512, 362], [522, 326], [514, 290]];
const crown: P[] = [[402, 253], [428, 246], [452, 250]];
const farEar: P[] = [[354, 288], [347, 238], [352, 203], [376, 222], [402, 253]];
const nearEar: P[] = [[452, 250], [478, 214], [502, 190], [512, 236], [514, 290]];
const wrongEar: P[] = [[462, 252], [480, 190], [492, 134], [503, 200], [506, 282]]; // too tall, too narrow: the classic first try
const back: P[] = [[516, 300], [532, 338], [546, 382], [566, 428], [582, 470], [612, 522], [658, 574], [708, 622], [746, 690], [762, 764], [752, 832], [722, 884]]; // nape, shoulder blade, back, over the haunch
const chestFront: P[] = [[392, 420], [366, 452], [350, 510], [348, 574], [362, 626], [376, 660]];
const farLeg: P[] = [[376, 660], [383, 740], [386, 820], [382, 872]];
const nearLegF: P[] = [[438, 640], [445, 740], [449, 820], [447, 876]];
const nearLegB: P[] = [[494, 642], [497, 740], [497, 820], [495, 876]];
const belly: P[] = [[497, 700], [516, 742], [530, 800], [528, 860], [518, 884]];
const thigh: P[] = [[548, 660], [590, 622], [650, 612], [705, 640]];
const farPaw: P[] = [[366, 884], [372, 874], [390, 870], [408, 874], [414, 886], [400, 893], [378, 893]];
const nearPaw: P[] = [[438, 890], [446, 876], [468, 872], [490, 876], [500, 888], [486, 897], [455, 898]];
const hindFoot: P[] = [[514, 886], [540, 877], [572, 876], [592, 884], [584, 896], [548, 898], [520, 896]];
const tailOut: P[] = [[744, 850], [786, 872], [796, 900], [764, 918], [700, 924], [610, 922], [540, 918], [498, 914], [476, 906]];
const tailIn: P[] = [[722, 880], [752, 890], [750, 902], [700, 908], [610, 908], [540, 905], [500, 902], [476, 906]];

// ---------------------------------------------------------------- the lesson
export const catScore = (): Score => {
  const b = new ScoreBuilder({ id: "cat", title: "How to draw a cat sitting", medium: "Graphite pencil, HB and 2B, with a blue col-erase pencil and a kneaded eraser", W: 1080, H: 1080, paper: PAPER, toothAngle: -0.6 })
    .layer("guides", 0, 1, "blue construction: erased before shading").layer("wrong", 0, 1, "the first ear, isolated so it can be erased alone")
    .layer("line", 0).layer("tone", 1).layer("dark", 2);
  b.part("gesture", "gesture and ground").part("head", "head", ["gesture"]).part("chest", "chest", ["head"]).part("haunch", "haunch", ["chest"])
    .part("face", "face", ["head"]).part("ears", "ears", ["head"]).part("legs", "front legs and paws", ["chest"]).part("hind", "hind foot", ["haunch"]).part("tail", "tail", ["haunch"]).part("shadow", "cast shadow", ["legs"]);

  // 1. placement
  b.step("s1", "placement", {
    title: "Place it and measure",
    caption: "One curve for the lean of the back, a floor line, and ticks for the height: this cat is about four heads tall.",
    look: "Before any cat, decide how big it is and where it sits. Mark the top of the ears and the floor first, then divide the height into head units.",
    how: "Hold the pencil far back and draw from the shoulder. Blue col-erase pencil, very light: none of these lines will survive.",
    mistake: "Starting with an eye. Details drawn first fix the size of everything else, and the cat never fits the page.",
  });
  b.add("gesture.floor", "gesture", "guides", "guide", guideLine([230, GROUND], [860, GROUND], G(11)));
  b.add("gesture.lean", "gesture", "guides", "guide", stroke([[424, 236], [470, 300], [560, 420], [660, 560], [730, 690], [752, 800], [735, 880]], { w: 2.3, col: BLUE, a: 0.62 }));
  [196, 376, 556, 736, GROUND].forEach((y, i) => b.add(`gesture.tick${i}`, "gesture", "guides", "guide", guideLine([252, y], [282, y], G(20 + i))));
  b.add("gesture.height", "gesture", "guides", "guide", guideLine([267, 196], [267, GROUND], { ...G(26), a: 0.45 }));

  // 2. big shapes
  b.step("s2", "shapes", {
    title: "Three masses",
    caption: "A ball for the head, an egg tipped back for the chest, and a big circle for the haunch, the largest shape of all.",
    look: "The haunch is about one and a half heads across and sits BESIDE the chest, behind it. Check that the chest egg leans back along your curve.",
    how: "Draw each shape in one loose loop that goes round a little more than once. Let the second pass correct the first; do not scrub.",
    mistake: "Drawing the body as one sausage. A sitting cat folds: without the haunch mass it reads as a bottle with ears.",
  });
  b.add("head.ball", "head", "guides", "guide", sketchEllipse(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, G(31)));
  b.add("chest.egg", "chest", "guides", "guide", sketchEllipse(CHEST.cx, CHEST.cy, CHEST.rx, CHEST.ry, { ...G(32), rot: CHEST.rot }));
  b.add("haunch.circle", "haunch", "guides", "guide", sketchEllipse(HAUNCH.cx, HAUNCH.cy, HAUNCH.r, HAUNCH.r * 0.97, G(33)));
  b.add("chest.neck", "chest", "guides", "guide", stroke([[370, 405], [362, 440], [356, 470]], { w: 2, col: BLUE, a: 0.55 }));
  b.add("chest.nape", "chest", "guides", "guide", stroke([[505, 312], [535, 360], [548, 420]], { w: 2, col: BLUE, a: 0.55 }));

  // 3. construction
  b.step("s3", "construction", {
    title: "Build the parts",
    caption: "Cross lines on the head ball, triangles for ears, a small oval muzzle, straight tubes for the front legs, and the tail's path.",
    look: "The eye line runs across the MIDDLE of the head, not near the top. The centre line curves round the ball because the head is turned.",
    how: "Wrap the cross lines round the ball as if drawing on an orange. Legs are two straight columns; paws are flat ovals on the floor line.",
    mistake: "Eyes placed high on the head, or ears stuck on the sides. Both make a cat look like a bear or an owl.",
  });
  b.add("face.centre", "face", "guides", "guide", stroke([[430, 244], [412, 290], [405, 340], [412, 400], [418, 418]], { w: 2, col: BLUE, a: 0.6 }));
  b.add("face.eyeline", "face", "guides", "guide", stroke([[336, 318], [380, 332], [430, 336], [480, 330], [522, 318]], { w: 2, col: BLUE, a: 0.6 }));
  b.add("face.muzzle", "face", "guides", "guide", sketchEllipse(418, 386, 42, 27, { ...G(41), turns: 1.1 }));
  b.add("ears.far", "ears", "guides", "guide", stroke([[354, 290], [351, 204], [404, 254]], { w: 2, col: BLUE, a: 0.6, smooth: false }));
  b.add("ears.nearWrong", "ears", "wrong", "guide", stroke([wrongEar[0], wrongEar[2], wrongEar[4]], { w: 2, col: BLUE, a: 0.6, smooth: false }));
  b.add("legs.far", "legs", "guides", "guide", stroke([[382, 640], [388, 760], [388, 876]], { w: 2, col: BLUE, a: 0.55 }));
  b.add("legs.nearF", "legs", "guides", "guide", stroke([[440, 640], [446, 760], [448, 878]], { w: 2, col: BLUE, a: 0.55 }));
  b.add("legs.nearB", "legs", "guides", "guide", stroke([[494, 640], [498, 760], [496, 878]], { w: 2, col: BLUE, a: 0.55 }));
  b.add("legs.farPaw", "legs", "guides", "guide", sketchEllipse(390, 884, 26, 11, { ...G(44), turns: 1.05 }));
  b.add("legs.nearPaw", "legs", "guides", "guide", sketchEllipse(469, 886, 32, 12, { ...G(45), turns: 1.05 }));
  b.add("hind.foot", "hind", "guides", "guide", sketchEllipse(553, 887, 40, 10, { ...G(46), turns: 1.05 }));
  b.add("tail.path", "tail", "guides", "guide", stroke([[742, 846], [790, 884], [760, 914], [640, 918], [520, 912], [476, 906]], { w: 2.2, col: BLUE, a: 0.6 }));

  // 4. check and correct
  b.step("s4", "construction", {
    title: "Check, then correct",
    caption: "Measure before you commit. The ear is too tall: it should be about as tall as the eyes are apart. Lift it and redraw.",
    look: "Compare ear height with the distance between the eyes, and ear width with its height. Cat ears are nearly as wide at the base as they are tall.",
    how: "Hold the pencil at arm's length as a ruler, or just compare two lengths by eye. Press the kneaded eraser, do not rub.",
    mistake: "Correcting after shading. Once graphite goes over a wrong line it will not lift cleanly; fix proportions while it is all blue.",
  });
  b.add("ears.measure", "ears", "guides", "guide", guideLine([380, 348], [448, 348], { ...G(51), a: 0.5 }));
  b.erase("ears.lift", "ears", "wrong", eraserPath([456, 128, 512, 290], { seed: 52, bite: 22 }), { width: 24, ghost: 0.08 });
  b.add("ears.near", "ears", "guides", "correction", stroke([[452, 252], [502, 190], [514, 290]], { w: 2.1, col: BLUE, a: 0.62, smooth: false }), { supersedes: "ears.nearWrong" });

  // 5. commit the outline, then lift the blue
  b.step("s5", "construction", {
    title: "Commit to the outline",
    caption: "Now the graphite line, following the blue. Press harder on the shadow side, go light where the light hits, then lift the blue.",
    look: "The outline is not one wire. It thickens under the chin, the belly and the haunch, and almost disappears along the lit top of the back.",
    how: "Short overlapping strokes, each starting a little inside the last. Rotate the paper so every stroke pulls toward you.",
    mistake: "Tracing every blue line. Leave out the construction: no circles show through a cat's fur.",
  });
  const lit = (x: number, y: number) => 0.55 + 0.9 * Math.max(0, Math.min(1, (x - 360) / 420 + (y - 300) / 900)); // weight grows away from the upper-left light
  const C = (name: string, part: string, pts: P[], seed: number, w = 2.3, keep = lit, closed = false) => b.addAll(`${part}.${name}`, part, "line", "line", contour(pts, { w, col: LEAD, a: 0.9, seed, keep: (x, y) => keep(x, y), closed }));
  C("outline", "head", headOutline, 61); C("crown", "head", crown, 62, 2); C("far", "ears", farEar, 63, 2.1); C("near", "ears", nearEar, 64, 2.2);
  C("front", "chest", chestFront, 65, 2.2); C("back", "haunch", back, 66, 2.3, (x, y) => (y < 560 ? 0.25 + (y - 300) / 520 : lit(x, y)));
  C("far", "legs", farLeg, 67, 2.2); C("nearF", "legs", nearLegF, 68, 2.2); C("nearB", "legs", nearLegB, 69, 2.5); C("belly", "haunch", belly, 70, 2.5); C("thigh", "haunch", thigh, 71, 1.7, () => 0.6);
  C("farPaw", "legs", farPaw, 72, 2.1, () => 1, true); C("nearPaw", "legs", nearPaw, 73, 2.2, () => 1, true); C("foot", "hind", hindFoot, 74, 2.2, () => 1, true);
  C("out", "tail", tailOut, 75, 2.4); C("in", "tail", tailIn, 76, 2.1);
  b.erase("gesture.lift", "gesture", "guides", eraserPath([220, 180, 880, 930], { seed: 77, bite: 42 }), { width: 46, ghost: 0.06 });

  // 6. value masses
  b.step("s6", "values", {
    title: "Shadow masses",
    caption: "Light comes from the upper left. Hatch the shade side as whole shapes: under the chin, right of the chest, the haunch, the floor.",
    look: "Squint. Find the three or four biggest dark shapes and ignore the fur. The cast shadow on the floor falls to the right and hugs the paws.",
    how: "Parallel strokes in one diagonal, laid side by side in patches. Build darker by going over again, not by pressing hard on the first pass.",
    mistake: "Outlining the shadow and colouring it in, or shading every part the same grey. Keep the lit side almost bare paper.",
  });
  const headShape = [...headOutline], chestShape: P[] = [[392, 420], [366, 452], [350, 510], [348, 574], [362, 626], [376, 660], [383, 740], [386, 820], [382, 872], [447, 876], [495, 876], [518, 884], [528, 860], [530, 800], [516, 742], [497, 700], [548, 660], [590, 622], [540, 470], [516, 300], [488, 392], [452, 412]];
  const haunchShape: P[] = [[612, 522], [658, 574], [708, 622], [746, 690], [762, 764], [752, 832], [722, 884], [612, 890], [548, 880], [528, 860], [530, 800], [516, 742], [510, 690], [548, 640], [575, 580]];
  const sideShape: P[] = [[516, 300], [532, 338], [546, 382], [566, 428], [582, 470], [612, 522], [575, 580], [548, 640], [510, 690], [497, 700], [494, 642], [470, 560], [488, 392]];
  const H = (name: string, part: string, reg: ReturnType<typeof polyR>, dens: (x: number, y: number) => number, seed: number, o: { gap?: number; len?: number; a?: number; w?: number; ang?: number; layer?: string } = {}) =>
    b.addAll(`${part}.${name}`, part, o.layer ?? "tone", "fill", hatch(reg, { ang: o.ang ?? HATCH, gap: o.gap ?? 5.2, len: o.len ?? 34, w: o.w ?? 1.9, col: LEAD, a: o.a ?? 0.55, seed, dens }));
  const clampD = (v: number) => Math.max(0, Math.min(1, v));
  H("chin", "head", polyR([[372, 398], [414, 422], [470, 410], [500, 388], [520, 440], [470, 470], [390, 460]]), (x, y) => clampD(0.95 - (y - 410) / 90) * clampD((x - 360) / 60), 81);
  H("cheek", "head", polyR(headShape), (x, y) => clampD(((x - 470) / 60) * 0.55 + (y - 360) / 200) * 0.7, 82, { gap: 6.5 });
  // the side of the body turns away from the light: a gentle half-tone that deepens toward the back
  H("side", "chest", polyR(sideShape), (x, y) => clampD(0.12 + (x - 480) / 260 + (y - 420) / 900) * 0.62, 83, { gap: 6.2 });
  // the pocket between the near leg, the belly and the haunch: the deepest shade on the body
  H("pocket", "chest", polyR([[494, 642], [510, 690], [516, 742], [530, 800], [528, 860], [518, 884], [496, 878], [497, 760]]), (x, y) => clampD(0.55 + (y - 660) / 300), 88, { gap: 4.4 });
  // the haunch is a ball lit from the upper left: tone grows with distance from its light spot
  H("mass", "haunch", polyR(haunchShape), (x, y) => { const d = Math.hypot(x - 575, y - 640); return clampD((d - 55) / 190) * 0.95; }, 84);
  H("under", "tail", polyR([...tailOut, ...[...tailIn].reverse()]), (x) => clampD(0.55 + (x - 480) / 700), 85, { gap: 4.5, len: 22 });
  H("floor", "shadow", minus(ellR(650, 912, 238, 24), polyR([...tailOut, ...[...tailIn].reverse()]), polyR(nearPaw), polyR(hindFoot)), (x) => clampD(0.9 - Math.abs(x - 640) / 260), 86, { ang: -0.12, gap: 4.2, len: 40, a: 0.45 });
  H("ears", "ears", union(polyR([[360, 282], [356, 220], [392, 252]]), polyR([[466, 250], [500, 202], [506, 282]])), () => 0.8, 87, { gap: 4, len: 20 });

  // 7. edges and details
  b.step("s7", "edges", {
    title: "Face and fur",
    caption: "Almond eyes on the eye line, a small nose where the centre line ends, a short Y for the mouth. Flick fur at the chest.",
    look: "The eyes sit one eye-width apart. The far eye is narrower because it turns away. Fur shows only at the edges: the ruff, the cheeks, the tail tip.",
    how: "Draw the eye shape, shade the iris lightly and leave a small white highlight on the same side for both eyes. Fur flicks go in the direction the hair grows.",
    mistake: "Round cartoon eyes with a dot. A cat's eye is an almond with a vertical slit pupil, and the upper lid is darker than the lower.",
  });
  const eye = (id: string, cx: number, cy: number, w: number, h: number, seed: number) => {
    const top: P[] = [[cx - w / 2, cy + 2], [cx - w / 4, cy - h / 2], [cx + w / 4, cy - h / 2 - 1], [cx + w / 2, cy - 2]], bot: P[] = [[cx - w / 2, cy + 2], [cx - w / 5, cy + h / 2], [cx + w / 4, cy + h / 2 - 1], [cx + w / 2, cy - 2]];
    b.addAll(`face.${id}Lid`, "face", "line", "line", contour(top, { w: 2.6, col: DARK, a: 0.95, seed, seg: 90 }));
    b.addAll(`face.${id}Low`, "face", "line", "line", contour(bot, { w: 1.5, col: LEAD, a: 0.8, seed: seed + 1, seg: 90 }));
    b.addAll(`face.${id}Iris`, "face", "tone", "fill", hatch(minus(ellR(cx, cy, w * 0.42, h * 0.42), ellR(cx - w * 0.14, cy - h * 0.15, 3.2, 3.2)), { ang: HATCH, gap: 2.6, len: 12, w: 1.4, col: LEAD, a: 0.5, seed: seed + 2 }));
  };
  eye("farEye", 379, 331, 40, 20, 91); eye("nearEye", 453, 331, 48, 23, 95);
  b.addAll("face.nose", "face", "line", "line", contour([[406, 366], [420, 364], [432, 367], [420, 380], [406, 366]], { w: 2, col: DARK, a: 0.9, seed: 99, seg: 40, smooth: false }));
  b.add("face.philtrum", "face", "line", "line", stroke([[420, 380], [419, 392]], { w: 1.8, col: LEAD, a: 0.85 }));
  b.add("face.mouthL", "face", "line", "line", stroke([[419, 392], [408, 400], [396, 398]], { w: 1.8, col: LEAD, a: 0.85 }));
  b.add("face.mouthR", "face", "line", "line", stroke([[419, 392], [432, 401], [446, 398]], { w: 1.8, col: LEAD, a: 0.85 }));
  b.addAll("ears.innerFar", "ears", "line", "line", contour([[362, 280], [357, 226], [388, 250]], { w: 1.4, col: LEAD, a: 0.7, seed: 101 }));
  b.addAll("ears.innerNear", "ears", "line", "line", contour([[468, 248], [500, 206], [506, 276]], { w: 1.4, col: LEAD, a: 0.7, seed: 102 }));
  // fur: short flicks in the direction of growth, only where an edge turns (ruff, cheek, tail tip)
  const flicks = (name: string, part: string, base: P[], dir: P, n: number, seed: number, L = 16) => { const out = []; let r = seed; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, k = Math.floor(t * (base.length - 1)), f = t * (base.length - 1) - k, a = base[k], c = base[Math.min(base.length - 1, k + 1)], x = a[0] + (c[0] - a[0]) * f, y = a[1] + (c[1] - a[1]) * f; r = (r * 9301 + 49297) % 233280; const j = r / 233280; out.push(stroke([[x, y], [x + dir[0] * L * (0.7 + j * 0.6) * 0.5 + (j - 0.5) * 3, y + dir[1] * L * (0.7 + j * 0.6) * 0.5], [x + dir[0] * L * (0.7 + j * 0.6), y + dir[1] * L * (0.7 + j * 0.6)]], { w: 1.5, col: LEAD, a: 0.75 })); } return b.addAll(`${part}.${name}`, part, "line", "line", out); };
  flicks("ruff", "chest", [[392, 424], [372, 450], [358, 488], [352, 526]], [-0.55, 0.85], 11, 7, 18);
  flicks("cheekL", "head", [[338, 340], [342, 370], [356, 392]], [-0.8, 0.5], 5, 11, 14);
  flicks("cheekR", "head", [[516, 350], [506, 376], [490, 394]], [0.8, 0.55], 4, 13, 13);
  flicks("tip", "tail", [[480, 904], [492, 910], [504, 914]], [-0.9, -0.2], 4, 17, 12);
  // tabby markings: the M on the brow and a few bands on the tail: they wrap round the form, so they curve
  b.addAll("face.brow", "face", "tone", "line", [stroke([[392, 290], [400, 272], [408, 292]], { w: 2, col: LEAD, a: 0.6 }), stroke([[416, 288], [420, 266], [428, 288]], { w: 2, col: LEAD, a: 0.6 }), stroke([[436, 290], [446, 270], [452, 294]], { w: 2, col: LEAD, a: 0.6 })]);
  b.addAll("tail.bands", "tail", "tone", "line", [[560, 906, 918], [620, 907, 921], [680, 906, 921], [740, 896, 914]].map(([x, y0, y1]) => stroke([[x, y0], [x - 4, (y0 + y1) / 2], [x - 1, y1]], { w: 4.2, col: LEAD, a: 0.55 })));

  // 8. accents
  b.step("s8", "accents", {
    title: "Darkest darks last",
    caption: "Pupils, nostrils, the corner of the mouth and the line where the paws touch the floor. Then whiskers: light, fast, curved.",
    look: "Only a few spots get the darkest dark. They pull the eye to the face and pin the cat to the floor.",
    how: "Switch to the 2B and press. Whiskers go last in single quick strokes that start at the muzzle and lift off; stop when in doubt.",
    mistake: "Heavy whiskers drawn slowly. Six light curved flicks read better than twelve dark straight ones.",
  });
  b.add("face.farPupil", "face", "dark", "fill", scribbleDot(381, 332, 3.2, 9.5, { w: 2.6, col: DARK, a: 0.95, seed: 111 }));
  b.add("face.nearPupil", "face", "dark", "fill", scribbleDot(455, 332, 3.8, 11, { w: 2.8, col: DARK, a: 0.95, seed: 112 }));
  b.add("face.nostril", "face", "dark", "fill", scribbleDot(419, 371, 6, 3.5, { w: 2.4, col: DARK, a: 0.9, seed: 113 }));
  b.addAll("shadow.contact", "shadow", "dark", "fill", hatch(union(ellR(468, 898, 36, 5), ellR(392, 894, 28, 4.5), ellR(572, 900, 46, 4.5)), { ang: -0.1, gap: 2.4, len: 18, w: 1.6, col: DARK, a: 0.8, seed: 114 }));
  b.addAll("chest.crease", "chest", "dark", "line", contour([[400, 424], [440, 428], [476, 414]], { w: 2.2, col: DARK, a: 0.75, seed: 115, seg: 50 }));
  const whisk = (x: number, y: number, dx: number, dy: number, bend: number) => stroke([[x, y], [x + dx * 0.5, y + dy * 0.5 - bend], [x + dx, y + dy]], { w: 1.25, col: LEAD, a: 0.7 });
  b.addAll("face.whiskers", "face", "dark", "line", [whisk(400, 386, -92, -8, 6), whisk(400, 392, -96, 10, 5), whisk(402, 398, -80, 26, 3), whisk(440, 386, 96, -10, 6), whisk(440, 392, 100, 8, 5), whisk(438, 398, 84, 26, 3)]);
  void inter; void edgeDist; void ellipsePts;
  return b.build();
};

export const lessonCat = lessonFilm(catScore, { outro: "Finished. Now draw it again from memory, bigger: the second cat teaches you more than the first." });

export const LESSON = { score: catScore, sheet: "lessonCatSheet", final: "lessonCatFinal" };
