// ACT 3, WATERCOLOUR: 360 frames, 12 s, 24 beats. Pencil, water, pigment, and a drop of clean
// water in the middle of it. The motion is what the water does.
import { P } from "../core";
import { WaterState } from "./act4plate";

export type Ease = "linear" | "out" | "flick";
export type Cue = { at: number; dur: number; id: string; ease?: Ease; amp?: number };
export const DURATION = 360;
export const SHOTS: [string, number, number][] = [
  ["paper", 0, 45],     /* cold-press stock, nothing on it yet */
  ["pencil", 45, 135],  /* the underdrawing, loose and fast, and it stays visible for ever */
  ["wet", 135, 225],    /* the washes go down wet-in-wet and spread out from the brush */
  ["settle", 225, 270], /* a drop of clean water blooms a backrun, pigment granulates and dries */
  ["alive", 270, 345],  /* five flaps, and the paint lags behind the drawing */
  ["dry", 345, 360],    /* the finished painting, held */
];
export const CUES: Cue[] = [
  { at: 45, dur: 80, id: "pencil", ease: "linear" },
  { at: 135, dur: 85, id: "wet", ease: "linear" },
  { at: 195, dur: 75, id: "settle", ease: "out" },
  { at: 225, dur: 40, id: "bloom", ease: "out" },
  { at: 270, dur: 10, id: "twitch", ease: "flick", amp: 0.14 },
  { at: 285, dur: 15, id: "flap1", ease: "flick", amp: 0.55 }, { at: 300, dur: 10, id: "flap2", ease: "flick", amp: 0.62 },
  { at: 310, dur: 10, id: "flap3", ease: "flick", amp: 0.5 }, { at: 320, dur: 10, id: "flap4", ease: "flick", amp: 0.32 }, { at: 330, dur: 10, id: "flap5", ease: "flick", amp: 0.16 },
  { at: 285, dur: 30, id: "slip.out", ease: "out" }, { at: 325, dur: 20, id: "slip.in", ease: "out" },
];
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (p: number, e: Ease = "linear") => (e === "out" ? 1 - (1 - p) ** 3 : e === "flick" ? (p < 0.35 ? Math.sin((p / 0.35) * Math.PI / 2) : Math.cos(((p - 0.35) / 0.65) * Math.PI / 2)) : p);
const byId = new Map(CUES.map((c) => [c.id, c]));
const cue = (id: string) => { const c = byId.get(id); if (!c) throw new Error(`no cue '${id}'`); return c; };
export const at = (frame: number, id: string) => { const c = cue(id); return ease(clamp((frame - c.at) / c.dur), c.ease); };

export const stateAt = (frame: number): WaterState => {
  const flap = ["twitch", "flap1", "flap2", "flap3", "flap4", "flap5"].reduce((f, id) => f - (cue(id).amp ?? 0) * at(frame, id), 1);
  const slip = at(frame, "slip.out") * (1 - at(frame, "slip.in"));
  return { pose: { flap, sweep: -0.2 * (1 - flap) }, pencil: at(frame, "pencil"), wet: at(frame, "wet"), settle: at(frame, "settle"), slip: [slip * 9, slip * 6], bloom: at(frame, "bloom") };
};
export const gridProblems = (): string[] => {
  const p: string[] = [];
  CUES.forEach((c) => { if (c.at % 5) p.push(`cue '${c.id}' starts on frame ${c.at}, not a multiple of 5`); if ((c.at + c.dur) % 5) p.push(`cue '${c.id}' ends on frame ${c.at + c.dur}, not a multiple of 5`); if (c.at + c.dur > DURATION) p.push(`cue '${c.id}' ends after the act`); });
  SHOTS.forEach(([id, a, b]) => { if (a % 15 || b % 15) p.push(`shot '${id}' cuts off the beat grid (${a}..${b})`); });
  return p;
};
