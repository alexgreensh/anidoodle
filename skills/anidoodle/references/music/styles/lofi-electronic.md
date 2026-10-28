# Style: lo-fi electronic (chill, upbeat, clean)

**Contents:** The sound · Grooves · Harmony language (write your own progression) · Melody rules (write your own motif) · Arrangement grammar · Mixing: balance by stem RMS, then master

> A vocabulary, not a song. The data is `VOCAB.lofiElectronic` in `engine/src/canvas-core/music/vocab.ts`
> (print it: `node tools/music.mjs vocab lofiElectronic`). You compose the notes with
> [../compose.md](../compose.md). Our launch film was scored in this style (`launchLofi3`). That
> score is ours and is in the novelty corpus. Never reuse its progression, hook, rhythms, drums or
> form.

## The sound

Chill but **upbeat**, **clear**, **not noisy**:
- a warm pad that breathes with the kick;
- a plucked lead through a dotted-eighth ping-pong delay;
- a high counter-line;
- a round sine sub;
- a bouncy, clean kit.

**Never:**
- synth electric piano;
- vinyl crackle;
- bit-crush;
- a dark master low-pass;
- heavy tape.

Those read as dusty lo-fi hip-hop (the `lofi` style), not clean electronic.

| Slot | Voice | How it's made | Stem RMS target |
|---|---|---|---|
| chords | `warmPad` | 7 PolyBLEP saws, spread 0.55 x +-14 cents, slow per-voice drift, 12 dB low-pass at 2.6 kHz, 0.5 s attack, 1.4 s release | -22 dB |
| lead | `softPluck` | triangle + square an octave down, filter snaps open, 0.42 s decay, dotted-eighth ping-pong (feedback 0.28, mix 0.24) | -15.5 dB |
| counter | `softPluck` | brighter, panned 0.35, more delay and room | -20 dB |
| bass | `sub` | sine + a whisper of the 2nd harmonic, low-passed at 150 Hz | -18.5 dB |
| kick / snare / ghost / hat | kit | a bouncy kick, a snare, rim ghosts about 11 dB under, 16th hats | -14.5 / -19 / - / -24.5 dB |
| arp, perc | `softPluck`, `hat` | optional extra layers | - |

Alternates:
- lead: `bell`, `mallet`, `guitar`;
- chords: `strings`, `piano`;
- bass: `warm`.

Bus:
- the kick ducks the chords and the counter (depth 0.38, release 0.24 s);
- tape is barely there (2.5 cents of wow);
- clean master at **-14 LUFS**, true peak **<= -1 dBTP**.

The stem targets were calibrated on a listened score, and they are the only calibrated targets.

## Grooves

`bounce`, `halfTime`, `broken`, `skip`, `pulse`, `build`. Pick one per section role (`main`,
`half`, `build`) and set `density` and `variation`. The seed varies every bar. Swing 0.52-0.56.

## Harmony language (write your own progression)

- **Modes:** major, dorian, lydian, aeolian, mixolydian.
- **Qualities:** 7ths, 9ths, 11ths, 13ths, add9, sus2 and sus4. Keep bare triads for the landing.
- **Tendencies:**
  - loops of 2, 4 or 8 bars;
  - ii-V motion;
  - drifting IV-iii-vi motion;
  - modal vamps (i-IV in dorian, I-II in lydian);
  - a borrowed iv or bVII for a wistful turn.
- **Harmonic rhythm:** one chord per bar or two. A change may anticipate the bar by an eighth.
- **Voicing:** rootless 3-4 note voicings between about E3 and E4, moving by step. The sub owns the
  root.
- **Tension:** sus4 and 13ths lean, maj7#11 floats, 7b9 or a borrowed iv aches. Release by stepping
  the leaning voice down.

## Melody rules (write your own motif)

- Lead in C4-A5, counter an octave above.
- Short arches, with the high point late in the phrase.
- 1-3 notes per beat, with rests so the echo can answer.
- A 2-5 note cell with its own rhythm: repeat it, then vary it (a step up, the last interval
  inverted, displaced by an eighth).
- Call and response between the lead and the counter.

## Arrangement grammar

A typical shape: intro -> groove -> hook -> (half-time or breakdown) -> drop on home -> outro. Add
or remove one layer at a time. Put the drop (everything back, home chord) on the picture's strongest
beat.

**Transitions:**
- a fill bar;
- a half-time bar;
- drums out for a breakdown.

**Endings:**
- the home chord held, with the motif's last note;
- a clean button.

## Mixing: balance by stem RMS, then master

```
node tools/music.mjs check <file>.ts#<export>              # the whole gate, stems included
node tools/music.mjs stems <file>.ts#<export>              # the stem table alone, while you balance
node tools/music.mjs render <file>.ts#<export> out.mp3 --stems
```

A stem is a part's own signal:
- unmastered, pre-room, after its gain and the duck;
- measured on its **mid** ((L + R) / 2, after its pan, 30 Hz high-passed) as the RMS of the 20 ms blocks where it
  plays: blocks under -70 dBFS never count, then blocks more than 20 dB under the part's own level drop out (gated
  like loudness), at 24 kHz. (The v1 meter read the left channel sample by sample above -80 dB; every target was
  converted at the sound-v2 merge on the render it was set on, so the balance did not move.)

Fix a flagged part with `levels`, never with the master.

**The lesson:** integrated LUFS only says how loud the whole mix is. On the launch score the mix read
a healthy -14 LUFS while the sub sat **7-10 dB too hot**. `tools/music-unit.mjs` keeps this as a
regression: a sub 9 dB hot still masters to -14.0 LUFS, and only the stem meter flags it.
