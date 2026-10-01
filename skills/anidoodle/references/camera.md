# The camera: one dolly, keyed on the frame grid

`engine/src/canvas-core/camera.ts` is the camera. A film either draws in world coordinates
inside `begin()`/`end()` (the transform path: dirty boxes stay right because the camera rides
the `Gfx` transform stack), or asks `toScreen()` where a world point lands and draws there (the
projector path). Both come from the same state, so a caption pinned to the frame and the world
it floats over can never disagree. Everything is a pure function of the frame: the same camera
question gets the same answer on any machine, in any order.

## The move

```ts
import { Camera } from "./camera";

const cam = new Camera([W / 2, H / 2], [
  { f: 0,   look: [400, 300], zoom: 1, ease: "inout" }, // ease governs the segment this key LEAVES
  { f: 90,  look: [900, 300], zoom: 2 },
  { f: 150, look: [900, 300], zoom: 2 },                // a hold: say it, don't imply it
  { f: 240, look: [400, 300], zoom: 1 },
]);
cam.shake({ from: 96, to: 126, amp: 14, seed: 7, rot: 0.004 }); // an impact, ringing down
```

- **Zoom is interpolated in log2.** A zoom is a ratio: halving the apparent size twice should
  take twice as long as halving it once. Ease the zoom value itself and a long push-in sprints
  at the near end and crawls at the far one; easing log2(zoom) spends time evenly per stop.
- **Easing per segment, `inout` (easeInOutCubic) by default.** A camera move with no live
  operator should accelerate gently and arrive gently. `linear` reads as mechanical, `out`
  alone reads as interrupted, `in` alone as a fall.
- **A zoom path with several keys** breathes at every key under per-segment easing. Pass
  `monoZoom: true` to run one monotone cubic through all the zoom keys in log2 instead: smooth,
  never overshooting into a scale it was not given, never reversing.
- **Authored paths**: for a camera that follows a creature or a curve, pass
  `path: (f) => ({ look, zoom })` instead of keys. Same camera, same shake, same projections.

## Depth planes (parallax)

The camera sits at distance D = 1/zoom from the hero plane (z = 0). A plane at depth z scales
by `1/(D + z)` and moves with it: near planes swing wide, far ones barely stir, and every
element at a depth agrees with every other, because there is only one camera. Positive z
recedes; a negative z crosses the lens (grass across the glass). Pass the plane's z to
`begin(g, f, z)` or `toScreen(p, f, z)`. One dolly, one number, and the parallax is true for
every element at once: do not hand each plane its own drift.

## Shake

`shake({ from, to, amp, seed, freq, rot, attack })` registers an impact or a handheld stretch:

- **amp in SCREEN pixels**, so the shake reads the same at any zoom; **rot** in radians at full
  strength, about the frame's centre. A small rotation is what actually sells handheld.
- The envelope is an **attack ramp** (default 2 frames) into a **squared decay**: full strength
  at the hit, gone a beat later. An impact rings down; it does not stop mid-air.
- The motion is **low-frequency gradient noise**, seeded, never white noise per frame. Static
  per frame reads as a faulty projector; smooth noise reads as mass. `freq` is cycles per frame
  (default 0.35, about 10 Hz at 30 fps; drop it for a heavier camera).
- Shake is folded into `shaken(f)`, which `begin` and `toScreen` read, so the drawn world and
  any projected overlay shake together. `at(f)` stays clean for driving things that must not
  shake (the score, a cue grid).

## Line weight at close range

Ink is authored at some view; at zoom S the same nib reads S times heavier. Divide stroke widths
by `weight(cam)` = S^0.35. Not S: a little weight gain is what makes a close-up feel close
rather than enlarged.

## The two drawing paths

```ts
// transform path: the world moves, you draw in world units
cam.begin(g, f);                    // hero plane
meadow(g, f);
cam.end(g);
cam.begin(g, f, 2.2);               // a farther plane
hills(g, f);
cam.end(g);

// projector path: ask where things are, draw them there (cached surfaces, screen-space type)
const at = cam.toScreen(flower.centre, f, flower.z);
const k = cam.scaleAt(cam.at(f), flower.z);
```

`toWorld(s, f, z)` inverts `toScreen`, for hit-testing or for pinning world content to a screen
point. The camera never touches the context itself, the clock, or `Math.random`: it is
arithmetic over `(frame, keys, seed)`, which is what keeps the determinism contract intact.
