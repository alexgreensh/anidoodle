# Oil on canvas

Module: `engine/src/canvas-core/paintedOil.ts` (kit: `paintedOilKit.ts`, process runner from `sumiEKit.ts`).
Hero: two pears and a copper pot by a window (the window just out of frame, left).

**The medium, physically.** Oil paint on stretched plain-weave linen, primed with lead white, then
toned with a thin rub of burnt sienna and umber (the imprimatura). Hog-bristle flats and
filberts. The paint is lean (thinned) in the early passes and fat (straight from the tube) at the end.

**The mark.** A flat bristle stroke (`oilStroke`). It lands square and fully loaded. Each bristle
lays its own line, varying a few percent in value, so every stroke is streaked along its length.
As the paint runs out, the outer bristles break first, and the end of the stroke drags into
streaks over the layer beneath. Each stroke carries two colours: the colour it was loaded with,
and the one it picks up by the end (wet into wet), sampled from the light model at both ends.

**The edge.** Ridges: paint is shoved up at both edges of the brush. The ridge turned to the window
catches a thin light line, and the far ridge a thin dark one. Bristle grooves run down the middle,
and paint piles across the end where the brush lifted. Impasto highlights are short, thick dabs
that stand off the canvas, with a hairline cast shadow away from the light. Object edges are found
on the lit side (clipped crisply against the ground already laid) and lost in shadow. There, the
value of the shadow side is brought to the value of the dark wall, so no line is left to find.

**Order.** White priming → toning rub → thin burnt-umber drawing (small round brush, searching
lines, shadow shapes scrubbed in) → dark masses everywhere with a big brush and lean paint → mid
tones → lights with a smaller brush and fatter paint → impasto highlights → final dark accents
(stems, calyx, contact shadows). Background strokes never cross the objects (an even-odd clip), so
each object keeps its own passes.

**Size hierarchy.** A big flat (~130 px) lays the wall in few steep diagonal passes, with the toned ground left between them. Broad horizontals lay the table. A medium brush follows each form. A small brush does the accents only. Strokes feather in (`soft`), so no stroke starts as a square slab.

**Form and direction.** Strokes follow each form's own structure. The copper pot is painted in hoops
round its belly: one eye-level ellipse ratio (0.17 at the rim, 0.205 at the foot), with the stroke curvature
exaggerated as a painter would. It carries a warm body, a dark core and warm reflected light; the window's sky is 3 cool
strokes that follow the curvature, plus one specular dab. The pears are bodies of revolution (bulb and neck on
an axis), their strokes wrapping each cross-section; the lying one is foreshortened, with its neck turning away. The table is laid along the grain, and the wall is scumbled on a drifting diagonal.

**Palette.** A Chardin kitchen palette: umbers, burnt sienna, yellow ochre, terre verte, Naples
yellow, lead white. The copper is a mirror model: it shows a narrow window band left of centre,
painted as a painter reads it (body, core, reflected light, cool sky strokes), not computed as a mirror.

**Canvas.** A plain-weave linen tile (`weave`), 10 threads per 34 px, each crossing a lit bump. It
is multiplied at 0.55 into the ground and at 0.3 over the finished paint.

**Not its nearest neighbour (`ranunculus`, pencil & watercolour).** Watercolour is transparent: it
is laid light to dark, it never covers, and the paper is the white. Oil is opaque: it is laid dark
to light, every pass covers the one before, the white is lead-white paint, and the texture is the
paint's own relief (ridges, impasto) over canvas weave, not granulation on paper.

**Motion grammar.** The painting is being made. Each pass works across its area in a sweep. A
stroke is laid along its path at a hand's pace, and several quick marks fit in one frame
(fractional op windows) during the block-in. The impasto dabs are slower. There is a beat of
pause between passes. Nothing fades or scales in.
