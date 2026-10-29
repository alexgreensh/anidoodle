# Machines: explain an idea by building it, in any style

**Contents:** 1. Turn the idea into a machine · 2. Parts list before geometry · 3. One model drives everything · 4. Build with the kit · 5. Draw it in a style: the hand · 6. Films and interactive pieces · 7. Check it

A machine is a subject, not a look. The kit (`engine/src/canvas-core/mechanismKit.ts`) builds real
parts in 3D, sorts them, takes them apart and folds them back; a **hand** marks them in a style's
own medium. The same music box draws as cyanotype, coloured pencil, stipple or flat iso planes.
Worked example: `mechanism.ts` (the 18-note movement), `mechanismHands.ts`, `mechanismExplorer.ts`.

## 1. Turn the idea into a machine

1. **Get the facts first.** The idea's real quantities: how many, how big, how fast, the limits (`explainer.md`).
2. **Name what happens** to what: the actions (fills, waits, matches, rejects, decays) and the things they act on.
3. **Find a made object that does those actions,** one a general reader recognises: a turnstile for
   "one at a time", a sieve for a filter, a ratchet for "only forward", a sluice for a queue.
4. **Test the match aloud:** describe the machine running, then the idea; if the two descriptions do
   not line up step for step, pick another object.
5. **Every part means something,** and say where the comparison stops being literal.
6. **One part carries the story.** It alone gets the accent (`accent: true` on its material).
7. **Show the number:** a dial, a ruler, a counter or the readout corner reads the quantity live.
8. **Turn it to face the viewer:** `Cam.fit(A, E, points, box)`. The music box sits at an azimuth of
   36; most machines look right somewhere between a third and two thirds of a right angle.

The machine has to be something a person could name, with every part doing work. Labelled blocks
hanging in space give the viewer nothing to name, and a big bare panel with a scratch or two of
detail looks like a drawing someone stopped halfway through.

## 2. Parts list before geometry

Write the inventory first, working from the ground up: the bench or feet it rests on, the frame
that carries the motion, the moving parts, the handles and knobs a person would reach for, and
finally the one part the story is about. Nothing floats and nothing is idle: each part rests on
something and earns its place. For scale, the music box runs to 68 parts and spans about 62 percent
of its card. If your machine wants far more than that, build a cut-down version that keeps the
heart of it. Richness should come from construction (a boss where a shaft meets a plate, a row of
drilled holes, a stop lever), not from a pattern painted over the surface. When a face looks empty,
ask what real part belongs there.

## 3. One model drives everything

Everything that moves, the readout and every caption are computed from a single function of
`(frame)`, or of the input state in an interactive piece, with no side effects. In the music box,
`play(rot)` places the pins and bends the teeth, and the same call names the pin, the tooth and the
pitch for the readout, so nothing is typed twice. Take words from the live state, never from a
script running beside it: the readout names the pin that just struck because it works that out from
the drum angle, not because a timed caption says so. Counts come from the list that draws the parts
("8 ASSEMBLIES OUT" is `PLAN.order.length`).

## 4. Build with the kit

| Need | Use |
|---|---|
| Camera, depth, a world offset on screen | `Cam`, `Cam.fit`, `c.depth`, `c.dv` |
| Slabs, plates, boxes with rounded plans, seams, bevels | `prism`, `box`, `rrect`, `circle` |
| Drums, posts, knobs, domes: any surface of revolution | `turned` with `cyl`, `cone`, `sphere`; bands are exact, never staircased |
| A lever, a vane, a bracket in any plane | `slab` with `leverRing` or any convex outline |
| Pipes, wires, cables along a route | `tubeAlong` (filleted bends, end caps) |
| Screws, pins, ticks, ribs that fade as they turn away | `screw`, `facingAt` + `smooth` for alpha |
| Many parts in the right order | `paintAll(items)`; each item has `at`, `bias`, `ride` (its assembly) |
| An exploded view | `ExplodePlan` + `sharesAt(plan, cues, t)`: staggered out, last-out first-home, reversals cancel pending moves |
| A card that frames the figure and gives each corner a job: the title, a hint, the live readout | `card` |

Rules that keep it clean: split a part that wraps another (back half, inner, front half); every
part is held by something; explode real assemblies along their true direction, the outside ones
first; draw a chain line along each path of travel; leave the card a generous margin round the figure.

## 5. Draw it in a style: the hand

The kit never chooses a colour. It calls the current hand with meaning: a region and its tone `q`
(0 darkest side, 4 top), a line and its role (`out`, `lit`, `in`, `crease`, `seam`, `hair`,
`light`, `chain`), a dot, the card's sheet, rule and lettering. `setHand(h)` before painting,
`setHand(flatHand())` after. Shipped hands: `isometric` (fast, the default), `blueprint`, `colouredPencil`,
`stipple`. To add one, read the style's recipe in `references/styles/<id>.md` and answer five
questions in code:

1. **Is there light?** Blueprint has none (tone is section lining, only on the part to watch);
   stipple's light is dot density; pencil's is pressure and stacked passes.
2. **What is an edge?** A ruled line, a broken pencil contour heavier on the shade side, a denser
   row of dots, or nothing at all (iso planes meet tone to tone).
3. **How is the accent made?** A colour, section lining, or density.
4. **What is the ground?** Draw it once into a cached layer; `knock` paints it back over a part.
5. **Are the marks anchored?** Anchor hatching and dots to `offset()`, never to the screen, and
   seed them from the part, so a still part never boils and a moving one carries its marks.

## 6. Films and interactive pieces

Two films, not one: the making (`kind: "drawing"`, each part inked then toned in assembly order
with `setReveal(ink, tone, paper)`, then the words) and the run (`kind: "explainer"`: play close on
the part to watch, explode, tour, home). One film holding both fails the dead-air gate, because a
build's slow strokes are measured against an explainer's floor. While apart, let each assembly
breathe a little along its own path, out of step with the others, so the tour never freezes. An interactive piece (`interactive.md`): each
assembly rides its own spring, damped with `zeta` 0.8 to 0.9 so it settles with weight, and the
outer assemblies get the quicker springs; a fixed
camera so the card and the bench bake once; the part nearest the pointer lights and the readout
says what it does; reduced motion holds the drum still.

## 7. Check it

Render at `--scale 2` or 3 and crop every joint (flange, bridge, crank, wire end, tooth tips); the
things to hunt for: a part painted behind something it should sit in front of; two parts that
overlap or hang apart where they should touch; a stroke that ends on nothing; an edge drawn twice;
a pattern that stops abruptly in the middle of a face instead of fading. Then
`node tools/test.mjs mechanism` and, for a page, `emit-interactive.mjs` and `replay.mjs` (22 checks,
including 6 ms a frame at DPR 2). Measured, not assumed: say which of these you ran.
