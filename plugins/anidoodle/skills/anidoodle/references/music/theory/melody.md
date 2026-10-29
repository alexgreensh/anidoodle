# Melody: motif, contour, phrase

**Contents:** 1. Start from a motif, then develop it · 2. Phrase and period · 3. Contour and climax · 4. Steps, leaps and recovery · 5. Range and tessitura · 6. Rhythm and melody together · 7. Non-chord tones: where the feeling is · 8. Phrase endings · Checklist

Notation on this page: scale degrees (`1 2 3 ... 7`, `b3`, `#4`; `5,` = the octave below, `1'` = the octave
above), durations in beats after a colon (`3:.5`). These are shapes to apply, never tunes to copy.
`node tools/music.mjs craft <score>` measures every rule below (the **melody** line and `CRAFT melody:` findings).

## 1. Start from a motif, then develop it

A motif is 2-5 notes with **its own rhythm**. The rhythm is its identity: listeners recognise a
motif by its rhythm and contour long before its exact intervals (Schoenberg 1967, ch. 2-3; Dowling 1978).
Write the rhythm first, then the pitches.

| Technique | What changes | Example (from a cell `1:.5 2:.5 3:1`) | Effect |
|---|---|---|---|
| Repetition | nothing | the cell again | anchors: the ear learns it |
| Varied repetition | the last interval or note | `1 2 5` | keeps identity, adds interest |
| Sequence | the start pitch (same shape) | `2 3 4`, then `3 4 5` | motion, rising energy; max 3 links, then break |
| Inversion | the direction of each interval | `3 2 1` | an answer, a turn of mood |
| Retrograde | the order | `3 2 1` with the rhythm reversed | rare, a hidden echo |
| Augmentation | durations x2 | `1:1 2:1 3:2` | weight, arrival, the climax or the end |
| Diminution | durations /2 | `1:.25 2:.25 3:.5` | urgency, a build |
| Fragmentation | keep 2-3 notes, repeat them | `2 3, 2 3, 2 3` | the build before a peak |
| Displacement | start an eighth later | `r:.5 1 2 3` | syncopation, groove, surprise |
| Reharmonisation | the chord under it | same notes over vi instead of I | new colour, same tune |

A score that works usually has **one** idea heard 6-12 times, never the same way twice, and at most a
second idea that answers or contrasts it. `craft` reports how each phrase (or bar) relates to earlier
ones: `exact`, `sequence`, `varied`, `new`. Aim for most phrases to return (`motif returns` >= 50 %) and
few to be exact copies (<= 60 %; loop idioms like lo-fi and house may repeat more).

## 2. Phrase and period

- A **phrase** is 2 or 4 bars and ends with a cadence, a long note or a rest (Caplin 1998).
- A **period** is two phrases: the antecedent (question) ends open, on 2, 5 or 7 over V; the
  consequent (answer) starts the same way and ends closed, on 1 over I.
- A **sentence** is 2 + 2 + 4: the idea, the idea again (varied or sequenced), then a continuation that
  fragments it and speeds up the harmony into the cadence (Schoenberg 1967; Caplin 1998).
- Question/answer between instruments is the same device: the lead asks, the counter answers
  within one bar.

## 3. Contour and climax

- **Arch.** Across thousands of folk songs, the commonest phrase shape rises then falls (Huron 1996).
  Descending phrases come second; phrases also drift down at their ends ("late-phrase declination",
  Huron 2006).
- **One high point per phrase group**, in the second half, often about two thirds in. The highest
  note of the whole piece is its climax: put it on the picture's key moment, and don't reuse it
  casually. `craft` warns when the piece peaks in its first 30 % or repeats the top note often.
- Vary contours between phrases: a question that rises, an answer that falls.
- In minor-key themes, lines sit lower and move in smaller intervals than in major ones (Huron 2008).
  That is part of why they sound sad, so use it on purpose.

## 4. Steps, leaps and recovery

- **Mostly steps.** Small intervals dominate melodies across cultures (Vos & Troost 1989; Huron
  2006, "pitch proximity"). Singable tunes are roughly 60-80 % steps.
- **A leap is an event.** Use a 4th or more to mark the motif's head or to reach the high point.
- **Recover from leaps.** After a leap, change direction, preferably by step, to fill the gap. This
  is statistically real ("post-skip reversal") and partly regression to the middle of the range
  (von Hippel & Huron 2000). `craft` counts leaps that keep going the same way.
- **Exemptions:** arpeggiating the current chord (a fanfare `1 3 5 1'`), and arpeggio or ostinato
  idioms (music box, chiptune, synthwave, house).
- **Avoid:** two leaps the same way that don't outline a chord; augmented 2nds and tritone leaps
  (except as a deliberate colour); leaps over an octave in anything meant to sound sung.

## 5. Range and tessitura

- Keep one phrase within about an octave. Keep the whole tune within a 10th to a 12th unless the
  instrument is built for more (piano, harp, synth).
- Keep each part in its instrument's sweet range. `craft` checks the table in `craftTables.ts`
  (after Adler 2016): a note outside what the instrument can physically play is the one craft error.
- The melody sits **above** the chord voicing. A melody under the chords' top note is masked unless it
  is louder and a different timbre (a tenor-register theme).

## 6. Rhythm and melody together

- Put the motif's long note where the meaning is: on the downbeat for arrival, or on a weak beat
  (syncopated) for lift.
- Start motifs off the downbeat (an upbeat or pickup) for forward motion. Start on it for weight.
- Leave rests. A melody that never breathes can't phrase, and echo effects need the gaps.
- Rhythmic contrast between phrases matters as much as pitch contrast. Change one, keep the other.

## 7. Non-chord tones: where the feeling is

On strong beats, use chord tones (`craft`: "strong beats on chord tones"; below 50 % the tune fights the
harmony). Dissonance belongs in these shapes, each with its own effect (Aldwell & Schachter 2011, ch.
9-10; Huron 2006 on tension and resolution):

| Type | Shape | Effect |
|---|---|---|
| Passing | step, step, same direction, weak beat | flow, smoothness |
| Neighbour | step away and back | ornament, gentle motion |
| Appoggiatura | leap INTO the dissonance on a strong beat, resolve by step the other way | longing, the "sigh": strongest emotional pull |
| Suspension | a note held from the previous chord, resolving down by step (4-3, 9-8, 7-6) | ache, tenderness, delayed release |
| Anticipation | the next chord's note arrives early | eagerness, pop and jazz lift |
| Escape | step in, leap out | a flick, playfulness |

Outside common-practice idioms the added 6th and 9th count as colour tones, not dissonances (Levine 1995).

## 8. Phrase endings

- Answers end on 1, 3 or 5 over a stable chord. Questions end on 2, 5 or 7 (over V) or on a colour tone.
- `craft` reports the share of phrases ending on chord tones and names a last note off the home triad.
  An open ending is allowed where the mood asks for it (suspense, ambient, curious), and craft says so.

## Checklist

- [ ] One motif, rhythm first, heard 6-12 times, developed (sequence, inversion, fragmentation, augmentation).
- [ ] Phrases in 2s and 4s. Questions end open, answers end home.
- [ ] Arches. One climax, in the second half, on the key picture beat.
- [ ] Mostly steps. Leaps turn back.
- [ ] Chord tones on the beats. Appoggiaturas and suspensions where you want feeling.
- [ ] Every part in its sweet range. The tune sits above the chords.

Sources: Schoenberg, *Fundamentals of Musical Composition* (1967); Caplin, *Classical Form* (1998);
Huron, "The Melodic Arch in Western Folksongs", *Computing in Musicology* 10 (1996); Huron, *Sweet
Anticipation* (2006); Huron, "A comparison of average pitch height and interval size in major- and
minor-key themes", *Empirical Musicology Review* 3 (2008); von Hippel & Huron, "Why do skips precede
reversals?", *Music Perception* 18 (2000); Vos & Troost, "Ascending and descending melodic intervals",
*Music Perception* 6 (1989); Dowling, "Scale and contour", *Psychological Review* 85 (1978);
Aldwell & Schachter, *Harmony and Voice Leading* (4th ed., 2011); Levine, *The Jazz Theory Book*
(1995); Adler, *The Study of Orchestration* (4th ed., 2016).
