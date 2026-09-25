// THE REMOTION COMPONENT. The only React in the building that knows about the art core, and it
// knows exactly one thing: frame N goes on a canvas. `renderFrame(film, ctx, frame, env)` is the
// whole contract (canvas-core/film.ts), so Remotion is a HOST here, not a framework the art is
// written against. Nothing under src/canvas-core imports this file, or React, or remotion.
//
// Two details carry the determinism:
//
//   delayRender  Remotion screenshots the DOM when React has committed, which for us is too
//                early: a committed <canvas> is a blank one until the effect runs. The frame is
//                held open until the draw has finished, so what is captured is the drawing and
//                never the empty element.
//   useCurrentFrame  is the ONLY input. There is no rAF loop, no clock and no state carried
//                from the previous frame, which is what makes a Remotion render and a browser
//                render of frame N the same pixels.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Composition, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import type { Ctx, Env, Layer } from "../../../src/canvas-core/core";
import { Film, renderFrame, validate } from "../../../src/canvas-core/film";

// The host supplies offscreen surfaces; the core never makes one itself (core.ts, Env).
const surface = (w: number, h: number): Layer => {
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  return { canvas: c, ctx: c.getContext("2d") as unknown as Ctx } as Layer;
};

export const FilmCanvas: React.FC<{ film: Film; scale?: number }> = ({ film, scale = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const envRef = useRef<Env | null>(null);
  const [handle] = useState(() => delayRender(`film "${film.meta.title}" frame ${frame}`));
  const done = useCallback(() => continueRender(handle), [handle]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // One env per mounted component, so a Remotion render that walks frames in order gets the
    // same warm-cache path a browser does. Every cache key names its own inputs (surface.ts),
    // so warm and cold must agree; if they ever stop agreeing the gate says so.
    if (!envRef.current) {
      const problems = validate(film);
      if (problems.length) throw new Error("timeline: " + problems.join("; "));
      envRef.current = { W: film.meta.W, H: film.meta.H, scale, cache: new Map(), canvas: surface, image: () => undefined };
    }
    const ctx = canvas.getContext("2d") as Ctx;
    renderFrame(film, ctx, frame, envRef.current);
    ctx.getImageData(0, 0, 1, 1); /* force the deferred raster before the screenshot is taken */
    done();
  }, [frame, film, scale, done]);

  return <canvas ref={ref} width={Math.round(width * scale)} height={Math.round(height * scale)} style={{ width, height, display: "block" }} />;
};

// A whole Remotion root for one film: the composition's id IS the film's title, and its
// dimensions and length come from the film's own meta rather than being restated here.
//
// The film is CLOSED OVER, never passed as defaultProps. A Film carries functions (every shot's
// draw, and the score), and Remotion serializes props: handing it the film would ask it to JSON
// a function. The entry file is generated per film, so closing over one is free.
export const rootFor = (film: Film, scale = 1): React.FC => {
  const One: React.FC = () => <FilmCanvas film={film} scale={scale} />;
  return () => (
    <Composition
      id={film.meta.title}
      component={One}
      durationInFrames={film.meta.durationFrames}
      fps={film.meta.fps}
      width={film.meta.W}
      height={film.meta.H}
    />
  );
};

// registerRoot() is deliberately NOT called here. Remotion reads the ENTRY FILE looking for it,
// and an entry that hides the call behind a helper is an entry that fails to bundle.
