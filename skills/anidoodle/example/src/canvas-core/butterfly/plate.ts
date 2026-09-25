// THE COMPOSER. Draws PLATE I for one state, part by part, each part on its own surface so a
// part that did not change is not redrawn (spec 6.3). A cache entry's key names everything its
// pixels depend on, which is why caching stays inside the pure-function contract: a cold frame
// and a cached frame of the same number are the same pixels.
import { Ctx, Env, Gfx, Layer, Medium } from "../core";
import { FW, FW_H, FW_T, HW, HW_H, HW_T, Pose, REST, Wing, posed, wingGeom } from "./geom";
import { DRAFT, Kit, kit } from "./kit";
import { IDLE, Train, abdomen, bodyMask, border, bubble, cartouche, construction, detailPlate, detailTrain, drawWing, dust, furniture, grid, key, partsList, scaleBar, sectionAA, sheet, thoraxShell, thoraxTrain, tooth } from "./parts";

// How much of each part is on the sheet. 0 = the draftsman has not started it, 1 = finished.
export type Parts = { grid: number; border: number; construct: number; shell: number; head: number; window: number; detail: number; detailPlate: number; detailNotes: number; bubble: number; wing: [number, number, number, number]; skin: [number, number, number, number]; abdomen: number; axis: number; key: number; note: number; furniture: number; section: number; scale: number; list: number; cartouche: number; lettering: number };
export const FULL: Parts = { grid: 1, border: 1, construct: 0, shell: 1, head: 1, window: 1, detail: 1, detailPlate: 1, detailNotes: 1, bubble: 1, wing: [1, 1, 1, 1], skin: [1, 1, 1, 1], abdomen: 1, axis: 1, key: 1, note: 1, furniture: 1, section: 1, scale: 1, list: 1, cartouche: 1, lettering: 1 };
export const EMPTY: Parts = { grid: 0, border: 0, construct: 0, shell: 0, head: 0, window: 0, detail: 0, detailPlate: 0, detailNotes: 0, bubble: 0, wing: [0, 0, 0, 0], skin: [0, 0, 0, 0], abdomen: 0, axis: 0, key: 0, note: 0, furniture: 0, section: 0, scale: 0, list: 0, cartouche: 0, lettering: 0 };

// `boil` is the hero linework's breath. `inkedBoil` is the breath of everything the draftsman has
// ALREADY inked: the sheet, the grid, the border, the furniture, the cartouche. At the desk that is
// 0, because finished furniture is dead still (spec 4); once the drawing comes alive the whole sheet
// breathes with it. It is a field rather than a constant because the two moments want opposite
// answers, and a field is the only way a cache KEY can name it.
export type PlateState = { wings: Pose; lift: number; keyY: number; keyTurn: number; train: Train; shadow: [number, number]; boil: number; inkedBoil: number; boilIndex: number; p: Parts; view: View };
export const PLATE_REST: PlateState = { wings: REST, lift: 1, keyY: 0, keyTurn: 0, train: IDLE, shadow: [0, 0], boil: 0, inkedBoil: 0, boilIndex: 0, p: FULL, view: WIDE };
const SHADOW = "#061a30";
import { View, WIDE, blit as blitL, kk, part as partL, slotOf } from "./surface";
// A close shot must not fatten the line. The canvas transform multiplies width by the zoom, so
// the nib is divided back out and re-multiplied by zoom^0.35: a 3.3x push gets a line about
// 1.5x heavier, which is what a draftsman's pen looks like magnified (spec 6.4).
const nibFor = (z: number): Medium => (z === 1 ? DRAFT : { ...DRAFT, nib: (DRAFT.nib * Math.pow(z, 0.35)) / z });
const blit = (ctx: Ctx, L: Layer | null, dx = 0, dy = 0, alpha = 1) => blitL(ctx, L, dx, dy, alpha);

export const drawPlate = (ctx: Ctx, env: Env, s: PlateState) => {
  const W = env.W, H = env.H, dw = Math.round(W * env.scale), dh = Math.round(H * env.scale), p = s.p;
  // A surface drawn at some boil carries that boil in its PIXELS, so it must carry it in its KEY, or a
  // later frame at a different boil silently reuses the slot and the film stops being a function of the
  // frame number alone. Kit, boil frame and key term are all derived from the one number, together.
  const bfOf = (boil: number) => (boil > 0 ? s.boilIndex * 4 : 0);
  const keyOf = (boil: number) => kk(boil, boil > 0 ? s.boilIndex : 0);
  const bf = bfOf(s.boil), K = (g: Gfx, tint?: string) => kit(g, { boil: s.boil, tint });
  // The already-inked parts hold ONE boil phase rather than cycling: a sheet that has been drawn on
  // settles, it does not flutter. So their boil frame is always 0 and their key needs only the amount.
  const bf0 = 0, K0 = (g: Gfx, tint?: string) => kit(g, { boil: s.inkedBoil, tint });
  const v = s.view, vk = kk(v.cx, v.cy, v.zoom), med = nibFor(v.zoom);
  const part = (name: string, key: string, boilFrame: number, fn: (g: Gfx) => void): Layer => partL(env, med, name, key + "|" + vk, boilFrame, fn, v);
  const live = (name: string, key: string, fn: (g: Gfx) => void): Layer => part(name, key + "|" + b, bf, fn);    /* draws with K,  breathes */
  const still = (name: string, key: string, fn: (g: Gfx) => void): Layer => part(name, key + "|" + b0, bf0, fn); /* draws with K0, already inked */
  const b = keyOf(s.boil), b0 = kk(s.inkedBoil), t = kk(s.train.centre, s.train.escape, s.train.fork);
  const wings = (pose: Pose): Wing[] => [wingGeom(-1, HW, HW_H, HW_T, 2000, pose), wingGeom(1, HW, HW_H, HW_T, 2600, pose), wingGeom(-1, FW, FW_H, FW_T, 1000, pose), wingGeom(1, FW, FW_H, FW_T, 1600, pose)];
  const w = wings(s.wings), wr = posed(s.wings) ? wings(REST) : w, rest = { LH: wr[0], RH: wr[1], LF: wr[2], RF: wr[3] }; /* the furniture was inked on the resting drawing and stays where it was put */
  const on = (v: number) => v > 0;

  const drawWings = (g: Gfx, tint?: string) => {
    const k = K(g, tint);
    k.ink(() => { drawWing(k, w[0], -1, 2000, { skin: true, line: p.wing[0], skinP: p.skin[0] }); drawWing(k, w[1], 1, 2600, { skin: false, line: p.wing[1], skinP: p.skin[1] }); });
    k.ink(() => { drawWing(k, w[2], -1, 1000, { skin: true, line: p.wing[2], skinP: p.skin[2] }); drawWing(k, w[3], 1, 1600, { skin: true, lift: 2, liftT: s.lift, line: p.wing[3], skinP: p.skin[3] }); });
  };
  const anyWing = p.wing.some(on) || p.skin.some(on);

  const back = still("back", kk("back", p.grid, p.border), (g) => { const k = K0(g); sheet(k, W, H); grid(k, W, H, p.grid); border(k, W, H, p.border); });
  const constructL = on(p.construct) ? still("construct", kk(p.construct), (g) => construction(K0(g), { LF: rest.LF, RF: rest.RF, LH: rest.LH, RH: rest.RH }, p.construct)) : null;
  const wingL = anyWing ? live("wings", kk("w", p.wing.join(","), p.skin.join(","), s.lift, s.wings.flap, s.wings.sweep), drawWings) : null;
  const bodyL = on(p.abdomen) || on(p.shell) ? live("body", kk(p.abdomen, p.shell > 0 ? 1 : 0), (g) => { const k = K(g); bodyMask(k, on(p.shell)); abdomen(k, p.abdomen); }) : null;
  const shellL = on(p.shell) || on(p.head) ? live("shell", kk(p.shell, p.head), (g) => thoraxShell(K(g), { shell: p.shell, head: p.head })) : null;
  const windowL = on(p.window) ? live("window", kk(p.window, t), (g) => thoraxTrain(K(g), s.train, p.window)) : null;
  const keyL = on(p.axis) || on(p.key) || on(p.note) ? live("key", kk(p.axis, p.key, p.note, s.keyY, s.keyTurn), (g) => key(K(g), { y: s.keyY, turn: s.keyTurn, axis: p.axis, body: p.key, note: p.note })) : null;
  const frontOn = on(p.furniture) || on(p.section) || on(p.scale) || on(p.list) || on(p.cartouche) || on(p.lettering);
  const front = still("front", kk("f", p.furniture, p.section, p.scale, p.list, p.cartouche, p.lettering), (g) => { const k = K0(g); if (frontOn) { furniture(k, rest, p.furniture); sectionAA(k, p.section); scaleBar(k, p.scale); partsList(k, p.list); cartouche(k, p.cartouche, p.lettering); } dust(k, W, H); });
  const bubbleL = on(p.bubble) ? still("bubble", kk(p.bubble), (g) => bubble(K0(g), p.bubble)) : null;
  const detailL = on(p.detail) ? live("detail", kk(p.detail, t), (g) => detailTrain(K(g), s.train, p.detail)) : null;
  const detailFurn = on(p.detailPlate) ? still("detailPlate", kk(p.detailPlate, p.detailNotes), (g) => detailPlate(K0(g), p.detailPlate, p.detailNotes)) : null;

  blit(ctx, back); blit(ctx, constructL);
  if (s.shadow[0] || s.shadow[1]) { /* the drawing lifts off its own paper: one flat copy of the hero linework, offset */
    const sh = slotOf(env, "shadow", dw, dh).L, c = sh.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, dw, dh);
    [wingL, bodyL, shellL, windowL, keyL].forEach((L) => L && c.drawImage(L.canvas as CanvasImageSource, 0, 0));
    c.globalCompositeOperation = "source-in"; c.fillStyle = SHADOW; c.fillRect(0, 0, dw, dh); c.globalCompositeOperation = "source-over";
    blit(ctx, sh, Math.round(s.shadow[0] * env.scale), Math.round(s.shadow[1] * env.scale), 0.7);
  }
  [wingL, bodyL, shellL, windowL, keyL, bubbleL, front, detailL, detailFurn].forEach((L) => blit(ctx, L));
  tooth(kit(new Gfx(ctx, env, 0, DRAFT))); /* the sheet's tooth is on the FRAME, so it neither swims nor blows up when the camera moves */
};

// The approved plate: every part finished, nothing running. Frame 0 of the motion test is this.
export const drawStill = (ctx: Ctx, _frame: number, env: Env) => drawPlate(ctx, env, PLATE_REST);
