# Ballpoint sketch, drawn on (`pocketWatchDraw`)

The `pocketWatch` plate, filmed while the biro makes it. The last frame is the plate, byte for byte.

**Medium.** One blue ballpoint (#23379f) on cream cartridge paper (#f6f2e6). A steel ball rolls oil ink: the line weight barely changes, it cannot be thinned or lifted, and nothing can be erased. Where a firm stroke stops, the ball leaves a bead of ink.

**Marks.** Only lines. Tone comes from where the hatching sits: one direction, then a cross layer, then a third direction in the deepest darks. The only solid blacks are the Breguet hands and the centre boss, scribbled in.

**Edge.** Every edge is a line. The glare on the crystal is paper that was never hatched.

**Order.** (1) Construction: two faint centre lines and a loose ellipse. (2) Contours: case, back arc, bezel and track rings, sub-dial, pendant, crown and bow, then the chain. (3) Detail: reeding, minute track, IIII numerals, sub-dial ticks, knurling. (4) The first tone layer everywhere there is shade. (5) The cross layer where it is darker. (6) The third direction in the darkest places. (7) The solid blacks: the hands, their hair shadows and the boss. A pen cannot take a mark back, so a sketcher commits to the contour before any tone. The hands come last because they sit on top of everything.

**Palette and paper.** One ink and one paper, with the `paper` tile multiplied at 0.07.

**Not its neighbour.** This is not pencil: there is no smudge, no erased lay-in and no pressure-driven weight. It is not ink and line-wash: there is no wash and no flexible nib. Against the still `pocketWatch`, the difference is the ORDER of the marks.

**Motion grammar.** Each mark is gated by a clock that knows its pass (`build/line/detail/h1/h2/h3/fill`). Marks paint in the plate's own order, so the finished frame cannot drift, and the clock only decides WHEN each one happens. Time per mark is 4 + length^0.85 cost units: long strokes cover more pixels per frame, while short fiddly ones take longer per pixel. Hatching overlaps like a time-lapse. There is a 10-frame pause between passes. Strokes the case will cover take no time. A bead appears only once the stroke is finished. A solid area grows as a band swept across it and never fades in. Watch before chain.
