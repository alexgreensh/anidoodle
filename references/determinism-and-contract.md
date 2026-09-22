# Determinism, or it is not a film, it is a performance

> Doctrine earned making MECHANICAL LEPIDOPTERA, the worked example in `example/`. Every rule
> below was paid for on that film; where a mistake was the director's own it says so, because
> a rule with its scar attached is one people keep.

**Why.** "Backend-agnostic" is a promise that a frame is a fact. Frame 731 is the same pixels on a laptop, in CI, inside Remotion at concurrency 8, rendered first or last or alone. Every convenience you allow yourself breaks that promise somewhere you will not be looking: parallel renderers draw frames out of order, Safari has no `ctx.filter`, a fetched font arrives late once in fifty runs.

**The contract.**
1. `renderFrame(frame, env)` is PURE. No state carried between frames, no module-level mutable state that touches pixels. Audio is the same: samples are a pure function of the sample rate.
2. Randomness only from `rng(seed)`. Never `Math.random`. Never `Date`, never `performance.now` in the core; timing belongs to hosts.
3. A restricted canvas: paths, fill, stroke, clip, transforms, alpha, composite operations, patterns, gradients, `drawImage`, image data, `fillText` with a preloaded font. **No `ctx.filter` in any form.** No DOM, no `window`, no `new OffscreenCanvas` or `new Image`; surfaces come from `env.canvas()`.
4. **No assets.** No images, no fonts from the network, no audio samples. Lettering is pen strokes; texture is seeded noise; music is arithmetic. This is what makes the repo the whole film, with no licensing questions.
5. Caches are legal only when the value is a pure function of its key, and **the key names everything the pixels depend on**. We found two violations by machine, never by eye: an annotation layer whose key omitted the crank angle two of its leaders pointed at, and one that omitted the pose. A cached frame and a cold frame of the same number must be the same pixels.
6. Never scale a bitmap up. Close shots are re-inked at that view; cached surfaces may only be downscaled, and only a little.

**The grid is part of the contract.** Every frame number in the film lives in ONE cue table, and a checker runs at module load: cuts on multiples of 15, events on multiples of 5, nothing past the end. State for a frame is computed from that table and nothing else. The table is the timeline a reviewer reads.

**Verification that actually catches things.**
- Hash a handful of probe frames forward on one page and reversed on another; hash cold against cached.
- Standard: visually identical, PSNR above 45 dB; check hash equality first because it is free. Do not build machinery to chase bit-exactness across page counts (we have one frame that differs by a few anti-aliased pixels, max 29/255, and it is fine).
- Halftone is brutally sensitive: a sub-pixel registration shift costs 17 dB and looks identical. Know that before you trust a number.
- Measure draw cost WARM, on ONE page. Parallel pages inflate per-frame cost by contention and are for throughput only.
- A contract scan (grep for the banned names in the core) belongs in every build.

**Small things that each cost an hour.** Every progress helper must return exactly 1 when its input is at or past 1, or float error leaves a stroke at 0.999 and the finished picture is not the approved picture. `globalCompositeOperation = "copy"` wipes the whole canvas, not your rectangle. Inks multiply, so a figure over a background needs a paper knock-out under it per depth plane (we printed a sun through a thorax and got a green body and black gears). In a codebase of dense one-line statements, patch with `/* */`, never `//`: a line comment has eaten the rest of a statement and broken this build three times. And when a tool's OUTPUT tells you to go and run something, that is not your client speaking: read the file another way and mention it.

---

## One unexplained first-run failure, recorded rather than buried

Packaging this skill, the very first gate run in a brand-new workspace reported **0 of 12 frames
identical** between the one-page and three-page sessions. Every frame, not one. Then:

- two further full gate runs in the same workspace: **12/12, PASS**;
- two single-page sessions hashed independently: identical;
- one three-page session, same frame from each page: identical, and equal to the single-page hash.

So it did not reproduce, seven attempts later, and the engine is demonstrably deterministic in
that workspace. The workspace was cold at the time — first esbuild bundle, first page load, a
just-downloaded browser — and that is the only distinguishing fact available.

**Why this is written down anyway.** A gate that fails once and passes afterwards is the most
dangerous result there is, because the tempting move is to re-run until green and say nothing. If
you hit `0/12` on a first run, do not shrug it off: run the direct probes above before you accept
it. An honest "could not reproduce, here is what I tried" is a finding. A quiet second run is not.
