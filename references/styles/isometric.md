# Isometric cutaway · `isometric.ts`

**Medium, physically.** A flat vector illustration on a true 2:1 isometric (dimetric) grid, built the way an iso illustrator works in a pen-tool program. World x -> screen (u, u/2), y -> (-u, u/2), z -> (0, -1.2247u): every horizontal edge is a 2:1 line, every vertical is vertical, a cube reads as a cube (`Iso` in `isometricKit.ts`).

**The mark.** The plane: pen-traced outline (kept inside the plane), then a flat fill. The 2:1 hairline. The flat light shape.

**The edge.** Vector-crisp. No contour line: tone meets tone. Each material has exactly three tones (top lightest, +y face middle, +x face darkest); curved things obey the same cube rule (a dome is three flat regions split on the meridian that projects vertical, plus an up-facing cap).

**Order.** Iso grid ruled across the ground -> massing blocks (translucent construction boxes, strokes clipped inside so none survives) -> walls and floors -> interiors (oven, loft, racks, table, ladder) -> props (bread, sacks, the baker) -> light and shadow -> details (tile joints, brick courses, plank lines, plaster speckle, window stars, flour).

**Palette & light.** Night-cool ambient on warm materials (everything but the bread is stepped a notch into the dark), so the only saturated warmth is the oven. The oven mouth is the one light: faces that can see it take ONE flat warm tint stepped in three distance bands (`warmBox`), the floor pool is three flat bands, cast shadows are single flat shapes thrown away from the mouth. No gradients anywhere.

**Figures.** Authored in screen space over the projected foot point, 7.5 heads, three tones per garment, the rim of warm light on the side that faces the source.

**Not its neighbour.** `koi` inks a thick-thin contour by hand; here there is no line and no hand at all, the projection is the style and the order is construction-first.

**Motion grammar.** Construction time-lapse: things are laid in painter's order but revealed stage by stage; a plane is traced then filled top-down; light is poured last. Camera never moves in the process film.
