# Toy brick · `toyBrick.ts`

**Medium, physically.** Moulded ABS toy bricks, rendered in orthographic view (azimuth 45, elevation 30). Zero hand marks. Real units (`toyBrickKit.ts`): 1 stud pitch = 20 LDU, brick 24, plate 8, stud 12 wide and 4 high, so the 5:6 brick proportion is right by construction. Never name the trademark anywhere.

**The mark.** The part. Flat plastic fill in a real toy-brick colour (fixed table, spec 13 rule 9), one tone per face by the cube rule (top +0.10, lit +Z side 0, far +X side -0.22), a bevel highlight where a top meets a visible side and down each visible vertical corner, a dark seam hairline where one part meets the next, studs as real cylinders (shadow crescent on the top they stand on, lit left / dark right side band, top ellipse, highlight crescent toward the light).

**The edge.** Crisp plastic edges, softened only by the bevel strip. The only blur in the plate is the ground shadow: each part's box swept along the light onto the baseplate, filled at 1/5 size and drawn back up.

**Order.** Instruction-booklet grammar: bare backdrop, the baseplate drops in, then step by step (each step starts on a beat, parts seat in at most four 5-frame slots), bottom up and back to front inside a course; parts fall straight down their insertion axis on an ease-out, ghosted from 35% alpha while travelling, seat with a one-frame 0.5 LDU press-fit. The current step's parts wear the booklet's yellow outline until the next step begins. A short settle (the whole model pressed home, 1 LDU) and the hold.

**Painter's order.** No z-buffer: per frame, parts are ordered by pairwise separating axes on their boxes (X, then Z, then Y), only for pairs whose screen boxes overlap (Kahn's sort). Settled parts are cached as one layer keyed by the exact set of settled ids; anything moving is drawn over it, followed by every settled part that stands in front of it.

**Palette & backdrop.** Blue water baseplate, Light/Dark Bluish Grey quay, Red + Black hull, Reddish Brown deck, White superstructure, Medium Azure glass, Yellow funnel, Orange/Reddish Brown crates. One flat studio backdrop colour.

**Not its neighbour.** `fox` (cut-paper collage) is torn paper with a lift shadow per piece and a hand behind every edge; here the look is manufactured and the process is assembly, not drawing.

**Motion grammar.** Rigid: no squash, no stretch, no bounce. Take-apart is the build reversed frame for frame.
