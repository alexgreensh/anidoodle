# Marker comic, drawn (koiDraw)

Module: `engine/src/canvas-core/koiDraw.ts` over `koi.ts` (optional `KoiClock` 4th argument to `drawKoi`; without it every branch takes the original call, and the plate's md5 is unchanged: 1x dfd5350f5c2b94d030d7c62e34d2dc7d, 2x 27ebed84ad3a09aac4336d124d6e2707).

**Process.** Non-photo-blue lay-in (spine gesture, masses, parts) -> flat cel fills lightest first, each laid in back-and-forth chisel-marker passes that start and stop past the pencil line; a wide area (the pond) is filled in blocks of short passes, so its leading edge is ragged, never a wipe -> hard shadow shapes and floor shadows -> details (scale arcs, fin rays, streaks, rings, gel-pen whites) -> the heavy brush-pen contour LAST, each stroke growing along its centreline.

**Stacking.** Every element is drawn in its own z order every frame and only its extent grows, so a fin laid before the body still sits under it. The marker is opaque here: pencil vanishes under it.

**Kit.** `koiDrawKit.ts`: `streaks`/`streakClip` (a marker or brush laying a flat), `cut` (a line's first q by arc length), `part`/`stagger`, `sequence`/`cueClock` (a strict cue table: a missing cue throws instead of drawing that mark finished at frame 0).
