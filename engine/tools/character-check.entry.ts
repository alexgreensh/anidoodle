// Bundled and run by tools/character-check.mjs. Holds Mira and Theo to their invariants, then
// runs the NEGATIVE twins: a gate that has never been seen to fail proves nothing.
import { camera } from "../src/canvas-core/character/math3";
import type { Pose, Scene } from "../src/canvas-core/character/types";
import { CANON } from "../src/canvas-core/character/human/canon";
import { SIDES, limitViolations } from "../src/canvas-core/character/human/skeleton";
import { rigFor, checkPose } from "../src/canvas-core/character/human/figure";
import { canonChecks, featureChecks, handChecks, paletteChecks, poseChecks, risoColour, type Result } from "../src/canvas-core/character/check";
import { mira, MIRA_SPEC, MIRA_FEATURES, MIRA_ROLES } from "../src/canvas-core/characters/mira";
import { MIRA_MARKER, MIRA_RISO, MIRA_STORYBOOK } from "../src/canvas-core/characters/mira/palettes";
import * as MP from "../src/canvas-core/characters/mira/poses";
import { theo, THEO_SPEC } from "../src/canvas-core/characters/theo";
import * as TP from "../src/canvas-core/characters/theo/poses";
import { DRUM } from "../src/canvas-core/character/render/riso";
import { miraAt } from "../src/canvas-core/miraWalk";
import { apply } from "../src/canvas-core/character/math3";
import { HANDS } from "../src/canvas-core/miraTile";
import { handIdentity } from "../src/canvas-core/miraEveryHand";

export const run = () => {
  const out: { section: string; results: Result[] }[] = [], sec = (section: string, results: Result[]) => out.push({ section, results });
  // ---- proportions
  sec("MIRA canon (storybook child, declared stylisation of a 6.2-head nine-year-old)", canonChecks(CANON.storybookChild, MIRA_SPEC.height, 6.2));
  sec("THEO canon (adult, 7.5 heads)", canonChecks(CANON.adult, THEO_SPEC.height));
  // ---- poses: limits, bones, balance, floor
  const crateTop = (yaw: number) => [[-0.17, 0.3, -0.15], [0.17, 0.3, -0.15], [0.17, 0.3, 0.11], [-0.17, 0.3, 0.11]].map((v) => { const a = (yaw * Math.PI) / 180; return [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)] as [number, number, number]; });
  const stoolTop = (yaw: number) => [[-0.15, 0.5, -0.18], [0.15, 0.5, -0.18], [0.15, 0.5, 0.12], [-0.15, 0.5, 0.12]].map((v) => { const a = (yaw * Math.PI) / 180; return [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)] as [number, number, number]; });
  const plantM = (p: Pose) => rigFor(MIRA_SPEC, p), plantT = (p: Pose) => rigFor(THEO_SPEC, p);
  sec("MIRA poses", poseChecks("mira", CANON.storybookChild, MIRA_SPEC.height, [
    ["relaxed", MP.relaxed(0)], ["weightOnOneLeg", MP.strapStand(-25)], ["walkContact", MP.walkContact(70), { dynamic: true }], ["tiptoeReach", MP.reachUp(30)],
    ["sitOnCrate", MP.sitCrate(-40), { seated: crateTop(-40) }], ["crouch", MP.crouch(35)], ["wave", MP.wave(-15, 0.8)], ["gearToEye", MP.gearToEye(-50), { seated: crateTop(-50) }],
  ], plantM));
  sec("THEO poses", poseChecks("theo", CANON.adult, THEO_SPEC.height, [
    ["relaxed", TP.relaxed(0)], ["contrapposto", TP.contra(-30)], ["reachUp", TP.reachUp(-35)], ["sitOnStool", TP.sit(-40), { seated: stoolTop(-40) }], ["holdCup", TP.holdCup()], ["pointAtLens", TP.pointAtCamera([0.05, 1.46, 0.95])],
  ], plantT));
  // ---- hands
  sec("HANDS", [...handChecks("mira", plantM(MP.relaxed(0)), MP.MIRA_DIMS.hand), ...handChecks("theo", plantT(TP.relaxed(0)), TP.THEO_DIMS.hand)]);
  // ---- identity across views
  const cam = camera([0, 0.8, 8], [0, 0.65, 0], 3000, 500, 500), views: [number, Scene][] = [0, 20, 40, 60, 90, 120, 150, 180, -40, -90].map((y) => [y, mira.toScene(MP.relaxed(y), cam)]);
  sec("MIRA identity per view", featureChecks("mira", MIRA_FEATURES, views));
  // the same pose rendered in every hand is the SAME scene geometry: the hands only change marks
  const s1 = JSON.stringify(mira.toScene(MP.wave(-15, 0.8), cam).parts.map((p) => [p.id, p.polys])), s2 = JSON.stringify(mira.toScene(MP.wave(-15, 0.8), cam).parts.map((p) => [p.id, p.polys]));
  sec("MIRA determinism", [{ id: "mira.scene.deterministic", ok: s1 === s2, detail: `scene geometry for one pose, built twice: ${s1 === s2 ? "identical" : "DIFFERENT"} (${s1.length} chars)` }]);
  // ---- palette roles, per hand
  const drum = Object.fromEntries(Object.entries(DRUM).map(([k, v]) => [k, v.col]));
  const risoMap = Object.fromEntries(Object.entries(MIRA_RISO).map(([k, v]) => [k, risoColour(v.inks, drum)]));
  sec("MIRA palette roles in three hands", paletteChecks("mira", MIRA_ROLES, { storybook: Object.fromEntries(Object.entries(MIRA_STORYBOOK).map(([k, v]) => [k, v.base])), marker: Object.fromEntries(Object.entries(MIRA_MARKER).map(([k, v]) => [k, v.base])), riso: risoMap }));
  // ---- the walk
  const walk: Result[] = []; let bad = 0, maxSlide = 0, at = -1, below = 0; let prev: Record<string, [number, number, number]> | null = null;
  for (let f = 0; f < 240; f++) {
    const p = miraAt(f); bad += limitViolations(p.joints).length ? 1 : 0;
    const r = rigFor(MIRA_SPEC, p), d = r.dims, pts: Record<string, [number, number, number]> = {};
    SIDES.forEach((s) => { pts[s + "h"] = apply(r.foot[s], [0, -d.ankleH, -d.heel * 0.9]); pts[s + "b"] = apply(r.toes[s], [0, -d.ankleH * 0.15, 0]); });
    Object.values(pts).forEach((q) => { if (q[1] < -0.004) below++; });
    if (prev) for (const k of Object.keys(pts)) { const a = prev[k], b = pts[k]; if (a[1] < 0.004 && b[1] < 0.004) { const sl = Math.hypot(a[0] - b[0], a[2] - b[2]); if (sl > maxSlide) { maxSlide = sl; at = f; } } }
    prev = pts;
  }
  walk.push({ id: "walk.limits", ok: bad === 0, detail: `${bad} of 240 frames outside the range of motion` });
  walk.push({ id: "walk.plantedFeetStay", ok: maxSlide < 0.004, detail: `a planted heel or ball moves at most ${(maxSlide * 1000).toFixed(1)} mm in a frame (frame ${at}); < 4 mm passes` });
  walk.push({ id: "walk.noFootThroughFloor", ok: below === 0, detail: `${below} foot-point samples more than 4 mm under the floor` });
  sec("MIRA film: the walk, all 240 frames", walk);
  // ---- Mira in every hand: per hand, the features that survived and the palette roles
  const every: Result[] = [];
  for (const h of HANDS) {
    const idn = handIdentity(h.id);
    idn.feats.forEach((f) => every.push({ id: `every.${h.id}.${f.feature}`, ok: f.ok, detail: f.got }));
    const bad = idn.pal.filter((p) => !p.ok);
    every.push({ id: `every.${h.id}.palette`, ok: bad.length === 0, detail: bad.length ? bad.map((b) => b.detail).join(" / ") : `${idn.pal.length} roles inside their hue families` });
  }
  sec("MIRA IN EVERY HAND (one pose, one camera, nine hands)", every);
  // ---- NEGATIVE twins: each must throw or fail
  const neg: Result[] = [];
  const expectThrow = (id: string, fn: () => void) => { try { fn(); neg.push({ id, ok: false, detail: "did NOT throw: the gate is blind here" }); } catch (e) { neg.push({ id, ok: true, detail: `threw as it must: ${String((e as Error).message).split("\n")[1]?.trim() ?? (e as Error).message}` }); } };
  expectThrow("neg.elbow170", () => mira.pose({ ...MP.relaxed(0), joints: { elbowR: 170 } }));
  expectThrow("neg.kneeBackwards", () => theo.pose({ ...TP.relaxed(0), joints: { kneeL: -15 } }));
  expectThrow("neg.wristCone", () => checkPose({ ...MP.relaxed(0), joints: { wristFlexL: 70, wristDevL: 30 } }));
  expectThrow("neg.straightLegKick", () => checkPose({ ...TP.relaxed(0), joints: { hipFlexR: 110, kneeR: 0 } }));
  expectThrow("neg.fingerBentBack", () => checkPose({ ...MP.relaxed(0), hands: { R: { angles: { thumb: [10, 10, 10, 10], index: [0, -45, 0, 0], middle: [0, 0, 0, 0], ring: [0, 0, 0, 0], little: [0, 0, 0, 0] } } } }));
  expectThrow("neg.neckOwl", () => checkPose({ ...MP.relaxed(0), joints: { neckTwist: 60, headTurn: 30 } }));
  // a stiff figure tipped 20 degrees forward from the ankles, planted: only the toes touch, the mass is far out in front
  const toppling: Pose = { ...TP.relaxed(0), pitch: 20, plant: true };
  const bb = poseChecks("neg", CANON.adult, THEO_SPEC.height, [["toppling", toppling]], (p) => rigFor(THEO_SPEC, p)).find((r) => r.id.endsWith("balance"))!;
  neg.push({ id: "neg.fallingOver", ok: !bb.ok, detail: `a stiff figure tipped 20 deg forward must fail balance: ${bb.ok ? "PASSED (gate blind)" : "failed as it must: " + bb.detail}` });
  const badPal = paletteChecks("neg", { coat: MIRA_ROLES.coat }, { wrong: { coat: "#3a7bd5" } })[0];
  neg.push({ id: "neg.coatTurnedBlue", ok: !badPal.ok, detail: `a blue coat must fail the yellow role: ${badPal.ok ? "PASSED (gate blind)" : "failed as it must"}` });
  const noGlasses = featureChecks("neg", MIRA_FEATURES, [[0, { ...views[0][1], parts: views[0][1].parts.filter((p) => p.id !== "glasses") }]])[0];
  neg.push({ id: "neg.glassesMissing", ok: !noGlasses.ok, detail: `a front view without the glasses must fail identity: ${noGlasses.ok ? "PASSED (gate blind)" : noGlasses.detail}` });
  sec("NEGATIVE TWINS (each must be caught)", neg);
  return out;
};
