// MOVEMENT 2, "ALIVE": every frame number in the movement, and nothing else. Spec section 1 is
// binding: one beat = 15 frames, one bar = 60, events on multiples of 5, landings and take-offs
// on BEATS. gridProblems() runs at module load in every host that draws this movement, so a
// number that drifts off the grid is a build error and never something a reviewer catches by eye.
//
// FABLE, one deviation to veto in a line: the spec asks for this table in `butterfly/act2cues.ts`.
// That filename is taken by the CUT riso act, which is still on disk as the record you asked to
// keep and still compiles; moving it to legacy/ breaks `act2.ts` and `act3.ts` with it. The
// movement's table lives here instead. Nothing imports the riso tables from this movement.

export const LOCAL = 870; // frames in movement 2. Retimed from 1260 on review: the macro and the
// ending are untouched, stage F loses its poppy touch-down and stage R loses the fourth landing,
// which is exactly the trim spec O6 nominates. The whole film is now 1410 frames, 47.0 s.
export const FILM_OFFSET = 540; // film frame = local + 540 (Act 1 is frames 0-539)
export const BEAT = 15, BAR = 60;
export const filmFrame = (local: number) => local + FILM_OFFSET;

// ---------------------------------------------------------------- 5.1 the camera
// S is screen px per sheet unit. Monotone, never increasing, never at rest after frame 0.
export const S_KEYS: [number, number][] = [
  [0, 4.0], [120, 3.4], [240, 1.6], [345, 0.55],
  [420, 0.545], [450, 0.52], [525, 0.515], [555, 0.49], [585, 0.485],
  [660, 0.24], [720, 0.15], [780, 0.118], [870, 0.115],
];
// The three STEPS: a take-off releases each one and it takes 30 frames. The big moves start on
// the take-offs at 240, 720 and 855.
export const STEPS: [number, number][] = [[420, 450], [525, 555]];

// The camera spine: where the lens is pointed, in sheet units, keyed on bars. Stages M to R are
// authored here; once the flight paths land these become the TARGET of a critically damped
// follow (about 25 frames of lag, spec 4) rather than the centre itself.
export const M0: [number, number] = [665, 372]; // beat 1's view: starboard forewing root, panel 2 right of centre, thorax window and its wheels in the left third

// ---------------------------------------------------------------- 5.2 the water
// The drop lands on the LIFTED panel 2 and runs down its projection lines onto the wing; from
// there it follows the spars by capillary, one spar per 5 frames, and the draftsman's port-to-
// starboard order is abandoned because water does not care about the draftsman.
// Wing order everywhere in this movement: 0 port hind, 1 starboard hind, 2 port fore, 3 starboard fore.
export const DROP = 5; // a clear bead lands on panel 2
export const SPAR_WET: number[][] = [
  [85, 90, 95, 100, 105, 110, 115], // 0 port hind
  [40, 45, 50, 55, 60, 65, 70], //  1 starboard hind
  [75, 80, 85, 90, 95, 100], //      2 port fore
  [40, 25, 15, 10, 30, 50], //       3 starboard fore: the drop arrives at spar 3 and works outward and back, and the trailing spar is the LAST to take it, so at 60 the front is still crossing the wing in the middle of the frame
];
export const PANEL2_FLOOD = 45, PANEL2_HOME = 60; // it keeps the blueprint's cornflower and slides home on its projection lines
export const BODY_WET = { shell: 65, head: 75, window: 80, abdomen: 85 }; // water crosses the body 60-120

// ---------------------------------------------------------------- 5.2 to 5.6 the beats
export const STIR = { gears: 120, portAntenna: 125, starAntenna: 130, doubleStep: 130, breath: 135, breathStar: 140, breathEnd: 165 };
export const FANS: [number, number, number][] = [[180, 30, 0.6], [210, 20, 0.5], [230, 10, 0.45]]; // start, length, flap floor
export const SMOOTH = [180, 240] as const; // stepped motion blends to continuous across this bar
export const TAKEOFFS = [240, 420, 525, 585];
export const LANDINGS: { at: number; flower: string }[] = [
  { at: 360, flower: "R1" }, { at: 450, flower: "R2" }, { at: 540, flower: "R3" },
];
export const SIPS: [number, number][] = [[375, 410], [465, 510], [555, 575]];
export const PROBOSCIS = [375, 385] as const; // the hairspring uncoils into the tight centre
export const GUSTS = [480, 600]; // a gust FRONT enters left and crosses in 60 to 90 frames
export const CLOUD_SHADOW: [number, number][] = [[480, 540], [660, 870]];
export const PETAL_FALL = [555, 585] as const;
export const WHITES = [630, 750] as const; // two real white butterflies
export const SHEET_RETURNS = 700, SHEET_CORNER_LIFTS = [715, 745];
export const HOVER = 750, CORNER_LIFT = [780, 795] as const, SIGNATURE = [795, 825] as const, DING = 825;
// 5.6: from the poppy it turns and comes UP the field to the foreground, growing as the world
// shrinks. These are the keys of that approach, and the last one is the arrival at the approved
// still's position. Without them bar 18 owns no event, which is exactly what G-AIR would find.
export const APPROACH: [number, number][] = [[660, 2.2], [700, 0.9], [730, -2.1], [750, -5.8]]; // frame, the creature's depth z
// 1185-1260: five beats to read the signature. The ink is still drying and the creature is still
// drifting, so the last bar is authored too and is not a held frame.
export const INK_DRY: [number, number] = [825, 865];
export const SEED_FLUFF = 345;

// ---------------------------------------------------------------- the gate
export const gridProblems = (): string[] => {
  const p: string[] = [], ev = (n: number, what: string) => { if (n % 5) p.push(`${what} at ${n} is off the 5-frame event grid`); if (n < 0 || n > LOCAL) p.push(`${what} at ${n} is outside [0, ${LOCAL}]`); };
  const beat = (n: number, what: string) => { if (n % BEAT) p.push(`${what} at ${n} is not on a beat (${BEAT} frames)`); };
  ev(DROP, "the drop"); ev(PANEL2_FLOOD, "panel 2 flood"); ev(PANEL2_HOME, "panel 2 home");
  SPAR_WET.forEach((w, i) => w.forEach((n, j) => ev(n, `wing ${i} spar ${j}`)));
  Object.entries(BODY_WET).forEach(([k, n]) => ev(n, `body ${k}`));
  Object.entries(STIR).forEach(([k, n]) => ev(n, `stir ${k}`));
  FANS.forEach(([n], i) => ev(n, `fan ${i}`));
  TAKEOFFS.forEach((n) => { ev(n, `take-off ${n}`); beat(n, `take-off ${n}`); });
  LANDINGS.forEach((l) => { ev(l.at, `landing on ${l.flower}`); beat(l.at, `landing on ${l.flower}`); });
  SIPS.forEach(([a, b], i) => { ev(a, `sip ${i} start`); ev(b, `sip ${i} end`); if (b <= a) p.push(`sip ${i} ends before it starts`); });
  [...GUSTS, SEED_FLUFF, SHEET_RETURNS, ...SHEET_CORNER_LIFTS, HOVER, DING, ...INK_DRY].forEach((n) => ev(n, `event ${n}`));
  APPROACH.forEach(([n], i) => { ev(n, `approach key ${i}`); if (i && n <= APPROACH[i - 1][0]) p.push(`approach key ${i} at ${n} is out of order`); if (i && APPROACH[i][1] >= APPROACH[i - 1][1]) p.push(`approach key ${i} does not come toward the camera`); });
  [...CORNER_LIFT, ...SIGNATURE, ...PETAL_FALL, ...WHITES, ...PROBOSCIS].forEach((n) => ev(n, `event ${n}`));
  CLOUD_SHADOW.forEach(([a, b], i) => { ev(a, `cloud shadow ${i}`); ev(b, `cloud shadow ${i} end`); });
  STEPS.forEach(([a, b], i) => { if (!TAKEOFFS.includes(a)) p.push(`camera step ${i} at ${a} is not released by a take-off`); if (b - a !== 30) p.push(`camera step ${i} takes ${b - a} frames, the spec says 30`); });
  S_KEYS.forEach(([f], i) => { if (i && f <= S_KEYS[i - 1][0]) p.push(`S key ${i} at frame ${f} is out of order`); });
  S_KEYS.forEach(([, s], i) => { if (i && s > S_KEYS[i - 1][1]) p.push(`S rises at key ${i} (${S_KEYS[i - 1][1]} to ${s}): the camera never moves in`); });
  if (S_KEYS[S_KEYS.length - 1][0] !== LOCAL) p.push(`the last S key is at ${S_KEYS[S_KEYS.length - 1][0]}, the movement is ${LOCAL}`);
  // every bar of the movement must own at least one authored event, or something is holding still
  const all = [DROP, PANEL2_FLOOD, PANEL2_HOME, ...SPAR_WET.flat(), ...Object.values(BODY_WET), ...Object.values(STIR), ...FANS.map((f) => f[0]), ...TAKEOFFS, ...LANDINGS.map((l) => l.at), ...SIPS.flat(), ...GUSTS, SEED_FLUFF, SHEET_RETURNS, ...SHEET_CORNER_LIFTS, HOVER, ...CORNER_LIFT, ...SIGNATURE, DING, ...PETAL_FALL, ...WHITES, ...CLOUD_SHADOW.flat(), ...APPROACH.map((a) => a[0]), ...INK_DRY];
  for (let b = 0; b * BAR < LOCAL; b++) if (!all.some((n) => n >= b * BAR && n < (b + 1) * BAR)) p.push(`bar ${b + 1} (frames ${b * BAR}-${(b + 1) * BAR}) has no authored event: check it against section 5 before trusting G-AIR`);
  return p;
};
