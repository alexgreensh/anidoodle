# Backends and adapters

One art core, four backends, and the core cannot see any of them. An adapter is the only thing
that knows how a film becomes pixels.

## The interface

Every adapter exports the same four things, so `tools/gate.mjs` can hold any of them to the same
bar without knowing which it has:

```js
export const name = "html-player";
export const describe = () => "one sentence: what this adapter DELIVERS";
export const probe = () => ({ ok, why });        // can it run here, and if not, why not
export const open = async (film, { scale, workers }) => session;
```

A session is:

```js
{ workers,                  // how many independent draw contexts it actually opened
  info(),                   // -> film.meta
  frame(n, w),              // -> { png: Buffer, shot, drawMs }
  hash(n, w),               // -> stable digest of the drawn pixels
  audio(sampleRate),        // -> { sampleRate, frames, pcm16 } | null
  artifact(),               // -> the adapter's own deliverable, or null
  close() }
```

`workers` is the number of independent contexts, and the gate uses it to redraw the same frames a
different way. That is a stronger test than it sounds: each instance has its own texture tiles,
its own layer pool and its own cache, so two instances agreeing means the caches are genuinely
keyed on what the pixels depend on and not on the order somebody happened to ask for frames in.

## The four

| Adapter | Delivers | Needs |
|---|---|---|
| `playwright` | frames, as a means to an MP4 | playwright + a chromium build |
| `html-player` | **the page**: one self-contained offline HTML file | playwright + a chromium build |
| `remotion` | frames through a Remotion `<Composition>` | `remotion`, `@remotion/bundler`, `@remotion/renderer` |
| `hyperframes` | frames seeked in headless Chrome by the Hyperframes engine | `@hyperframes/engine`, Node >= 22, ffmpeg |

## Warm and cold catch different bugs

This is the one thing to carry away.

- **`html-player` shares one warm cache across frames.** It can catch a cache key that fails to
  name everything its pixels depend on, because it draws frame 512 and then frame 128 into the
  same session and compares.
- **`remotion` renders every frame COLD** — each still is its own page, its own module state, its
  own cache. It proves frame N owes nothing to the frames before it, and it **cannot** catch a
  stale cache, because there never is one.

On this film a real order-dependence sat in the plate composer: five cached surfaces baked the
line's "boil" into their pixels while leaving it out of their key. The warm adapter found it and
named the poisoning frame. The cold adapter passed happily. **Run both. Neither is the whole bar.**

## Writing a new one

Ninety percent of an adapter is plumbing; the film is already a pure function of the frame number,
which is what every one of these backends actually wants. Two traps, both paid for:

- **Remotion screenshots when React commits**, and a committed `<canvas>` is a blank one until the
  effect runs. Hold the frame with `delayRender` / `continueRender` around the draw or you will
  ship empty plates that pass every hash check, because they are consistently empty.
- **Do not pass the film through props.** A `Film` carries functions (every shot's `draw`, the
  score) and most frameworks serialize props. Close over it instead.

For a backend that drives a **seekable page** rather than a component, the page-side contract is
small and this engine already satisfies it: a finite frame count, forward, backward and random
seeks, and the same state whenever the same frame is asked for again. `window.FILM.seek(n)` is the
whole implementation. `tools/verify-frame-adapter.mjs` holds such an adapter to that contract
using playwright, which means you can prove the page-side half **before** the backend is installed.

## If a backend is not installed

Say so. Keep every reference behind a dynamic import inside `open()` so the file imports clean,
make `probe()` name what is missing and how to get it, and let the gate report `CANNOT RUN`
(exit 2) rather than failing. Then check that the module really exports what you are about to
call, and if it does not, say what it exported instead. A backend that is not installed should
report that it is not installed — it should never quietly produce a wrong answer.
