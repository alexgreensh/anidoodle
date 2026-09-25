# Storybook pencil + watercolour, drawn (`storybookDraw.ts`)

**Medium.** Soft graphite and pan watercolour on warm cold-press, the hand of `storybook.ts`.
The character is `drawBit`, called UNCHANGED through `Phase`, a `Gfx` subclass that decides which
of its groups draw in each pass and how far along each stroke is (a census pass records every
group's kind, bounding box and stroke count once).

**Order of marks.** (1) Construction in blue-grey: head and body ovals, gesture line, shoulder
line, the face cross, arm gestures, the footprint; left in the finished page as picture books
do. (2) A light pencil drawing of Bit, head first and down (groups ordered by the top of their
box), every contour drawn stroke by stroke at 0.36 alpha, 0.62 width. (3) Washes: the sheet's
warm ground, sky, peach light, grass, shadow, four flowers, then Bit back to front in
`drawBit`'s own order (legs, boots, arms, hands, body, collar, antenna glow, bulb, head,
cheeks), each spreading from the upper-left of its shape (toward the light). (4) The final line
at full weight, head first, then ground line, grass, pebbles, flower stems; last, paint flicked
off the brush.

**Gotcha paid for.** A gradient (`g.glow`) painted into a POOLED layer changes how Chromium later
rasterises pencil strokes into that same layer: 1/255 on every stroke pixel, so frame order
leaked into pixels (5/6, then 4/8 probe frames differed). The glow is painted on its own cached
surface and copied in; the pool never sees a gradient. Now 8/8 identical.
