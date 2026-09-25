// TOY BRICK · "the tug". A brick-built harbour tugboat on a baseplate, built step by step.
//
// MEDIUM (physical): moulded ABS toy bricks, rendered. Zero hand marks: flat plastic fills in
// the part's real colour (a fixed table of real toy-brick colours), one tone per face by the
// cube rule (top +0.10, lit side 0, far side -0.22), a thin bevel highlight where a top meets a
// side, dark seam hairlines where one part meets the next, studs as real cylinders (12 LDU wide,
// 4 high) with a highlight crescent toward the light and a shadow crescent away from it, and a
// soft ground shadow on the baseplate. Proportions are real: 1 stud = 20 LDU, brick 24, plate 8.
// MARKS: the part. Nothing is stroked by a hand; a part is placed.
// ORDER (the film, instruction-booklet grammar): the bare backdrop, then the baseplate drops in,
// then step by step, bottom up and back to front inside a layer, each part falls straight down
// its insertion axis, ghosted while it travels, and seats with a one-frame press-fit. The parts
// of the current step carry the booklet's yellow outline until the next step begins. A short
// settle (the whole model pressed home) and the finished model holds.
// PALETTE: real toy-brick colours only (spec 13 rule 9 table): Blue water, Light/Dark Bluish Grey
// quay, Red + Black hull, Reddish Brown deck, White superstructure, Yellow funnel, Medium Azure
// glass, Orange crates. BACKDROP: one flat studio colour.
// LIGHT: one key light from the upper left, a little in front: +Z faces lit, +X faces in shade,
// ground shadows thrown back and right.
// SUBJECT + REALISM: a harbour tug (reference, from knowledge: low wide hull with high bow and a
// heavy bow fender, tall wheelhouse forward of midships with windows all round, a squat funnel
// aft of it, towing bitts on the long low aft deck, a mast with a light), moored off a stone quay
// with bollards, a lamp and cargo crates. Look-alike parts, no buildability claim (spec 13-C a).
// NOT ITS NEAREST NEIGHBOUR (fox, cut-paper collage): no torn edge, no lift shadow per piece, no
// hand; the look is manufactured plastic and the process is assembly, not drawing.
import type { Ctx, Env, Layer } from "./core";
import type { Film } from "./film";
import { aabb, BRICK, Cam, drawPart, LIGHT, order, Part, PLATE, shade, STUD, STUD_H } from "./toyBrickKit";

void BRICK;
const C = { blue: "#1E5AA8", lbg: "#969696", dbg: "#646464", red: "#B40000", black: "#1B2A34", white: "#F4F4F4", yellow: "#FAC80A", brown: "#5F3109", azure: "#68C3E2", orange: "#D67923", tan: "#D7BA8C" };
const BACKDROP = "#E7E4DE", OUTLINE = "#FAC80A";
const N = 540, HOLD = 30, FALL = 10, DROP = 190;           // frames; LDU a part falls from

// ---------------------------------------------------------------- the model, in build order
const model = (): Part[] => {
  const P: Part[] = []; let step = 0;
  const rect = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const add = (foot: [number, number][], y0: number, h: number, color: string, studs = true, kind: Part["kind"] = "prism") => P.push({ id: P.length, color, kind, foot, y0, h, studs, step });
  const next = () => step++;
  // a rectangular course split into 2-wide rows of bricks, lengths staggered per course (running bond)
  const course = (x0: number, z0: number, x1: number, z1: number, y0: number, h: number, color: string, lens: number[], shift: number) => {
    for (let z = z0, r = 0; z < z1; z += 2, r++) { let x = x0; const L = [...lens.slice((r + shift) % lens.length), ...lens.slice(0, (r + shift) % lens.length)]; for (const l of L) { if (x >= x1) break; const e = Math.min(x1, x + l); add(rect(x, z, e, Math.min(z1, z + 2)), y0, h, color); x = e; } }
  };
  // 1: the baseplate
  add(rect(0, 0, 24, 18), -0.4, 0.4, C.blue); next();
  // 2-3: the quay, two courses, then its coping and a paved top
  course(0, 0, 24, 4, 0, 3, C.lbg, [6, 4, 8, 6], 0); next();
  course(0, 0, 24, 4, 3, 3, C.lbg, [4, 8, 6, 6], 1); next();
  for (let x = 0; x < 24; x += 6) add(rect(x, 0, x + 6, 3), 6, 1, C.lbg);
  for (let x = 0; x < 24; x += 8) add(rect(x, 3, x + 8, 4), 6, 1, C.dbg, false); next();
  // 4-6: the hull, three courses; the bow is a wedge, black as the tug's bow fender from course 2
  const bow: [number, number][] = [[17, 8], [20, 10.5], [20, 11.5], [17, 14]];
  course(4, 8, 17, 14, 0, 3, C.black, [4, 4, 3, 2], 0); add(bow, 0, 3, C.black); next();
  course(4, 8, 17, 14, 3, 3, C.red, [2, 4, 4, 3], 1); add(bow, 3, 3, C.black); next();
  course(4, 8, 17, 14, 6, 3, C.red, [3, 2, 4, 4], 2); add(bow, 6, 3, C.black); next();
  // 7: the deck: a black rubbing strake round the edge, reddish-brown planking inside
  add(rect(4, 8, 17, 9), 9, 1, C.black); add(rect(4, 9, 5, 14), 9, 1, C.black); add(rect(5, 13, 17, 14), 9, 1, C.black); add(bow, 9, 1, C.black);
  add(rect(5, 9, 11, 13), 9, 1, C.brown); add(rect(11, 9, 17, 13), 9, 1, C.brown); next();
  // 8-9: the deckhouse aft of midships, then the funnel on it
  add(rect(7, 9, 11, 11), 10, 3, C.white); add(rect(7, 11, 11, 13), 10, 3, C.white);
  add(rect(7, 9, 9, 13), 13, 3, C.white); add(rect(9, 9, 11, 13), 13, 3, C.white); next();
  add(rect(8, 10, 10, 12), 16, 3, C.yellow); add(rect(8, 10, 10, 12), 19, 3, C.yellow); add(rect(8, 10, 10, 12), 22, 1, C.black); next();
  // 10-11: the wheelhouse, two courses, then the window course with glass on the two faces we see
  add(rect(11, 9, 15, 11), 10, 3, C.white); add(rect(11, 11, 15, 13), 10, 3, C.white);
  add(rect(11, 9, 13, 13), 13, 3, C.white); add(rect(13, 9, 15, 13), 13, 3, C.white); next();
  add(rect(11, 9, 12, 10), 16, 3, C.white); add(rect(12, 9, 14, 10), 16, 3, C.white); add(rect(14, 9, 15, 10), 16, 3, C.white);
  add(rect(11, 10, 12, 12), 16, 3, C.white); add(rect(12, 10, 14, 12), 16, 3, C.white);
  add(rect(14, 10, 15, 12), 16, 3, C.azure); add(rect(11, 12, 12, 13), 16, 3, C.white); add(rect(12, 12, 14, 13), 16, 3, C.azure); add(rect(14, 12, 15, 13), 16, 3, C.white); next();
  // 12: roof with overhang, mast, searchlight
  add(rect(10, 8, 15, 13), 19, 1, C.dbg); next();                        // roof, overhanging aft and to port only
  add(rect(12, 10, 13, 11), 20, 3, C.lbg, false, "round"); add(rect(12, 10, 13, 11), 23, 3, C.lbg, false, "round"); add(rect(12, 10, 13, 11), 26, 3, C.lbg, false, "round"); add(rect(12, 10, 13, 11), 29, 1, C.red, true, "round");
  add(rect(13, 11, 14, 12), 20, 1, C.yellow, true, "round"); next();
  // 13: towing bitts aft, a bollard on the foredeck
  add(rect(5, 9, 6, 10), 10, 3, C.dbg, true, "round"); add(rect(5, 12, 6, 13), 10, 3, C.dbg, true, "round"); add(rect(17, 10, 18, 11), 10, 2, C.black, true, "round"); next();
  // 14: the quay furniture: bollards, the harbour lamp, crates
  add(rect(6, 2, 7, 3), 7, 2, C.black, true, "round"); add(rect(15, 2, 16, 3), 7, 2, C.black, true, "round");
  add(rect(16, 0, 18, 2), 7, 3, C.orange); add(rect(18, 0, 20, 2), 7, 3, C.brown); add(rect(17, 0, 19, 2), 10, 3, C.orange);
  add(rect(21, 1, 22, 2), 7, 3, C.dbg, false, "round"); add(rect(21, 1, 22, 2), 10, 3, C.dbg, false, "round"); add(rect(21, 1, 22, 2), 13, 3, C.dbg, false, "round"); add(rect(21, 1, 22, 2), 16, 2, C.yellow, true, "round"); next();
  // 15: the water: a bow wave and the wake, flat tiles on the baseplate
  add(rect(20, 9, 22, 10), 0, 1, C.white, false); add(rect(20, 12, 22, 13), 0, 1, C.white, false); add(rect(21, 10, 22, 12), 0, 1, C.azure, false);
  add(rect(1, 10, 3, 12), 0, 1, C.white, false); add(rect(0, 9, 2, 10), 0, 1, C.azure, false); add(rect(0, 12, 2, 13), 0, 1, C.azure, false);
  return P;
};

// ---------------------------------------------------------------- schedule: one cue table
// Each step starts on a beat; its parts land on the 5-frame event grid, one or two per slot.
type Sched = { land: number[]; stepStart: number[]; stepEnd: number[]; settle: number };
const schedule = (P: Part[]): Sched => {
  const land = new Array(P.length).fill(0), steps = Math.max(...P.map((p) => p.step)) + 1, stepStart: number[] = [], stepEnd: number[] = [];
  land[0] = 20; stepStart[0] = 0; stepEnd[0] = 20; let t = 20;
  for (let s = 1; s < steps; s++) {
    // a step starts on a beat; its parts seat in at most four 5-frame slots, so a step is two beats
    const ids = P.filter((p) => p.step === s).map((p) => p.id), per = Math.ceil(ids.length / 4);
    const start = Math.ceil((t + 5) / 15) * 15; stepStart[s] = start;
    ids.forEach((id, k) => (land[id] = start + FALL + 5 * Math.floor(k / per)));
    t = Math.max(...ids.map((id) => land[id])); stepEnd[s] = t;
  }
  return { land, stepStart, stepEnd, settle: Math.ceil((t + 5) / 5) * 5 };
};

// ---------------------------------------------------------------- render
const build = (env: Env) => {
  let v = env.cache.get("toyBrick/build") as { P: Part[]; S: Sched; fit: [number, number, number] } | undefined;
  if (!v) {
    const P = model(), S = schedule(P);
    // fit the finished model into the frame (pure: from geometry only)
    const probe = new Cam(1, 0, 0); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    P.forEach((p) => { const b = aabb(p); for (const X of [b.x0, b.x1]) for (const Y of [b.y0, b.y1]) for (const Z of [b.z0, b.z1]) { const q = probe.p(X, Y, Z); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); } });
    const s = Math.min((env.W * 0.86) / (x1 - x0), (env.H * 0.8) / (y1 - y0));
    v = { P, S, fit: [s, env.W / 2 - ((x0 + x1) / 2) * s, env.H / 2 - ((y0 + y1) / 2) * s + env.H * 0.02] };
    env.cache.set("toyBrick/build", v);
  }
  return v;
};
const layer = (env: Env, key: string): Layer => { let L = env.cache.get(key) as Layer | undefined; if (!L) { L = env.canvas(Math.round(env.W * env.scale), Math.round(env.H * env.scale)); env.cache.set(key, L); } return L; };
const HAIR = 0.7;

// the soft shadow of a set of parts on the baseplate (Y = 0): each part's box swept along the
// light onto the plane, filled small and drawn back up (the only blur, and no filter)
const shadowOf = (c: Ctx, cam: Cam, parts: { p: Part; dy: number }[], k: number) => {
  const sx = -LIGHT[0] / LIGHT[1], sz = -LIGHT[2] / LIGHT[1];
  c.fillStyle = "#000";
  parts.forEach(({ p, dy }) => {
    const b = aabb(p, dy); if (b.y0 < -0.5) return; const pts: [number, number][] = [];
    for (const Y of [b.y0, b.y1 - (p.studs ? STUD_H : 0)]) for (const X of [b.x0, b.x1]) for (const Z of [b.z0, b.z1]) { const q = cam.p(X + sx * Y, 0, Z + sz * Y); pts.push([q[0] * k, q[1] * k]); }
    const h = hull(pts); c.beginPath(); h.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
  });
};
const hull = (pts: [number, number][]) => {
  const q = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], up: [number, number][] = [];
  for (const p of q) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = q.length - 1; i >= 0; i--) { const p = q[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
};

const drawFrame = (ctx: Ctx, fr: number, env: Env) => {
  const { P, S, fit } = build(env), f = fr >= N - HOLD ? N - 1 : fr, sc = env.scale, W = Math.round(env.W * sc), H = Math.round(env.H * sc);
  const cam = new Cam(fit[0], fit[1], fit[2]);
  // the settle: the whole model pressed home, 1 LDU down and back, after the last part seats
  const settle = f >= S.settle && f < S.settle + 6 ? [0, 0.6, 1, 1, 0.6, 0.25][f - S.settle] : 0;
  const state = P.map((p) => { const L = S.land[p.id]; if (f < L - FALL) return null; if (f >= L) return { p, dy: (f === L ? -0.5 : 0) - (p.id > 0 ? settle : 0), moving: false, t: 1 };
    const t = (f - (L - FALL)) / FALL, e = 1 - (1 - t) ** 3; return { p, dy: DROP * (1 - e) * (p.id === 0 ? 2 : 1), moving: true, t }; });
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = BACKDROP; ctx.fillRect(0, 0, W, H);
  // the settle moves the finished model rigidly: two cached layers (plate + shadow, parts) and a
  // translate, instead of re-sorting and redrawing every part for six frames
  if (settle > 0) {
    const kb = `${sc}`, done = P.map((p) => ({ p, dy: 0 })), rest = done.filter((s) => s.p.id !== 0);
    let SL = env.cache.get("toyBrick/settle") as { key: string; base: Layer; parts: Layer } | undefined;
    if (!SL || SL.key !== kb) {
      const base = env.canvas(W, H), parts = env.canvas(W, H); base.ctx.setTransform(sc, 0, 0, sc, 0, 0); parts.ctx.setTransform(sc, 0, 0, sc, 0, 0);
      paintBase(base.ctx, env, cam, P[0], 0); paintShadow(base.ctx, env, cam, rest, 0.34);
      order(rest, cam).forEach((i) => drawPart(parts.ctx, cam, rest[i].p, 0, HAIR));
      SL = { key: kb, base, parts }; env.cache.set("toyBrick/settle", SL);
    }
    ctx.drawImage(SL.base.canvas, 0, 0); ctx.drawImage(SL.parts.canvas, 0, settle * 0.86603 * cam.s * sc); return;
  }
  const live = state.filter((s): s is NonNullable<typeof s> => !!s);
  if (!live.length) return;
  // settled = landed and not in its seating frame and not pressed; those are cacheable
  const stat = live.filter((s) => !s.moving && s.dy === 0), key = `${sc}|${stat.map((s) => s.p.id).join(",")}`;
  const base = stat.find((s) => s.p.id === 0);
  // --- the static layer: baseplate shadow on the backdrop, baseplate, parts' ground shadow, parts
  const L = layer(env, "toyBrick/static");
  if (env.cache.get("toyBrick/staticKey") !== key) {
    const c = L.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); c.setTransform(sc, 0, 0, sc, 0, 0);
    if (base) paintBase(c, env, cam, base.p, 0);
    const rest = stat.filter((s) => s.p.id !== 0);
    if (base && rest.length) paintShadow(c, env, cam, rest, 0.34);
    order(rest.map((s) => ({ p: s.p, dy: 0 })), cam).forEach((i) => drawPart(c, cam, rest[i].p, 0, HAIR));
    env.cache.set("toyBrick/staticKey", key);
  }
  ctx.drawImage(L.canvas, 0, 0);
  // --- whatever is moving or seating, then any settled part that stands in front of it
  const dyn = live.filter((s) => s.moving || s.dy !== 0);
  if (!dyn.length) { outline(ctx, sc, cam, live, S, f); return; }
  ctx.setTransform(sc, 0, 0, sc, 0, 0);
  const all = [...stat.filter((s) => s.p.id !== 0), ...dyn.filter((s) => s.p.id !== 0)], ord = order(all.map((s) => ({ p: s.p, dy: s.dy })), cam);
  const baseDyn = dyn.find((s) => s.p.id === 0); if (baseDyn) paintBase(ctx, env, cam, baseDyn.p, baseDyn.dy, baseDyn.moving ? ghost(baseDyn.t) : 1);
  // ground shadows of parts falling onto the baseplate grow and sharpen as they come down
  dyn.forEach((s) => { if (s.p.id === 0 || s.p.y0 > 0 || !base) return; paintShadow(ctx, env, cam, [s], 0.34 * Math.min(1, 0.25 + 0.75 * s.t)); });
  let seen = false;
  const firstDyn = ord.findIndex((i) => all[i].moving || all[i].dy !== 0);
  ord.forEach((i, k) => {
    const s = all[i]; if (k < firstDyn) return;
    if (s.moving || s.dy !== 0) { seen = true; drawGhost(ctx, env, cam, s.p, s.dy, s.moving ? ghost(s.t) : 1); return; }
    if (seen) drawPart(ctx, cam, s.p, 0, HAIR);                  // a settled part in front of something moving
  });
  outline(ctx, sc, cam, live, S, f);
};
const ghost = (t: number) => 0.35 + 0.65 * Math.min(1, t / 0.6);
const drawGhost = (ctx: Ctx, env: Env, cam: Cam, p: Part, dy: number, a: number) => {
  if (a >= 1) { drawPart(ctx, cam, p, dy, HAIR); return; }
  const T = layer(env, "toyBrick/ghost"), c = T.ctx, sc = env.scale; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, T.canvas.width, T.canvas.height); c.setTransform(sc, 0, 0, sc, 0, 0);
  drawPart(c, cam, p, dy, HAIR); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.drawImage(T.canvas, 0, 0); ctx.restore();
};
const paintBase = (c: Ctx, env: Env, cam: Cam, p: Part, dy: number, a = 1) => {
  // the baseplate's own soft shadow on the backdrop, then the plate
  const k = 1 / 6, S = layer(env, "toyBrick/softBase"), sc = env.scale, w = Math.ceil((env.W * sc) * k), h = Math.ceil((env.H * sc) * k);
  const s = S.ctx; s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, w + 2, h + 2); s.setTransform(sc * k, 0, 0, sc * k, 0, 0); s.fillStyle = "#000";
  const b = aabb(p, dy), q = [cam.p(b.x0, b.y0 - 2, b.z0), cam.p(b.x1, b.y0 - 2, b.z0), cam.p(b.x1, b.y0 - 2, b.z1), cam.p(b.x0, b.y0 - 2, b.z1)];
  s.beginPath(); q.forEach(([x, y], i) => (i ? s.lineTo(x + 10, y + 16) : s.moveTo(x + 10, y + 16))); s.closePath(); s.fill();
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.22 * a; c.imageSmoothingEnabled = true; c.drawImage(S.canvas, 0, 0, w, h, 0, 0, w / k, h / k); c.restore();
  const B = env.cache.get("toyBrick/basePix") as { L: Layer; key: string } | undefined, bk = `${sc}`;
  if (dy === 0 && a >= 1) {
    let BL = B; if (!BL || BL.key !== bk) { const Lb = env.canvas(Math.round(env.W * sc), Math.round(env.H * sc)); Lb.ctx.setTransform(sc, 0, 0, sc, 0, 0); drawPart(Lb.ctx, cam, p, 0, HAIR); BL = { L: Lb, key: bk }; env.cache.set("toyBrick/basePix", BL); }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(BL.L.canvas, 0, 0); c.restore();
  } else drawGhost(c, env, cam, p, dy, a);
};
const paintShadow = (c: Ctx, env: Env, cam: Cam, parts: { p: Part; dy: number }[], a: number) => {
  const k = 1 / 5, S = layer(env, "toyBrick/soft"), sc = env.scale, w = Math.ceil(env.W * sc * k), h = Math.ceil(env.H * sc * k), s = S.ctx;
  s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, w + 2, h + 2); s.setTransform(sc * k, 0, 0, sc * k, 0, 0); shadowOf(s, cam, parts, 1);
  // contact darkness: the footprint itself, a second time, a little stronger
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true; c.globalAlpha = a; c.drawImage(S.canvas, 0, 0, w, h, 0, 0, w / k, h / k); c.restore();
};
// booklet grammar: the parts of the step being built carry a yellow outline until the next step
const outline = (ctx: Ctx, sc: number, cam: Cam, live: { p: Part; dy: number; moving: boolean }[], S: Sched, f: number) => {
  let cur = -1; for (let s = 1; s < S.stepStart.length; s++) if (f >= S.stepStart[s]) cur = s;
  if (cur < 1) return; const nextStart = S.stepStart[cur + 1] ?? S.settle; if (f >= nextStart) return;
  ctx.save(); ctx.setTransform(sc, 0, 0, sc, 0, 0); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2; ctx.lineJoin = "round";
  live.forEach(({ p, dy, moving }) => { if (p.step !== cur || moving) return; const b = aabb(p, dy), pts: [number, number][] = []; for (const X of [b.x0, b.x1]) for (const Y of [b.y0, b.y1 - (p.studs ? 0 : 0)]) for (const Z of [b.z0, b.z1]) pts.push(cam.p(X, Y, Z));
    const h = hull(pts); ctx.beginPath(); h.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke(); });
  ctx.restore();
};

export const toyBrick: Film = {
  meta: { title: "Toy brick · the tug", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N, raster: "cpu" },
  assets: { images: {} },
  shots: [{ id: "build", start: 0, end: N, draw: drawFrame }],
};
void PLATE; void STUD; void shade;

export const STYLE = { id: "toyBrick", name: "Toy brick", family: "rendered", medium: "moulded ABS toy bricks, rendered flat-plastic in orthographic view: face tones by the cube rule, bevel highlights, seam hairlines, real studs, a soft ground shadow", nearest: "fox", hero: "a brick-built harbour tugboat on a baseplate" };
export const toyBrickCues = () => schedule(model());
