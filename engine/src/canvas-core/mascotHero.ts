// MASCOT HERO. Bit (storybook plate) in his meadow on a landing-page hero, watching the visitor.
//
// The idea in one sentence: the little wind-up robot is the page's most attentive reader, so he
// looks where you look and gets visibly excited about the button you are about to press.
//   - his eyes follow the pointer anywhere on the page; his head follows a beat later (eyes lead);
//   - hover or TAB to a bound button: he turns to it, lifts the near arm to present it, brows up,
//     antenna bulb brightens (every hover reaction has a keyboard-focus equivalent);
//   - press: he winds up (a crouch, eyes wide); click "start": he jumps and cheers with pencil
//     twinkles; click "tour": he waves hello; poke Bit himself: he giggles;
//   - untouched, he breathes, blinks, his key turns and his pencil line boils: never a dead second.
// Loop: 480 ticks (8 s). Every idle motion's period divides it.
import type { Env, P } from "./core";
import { blit, usePaper } from "./bake";
import { attend, bakeBit, CHEER, cheer, drawBit2, FACE, idle, LOOP, meadowSprite, restPose, SHEETS, toSheet, type BitPose } from "./bitRig";
import { attentionOf, centre, clip, reactionSeed, type Discrete, type InputState, type Piece } from "./input";

const FACE_S = toSheet(FACE);
const SHOULDER_S = (side: number) => toSheet([side * 50, -114]);
// the lift that points an arm at a target, or 0 if the target is on the other side
const pointLift = (d: Discrete, side: number): number => {
  const a = attentionOf(d); if (!a || a === "self" || !d.rects[a]) return 0;
  const c = centre(d.rects[a]), sh = SHOULDER_S(side);
  if ((c[0] - sh[0]) * side <= 0) return 0;
  const phi = (Math.atan2(c[1] - sh[1], (c[0] - sh[0]) * side) * 180) / Math.PI; // angle in the right arm's frame
  return Math.max(0.2, Math.min(0.6, (62 - phi) / 177));
};

export const mascotHero: Piece = {
  meta: { title: "Bit, watching", W: 560, H: 560, loop: LOOP, alt: "A pencil-and-watercolour wind-up robot in a meadow, who watches your pointer and cheers when you press Get started." },
  input: {
    springs: {
      look: { omega: 0.3, target: (d) => lookAt(d) },                 // eyes: quick
      head: { omega: 0.11, target: (d) => lookAt(d) },                // head: a beat behind the eyes
      armL: { omega: 0.16, target: (d) => pointLift(d, -1) },
      armR: { omega: 0.16, target: (d) => pointLift(d, 1) },
      excite: { omega: 0.09, target: (d) => { const a = attentionOf(d); return a && a !== "self" ? 1 : 0; } },
    },
  },
  bake: function* (env) { yield "paper"; usePaper(env, SHEETS); yield "meadow"; bg(env); yield* bakeBit(env); },
  draw: (ctx, t, env, s) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    usePaper(env, SHEETS); /* the sheet is baked into every sprite (bake.ts): no per-frame multiply */
    blit(ctx, bg(env));
    drawBit2(ctx, env, pose(t, s));
  },
};

const lookAt = (d: Discrete): P => { const a = attentionOf(d); if (a && a !== "self" && d.rects[a]) return centre(d.rects[a]); return d.pointer ?? FACE_S; };
const bg = (env: Env) => meadowSprite(env);
const tri = (u: number) => (u < 0.5 ? u * 2 : 2 - u * 2);

export const pose = (t: number, s: InputState): BitPose => {
  const p = restPose(), R = s.reduced;
  if (!R) { idle(p, t); attend(p, s.spring.look as P, s.spring.head as P); p.armL = s.spring.armL as number; p.armR = s.spring.armR as number; }
  const ex = s.spring.excite as number, a = s.attention;
  p.glow += ex * 0.9;
  if (a && a !== "self") { p.brows = "up"; p.mouth = a === "start" ? "grin" : "smile"; if (a === "tour" && !R) p.tilt += 5 * ex; }
  if (s.pressed && s.pressed !== "self") { p.mouth = "o"; p.brows = "up"; if (!R) p.squash = 0.965; }
  // reactions: fixed-length clips on the grid, restarted by each new click
  const ch = clip(s, "click:start", CHEER), wave = clip(s, "click:tour", 64), poke = clip(s, "click:self", 48);
  if (ch) cheer(p, ch.f, reactionSeed(s, "click:start"), R);
  else if (wave) {
    const f = wave.f; p.eyes = "happy"; p.mouth = "smile"; p.brows = "up"; p.blush = 1;
    if (!R) { p.armR = 0.56 + 0.09 * Math.sin((2 * Math.PI * f) / 16); p.tilt = 7 * Math.sin((Math.PI * f) / 64); p.look = [2, -1]; }
  } else if (poke) {
    const f = poke.f; p.eyes = "squint"; p.mouth = "grin"; p.blush = 1; p.heart = tri((f % 16) / 16);
    if (!R) { p.tilt = 6 * Math.sin((2 * Math.PI * f) / 12) * (1 - f / 48); p.squash = 1 - 0.03 * tri((f % 12) / 12); p.key += Math.floor(f / 2); }
  }
  if (R && (ch || wave || poke)) { const c = (ch ?? wave ?? poke)!, len = ch ? CHEER : wave ? 64 : 48; p.faceFade = Math.min(1, c.f / 8, (len - c.f) / 8); }
  return p;
};
