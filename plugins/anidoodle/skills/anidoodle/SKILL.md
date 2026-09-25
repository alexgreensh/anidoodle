---
name: anidoodle
description: Code-drawn stills, drawing timelapses, films, explainers and interactive web animations in 31 styles, with composed scores. Matches a reference style, keeps characters consistent, teaches drawing. Deterministic, no generated assets.
metadata:
  created_by: Alex Greenshpun (10x Company)
  license: Apache-2.0
---

# anidoodle

Pictures, films and interactive pieces drawn entirely in code. One pure function paints every
frame; another composes and synthesizes every audio sample. The same source rebuilds the same
pixels and the same sound on any machine, at any size, at any length.

The engine is the easy half. Work gets thrown away because it had no point, because the subject
was an icon of itself, because a style was only a palette swap, because the music had no form,
or because the person spent their patience approving fragments. This skill carries the craft
that prevents each of those.

## Start by asking, then build

Read `references/workflows/start-here.md` and run its intake: one question at a time, only
what the request leaves open, your recommendation first. **What** are they making, in **which
style** (show `assets/styles.jpg`; the list is `references/styles/INDEX.md`), what
**shape** (1x1, 9x16, 16x9, 4x5 or any W x H), how **long** (any length; never cap it), what
**sound** (silent or a music style and mood), which **characters**. "You pick" means pick and
say why in one line. Write the answers into a short brief before drawing.

## What are you making?

| Making | Read |
|---|---|
| A still: hero, spot, cover, card, poster, a series | Still workflow below, `references/formats.md` |
| A picture that draws itself (timelapse, making-of) | `references/workflows/drawing-process.md` |
| A loop, sticker, animated logo, ambient header | Loop workflow below, `references/formats.md` |
| A story film, any length | Film workflow below, `references/workflows/long-film.md` |
| An explainer or an infographic | `references/workflows/explainer.md` |
| A launch or product video (their screenshots welcome) | `references/workflows/launch-video.md` |
| An interactive web animation that reacts to the UI | `references/workflows/interactive.md` |
| A drawing lesson, or "how do I draw this?" | `references/workflows/teach-drawing.md` |
| A character kept identical in any style (woodcut to toy brick) | `references/workflows/character-consistency.md`, `references/anatomy.md` |
| A style matched from their image | `references/workflows/adapt-a-style.md` |
| A score or soundtrack | `references/music/README.md` |

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
   pieces), `rng(seed)` only, no clock, no `ctx.filter`. Nothing generated or downloaded; images
   the person brings may be embedded, pinned by hash. → `references/determinism-and-contract.md`
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
something moves every second. Check the seam (last frame against frame 0). ✋ **One approval,
on the moving file.**

**Film.** (1) **The story in three sentences** (setup, transformation, payoff) and the token; for
longer films, a spine plus one line per chapter. If you cannot write it, stop. (2) **The grid**:
at 120 bpm and 30 fps a beat is 15 frames; one cue table holds every frame number and a checker
runs at load. (3) **Real reference** for anything that exists. (4) **ONE look still**, the hardest
frame, critiqued in writing. ✋ **Approval.** (5) **ONE 8-second music sample.** ✋ **Approval.**
(6) **Build the whole film**; mechanical checks run continuously. (7) **Review once** from the
rendered file: a contact sheet per beat, each cut as a pair, the dead-air numbers. One ranked fix
list, one rebuild. (8) ✋ **Final approval.** Say what you verified and what you cannot.

Three approval gates at most. Approval is a budget; spend it where being wrong is expensive.

## The craft bar

The test: would a proud human illustrator ship this, or is it mechanical shape-assembly? The
full table of tells is `references/craft-bar.md`. The ones that sink most work: subjects built
from ellipses, one style recoloured into another, things that fade in instead of being drawn,
people with rubber joints, and a character drawn differently from shot to shot.

**No dead air** in anything that moves: something visibly changes every second. A film that
draws itself declares `kind: "drawing"` and is judged on a finer floor; a freeze still fails.

## The engine

`engine/` is the portable art core plus the tooling. `engine/src/canvas-core` knows nothing
about the DOM or any backend. `W`, `H`, `fps` and `durationFrames` come from the film's `meta`.

```bash
node <skill>/engine/tools/scaffold.mjs ~/art --film intro --format 9x16 --duration 180
cd ~/art && npm install && npx playwright-core install chromium
node tools/still.mjs intro --frame 0 --out out/look.png --scale 2   # a still, with its hash
node tools/render.mjs intro                                        # MP4; --out x.gif|x.webm|x.apng
node tools/gate.mjs intro                                          # determinism, contract, dead air
node tools/emit.mjs intro --out out/intro.html                     # one self-contained offline player
```

| Tool | What it does |
|---|---|
| `scaffold.mjs` | a project with a still and/or film; `--duration`, `--format` or `--size`, `--fps`, `--bpm` |
| `still.mjs` / `render.mjs` | one frame, drawn twice with its hash / the whole piece in any format, then a determinism probe |
| `gate.mjs` | determinism, contract, dead air, artifact; `--self-test` proves it can fail |
| `registry.mjs` / `gallery.mjs` | the style list from the plates themselves / the gallery sheet |
| `docs-check.mjs` | fails when any doc's style count, length or path disagrees with the code |
| `music.mjs` | renders and meters a score (loudness, range, onsets, brightness) |

Four backends, one art core: `playwright`, `html-player`, `remotion`, `hyperframes`.
→ `references/backends-and-adapters.md`

## Worked examples

- **The style plates** in `engine/src/canvas-core/`: every hand has a still and a film of it being
  drawn, with the recipe in the header and `references/styles/<id>.md`.
- **MECHANICAL LEPIDOPTERA** in `example/`: a 47 s scored film. `scaffold.mjs ~/study --example`.

**Study them. Do not copy them.** The craft bar is not satisfied by inheritance.

## Honest limits

You cannot hear the score, watch the film move, or use the interactive piece. Every claim about
them comes from a measurement or from a human; say which. A green checkmark is a claim until you
re-run it. Render one frame at `--scale 2` before trusting a still: a layer blitted through the
wrong transform looks right at 1x and breaks at 2x.
