// THE MEADOW, AS A WORLD. Positions are written as they appear on the LAST frame of the film,
// which makes the spec's table readable, and everything earlier is that world seen from closer
// in. A plane at depth z is magnified about the camera's look-at point by (Dend + z)/(D + z):
// near things swell fast as the camera comes in, the hills hardly move at all. One dolly, one
// number, and the parallax is true for every element at once.
import { P } from "../../core";

export const DEND = 1; // the dolly distance on the last frame; the hero plane is 1:1 there
export type Plane = { id: string; z: number };
export const PLANES: Plane[] = [
  { id: "fringe", z: -0.2 }, /* grass across the lens, huge and soft at the open */
  { id: "hero", z: 0 }, /* the flower it is on, and the blueprint sheet */
  { id: "hero2", z: 0.3 },
  { id: "p2", z: 1.0 }, { id: "p3", z: 2.2 }, { id: "p4", z: 3.5 },
  { id: "far", z: 8 }, /* the far field: colour, no plants */
  { id: "hills", z: 20 },
  { id: "sky", z: 1e6 }, /* no parallax at all */
];
export const zOf = (id: string) => PLANES.find((p) => p.id === id)?.z ?? 0;

export type Cam = { D: number; look: P };
export const scaleAt = (c: Cam, z: number) => (DEND + z) / (c.D + z);
export const project = (c: Cam, z: number, p: P): P => { const k = scaleAt(c, z); return [540 + (p[0] - c.look[0]) * k, 540 + (p[1] - c.look[1]) * k]; };
export const projector = (c: Cam, z: number) => { const k = scaleAt(c, z); return { k, at: (p: P): P => [540 + (p[0] - c.look[0]) * k, 540 + (p[1] - c.look[1]) * k] }; };

// ---------------------------------------------------------------- the paint box
export const SKY_TOP = "#a6c6e4", SKY_LOW = "#f4e7d0", SUN = "#f7dd9a", CLOUD_SHADE = "#c8c9dd";
export const HILL_FAR = "#aec2c4", HILL_NEAR = "#94ad9b", TREE = "#5f7e69";
export const FIELD_LIT = "#cbd485", FIELD_MID = "#a8bd6f", FIELD_COOL = "#7f9d78";
export const GRASS_LIT = "#ccd677", GRASS_MID = "#94b155", GRASS_SHADE = "#5e7f52", PATH = "#e9dfc2";
export const DAISY = "#fbf7ee", DAISY_SHADE = "#e8ddc4", POPPY = "#e2452b", POPPY_DARK = "#8d2a20";
export const CORNFLOWER = "#5b7fc7", COSMOS = "#ef9ab8", BUTTERCUP = "#f5c93f", STEM = "#8aa35f";
export const ROSE = "#e9a3ad", PEACH = "#f5b98a", BUTTER = "#f3d577", DENIM = "#6f93c4", INK_P = "#4a4a52";
export const PAPER_W = "#fbf7ee", SIG = "#5b5148";

// where the light is: upper right, so everything has a lit side and a shadow to its lower left
export const SUN_AT: P = [830, 150];
export const HORIZON = 410; // world y where hills meet sky on the last frame
