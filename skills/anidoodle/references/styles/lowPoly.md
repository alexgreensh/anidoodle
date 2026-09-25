# Low-poly (`lowPoly.ts`)

**Medium, physically.** None, by design: a scene MODELLED as triangle meshes, PROJECTED by hand
through a pinhole camera (a translate, one pitch rotation, a divide: no 3D engine), FLAT-SHADED
(each triangle one colour from its normal against one light plus a cool sky ambient, hazed toward
the dawn by distance), and drawn by PAINTER'S SORT, far to near.

**The mark.** The facet: a hard-edged triangle. No line in the finished picture (a same-colour
hairline only closes antialias seams), no gradient, no texture. The triangulation IS the texture,
so the grid is built perspective-friendly (columns widen with distance, rows grow ~12%) and
jittered, which keeps facets about the same size on screen.

**Meshes.** A heightfield: lake basin (clamped to the water plane, so water is just faces of the
same grid), shores, a low front range, a high back range with a notch the sun clears, snow on
high faces that face up. Pines: a trunk and three six-sided cone tiers, placed in drifts with
bare rests. A canoe lofted from 13 cross-sections: outer hull culled by its outward normal, inner
walls by their inward one, thwarts, a paddle. The sky is 2D facets (a jittered grid, coloured by
height and distance to the sun), faceted clouds lit from below, a faceted sun glow.

**Reflections.** The same meshes mirrored in the water plane, darkened toward the water, drawn
only where water is visible (a mask built by the same painter's pass: water white, solid faces
erasing), then broken by horizontal ripple cuts; a glitter path of short dashes under the sun.

**Order of marks.** The empty viewport (dark grid). The wireframe, edge by edge: terrain swept
from the far ranges to the near shore, then trees, then the canoe. The faces shading in exactly
in painter's order: sky top-down, then far to near. Water facets far to near. Reflections far to
near. Ripple cuts and glitter last.

**Palette.** Dawn: indigo `#262c5c` to violet `#5b4f8a` to rose `#d98f98` to peach `#f6bf92`;
sun-facing slopes peach-rose, the rest blue-violet; spruce `#23463b`; canoe red `#b3392b`.

**Not its neighbours.** Every other plate is a hand's mark on a surface; this is geometry.

**Motion grammar.** A modeller's viewport: lines are laid then covered by faces; nothing slides.
If a camera ever moves, re-project every frame (never scale the bitmap) and keep facets flat.
