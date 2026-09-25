// BIT, RIGGED FOR THE WEB. The storybook plate's wind-up robot (storybook.ts, pencil + watercolour),
// cut into parts that are drawn ONCE by the plate's own code and then moved as sprites.
//
//   legs + boots + ground hatch   drawBit groups 0, 3-8           (boil variants)
//   wind-up key                   drawBit groups 1-2              (8 turn phases)
//   arms                          storybook limb() + hand()       (ARM_CELS angles per side, on twos)
//   body + collar                 drawBit groups 17-20            (boil variants)
//   antenna, bulb, ears, head     drawBit groups 22-25            (boil variants; tilts about the neck)
//   blush                         drawBit group 26
//   face                          re-inked here with the plate's pen, one cel per expression,
//                                 because an interactive face needs expressions the still never drew
//   glow                          live: one radial gradient, the only mark made per frame
//
// Nothing here knows about input. A piece turns InputState into a BitPose; the rig draws the pose.
import { GRAPHITE, TINT, arc, heart, line, oval, rng, turn, type Ctx, type Env, type Gfx, type P } from "./core";
import { bake, bakePart, blit, paperFactor, type Sprite } from "./bake";
import { SHADE, drawBit, hand, limb } from "./storybook";

// ---------------------------------------------------------------- placement: the plate's own
export const SHEET = 560;
const X = 272, Y = 492, S = 2.75 * (SHEET / 1080), SEED = 3;
const REST = { look: 0, tilt: 0, lean: 0, handL: [-80, -58] as P, handR: [94, -178] as P };
export const HIP: P = [0, -40], NECK: P = [0, -140], FACE: P = [0, -194], BULB: P = [39, -130 - 200];
export const toSheet = (p: P): P => [X + p[0] * S, Y + p[1] * S];                  // Bit-local -> sheet (logical) px
export const BOIL = 2;                                                             // boil variants of the big outlines
export const KEY_PHASES = 8;
export const ARM_CELS = 16, ARM_MAX = 0.8;                                         // arm lift u in [0, ARM_MAX]

// ---------------------------------------------------------------- affine, in device px
export type M = [number, number, number, number, number, number];
export const I: M = [1, 0, 0, 1, 0, 0];
export const mul = (m: M, n: M): M => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
export const tr = (x: number, y: number): M => [1, 0, 0, 1, x, y];
export const about = (p: [number, number], deg: number, sx = 1, sy = 1): M => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return mul(tr(p[0], p[1]), mul([c * sx, s * sx, -s * sy, c * sy, 0, 0], tr(-p[0], -p[1]))); };
export const apply = (m: M, p: [number, number]): [number, number] => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
// draw a sprite through m: a pure translation stays on whole device pixels (crisp); anything else
// resamples. Rule 6: never enlarge a bitmap.
export const blitM = (ctx: Ctx, s: Sprite, m: M, alpha = 1) => {
  if (alpha <= 0) return;
  if (m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1) return blit(ctx, s, m[4], m[5], alpha);
  if (Math.hypot(m[0], m[1]) > 1 + 1e-9 || Math.hypot(m[2], m[3]) > 1 + 1e-9) throw new Error("bitRig: a sprite may only be scaled down");
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); ctx.globalAlpha = alpha; ctx.drawImage(s.c, s.x, s.y); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
};

// ---------------------------------------------------------------- parts
const glowSprite = (env: Env) => bake(env, "bit:glow", (g) => { const c = toSheet(BULB), r = 46 * S * 1.2; g.group("plain", () => { g.touch(c[0] - r * 2, c[1] - r * 2, c[0] + r * 2, c[1] + r * 2); g.glow(c[0], c[1], r, TINT.glow, 1); }); });
const headLayer = (env: Env, w: number, h: number) => { const key = `bit:headLayer:${w}x${h}`; let L = env.cache.get(key) as ReturnType<Env["canvas"]> | undefined; if (!L) { L = env.canvas(w, h); env.cache.set(key, L); } return L; };
const dev = (env: Env, p: P): [number, number] => { const q = toSheet(p); return [q[0] * env.scale, q[1] * env.scale]; };
const part = (env: Env, name: string, groups: number[], v: number, frame = v * 4) => bakePart(env, `bit:${name}:${v}`, (i) => groups.includes(i), (g) => { g.push(X, Y, S); drawBit(g, frame, SEED, REST); g.pop(); }, { frame });
export const LEGS = [0, 3, 4, 5, 6, 7, 8], KEY = [1, 2], BODY = [17, 18, 19, 20], HEAD = [22, 23, 24, 25], BLUSH = [26];
const legs = (env: Env, v: number) => part(env, "legs", LEGS, v);
const body = (env: Env, v: number) => part(env, "body", BODY, v);
const head = (env: Env, v: number) => part(env, "head", HEAD, v);
const blush = (env: Env) => part(env, "blush", BLUSH, 0);
// keyTurn = |cos(frame * 0.22)| in the plate: phase i of 8 is frame i*pi/8/0.22
const key = (env: Env, i: number) => part(env, `key${i}`, KEY, 0, (i * Math.PI) / KEY_PHASES / 0.22);

// arms: the plate's limb() and hand(), at a lift u. Right shoulder is (50, -114); the left mirrors it.
const SHOULDER = (side: number): P => [side * 50, -114];
const armAngle = (u: number) => 62 - 177 * u;                                        // degrees, right arm; 62 = hanging, -80 = up
const armLen = (u: number) => 64 + 12 * Math.min(1, u / 0.66);
export const handAt = (side: number, u: number): P => { const a = (armAngle(u) * Math.PI) / 180, L = armLen(u), s = SHOULDER(side); return [s[0] + side * Math.cos(a) * L, s[1] + Math.sin(a) * L]; };
export const armCel = (u: number) => Math.max(0, Math.min(ARM_CELS - 1, Math.round((u / ARM_MAX) * (ARM_CELS - 1))));
const arm = (env: Env, side: number, cel: number) => bake(env, `bit:arm:${side}:${cel}`, (g) => {
  const u = (cel / (ARM_CELS - 1)) * ARM_MAX, s = SHOULDER(side), h = handAt(side, u), bend = side * 14, mid = line(s, h, bend)[1];
  g.push(X, Y, S); limb(g, s, h, bend, 7.5, SEED + (side < 0 ? 40 : 50)); hand(g, h, Math.atan2(h[1] - mid[1], h[0] - mid[0]), u < 0.16 ? "rest" : "open", SEED + (side < 0 ? 60 : 80)); g.pop();
});

// the face, re-inked. Eye centres are fo + (+-31, 0|-1), the plate's gap; the pen and seeds are the plate's.
const GAP = 31, FS = SEED + 170;
const eyeC = (s: number): P => [FACE[0] + s * GAP, FACE[1] + (s > 0 ? -1 : 0)];
const face = (env: Env, name: string, draw: (g: Gfx) => void) => bake(env, `bit:face:${name}`, (g) => { g.push(X, Y, S); draw(g); g.pop(); });
const eye = (env: Env, s: number) => face(env, `eye${s}`, (g) => g.group("ink", () => {
  const c = eyeC(s), k = g.cur; g.touch(c[0] - 13, c[1] - 13, c[0] + 13, c[1] + 13);
  k.fillStyle = GRAPHITE; k.beginPath(); k.ellipse(c[0], c[1], 8.4, 10.8, 0, 0, Math.PI * 2); k.fill();
  k.fillStyle = "#fffaf3"; k.beginPath(); k.arc(c[0] - 2.6, c[1] - 3.8, 3.3, 0, Math.PI * 2); k.fill(); k.globalAlpha = 0.85; k.beginPath(); k.arc(c[0] + 2.8, c[1] + 3.6, 1.5, 0, Math.PI * 2); k.fill(); k.globalAlpha = 1;
}));
export type Eyes = "open" | "happy" | "shut" | "blink" | "squint";
const lids = (env: Env, kind: Exclude<Eyes, "open">, s: number) => face(env, `lid-${kind}${s}`, (g) => g.group("ink", () => {
  const [x, y] = eyeC(s), o = { w: 2.6, seed: FS + 40 + s, wobble: 0.3, boil: 0.25, taper: 0.5 };
  if (kind === "happy") g.pen(arc(x, y + 4, 9, 8, 1.1 * Math.PI, 1.9 * Math.PI, 6), o);                                  // ^ ^
  if (kind === "blink") g.pen(arc(x, y - 3, 9, 4, 0.12 * Math.PI, 0.88 * Math.PI, 5), o);                                // a closed lid, lashes down
  if (kind === "shut") g.pen([[x - 8 * s, y - 7], [x + 5 * s, y], [x - 8 * s, y + 7]], { ...o, w: 2.9 });                 // > <  squeezed shut
  if (kind === "squint") g.pen(arc(x, y + 1, 9, 5, 1.08 * Math.PI, 1.92 * Math.PI, 5), { ...o, w: 3 });
}));
export type Brows = "neutral" | "up" | "worried" | "none";
const brow = (env: Env, kind: Exclude<Brows, "none">, s: number) => face(env, `brow-${kind}${s}`, (g) => g.group("ink", () => {
  const [x, y] = eyeC(s), lift = kind === "up" ? -6 : kind === "worried" ? -3 : 0, pts = arc(x, y - 13 + lift, 10, 6, 1.25 * Math.PI, 1.75 * Math.PI, 4);
  g.pen(kind === "worried" ? turn(pts, x, y - 13 + lift, s * 16) : pts, { w: 2.1, seed: FS + 14 + (s > 0 ? 1 : 0), wobble: 0.3, opacity: kind === "neutral" ? 0.55 : 0.75, retrace: false });
}));
export type Mouth = "smile" | "grin" | "o" | "wobble" | "flat";
const mouth = (env: Env, kind: Mouth) => face(env, `mouth-${kind}`, (g) => {
  const [x, y] = [FACE[0], FACE[1] + 20], o = { w: 2.9, seed: FS + 20, wobble: 0.3, boil: 0.3 };
  if (kind === "grin") {
    const lip: P[] = [[x - 13, y - 3], [x - 6, y - 4], [x, y - 4], [x + 6, y - 4], [x + 13, y - 3]], cup: P[] = [...lip, ...arc(x, y - 3, 13, 12, 0.05 * Math.PI, 0.95 * Math.PI, 9)];
    g.group("paint", () => { g.fill(cup, "#5b3a44", 0.92); g.wash(oval(x + 1, y + 5, 7, 4, 8), TINT.blush, { alpha: 0.9, seed: FS + 23, dx: 0, dy: 0, shrink: 1, rim: false }); });
    g.group("ink", () => g.pen(cup, { ...o, closed: true, w: 2.6, taper: 0.4 }));
  } else g.group("ink", () => {
    if (kind === "smile") g.pen(arc(x, y, 9, 8, 0.12 * Math.PI, 0.88 * Math.PI, 6), o);
    if (kind === "o") g.pen(oval(x, y + 3, 5.5, 6.5, 8), { ...o, closed: true, w: 2.6, taper: 0.4 });
    if (kind === "wobble") g.pen([[x - 10, y + 5], [x - 5, y + 2], [x, y + 5], [x + 5, y + 2], [x + 10, y + 5]], { ...o, w: 2.5 });
    if (kind === "flat") g.pen(line([x - 7, y + 4], [x + 7, y + 3], 0.5), o);
  });
});
const cheeks = (env: Env) => face(env, "cheeks", (g) => g.group("ink", () => [-1, 1].forEach((s) => { const c: P = [FACE[0] + s * (GAP + 22) - 7, FACE[1] + 17]; g.hatch(c[0], c[1], 13, { n: 3, len: 9, color: TINT.blush, pw: 2.6, opacity: 0.9, seed: FS + 30 + s }); })));
// the chest heart, re-inked 25% larger so a beat can shrink it back to the plate's size (never enlarge)
const HEART: P = [0, -86 - 13], BIG = 1.25;
const heartBig = (env: Env) => face(env, "heart", (g) => { g.group("paint", () => g.wash(heart(HEART[0], HEART[1], 10 * BIG), TINT.blush, { alpha: 0.95, seed: SEED + 102, dx: 0, dy: 0, shrink: 1, rim: false })); g.group("ink", () => g.pen(heart(HEART[0], HEART[1], 10 * BIG), { closed: true, w: 1.9 * BIG, color: "#c9566b", seed: SEED + 113, wobble: 0.3, taper: 0.4 })); });
// a pencil twinkle for celebrations: four strokes from a point and a dab of butter wash
export const twinkle = (env: Env, v: number) => bake(env, `bit:twinkle:${v}`, (g) => {
  const c: P = TWINKLE_AT(v); g.push(X, Y, S);
  g.group("paint", () => g.wash(oval(c[0], c[1], 11, 11, 7), TINT.butter, { alpha: 0.9, seed: 900 + v, dx: 0, dy: 0, shrink: 1, rim: false }));
  g.group("ink", () => [0, 1, 2, 3].forEach((i) => { const a = (i * Math.PI) / 2 + v * 0.4, r0 = 15, r1 = 34 + (i % 2) * 10; g.pen(line([c[0] + Math.cos(a) * r0, c[1] + Math.sin(a) * r0], [c[0] + Math.cos(a) * r1, c[1] + Math.sin(a) * r1]), { w: 3, seed: 910 + v * 4 + i, wobble: 0.3, retrace: false }); }));
  g.pop();
});
export const TWINKLE_AT = (v: number): P => [-140 + v * 60, -60]; /* baked on the sheet, then moved: a bake crops to the canvas */

// ---------------------------------------------------------------- the pose and the draw
export type BitPose = {
  off: P;          // whole figure, local units (a jump is negative y)
  bob: number;     // upper body only, local units (breathing)
  squash: number;  // <= 1, vertical, about the feet
  lean: number;    // degrees, upper body about the hips
  headOff: P;      // local units, the head turning toward what it looks at
  tilt: number;    // degrees, head about the neck
  look: P;         // local units, eyes inside the face
  armL: number; armR: number; // lift, 0 hanging .. ARM_MAX
  eyes: Eyes; eyesR?: Eyes;   // eyesR: the right eye, when it differs (a peek)
  blink: number;   // 0 open .. 1 closed (open eyes only)
  brows: Brows; mouth: Mouth;
  blush: number; glow: number; heart: number; // heart: 0 rest .. 1 full beat
  key: number;     // phase index (any integer)
  boil: number;    // variant index (any integer)
  twinkles?: { at: P; k: number; a: number; v: number }[];
  faceFade?: number; // reduced motion: 0 = resting face .. 1 = this pose's face, crossfaded // sheet-local positions, 0.4 <= k <= 1 scale, alpha
};
export const restPose = (): BitPose => ({ off: [0, 0], bob: 0, squash: 1, lean: 0, headOff: [0, 0], tilt: 0, look: [0, 0], armL: 0, armR: 0, eyes: "open", blink: 0, brows: "neutral", mouth: "smile", blush: 0.8, glow: 1, heart: 0, key: 0, boil: 0 });

export const drawBit2 = (ctx: Ctx, env: Env, p: BitPose) => {
  const k = S * env.scale, v = ((p.boil % BOIL) + BOIL) % BOIL;
  const F = mul(tr(Math.round(p.off[0] * k), Math.round(p.off[1] * k)), about(dev(env, [0, 0]), 0, 1, p.squash));
  // lean is a whole-pixel shift of the upper body, not a rotation: crisp, and a rotated blit costs ~8x
  // an axis-aligned one on a software canvas. Only the head rotates (tilt), and only once: see below.
  const U = mul(F, tr(Math.round(p.lean * 1.2 * k), Math.round(p.bob * k))), H = mul(U, mul(tr(p.headOff[0] * k, p.headOff[1] * k), about(dev(env, NECK), p.tilt)));
  const snap = (m: M): M => (m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 ? [1, 0, 0, 1, Math.round(m[4]), Math.round(m[5])] : m);
  blitM(ctx, legs(env, v), snap(F));
  blitM(ctx, key(env, ((p.key % KEY_PHASES) + KEY_PHASES) % KEY_PHASES), snap(U));
  blitM(ctx, arm(env, -1, armCel(p.armL)), snap(U)); blitM(ctx, arm(env, 1, armCel(p.armR)), snap(U));
  blitM(ctx, body(env, v), snap(U));
  if (p.heart > 0) { const c = dev(env, HEART), s = 1 / BIG + (1 - 1 / BIG) * Math.min(1, p.heart); blitM(ctx, heartBig(env), mul(U, about(c, 0, s, s))); }
  // the bulb's glow: the plate's radial falloff, the only thing drawn live
  // the bulb's glow: the plate's radial falloff, baked once at full strength, blitted with the pose's alpha
  const b = apply(H, dev(env, BULB)), op = Math.min(1, 0.56 * p.glow), gs = glowSprite(env);
  if (op > 0.01) blit(ctx, gs, Math.round(b[0] - (gs.x + gs.w / 2)), Math.round(b[1] - (gs.y + gs.h / 2)), op);
  // head and face are composed axis-aligned on one layer (in rest device coords), then that layer is
  // blitted through H once: one rotated blit instead of ten
  const hs = head(env, v), bx = hs.x - Math.round(12 * k), by = hs.y - Math.round(8 * k), bw = hs.w + Math.round(24 * k), bh = hs.h + Math.round(16 * k), HL = headLayer(env, bw, bh), outer = ctx;
  { const c = HL.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, bw, bh); }
  const hctx = HL.ctx as Ctx, B0 = tr(-bx, -by);
  blitM(hctx, hs, B0);
  // the face rides on the head, and slides a little toward what it looks at
  const Fc = snap(mul(B0, tr(p.look[0] * 0.45 * k, p.look[1] * 0.35 * k))), Fe = snap(mul(B0, tr(p.look[0] * k, p.look[1] * k)));
  const faceOf = (q: Pick<BitPose, "eyes" | "eyesR" | "blink" | "brows" | "mouth" | "blush">, al: number) => {
    if (al <= 0) return;
    blitM(hctx, blush(env), Fc, q.blush * al); if (q.blush > 0.9) blitM(hctx, cheeks(env), Fc, Math.min(1, (q.blush - 0.9) * 10) * al);
    [-1, 1].forEach((s) => {
      const e = s > 0 && q.eyesR ? q.eyesR : q.eyes;
      if (e === "open") { const bl = Math.max(0, Math.min(1, q.blink)); if (bl < 0.85) { const c = apply(Fe, dev(env, eyeC(s))); blitM(hctx, eye(env, s), mul(about(c, 0, 1, 1 - bl * 0.9), Fe), al); } else blitM(hctx, lids(env, "blink", s), Fc, al); }
      else blitM(hctx, lids(env, e, s), Fc, al);
      if (q.brows !== "none") blitM(hctx, brow(env, q.brows, s), Fc, al);
    });
    blitM(hctx, mouth(env, q.mouth), Fc, al);
  };
  // reduced motion: an expression change is a short crossfade from the resting face, never a movement
  if (p.faceFade !== undefined) { const a = Math.max(0, Math.min(1, p.faceFade)); faceOf({ eyes: "open", blink: 0, brows: "neutral", mouth: "smile", blush: 0.8 }, 1 - a); faceOf(p, a); }
  else faceOf(p, 1);
  blitM(outer, { c: HL.canvas as CanvasImageSource, x: bx, y: by, w: bw, h: bh }, snap(H));
  (p.twinkles ?? []).forEach((t) => { const tv = t.v % 3, c = dev(env, TWINKLE_AT(tv)); blitM(ctx, twinkle(env, tv), mul(tr(t.at[0] * env.scale - c[0], t.at[1] * env.scale - c[1]), about(c, t.v * 17, t.k, t.k)), t.a); });
};

// Everything the rig can ever blit, in the order a first frame needs it: rest first, cels after.
export function* bakeBit(env: Env): Generator<string> {
  yield "legs"; legs(env, 0); yield "key"; key(env, 0); yield "arms"; arm(env, -1, 0); arm(env, 1, 0); yield "body"; body(env, 0); yield "head"; head(env, 0);
  yield "face"; blush(env); cheeks(env); [-1, 1].forEach((s) => { eye(env, s); brow(env, "neutral", s); }); mouth(env, "smile");
  for (let v = 1; v < BOIL; v++) { yield `boil${v}`; legs(env, v); body(env, v); head(env, v); }
  for (let i = 1; i < KEY_PHASES; i++) { yield `key${i}`; key(env, i); }
  for (let c = 1; c < ARM_CELS; c++) { yield `arm${c}`; arm(env, -1, c); arm(env, 1, c); }
  yield "expressions";
  [-1, 1].forEach((s) => { (["happy", "blink", "shut", "squint"] as const).forEach((l) => lids(env, l, s)); (["up", "worried"] as const).forEach((b) => brow(env, b, s)); });
  (["grin", "o", "wobble", "flat"] as const).forEach((m) => mouth(env, m)); heartBig(env); [0, 1, 2].forEach((v) => twinkle(env, v));
}

// ---------------------------------------------------------------- the meadow, re-authored from drawStorybook without Bit
// (drawStorybook builds its own Gfx, so its scene cannot be filtered; these are its calls, same seeds)
export const meadow = (g: Gfx, o: { flowers?: boolean; underdrawing?: boolean; splatter?: boolean; vignette?: boolean; base?: boolean } = {}) => {
  const ctx = g.main, env = g.env;
  if (o.base !== false) { ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = "#fbf6ea"; ctx.fillRect(0, 0, env.W, env.H); }
  g.group("paint", () => {
    g.wash([[40, 46], [170, 36], [300, 42], [430, 34], [522, 44], [528, 170], [520, 300], [526, 430], [518, 488], [400, 480], [280, 490], [150, 482], [42, 490], [34, 380], [42, 250], [36, 130]], "#f3d9b4", { alpha: 0.62, seed: 2 });
    g.wash(oval(170, 150, 150, 105, 9), "#a9cdea", { alpha: 0.24, seed: 3 }); g.wash(oval(420, 330, 120, 150, 9), "#f2b9a0", { alpha: 0.26, seed: 4 }); g.wash(oval(318, 96, 80, 70, 8), TINT.glow, { alpha: 0.5, seed: 5 });
    g.wash([[34, 470], [150, 452], [300, 460], [430, 450], [530, 466], [524, 530], [300, 538], [44, 530]], "#9cc79a", { alpha: 0.62, seed: 6 }); g.wash([[60, 486], [200, 474], [330, 480], [330, 500], [190, 506], [70, 504]], "#6fa874", { alpha: 0.35, seed: 7 });
    g.wash(oval(292, 494, 124, 13, 10), "#7d6fa8", { alpha: 0.42, seed: 8 });
  });
  g.group("ink", () => {
    const U = "#8d90a6";
    if (o.underdrawing !== false) { g.pen(turn(oval(300, 214, 128, 104, 12), 300, 214, 6), { closed: true, w: 1.4, color: U, seed: 9, opacity: 0.45, wobble: 2 }); g.pen(oval(292, 392, 86, 92, 10), { closed: true, w: 1.4, color: U, seed: 10, opacity: 0.42, wobble: 2 }); g.pen([[318, 96], [300, 214], [288, 400], [286, 500]], { w: 1.3, color: U, seed: 11, opacity: 0.42 }); g.pen([[170, 232], [300, 214], [432, 196]], { w: 1.3, color: U, seed: 12, opacity: 0.4 }); }
    g.pen([[36, 470], [150, 454], [300, 461], [430, 452], [530, 468]], { w: 2, seed: 13, opacity: 0.55 });
    [[66, 0], [84, 1], [104, 0], [128, 1], [430, 0], [452, 1], [474, 0], [500, 1]].forEach(([x, k], i) => g.pen([[x, 472], [x + (k ? 5 : -4), 456 - (i % 3) * 4], [x + (k ? 9 : -8), 444 - (i % 3) * 5]], { w: 1.9, color: "#5f8f62", seed: 20 + i, retrace: false }));
    [[176, 512, 9, 5], [396, 516, 11, 6], [232, 524, 6, 4]].forEach(([x, y, a, b], i) => g.pen(oval(x, y, a, b, 7), { closed: true, w: 1.6, seed: 40 + i, opacity: 0.6 }));
  });
  if (o.flowers !== false) ([[64, 440, "#f2899c", 50], [488, 430, "#c7b3e0", 60], [446, 452, "#f5b98a", 70], [98, 462, "#f3d577", 80]] as [number, number, string, number][]).forEach(([x, y, c, seed]) => {
    g.group("paint", () => { const flat = { dx: 3, dy: 2, shrink: 0.94, rim: true }; [0, 1, 2, 3, 4].forEach((i) => g.wash(oval(x + Math.cos(i * 1.256 + 0.4) * 9, y + Math.sin(i * 1.256 + 0.4) * 9, 7.5, 7.5, 6), c, { alpha: 0.85, seed: seed + i, ...flat })); g.wash(oval(x, y, 3.4, 3.4, 5), TINT.butter, { alpha: 0.95, seed: seed + 6, ...flat }); });
    g.group("ink", () => { g.pen([[x, y + 9], [x + 2, y + 24], [x - 1, y + 40]], { w: 1.8, color: "#6f9b6a", seed: seed + 7, retrace: false }); g.pen(oval(x, y, 16, 16, 9), { closed: true, w: 1.5, seed: seed + 8, opacity: 0.6, wobble: 2 }); });
  });
  if ((o.splatter ?? o.flowers) !== false) splatter(g);
  if (o.vignette !== false) g.vignette("rgba(90,50,50,0.11)");
};
// paint flicked off the brush (drawStorybook draws it last, over Bit)
export const splatter = (g: Gfx) => g.group("paint", () => { const c = g.cur; ([[5, 26, [50, 60, 510, 470], "#e9a887", 3], [8, 12, [60, 380, 500, 520], "#6fa874", 2.6]] as [number, number, number[], string, number][]).forEach(([sd, n, box, col, rmax]) => { const r = rng(sd); for (let i = 0; i < n; i++) { const x = box[0] + r() * (box[2] - box[0]), y = box[1] + r() * (box[3] - box[1]), k = r(); g.touch(x - 5, y - 5, x + 5, y + 5); c.globalAlpha = 0.5 * (0.5 + r() * 0.5); c.fillStyle = col; c.beginPath(); c.arc(x, y, 0.5 + k * k * rmax, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1; }); });
export const SHADES = SHADE;

// ---------------------------------------------------------------- shared behaviour, for any piece that uses Bit
export const LOOP = 480; // 8 s; every idle period below divides it
const tri = (u: number) => (u < 0.5 ? u * 2 : 2 - u * 2);
export const FACE_SHEET = toSheet(FACE);
export const S_LOCAL = S;
// breathing, blinking, the key turning, the line boiling, the bulb pulsing: never a dead second
export const idle = (p: BitPose, t: number) => {
  const lt = t % LOOP;
  p.key = Math.floor(t / 4); p.boil = Math.floor(t / 8); p.bob = -1.2 * Math.sin((2 * Math.PI * t) / 120);
  p.glow = 1 + 0.25 * Math.sin((2 * Math.PI * t) / 60);
  const b = lt >= 100 && lt < 108 ? (lt - 100) / 8 : lt >= 330 && lt < 338 ? (lt - 330) / 8 : -1; if (b >= 0) p.blink = tri(b);
};
// eyes and head toward two sprung points in sheet px
export const attend = (p: BitPose, look: P, head: P) => {
  const gz = gazeAt(FACE_SHEET, look, 6 * S, 160), hg = gazeAt(FACE_SHEET, head, 1, 260);
  p.look = [gz[0] / S, Math.max(-4, Math.min(4, gz[1] / S))]; p.headOff = [hg[0] * 5, hg[1] * 3]; p.tilt = hg[0] * 4; p.lean = hg[0] * 2;
};
const gazeAt = (eye: P, at: P, reach: number, near: number): P => { const dx = at[0] - eye[0], dy = at[1] - eye[1], d = Math.hypot(dx, dy); if (d < 1e-6) return [0, 0]; const k = reach * Math.tanh(d / near); return [(dx / d) * k, (dy / d) * k]; };
// the cheer: 72 ticks. Wind-up crouch, a jump, both arms up and waving, twinkles, a landing squash.
export const CHEER = 72;
export const cheer = (p: BitPose, f: number, seed: number, reduced: boolean) => {
  p.eyes = "happy"; p.mouth = "grin"; p.brows = "up"; p.blush = 1; p.heart = tri((f % 18) / 18);
  if (reduced) return;
  p.squash = f < 6 ? 1 - 0.05 * (f / 6) : f >= 30 && f < 38 ? 1 - 0.05 * tri((f - 30) / 8) : 1;
  if (f >= 6 && f < 30) p.off = [0, -24 * Math.sin((Math.PI * (f - 6)) / 24)];
  p.armL = Math.min(ARM_MAX, 0.6 + 0.07 * Math.sin((2 * Math.PI * f) / 12)); p.armR = Math.min(ARM_MAX, 0.6 + 0.07 * Math.sin((2 * Math.PI * (f + 3)) / 12));
  p.key += f; p.look = [0, -2]; p.headOff = [0, -2]; p.tilt = 0; p.lean = 0;
  const r = rng(seed); p.twinkles = [];
  for (let i = 0; i < 7; i++) { const side = i % 2 ? 1 : -1, ang = -Math.PI * (0.5 + side * (0.12 + 0.36 * r())), dist = 175 + r() * 60, f0 = 6 + i * 3, u = f - f0; if (u < 0) continue; const at: P = [FACE_SHEET[0] + Math.cos(ang) * dist, FACE_SHEET[1] + 60 + Math.sin(ang) * dist * 0.8]; /* either side of him, never over his face */ p.twinkles.push({ at, k: Math.min(1, 0.45 + u / 10), a: Math.max(0, Math.min(1, (CHEER - f) / 14)), v: i }); }
};

// the meadow and the sheet, baked once per scale
export const meadowSprite = (env: Env, o: Parameters<typeof meadow>[1] = {}) => bake(env, `meadow:${o.flowers !== false}:${o.underdrawing !== false}`, (g) => meadow(g, o), { full: true });
export const sheetSprite = (env: Env) => paperFactor(env, [["paper", 0.13], ["coldpress", 0.2]]);
export const SHEETS: [string, number][] = [["paper", 0.13], ["coldpress", 0.2]];

