// FILM RUNTIME. A film is data: meta, an asset manifest, and shots that tile [0, duration).
// renderFrame(film, ctx, frame, env) is the whole contract between the art and any backend.
import type { Ctx, Env } from "./core";
import type { Piece } from "./music/plan";

/** Hosts preload these scores' verified banks before calling the complete audio mix. */
export type FilmAudio = ((sampleRate: number) => [Float32Array, Float32Array]) & { scores?: Piece[] };

export type Shot = { id: string; start: number; end: number; draw: (ctx: Ctx, local: number, env: Env) => void }; // frames, end exclusive
export type Assets = { images: Record<string, string>; fonts?: Record<string, string> }; // name -> url (the page build inlines them)
// raster "cpu": every canvas of the film is rasterised in software. Chromium gives each page a
// GPU canvas budget, and when several pages render at once with big layer pools some surfaces
// silently fall back to software, which antialiases differently: the same frame then comes out
// in more than one way depending on timing. Software everywhere is the same everywhere.
export type Film = { meta: {
  title: string; W: number; H: number; fps: number; bpm: number; durationFrames: number;
  raster?: "gpu" | "cpu";
  // "drawing": a picture drawing itself. Fine marks change little per frame, so dead air is judged
  // over 1 s at a 0.02% floor, and a hand's short pauses between passes (up to half a second) are allowed.
  kind?: "story" | "drawing" | "loop" | "explainer" | "infographic" | "launch" | "interactive";
  locked?: [from: number, to: number, reason: string][];
  // a declared hold: the stillness is meant (a word read, an end card); the optional reason is printed by the gate
  holds?: [from: number, to: number, reason?: string][];
  /** silences the film means (a held breath before a reveal, a pause on a beat), [fromFrame, toFrame, reason]: verify-export does not count them as holes */
  quiet?: [from: number, to: number, reason?: string][];
  onTwos?: boolean;
  step?: 1 | 2 | 3;
  // the score as fitted to this film: its tempo and form; render prints it next to the grid's bpm.
  // grid: the film's cuts sit on meta.bpm, so the score must play within 0.5 % of it (render refuses otherwise)
  score?: { tempo: number; form: string; grid?: boolean };
  // frame-cued sync points the delivered file is checked against (verify-export: audio-to-video sync), and
  // the words a viewer reads, for .srt/.vtt captions: both in frames of this film
  sync?: { frame: number; label: string }[];
  captions?: { from: number; to: number; text: string }[];
  // a legible frame for the poster image and the thumbnail (render --poster-frame, launch.mjs ship)
  poster?: number;
  // what the film tells the ship checks about itself (shipMeta.ts: layout exemptions, length budget, brand fonts)
  checks?: import("./shipMeta").ShipMeta;
  // what the film tells the motion scans (motionMeta.ts: brand colours, temperament, approved shots, exceptions)
  motion?: import("./motionMeta").MotionMeta;
}; assets: Assets; shots: Shot[]; audio?: FilmAudio;
  // the same film composed for another frame shape (launch template films); hosts/page.ts calls it for <film>-<shape>
  reshape?: (shape: string) => Film };

// Cheap structural checks every adapter runs before frame 0. (The full gate is Phase 2.)
export const validate = (film: Film): string[] => {
  const p: string[] = [], { W, H, fps, bpm, durationFrames } = film.meta, beat = bpm ? (60 / bpm) * fps : null, ids = new Set<string>();
  if (![W, H, fps, durationFrames].every((n) => Number.isSafeInteger(n) && n > 0)) p.push("W, H, fps and durationFrames must be positive integers");
  if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isInteger(beat)) p.push(`bpm ${bpm} at ${fps} fps does not give a whole-frame beat`);
  if (film.meta.step !== undefined && ![1, 2, 3].includes(film.meta.step)) p.push("step must be 1, 2 or 3");
  for (const [from, to] of [...(film.meta.holds ?? []), ...(film.meta.locked ?? []), ...(film.meta.quiet ?? [])]) if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to > durationFrames || to <= from) p.push(`invalid declared range ${from}-${to}`);
  for (const [, , reason] of film.meta.locked ?? []) if (!reason?.trim()) p.push("locked ranges need a reason");
  let t = 0;
  [...film.shots].sort((a, b) => a.start - b.start).forEach((s) => {
    if (ids.has(s.id)) p.push(`duplicate shot id '${s.id}'`); ids.add(s.id);
    if (s.start !== t) p.push(`shot '${s.id}' starts at ${s.start}, expected ${t} (gap or overlap)`);
    if (s.end <= s.start) p.push(`shot '${s.id}' has no length`);
    if (beat && Number.isInteger(beat) && s.start % beat) p.push(`shot '${s.id}' cuts off the beat grid (frame ${s.start}, beat = ${beat} frames)`);
    t = s.end;
  });
  if (t !== durationFrames) p.push(`shots end at frame ${t}, film is ${durationFrames}`);
  return p;
};

export const shotAt = (film: Film, frame: number): Shot | undefined => film.shots.find((s) => frame >= s.start && frame < s.end);
// Every frame starts from a DEFAULT context, whatever the last frame left behind: a lineJoin, a dash,
// a font or an unmatched save() leaking from frame 86 into frame 109 makes 109 depend on the order
// frames were asked for (measured on brickBalloon inside the launch film). reset() is the whole
// state in one call; the fallback names every property a 2D context carries.
const freshState = (ctx: Ctx) => {
  const c = ctx as Ctx & { reset?: () => void };
  if (typeof c.reset === "function") { c.reset(); return; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#000"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.lineCap = "butt"; ctx.lineJoin = "miter"; ctx.miterLimit = 10;
  ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.font = "10px sans-serif"; ctx.textAlign = "start"; ctx.textBaseline = "alphabetic"; ctx.direction = "inherit";
  ctx.shadowBlur = 0; ctx.shadowColor = "rgba(0, 0, 0, 0)"; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "low";
};
export const renderFrame = (film: Film, ctx: Ctx, frame: number, env: Env): string | null => {
  const s = shotAt(film, Math.max(0, Math.min(film.meta.durationFrames - 1, Math.round(frame))));
  if (!s) return null;
  freshState(ctx); ctx.clearRect(0, 0, env.W * env.scale, env.H * env.scale);
  s.draw(ctx, frame - s.start, env);
  return s.id;
};
