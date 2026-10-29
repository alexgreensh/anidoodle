// ONE WORLD. The default architecture for a motion-graphics film: every beat is a REGION placed on
// one canvas in world coordinates, and a single camera travels between them. Nothing is rebuilt per
// scene, so nothing can cut like a slide. This is the fix for "DUDE YOUR VIDEO IS A LITERAL SLIDE
// DECK" on a brand launch film: it cut from screen to screen instead of being one moving world.
//
//   const w = world({ W: 1920, H: 1080, regions: [
//       { id: "chat",  rect: [0, 0, 1600, 900] },
//       { id: "crowd", rect: [1900, 200, 2400, 1350] },
//     ], stops: [
//       { f: 0,   at: "chat", hold: 90 },
//       { f: 150, at: "crowd", hold: 60 },        // the camera travels chat -> crowd over frames 90..150
//     ], alive: { amp: 3, seed: 7 } });
//   w.begin(ctx, env, f);                          // the camera's transform: draw in world units now
//   w.region(ctx, "chat", () => drawChat(ctx));    // clipped to its own rect by default (no leaking edges)
//   w.depth(ctx, env, f, 0.33, () => frieze(ctx)); // a layer of brand shapes at a third of camera speed
//   w.end(ctx);
//
// CRAFT, and why it works this way:
// - REGIONS ARE THE STORYBOARD. A row of the board is a place in the world plus the camera move into
//   it, so a board with two rows and no move between them cannot be built here.
// - A STOP FRAMES A REGION. Its zoom fits the region's rect inside the frame with `pad` around it, so a
//   region can be any size and the camera works out the dolly. Several regions may share a stop.
// - REGIONS CLIP BY DEFAULT. A speaker's pink panel edge leaked into the next question on a brand launch film;
//   a region draws only inside its own rect unless it says clip: false.
// - THE CAMERA BREATHES. `alive` adds a slow handheld drift in screen px (never per-frame noise): a parked
//   camera reads as a slide even when the world is one.
// - ONE LAYOUT PER SHAPE. `regions` may be a function of the frame shape, so a 9:16 cut re-composes the
//   same world (a chat card that fills the phone) instead of cropping it.
// Every function is pure in the frame number; the camera is camera.ts's, so seams.ts's numbers apply.
import { Camera, heroScale, type Cam, type CamKey, type EaseName } from "./camera";
import { fractal, type Ctx, type Env, type P } from "./core";

export type Rect = [x: number, y: number, w: number, h: number];
export type Region = { id: string; rect: Rect; clip?: boolean };
export type Stop = { f: number; at: string | { look: P; zoom: number }; hold?: number; pad?: number; ease?: EaseName };
export type Shape = { W: number; H: number; name?: string };
export type WorldSpec = { W: number; H: number; regions: Region[] | ((shape: Shape) => Region[]); stops: Stop[]; alive?: { amp: number; seed: number; freq?: number }; shape?: string };

/** The zoom that fits rect inside a W x H frame with `pad` (a share of the rect) around it. */
export const fitZoom = (rect: Rect, W: number, H: number, pad = 0.08) => Math.min(W / (rect[2] * (1 + 2 * pad)), H / (rect[3] * (1 + 2 * pad)));
export const centreOf = (r: Rect): P => [r[0] + r[2] / 2, r[1] + r[3] / 2];
/** The fewest frames a camera move of `distPx` screen px may take so its peak stays under `maxPxPerFrame` (an in-out cubic peaks at 3x its mean). Use with temperament(...).pxPerFrame(W, fps). */
export const minTravel = (distPx: number, maxPxPerFrame: number) => { if (!(maxPxPerFrame > 0)) throw new Error(`minTravel: the speed limit must be above 0 (got ${maxPxPerFrame})`); return Math.max(2, Math.ceil((3 * Math.abs(distPx)) / maxPxPerFrame)); };

export const world = (spec: WorldSpec) => {
  const { W, H } = spec, regions = typeof spec.regions === "function" ? spec.regions({ W, H, name: spec.shape }) : spec.regions;
  if (!spec.stops.length) throw new Error("world: give at least one stop: where the camera starts");
  const byId = new Map<string, Region>();
  for (const r of regions) {
    if (byId.has(r.id)) throw new Error(`world: two regions are called "${r.id}"`);
    if (!(r.rect[2] > 0 && r.rect[3] > 0)) throw new Error(`world: region "${r.id}" has no size (${r.rect})`);
    byId.set(r.id, r);
  }
  const frame = (s: Stop): { look: P; zoom: number } => {
    if (typeof s.at !== "string") return s.at;
    const r = byId.get(s.at); if (!r) throw new Error(`world: stop at frame ${s.f} goes to "${s.at}", which is not a region (${[...byId.keys()].join(", ")})`);
    return { look: centreOf(r.rect), zoom: fitZoom(r.rect, W, H, s.pad) };
  };
  // each stop is an arrival key and, with a hold, a departure key: the camera travels between them
  const keys: CamKey[] = [];
  let last = -1;
  for (const s of spec.stops) {
    if (!Number.isInteger(s.f) || s.f <= last) throw new Error(`world: stops sit on whole, increasing frames (${last} then ${s.f}); a stop's hold must end before the next stop, and a move takes at least one frame (a jump between regions is the slide cut this scaffold exists to stop)`);
    const c = frame(s); keys.push({ f: s.f, ...c, ease: s.hold ? "linear" : s.ease ?? "inout" });
    if (s.hold) { if (!(Number.isInteger(s.hold) && s.hold > 0)) throw new Error(`world: hold at frame ${s.f} is a whole number of frames (got ${s.hold})`); keys.push({ f: s.f + s.hold, ...c, ease: s.ease ?? "inout" }); last = s.f + s.hold; } else last = s.f;
  }
  const camera = new Camera([W / 2, H / 2], keys);
  // handheld breathing: smooth gradient noise in screen px, the same at every zoom
  const breath = (f: number): P => {
    const a = spec.alive; if (!a || !(a.amp > 0)) return [0, 0];
    const q = a.freq ?? 0.02; return [a.amp * (fractal(a.seed, f * q, 0, 1, 1, 2) * 2 - 1), a.amp * (fractal(a.seed + 31, f * q, 0, 1, 1, 2) * 2 - 1)];
  };
  /** The camera at frame f, breathing included: look in world units, zoom in screen px per world unit. */
  const cam = (f: number): Cam => { const c = camera.at(f), [bx, by] = breath(f), k = heroScale(c); return { ...c, look: [c.look[0] - bx / k, c.look[1] - by / k] }; };
  /** Set the context to draw in world units at frame f (env.scale included). Pair with end(). */
  const begin = (ctx: Ctx, env: Env, f: number) => {
    const c = cam(f), k = heroScale(c);
    ctx.save(); ctx.setTransform(env.scale * k, 0, 0, env.scale * k, env.scale * (W / 2 - k * c.look[0]), env.scale * (H / 2 - k * c.look[1]));
  };
  const end = (ctx: Ctx) => ctx.restore();
  /** Draw a region: clipped to its rect unless it says clip: false. Call inside begin()/end(). */
  const region = (ctx: Ctx, id: string, draw: (r: Region) => void) => {
    const r = byId.get(id); if (!r) throw new Error(`world: no region "${id}"`);
    ctx.save(); if (r.clip !== false) { ctx.beginPath(); ctx.rect(...r.rect); ctx.clip(); } draw(r); ctx.restore();
  };
  /** A depth layer that travels at `speed` x the camera (0.33: a third as fast, far behind). Its own transform; do not nest in begin(). */
  const depth = (ctx: Ctx, env: Env, f: number, speed: number, draw: () => void) => {
    if (!(speed > 0)) throw new Error(`world.depth: speed is a share of the camera's, above 0 (got ${speed})`);
    const c = cam(f), k = heroScale(c);
    ctx.save(); ctx.setTransform(env.scale * k, 0, 0, env.scale * k, env.scale * (W / 2 - k * c.look[0] * speed), env.scale * (H / 2 - k * c.look[1] * speed)); draw(); ctx.restore();
  };
  /** Where a world point lands on screen at frame f (logical px). */
  const toScreen = (p: P, f: number): P => { const c = cam(f), k = heroScale(c); return [W / 2 + k * (p[0] - c.look[0]), H / 2 + k * (p[1] - c.look[1])]; };
  /** The region the camera frames at f (its centre nearest the look point), for captions and checks. */
  const regionAt = (f: number): Region | undefined => { const c = cam(f); let best: Region | undefined, d = Infinity; for (const r of regions) { const [x, y] = centreOf(r.rect), e = Math.hypot(x - c.look[0], y - c.look[1]); if (e < d) { d = e; best = r; } } return best; };
  /** The camera's moves between stops, [from, to] frames: the seams of the film, every one a move. */
  const moves = () => { const out: { from: number; to: number; into: string }[] = []; for (let i = 1; i < spec.stops.length; i++) { const p = spec.stops[i - 1], s = spec.stops[i]; out.push({ from: p.f + (p.hold ?? 0), to: s.f, into: typeof s.at === "string" ? s.at : "point" }); } return out; };
  return { camera, cam, begin, end, region, depth, toScreen, regionAt, moves, regions: byId };
};
