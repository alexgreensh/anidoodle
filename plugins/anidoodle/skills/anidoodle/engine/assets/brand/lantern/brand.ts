// Written by tools/brand.mjs import from 1 source file(s); never edit by hand, re-import instead.
// These are the brand's exact paths: move, rotate, scale evenly, clip and layer them (brandKit.ts), never redraw them.
import type { BrandElement } from "../../../src/canvas-core/brandKit";

export const BRAND: { elements: Record<string, BrandElement>; palette: { hex: string; share: number }[]; fonts: string[]; motion: Record<string, any> } = {"elements":{"lanternMark":{"w":120,"h":120,"parts":[{"d":"M60 2 A13 13 0 1 1 59.99 2 Z M60 9 A6 6 0 1 0 60.01 9 Z","fill":{"type":"solid","c":"#f2b544"},"rule":"evenodd","op":1,"bb":[47,2,26,26]},{"d":"M40 24 H80 L92 38 H28 Z","fill":{"type":"solid","c":"#f2b544"},"rule":"nonzero","op":1,"bb":[28,24,64,14]},{"d":"M32 40 H88 V98 H32 Z M42 48 V90 H78 V48 Z","fill":{"type":"solid","c":"#f2b544"},"rule":"evenodd","op":1,"bb":[32,40,56,58]},{"d":"M60 52 C70 64 73 74 68 82 C65 87 55 87 52 82 C47 74 50 64 60 52 Z","fill":{"type":"solid","c":"#f2b544"},"rule":"nonzero","op":1,"bb":[49.63,52,20.75,33.75]},{"d":"M24 100 H96 Q100 100 100 104 V108 Q100 112 96 112 H24 Q20 112 20 108 V104 Q20 100 24 100 Z","fill":{"type":"solid","c":"#f2b544"},"rule":"nonzero","op":1,"bb":[20,100,80,12]}]}},"palette":[{"hex":"#f2b544","share":1}],"fonts":[],"motion":{}};

/** For the film's meta.brand: the brand's colours (never drawn translucent outside a declared exception) and its element names. */
export const brandMeta = {"colors":["#f2b544"],"elements":["lanternMark"]};
/** For the film's meta.motion: layerscan fails a brand colour filled half-transparent. Spread it: meta.motion = { ...brandMotion, temperament: "calm" }. */
export const brandMotion = {"brandColors":["#f2b544"]};
