# Ink & line-wash, drawn (wren draw-on)

Module: `engine/src/canvas-core/wrenDraw.ts`. Plate: `wren.ts` (unchanged). Hero: a Eurasian wren
singing on a hawthorn twig.

**The medium, physically.** Watercolour washes on cold-press paper, then a flexible steel nib in
dark ink over the dried washes.

**The marks, in order.** Every wash goes down first, then all the pen work, then the spatter.
- **A wash is laid as a bead.** The loaded brush touches the top of the shape, and the bead of wet
  paint is pulled down it, with a wavering wet front and a darker line of pigment riding that front.
- **The pigment settles.** Once the shape is covered, the pigment slides down and pools along its
  bottom edge (the gradient band sinks and deepens).
- **The backrun.** Where a second, wetter drop touched the damp body, a pale cauliflower opens
  outward and its crinkled dark rim rides the edge.
- **Wash order.** Background (one big bead across the sheet), twig, leaves, haws, and the haw
  highlights lifted out; then the bird light to dark: tail, body (with its backrun), belly buff,
  rufous back, wing, the eyebrow lifted, the eyestripe.
- **The pen.** The bird first, as the focal subject: contour (left open where the light eats it,
  pressed at the belly), bill and gape, eyestripe, eye, breast flicks, tail and its barring, wing,
  covert spots, flank, legs and toes. Then the twig: bark edges, thorns, ticks, leaves, haws. Each
  line grows along its path through `g.pen({ progress })`, heavy where pressed, hair-thin at the lift.
- **Spatter.** The pen is shaken, and the dots land one after another.

**Exactness.** `wren.ts` is untouched, so its hero md5 is unchanged. The process re-authors the
same geometry as timed marks. In line-wash order, the bird's washes composite before the twig's
ink (the still does the twig whole, then the bird), so the finished process differs from the still
by about 240 overlap pixels (57.7 dB PSNR). The last 30 frames are therefore `drawWren` itself,
byte for byte. That needs GPU raster (the default, as wren has): with `raster: "cpu"`, or with the
still cached on an offscreen surface, the hold was measured NOT identical to the wren still.
