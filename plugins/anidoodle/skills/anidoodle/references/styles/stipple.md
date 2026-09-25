# Stipple (pen-and-ink dots) · `stipple.ts`

**Medium, physically.** One technical pen (0.25 mm), never changed, touched straight down onto hot-press bristol thousands of times. No line, no hatch, no wash. The pen is held a touch off vertical, so each dot is slightly oval and slightly ragged; now and then it drags a hair of tail as it lifts, now and then it runs dry and a dot comes up grey.

**The mark.** A dot of one size. Tone is only how many dots sit in a square centimetre (weighted-Voronoi / Secord 2002 distribution: blue noise, no clumps, spacing ~1.5 px / tone^0.64 at 1080). Built as variable-radius Poisson-disk sampling over a 1-px tone raster computed from the subject's real structure and one lamp (`stippleKit.ts`).

**The edge.** There are no contours. An edge is where dot density changes; in full light the edge is simply lost (the upper-left rim of the shell).

**Order.** Darkest masses first (chamber shadows, the body chamber's cast shadow, contact shadow), then out into the mid tones, then a few sparse passes over the lit nacre. Each pass works across the sheet in patches (a snake of ~84 px cells), not in a raster. A beat of rest between passes.

**Palette & paper.** Carbon black a hair warm (#15120e) on bright bristol (#fbfaf5); the core `paper` tile at 5%, nothing else.

**Not its neighbour.** `mellan` is one continuous line whose width carries tone; `pocketWatch` builds tone with hatching directions. Stipple has no direction at all: the only variable is density.

**Motion grammar.** Marks arrive; nothing moves. A film is the stippler's time-lapse: dots accumulate pass by pass (~100 per frame), the dark masses establish the drawing before any light tone exists. Never fade dots in; never move them.
