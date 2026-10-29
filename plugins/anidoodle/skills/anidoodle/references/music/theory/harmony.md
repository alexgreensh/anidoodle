# Harmony: function, voice leading, colour, tension

**Contents:** 1. Function: home, away, leaning, home · 2. Cadences: where a phrase breathes · 3. Voice leading · 4. Voicing and the low end · 5. Colour: modes, borrowed chords, extensions · 6. Secondary dominants, pedals, modulation · 7. Harmonic rhythm: pacing · 8. Tension curve

Roman numerals are relative to the key (`I ii iii IV V vi vii°` in major, `i ii° III iv v VI VII` in
minor, `b` = borrowed or lowered). These are idioms, which are vocabulary. A multi-bar progression
together with its rhythm and groove is a piece, and novelty checks for that. `craft` measures this page
on the **harmony** line.

## 1. Function: home, away, leaning, home

| Function | Chords (major) | Feels like | Use |
|---|---|---|---|
| Tonic (T) | I, vi, iii | home, rest | starts, arrivals, the end |
| Subdominant / predominant (S) | IV, ii, (bVI, iv borrowed) | moving away, opening | verses, bridges, before the lean |
| Dominant (D) | V, V7, vii°, (bVII in rock/modal) | leaning, wanting home | the bar before an arrival |

The standard motion is T -> S -> D -> T. Film and pop often skip D (`I bVII IV I`, a plagal or modal
world) for warmth without the classical "push".

## 2. Cadences: where a phrase breathes

| Cadence | Motion | Effect | `craft` label |
|---|---|---|---|
| Authentic | V(7) -> I | full stop, arrival | `authentic` |
| Plagal | IV -> I (or iv -> I) | "amen", gentle, hymn-like | `plagal` |
| Modal / backdoor | bVII -> I, bVI -> I, bII -> I | rock, film, epic warmth | `modal` |
| Half | ... -> V | a question, a comma | `half` |
| Deceptive | V -> vi (or bVI) | surprise, "not yet", extends a phrase | `deceptive` |

Put half and deceptive cadences inside the piece and the full one at the end. `craft` lists each
section's ending. It warns when nothing before the last section breathes, and when a non-loop piece ends
away from home (except where the idiom allows an open ending). **A loop should not cadence home** at its
end. Lean back into bar 1 instead (end on V, IV or a turnaround).

## 3. Voice leading

Chords are voices moving, not blocks (Aldwell & Schachter 2011; Tymoczko 2011):

- **Hold common tones.** Move every other voice to the **nearest** tone of the next chord. Efficient
  voice leading averages 1-3 semitones per voice per change (`craft`: "voice motion").
- **Contrary motion** between the bass and the melody gives independence and strength.
- **No parallel 5ths or octaves** between independent voices in common-practice idioms: chorale,
  choir, orchestral, nocturne, lullaby, music box, cinematic. They fuse two voices into one. `craft`
  warns in these styles and only notes them elsewhere. Parallel 5ths are the **sound** of rock power
  chords, of planing in jazz, house and lo-fi, and of folk drones. Doubling a line in octaves is
  orchestration, not a fault (`craft` counts it separately), except in a choir.
- **Inner voices** move by step or stay. A jump bigger than a 5th in an inner voice is a revoicing
  mistake.
- **Tendency tones:** the leading tone (7) rises to 1. The chord 7th falls by step. The suspended 4th
  falls to 3.

## 4. Voicing and the low end

- **Spread low, close high.** Below about C3, use only octaves and 5ths. Put thirds from about C3 up,
  and seconds from about E3 up. `craft` flags close intervals under the **low interval limits**
  (the chart in [sound.md](sound.md) and `craftTables.ts`), because they turn to mud.
- **The bass owns the root** (or a chosen inversion). The chord part sits above it in its own octave.
- **Voicings by genre:**

| Idiom | Voicing |
|---|---|
| Classical / choral | 4 parts SATB, root doubled, close or open position, 3rd never doubled in V |
| Jazz, lo-fi, neo-soul | rootless 3-7-9 or 7-3-13 shells between E3 and E4; the bass has the root (Levine 1995) |
| Pop / piano ballad | root-5-8 in the left hand, triad or add9 in the right |
| Rock | power chords (1-5-8) in the low guitar; keys add the 3rd higher up |
| Film / orchestral | open 5ths in the low strings, triads in the violas and violins, octave doublings for weight |
| Ambient / pad | add9, sus2 and maj7#11 clusters, placed high and wide |

## 5. Colour: modes, borrowed chords, extensions

| Colour | How | Feeling |
|---|---|---|
| Lydian `#4` | I -> II (major) | wonder, flight, magic (film "flying" music) |
| Mixolydian `b7` | I -> bVII -> IV | sunny, rock, easygoing |
| Dorian `6` | i -> IV (major) | bittersweet, moving forward |
| Phrygian `b2` | i -> bII | menace, heat |
| Borrowed iv | I -> iv -> I | a sudden ache, nostalgia (the "minor iv") |
| bVI and bVII | I -> bVI -> bVII -> I | epic, heroic lift |
| Chromatic mediants | I -> III or I -> bVI (major triads) | awe, a scene turning, the film "magic" shift (Lehman 2018) |
| Extensions | maj7, 9, 11, 13 | warmth and sophistication (jazz, lo-fi); triads sound plainer and bolder |
| Sus chords | sus4 -> 3, sus2 | openness; a lean that resolves |

## 6. Secondary dominants, pedals, modulation

- **Secondary dominant:** V/x before any chord x (`V/vi -> vi`, `V/V -> V`). It adds a leading tone and
  energy for one chord without leaving the key.
- **Pedal point:** hold the bass (1 or 5) while the chords change above it. A tonic pedal gives calm or
  a drone. A dominant pedal gives the build before an arrival.
- **Modulation:**
  - pivot chord (smooth, a new chapter);
  - direct lift up a step or a half step for the last chorus (energy; declare it on the section);
  - chromatic mediant (cinematic);
  - relative major and minor (mood change, same notes).

## 7. Harmonic rhythm: pacing

How often the chord changes sets the pace as much as the tempo does.

- 1 chord per 2 bars: calm, spacious, ambient, awe.
- 1 per bar: song default.
- 2 per bar: urgency, jazz, a cadence approach.

**Speed the harmonic rhythm up into a cadence** (the sentence's continuation) and slow it down after
an arrival. Change chords on strong beats. An eighth-note anticipation is fine; changes between beats
blur the metre (`craft`: "chord changes on beats").

## 8. Tension curve

`craft` draws a per-bar tension curve. Felt tension follows intensity first and harmony second
(Farbood 2012), so the blend is:

| Term | Weight | What it reads |
|---|---|---|
| loudness | 0.35 | every part sounding in the bar, velocity squared (section `energy` and `chordVel` included), weighted by its stem target; 1 at the piece's loudest bar, 0 at 12 dB under it |
| density | 0.25 | onsets per beat, against the piece's busiest bar |
| register | 0.15 | the melody's mean pitch within its range (the top voice where the melody rests) |
| harmonic lean | 0.25 | the chord root's distance from home (Lerdahl 2001, simplified; 0.15) and the sonority's dissonance (Huron 1994 interval-class ratings; 0.10) |

So a home-chord tutti climax or an EDM drop reads as the peak: its chord is at rest, but everything
plays, loud and high. A dominant that leans quietly does not. `craft` prints each section's four
terms under the curve, so you can see what drives it.

Plan the curve **before** the notes: rise, a dip just before the peak (a breath or breakdown), the
peak on the key picture moment, then release. It warns on a flat curve, on a first section that is the
most intense, and on a last section with no release. A loop, an ambient piece or a calm one stays
level on purpose (a site loop is low arousal: [mood.md](mood.md)), so a flat curve there is a note,
not a warning.

Sources: Aldwell & Schachter, *Harmony and Voice Leading* (2011); Kostka & Payne, *Tonal Harmony*
(8th ed., 2018); Piston, *Harmony* (1941/1987); Tymoczko, *A Geometry of Music* (2011); Levine, *The
Jazz Theory Book* (1995); Lehman, *Hollywood Harmony* (2018); Lerdahl, *Tonal Pitch Space* (2001);
Huron, "Interval-class content of equally tempered pitch-class sets", *Music Perception* 11 (1994);
Farbood, "A parametric, temporal model of musical tension", *Music Perception* 29 (2012); Lerdahl &
Krumhansl, "Modeling tonal tension", *Music Perception* 24 (2007).
