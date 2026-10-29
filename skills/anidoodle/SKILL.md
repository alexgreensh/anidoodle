---
name: anidoodle
description: Code-drawn stills, films, 3D motion graphics, explainers and web animations in 32 styles, with scores, narration and subtitles. Use when asked for an illustration, animation, video or drawing lesson.
metadata:
  created_by: Alex Greenshpun (10x Company)
  license: Apache-2.0
---

# anidoodle

Pictures, films and interactive pieces drawn entirely in code, in 2D or in 3D. One pure function
paints every frame; another composes the score and plays it. The same source rebuilds the same
pixels and the same sound on any machine, at any size, at any length. Eight acoustic instruments can
play recordings of real ones from an optional download. ASK the user before any score work; never download unasked.

The engine is the easy half. Work gets thrown away because it had no point, the subject was an
icon of itself, a style was only a palette swap, the music had no form, or the person spent their
patience approving fragments. This skill carries the craft that prevents each of those.

## Start by asking, then build

Read `references/workflows/start-here.md` and run its intake: one question at a time, only
what the request leaves open, your recommendation first. **What** are they making, in **which
style** (show the gallery sheet, https://github.com/alexgreensh/anidoodle/blob/main/skills/anidoodle/assets/styles.jpg; the list is `references/styles/INDEX.md`)
or in 3D (one medium per film), what **shape** (1x1, 9x16, 16x9, 4x5 or any W x H), how **long**
(any length; never cap it), what **sound** (silent, a music style and mood, narration), which
**characters**. "You pick" means pick and say why in one line. Write the answers into a short brief before drawing.

## What are you making?

| Making | Read |
|---|---|
| A still: hero, spot, cover, card, poster, a series | Still workflow below, `references/formats.md` |
| A picture that draws itself (timelapse, making-of) | `references/workflows/drawing-process.md` |
| A loop, sticker, animated logo, ambient header | Loop workflow below, `references/formats.md` |
| A story film, any length | Film workflow below, `references/workflows/long-film.md` |
| A 3D film or 3D motion graphics: extruded type, objects, puppets, a camera through space | `references/workflows/three-d.md` |
| An explainer or infographic; a machine that comes apart to explain an idea, in any style | `references/workflows/explainer.md`, `references/workflows/machines.md` |
| A launch or product video, or 2D motion graphics (their screenshots welcome) | `references/workflows/launch-video.md`; one world, one camera: `references/workflows/motion-film.md`; the kit: `references/workflows/launch-video-kit.md`; claims: `references/workflows/facts.md` |
| A film in someone else's brand: their exact elements, logos, fonts, sponsors, an event program | `references/workflows/brand-film.md` (imported and signed off before the first board) |
| Art for a site (hero by a headline, tiles, spots, share card) on its page colour and brand; or a web animation that reacts to the UI | `references/workflows/site-art.md`; `references/workflows/interactive.md` |
| A drawing lesson, or "how do I draw this?" | `references/workflows/teach-drawing.md` |
| A character kept identical in any style (woodcut to toy brick) | `references/workflows/character-consistency.md`, `references/anatomy.md` |
| A style matched from their image | `references/workflows/adapt-a-style.md` |
| A score or soundtrack; or a generated or licensed track cut to the film | `references/music/README.md`; `references/music/generated-tracks.md` |
| Narration, a voice-over, word timing or subtitles | `references/workflows/narration.md` |

- Music: pick a style vocabulary (`references/music/styles/vocabularies.md`; deep dives `references/music/styles/music-box.md`, `references/music/styles/lofi-electronic.md`) and mood, sketch the tension arc and motif, compose your own harmony, motif and form (references/music/compose.md, craft in references/music/theory/), revise until node tools/music.mjs craft shows only findings you chose, then check must PASS before a human listens. Styles give sound, never notes.
- Sound effects: references/music/sound-design.md. 14 layered, seeded effects cued by film frame (filmSfx); the score ducks, and every cue must be within 6 dB of it. Effects only on real direction changes, one riser + one impact per film. Under someone else's music, unpitched `tap` effects only.
- Launch films: `launchTemplate.ts` renders a product's launch from data (prompts, plates or its own UI, a score composed for it, words, install lines) in every shape from one timeline; `launch.mjs new|ship`. Habits that save tokens: `references/working-method.md`.

## The seven laws

1. **Every piece has a point.** A still: one idea, one focal subject, one light. A film: one
   transformation, one payoff, one token that returns. → `references/storytelling.md`
2. **State the realism.** Name the anatomy, the view and the reference you opened, for animals,
   objects and people alike. → `references/realism-and-craft.md`, `references/anatomy.md`
3. **A style is a way of making marks.** Change the medium, the edge and the order of the marks,
   beyond the palette. → `references/styles.md`
4. **Prove the look on ONE still, then build end to end.** After that, gates cost more than they
   save. → `references/working-method.md`
5. **The contract is absolute.** Pure in `(frame, env)` (and the input log, for interactive
   pieces), `rng(seed)` only, no clock, no `ctx.filter`. Nothing generated, with one exception the
   person opts into: narration, in the voice they chose, each take cached by hash and baked into
   the film. Images they bring may be embedded by hash; the sound pack is a separate, hash-pinned
   download. → `references/determinism-and-contract.md`, `references/workflows/narration.md`
6. **Music gets a plan, never an adjective.** A style, a mood per section, the notes as data, then
   measurements. You cannot hear it, so one human listens before it ships. → `references/music/`
7. **One directs, one builds, both write everything down.** When a session degrades, reset; the
   files are the memory. → `references/working-method.md`

## Workflows

**Still.** (1) Say the idea in one sentence; name the focal subject and the light. (2) Open real
reference for anything that exists, and note which. (3) Pick the style and read its plate's
header first. (4) Draw in that medium's order. (5) Render with `still.mjs` at full size, run the
**detail pass** on crops (faces, hands, feet, joins; `references/craft-bar.md`), critique in writing. ✋ **One approval.** (6) Deliver every
size and shape asked for from the same source, and say `reproducible` was printed.

**Loop.** As a still, plus: every motion is periodic over the loop, the subject never stops,
something moves every second. Check the seam (last frame against frame 0). ✋ **One approval, on the moving file.**

**Film.** (1) **The story in three sentences** (setup, transformation, payoff) and the token; for
longer films, a spine plus one line per chapter; a launch or brand film adds a `board.json` that `board.mjs` passes. If you cannot write it, stop. (2) **The grid**:
a beat is 60 x fps / bpm frames, the bpm from the brief's score; one cue table holds every frame number and a checker
runs at load. (3) **Real reference** for anything that exists. (4) **ONE look still**, the hardest
frame, critiqued in writing. ✋ **Approval.** (5) **ONE 8-second music sample.** ✋ **Approval.**
(6) **Build the whole film**; mechanical checks run continuously, and `ship.mjs` passes on the exact file before anyone sees a version. (7) **A fresh critic reviews, never you**
(`references/workflows/review.md`): after the storyboard, each scene and the full render, a new subagent that saw none of the building returns ranked, timestamped problems and a verdict. Fix the biggest, a NEW critic rechecks; 3 rounds at most, logged in `ledger.md`.
(8) ✋ **Final approval.** Say what you verified and what you cannot. Three approval gates at most. Approval is a budget; spend it where being wrong is expensive.

## The craft bar

The test: would a proud human illustrator ship this, or is it mechanical shape-assembly? The
full table of tells is `references/craft-bar.md` (3D tells: `references/workflows/three-d.md`).
The ones that sink most work: subjects built from ellipses, one style recoloured into another,
things that fade in instead of being drawn, people with rubber joints, and a character drawn differently from shot to shot.

**No dead air** in anything that moves: something visibly changes every second. A film that
draws itself declares `kind: "drawing"` and is judged on a finer floor; a freeze still fails.

## The engine

`engine/` is the portable art core plus the tooling. `engine/src/canvas-core` knows nothing
about the DOM or any backend. `W`, `H`, `fps` and `durationFrames` come from the film's `meta`. Four backends, one art core → `references/backends-and-adapters.md`.
3D: `engine/src/three-core` renders three.js onto the same frame, so every tool below works on 3D films (three.js 0.170.0, hash-pinned, `engine/vendor/three/PROVENANCE.md`; type face `engine/assets/fonts/PROVENANCE.md`).
Camera moves (pans, dollies, lens and dolly zooms, parallax, shake) and slow motion or freeze frames: `engine/src/canvas-core/camera.ts`, `engine/src/canvas-core/timeRemap.ts`, `references/camera.md`.
Seams between scenes: `references/motion-grammar.md` (cuts that carry motion: `seams.ts`; `tools/deck.mjs deal` deals each film different moves; `deck.mjs find "<name>"` turns a move's everyday name into its card). `render.mjs --blur auto` renders with motion blur (subframes per frame
from its measured on-screen speed, averaged in linear light, `--shutter 180`); the default path is untouched.

```bash
node <skill>/engine/tools/scaffold.mjs ~/art --film intro --format 9x16 --duration 12   # seconds
cd ~/art && npm install && npx playwright-core install chromium
node tools/still.mjs intro --frame 0 --out out/look.png --scale 2   # a still, with its hash
node tools/render.mjs intro                                        # MP4; --out x.gif|x.webm|x.apng
node tools/gate.mjs intro                                          # determinism, contract, dead air
node tools/emit.mjs intro --out out/intro.html                     # one self-contained offline player
node <skill>/engine/tools/soundfetch.mjs list    # no network. Nothing installed and not declined: ask the user now
node <skill>/engine/tools/soundfetch.mjs get piano rooms  # on their yes (piano 233 MB, all 373 MB). On no: soundfetch.mjs decline
```

| Tool | What it does |
|---|---|
| `scaffold.mjs` | a project with a still and/or film; `--duration`, `--format` or `--size`, `--fps`, `--bpm` |
| `still.mjs` / `render.mjs` | frames drawn twice with hashes (`--frames a,b,c --sheet <file>` in one browser) / the piece in any format (`--from/--to`, `--poster-frame`, `--hashes`) |
| `gate.mjs` | determinism, contract, dead air, artifact, 3D checks; `--self-test` proves it can fail |
| `registry.mjs` / `gallery.mjs` / `docs-check.mjs` | the style list from the plates / the gallery sheet / fails when a doc's style count, length or path disagrees with the code |
| `verify-export.mjs` | QA on the rendered file: frames, duration, score, A/V sync, true peak after the encode; opt-in first frame, loop seam, `--delivery` |
| `launch.mjs` | a launch film: `new <name>` scaffolds the spec (its `look` wears the product's own fonts, palette, shapes and logo: launch-video-kit.md, Looks); `ship <name> --shapes 16x9,9x16` renders, posters, captions, verifies and framechecks each (`framecheck.mjs`: text whole, up long enough to read, clear of the 9:16 phone zones) and checks `facts.json` (`facts.mjs`) |
| `test.mjs` (`npm test`) | unit suites in `engine/test/`, no browser |
| `music.mjs` | `vocab` prints a style's vocabulary; `check` gates your composed score (key, master, guards, stems, novelty, which parts played recordings) and prints its shape (ARC); `render`, `meter` |
| `narrate.mjs` | narration: `say` (takes, cached), `time`, `check` (hears every word back; exit 1 on a dropped word), `bake`, `all`, `providers` |
| `soundfetch.mjs` / `sfx.mjs` | the sound pack: `list`, `get <id...\|all>`, `where`, `verify`, `remove <id>` / the effects kit: `list`, `one`, `kit <dir>`, `test` |
| `ship.mjs` | every check on the exact delivered file (framecheck on all drawn text, verify-export, gate, motion and layer scans, locks, sound, cues, facts, review ledger, length), one table and a critic sheet; a check that cannot look FAILS |
| `board.mjs` / `brand.mjs` | the brief and storyboard checked before drawing / a brand imported exactly: `import --sheet`, `inventory`, `find`, `check`, `logos`, `logo` |
| `motionscan.mjs` / `layerscan.mjs` / `lock.mjs` / `worldfilm.mjs` | slide cuts, carousels, dissolves, temperament on the MP4 / text residue, fast type, shapes over faces, translucent brand colour / approved shots frozen / a film started as one world |
| `track.mjs` / `cues.mjs` | an outside track: `analyze`, `cut` by bars, `mix`, `master`, `check`, `listen`, `prompt` (never sent) / the film's own event times for sound and sync |

## Worked examples

The style plates in `engine/src/canvas-core/` (a still and a film of each being drawn, recipe in the header and `references/styles/<id>.md`) and **MECHANICAL LEPIDOPTERA** in `example/`, a 47 s scored film (`scaffold.mjs ~/study --example`). **Study them. Do not copy them.** The craft bar is not satisfied by inheritance.

## Honest limits

You cannot hear the score or the voice, watch the film move, or use the interactive piece. Every claim about them comes from a measurement or from a human; say which.
A green checkmark is a claim until you re-run it. Render one frame at `--scale 2` before trusting a still: a layer blitted through the
wrong transform looks right at 1x and breaks at 2x.
