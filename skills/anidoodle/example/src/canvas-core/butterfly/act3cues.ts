// ACT 3, EDITORIAL CUTAWAY: 360 frames, 12 s, 24 beats. UNDERSTOOD. The flight stops, the
// housing comes off, and the mechanism is run in slow motion, one crank step per tick, while
// the camera follows the force from the spring to the wing. Then it speeds back up and leaves.
import { P } from "../core";
import { EditState } from "./act3plate";
import { Pose, THORAX, cen } from "./geom";
import { ARBOR, crankFor, crankPin, flapOf, pivot } from "./linkage";
import { Train } from "./parts";
import { View } from "./surface";
import { END_POSE } from "./act2cues";

export type Ease = "linear" | "out" | "inout" | "outBack";
export type Cue = { at: number; dur: number; id: string; ease?: Ease };
export const DURATION = 360, TICK = 5, CRANK0 = 30;
export const SHOTS: [string, number, number][] = [
  ["freeze", 0, 30],   /* the only silence in the film, and the housing comes off */
  ["spring", 30, 120], /* station A: mainspring and going train */
  ["crank", 120, 210], /* station B: round becomes back-and-forth */
  ["wing", 210, 285],  /* station C: the wing answers, and panel 2 is pressed home */
  ["whole", 285, 315], /* cause and effect in one frame */
  ["speed", 315, 345], /* it speeds back up and lifts off its own diagram */
  ["leave", 345, 360], /* pushed in on the thorax, the accent bleeding wet: the watercolour arriving */
];
export const CUES: Cue[] = [
  { at: 0, dur: 10, id: "cut" }, { at: 10, dur: 20, id: "shell", ease: "outBack" }, { at: 10, dur: 20, id: "faces" }, { at: 15, dur: 30, id: "accent" },
  { at: 45, dur: 10, id: "l1" }, { at: 50, dur: 10, id: "rot" }, { at: 75, dur: 10, id: "l2" }, { at: 90, dur: 10, id: "l3" }, { at: 105, dur: 10, id: "l4" },
  { at: 150, dur: 30, id: "ghostRod" }, { at: 165, dur: 10, id: "l5" }, { at: 180, dur: 10, id: "l6" }, { at: 190, dur: 10, id: "cap" },
  { at: 240, dur: 20, id: "arc" }, { at: 240, dur: 20, id: "ghostSpar" }, { at: 255, dur: 10, id: "l7" }, { at: 265, dur: 10, id: "l8" },
  { at: 270, dur: 15, id: "inset" }, { at: 275, dur: 10, id: "seat", ease: "outBack" },
  { at: 300, dur: 15, id: "shellBack", ease: "out" },
  { at: 330, dur: 15, id: "lift", ease: "out" }, { at: 330, dur: 15, id: "shadow", ease: "out" }, { at: 350, dur: 10, id: "bleed" },
  { at: 60, dur: 60, id: "pulse" }, { at: 120, dur: 90, id: "pulse2" },
];
const ARB = ARBOR, PV = pivot(-1), TC = cen(THORAX);
const CAM: { at: number; cx: number; cy: number; z: number; ease: Ease }[] = [
  { at: 0, cx: 540, cy: 400, z: 1.6, ease: "inout" }, { at: 30, cx: 540, cy: 400, z: 1.68, ease: "inout" }, /* the freeze still creeps: nothing in this film is nailed down */
  { at: 60, cx: ARB[0], cy: ARB[1] + 8, z: 3.2, ease: "inout" }, { at: 120, cx: ARB[0] + 4, cy: ARB[1] + 10, z: 3.4, ease: "inout" },
  { at: 135, cx: (ARB[0] + PV[0]) / 2, cy: (ARB[1] + PV[1]) / 2 + 6, z: 3.2, ease: "inout" }, { at: 210, cx: (ARB[0] + PV[0]) / 2 - 4, cy: (ARB[1] + PV[1]) / 2 + 8, z: 3.32, ease: "inout" },
  { at: 225, cx: PV[0] - 6, cy: PV[1] + 4, z: 3.0, ease: "inout" }, { at: 285, cx: PV[0] - 10, cy: PV[1] + 2, z: 3.1, ease: "inout" },
  { at: 315, cx: 540, cy: 440, z: 1.15, ease: "out" }, { at: 345, cx: 540, cy: 434, z: 1.19, ease: "inout" },
  { at: 360, cx: TC[0], cy: TC[1] - 6, z: 3.2, ease: "inout" }, /* the thorax again, the film's rhyme with Act 1 */
];
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (p: number, e: Ease = "linear") => (e === "inout" ? (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2) : e === "out" ? 1 - (1 - p) ** 3 : e === "outBack" ? 1 + 1.7 * (p - 1) ** 3 + 0.7 * (p - 1) ** 2 : p);
const byId = new Map(CUES.map((c) => [c.id, c]));
const cue = (id: string) => { const c = byId.get(id); if (!c) throw new Error(`no cue '${id}'`); return c; };
export const at = (frame: number, id: string) => { const c = cue(id); return ease(clamp((frame - c.at) / c.dur), c.ease); };

// THE CRANK. Slow motion is one twenty-fourth of a revolution per tick, snapped over two frames
// like the escapement that drives it. It doubles at 315, again at 325, and runs free from 335.
const STEP = [14 / 24, 26 / 24, 1, 1, 1], TH0 = crankFor(END_POSE()[2].flap);
const REV = Math.PI * 2, TH: number[] = (() => {
  const out: number[] = []; let th = TH0;
  const stepped = (f: number, from: number, per: number) => { const t = Math.floor((f - from) / TICK), s = (f - from) % TICK; return t < 1 ? 0 : (t - 1 + STEP[s]) * per; };
  let base = TH0, b315 = 0, b325 = 0, b335 = 0;
  for (let f = 0; f < DURATION; f++) {
    if (f < CRANK0) th = TH0;
    else if (f < 315) th = base + stepped(f, CRANK0, REV / 24);
    else if (f < 325) { if (!b315) b315 = base + stepped(315, CRANK0, REV / 24); th = b315 + stepped(f, 315, REV / 12); }
    else if (f < 335) { if (!b325) b325 = b315 + stepped(325, 315, REV / 12); th = b325 + stepped(f, 325, REV / 6); }
    else { if (!b335) b335 = b325 + stepped(335, 325, REV / 6); th = b335 + ((f - 335) * REV) / 10; } /* life speed: a beat every ten frames */
    out.push(th);
  }
  return out;
})();
export const thAt = (f: number) => TH[Math.max(0, Math.min(DURATION - 1, f))];
const trainAt = (f: number): Train => { const th = thAt(f) - TH0, a = th / REV; return { centre: th, third: -a * REV * (24 / 14) * 0.25, pinion: a * REV * (24 / 8) * 0.25, escape: a * REV * 1.2, fork: 0.085 * (Math.floor(f / TICK) % 2 ? 1 : -1) }; };

const viewAt = (frame: number): View => {
  let i = 0; for (let j = 0; j < CAM.length; j++) if (CAM[j].at <= frame) i = j;
  const a = CAM[i], b = CAM[Math.min(CAM.length - 1, i + 1)];
  if (b.at <= a.at) return { cx: a.cx, cy: a.cy, zoom: a.z };
  const t = ease(clamp((frame - a.at) / (b.at - a.at)), a.ease);
  return { cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, zoom: Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t) };
};
const poseAt = (frame: number): Pose[] => {
  if (frame < CRANK0) return END_POSE(); /* the freeze holds Act 2's last frame exactly */
  const th = thAt(frame), fp = flapOf(-1, th), fs = flapOf(1, th);
  return [-1, 1, -1, 1].map((side, i) => { const f = side < 0 ? fp : fs; return { flap: f, sweep: -0.2 * (1 - f) }; });
};
export const stateAt = (frame: number): EditState => {
  const th = thAt(frame), P0 = crankPin(th), R = pivot(-1);
  const L = (n: string, text: string, at: P, to: P, id: string): { n: string; text: string; at: P; to: P; p: number } => ({ n, text, at, to, p: at2(frame, id) });
  const shell = at(frame, "shell") * (1 - at(frame, "shellBack"));
  const lift = at(frame, "lift"), sh = at(frame, "shadow");
  return {
    view: viewAt(frame), poses: poseAt(frame), th, train: trainAt(frame), mech: at(frame, "accent") > 0 ? 1 : 0,
    art: { th, shell, faces: at(frame, "faces") * (1 - at(frame, "shellBack")), accent: at(frame, "accent"), wings: 1, lift: [0, 0], bleed: at(frame, "bleed"), ghostRod: at(frame, "ghostRod"), arc: at(frame, "arc"), ghostSpar: at(frame, "ghostSpar") },
    cut: at(frame, "cut"),
    labels: [
      L("1", "MAINSPRING", [ARB[0] - 158, ARB[1] - 22], [ARB[0] - 62, ARB[1] - 16], "l1"),
      L("2", "GOING TRAIN", [ARB[0] + 72, ARB[1] - 102], [ARB[0] + 32, ARB[1] - 34], "l2"),
      L("3", "ESCAPEMENT", [ARB[0] + 88, ARB[1] + 74], [ARB[0] + 54, ARB[1] + 8], "l3"),
      L("4", "24 : 8", [ARB[0] + 112, ARB[1] + 10], [ARB[0] + 40, ARB[1] - 6], "l4"),
      L("5", "CRANK", [ARB[0] - 152, ARB[1] + 74], [P0[0], P0[1]], "l5"),
      L("6", "CONN. ROD", [ARB[0] - 44, ARB[1] + 136], [(P0[0] + R[0]) / 2, (P0[1] + R[1]) / 2 + 6], "l6"),
      L("7", "BELL-CRANK", [R[0] - 152, R[1] - 84], [R[0] - 14, R[1] - 8], "l7"),
      L("8", "WING ROOT", [R[0] + 34, R[1] + 100], [R[0] + 14, R[1] + 18], "l8"),
    ],
    caption: ["ROUND BECOMES BACK-AND-FORTH", at(frame, "cap")],
    pulseAt: (at(frame, "pulse") * 4 + at(frame, "pulse2") * 12) % 4, pulseOn: frame >= 60 && frame < 215 ? 1 : 0,
    forceP: at(frame, "rot"), inset: at(frame, "inset"), seat: at(frame, "seat"),
    lift: [0, -30 * lift], shadow: [10 * sh, 14 * sh],
  };
};
const at2 = (frame: number, id: string) => at(frame, id);
export const gridProblems = (): string[] => {
  const p: string[] = [];
  CUES.forEach((c) => { if (c.at % 5) p.push(`cue '${c.id}' starts on frame ${c.at}, not a multiple of 5`); if ((c.at + c.dur) % 5) p.push(`cue '${c.id}' ends on frame ${c.at + c.dur}, not a multiple of 5`); if (c.at + c.dur > DURATION) p.push(`cue '${c.id}' ends after the act`); });
  CAM.forEach((k) => { if (k.at % 5) p.push(`camera key at frame ${k.at} is not a multiple of 5`); });
  SHOTS.forEach(([id, a, b]) => { if (a % 15 || b % 15) p.push(`shot '${id}' cuts off the beat grid (${a}..${b})`); });
  return p;
};
