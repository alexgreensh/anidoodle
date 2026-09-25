import { Gfx, type Ctx, type Env, type Layer } from "./core";
import type { Film } from "./film";
import { INK, LITHO, PAPER, drum } from "./riso";
import { bluePlate, drawLighthouse, pinkPlate, yellowPlate } from "./lighthouse";

// LIGHTHOUSE AT SUNSET · the print being pulled, drum by drum.
//
// A risograph prints one ink per drum, and a two- or three-colour print is the SAME sheet fed
// through the machine again with the next drum loaded. So the process here is not drawing, it is
// three passes through the press. Frame 0 is the bare sheet (its stock tooth and the trim marks
// already on it). Then the yellow drum: the sheet feeds leading-edge first, and the ink lands at
// the nip, a straight front travelling down the sheet with the drum's shadow riding just ahead of
// it. A breath while the drum is swapped. Pink goes down over the dry yellow at its own
// registration offset, and every overprint is BORN at the nip line: the sky turns coral, the sun
// orange, the turf nothing yet. Swap. Blue last, the key plate: the dusk violet, the green of the
// turf, the shadow side of every form and the crayon key lines all arrive in one sweep. Each
// ink's swatch in the colour bar at the foot prints with its own drum. The last frame is
// `drawLighthouse` itself, so the finished piece is the lighthouse still, byte for byte.
//
// Motion grammar: the only moving thing is the nip line, constant speed like a real feed (short
// ease at the ends as the sheet is gripped and released); never a fade.

const N = 330;
// ---------------------------------------------------------------- the cue table (frames)
const CUE = { yellow: [0, 95], pink: [100, 195], blue: [200, 295], done: 295 } as const;   /* passes on the 5-frame event grid; a 5-frame breath while the drum is swapped */
const check = () => { const all = [...CUE.yellow, ...CUE.pink, ...CUE.blue, CUE.done]; if (all.some((f) => f % 5)) throw new Error("lighthouseDraw: cue off the beat grid"); if (CUE.done > N - 30) throw new Error("lighthouseDraw: hold shorter than 30 frames"); };
check();

const PLATES = [yellowPlate, pinkPlate, bluePlate], SWATCH = [INK.yellow, INK.pink, INK.blue];

// The sheet after k passes. Mirrors plateMarks exactly, except that a swatch prints only once its
// drum has run. The held finish is drawn by drawLighthouse itself on the main canvas, so the last
// frames are the lighthouse still byte for byte (state 3 is its offscreen twin for the blue pass).
const state = (env: Env, k: number): Layer => {
  const key = `lighthouseDraw:state:${k}:${env.W}x${env.H}@${env.scale}`; let L = env.cache.get(key) as Layer | undefined;
  if (L) return L;
  const W = env.W, H = env.H; L = env.canvas(Math.round(W * env.scale), Math.round(H * env.scale));
  const g = new Gfx(L.ctx, env, 0, LITHO), c = L.ctx;
  c.setTransform(env.scale, 0, 0, env.scale, 0, 0); c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
  for (let i = 0; i < k; i++) PLATES[i](g);
  g.group("plain", () => { const x = g.cur; x.strokeStyle = "#1b1b1b"; x.lineWidth = 1.1; [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26]].forEach(([px, py]) => { x.beginPath(); x.arc(px, py, 7, 0, Math.PI * 2); x.moveTo(px - 12, py); x.lineTo(px + 12, py); x.moveTo(px, py - 12); x.lineTo(px, py + 12); x.stroke(); }); }, { alpha: 0.9 });
  if (k > 0) drum(g, [0, 0], () => SWATCH.slice(0, k).forEach((col, i) => { const x = g.cur; x.fillStyle = col; x.fillRect(W / 2 - SWATCH.length * 16 + i * 32, H - 34, 28, 14); }));
  g.paper("paper", 0.26); g.paper("coldpress", 0.22);
  env.cache.set(key, L); return L;
};

// the nip line's position through one pass, 0..1 of the sheet; gripped and released gently
const feed = (u: number) => { const a = 0.08; if (u <= 0) return 0; if (u >= 1) return 1; const v = u < a ? (u * u) / (2 * a) : u > 1 - a ? 1 - ((1 - u) * (1 - u)) / (2 * a) : u - a / 2; return v / (1 - a / 2); };

const draw = (ctx: Ctx, f: number, env: Env) => {
  if (f >= CUE.done) return drawLighthouse(ctx, 0, env);   // the finished print: the still, exactly
  const passes = [CUE.yellow, CUE.pink, CUE.blue];
  let done = 0; while (done < 3 && f >= passes[done][1]) done++;
  const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(state(env, done).canvas, 0, 0);
  const p = passes[done]; if (!p || f < p[0]) return;       // between passes: the drum is being swapped
  const u = feed((f - p[0]) / (p[1] - p[0])), shade = 46 * env.scale, y = Math.round(u * DH);   /* the nip is on the sheet from the first frame of the pass to the last */
  if (y > 0) ctx.drawImage(state(env, done + 1).canvas, 0, 0, DW, y, 0, 0, DW, y);
  // the drum's shadow on the sheet, just ahead of the nip: the one sign of the machine
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const gr = ctx.createLinearGradient(0, y, 0, y + shade); gr.addColorStop(0, "rgba(40,30,40,0.2)"); gr.addColorStop(0.25, "rgba(40,30,40,0.09)"); gr.addColorStop(1, "rgba(40,30,40,0)");
  ctx.fillStyle = gr; ctx.fillRect(0, y, DW, shade); ctx.restore();
};

export const lighthouseDraw: Film = {
  meta: { title: "Lighthouse at sunset · the print, drum by drum", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "press", start: 0, end: N, draw }],
};

export const STYLE = { id: "lighthouseDraw", name: "Risograph, pulled drum by drum", family: "print", medium: "soy ink forced through a stencil master wrapped on a rotating drum, one drum per colour, the same sheet fed through once per ink", nearest: "lighthouse", hero: "lighthouse at sunset" };
