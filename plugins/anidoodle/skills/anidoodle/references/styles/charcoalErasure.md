# Charcoal, erased and redrawn (`charcoalErasure.ts`)

**Medium, physically.** Willow vine charcoal (a soft grey stick that skates over the tooth and dusts
off at a breath) and compressed charcoal (black, crisp, bites into the paper and barely erases), on
one sheet of heavy cream rag paper with a strong tooth. A paper stump rubs tone into the valleys; a
kneaded eraser lifts light back out, and never lifts all of it.

**The marks.**
- The stick's point for structure: vine first (light, powdery, broken by the tooth), compressed last (black, crisp).
- The SIDE of the stick for tone: broad parallel drags clipped to a region (`sideMarks`).
- The stump: a wide, soft zigzag rub (`zigzag` + `rubMark`, blurred group, `ce_blend` tooth) that turns drags into atmosphere.
- The kneaded eraser: the same rub with `destination-out` on the charcoal layer, partial alpha and a streak tile, so erased light is streaky in the drag direction and always leaves grey residue.

**Edge.** Vine: powdery, bitten. Compressed: crisp. Stumped tone: no edge at all. Erased edge: streaky.

**Order.** Tone the sheet (sky), lift the light (the sun) with the eraser, lay the subject in with
vine, build the structure, accents in compressed, ground and cast shadow, lift highlights. Then the
signature: **erase and redraw**. Every change is rubbed out with the kneaded eraser (partly), re-toned,
and redrawn on top of its own residue. Nothing is ever fully gone.

**Palette.** One warm black (`#1b1917`) on cream (`#ece5d5`). Value only.

**Paper.** A felt-marked sheet tile multiplied under the charcoal, and the paper tooth multiplied OVER
it, so the grain shows through the blacks. Charcoal lives on its own transparent layer so the eraser
can remove it; the paper is never erased.

**What makes it NOT its neighbour** (`pocketWatch`, ballpoint): tone is rubbed and lifted, never
hatched; the eraser is a drawing tool; the sheet carries its own history.

**Motion grammar.** The film IS the erase-redraw cycle. Every pass is a list of marks laid one after
another (`runPass`); a stroke grows from where the stick touched, tone arrives drag by drag, the stump
and eraser travel their zigzags. A breath (12% of a pass) between passes. Finished passes are cached as
layers keyed by pass index + scale + size, so a frame only draws the pass in progress.

**The hero.** An open-grown English oak through four seasons on one sheet, whole, left of centre, on a
ground line in the lower third, with bare paper round it. The sun is upper right, lifted from a small
feathered haze (never a toned sheet). Each season the old sun is re-toned and a new one lifted; the
shadow falls lower left (long in winter, a pool in summer, long and low in autumn). Erasures stay
local to what changed, so the final still shows faint earlier states of the same tree: the summer mass
as a whisper, and the calm winter branches under the wind-bent autumn twigs.
