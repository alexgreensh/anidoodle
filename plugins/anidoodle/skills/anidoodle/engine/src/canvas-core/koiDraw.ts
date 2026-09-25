import type { Film } from "./film";
import { drawKoi } from "./koi";
import { cueClock, sequence } from "./koiDrawKit";

// KOI · the marker comic, drawn. The koi plate made the way a comic colourist makes it with
// alcohol markers and a brush pen on bleedproof marker paper:
//   1. a light lay-in in non-photo blue: the spine's gesture first, then the masses, then the parts;
//   2. flat cel fills, lightest first, each laid in parallel chisel-marker passes, back and forth,
//      starting and stopping past the pencil line (the contour will hide the overshoot); the pond
//      goes in LAST around the finished fish, broad and fast, the way you fill a background;
//   3. the hard shadow shapes, a darker marker over each flat on the side away from the light,
//      and the cast shadows on the pond floor;
//   4. the details: scale arcs, fin rays, water streaks, surface rings, gel-pen whites;
//   5. the heavy contour LAST, one confident brush-pen stroke per edge, fat away from the light.
// The marker is opaque here (the pencil vanishes under it), so each element is drawn in its own
// stacking order every frame and only its extent grows: a fin laid before the body still sits
// under it. From the hold on, the frame IS drawKoi with no clock: the plate, pixel for pixel.

const W = 1080, H = 1080, HOLD = 30, N = 540;
const F = (el: string, pass: string, n: number): [string, string, number] => [el, pass, n];
const plan = sequence(4, [
  F("fish", "pencil", 48), F("pads", "pencil", 14), F("lily", "pencil", 10), 5,
  F("body", "flat", 16), F("hi", "flat", 22), F("sumi", "flat", 8), F("eyes", "flat", 6),
  F("fin0", "flat", 7), F("fin1", "flat", 6), F("fin2", "flat", 5), F("fin3", "flat", 5), F("dorsal", "flat", 5), F("tail", "flat", 9),
  F("pad0", "flat", 9), F("pad1", "flat", 7), F("pad2", "flat", 6), F("lily", "flat", 14), F("water", "flat", 36), 3,
  F("floor", "shade", 10), F("fin0", "shade", 4), F("fin1", "shade", 4), F("fin2", "shade", 4), F("fin3", "shade", 4), F("body", "shade", 10), F("hi", "shade", 10),
  F("dorsal", "shade", 4), F("tail", "shade", 6), F("pad0", "shade", 5), F("pad1", "shade", 4), F("pad2", "shade", 4), F("lily", "shade", 9), 4,
  F("scales", "detail", 14), F("fin0", "detail", 4), F("fin1", "detail", 4), F("fin2", "detail", 4), F("fin3", "detail", 4), F("dorsal", "detail", 4), F("tail", "detail", 8),
  F("water", "detail", 6), F("ripples", "detail", 8), F("gloss", "detail", 6), F("eyes", "detail", 3), F("lily", "detail", 3),
  F("pad0", "detail", 3), F("pad1", "detail", 3), F("pad2", "detail", 2),
  F("body", "line", 22), F("fin0", "line", 8), F("fin1", "line", 7), F("fin2", "line", 5), F("fin3", "line", 5), F("tail", "line", 9), F("dorsal", "line", 6),
  F("head", "line", 12), F("pad0", "line", 9), F("pad1", "line", 7), F("pad2", "line", 6), F("lily", "line", 11),
]);
// the grid check: the drawing must finish exactly where the hold begins
if (plan.end !== N - HOLD) throw new Error(`koiDraw: process ends at ${plan.end}, the hold starts at ${N - HOLD}`);

export const STYLE = { id: "koiDraw", name: "Marker comic, drawn", family: "marker comic", medium: "alcohol markers and a brush pen over non-photo-blue pencil on bleedproof marker paper", nearest: "koi", hero: "a Sanke koi turning under lily pads" };

export const koiDraw: Film = {
  meta: { title: "Koi · marker comic, drawn", W, H, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "draw", start: 0, end: N, draw: (ctx, f, env) => (f >= N - HOLD ? drawKoi(ctx, 0, env) : drawKoi(ctx, 0, env, cueClock(plan.cues, f))) }],
};
