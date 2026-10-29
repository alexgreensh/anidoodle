# Music: composed as data, performed, measured, then heard once

**Contents:** The pipeline · Recorded instruments: the optional sound pack · Any length, never hard-coded · Styles (21) and moods (21) · Keys and modes (13) · How to write a score · The guards (guards.ts): sad is allowed, formless is not · The 8-second human listen

Every score in anidoodle is written as data and every voice is the engine's own: you write the
notes, the engine performs them. You cannot hear what you make, so every choice is a number, every
number is measured, and a human hears 8 seconds before anything ships.

Eight acoustic instruments also play **recordings of the real thing**, from an optional sound pack
you install separately: grand and upright piano, concert harp, marimba, vibraphone, glockenspiel,
tubular bells and timpani, plus three recorded rooms. Everything else, and every score on a machine
without the pack, is synthesized in code exactly as before. See
[Recorded instruments](#recorded-instruments-the-optional-sound-pack) below.

Code: `engine/src/canvas-core/music/`. Tools: `engine/tools/music.mjs`, `engine/tools/soundfetch.mjs`.
To check a finished film's sound: `engine/tools/soundcheck.mjs` and `soundsheet.mjs` ([how](sound-design.md#checking-the-finished-films-sound)).

**Start here: [`compose.md`](compose.md).** It takes you from a brief to an original score. A style
is a vocabulary: sound, grooves, harmony language, melody rules, arrangement grammar. It is never
notes. You compose every note, and nothing is filled in for you. There is no default style.

Pages:
- [`compose.md`](compose.md): the workflow, the material format, craft, and the never-reuse rule.
- [`generated-tracks.md`](generated-tracks.md): when the person wants a music-model take or a licensed
  track instead: pinned and costed, cut by whole bars, unpitched effects, mastered and checked.
- [`theory/`](theory/README.md): the craft behind it: melody, harmony, rhythm, mood mapping, form and
  orchestration, sound (psychoacoustics for voicing and mixing). Cited, and measured by
  `node tools/music.mjs craft`.
- [`styles/vocabularies.md`](styles/vocabularies.md): all 21 style vocabularies, the 15 groove
  families and the section kinds. It is generated from the code.
- [`styles/lofi-electronic.md`](styles/lofi-electronic.md): the lo-fi electronic vocabulary in
  depth, and the stem balance meter.
- [`styles/music-box.md`](styles/music-box.md): the original music-box recipe's sound numbers and
  the scar story behind the guards.
- [`sounds-licenses.md`](sounds-licenses.md): where the recordings come from, and the attribution
  CC BY asks for. Required reading before you redistribute a pack.

**Demos are not scores.** The pieces in `pieces/` (samplers, families, nocturne, our launch scores)
were written to prove the synth and the meters, and one of them is our own film's score. They are
listening references and the novelty corpus (`node tools/music.mjs list`). A film never plays them:
`node tools/music.mjs novelty` fails a score that sounds like them or quotes them.

## The pipeline

```
MusicPlan + notes (you write)  ->  perform  ->  instruments (one stem per part)  ->  room  ->  master  ->  [L, R]
   plan.ts, pieces/*.ts           perform.ts    piano.ts, instruments.ts          dsp.ts     render.ts
```

1. **Plan** (`plan.ts`, `tables.ts`, `theory.ts`). A `Piece` = a `MusicPlan` + parts of notes + the
   harmony list.
   - The plan names:
     - one **style**;
     - a tempo and a meter (2/4, 3/4, 4/4, 5/4, 6/8, 7/8, 9/8, 12/8);
     - **sections**, each with a mood (or a blend `[a, b, w]`), a key and mode, the melody types,
       a dynamic level `[start, end]` 0..1, and an ending;
     - `repeatable` / `optional` / `pickup` / `variations` flags, which let it fit any length.
   - Notes are written in a bar-checked notation. A bar that doesn't add up to the meter throws:
     ```ts
     line(<start beat>, "<NOTE>:<beats> <NOTE>:<beats> | [<NOTE> <NOTE>]:<beats>@<vel> | r:<beats>", { role, bpb })
     ```
   - Roles: `melody`, `inner`, `bass`, `accomp`, `color`, `drum`.
   - Nothing generates notes. **You compose** (compose.md):
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
3. **Perform the instruments.** Each part is an instrument:

   | Instrument | How it's made |
   |---|---|
   | `piano` | Modal, physics-shaped: inharmonic partials, 2-3 detuned strings with two-stage decay, velocity-dependent hammer brightness and strike comb, knock, soundboard modes, dampers, sustain pedal with sympathetic strings, stereo by pitch. See ADVISORY 4.1. |
   | `musicBox`, `bell` | The recipe's numbers |
   | `celesta`, `marimba`, `vibes` | Modal bars |
   | `harp`, `guitar` | Extended Karplus-Strong: pick position, two polarisations, a commuted body (harp fitted to CC0 recordings). `kind`: nylon (default), steel, electric (`pickup`: neck or bridge, `drive` into a clean amp) |
   | `strings` | A section of `players` (default 10, divided across chords), each with its own timing, tuning, drift, vibrato and bow noise, through measured violin, viola and cello bodies. `pizz: true` plucks |
   | `fmBell`, `ePiano` | 2-operator FM |
   | `pulse`, `triangle`, `noiseDrum` | NES-style chip voices |
   | `kick`, `snare`, `hat`, `vinyl` | Drums and texture |
   | `bass` | `kind`: finger (default, electric through an amp, `drive`), pick, upright (body, pitch settle, thump), synth (saw + sub into a 24 dB filter, glide) |
   | `warmPad`, `softPluck`, `sub` | The lo-fi electronic kit (`lofiKit.ts`): detuned-saw pad, filtered pluck with ping-pong delay, sine sub |
   | `organ` | Drawbar ranks (harmonics 1 2 3 4 6 8), chorus, tremulant |
   | `brass` | Section of `players` (default 3): harmonics that brighten with loudness, a lip scoop, breath, bell formants (`type`: trumpet, trombone or horn; `bright` < 0.75 = horn) |
   | `woodwind` | Flute (chiff, jet and breath noise, breath vibrato) or `reed: true` clarinet (odd harmonics, reed noise). Touching notes slur |
   | `choir` | Singers (`singers`, default 8) with a glottal source, jitter, shimmer and breath, through 5 formants per vowel. `vowel`: a e i o u, or a sequence (`"uoa"`) that morphs across each note |
   | `timpani` | Tuned membrane modes, a pitch settle, a mallet thump (`pitch` tunes it in a drum lane) |
   | `leadSynth` | Mono saw + square, portamento, a filter envelope, blooming vibrato |
   | `bowedSolo` | A bowed waveguide string (violin, or `cello: true`): touching notes are one bow with a finger slide, delayed vibrato, measured body |

   Eight of these play recordings of real instruments when the sound pack is installed. The table
   below is what the engine builds; [Recorded instruments](#recorded-instruments-the-optional-sound-pack)
   is what it plays instead.

   The modelled voices are approximations: cinematic and stylized, never "realistic". Every note
   varies (seeded), so repeats never clone. A human listens before one carries a film. A shipped
   score sets `legacy: true` on its piece to keep the sound it shipped with, and never reaches the
   sampler at all.
4. **Room.** The style chooses it:
   - music box: one reflection, no tail;
   - nocturne and lullaby: a small room;
   - cinematic and drive: a hall;
   - chiptune: nothing.
   With the pack installed, a style may name a recorded room instead and the engine convolves with
   the recording.
5. **Master.**
   - **Gentle styles:** one static gain to **-16 LUFS**, true peak <= -1 dBTP, never a compressor on the master.
     Struck stems (plucks, plucked basses, piano, mallets and bells, timpani) first go through a transient-aware
     gain in the mix (only the pick or hammer spike above the note's own body comes down, up to 6 dB, the stem's
     level unchanged), so their attacks don't hold the master under the ceiling. `RenderOpts.gentleGlue` (a <= 1 dB
     2:1 bus glue) exists but is off by default. If the peak still blocks the gain, the loudness goes
     down. The cure is musical (see "Peaks" below): a solo piano with a 10 LU range (the nocturne demo) masters at -17.5.
   - **Dense styles** (lofiElectronic, lofi, drive, house, synthwave, hipHop, rock, chiptune): **-14 LUFS** through a look-ahead true-peak limiter, then a static trim if an inter-sample peak still passes -1 dBTP.
   - **A film's whole mix** (score plus effects, or effects alone) goes through the delivery master last:
     `sound-design.md`, The finished mix.

A film's `audio` is `filmAudio(piece, seconds)`, which returns `(sampleRate) => [L, R]` at exactly
the film's length. It fits the score first (`fitScore`, below), so the music ends on its phrase at
the last frame and is never chopped. Any film mix that renders a score (sound effects included) must
fit it the same way. `engine/src/canvas-core/score.ts` is an empty skeleton: `filmScore(material,
fps, frames)` composes your material and fits it.

## Recorded instruments: the optional sound pack

The pack is a separate download (about 390 MB), not part of the skill. Once it is installed, eight
acoustic parts play recordings of real instruments and three rooms are recorded impulse responses.
Without it every score still plays, on the modelled voices, unchanged.

Every stereo recording is made phone-safe when its bank loads (`RECORDING_WIDTH` in `sampler.ts`): a
side whose body (150 Hz to 2 kHz) is clearly inverted is flipped back and the body is narrowed, while
the air above 2 kHz keeps its width, so a mono fold keeps the whole instrument.


```bash
node tools/soundfetch.mjs list          # the install directory and what is installed; no network
node tools/soundfetch.mjs get harp rooms # the one command that downloads: hash, unpack, install (`all` = 373 MB)
node tools/soundfetch.mjs decline       # the user said no: remembered, nobody is asked again
node tools/soundfetch.mjs where         # the install directory
node tools/soundfetch.mjs verify        # re-hash every installed file
node tools/soundfetch.mjs remove <id>   # drop one instrument, or `rooms`
```

**The user decides, once.** Before the first score of a session, run `list`. When nothing is
installed and it does not say the recordings were declined, ask the user in plain words whether
they want real recorded instruments, and name the size: the whole pack is 373 MB, the grand piano
alone 233 MB, and one piece usually needs one instrument plus `rooms` (0.4 MB). Yes: `get` those
ids. No: `decline`, which is remembered across sessions. Never download without that answer.
`music.mjs` and the film tools print the same offer, with the ids and sizes the piece in hand
needs, whenever a part falls back to a code-built voice.

`get` names the ids it wants, or `all`. It installs to `ANIDOODLE_SOUNDS`, or
`~/.anidoodle/sounds`, and refuses any archive whose size or sha256 disagrees with the index
before it unpacks. `ANIDOODLE_SOUNDS_URL` points the fetch at a different release; point it at a
local directory or a `file://` URL and `list` also prints what is available there, since a local
source is read off disk. Against the GitHub release `list` reads the installed manifest alone and
prints that the index is fetched by `get` only. The engine finds an installed pack on its own; to
render from a pack directory without installing it, pass `--sounds <dir>` to `music.mjs`.

| Part | `variant` | Recording | Range | What it brings |
|---|---|---|---|---|
| `piano` | | Grand Piano, Steinway B | A0 to G#7 | 3 velocity layers, pedal-down resonance (`sus`) and key-release (`rel`) |
| `piano` | `"upright"` | Upright Piano, Knight | A0 to C8 | 2 layers, key-release only, no pedal resonance |
| `harp` | | Concert Harp | D1 to G7 | rings out, nothing damps it |
| `marimba` | | Marimba | D2 to C7 | 3 layers, rings out. Sparse: some notes are a recording shifted up to 3 semitones |
| `vibes` | | Vibraphone | F3 to F6 | 3 layers, damped, so the pedal holds it |
| `glockenspiel` | | Glockenspiel | G5 to C8 | 3 layers, rings out. Sparse: up to 3 semitones |
| `bell` | `"tubular"` | Tubular Bells 1 | C4 to F#5 | 2 layers, rings out |
| `timpani` | | Timpani | C#2 to B3 | 3 layers, rings out |

The recordings are from VCSL, CC0. Ranges and the layer counts above are read from the installed
pack's own `manifest.json`; `check` names a sparse bank when it meets one. `bell` without
`"tubular"`, and every other instrument in the table above, are still modeled.

Not recorded, and still synthesized in code: strings, guitar, bass, brass, woodwinds, choir,
celesta, music box, the electric pianos and the acoustic drum kit. Synths, lo-fi colour, electronic
drums and every sound effect are code and stay code.

### What changes when you write for a recording

- **Write inside the range.** A note outside the bank's range throws and the render stops. The grand
  reaches A0; the timpani stops at B3, so anything above B3 in a timpani part needs another
  instrument. Inside the range every note plays: the engine takes the nearest recorded pitch.
- **The decay is the instrument's own.** A low grand note rings for tens of seconds and nothing
  trims it to fit the tail. Let the low notes ring and give them room.
- **The pedal is a pedal.** A `sus` zone is the strings ringing with the dampers lifted, played
  instead of the ordinary zone for any note struck while the pedal is down; a `rel` zone is the
  damper coming back, added quietly at key-up. `perform.ts` moves the pedal just after each harmony
  change, so write pedal changes where the harmony changes. `opts: { pedal: false }` holds it up.
- **Soft playing keeps a real attack.** The Steinway bank has three velocity layers and its source
  was normalized, so soft notes come from the soft recording with the modeled piano's velocity law
  rather than a quiet copy of a loud one. Do not add an attack that isn't there.
- **Between layers and between keys, the tone follows the real takes.** A velocity between two
  layers plays the louder take softened to the colour read between the real takes of that key
  (a softer blow is darker, not only quieter), and a key between two recordings takes the colour
  of the recordings either side, so a moved take does not drag its body resonances along. Both
  piano banks do this; `opts: { velocityTone: "lowpass" }` brings back the older single filter.
  On the grand, a take whose treble stands out from the takes either side, or a corner in the
  register between two neighbouring takes, gets a fixed gentle shelf when the bank loads: the
  duller take is lifted at most 4 dB and the brighter one comes down by the rest.
- **Key-up lets the bass hum.** On the grand the felt stops the upper partials at once while the
  lowest strings keep a low hum for a moment, as the recorded release takes do.
  `opts: { release: "flat" }` damps every frequency at one rate.
- **Measure before you tune.** `node tools/pianoruler.mjs` holds each recording out in turn, plays
  it from what is left and scores the gap in the real piano's own soft-to-loud steps (1.0 = a
  whole step off). Change one thing, rerun, keep it only if the number moves the right way.
- **A real marimba's low notes are rich.** D2 to C4 carries as much as the top of the instrument.
  Keep bass lines out of the melody's register rather than reaching down for the modeled marimba's
  thin bass.
- **Sparse banks name themselves.** Marimba and glockenspiel are flagged `sparse`, so a note in a
  gap is a shifted recording. `check` says so on the `voices` line rather than hiding it.

### Picking a room

| Room | rt60 | Where the recording is from |
|---|---|---|
| `live-room` | 0.2 s | Genesis 6 Studio live room, University of York |
| `small-room` | 0.4 s | Arthur Sykes Rymer Auditorium, University of York |
| `recital-hall` | 1.8 s | Jack Lyons Concert Hall, University of York |

A style's `space.room` names one; `node tools/music.mjs --room <id> ...` overrides it for one run.
An id that is not installed keeps the synthesized space, so the same command is safe with no pack.
Pick the room for the size of the room, not the length of the piece: `live-room` for a take that
should feel close and dry, `small-room` for a nocturne or a lullaby, `recital-hall` when seats are
in the room. The reverb guard still runs: a recorded hall that pushes the late tail within 10 dB of
the dry mix fails `check` like any other space.

### Checking what actually played

`check` and `render` print one line naming every part and which side of the split it took:

```
voices   recordings: lead (piano), accomp (piano.upright); modeled: bass (bass), drums (kick)
```

Anything that should have played a recording and did not is a part whose notes fall outside the
bank's range, or a part that opted out.

A part opts out with `opts: { sampled: false }`, which is how you hear a modeled voice beside a
recorded one on purpose, and how a pitch or a register the recording cannot cover stays safe. An
opted-out part renders bit-identical audio to the same part with no pack installed, so the opt-out
is never a guess.

## Any length, never hard-coded

`fitScore(piece, seconds)` first calls the piece's own `refit(seconds)` if it has one. A composed
piece repeats or drops its `stretch` section, so it still lands on its outro. Then it runs
`fitToDuration`.

`fitToDuration(piece, seconds)` tries every form:
- with some `optional` sections dropped (dropping music costs more than nudging the tempo);
- with the `repeatable` group restated 0..n times, as "A B A B" or "A A B" (restatements take the
  section's `variations`: `octaveDouble`, `octaveUp`, `thin`);
- at the tempo that lands the last note at `seconds - tail`, inside the style's tempo range.

It picks the form whose tempo is closest to the written one. If no full form fits, it falls back to
the piece's `shortForm`. A section's `pickup` travels with it: wherever a section lands, its own
upbeat leads into it.

A hand-written piece with a short form, repeatable sections and optional sections can fit anything
from a quarter of its length to many times it, and it still ends on its cadence.

A form that already fits keeps its tempo: when the last note plus the tail lands within max(0.5 s,
one beat) of the length, `fitScore` changes nothing and the tail takes up the difference (the final
ritard alone would otherwise nudge the tempo). **Music that must hit exact picture moments** (a drop
on a cut, a sting on a reveal) is composed to the length and rendered without `--fit`, or uses the
beat-grid mode the launch films use (`gridScore` in `launchTemplate.ts`), where the score plays at
the film's bpm exactly and every cut sits on a downbeat. A fit that changes the tempo moves every
hit with it.

## Styles (21) and moods (21)

Both are rows of numbers in `tables.ts`. The vocabularies are in `vocab.ts` and `vocabMore.ts`, and
[`styles/vocabularies.md`](styles/vocabularies.md) is generated from them. A brief names rows,
never adjectives. Each row stays `unconfirmed` until a human has listened to 8 seconds of it; the
listener's words then go into `confirmedBy`.

| Style | Atmosphere | Master |
|---|---|---|
| lofiElectronic | chill, upbeat, clean electronic | dense |
| lofi | dusty lo-fi hip-hop (e-piano, vinyl) | dense |
| drive | driving electronic, four-on-the-floor | dense |
| house | euphoric house / EDM | dense |
| synthwave | neon-retro, gated snare, soaring lead | dense |
| hipHop | head-nod or dark trap, heavy 808 | dense |
| rock | band energy, driven guitars, tight kit | dense |
| chiptune | 8-bit, two pulses, triangle, noise | dense |
| cinematic | string swells, ostinatos, harp and bell colour | gentle |
| orchestral | heroic/epic: brass theme, string engine, choir, timpani | gentle |
| suspense | drones, heartbeat pulse, bowed harmonics, stingers | gentle |
| ambient | airy, spacious, bells and pads | gentle |
| choral | voices in parts, organ, bells | gentle |
| folk | tender acoustic: guitar, piano, harp, brushes | gentle |
| world | drone, modal melody, hand percussion, odd meters | gentle |
| playful | bouncy mallets, skipping kit | gentle |
| jazz | swing ride, walking bass, comping | gentle |
| nocturne | solo piano, rubato | gentle |
| minimalist | interlocking ostinatos | gentle |
| lullaby | soft, rocking, nothing percussive | gentle |
| musicBox | clockwork plucks, no sustain | gentle |

Moods: joy, playful, tender, wistful, melancholy, hopeful, curious, tension, dread, awe, triumph,
drive, calm, nostalgic, romantic, anger, eerie, mischief, heroic, sensual, grief.
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

## How to write a score

Follow [`compose.md`](compose.md). In short:
1. brief -> numbers (length, picture beats, feeling);
2. one style + one mood + five mood controls;
3. compose YOUR harmony, bass lines, motif(s), groove choice and form as `Material`;
4. `node tools/music.mjs check <file>.ts#<export>` must PASS (key, master, ghost/reverb/masking guards, stems, novelty);
   answer its ARC line too (the shape of the whole: [`theory/form.md`](theory/form.md), section 3);
5. `node tools/music.mjs render <file>.ts#<export> out.wav` (use wav for loops: mp3 is not gapless);
6. 8 seconds (then the whole piece) to a human, as an mp3 on a page.

Hand-written `Piece`s (the nocturne, the samplers) are still valid for styles without a vocabulary
builder. Write them with `line()` and render them with `renderPiece`.

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
