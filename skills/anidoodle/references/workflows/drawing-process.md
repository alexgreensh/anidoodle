# A picture that draws itself

Every hand in the gallery ships two things from one source: the finished still and a film of it
being made, mark by mark, in the order an artist in that medium works. The film's last frames
are the still, pixel for pixel. This is the timelapse people share, the making-of, the teaching
step, and the explainer's diagram assembling.

## Rules

- **Frame 0 is the bare ground**: paper, board, linen, black clay, a blank screen.
- **The medium's own order**: watercolour lays in pencil, then light washes, darker washes, detail,
  line. Woodcut prints the keyblock, then colour blocks light to dark. Pixel art blocks flat
  masses, cleans the line, shades clusters, adds highlights. Oil tones the ground, blocks in dark
  to light, finishes with impasto. Embroidery pulls each stitch through. Each plate's header says
  its order.
- **Marks are made, never faded**: a stroke grows along its path, a wash spreads from where the
  brush touched, a brick drops and seats, a stamp lands.
- **A hand's pace**: long strokes fast, fiddly ones slow, a short rest between passes (up to half a
  second; the gate allows it for `kind: "drawing"`).
- **The last stretch is the still**: declare it with `meta.holds` so the gate knows it is meant.

## How to build one

Declare `meta.kind: "drawing"` and the final hold. Then either:
- **Author the process**: list the marks as timed operations and replay them over a cache that only
  grows (the pattern in `colouredPencilKit.ts` `replay`, `sumiEKit.ts` `runProcess`,
  `brokenColourKit.ts` `staged`); or
- **Add a clock to an existing plate**: an optional parameter that gates each draw call by its
  pass; with no clock the plate draws exactly as before (check the hero's md5 before and after).

Set `meta.raster: "cpu"` for process films built on replay caches; mixed GPU and software
rasterisation breaks determinism.

## The gate for drawing films

`kind: "drawing"` judges dead air over one second at a 0.02% changed-area floor (fine pencil lines
change little per frame) and allows rests up to half a second. A freeze longer than that still
fails, because a viewer sees it.
