# Sound design: the effects kit, placed by frame, heard over the score

**Contents:** What makes an effect sound designed, not generated · The kit · Placing effects in a film · Sound across a cut (J-cut and L-cut) · Levels and the audibility rule · Taste: when to use effects · The finished mix · Checking the finished film's sound · Tools and checks

Every anidoodle sound effect is **built in code, from nothing**: no samples, no recordings, ever.
(The music's acoustic instruments can play recordings from the optional sound pack; effects never
do.) Every effect is deterministic: the same cue and seed give identical samples.

Code: `engine/src/canvas-core/music/sfxKit.ts` (the kit), `sfxMix.ts` (placement), `sfxCore.ts`
(building blocks). Tool: `engine/tools/sfx.mjs`.

## What makes an effect sound designed, not generated

- **Layers.** Every sound has a transient (the contact: a 1-4 ms filtered noise burst), a body
  (modes of the struck object, a pitch-dropping sine, a friction band) and a tail (a small room from
  `dsp.room`). A single noise burst is not an effect. It is a click.
- **Physics, cheaply.** Plastic, bricks and bells are *modal*: a few damped sines at inharmonic
  ratios. Drops and bubbles ring with a *rising* pitch. A whoosh is a *pass-by*: distance sets
  level and air, radial speed sets the doppler glide (bright coming, darker going), angle sets pan.
  A pen's friction band brightens with stroke speed.
- **Stereo that moves.** Moving sounds travel across the field (`dir: 1` = left to right).
  Hits sit a little off-centre with a Haas offset. Tails are decorrelated.
- **No two hits alike.** Pitch, decay, pan, mode tuning and level (±1 dB) vary per seed. Twenty
  key ticks are twenty different ticks. `mixSfx` gives each cue its own seed from (kind, frame), so
  inserting a cue never changes the others.
- **Tuned where it is tonal.** chime, riser, `press:confirm` and `impact:bloom` follow the film's
  key. A sparkle in the wrong key sounds like a mistake, so there is **no default key or tempo**.
  Pass `plan.score: { piece, tempo? }` (key, bpm and bar come from the film's piece) or set
  `plan.key` / `plan.bpm`. A tuned kind with no key, or a riser with no bpm, throws.

## The kit

`node tools/sfx.mjs list` prints this live. The level is the target loudness over the sound's own
speaking window (K-weighted, see below). Duck is how far the score dips under it.

| kind | variants (first = default) | use it for | level | duck |
|---|---|---|---|---|
| tick | key, soft, ui, space | typing, one per character; a UI tick | -20.5 | 0 |
| press | thock, soft, confirm | the Generate button; `confirm` adds a tuned answer | -13 | 2 |
| pop | pop, cork, tiny | something appears; a card lands; a badge | -16 | 1 |
| ink | plip, double, bloom | an ink drop; `bloom` opens an ink-bloom frame | -15 | 2 |
| scratch | nib, pencil, marker | lettering being written (`lengthS` = writing time) | -18.5 | 1.5 |
| paper | slide, flip, rustle | a sheet lands (hit = landing), a page turn (hit = snap) | -18 | 1.5 |
| whoosh | soft, air, fast, deep | something passes the camera (hit = the pass-by) | -16 | 2 |
| swish | in, out, soft | a UI panel or card slides | -17 | 1 |
| riser | soft, air, tonal | THE build into the reveal (hit = its end) | -15 | 2 |
| impact | boom, soft, bloom | THE reveal; `bloom` breathes in first and shimmers in key | -9 | 6 |
| chime | sparkle, bell, glint | magic / success, tuned to the key | -17 | 1.5 |
| bubble | bubbles, splash, gloop | water life, the koi | -16.5 | 1.5 |
| brick | clack, snap, tumble | toy bricks: tap, press onto studs, drop on a pile | -15 | 1.5 |
| thread | pull, pierce, stitch | embroidery: thread through cloth (hit = the tug), the needle | -17.5 | 1.5 |

**Under someone else's music, effects are transients, never notes.** Use the unpitched `tap` kind
(tick, tickHi, tock, thump, impact); tuned kinds are refused unless the cue says why (`pitched`).
The impact's in-key shimmer applies only to scores the engine composes. The route for a generated or
supplied track: `generated-tracks.md`.

## Placing effects in a film

Cues are addressed by **film frame**, a whole number (a fractional frame throws; to land a hit
between frames, `snap` it to the beat). The frame is where the sound's sync point lands: the hit;
the pass-by of a whoosh; the landing of a paper slide; the END of a riser. Pre-roll (a whoosh's
approach, a riser's build) is rendered before the frame. If it would start before frame 0,
the plan throws and names the earliest legal frame.

```ts
import { filmSfx, filmAudio, composePiece, type SfxPlan } from "./music";
import { myScore } from "./myScore";                  // the Material YOU composed for this film (compose.md)
const score = composePiece(myScore);
const plan: SfxPlan = {
  fps: 30, frames: 450, score: { piece: score }, beatZeroS: 0, seed: 7,  // key, bpm, bar from the score
  cues: [
    { frame: 12, kind: "tick" },                                          // ...one per typed character
    { frame: 157, kind: "press", variant: "thock", snap: "beat", label: "Generate" },
    { frame: 182, kind: "scratch", variant: "nib", lengthS: 1.4 },
    { frame: 232, kind: "whoosh", variant: "soft", dir: 1 },
    { frame: 400, kind: "riser", beats: 4 },                              // ends ON bar 5
    { frame: 400, kind: "impact", variant: "bloom", snap: "bar" },
  ],
};
export const audio = filmSfx(filmAudio(score, 15), plan);   // Film.audio: score + effects
```

- `snap: "bar" | "beat" | "8th" | "16th"` moves the sync point to the tempo grid (`bpm`,
  `beatZeroS`, `beatsPerBar`). Snap musical moments: the reveal on the bar, a sparkle on the beat.
  Keep UI sounds (typing, clicks) on the picture.
- `beats` sizes a riser in tempo. Its chord pulses in 8ths, then 16ths, then 32nds, and it stops
  on the downbeat.
- Per cue: `variant`, `seed`, `pitch` (semitones), `gainDb`, `dir`, `lengthS`, `duckDb`, `minDb`,
  `label`.
- `mixSfx(music, plan)` returns the mix, the stems (`sfx`, ducked `music`), the duck curve, every
  placed cue and the audibility table. `filmSfx` wraps it for `Film.audio` and **throws on a
  buried cue**.
- One master at the very end: a look-ahead true-peak ceiling at -1 dBTP (`ceilingDb`). The score
  arrives already mastered, so nothing is renormalised.

## Sound across a cut (J-cut and L-cut)

The cheapest smooth seam works on the ear: the sound crosses the cut ahead of the picture or
behind it. In a **J-cut** the next scene is heard before it is seen, 0.3 to 0.8 s early (the
pond's bubbles under the last shot of the room, the nib scratching before the page appears). In an
**L-cut** the last scene is still heard 0.5 to 1.5 s into the next (a page still rustling, a pen
still scratching). The ear makes the join first, so the picture cut lands as an answer. It uses
the same cue table: cue the incoming scene's sound at `CUT - lead` (`{ frame: CUT - 15, kind:
"bubble" }`). To carry the outgoing sound past the cut, give it a longer `lengthS` where the kind
takes one (scratch, paper, whoosh, swish, riser, thread); for the others, place a few quieter cues
of that scene's sound after the cut. The score can do it too, entering its next section a beat
before the cut (a pre-lap), or letting the old chord ring over the first beat of the new scene.
This never moves a hit: a contact's sound stays on its own frame (Land on the frame, below). What
crosses the cut is a scene's ongoing sound, never a hit's. Deck card `seam-sound-leads`.

## Levels and the audibility rule

A cue nobody hears is a bug, not a subtle choice. A test that only checks a cue exists proves
nothing: test that it is heard over the music at its own moment.

- Every cue is measured against the ducked score **at its own moment**. The yardstick is
  K-weighted (BS.1770) loudness over the cue's *speaking window*: the 10 ms frames within 10 dB of
  its loudest, 15-500 ms long. The score is measured over the same window, at least 100 ms.
- **margin = cue - score.** The mix fails if any cue is more than `minDb` under (default **-6
  dB**). Short transients cut through at -3 to -6. Sustained textures (scratch, thread) want -3
  or better.
- To fix a failing cue, raise its `gainDb` first. Raise its `duckDb` only for the moments that
  matter.
- Ducking: the score dips before the cue's window (40 ms raised-cosine attack), holds, and comes
  back over 280 ms (1.2 s after an impact). Typing does not duck. The reveal ducks 6 dB.
- Measured on our own launch film's score (`launchLofi3`: a demo, never a score for your film;
  first 15 s, 33 cues): -15.5 LUFS, -1.9 dBTP, every cue audible. Margins: typing +3 to +8 dB over the intro pad; groove cues -3.5 to +5 dB; the reveal +10.7 dB.

## Taste: when to use effects

- **Effects only on real direction changes.** A press, an appearance, a scene move, a landing.
  Never under every motion, and never a constant bed of whooshes. Silence around a cue is what
  makes it land.
- **One signature riser, one impact per film.** They mark the big reveal. A second riser halves
  both.
- Transitions are gentle moves by default, so their sound is gentle: `whoosh:soft` and
  `swish:soft`. A matched hard cut takes a short hit on the beat or nothing. Never a sharp swoosh.
- Typing is one `tick` per character at the typing cadence, with `space` on spaces. Its level sits
  above the intro and under the groove.
- Put at most two cues in any 100 ms. A thock on the kick merges into the kick, which is lovely
  when it starts the groove and mud anywhere else.
- Hear it in context before it ships. Render the kit page (`node tools/sfx.mjs kit <dir>`) and a
  demo over the real score, and check the audibility table.
- **Restraint is the design.** A cue earns its place by marking something the viewer should feel: a
  press, an arrival, a landing, the reveal. Picture changes that are only edits stay silent. Count
  your cues against the film's length; if you cannot say what each one marks, cut it.
- **Land on the frame.** A hit belongs on the frame where the thing happens; within a frame either
  side reads as one event. A soft lead into the hit reads as anticipation. A hit's sound after its
  picture reads as lag, which is the one error a viewer always notices. (A place's sound may run
  past a cut: Sound across a cut, above.)
- **One voice per job.** Every press of every button is the same click, at the same level, so the UI
  feels like one object. Variety goes to the story moments, not to repeats of the same action.
- **The ending breathes.** The music settles on the tonic or lets its last chord ring, a beat of
  near silence before the final mark if the film has one, and the tail rings out to the last frame.
  Never a cut-off, never dead air after it.

## The finished mix

What the whole film's sound must be before it ships, score and effects together:

- **On its loudness target.** The delivery master (`music/delivery.ts`, the last stage of `mixSfx` and
  `mixLaunch`) sets one static gain to -16 LUFS (gentle) or -14 (dense, launch films), then a smooth
  true-peak limiter with its work capped (4 dB gentle, 6 dense): past the cap the gain gives way
  instead of the hits being squashed, and the shortfall is reported. `master: "none"` keeps the old
  peak-only ceiling. A score-only film keeps its own master (music/README.md, Master).
- **Never digital silence.** An effects-only film sits on room tone 22 dB under its cues (`bed`), nearly
  mono so a phone keeps it, from the first frame to the last.
- **A finished shape.** Sound from the first frame (within 0.5 s), no hole over 0.25 s, the last sound
  within 0.5 s of the last frame. A silence the film means (a held breath, a pause on a beat) is declared in
  `meta.quiet` as `[fromFrame, toFrame, reason]`. `verify-export --delivery` fails the shape, a true
  peak over -1 dBTP after the encode, and loudness under -19 LUFS; it warns from -17.


## Checking the finished film's sound

Before the film goes to anyone, put numbers on the mix that was actually delivered. Two tools take
the rendered file and do it (give a film name for `out/<name>.mp4`, or point at a `.wav` or `.m4a`):

```
node tools/soundcheck.mjs <film|file>                 # the scorecard; exit 1 on any FAIL
node tools/soundcheck.mjs <film> --json --out x.json  # the same, as data
node tools/soundcheck.mjs <film> --allow 3.1:3.6      # the silence there is a declared held breath
node tools/soundsheet.mjs <film> -o out/<film>-sound.png   # one picture of it all
```

Each metric in `soundcheck` gets a status line: PASS, WARN or FAIL when it has a range, INFO when
it is only reported. Under them comes **START HERE**, the changes to make ranked by importance, and
every one is specific about where and what: "3.4 s hole at 0:03.4", "crowded body, strongest near
630 Hz: notch it a couple of dB", "mids decorrelated: narrow the stereo width below 2 kHz". The
numbers fall into five groups:

- level: integrated LUFS, true peak, loudness range, loudest 3 s, intro and end level, an
  11-point arc, the loudest moment;
- shape: when the first sound arrives, any holes mid-film, dead air after the last sound, the fade,
  the closing moment, an ending that cuts off, how many onsets and accents (sudden jumps in level)
  there are per second, and held breaths (short dips that come straight back);
- spectrum: how the energy splits across five bands (rumble, warmth, body, bite and sparkle,
  20 Hz to 16 kHz), plus the centroid;
- stereo: side vs mid, L/R correlation overall and per band (150 Hz-2 kHz is where phones comb
  the body away), and how much more than the expected 3 dB the mix loses folded to mono;
- picture (any file with video): frame-difference events, the share with an onset within 100 ms
  against a chance baseline, the events with no sound, and the median onset offset. INFO only:
  not every picture change is meant to be a cue.

The built-in ranges are for drawing films: -16 to -13 LUFS (web target -14, gentle films -16),
true peak at or under -1 dBTP, LRA at most 9 LU, sound by 0.5 s, no hole over 0.25 s, at most
0.5 s of silence at the end, 150 Hz-2 kHz correlation at least 0.3, at most 1.5 dB of extra mono
loss, and the rumble (under 80 Hz) at or under -5 dB of the energy.

When the user has films whose sound they love, score against those instead:
`node tools/soundcheck.mjs profile <films...> -o references/music/sound-profile.json`, then pass
`--profile references/music/sound-profile.json`. The profile shifts the ranges that are a matter
of taste (loudness, bands, width). The ranges a delivery must meet (true peak, first sound, holes,
end silence, mono loss) do not move.

`soundsheet` lays the whole soundtrack out on one timeline, top to bottom: a strip of frames, the
spectrogram, the waveform, momentary and short-term loudness with the integrated level and -14
marked, then rows of onsets, accents and picture events (a picture event turns red when no sound
lands on it). Holes and dead air at the end are shaded. Look at it before handing the film over;
a gap, a silent ending or a late accent is obvious on the page.

The metrics live in `engine/src/canvas-core/music/soundcheck.ts`, tested on synthetic faults in
`engine/test/soundcheck.test.ts`.

## Tools and checks

```
node tools/sfx.mjs list                              # kinds, variants, levels, uses
node tools/sfx.mjs one whoosh soft 3 out.mp3         # one sound
node tools/sfx.mjs kit <dir>                          # every variant x3 + demo + page + meters.json + spectra/
node tools/sfx.mjs test                               # the gate
node tools/soundcheck.mjs <film>                      # the finished film's sound (see above)
```

The test checks every kind and variant for:

- determinism (md5 of two renders) and seed variation;
- no NaN, no DC, a peak of -1 dBFS or lower, an end at zero, and no fizz above 20 kHz (a
  16.5 kHz air roll-off is built in);
- a non-silent sound whose level stays stable across seeds.

It also checks:

- the whoosh's doppler and pan travel;
- a chime tuned to its key;
- a riser synced to tempo, and snap-to-beat;
- the demo: deterministic, at film length, true peak within ceiling, every cue audible, the score
  ducked under the impact;
- that a buried cue fails;
- that validation throws clearly on an unknown kind or variant, a pre-roll before frame 0, a bad
  seed, a frame outside the film, a snap without bpm, a bad key, or a pitch out of range.
