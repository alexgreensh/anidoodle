import type { Film } from "./film";
import { outline, printPlate, ribbon, SPIRAL_A, stillOutline } from "./mellan";

// MELLAN SPIRAL · unspooling. The still's single line, engraved from nothing, watched through a
// camera that is carried out by the burin.
//
// Frame 0 is the clean plate: paper, no ink. From frame 1 the line leaves the exact centre and
// winds outward, and the camera, which opens at ~60x on that point, pulls back in step with it,
// so the tip always sits at the same place on screen while the moon assembles around it. The
// pull-back eases to rest on the whole plate as the line passes the moon's limb; the last turns
// fill the sky's corners under a still camera, and the last frame is the still, exactly.
//
// Everything is paced by the spiral's ANGLE, not its length or ink: on a spiral the camera must
// follow the radius, and radius is angle (r = a * theta), so one clock drives both.
const N = 240;                                   // 8 s at 30 fps
const FINE = 0.02;                               // max radians per ribbon step, for the close-up opening
const V0 = 9, K = 1.3;                           // view half-width = V0 + K * tip radius (world px)
const HALF = 540, KNEE = 130;                    // the whole plate, and how softly the camera lands on it
const R_LAST = 700;                              // past this radius the spiral is clipped away entirely (plate corner = 494 * sqrt 2)

// angular speed over the film, in relative units: a readable curl at the start, rising as the
// turns get longer. It does NOT ease out: the camera does the settling, and the last turns are
// short corner slivers, so a slowing line there left the final half second measurably dead.
const speed = (u: number) => 0.12 + u ** 1.7;
const clock = (() => {                           // theta at the tip for each frame, frame 0 = nothing
  const th0 = 0.6, th1 = R_LAST / SPIRAL_A, out = [0];
  let acc = 0; const inc: number[] = [];
  for (let f = 1; f < N; f++) { acc += speed((f - 1) / (N - 2)); inc.push(acc); }
  inc.forEach((a) => out.push(th0 + ((th1 - th0) * a) / acc));
  return out;
})();
// view half-width for a tip at radius r: proportional, then a C1 quadratic landing on the plate
const view = (r: number) => {
  const raw = V0 + K * r;
  if (raw <= HALF - KNEE) return raw;
  if (raw >= HALF + KNEE) return HALF;
  const d = raw - (HALF - KNEE); return raw - (d * d) / (4 * KNEE);
};

export const mellanUnspool: Film = {
  meta: { title: "Mellan spiral · unspooling", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{
    id: "unspool", start: 0, end: N, draw: (ctx, f, env) => {
      const rb = ribbon(env.cache, FINE), th = clock[f], n = rb.th.length;
      if (f === 0) return printPlate(ctx, env, null, HALF / V0);          // the clean slate, already framed on the centre
      if (f === N - 1) return printPlate(ctx, env, stillOutline(rb), 1);        // the finished plate: the still, pixel for pixel
      let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (rb.th[m] < th) lo = m + 1; else hi = m; }
      printPlate(ctx, env, outline(rb, Math.max(2, lo + 1)), HALF / view(SPIRAL_A * th));
    },
  }],
};
