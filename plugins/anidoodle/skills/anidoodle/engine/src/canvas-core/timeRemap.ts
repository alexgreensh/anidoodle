// TIME REMAP. Speed ramps, slow motion and freeze frames as one pure map from the film's frame to
// the scene's frame: draw the scene at remap.at(f) instead of f. Nothing else changes, so the
// determinism contract holds by construction (the scene is still a pure function of a number).
//
//   const t = timeRemap([
//     { f: 90,  speed: 0.3, ramp: 8 },                            // ease down into slow motion before the peak
//     { f: 120, speed: 0, keepsMoving: "the name writes itself" },  // a freeze: the world stops, one thing does not
//     { f: 156, speed: 1, ramp: 12 },                             // ease back to real time
//   ]);
//   scene(g, t.at(f));        // the remapped world
//   name(g, f);               // what keeps moving through the freeze stays on the film's own frame
//
// CRAFT, and why it works this way:
// - SPEED IS WHAT YOU KEY, TIME IS ITS INTEGRAL. A key sets the speed from its frame on (scene
//   frames per film frame); scene time is the area under that speed, worked out exactly. So time
//   never jumps, never runs backwards, and every position in the scene stays continuous.
// - A RAMP EASES THE SPEED, NOT THE TIME. With a ramp the speed glides from the old value to the new
//   one over that many frames on a smoothstep, so it is continuous too and starts and ends with no
//   kick: a body in flight slows the way a camera slows it, not the way a cut does. ramp: 0 is a
//   hard change of speed, for a deliberate snap.
// - A FREEZE MUST KEEP SOMETHING MOVING. A speed of 0 is refused unless the key says, in words, what
//   keeps moving on the film's own frame (a name being written, the camera creeping in, dust still
//   settling). A frozen frame with nothing moving is dead air, and the gate would fail the film.
// - SCORE AND SOUND STAY ON REAL TIME. The remap never touches audio: music is cued by film frame,
//   and so are effects. To land a sound on a remapped event, find the film frame that shows it with
//   filmFrameOf(sceneFrame). A slowed world under a score at its own tempo is the effect.
// Every function here is arithmetic over (frame, keys): no clock, no state, any order.

// WHERE A KEY SITS, IN NAMED UNITS. `f` is a film frame. `film: s` is film time in seconds and `scene:
// s` is SCENE time in seconds (the key lands on the first film frame that shows that scene moment);
// both need timeRemap(keys, { fps }). Exactly one of the three, never a bare number: a brand launch
// logo keys were typed in scene seconds where film seconds were meant, and nothing complained.
export type TimeKey = {
  f?: number;             // the film frame this speed starts from (whole, increasing)
  film?: number;          // or: film time in seconds (needs fps)
  scene?: number;         // or: scene time in seconds, resolved through the keys before this one (needs fps)
  speed: number;          // scene frames per film frame from here on: 1 real time, 0.25 slow motion, 0 a freeze, 2 fast (0 or at least MIN_SPEED)
  ramp?: number;          // frames over which the speed glides from the old value to this one (default 0, a hard change)
  curve?: "smooth" | "linear"; // the glide's shape: smoothstep (default; no kick at either end) or a straight line
  keepsMoving?: string;   // required when speed is 0: what still moves, on the film's frame, through the freeze
};
export type Freeze = { from: number; to: number; keepsMoving: string }; // film frames [from, to); to is Infinity if never released
export type TimeRemap = {
  /** The scene frame shown on film frame f (fractional in slow motion: the scene must draw between its frames). */
  at: (f: number) => number;
  /** Scene frames per film frame at f. */
  speedAt: (f: number) => number;
  /** The first whole film frame that shows scene frame t: where a sound for a scene event is cued. */
  filmFrameOf: (t: number) => number;
  /** Every stretch where the scene stands still, with what keeps moving through it. */
  freezes: Freeze[];
};

// the glide's shape e(u) and its integral from 0 to u, so time under a ramp is exact
const CURVES = {
  smooth: { e: (u: number) => u * u * (3 - 2 * u), area: (u: number) => u * u * u - (u * u * u * u) / 2 },
  linear: { e: (u: number) => u, area: (u: number) => (u * u) / 2 },
} as const;

/** The slowest a scene may run without being a freeze. Below it the world looks stopped, so it must be a declared freeze. */
export const MIN_SPEED = 0.01;

type Seg = { f: number; from: number; to: number; ramp: number; curve: (typeof CURVES)["smooth"]; t0: number };

export const timeRemap = (input: readonly TimeKey[], opts: { fps?: number } = {}): TimeRemap => {
  const keys = resolveKeys(input, opts.fps);
  let last = -1, prevSpeed = 1;
  const segs: Seg[] = [], freezes: Freeze[] = [];
  // the frames first, all of them, so a later check never reports a symptom of keys out of order
  for (const [i, k] of keys.entries()) {
    if (!Number.isInteger(k.f) || k.f < 0) throw new Error(`timeRemap: key ${i} is at frame ${k.f}; keys sit on whole film frames from 0`);
    if (k.f <= last) throw new Error(`timeRemap: keys must increase (${last} then ${k.f})`);
    last = k.f;
  }
  for (const [i, k] of keys.entries()) {
    if (!Number.isFinite(k.speed) || k.speed < 0) throw new Error(`timeRemap: speed at frame ${k.f} must be a number of 0 or more (got ${k.speed}); time never runs backwards`);
    if (k.speed > 0 && k.speed < MIN_SPEED) throw new Error(`timeRemap: speed ${k.speed} at frame ${k.f} looks frozen; use speed 0 with keepsMoving, or at least ${MIN_SPEED}`);
    const ramp = k.ramp ?? 0, curve = k.curve ?? "smooth", next = keys[i + 1]?.f;
    if (!Number.isFinite(ramp) || ramp < 0) throw new Error(`timeRemap: ramp at frame ${k.f} must be 0 or more frames (got ${ramp})`);
    if (!(curve in CURVES)) throw new Error(`timeRemap: curve at frame ${k.f} is "smooth" or "linear" (got ${curve})`);
    if (next !== undefined && k.f + ramp > next) throw new Error(`timeRemap: the ramp from frame ${k.f} runs ${ramp} frames, past the next key at ${next}`);
    if (k.speed === 0 && !(typeof k.keepsMoving === "string" && k.keepsMoving.trim())) throw new Error(`timeRemap: the freeze at frame ${k.f} must say what keeps moving (keepsMoving), or it is dead air`);
    // scene time at this key: the previous segment's area up to here
    const t = segs.length ? sceneAt(segs[segs.length - 1], k.f) : k.f;
    segs.push({ f: k.f, from: prevSpeed, to: k.speed, ramp, curve: CURVES[curve], t0: t });
    if (k.speed === 0 && (next ?? Infinity) > k.f + ramp) freezes.push({ from: k.f + ramp, to: next ?? Infinity, keepsMoving: k.keepsMoving!.trim() });
    prevSpeed = k.speed;
  }
  const segAt = (f: number): Seg | undefined => { let s: Seg | undefined; for (const x of segs) { if (x.f <= f) s = x; else break; } return s; };
  const at = (f: number): number => { if (!Number.isFinite(f)) throw new Error(`timeRemap: frame must be a number (got ${f})`); const s = segAt(f); return s ? sceneAt(s, f) : f; };
  const speedAt = (f: number): number => {
    if (!Number.isFinite(f)) throw new Error(`timeRemap: frame must be a number (got ${f})`);
    const s = segAt(f); if (!s) return 1;
    const x = f - s.f; return s.ramp > 0 && x < s.ramp ? s.from + (s.to - s.from) * s.curve.e(x / s.ramp) : s.to;
  };
  const filmFrameOf = (target: number): number => {
    if (!Number.isFinite(target)) throw new Error(`filmFrameOf: scene frame must be a number (got ${target})`);
    const reached = (f: number) => at(f) >= target - 1e-9;
    let lo = Math.min(-1, Math.floor(target) - 1); // before the first key the scene runs at real time, so at(lo) = lo < target
    const tail = segs[segs.length - 1], start = tail ? tail.f + tail.ramp : 0;
    let hi = Math.max(1, Math.ceil(start), Math.ceil(target));
    if (!reached(hi)) {
      if (tail && tail.to === 0) throw new Error(`filmFrameOf: scene frame ${target} is never shown; the film stays frozen at scene frame ${at(hi).toFixed(2)}`);
      const rate = tail ? tail.to : 1; hi += Math.ceil((target - at(hi)) / rate) + 1;
      while (!reached(hi)) hi += Math.ceil(1 / rate) + 1; // guards rounding only
      if (!Number.isSafeInteger(hi)) throw new Error(`filmFrameOf: scene frame ${target} is past any film frame`);
    }
    while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (reached(mid)) hi = mid; else lo = mid; }
    return hi;
  };
  return { at, speedAt, filmFrameOf, freezes };
};

// scene time inside one segment: the area under its speed from the key to film frame f
const sceneAt = (s: Seg, f: number): number => {
  const x = f - s.f;
  if (s.ramp > 0 && x < s.ramp) return s.t0 + s.ramp * (s.from * (x / s.ramp) + (s.to - s.from) * s.curve.area(x / s.ramp));
  return s.t0 + s.ramp * (s.from + (s.to - s.from) * s.curve.area(1)) + s.to * (x - s.ramp);
};

// Every key's place in film frames, from whichever unit it names. A scene-time key is found on the
// remap built from the keys before it, so "the logo starts at scene 30 s" means what it says even
// after a slowdown earlier in the film.
type Resolved = TimeKey & { f: number };
const resolveKeys = (keys: readonly TimeKey[], fps?: number): Resolved[] => {
  const out: Resolved[] = [];
  for (const [i, k] of keys.entries()) {
    if (typeof k !== "object" || k === null) throw new Error(`timeRemap: key ${i} is ${JSON.stringify(k)}; a key is an object that names its unit: { f: frame }, { film: seconds } or { scene: seconds }, plus speed`);
    const named = (["f", "film", "scene"] as const).filter((u) => k[u] !== undefined);
    if (named.length !== 1) throw new Error(`timeRemap: key ${i} ${named.length ? `names ${named.join(" and ")}` : "names no time"}; give exactly one of f (film frame), film (film seconds) or scene (scene seconds)`);
    const u = named[0], v = k[u]!;
    if (!Number.isFinite(v)) throw new Error(`timeRemap: key ${i} has ${u} = ${v}; it must be a number`);
    if (u === "f") { out.push({ ...k, f: v }); continue; }
    if (!(fps && fps > 0)) throw new Error(`timeRemap: key ${i} is in ${u} seconds; pass timeRemap(keys, { fps }) so seconds can become frames`);
    if (u === "film") { out.push({ ...k, f: Math.round(v * fps) }); continue; }
    const before = timeRemap(out.map(({ f, speed, ramp, curve, keepsMoving }) => ({ f, speed, ramp, curve, keepsMoving })));
    out.push({ ...k, f: before.filmFrameOf(v * fps) });
  }
  return out;
};
