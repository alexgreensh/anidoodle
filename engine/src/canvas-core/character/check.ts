// CHARACTER GATE. The invariants a character must hold in every shot, as pure functions over
// its rig and its Scenes. tools/character-check.mjs runs them and prints a verdict; every check
// has a negative twin that must FAIL, so a green line is evidence, not a claim.
//
// What these checks can prove: proportions against a declared canon, joints inside their range,
// bone lengths constant, left/right symmetric, five digits in the right length order, balance,
// feet planted while planted, distinguishing features present per view, palette roles inside
// their hue families in every hand. What they CANNOT prove: that a hand LOOKS like a hand, that
// a face reads as the same person, that motion feels alive. That is the model sheet's job, and a
// human's (see references/anatomy.md: the look-at-it list).
import type { V3 } from "./math3";
import type { Pose, RoleSpec, Scene } from "./types";
import type { CanonRow } from "./human/canon";
import { type Rig, SIDES, boneLengths, dimsFromCanon, fk, limitViolations } from "./human/skeleton";
import { DIGITS, handModel, resolveHand, FINGERS } from "./human/hands";
import { balance } from "./human/balance";

export type Result = { id: string; ok: boolean; detail: string };
const R = (id: string, ok: boolean, detail: string): Result => ({ id, ok, detail });

// ---- proportions. Adult canon rules (Loomis) where the canon is realistic; Winter's segment
// ratios (fractions of height) for the body below the head in every canon, with a stylised
// canon measured against its BODY height (height minus the head it enlarged).
const WINTER = { upperArm: 0.186, forearm: 0.146, hand: 0.108, thigh: 0.245, shank: 0.246, foot: 0.152 };
export const canonChecks = (c: CanonRow, height: number, realHeads = c.heads): Result[] => {
  const d = dimsFromCanon(c, height), r = fk(d, { root: [0, d.root, 0], yaw: 0, joints: {}, expression: {} }), out: Result[] = [];
  const crown = r.joints.crown[1], floor = Math.min(r.joints.heelL[1], r.joints.heelR[1]) - d.ankleH * 0.1;
  const heads = (crown - floor) / d.hh;
  out.push(R("canon.heads", Math.abs(heads - c.heads) < 0.12, `${heads.toFixed(2)} heads measured from the rest skeleton, declared ${c.heads}`));
  // body height: what a real-canon figure of this age would be, minus the head the stylisation added
  const bodyH = height - (d.hh - height / realHeads);
  const seg: [string, number, number][] = [["upperArm", d.upperArm, WINTER.upperArm], ["forearm", d.forearm, WINTER.forearm], ["hand", d.hand, WINTER.hand], ["thigh", d.thigh, WINTER.thigh], ["shank", d.shin, WINTER.shank], ["foot", d.heel + d.toe, WINTER.foot]];
  seg.forEach(([n, len, w]) => { const got = len / bodyH; out.push(R(`canon.segment.${n}`, Math.abs(got / w - 1) < 0.16, `${(got * 100).toFixed(1)}% of body height, Winter ${(w * 100).toFixed(1)}% (${((got / w - 1) * 100).toFixed(0)}%)`)); });
  if (!c.stylised) {
    const crotch = r.joints.hipL[1] - 0.2 * d.hh; // the crotch sits about a fifth of a head under the hip joints
    out.push(R("canon.crotchAtHalf", Math.abs(crotch / height - 0.5) < 0.03, `crotch at ${((crotch / height) * 100).toFixed(1)}% of height (Loomis: 50%)`));
    const armDown = fk(d, { root: [0, d.root, 0], yaw: 0, joints: {}, expression: {} });
    out.push(R("canon.elbowAtWaist", Math.abs(armDown.joints.elbowL[1] - armDown.joints.lumbar[1]) < 0.35 * d.hh, `elbow ${((armDown.joints.elbowL[1] - armDown.joints.lumbar[1]) / d.hh).toFixed(2)} hh from the waist`));
    out.push(R("canon.wristAtCrotch", Math.abs(armDown.joints.wristL[1] - crotch) < 0.35 * d.hh, `wrist ${((armDown.joints.wristL[1] - crotch) / d.hh).toFixed(2)} hh from the crotch`));
    out.push(R("canon.handIsFace", Math.abs(d.hand / (0.78 * d.hh) - 1) < 0.12, `hand ${(d.hand / d.hh).toFixed(2)} hh vs face ~0.78 hh`));
    out.push(R("canon.footIsForearm", Math.abs((d.heel + d.toe) / d.forearm - 1) < 0.12, `foot ${((d.heel + d.toe) / d.hh).toFixed(2)} hh vs forearm ${(d.forearm / d.hh).toFixed(2)} hh`));
  }
  return out;
};

// ---- the rig under a set of poses
export const poseChecks = (name: string, c: CanonRow, height: number, poses: [string, Pose, { seated?: V3[]; dynamic?: boolean }?][], rigOf: (p: Pose) => Rig): Result[] => {
  const d = dimsFromCanon(c, height), rest = boneLengths(fk(d, { root: [0, 1, 0], yaw: 0, joints: {}, expression: {} })), out: Result[] = [];
  for (const [pn, p, o] of poses) {
    const v = limitViolations(p.joints);
    out.push(R(`${name}.${pn}.limits`, v.length === 0, v.length ? v.join("; ") : `${Object.keys(p.joints).length} joints inside their range`));
    const r = rigOf(p), bl = boneLengths(r), worst = Object.keys(rest).reduce((a, k) => Math.max(a, Math.abs(bl[k] - rest[k])), 0);
    out.push(R(`${name}.${pn}.boneLengths`, worst < 1e-6, `largest bone length change ${(worst * 1000).toFixed(4)} mm`));
    if (!o?.dynamic) { const b = balance(r, o?.seated ?? []); out.push(R(`${name}.${pn}.balance`, b.inside && b.margin > 0.002, `centre of mass ${b.inside ? "inside" : "OUTSIDE"} the support polygon${o?.seated ? " (seat included)" : ""}, margin ${(b.margin * 100).toFixed(1)} cm`)); }
    const low = Math.min(...SIDES.flatMap((s) => [r.joints["heel" + s][1], r.joints["toeTip" + s][1]]));
    out.push(R(`${name}.${pn}.floor`, low > -0.012, `lowest foot point ${(low * 1000).toFixed(1)} mm (below the floor is a foot through it)`));
  }
  // left/right symmetry of the rest skeleton
  const sym = ["upperArm", "forearm", "thigh", "shin", "hipWidth"].map((k) => Math.abs(rest[k + "L"] - rest[k + "R"]));
  out.push(R(`${name}.symmetry`, Math.max(...sym) < 1e-9, `largest left/right bone difference ${(Math.max(...sym) * 1000).toFixed(6)} mm`));
  return out;
};

// ---- hands: count, order, opposition
export const handChecks = (name: string, rig: Rig, Lh: number): Result[] => {
  const out: Result[] = [], hm = handModel(rig.hand.R, "R", Lh, resolveHand("relaxed"));
  out.push(R(`${name}.hand.digits`, hm.digits.length === 5 && DIGITS.every((d) => hm.digits.some((x) => x.digit === d)), `${hm.digits.length} digits: ${hm.digits.map((x) => x.digit).join(", ")}`));
  const L = (d: keyof typeof FINGERS) => FINGERS[d].len.reduce((a, b) => a + b, 0) + FINGERS[d].mcp[1] * -1;
  const order = L("middle") > L("ring") && L("ring") >= L("index") - 0.01 && L("index") > L("little");
  out.push(R(`${name}.hand.lengthOrder`, order, `reach from the wrist (Lh): middle ${L("middle").toFixed(3)}, ring ${L("ring").toFixed(3)}, index ${L("index").toFixed(3)}, little ${L("little").toFixed(3)}`));
  const arc = hm.mcpArc.map((p) => p), mid = arc[1], ends = [arc[0], arc[3]];
  const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), wrist = rig.joints.wristR;
  out.push(R(`${name}.hand.knuckleArc`, dist(mid, wrist) > dist(ends[0], wrist) && dist(ends[0], wrist) > dist(ends[1], wrist), `knuckle distance from the wrist: middle ${(dist(mid, wrist) / Lh).toFixed(3)} > index ${(dist(ends[0], wrist) / Lh).toFixed(3)} > little ${(dist(ends[1], wrist) / Lh).toFixed(3)}`));
  const pinch = handModel(rig.hand.R, "R", Lh, resolveHand("pinch")), th = pinch.digits[0].pts[3], ix = pinch.digits[1].pts[3], gap = dist(th, ix) / Lh;
  out.push(R(`${name}.hand.opposition`, gap < 0.16, `pinch: thumb tip to index tip ${(gap * 100).toFixed(1)}% of hand length`));
  return out;
};

// ---- identity across views and hands
export const featureChecks = (name: string, features: { id: string; parts: string[]; visible: (y: number) => boolean }[], views: [number, Scene][]): Result[] => {
  const out: Result[] = [];
  for (const [yaw, s] of views) {
    const ids = new Set(s.parts.filter((p) => p.polys.length || p.marks.length).map((p) => p.id));
    const missing = features.filter((f) => f.visible(yaw) && !f.parts.some((pid) => ids.has(pid))).map((f) => f.id);
    out.push(R(`${name}.features.yaw${yaw}`, missing.length === 0, missing.length ? `MISSING: ${missing.join(", ")}` : `all ${features.filter((f) => f.visible(yaw)).length} features expected at yaw ${yaw} are present`));
  }
  return out;
};
const hue = (hex: string) => { const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 1e-6) return 0; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };
const inHue = (h: number, [a, b]: [number, number]) => (a <= b ? h >= a && h <= b : h >= a || h <= b);
// the colour a riso recipe actually prints: the paper times each ink at its coverage
export const risoColour = (inks: [string, number][], drum: Record<string, string>, paper = "#f5efe2") => {
  const p = parseInt(paper.slice(1), 16); let c = [(p >> 16) & 255, (p >> 8) & 255, p & 255];
  inks.forEach(([n, t]) => { const k = parseInt(drum[n].slice(1), 16), ink = [(k >> 16) & 255, (k >> 8) & 255, k & 255]; c = c.map((v, i) => v * (1 - t * (1 - ink[i] / 255))); });
  return "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
};
export const paletteChecks = (name: string, roles: Record<string, RoleSpec>, hands: Record<string, Record<string, string>>): Result[] => {
  const out: Result[] = [];
  for (const [role, spec] of Object.entries(roles)) {
    const got = Object.entries(hands).map(([hand, m]) => { const c = m[role]; if (!c) return `${hand}: UNMAPPED`; const h = hue(c); return `${hand} ${c} ${Math.round(h)}deg${inHue(h, spec.hue) ? "" : " OUT"}`; });
    out.push(R(`${name}.palette.${role}`, got.every((s) => !s.includes("OUT") && !s.includes("UNMAPPED")), `${spec.family} [${spec.hue.join("-")}]: ${got.join(" | ")}`));
  }
  return out;
};
