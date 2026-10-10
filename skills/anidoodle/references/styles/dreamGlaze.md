# Dream glaze (hand-painted dream) · `dreamGlazeKit.ts` + `dreamGlaze.ts`

**Medium, physically.** Oil thinned with resin, laid in thin glazes with a very small soft brush on a smooth white ground. The surface is enamel-flat: no bristle, no ridge, no visible stroke. This is the hand of the "hand-painted dream photograph": an impossible scene painted as carefully as a still life.

**The mark.** None that shows. A form is turned by value steps too fine to see, so the unit is the single pixel, each one lit by the same sun. Every standing thing is a height field (`Obj.at` returns its edge distance, its height toward the eye, two surface coordinates and a material); the kit takes the normal from the heights and hands it to your painter, which asks `sunAt` whether the sun reaches that point (it walks toward the sun across the heights) and calls `light` to mix a warm sun, a cool sky and a warm bounce from the ground. Nothing is a stroke, a gradient fill or a blur.

**The edge.** Hard, near and far alike. Depth is haze and scale, never softness. A thing a mile off is as sharp as a thing at arm's length, only smaller and paler.

**Order.** A white primed panel; the drawing in thin umber; the sky laid twice (a thin glaze, then the full one) in rows from the top; the plain the same way; each form, furthest first, laid in its shadow tone; the cast shadows; the small accents (handwriting, lashes, stars); the main form worked up dark to light, last and slowest; the signature.

**Space and light.** A pinhole camera over an endless plain, the horizon low. One low sun, front-left: every form is lit from it and every shadow rakes right and away, computed on the ground from the same alpha that draws the object. Small figures and repeated objects give the scale.

**Palette & ground.** Ultramarine falling through turquoise to lemon at the horizon; an ochre and umber plain; waxy flesh; violet-umber shadows; one saturated orange, kept for a single accent. A fine linen weave at 4% and the core `paper` tile at 5%; the corners a little sunk, as old varnish does.

**Not its neighbour.** `paintedOil` shows its bristle, loses its edges into shadow and works wet into wet. Dream glaze hides the brush and keeps every edge; its drama is in the idea and the light, never in the paint.

**Kit and plate.** `dreamGlazeKit.ts` is the hand and nothing else: noise and colour, `sunlight()`, the `Obj` height field, `raise()` and `paintForms()`, `surface()`, and the two film gestures `rows()` / `laid()` and `workPlan()` / `workUp()`. It holds no face, no object and no prop. `dreamGlaze.ts` is one picture made with it. Build a new picture on the kit: write your own `Obj`s, your own painter and your own ground. Do not import from the plate. Its mask, question marks, scroll, spark and far-off repeats belong to that one picture and are not vocabulary of the style; a second picture that reuses them is the same picture again.

**Subject rule.** The hand is only half of it. The picture needs soft things that should be hard, things held up that should fall, one object repeated to the horizon, and one image hiding a second meaning. Invent your own props for your own subject; never re-stage a known painting.

**Motion grammar.** Marks arrive; nothing fades. Grounds are laid in boustrophedon rows whose lower edge wavers (`rows`, `laid`). Forms are laid in a shadow tone and then worked up: a ceiling on lightness rises across the form, so shadows finish first and highlights last (`workPlan`, `workUp`). Handwriting runs out along its line. The last frames are the still, pixel for pixel.
