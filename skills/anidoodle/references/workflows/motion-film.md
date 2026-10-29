# Motion films: one world, one camera

**Contents:** Why one world · Start a film as one world · The kit · Type that enters and leaves · Brand temperament · Approved shots stay approved · The scans · Exceptions, declared · Rendering with blur

A motion-graphics film (a launch, a promo, an explainer in a clean register) is judged first on
whether it moves like one piece. A brand launch film built scene by scene, each scene rebuilding its
own layout, was called "a literal slide deck" four times; both of its critics flagged the same
carousel in its middle. The cure is architectural, and the scans below hold it.

## Why one world

Every beat is a **region** placed on one canvas in world coordinates, and a single **camera** travels
between them. Nothing is rebuilt per scene, so nothing can cut like a slide: every seam is a camera
move, and the thing on screen at the end of one beat is still in the world at the start of the next.
Regions clip their own drawing by default, so one region never leaks an edge into its neighbour.

## Start a film as one world

```bash
node tools/worldfilm.mjs promo --beats 4 --format 16x9 --temperament calm   # writes the film and its host page
node tools/motionscan.mjs promo && node tools/layerscan.mjs promo              # the scaffold passes both as written
```

`engine/src/canvas-core/world.ts`:

```ts
const w = world({ W: 1920, H: 1080, regions: [{ id: "chat", rect: [0, 0, 1600, 900] }, { id: "crowd", rect: [1900, 200, 2400, 1350] }],
  stops: [{ f: 0, at: "chat", hold: 90 }, { f: 150, at: "crowd", hold: 60 }], alive: { amp: 3, seed: 7 } });
w.begin(ctx, env, f);                          // the camera's transform: draw in world units
w.region(ctx, "chat", () => drawChat(ctx));    // clipped to its rect
w.end(ctx);
w.depth(ctx, env, f, 0.33, () => frieze(ctx)); // a layer of brand shapes at a third of the camera's speed
```

A stop with no frames to travel is refused: that is the slide cut. `minTravel(px, maxPxPerFrame)`
gives the frames a move needs at the temperament's top speed. `regionAt(f)` and `moves()` list where
the camera is and every seam. Regions may be a function of the frame shape, so one world re-composes
for 9:16 from day one.

## The kit

`engine/src/canvas-core/motionKit.ts`, all pure arithmetic over the frame:

| Call | For |
|---|---|
| `alternate(i, ["left", "right"])`, `entryFrom(i)` | the i-th item of a list enters from a different side each time: a program never plays as a carousel |
| `chatScroll(f, steps)` | a chat column that scrolls over 18 to 24 frames on an ease-out; a snap is refused |
| `temperament("calm" \| "lively" \| "snappy" \| spec)` | the brand's motion as numbers: top speed, settle frames, overshoot or not, an arrival ease |
| `cubicBezier(x1, y1, x2, y2)`, `motionTokens(BRAND.motion, fps)` | a brand's own easings (from `brand.mjs`) as eases and frame counts |
| `typeExit(q)` | how far a line has sunk on its way out (ease-in, 1.3x its size) |
| `sharp(() => draw())` | marks a layer the motion blur must leave sharp |
| `landSquash(t, land, { brand, gag })` | squash on landing, volume kept; refused on a brand mark unless the gag is named |

`world({ alive })` gives the camera a slow breath; `w.depth` the parallax layer. People: `people.ts`
places cut-outs by head height (`drawPerson`, `popOut`). Brand marks: `brandKit.ts`.

## Type that enters and leaves

- `setType(ctx, env, text, x, y, size, p, { out })`: words rise in, and with `out` sink out last
  word first on an **ease-in** over 1.3x their size, so they clear the clip edge at speed. A sink that
  eased out decelerated into the mask and left slivers for half a second ("check each and every frame").
- `{ space: "world" }` draws inside the current transform (a camera, a region); the default resets to
  screen space.
- Type and photos leave in 0.5 to 0.7 s and are never blurred (`../motion-grammar.md`).
- Holds come from the words: `readable.ts` (`chatHold`, `readS`, `paced`, `texture`, `fitText`).

## Brand temperament

Set `meta.motion.temperament` before any motion is built. Too violent and too flat are both a
missing temperament. `motionscan` fails any stretch faster than its top speed.

## Approved shots stay approved

When the person approves a shot, freeze it: `node tools/lock.mjs <film> --shot logo` prints its sha;
put `["logo", "<sha>", "<who approved it, and when>"]` in `meta.motion.approved`. `lock.mjs <film>`
fails if its frames change; `--unlock logo` lets a deliberate change through, which is the moment to
ask the person again. A shot that was "improved" in passing had to be rebuilt exactly.

## The scans

| Tool | Reads | Fails |
|---|---|---|
| `motionscan.mjs <film\|file.mp4>` | the rendered file (any MP4) | **slidecut**: most of the content replaced within 6 frames with no camera move, more than 2 a minute; **repeat**: 3 beats in a row settle into one layout (a carousel); **dissolve**: a cross-dissolve or fade-in over a real share of the frame; **temperament**: faster than the film allows |
| `layerscan.mjs <film>` | what each frame draws | **exits**: text residue at its clip edge for 0.2 s or more; **fasttext**: type faster than half the speed ceiling; **faces**: a moving shape (any probe box, brand marks included) over the top 30% of a person's photo; **translucent**: a brand colour filled between 5% and 95% alpha |
| `lock.mjs <film>` | approved shots | a locked shot that changed or went missing |

A check with no input says N/A with its reason (no temperament declared, no photos, no brand
colours); the ship command lists those, never counts them as passes.

## Exceptions, declared

`meta.motion.allow = { slideCut: [[from, to, reason]], dissolve: [...], translucent: [...] }`: a hard
cut on a strong beat, a dissolve the story needs, a declared brand fade. Each has its reason.
`meta.motion.brandColors` comes from `brandMotion` in the module `brand.mjs import` writes.

## Rendering with blur

`render.mjs --blur auto` blurs fast moves by their real speed and keeps text, photos and anything in
`sharp()` crisp (the pixels they own come from the sharp frame); `--blur-all` blurs everything, the
old behaviour. Text baked into a cached plate is blurred with the plate: draw type on the frame. Every
render writes `<out>.film.json` (film id, frames, blur, sha256, meta), so a renamed or versioned file
is still checked as its film.
