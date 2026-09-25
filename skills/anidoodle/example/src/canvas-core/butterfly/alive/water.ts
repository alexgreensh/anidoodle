// THE WATER FRONT. A cyanotype is developed in water and its blue lifts when the sheet is wet,
// which is the only honest device that turns this drawing into a painting, and it is why a single
// drop is the whole bridge between the two movements of the film (spec section 0).
//
// The water does not spread as a circle. It lands on the lifted panel, runs down its projection
// lines onto the wing, and from there it follows the DRAWING by capillary, one spar per five
// frames, in an order the draftsman would never have chosen. Behind the front the Prussian ground
// is gone and there is paint; in front of it there is still a blueprint; and the front itself is
// a dark rim of the pigment it pushed along in front of it.
import { Gfx, P, jitter, oval, rng, tube } from "../../core";
import { Wing, cen, lerp } from "../geom";
import { BODY_WET, DROP, PANEL2_FLOOD, SPAR_WET } from "./cues";
import { Wetness, frontLine } from "./wingpaint";

const FRONT = "#1e4f7e", DROP_DARK = "#0f3558", HIGHLIGHT = "#fdfdfb";
const ramp = (f: number, at: number, len: number) => Math.max(0, Math.min(1, (f - at) / len));

// when a panel starts to flood: both its spars have to be running before it fills
export const panelAt = (i: number, j: number): number => (i === 3 && j === 2 ? PANEL2_FLOOD : Math.max(SPAR_WET[i][j], SPAR_WET[i][j + 1] ?? SPAR_WET[i][j]) + 5);
export const panelFrom = (i: number, j: number): number => ((SPAR_WET[i][j] ?? 0) <= (SPAR_WET[i][j + 1] ?? 1e9) ? j : j + 1); // the spar the water arrived on

export const wetnessAt = (f: number): Wetness => ({
  panel: (i, j) => ramp(f, panelAt(i, j), i === 3 && j === 2 ? 15 : 10),
  spar: (i, j) => ramp(f, SPAR_WET[i][j] ?? 1e9, 8),
  body: (part) => ramp(f, BODY_WET[part], 20),
  from: (i, j) => panelFrom(i, j) === j,
});

// The front itself, drawn after the paint: wherever a panel is half taken, a wet edge is crossing
// it, and a wet edge in watercolour is a dark line because the pigment piles up at the water's rim.
export const frontRim = (g: Gfx, T: (p: P) => P, sc: number, W: Wing[], f: number, wt: Wetness) => {
  W.forEach((wg, i) => wg.panels.forEach((pn, j) => {
    const u = wt.panel(i, j); if (u <= 0.02 || u >= 0.98) return;
    const p = pn.map((q) => lerp(q, cen(pn), 0.09)), line = frontLine(p, panelFrom(i, j) === j, u).map(T);
    /* a wet edge in watercolour is DARK, because the water carries the pigment to its own rim and
       leaves it there when it stops. That dark line is the only thing that says this is liquid. */
    g.fill(jitter(tube(line, sc * 0.03, sc * 0.02, false), sc * 0.012, 4100 + i * 9 + j), FRONT, 0.62);
    g.fill(jitter(tube(line.map((q) => [q[0] - sc * 0.035, q[1] + sc * 0.02] as P), sc * 0.05, sc * 0.03, false), sc * 0.02, 4150 + i * 9 + j), "#8fb1cb", 0.28); /* the damp sheen just behind it */
  }));
};

// The drop. A clear bead on a blue sheet: darker blue under it because it magnifies the ground,
// one paper-white highlight up and left of centre, and a crown of four droplets thrown off the
// impact that are gone again within a beat.
export const drop = (g: Gfx, at: P, r: number, f: number) => {
  const t = f - DROP; if (t < 0 || t > 55) return;
  const spread = Math.min(1, t / 30), R = r * (0.55 + spread * 0.75), fade = 1 - Math.max(0, (t - 34) / 21);
  g.wash(jitter(oval(at[0], at[1], R * 1.05, R * 0.92, 14), R * 0.08, 4300), DROP_DARK, { alpha: 0.42 * fade, seed: 4300, shrink: 0.97, rim: true, dx: 1, dy: 2 });
  if (t < 26) { /* while it is still a bead it has a lens in it */
    g.fill(oval(at[0] - R * 0.28, at[1] - R * 0.3, R * 0.2, R * 0.14, 9), HIGHLIGHT, 0.8 * (1 - t / 26));
    g.wash(oval(at[0] + R * 0.2, at[1] + R * 0.24, R * 0.5, R * 0.34, 10), "#5f8fb4", { alpha: 0.3, seed: 4310, shrink: 0.9, rim: false });
  }
  if (t <= 10) { const rr = rng(4320); for (let i = 0; i < 4; i++) { const a = rr() * Math.PI * 2, d = R * (0.9 + t * 0.14 + rr() * 0.4), s = R * 0.12 * (1 - t / 10); g.fill(oval(at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d * 0.7 - t * R * 0.04, s, s * 0.85, 7), "#bfd8e8", 0.75 * (1 - t / 10)); } } /* the crown */
};
