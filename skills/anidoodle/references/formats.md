# Formats: what you are making, and how each one ships

**Contents:** Stills: hero art, spots, covers, cards, diagrams · Motion without a story: loops, stickers, logos, ambient art · Films: the story ones · Delivering

Everything is a `Film`: meta, shots that tile `[0, duration)`, and optionally a score. A still
is a film one frame long, so every tool works on every format. Scaffold the kind you need:

```bash
node <skill>/engine/tools/scaffold.mjs ~/art --still hero      # a picture
node <skill>/engine/tools/scaffold.mjs ~/art --film intro      # something that moves
```

## Stills: hero art, spots, covers, cards, diagrams

Art that sits on a site beside a headline, on its page colour and brand: `workflows/site-art.md`.

- **Size is `meta.W` x `meta.H`**, in logical units; `--scale` multiplies it at render time, so
  one source gives a thumbnail (`--scale 0.5`), the page (`1`) and print (`--scale 3`). Common
  shapes: 1600x900 web hero, 1200x630 social card, 1080x1080 square post, 1080x1350 portrait
  post, 2550x3300 letter at 300 dpi.
- **`node tools/still.mjs hero --out out/hero.png`** draws it twice and prints `reproducible`
  when both hashes agree. That line is the receipt that the same file will come back tomorrow.
  Several frames of a moving piece in one browser: `--frames 0,450,900` (or `0-900:150`), with
  `--sheet out/sheet.jpg` for a contact sheet at 0.4 scale (`working-method.md`).
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
  compare them to a mid-loop neighbour pair, or run `node tools/verify-export.mjs <name> --loop`
  on the rendered file, which judges the last-to-first step against the loop's own mid-loop
  deltas.
- **Animated logo / sticker**: 2 to 4 seconds, the mark DRAWN on (`progress` on `g.pen`,
  `letter`), a settle, a small idle. Leave the background unpainted for transparency.
- **Ambient / idle art** (a site header that breathes, a banner): the subject never stops; the
  motion is small and everywhere. `banner.ts` is the worked example.
- **Dead air still applies**: the gate measures it on any piece longer than one frame.

## Films: the story ones

30 to 90 seconds, a transformation, a score, the full workflow in `SKILL.md`, the doctrine in
`storytelling.md`, `music/README.md` and `working-method.md`. `example/` is the worked one.

## Delivering

| Output | Command | For |
|---|---|---|
| PNG | `node tools/still.mjs <name> --out out/x.png [--scale 2]` | stills, print, anything static |
| MP4 | `node tools/render.mjs <name>` | films with their score, social video |
| GIF | `node tools/render.mjs <name> --out out/x.gif [--width 640] [--gif-fps 15]` | loops, README heroes, email |
| WebM | `node tools/render.mjs <name> --out out/x.webm [--width 512]` | stickers and overlays, alpha kept (VP9) |
| APNG | `node tools/render.mjs <name> --out out/x.apng [--width 512]` | alpha loops that play in every browser |
| HTML | `node tools/emit.mjs <name> --out out/x.html` | the piece itself: one offline file that redraws it, with sound, on a double-click |

Render options that hold for every moving format:

- `--poster-frame N [--poster-fade 6]`: platforms show frame 0 as the thumbnail. The file opens
  on frame N (the wall of styles, the logo, the prompt written big) and dissolves into the real
  opening by frame 6. The frame count and the score are unchanged. A delivery whose frame 0 is
  near-blank gets a warning after the encode.
- `--blur auto` (or `--blur N`): motion blur, each output frame the average of subframes over the
  shutter, in linear light and weighted by alpha (so a transparent WebM or APNG gets no dark
  fringe). `auto` measures each frame's on-screen motion (two sharp renders at the shutter's ends,
  block-matched; drawing strokes, typed letters and halftone patterns are not mistaken for motion)
  and takes subframes at most `--blur-px` apart (default 3 px): 1 on a still frame, which comes out
  untouched, up to `--blur-max` (32) on a whip. Deterministic. `--shutter DEG` is the shutter
  angle, 180 by default (360 is the old whole-frame shutter). Stepped art (`meta.step` > 1,
  `onTwos`) is never blurred.
- `--shapes 16x9,1x1,4x5,9x16`: a launch template film rendered in each shape from one timeline
  (each re-composed by its layout, never cropped) to `out/<name>-<shape>.mp4`. Any tool takes
  `<name>-<shape>` as the film's name for one shape.
- `--from F --to T`: frames `[F, T)` only, silent, written to `out/<name>.<F>-<T>.<ext>`, never
  over the finished film. For checking a passage, not for shipping.
- `--hashes out/x.md5`: the md5 of every frame handed to the encoder, for frame-exact
  comparisons of two renders before any codec blurs the difference.

Words on screen, wherever the shape:

- **Reading time.** Each text stays up at least `max(0.7 s, 0.3 s per word)`. `node tools/framecheck.mjs
  <name>` times every block of text the film DRAWS (glyphs joined into words and blocks, through
  layers and clips; typed text is timed from its last character) and fails any block held shorter.
  It is never N/A while text is drawn: a film that draws none says NONE with the evidence, and no
  frame checked is a FAIL. Text meant as texture is drawn inside `texture(ctx, draw)` and skipped.
  Build holds from the rule, not by feel: `readable.ts` `chatHold(text)` is think time (about 0.6 s)
  plus typing (about 52 characters a second) plus the full read AFTER the last character, times one
  `pace` scalar (`paced`, per section if needed). Worked example: an 11-word typed reply needs 3.3 s
  of reading after it finishes; a launch film held it 0.9 s, viewers said "too fast" twice, and even a
  25% slowdown left it under the floor. "20% slower" is then one number, `pace: 1.2`.
- **Layout and the last second.** framecheck also fails more than 7 text blocks in a frame, 5 or more
  packed into under 30% of it, a centred stack of 5 or more, gaps under 3% of the short side, text
  over text or across a card's edge (held 0.5 s), any line under 28 px at 1080 in the last second,
  an end card that lands twice, and people in one sequence whose heads differ by more than 10%.
  A deliberate dense frame (a UI beat) is declared in `meta.checks.layoutExempt` with its reason.
- **No text on a busy picture without a plate** (`craft-bar.md`).
- **Phone safe zones, 9:16 only.** Reels, TikTok and Shorts lay their own name, caption, buttons
  and progress bar over the frame. Keep text and key content out of the top 14 % and bottom 25 %
  of the height, and the right 14 % of the width (the button column) between them. The shares are
  the cautious end of the creator safe-area guidance those apps publish for vertical video,
  rounded up; their layouts change, so re-check before a campaign. `framecheck.mjs` finds text in
  those zones on any 9:16 frame (`SAFE-ZONES`) and `launch.mjs ship` fails the shape for it
  (`--zones warn` only flags it). The launch template composes its 9:16 layout inside the safe
  rectangle: the chat, the words, the split beat, the end card and the corner mark, with burned-in
  captions (`captions: "burn"`) in a band at the safe rectangle's bottom. The background still fills
  the frame. Other shapes report N/A.
- **Claims** in a film, on screen or spoken, are listed with their sources in `facts.json`
  (`workflows/facts.md`).

After any encode, `node tools/verify-export.mjs <name> [--first-frame #hex] [--fidelity-psnr 40]`
proves the file on disk is the film: size, exact frame count, duration, the score (an audio
stream exactly when the film has one, as long as the picture, not silent), its SYNC (the decoded
sound cross-correlated with the master mix at each of `meta.sync`'s markers, within 1 ms, and each
cue's attack where the master put it), its true peak after the encode (-1 dBTP under
`--delivery`), and optionally the
first frame's average colour and its fidelity to the source frame (`--frame N` picks which
frame `--fidelity-psnr` compares; default 0). All of it is opt-in beyond the container facts,
so transparent and non-uniform pieces pass cleanly. For a file that ships, add `--delivery`: a
near-blank frame 0 then FAILS instead of warning; the fix is `render --poster-frame N`.

**Venue screens.** A film that will also loop on screens at an event: ask first what plays it (a
video player, a presentation app), make the loop seam clean (`gate` checks the last frame against
frame 0 for loops), and never depend on the sound, which venues often mute.

**Ship.** Before any version is shown to anyone, `node tools/ship.mjs <film> --file out/<file>.mp4`
runs every check on that exact file and writes a table and a critic sheet beside it (`workflows/review.md`).

A still needs a browser only (`npx playwright-core install chromium`). Anything that moves also needs
`ffmpeg`. `gate.mjs` runs on all of them and marks the checks that do not apply to the piece,
a silent loop's audio or a still's dead air, as `----` rather than passing them.
