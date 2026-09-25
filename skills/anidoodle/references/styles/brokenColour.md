# Broken colour (`brokenColour.ts`, kit in `brokenColourKit.ts`)

**Medium, physically.** Oil straight from the tube on a lead-white primed linen, one sitting,
out of doors. A flat hog-bristle brush, loaded and put down ONCE: it lands blunt, pushes a ridge
of paint up along one side (lighter), leaves a groove on the other (darker), and drags thin where
it lifts; big strokes break into dry bristle tails. Colours are not mixed into the colour of the
thing: two or three unmixed colours sit side by side and the eye mixes them. The linen weave
(`weave`, a seeded plain-weave tile) is multiplied last and shows in the thin lay-in and the gaps.

**The marks.** Short, separate, opaque dabs (`brush` kind 0). Their colour is SAMPLED from an
analytic colour field (`field(u, v)`: the motif as smooth colour, regions, stroke direction and
dab size), then broken: hue +-0.03, value +-0.07, saturation up. Complementary accents are
dropped in by rule, never scattered evenly: orange/rose into blue shadow, violet/lilac into gold.
Directions follow the plane: water flat and long, sky varied (patches hatched up-right,
down-right or flat, lying along the cloud banks, turning part way round the sun), town low and
level, hulls along the hull, figures upright. Masts, oars, placement lines: one pull of a rigger
(kind 1). The lay-in: a thin scrubbed stroke of separate bristles (kind 2).

**Edge.** No outlines anywhere. A form ends where its dabs stop. Boats are dark dabs against
light dabs; edges are found only on the sunlit rims and lost into the haze elsewhere. The sun
is dabs too: cream-yellow core laid every which way, orange round it, orange and pink breaking
its edge into the halo. A clean circle is a craft-bar failure.

**Order of marks.** (1) thin warm imprimatura, scrubbed, alternating direction; (2) placement in
thinned ultramarine; (3) masses in big dabs whose colour is the AVERAGE of a wide neighbourhood
(boats blocked in with their own dark); (4) broken dabs everywhere, sky to water, visited along
a smooth order field (never per-cell random: that leaves vertical seams); (5) boats, masts,
town, sun restated along their forms; (6) accents; (7) reflections as horizontal bars, sun path
then boats; (8) oars and the last sparkles on the crests.

**Palette.** High key. Lead white, cadmium orange and red, chrome yellow, rose madder, cobalt
violet, ultramarine, viridian. No black: the darkest dark is ultramarine + rose.

**Light.** One low sun behind the subject; contre-jour silhouettes with warm rims on the sun side;
reflections stretch DOWN and break into bars (each ripple sees another slice of sky).

**Not its neighbours.** Not pencil & watercolour (`ranunculus`): nothing is transparent, there is
no line and no wash that misses its outline; colour is placed, not flooded. Not an oil impasto
plate that models form dark-to-light: here form comes from temperature, not value.

**Motion grammar.** A still that paints itself (`staged`): every dab is pulled along its length in
2-4 frames, passes abut (the next starts one frame before the last ends), the order field makes
the painting advance in an irregular front, never a scanline. Finished prefix cached; frame
order cannot change pixels.

**Gotchas paid for.** `smoothstep(t, 0.3t, x)` with t = 0 divides by zero and paints a full-height
column: guard it. A per-patch random draw order leaves vertical seams wherever two patches meet.
