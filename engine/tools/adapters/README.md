# Render adapters

An adapter is the only thing that knows how a film becomes pixels. The art core never sees one.

Every adapter exports the same four things, so `tools/gate.mjs` can hold any of them to the same
bar without knowing which it has got:

```js
export const name = "html-player";              // what to call it in a report
export const describe = () => "one sentence";   // what this adapter DELIVERS
export const probe = () => ({ ok, why });       // can it run here, and if not, why not
export const open = async (env, film, opts) => session;
```

`opts` carries `{ scale, workers }`. `workers` is the number of independent draw contexts the
session runs; the gate uses it to re-draw the same frames a different way and check they come out
the same. A session is:

```js
{ workers,                       // how many it actually opened
  info(),                        // -> film.meta
  frame(n, w),                   // -> { png: Buffer, shot, drawMs }
  hash(n, w),                    // -> stable hex digest of the drawn pixels
  audio(sampleRate),             // -> { sampleRate, frames, pcm16 } | null
  artifact(),                    // -> { path, kind, bytes, checks: [{ok,label,detail}] } | null
  close() }
```

## The four adapters

| Adapter | Delivers | Runs here |
| --- | --- | --- |
| `playwright` | frames, as a means to an MP4 | yes |
| `html-player` | THE PAGE: one self-contained offline HTML file | yes |
| `remotion` | frames through a Remotion `<Composition>`, one still per frame | yes (`remotion@4.0.522`) |
| `hyperframes` | frames seeked in headless Chrome by the Hyperframes engine | no: `npm i -D @hyperframes/engine` (Node >= 22, Chrome, ffmpeg), then `node tools/gate.mjs <film> --adapter hyperframes` |

Every adapter reaches the art through the same pure `renderFrame(film, ctx, frame, env)` and the
same `film.audio(sampleRate)`. None of them is visible from `src/canvas-core`.

Two notes worth carrying:

- **`remotion` renders every frame COLD** (a still is its own page), so it proves frame N owes
  nothing to the frames before it, and it CANNOT catch a stale cache. `html-player` shares one
  warm cache across frames and can. They check different things; run both.
- **`hyperframes` is not installed**, so its node-side capture calls have never been run. Its
  page-side FrameAdapter is proved on its own, against Hyperframes' published contract, by
  `node tools/verify-frame-adapter.mjs` — finite duration, forward/backward/random seeks, the
  same state for the same frame, and seeked pixels identical to the plain player's.

`artifact()` is the adapter's own deliverable, if it has one. The playwright adapter has none: it
is a means to an MP4. The html-player adapter's deliverable IS the page, so it returns it and
declares the checks that make that page worth shipping.

## The gate

`node tools/gate.mjs <film> [--adapter html-player] [--mp4 out/x.mp4] [--samples 12]`

Three checks, PASS/FAIL, non-zero exit on any failure:

1. **Determinism** — the same sampled frames drawn twice, at two different worker counts, in two
   different orders. Byte-identical, or PSNR above 45 dB.
2. **Contract** — a static scan of every module the film draws through: no `Math.random`, `Date`,
   `performance.now`, `ctx.filter`, network, or image/font assets; all randomness via `rng(seed)`.
3. **Dead air** — no identical consecutive frames and no 15-frame window under 0.5 % changed area,
   measured on a rendered MP4 that the gate only ever READS.
