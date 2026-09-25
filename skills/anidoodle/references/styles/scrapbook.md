# Archival scrapbook (`scrapbook.ts`, kit in `scrapbookKit.ts`, engravings in `scrapbookEngraving.ts`)

**Medium, physically.** A page from an old field-notes album: rag paper gone to parchment, foxed
with rust spots (drifts at the right margin, the lower-left corner and along the fold, bare
elsewhere), darker toward the handled edges, folded once, a faint tide mark. On it, cards torn
from other stock (deckle edges, darkened rims), held with yellowed cellulose tape or pegged to
a twine line with a wooden clothespin. The pictures are COPPERPLATE ENGRAVINGS, afterwards hand
tinted with thin wash. Words come from a typewriter, from ransom-note cut letters, and a red pen.
A rubber stamp goes on last.

**The marks.**
- *Burin line* (`burin`, `engrave`): a centreline whose width swells with the tone under it and
  comes to a point at both ends; where the tone drops below a threshold the line breaks into
  the paper, so highlights are bare. Contour hatching follows the form (rings across a tube,
  lines along a petal); cross-hatching only where the tone is deep; fur as short tapered flicks;
  a stipple for pollen; cast shadows ruled as horizontal lines feathered at the edge. Tone is a
  normal-vs-light model on each part's own frame (`frame`, `tubeShade`), occlusion by testing
  each sample against the parts in front (`occluder`), so hidden lines are never cut.
- *Struck character* (`typed`): slab-serif monospace from a stroke glyph table, each strike its
  own density and a hair off the line, the ribbon printing faintly double.
- *Cut letter* (`ransom`): each letter a scissor-cut paper tile with its own colour pair, face
  (heavy, slab, outline, italic, condensed, wide, rounded), size and tilt; some cut from a column
  of print, the letter on a cleared patch. Glyphs are STROKED paths, never `fillText`.
- *Red pen* (`handWrite`, `g.pen`): tapered, wobbling annotation: a dashed trend, a loop, the reading.
- *Stamp*: double-bordered, ink broken by `risoSpeck` + `risoMottle`, multiplied.

**Edge.** Torn (cards), scissor-crisp (tiles), no drawn outline round anything that is paper.
Every paper lifts a little and throws a soft shadow down-right.

**Order of marks.** Page (frame 0). Cards laid down one by one (held high, shadow far, then
pressed), each taped; the twine, the flower card, the peg. The section tag, typed. The bee cut:
contours, abdomen, thorax and head, legs and antennae, wings, cross-hatch + eyes + fur + pollen,
cast shadow. The rose: contours, petals, stamens, stem and leaf, shadow. Hand tint (wash spreads
from where the brush touched). Captions typed. Title strips typed, ransom letters pasted one by
one. The waggle diagram in pen. The chart plotted (axes, bars inked upward), then annotated.
The stamp, rocked on from one end.

**Palette.** Parchment `#e8d6b2`, sepia-black ink `#2a2019`, teal `#4f8f8a`, dusty pink `#d9a5a0`,
stamp red `#b8322a`, navy `#22335a`, mustard `#d6a13c`. One lamp, upper left.

**Not its neighbours.** `fox` (cut paper) has no line and no type. `pocketWatch` builds tone from
a constant-width biro. `mellan` is one spiral. Here tone is many swelling lines that follow the
form, on collaged ephemera, and the words are part of the picture.

**Motion grammar.** A desk worked in real time: paper moves (slides and presses), ink never
moves once made. Lines are cut one after another, the current one travelling; letters strike one
at a time; tiles drop with a small tilt and settle.
