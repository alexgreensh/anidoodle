# Compose: from a brief to an original score

**Contents:** The workflow · Recorded instruments · The material format · What makes it beautiful (check before you call it done) · What checks what

A style is a **vocabulary**. It gives you:
- sound: voices, levels and fx;
- groove families;
- a harmony language;
- melody rules;
- an arrangement grammar.

It never gives you notes. **You write every note**:
- the chords and their voicings;
- the bass lines;
- the motifs and lines;
- the form.

The engine refuses to fill gaps. Missing harmony, melody, grooves or form is an error that tells you
what to compose. The engine then performs, mixes and masters, deterministically, in code, and it
plays recordings of real instruments where you ask for one.

> **Never reuse shipped material.** The demos (`node tools/music.mjs list`) and our own film scores
> are listening references and the novelty corpus. They are never a film's score or a template. Don't
> copy them, transpose them or re-rhythm them. `node tools/music.mjs novelty` fails a score that
> sounds like any shipped piece, or that quotes one: a 6-note fragment (transposed or not), or an
> 8-note melody shape in any key, meter or rhythm.
>
> **Idioms are fine.** A ii-V-I, a plagal amen, a two-chord vamp, a I-bVII-IV are vocabulary. The
> style pages name them so you can use them. What is not fine is reusing the same music: a
> multi-bar progression together with its rhythm, groove, contour and form, or a quoted melody.
>
> Why this rule exists: a "new" example once changed the key, chords and pitches of the launch
> score but kept its rhythms, contour, drums and form. It was heard at once as the same song. The
> novelty fingerprint weighs exactly those things.

## The workflow

1. **Read the brief as numbers.** Write down:
   - the use case (launch film, explainer, loop for a site, game, ad);
   - the length in seconds, and whether it must loop;
   - 3-5 picture beats with their times (the reveal, the claim, the cut to the end card);
   - the words the person used for the feeling.
2. **Pick one style and one mood.** Styles:
   ```
   node tools/music.mjs vocab
   node tools/music.mjs vocab <style>
   ```
   For the details, see [styles/vocabularies.md](styles/vocabularies.md). The mood is a row in
   `tables.ts` (see the README's mood list). Then set the five **mood controls**, each 0..1, where
   0.5 = the calibrated palette:

   | Control | What it moves |
   |---|---|
   | `energy` | groove density, drum level, sidechain depth, dynamics |
   | `warmth` | filters darker, tape drive and wow, a little more bass |
   | `brightness` | filters and pluck brightness open, hats up |
   | `tension` | pad detune wider, string attacks shorter, lead decays shorter |
   | `space` | reverb sends, delay mix, pad release |

   Controls change the sound only. Harmonic tension is yours to write (step 4). To choose the tempo,
   mode, register and density that make a feeling read, see [theory/mood.md](theory/mood.md): tempo
   and mode are the strongest cues, and several cues pointing the same way make the mood unmistakable.
3. **Sketch the arc and the motif before any chord.** Write three things down:
   - **The tension curve.** One number 0..1 per section: it rises, dips just before the peak (a breath
     or breakdown), peaks on the picture's key frame, then releases. This becomes each section's
     `energy`, its layers and its harmony (leaning chords before home).
   - **The climax.** The bar, the highest note of the piece, and the chord under it (home, full layers).
   - **The motif.** Its rhythm (which beats it avoids, where the long note sits), its contour (one leap,
     then steps back), and how it will develop across the form: stated, sequenced, fragmented in the
     build, augmented at the climax, last word at the end ([theory/melody.md](theory/melody.md)).
4. **Compose the harmony.** Work inside the style's harmony language: its modes, chord qualities,
   tendencies and voicing rule. Decide the key and mode from the mood, not from habit.
   - Write a progression **for this brief**. Choose its length (2, 3, 4, 5, 6 or 8 bars) and its
     harmonic rhythm (one chord per bar, two per bar, or one per two bars) on purpose.
   - Voice each chord yourself. Move the voices by step and hold common tones. The bass owns the
     root.
   - Write each chord's bass line (one bar) in the style's bass idiom: held root, root and fifth,
     walking, offbeat 8ths, a syncopated 808 figure. Make the rhythm YOURS.
   - **Tension and release as a curve.** Stable (tonic), moving away (subdominant, relative,
     borrowed), leaning (dominant, suspension, pedal), home. Put home on the picture's key beat. End
     inner sections on half or deceptive cadences, and save the full close for the end
     ([theory/harmony.md](theory/harmony.md)).
   - **Spread low, close high.** No close intervals below about C3 ([theory/sound.md](theory/sound.md)).
5. **Compose the motif(s).** A motif is 2-5 notes with its own rhythm. Invent the rhythm first:
   - Which beats does it avoid?
   - Does it start on an upbeat?
   - Where is the long note?

   Then the pitches: the contour, one leap, then steps back.

   Develop the motif. Don't photocopy it:
   - **repeat**, then **vary**: change the last interval, displace it by an eighth, extend it;
   - **sequence**: the same shape a step or a third higher;
   - **call and response**: the question ends off the tonic, the answer lands on it, or another
     instrument answers;
   - **fragment** it in a build, **augment** it (slower, longer notes) at the climax;
   - put it in the bass for menace, or high and quiet at the close.

   The phrase's high point goes in its second half. A phrase is 2 or 4 bars; a period is two phrases
   (question, answer). The line must respect the style's range and density. Put chord tones on strong
   beats, and put the feeling in appoggiaturas and suspensions that resolve by step.
6. **Choose or write the groove.** Pick a family from the style's list (`bounce`, `trap`,
   `brushes`, `hand`, ...). Set `density` 0..1, `variation` 0..1 and `fill` (a fill on a section's
   last bar). The seed varies every bar, so no two pieces share a loop. You can also write the drum
   bars yourself as notation, one or more bars per lane: `kick`, `snare`, `ghost`, `hat`, `perc`.
   Use a second groove for contrast (`half`, `build`). Keep the kick and backbeat stable, and syncopate on
   top of them ([theory/rhythm.md](theory/rhythm.md)).
7. **Write the form.** Sections are `{ kind, bars, harmony, lead, counter, arp, comp, groove, bass,
   chordVel, energy, repeat, stretch }`.
   - The **kind** sets which layers may sound: intro, verse, groove, hook, build, half, breakdown,
     drop, bridge, swell, breath, outro. See the arrangement grammar in vocabularies.md.
   - Lines sound only where you write them.
   - Land each section change on a picture beat. At `bpm`, a bar lasts `beatsPerBar x 60 / bpm`
     seconds, and at 30 fps a beat is `1800 / bpm` frames.
   - Mark one section `stretch: true`: a film fit repeats or drops it to reach the exact length and
     still end on your outro.
   - **Music that must hit exact picture moments** (a drop on the reveal at 16.0 s): compose it to
     the length (bars x beats x 60 / bpm) and render without `--fit`, or use the beat-grid mode the
     launch films use (`gridScore` in `launchTemplate.ts`: the score plays at the film's bpm exactly
     and the cuts sit on its downbeats). `--fit` keeps your tempo when the form already ends within
     max(0.5 s, one beat) of the length, and the tail takes up the difference. Past that it changes
     the tempo, and every hit moves with it.
   - Song and cue forms, builds, and orchestration slots: [theory/form.md](theory/form.md).
8. **Revise with craft, before you render.** `craft` reads the notes in milliseconds:
   ```
   node tools/music.mjs craft <file>.ts#<export>
   ```
   - It prints scores (0..1) for melody, harmony, rhythm, tension and mood, the tension curve per
     section and per bar, and each section's cadence.
   - Each `CRAFT` line names what it saw, where (bar and beat), and a fix.
   - Loop: read the findings, revise the notes, run `craft` again. Stop when every remaining
     finding is one you chose on purpose (an open ending for suspense, parallel fifths in rock). Say
     which ones in your note to the person.
   - Compare the printed tension curve with your sketch from step 3. If the peak is not where you
     planned it, the arrangement is wrong, not the sketch. The line under the curve says what drives
     each section (loudness, density, register, harmony): loudness and density weigh most, so a
     home-chord tutti or a drop is the peak ([theory/harmony.md](theory/harmony.md), section 8).

   | `craft` says | Usual fix |
   |---|---|
   | leaps keep going the same way | turn back by step after a leap |
   | nothing comes back / exact copies | develop one motif: sequence, vary the last interval, fragment |
   | phrases don't end on chord tones | land answers on 1, 3 or 5; keep one open question |
   | the melody peaks early | move the highest note to the second half, on the key frame |
   | parallel 5ths (common-practice idiom) | contrary motion; hold the common tone |
   | close intervals below their low limit | spread the voicing: 1-5-3', or lift the upper note an octave |
   | melody under the chords | voice the chords lower, or the melody higher |
   | no syncopation (groove idiom) | anticipate a bass or melody note by an eighth |
   | flat tension curve / no release | change layers, loudness (`energy`), register and harmony by section; release after the peak (a loop, ambient or calm piece may stay level: a note, not a warning) |
   | mood cues (tempo, mode, register, density) | move the cue toward the mood, or declare the mood you wrote |
9. **Check, render, listen:**
   ```
   node tools/music.mjs check <file>.ts#<export> [--fit --seconds 62]   # EVERYTHING, must PASS (below)
   node tools/music.mjs render <file>.ts#<export> out.mp3 --stems       # the file, plus the same report
   node tools/music.mjs novelty <a>.ts#x <b>.ts#y                       # several scores: vs shipped AND pairwise
   node tools/music.mjs score <file>.ts#<export>                        # the text score, bar by bar
   ```
   `check` runs everything:
   - key/mode problems and composer warnings (for example, a line shorter than its section);
   - the master: loudness vs target, true peak, and a note when the -1 dBTP ceiling stopped the
     gain short;
   - the **ghost, reverb and masking guards**;
   - the stems;
   - craft (the step-8 report, with brightness measured from the render; only an unplayable range fails);
   - novelty.

   It exits non-zero on any failure. `render` prints the same report (stems with `--stems`), except
   novelty. Both synthesize each voice once, on all but one of your cores, and render the guards and
   the stems in parallel with the mix: the audio is bit-identical to a serial render (`render
   --verify` renders again serially and compares; `ANIDOODLE_THREADS=1` turns the pool off).
   - **Stems:** fix any part flagged more than 3 dB off with `levels`. `levels` is a **dB offset** per
     slot (+2 = two dB louder), added on top of the calibrated gain, the trims and the mood controls'
     shifts, on the same scale as your own voice's `gainDb`. LUFS alone once hid a sub 7-10 dB too hot.
   - **When the guards and the stems disagree, the guards win.** If masking fails (the melody isn't
     heard), raise the lead. The stem meter lets the lead sit up to +3 dB above its tolerance for
     this. You can also lower or thin what sits in the melody's register. Mood controls shift the
     stem targets with the sound (for example, brightness lifts the hats and their target); the
     printed targets already include that.
   - **Master short of target:** a gentle master (-16 LUFS) never compresses. If one peak blocks the
     gain, the whole piece stays quieter, and `check` says by how much, where the peak is (bar, beat
     and seconds) and which parts pile up there, loudest first, with the notes they are playing.
     Fix it in the notes at that spot: stagger the bass under that downbeat, roll the big chord, don't
     double the climax note.
   - **Novelty:** if it fails, change what the numbers point at. Changing the key fixes nothing.
     Each feature is a bag of n-grams compared by cosine (0 = nothing shared, 1 = the same); the
     score is their weighted mean, and it fails above 0.5:

     | Feature | Weight | What it counts |
     |---|---|---|
     | `melodyRhythm` | 0.20 | the lead's onset positions in each bar, and its inter-onset-interval trigrams |
     | `melodyContour` | 0.15 | the lead's up / down / same 4-grams |
     | `melodyIntervals` | 0.10 | the lead's interval trigrams, in semitones (transposition-free) |
     | `lineRhythm` | 0.15 | the counter line's rhythm plus the bass's rhythm (bar positions and inter-onset trigrams of each) |
     | `drums` | 0.15 | each drum part's hit positions per bar |
     | `chords` | 0.10 | chord-function trigrams: each root against the key, with its quality |
     | `qualities` | 0.07 | chord-quality trigrams (maj7, min, dom, sus ...) |
     | `form` | 0.08 | the order of section kinds, in pairs |

     The lead is the top note of each onset of the melody part. Bar positions depend on the meter;
     the inter-onset trigrams, the contour, the intervals and both quote gates do not. Two gates fail
     outright whatever the score: a **6-note fragment** of a shipped melody (its intervals and
     durations, in any key), and an **8-note melody shape** (its intervals alone, in any key, meter
     or rhythm: a quote re-barred into 5/4 or stretched is still the tune). Only distinctive shapes
     count (three or more different intervals, a leap of a third or more, at most three repeated
     notes), so a scale run is never a quote.
   - **Listen:** the person hears it before it is used. Meters prove you aren't obviously wrong.
     Only an ear says right. For a **loop**, deliver a `.wav`: mp3 adds encoder padding, so it clicks
     or gaps at the loop point.

## Recorded instruments

Eight acoustic parts play recordings of the real thing when the sound pack is installed: `piano`
(and `piano` with `variant: "upright"`), `harp`, `marimba`, `vibes`, `glockenspiel`, `bell` with
`variant: "tubular"`, and `timpani`. Strings, guitar, bass, brass, woodwinds, choir, celesta, music
box, the electric pianos and the acoustic drum kit stay modeled either way, and every score plays
without the pack.

Four things decide what you write:

- **Stay inside the range, or the render throws.** The grand reaches A0; the timpani stops at B3;
  the vibraphone starts at F3 and the glockenspiel at G5. The full table is in
  [README.md](README.md#recorded-instruments-the-optional-sound-pack).
- **A recorded note decays the way that instrument decays.** A low grand note rings for tens of
  seconds. Do not write a dense texture under it and expect the tail to get out of the way.
- **The piano has a real pedal.** `sus` zones sound while the dampers are lifted, so the pedal
  changes `perform.ts` already writes just after each harmony change are audible, and a chord left
  ringing under the next one is what a real player does. `opts: { pedal: false }` holds the pedal.
- **A real marimba's low notes are rich.** D2 to C4 carries as much as its top. Keep a bass line out
  of the melody's register instead of reaching down for a note that will not sit under a tune.

Two options go in a part's `opts`:

| Option | What it does |
|---|---|
| `variant: "upright"` / `variant: "tubular"` | picks the second recording of that instrument |
| `sampled: false` | keeps the modeled voice for that part, whatever is installed |

`node tools/music.mjs check` prints the split, so read it before you believe the instrument table:

```
voices   recordings: lead (piano), accomp (piano.upright); modeled: bass (bass), drums (kick)
```

A part you expected to be recorded and find modeled is either out of range or opted out. Both are
yours to fix; neither is a silent fallback.

## The material format

Write the score in the film's own file, next to the film module: `src/canvas-core/<film>Score.ts`
in a scaffolded project (`engine/src/canvas-core/<film>Score.ts` inside the skill), and export it:

```ts
import type { Material } from "./music";
export const score = (): Material => ({
  style: "<style id>", title: "<this film's score>", seed: <any integer>, mood: "<mood id>",
  bpm: <tempo in the style's range>, key: "<tonic>", mode: "<mode id>", meter: "<meter>",
  moodControls: { energy: <0..1>, warmth: <0..1>, brightness: <0..1>, tension: <0..1>, space: <0..1> },
  swing: <0.5 straight .. 0.67 hard>, dyn: [<start 0..1>, <end 0..1>], tail: <seconds of ring-out>,
  chords: { "<name>": { voicing: "[<note> <note> <note>]", bass: "<one bar of notation>" }, /* ... */ },
  motifs: { "<motif>": "<one or more bars of notation>", /* your variations are motifs too */ },
  grooves: { main: { family: "<family>", density: <0..1>, variation: <0..1> }, half: { family: "<family>" } },
  sections: [
    { kind: "intro", bars: <n>, harmony: ["<chord>", /* per bar, cycled */], chordVel: <0..1> },
    { kind: "hook", bars: <n>, harmony: [/* ... */], lead: ["<motif>", "<motif variant>", "r:<beats>"], stretch: true, energy: <0..1> },
    { kind: "groove", bars: <n>, harmony: [/* ... */], lead: ["<2-bar motif>"], loopLines: true },
    { kind: "verse", bars: <n>, harmony: ["<chord>", "~"], comp: ["x:1 r:.5 x:.5 r:2"] }, // held over the bar line; a comped rhythm
    { kind: "bridge", bars: <n>, key: "<new tonic>", mode: "<mode>", harmony: [/* in the new key */], lead: [/* ... */] },
    /* ... */
    { kind: "outro", bars: <n>, harmony: ["<home chord>"], lead: ["<the motif's last word>"] },
  ],
});
```

A film plays it with `filmScore(score(), fps, frames)` from `canvas-core/score.ts`. That fits your
form to the exact length. `score.ts` is an empty skeleton to copy.

- **Voices:** `voices: { lead: "<alternate name>" }` swaps a slot for one of the style's
  alternates. Or give your own `{ inst, role, opts }` (instruments: README table), with the slot's
  role: `chords` and `arp` are `"accomp"`, `lead` is `"melody"`, `counter` is `"color"`, `bass` is
  `"bass"`, drum lanes are `"drum"`. **Levels are one scale.** The palette voice, an alternate and
  your own voice all sit at the slot's stem target (the column in
  [styles/vocabularies.md](styles/vocabularies.md), fix included): alternates carry a measured trim,
  and your own voice is placed from its instrument's measured level in the register your notes
  play in. So leave your voice's `gainDb` out (0 = at the target) and set it, like `levels`, only
  as an offset: `gainDb: 2` is two dB over. Then read `check`'s stems and adjust by the dB it
  prints. Options (`attack`, `bright`, `drive`) move the level a little; a piano far up its range
  is quiet by nature. `variant` and `sampled` are the two options that change which sound you get,
  and they are in [Recorded instruments](#recorded-instruments) above.
- **Loops:** `loop: true`, and the form length is the loop. `render` makes it seamless.
- **Split bars:** `harmony: ["<chord> <chord>"]` splits a bar where the meter divides, not at its
  arithmetic middle. Give that section a `bass` override for it.

  | Meter | 2 chords | 3 chords |
  |---|---|---|
  | 2/4 | 1 + 1 | even |
  | 3/4 | 2 + 1 (the change on beat 3) | 1 + 1 + 1 |
  | 4/4 | 2 + 2 | 2 + 1 + 1 |
  | 5/4 | 3 + 2 | 2 + 1 + 2 |
  | 6/8 | 1 + 1 (3 + 3 eighths) | even |
  | 7/8 | 2 + 1.5 (4 + 3 eighths) | 1 + 1 + 1.5 (2 + 2 + 3) |
  | 9/8 | 2 + 1 | 1 + 1 + 1 |
  | 12/8 | 2 + 2 | 2 + 1 + 1 |

  Beats are the meter's beats (in 6/8, 9/8 and 12/8 a dotted quarter). To feel the bar another
  way, set the piece's `grouping` (for example `grouping: [2, 3]` for a 5/4 felt 2 + 3): a split
  into as many chords as it has groups follows it. Or give each chord its beats: `"Dm9:1 G13:2"`.
- **Held chords:** `"~"` holds the chord before it over the bar line, with no restrike, so a pad
  never dips at the bar line: `harmony: ["Cmaj9", "~", "Am9", "~"]` is two chords of two bars each.
  `"~ G13"` holds into the bar, then changes. The bass keeps its own line under a held chord (the
  chord's bass line plays again). To tie the bass too, write that bar of the section's `bass` as `"~"`.
- **Comping:** a section's `comp` gives the chord part a rhythm, one bar per item, cycled over the
  section. `x:DUR` strikes the chord sounding at that point, `r:DUR` rests, `x:DUR@0.7` accents, and
  a bar may start with `~:DUR` to hold the last strike over the bar line (a pushed chord):
  `comp: ["x:1 r:.5 x:.5 r:1 x:1", "r:3.5 x:.5", "~:1 r:1 x:2"]`. A comp bar must add up to the bar.
  Without `comp`, each chord sounds for its whole span.
- **A silent chord:** `voicing: "r"` makes the chord part rest while the chord still names the
  harmony: the key check, `craft`, novelty and the bass all read it. Use it for a bar that the bass
  or an arp states alone, or a stop-time break.
- **Lines play once.** `lead`, `counter` and `arp` start at the section's first bar and play ONCE,
  even though `harmony` cycles. A shorter line leaves rests, and `check` warns. Set
  `loopLines: true` to repeat the line until the section is full. `repeat: n` replays the whole
  section, lines included.
- **Section `energy`** (0..1, 0.5 = as written) sets the section's dynamics for every part,
  hand-written lines included. It scales velocity from 0.55x to 1.45x, roughly -5 to +3 dB. It
  also sets the density of generated grooves.
- **`dyn`** is the whole piece's dynamic level `[start, end]`, ramped (default `[0.62, 0.66]`).
  `swing` and `tail` default to the style's lower swing bound and 3.2 s.
- **Modulation:** give a section its own `key` and `mode`. The key check then reads each key region
  on its own. A lift of a step for the last chorus is fine when that section declares the new key.
- **The key check weighs the tonic.** It accepts your declared tonic and mode when the mode's scale
  explains the notes as well as any other reading, and the tonic is heard (at least 8 % of note
  time). A lydian or dorian passage whose notes lean on another degree gets read as that degree's
  major. Put the bass on the tonic at section starts and cadences, and state the mode's colour note.
- **Written drums:**
  - A `LiteralGroove` gives notation bars per lane (`kick`, `snare`, `ghost`, `hat`, `perc`).
  - The bars cycle from each section's first bar; `cycle: "piece"` cycles on the piece's bar count
    instead.
  - Unpitched drums ignore the written pitch: write `C4`.
  - A timpani in a drum lane (orchestral, choral, suspense, world) is tuned to the tonic of `key`,
    generated grooves included (`epic`).

**Notation** (bar-checked; a bar that doesn't add up throws, the last bar too: a line that ends
mid-bar writes its rest, `C2:3 r:1`, never a silent gap):
- A token is `NOTE:DUR[@VEL]` (a pitch name with an octave, e.g. `F#4`), `[NOTE NOTE ...]:DUR` (a
  chord) or `r:DUR` (a rest).
- Bars are separated by `|`, or given as array items.
- Durations are in beats. In 6/8, 9/8 and 12/8 a beat is a dotted quarter, so an eighth is `1/3`.
  In 7/8 a beat is a quarter, so an eighth is `.5` and a bar is 3.5.
- `@VEL` scales the line's velocity (0..1).
- In a hand-written piece, a one-bar sting on any beat says so: `line(t, "G6:1", { ..., hit: true })`.

## What makes it beautiful (check before you call it done)

- [ ] **One idea, developed.** One motif, heard 6-12 times, never the same way twice. A second idea
  answers or contrasts it.
- [ ] **A line you could sing.** Mostly steps, leaps that turn back, arches, and one high point per
  phrase group in its second half.
- [ ] **Questions and answers.** Phrases in 2s and 4s. Questions end open, answers end home.
- [ ] **Feeling in the dissonance.** Chord tones on the beats. An appoggiatura or suspension where
  the picture needs an ache, resolved down by step.
- [ ] **Harmony that moves smoothly.** Common tones held, voices by step, the bass contrary to the
  tune, the low end spread.
- [ ] **A groove that breathes.** An anchored kick and backbeat, syncopation on top, rests in the
  melody, a fill only at section ends.
- [ ] **An arc.** Contrast by section in density, register, harmonic rhythm and groove. A dip
  before the peak, the peak on the key frame, then release.
- [ ] **Cadences on picture beats.** The claim, the reveal and the logo each get a structural
  downbeat.
- [ ] **An ending on a phrase:** a held home chord with the motif's last word, a button, or (suspense
  only) an unresolved hold.
- [ ] **Mood cues aligned.** Tempo, mode, register, density, articulation and brightness all point
  at the words. If a listener names a different emotion, the choice was wrong, not the listener.
- [ ] **Breadth.** Across projects, vary the meter, harmonic rhythm, groove family and form length.
  Two scores for two products should not be siblings.

## What checks what

| Check | Runs in | Fails when |
|---|---|---|
| key/mode (`planProblems`) | `check`, `render` | a key region's notes don't support its declared tonic and mode |
| composer warnings | `check`, `render` | (warns only) a line is shorter than its section, ... |
| master | `check`, `render` | (notes only) the peak ceiling stopped the gain short of the target |
| ghost guard | `check`, `render` | 4-bar windows are formless (few onsets, sustained, wet, no cadence) |
| reverb guard | `check`, `render` | the late tail sits within 10 dB of the dry sound |
| masking guard | `check`, `render` | the melody doesn't clear the other parts in 500 Hz-4 kHz |
| stems | `check`, `render --stems`, `stems` | a part is more than 3 dB off target (lead: up to +6 dB allowed); advisory for uncalibrated styles |
| craft | `craft`, `check` | (advisory scores and fixes) melody, harmony, rhythm, tension, mood fit; fails only on a note an acoustic instrument cannot play |
| novelty | `check`, `novelty` | similarity above 0.5 to a shipped piece (or to each other), a reused 6-note melody fragment, or an 8-note melody shape in any key, meter or rhythm |

`tools/music-unit.mjs` keeps the engine honest: determinism, no defaults, every vocabulary renders.
