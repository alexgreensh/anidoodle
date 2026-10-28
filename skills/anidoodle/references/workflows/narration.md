# Narration, word timing and subtitles

**Contents:** The order of work · The script: narration.json · Choosing a voice · The commands · The round trip, and why it is not optional · Narration sets the clock · Phrase subtitles · Caption files · The mix

A narrated film is timed by its voice. The script is written first, each line becomes one take,
the takes are heard back word for word, and the picture is cut to the words. Everything here works
the same for 2D and 3D films.

Narration is the one generated input anidoodle allows, and only on the person's request: the voice
they chose, each take cached by a hash of what made it, then baked into the film so the film needs
no file and no network to play. Needs `ffmpeg` and whisper.cpp (`brew install whisper-cpp`; the
tool prints the one-line model download when no model is found).

## The order of work

1. Write the script and budget its time before setting the film's length: every phrase needs
   `max(0.7 s, 0.3 s per word)` on screen, and a voice says 1.2 to 4.5 words a second. A rhymed
   narration on the last film set the runtime to 119 s on its own.
2. Draft with a free voice, cut the picture to it, then make the final takes with the chosen voice.
3. `narrate.mjs check` until it passes, then `bake`.
4. Build the shots on the words (`cue`), the subtitles from the timing, the mix with the duck.
5. Render, then `check --mix` on the finished file, `framecheck`, `verify-export --delivery`.
   A human listens before it ships: you cannot hear the voice.

## The script: narration.json

```json
{
  "fps": 24,
  "provider": "kokoro",
  "voice": { "name": "af_heart", "speed": 1 },
  "lead": 12, "tail": 30, "pause": 0.4, "lang": "en",
  "aliases": { "Clawd": ["claude"] },
  "lines": [
    { "id": "open", "text": "Every film starts as a few plain words." },
    { "id": "code", "text": "It draws itself at twenty four frames a second.", "display": "It draws itself at 24 frames a second.", "pauseAfter": 0.6 },
    { "id": "end",  "text": "Then the clock rang out \"Context!\" for him.", "at": 400 }
  ]
}
```

- `lead` and `tail` are frames of air before the first line and after the last; `pause` is seconds
  between lines, `pauseAfter` overrides it for one line, `at` pins a line to a frame (refused if the
  line before is still speaking).
- `text` is what the voice says; `display` is what the screen shows. Write numbers, money and
  symbols as spoken words in `text` and as figures in `display`: each screen word takes the frames
  of the words spoken for it ("24" gets the frames of "twenty four").
- A line's own `voice` overrides the script's. `aliases` accept a name the transcriber spells
  another way.
- Write an emphasised word in plain case inside quotes, never in capitals. A cloud voice read
  "the clock rang out CONTEXT for him" as "the clock rang out for him", silently; the quoted
  plain-case form passed three takes of three.

## Choosing a voice

Ask which voice the person wants. The script's `provider` is the only way a voice is chosen; the
command line has no override, so a paid voice is called only when the script names it.

| Provider | Runs | Licence and cost | Setup |
|---|---|---|---|
| `say` | this Mac, offline | Free. Apple licenses the system voices for personal, non-commercial use, so **drafts only**: re-voice before publishing, and never commit a `say` take or a module baked from one | macOS only. `voice: { name, rate }` |
| `kokoro` | this machine, offline | Free; code and weights Apache-2.0, so a clean choice for a film that ships | `pipx install kokoro-tts`. `voice: { name, speed, lang }` |
| `files` | your own recordings | Yours | one `<id>.wav` (or aiff, flac, mp3, m4a) per line in `voice.dir` (default `takes/` beside the script) |
| `gemini` | Google's servers | Paid per use; the text goes to Google; their terms govern the audio | `GEMINI_API_KEY` or `GOOGLE_API_KEY`. `voice: { name, style, model }` |
| `openai` | OpenAI's servers | Paid per use; the text goes to OpenAI | `OPENAI_API_KEY`. `voice: { name, model, instructions, speed }` |
| `elevenlabs` | ElevenLabs' servers | Paid per use; the text goes to ElevenLabs | `ELEVENLABS_API_KEY`. `voice: { id, model, stability, similarity, seed }` |

Before a cloud voice runs, tell the person that each line's text is sent to that company and that
it costs money per use, and get their yes. Never pick a paid voice for them. Keys come from the
environment only; the tool never prints them, and they never go into the script, a command you
show, or a file. `node tools/narrate.mjs providers` lists what this machine can use.
The kokoro, openai and elevenlabs modules have not yet been run against the real service: make one
line and `check` it before voicing a whole script.

## The commands

```bash
node tools/narrate.mjs providers                      # which voices this machine can use
node tools/narrate.mjs say   <narration.json>         # make every take (cached: .cache/voice/<sha256>.wav)
node tools/narrate.mjs time  <narration.json>         # word timings -> out/narration/<name>/voice-timing.json + lines/<id>.wav
node tools/narrate.mjs check <narration.json>         # the round trip; exit 1 on any failure
node tools/narrate.mjs bake  <narration.json>         # write src/canvas-core/<name>Voice.ts (timing + takes)
node tools/narrate.mjs all   <narration.json>         # check, then bake when it passes
```

Flags: `--out DIR` (stems and timing), `--module FILE` (the baked module), `--model FILE` (a
whisper.cpp model; `ggml-small.en.bin` hears better than base), `--shape 16x9|9x16|1x1` (subtitle
line length), `--max-wer 0.03`, `--mix out/<film>.mp4` (check the finished mix too), `--force`
(make every take again).

A take is keyed by provider, voice settings, text and processing, so editing one line re-makes
only that line, and checking, timing or baking cached cloud takes never calls the company or needs
the key. `--force` re-makes, and re-pays for, every take. Each take is trimmed, padded and levelled
to -20 LUFS. `time` also writes a voice-only stem per line: keep them, so one line can be swapped
later without re-recording the takes people liked.

## The round trip, and why it is not optional

A voice model can drop or change a word without any error, and the take still sounds fluent. A
shipped film lost the word CONTEXT this way and only a human ear caught it. So `check` transcribes
every take with whisper.cpp, with no prompt (it must hear what was said, not what was meant),
and holds it to the script word by word, after normalising numbers, money and times on both sides.

It fails on: any dropped or changed script word, named; extra heard words past `--max-wer`; a
word with no timing of its own, out of order, under 0.05 s or over 1.5 s, or a gap over 1 s inside
a sentence; clipping, a peak over -1 dBFS, too much silence at either end, a silent take, a pace
outside 1.2 to 4.5 words a second; a subtitle phrase that cannot get its reading time (TOO TIGHT);
a baked module made from other takes or another timing. With `--mix` it transcribes the finished
film as well, so a score that buries a word fails too.

On a failure, fix the script (rewrite the word, spell the number, quote the emphasis), re-run
`check` (only the changed line is re-made), then `bake`. A film plays the baked module, so a take
changed after the bake is a stale film until it is baked again. Word times come from whisper's
segments, good to about 50 to 100 ms: right for phrases and for landing a beat on a word, too
coarse for lip sync. Normalising is English only; a year spoken as words can read as a change.

## Narration sets the clock

The audio is measured first and the picture follows it, never the reverse: a picture timed to a
guessed read drifted 30 to 40 frames from the voice on the last film.

```ts
import { myFilmVoice as VOICE } from "./myFilmVoice";        // written by narrate.mjs bake
import { cue, cueEnd, drawSubtitles, phrases, toCaptions } from "./subtitles";
import { narrationAudio, syncMarks } from "./voice";
const T = VOICE.timing, EVENTS = phrases(T, { shape: "16x9" });
const HIT = cue(T, "code:24");           // the frame "24" is spoken; "code" = line start, "end:the#2" = the second "the"
```

- The film's length comes from `T.totalFrames` (rounded up to the beat). Cuts land on line
  starts, reveals on the word that names them.
- In 3D, `timeline(fps, { words })` places clips on words by name; see `references/workflows/three-d.md`.
- When shots were written before the voice, map each story frame to its spoken cue with
  `storyClock` (`engine/src/three-core/time.ts`) instead of moving every constant by hand. Cyclic
  motion keeps the real frame.

## Phrase subtitles

`phrases(timing, opts)` cuts each line into 2 to 6 word phrases, one on screen at a time, and
`drawSubtitles(ctx, env, frame, events, style)` burns them in. A whole line in a lower band was
too much to read on the last film; short phrases, each landing on its own words, read without
pulling the eye off the picture. The rules, held in code:

- A phrase appears 2 frames before its first word is spoken and holds at least
  `max(0.7 s, 0.3 s per word)` and 20 frames, at most 7 s, with 2 frames between phrases.
- Breaks fall at punctuation, then clause words. Never between an article and its noun, a number
  and its unit, a currency sign and its amount, or inside a name (`keep: ["Total Recall"]`).
- When the speech is too fast to give a phrase its reading time, `phrases` throws TOO TIGHT
  instead of squeezing it. Slow the read, cut words, or add a pause.
- At most 32 characters a line for 16x9 and 1x1, 22 for 9x16; a long phrase wraps to two lines.
- `style.home` places the phrase: one home per shot, in calm negative space, never over a face, a
  hand at work or a joke, and it moves only on a cut (pass a function of the frame). White type
  on a dark plate, never grey; `highlight: true` lights the word being spoken. On 9:16 it stays
  out of the phone's interface zones.

## Caption files

`meta.captions = toCaptions(EVENTS, fps)` hands the same phrases to the sidecar files;
`toCaptions` refuses events that break the rules. `node tools/captions.mjs <film>` writes `.srt`
and `.vtt`, and `framecheck.mjs` holds every cue to its reading time and every burned phrase to
the frame.

## The mix

```ts
audio: narrationAudio({ voice: VOICE, music: filmAudio(score, N / FPS), frames: N, musicDb: -6, depthDb: -9 }), // filmAudio: ./music/render
meta: { ..., captions: toCaptions(EVENTS, FPS), sync: syncMarks(T) },
```

The score sits 6 dB under its own level and ducks a further 9 dB under the voice, measured from
the voice itself. The dip starts 40 ms before each line, so the first syllable never lands on
full music, holds across the gaps between words and comes back over 450 ms. One delivery master
brings the mix to -16 LUFS under -1 dBTP. `syncMarks` puts a marker on each line's first word, so
`verify-export.mjs --delivery` measures the voice landing on its frame. The baked takes cost
about 64 KB of page per second of speech, fine for a short film; a long one is a size to state.
