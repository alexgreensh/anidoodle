// THE CHARACTER CONTRACT. A character is ONE module: rig, drawn views, palette roles, canon,
// distinguishing features, and toScene(pose). Shots pose characters; they never redraw them.
// A Scene is what every hand (storybook, marker comic, riso ...) renders with its own marks.
import type { P } from "../core";
import type { Camera, V3 } from "./math3";

// A pose. Angles in DEGREES, named anatomically (see human/skeleton.ts for every joint and its
// range of motion). `hands` names a pose from the hand library or gives its joint angles.
export type HandPose = string | Record<string, number> | { angles: Record<string, [number, number, number, number]> }; // a library name, a blend {fist: 0.5, point: 0.5}, or raw angles
export type Pose = {
  root: V3;                                  // pelvis centre, world metres; y is height above the floor
  yaw: number; pitch?: number; roll?: number; // body orientation: yaw 0 faces the camera axis (+z), +yaw turns to her left
  joints: Record<string, number>;
  expression: Record<string, number>;
  hands?: { L?: HandPose; R?: HandPose };
  plant?: boolean;                           // drop the root so the lowest foot touches y = 0
  aux?: Record<string, number>;              // secondary motion a character defines for itself (a bag swinging on its strap)
};

export type Role = string;
export type Mark =
  | { kind: "line"; pts: P[]; role: Role; w: number; closed?: boolean; alpha?: number; tag?: string }
  | { kind: "fill"; pts: P[]; role: Role; alpha?: number; line?: number; tag?: string }
  | { kind: "dot"; at: P; rx: number; ry: number; rot: number; role: Role; alpha?: number };

export type Part = {
  id: string; role: Role; depth: number;
  polys: P[][];                              // union of convex-ish polygons, screen px
  size: number;                              // typical radius in px: mark weight is scaled from it
  seams?: { at: P; r: number; with: string }[];
  marks: Mark[];                             // drawn with the part, after its fill
  outline?: boolean; fill?: boolean;
  feature?: string;                          // a distinguishing feature this part carries
  over?: string[];                           // parts this one must paint over whatever the depth says (clothing over body)
  keepLine?: (p: P) => boolean;              // draw only these contour points (a nose draws its far edge, never a ring)
  clipTo?: string;                           // paint and ink only inside another part (a neckline is cut INTO the shirt)
};
export type Scene = { parts: Part[]; light: P; ground: { y: number; shadow: P[] } | null; px: number; meta: Record<string, string | number>; gesture?: P[][] }; // gesture: the construction curves the drawing layer was built on (a hand may lay them in first)

export type RoleSpec = { family: string; hue: [number, number]; note: string }; // hue range in degrees the role must stay in, in every hand
export type Feature = { id: string; parts: string[]; note: string; visible: (viewYaw: number) => boolean };
export type Character = {
  id: string; name: string; version: string; canonId: string; description: string;
  roles: Record<Role, RoleSpec>;
  features: Feature[];
  pose: (p: Pose) => Pose;                   // validates against joint limits; throws at load
  toScene: (p: Pose, cam: Camera, o?: { t?: number }) => Scene;
};
