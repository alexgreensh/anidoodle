# The camera: one dolly and one lens, keyed on the frame grid

**Contents:** The move · Depth planes (parallax) · Lens and dolly · Time: speed ramps, slow motion, freeze frames · Shake · Line weight at close range · The two drawing paths

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

- **The `zoom` key is the dolly**: how close the camera stands (see Lens and dolly below). It is
  interpolated in log2, because it is a ratio: halving the apparent size twice should take twice
  as long as halving it once. Ease the value itself and a long push-in sprints at the near end
  and crawls at the far one; easing log2(zoom) spends time evenly per stop. A `lens` key eases
  the same way.
- **Easing per segment, `inout` (easeInOutCubic) by default.** A camera move with no live
  operator should accelerate gently and arrive gently. `linear` reads as mechanical, `out`
  alone reads as interrupted, `in` alone as a fall.
- **A dolly path with several keys** breathes at every key under per-segment easing. Pass
  `monoZoom: true` to run one monotone cubic through all the `zoom` keys in log2 instead: smooth,
  never overshooting into a scale it was not given, never reversing.
- **Authored paths**: for a camera that follows a creature or a curve, pass
  `path: (f) => ({ look, zoom, lens? })` instead of keys. Same camera, same shake, same projections.

## Depth planes (parallax)

The camera sits at distance D = 1/zoom from the hero plane (z = 0). A plane at depth z scales
by `lens/(D + z)` and moves with it: near planes swing wide, far ones barely stir, and every
element at a depth agrees with every other, because there is only one camera. Positive z
recedes; a negative z crosses the lens (grass across the glass). Pass the plane's z to
`begin(g, f, z)` or `toScreen(p, f, z)`. One dolly, one number, and the parallax is true for
every element at once: do not hand each plane its own drift.

## Lens and dolly

Two different moves make the subject bigger, and directors name them apart:

- **A dolly** moves the camera: the `zoom` key, distance D = 1/zoom. Near planes grow faster than
  far ones, so the depth changes as it goes. This is a push-in, a pull-back, a dolly in or out.
- **A lens zoom** changes the focal length with the camera standing still: the `lens` key (1
  when no key sets it; once one does, frames before the first lens key hold that key's value, so
  key `lens: 1` where the zoom starts, as below). It multiplies every plane by the same factor about the frame's centre, so nothing
  shifts against anything else; the picture is magnified, flat. A crash zoom or punch-in is this.
  It reads as an operator's or a documentary's move, more noticed than a dolly. Use it when that
  is the voice; for travelling into a world, dolly.
- **A dolly zoom** does both against each other: the camera dollies while the lens is solved on
  every frame so the hero plane keeps its size, and the planes behind stretch away (dolly in) or
  loom (dolly out). The subject holds still in a world that has just changed shape: the moment of
  realisation (deck card `cam-vertigo-realisation`). It needs at least two planes behind the
  subject; with nothing behind it, nothing visibly happens.

```ts
import { Camera, dollyZoom, heroScale } from "./camera";

const lensIn = new Camera(c, [{ f: 0, look, zoom: 1 }, { f: 40, lens: 1, ease: "out" }, { f: 52, lens: 2.2 }]); // a crash zoom
const dolly = new Camera(c, [{ f: 0, look, zoom: 1 }, { f: 60, zoom: 2.4 }]);
const vertigo = new Camera(c, [], { path: dollyZoom((f) => dolly.at(f)) }); // holds frame 0's hero scale
// dollyZoom(path, { hold: 1.5 }) holds a given scale; { at: 30 } holds the scale the path has at frame 30
```

`heroScale(cam)` is the hero plane's screen scale (dolly times lens), and the line-weight
compensation `weight(cam)` follows it, for a lens zoom as for a dolly.

## Time: speed ramps, slow motion, freeze frames

`engine/src/canvas-core/timeRemap.ts` maps the film's frame to the scene's frame: draw the world at
`t.at(f)` instead of `f`. Speed is what you key and scene time is its exact integral, so time is
continuous, never runs backwards, and stays a pure function of the frame.

```ts
import { timeRemap } from "./timeRemap";

const t = timeRemap([
  { f: 84,  speed: 0.3, ramp: 8 },                              // ease into slow motion before the peak
  { f: 120, speed: 0, keepsMoving: "her name writes itself" },    // freeze: the world stops, the writing does not
  { f: 150, speed: 1, ramp: 14 },                               // ease back to real time
]);
world(g, t.at(f));          // the remapped scene
name(g, f);                 // the writing, on the film's own frame
cues.push({ frame: t.filmFrameOf(LANDING), kind: "paper" }); // a sound on a remapped event
```

- **Every key names its unit**: `f` (a film frame), `film` (seconds of film time) or `scene` (seconds of
  scene time, resolved through the keys before it), exactly one. A bare number throws, because a
  speed key set in scene seconds when film seconds were meant once put a logo's speed-up in the wrong
  place.
- **A ramp eases the speed**, on a smoothstep (or `curve: "linear"`), so it starts and ends with
  no kick. `ramp` defaults to 0, a deliberate hard change of speed; give it frames to glide. A slowed scene is asked for frames between its frames, so it must
  draw at fractional time (motion is a function of time, never of a frame counter).
- **Score and sound stay on real time.** The score never slows; effects are cued by film frame.
  `filmFrameOf(sceneFrame)` gives the first film frame that shows a scene event, which is where
  its sound goes.
- **A freeze must keep something moving.** A `speed: 0` key without `keepsMoving` (in words)
  throws, and so does a speed under 0.01 (`MIN_SPEED`), which looks frozen without saying so: a frozen frame with nothing moving is dead air, and the gate fails it. Drive the thing
  that moves (the name being written, the camera still creeping in) from the film's frame `f`.
  `t.freezes` lists each stop with what keeps moving.
- **Once a film for each.** One slow motion at the peak, one freeze on the telling pose (deck
  cards `emph-time-ramp`, `type-freeze-and-name`). The second halves the first.

## Shake

`shake({ from, to, amp, seed, freq, rot, attack })` registers an impact or a handheld stretch:

- **amp in SCREEN pixels**, so the shake reads the same at any dolly or lens; **rot** in radians at full
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

Ink is authored at some view; at a screen scale S (dolly times lens) the same nib reads S times
heavier. Divide stroke widths by `weight(cam)` = S^0.35. Not S: a little weight gain is what
makes a close-up feel close rather than enlarged.

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
