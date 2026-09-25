# MECHANICAL LEPIDOPTERA — the worked example

1410 frames, 47.0 s at 30 fps, 1080x1080. A clockwork butterfly is drawn on a blueprint sheet,
comes alive, and leaves its blueprint behind in the grass. Every pixel and every audio sample is
drawn by code. No images, no fonts, no samples.

`butterfly-film-spec.md` is the spec it was built from — the story, the shot list, the cue grid,
the realism section, the music. Read that first; it is what a good spec looks like.

## Study it. Do not copy it.

This is here as proof of craft, not as a template. Copying it gets you somebody else's film with
your title on it, and none of the craft bar in `SKILL.md` is satisfied by inheritance.

What is worth opening, and why:

| File | What it shows |
|---|---|
| `src/canvas-core/mechanicalLepidoptera.ts` | a whole film as data: meta, shots tiling `[0, duration)`, the score attached |
| `src/canvas-core/butterfly/act1cues.ts` | ONE cue table holding every frame number, with a checker that runs at load |
| `src/canvas-core/butterfly/alive/anatomy.ts` | realism as code: a closed discal cell, veins that fork and never cross, a scalloped margin — and a header naming the four reference images actually opened |
| `src/canvas-core/butterfly/alive/lateral.ts` | the second AUTHORED view. A closed wing is the same wing stood up, not a folded one |
| `src/canvas-core/butterfly/surface.ts` | a cache key that names everything its pixels depend on |
| `src/canvas-core/butterfly/plate.ts` | `live()` vs `still()`: two kits, so a surface drawn at some boil cannot be given a key that omits it |
| `src/canvas-core/butterfly/alive/score.ts` | the music recipe as arithmetic, with every onset asserted onto the frame grid |
| `src/canvas-core/butterfly/kit.ts` | the draftsman's marks: a ruling pen that is never quite straight |

## Running it

The example is not a project on its own — its modules import `../core`, which lives in the
engine. Put the two together:

```bash
node <skill>/engine/tools/scaffold.mjs ~/study --example
cd ~/study && npm install
node tools/still.mjs mechanicalLepidoptera --out out/look.png
node tools/gate.mjs mechanicalLepidoptera --mp4 out/mechanical-lepidoptera.mp4
node tools/emit.mjs mechanicalLepidoptera --out out/mechanical-lepidoptera.html
```

The dead-air check needs a rendered MP4 to measure; without one it reports that and the other two
bars still run. `node tools/render.mjs mechanicalLepidoptera` makes it (it takes a while: 1410
frames).

## One honest note about Act 1

Act 1 (frames 0-540) is LOCKED on the original film and it fails the dead-air bar at its open —
there are 49 identical consecutive frames in it, all inside that act. The gate reports them
separately rather than laundering them. That is the right behaviour to copy: a gate that hides a
known failure to keep a green light is worth nothing.
