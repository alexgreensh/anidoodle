# Generated or supplied music: someone else's track, cut to the film

**Contents:** When to take this path · The route · Prompting a music model · Cutting by bars · Effects under someone else's music · Mastering and the checks · What it cannot do

anidoodle composes its own scores (`compose.md`). Sometimes the person wants a track from a music
model (Lyria, through the Gemini API), or brings a licensed one. That is a first-class path with its
own tools: `engine/tools/track.mjs` (analyse, cut, mix, master, check) and `engine/tools/cues.mjs`
(the film's own event times). Every step below closes a failure from a brand launch film whose
music was made this way by hand: the music ended four seconds before the picture, twice, and the
effects were notes that clashed with the track.

## When to take this path

When the person asks for it, or when they have heard the composed score and want a register the
engine does not reach. Never as a shortcut around composing. The person chooses the provider and
pays for it; anidoodle never calls a paid API. Cost is stated before anything runs, and every take
is logged with its price in a `COST.md` beside the music.

## The route

1. **Agree** tempo, length, sections and style with the person.
2. **Prompt.** `track.mjs prompt --len 70 --bpm 120 --style "..." --sections "0-11 Intro: ...; 11-12 Hard stop: ..."`
   writes the request (a tempo-lock line, "Instrumental only", timestamped sections) and prints the
   price with its source and the date it was checked. It says the request was **not sent**.
3. **The person runs their provider.** For Lyria via the Gemini API: `POST
   https://generativelanguage.googleapis.com/v1beta/interactions` with
   `{"model": "lyria-3.5", "input": <prompt>, "response_format": {"type": "audio", "mime_type": "audio/wav"}}`
   and their key from their keychain ($0.08 per song on the paid tier, checked 2026-10-27; check
   again). Ask for 3 to 4 takes: the model ignores exact timestamps, so takes differ in where they land.
4. **Pin the take.** `track.mjs import <take.wav> --provider lyria-3.5 --cost 0.08 --prompt p.txt
   --licence "..."` writes `<take>.track.json` (sha256, provider, cost, prompt, licence). The film
   declares it as `meta.score = { external: "<take>.track.json" }`.
5. **Analyse.** `track.mjs analyze <take.wav>`: tempo (top candidates printed; pin `--bpm` when the
   ear disagrees, tempo octaves happen), first downbeat, bars with levels, sections, a key estimate
   (marked unclear when weak; takes often ignore the key asked for), the track's own stops, and the
   **real last note**.
6. **Fit the picture to the music.** `trackGrid(cut.downbeats, fps).holdTo(start, minHold)` gives the
   shortest hold that lands on a downbeat; land the logo lock, the card's arrival and other key hits
   on downbeats.
7. **Cut by whole bars.** `track.mjs cut <take.wav> --bars "0-3,4-18" --film <name> -o cut.wav`
   (below).
8. **Cues from the film itself.** Wrap the film with `withCues(film, [{ name, at: { scene: 22, through:
   [master] } }, ...])` and run `cues.mjs <film>`; the cue sheet comes from the film's own time maps, so
   a slowdown or a time-map change moves every cue with it. Never copy times into a second file:
   a hand-mirrored timing script drifted twice on the film this page comes from. `cues.mjs <film>
   --check` fails a sheet (or a mix) that is out of date.
9. **Listen first.** `track.mjs listen <dir> --mix mix.wav` makes a page with each effect alone, a
   10 s sample of the mix and the takes. A human hears it before the full mix.
10. **Mix.** `track.mjs mix --music cut.wav --cues out/<film>.cues.json --sounds map.json -o mix.wav --stem sfx.wav`.
11. **Master and check.** `track.mjs master <picture.mp4> mix.wav -o film.mp4`, then `track.mjs check`
    and the ship command on the delivered file.

## Prompting a music model

- Say the tempo twice (in the tempo-lock line and in the style), the length, "Instrumental only",
  and the sections with times. A designed stop ("hard stop, one beat of silence") is worth asking for
  at the moment the picture holds its breath.
- Expect to fit the cut by bars afterwards: timestamps in the prompt are wishes.
- Keep the prompts and the takes; the person picks by ear ("take 2, love it").

## Cutting by bars

`track.mjs cut` joins whole bars with centred 12 ms crossfades, so the edit's length is exact and
every join sits on a downbeat. It refuses, and names the bars to add:

- a join more than a little off a downbeat;
- a segment that carries the silence after the last note;
- an outro that stops before the track's own ending (unless you ask for `--fade-out`);
- an edit whose last audible moment ends more than 0.5 s before the picture (`--end-tol`).

The edit's own downbeats are written beside it (`cut.wav.cut.json`) for `trackGrid`, and the track's
own stops become declared quiet ranges, so the dead-air and shape checks do not call them holes.
A segment list with no final newline is read whole (a shell loop once dropped the last segment).

## Effects under someone else's music

**Under a track the engine does not control, effects are transients, never notes.** A note that is
not in the track's key, or not on its chord, is a clash ("the sound effects cannot be melodic, they
make disharmonious interruptions"). Use the `tap` kind (`tick`, `tickHi`, `tock`, `thump`,
`impact`): short strikes too brief for the ear to name a pitch. Tuned kinds (chime, tuned riser,
`impact:bloom`, `press:confirm`) are refused under an external track unless the cue says why
(`pitched: "..."`). Every placed sound's pitch salience is measured in the mix, and `soundcheck.mjs
<file> --sfx sfx.wav` measures the rendered stem: a cue over 0.5 fails. The buried-cue guard runs
against the track too: a quiet cue is raised up to 8 dB against the track's local loudness, and fails
by name if it is still buried. `track.mjs kit --from-pack` cuts a transient kit from the sound pack,
each strike cut from its peak (cutting from the onset kept leading silence and lost the hit).

## Mastering and the checks

`track.mjs master` normalises to -14 LUFS, limits, encodes AAC 256k, then reads the true peak from the
**encoded** file and lowers the limiter until it is at or under -1 dBTP (AAC adds up to about 3 dB to
a peak). It then runs `check` on the muxed file: loudness, peak, the end of the music against the end
of the picture (filmshape), and the declared stops. The ship command runs `track.mjs check`,
`soundcheck --sfx` and `cues.mjs --check` for any film with an external track.

## What it cannot do

It cannot hear. Tempo, key and the last note are measurements; taste is the person's. A take's
own silent tail can still fail the end check by a fraction of a second: add the bars, or ask.
