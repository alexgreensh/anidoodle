// MOTION KIT AND ONE-WORLD TESTS. motionKit.ts, world.ts and timeRemap's named units are arithmetic,
// so their claims (no item repeats its neighbour's side, scrolls never snap, a world camera travels
// between regions and never jumps, a key's unit is always named) are held to numbers here.
//   node tools/test.mjs motionKit
import { alternate, chatScroll, sharp, cubicBezier, entryFrom, landSquash, motionTokens, temperament, typeExit } from "../src/canvas-core/motionKit";
import { fitZoom, minTravel, world } from "../src/canvas-core/world";
import { timeRemap } from "../src/canvas-core/timeRemap";
import { speedCeiling } from "../src/canvas-core/seams";

export const name = "motionKit";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
  const throws = (fn: () => unknown, re?: RegExp) => { try { fn(); return false; } catch (e) { return re ? re.test(String(e)) : true; } };

  // alternate (M2)
  for (const n of [2, 3, 4, 5, 6, 8]) {
    const ch = Array.from({ length: n }, (_, i) => i), seq = Array.from({ length: 3 * n }, (_, i) => alternate(i, ch));
    ok(seq.every((v, i) => i === 0 || v !== seq[i - 1]) && new Set(seq.slice(0, n)).size === n, `alternate over ${n} choices: never the same twice running, every choice used once per round (${seq.slice(0, n).join(",")})`);
  }
  ok(throws(() => alternate(0, ["left"]), /carousel/), "RED: one choice is refused (it is the carousel)");
  const ent = Array.from({ length: 4 }, (_, i) => entryFrom(i)); ok(new Set(ent).size === 4 && ent[0] === "left", `entryFrom walks all four directions, never two alike in a row (${ent.join(", ")})`);

  // chatScroll (M11)
  const steps = [{ f: 10, by: 100 }];
  const ys = Array.from({ length: 40 }, (_, f) => chatScroll(f, steps));
  const maxStep = Math.max(...ys.slice(1).map((y, i) => y - ys[i]));
  ok(near(ys[39], 100) && ys[9] === 0 && maxStep < 16, `GREEN: a 100 px scroll over 20 frames moves at most ${maxStep.toFixed(1)} px a frame (the film snapped 100 px in 2-3 frames)`);
  ok(throws(() => chatScroll(0, steps, { frames: 3 }), /snap/), "RED: a 3-frame scroll is refused");

  // temperament (M7)
  const calm = temperament("calm");
  ok(near(calm.pxPerFrame(1920, 30), 0.35 * speedCeiling(1920, 30)) && calm.settleFrames(30)[0] === 15, "calm: top speed is 35 % of the ceiling, settles in 0.5-1 s");
  ok(Math.max(...Array.from({ length: 101 }, (_, i) => calm.arrive(i / 100))) <= 1 + 1e-9, "calm arrivals never overshoot");
  ok(Math.max(...Array.from({ length: 101 }, (_, i) => temperament("lively").arrive(i / 100))) > 1.01, "lively arrivals pass their mark a little");
  ok(throws(() => temperament("violent")), "an unknown temperament is refused, with the list");

  // brand motion tokens (M13): Figma's hourglass turn, cubic-bezier(0.5, 0, 0.5, 1) over 2 s
  const turn = cubicBezier(0.5, 0, 0.5, 1);
  ok(near(turn(0.5), 0.5, 1e-6) && turn(0.1) < 0.05 && turn(0.9) > 0.95, "cubic-bezier(0.5,0,0.5,1) is a symmetric in-out");
  const ease = cubicBezier(0.25, 0.1, 0.25, 1); ok(near(ease(0.5), 0.8024, 2e-3), `CSS 'ease' at 0.5 is about 0.802 (${ease(0.5).toFixed(4)})`);
  const tok = motionTokens({ turn: { ease: [0.5, 0, 0.5, 1], ms: 2000 }, slideIn: { ease: [0, 0, 0.58, 1], ms: 500, distance: 200 } }, 60);
  ok(tok.turn.frames === 120 && tok.slideIn.frames === 30 && tok.slideIn.distance === 200, "motion tokens become frame counts at the film's fps");

  // type exit (T5)
  ok(typeExit(0) === 0 && near(typeExit(1), 1.3) && typeExit(0.5) < 0.65 * 0.5, "typeExit: ease-in, 1.3x the size at the end");

  // the blur mask's tag: sharp() draws normally, and is left out while the renderer draws blurred subframes
  { const g = globalThis as { __ANIDOODLE_SHARP__?: string }; let n = 0; sharp(() => n++); g.__ANIDOODLE_SHARP__ = "skip"; sharp(() => n++); delete g.__ANIDOODLE_SHARP__; sharp(() => n++); ok(n === 2, "sharp() draws, except while the blur's subframes are drawn"); }

  // landings (M8, M9)
  const sq = landSquash(100, 100); ok(sq[1] < 1 && near(sq[0] * sq[1] * sq[0], sq[0] * sq[0] * sq[1]) && near(sq[0] * Math.sqrt(sq[1]), 1), "landSquash keeps volume (sx = 1 / sqrt(sy)) and squashes on contact");
  ok(landSquash(130, 100)[1] === 1, "round again after the landing");
  ok(throws(() => landSquash(100, 100, { brand: true }), /redraw/) && !throws(() => landSquash(100, 100, { brand: true, gag: "crushed by the chat window" })), "RED: a brand mark refuses the squash unless the gag is named");

  // one world (M1, C6, D4)
  const w = world({ W: 1920, H: 1080, regions: [{ id: "chat", rect: [0, 0, 1920, 1080] }, { id: "crowd", rect: [2400, 0, 3840, 2160] }], stops: [{ f: 0, at: "chat", hold: 30 }, { f: 90, at: "crowd", hold: 30 }] });
  ok(near(w.cam(0).zoom, fitZoom([0, 0, 1920, 1080], 1920, 1080)) && near(w.cam(10).look[0], 960), "a stop frames its region: centred, fitted with padding");
  ok(near(w.cam(120).look[0], 2400 + 1920) && w.cam(120).zoom < w.cam(0).zoom, "the second stop frames the bigger region further out");
  const xs = Array.from({ length: 121 }, (_, f) => w.cam(f).look[0]), steps2 = xs.slice(1).map((x, i) => x - xs[i]);
  ok(steps2.every((d) => d >= -1e-9) && Math.max(...steps2) < 200, `the camera travels between regions on every frame of the move (largest step ${Math.max(...steps2).toFixed(1)} world units), never jumps`);
  { const n = minTravel(600, 20), mv = world({ W: 1920, H: 1080, regions: [{ id: "a", rect: [0, 0, 1920, 1080] }, { id: "b", rect: [600 / fitZoom([0, 0, 1920, 1080], 1920, 1080), 0, 1920, 1080] }], stops: [{ f: 0, at: "a" }, { f: n, at: "b" }] }), xs2 = Array.from({ length: n + 1 }, (_, f) => mv.toScreen([0, 0], f)[0]);
    ok(Math.max(...xs2.slice(1).map((x, i) => Math.abs(x - xs2[i]))) <= 20.0001, `minTravel(600 px, 20 px a frame) = ${n} frames keeps the move's peak under 20 px a frame`); }
  ok(w.regionAt(5)?.id === "chat" && w.regionAt(120)?.id === "crowd", "regionAt names the region on screen");
  ok(w.moves().length === 1 && w.moves()[0].from === 30 && w.moves()[0].to === 90, "moves() lists the seams, each one a camera move");
  ok(throws(() => world({ W: 1920, H: 1080, regions: [{ id: "a", rect: [0, 0, 10, 10] }, { id: "b", rect: [20, 0, 10, 10] }], stops: [{ f: 0, at: "a", hold: 30 }, { f: 30, at: "b" }] }), /slide cut/), "RED: a stop with no frames to travel (a jump between regions) is refused");
  const tall = world({ W: 1080, H: 1920, shape: "9x16", regions: (s) => [{ id: "chat", rect: s.W < s.H ? [0, 0, 1080, 1920] : [0, 0, 1920, 1080] }], stops: [{ f: 0, at: "chat" }] });
  ok(near(tall.cam(0).look[1], 960), "regions as a function of the shape re-compose the world for 9:16");
  const alive = world({ W: 1920, H: 1080, regions: [{ id: "a", rect: [0, 0, 1920, 1080] }], stops: [{ f: 0, at: "a" }], alive: { amp: 3, seed: 2 } });
  const drift = Array.from({ length: 60 }, (_, f) => alive.cam(f).look[0]);
  ok(Math.max(...drift) - Math.min(...drift) > 0.5 && Math.max(...drift.slice(1).map((x, i) => Math.abs(x - drift[i]))) < 1, "an alive camera breathes slowly, never per-frame noise");

  // time remap units (M14)
  ok(throws(() => timeRemap([{ speed: 0.8 } as never]), /exactly one/), "RED: a key with no unit is refused");
  ok(throws(() => timeRemap([30 as never]), /names its unit/), "RED: a bare number is refused");
  ok(throws(() => timeRemap([{ f: 30, film: 1, speed: 1 }]), /exactly one/), "RED: a key naming two units is refused");
  ok(throws(() => timeRemap([{ film: 1, speed: 1 }]), /fps/), "seconds without fps are refused");
  const slow = timeRemap([{ film: 1, speed: 0.8 }, { scene: 10, speed: 1.1 }], { fps: 30 });
  ok(near(slow.at(30), 30) && near(slow.speedAt(31), 0.8), "film seconds land on film frames: 1 s is frame 30");
  ok(near(slow.speedAt(367), 0.8) && near(slow.speedAt(368), 1.1) && near(slow.at(368), 300, 1), "the scene-10 s key lands on film frame 368, where the slowed scene reaches 300 (typed as frame 300 it would be 68 frames early)");
};
