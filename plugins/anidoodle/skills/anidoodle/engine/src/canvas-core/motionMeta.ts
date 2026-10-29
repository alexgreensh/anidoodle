// MOTION META. What a film tells the motion scans about itself (Film.meta.motion). Plain data, so it
// survives the page boundary; every field is read by a tool (motionscan.mjs, layerscan.mjs, lock.mjs).
import type { Temperament } from "./motionKit";

export type MotionMeta = {
  /** The brand's colours (#rrggbb). layerscan fails any fill in them at an alpha between 5 % and 95 % (olive mud). */
  brandColors?: string[];
  /** The brand's motion temperament, by name ("calm", "lively", "snappy") or as numbers. motionscan fails stretches past its top speed. */
  temperament?: string | Temperament;
  /** Approved shots, frozen: [shot id, sha from `lock.mjs <film> --shot <id>`, who approved it and when]. lock.mjs fails if the shot's frames change. */
  approved?: [shot: string, sha: string, note: string][];
  /** Deliberate exceptions, [fromFrame, toFrame, reason]: a hard cut on a beat (slide cut), a dissolve the story needs, a declared brand fade. */
  allow?: { slideCut?: [number, number, string][]; dissolve?: [number, number, string][]; translucent?: [number, number, string][] };
};
