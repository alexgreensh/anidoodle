// MIRA, DRAWN. Her coat, sleeves, legs and wellies as DESIGNED masses: an authored cross-section
// table swept along the gesture curve through her joints. The rig only says where the curve goes;
// the shape is these numbers, placed by hand (head units: lateral, medial, front, back).
//
// Shape language: the raincoat is a trapezoid (narrow shoulders, straight sides, a hem that kicks
// out), the one big shape; sleeves are soft straight tubes with a cuff that bells; the legs are
// thin and straight in front with the calf swelling behind; the wellies are stiff cylinders,
// wider at the top, on a rounded toe. Big (coat), medium (boots, sleeves), small (hands, glasses).
import type { Camera, V3 } from "../../character/math3";
import { apply, mix3, mv, project } from "../../character/math3";
import { type Section, type Station, jointed, station, stationU, sweep } from "../../character/design";
import type { Part } from "../../character/types";
import { type Rig, type Side, SIDES, sgn } from "../../character/human/skeleton";

// ---- the coat: hem (0) to collar (1)
const COAT: Section[] = [
  [0.0, 0.66, 0.66, 0.5, 0.5], [0.18, 0.57, 0.57, 0.43, 0.43], [0.38, 0.5, 0.5, 0.37, 0.39], [0.5, 0.46, 0.46, 0.36, 0.36],
  [0.62, 0.47, 0.47, 0.36, 0.34], [0.84, 0.5, 0.5, 0.33, 0.3], [0.93, 0.5, 0.5, 0.29, 0.28], [0.97, 0.3, 0.3, 0.22, 0.22], [1.0, 0.19, 0.19, 0.17, 0.17],
];
// ---- a sleeve: shoulder (0) to wrist (1); the deltoid rounds the lateral side, the cuff bells
const SLEEVE: Section[] = [[0, 0.09, 0.08, 0.1, 0.1], [0.1, 0.17, 0.14, 0.17, 0.16], [0.25, 0.165, 0.15, 0.17, 0.16], [0.5, 0.14, 0.135, 0.145, 0.15], [0.8, 0.125, 0.12, 0.125, 0.125], [0.94, 0.14, 0.14, 0.14, 0.14], [1, 0.14, 0.14, 0.14, 0.14]];
// ---- a leg in tights: hip (0) to ankle (1): the knee notches, the calf swells high at the back, the shin runs straight
const LEG: Section[] = [[0, 0.22, 0.2, 0.22, 0.24], [0.28, 0.19, 0.17, 0.19, 0.2], [0.44, 0.14, 0.13, 0.155, 0.13], [0.5, 0.13, 0.125, 0.15, 0.12], [0.6, 0.14, 0.13, 0.12, 0.165], [0.72, 0.125, 0.12, 0.11, 0.14], [0.9, 0.095, 0.09, 0.09, 0.09], [1, 0.08, 0.08, 0.08, 0.08]];
// ---- a welly: shaft top (0) down to the ankle (1), then the foot from heel (0) to toe (1)
const SHAFT: Section[] = [[0, 0.165, 0.165, 0.165, 0.165], [0.15, 0.155, 0.155, 0.155, 0.155], [0.75, 0.12, 0.12, 0.12, 0.125], [1, 0.12, 0.12, 0.12, 0.12]];
const FOOT: Section[] = [[0, 0.085, 0.085, 0.085, 0.085], [0.35, 0.1, 0.1, 0.085, 0.085], [0.75, 0.105, 0.105, 0.065, 0.065], [1, 0.075, 0.075, 0.045, 0.045]];   // top and sole kept equal: along the foot "front" has no meaning

const part = (id: string, role: string, polys: ReturnType<typeof sweep>, cam: Camera, at: V3, bias: number, o: Partial<Part> = {}): Part => {
  const q = project(cam, at); return { id, role, depth: q.z + bias, polys, size: q.s * 0.12, marks: [], ...o };
};

export const drawnMira = (r: Rig, cam: Camera): Part[] => {
  const hh = r.dims.hh, out: Part[] = [];
  // the coat's gesture: from the hem (hung between the knees) up the spine to the collar
  const knees = mix3(r.joints.kneeL, r.joints.kneeR, 0.5), hips = mix3(r.joints.hipL, r.joints.hipR, 0.5), hem = mix3(hips, knees, 0.6);
  const coatSt: Station[] = [{ at: hem, frame: r.pelvis }, station(r.pelvis), station(r.lumbar), station(r.chest), station(r.chest, [0, 0.78 * hh, 0]), station(r.chest, [0, 0.9 * hh, -0.02 * hh])];
  out.push(part("coat", "coat", sweep(cam, coatSt, COAT, { hh, side: 1, n: 12, caps: [true, false] }), cam, r.joints.lumbar, 0, { over: ["legL", "legR"] }));
  for (const s of SIDES) {
    const k = sgn(s) as 1 | -1;
    // sleeve: shoulder, elbow, wrist; cut at the elbow so a bent arm folds, never self-crosses
    const sl: Station[] = [station(r.upper[s], [-k * 0.02 * hh, -0.04 * hh, 0]), station(r.fore[s]), station(r.hand[s], [0, 0.02 * hh, 0])];
    out.push(part("sleeve" + s, "coat", jointed(cam, sl, SLEEVE, { hh, side: k, n: 10, cuts: [stationU(sl, 1)] }), cam, r.joints["elbow" + s], -0.06 * hh, { seams: [{ at: pt(cam, r.joints["shoulder" + s]), r: 0.22 * hh * project(cam, r.joints["shoulder" + s]).s, with: "coat" }] }));
    // leg: hip, knee, ankle
    const lg: Station[] = [station(r.thigh[s]), station(r.shin[s]), station(r.foot[s])];
    out.push(part("leg" + s, "tights", jointed(cam, lg, LEG, { hh, side: k, n: 10, cuts: [stationU(lg, 1)] }), cam, r.joints["knee" + s], -0.02 * hh));
    // welly: the shaft from mid-shin to the ankle, and the foot from heel to toe, one part
    const sh: Station[] = [station(r.shin[s], [0, -0.52 * r.dims.shin, 0]), station(r.foot[s], [0, 0.02 * hh, 0])];
    const ft: Station[] = [station(r.foot[s], [0, -0.13 * hh, -0.1 * hh]), station(r.foot[s], [0, -0.14 * hh, 0.14 * hh]), station(r.toes[s], [0, -0.02 * hh, 0.1 * hh])];
    out.push(part("boot" + s, "boots", [...sweep(cam, sh, SHAFT, { hh, side: k, n: 8, caps: [true, false] }), ...sweep(cam, ft, FOOT, { hh, side: k, n: 8 })], cam, apply(r.foot[s], [0, 0, 0.05 * hh]), -0.025 * hh, { over: ["leg" + s], feature: "wellies" }));
  }
  return out;
};
const pt = (cam: Camera, v: V3): [number, number] => { const q = project(cam, v); return [q.x, q.y]; };
export { mv };
