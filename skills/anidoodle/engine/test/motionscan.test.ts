// MOTION SCAN TESTS. tools/motionscan-core.mjs is pure, so every detector is held to synthetic frames
// here: a red fixture it must fail (the brand launch film fault it exists for) next to a green case it must
// pass (the fix).   node tools/test.mjs motionscan
// @ts-ignore: a plain ES module shared with the tools
import { TEMPERAMENT_MAX, layoutIoU, layoutOf, motionBetween, scanDissolves, scanExits, scanFaceCover, scanFastText, scanRepeats, scanSlideCuts, scanTarget, scanTemperament, scanTranslucent, speedProfile } from "../tools/motionscan-core.mjs";
import { TEMPERAMENTS, TYPE_EXIT_TRAVEL, typeExit } from "../src/canvas-core/motionKit";

export const name = "motionscan";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const W = 128, H = 72, FPS = 30;
  // value noise in 4 px cells: texture block matching can lock onto
  const noise = (seed: number, w: number, h: number) => { const o = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = (Math.floor(x / 4) * 73856093) ^ (Math.floor(y / 4) * 19349663) ^ (seed * 83492791); s ^= s << 13; s ^= s >>> 17; s ^= s << 5; o[y * w + x] = 30 + ((s >>> 0) % 200); } return o; };
  const crop = (src: Uint8Array, sw: number, ox: number) => { const o = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) o[y * W + x] = src[y * sw + x + ox]; return o; };
  const blend = (a: Uint8Array, b: Uint8Array, t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const card = (seed: number, x0: number, y0: number, x1: number, y1: number) => { const o = new Uint8Array(W * H).fill(40), n = noise(seed, W, H); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) o[y * W + x] = n[y * W + x]; return o; };
  const opts = { width: W, height: H, fps: FPS };

  // ---- motion between frames: the tool every scan stands on
  const world = noise(1, 600, H);
  const m = motionBetween(crop(world, 600, 10), crop(world, 600, 13), W, H);
  ok(m.matched > 0.9 && Math.abs(m.speed - 3) < 0.6, `a 3 px pan reads as motion: speed ${m.speed.toFixed(2)}, matched ${m.matched.toFixed(2)}`);
  const cut = motionBetween(noise(1, W, H), noise(2, W, H), W, H);
  ok(cut.matched < 0.3, `a hard cut finds nothing to match (matched ${cut.matched.toFixed(2)})`);

  // ---- slide cuts (M1)
  const deck = Array.from({ length: 100 }, (_, f) => noise(10 + Math.floor(f / 20), W, H)); // a new "slide" every 20 frames
  const sc = scanSlideCuts(deck, opts);
  ok(sc.fail && sc.events.length === 4, `RED: a deck that swaps the whole picture every 20 frames: ${sc.events.length} slide cuts, fails`);
  const pan = Array.from({ length: 100 }, (_, f) => crop(world, 600, 3 * f));
  const sp = scanSlideCuts(pan, opts);
  ok(!sp.fail && sp.events.length === 0, `GREEN: one world under a travelling camera has no slide cuts (${sp.events.length})`);
  ok(!scanSlideCuts(deck.slice(0, 50), opts).fail, "GREEN: two cuts in a short film is within 2 a minute");
  ok(!scanSlideCuts(deck, { ...opts, allow: [[0, 100]] }).fail, "declared cuts (allow) are not counted");
  const darkDeck = Array.from({ length: 100 }, (_, f) => card(40 + Math.floor(f / 20), (Math.floor(f / 20) % 2) * 60 + 4, 10, (Math.floor(f / 20) % 2) * 60 + 60, 40).map((v) => (v === 40 ? 17 : v)));
  ok(scanSlideCuts(darkDeck, opts).fail, "RED: slides on a dark ground (most pixels never change) are still slide cuts: content, not ground, is measured");

  // ---- dissolves (M3)
  const A = noise(3, W, H), B = noise(4, W, H);
  const fade = [...Array(10).fill(A), ...Array.from({ length: 12 }, (_, i) => blend(A, B, (i + 1) / 13)), ...Array(10).fill(B)];
  const dv = scanDissolves(fade, opts);
  ok(dv.fail && dv.findings[0]?.area === 1, `RED: a 12-frame cross-dissolve over the whole frame is found (${JSON.stringify(dv.findings[0])})`);
  ok(!scanDissolves(pan.slice(0, 40), opts).fail && scanDissolves(pan.slice(0, 40), opts).findings.length === 0, "GREEN: a camera move is motion, not a blend");
  ok(!scanDissolves([...Array(10).fill(A), ...Array(10).fill(B)], opts).findings.length, "GREEN: a hard cut is not a dissolve");
  ok(!scanDissolves(fade, { ...opts, allow: [[0, 40]] }).fail, "a declared dissolve (allow) is reported but does not fail");
  const elFade = [...Array(8).fill(card(5, 0, 0, 16, 9).fill(40)), ...Array.from({ length: 10 }, (_, i) => { const o = new Uint8Array(W * H).fill(40), c = noise(5, W, H); for (let y = 0; y < 9; y++) for (let x = 0; x < 16; x++) o[y * W + x] = Math.round(40 + (c[y * W + x] - 40) * ((i + 1) / 11)); return o; })];
  const ef = scanDissolves(elFade, opts);
  ok(ef.findings.length === 1 && !ef.fail, `a small element fading in is listed (area ${ef.findings[0]?.area}) but is not a dissolve seam`);
  const cardFade = [...Array(8).fill(new Uint8Array(W * H).fill(17)), ...Array.from({ length: 10 }, (_, i) => blend(new Uint8Array(W * H).fill(17), card(6, 8, 8, 60, 64), (i + 1) / 11)), ...Array(6).fill(card(6, 8, 8, 60, 64))];
  ok(scanDissolves(cardFade, opts).fail, "RED: a card faded in on a dark ground (the deck's entrance) fails: it is a fade, not a move");

  // ---- repeated layouts (M2)
  const hold = (f: Uint8Array, n = 20) => Array(n).fill(f) as Uint8Array[];
  const carousel = [0, 1, 2, 3].flatMap((i) => hold(card(20 + i, 8, 8, 60, 64)));
  const rp = scanRepeats(carousel, opts);
  ok(rp.fail && rp.runs[0]?.length === 4, `RED: four beats settle into the same card with new content: one run of ${rp.runs[0]?.length}`);
  const sides = [0, 1, 2, 3].flatMap((i) => hold(i % 2 ? card(20 + i, 68, 8, 120, 64) : card(20 + i, 8, 8, 60, 64)));
  ok(!scanRepeats(sides, opts).fail, "GREEN: alternate() sides (left, right, left, right) is not a carousel");
  const same = [0, 1, 2, 3].flatMap(() => hold(card(20, 8, 8, 60, 64)));
  ok(!scanRepeats(same, opts).fail, "GREEN: one beat held (no new content) is not a repeat");
  ok(layoutIoU(layoutOf(card(1, 8, 8, 60, 64), W, H), layoutOf(card(2, 8, 8, 60, 64), W, H)) > 0.9, "the layout map ignores what is inside a box, only where it is");

  // ---- temperament (M7)
  const prof = speedProfile(pan.slice(0, 6), { width: W, height: H, scale: 15 });
  ok(Math.abs(prof[3] - 45) < 10, `speed profile scales analysis px to the film's size (3 px at 1/15 size = ${prof[3].toFixed(1)} px)`);
  const tm = scanTemperament([0, 10, 90, 95, 99, 20, 0, 85, 0], { maxPx: 64 });
  ok(tm.fail && tm.stretches.length === 1 && tm.stretches[0].from === 2, "RED: three frames past the temperament's top speed fail; a one-frame peak does not");
  ok(!scanTemperament([0, 10, 40, 60, 20], { maxPx: 64 }).fail, "GREEN: a move under the temperament passes");
  ok(Object.entries(TEMPERAMENTS).every(([k, t]) => (TEMPERAMENT_MAX as Record<string, number>)[k] === t.maxSpeed) && Object.keys(TEMPERAMENT_MAX).length === Object.keys(TEMPERAMENTS).length, "the tool's temperament table equals motionKit's");

  // ---- text exits (T5): the ink a line shows as it sinks under its clip, from the geometry of rise()
  // glyph from baseline - 0.95 size (ascenders, dots) to + 0.2 size; the clip ends 0.3 size under the baseline
  const inkAt = (dy: number) => Math.max(0, Math.min(1.15, 0.3 + 0.95 - dy)) / 1.15;
  const series = (sink: (q: number) => number, frames = 18) => Array.from({ length: frames }, (_, i) => ({ frame: 100 + i, ink: Math.round(1000 * inkAt(sink(i / frames))) }));
  const oldRise = series((q) => 1.0 * (1 - Math.pow(1 - q, 3))), newRise = series((q) => typeExit(q));
  const ex = scanExits({ "old rise": [...Array.from({ length: 30 }, (_, i) => ({ frame: 70 + i, ink: 1000 })), ...oldRise] }, { fps: FPS });
  ok(ex.fail && ex.findings[0].frames >= 6, `RED: the brand launch exit (ease-out, 1.0x) leaves slivers for ${ex.findings[0]?.frames} frames (${ex.findings[0]?.seconds} s)`);
  const ok2 = scanExits({ "new rise": [...Array.from({ length: 30 }, (_, i) => ({ frame: 70 + i, ink: 1000 })), ...newRise] }, { fps: FPS });
  ok(!ok2.fail, `GREEN: typeExit (ease-in, ${TYPE_EXIT_TRAVEL}x) clears the clip with no lingering slivers`);
  ok(inkAt(typeExit(1)) === 0 && inkAt(1.0) > 0.2, "1.3x travel clears ascenders and dots; 1.0x leaves a fifth of the letters showing");
  ok(!scanExits({ cut: [{ frame: 1, ink: 900 }, { frame: 2, ink: 900 }, { frame: 3, ink: 0 }] }, { fps: FPS }).fail, "GREEN: a line that simply ends leaves nothing");

  // ---- fast text (M4)
  const lay = (frames: number, v: number) => Array.from({ length: frames }, (_, f) => ({ frame: f, recs: [{ kind: "text", src: "probe", label: "Nobody has a prompt for that.", x0: 100 + v * f, y0: 500, x1: 900 + v * f, y1: 560, alpha: 1, order: 0 }], translucent: [] }));
  const ft = scanFastText(lay(10, 120), { W: 1920, fps: FPS });
  ok(ft.fail && ft.cap === 80, `RED: type whipping out at 120 px a frame is past half the speed ceiling (${ft.cap} px)`);
  ok(!scanFastText(lay(10, 30), { W: 1920, fps: FPS }).fail, "GREEN: type leaving at 30 px a frame (0.5-0.7 s) passes");

  // M3: sampled every 2 frames, type whipping at 120 px a frame is still caught (the scan used to need consecutive frames)
  const every2 = lay(20, 120).filter((l) => l.frame % 2 === 0);
  ok(scanFastText(every2, { W: 1920, fps: FPS, step: 2 }).fail, "NEGATIVE M3: fast type is still found when the frames are sampled every 2 (step)");
  ok(!scanFastText(lay(20, 30).filter((l) => l.frame % 2 === 0), { W: 1920, fps: FPS, step: 2 }).fail, "M3 slow type sampled every 2 frames passes");

  // ---- faces covered by a moving shape (M12)
  const face = (moveShape: boolean, behind = false) => Array.from({ length: 6 }, (_, f) => ({ frame: f, translucent: [], recs: [
    { kind: "photo", src: "image", label: "priya", x0: 800, y0: 200, x1: 1100, y1: 700, alpha: 1, order: behind ? 1 : 0 },
    { kind: "box", src: "probe", label: "brand:frieze", x0: 700 + (moveShape ? 20 * f : 0), y0: 220, x1: 1000 + (moveShape ? 20 * f : 0), y1: 330, alpha: 1, order: behind ? 0 : 1 },
  ] }));
  ok(scanFaceCover(face(true)).fail, "RED: a frieze sliding across a speaker's face (whack-a-mole) is found");
  ok(!scanFaceCover(face(true, true)).fail, "GREEN: the same frieze moving BEHIND the photo passes");
  ok(!scanFaceCover(face(false)).fail, "GREEN: a shape that moves with the person (their stage) passes");

  // ---- translucent brand colour (M3, M10)
  const tr = [{ frame: 3, recs: [], translucent: [{ colour: "#ffde59", alpha: 0.5 }] }, { frame: 4, recs: [], translucent: [{ colour: "#ffde59", alpha: 0.4 }] }];
  ok(scanTranslucent(tr).fail && scanTranslucent(tr).findings[0].frames.length === 2, "RED: brand yellow filled at 40-50 % alpha is found on both frames");
  ok(!scanTranslucent(tr, { allow: [[0, 10]] }).fail, "GREEN: inside a declared fade it passes");
  // ---- L5: the file a scan reads
  ok(scanTarget("x.mov") === "x.mov" && scanTarget("cuts/x.M4V") === "cuts/x.M4V" && scanTarget("x.mp4") === "x.mp4", "NEGATIVE L5: a .mov or .m4v is scanned as given, never rewritten to out/x.mov.mp4");
  ok(scanTarget("brandLaunch") === "out/brandLaunch.mp4", "L5 a film name reads out/<film>.mp4");
};
