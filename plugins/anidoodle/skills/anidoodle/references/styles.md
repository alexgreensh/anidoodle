# Styles: nine hands, and the kit they are drawn with

A style is a way of making a MARK, and it goes deeper than a palette. The same fox drawn by a
crayon kid, a collage artist and a printmaker changes shape, edge and light, and it changes in
the order the marks go down. Recolouring one drawing gives you one drawing in nine outfits.
Every plate below is a working module in `engine/src/canvas-core/`: open it before you draw in
its style, because the header comment is the recipe and the code is the proof.

Render any of them: `node tools/still.mjs koi --out out/koi.png`. The whole sheet:
`node tools/still.mjs styleGallery`.

## The nine

| # | Style | Module | The mark that makes it |
|---|---|---|---|
| 1 | Pencil & watercolour | `ranunculus.ts` | washes that never quite fill their outline, form shaded toward ONE light, graphite over the paint |
| 2 | Marker comic | `koi.ts` | flat cel fills with a hard shadow edge, one heavy contour that thickens away from the light |
| 3 | Ballpoint sketch | `pocketWatch.ts` | one biro, near-constant weight; tone comes only from WHERE hatching sits (single, cross, third direction) plus the blob where a firm stroke stops |
| 4 | Crayon | `balloon.ts` | back-and-forth scribble fills that skip the paper's valleys, a darker crayon over the shade side, a white one burnishing the highlight, a fat contour gone over twice |
| 5 | Ink & line-wash | `wren.ts` | wet washes first that flood past the line and settle along each shape's BOTTOM edge, backruns, then a flexible nib, thick on the press, hair-thin on the lift, contours left open where light eats the edge |
| 6 | Chalkboard | `moonPhases.ts` | side-of-the-chalk scumble, lit limbs worked twice, every stroke broken by the board's tooth with dust either side, ghosts of old lessons |
| 7 | Cut-paper collage | `fox.ts` | zero drawn lines: torn pieces with a white fibrous edge, scissor pieces crisp, each lifting off the one below with a soft shadow |
| 8 | Risograph | `lighthouse.ts` | one layer per drum, multiplied through its own registration offset; every other colour is an OVERPRINT; tone is a halftone screen per ink angle; white is bare paper |
| 9 | Single-line engraving | `mellan.ts` | one unbroken spiral whose width follows a procedural tone field: the whole picture is a single stroke |

Two more hands live in the worked film (`example/`): a **cyanotype blueprint** (ruling pen,
`draftTooth` + `blueMottle` tiles, `inkGroup` halos, inclined gothic lettering) and a **storybook
pencil + watercolour** character (`storybook.ts`). `print.ts` is the same character in riso.

## Picking one

Pick for the JOB before the looks. The same idea reads differently in each.

| The piece is | Reach for |
|---|---|
| warm, human, a brand with a smile | pencil & watercolour, crayon, cut paper |
| a serious topic, a report, a founder essay | ballpoint, ink & line-wash, engraving |
| an explainer, a how-it-works, an infographic | chalkboard, blueprint, ballpoint with drafted labels |
| loud, social, a launch | marker comic, risograph |
| a poster, a cover, one image people keep | engraving, risograph, cut paper |

A brand picks ONE hand and keeps it: every hero, spot and card afterwards in the same mark is
what makes a set feel like a system.

## Your own style

Start from the nearest plate and change the MARK, never just the colours:

1. **Name the medium physically.** What touches the paper, how wet, how it lifts, what the paper
   does back. Write it as the header comment before any code, like the nine above.
2. **Set a `Medium`** for pen-based hands: `{ nib, taper, pressure, retrace, wobble, rough }`.
   Compare `PENCIL`, `BIRO_M` (pocketWatch), `CRAYON_M` (balloon), `INK_M` (wren), `CHALK_M`
   (moonPhases), `LITHO` (riso). A biro has almost no taper; a flexible nib has a lot of pressure.
3. **Decide the order of the marks.** Wash then line (line-wash), line then wash (pencil &
   watercolour), plate by plate (riso), piece by piece (collage). The order is half the style.
4. **Pick the paper**: which tiles, at what opacity, applied last.
5. **Render one still of the hardest subject in it** and critique it against the craft table in
   `realism-and-craft.md` before you use the style for anything else.

## The kit

Everything is geometry plus a few composited layers. No filters, no assets.

**`core.ts`** is the drawing surface and shape helpers.
- `new Gfx(ctx, env, frame, medium)`, the surface. `frame` drives line boil in motion; a still passes 0.
- `g.group("paint" | "ink" | "plain", fn, { blend, alpha, off, textures, blur })`: draw on a
  layer, texture it once, composite only what was touched. `paint` softens + granulates, `ink`
  gets pencil tooth, `plain` is for cut or printed media.
- `g.pen(pts, { w, color, seed, closed, wobble, boil, taper, opacity, retrace, progress })`:
  a tapered, pressure-shaped stroke. `progress < 1` draws it partway, cut on the centreline,
  which is how a line is seen being MADE.
- `g.form(pts, color, shade, { light, hi })`: a shaded volume toward one light, optional highlight.
- `g.wash(pts, color, { alpha, dx, dy, shrink, rim })`: watercolour that misses its outline, pigment at the rim.
- `g.fill`, `g.hatch`, `g.glow`, `g.paper(tile, opacity)`, `g.vignette`, `g.inkGroup` (line with a halo).
- Shapes: `oval`, `softBox`, `arc`, `line(a, b, bow)`, `tube(centre, r0, r1)`, `poly`, `turn`,
  `sample` (smooth a polyline), `jitter`, `displace` (noise-displaced geometry), `halftone`.
- Randomness: `rng(seed)`, `fractal(seed, x, y, fx, fy, octaves)`.
- Tiles: `paper`, `coldpress`, `pencilTooth`, `washGran`, `risoSpeck`, `risoMottle`, `draftTooth`, `blueMottle`.

**`gallery.ts`** holds the representational helpers the plates share: `body(ctrl, halfWidth)`
(a spine with a width profile, for fish, birds, limbs), `profile(knots)`, `ink(g, centre, color, opts)`
(a contour ribbon that thickens away from the light), `blob` (an organic closed shape),
`hatchRuns` (hatching clipped to a shape), `fillShape`, `clipped`, `inside`, `mix`, `resample`.

**`riso.ts`** covers printmaking: `INK` colours, `drum(g, offset, fn)`, `screen(...)` (a halftone driven by a
tone function), `REG` offsets, `cut` (a hand-cut edge), `plateMarks`, `across` (a 0..1 gradient across a shape).

**Lettering, drawn as strokes so no font is ever loaded.**
- `drafting.ts`: `letter(g, text, x, y, { cap, color, seed, w, progress })`, single-stroke
  inclined gothic capitals, the lettering of engineering drawings. Labels, callouts, captions,
  infographic numbers. `progress` writes it on.
- `lettering.ts`: pointed-pen script, width from how much each stretch travels downward. It
  spells one authored word (the banner's); a new word means authoring its centrelines the same way.
