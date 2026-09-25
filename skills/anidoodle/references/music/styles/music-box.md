# Style preset: music-box (the default)

> The original anidoodle music recipe, kept **verbatim** below as one style preset among the eleven
> in `engine/src/canvas-core/music/tables.ts` (`STYLES.musicBox`). Its numbers are what the
> `musicBox` and `bell` instruments implement. Its ban list is now the rule for THIS preset only;
> for every other style the bans became measured guards (see `../README.md`, "Guards"). The scar
> story is kept because it is why the guards exist.

---

# The music recipe

> Doctrine earned making MECHANICAL LEPIDOPTERA, the worked example in `example/`. Every rule
> below was paid for on that film; where a mistake was the director's own it says so, because
> a rule with its scar attached is one people keep.

**The mistake.** Music made in code is the hardest thing in this skill, because the one making it cannot hear it. My spec asked for a music box that "asks a question and ends unresolved on the fifth", a tick "thinning into a felt flutter", and "a bowed pad from the take-off". Every one of those is a good sentence and together they are the recipe for what the client called a ghost crying: slow attacks, sustained tones, a phrase left hanging for eighteen seconds, reverb. It was nobody's bug. It was an adjective brief, and adjective briefs produce atmosphere, and synthesized atmosphere is a haunted house.

**The rule: never "make it good". Ship this.**

**Banned, all of it, always:** minor keys and modes; any sustained pad, bowed or blown tone, drone or sub-bass; attack times over 10 ms; reverb tails, feedback delays, convolution; detuning, pitch glides, vibrato; filtered noise "wind" or swells; a phrase left unresolved for more than four bars; a gap with nothing sounding for more than one beat once the music has started.

**The instrument: a music box / celesta pluck.** Per note at frequency `f`:
- partials: sine at `f` gain 1.0, `2f` 0.35, `3f` 0.12, plus a strike "ping" at about `5.4f` gain 0.08 that dies in 60 ms;
- envelope: 2 ms linear attack, then pure exponential decay, no sustain. Time constant `tau = 0.45 * sqrt(440 / f)` seconds, so high notes are short and sparkly and low notes ring a little;
- velocity: strong beats 1.0, others 0.7, grace notes 0.45.
- bass: same pluck one to two octaves down with only the first two partials, gain 0.5. It is still a pluck. It never sustains.
- "room": ONE early reflection, 30 ms late, 14 dB down. No tail.

**Key, register, harmony.** C, G or D major. Melody between C5 and C7, bass C3 to G3. One chord per bar, **I, IV, V, I**, and nothing cleverer. If you want a lift for the payoff, go up a whole step and play the same thing.

**Melody.** Chord tones and the major pentatonic (1 2 3 5 6). Mostly steps, leaps only onto chord tones. Four-bar phrases in pairs: the QUESTION ends on the 5th over V, the ANSWER ends on the root over I, **and the answer follows immediately.** The story may hold its resolution back for a minute; the tune may not. What you hold back is the ARRANGEMENT: the octave doubling, the full arpeggio and the bell arrive with the payoff.

**Rhythm.** At 120 bpm and 30 fps a beat is 15 frames and a straight eighth is 7.5 frames, which does not exist. Use triplet eighths, 5 frames: 12/8, which is what a music box plays anyway. Accompaniment is a rolling 1-5-3-5 arpeggio on the triplets; melody mostly on beats. Every onset is a row in a cue table with its FRAME, and the module asserts at load that each sample index equals `round(frame / fps * sampleRate)`.

**Sound events ride on top, quietly:** a tick is a 2 ms noise burst through a band-pass at 3 kHz, the tock at 2 kHz, 20 dB under the melody. A landing is one soft pluck on its beat. The DING is a bell on the tonic (partials 1, 2, 3, 4.2, tau 1.2 s, doubled an octave down) on the final downbeat, with at least four beats of film after it.

**Arc without pads.** Act by act: melody alone; add bass; add the arpeggio; add octave sparkle; bell. More notes, never longer notes.

**Master.** Normalise to a peak of -3 dBFS, soft-clip with `tanh`, RMS near -18 dBFS.

**Verification, since you are deaf.** Print the score as text, bar by bar, note names and chords, so a human can read it. Measure from the DECODED file: peak, RMS per bar, longest silence, and spectral centroid (a bright pluck score sits well above 1.5 kHz; a number near 400 Hz means a pad got in). Then the only test that counts: **one 8-second sample to the client before you score the film.** It is the music's look-still. We skipped it and scored sixty seconds of the wrong thing.

---

## What is verified here, and what is not

Flagged by the director when this doctrine was written, and carried forward unchanged because it
still applies: the "what went wrong" above rests on the **client's description** of the render plus the
director's own spec, which had asked for exactly the ingredients she named. The director could not
hear it either. **The synthesis numbers are a good starting point, not a frozen answer** — confirm
them with one human listening pass before you trust them on a new film.

The related `doodle-film` skill's score advice (detune the loop flatter on each repeat, a hush and
a heartbeat kick) is tuned for a wistful film and contradicts several bans above. Neither is wrong;
they are for different moods. Say which mood you are in before you pick.
