// anidoodle music: 100 % procedural, notes as data, synthesized in code. No samples, ever.
export * from "./theory";
export * from "./tables";
export * from "./plan";
export * from "./perform";
export * from "./piano";
export * from "./render";
export * from "./meter";
export * from "./guards";
export * from "./score-text";
export * as instruments from "./instruments";
import { nocturne, pianoPhrase8 } from "./pieces/nocturne";
import { musicBoxJoy, minorPianoMelancholy, cinematicAwe, chiptunePlayful, lofiNostalgic } from "./pieces/samplers";
import { marimbaCurious, harpTender, guitarWistful, celestaWonder, bellsHopeful, driveElectronic, folkCalm } from "./pieces/families";
import { ghostFixture } from "./pieces/fixtures";
export { nocturne, pianoPhrase8, musicBoxJoy, minorPianoMelancholy, cinematicAwe, chiptunePlayful, lofiNostalgic, marimbaCurious, harpTender, guitarWistful, celestaWonder, bellsHopeful, driveElectronic, folkCalm, ghostFixture };
/** Named pieces a film (or the tool) can ask for. ghostFixture is a test fixture, never a score. */
export const PIECES = { nocturne, pianoPhrase8, musicBoxJoy, minorPianoMelancholy, cinematicAwe, chiptunePlayful, lofiNostalgic, marimbaCurious, harpTender, guitarWistful, celestaWonder, bellsHopeful, driveElectronic, folkCalm, ghostFixture };
