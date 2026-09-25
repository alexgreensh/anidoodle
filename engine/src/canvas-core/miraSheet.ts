// MIRA'S MODEL SHEET, v1.0.0: the character's specimen plate and its ONE approval artifact.
// Turnaround (front, three-quarter, profile, back), six expressions, six poses, six hands and a
// scale line-up, in storybook pencil + watercolour. Every figure on it is mira.toScene(pose):
// nothing on this sheet is drawn by hand for the sheet.
import { GRAPHITE, Gfx, PENCIL, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import { Camera, add, apply, camera, project } from "./character/math3";
import type { Pose, Scene } from "./character/types";
import { renderStorybook } from "./character/render/storybook";
import { letter } from "./drafting";
import { mira, MIRA_VERSION, MIRA_FEATURES } from "./characters/mira";
import { MIRA_STORYBOOK } from "./characters/mira/palettes";
import { MIRA_DIMS, base, crate, crouch, gear, reachUp, relaxed, screwdriver, sitCrate, strapStand, walkContact, wave } from "./characters/mira/poses";
import { theo, THEO_PALETTE } from "./characters/theo";
import { relaxed as theoRelaxed } from "./characters/theo/poses";
import { EXPRESSIONS } from "./character/human/head";
import { rigFor } from "./character/human/figure";
import { MIRA_SPEC } from "./characters/mira";
import { order, toPart, type BlobPart } from "./character/build";

const W = 3600, H = 4500, SHEET = "#f7f1e3", MUTED = "#8a7f72";
const PAL = { ...MIRA_STORYBOOK, crate: { base: "#c9955e", shade: "#94683d" }, toolRed: { base: "#d8443a", shade: "#a52f28" }, ...THEO_PALETTE, skin: MIRA_STORYBOOK.skin, hair: MIRA_STORYBOOK.hair, nail: MIRA_STORYBOOK.nail };
const label = (g: Gfx, t: string, x: number, y: number, cap = 26, color = GRAPHITE, align: "left" | "center" = "left") => letter(g, t, x, y, { cap, color, seed: t.length * 7 + Math.round(x), w: cap / 11, opacity: 0.9, align });
const fullCam = (cx: number, floorY: number, figPx: number, height = 1.3, elev = 0): Camera => { const d = 12, f = (figPx * d) / height; return camera([0, height * 0.52 + elev, d], [0, height * 0.52, 0], f, cx, floorY - figPx * 0.52); };
const withProps = (s: Scene, cam: Camera, props: BlobPart[]): Scene => ({ ...s, parts: order([...s.parts, ...props.map((b) => toPart(cam, b))]) });
const cell = (ctx: Ctx, env: Env, g: Gfx, x: number, y: number, w: number, h: number, fn: () => void) => {
  ctx.save(); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); fn(); ctx.restore();
  g.group("ink", () => ([[[x, y], [x + w, y]], [[x + w, y], [x + w, y + h]], [[x + w, y + h], [x, y + h]], [[x, y + h], [x, y]]] as P[][]).forEach((l, i) => g.pen(l, { w: 1.1, color: MUTED, seed: x + y + i, wobble: 0.5, opacity: 0.45, retrace: false })));
};

export const drawMiraSheet = (ctx: Ctx, frame: number, env: Env) => {
  const g = new Gfx(ctx, env, frame, PENCIL);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = SHEET; ctx.fillRect(0, 0, W, H);
  label(g, `MIRA  /  MODEL SHEET  /  V${MIRA_VERSION}`, 90, 60, 50);
  label(g, "NINE-YEAR-OLD INVENTOR. STORYBOOK CANON 5.2 HEADS (A DECLARED ENLARGEMENT OF A REAL 6.2-HEAD CHILD), 1.30 M", 90, 134, 20, MUTED);
  label(g, "EVERY FIGURE HERE IS MIRA.TOSCENE(POSE) FROM ONE MODULE. SHOTS POSE HER; NOTHING REDRAWS HER.", 90, 168, 20, MUTED);
  // ---- turnaround, with head rules
  label(g, "1  TURNAROUND", 90, 240, 30);
  const turnCams = [0, 1, 2, 3].map((i) => fullCam(470 + i * 740, 1330, 980));
  g.group("ink", () => { for (let i = 0; i <= 5; i++) { const hgt = Math.min(i, 5.2) * MIRA_DIMS.hh, y = project(turnCams[0], [0, hgt, 0]).y; g.pen([[150, y], [3060, y]], { w: 0.9, color: "#9aa3b5", seed: 300 + i, wobble: 0.4, opacity: 0.5, retrace: false }); label(g, String(i), 110, y - 9, 14, "#9aa3b5"); } const yt = project(turnCams[0], [0, 5.2 * MIRA_DIMS.hh, 0]).y; g.pen([[150, yt], [3060, yt]], { w: 1.1, color: "#9aa3b5", seed: 309, wobble: 0.4, opacity: 0.55, retrace: false }); label(g, "5.2", 96, yt - 9, 14, "#9aa3b5"); });
  [0, 40, 90, 180].forEach((yaw, i) => { renderStorybook(g, mira.toScene(relaxed(yaw), turnCams[i]), PAL); label(g, ["FRONT", "THREE-QUARTER", "PROFILE", "BACK"][i], 470 + i * 740, 1370, 22, MUTED, "center"); });
  // the identity card: what must be present in every shot
  label(g, "IDENTITY", 3150, 300, 24);
  const wrap = (s: string, n: number) => s.split(" ").reduce<string[]>((a, w) => { const l = a[a.length - 1]; if (l !== undefined && (l + " " + w).length <= n) a[a.length - 1] = l + " " + w; else a.push(w); return a; }, []);
  MIRA_FEATURES.forEach((f, i) => { label(g, f.id.toUpperCase(), 3150, 350 + i * 118, 18); wrap(f.note.toUpperCase(), 28).slice(0, 3).forEach((ln, k) => label(g, ln, 3150, 380 + i * 118 + k * 20, 12, MUTED)); });
  // ---- expressions
  label(g, "2  EXPRESSIONS", 90, 1450, 30);
  ["neutral", "happy", "laughing", "surprised", "worried", "determined"].forEach((ex, i) => {
    const x = 120 + i * 560;
    cell(ctx, env, g, x, 1510, 520, 560, () => { const p = base(i % 2 ? 22 : -18, { headTilt: [0, 4, -6, 0, 5, -3][i] }, EXPRESSIONS[ex]), r = rigFor(MIRA_SPEC, p), t = add(r.joints.head, [0, 0.07, 0]), cam = camera(add(t, [0, 0.03, 1.6]), t, 2300, x + 260, 1790); renderStorybook(g, mira.toScene(p, cam), PAL); });
    label(g, ex.toUpperCase(), x + 260, 2090, 20, MUTED, "center");
  });
  // ---- poses
  label(g, "3  POSES", 90, 2180, 30);
  const poses: [string, Pose, BlobPart[]][] = [["WEIGHT ON ONE LEG", strapStand(-25), []], ["WALKING, CONTACT", walkContact(70), []], ["ON TIPTOE, REACHING", reachUp(30), []], ["SITTING ON A CRATE", sitCrate(-40), crate(-40)], ["CROUCHED, TINKERING", crouch(35), []], ["WAVING", wave(-15, 0.8), []]];
  poses.forEach(([name, p, props], i) => {
    const x = 330 + i * 560, cam = fullCam(x, 3060, 760);
    const extra = name.startsWith("CROUCHED") ? [...screwdriver(p), ...gear(p)] : props;
    renderStorybook(g, withProps(mira.toScene(p, cam), cam, extra), PAL);
    label(g, name, x, 3100, 18, MUTED, "center");
  });
  // ---- hands
  label(g, "4  HANDS (RIGHT)", 90, 3200, 30);
  const handPoses: [string, string][] = [["RELAXED", "relaxed"], ["OPEN", "open"], ["POINT", "point"], ["FIST", "fist"], ["GRIP", "grip"], ["PINCH", "pinch"]];
  handPoses.forEach(([name, hp], i) => {
    const x = 120 + (i % 3) * 700, y = 3260 + Math.floor(i / 3) * 600;
    cell(ctx, env, g, x, y, 660, 540, () => {
      const p: Pose = { ...base(0, { shoulderRaiseR: 70, shoulderSwingR: 80, elbowR: 70, pronationR: 30, shoulderTwistR: -10 }), hands: { L: "relaxed", R: hp } };
      const r = rigFor(MIRA_SPEC, p), hc = apply(r.hand.R, [0, -0.4 * MIRA_DIMS.hand, 0]), cam = camera(add(hc, [-0.07, 0.1, 0.24]), hc, 1050, x + 330, y + 270);
      const props = hp === "grip" ? screwdriver(p) : [];
      const s = withProps(mira.toScene(p, cam), cam, props);
      renderStorybook(g, { ...s, parts: s.parts.filter((q) => /^(palm|thumb|index|middle|ring|little)R$|^driver/.test(q.id)), ground: null }, PAL);
    });
    label(g, name, x + 330, y + 555, 18, MUTED, "center");
  });
  // ---- scale line-up
  label(g, "5  SCALE", 2250, 3200, 30);
  cell(ctx, env, g, 2250, 3260, 1250, 1140, () => {
    const cam = (cx: number) => { const d = 16, f = (860 * d) / 1.78; return camera([0, 0.9, d], [0, 0.9, 0], f, cx, 4200 - 860 * 0.9 / 1.78); };
    const cm = cam(2600), ct = cam(3060);
    g.group("ink", () => { [0, 1.3, 1.78].forEach((hgt, i) => { const y = project(cm, [0, hgt, 0]).y; g.pen([[2280, y], [3470, y]], { w: 0.9, color: "#9aa3b5", seed: 500 + i, wobble: 0.4, opacity: 0.5, retrace: false }); }); });
    renderStorybook(g, mira.toScene(relaxed(15, { smile: 0.4 }), cm), PAL);
    renderStorybook(g, theo.toScene(theoRelaxed(-15), ct), PAL);
    label(g, "MIRA 1.30 M", 2600, 4250, 18, MUTED, "center"); label(g, "5.2 HEADS", 2600, 4278, 14, MUTED, "center");
    label(g, "THEO 1.78 M", 3060, 4250, 18, MUTED, "center"); label(g, "7.5 HEADS", 3060, 4278, 14, MUTED, "center");
  });
  g.paper("paper", 0.12); g.paper("coldpress", 0.12);
};
export const miraSheet: Film = { meta: { title: "Mira model sheet", W, H, fps: 30, bpm: 120, durationFrames: 1 }, assets: { images: {} }, shots: [{ id: "sheet", start: 0, end: 1, draw: drawMiraSheet }] };
