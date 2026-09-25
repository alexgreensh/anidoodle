// ACT 1, THE BLUEPRINT: 540 frames, 18 s, 36 beats at 120 bpm. A bare cyanotype sheet draws
// itself into PLATE I, the key goes in, the train starts, and for two beats the drawing is
// alive. Every frame number in the act is in this table and nowhere else: cuts on multiples of
// 15, events on multiples of 5 (triplet eighths, which is what an escapement sounds like).
import { EMPTY, Parts, PlateState } from "./plate";
import { BUBBLE } from "./parts";
import { View } from "./surface";
import { Train } from "./parts";

export type Ease = "linear" | "out" | "outBack" | "flick" | "inout";
export type Cue = { at: number; dur: number; id: string; ease?: Ease; amp?: number };

export const DURATION = 540, TICK0 = 240, TICK = 5;
export const SHOTS: [string, number, number][] = [
  ["sheet", 0, 60],      /* the ground, the printed grid, the border rules itself */
  ["layout", 60, 120],   /* construction: centre line, wing envelopes, thorax ellipse, then the title block is RULED */
  ["thorax", 120, 180],  /* the housing, the broken-out window, the head and its coiled antennae */
  ["push", 180, 240],    /* the camera moves in on the thorax while the going train seats inside it */
  ["detail", 240, 270],  /* MATCH CUT: the bubble on the thorax becomes Detail B, full frame, and it ticks */
  ["pull", 270, 315],    /* back out to the sheet */
  ["spars", 315, 360],   /* four wing frames radiate from their hinges, port leading */
  ["skin", 360, 405],    /* membrane panels fly home along their projection lines and are veined */
  ["notes", 405, 420],   /* dimensions, balloons, notes, and MECHANICAL LEPIDOPTERA written last */
  ["wind", 420, 495],    /* the key rides up the centre line and winds seven turns, then comes out */
  ["alive", 495, 525],   /* it moves, and lifts off its own paper */
  ["plate", 525, 540],   /* the finished plate, held */
];

// THE CAMERA. Keyframes of (frame, centre, zoom); two keys on the same frame are a CUT. The view
// is applied to control points through the transform stack, and line weight is compensated for
// the zoom in plate.ts, so a close shot is redrawn at size, never a magnified bitmap.
type Key = { at: number; cx: number; cy: number; z: number; ease: Ease };
const [BX, BY, BR] = BUBBLE(), DBX = 392, DBY = 898, DBR = 100, SCREEN = 330; /* the bubble and the Detail B circle land on the SAME screen circle: that is the cut */
export const CAM: Key[] = [
  { at: 0, cx: 540, cy: 540, z: 1, ease: "linear" },
  { at: 195, cx: 540, cy: 540, z: 1, ease: "inout" },
  { at: 240, cx: BX, cy: BY, z: SCREEN / BR, ease: "linear" }, /* slow push in on the thorax as the wheels seat */
  { at: 240, cx: DBX, cy: DBY, z: SCREEN / DBR, ease: "linear" }, /* CUT */
  { at: 270, cx: DBX, cy: DBY, z: (SCREEN / DBR) * 1.045, ease: "out" }, /* it breathes in while the train runs */
  { at: 315, cx: 540, cy: 500, z: 1.12, ease: "linear" }, /* held here while the wings and the body are drawn: a still camera lets the drawing work */
  { at: 405, cx: 540, cy: 500, z: 1.12, ease: "inout" },
  { at: 420, cx: 540, cy: 540, z: 1, ease: "linear" }, /* wide again, on the frame the key starts to rise */
  { at: 540, cx: 540, cy: 540, z: 1, ease: "linear" },
];

export const CUES: Cue[] = [
  { at: 15, dur: 30, id: "grid", ease: "out" }, /* printed paper, so it may fade: the only fade in the act */
  { at: 30, dur: 30, id: "border" },
  { at: 60, dur: 45, id: "construct" }, { at: 300, dur: 30, id: "erase" }, /* construction is UN-drawn, because a construction line is erased and never faded */
  { at: 105, dur: 45, id: "cartouche" }, { at: 355, dur: 65, id: "lettering" }, /* the box is ruled early, the lettering is the last job: MECHANICAL LEPIDOPTERA is written just before the key goes in */
  { at: 120, dur: 45, id: "shell" }, { at: 160, dur: 40, id: "head" },
  { at: 165, dur: 60, id: "detailPlate" }, { at: 180, dur: 45, id: "detail" }, { at: 200, dur: 35, id: "window" }, { at: 185, dur: 30, id: "bubble" }, /* the bubble is rung on the thorax before the camera goes in, and it is the circle the cut matches */ { at: 385, dur: 25, id: "detail.notes" }, /* the tooth counts are notes, so they wait for the notes phase */
  { at: 300, dur: 45, id: "wing.LF" }, { at: 315, dur: 45, id: "wing.LH" }, { at: 330, dur: 45, id: "wing.RF" }, { at: 345, dur: 45, id: "wing.RH" }, /* port leads, starboard follows: a right-handed draftsman works left to right */
  { at: 340, dur: 40, id: "skin.LF" }, { at: 355, dur: 40, id: "skin.LH" }, { at: 370, dur: 40, id: "skin.RF" },
  { at: 350, dur: 50, id: "abdomen" },
  { at: 365, dur: 45, id: "key.draw" }, { at: 360, dur: 20, id: "axis" }, { at: 370, dur: 50, id: "furniture" }, { at: 365, dur: 30, id: "section" }, { at: 375, dur: 20, id: "scale" }, { at: 380, dur: 15, id: "note" }, { at: 380, dur: 30, id: "list" },
  { at: 420, dur: 15, id: "key.rise", ease: "outBack" }, { at: 435, dur: 35, id: "key.wind", ease: "linear" }, { at: 475, dur: 10, id: "key.out", ease: "out" },
  { at: 485, dur: 10, id: "twitch", ease: "flick", amp: 0.14 },
  { at: 495, dur: 15, id: "flap1", ease: "flick", amp: 0.55 }, { at: 510, dur: 10, id: "flap2", ease: "flick", amp: 0.62 }, { at: 520, dur: 5, id: "flap3", ease: "flick", amp: 0.45 },
  { at: 495, dur: 15, id: "shadow.out", ease: "out" }, { at: 510, dur: 15, id: "shadow.in", ease: "out" },
  { at: 495, dur: 30, id: "boil" },
];

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (p: number, e: Ease = "linear") => (e === "inout" ? (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2) : e === "out" ? 1 - (1 - p) ** 3 : e === "outBack" ? 1 + 1.7 * (p - 1) ** 3 + 0.7 * (p - 1) ** 2 : e === "flick" ? (p < 0.35 ? Math.sin((p / 0.35) * Math.PI / 2) : Math.cos(((p - 0.35) / 0.65) * Math.PI / 2)) : p);
const byId = new Map(CUES.map((c) => [c.id, c]));
const cue = (id: string) => { const c = byId.get(id); if (!c) throw new Error(`no cue '${id}'`); return c; };
export const at = (frame: number, id: string): number => { const c = cue(id); return ease(clamp((frame - c.at) / c.dur), c.ease); };
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

// the camera at a frame: the last key at or before it, eased into the next
export const viewAt = (frame: number): View => {
  let i = 0; for (let j = 0; j < CAM.length; j++) if (CAM[j].at <= frame) i = j;
  const a = CAM[i], b = CAM[Math.min(CAM.length - 1, i + 1)];
  if (b.at <= a.at) return { cx: a.cx, cy: a.cy, zoom: a.z };
  const t = ease(clamp((frame - a.at) / (b.at - a.at)), a.ease), lz = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t); /* zoom moves geometrically, or a push looks like it stalls at the end */
  const cx = a.cx + (b.cx - a.cx) * t, cy = a.cy + (b.cy - a.cy) * t;
  if (Math.abs(lz - 1) < 0.004 && Math.abs(cx - 540) < 2 && Math.abs(cy - 540) < 2) return { cx: 540, cy: 540, zoom: 1 }; /* snap the last hair of the move to true wide, or every finished part redraws for nothing */
  return { cx, cy, zoom: lz };
};

export const stateAt = (frame: number): PlateState => {
  const flap = ["twitch", "flap1", "flap2", "flap3"].reduce((f, id) => f - (cue(id).amp ?? 0) * at(frame, id), 1);
  const sh = 1 - at(frame, "shadow.in"), out = at(frame, "shadow.out") * sh, wind = raw(frame, "key.wind");
  const p: Parts = {
    ...EMPTY,
    grid: at(frame, "grid"), border: at(frame, "border"), construct: at(frame, "construct") * (1 - at(frame, "erase")),
    shell: at(frame, "shell"), head: at(frame, "head"), window: at(frame, "window"),
    detail: at(frame, "detail"), detailPlate: at(frame, "detailPlate"),
    wing: [at(frame, "wing.LH"), at(frame, "wing.RH"), at(frame, "wing.LF"), at(frame, "wing.RF")],
    skin: [at(frame, "skin.LH"), 0, at(frame, "skin.LF"), at(frame, "skin.RF")], /* starboard hindwing keeps its membrane omitted */
    abdomen: at(frame, "abdomen"), axis: at(frame, "axis"), key: at(frame, "key.draw"), note: at(frame, "note"), bubble: at(frame, "bubble"),
    furniture: at(frame, "furniture"), section: at(frame, "section"), scale: at(frame, "scale"), list: at(frame, "list"), cartouche: at(frame, "cartouche"), lettering: at(frame, "lettering"), detailNotes: at(frame, "detail.notes"),
  };
  return {
    wings: { flap, sweep: -0.2 * (1 - flap) }, /* a raised wing also rakes forward: the 57o sweep the plate dimensions */
    lift: 1, /* the starboard forewing panel that never comes home: the act ends on the approved plate */
    keyY: at(frame, "key.rise") * (1 - at(frame, "key.out")),
    keyTurn: wind >= 1 || wind <= 0 ? 0 : wind * 7 * Math.PI * 2, /* seven turns, one every five frames */
    train: trainAt(frame),
    shadow: [out * 10, out * 14],
    boil: at(frame, "boil") > 0 && raw(frame, "boil") < 1 ? 0.25 : 0,
    inkedBoil: 0, /* at the desk the finished furniture is dead still (spec 4): only the hero line breathes */
    boilIndex: Math.floor(frame / 5) % 4,
    p,
    view: viewAt(frame),
  };
};

// The grid is a rule, so it is checked, not trusted (spec 9, G1).
export const gridProblems = (): string[] => {
  const p: string[] = [];
  CUES.forEach((c) => { if (c.at % 5) p.push(`cue '${c.id}' starts on frame ${c.at}, not a multiple of 5`); if ((c.at + c.dur) % 5) p.push(`cue '${c.id}' ends on frame ${c.at + c.dur}, not a multiple of 5`); if (c.at + c.dur > DURATION) p.push(`cue '${c.id}' ends after the act`); });
  SHOTS.forEach(([id, a, b]) => { if (a % 15 || b % 15) p.push(`shot '${id}' cuts off the beat grid (${a}..${b})`); });
  if (TICK0 % 5) p.push(`the train starts on frame ${TICK0}, not a multiple of 5`);
  return p;
};
