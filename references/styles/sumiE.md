# Sumi-e (ink painting on xuan)

Module: `engine/src/canvas-core/sumiE.ts` (kit: `sumiEKit.ts`). Hero: bamboo in wind with a tree sparrow.

**The medium, physically.** One soft goat-and-wolf-hair brush, loaded from an inkstone, on unsized
xuan paper that drinks ink the moment it touches. Nothing is corrected or covered: every mark is
one gesture, laid once.

**The mark.** A brush of real hairs (`brush()` in the kit). Each hair carries its own ink load and
spends it with travel, edge hairs first. Loaded, the hairs merge into one solid mark; running dry,
they skip where the paper wins, which gives flying white (飞白): bare-paper streaks running *with*
the stroke, and split hairs splaying at the lift. The brush is a cone: outer hairs touch down later
and lift sooner, so ends are pointed or rounded, never square.

**The edge.** Soft and feathered where wet: at every slow point (touch-down, the pause at a node,
the lift) the ink bleeds into the fibres as a halo with fine feathers wicking outward. Broken and
bristled where dry. `wet` > 0 lays a stroke into damp paper and softens the whole edge (the
sparrow's belly wash). There is never a drawn outline.

**Tone.** Only by dilution, the five inks: scorched (1), thick (0.82), heavy (0.6), light (0.38),
clear (0.2). Dilute sumi goes a little cool, never brown. A single stroke never stacks with itself
(it is rendered as one opaque mark, then laid at its tone); ink darkens only where a second stroke
crosses the first, which is why overlapping leaves show darker lozenges.

**Order.** The Mustard Seed Garden order: stalks first, each in single upward strokes one segment
at a time, the brush pausing and lifting at every node (segments short at the base, longest
mid-stalk); nodes in darker ink; branches out of the nodes; leaves as pressed-lifted strokes in
groups, front leaves thick ink, back leaves light; the bird in the manual's order (beak, eye, head,
back, wing, tail, belly, feet); dry accents (grass flicks, moss dots); the seal stamped last.

**Palette.** One ink stick, five dilutions, and one cinnabar seal (`#b8352b`, multiplied, with the
glyphs cut in so they print as paper). The glyphs are an invented seal-script mark, not text.

**Paper.** Warm unbleached xuan `#f3ede0`, long vat fibres and bark flecks drawn as geometry in
the ground, `paper` at 0.1 and `coldpress` at 0.045 multiplied over everything. No tooth.

**Not its nearest neighbour (`wren`, ink & line-wash).** Wren washes colour first and then draws
a flexible-nib LINE round the forms; sumi-e has no line and no colour: the form IS the brush
stroke, one gesture per leaf, and tone comes only from dilution. Wren's washes pool at the
bottom edge of a shape; sumi-e ink bleeds at slow points of the brush's path, and dries into
flying white along its length.

**Motion grammar.** The film is the painting being made: a stroke grows along its path at a
hand's pace (long stalk segments fast, bird strokes slower), a slow point keeps soaking after the
brush leaves it (the halo grows over a few frames), a beat of pause between passes, the seal
pressed in one short press. Nothing fades or scales in.

**Kit primitives (candidates for core).** `runProcess` + `timeline` (a still that draws itself as
timed ops over an extend-only done-cache) and `brush` (hair-model stroke with ink load, flying
white and fibre bleed). Films built on them should set `meta.raster: "cpu"`: the extra cached
surface otherwise pushes Chromium into mixing GPU and software rasterisation, and frames stop
being identical across render orders.
