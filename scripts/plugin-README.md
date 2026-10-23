# anidoodle

**Hand-drawn art, written as code.**

anidoodle makes illustrations, drawing timelapses, films of any length, explainers, infographics and interactive web animations in 32 hand-made styles, with original music composed as data and played by an engine written in code. Ask for a picture in plain words, match a style from your own image, recreate a photo in any style, keep a character consistent across scenes, or learn step by step how a drawing is built.

Music is composed for each piece from 21 genre vocabularies, never presets, and played by a sound engine written in code: a piano modelled on a real Steinway, Rhodes and Wurlitzer, orchestral sections and choir, guitars, real drum kits, real lo-fi, a full mix with reverb. An optional sound pack adds recordings of eight real acoustic instruments and three recorded rooms; every score plays without it. `music.mjs check` clears a score (key, loudness, balance, novelty) before anyone listens. The launch kit turns your product's prompts, screens and install lines into a launch film in four shapes (16:9, 1:1, 4:5, 9:16), with sound cued from the picture, captions and a sync check; `launch.mjs new` starts one and `launch.mjs ship` delivers every shape.

Every mark is a function and every score is written, so the same source redraws the same picture on every machine, at every size. There are no generated image assets and no image model calls.

Works in Claude Code, Codex and Grok Build, and in any agent that reads skills. It needs Node 20 or newer on your machine; films also use ffmpeg.

## What it runs

- The skill writes and runs local Node.js scripts from its `engine/` folder (Node 20 or newer).
- The first render in a new project runs `npm install` for the engine's open-source dependencies (esbuild, playwright-core, typescript, and Remotion for some video work) and downloads a Chromium build with `npx playwright-core install chromium`. Moving pictures also use your local `ffmpeg`.
- The optional sound pack downloads only when you run `node engine/tools/soundfetch.mjs get <instrument>`. It comes from this project's GitHub release, and every file is checked against a pinned sha256 before it unpacks into `~/.anidoodle/sounds`.
- Nothing else leaves your machine: no telemetry, no accounts, no API keys, and the rendered pages and bundles are checked for network calls.

## Links

- Source, gallery and full docs: https://github.com/alexgreensh/anidoodle
- The worked example film and the engine's unit tests live in the repository, not in this plugin, to keep it small: clone it to use `scaffold.mjs --example` or `npm test`
- License: Apache-2.0, by Alex Greenshpun

## Notes for directory reviewers

"Uses a credential from the user's machine" points at `engine/tools/soundfetch.mjs`. It reads three settings, none of them a credential:

- `ANIDOODLE_SOUNDS`: the folder to install the sound pack into (default `~/.anidoodle/sounds`)
- `ANIDOODLE_SOUNDS_URL`: where to download the pack from (default this project's GitHub release)
- `ANIDOODLE_SOUNDS_INDEX_SHA256`: the expected hash of the pack index, for testing a new pack

It sends nothing. It only downloads when the user runs `soundfetch.mjs get`, and it refuses any file whose sha256 doesn't match the pinned value. anidoodle reads no tokens or keys and renders locally with Node, Chromium and ffmpeg, as described above.
