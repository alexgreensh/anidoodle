// anidoodle sound effects: the kit (sfxKit), its building blocks (sfxCore) and film placement (sfxMix).
// Docs: references/music/sound-design.md. Tool: engine/tools/sfx.mjs.
export { SFX, SFX_KINDS, sfxVariants, sfxInfo, sfxDuckDb, renderSfx, validateSfx, sfxNeeds, parseKey, type SfxKind, type SfxOpts, type SfxSound } from "./sfxKit";
export { placeSfx, sfxDuck, sfxAudibility, sfxHarshness, SFX_HARSH_CAPS, mixSfx, assertSfxAudible, filmSfx, validateSfxPlan, resolveSfxPlan, type SfxCue, type SfxPlan, type SfxSnap, type PlacedCue, type SfxAudibility, type SfxHarshOptions, type SfxHarshness, type SfxMix } from "./sfxMix";
export { type SfxStereo } from "./sfxCore";
