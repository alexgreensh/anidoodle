# Human anatomy in code

> Structure first, marks last: the rule `butterfly/alive/anatomy.ts` applied to a wing, applied to
> a person. A human drawn from outlines is the road-sign icon of a human. A human built from a
> skeleton, volumes and a camera gets foreshortening, overlap, contact and balance for free, and
> gets every one of them checkable. Code: `engine/src/canvas-core/character/human/`.

**The scar.** The first mannequin we built had arms hanging in a gap beside a box torso: a
wooden doll. Its hands were rakes, its thumb left the wrist as a stick, its pinch never closed, a
nine-year-old's shins were 16% short, and a 37-degree ankle bend and a 46-degree hip slipped into
poses we "tuned by eye". The checks below caught the last four. The eye caught the first three.
You need both.

## The pipeline

| Layer | File | What it owns |
|---|---|---|
| Canon | `canon.ts` | landmark heights in head units per canon ROW (adult 7.5, storybook child 5.2 declared over a real 6.2); heads-by-age and eye-line-by-age tables |
| Skeleton | `skeleton.ts` | bone lengths from the canon; forward kinematics; joint limits and cones; **a pose outside them throws at load** |
| Mannequin | `mannequin.ts` | ribcage egg, pelvis bowl, shoulder girdle, limbs as chains of ellipsoids with muscle profiles |
| Head | `head.ts` | Loomis ball + jaw; features placed ON the face surface; eleven expression parameters |
| Hands | `hands.ts` | 5 digits, 14 phalanges, knuckle arc, thumb from the wrist with thenar mass, pose library, solved pinch |
| Balance, reach | `balance.ts` | centre of mass (Winter segment masses) inside the support polygon; analytic leg IK; numeric reach; contrapposto |
| Walk | `walk.ts` | a walk from footsteps: heel, ankle and forefoot rockers, swing arcs, pelvis bob and counter-rotation |
| Clothing | `clothing.ts` | garments are inflated body blobs cut to length; they turn and swing with the body |

A body part is a UNION of convex polygons (a limb is its blob chain swept pairwise), projected
through a pinhole camera with a real focal length. The outline is every boundary point not inside
a sibling polygon, minus seams where a part grows out of its parent: so an elbow has no seam, but a
forearm crossing its own upper arm still gets its overlap line.

**Mannequin is the checker, not the look (in progress).** Rendering those volumes literally reads as
a mannequin. The drawing layer (`character/design.ts`) keeps the rig as pose source and checker and
draws designed sweeps over it: a gesture curve through the joints, an authored section table, the
silhouette perpendicular to the curve. Mira's clothing and Theo the baker (`characters/theo/baker.ts`,
coloured pencil) use it. Still open: sleeve caps and forearms read tubular, clothing drape from contact
points is partial, anatomical landmarks are not yet expressed as contour breaks on the drawn layer.

## Canon (checked, not asserted)

- Heads tall by age (Loomis): 1 y 4, 3 y 5, 6 y 5.75, 8 y 6, 9 y 6.2, 12 y 7, adult 7.5, heroic 8.
- Eye line: half the head in adults, lower in children (0.44 at nine, 0.38 at one).
- Adult: crotch at half height, elbow at the waist, wrist at the crotch, hand = face, foot = forearm.
- Every canon: limb segments as fractions of (body) height from Winter's anthropometric table:
  upper arm 18.6%, forearm 14.6%, hand 10.8%, thigh 24.5%, shank 24.6%, foot 15.2%, within 16%.
- A stylised canon is a declared row. The storybook child enlarges the head 1.19x and is measured
  against the body height a real 6.2-head child of her height would have.

## Joints

Ranges (AAOS / Norkin & White, rounded): elbow 0-150, knee 0-140, hip flexion -20..125 but only 95
with the knee straight (hamstrings), ankle -45..25, neck total rotation 80, fingers MCP -20..90, PIP
0..110, DIP -5..80. Wrist, neck and shoulder are CONES (an ellipse of combined motion), not boxes.
Anything that solves a pose (leg IK, reach, the walk) either stays inside or throws; an ankle at its
limit lifts the heel instead of folding further, which is what a real heel does.

## Hands, the known weak spot

- Knuckles on an ARC (middle furthest from the wrist, little finger well back); fingers in length
  order middle > ring >= index > little; a web of skin a third of the way up the fingers.
- The thumb's metacarpal is buried in the thenar eminence: the visible thumb leaves the palm at its
  MCP, not the wrist. At rest it lies alongside the index, pointing down and forward.
- Contact is SOLVED, never typed: the pinch pulls thumb pad onto index pad; a grip pulls every
  finger joint onto the cylinder it holds (none inside it); a wave turns the forearm until the palm
  faces the lens.
- Nails on the dorsal face of the distal phalanx, drawn only when that face turns to the camera.

## Poses from reference, built like a teacher builds them

Name the reference you opened (Loomis, Hogarth, Williams, Perry and Burnfield are cited in the
files). Place the feet, solve the legs, carry the centre of mass over the support, send each hand
to a target. Contrapposto: weight foot near the midline, pelvis drops on the free side, shoulders
tilt against it. Tiptoe: toes bend flat to the floor and the mass goes over the balls. A seated
figure's support includes the seat.

## The look-at-it list (no check proves these)

Render the figure sheet and look, at full size, for: arms that hang in a gap (missing shoulder
girdle); rake hands; a thumb from the wrist; a face that turns but whose far eye does not narrow;
a hand that covers the face; a pinch that does not meet; feet that float or sink; a coat that sits
on the lap like a plate; a pointed finger that does not read as aimed. Each of those shipped in a
draft of our figure sheet and was caught only by eye. See `samples/characters/ANATOMY-CRITIQUE.md`
for the ones still open.

## Gate

`node tools/character-check.mjs` : canon ratios, limits for every library pose, bone lengths
constant, left/right symmetry, five digits in length order with the knuckle arc, pinch contact,
balance, feet on (not through) the floor, identity per view, palette hue families per hand, and
for a film the planted feet (no slide over 4 mm a frame). Then its negative twins, each of which
must fail: elbow 170, knee backwards, wrist outside its cone, straight-leg kick, finger bent back,
owl neck, a figure toppling, a blue coat, missing glasses.
