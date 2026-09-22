<p align="center">
  <img src="assets/banner.gif" width="100%" alt="anidoodle: an artist's table of code-drawn doodles, with the name writing itself in calligraphy">
</p>

<h1 align="center">anidoodle</h1>

<p align="center"><strong>Hand-drawn art, written as code.</strong></p>

<p align="center">
  Illustrations, animations and short films in nine hand-drawn styles.<br>
  Every mark is a function and every note is arithmetic, so the same source<br>
  redraws the same picture on every machine, at every size, for good.
</p>

<p align="center">
  <a href="https://github.com/alexgreensh/anidoodle/releases"><img src="https://img.shields.io/github/v/release/alexgreensh/anidoodle?color=c2410c&label=release" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-3b6ea5" alt="Apache 2.0"></a>
  <img src="https://img.shields.io/badge/made%20of-pure%20code-6b8e23" alt="Made of pure code">
  <img src="https://img.shields.io/badge/every%20render-identical-7c5c99" alt="Every render identical">
</p>

<p align="center">
  <a href="#nine-styles-to-choose-from">Styles</a> ·
  <a href="#what-you-can-make">What you can make</a> ·
  <a href="#what-it-packs">What it packs</a> ·
  <a href="#it-draws-then-it-moves">Motion</a> ·
  <a href="#get-started">Get started</a>
</p>

## Nine styles to choose from

<p align="center">
  <img src="assets/styles.jpg" width="100%" alt="Nine illustrations, each in its own style: pencil and watercolour ranunculus, marker comic koi, ballpoint pocket watch, crayon hot-air balloon, ink and line-wash wren, chalkboard moon phases, cut-paper fox, risograph lighthouse, and a single-line engraved moon">
</p>

Each style is its own way of making a mark: the taper of a nib, the bleed of a wash, the scumble of chalk on slate, the torn edge of cut paper, the halftone of a risograph drum, one engraved line spiralling out to become a moon. The subject changes shape in each hand, the way it would for nine different illustrators. Pick one for your brand and every picture after it arrives in the same hand. Every plate above, and the contact sheet itself, is drawn by code in this repo.

## What you can make

| For | You get |
|---|---|
| **Your website** | A hero illustration, spot art for each feature, empty states and a 404, all in one hand. Transparent PNGs at any size from one source, so retina and print come free. |
| **Explainers and reports** | How-it-works diagrams, cutaways and animated infographics, labelled in drafted lettering. Chalkboard, blueprint and ballpoint suit the serious ones. |
| **Your brand** | A logo that draws itself on, a title sequence, a social card template that stays on brand for every post. |
| **Social and chat** | Endless loops, GIFs and transparent animated stickers, sized for the feed. |
| **Decks and docs** | A family of section illustrations from one program. A new seed gives a sister image in the same style. |
| **Stories** | Storyboards and animatics that grow into a finished short film with an original score. |

Ask in plain words, *"a risograph lighthouse for our careers page, 1600×900"* or *"a chalkboard explainer of how our pricing tiers stack up"*, and anidoodle routes it to the right workflow and style recipe, asking only for what the request leaves open.

## What it packs

The engine is the easy half. The craft is the part anidoodle carries for you, six lessons, each one earned by getting a piece wrong first and written down so you start where the last project ended:

- **Story** gives every piece a point. One idea and one focal subject for a still; one transformation, one payoff and one returning token for a film. → [`storytelling.md`](references/storytelling.md)
- **Realism** comes from naming it. The anatomy, the view and the reference you opened, so a butterfly reads as a creature with a body and veins. → [`realism-and-craft.md`](references/realism-and-craft.md)
- **Style** lives in the mark. Nine full recipes, a guide for picking one per job, and the steps for inventing your own. → [`styles.md`](references/styles.md)
- **Music** follows a recipe. Major key, plucked, a phrase that asks a question and resolves home, warm and sure. → [`music-recipe.md`](references/music-recipe.md)
- **Determinism** is the guarantee. Pure functions and a seeded random, so anyone with the source rebuilds the exact same piece. → [`determinism-and-contract.md`](references/determinism-and-contract.md)
- **Method** keeps you fast. Prove the look on one still, build straight through, and spend approval where being wrong is expensive. → [`working-method.md`](references/working-method.md)

Every format ships from the same source: PNG, MP4 with its score, GIF, WebM and animated PNG with transparency, and one self-contained HTML file. → [`formats.md`](references/formats.md)

## It draws, then it moves

<table>
  <tr>
    <td width="50%" align="center"><img src="assets/act1.gif" alt="A cyanotype blueprint plate drawing itself, line by line"></td>
    <td width="50%" align="center"><img src="assets/alive.gif" alt="A clockwork butterfly comes to life in watercolour and flits between ranunculus"></td>
  </tr>
  <tr>
    <td align="center"><sub>Marks are <strong>made</strong>, in the order a hand would make them.</sub></td>
    <td align="center"><sub>The blueprint wakes in watercolour and flies off into its meadow.</sub></td>
  </tr>
</table>

**▶ The full 47-second film**, sound on. 1080×1080 with an original score, every frame and sample generated in code:

https://github.com/user-attachments/assets/019d46d3-536a-4843-9f68-8e8f5f5c3401

One pure function paints each frame, so a finished illustration is that function called once, a sticker is the same function on a loop, and a film is it with a story and a score. The same guarantees hold for all three.

## Pay once, draw forever

A picture model spends tokens and compute on every frame of every render, and it draws something new each time. Code spends them once. The 47-second film is a single program: written one time, it renders all 1,410 frames and a full stereo score, at any size, on any machine, free every time it runs. That works out to about sixty tokens of code per frame on the first pass, and zero on every pass after. A still is a few hundred lines. A whole family of images is a list of seeds.

## Get started

anidoodle is an agent skill: one folder with a `SKILL.md` at the top. For Claude Code, clone it into your skills folder:

```bash
git clone https://github.com/alexgreensh/anidoodle ~/.claude/skills/anidoodle
```

Then ask for what you want: *"draw a pencil & watercolour pear for our recipes page"*. To drive the engine yourself:

```bash
node ~/.claude/skills/anidoodle/engine/tools/scaffold.mjs ~/art --still hero --film intro
cd ~/art && npm install && npx playwright-core install chromium

node tools/still.mjs  hero  --out out/hero.png --scale 2   # a finished illustration, print size
node tools/render.mjs intro --out out/intro.gif            # a loop; also .mp4 with score, .webm with alpha
node tools/emit.mjs   intro --out out/intro.html           # the whole piece as one offline file
node tools/gate.mjs   hero                                 # determinism, contract and dead air in one pass
```

Node 20 or newer. Stills need only the browser above; anything that moves also uses `ffmpeg`.

`emit` writes one HTML file, around 100 KB, that plays the piece with sound on a double-click, offline. It carries the recipe and draws everything again from scratch every time you open it. Attach it to an email and you have shipped a studio.

Four backends share one art core, and the core stays blissfully unaware of which one is drawing: `playwright`, `html-player`, `remotion`, `hyperframes`.

## The example film

`example/` holds **Mechanical Lepidoptera**: 1,410 frames, 47 seconds, a clockwork butterfly that drafts itself, comes alive in watercolour, and leaves its blueprint in the grass. It is the whole engine in one piece: control points placed by hand over real anatomy, a cache key that names every input a pixel depends on, a score built from the recipe, and one unbroken move from built to alive. The nine style plates sit beside the engine in `engine/src/canvas-core/`, each with its recipe written at the top. Open any of them, change a number, and watch what moves.

## Honest by design

Sound and motion earn their claims. Every statement about the score or the movement carries a measurement or a human's eye behind it, and a green checkmark counts once it has been re-run. That discipline is why the same piece comes back byte for byte, every time, on every machine.

---

Licensed under the [Apache License 2.0](LICENSE). Copyright 2026 Alex Greenshpun.

<sub>Built with anidoodle, which learned everything it knows by drawing the butterfly a few honest times.</sub>
