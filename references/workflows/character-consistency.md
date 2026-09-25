# Workflow: a character that stays itself

> "I want to make a movie about this specific character." The character is built ONCE, as a
> module, approved ONCE, as a model sheet, and from then on every still, shot, film and style
> POSES it. Nothing ever draws it again. Worked example: Mira (`engine/src/canvas-core/characters/mira/`).

**Why.** `storybook.ts` and `print.ts` both draw Bit, from two separate sets of control points.
Change one and the other is a different robot. A character drawn per shot drifts per shot: the
glasses change size, the coat changes yellow, the hand grows a sixth finger. The fix is structural,
not diligence: one source of truth, and a gate that says when a shot departs from it.

## The module (one file per character, plus its poses and palettes)

| Export | What it is |
|---|---|
| canon + spec | a canon ROW (`human/canon.ts`), height, body and head specs |
| rig | the 3D skeleton the canon implies, with joint limits (`human/skeleton.ts`) |
| drawn views | parts a volume can't describe (a fringe, a cowlick) authored as 2D shapes in 3 views with matching points, blended by view angle (`view25d.ts`, Rivers et al. 2010) |
| palette ROLES | `coat`, `skin`, `hair` ... each with a hue family; every hand MAPS the roles in its own medium (`palettes.ts`) |
| distinguishing features | glasses, fringe, cowlick, freckles, raincoat, satchel, wellies: part ids plus the views they must appear in |
| `pose(p)` | validates a pose; throws if any joint leaves its range |
| `toScene(pose, camera)` | the character as a Scene: parts in paint order, each a union of polygons plus marks, in role colours |

Hands render any Scene with their own marks: `storybook`, `marker`, `riso`, `woodcut`,
`scratch`, `sumi`, `pencil` (in `character/render/`), each built on its plate's kit. The geometry
every hand receives for one pose is identical (the gate asserts it).

**Consistency is style-free.** The module is a spec (features, proportions, palette roles, signature
shapes), not a look. Line hands draw the Scene; GRID hands (`render/grid.ts` → `pixel.ts`, `brick.ts`)
re-express it in their own units: sample the top part per cell, exaggerate small rings (glasses) to a
minimum radius, and drop what a sprite can't hold (lids, brows, temples). Identity is then checked on
the cells, not the scene (`character/identity.ts`), plus silhouette IoU against a finer sampling.

**The drawing layer (illustrator-first, IN PROGRESS).** The skeleton, canon, limits and balance are the
invisible checker and pose source. Visible masses are designed sweeps (`character/design.ts`): a gesture
curve through the joints, an authored section table along it, the silhouette taken perpendicular to the
curve, split at joints with overlap so no seam shows. Mira's coat, sleeves, legs and boots and the baker
(`characters/theo/baker.ts`) use it; the scene carries `gesture` curves for a lay-in pass. Not done yet:
per-view hand-placed contour control points, drape from contact points for all clothing, landmarks as
contour breaks on the drawn layer. The older Theo figure model still renders the volumes literally.

## Steps

1. **From a description**: write the identity in one paragraph (age, canon, the 5-8 features a
   child would draw from memory). Pick the canon row; if the look needs a bigger head, DECLARE a
   stylised row, keep the body real. **From a user's image**: list the features, sample the colours
   into roles, read proportions against a head-unit grid, draw the image's own view first; views the
   image does not show are invented and labelled as invented on the sheet.
2. **Build the module**: spec, roles, features, clothing as inflated body blobs, 2.5D parts for
   hair, a pose library built from placed feet, solved legs, balance and reach targets.
3. **Model sheet** (`miraSheet.ts`): turnaround (front, 3/4, profile, back) on a head grid, six
   expressions, six poses, six hands, a scale line-up. Look at it at full size against
   `references/anatomy.md`'s look-at-it list. ✋ **The one approval.** It pins the version.
4. **Prove the hands**: the same pose and camera in every hand you will use (`miraTriptych.ts`,
   and `miraEveryHand.ts` for nine hands, each tile at full size from `miraTile.ts`). If she reads as
   different girls, fix the hand's role mapping, not the character.
5. **Use it**: shots import the module and pose it. A film computes a pose per frame (the walk is
   footsteps, not keyframes) and hands it to `toScene`.
6. **Change it**: any change to the module bumps its version and re-renders the sheet.

## Invariants the gate checks (`node tools/character-check.mjs`)

- canon ratios and segment lengths; bone lengths constant in every pose; left/right symmetry;
- every library pose inside joint limits; standing poses balanced; feet on, not through, the floor;
- five digits in length order, knuckle arc, thumb meets index in the pinch;
- every distinguishing feature present in every view it should be (ten views, both sides);
- every palette role inside its hue family in every hand (riso measured as the overprint it prints);
- scene geometry deterministic; a film's planted feet do not slide.

- per hand in the every-hand sheet: the feature checklist (scene features for line hands, cell
  features for pixel and brick), palette roles in family, grid IoU > 0.8 for pixel and brick.

Each has a negative twin that must fail. What the gate cannot see: whether she LOOKS like herself.
Silhouette overlap is identical by construction across line hands, so it proves nothing there; the
model sheet and the every-hand sheet, looked at by a person, are the identity test.
