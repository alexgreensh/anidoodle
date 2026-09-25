// FIGURE SHEET: Theo, the realistic-canon adult (7.5 heads), on the hard cases. Turning (four
// views on a head-unit grid), contrapposto (with its centre of mass dropped to the floor inside
// the support polygon), reaching up, sitting on a stool, gripping a mug (fingers solved onto the
// cylinder), and a hand pointed at the lens through a 35 mm lens. Storybook pencil + wash.
import { GRAPHITE, Gfx, PENCIL, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import { Camera, V3, add, camera, lensPx, mix3, mul, norm, project, sub } from "./character/math3";
import { handModel, resolveHand } from "./character/human/hands";
import type { Pose, Scene } from "./character/types";
import { renderStorybook } from "./character/render/storybook";
import { letter } from "./drafting";
import { theo, THEO_PALETTE } from "./characters/theo";
import { THEO_DIMS, contra, holdCup, mug, pointAtCamera, reachUp, relaxed, sit, stool, withProps, STOOL_H } from "./characters/theo/poses";
import { rigFor } from "./character/human/figure";
import { THEO_SPEC } from "./characters/theo";
import { balance } from "./character/human/balance";

const W = 3200, H = 4420, SHEET = "#f7f1e3", MUTED = "#8a7f72";
const label = (g: Gfx, t: string, x: number, y: number, cap = 26, color = GRAPHITE, align: "left" | "center" = "left") => letter(g, t, x, y, { cap, color, seed: t.length * 7 + Math.round(x), w: cap / 11, opacity: 0.9, align });
const only = (s: Scene, re: RegExp): Scene => ({ ...s, parts: s.parts.filter((p) => re.test(p.id)), ground: null });
// a long lens from far away for full figures: near-orthographic, so the grid reads true
const fullCam = (cx: number, floorY: number, figPx: number, yawCam = 0, height = 1.78): Camera => { const d = 14, f = (figPx * d) / height, a = (yawCam * Math.PI) / 180; return camera([Math.sin(a) * d, height * 0.52, Math.cos(a) * d], [0, height * 0.52, 0], f, cx, floorY - figPx * 0.52); };

const grid = (g: Gfx, cam: Camera, x0: number, x1: number) => {
  // head-unit rules: floor to crown in eighths... sevens and a half for a 7.5-head figure
  g.group("ink", () => { for (let i = 0; i <= 8; i++) { const y = project(cam, [0, Math.min(i, 7.5) * THEO_DIMS.hh, 0]).y; g.pen([[x0, y], [x1, y]], { w: i === 0 || i === 8 ? 1.4 : 0.9, color: "#9aa3b5", seed: 40 + i, wobble: 0.4, opacity: 0.5, retrace: false }); label(g, i === 8 ? "7.5" : String(i), x0 - 44, y - 9, 14, "#9aa3b5"); } });
};
const plumb = (g: Gfx, cam: Camera, _s: Scene, pose: Pose, extra: V3[] = []) => {
  const b = balance(rigFor(THEO_SPEC, pose), extra), top = project(cam, b.com), foot = project(cam, [b.com[0], 0, b.com[2]]);
  const sup = b.support.map(([x, z]) => { const q = project(cam, [x, 0.002, z]); return [q.x, q.y] as P; });
  g.group("ink", () => {
    if (sup.length > 2) g.pen(sup, { closed: true, w: 1.3, color: "#c0392b", seed: 71, wobble: 0.3, opacity: 0.8, retrace: false });
    g.pen([[top.x, top.y], [foot.x, foot.y]], { w: 1.2, color: "#c0392b", seed: 72, wobble: 0.2, opacity: 0.75, retrace: false });
    const c = g.cur; g.touch(top.x - 9, top.y - 9, top.x + 9, top.y + 9); c.fillStyle = "#c0392b"; c.beginPath(); c.arc(top.x, top.y, 6, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(foot.x, foot.y, 4, 0, Math.PI * 2); c.fill();
  });
  return b;
};

export const drawFigureSheet = (ctx: Ctx, frame: number, env: Env) => {
  const g = new Gfx(ctx, env, frame, PENCIL);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = SHEET; ctx.fillRect(0, 0, W, H);
  label(g, "THEO  /  FIGURE SHEET  /  ADULT CANON 7.5 HEADS, 1.78 M", 90, 60, 46);
  label(g, "EVERY POSE BUILT FROM THE SKELETON: JOINT LIMITS, BALANCE AND CONTACT ARE CHECKED IN CODE, NOT EYEBALLED", 90, 128, 20, MUTED);
  // ---- row 1: turning
  label(g, "1  TURNING", 90, 200, 28);
  [0, 45, 90, 180].forEach((yaw, i) => {
    const cx = 480 + i * 720, cam = fullCam(cx, 1110, 860);
    if (i === 0) grid(g, cam, 170, 3050);
    renderStorybook(g, theo.toScene(relaxed(yaw), cam), THEO_PALETTE);
    label(g, ["FRONT", "THREE-QUARTER", "PROFILE", "BACK"][i], cx - 90, 1150, 22, MUTED);
  });
  // ---- row 2: contrapposto, reaching, sitting
  label(g, "2  WEIGHT, REACH, SEAT", 90, 1240, 28);
  { const cx = 560, cam = fullCam(cx, 2170, 860, 0), p = contra(-30); const s = theo.toScene(p, cam); renderStorybook(g, s, THEO_PALETTE); const b = plumb(g, cam, s, p); label(g, "CONTRAPPOSTO: WEIGHT ON THE LEFT LEG", cx - 330, 2210, 20, MUTED); label(g, `CENTRE OF MASS ${b.inside ? "INSIDE" : "OUTSIDE"} SUPPORT, MARGIN ${(b.margin * 100).toFixed(1)} CM`, cx - 330, 2246, 16, "#c0392b"); }
  { const cx = 1600, cam = fullCam(cx, 2170, 860, 0), p = reachUp(-35); const s = theo.toScene(p, cam); renderStorybook(g, s, THEO_PALETTE); const b = plumb(g, cam, s, p); label(g, "REACHING UP, ON THE BALLS OF THE FEET", cx - 330, 2210, 20, MUTED); label(g, `CENTRE OF MASS ${b.inside ? "INSIDE" : "OUTSIDE"} SUPPORT, MARGIN ${(b.margin * 100).toFixed(1)} CM`, cx - 330, 2246, 16, "#c0392b"); }
  { const cx = 2650, cam = fullCam(cx, 2170, 860, 0), p = sit(-40); const s = withProps(theo.toScene(p, cam), cam, stool(-40)); renderStorybook(g, s, THEO_PALETTE); label(g, "SITTING ON A STOOL", cx - 330, 2210, 20, MUTED); label(g, `SEAT ${Math.round(STOOL_H * 100)} CM, THIGHS FORESHORTEN TOWARD US`, cx - 330, 2246, 16, MUTED); }
  // ---- row 3: the hands that carry the story
  label(g, "3  GRIP AND POINT", 90, 2330, 28);
  const cell = (x: number, y: number, w: number, h: number, fn: () => void) => { ctx.save(); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); fn(); ctx.restore(); g.group("ink", () => ([[[x, y], [x + w, y]], [[x + w, y], [x + w, y + h]], [[x + w, y + h], [x, y + h]], [[x, y + h], [x, y]]] as P[][]).forEach((l, i) => g.pen(l, { w: 1.2, color: MUTED, seed: x + i, wobble: 0.5, opacity: 0.5, retrace: false }))); };
  cell(120, 2400, 1440, 880, () => {
    // a medium close-up: the mug hand and the face that is looking at it
    const p = holdCup(), r = rigFor(THEO_SPEC, p), hand = r.joints.wristR, t = mix3(hand, r.joints.head, 0.5), cam = camera(add(t, [-0.24, 0.06, 1.1]), t, 1500, 840, 2840);
    renderStorybook(g, withProps(theo.toScene(p, cam), cam, mug(p)), THEO_PALETTE);
  });
  label(g, "GRIPPING A MUG: FOUR FINGERS SOLVED ONTO THE CYLINDER, THUMB OPPOSED", 130, 3300, 20, MUTED);
  cell(1640, 2400, 1440, 880, () => {
    // the camera sits ON the line of the index finger, half a metre out, with a 28 mm lens
    const p = pointAtCamera([0.05, 1.46, 0.95]), r = rigFor(THEO_SPEC, p), hm = handModel(r.hand.R, "R", THEO_DIMS.hand, resolveHand("point"));
    const idx = hm.digits.find((d) => d.digit === "index")!, tip = idx.pts[3], dir = norm(sub(tip, idx.pts[1]));
    const eye = add(add(tip, mul(dir, 0.28)), [0.055, 0.045, 0]), cam = camera(eye, add(tip, mul(dir, -0.5)), lensPx(24, 1440), 2360, 2840);
    renderStorybook(g, theo.toScene(p, cam), THEO_PALETTE, { weight: 1.1 });
  });
  label(g, "POINTING AT THE LENS, 24 MM, 30 CM: THE HAND DWARFS THE ARM BEHIND IT", 1650, 3300, 20, MUTED);
  // ---- row 4: one face, every view (the head only, big enough to judge)
  label(g, "4  ONE FACE, EVERY VIEW", 90, 3390, 28);
  [[0, 0, "FRONT"], [35, 0, "THREE-QUARTER"], [90, 0, "PROFILE"], [-40, -12, "FROM BELOW"], [160, 0, "BACK THREE-QUARTER"]].forEach(([yaw, tilt, name], i) => {
    const x = 120 + i * 600;
    cell(x, 3450, 560, 860, () => { const p: Pose = { ...relaxed(0), joints: { ...relaxed(0).joints, headTurn: 0 }, expression: i === 1 ? { smile: 0.35 } : {} }, r = rigFor(THEO_SPEC, p), t = add(r.joints.head, [0, 0.03, 0]), a = ((yaw as number) * Math.PI) / 180, el = (tilt as number) * 0.01, cam = camera(add(t, [Math.sin(a) * 1.4, -el * 30 * 0.03 - (tilt ? 0.35 : 0), Math.cos(a) * 1.4]), add(t, [0, tilt ? 0.02 : 0, 0]), 2900, x + 280, 3830); renderStorybook(g, only(theo.toScene(p, cam), /^(head|nose|earL|earR|hair|neck|neckSkin|torso|sleeveL|sleeveR)$/), THEO_PALETTE); });
    label(g, name as string, x + 280, 4340, 18, MUTED, "center");
  });
  g.paper("paper", 0.12); g.paper("coldpress", 0.12);
};
export const figureSheet: Film = { meta: { title: "Theo figure sheet", W, H, fps: 30, bpm: 120, durationFrames: 1 }, assets: { images: {} }, shots: [{ id: "sheet", start: 0, end: 1, draw: drawFigureSheet }] };
