// ACT 2, RISOGRAPH: 360 frames, 12 s, 24 beats. It STIRS. Frame 0 is Act 1's last frame; the
// first drum pass wipes the blueprint off the sheet and replaces it with ink. Then three passes,
// a train that stalls and catches, a first twitch, a body that wakes, and full flutter.
// Nothing is ever still: there is no blank stock and no end hold.
import { P } from "../core";
import { RisoState } from "./act2plate";
import { Pose } from "./geom";
import { Train } from "./parts";
import { View } from "./surface";

export type Ease = "linear" | "out" | "inout" | "flick";
export type Cue = { at: number; dur: number; id: string; ease?: Ease; amp?: number };
export const DURATION = 360, TICK = 5, TRAIN0 = 60; // the train takes its first step when the pink plate lands
export const SHOTS: [string, number, number][] = [
  ["blue", 0, 30],      /* the blue drum wipes the blueprint off the sheet */
  ["pink", 30, 60],     /* the second pass lands badly out of register */
  ["jog", 60, 90],      /* the operator nudges the sheet twice, and panel 2 prints alone and late */
  ["yellow", 90, 120],  /* the sun, and the lit side of the body */
  ["catch", 120, 150],  /* the gears stall, hang for two ticks, and catch with a double step */
  ["twitch", 150, 180], /* first wing twitch, port alone, starboard answering */
  ["wake", 180, 210],   /* the body wakes: a ripple down the abdomen, both antennae sweeping */
  ["flaps", 210, 270],  /* first real flaps, all four wings */
  ["lift", 270, 330],   /* sustained flutter, and it lifts off the stock leaving a ghost */
  ["flutter", 330, 360],/* full amplitude, cut on the top of an up-stroke */
];

export const CUES: Cue[] = [
  { at: 0, dur: 25, id: "pass.blue", ease: "linear" }, { at: 0, dur: 25, id: "marks" }, { at: 10, dur: 25, id: "imprint" }, { at: 5, dur: 10, id: "bar1" },
  { at: 30, dur: 25, id: "pass.pink", ease: "linear" }, { at: 45, dur: 10, id: "wheels" }, { at: 45, dur: 10, id: "bar2" },
  { at: 60, dur: 15, id: "jog1", ease: "out" }, { at: 80, dur: 10, id: "jog2", ease: "out" }, { at: 75, dur: 10, id: "panel2", ease: "out" },
  { at: 90, dur: 25, id: "pass.yellow", ease: "linear" }, { at: 90, dur: 20, id: "sun", ease: "out" }, { at: 95, dur: 20, id: "lit" }, { at: 110, dur: 10, id: "bar3" },
  { at: 135, dur: 10, id: "quiver.port", ease: "flick", amp: 1 }, { at: 140, dur: 10, id: "quiver.star", ease: "flick", amp: 1 },
  { at: 150, dur: 10, id: "twitch.port", ease: "flick", amp: 0.14 }, { at: 165, dur: 10, id: "twitch.star", ease: "flick", amp: 0.14 },
  { at: 170, dur: 10, id: "proboscis", ease: "out" },
  { at: 180, dur: 35, id: "ripple" }, { at: 180, dur: 35, id: "sweep", ease: "flick", amp: 1 },
  { at: 210, dur: 15, id: "flap1", ease: "flick", amp: 0.4 }, { at: 225, dur: 15, id: "flap2", ease: "flick", amp: 0.55 }, { at: 240, dur: 10, id: "flap3", ease: "flick", amp: 0.62 },
  { at: 250, dur: 10, id: "flap4", ease: "flick", amp: 0.62 }, { at: 260, dur: 10, id: "flap5", ease: "flick", amp: 0.62 },
  { at: 270, dur: 10, id: "f1", ease: "flick", amp: 0.55 }, { at: 280, dur: 10, id: "f2", ease: "flick", amp: 0.55 }, { at: 290, dur: 10, id: "f3", ease: "flick", amp: 0.55 },
  { at: 300, dur: 10, id: "f4", ease: "flick", amp: 0.55 }, { at: 310, dur: 10, id: "f5", ease: "flick", amp: 0.55 }, { at: 320, dur: 10, id: "f6", ease: "flick", amp: 0.55 },
  { at: 330, dur: 10, id: "f7", ease: "flick", amp: 0.62 }, { at: 340, dur: 10, id: "f8", ease: "flick", amp: 0.62 }, { at: 350, dur: 10, id: "f9", ease: "inout", amp: 0.55 }, /* the last up-stroke, still rising when we cut */
  { at: 285, dur: 20, id: "lift", ease: "inout" }, { at: 285, dur: 15, id: "ghost" }, { at: 330, dur: 30, id: "ghost.shrink", ease: "out" },
];

const CAM: { at: number; cx: number; cy: number; z: number; ease: Ease }[] = [
  { at: 0, cx: 540, cy: 540, z: 1, ease: "linear" }, { at: 25, cx: 540, cy: 540, z: 1, ease: "linear" }, { at: 30, cx: 540, cy: 537, z: 1.012, ease: "inout" },
  { at: 60, cx: 540, cy: 470, z: 1.15, ease: "linear" }, { at: 120, cx: 540, cy: 466, z: 1.18, ease: "inout" }, /* creep */
  { at: 150, cx: 540, cy: 440, z: 1.22, ease: "linear" }, { at: 240, cx: 540, cy: 436, z: 1.25, ease: "inout" }, /* FABLE review: at 1.3 the resting wingtips kissed the frame edge (my spec's number, corrected there too) */
  { at: 270, cx: 540, cy: 420, z: 1.45, ease: "linear" }, { at: 330, cx: 540, cy: 416, z: 1.48, ease: "inout" },
  { at: 360, cx: 540, cy: 400, z: 1.6, ease: "linear" },
];

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (p: number, e: Ease = "linear") => (e === "inout" ? (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2) : e === "out" ? 1 - (1 - p) ** 3 : e === "flick" ? (p < 0.35 ? Math.sin((p / 0.35) * Math.PI / 2) : Math.cos(((p - 0.35) / 0.65) * Math.PI / 2)) : p);
const byId = new Map(CUES.map((c) => [c.id, c]));
const cue = (id: string) => { const c = byId.get(id); if (!c) throw new Error(`no cue '${id}'`); return c; };
export const at = (frame: number, id: string) => { const c = cue(id); return ease(clamp((frame - c.at) / c.dur), c.ease); };

// THE TRAIN. It steps on the tick from 60, stalls at 120 with a 3 degree recoil, hangs for two
// ticks, and catches up with a double step at 130.
const STEP = [14 / 24, 26 / 24, 1, 1, 1];
const teeth = (f: number): number => { if (f < TRAIN0 + TICK) return 0; const g = f >= 120 && f < 130 ? 119 : f, t = Math.floor((g - TRAIN0) / TICK), s = (g - TRAIN0) % TICK; return t - 1 + STEP[s]; };
export const trainAt = (f: number): Train => {
  const a = teeth(f), w = (Math.PI * 2) / 96, stalled = f >= 120 && f < 130, recoil = stalled ? -(3 * Math.PI) / 180 : 0;
  const t = Math.floor((f - TRAIN0) / TICK), s = (f - TRAIN0) % TICK, tremble = stalled ? ((f % 2) - 0.5) * 0.02 : 0;
  const rocking = f >= TRAIN0 + TICK && s === 0 ? 0 : 0.085 * (t % 2 ? 1 : -1);
  return { centre: a * w, third: -a * w * (24 / 14), pinion: a * w * (24 / 8), escape: a * ((Math.PI * 2) / 15) + recoil, fork: (f < TRAIN0 + TICK ? 0 : rocking) + tremble };
};

const viewAt = (frame: number): View => {
  let i = 0; for (let j = 0; j < CAM.length; j++) if (CAM[j].at <= frame) i = j;
  const a = CAM[i], b = CAM[Math.min(CAM.length - 1, i + 1)];
  if (b.at <= a.at) return { cx: a.cx, cy: a.cy, zoom: a.z };
  const t = ease(clamp((frame - a.at) / (b.at - a.at)), a.ease);
  return { cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, zoom: Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t) };
};

// per-wing flap. Port leads starboard by 5 frames, and only the forewings twitch at first.
const FLAPS = ["flap1", "flap2", "flap3", "flap4", "flap5", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9"];
const flapOf = (frame: number, wing: number): number => {
  const star = wing === 1 || wing === 3, f = frame - (star ? 2 : 0), fore = wing >= 2; /* FABLE review: a 5-frame lag on a 10-frame beat is ANTIPHASE, one side folded while the other is spread. 2 frames keeps it lopsided and together */
  let v = 1;
  if (fore) v -= (cue(star ? "twitch.star" : "twitch.port").amp ?? 0) * at(frame, star ? "twitch.star" : "twitch.port");
  FLAPS.forEach((id) => { v -= (cue(id).amp ?? 0) * at(f, id); });
  return clamp(v, 0.25, 1);
};
export const poseAt = (frame: number, wing: number): Pose => { const flap = flapOf(frame, wing); return { flap, sweep: -0.2 * (1 - flap) }; };

export const stateAt = (frame: number): RisoState => {
  const poses = [0, 1, 2, 3].map((i) => poseAt(frame, i));
  const vel = [0, 1, 2, 3].map((i) => Math.abs(flapOf(frame, i) - flapOf(frame - 1, i)));
  const j1 = at(frame, "jog1"), j2 = at(frame, "jog2");
  const OFF0: P = [17, -12], OFF1: P = [9.5, -6.5], OFF2: P = [4.5, -3];
  const lagN = Math.max(...vel) * 60; /* misregistration as follow-through: the pink plate lags a fast move and catches up */
  const reg: P = [OFF0[0] + (OFF1[0] - OFF0[0]) * j1 + (OFF2[0] - OFF1[0]) * j2 + lagN * 0.6, OFF0[1] + (OFF1[1] - OFF0[1]) * j1 + (OFF2[1] - OFF1[1]) * j2 + lagN * 0.4];
  const lift = at(frame, "lift"), sway = ((frame - 285) / 60) * Math.PI * 2;
  const L: P = lift > 0 ? [Math.sin(sway) * 7 * lift, -14 * lift + Math.sin(sway * 2) * 4 * lift] : [0, 0]; /* a slow figure of eight, the way a thing that has just learned to fly holds itself */
  const rip = at(frame, "ripple"), flex = Array.from({ length: 7 }, (_, i) => { const t = clamp((rip * 7 - i) * 1.6); return Math.sin(t * Math.PI) * (1 - i * 0.06); });
  const q = at(frame, "quiver.port"), qs = at(frame, "quiver.star"), sw = at(frame, "sweep");
  return {
    poses, view: viewAt(frame),
    blue: at(frame, "pass.blue"), pink: at(frame, "pass.pink"), yellow: at(frame, "pass.yellow"),
    reg, lift: L, ghost: at(frame, "ghost") * (1 - 0.6 * at(frame, "ghost.shrink")),
    marks: at(frame, "marks"), bars: (at(frame, "bar1") + at(frame, "bar2") + at(frame, "bar3")) / 3, imprint: at(frame, "imprint"),
    train: trainAt(frame), wheels: at(frame, "wheels"), panel2: at(frame, "panel2"),
    quiver: [q * 0.1 + sw * 0.26, qs * 0.1 + sw * 0.2], /* FABLE review: 3 to 5 degrees did not read; antennae are the first thing that says alive */ proboscis: at(frame, "proboscis"), key: 0,
    flex, vel, sun: at(frame, "sun"), lit: at(frame, "lit"),
  };
};
export const END_POSE = (): Pose[] => [0, 1, 2, 3].map((i) => poseAt(DURATION - 1, i)); // Act 3 opens on exactly this
export const gridProblems = (): string[] => {
  const p: string[] = [];
  CUES.forEach((c) => { if (c.at % 5) p.push(`cue '${c.id}' starts on frame ${c.at}, not a multiple of 5`); if ((c.at + c.dur) % 5) p.push(`cue '${c.id}' ends on frame ${c.at + c.dur}, not a multiple of 5`); if (c.at + c.dur > DURATION) p.push(`cue '${c.id}' ends after the act`); });
  CAM.forEach((k) => { if (k.at % 5) p.push(`camera key at frame ${k.at} is not a multiple of 5`); });
  SHOTS.forEach(([id, a, b]) => { if (a % 15 || b % 15) p.push(`shot '${id}' cuts off the beat grid (${a}..${b})`); });
  return p;
};
