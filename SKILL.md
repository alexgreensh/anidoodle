---
name: anidoodle
description: Draw, animate and illustrate entirely in code, no image or audio assets, deterministic on any backend. Use for a code-drawn film or animation, an illustration or still, a storyboard, or sketching a visual idea.
metadata:
  created_by: Alex Greenshpun (10x Company)
  license: Apache-2.0
---

# anidoodle

A 30 to 90 second film where one pure function `renderFrame(film, ctx, frame, env)` draws every
frame and a second pure function writes every audio sample. One generated HTML page IS the film;
adapters turn it into an MP4. Nothing downloaded, nothing sampled, nothing random, so anyone can
rebuild it bit for bit from source.

That is the easy half. The films that get thrown away are never thrown away for engineering
reasons. They are thrown away because they had no story, because the subject did not look real,
because the music sounded like a ghost crying, and because the client's patience was spent
approving stills of a film that did not yet exist.

## The seven laws

1. **Story is the spine.** One transformation, one payoff, one visual token that returns. Style is
   how you say it, never the point. → `references/storytelling.md`
2. **State the realism.** "A butterfly" gets you the road-sign icon of a butterfly. Name the
   anatomy, the view, and the reference you opened. → `references/realism-and-craft.md`
3. **Music gets a recipe, never an adjective.** Major key, plucked, I-IV-V-I, no pads, no drones,
   no long reverb. You cannot hear your output, so you do not improvise. → `references/music-recipe.md`
4. **Prove the look on ONE still, then build end to end.** One still buys the look. After that,
   gates cost more than they save. → `references/working-method.md`
5. **The contract is absolute.** Pure in `(frame, env)`, `rng(seed)` only, no clock, no
   `ctx.filter`, no assets. → `references/determinism-and-contract.md`
6. **One directs, one builds, both write everything down.** When a session degrades, reset it; the
   files are the memory. → `references/working-method.md`
7. **Texture is geometry and seeded tiles.** Anything a filter would have done, you do with noise
   you made yourself. → `references/realism-and-craft.md`

## Workflow

1. **Write the story in three sentences** (setup, transformation, payoff) and name the token. If
   you cannot, stop. Do not open an editor.
2. **Put it on the grid.** 120 bpm at 30 fps is a 15-frame beat. Cuts on multiples of 15, events on
   multiples of 5. ONE cue table per film holds every frame number, and a checker runs at load.
3. **Open real reference** for anything that exists in the world, and write down which images.
4. **ONE look still** — the hardest frame: hero subject, large, in its world, in the final medium
   and light. Critique it yourself in writing first. ✋ **Approval gate.**
5. **ONE 8-second music sample** from the recipe. ✋ **Approval gate.** The client listens; you can't.
6. **Build the whole film.** No per-shot approvals. Mechanical checks run continuously and need
   nobody: types, grid, contract scan, draw budget, determinism, dead air.
7. **Review the whole film once**, from the rendered file: contact sheet at one tile per beat, each
   cut as a before/after pair, the dead-air numbers. One ranked fix list. One rebuild.
8. **Verify and deliver.** ✋ **Final approval.** Say what you verified and what you cannot — you
   cannot hear it and you cannot watch it move.

Three approval gates. Not thirty. Approval is a budget; spend it where being wrong is expensive.

## The craft bar

The test: would a proud human illustrator ship this, or is it mechanical shape-assembly?

| The tell | What passes |
|---|---|
| A row of style vignettes | One arc. The medium changes only when the STORY changes state |
| Things fade or scale in | Marks are MADE, in the order a hand makes them |
| Both sides do the same thing at once | One side leads, by a few frames, never half a cycle |
| Every stroke the same weight and speed | Long strokes fast, fiddly ones slow, thick-thin, tapered |
| Flat colour fields | Wash, then pattern wet-on-damp, then line; one named light; cast shadows |
| A subject built from ellipses and capsules | Hand-placed control points over real anatomy |
| Even scatter, one flower stamped 200 times | Hand-placed drifts with bare rests; 4-5 authored views per species |
| Gradient sky, disc sun, oval bokeh | Granulating wash, sun as paper left light, lost edges |
| Decoration | Every element has a one-line reason or it is not drawn |
| A hold | The camera may creep. The subject never stops |

**No dead air**: something visibly moves in every second, from frame 0. Check it with the tool AND
by eye — a creeping camera changes every pixel and satisfies the tool while the eye sees a still.

## The engine

`engine/` is the portable art core plus the tooling. Nothing in `engine/src/canvas-core` knows
about React, Remotion, the DOM, or any backend — that separation is verified, not asserted.

```bash
node <skill>/engine/tools/scaffold.mjs ~/my-film --film myFilm   # new project, starter film
cd ~/my-film && npm install
node tools/still.mjs myFilm --out out/look.png        # step 4: the ONE look still
node tools/gate.mjs myFilm --mp4 out/my-film.mp4      # determinism + contract + dead air
node tools/emit.mjs myFilm --out out/my-film.html     # the self-contained player
node tools/render.mjs myFilm                          # the MP4
```

| Tool | What it does |
|---|---|
| `scaffold.mjs` | engine + (optionally) the example into one working project |
| `still.mjs` | one frame, full size, with its hash so a re-render can be proved identical |
| `gate.mjs` | the three bars: determinism, contract, dead air. Any adapter |
| `emit.mjs` | one self-contained offline HTML file, then verifies the file it just wrote |
| `render.mjs` / `snap.mjs` | MP4; contact sheets |
| `deadair.mjs` | per-frame changed-pixel fraction |
| `verify-frame-adapter.mjs` | holds a page-side seek adapter to its contract |

Four backends, one art core: `playwright`, `html-player`, `remotion`, `hyperframes`. Each is
roughly 100 lines and none is visible from the core. → `references/backends-and-adapters.md`

## The worked example

`example/` is MECHANICAL LEPIDOPTERA: 1410 frames, 47 s, a clockwork butterfly that is drawn,
comes alive, and leaves its blueprint in the grass. Its full spec is `example/butterfly-film-spec.md`.

**Study it. Do not copy it.** It is there so you can see what "hand-placed control points over real
anatomy" actually looks like in code — `example/src/canvas-core/butterfly/alive/anatomy.ts` builds
a discal cell and veins that fork and never cross; `butterfly/surface.ts` beside it shows a cache
key that names everything its pixels depend on. Copying it gets you somebody else's film with your title on it, and the craft bar
above is not satisfied by inheritance.

```bash
node <skill>/engine/tools/scaffold.mjs ~/study --example
```

## Honest limits

You cannot hear the score and you cannot watch the film move. Every claim about either must come
from a measurement or from a human. Say which. A green checkmark is a claim, not evidence, until
you re-run it — on this film the dead-air gate passed while a second of near-stillness sat in the
cut, and a cache key that was wrong in one frame order survived every eye that read the code. The
machine found that one; no human was ever going to.
