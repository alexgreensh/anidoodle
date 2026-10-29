// TIME. The shared vocabulary every 3D module speaks. A frame number goes in, a number comes out;
// nothing here keeps state, so any frame can be drawn first.
//
//   seg(f, a, b)        0 before frame a, 1 after frame b, linear between (the workhorse)
//   ease.*              shaping curves on [0, 1]
//   spring(f, at, ...)  a damped spring that was kicked at frame `at`, in closed form: follow-through
//                       and settle WITHOUT simulating from frame 0, so it stays seekable
//   storyClock(...)     maps the film's real frames onto the frames the shots were written in, so a
//                       narrator that stretches the film is a table edit, not 100 hand-moved numbers

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** progress of frame f through [a, b]: 0 before, 1 after */
export const seg = (f: number, a: number, b: number) => (b <= a ? (f >= a ? 1 : 0) : clamp01((f - a) / (b - a)));

export type Ease = (t: number) => number;
const back = 1.70158;
export const ease = {
  linear: ((t) => t) as Ease,
  inQuad: ((t) => t * t) as Ease,
  outQuad: ((t) => 1 - (1 - t) * (1 - t)) as Ease,
  inOutQuad: ((t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)) as Ease,
  inCubic: ((t) => t * t * t) as Ease,
  outCubic: ((t) => 1 - (1 - t) ** 3) as Ease,
  inOutCubic: ((t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)) as Ease,
  outQuint: ((t) => 1 - (1 - t) ** 5) as Ease,
  inOutSine: ((t) => -(Math.cos(Math.PI * t) - 1) / 2) as Ease,
  outExpo: ((t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))) as Ease,
  inOutExpo: ((t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2)) as Ease,
  /** overshoots then lands: pops, drops, arrivals */
  outBack: ((t) => 1 + (back + 1) * (t - 1) ** 3 + back * (t - 1) ** 2) as Ease,
  /** pulls back first: anticipation before a move */
  inBack: ((t) => (back + 1) * t * t * t - back * t * t) as Ease,
  outElastic: ((t) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1)) as Ease,
  outBounce: ((t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; }) as Ease,
  /** smoothstep: soft in and out, the default for camera moves */
  smooth: ((t) => t * t * (3 - 2 * t)) as Ease,
};
/** eased progress of frame f through [a, b] */
export const tween = (f: number, a: number, b: number, e: Ease = ease.inOutCubic) => e(seg(f, a, b));

/**
 * A damped spring kicked at frame `at`: returns the displacement (starting at 1, ringing down to 0)
 * at frame f. Multiply by an amplitude for follow-through (an antenna after a stop, a jar swinging
 * after a turn). Closed form, so frame 300 never needs frames 0-299. freq in Hz, damping 0-1.
 */
export const spring = (f: number, at: number, fps: number, freq = 2.2, damping = 0.28) => {
  // a 0 fps or a 0 Hz spring has no time to ring in: it would return NaN, and a NaN position draws nothing
  if (!(fps > 0) || !Number.isFinite(fps)) throw new Error(`spring: fps must be a positive number of frames per second (got ${fps})`);
  if (!(freq > 0) || !Number.isFinite(freq)) throw new Error(`spring: freq must be a positive number of Hz (got ${freq})`);
  if (f < at) return 0;
  const t = (f - at) / fps, w = 2 * Math.PI * freq, z = Math.min(0.999, Math.max(0, damping)), wd = w * Math.sqrt(1 - z * z);
  return Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
};

/** frames per beat at a tempo; integer when the film's grid is valid (validate() enforces it) */
export const beatFrames = (bpm: number, fps: number) => (60 * fps) / bpm;

/**
 * STORY CLOCK. Shots are written against story frames (the grid they were planned on). When the
 * narration or the score stretches the film, give the real frame of each story anchor and every
 * shot follows: between anchors, time maps linearly. Anchors must increase in both columns.
 *   const clock = storyClock([[0, 0], [240, 300], [480, 590]]);   // [storyFrame, realFrame]
 *   draw: (ctx, local, env) => shot(clock.story(start + local) - storyStart)
 * real(f) goes the other way. For cyclic motion that must keep its real speed (a walk, flicker),
 * use the real frame directly.
 */
export const storyClock = (anchors: [story: number, real: number][]) => {
  if (!anchors.length) throw new Error("storyClock: give at least one [storyFrame, realFrame] anchor");
  const a = [...anchors].sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < a.length; i++) if (!(a[i][0] > a[i - 1][0] && a[i][1] > a[i - 1][1])) throw new Error(`storyClock: anchors must increase in both columns (at ${a[i - 1]} -> ${a[i]})`);
  const map = (x: number, from: 0 | 1, to: 0 | 1) => {
    if (a.length === 1) return x - a[0][from] + a[0][to];
    let i = 0; while (i < a.length - 2 && x > a[i + 1][from]) i++;
    const [p, q] = [a[i], a[i + 1]];
    return p[to] + ((x - p[from]) * (q[to] - p[to])) / (q[from] - p[from]);
  };
  return { story: (real: number) => map(real, 1, 0), real: (story: number) => map(story, 0, 1) };
};
