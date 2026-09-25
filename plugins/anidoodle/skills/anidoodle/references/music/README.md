# Music: composed as data, synthesized in code, measured, then heard once

Every score in anidoodle is **100 % procedural**: you write the notes as data, the engine performs
and synthesizes them in code. No samples, no recordings, no licensed audio, ever. You cannot hear
what you make, so every choice is a number, every number is measured, and a human hears 8 seconds
before anything ships.

Code: `engine/src/canvas-core/music/`. Tool: `engine/tools/music.mjs`. The old music-box recipe
lives on, verbatim, as the default style preset: [`styles/music-box.md`](styles/music-box.md).

## The pipeline

```
MusicPlan + notes (you write)  ->  perform  ->  instruments (one stem per part)  ->  room  ->  master  ->  [L, R]
   plan.ts, pieces/*.ts           perform.ts    piano.ts, instruments.ts          dsp.ts     render.ts
```

1. **Plan** (`plan.ts`, `tables.ts`, `theory.ts`). A `Piece` = a `MusicPlan` + parts of notes + the
   harmony list.
   - The plan names:
     - one **style**;
     - a tempo and a meter (3/4, 4/4, 6/8, 12/8);
     - **sections**, each with a mood (or a blend `[a, b, w]`), a key and mode, the melody types,
       a dynamic level `[start, end]` 0..1, and an ending;
     - `repeatable` / `optional` / `pickup` / `variations` flags, which let it fit any length.
   - Notes are written in a bar-checked notation. A bar that doesn't add up to the meter throws:
     ```ts
     line(3, "C5:2 Bb4:.5 Ab4:.5 | Bb4:2 Eb4:1 | [Ab1 Eb2 Ab2]:3@0.8", { role: "melody", bpb: 3 })
     ```
   - Roles: `melody`, `inner`, `bass`, `accomp`, `color`, `drum`.
   - Generators may draft. **You compose**:
     - real harmony and voice-leading;
     - a memorable motif and phrases that ask and answer;
     - cadences.
2. **Perform** (`perform.ts`). Beats become seconds and written velocities become played ones. This
   is where "MIDI" stops. For piano:
   - voicing: the melody sits 6-10 dB over the rest;
   - a phrase arch in both dynamics and tempo;
   - the melody leads by 10-30 ms, and chords spread;
   - legato overlap on melody keys;
   - pedal changes just after each harmony change;
   - a kinematic final ritard and a breath before a sudden hush;
   - humanize from `rng(seed)`, smoothed so it correlates across a phrase.

   Parts with `opts.grid` (music box, chiptune, drive) stay mechanical on purpose.
3. **Synthesize.** Each part is an instrument:

   | Instrument | How it's made |
   |---|---|
   | `piano` | Modal, physics-shaped: inharmonic partials, 2-3 detuned strings with two-stage decay, velocity-dependent hammer brightness and strike comb, knock, soundboard modes, dampers, sustain pedal with sympathetic strings, stereo by pitch. See ADVISORY 4.1. |
   | `musicBox`, `bell` | The recipe's numbers |
   | `celesta`, `marimba`, `vibes` | Modal bars |
   | `harp`, `guitar` | Extended Karplus-Strong |
   | `strings` | Detuned PolyBLEP saws, slow bow, delayed vibrato |
   | `fmBell`, `ePiano` | 2-operator FM |
   | `pulse`, `triangle`, `noiseDrum` | NES-style chip voices |
   | `kick`, `snare`, `hat`, `bass`, `vinyl` | Drums, bass and texture |
4. **Room.** The style chooses it:
   - music box: one reflection, no tail;
   - nocturne and lullaby: a small room;
   - cinematic and drive: a hall;
   - chiptune: nothing.
5. **Master.**
   - **Gentle styles:** one static gain to **-16 LUFS**, true peak <= -1 dBTP, never a compressor.
     If the peak blocks the gain, the loudness goes down. The cure is musical (see "Peaks" below).
   - **Dense styles** (chiptune, lo-fi, drive): **-14 LUFS** through a look-ahead true-peak limiter.

A film's `audio` is `filmAudio(piece, seconds)`, which returns `(sampleRate) => [L, R]` at exactly
the film's length. `engine/src/canvas-core/score.ts` is the scaffold example.

## Any length, never hard-coded

`fitToDuration(piece, seconds)` tries every form:
- with some `optional` sections dropped (dropping music costs more than nudging the tempo);
- with the `repeatable` group restated 0..n times, as "A B A B" or "A A B" (restatements take the
  section's `variations`: `octaveDouble`, `octaveUp`, `thin`);
- at the tempo that lands the last note at `seconds - tail`, inside the style's tempo range.

It picks the form whose tempo is closest to the written one. If no full form fits, it falls back to
the piece's `shortForm`. A section's `pickup` travels with it: wherever a section lands, its own
upbeat leads into it.

Example: the nocturne "Window Light" gives
- the short form (the 8-second phrase, restated) at 15 s;
- the full piece at 45 s;
- intro, theme, theme (in octaves), build, coda at 60 s;
- six theme/climax cycles with rotating variations at 180 s.

## Styles (11) and moods (15)

Both are rows of numbers in `tables.ts`. A brief names rows, never adjectives. Each row stays
`unconfirmed` until a human has listened to 8 seconds of it; the listener's words then go into
`confirmedBy`.

| Style | Tempo, meter | Natural moods | Master |
|---|---|---|---|
| musicBox (default) | 110-130, 12/8 | joy, curious, tender, playful, wistful | gentle |
| nocturne (piano) | 50-72, 3/4 or 6/8 | tender, melancholy, wistful, romantic | gentle |
| cinematic | 60-120 | awe, triumph, melancholy, tension, hopeful | gentle |
| lullaby | 60-75, 3/4 or 6/8 | tender, calm | gentle |
| folk | 80-120, 6/8, 3/4, 4/4 | calm, wistful, joy, nostalgic | gentle |
| minimalist | 100-140 | curious, tension, awe | gentle |
| jazz | 90-180, swing | playful, nostalgic, romantic, curious | gentle |
| ambient | 50-80 | awe, calm, dread (highest ghost risk) | gentle |
| chiptune | 120-160 | joy, playful, drive, tension | dense |
| lofi | 70-90, swing 55-62 % | nostalgic, calm, wistful | dense |
| drive | 110-140 | drive, triumph, tension, awe | dense |

Moods: joy, playful, tender, wistful, melancholy, hopeful, curious, tension, dread, awe, triumph,
drive, calm, nostalgic, romantic.
- Each row has columns for:
  - modes and tempo;
  - harmonic rhythm and lead register;
  - onsets per beat and attack;
  - the target LRA and brightness;
  - instrument families and melody types.
- Compatible blends interpolate.
- Refused blends: joy + dread, playful + grief, calm + tension. Use consecutive sections instead.
- Big swings must land on a sync point.

## Keys and modes (13)

major, aeolian, harmonic minor, melodic minor, dorian, phrygian, lydian, mixolydian, major
pentatonic, minor pentatonic, blues, whole-tone, locrian. Intervals, colour notes, uses and
per-mode guards are in `theory.ts`.
- **A mode must be heard.** State its colour note early: dorian's natural 6, lydian's #4,
  mixolydian's b7. Otherwise it reads as plain major or minor.
- **The mode must match the mood.** A mode the film didn't intend reads as the wrong emotion (the
  butterfly scar: meant sunny, heard "sad and eerie"). `planProblems` checks each section's
  declared key and mode against its notes.

Melody types (9): arpeggio, stepwise, hook, ostinato, drone, call and response, counter-melody,
sequence, theme transformation.

## How to plan a score

1. **Spot the film.** Find its 3-5 true sync points, and an arc per section (for example tender, then
   swelling, then a sudden hush at about 2/3, then a soft close).
2. **Pick one style.** Give each section a mood, a key and a mode.
3. **Write the motif first.** A 2-5 note cell with its own rhythm. Then build the harmony under it,
   with voice-leading by step. Then the phrases:
   - the question ends off the tonic;
   - the answer ends on it, straight away;
   - the high point falls in the second half of the phrase.
4. **Arrange.** Add density, not length (more notes, never longer notes). Let the motif return:
   transformed, at the climax, and at the close.
5. **Print the score and meter it:**
   ```
   node tools/music.mjs score <piece>
   node tools/music.mjs render <piece> out.wav --seconds 45 --fit
   ```
6. **8 seconds to a human.** Include the most important mood change.

**Peaks are a composing problem.** Octaves in both hands landing on one downbeat make a true peak
that caps a gentle master. Fix it in the notes:
- stagger the bass by an eighth;
- spread the climax over a rolled chord;
- don't double the climax note.

Never fix it with a compressor.

## The guards (`guards.ts`): sad is allowed, formless is not

| Guard | Rule | Where it runs |
|---|---|---|
| **ghost** | Per window (4 bars, or 8 s when the tempo is unknown), FAIL only if ALL of these hold: onsets < 1 per beat, sustained-energy share > 60 %, reverb tail within 12 dB of dry, and no cadence. The window is exempt if it is a declared breath. | Bare audio too. On a reference file, unknown reverb and cadence count against it. |
| **reverb** | The late tail sits >= 10 dB under the dry mix in every bar. | Rendered pieces |
| **masking** | While the melody sounds, its 500 Hz-4 kHz band beats every other role by >= 3 dB in >= 80 % of bars. | Rendered pieces, per-role stems |
| **plan** | The declared mode matches the notes; no close thirds below C3 in the piano. | Note data |

How the ghost guard measures:
- "Sustained" means 50 ms frames that aren't decaying like a struck note (falling slower than
  6 dB/s) and aren't just after an onset.
- Onsets come from loudness-normalised spectral flux with an absolute floor of 4.0. Real note starts
  in the loved reference sit at 8-62; a detuned pad's beating sits at 2-3.4.

**Calibration** (`node tools/music.mjs samples`, see the samples' METERS.md):

| File | Onsets per window | Sustained share | Ghost |
|---|---|---|---|
| Loved Kevin Ngo piano (audio only) | 1.00-1.88 | 0.26-0.45 | PASSES |
| Hated ghost fixture (`pieces/fixtures.ts`: slow pad, 5 s tail, drifting maj7 chords, no cadence) | 0.00 | 0.79-0.90 | FAILS every window |

The fixture also fails reverb (+8 dB) and masking (0 %). A guard ships only if every loved piece
passes it and every hated piece fails it.

Brightness is reported, never gated: the loved piano's centroid is ~600 Hz.

## The 8-second human listen

Meters prove we aren't obviously wrong. Only an ear says right.
- **Per film:** one 8-second sample before scoring. It contains the most important mood change.
- **First use of a style, a family or a mood row:** 8 seconds of it, once. The listener's words are
  stored in the row.
- **Mismatch rule:** if the listener names a different emotion from the one declared, the row is
  wrong, not the listener. Change the numbers, re-measure, re-listen.
- **Honesty rule:** passing meters is not a timbre or emotion claim. If no human listened, the
  delivery says so.
