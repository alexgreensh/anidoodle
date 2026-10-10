# anidoodle

**Hand-drawn art, written as code.**

anidoodle makes illustrations, drawing timelapses, films of any length, explainers, infographics and interactive web animations in 32 hand-made styles, with original music composed as data and played by an engine written in code. Ask for a picture in plain words, match a style from your own image, recreate a photo in any style, keep a character consistent across scenes, or learn step by step how a drawing is built.

Music is composed for each piece from 21 genre vocabularies, never presets, and played by a sound engine written in code: a piano modelled on a real Steinway, Rhodes and Wurlitzer, orchestral sections and choir, guitars, real drum kits, real lo-fi, a full mix with reverb. An optional sound pack adds recordings of eight real acoustic instruments and three recorded rooms; every score plays without it. `music.mjs check` clears a score (key, loudness, balance, novelty) before anyone listens. The launch kit turns your product's prompts, screens and install lines into a launch film in four shapes (16:9, 1:1, 4:5, 9:16), with sound cued from the picture, captions and a sync check; `launch.mjs new` starts one and `launch.mjs ship` delivers every shape.

Every mark is a function and every score is written, so the same source redraws the same picture on every machine, at every size. There are no generated image assets and no image model calls.

Works in Claude Code, Codex and Grok Build, and in any agent that reads skills. It needs Node 20 or newer on your machine; films also use ffmpeg.

## What it runs

- The skill writes and runs local Node.js scripts from its `engine/` folder (Node 20 or newer).
- The first render in a new project runs `npm install` for the engine's open-source dependencies (esbuild, playwright-core, typescript, and Remotion for some video work) and downloads a Chromium build with `npx playwright-core install chromium`. Moving pictures also use your local `ffmpeg`.
- Nothing else leaves your machine: no telemetry, no accounts, no API keys, and the rendered pages and bundles are checked for network calls.

## Links

- Source, gallery and full docs: https://github.com/alexgreensh/anidoodle
- License: Apache-2.0, by Alex Greenshpun

## Notes for directory reviewers

The directory scan holds one finding, "Uses a credential from the user's machine". It pairs two false matches:

- `engine/src/canvas-core/bake.ts` calls `env.cache.set(...)`. `env` is the renderer's own object and `cache` is its in-memory drawing cache. Nothing reads environment variables or runs `env` or `set` in a shell.
- `engine/src/canvas-core/adaptAlmond.ts` builds a cache label for lily pad `i` as `pad${i}`. It is a string key, not a command.

anidoodle reads no credentials and sends nothing off the machine. It renders locally with Node, Chromium and ffmpeg, as described above.
