# 3D films and 3D motion graphics

**Contents:** 3D or 2D: one medium per film · Benchmark before the look still · A 3D shot · The contract in 3D · The kit, by job · The craft bar in 3D · The checks, and what each catches · Rendering

A 3D shot is an ordinary shot. three.js renders into WebGL, `draw3d` copies the pixels onto the
frame's 2D canvas, and every tool (still, render, gate, framecheck, captions, emit, the score)
works on it unchanged. The Film workflow in `SKILL.md` still runs in full: three sentences, one
look still, one music sample, a fresh critic. This page adds what is different in 3D.

## 3D or 2D: one medium per film

Pick 3D when the subject is solid things in light: extruded type, products and objects, toys
and puppets, a camera that travels through space, stop-motion. Pick 2D when the marks are the
point: any of the drawn styles, a drawing that makes itself, ink and paint. The 2D style plates
have no 3D version, so a request for "watercolour, but 3D" is a question to ask, not a build.

Make the medium a brief question ("all drawn, or all 3D?") and keep one medium for the whole
film. The last 3D film rejected four mixed looks before the one that worked: code-painted 2D, pasted
reference pixels, a drawn world with a 3D puppet composited on top, a painted backdrop behind 3D.
Each read as two films glued together. Build a hybrid only when the person asks for one. Finish
layers drawn over the 3D frame (subtitles, grain, vignette, a plated title) are not a second medium.

## Benchmark before the look still

The kit makes it easy to put a lit, bevelled object on screen, and that is the trap: a capsule
robot, a box house and lollipop trees under default materials render cleanly, pass every check,
and still read as a beginner's three.js scene. It happened on this kit's first flagship still
(graded 7 by its builder, rejected on sight). Clean is the floor. The bar is designed 3D, and you
cannot hold a bar you have not looked at.

So before the look still, build a reference board:

1. **Find 6 to 12 real references** of excellent stylized 3D close to the brief: award-winning
   WebGL work, stylized 3D studios, stylized games and films (a paper world that comes alive
   points at Tearaway; a miniature town at Townscaper). Open them and look; do not work from memory.
2. **Write what makes each one work**: shape language and proportions (characters designed as
   shapes with a silhouette, never a stack of capsules), bevel softness, material recipe, light,
   palette, depth and atmosphere, lens and framing, how dense the small detail is.
3. **Pick ONE benchmark** and say which techniques you take from it. References are rebuilt in
   code; their pixels never ship.
4. **Critique the still side by side with the benchmark**, by a fresh critic
   (`references/workflows/review.md`), and grade against the benchmark, never against "it works".
   A still that would look out of place next to its benchmark is not done.

## A 3D shot

```ts
import * as THREE from "three";                       // the vendored build, resolved by the bundler
import { draw3d, memo } from "../three-core/stage";
import { orbit, place } from "../three-core/camera";

const build = () => { /* scene, meshes, lights, camera: built once, never reads the frame */ };
const shot = (ctx: Ctx, f: number, env: Env) => {
  const s = memo(env, "myShot", build);               // the same objects every frame
  s.star.rotation.y = (f / 96) * Math.PI * 2;         // every moving value SET from f, every frame
  place(s.cam, orbit([0, 0, 0], 0, 40, 6, 1.5, 0, 96)(f), env); // camera first, then anything placed on screen
  draw3d(ctx, env, s.scene, s.cam, { clear: "#0f0d1a" });
  // 2D finish on top: subtitles, grain, vignette
};
```

`engine/src/canvas-core/threeHello.ts` is the smallest whole film. `threeMotionDemo.ts`,
`threeTypeDemo.ts` and `threeRigDemo.ts` beside it show the motion, type and character kits.

## The contract in 3D

Frames render in parallel chunks and out of order, so frame N has to be the same picture however
it is reached. 3D makes that easy to break, because a scene graph remembers.

- **Pure in the frame.** Build once with `memo`, then set every moving value (position, rotation,
  scale, opacity, colour, morph, camera) from the frame number on every draw. A value left over from
  the frame before is the classic 3D bug: on the last film a dropped broom vanished when a render
  chunk started after the drop, and a firefly was placed with the previous drawing's camera.
  When a shot needs a pose from an earlier beat, rebuild it at that fixed beat, read it, and throw
  it away. Never carry it in a `let`.
- **No clock.** No `Math.random`, `Date`, `performance.now`, `setAnimationLoop`, `THREE.Clock`,
  `mixer.update(dt)`. An `AnimationMixer` is driven with `mixer.setTime(f / fps)`. The gate's
  contract scan reads `src/three-core` as well as `src/canvas-core` and fails on these.
- **Seeded randomness**: `rand(seed)` from `three-core/stage.ts`, one seed per system, so adding
  one effect does not reshuffle another.
- **Import three as `import * as THREE from "three"` in each file, and never re-export the
  namespace.** Re-exporting stops the bundler dropping the unused parts, which drags three's file
  loaders (which can fetch) into the player, and the gate fails a player that can reach the network.
- **`ss` supersampling, default 2** (`draw3d(..., { ss })`, 1 to 3): rendered at 2x and scaled down,
  so edges are smooth and identical on every backend. MSAA varies by driver; do not turn it on.
- **Shadows are off by default** (`{ shadows: true }` turns on soft shadow maps). A shadow is a
  choice, and shadow acne is the first cheap-3D tell.
- Fonts arrive as data: `defaultFont()` is Poppins Bold, inlined from `engine/assets/fonts/`
  (OFL, provenance in `engine/assets/fonts/PROVENANCE.md`). three.js itself is vendored, scanned
  and hash-pinned: `engine/vendor/three/PROVENANCE.md`.

## The kit, by job

All in `engine/src/three-core/`. Every function takes the frame and returns or sets a value; none keeps state.

| Job | Module | What to reach for |
|---|---|---|
| Stage | `stage.ts` | `stage`, `draw3d` (render and copy to the frame), `memo`, `rand`, `probe3d` |
| Time | `time.ts` | `seg`, `tween`, `ease.*`, `spring` (closed form, seekable), `beatFrames`, `storyClock` |
| Timeline | `timeline.ts` | `timeline(fps, { labels, words, beat })` with `tl.at`, `tl.value`, `tl.check`; clips `to`, `fromTo`, `set`, `wait`, `all`, `chain`, `sequence`, `delay`, `loop`; `mix` (colours in linear light) |
| Camera | `camera.ts` | `look`, `place`, `hold`, `then`, `withMods`; `pushIn`, `pullBack`, `dolly` + `path`, `orbit`, `crane`, `truck`, `pan`, `tilt`, `whipPan`; mods `handheld`, `dutch`, `zoom`; `fitTo`, `rackFocus`; `matchCut`, `matchLens`, `screenPx`, `screenSize`, `worldForPx` |
| Motion graphics | `mograph.ts` | `popIn`/`popOut`, `dropIn`, `riseFromFloor`, `growFrom`, `fadeIn`/`fadeOut`, `extrudeIn`, `writeOn`/`drawTo`, `moveAlongPath`, `morph` + `writeTube`, `explode`/`assemble`, `indicate`, `wiggle`, `wave`; groups `lagged`, `grid`, `kinetic` (per letter) |
| Type | `type3d.ts`, `ttf.ts` | `text3d(env, font, text, opts)` (one mesh per letter, `userData.letters`), `textPlane` (flat crisp text in the scene), `defaultFont`, `parseTTF` for another TrueType face |
| Look | `look.ts` | rigs `studio`, `night`, `interior`, `sunset`; materials `matte`, `satin`, `toon`, `glass`, `emissiveGlow`; `outline` (`screen: true` for a width in pixels), `contactShadow`, `softShadows`, `grain`, `vignette` |
| Transitions | `transitions.ts` | `transition(ctx, env, t, kind, drawA, drawB)` with `crossfade`, `wipe`, `radialWipe`, `noiseWipe` (ink blot), `slide`, `zoomThrough`; t at 0 or 1 is exactly A or B |
| Characters | `rig.ts` | `makeRig`, `part`, `anchor`, `limb`, `head`, `flag`, `pose`, `bodyMatrix`, `solveTwoBone`; props `handle`, `grip`, `gripFrame`; motion `lookAt`, `anticipate`, `followThrough`, `squashStretch`, `walkCycle` |
| Checks | `checks3d.ts` | `checkGrip`, `proximity`, `selfClear`, `pathClear`, `labelVisible`, `placeLabel`, `screenSizeOk`; per frame: `resetChecks`, `register*`, `runChecks` |

Mograph verbs take `(object, f, at, len)` and set their channels from the object's rest pose:
before `at` the object is in its before-state, after `at + len` it is exactly at rest. A
`timeline` `to()` on a track that was never set throws instead of moving from a silent 0.

**Two clocks for narrated or rescored films.** Write shots against story frames and map the real
frame through `storyClock([[story, real], ...])`, so a narrator who stretches the film is a table
edit (the last film retimed about 100 beat constants this way). Cyclic motion (walks, flicker,
breathing) reads the real frame, or it plays in slow motion. Keep every story action as a named
frame constant at the top of the shot. Word cues come from narration: `references/workflows/narration.md`.

## The craft bar in 3D

The test from `references/craft-bar.md` holds: would a proud maker ship it? In 3D the question is whether it
reads as a designed miniature or as an untextured blockout.

| The cheap-3D tell | What passes |
|---|---|
| Shadow acne, self-shadow creases on a character | Shadows off unless chosen; `softShadows(light)` sets acne-free biases; characters get `receiveShadow = false` and a `contactShadow` under them |
| Plastic shine | `matte` or `satin` (sheen, low specular); metal only where the thing is metal |
| Jaggies, shimmering edges | `ss: 2`; check a 2x crop |
| Black crush in the shadows | Every rig has a sky fill; `vignette` darkens toward a tinted colour, never black |
| A muddy interior lit by the outdoor rig | `interior()`: a key from above, a warm practical, a warm fill |
| Far glows going grey in fog | `emissiveGlow` (fog off): distance reads by size |
| Glass with a second, offset outline | `glass()`: front side only, thin, low IOR |
| Boxes with a glowing plane for a window | Built like a model maker would: frames, sills, bevels, varied repeated pieces |
| A hook, a lamp or a sign floating | Every part held by something (a bracket, a string, the ground); look at the joins at 2x |
| One angle per shot, a locked camera | Each shot gets an angle, a move and a seam (`references/motion-grammar.md`, `deck.mjs deal`) |
| A whip pan with smear frames | `whipPan` holds posed frames at both ends; a match cut keeps size with `matchCut`/`matchLens` |
| Frozen arms on a walking character | Limbs that pose from the start: arm counter-swing (`walkCycle`), reach with `anticipate`, props that lag (`followThrough`) |

Five rules the last film paid for, each with its check:

- **Contact beats are framed close.** A grip, a push or a hand-off reads only when the contact
  point is at least about 40 px tall at 1080p. A gate push filmed from 17 units away showed a claw
  a few pixels wide and read as nothing. `registerSize(hand.end, 40)` holds it.
- **Thin lines are sized by screen, not world units.** A fixed-width thread vanishes in a wide
  shot. Size it with `worldForPx`, or use `outline(..., { screen: true })`.
- **Labels are placed after the camera.** A tag reading "/co act" because a claw covers two letters
  is a placement problem. Set the camera, then `placeLabel` tries positions until the label reads;
  `registerLabel` flags one still hidden or turned away.
- **Hands act.** Build every rig with posable limbs and grip points before any shot. A rig whose
  arms were fixed geometry played every shot with frozen claws, and retrofitting the arms cost
  two rendered shots. `pose` throws on a flag a rig variant does not have, so nothing silently
  does nothing.
- **Grips read.** A held handle runs along the hand's grip axis through the closed grip (`grip`),
  a lantern hangs from its bail (`hang: true`). A broom, a shovel and a jar went through the claws
  for a whole first cut and nobody saw it until a critic did. Check the rig's reach before blocking a
  hand-off: when the hands cannot meet, a toss, a drop or a set-down reads better and never clips.

## The checks, and what each catches

```bash
node tools/still.mjs <film> --frames 0,48,96,150 --out out/look/ --sheet out/look-sheet.png
node tools/still.mjs <film> --frame 126 --scale 2 --out out/grip-126.png   # a 2x crop
node tools/framecheck.mjs <film>
node tools/gate.mjs <film>
```

- **Still sheets.** `--sheet` takes a file path. A bare `--sheet` swallows the next argument, so
  `--sheet --out x.png` writes the sheet to a file named `--out`.
  Then a 2x frame of every contact beat, face and join: the checks see geometry, a crop sees
  what the viewer sees.
- **framecheck** with `probe3d`: call `probe3d(ctx, env, object, camera, label)` after the camera
  is placed, for 3D type and any hero object that must be whole. framecheck then fails one cut by
  the frame edge, as it does for 2D type, and holds subtitle cues to their reading time.
- **gate**, five steps on a 3D film. DETERMINISM (the same sampled frames drawn cold and forward, then
  warm and reversed, identical) catches state carried between frames. CONTRACT catches a clock or the network.
  DEAD AIR catches stillness; declare a meant hold in `meta.holds` with its reason. ARTIFACT
  catches a player that can reach the network. **3D CHECKS** runs `checks3d` inside the page on
  about 48 sampled frames plus every frame of each grip's contact window, and fails on any finding:
  a gap or an open hand on a held prop, a prop through a hand or the holder's body, a hand off
  screen while its prop is on, a grip hidden from the lens, two rigs clipping, a walk through a
  closed prop, a label covered, a contact beat under its pixel size. For that, each draw starts with
  `resetChecks()`, registers what it holds (`registerRig`, `registerGrip`, `registerSize`,
  `registerLabel`, `registerPath`) and ends with `if (checking()) runChecks(f, camera, env)`
  (`threeRigDemo.ts`). A film that registers nothing gets a note, not a pass.
- **Rerun the whole check pass after every batch of shot changes.** A new jar swing broke a catch
  that had been clean, and only the re-run found it. A green gate with a prop through a hand is a
  failed gate, so look at the crops too.

## Rendering

- **Default: SwiftShader**, a CPU WebGL that draws the same pixels on any machine. About 1 s a
  1080p frame at `ss: 2` with soft shadows. `render.mjs` then prints its 150 ms draw budget as OVER;
  that line is information, not a failure.
- **`ANIDOODLE_GL=gpu`** uses the machine's GPU (Metal on a Mac), about 12x faster. Its hashes
  hold only on the same machine and driver, so iterate and render long films with it, and say which
  backend a published hash came from. Any tool takes it:
  `ANIDOODLE_GL=gpu node tools/render.mjs <film>`.
- A lost WebGL context throws in `draw3d` instead of writing a broken frame; re-render in a fresh page.
- Grain changes every pixel every frame and defeats compression (69 MB for 8 s at the demo's
  amount). Keep `grain` around 0.03 for long films.
- Only pages whose bundle carries the 3D marker get WebGL flags, so 2D films keep the browser
  they always had.
