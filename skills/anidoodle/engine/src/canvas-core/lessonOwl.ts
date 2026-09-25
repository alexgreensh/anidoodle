// LESSON: HOW TO DRAW AN OWL. The famous two-step meme ("1. Draw some circles. 2. Draw the rest
// of the owl.") with the steps it skips put back. Step 1 is the meme's step 1 (two circles, head
// over body); step 9 is the meme's step 2, and it is earned by the seven in between.
// A basic-drawing lesson from a plain request, written as a drawing score (drawingScore.ts).
// The meme was studied for pose only; nothing here is traced from it (our owl faces the other way
// on a branch that rises to the right, with its own proportions, feathers and light).
//
// MEDIUM, physically: graphite pencils 2B, 4B and 6B on warm cartridge paper, and a blue col-erase
// pencil for construction (it lifts cleanly and does not smear under graphite). Graphite catches
// the paper's tooth: light pressure leaves the valleys white, pressing hard fills them, and the 6B
// fills them almost solid. Tone is built as hatching in the right hand's diagonal; texture is laid
// in the direction the feathers lie. A kneaded eraser lifts the blue to a ghost, and at the end
// lifts catchlights and lost edges out of the graphite.
//
// SUBJECT: a great horned owl (Bubo virginianus) perched facing us, eyes half-closed under a stern
// V brow, ear tufts up. Anatomy that makes it read as this owl and not an icon:
//   - the head is wider than tall and about 3/4 the body's width; the whole bird, tuft tips to
//     tail tip, is about 3 1/4 head-circles tall;
//   - ear tufts are FEATHERS, set wide on the corners of the head, not ears on top;
//   - the facial disc is two rounded lobes around the eyes, framed by a dark rim that runs from
//     beside the brow down round the cheeks to the chin;
//   - the eyes are huge, forward-facing, set on one line about 40% down the head; half-closed,
//     the upper lid is a straight dark bar slanting down toward the beak (the stern V);
//   - pale brow feathers make the V above the eyes; a dark stripe runs down between them to the beak;
//   - the beak is small, dark and hooked, its top half buried in bristly facial feathers;
//   - a white throat bib sits under the chin, then a dark mottled upper breast;
//   - the chest is pale, finely barred; the bars follow the round body (they curve like smiles
//     because we look slightly down on them) and crowd together as the belly turns under;
//   - the folded wings cover the sides: rows of scalloped coverts on top, long barred primaries below;
//   - feathered legs and toes; three toes forward over the branch, one back; hooked black talons;
//   - the tail hangs below the branch, barred.
// REFERENCE (from knowledge): field-guide plates and photographs of perched great horned owls;
// the classic head-circle-over-body-oval construction taught in bird-drawing primers.
// LIGHT: from the upper left. Shade side: the bird's left (our right), the eye sockets, the upper
// breast under the chin, the underside of the branch. The owl's shadow falls down-right on the branch.
import { rng, type P } from "./core";
import { ScoreBuilder, type Score } from "./drawingScore";
import { contour, ellR, eraserPath, guideLine, hatch, minus, polyR, scribbleDot, sketchEllipse, stroke, union, inter, type Ink, type Region } from "./drawingMarks";
import { owlFilm } from "./lessonOwlLayout";

const BLUE = "#3a68c0", LEAD = "#2a2527", DARK = "#141012", SOFT = "#403a3c", PAPER = "#f6f1e6";
const HATCH = -0.95; // the right hand's diagonal
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const G = (seed: number, a = 0.75) => ({ w: 5, col: BLUE, a, seed }); // construction pencil
const mir = (pts: P[], dx = 0, dy = 0): P[] => pts.map(([x, y]) => [1000 - x + dx, y + dy] as P);
const rev = (pts: P[]) => [...pts].reverse();
// x of a polyline (monotonic in y) at height y
const xAt = (pts: P[], y: number) => { if (y <= pts[0][1]) return pts[0][0]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (y <= b[1]) return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1] || 1); } return pts[pts.length - 1][0]; };
const rot = ([x, y]: P, a: number): P => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// ---------------------------------------------------------------- the owl, as geometry (design 1000 x 1200)
const HEAD = { cx: 500, cy: 300, r: 160 }, BODY = { cx: 500, cy: 650, rx: 215, ry: 320 };
// the branch rises to the right: centreline y at x, and its half thickness
const bc = (x: number) => 1030 - 0.155 * (x - 20), BH = 31, BANG = Math.atan(-0.155);
const bTop = (x: number) => bc(x) - BH, bBot = (x: number) => bc(x) + BH;

const tuftLo: P[] = [[347, 224], [346, 184], [350, 140], [357, 104], [364, 74]];      // outer edge, up to the tip
const tuftLi: P[] = [[364, 74], [375, 104], [388, 140], [402, 168], [418, 184]];      // inner edge, down to the crown
const crown: P[] = [[418, 184], [458, 191], [500, 193], [542, 190], [582, 183]];
const tuftRi: P[] = [[582, 183], [598, 166], [612, 138], [625, 102], [638, 72]];
const tuftRo: P[] = [[638, 72], [645, 102], [651, 140], [655, 184], [654, 224]];
const headL: P[] = [[347, 224], [338, 266], [337, 316], [342, 362], [346, 400]];
const headR: P[] = [[654, 224], [663, 267], [664, 318], [659, 364], [655, 402]];
// no neck: the head flows straight into the shoulders, and the body is an egg, widest low down
const sideL: P[] = [[346, 400], [342, 440], [330, 492], [314, 552], [301, 622], [293, 694], [294, 764], [304, 832], [322, 886], [345, 926], [372, 954]];
const sideR: P[] = [[655, 402], [659, 442], [671, 494], [687, 554], [700, 624], [707, 698], [705, 770], [694, 836], [680, 876], [666, 900], [652, 914]];
// the belly's lower edge, feathers draped just over the front of the branch, broken where the feet come out
const bottom: P[] = [[372, 956], [400, 951], [425, 947], [446, 944], [468, 941], [500, 936], [535, 931], [560, 928], [582, 925], [620, 919], [652, 914]];
const wingLi: P[] = [[372, 468], [390, 535], [402, 615], [405, 700], [399, 790], [389, 870], [378, 934]];
const wingRi: P[] = [[629, 470], [611, 537], [599, 617], [596, 702], [602, 792], [612, 870], [626, 912]];
// the tail fans a little and ends in a row of rounded feather tips, not a capsule
const tailL: P[] = [[465, 990], [462, 1030], [459, 1070], [460, 1097]], tailTip: P[] = [[460, 1097], [470, 1108], [481, 1101], [492, 1112], [503, 1105], [515, 1112], [526, 1101], [537, 1107], [545, 1095]], tailR: P[] = [[545, 1095], [547, 1066], [548, 1030], [549, 982]];

const rimL: P[] = [[372, 240], [357, 272], [351, 314], [356, 356], [371, 392], [400, 420], [440, 440], [476, 449], [500, 451]];
const rimR: P[] = mir(rimL, 1, 1).map(([x, y], i) => [x + (i < 3 ? 2 : 0), y] as P);
const browL: P[] = [[376, 266], [402, 258], [430, 264], [460, 282], [490, 306]];     // upper edge of the pale brow (the V)
const browR: P[] = mir(browL, 1, 0);
// the eyes are big discs (no white shows on an owl); half-closed, the upper lid is a bar that
// slants down toward the beak and hides the top half. Lower lid = the disc's own lower arc.
const EYE_R = 38, eyeL = { cx: 436, cy: 300 }, eyeR = { cx: 565, cy: 300 };
const arcPts = (cx: number, cy: number, r: number, a0: number, a1: number, n = 10): P[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as P; });
const lowL: P[] = arcPts(eyeL.cx, eyeL.cy, EYE_R, Math.PI - 0.12, 0.42);
const lidL: P[] = [lowL[0], [420, 300], [444, 304], [462, 310], lowL[lowL.length - 1]];
const lowR: P[] = arcPts(eyeR.cx, eyeR.cy, EYE_R, 0.12, Math.PI - 0.42);
const lidR: P[] = [lowR[0], [581, 303], [557, 307], [539, 313], lowR[lowR.length - 1]]; // the right eye a touch more closed
const beak: P[] = [[487, 327], [500, 321], [513, 327], [512, 343], [507, 359], [500, 375], [493, 359], [488, 343]];
const bib: P[] = [[428, 447], [468, 456], [500, 459], [532, 456], [572, 447], [592, 470], [562, 494], [500, 502], [438, 494], [408, 470]];
const eyePoly = (lid: P[], low: P[]) => [...lid, ...rev(low)];

// regions
const bodyShape: P[] = [...sideL, ...bottom.slice(1, -1), ...rev(sideR)];
const wingLShape: P[] = [...wingLi, ...rev(sideL.slice(1, 10))];
const wingRShape: P[] = [...wingRi, ...rev(sideR.slice(1, 10))];
const breastShape: P[] = [[352, 432], ...wingLi, [400, 951], [446, 944], [500, 936], [560, 928], ...rev(wingRi), [648, 432], [500, 456]];
const discL: P[] = [...rimL, [500, 380], [490, 330], [490, 301], ...rev(browL)];
const discR: P[] = [...rimR, [500, 380], [510, 330], [510, 301], ...rev(browR)];
const forehead: P[] = [...browL, [500, 306], ...rev(browR), [628, 236], [612, 196], ...rev(tuftRi).slice(0, 1), ...rev(crown), [398, 196], [372, 236]];
const cheekL: P[] = [...headL, ...rev(rimL).slice(4), [374, 234]], cheekR: P[] = [...headR, ...rev(rimR).slice(4), [626, 234]];
const tuftLShape: P[] = [[347, 224], ...tuftLo.slice(1), ...tuftLi.slice(1), [392, 200], [370, 232]];
const tuftRShape: P[] = [[654, 224], ...tuftRo.slice(0, -1).reverse(), ...rev(tuftRi).slice(1), [608, 200], [630, 232]];
const tailShape: P[] = [...tailL, ...tailTip.slice(1), ...tailR.slice(1)];
const branchShape: P[] = []; for (let x = 36; x <= 1004; x += 24) branchShape.push([x, bTop(x) + Math.sin(x * 0.05) * 1.5]); for (let x = 1004; x >= 36; x -= 24) branchShape.push([x, bBot(x) + Math.sin(x * 0.043 + 1) * 2]);
const branchR = minus(polyR(branchShape), polyR(bodyShape));

// light from the upper left, on a form approximated by an ellipsoid: 0 lit .. 1 in shade
const ball = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => { const nx = (x - cx) / rx, ny = (y - cy) / ry, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)); return clamp(1 - (-0.55 * nx - 0.5 * ny + 0.67 * nz) * 1.25); };
const bodyLight = ball(470, 600, 250, 380), headLight = ball(490, 300, 190, 190);

// ---------------------------------------------------------------- mark helpers
const S = (pts: P[], w: number, a = 0.9, col = LEAD, taper = 1): Ink => stroke(pts, { w, col, a, taper });
// a feather's lower edge: a shallow U, and (in shade) a short dark crescent under it
const scallop = (cx: number, cy: number, w: number, h: number, ang: number): P[] => [[-w / 2, -h * 0.35], [-w * 0.32, h * 0.3], [0, h * 0.5], [w * 0.32, h * 0.3], [w / 2, -h * 0.35]].map((p) => { const [x, y] = rot(p as P, ang); return [cx + x, cy + y] as P; });

// ---------------------------------------------------------------- the lesson
export const owlScore = (): Score => {
  const b = new ScoreBuilder({ id: "owl", title: "How to draw an owl", medium: "Graphite 2B, 4B and 6B, a blue col-erase pencil and a kneaded eraser", W: 1000, H: 1200, paper: PAPER, toothAngle: -0.6 })
    .layer("guides", 0, 1, "blue construction: lifted to a ghost before the value masses").layer("line", 1).layer("tone", 1).layer("tex", 1).layer("dark", 2);
  b.part("circles", "head and body circles").part("branch", "branch", ["circles"]).part("head", "head", ["circles"]).part("tufts", "ear tufts", ["circles"]).part("face", "facial disc, eyes, brow and beak", ["circles"])
    .part("body", "body and breast", ["circles"]).part("wings", "folded wings", ["circles"]).part("tail", "tail", ["branch"]).part("feet", "feet and talons", ["branch"]);
  const addG = (id: string, part: string, ink: Ink) => b.add(id, part, "guides", "guide", ink);

  // 1. the meme's step 1
  b.step("s1", "shapes", {
    title: "Draw some circles",
    caption: "A circle for the head, a tall oval for the body. Overlap them: no neck.",
    look: "The head circle is about three quarters as wide as the body oval, and its lower third sits inside the oval. Leave room above for the ear tufts and below for the branch and tail.",
    how: "Blue col-erase pencil held far back, arm moving from the shoulder. Each shape is one loose loop that goes round a little more than once; the second pass corrects the first.",
    mistake: "A small head on a neck, like a snowman. The head sinks into the shoulders; that overlap is what makes it an owl.",
  });
  addG("circles.head", "circles", sketchEllipse(HEAD.cx, HEAD.cy, HEAD.r, HEAD.r * 0.97, G(11)));
  addG("circles.body", "circles", sketchEllipse(BODY.cx, BODY.cy, BODY.rx, BODY.ry, G(12)));

  // 2. placement: branch, centre line, height
  b.step("s2", "shapes", {
    title: "Add the branch",
    caption: "Tilt a branch under the oval. Drop a centre line; tick tuft tips and tail.",
    look: "From tuft tips to tail tip the owl is about three and a quarter head circles tall. The branch crosses the oval near its bottom, and the tail hangs below it.",
    how: "Two long, light parallel strokes for the branch, overshooting both ends. The centre line runs straight down through both circles: the owl is facing you, so everything will mirror across it.",
    mistake: "Putting the branch under the owl's feet as an afterthought. The branch decides where the feet grip and how much tail shows; place it now.",
  });
  addG("branch.top", "branch", guideLine([40, bTop(40)], [990, bTop(990)], G(21)));
  addG("branch.bot", "branch", guideLine([40, bBot(40)], [990, bBot(990)], G(22)));
  addG("circles.centre", "circles", guideLine([500, 70], [500, 1122], { ...G(23, 0.6), bow: 2 }));
  [74, 1110].forEach((y, i) => addG(`circles.tick${i}`, "circles", guideLine([470, y], [530, y], G(24 + i))));

  // 3. construction
  b.step("s3", "construction", {
    title: "Build the parts",
    caption: "Eye line and eyes, a heart-shaped face, tufts, wings at the sides, feet, tail.",
    look: "The eyes sit on a line a little below the middle of the head circle, each about a fifth of the head wide, a beak's width apart. The wings are long teardrops that hide the sides of the body.",
    how: "Keep it blue and light. The facial disc is two round lobes meeting in a V over the beak. Tufts go on the top corners of the head, leaning slightly out.",
    mistake: "Eyes high on the head and far apart, like a cartoon. On a real owl the huge eyes crowd the beak and sit low.",
  });
  addG("face.eyeline", "face", guideLine([350, 297], [650, 297], { ...G(31, 0.6), bow: -3 }));
  addG("face.eyeL", "face", sketchEllipse(eyeL.cx, eyeL.cy, 39, 38, { ...G(32), turns: 1.1 }));
  addG("face.eyeR", "face", sketchEllipse(eyeR.cx, eyeR.cy, 39, 38, { ...G(33), turns: 1.1 }));
  addG("face.discL", "face", S([[492, 262], [440, 234], [385, 240], [355, 290], [356, 360], [394, 418], [450, 446], [500, 452]], 4.6, 0.72, BLUE, 0.6));
  addG("face.discR", "face", S([[508, 262], [560, 234], [615, 240], [645, 290], [644, 360], [606, 418], [550, 446], [500, 452]], 4.6, 0.72, BLUE, 0.6));
  addG("face.beak", "face", S([[486, 322], [500, 376], [514, 322]], 4, 0.72, BLUE, 0.5));
  addG("tufts.L", "tufts", S([[346, 222], [366, 74], [434, 178]], 4.6, 0.72, BLUE, 0.5));
  addG("tufts.R", "tufts", S([[566, 178], [637, 72], [655, 222]], 4.6, 0.72, BLUE, 0.5));
  addG("wings.L", "wings", S([[365, 455], [318, 520], [296, 660], [312, 850], [372, 940], [394, 800], [392, 600], [365, 455]], 4.6, 0.72, BLUE, 0.5));
  addG("wings.R", "wings", S([[636, 457], [684, 520], [706, 660], [690, 850], [630, 915], [606, 800], [610, 600], [636, 457]], 4.6, 0.72, BLUE, 0.5));
  addG("body.bib", "body", S([[410, 470], [500, 504], [592, 470]], 4.2, 0.65, BLUE, 0.6));
  addG("feet.L", "feet", sketchEllipse(446, 952, 26, 18, { ...G(36), turns: 1.05 }));
  addG("feet.R", "feet", sketchEllipse(561, 934, 26, 18, { ...G(37), turns: 1.05 }));
  addG("tail.guide", "tail", S([[463, 985], [458, 1104], [503, 1112], [548, 1102], [550, 978]], 4.6, 0.72, BLUE, 0.5));

  // 4. commit the outline
  b.step("s4", "construction", {
    title: "Find the outline",
    caption: "Graphite now. Short strokes over the blue, heavier on the shadow side.",
    look: "The silhouette is soft, not a wire: little feather bumps at the cheeks and shoulders, a crisp edge only on the shaded right and where the owl meets the branch.",
    how: "2B, short overlapping strokes, each starting inside the last. Rotate the page so every stroke pulls toward you. Draw the branch as two edges that stop behind the owl.",
    mistake: "Tracing the circles. The circles were scaffolding: the real head is flat on top between the tufts, and the body is widest low down, like an egg standing up.",
  });
  const lit = (x: number, y: number) => 0.5 + 0.9 * clamp((x - 330) / 420 + (y - 200) / 1400);
  const C = (name: string, part: string, pts: P[], seed: number, w = 6.2, keep = lit, layer = "line", col = LEAD) => b.addAll(`${part}.${name}`, part, layer, "line", contour(pts, { w, col, a: 0.95, seed, keep: (x, y) => keep(x, y), seg: 56 }));
  const broken = (x: number, y: number) => (Math.sin(x * 0.21 + y * 0.13) > -0.35 ? 0.85 : 0); // a feathered edge, not a wire
  C("tuftLo", "tufts", tuftLo, 41, 4.6); C("tuftLi", "tufts", tuftLi, 42, 3.8); C("crown", "head", crown, 43, 4.4, (x) => 0.35 + (x - 430) / 300); C("tuftRi", "tufts", tuftRi, 44, 4); C("tuftRo", "tufts", tuftRo, 45, 5.4);
  C("sideL", "head", headL, 46, 5.4); C("sideR", "head", headR, 47, 6.6);
  // the rim stops at the jaw: carried across the chin it reads as a smiling mouth
  C("rimL", "face", rimL.slice(0, 7), 48, 4, broken); C("rimR", "face", rimR.slice(0, 7), 49, 4.6, broken);
  C("bodyL", "body", sideL, 50, 5.6); C("bodyR", "body", sideR, 51, 7);
  C("wingLi", "wings", wingLi, 52, 4.2, () => 0.75); C("wingRi", "wings", wingRi, 53, 4.8, () => 0.95);
  C("tailL", "tail", tailL, 54, 5); C("tailR", "tail", tailR, 56, 6);
  b.addAll("tail.tips", "tail", "line", "line", [0, 2, 4, 6].map((i) => S([tailTip[i], tailTip[i + 1], tailTip[i + 2]], 4.6, 0.9)));
  // the branch: two edges, stopping behind the owl; the lit top edge is lighter
  const bEdge = (f: (x: number) => number, x0: number, x1: number): P[] => { const out: P[] = []; for (let x = x0; x <= x1; x += 30) out.push([x, f(x) + Math.sin(x * 0.05) * 1.5]); return out; };
  C("topL", "branch", bEdge(bTop, 40, 352), 57, 4.4, () => 0.55); C("topR", "branch", bEdge(bTop, 656, 1004), 58, 4.4, () => 0.7);
  C("botL", "branch", bEdge(bBot, 40, 455), 59, 6.4, () => 1.1); C("botR", "branch", bEdge(bBot, 552, 1004), 60, 6.4, () => 1.1);
  C("end", "branch", [[44, bTop(40) + 2], [36, bc(40) - 8], [37, bc(40) + 12], [46, bBot(40) - 2]], 61, 5, () => 1);
  // the belly's lower edge: small down-curving feather bumps, not one line
  const bumps: Ink[] = []; for (let i = 0; i < bottom.length - 1; i++) { const [x0, y0] = bottom[i], [x1, y1] = bottom[i + 1]; if (x0 >= 425 && x1 <= 468) continue; if (x0 >= 535 && x1 <= 582) continue; bumps.push(S([[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 + 7], [x1, y1]], 4.6, 0.85)); }
  b.addAll("body.fringe", "body", "line", "line", bumps);

  // 5. the face
  b.step("s5", "construction", {
    title: "Eyes, brow and beak",
    caption: "Half-close the eyes under a lid that slants to the beak. Pale brows make the V.",
    look: "The upper lid is a dark bar across the top half of each eye, lower at the inner corner: that slant is the whole stern expression. The beak shows only below the bristles.",
    how: "4B for the lids, pressed hard. Leave the brow bands as bare paper and draw the forehead's edge above them. Then lift all the blue with the kneaded eraser.",
    mistake: "Round eyes with a dot in each. Wide-open eyes make a cute cartoon; half-closed ones under a V give the meme's glare.",
  });
  const eye = (id: string, lid: P[], low: P[], cx: number, cy: number, seed: number) => {
    b.addAll(`face.${id}Lid`, "face", "line", "line", contour(lid, { w: 8, col: DARK, a: 1, seed, seg: 90 }));
    b.addAll(`face.${id}Low`, "face", "line", "line", contour(low, { w: 3.6, col: LEAD, a: 0.9, seed: seed + 1, seg: 60 }));
    // the pupil's edge: a big dark disc, its top hidden by the lid
    const reg = polyR(eyePoly(lid, low)), pup = arcPts(cx, cy + 6, 23, -0.2, Math.PI + 0.2, 16).filter(([x, y]) => reg.has(x, y));
    if (pup.length > 2) b.add(`face.${id}Pupil`, "face", "line", "line", S(pup, 3, 0.9, DARK));
    // the iris (yellow; in graphite a pale grey): fine strokes radiating from the pupil
    const ring: Ink[] = []; for (let k = 0; k < 26; k++) { const a = -0.3 + (k / 25) * (Math.PI + 0.6), c = Math.cos(a), sn = Math.sin(a), p0: P = [cx + c * 25, cy + 6 + sn * 25], p1: P = [cx + c * 33, cy + 6 + sn * 32]; if (k % 2 === 0 && reg.has(p0[0], p0[1]) && reg.has(p1[0], p1[1])) ring.push(S([p0, p1], 1.6, 0.35)); }
    b.addAll(`face.${id}Iris`, "face", "line", "line", ring);
    // the round socket: an owl's eye is a big disc set in a ring of dark feathers, seen below and outside the lid
    const out = cx < 500 ? arcPts(cx, cy + 2, 47, Math.PI + 0.5, 0.4, 18) : arcPts(cx, cy + 2, 47, -0.5, Math.PI - 0.4, 18);
    b.addAll(`face.${id}Ring`, "face", "line", "line", contour(out, { w: 3.2, col: LEAD, a: 0.7, seed: seed + 3, seg: 40 }));
  };
  eye("eyeL", lidL, lowL, eyeL.cx + 3, eyeL.cy, 71); eye("eyeR", lidR, lowR, eyeR.cx - 3, eyeR.cy, 75);
  // the brow: the upper edge of the pale V, drawn as the start of the darker forehead feathers
  b.addAll("face.browL", "face", "line", "line", contour(browL, { w: 4, col: LEAD, a: 0.85, seed: 79, seg: 40 }));
  b.addAll("face.browR", "face", "line", "line", contour(browR, { w: 4.4, col: LEAD, a: 0.9, seed: 80, seg: 40 }));
  // the beak: outline, the hook, the split, then a dark fill leaving a lit ridge on the left
  b.addAll("face.beak", "face", "line", "line", contour([[487, 330], [488, 344], [493, 360], [500, 376], [507, 360], [512, 344], [513, 330]], { w: 4.2, col: DARK, a: 1, seed: 81, seg: 40 }));
  b.addAll("face.beakFill", "face", "line", "fill", hatch(minus(polyR(beak), polyR([[492, 330], [497, 330], [498, 366], [494, 354]])), { ang: 1.35, gap: 2.6, len: 14, w: 2.4, col: DARK, a: 0.9, seed: 82 }));
  // bristles: fine feathers from the disc sweep down over the top of the beak and hide its base
  const brist: Ink[] = []; const rb = rng(83); for (let i = 0; i < 16; i++) { const side = i % 2 ? 1 : -1, x0 = 500 + side * (8 + rb() * 22), y0 = 298 + rb() * 16, x1 = 500 + side * (1 + rb() * 6), y1 = 326 + rb() * 10; brist.push(S([[x0, y0], [(x0 + x1) / 2 + side * 2, (y0 + y1) / 2 + 2], [x1, y1]], 2, 0.75)); }
  b.addAll("face.bristles", "face", "line", "line", brist);
  // the facial disc: fine feathers radiating from each eye out to the rim
  const radial = (cx: number, cy: number, a0: number, a1: number, rim: P[], seed: number) => { const out: Ink[] = [], r = rng(seed), reg = polyR(rim); for (let k = 0; k < 34; k++) { const a = a0 + ((a1 - a0) * (k + r() * 0.6)) / 34, c = Math.cos(a), s = Math.sin(a); let r1 = 42; while (r1 < 140 && reg.has(cx + c * (r1 + 4), cy + s * (r1 + 4))) r1 += 3; if (r1 < 52) continue; const r0 = 40 + r() * 6; out.push(S([[cx + c * r0, cy + s * r0], [cx + c * (r0 + r1) / 2 + s * 2, cy + s * (r0 + r1) / 2 - c * 2], [cx + c * (r1 - 3), cy + s * (r1 - 3)]], 2.1, 0.6)); } return out; };
  b.addAll("face.discL", "face", "line", "line", radial(eyeL.cx, eyeL.cy + 4, Math.PI * 0.35, Math.PI * 1.25, discL, 84));
  b.addAll("face.discR", "face", "line", "line", radial(eyeR.cx, eyeR.cy + 4, -Math.PI * 0.25, Math.PI * 0.65, discR, 85));
  // lift the blue where it is: back and forth over the owl, then once along each branch line (never scrubbing bare paper)
  b.erase("circles.lift", "circles", "guides", eraserPath([226, 36, 774, 1146], { seed: 86, bite: 50 }), { width: 90, ghost: 0.03 });
  b.erase("branch.liftTop", "branch", "guides", [[10, bTop(10)], [505, bTop(505)], [1000, bTop(1000)]], { width: 34, ghost: 0.03 });
  b.erase("branch.liftBot", "branch", "guides", [[1000, bBot(1000)], [505, bBot(505)], [10, bBot(10)]], { width: 34, ghost: 0.03 });

  // 6. value masses
  b.step("s6", "values", {
    title: "Block in the shadows",
    caption: "Light from upper left. Hatch whole shadow shapes: right side, sockets, branch.",
    look: "Squint until the feathers disappear. The eye sockets and the facial rim are the darkest shapes on the head; the right wing and the branch's underside the darkest below.",
    how: "Parallel strokes in one diagonal, side by side in patches, 2B then 4B over it. Build dark by going over again, not by stabbing harder on the first pass.",
    mistake: "Shading every part the same grey. Keep the bib, the brows and the lit left of the chest nearly bare paper, or the owl goes flat.",
  });
  const H = (name: string, part: string, reg: Region, dens: (x: number, y: number) => number, seed: number, o: { gap?: number; len?: number; a?: number; w?: number; ang?: number; layer?: string; col?: string } = {}) =>
    b.addAll(`${part}.${name}`, part, o.layer ?? "tone", "fill", hatch(reg, { ang: o.ang ?? HATCH, gap: o.gap ?? 6.2, len: o.len ?? 40, w: o.w ?? 2.9, col: o.col ?? LEAD, a: o.a ?? 0.7, seed, dens }));
  const eyesR = union(polyR(eyePoly(lidL, lowL)), polyR(eyePoly(lidR, lowR)));
  const bibR = polyR(bib), browBand = union(polyR([...browL, ...rev(lidL.map(([x, y]) => [x, y - 3] as P))]), polyR([...browR, ...rev(lidR.map(([x, y]) => [x, y - 3] as P))]));
  // the sockets: a dark ring round each eye, under the brow and down into the disc
  H("sockets", "face", minus(union(ellR(eyeL.cx, eyeL.cy + 2, 56, 50), ellR(eyeR.cx, eyeR.cy + 2, 56, 50)), eyesR, browBand), (x, y) => { const d = Math.min(Math.hypot((x - eyeL.cx) / 56, (y - eyeL.cy - 2) / 50), Math.hypot((x - eyeR.cx) / 56, (y - eyeR.cy - 2) / 50)); return clamp(1.3 - d) * (x > 500 ? 1 : 0.8); }, 91, { gap: 4, len: 22, w: 3 });
  // the iris is yellow: in graphite a light, even grey, so the eye never reads as a white human eyeball
  H("iris", "face", minus(eyesR, ellR(eyeL.cx + 3, eyeL.cy + 6, 22, 22), ellR(eyeR.cx - 3, eyeR.cy + 6, 22, 22)), () => 0.45, 102, { gap: 3.4, len: 14, w: 2, a: 0.5, ang: -0.6 });
  H("disc", "face", minus(union(polyR(discL), polyR(discR)), eyesR, browBand), (x, y) => clamp(-0.05 + headLight(x, y) * 0.6), 92, { gap: 7.5, a: 0.5 });
  H("forehead", "head", polyR(forehead), (x, y) => clamp(0.25 + headLight(x, y) * 0.6), 93, { gap: 5.8 });
  H("cheeks", "head", union(polyR(cheekL), polyR(cheekR)), (x, y) => clamp(0.15 + headLight(x, y) * 0.85), 94, { gap: 5.4, ang: -1.25 });
  H("tufts", "tufts", union(polyR(tuftLShape), polyR(tuftRShape)), (x, y) => clamp(0.35 + headLight(x, y) * 0.6), 95, { gap: 5, len: 30, ang: -1.45 });
  // the head's shadow on the upper breast, and the breast's turning edge on the right
  H("breast", "body", minus(polyR(breastShape), bibR, union(ellR(446, bTop(446) + 24, 32, 26), ellR(561, bTop(561) + 24, 32, 26))), (x, y) => clamp(bodyLight(x, y) * 1.15 - 0.5 + (y < 570 ? 0.35 * clamp((570 - y) / 90) : 0)), 96, { gap: 6.4 });
  H("wingL", "wings", polyR(wingLShape), (x, y) => clamp(0.1 + bodyLight(x, y) * 0.65), 97, { gap: 6, ang: 1.38 });
  H("wingR", "wings", polyR(wingRShape), (x, y) => clamp(0.45 + bodyLight(x, y) * 0.6), 98, { gap: 4.8, ang: 1.76 });
  H("tail", "tail", minus(polyR(tailShape), polyR(branchShape)), (x, y) => clamp(0.95 - (y - 990) / 260 + (x - 480) / 300), 99, { gap: 5.2, ang: HATCH });
  // the branch is a cylinder: dark along its underside, a core shadow, reflected light at the very bottom
  H("branch", "branch", branchR, (x, y) => { const t = (y - bc(x)) / BH; return clamp(0.12 + 0.75 * clamp((t + 0.4) / 1.1) - (t > 0.8 ? 0.2 : 0)); }, 100, { gap: 5.4, ang: HATCH });
  // the owl's shadow on the branch, down and to the right of the feet
  H("cast", "branch", minus(inter(polyR(branchShape), polyR([[600, 895], [720, 872], [790, 885], [720, 915], [610, 935]])), polyR(bodyShape)), (x) => clamp(1.1 - (x - 610) / 180), 101, { gap: 3.6, a: 0.85, ang: -0.3 });

  // 7. feather texture
  b.step("s7", "edges", {
    title: "Feathers follow the form",
    caption: "Chest bars curve like smiles; scallops on the wings; fluff at the flanks.",
    look: "Every chest bar bends like a smile because the body is round, and the bars crowd together as the belly turns under. The wing scallops shrink toward the shoulder.",
    how: "Change the mark, not just the darkness: short broken bars (4B), U-shaped scallops with a dark crescent under each, loose curls at the flanks.",
    mistake: "Drawing every feather everywhere, all the same. Texture belongs where light and form turn; let the lit left side stay quiet.",
  });
  const R7 = rng(700);
  const wavy = (x0: number, x1: number, yy: (x: number) => number, w: number, a: number, r: () => number, col = LEAD) => { const pts: P[] = []; for (let k = 0; k <= 4; k++) { const x = x0 + ((x1 - x0) * k) / 4; pts.push([x, yy(x) + (r() - 0.5) * 2.4]); } return S(pts, w, a, col); };
  // the chest bars: thin, wavy, broken; they bend like smiles round the body and crowd as it turns under
  const bars: Ink[] = []; const feetR = union(ellR(446, bTop(446) + 22, 34, 30), ellR(561, bTop(561) + 22, 34, 30)), breastR = minus(polyR(breastShape), bibR, feetR);
  for (let y0 = 600, row = 0; y0 < 935; row++) {
    const xl = xAt(wingLi, y0) + 4, xr = xAt(wingRi, y0) - 4, half = (xr - xl) / 2, mid = (xl + xr) / 2;
    for (let x = xl + R7() * 8; x < xr;) {
      const L = 14 + R7() * 30, x1 = Math.min(xr, x + L), yy = (xx: number) => y0 + 12 * (1 - ((xx - mid) / half) ** 2) + Math.sin(xx * 0.08 + row * 1.7) * 2;
      const xm = (x + x1) / 2, sh = bodyLight(xm, y0);
      if (breastR.has(xm, yy(xm)) && R7() < 0.55 + sh * 0.6) bars.push(wavy(x, x1, yy, 2.2 + sh * 2.6 + R7() * 0.8, 0.6 + sh * 0.35, R7));
      if (R7() < 0.1 && breastR.has(xm, yy(xm) + 8)) bars.push(S([[xm - 6, yy(xm) + 2], [xm, yy(xm) + 9], [xm + 6, yy(xm) + 2]], 3, 0.85)); // an arrowhead mark
      x = x1 + 3 + R7() * 10;
    }
    y0 += Math.max(12, 23 - (y0 - 600) / 30);
  }
  b.addAll("body.bars", "body", "tex", "line", bars);
  // the dark mottled band under the bib: small tear-drops and chevrons, dense at the top, thinning out
  const streaks: Ink[] = []; for (let i = 0; i < 420 && streaks.length < 190; i++) { const x = 360 + R7() * 280, y = 478 + R7() * 130; if (!breastR.has(x, y) || !breastR.has(x, y + 12) || bibR.has(x, y - 6)) continue; const den = clamp(1.1 - (y - 500) / 110) * (0.55 + 0.45 * bodyLight(x, y)); if (R7() > den) continue; const tilt = (x - 500) / 260, L = 7 + R7() * 12; streaks.push(R7() < 0.3 ? S([[x - 5, y], [x, y + 6], [x + 5, y]], 3.2, 0.8) : S([[x, y], [x + tilt * L * 0.5, y + L * 0.5], [x + tilt * L, y + L]], 3 + R7() * 2.8, 0.62 + bodyLight(x, y) * 0.3)); }
  b.addAll("body.streaks", "body", "tex", "line", streaks);
  // the bib: only its lower edge, as short feather flicks; the rest stays paper
  b.addAll("body.bibEdge", "body", "tex", "line", Array.from({ length: 16 }, (_, i) => { const t = (i + 0.5) / 16, x = 412 + t * 176, y = 470 + 30 * Math.sin(Math.PI * t) - 2; return S([[x, y], [x + (R7() - 0.5) * 4, y + 8 + R7() * 6]], 2.6, 0.75); }));
  // wing coverts: rows of overlapping scallops lying down the wing, smaller toward the shoulder
  const coverts = (side: 1 | -1, inner: P[], outer: P[], seed: number) => { const out: Ink[] = [], r = rng(seed); for (let j = 0; j < 7; j++) { const y = 490 + j * 26, xo = xAt(outer, y) + 9 * side, xi = xAt(inner, y) - 5 * side, w = 16 + j * 1.8, n = Math.max(1, Math.round(Math.abs(xi - xo) / (w * 0.9))); for (let k = 0; k < n; k++) { if (r() < 0.12) continue; const t = (k + 0.5 + (j % 2 ? 0.3 : -0.1) + (r() - 0.5) * 0.25) / n, x = xo + (xi - xo) * t, yy = y + t * 9 + (r() - 0.5) * 5, ang = side * -0.3 + (r() - 0.5) * 0.25, sh = bodyLight(x, yy), ww = w * (0.85 + r() * 0.3); out.push(S(scallop(x, yy, ww, 11 + r() * 3, ang), 2.2 + sh * 1.4, 0.72 + sh * 0.2)); if (sh > 0.25 || r() < 0.4) out.push(S(scallop(x, yy + 3.5, ww * 0.62, 6, ang).slice(1, 4), 3.4 + sh * 2.2, 0.35 + sh * 0.5)); } } return out; };
  b.addAll("wings.covertsL", "wings", "tex", "line", coverts(1, wingLi, sideL, 710));
  b.addAll("wings.covertsR", "wings", "tex", "line", coverts(-1, wingRi, sideR, 711));
  // the primaries: long feathers lying down the side, each edged, barred at its own rhythm, tip pointed
  const primaries = (side: 1 | -1, inner: P[], outer: P[], seed: number) => {
    const out: Ink[] = [], r = rng(seed), yT = 676, yB = side > 0 ? 930 : 900;
    const at = (t: number, y: number) => xAt(outer, y) + (xAt(inner, y) - xAt(outer, y)) * t;
    out.push(S([[at(0.0, yT - 6), yT - 6], [at(0.3, yT + 6), yT + 6], [at(0.65, yT + 3), yT + 3], [at(1, yT - 8), yT - 8]], 3.2, 0.85)); // the edge of the greater coverts
    const edges = [0, 0.24, 0.47, 0.7, 0.9];
    edges.slice(1).forEach((t, k) => out.push(S([[at(t * 0.8, yT + 4), yT + 4], [at(t * 0.92, yT + 90), yT + 90], [at(t * 0.98, yT + 180), yT + 180], [at(t, yB - 14 + k * 4), yB - 14 + k * 4]], 2.6, 0.8)));
    for (let k = 0; k < edges.length - 1; k++) { const t0 = edges[k] + 0.04, t1 = edges[k + 1] - 0.03; for (let yb = yT + 16 + r() * 18; yb < yB - 18; yb += 24 + r() * 8) { if (r() < 0.2) continue; const y0 = yb, y1 = yb + 6 * side; out.push(S([[at(t0, y0), y0], [at((t0 + t1) / 2, (y0 + y1) / 2 + 2), (y0 + y1) / 2 + 2], [at(t1, y1), y1]], 4.4 + r() * 2, 0.5 + bodyLight(at(0.5, y0), y0) * 0.4)); } }
    return out;
  };
  b.addAll("wings.primL", "wings", "tex", "line", primaries(1, wingLi, sideL, 712));
  b.addAll("wings.primR", "wings", "tex", "line", primaries(-1, wingRi, sideR, 713));
  // the flanks: loose curls that soften the silhouette where the belly drapes over the branch
  const bodyReg = polyR(bodyShape), fluff: Ink[] = []; for (let i = 0; i < 160 && fluff.length < 80; i++) { const x = 372 + R7() * 262, y = 850 + R7() * 95; if (!bodyReg.has(x, y) || feetR.has(x, y)) continue; const d = (x < 500 ? -1 : 1) * (0.5 + R7() * 0.6), L = 12 + R7() * 12; fluff.push(S([[x, y], [x + d * 5, y + L * 0.45], [x + d * 1.5, y + L]], 2.2 + bodyLight(x, y) * 1.2, 0.5 + bodyLight(x, y) * 0.35)); }
  b.addAll("body.fluff", "body", "tex", "line", fluff);
  // head: forehead and crown mottled in tiny arcs; cheeks the same; broken dark marks down between the brows
  const mottle = (reg: Region, n: number, seed: number, size = 9): Ink[] => { const out: Ink[] = [], r = rng(seed); for (let i = 0; i < n * 4 && out.length < n; i++) { const x = reg.box[0] + r() * (reg.box[2] - reg.box[0]), y = reg.box[1] + r() * (reg.box[3] - reg.box[1]); if (!reg.has(x, y)) continue; const sh = headLight(x, y); if (r() > 0.35 + sh) continue; out.push(S(scallop(x, y, size * (0.6 + r() * 0.7), size * 0.6, (r() - 0.5) * 0.6), 2 + sh * 1.2, 0.55 + sh * 0.4)); } return out; };
  b.addAll("head.mottle", "head", "tex", "line", mottle(minus(polyR(forehead), browBand), 80, 714));
  b.addAll("head.cheekMottle", "head", "tex", "line", mottle(union(polyR(cheekL), polyR(cheekR)), 46, 715, 11));
  b.addAll("head.stripe", "head", "tex", "fill", hatch(polyR([[478, 200], [522, 200], [510, 296], [500, 306], [490, 296]]), { ang: 1.45, gap: 3.4, len: 16, w: 2.6, col: LEAD, a: 0.75, seed: 720, dens: (x, y) => clamp(0.9 - Math.abs(x - 500) / 30) * clamp(0.5 + (y - 200) / 120) }));
  // tufts: a bundle of long feathers, fanning from the head, tips ragged and staggered
  const tuftFeathers = (tip: P, base0: P, base1: P, lean: number, seed: number) => { const r = rng(seed), out: Ink[] = []; for (let i = 0; i < 11; i++) { const t = i / 10, bx = base0[0] + (base1[0] - base0[0]) * t, by = base0[1] + (base1[1] - base0[1]) * t, reach = 0.72 + r() * 0.34 - Math.abs(t - 0.35) * 0.3, tx = bx + (tip[0] - bx) * reach + lean * (r() - 0.3) * 6, ty = by + (tip[1] - by) * reach; out.push(S([[bx, by], [(bx + tx) / 2 + lean * 3, (by + ty) / 2], [tx, ty]], 2.4 + r() * 1.6, 0.7 + r() * 0.25)); } return out; };
  b.addAll("tufts.featherL", "tufts", "tex", "line", tuftFeathers([362, 70], [350, 222], [414, 186], -1, 716));
  b.addAll("tufts.featherR", "tufts", "tex", "line", tuftFeathers([640, 68], [652, 222], [586, 186], 1, 717));
  // the rim: short dark feathers across it, a ruff that is heavy at the sides and fades toward the chin
  const ruff = (rim: P[], seed: number, heavy: number) => { const out: Ink[] = [], r = rng(seed); for (let i = 1; i < rim.length; i++) { const fade = clamp(1.15 - i / rim.length); for (let k = 0; k < 6; k++) { if (r() > fade + 0.15) continue; const t = (k + r()) / 6, x = rim[i - 1][0] + (rim[i][0] - rim[i - 1][0]) * t, y = rim[i - 1][1] + (rim[i][1] - rim[i - 1][1]) * t, dx = rim[i][0] - rim[i - 1][0], dy = rim[i][1] - rim[i - 1][1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, sgn = x < 500 ? 1 : -1, o = 5 + r() * 4, L = 8 + r() * 8; out.push(S([[x - nx * o * sgn, y - ny * o * sgn], [x + nx * L * sgn + dx / l * 3, y + ny * L * sgn + dy / l * 3]], (2.6 + r() * 1.6) * heavy * (0.6 + fade * 0.4), 0.85)); } } return out; };
  b.addAll("face.ruffL", "face", "tex", "line", ruff(rimL.slice(0, 7), 718, 1));
  b.addAll("face.ruffR", "face", "tex", "line", ruff(rimR.slice(0, 7), 719, 1.2));
  // the tail: wavy bars across, feather tips split at the bottom
  b.addAll("tail.bars", "tail", "tex", "line", [1024, 1058].flatMap((y, i) => { const xl = xAt(tailL, y) + 3, xr = xAt([...tailR].reverse(), y) - 3, m = (xl + xr) / 2; return [wavy(xl, m - 3, (x) => y + (x - xl) * 0.08, 5.2, 0.62 + i * 0.05, R7), wavy(m + 3, xr, (x) => y + 4 - (x - m) * 0.06, 5.6, 0.7 + i * 0.05, R7)]; }));
  b.addAll("tail.splits", "tail", "tex", "line", [[481, 1100, 483, 1068], [503, 1104, 503, 1070], [526, 1100, 524, 1066]].map(([x0, y0, x1, y1]) => S([[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2], [x1, y1]], 2.2, 0.65)));

  // 8. feet and branch
  b.step("s8", "edges", {
    title: "Talons and bark",
    caption: "Toes wrap over the branch, one behind. Black hooked talons. Bark runs along it.",
    look: "The toes wrap over the branch's curve and the talons hook back into it; the fourth toe grips from behind, so only its claw tip shows below.",
    how: "Draw each toe as a short fat curve, then its talon from thick to a sharp point with the 6B. Bark: long broken strokes along the branch, a knot or two, darker underneath.",
    mistake: "Feet standing on top of the branch like on a floor. An owl grips: the toes go OVER and DOWN the front of the branch.",
  });
  const foot = (id: string, x: number, seed: number) => {
    const top = bTop(x), r = rng(seed), toes: Ink[] = [], talons: Ink[] = [];
    [-21, 0, 20].forEach((dx, i) => {
      const x0 = x + dx * 0.55, y0 = top + 4, x1 = x + dx * 1.1, y1 = top + 38 + (i === 1 ? 5 : 0);
      // a toe: a fat feathered curve over the branch's rounded top and down its front
      toes.push(S([[x0 - 8, y0], [x1 - 10, (y0 + y1) / 2], [x1 - 7, y1]], 4.4, 0.95, DARK), S([[x0 + 8, y0], [x1 + 9, (y0 + y1) / 2], [x1 + 7, y1]], 3.6, 0.9, DARK), S([[x1 - 7, y1], [x1, y1 + 5], [x1 + 7, y1]], 3.6, 0.9, DARK));
      for (let k = 0; k < 4; k++) toes.push(S([[x1 - 6 + r() * 12, y0 + 5 + k * 8], [x1 - 4 + r() * 8, y0 + 10 + k * 8]], 2, 0.6)); // feathering on the toe
      talons.push(S([[x1 - 3, y1 + 3], [x1 + 3, y1 + 14], [x1, y1 + 25], [x1 - 11, y1 + 29]], 7.5, 1, DARK), S([[x1 + 3, y1 + 2], [x1 + 5, y1 + 12], [x1 + 1, y1 + 21]], 3.4, 0.95, DARK));
    });
    b.addAll(`feet.${id}Toes`, "feet", "line", "line", toes);
    b.addAll(`feet.${id}Talons`, "feet", "dark", "line", talons);
    // the back toe's claw: behind the branch, only its tip hooks out below
    const bx = x - 8, by = bBot(bx);
    b.add(`feet.${id}Back`, "feet", "dark", "line", S([[bx + 2, by - 6], [bx + 6, by + 4], [bx + 1, by + 11], [bx - 7, by + 12]], 5.5, 1, DARK));
    // the feathered leg above the toes: soft vertical fluff over the ankle
    b.addAll(`feet.${id}Leg`, "feet", "line", "line", Array.from({ length: 8 }, (_, i) => { const xx = x - 20 + i * 5.5, yy = top - 6 + r() * 6; return S([[xx, yy], [xx + (r() - 0.5) * 4, yy + 12 + r() * 6]], 2.4, 0.75); }));
  };
  foot("L", 446, 801); foot("R", 561, 802);
  b.addAll("feet.contact", "feet", "dark", "fill", hatch(union(ellR(447, bTop(447) + 44, 30, 7, BANG), ellR(562, bTop(562) + 44, 30, 7, BANG)), { ang: BANG, gap: 3, len: 20, w: 2.6, col: DARK, a: 0.8, seed: 803 }));
  // bark: long broken strokes that follow the branch's length, darker on the underside
  const bark: Ink[] = []; const RB = rng(804), bodyR = polyR(bodyShape), tailR_ = polyR(tailShape);
  for (let i = 0; i < 90; i++) { const t = -0.85 + RB() * 1.7, x0 = 40 + RB() * 950, L = 40 + RB() * 120, pts: P[] = []; for (let s = 0; s <= 4; s++) { const x = x0 + (L * s) / 4; pts.push([x, bc(x) + t * BH + Math.sin(x * 0.07 + i) * 2.2]); } if (pts[4][0] > 1004 || pts.some(([x, y]) => bodyR.has(x, y) || (x > 430 && x < 580 && y > bBot(x) - 4))) continue; bark.push(S(pts, 2.2 + clamp(t + 0.3) * 2.4, 0.5 + clamp(t + 0.4) * 0.4)); }
  b.addAll("branch.bark", "branch", "tex", "line", bark);
  const knot = (x: number, s: number) => [S([[x - 16 * s, bc(x) - 4], [x, bc(x) - 12 * s], [x + 18 * s, bc(x) - 3], [x + 2, bc(x) + 7 * s], [x - 16 * s, bc(x) - 4]], 3.4, 0.85), S([[x - 7 * s, bc(x) - 3], [x + 1, bc(x) - 7 * s], [x + 8 * s, bc(x) - 2], [x, bc(x) + 2]], 3, 0.9, DARK)];
  b.addAll("branch.knots", "branch", "tex", "line", [...knot(230, 1.2), ...knot(820, 0.9)]);
  b.addAll("branch.endRings", "branch", "tex", "line", [S([[40, bc(40) - 16], [34, bc(40)], [40, bc(40) + 18]], 2.6, 0.7), S([[44, bc(40) - 6], [42, bc(40) + 4]], 2.2, 0.7)]);
  void tailR_;

  // 9. the meme's step 2
  b.step("s9", "accents", {
    title: "Draw the rest of the owl",
    caption: "6B in every shadow, a second pass of feathers, cast shadow, catchlights.",
    look: "This is the step the meme hides, and it is most of the drawing: the second, darker layer. Shadows go from grey to deep, feathers go from a map to a surface, and a few 6B blacks (pupils, lids, talons) pull the eye to the face.",
    how: "6B cross-hatched at a new angle over the shadow side, the sockets, under the tufts and wings, and the owl's shadow on the branch. Second rows of chest bars and wing scallops in the shade, more fluff at the flanks. Last, the kneaded eraser pinched to a point: a catchlight in each eye, and soften the lit edges.",
    mistake: "Stopping at a clean outline with some texture, or going black everywhere. The rest of the owl is value: dark where the form turns away, and the lit left kept almost bare so it still breathes.",
  });
  const pupilL = inter(ellR(eyeL.cx + 3, eyeL.cy + 6, 23, 23), polyR(eyePoly(lidL, lowL))), pupilR = inter(ellR(eyeR.cx - 3, eyeR.cy + 6, 23, 23), polyR(eyePoly(lidR, lowR)));
  H("pupils", "face", union(pupilL, pupilR), () => 1, 901, { gap: 2.2, len: 14, w: 3, a: 1, layer: "dark", col: DARK });
  b.addAll("face.lidsDark", "face", "dark", "line", [...contour(lidL, { w: 6, col: DARK, a: 1, seed: 902, seg: 90 }), ...contour(lidR, { w: 6.6, col: DARK, a: 1, seed: 903, seg: 90 })]);
  b.addAll("face.rimDark", "face", "dark", "line", [...contour(rimL.slice(0, 5), { w: 4, col: DARK, a: 0.75, seed: 904, seg: 30, keep: (x, y) => (Math.sin(x * 0.3 + y * 0.2) > 0 ? 1 : 0) }), ...contour(rimR.slice(0, 5), { w: 5, col: DARK, a: 0.85, seed: 905, seg: 30, keep: (x, y) => (Math.sin(x * 0.3 + y * 0.2) > -0.2 ? 1 : 0) })]);
  H("beakDark", "face", polyR([[500, 330], [512, 330], [511, 344], [505, 360], [500, 374]]), () => 1, 906, { gap: 2.2, len: 10, w: 2.6, a: 1, layer: "dark", col: DARK, ang: 1.3 });
  b.addAll("tufts.dark", "tufts", "dark", "line", [S([[384, 196], [374, 146], [366, 96]], 4.4, 0.85, DARK), S([[392, 190], [384, 150], [372, 110]], 3, 0.7, DARK), S([[618, 196], [628, 146], [637, 94]], 5, 0.9, DARK), S([[608, 190], [617, 150], [630, 110]], 3.4, 0.75, DARK)]);
  b.addAll("wings.crevice", "wings", "dark", "line", [...contour(wingRi.slice(1), { w: 5.5, col: DARK, a: 0.85, seed: 907, seg: 60 }), ...contour([[318, 494], [304, 560], [298, 640]], { w: 3, col: DARK, a: 0.5, seed: 908, seg: 60 })]);
  b.addAll("body.darkBars", "body", "dark", "line", bars.filter((m, i) => i % 3 === 0 && m.cl[0][0] > 540).map((m) => stroke(m.cl, { w: 3.2, col: DARK, a: 0.5 })));
  b.addAll("branch.under", "branch", "dark", "line", [...contour(bEdge(bBot, 40, 455), { w: 5, col: DARK, a: 0.8, seed: 909, keep: () => 1 }), ...contour(bEdge(bBot, 552, 1004), { w: 5, col: DARK, a: 0.8, seed: 910 })]);
  // the 6B second layer: cross-hatched at a new angle over everything that turns away from the light
  const shadeReg = minus(union(polyR(bodyShape), polyR(cheekL), polyR(cheekR), polyR(forehead), polyR(tuftLShape), polyR(tuftRShape)), bibR, eyesR, browBand, feetR, polyR(discL), polyR(discR));
  H("deep", "body", shadeReg, (x, y) => clamp(((y < 440 ? headLight(x, y) : bodyLight(x, y)) - 0.5) * 2.4), 911, { gap: 4.6, len: 36, w: 2.8, a: 0.8, ang: 0.42, layer: "dark", col: DARK });
  H("socketsDeep", "face", minus(union(ellR(eyeL.cx, eyeL.cy + 2, 54, 48), ellR(eyeR.cx, eyeR.cy + 2, 54, 48)), eyesR, browBand), (x, y) => { const d = Math.min(Math.hypot((x - eyeL.cx) / 54, (y - eyeL.cy - 2) / 48), Math.hypot((x - eyeR.cx) / 54, (y - eyeR.cy - 2) / 48)); return clamp((1.12 - d) * 3) * (x > 500 ? 1 : 0.8); }, 912, { gap: 3.2, len: 16, w: 2.6, a: 0.85, ang: 0.5, layer: "dark", col: DARK });
  // under the tufts and in the tufts' cores; under the wings' leading edges, where the wing overhangs the breast
  H("underTufts", "tufts", union(polyR([[352, 232], [372, 196], [420, 186], [412, 212], [376, 246]]), polyR([[648, 232], [628, 196], [580, 186], [588, 212], [624, 246]]), polyR([[372, 180], [366, 96], [392, 176]]), polyR([[628, 180], [636, 94], [610, 176]])), (x) => (x > 500 ? 0.95 : 0.75), 913, { gap: 3.4, len: 20, w: 2.6, a: 0.85, ang: 1.3, layer: "dark", col: DARK });
  const underWing = (inner: P[], dx: number): Region => polyR([...inner, ...rev(inner.map(([x, y]) => [x + dx, y + 6] as P))]);
  H("underWings", "wings", minus(union(underWing(wingLi, 16), underWing(wingRi, -24)), feetR), (x, y) => (x > 500 ? 0.95 : 0.6) * clamp(0.4 + (y - 470) / 500), 914, { gap: 3.4, len: 24, w: 2.6, a: 0.8, ang: 1.5, layer: "dark", col: DARK });
  // the second pass of feathers: interleaved chest bars where the body turns into shade, darker crescents under the scallops
  const bars2: Ink[] = []; const R9 = rng(915);
  for (let y0 = 611, row = 0; y0 < 930; row++) { const xl = xAt(wingLi, y0) + 4, xr = xAt(wingRi, y0) - 4, half = (xr - xl) / 2, mid = (xl + xr) / 2; for (let x = xl + R9() * 12; x < xr;) { const L = 12 + R9() * 24, x1 = Math.min(xr, x + L), xm = (x + x1) / 2, sh = bodyLight(xm, y0), yy = (xx: number) => y0 + 12 * (1 - ((xx - mid) / half) ** 2) + Math.sin(xx * 0.08 + row * 2.3) * 2; if (breastR.has(xm, yy(xm)) && R9() < (sh - 0.3) * 1.6) bars2.push(wavy(x, x1, yy, 2.6 + sh * 2.6, 0.75 + sh * 0.2, R9, DARK)); x = x1 + 4 + R9() * 12; } y0 += Math.max(12, 23 - (y0 - 600) / 30); }
  b.addAll("body.bars2", "body", "dark", "line", bars2);
  const crescents = (side: 1 | -1, inner: P[], outer: P[], seed: number) => { const out: Ink[] = [], r = rng(seed); for (let j = 0; j < 12; j++) { const y = 496 + j * 21 + r() * 6, xo = xAt(outer, y) + 10 * side, xi = xAt(inner, y) - 6 * side, n = Math.max(1, Math.round(Math.abs(xi - xo) / 17)); for (let k = 0; k < n; k++) { const x = xo + ((xi - xo) * (k + r())) / n, yy = y + (r() - 0.5) * 6, sh = bodyLight(x, yy); if (r() > sh * 1.3 - 0.05) continue; out.push(S(scallop(x, yy, 12 + r() * 8, 7, side * -0.3).slice(1, 4), 3 + sh * 2.4, 0.7 + sh * 0.25, DARK)); } } return out; };
  b.addAll("wings.crescentsL", "wings", "dark", "line", crescents(1, wingLi, sideL, 916));
  b.addAll("wings.crescentsR", "wings", "dark", "line", crescents(-1, wingRi, sideR, 917));
  // streak band and flanks: more, darker; the flanks break into loose curls over the branch
  const streaks2: Ink[] = []; for (let i = 0; i < 300 && streaks2.length < 90; i++) { const x = 380 + R9() * 240, y = 488 + R9() * 90; if (!breastR.has(x, y) || !breastR.has(x, y + 10) || bibR.has(x, y - 6) || R9() > bodyLight(x, y) + 0.2) continue; const t = (x - 500) / 260, L = 6 + R9() * 10; streaks2.push(S([[x, y], [x + t * L * 0.5, y + L * 0.5], [x + t * L, y + L]], 3.2 + R9() * 2.4, 0.85, DARK)); }
  b.addAll("body.streaks2", "body", "dark", "line", streaks2);
  const fluff2: Ink[] = []; for (let i = 0; i < 300 && fluff2.length < 110; i++) { const x = 360 + R9() * 290, y = 830 + R9() * 125; if (!bodyReg.has(x, y) || feetR.has(x, y)) continue; const d = (x < 500 ? -1 : 1) * (0.4 + R9() * 0.7), L = 10 + R9() * 14, sh = bodyLight(x, y); fluff2.push(S([[x, y], [x + d * 6, y + L * 0.4], [x + d * 2, y + L * 0.8], [x - d * 1, y + L]], 2 + sh * 1.8, 0.45 + sh * 0.45, sh > 0.55 ? DARK : LEAD)); }
  b.addAll("body.fluff2", "body", "dark", "line", fluff2);
  // tail and branch: the tail's top in the branch's shadow; the branch's core shadow; the owl's shadow on the branch
  H("tailDeep", "tail", minus(polyR(tailShape), polyR(branchShape)), (x, y) => clamp(1 - (y - 985) / 60) * 0.95 + clamp((x - 520) / 30) * 0.4, 918, { gap: 3.6, len: 20, w: 2.6, a: 0.85, ang: 0.4, layer: "dark", col: DARK });
  H("core", "branch", branchR, (x, y) => { const t = (y - bc(x)) / BH; return clamp(1 - Math.abs(t - 0.45) * 2.2); }, 919, { gap: 3.8, len: 34, w: 2.6, a: 0.8, ang: BANG + 0.35, layer: "dark", col: DARK });
  H("castDeep", "branch", minus(inter(polyR(branchShape), polyR([[594, 900], [740, 868], [820, 884], [740, 918], [600, 942]])), polyR(bodyShape)), (x) => clamp(1.2 - (x - 600) / 200), 920, { gap: 2.8, len: 26, w: 2.8, a: 0.9, ang: 0.3, layer: "dark", col: DARK });
  H("belly", "branch", minus(inter(polyR(branchShape), polyR([[360, 930], [660, 890], [664, 930], [360, 972]])), polyR(bodyShape), feetR), () => 0.9, 921, { gap: 3, len: 20, w: 2.6, a: 0.85, ang: BANG + 0.5, layer: "dark", col: DARK });
  // the kneaded eraser, pinched to a point: catchlights, then lost edges where the light hits
  b.erase("face.catchL", "face", "dark", [[eyeL.cx - 5, eyeL.cy + 11], [eyeL.cx - 2, eyeL.cy + 12]], { width: 9, ghost: 0.02 });
  b.erase("face.catchR", "face", "dark", [[eyeR.cx - 11, eyeR.cy + 12], [eyeR.cx - 8, eyeR.cy + 13]], { width: 9, ghost: 0.02 });
  b.erase("head.lostTop", "head", "line", [[350, 170], [358, 250], [345, 330], [350, 150]], { width: 22, ghost: 0.45 });
  b.erase("body.lostShoulder", "body", "line", [[330, 470], [306, 540], [296, 610]], { width: 20, ghost: 0.5 });
  b.erase("branch.lostTop", "branch", "line", [[60, bTop(60)], [180, bTop(180)], [300, bTop(300)]], { width: 18, ghost: 0.35 });
  void guideLine; void scribbleDot;
  return b.build();
};

export const lessonOwl = owlFilm(owlScore, { subtitle: "1. Draw some circles. 2. Draw the rest of the owl. Here are the steps in between.", outro: "That's the rest of the owl. Now draw it again from memory: the second owl teaches more than the first." });

export const LESSON = { score: owlScore, sheet: "lessonOwlSheet", final: "lessonOwlFinal" };
