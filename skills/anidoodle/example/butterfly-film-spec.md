# MECHANICAL LEPIDOPTERA: film spec, Revision 4 (BUILT, then ALIVE)

Roles: an art director authors and reviews this spec, a builder implements it, a client approves.
Project: this skill's `example/` (a worked reference to study, not a template).
Read before building, in this order: this file, whole; `../references/determinism-and-contract.md` for the rules every frame obeys; then the modules beside this spec in `src/canvas-core/butterfly/` (geom, kit, parts, plate, surface, linkage, act1cues, and the finale world in act4*). Render the approved destination still yourself before you change anything that reaches it.

This revision REPLACES Revision 3. Lines marked DIRECTOR are the art director's own calls, vetoable by the client in one line.

---

## 0. The story (the client)

A mechanical butterfly is BUILT on a blueprint. Then it comes ALIVE, leaves the blueprint, and the world opens around it.

| # | Movement | Medium | Frames | Beats | Bars | Status |
|---|---|---|---|---|---|---|
| 1 | BLUEPRINT: the plate drafts itself, with camera | cyanotype, ruling pen | 540 | 36 | 9 | DONE, APPROVED, LOCKED |
| 2 | ALIVE: one continuous coming-to-life, macro to wide | pencil + watercolour | 1260 | 84 | 21 | this spec |
| | **Film** | | **1800** | **120** | **30** | **60.0 s** |

1080x1080, 30 fps, 120 bpm.

**Cut from the film (the client):** the editorial cutaway. **Cut (DIRECTOR, my call on the question the client left open):** the riso wake. Reason: the story is two states, a drawing and a living thing. A third medium in the middle is a detour, and there is no honest device that turns printer's ink into watercolour. There IS one that turns a cyanotype into watercolour: water. Cyanotypes are developed in water and the blue lifts when wet. So the bridge is a single drop of water landing on the blueprint (section 5, beat 1). The cut acts are not part of this film and do not ship with it. What survives from them: `linkage.ts` (flap driven by the crank), the stir vocabulary (gears catch, antennae quiver, first twitch), `tools/deadair.mjs`, the camera/view engine, per-part cached surfaces.

**The one idea that makes it one story (DIRECTOR):** the blueprint of Act 1 and the ghost blueprint lying in the grass on the approved finale still are THE SAME SHEET. Movement 2 starts pressed against that sheet in macro and never cuts again: one stepped pull-back carries us from a wing panel, to the whole creature, to the sheet it leaves behind, to the ranunculus, to the meadow, and the last thing to come back into frame is the sheet, with a butterfly-shaped blank where the drawing used to be and the key it no longer needs. The ending's meaning is set up by the first frame.

### 0.1 Hard rules

1. **NO DEAD AIR.** Something visibly moves in every second. No blank starts, no static holds. Checked by `tools/deadair.mjs` (gate G-AIR). "Hold" in this document always means the camera slows to a creep while the subject keeps moving.
2. **EVERY ELEMENT MEANS SOMETHING.** Decoration is the machine tell.
3. **ONE SHOT.** Movement 2 contains no cuts. Every change of scale is a camera move, and every big move is MOTIVATED BY A TAKE-OFF (the client).

---

## 1. The grid (binding)

One beat = 15 frames. Bars = 60. Movement boundaries on bar lines.
- **Events** (a drop lands, a panel floods, a landing, a take-off, a stroke begins): multiples of **5**.
- **Landings and take-offs: on BEATS** (multiples of 15). Take-offs that trigger a camera step: on BAR lines where the table says so.
- Motion inside a move is continuous; its start and arrival are on the grid.
- Every frame number lives in `act2cues.ts` (new file for this movement; retire the riso table to `legacy/`) and nowhere else. `gridProblems()` at module load.

## 2. Craft bar (binding)

The client's test: would a proud human illustrator ship this. Never mechanical shape-assembly.

| The tell (rejected) | What passes |
|---|---|
| Things fade or scale in | Marks are MADE: water spreads, a wash floods out from where the brush touched, a line is drawn on |
| Symmetry in time | One side leads. Always lopsided |
| Mechanical easing on a living thing | After it wakes: ease in AND out, overlap, follow-through, the body bobbing against the wings |
| Canvas-scaled parts | Transform CONTROL POINTS, then paint. Never scale a bitmap up |
| Even scatter | Hand-placed DRIFTS with bare rests between |
| One flower stamped many times | 5 hand-authored views per species (section 6), seeded petal variation, no view above 25 percent of a clump |
| Concentric scalloped circles for a ranunculus | Petals painted from the centre out as overlapping C-strokes with paper left between them (6.1) |
| Grass swaying in unison | Wind as a GUST FRONT crossing the field; blades lean on arrival, spring back lopsided |
| Flat bands of one green | Three greens by temperature, wet-in-wet, dry-brush on top, cast shadows, cloud shadows |
| Gradient sky, disc sun | Graded granulating wash; the sun is where the paper was left lightest |
| Outline round everything | Lost-and-found pencil on near planes only. Far planes are paint alone |
| A sheet of paper that looks like a sticker | A rectangle in perspective, one corner curled, grass blades OVER its edges, a cast shadow under the curl, flattened grass round it |

## 3. Contract (unchanged)

`renderFrame` pure in `(frame, env)`. Randomness only from `rng(seed)`. No `Math.random`, `Date`, `performance.now`, `ctx.filter`, `document`, `window`, `new OffscreenCanvas`, `new Image`, or imports of `react`, `remotion` or any host/component module in the core. Surfaces from `env.canvas()`. Seeded tile textures. `g.touch()` for raw drawing in groups. Cache keys name everything the pixels depend on. `/* */` when patching one-liners. Never touch the locked deliverables (the finished film and Act 1's source and MP4). Install nothing without your own security gate. Budget 150 ms draw per frame, one page, warm.

## 4. Camera model (binding)

A true DOLLY over depth planes (already built for the finale world): camera distance `D`, plane depth `z_i`, plane scale `s_i = 1 / (D + z_i)`. The HERO plane is `z = 0`, so hero scale `S = 1 / D`. **S is "screen px per sheet unit"**: at S = 1 the creature (wingspan 780 units) is 780 px wide.

- `S(frame)` is a monotone cubic through `log2(S)` keys (table 5.1). It never increases. After frame 0 its velocity is never zero: between steps it CREEPS.
- The camera centre follows the creature with critically damped lag (about 25 frames) in stages M to R, then hands over to an authored path keyed on bars that ends on the approved still's composition.
- Never scale a bitmap UP. Static washes per plane are cached at LOD steps of sqrt 2 and only downscaled, by at most 1.41x. Everything that moves is drawn live from control points, culled to frame, LOD-reduced by screen size.
- Line weight `w = w_authored * S^0.35`. All texture anchored to the world. Finer tile octave comes up with S. Max S = 4.0 (raised from 3.4 for the macro; watercolour has no hairlines to fatten).

---

## 5. MOVEMENT 2, ALIVE (1260 frames). The client's six beats, on the grid.

Local frames `[start, end)`. Film frame = local + 540.

### 5.1 Camera scale at each stage

| Stage | Frames | S (hero scale) | D | Creature wingspan on screen | What the frame holds |
|---|---|---|---|---|---|
| **M, macro wings** | 0-120 | 4.0 creeping to 3.4 | 0.25-0.29 | 3100 px, far bigger than frame | One forewing root, panel 2, the edge of the thorax window. Extreme close |
| M2, still macro | 120-240 | 3.4 to 1.6 | 0.29-0.63 | 2650 to 1250 px | Thorax and all four wing roots; by 240 most of the creature |
| **T1, take-off pull** | 240-345 | 1.6 to 0.55 | 0.63-1.82 | 1250 to 430 px | The whole creature, then the whole SHEET with its blank, then grass over the sheet's edges, then stems |
| **R, close ranunculus** | 345-720 | 0.55 stepping down to 0.45 | 1.82-2.22 | 430 to 350 px | Three to five ranunculus heads fill the frame; each head about 385 to 315 px. THE HOLD: 6 bars, 12.5 s |
| **F, mid flight** | 720-870 | 0.45 to 0.18 | 2.22-5.56 | 350 to 140 px | Drifts of flowers, grass, the footpath, the first hills at the top of frame by about 800 |
| **W, wide meadow** | 870-1080 | 0.18 to 0.118 | 5.56-8.47 | see 5.7 (it flies TOWARD us) | Field, hills, sky, sun, clouds. The sheet comes back into frame lower left |
| Settle + signature | 1080-1260 | 0.118 to 0.115 | 8.47-8.70 | 290 px (as the approved still) | The approved still's composition, alive, signed |

`S` keys for the cubic: f0 4.0 · f120 3.4 · f240 1.6 · f345 0.55 · f420 0.545 · f450 0.52 · f525 0.515 · f555 0.49 · f630 0.485 · f660 0.47 · f720 0.45 · f810 0.24 · f870 0.18 · f1080 0.118 · f1260 0.115. Between steps the camera creeps (about 1 percent per bar); the drops that start at 420, 525 and 630 are the "steps": each is released by a take-off and takes 30 frames. The big moves start on the take-offs at 240, 720 and 855.

### 5.2 BEAT 1. It turns into a real butterfly (0-240, bars 1-4). Stage M.

The join to Act 1 is a CUT on the bar line (the only cut in the film after Act 1's own match cut): from Act 1's held wide plate to a macro of the SAME plate, same state, same ticking train. View M0: centred on the starboard forewing root so that lifted PANEL 2 on its projection lines sits right of centre and the edge of the thorax window, wheels stepping, sits in the left third. Gate: frame 0 must equal Act 1's final state drawn at view M0 (hash or above 45 dB).

| Frames | Camera | What happens |
|---|---|---|
| 0-5 | M0, S 4.0, creeping | Blueprint macro. White line on Prussian ground. The train steps on 0. The tick continues from Act 1 |
| **5** | | **A drop of water lands** on panel 2. A clear bead: darker blue under it, one paper-white highlight, a tiny crown splash of 4 droplets |
| 5-60 | creep | **The water runs, and a REAL WING comes up behind it.** It does not spread as a circle: it follows the drawing by capillary, along the spars toward the hinge, one spar per 5 frames (water does not care about the draftsman's order). Behind the wet front, on the creature only, every mechanical part becomes the piece of anatomy it always stood for (mapping in 5.7): the ruled SPAR softens, tapers and forks into a VEIN; the membrane PANEL becomes a wing CELL, first a pale warm wash, then scale colour and markings dropped in wet-on-damp (basal dusting, the dark apical patch with its pale spots, the marginal band); each RIVET becomes a submarginal SPOT; the ruled margin becomes a scalloped edge with a fine fringe. The Prussian ground lifts to bare cold-press under the wing only. The front itself is a dark blue rim of displaced pigment. By 60 the starboard forewing in frame is unmistakably a butterfly's wing, of naturalist-plate quality, and the sheet AROUND the creature is still a blueprint, for ever. **Rejected: a frame that reads as gears on one side and colour on the other. At every frame the painted part must already be anatomy, never an abstract colour field** |
| 45-60 | creep | **Panel 2 comes home.** It floods CORNFLOWER blue (it keeps the blueprint's colour, with a ghost of the ruled grid lifted in it) and slides down its projection lines, dashes shrinking, seating on 60 with the last mechanical overshoot in the film. The flaw is healed, and it becomes the mark of the individual: that blue panel is on the approved still |
| 60-120 | slow drift left across the thorax to the port wing roots, S to 3.4 | **Water crosses the body, and the body becomes an insect.** The housing takes a warm umber-grey wash turned as a form (light upper right, core shadow, reflected light below). The wheels in the window keep stepping on the tick while thoracic FUR is dry-brushed in from the window's edge, stroke by stroke, 75-120, closing over them: the mechanism is not removed, it is grown over. Abdomen rings become true segments with paler bands and fine hair. The stippled eyes become compound eyes with one lifted highlight each. Port wings come up 75-120, vein by vein, as the starboard did. Dimension lines, leaders and balloons that cross the frame stay hard white on blue: furniture does not change |
| 120-180 | ease back, S 3.4 to 2.4 | **First movement, and it is the movement of a newly emerged butterfly.** 120: the last of the mechanism, felt not seen: one stall, a recoil held for 2 ticks, a double step on 130, as a shudder through the thorax. 125: port antenna (now a finely ringed shaft with a true club) quivers, starboard answers on 130. 135-150: the six LEGS unfold from under the thorax, one pair per 5 frames, thin and jointed, and take the weight; the body lifts a hair off the sheet. 150-180: a BREATH, flap 1 to 0.86 and back, port first, starboard a triplet later. Motion is still STEPPED on the tick: it moves like a mechanism wearing a butterfly |
| 180-240 | S 2.4 to 1.6 | **It softens into a living thing: the slow fanning of wet wings.** Real butterflies do exactly this after emerging, pumping and fanning until the wings are dry enough to fly, so the wet paint IS the wet wings. Three fans, wider each time: down-strokes at 180 (30 frames, to flap 0.6), 210 (20 frames, to 0.5), 230 (10 frames). As the wings rise we see, for the first time, the paler UNDERSIDE pattern (5.7). Across this bar the motion blends from tick-stepped to continuous (`motion = lerp(stepped, smooth, u)`, u 0 to 1 over 180-240), easing changes from hard-out to in-and-out, the body bobs against the wings, the abdomen curls, the antennae trail, the proboscis uncoils once and recoils (200-220). A soft painted SHADOW separates beneath it on the blue sheet, offset 0 to (14, 20). From 180 the paint lags the pencil by up to 9 px on fast strokes. **By 240 nothing mechanical is visible. What takes off is a real butterfly.** Sound: the tick thins across this bar and a felt wing-flutter takes each down-stroke (section 8) |

### 5.3 BEAT 2. It takes off; the camera begins to zoom out (240-345, bars 5-6). Stage T1.

| Frames | Camera | What happens |
|---|---|---|
| **240** | the pull-back STARTS here, motivated by the take-off | **Take-off on the bar line.** Wing cycle drops to 10 frames. It rises off the sheet; its shadow slides away down-left and shrinks |
| 240-285 | S 1.6 to 0.95 | **What it leaves behind:** a butterfly-shaped BLANK in the blueprint, bare unexposed paper where the drawing was, because the drawing went with it. The furniture is all still there, now dimensioning nothing: WINGSPAN 184 across an empty shape, leaders pointing at paper. The KEY stays on the sheet. At about 270 the whole sheet is in frame: border, cartouche, MECHANICAL LEPIDOPTERA, and the hole |
| 285-345 | S 0.95 to 0.55, centre following the creature up and right | **Scenery appears.** Grass blades lie OVER the sheet's edges; one corner is curled with a shadow under it. The camera rises and tilts with the creature: the sheet foreshortens (control points, y-scale 1 to 0.45 about its centre, slight keystone) as it slides out lower left, gone by 335. Stems rise through frame: tall, slender, curving. Out-of-focus colour behind them resolves into petals. Big soft foreground blades (plane z -0.2) whip out of frame |
| **345** | arrives S 0.55 | It is hovering over a clump of RANUNCULUS |

### 5.4 BEATS 3 and 4. The ranunculus close-up; flower to flower, sipping (345-720, bars 6-12). Stage R.

This is the heart of the film and it is held long enough to read: six bars. The camera only creeps and drifts sideways with the creature, stepping back slightly on each take-off.

| Frames | Beat | Action |
|---|---|---|
| **360** | 24 | **Lands on R1** (coral, facing us). The head DIPS (stem bends 6 degrees, one settle). Wings open flat, then fan slowly (30-frame cycle, amp 0.35): it is never still |
| 375-410 | | **Sips.** The proboscis, the blueprint's hairspring, uncoils into the tight centre (375-385). Abdomen pulses once per beat: the tick has become a heartbeat. Recoils 405-410 |
| **420** | 28 | Take-off. R1 rebounds. Camera step 0.55 to 0.52 over 420-450 |
| 420-450 | | Short hop right, a bob on every down-stroke (6 to 10 units), one playful overshoot past R2 and back |
| **450** | 30 | **Lands on R2** (blush white with a pink picotee edge, three-quarter view). Sips 465-510 |
| **525** | 35 | Take-off. Step to 0.49 over 525-555 |
| 525-555 | | Crosses LEFT behind a stem (it passes BEHIND: overlap sells depth), first gust of wind arrives 540 and pushes it sideways; it recovers |
| **555** | 37 | **Lands on R3** (butter yellow, profile cup, lower in frame, with a nodding bud on the same stem). Sips 570-615. A petal it disturbs falls (585-630, tumbling) |
| **630** | 42 | Take-off. Step to 0.47 over 630-660 |
| **660** | 44 | **Lands on R4** (deep magenta, half-open, highest in frame). Sips 675-705 |
| **720** | 48 | **Take-off on the bar line.** This one does not hop: it climbs. It releases BEAT 5 |

Through the whole stage: every head nods on its own period (50 to 80 frames, never shared), leaves turn, the gust front at 540 crosses in 60 frames, sunlight flickers as a cloud shadow slides over the clump (600-690), two seed-fluffs drift through the foreground.

### 5.5 BEAT 5. The camera zooms out more; it takes off again (720-870, bars 13-15). Stage F.

| Frames | Camera | Action |
|---|---|---|
| 720-810 | S 0.45 to 0.24 | Mid flight: up and away over the ranunculus, a loop at 750, low over a daisy drift, then right along the footpath. The ranunculus clump shrinks into one drift among many. Hills enter the top of frame at about 800 |
| **810** | S 0.24, creeping | **Touch-down on a field poppy**, far right, deeper in the field (plane z 2.2). A short sip, 820-845. Two small WHITE butterflies lift out of the grass nearby at 825 (DIRECTOR): real ones |
| **855** | beat 57 | **Take-off again.** Second gust arrives 855. This take-off releases the final pull-back |
| 855-870 | S to 0.18 | It climbs with the two whites spiralling round it |

### 5.6 BEAT 6. Final wide: the meadow (870-1260, bars 15-21). Stage W, settle, signature.

| Frames | Camera | Action |
|---|---|---|
| 870-1080 | S 0.18 to 0.118, authored path, horizon settling at y 410 | The meadow opens: far field in bands, two ridges with a hedgerow and one lone tree, the big warm sky, the sun upper right, three lifted clouds drifting left, cloud shadows sliding over the far field from 900. **At about 930 the blueprint sheet re-enters, lower left**: small, in perspective, its corner lifting in the gust (on 945 and 1005), the butterfly-shaped blank and the key on it. It is never pointed at |
| 900-1080 | | **It flies TOWARD us.** From the poppy it turns and comes up the field to the foreground, growing as the world shrinks (its depth goes z 2.2 to z -5.8, so its scale goes 0.13 to 0.37). The whites peel away at 990. It arrives at the approved still's position (440, 590), wingspan about 290 px, on 1080, and HOVERS: a slow figure of eight, 60-frame period, wings on a 10-frame beat |
| 1080-1140 | S creeping 0.118 to 0.116 | The picture is the approved still, alive: grass idling, heads nodding, clouds, the creature hovering |
| 1140-1155 | | A clean damp brush LIFTS the lower right corner: one soft swipe about 250 x 60 px (see 7) |
| 1155-1185 | | **The signature is written**, last stroke finishing on **1185 with the DING** (film frame 1725) |
| 1185-1260 | creep to 0.115 | Five beats to read it. Ink dries 0.75 to 0.60. The creature drifts a little higher. Last frame: the approved still's composition. THE END |

### 5.7 The creature, painted

**The client's note: MORE REALISTIC, less abstract. A naturalist watercolour plate, NOT colour fields.** The medium, the warmth and the ranunculus stay. My earlier "wings as stained glass" direction is withdrawn: it produced flat panels and it was wrong.

**The bar:** a plate from a natural-history folio (Merian, the 19th-century lepidoptera atlases) painted by someone who has had the specimen under a lens. A lepidopterist should be able to name every part. It stays an ORIGINAL species (borrow the medium, never the content): no copying a real butterfly's pattern, but every structure is true. Look at real reference for anatomy and venation before moving a point, and say which you used.

**What each mechanical part becomes (this mapping IS the transform beat, 5.2):**

| Blueprint | Living butterfly |
|---|---|
| Wing spars radiating from the hinge | VEINS. They keep their positions, so the silhouette and rhythm carry over, but they become true venation: a closed DISCAL CELL from the base to about half the wing, veins leaving the cell and running to the margin, forking, never crossing, thinning toward the edge |
| Membrane panels | Wing CELLS between veins, covered in scales |
| Rivets along the spars | The row of SUBMARGINAL SPOTS |
| Ruled wing margin | A margin gently SCALLOPED between vein ends, with a fine pale/dark FRINGE |
| Thorax housing and its window | A furred THORAX (the fur grows over the window) |
| Abdomen rings | 7 to 8 visible abdominal SEGMENTS, tapering, paler bands at the joints, fine hair |
| Stippled eyes | Two large COMPOUND EYES, one lifted highlight each, and a pair of small furry PALPS between them |
| Coiled-wire antennae | Slender, finely ringed ANTENNAE ending in true CLUBS |
| Proboscis hairspring | The PROBOSCIS, coiled at rest between the palps, a fine double tube when extended |
| (not on the blueprint) | SIX LEGS, thin and jointed: femur, tibia, a tarsus with a tiny claw. They unfold at 135-150, grip the petal when perched, tuck back in flight |
| Lifted panel 2 | The one mark no real butterfly has: a CORNFLOWER BLUE cell in the starboard forewing, painted as an iridescent scale patch. The blueprint it carries with it |

**Wings, two true pairs.** Forewing roughly triangular (leading edge, apex, outer margin, inner margin), hindwing rounder with the short TAIL the geometry already has. The forewing OVERLAPS the hindwing's leading third, and that double layer is darker. Left and right are never mirror images (keep the seeded asymmetry).
- **Pattern (original, plausible, warm):** ground of rose running to peach toward the margin. Warm grey-umber DUSTING at the base, hairy near the body. A dark umber APICAL PATCH on the forewing holding three pale spots. A dark MARGINAL BAND, narrowing toward the rear corner, carrying the row of pale submarginal spots. A small dark DISCAL SPOT at the end of the cell. On the hindwing, the marginal spot row again and, at the base of the tail, a small blue-and-orange EYESPOT.
- **Underside (seen whenever the wings rise or close):** different and quieter, as in life: pale cream-peach with soft grey-olive marbling, the spot row repeated small, veins a touch darker. A butterfly with the same pattern on both faces reads as a cut-out.
- **How to paint it:** a pale first wash over the whole wing; pattern dropped in WET-ON-DAMP so its edges soften the way scales do (no hard-edged shapes except the eyespot's pupil); veins LAST with a fine rigger in umber, broken, tapering, heavier near the base, never a uniform line; the fringe as tiny alternating ticks; a lifted paper-white rim on the sunward margins.
- **Volume and translucency:** the wing is not flat: a slight camber, so a soft shadow runs behind each main vein and the cell between catches light. The body casts a shadow onto the wing bases; the wings cast a shadow onto the flower. Wings are TRANSLUCENT: where a wing overlaps a petal or the sky, 15 to 20 percent of that colour warms through it; backlit (wings raised against the sun, upper right) the ground glows and the veins read darker.
- **Body:** painted as a form, not a capsule: light upper right, core shadow, reflected light from below, fur dry-brushed along the thorax in the direction it grows, the segment bands wrapping round the cylinder.

**Two authored views (DIRECTOR, needed for realism at the ranunculus):**
- **DORSAL** (existing control points): the transform beat, basking with wings flat, all flight.
- **LATERAL, wings closed or half open over the back** (new hand-authored control points: body in profile, six legs gripping, forewing and hindwing undersides overlapped). This is how most butterflies actually sip, and it is what a plate shows beside the dorsal figure. Used at stage R, where the creature is 350 to 430 px and realism matters most: at least two of the four ranunculus visits are lateral. The switch between views happens inside the landing flutter, at the instant the wings pass through closed. Below about 150 px on screen, dorsal with the pose transform is enough.

**Pose and flight.** `Pose = { flap, sweep, heading, pitch, bank }`, all on control points: `heading` rotates about the thorax, `pitch` foreshortens along the body axis (1 to 0.55), `bank` offsets port against starboard flap by up to 0.2. `flap` comes from `linkage.ts`; after frame 240 the crank runs free and smooth. Flight is a butterfly's: hand-authored paths with detours, a bob on every down-stroke, never a straight line or a clean sine. It is the most saturated thing in every frame, with the wash behind its path kept a value lighter. Never under 46 px wingspan. LOD: above 300 px everything above; 120 to 300 px veins, main markings, legs when perched; 46 to 120 px silhouette, two-tone wings, dark margin, the blue cell.

**Rejected on sight:** wings as flat colour fields or stained-glass panels; spars left as straight ruled lines; mirror-image wings; one pattern on both faces; a capsule body; antennae as a line with a dot; no legs; uniform-weight veins; any frame of the transform that reads as "gears here, colour there".

---

## 6. The world

Light from the upper right, always: lit side, shadow side, a cast-shadow dab to the lower left of every plant and of the creature when it is low. Paper white is the brightest value and is LEFT: highlights, cloud tops, the rim of petals. Three greens by temperature. Aerial perspective: farther is paler, bluer, softer, no pencil.

### 6.1 RANUNCULUS, rendered true (the client)

Persian buttercup, *Ranunculus asiaticus*. Study real photographs before moving a point, and say which you used.

- **The head:** dozens of tissue-thin petals in tight, overlapping, concentric layers: a cupped rosette, rose-like but flatter and more orderly than a rose, never a pompom. Petals are smallest and most upright at the centre, largest, palest and slightly ruffled at the rim. Layers are OFFSET from each other, so no petal sits directly behind another.
- **The centre:** a tight green-yellow button. In a half-open bloom it is green and clasped; fully open it shows a small dark eye ringed with yellow.
- **How to paint it (this is the craft):** from the centre OUT, as short overlapping C-strokes circling the button, each ring larger and looser than the last. LEAVE SLIVERS OF BARE PAPER between strokes: those slivers are the petal edges, and they are what makes it read as layered tissue instead of a disc. Drop darker pigment into the gaps near the centre while wet (depth), let the outer petals stay pale with a hard dried rim, add one cool shadow wash over the side away from the sun. No outline round the head.
- **Rejected on sight:** concentric circles with regular scallops; a mathematical spiral; identical heads; petals as separate ovals arranged on a ring; straight stems.
- **Five views, hand-authored:** facing; three-quarter (an oval cup, inner layers seen as stacked crescents); profile (a cup on its stem, green sepals reflexed beneath); half-open; tight round BUD, nodding, clasped by sepals.
- **Stems:** tall, slender, faintly hairy, each with its own S-curve and thickness, often one main bloom plus a side bud. **Leaves:** low and basal, deeply cut, parsley-like, painted as a dark ferny mass at the foot of the clump.
- **Colours:** coral, blush white with a pink picotee edge, butter yellow, deep magenta, peach. They are the creature's own wing colours, which is why it goes to them (DIRECTOR).
- **The clump:** 9 heads and 5 buds, hand-placed at three heights and three depths, R1 to R4 chosen so the flight zig-zags right, left-behind-a-stem, down, up. Size: a full head is 700 units across, a little smaller than the creature.
- **LOD:** above 120 px everything above; 40 to 120 px three rings of strokes and the button; 14 to 40 px two tones and a centre dab; under 14 px one dab.

### 6.2 Everything else (as the approved still, with its open craft fixes)

Planes: P0 foreground fringe z -0.2 · P1 hero z 0 (the sheet, the ranunculus clump) · P2 z 1.0 (daisy drift) · P3 z 2.2 (poppies, cosmos, the touch-down poppy) · P4 z 3.5 (buttercups along the footpath) · P5 far field z 8 · P6 hills z 20 · P7 sky.

Supporting flowers, each with 4 views and LOD as above: oxeye daisy (paper white), field poppy, cosmos, buttercup (the ranunculus's wild cousin). About 14 hand-placed drift centres, seeded scatter inside each with falloff, three bare rests of plain grass.

**Changes to the approved still, flagged for the client:** the near flowers at about (540, 700), (440, 790), (815, 680), (920, 750) become RANUNCULUS so the clump we spent six bars on is recognisably in the last frame. Everything else in the still's composition stands: creature (440, 590), sheet lower left, sun upper right, signature lower right, horizon about y 410.

**Craft fixes already listed against the still, all still owed before motion:** (1) value range: the greens sit in one narrow band, push the hollows darker and the sunlit crests lighter; (2) drifts read as dot clouds, give near drifts real flower forms; (3) the sheet reads as a sticker or a lily pad: make it a rectangle in perspective with a curled corner, grass over its edges, a shadow under the curl; (4) the foreground is empty flat colour: P0/P1 grass clumps with thickness and cast shadows; (5) the signature letterforms (section 7).

**What moves, always:** gust fronts enter left on 540 and 855 and cross in 60 to 90 frames; idle sway between, per-clump periods 50 to 80 frames; clouds drift left; cloud shadows over the clump 600-690 and over the far field from 900; seed fluff from 345; the two whites 825-990; every visited flower dips and rebounds; wet paint spreading 5-120.

---

## 7. The signature (the client)

`alexgreenshpun.com`, signed like a watercolourist signs a corner. A signature, never a caption.
- Hand-authored brush strokes in `butterfly/finale/signature.ts` (control points, about 8 strokes), lowercase, connected, slight forward slant, baseline rising 2 degrees, uneven letter widths, loose descenders on g and p. LEGIBLE FIRST: it is a URL, the dot must read as a dot. The still's current letterforms do not pass this.
- Rigger brush, dilute warm grey-brown about `#5b5148`, width 1.3 to 2.2 px with pressure, pigment pooled at stroke ends, opacity 0.75 wet drying to 0.60.
- SCREEN space. Right edge of the last letter x = 1036, baseline y = 1034 at its left end, width 190 px, x-height 12 px, ascenders 19 px.
- Damp-brush lift 1140-1155 to make room (about 250 x 60 px, lightens the wash about 45 percent, faint backrun at its end). Written on, never faded: `alex` 1155-1160, `green` 1160-1170, `shpun` 1170-1175, the dot on 1175, `com` 1175-1185. Last stroke ends on **1185, with the DING**. Then 75 frames to read it.
- Check: readable at 100 percent, vanishes into the painting at thumbnail size. No underline, no flourish, no glow.

## 8. Score (pure JS, same shape as `score.ts`)

12/8. Act 1: music box, asks the question, ends unresolved on the fifth. Movement 2: the drop on local 5 is a single water-note; the motif returns slowed and warm under 5-240; from 240 (take-off) a bowed pad and a second voice; the answer resolves to the root as the meadow opens at 870; DING on local 1185.
**The tick becomes a pulse:** tick every 5 frames through 0-180, thinning across 180-240 as a felt wing-flutter takes each down-stroke; gone by 240. While it sips, one soft low pulse per beat (the heartbeat). Landings get a pluck on their beat. Every onset is a cue; assert sample index = `round(frame / 30 * 48000)`.

## 9. Engine work

1. `act2cues.ts` for this movement; riso/editorial tables retired to `legacy/`, nothing imports them.
2. **The water front:** progress along spars (arc length, reuse `nib()`), per-panel flood on arrival, ground lift clipped to the creature's silhouette plus a 6 px bleed, blue pigment rim at the front. Drop and crown splash.
3. **The sheet as a world object:** the Act 1 plate drawn into plane P1 via the existing view engine, cached at LOD steps, downscale only; a `blank` state that knocks the creature's silhouette out to bare paper; foreshortening on control points.
4. **Stepped-to-smooth motion blend** on the crank (5.2, 180-240).
5. Ranunculus: 5 views x colour variants, LOD, stems, leaves, dip and rebound.
6. Pose extension, flight paths, landing/sip/take-off states, proboscis.
7. Reuse as built: dolly planes, flora LOD, gusts, clouds, creature paint, signature, `deadair.mjs`.
If the macro (huge wet washes) or the last bars break 150 ms, cut blade and stroke counts before touching the look, and tell me.

## 10. Gates (stills first, I review each; under the no-collision protocol I review COPIES and return numbered fix lists through the client)

| Gate | Deliverable | Pass |
|---|---|---|
| **G-R ranunculus** (FIRST) | One sheet: the 5 views in 3 colours at full LOD, plus the clump composed at stage R with the creature perched on R1 | Craft review against 6.1. No motion before this passes |
| **G-M metamorphosis** | 6 stills: local 0, 5, 30, 60, 120, 210 | Frame 0 equals Act 1's final state at view M0. The water reads as water. Panel 2 home and blue. Realism per 5.7: every painted part is nameable anatomy at every sampled frame, never "gears here, colour there"; by 210 it is a complete, recognizable real butterfly with legs, clubbed antennae, venation, markings and an underside. Plus one PLATE still: the finished creature, dorsal and lateral side by side, as a naturalist plate |
| **G-S sheet** | 3 stills: local 270 (whole sheet with the blank), 320 (grass over its edges, foreshortening), 1080 (in the wide) | It is a sheet of paper, not a sticker. The blank reads as the absence of THIS butterfly |
| G-W wide | The approved still re-rendered with the five fixes and the ranunculus swap | The client re-approves the destination |
| G-MOTION | Contact sheet at one tile per beat (84) + MP4 | Tables 5.1 to 5.6 on the frame; landings and take-offs on their beats; camera keys within 2 percent |
| G-AIR | `tools/deadair.mjs` on the movement and the film | No identical consecutive frames; no 15-frame window under 0.5 percent changed area |
| G-FILM | `out/butterfly.mp4`, `dist/butterfly.html` | h264 + aac, 1800 frames, clean decode, draw median under 150 ms and p95 under 200 on one page, determinism on probe frames (hash, else above 45 dB) |

## 11. Open for the client (none blocks the build)

- O1. No riso wake (section 0). If you want one back, it costs a second bridge device and I would argue against it.
- O2. The join from Act 1 is a CUT to macro on the bar line. The alternative is a 30-frame push-in over the finished plate, which costs a full-plate redraw per frame.
- O3. Four near flowers on the approved still become ranunculus (6.2).
- O4. The two white butterflies, and the creature flying toward us at the end so it lands at the still's size.
- Act 1 is locked and approved, and it fails the dead-air check at its open (43 identical frames in the first seconds, per the gate). Two cue changes would fix it. The client's call whether to unlock it for that.
- O6. Length: 42 s for the coming-to-life, 60 s film. If it must be shorter, trim stage F and one ranunculus landing, never the macro or the ending.
