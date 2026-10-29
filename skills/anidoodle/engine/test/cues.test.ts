// CUE SHEET TESTS. Events declared once in the film, in explicit units, carried through the film's own
// time maps; the hand-mirrored timing that drifted in a brand launch film is reproduced and caught.
//   node tools/test.mjs cues
import { cueSheet, cueFrame, withCues, diffCues, diffSheets, invertRemap, sheetCues, type CueDef } from "../src/canvas-core/cues";
import { timeRemap } from "../src/canvas-core/timeRemap";
import type { Film } from "../src/canvas-core/film";

export const name = "cue sheet (sound and sync cued from the film's own maps)";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const throws = (fn: () => unknown, re: RegExp, label: string) => { try { fn(); ok(false, `${label} (did not throw)`); } catch (e) { ok(re.test((e as Error).message), `${label}: ${(e as Error).message.slice(0, 90)}`); } };
  const fps = 60, meta = { fps, durationFrames: 100 * fps };
  // a brand launch film's master pace map (a hand-kept timing script): fast cold open, then 0.8x (25 % longer) from frame 303
  const master = timeRemap([{ f: 87, speed: 1.2, ramp: 12 }, { f: 303, speed: 0.8, ramp: 12 }]);
  // a slow-motion fall inside it (the dots), applied first
  const slow = timeRemap([{ f: 687, speed: 0.3, ramp: 16 }, { f: 729, speed: 1, ramp: 24 }]);

  ok(cueFrame({ frame: 120 }, fps) === 120 && cueFrame({ film: 2 }, fps) === 120, "frames and film seconds are taken as given");
  ok(cueFrame({ scene: 2 }, fps) === 120, "a scene time with no maps is film time");
  throws(() => cueFrame(4.4 as never, fps), /no units/, "RED (M14 class): a bare number has no units and is refused");
  throws(() => cueFrame({ seconds: 4.4 } as never, fps), /no units/, "an unknown unit is refused");

  // the inverse of a map is exact: the frame found shows the scene time asked for
  const f = invertRemap(master, 40 * fps);
  ok(Math.abs(master.at(f) - 40 * fps) < 1e-4, `invertRemap: film frame ${f.toFixed(3)} shows scene frame ${master.at(f).toFixed(4)}`);

  // RED FIXTURE (A8): the hand-kept timing script re-implemented the map by hand and left a section at 1:1 after the slowdown
  const defs: CueDef[] = [{ name: "x-lock", at: { scene: 40, through: [master] }, sound: "tap:impact", sync: true }, { name: "fall", at: { scene: 11.94, through: [slow, master] } }, { name: "card", at: { film: 90 } }];
  const sheet = cueSheet(meta, defs), xl = sheet.find((c) => c.name === "x-lock")!;
  const handMirror = [{ ...xl, frame: 40 * fps }, ...sheet.filter((c) => c.name !== "x-lock")]; // scene seconds copied as if they were film seconds
  ok(xl.frame > 40 * fps + 400, `the slowed film shows the x-lock at frame ${xl.frame}, not 2400: ${((xl.frame - 2400) / fps).toFixed(1)} s later than a hand copy in scene seconds`);
  const d = diffCues(handMirror, sheet);
  ok(d.length === 1 && /moved "x-lock"/.test(d[0]), `RED (A8): the hand-mirrored sheet is caught as out of date: ${d[0]}`);
  ok(diffCues(sheet, cueSheet(meta, defs)).length === 0, "the same film gives the same sheet (deterministic)");
  // M9: a changed sound, a dropped sync mark or a changed frame rate makes the old mix out of date too
  const reSound = sheet.map((c) => (c.name === "x-lock" ? { ...c, sound: "tap:thump" } : c));
  ok(diffCues(sheet, reSound).some((x) => /x-lock.*sound/.test(x)), `RED (M9): a cue whose sound changed from tap:impact to tap:thump is caught: ${diffCues(sheet, reSound)[0]}`);
  const unSync = sheet.map((c) => (c.name === "x-lock" ? { ...c, sync: undefined } : c));
  ok(diffCues(sheet, unSync).some((x) => /x-lock.*sync/.test(x)), "RED (M9): a cue that lost its sync mark is caught");
  const was = { fps: 60, durationFrames: meta.durationFrames, cues: sheet }, nowFps = { fps: 30, durationFrames: meta.durationFrames, cues: sheet };
  ok(diffSheets(was, nowFps).some((x) => /fps/.test(x)), "RED (M9): a sheet written at 60 fps is out of date for the film at 30 fps");
  ok(diffSheets(was, { ...was }).length === 0, "GREEN (M9): the same sheet has no differences");
  ok(diffSheets({ ...was, durationFrames: 10 }, was).some((x) => /frames/.test(x)), "a changed length is still caught");
  // nested maps: innermost first
  const fall = sheet.find((c) => c.name === "fall")!, byHand = Math.ceil(invertRemap(master, invertRemap(slow, 11.94 * fps)) - 1e-6);
  ok(fall.frame === byHand && fall.frame !== Math.ceil(invertRemap(slow, invertRemap(master, 11.94 * fps)) - 1e-6), `maps apply innermost first (frame ${fall.frame})`);
  ok(sheet.map((c) => c.frame).every((v, i, a) => i === 0 || a[i - 1] <= v) && Math.abs(xl.t - xl.frame / fps) < 1 / fps, "sorted by frame, each with its exact time");

  throws(() => cueSheet(meta, [{ name: "a", at: { film: 1 } }, { name: "a", at: { film: 2 } }]), /declared twice/, "duplicate names are refused");
  throws(() => cueSheet(meta, [{ name: "late", at: { film: 120 } }]), /outside the film/, "a cue past the end is refused");
  throws(() => cueSheet(meta, [{ name: "", at: { film: 1 } }]), /needs a name/, "a cue needs a name");

  // withCues: the sheet rides on the film, and sync cues become verify-export markers
  const film = { meta: { title: "t", W: 16, H: 9, fps, bpm: 120, durationFrames: meta.durationFrames, sync: [{ frame: 6, label: "old" }] }, assets: { images: {} }, shots: [] } as unknown as Film;
  const cued = withCues(film, defs);
  ok(cued.cues.length === 3 && cued.meta.sync!.length === 2 && cued.meta.sync![1].label === "x-lock" && film.meta.sync!.length === 1, "withCues adds the sheet and the sync markers without touching the original film");

  // RED (cues.mjs crash): a launch template film carries its SOUND cues as film.cues ({ frame, kind,
  // variant, label }, no name, no t). cues.mjs wrote them raw, then crashed printing c.t.toFixed, and
  // --check keyed every cue by an undefined name, so all of them collapsed into one and nothing moved.
  const launchCues = [{ frame: 4, kind: "tick", variant: "key", label: 'key "m"' }, { frame: 9, kind: "tick", variant: "key", label: 'key "m"' }, { frame: 30, kind: "press", variant: "thock", label: "Match all", sync: undefined }, { frame: 31, kind: "pop" }];
  const s = sheetCues(launchCues, 60);
  ok(s.length === 4 && s.every((c) => typeof c.t === "number" && typeof c.name === "string" && c.name.length > 0), "every exported cue has a name and a time in seconds");
  ok(new Set(s.map((c) => c.name)).size === 4, `names are unique, a repeated label numbered in frame order: ${s.map((c) => c.name).join(" | ")}`);
  ok(Math.abs(s[2].t - 0.5) < 1e-9 && s[2].sound === "press:thock" && s[3].name.startsWith("pop"), "t is frame / fps, the sound is kind:variant, a cue with no label is named by its kind");
  const moved = sheetCues(launchCues.map((c, i) => (i === 2 ? { ...c, frame: 40 } : c)), 60);
  ok(diffCues(s, moved).some((x) => /moved "Match all"/.test(x)), "RED: a launch sound cue that moved is caught by --check (it was invisible under one undefined name)");
  ok(sheetCues(sheet, fps).every((c, i) => c.name === sheet[i].name && c.t === sheet[i].t), "a withCues sheet passes through unchanged");
};
