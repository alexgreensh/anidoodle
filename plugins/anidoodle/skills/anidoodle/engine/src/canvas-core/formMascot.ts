// FORM MASCOT. Bit (storybook plate) keeps a sign-up form company.
//
// The idea in one sentence: filling in a form is lonelier than it should be, so the robot reads
// along, looks away when you type your password, and is genuinely delighted when it works.
//   - focus a text field: he reads your caret, eyes first, head a beat later, with a small nod on
//     every keystroke. The host logs only the LENGTH and caret position of what you type, never
//     the text: a replay log holds no personal data;
//   - focus the password: he shuts his eyes tight and puts both hands up. Tick "show password"
//     (page sets state "peek"): one eye opens and one hand drops, caught peeking;
//   - submit with a problem (state "error"): a worried head-shake, wobbly mouth, dimmed bulb, and
//     he stays worried until you type again;
//   - "busy": the key whirrs and he looks up at his bulb, thinking; "success": the cheer.
// Loop 480 ticks. Targets: name, email, password, reveal, submit.
import type { Env, P } from "./core";
import { blit, usePaper } from "./bake";
import { attend, bakeBit, CHEER, cheer, drawBit2, FACE, idle, LOOP, meadowSprite, restPose, SHEETS, type BitPose } from "./bitRig";
import { clip, lookTarget, reactionSeed, ticksSince, type Discrete, type InputState, type Piece } from "./input";
import { toSheet } from "./bitRig";

const FACE_S = toSheet(FACE);
// covering his eyes while the password field is focused, or while its show/hide toggle is (it was the last field)
const covering = (d: Discrete) => d.state !== "success" && d.state !== "busy" && (d.focus === "password" || (d.focus === "reveal" && (d.since["focus:password"] ?? -1) > Math.max(d.since["focus:name"] ?? -1, d.since["focus:email"] ?? -1)));
const armFor = (d: Discrete, side: number) => (d.state === "success" ? 0 : covering(d) ? (d.state === "peek" && side > 0 ? 0.3 : 0.74) : 0);
const tri = (u: number) => (u < 0.5 ? u * 2 : 2 - u * 2);

export const formMascot: Piece = {
  meta: { title: "Bit, reading along", W: 560, H: 560, loop: LOOP, alt: "A pencil-and-watercolour wind-up robot who reads along as you fill in the form, covers his eyes for your password, and cheers when you sign up." },
  input: {
    springs: {
      look: { omega: 0.3, target: (d) => lookTarget(d, FACE_S) },
      head: { omega: 0.1, target: (d) => lookTarget(d, FACE_S) },
      armL: { omega: 0.18, target: (d) => armFor(d, -1) },
      armR: { omega: 0.18, target: (d) => armFor(d, 1) },
      worry: { omega: 0.12, target: (d) => (d.state === "error" ? 1 : 0) },
    },
  },
  bake: function* (env) { yield "paper"; usePaper(env, SHEETS); yield "meadow"; meadowSprite(env); yield* bakeBit(env); },
  draw: (ctx, t, env, s) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    usePaper(env, SHEETS); /* the sheet is baked into every sprite (bake.ts): no per-frame multiply */
    blit(ctx, meadowSprite(env as Env));
    drawBit2(ctx, env, pose(t, s));
  },
};

export const pose = (t: number, s: InputState): BitPose => {
  const p = restPose(), R = s.reduced, a = s.attention, st = s.state;
  if (!R) { idle(p, t); attend(p, s.spring.look as P, s.spring.head as P); p.armL = s.spring.armL as number; p.armR = s.spring.armR as number; }
  const typing = a ? clip(s, `key:${a}`, 12) : null;
  if (a && a !== "password" && a !== "submit" && a !== "reveal") { p.brows = "up"; if (typing && !R) { p.headOff[1] += 2 * tri(typing.u); p.key += typing.f; } }
  if (a === "submit") { p.mouth = "grin"; p.brows = "up"; p.glow += 0.7; }
  if (covering(s)) {
    p.eyes = "shut"; p.mouth = "flat"; p.brows = "worried"; p.blush = 1; p.look = [0, 0];
    if (st === "peek") { p.eyesR = "open"; p.eyes = "shut"; p.mouth = "o"; p.brows = "up"; }
    if (!R) { p.tilt = -3; p.headOff = [0, 2]; if (typing) p.key += typing.f; }
  }
  // error: a head-shake clip, then a worried face that lasts until the page clears the state
  const w = s.spring.worry as number;
  if (st === "error") {
    p.brows = "worried"; p.mouth = "wobble"; p.glow = Math.max(0.3, p.glow - 0.8 * w); p.blush = 0.5;
    const sh = clip(s, "state:error", 40);
    if (sh && !R) { const f = sh.f, amp = 1 - f / 40; p.headOff = [7 * Math.sin((2 * Math.PI * f) / 13) * amp, 2]; p.tilt = -5 * Math.sin((2 * Math.PI * f) / 13) * amp; p.look = [-4 * Math.sin((2 * Math.PI * f) / 13) * amp, 2]; }
    else if (!R) { p.look = [p.look[0] * 0.5, 3]; p.headOff[1] += 2; }
    if (R && sh) p.faceFade = Math.min(1, sh.f / 8);
  }
  if (st === "busy") {
    p.brows = "up"; p.mouth = "o";
    if (!R) { p.look = [2, -4]; p.headOff = [0, -1]; p.key += 2 * ticksSince(s, "state:busy"); p.glow = 1.4 + 0.6 * Math.sin((2 * Math.PI * t) / 20); }
  }
  if (st === "success") {
    const ch = clip(s, "state:success", CHEER);
    if (ch) { cheer(p, ch.f, reactionSeed(s, "state:success"), R); if (R) p.faceFade = Math.min(1, ch.f / 8); }
    else { p.eyes = "happy"; p.mouth = "smile"; p.blush = 1; p.heart = tri((t % 40) / 40); if (!R) p.glow += 0.5; }
  }
  return p;
};
