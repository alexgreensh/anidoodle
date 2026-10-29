// SHIP META. What a film tells the ship checks about itself (Film.meta.checks). Every field is
// optional and every one is read by a tool: framecheck.mjs, ship.mjs. Plain data, so it survives the
// page boundary as it is.
export type ShipMeta = {
  /** [fromFrame, toFrame, reason]: frames where the layout rules (density, gaps, centred stack, text over
   * text or over a box edge) are not judged. A deliberate wall of words or a collision that is the joke. */
  layoutExempt?: [from: number, to: number, reason: string][];
  /** The length budget in seconds (D1). ship prints the film's length and its shots against it; over max fails. */
  length?: { target: number; max: number };
  /** The brand's own font families (T8). Text set in any other family is listed for review. */
  fonts?: string[];
  /** Brand face -> the family standing in for it while the font file is missing (T8): every line set in a stand-in is listed. */
  standIns?: Record<string, string>;
  /** Music that is a supplied or generated track, not a score the page composes (X3). `track` is the take's
   * manifest from `track.mjs import` (<take>.track.json). verify-export then expects an audio stream, checks the
   * delivered mix came from that take, and ship runs track.mjs check and soundcheck --sfx on the file. */
  music?: { track: string };
  /** Checks with truly nothing to look at, by ship row name, each with its reason: { "review": "a test fixture
   * nobody is shown", "layers:translucent": "the brand has no colour of its own" }. A check that cannot look
   * FAILS in ship.mjs; a row named here is NONE instead, with the reason printed in the table. Gate check 5
   * reads "3d" the same way (a 3D film that registers no grip or rig to check). */
  none?: Record<string, string>;
};
