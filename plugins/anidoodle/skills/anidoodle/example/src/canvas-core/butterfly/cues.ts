// THE TIMELINE. Every frame number in the film lives in this table and nowhere else. 120 bpm at
// 30 fps: one beat = 15 frames, cuts on multiples of 15, events on multiples of 5 (triplet
// eighths, which is what an escapement sounds like anyway). State is a pure function of frame.
import { FULL, PlateState } from "./plate";
import { WIDE } from "./surface";
import { Train } from "./parts";

export type Ease = "linear" | "out" | "outBack" | "flick";
export type Cue = { at: number; dur: number; id: string; ease?: Ease; amp?: number };

// The motion test: four shots, eight beats. It starts on the approved plate and ends on it.
export const SHOTS: [string, number, number][] = [["still", 0, 30], ["wind", 30, 60], ["hush", 60, 90], ["alive", 90, 120]];
export const CUES: Cue[] = [
  { at: 15, dur: 20, id: "key.rise", ease: "outBack" }, /* the key rides up its own centre line and seats with a small overshoot */
  { at: 35, dur: 20, id: "key.wind", ease: "linear" }, /* four turns of 5 frames: in plan view the bows foreshorten to a line and back */
  { at: 55, dur: 10, id: "key.out", ease: "out" },
  { at: 65, dur: 10, id: "twitch", ease: "flick", amp: 0.14 }, /* it moves once before anyone expects it */
  { at: 75, dur: 15, id: "flap1", ease: "flick", amp: 0.55 },
  { at: 90, dur: 10, id: "flap2", ease: "flick", amp: 0.62 },
  { at: 100, dur: 5, id: "flap3", ease: "flick", amp: 0.45 },
  { at: 105, dur: 5, id: "flap4", ease: "flick", amp: 0.3 },
  { at: 110, dur: 5, id: "flap5", ease: "flick", amp: 0.14 },
  { at: 85, dur: 15, id: "shadow.out", ease: "out" }, /* the drawing separates from its own paper */
  { at: 105, dur: 10, id: "shadow.in", ease: "out" },
  { at: 85, dur: 30, id: "boil" }, /* hero linework breathes only while it is alive */
];
export const TICK0 = 35, TICK = 5; // the train starts on the first turn of the key and never stops
export const DURATION = 120;

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (p: number, e: Ease = "linear") => e === "out" ? 1 - (1 - p) ** 3 : e === "outBack" ? 1 + 1.7 * (p - 1) ** 3 + 0.7 * (p - 1) ** 2 : e === "flick" ? (p < 0.35 ? Math.sin((p / 0.35) * Math.PI / 2) : Math.cos(((p - 0.35) / 0.65) * Math.PI / 2)) : p;
const cue = (id: string) => { const c = CUES.find((x) => x.id === id); if (!c) throw new Error(`no cue '${id}'`); return c; };
export const at = (frame: number, id: string): number => { const c = cue(id); return ease(clamp((frame - c.at) / c.dur), c.ease); }; // 0 before, 1 after
export const raw = (frame: number, id: string): number => { const c = cue(id); return clamp((frame - c.at) / c.dur); };

// the going train: one tooth of the escape wheel per tick, snapped over two frames with a
// one-frame recoil, and every other wheel geared off it by its tooth count
const STEP = [14 / 24, 26 / 24, 1, 1, 1];
export const advance = (frame: number): number => { if (frame < TICK0 + TICK) return 0; const t = Math.floor((frame - TICK0) / TICK), s = (frame - TICK0) % TICK; return t - 1 + STEP[s]; };
export const trainAt = (frame: number): Train => {
  const a = advance(frame), w = (Math.PI * 2) / 96, t = Math.floor((frame - TICK0) / TICK), s = (frame - TICK0) % TICK;
  const rocking = frame >= TICK0 + TICK && s === 0 ? 0 : 0.085 * (t % 2 ? 1 : -1); /* the fork passes through centre on the tick frame */
  return { centre: a * w, third: -a * w * (24 / 14), pinion: a * w * (24 / 8), escape: a * ((Math.PI * 2) / 15), fork: frame < TICK0 + TICK ? 0 : rocking };
};

export const stateAt = (frame: number): PlateState => {
  const flap = ["twitch", "flap1", "flap2", "flap3", "flap4", "flap5"].reduce((f, id) => f - (cue(id).amp ?? 0) * at(frame, id), 1);
  const sh = 1 - at(frame, "shadow.in"), out = at(frame, "shadow.out") * sh, wind = raw(frame, "key.wind");
  return {
    wings: { flap, sweep: -0.2 * (1 - flap) }, /* a raised wing also rakes forward: the 57o sweep the plate dimensions */
    lift: 1, /* the starboard panel stays off the wing: the film ends on the approved plate */
    keyY: at(frame, "key.rise") * (1 - at(frame, "key.out")),
    keyTurn: wind >= 1 || wind <= 0 ? 0 : wind * 4 * Math.PI * 2,
    train: trainAt(frame),
    shadow: [out * 10, out * 14],
    boil: at(frame, "boil") > 0 && raw(frame, "boil") < 1 ? 0.25 : 0,
    inkedBoil: 0, /* the motion test is the same desk: the furniture does not move (spec 4) */
    boilIndex: Math.floor(frame / 5) % 4,
    p: FULL, /* the motion test starts from the finished plate */
    view: WIDE,
  };
};

// The grid is a rule, so it is checked, not trusted (spec 9, G1).
export const gridProblems = (): string[] => {
  const p: string[] = [];
  CUES.forEach((c) => { if (c.at % 5) p.push(`cue '${c.id}' starts on frame ${c.at}, not a multiple of 5`); if ((c.at + c.dur) % 5) p.push(`cue '${c.id}' ends on frame ${c.at + c.dur}, not a multiple of 5`); if (c.at + c.dur > DURATION) p.push(`cue '${c.id}' ends after the film`); });
  SHOTS.forEach(([id, a, b]) => { if (a % 15 || b % 15) p.push(`shot '${id}' cuts off the beat grid (${a}..${b})`); });
  if (TICK0 % 5) p.push(`the train starts on frame ${TICK0}, not a multiple of 5`);
  return p;
};
