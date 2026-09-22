# Formats: what you are making, and how each one ships

Everything is a `Film`: meta, shots that tile `[0, duration)`, and optionally a score. A still
is a film one frame long, so every tool works on every format. Scaffold the kind you need:

```bash
node <skill>/engine/tools/scaffold.mjs ~/art --still hero      # a picture
node <skill>/engine/tools/scaffold.mjs ~/art --film intro      # something that moves
```

## Stills: hero art, spots, covers, cards, diagrams

- **Size is `meta.W` x `meta.H`**, in logical units; `--scale` multiplies it at render time, so
  one source gives a thumbnail (`--scale 0.5`), the page (`1`) and print (`--scale 3`). Common
  shapes: 1600x900 web hero, 1200x630 social card, 1080x1080 square post, 1080x1350 portrait
  post, 2550x3300 letter at 300 dpi.
- **`node tools/still.mjs hero --out out/hero.png`** draws it twice and prints `reproducible`
  when both hashes agree. That line is the receipt that the same file will come back tomorrow.
- **Transparent background**: skip the paper fill and the page stays clear, so a spot
  illustration or an icon drops onto any website colour. Leave `g.paper()` off as well: over
  clear pixels it lays its grain down as a grey veil. Carry the tooth in the marks instead
  (`ink` and `paint` groups texture themselves).
- **A series** is one draw function and many seeds or parameters: a set of blog headers, a card
  per team member, a family of empty states. Put the variation in a table at the top of the
  module and render each row; `styleGallery.ts` shows how several plates compose onto one sheet.
- **An explainer or infographic** still: draw the thing, then label it with `drafting.ts`
  `letter()` and leader lines drawn with `g.pen`. Numbers are content, so every figure on the
  plate comes from a named source in a comment beside it.

The approval gate for a still is the still itself: one render, a written self-critique against
the craft table, then show it.

## Motion without a story: loops, stickers, logos, ambient art

- **Seamless loop**: drive everything from `t = local / DURATION` through functions that repeat
  a whole number of times over `[0, 1)` (`sin(2 * PI * k * t)`, integer `k`). Frame `DURATION`
  then equals frame 0 and the seam disappears. Check it: render the last frame and frame 0 and
  compare them to a mid-loop neighbour pair.
- **Animated logo / sticker**: 2 to 4 seconds, the mark DRAWN on (`progress` on `g.pen`,
  `letter`), a settle, a small idle. Leave the background unpainted for transparency.
- **Ambient / idle art** (a site header that breathes, a banner): the subject never stops; the
  motion is small and everywhere. `banner.ts` is the worked example.
- **Dead air still applies**: the gate measures it on any piece longer than one frame.

## Films: the story ones

30 to 90 seconds, a transformation, a score, the full workflow in `SKILL.md`, the doctrine in
`storytelling.md`, `music-recipe.md` and `working-method.md`. `example/` is the worked one.

## Delivering

| Output | Command | For |
|---|---|---|
| PNG | `node tools/still.mjs <name> --out out/x.png [--scale 2]` | stills, print, anything static |
| MP4 | `node tools/render.mjs <name>` | films with their score, social video |
| GIF | `node tools/render.mjs <name> --out out/x.gif [--width 640] [--gif-fps 15]` | loops, README heroes, email |
| WebM | `node tools/render.mjs <name> --out out/x.webm [--width 512]` | stickers and overlays, alpha kept (VP9) |
| APNG | `node tools/render.mjs <name> --out out/x.apng [--width 512]` | alpha loops that play in every browser |
| HTML | `node tools/emit.mjs <name> --out out/x.html` | the piece itself: one offline file that redraws it, with sound, on a double-click |

A still needs a browser only (`npx playwright-core install chromium`). Anything that moves also needs
`ffmpeg`. `gate.mjs` runs on all of them and marks the checks that do not apply to the piece,
a silent loop's audio or a still's dead air, as `----` rather than passing them.
