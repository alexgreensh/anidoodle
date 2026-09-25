# State the realism, and make texture by hand

> Doctrine earned making MECHANICAL LEPIDOPTERA, the worked example in `example/`. Every rule
> below was paid for on that film; where a mistake was the director's own it says so, because
> a rule with its scar attached is one people keep.

**The mistake, in four rounds.** Asked for "the butterfly, alive, in watercolour", we produced:

1. **Abstract.** Wings as long flat pink ribbons between ruled grey bars, a blue capsule for a body, antennae as lines with dots, no legs. My own spec line was "wings as stained glass". That sentence produced those panels. I withdrew it in writing.
2. **Washed out.** Anatomically improved and so pale it sat behind its own flowers. Watercolour is not "low opacity". It is thin FIRST washes with full-strength pigment dropped in where form turns. The client had to ask for "real pigment depth" as a hard requirement. That should have been in the brief.
3. **Stepped on.** The first side view folded the wing about its own midline with a single `abs()` in the transform, which turns one wing into a symmetrical moth lying flat: a butterfly somebody trod on. Then the body was drawn OVER the closed wings, the abdomen stuck out behind, and it read as a mosquito.
4. **Real**, once the brief said what real meant.

**Why.** A model asked for a subject draws the ICON of the subject, the thing a road sign would use. Icons are symmetrical, flat, outlined and built from primitives. Realism is a list of specific departures from the icon, and if the list is not written down, none of them happen.

**The rules.**

- **Name the anatomy, part by part.** For our creature: two true wing pairs with the forewing overlapping the hindwing's leading third; a closed discal cell; veins that fork, never cross and thin toward a margin scalloped between their ends; a fringe; a furred thorax; seven or eight tapering abdominal segments with paler bands; compound eyes with a highlight; palps; ringed antennae ending in true clubs; a coiled proboscis; six jointed legs that grip when perched and tuck in flight; an underside pattern that is different and quieter than the upper side. A specialist should be able to name every part on your still.
- **Open reference and say which.** The rebuild's file header names the four images actually looked at (a labelled venation plate, a generic wing for topology, a lateral photograph for the underside, a head macro). Borrow structure, never a real species' pattern: the subject stays original.
- **When the subject is a transformation, write the mapping.** Ours was a table: spar → vein, panel → wing cell, rivet → submarginal spot, housing → furred thorax, coiled wire → antenna, hairspring → proboscis. The mapping IS the shot. Without it we got "gears on the left, colour on the right", which the client rejected on sight. With it, every frame of the change is already anatomy.
- **"Keeps its position" means literally.** The first veins left the cell on bearings of their own and read as ruled lines in a new colour. The vein runs where the spar ran; what is new is the cell and the forks.
- **Avoid the hard collapsed profile.** A flat thing seen exactly edge-on is a line, and a winged thing seen exactly side-on with wings shut is a smear. Prefer three-quarter views and half-open poses. If the story truly needs the side view (ours did: butterflies sip with wings closed), AUTHOR it as a second view with its own control points. A closed wing is the same wing stood up, not a folded one. Draw the body under the wings. Never derive a profile by squashing the top view.
- **Form, then colour.** One named light direction for the whole film. Core shadow, reflected light, cast shadow onto whatever it touches, contact. Translucent things let 15 to 20 percent of what is behind them through. A subject with no cast shadow is pasted on, however well it is drawn.
- **Prove realism on ONE still: the specimen plate.** The subject alone, large, on plain paper, top view and side view together, like a page from a natural-history folio. No scene, no motion, no excuses. It is the cheapest image you will make and it settles the animal before it is put into forty shots. We made ours late, after two rounds of scene stills that were really arguments about the animal.
- **The same goes for every recurring subject.** Our ranunculus got its own section: petals painted from the centre out as overlapping C-strokes with slivers of bare paper between them, a tight green button, five authored views, and a rejected-on-sight list (concentric scalloped circles, a mathematical spiral, a pompom, straight stems). The first pass still came back with faceted low-poly centres and a magenta pompom, which tells you the list is necessary and not sufficient: you still have to look.

---

## Texture without filters

**Why no filters.** `ctx.filter` does not exist in Safari, is not guaranteed in headless or offscreen contexts, and SVG filters compute in linear RGB on a schedule of their own. A film that depends on them is not backend-agnostic. And, to be plain about it, filters are also how machine-drawn work gets its plastic look: one Gaussian blur over everything. Doing texture by hand is a constraint that improves the picture.

**The method.**
- **Seeded, tileable noise tiles**, built once per environment and cached by key: periodic gradient noise summed over octaves, 512 px, one tile per material (paper tooth, cold-press, ink tooth, wash granulation, riso speck, blueprint mottle). Same seed, same tile, every machine. Building them costs most of a second per page, so warm up before you measure anything.
- **Composite per layer, by meaning.** Alpha textures go on with `destination-in` (the ink only exists where the tooth lets it). Paper goes on with `multiply`. Patterns draw in the current transform, which is how texture scales with a subject; do not "fix" that.
- **Anything that was a displacement filter becomes displaced GEOMETRY.** Jitter the control points, roughen the ribbon's edge, let a wash miss its outline. Transform points and then ink them, so line weight survives foreshortening and zoom (we use `weight x zoom^0.35`, so a 3x close-up is about 1.5x heavier, not 3x).
- **Blur without `filter`:** draw small and draw back up, or stack offset copies at low alpha. A halo is one blurred copy of linework you already drew, not the group drawn twice (that change alone took a 187 ms frame to under 100).
- **Anchor texture to the WORLD, not the screen.** Screen-fixed grain crawls over the drawing the moment the camera moves and reads as noise. Bring up a finer octave as you zoom in, or close-ups go soft.
- **Texture belongs to its material.** We multiplied cream-stock grain over a whole frame that was still half blueprint, and the cut that was supposed to be invisible measured 28.8 dB. Clipped to the printed region it measured 41.
- **Scale-aware marks.** A wash that displaces its outline by a fixed thirteen units is right for a wing panel, turns a twenty-pixel petal into porridge and turns a thousand-pixel macro panel into an airbrushed ribbon. Size every mark relative to the thing it is drawing, and check the look at the closest AND the widest scale the film uses.
- **Ported from SVG?** Convert grey tiles from linear to sRGB or the grain comes out visibly greyer.
- **Medium-true motion comes from the same place.** Misregistered ink that lags a fast move and catches up; halftone dots that swell with wing speed; a wash that spreads from where the brush touched and pools at its wet edge; paint that trails its pencil by a few pixels. Each is a texture parameter driven by the cue table. That is how a medium moves, and it is worth more than any amount of generic easing.

---
