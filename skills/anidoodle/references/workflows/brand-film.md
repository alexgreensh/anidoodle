# Brand films: someone else's brand, exactly

**Contents:** Why this page exists · Step 0: one reference film · Step 1: the inventory · Step 2: getting the files out (four routes) · Step 3: import and sign-off · Step 4: logos · Step 5: fonts and motion tokens · Step 6: people and their photos · Step 7: the brief and the board · Step 8: the hardest shot first · What a brand element may do · Data from the live site · Design critique before the first render

A brand film is a launch, event or campaign film made in a brand that already exists: a logo, a
shape language, colours, fonts, maybe motion. Everything in `launch-video.md` applies. This page adds
what a brand changes, and every rule on it was paid for on a brand launch film that took twelve
versions: wrong elements drawn from screenshots, a logo morphed through goo, the wrong company logo
three times, sponsors "not in the design file" when two frames held them, and a font never supplied.

## Why this page exists

To the brand's owner, a mark redrawn by eye is a different mark, even when it is close. So brand
elements are **imported, never drawn**, and the film only ever **moves** them. Nothing on this page
is a style choice; each step closes a door a past film walked through.

## Step 0: one reference film

Before the brief, pick ONE reference film with the person (a launch film they admire, a keynote
title sequence). Deconstruct it into notes beside the project: frames every 0.5 s, shot lengths,
seam types, camera moves, how type enters and leaves, how long text holds. Take its **grammar,
never its content**. A film started with no reference drifts toward slides, and "this is the level
of mastery I expect" arrives as a note in round five instead of a target in round one. The board
records it as `brief.reference` (`board.mjs` fails a brand film without one, or without a reasoned
"none: ...").

## Step 1: the inventory

On first access to the brand source, list **every** frame in it, not only the ones you plan to use:

```bash
node <skill>/engine/tools/brand.mjs inventory --figma <fileKey>          # Figma REST (FIGMA_TOKEN)
node <skill>/engine/tools/brand.mjs inventory --figma-json file.json     # a saved REST response
node <skill>/engine/tools/brand.mjs inventory --dir brand-pack/          # a folder of exports
```

It writes `brand/INVENTORY.md` (page, frame, id, size, the words on it, a read box per frame),
`inventory.json`, and the file's own transition timings as `motion.json`. Then:

- **"Is X in the file?"** is answered with `brand.mjs find X`, which searches every frame name and
  every word on every frame. "Not there" is only ever said with the count of frames searched.
- **Read every frame.** Mark each `[x]`, or `[-] <why it does not matter>`. `brand.mjs check` fails
  while any frame is unmarked or skipped with no reason. Partner, sponsor and speaker frames hide
  under names like "Social Media partners".

## Step 2: getting the files out (four routes)

Try them in this order; never modify the source file.

1. **Figma REST API, read only.** The person makes a personal access token (file read scope) and
   exports it as `FIGMA_TOKEN`. `brand.mjs import --figma <fileKey> --nodes <id,id>` renders each node
   as SVG with text outlined and imports it. The node ids come from the inventory.
2. **Figma's own MCP server**, if the person has it connected: export each node as SVG with text
   outlined, then import the files.
3. **The plugin API in a browser tab**, when the file is open in a browser the agent can drive:
   `node.exportAsync({ format: "SVG_STRING", svgOutlineText: true })`. Browser tools often truncate
   results near 1,000 characters, so stage the string on `window` and read it back in slices.
   Slow and fragile; use it only when 1 and 2 are closed.
4. **Ask for an export**: one zip of SVGs (text outlined), one file per element, named for what it
   is. Asking costs one message; guessing costs a round.

A brand pack, a site's own SVGs, or an Illustrator export are imported the same way.

## Step 3: import and sign-off

```bash
node <skill>/engine/tools/brand.mjs import brand/src/ --ts src/canvas-core/myBrand.ts --sheet --on '#111'
```

- Each SVG becomes one element: its exact path data, fills, gradients (linear and radial, in either
  unit system), transforms, `<use>` and `<symbol>`, CSS classes, clip-paths and hard white masks,
  each part with its box. Path data is never rewritten; transforms ride beside it as a matrix.
- It writes `brand/brand.json` and a TS module exporting `BRAND` (elements, palette, fonts, motion)
  and `brandMeta` (colours and element names). Put `brandMeta` in the film's `meta.brand` so the
  gate knows which colours are the brand's, and spread `brandMotion` into `meta.motion` so layerscan
  fails a brand colour drawn half-transparent.
- It prints what each mark can do in motion: **rotational symmetry** (a mark that is the same after
  a half turn can land from a spin without a jump) and **repeat periods** (a frieze whose shapes
  repeat every N units tiles without a seam when stepped by N). Plan moves around those numbers.
- It names what it cannot draw (a soft mask, a filter, a pattern fill, an embedded image, live text)
  instead of dropping it silently.
- `--sheet` draws every element twice, from its source SVG in the browser and from the import, and
  **fails past 1% different ink**. Show `brand/sheet.png` to the person and get the sign-off before
  the first storyboard. Every later frame is built from what they signed.

## Step 4: logos

Partner, sponsor and company logos are the same problem in miniature.

- **Copy where it is rendered in production first.** Screenshot the logo where the company uses it
  (its site header, its product), then rebuild from its SVG. `brand.mjs logo film-logo.svg --ref
  shot.png` puts the two side by side at one height; the person sees that still before the logo
  goes in. A company with a mark and a wordmark has an order, a colour per part and a spacing; none
  of it is guessed.
- **One strip, equal weight.** `brand.mjs logos sponsors/ --on dark` trims transparent margins
  (a PNG with a wide margin renders tiny), writes a one-colour version for the ground, measures each
  logo's ink and prints the height at which every logo reads equally heavy, with a strip still.
  A PNG on a solid background is refused: ask for a transparent export or the SVG.
- **Never fix a client's mark.** Overlapping outlines (letters that share a stroke) are flagged
  "check with the owner". It is usually their real design; ask, do not repair.

## Step 5: fonts and motion tokens

- **Fonts.** The import lists any live text's font. Ask ONCE, early, for the font files (OTF, TTF
  or WOFF2) or for exports with text outlined. If the font never arrives, the brief records the
  stand-in face, and the review page flags every line set in it. A stand-in that mixes with the
  brand face in one frame reads as a mistake.
- **Motion tokens.** If the source has prototype transitions (Figma interactions), the inventory
  saves their durations and easings (`motion.json`, merged into `BRAND.motion` as named tokens).
  `motionTokens(BRAND.motion, fps)` in `motionKit.ts` turns them into eases and frame counts. A
  brand's own turn (say a half-turn over 2 s on `cubic-bezier(0.5, 0, 0.5, 1)`) is the film's first
  easing choice. Spring easings have no bezier form and are set aside for the person, never guessed.
- **Temperament.** Set it before motion: how fast things may move (a share of `speedCeiling`),
  how long they settle, whether anything overshoots (`temperament()` in `motionKit.ts`). A brand that moves "like poured liquid" never
  springs; a playful one may. A film corrected first for "violent" and then for "flat" never had one.

## Step 6: people and their photos

- **Program data comes from the live site**, cited as a site source with its date (`facts.md`):
  name, role, company logo, slot. Every speaker is listed (no mystery speakers); talk titles are off
  by default because nobody reads them in a film (`board.mjs` program rules).
- **Hosts, organisers, sponsors and partners are brief fields** for an event: present, or excluded
  by the person with a reason. The people running the event are often the beat viewers like most.
- **Photo restoration and cut-outs.** When the person asks, a supplied photo may be restored or cut
  out by an image model they choose (through their own subscription tool). Show the original and the
  result side by side on the film's background before use; the original file stays untouched; record
  the model and date in the asset manifest. A model may change clothes or lighting: compare, then ask.
- **Faces are sized by head, not by photo.** Normalise people in one sequence by head height with
  crowns level; a photo cropped looser makes its person look smaller.
- **A real face is never covered, cut or swallowed by a moving shape.** The person enters and
  leaves with their stage.

## Step 7: the brief and the board

`board.mjs init` writes a board with every field; `board.mjs board.json` checks it before anything is
drawn (`storytelling.md` has the why for each rule). For a brand film it requires: the story sentence
and the message; the comic premise or "none: why"; a promise that says what the viewer DOES and
LEAVES WITH (a brand tagline is used only if it passes that test); the actor that carries the seams;
the people fields; the reference film; and for every row, what it carries in from the row before.
The brand's reveal row says why the logo appears now and what it is built from.

## Step 8: the hardest shot first

No second scene until the hardest shot (usually the logo reveal) is rendered, critiqued and approved.
Once approved, **lock it** (`lock.mjs <film> --shot <id>`, the sha into `meta.motion.approved`,
`motion-film.md`): an approved shot is restored exactly, never "improved" in passing.

## What a brand element may do

Translate, rotate, scale evenly, clip, mask, layer, tile by its measured period, and appear part by
part (`riseIn`). It may not be squashed, skewed, blurred, morphed or blended into another mark, and a
brand colour is never shown half-transparent (yellow at 50% over black reads olive). In code:
`brandKit.ts` `drawEl` throws on a non-uniform scale or a skew; a squash that IS the joke passes
`{ allowSquash: "<the gag it serves>" }`. `placeEl` positions by centre and height and is uniform by
construction. Draw helpers multiply the caller's alpha and keep its transform, and every drawn mark
reports its on-screen box to the frame probe, so the scans see brand shapes crossing a face.

## Data from the live site

Fetch site data with the web reader the session has, not with ad-hoc downloads (security hooks block
those, rightly). Save what you used with its URL and date as the facts source.

## Design critique before the first render

Before the first full render, run a design critique on the storyboard stills with whatever design
skills the person has installed (name them in the brief), and re-read the person's last notes against
the new sheet. Judge hierarchy, flow and brand temperament first; collisions second.
