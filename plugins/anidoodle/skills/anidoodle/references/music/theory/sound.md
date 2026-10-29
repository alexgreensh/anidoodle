# Sound theory: psychoacoustics for composing and mixing

**Contents:** 1. Critical bands and roughness · 2. Masking: why the tune gets buried · 3. Equal loudness (Fletcher-Munson / ISO 226) · 4. Tonal balance by genre (long-term spectrum) · 5. Stereo and depth · 6. Reverb and delay timing · 7. Loudness and dynamics

You write notes, and the engine mixes. Most "muddy", "thin" or "buried" results are decided by the
notes: register, spacing, density and which parts overlap. This page is the physics behind those
choices. The engine's guards and `craft` check the parts you can control from the score. The mix
chain itself is in `render.ts` and `mixProfiles.ts` ([../sound-design.md](../sound-design.md) covers
effects).

## 1. Critical bands and roughness

- The ear analyses sound in overlapping **critical bands**, about 100 Hz wide below 500 Hz and about
  20 % of the centre frequency above that (Zwicker 1961; the ERB is 24.7 x (4.37 f/kHz + 1) Hz,
  Glasberg & Moore 1990).
- Two partials inside one band **beat and roughen**. Roughness peaks near a quarter of a critical band
  apart (Plomp & Levelt 1965).
- Low down, a band spans many semitones, so **a third at C2 is rough while the same third at C4 is
  sweet.**

That is the physics of the **low interval limits** (the chart taught in Berklee arranging; e.g. Pease &
Pullig 2001), the lowest bottom note for each interval before it muddies:

| Interval | m2 | M2 | m3 | M3 | P4 | tritone | P5 | m6-M7 | m9 | M9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Lowest bottom note | E3 | Eb3 | C3 | Bb2 | Bb2 | B2 | Bb1 | F2 | E2 | Eb2 |

- Octaves have no limit. The chart is loose by about ±2 semitones (a concert grand gets away with
  more), so `craft` flags intervals 3 or more semitones under their limit.
- Fix: spread the voicing (`1-5-3'` instead of `1-3-5` in the bass), or lift the upper note an octave.

## 2. Masking: why the tune gets buried

- A louder sound hides a quieter one in the same critical band. Masking spreads **upward**: a loud low
  sound masks higher sounds more than the reverse (Zwicker & Fastl 2007; Moore 2012).
- A pad or chord stack in the melody's octave masks the melody even at a lower level. The engine's
  masking guard requires the melody to beat every other part by 3 dB in 500 Hz-4 kHz.
- **Composing fixes come before level fixes:**
  - voice the chords below the tune (`craft`: "melody under chords");
  - thin the accompaniment when the melody moves;
  - give the lead a distinct timbre and its own octave;
  - let counter lines answer in the rests instead of overlapping.
- **Frequency slots** ([form.md](form.md) section 4): one owner per register at a time.

## 3. Equal loudness (Fletcher-Munson / ISO 226)

- Hearing is least sensitive at the extremes and most sensitive at 2-5 kHz. At low listening levels
  the lows and highs drop away (Fletcher & Munson 1933; ISO 226:2003).
- A bass line that is "loud enough" on studio monitors disappears on a phone speaker (the small
  speaker rolls off below about 150-200 Hz). **Phone rule:** every low part needs harmonics above
  500 Hz: a bass with some drive or a pick attack, and an 808 with saturation. Octave-doubling the bass
  line an octave up at a low level also works.
- A quiet passage sounds thinner, not just quieter. Soft sections can take slightly more low-mid warmth.

## 4. Tonal balance by genre (long-term spectrum)

- Commercial mixes cluster around a smooth downward slope, about -5 dB per octave from 100 Hz to
  4 kHz, steeper above (Pestana et al. 2013). The shape has held across decades and genres.
  The genres differ at the ends:

| Genre | Low end | Mids | Top |
|---|---|---|---|
| EDM, hip-hop, trap | +3-6 dB sub (40-80 Hz), the kick and 808 dominate | scooped slightly around 300-500 Hz | bright hats |
| Pop, rock | full, the kick and bass balanced | vocal and guitar forward at 1-4 kHz | bright |
| Lo-fi | warm, head bump 60-90 Hz | forward low-mids | rolled off above 8-10 kHz |
| Orchestral, acoustic | natural, less sub | wide | natural roll-off from distance and hall |
| Ambient | soft lows, long tails | recessed | airy but gentle |

- The engine's mix profiles implement these, and `check` measures the centroid for the mood. For
  composing: **a dark mood wants lower registers and fewer bright attacks, not just a darker filter.**

## 5. Stereo and depth

- **Mono lows:** keep the kick, bass and anything below about 120 Hz in the centre. Low frequencies
  carry little direction and eat headroom when spread.
- **Width comes from difference**: different parts (or the same part voiced differently) on each side,
  and two players with slight timing and tuning differences. One part copied to both sides is still
  mono.
- **The precedence (Haas) effect:** the same sound 1-30 ms later is heard as one sound from the
  earlier side (Haas 1951; Blauert 1997). It is useful for width on doubles, and dangerous for mono
  playback (comb filtering).
- **Depth cues:** a far sound is quieter, darker (the air absorbs highs), wetter (a higher
  reverb-to-direct ratio) and has softer attacks. Put the lead near and the pads far.

## 6. Reverb and delay timing

- **Tempo-synced delay:** a quarter note = 60,000 / bpm ms (at 90 bpm, 667 ms). A dotted eighth = 0.75 x
  that. An eighth = 0.5 x.
- **Pre-delay** (the gap before the reverb starts) keeps the attack dry and the part clear. 10-30 ms
  is typical. Longer (up to a 1/32 or 1/64 note) keeps the vocal and lead forward (Izhaki 2017).
- **Decay time to the tempo:** let the tail die before the next strong beat (a quarter to a half
  note). Longer tails blur harmony changes. The engine's reverb guard fails a tail within 10 dB of the
  dry sound.
- **Slow and sparse = more space. Fast and dense = less.** Many notes plus a long hall is the "ghost"
  wash that the ghost guard exists for.

## 7. Loudness and dynamics

- The engine masters to -16 LUFS (gentle) or -14 LUFS (dense), -1 dBTP, the streaming norms (AES TD1004,
  2015).
- **Real dynamics are written, not mastered:** section `energy`, `dyn` and velocities. A peak is a
  composing problem: stagger the bass under the loudest downbeat, roll the big chord, and don't double
  the climax note in every part.
- Perceived loudness follows density and brightness as well as level. A build can feel louder with more
  onsets and a higher register at the same meter reading.

Sources: Zwicker, "Subdivision of the audible frequency range into critical bands", *JASA* 33 (1961);
Glasberg & Moore, "Derivation of auditory filter shapes from notched-noise data", *Hearing Research*
47 (1990); Plomp & Levelt, "Tonal consonance and critical bandwidth", *JASA* 38 (1965); Zwicker &
Fastl, *Psychoacoustics: Facts and Models* (3rd ed., 2007); Moore, *An Introduction to the Psychology
of Hearing* (6th ed., 2012); Fletcher & Munson, "Loudness, its definition, measurement and
calculation", *JASA* 5 (1933); ISO 226:2003; Pestana, Ma, Reiss, Barbosa & Black, "Spectral
characteristics of popular commercial recordings 1950-2010", AES 135th Convention (2013); Haas, "Über
den Einfluss eines Einfachechos auf die Hörsamkeit von Sprache", *Acustica* 1 (1951); Blauert,
*Spatial Hearing* (1997); Izhaki, *Mixing Audio* (3rd ed., 2017); Owsinski, *The Mixing Engineer's
Handbook* (4th ed., 2017); Katz, *Mastering Audio* (3rd ed., 2015); Pease & Pullig, *Modern Jazz
Voicings* (2001); AES TD1004.1.15-10, "Recommendation for loudness of audio streaming and network file playback" (2015).
