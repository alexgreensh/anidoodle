// FRAME RULES. What framecheck judges on the text and boxes a film draws, as pure functions (records in,
// findings out, no browser) so every rule is unit-tested with a case that must fail.
// Records come from the frame probe (hosts/page.ts): { kind: "text"|"box", label, frame, x0, y0, x1, y1 }
// in device pixels, text also with { alpha, px, family, texture } and cut: false when wholly in frame.
// They exist because a brand launch film passed every check while its viewers said the text
// was too fast, its end card was a crowded corner and its CTA was 14 px tall. Each rule below names
// the note it answers.
import { readingNeed, readingTime, wordCount } from "./textrules.mjs";

export const RULES = {
  gapShare: 0.03,      // C4: two things closer than 3 % of the frame's short side read as touching ("circles way too close")
  maxBlocks: 7,        // C2: more than 7 separate text blocks on one frame is a wall of text (the ledger said 6; a
                       //     product-UI beat, header + bubbles + placeholder + button, is 7 and was never the complaint)
  clusterMin: 5,       // C2: 5 or more blocks ...
  clusterShare: 0.3,   //     ... packed into under 30 % of the frame is "an insane amount of text in a small spot"
  stackMin: 5,         // C1: 5 or more blocks centred on one axis is the centred stack the director rejected
  stackTol: 0.015,     //     centres within 1.5 % of the width count as one axis
  overlapShare: 0.2,   // T9: two text blocks sharing 20 % of the smaller one collide
  endPx: 28,           // T10: text in the last second smaller than 28 px at 1080 is unreadable on a phone
  endWindowS: 1,
  headSpread: 0.1,     // C5: people shown as one sequence differ in head height by at most 10 %
  persistS: 0.5,       // a layout finding counts when it holds this long (a passing move is not a layout)
  flashFrames: 3,      // a text replaced in place within 3 frames at 30 fps (0.1 s, scaled to the film's rate) is an animation step (a counter), not a read
};
const CURSOR = /[\s|▍▌▎█_]+$/u;

const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const area = (a) => Math.max(0, a.x1 - a.x0) * Math.max(0, a.y1 - a.y0);
const contains = (a, b, tol = 1) => b.x0 >= a.x0 - tol && b.y0 >= a.y0 - tol && b.x1 <= a.x1 + tol && b.y1 <= a.y1 + tol;
const centreIn = (r, b) => { const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2; return cx >= b.x0 && cx <= b.x1 && cy >= b.y0 && cy <= b.y1; };
const union = (list) => list.reduce((u, r) => ({ x0: Math.min(u.x0, r.x0), y0: Math.min(u.y0, r.y0), x1: Math.max(u.x1, r.x1), y1: Math.max(u.y1, r.y1) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
/** Edge-to-edge distance of two rectangles (0 when they touch or overlap). */
export const rectGap = (a, b) => { const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1), dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1); return Math.hypot(dx, dy); };
const lineH = (r) => (r.px > 0 ? r.px : Math.max(1, r.y1 - r.y0));

/**
 * The text blocks of ONE frame: lines of text (single glyphs, words or whole lines, however the film
 * drew them) joined into the blocks a viewer reads as one thing. A probeRect text box with real glyphs
 * inside it gives way to the glyphs (they show what is actually drawn); one with none (writeOn draws
 * strokes) stands for its words. -> [{ key, words, x0, y0, x1, y1, px, texture, family }]
 */
export const blocksOf = (recs) => {
  const fill = recs.filter((r) => r.kind === "text" && r.px !== undefined), probes = recs.filter((r) => r.kind === "text" && r.px === undefined);
  const T = [...fill, ...probes.filter((p) => !fill.some((f) => centreIn(f, p)))];
  const parent = T.map((_, i) => i), find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const sameLine = (a, b) => { const h = Math.min(lineH(a), lineH(b)), vo = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); return vo > 0.4 * Math.min(a.y1 - a.y0, b.y1 - b.y0) && Math.max(a.x0 - b.x1, b.x0 - a.x1) < 1.0 * h; };
  const stacked = (a, b) => { const h = Math.min(lineH(a), lineH(b)); return Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.max(a.y0 - b.y1, b.y0 - a.y1) < 0.75 * h; };
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) if (sameLine(T[i], T[j]) || stacked(T[i], T[j])) parent[find(i)] = find(j);
  const groups = new Map(); T.forEach((r, i) => { const k = find(i); (groups.get(k) ?? groups.set(k, []).get(k)).push(r); });
  return [...groups.values()].map((g) => {
    // lines: by vertical overlap, top to bottom; inside a line left to right, a space where the ink gap is a word gap
    const lines = []; for (const r of [...g].sort((a, b) => a.y0 - b.y0)) { const l = lines.find((L) => Math.min(L.y1, r.y1) - Math.max(L.y0, r.y0) > 0.4 * Math.min(L.y1 - L.y0, r.y1 - r.y0)); if (l) { l.rs.push(r); l.y0 = Math.min(l.y0, r.y0); l.y1 = Math.max(l.y1, r.y1); } else lines.push({ y0: r.y0, y1: r.y1, rs: [r] }); }
    lines.sort((a, b) => a.y0 - b.y0);
    const key = lines.map((L) => { const rs = L.rs.sort((a, b) => a.x0 - b.x0); let s = ""; rs.forEach((r, i) => { const lbl = String(r.label).trim(); if (i && (r.x0 - rs[i - 1].x1 > 0.18 * lineH(r) || r.label.startsWith(" ") || rs[i - 1].label.endsWith(" "))) s += " "; s += lbl; }); return s; }).join(" ").replace(CURSOR, "").trim();
    const fam = new Map(); for (const r of g) if (r.family) fam.set(r.family, (fam.get(r.family) ?? 0) + 1);
    return { key, words: wordCount(key), ...union(g), px: Math.max(...g.map(lineH)), texture: g.every((r) => r.texture), family: [...fam.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "" };
  });
};

/** Records grouped by frame, only what the viewer can see: in frame, not cut, alpha 0.1 and over. */
export const framesOf = (recs, frames) => {
  const m = new Map(frames.map((f) => [f, []]));
  for (const r of recs) if (r.cut === false && (r.alpha ?? 1) >= 0.1) m.get(r.frame)?.push(r);
  return m;
};

/**
 * READING TIME FROM WHAT IS DRAWN (T2). Every block of text the film shows becomes a cue, timed from the
 * first frame it is complete to the last frame it is up. Text still being typed or built (the next frame
 * shows a longer text containing it, in the same place) is not a cue yet: the read starts after the last
 * character, so a typed reply needs typing time PLUS reading time (T3). A text replaced in place within
 * RULES.flashFrames frames is an animation step (a count-up), not a read. What is left of a longer text as it
 * leaves (words sinking last-first) is an exit step, not a read. Texture text (texture()) is
 * words not meant to be read (S13). A cue cut off by the checked range is partial and not judged.
 * frames: the checked frame numbers, ascending. -> { cues, skipped: { typing, flash, partial }, texture, blocks }
 */
// what a sinking line leaves behind its clip, glyph by glyph: short letters drop out first, so "And"
// leaves "A d". True when each remnant piece is letters of one word of the longer text, in order, the
// pieces in the words' order ("A d" from "And it shows"); a new word that only shares letters ("dish")
// is not.
export const glyphsOf = (k, longer) => {
  if (longer.replace(/\s+/g, "").length <= k.replace(/\s+/g, "").length) return false; // fewer letters than were there
  const words = longer.split(/\s+/).filter(Boolean); let w = 0, c = 0;
  const inWord = (t, word, from) => { let i = from; for (const ch of t) { i = word.indexOf(ch, i); if (i < 0) return -1; i++; } return i; };
  for (const t of k.split(/\s+/).filter(Boolean)) {
    let at = -1; while (w < words.length && (at = inWord(t, words[w], c)) < 0) { w++; c = 0; }
    if (w >= words.length) return false; c = at;
  }
  return true;
};
export const autoCues = (byFrame, frames, { first = 0, last = Infinity, fps = 30 } = {}) => {
  const step = frames.length > 1 ? frames[1] - frames[0] : 1, B = new Map(frames.map((f) => [f, blocksOf(byFrame.get(f) ?? [])]));
  const cues = [], skipped = { typing: 0, flash: 0, partial: 0 }, open = new Map(); let texture = 0, blocks = 0;
  const close = (run, next) => {
    const nb = next === undefined ? [] : (B.get(next) ?? []).filter((b) => !b.texture), near = (b) => inter(b, run.box) > 0 || rectGap(b, run.box) < run.px;
    if (nb.some((b) => b.key.length > run.key.length && b.key.includes(run.key) && near(b))) { skipped.typing++; return; } // typed on, or joined by the next line of its block
    if (run.exiting) { skipped.exit = (skipped.exit ?? 0) + 1; return; }
    const span = run.last - run.first + step;
    // (flashFrames is 0.1 s at 30 fps: at 60 fps a counter's digit is up 6 frames, and was timed as a read)
    if (span <= RULES.flashFrames * Math.max(1, fps / 30) * step && nb.some((b) => b.key !== run.key && near(b))) { skipped.flash++; return; }
    if ((run.first === frames[0] && frames[0] > first) || (next === undefined && run.last === frames[frames.length - 1] && run.last + step < last)) { skipped.partial++; return; }
    cues.push({ from: run.first, to: run.last + step, text: run.key, box: run.box });
  };
  frames.forEach((f, i) => {
    const bs = B.get(f), seen = new Set();
    for (const b of bs) {
      blocks++; if (b.texture) { texture++; continue; } if (!b.key) continue;
      const k = b.key; if (seen.has(k)) continue; seen.add(k);
      const r = open.get(k);
      if (r && r.last === frames[i - 1]) { r.last = f; r.box = b; r.px = b.px; } else {
        if (r) close(r, frames[frames.indexOf(r.last) + 1]);
        // what is left of a longer text in the same place as it leaves (words sinking last-first) is an exit, not a new read
        const prev = i ? (B.get(frames[i - 1]) ?? []) : [], exiting = prev.some((p) => ((p.key.length > k.length && p.key.includes(k)) || glyphsOf(k, p.key)) && (inter(p, b) > 0 || rectGap(p, b) < b.px));
        open.set(k, { key: k, first: f, last: f, box: b, px: b.px, exiting });
      }
    }
    for (const [k, r] of open) if (!seen.has(k) && r.last === frames[i - 1]) { close(r, f); open.delete(k); }
  });
  for (const r of open.values()) close(r, undefined);
  // the same words gone for at most two checked frames and back (a sent message leaving the input for its
  // bubble, a cut between two framings of one card) are one read, not two
  cues.sort((a, b) => a.from - b.from);
  const joined = [];
  for (const c of cues) { const p = joined.findLast((q) => q.text === c.text); if (p && c.from - p.to <= 2 * step) p.to = Math.max(p.to, c.to); else joined.push({ ...c }); }
  // a text read once in full is not read again: when it comes back later (the chat's header in the next
  // shot, a placeholder after each send) a short return is not a reading fault
  const read = new Set(), out = [];
  for (const c of joined) { if (read.has(c.text)) { skipped.seen = (skipped.seen ?? 0) + 1; continue; } out.push(c); if (c.to - c.from >= Math.ceil(readingNeed(c.text) * fps - 1e-9)) read.add(c.text); }
  return { cues: out, skipped, texture, blocks };
};

/** The reading-time verdict on drawn text plus any declared captions. Never N/A while text is drawn. */
export const readingVerdict = (auto, captions, fps, framesChecked) => {
  const r = readingTime([...auto.cues, ...(Array.isArray(captions) ? captions : [])], fps);
  if (!framesChecked) return { ...r, status: "FAIL", reason: "no frame was checked: an empty run proves nothing" };
  if (r.status === "N/A") return auto.blocks ? { ...r, status: "FAIL", reason: `text was drawn (${auto.blocks} block(s)) but no cue could be timed: ${JSON.stringify(auto.skipped)}` } : { ...r, status: "NONE", reason: `no text was drawn on any of the ${framesChecked} frames checked` };
  return r;
};

/**
 * THE READING FLOOR (D2). The seconds the film cannot lose without cutting into reading time: the union
 * of every cue's [start, start + need]. Spare = how long text stays up beyond its need, summed: the only
 * place a cut for length may come from without making the text too fast.
 */
export const readingFloor = (cues, fps) => {
  const iv = cues.map((c) => [c.from, c.from + Math.ceil(readingNeed(c.text) * fps)]).sort((a, b) => a[0] - b[0]);
  let total = 0, end = -Infinity; for (const [a, b] of iv) { if (a > end) { total += b - a; end = b; } else if (b > end) { total += b - end; end = b; } }
  const spare = cues.reduce((s, c) => s + Math.max(0, c.to - c.from - Math.ceil(readingNeed(c.text) * fps)), 0);
  return { floorS: total / fps, spareS: spare / fps };
};

const exempt = (f, ranges) => (ranges ?? []).some(([a, b]) => f >= a && f < b);
/** Findings that hold at least RULES.persistS: [{ id, msg }] per frame -> [{ msg, from, to }] runs. */
const persist = (perFrame, frames, fps) => {
  const step = frames.length > 1 ? frames[1] - frames[0] : 1, need = Math.max(1, Math.round((RULES.persistS * fps) / step)), runs = new Map(), out = [];
  frames.forEach((f, i) => { for (const { id, msg } of perFrame.get(f) ?? []) { const r = runs.get(id); if (r && r.last === frames[i - 1]) { r.last = f; r.n++; } else { if (r && r.n >= need) out.push({ msg: r.msg, from: r.first, to: r.last + step }); runs.set(id, { msg, first: f, last: f, n: 1 }); } } });
  for (const r of runs.values()) if (r.n >= need) out.push({ msg: r.msg, from: r.first, to: r.last + step });
  // a run interrupted and resumed is reported once per stretch; collapse identical messages
  return out.sort((a, b) => a.from - b.from);
};

/**
 * LAYOUT (C1, C2, C4, T9). On every checked frame: too many text blocks, blocks packed into a corner, a
 * centred stack, two things nearly touching, text over the edge of a content box, text over text.
 * A finding counts when it holds RULES.persistS. meta.checks.layoutExempt [from, to, reason] ranges are
 * not judged (a deliberate wall of words, a gag that collides on purpose).
 * -> [{ rule, msg, from, to }]
 */
export const layoutFindings = (byFrame, frames, { W, H, fps, exemptRanges } = {}) => {
  const per = new Map();
  for (const f of frames) {
    if (exempt(f, exemptRanges)) continue;
    const recs = byFrame.get(f) ?? [], bl = blocksOf(recs).filter((b) => !b.texture && b.key), boxes = recs.filter((r) => r.kind === "box"), list = [];
    if (bl.length > RULES.maxBlocks) list.push({ id: "density", msg: `density: ${bl.length} text blocks on one frame (at most ${RULES.maxBlocks})` });
    if (bl.length >= RULES.clusterMin) { const u = union(bl), share = area(u) / (W * H); if (share < RULES.clusterShare) list.push({ id: "cluster", msg: `density: ${bl.length} text blocks packed into ${Math.round(share * 100)}% of the frame (spread them over at least ${RULES.clusterShare * 100}%)` }); }
    if (bl.length >= RULES.stackMin) { const cx = bl.map((b) => (b.x0 + b.x1) / 2).sort((a, b) => a - b), med = cx[cx.length >> 1], on = cx.filter((c) => Math.abs(c - med) <= RULES.stackTol * W).length; if (on >= RULES.stackMin) list.push({ id: "stack", msg: `centred stack: ${on} text blocks centred on one axis (compose an asymmetric grid: references/workflows/launch-video.md, end card)` }); }
    // collisions are judged on the lines themselves: two overlapping lines would otherwise merge into one block
    const lines = recs.filter((r) => r.kind === "text" && !r.texture && String(r.label).trim().length > 1);
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) { const a = lines[i], b = lines[j]; if (a.label !== b.label && inter(a, b) > RULES.overlapShare * Math.min(area(a), area(b))) list.push({ id: `tt:${a.label}|${b.label}`, msg: `text over text: "${String(a.label).slice(0, 32)}" and "${String(b.label).slice(0, 32)}" overlap` }); }
    const items = [...bl.map((b) => ({ ...b, label: b.key, isText: true })), ...boxes.map((b) => ({ ...b, isText: false }))], floor = RULES.gapShare * Math.min(W, H); // of the short side: on 9:16 the height is not what the eye measures a gap against
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]; if (a.label === b.label) continue;
      const ia = inter(a, b), q = (s) => `"${String(s).slice(0, 32)}"`;
      if (a.isText && b.isText) continue;
      if (ia > 0) { if (a.isText !== b.isText && !contains(a.isText ? b : a, a.isText ? a : b) && !contains(a.isText ? a : b, a.isText ? b : a)) list.push({ id: `edge:${a.label}|${b.label}`, msg: `text over an edge: ${q(a.isText ? a.label : b.label)} crosses the edge of ${q(a.isText ? b.label : a.label)}` }); continue; }
      const d = rectGap(a, b); if (d > 0 && d < floor) list.push({ id: `gap:${a.label}|${b.label}`, msg: `gap: ${q(a.label)} sits ${Math.round(d)} px from ${q(b.label)} (at least ${Math.round(floor)} px, ${RULES.gapShare * 100}% of the short side)` });
    }
    per.set(f, list);
  }
  return persist(per, frames, fps).map((x) => ({ rule: x.msg.split(":")[0], ...x }));
};

/** T10: text in the last second smaller than RULES.endPx at 1080. scale = device px per film px. */
export const endSizeFindings = (byFrame, frames, { W, H, fps, durationFrames, scale = 1 }) => {
  const from = durationFrames - Math.round(RULES.endWindowS * fps), small = new Map();
  for (const f of frames) if (f >= from) for (const b of blocksOf(byFrame.get(f) ?? [])) {
    if (b.texture || !b.key) continue; const at1080 = (b.px / scale) * (1080 / Math.min(W, H));
    if (at1080 < RULES.endPx) small.set(b.key, Math.min(small.get(b.key) ?? Infinity, at1080));
  }
  return [...small].map(([text, px]) => ({ text, px: Math.round(px), msg: `"${text.slice(0, 40)}" is ${Math.round(px)} px at 1080 in the last ${RULES.endWindowS} s (at least ${RULES.endPx}): grow it, or keep the card full size under the stinger` }));
};

export const END_CARD = "end card";
/** S9/C1: the end card lands once. Boxes labelled "end card" (endCard.ts probes it) seen in more than one run is card, something else, card. */
export const endCardRuns = (byFrame, frames) => {
  const runs = []; let on = false;
  for (const f of frames) { const vis = (byFrame.get(f) ?? []).some((r) => r.kind === "box" && r.label === END_CARD); if (vis && !on) runs.push([f, f]); if (vis) runs[runs.length - 1][1] = f; on = vis; }
  return { runs, ok: runs.length <= 1, msg: runs.length > 1 ? `the end card lands ${runs.length} times (${runs.map(([a, b]) => `${a}-${b}`).join(", ")}): one landing only, end on the card or on the stinger, never card-stinger-card` : "" };
};

/** C5: heads in one sequence match. Boxes labelled "head:<group>/<name>" (people.ts); each person's settled (largest) head height per group. */
export const headSpread = (byFrame, frames) => {
  const best = new Map();
  for (const f of frames) for (const r of byFrame.get(f) ?? []) { if (r.kind !== "box" || !String(r.label).startsWith("head:")) continue; const h = r.y1 - r.y0; if (h > (best.get(r.label) ?? 0)) best.set(r.label, h); }
  const groups = new Map(); for (const [label, h] of best) { const [g, name] = label.slice(5).split("/"); (groups.get(g) ?? groups.set(g, []).get(g)).push({ name: name ?? g, h: Math.round(h) }); }
  return [...groups].map(([group, people]) => { const hs = people.map((p) => p.h), spread = Math.min(...hs) > 0 ? (Math.max(...hs) - Math.min(...hs)) / Math.min(...hs) : 0; return { group, people, spread, ok: people.length < 2 || spread <= RULES.headSpread }; });
};

/** T8: which font families set the text, and the lines in a declared stand-in or outside the brand's faces. */
export const fontReport = (byFrame, frames, { fonts, standIns } = {}) => {
  const fam = new Map(); for (const f of frames) for (const r of byFrame.get(f) ?? []) if (r.kind === "text" && r.family && !r.texture) { const e = fam.get(r.family) ?? { family: r.family, lines: new Set() }; e.lines.add(r.label); fam.set(r.family, e); }
  const brand = new Set((fonts ?? []).map((s) => s.toLowerCase())), stand = Object.fromEntries(Object.entries(standIns ?? {}).map(([want, used]) => [String(used).toLowerCase(), want]));
  return [...fam.values()].map((e) => { const k = e.family.toLowerCase(), standFor = stand[k]; return { family: e.family, lines: e.lines.size, standFor, offBrand: brand.size > 0 && !brand.has(k) && !standFor }; });
};

/**
 * CUT BY THE EDGE, held (T7, M11). A line or box the frame's edge cuts through is a fault when it SITS
 * there: a sliced line left at the top edge for 196 frames, a name that overflows. Text sliding across
 * the edge while the camera travels in one world is a pan, not a fault. So a cut counts once the same
 * label is cut, unmoved (under half a pixel), on 3 checked frames in a row.
 * bad: the probe's cut records. -> [{ kind, label, frames, box, held }] with held = the longest still run.
 */
export const edgeCuts = (bad, frames, minHeld = 3) => {
  const idx = new Map(frames.map((f, i) => [f, i])), groups = new Map();
  for (const b of bad) { const k = `${b.kind}\u0000${b.label}`; (groups.get(k) ?? groups.set(k, []).get(k)).push(b); }
  const gap = (a, b) => Math.abs(a.x0 - b.x0) + Math.abs(a.y0 - b.y0) + Math.abs(a.x1 - b.x1) + Math.abs(a.y1 - b.y1);
  const out = [];
  for (const list of groups.values()) {
    // One label can be drawn more than once on a frame (two "Learn more" buttons, setType's fill per
    // character). Each record is followed as its own track: matched to the nearest record of the same
    // label on the checked frame before, nearest pairs first. Grouping by label alone compared the two
    // copies with each other, so a cut held for 6 frames read as never held.
    list.sort((a, b) => a.frame - b.frame);
    const byFrame = new Map(); for (const b of list) (byFrame.get(b.frame) ?? byFrame.set(b.frame, []).get(b.frame)).push(b);
    let live = [], prevIdx = null, held = 1, heldBox = list[0];
    for (const [f, recs] of byFrame) {
      const i = idx.get(f), cand = i !== undefined && prevIdx !== null && i === prevIdx + 1 ? live : [];
      const pairs = []; recs.forEach((r, ri) => cand.forEach((t, ti) => pairs.push([gap(r, t.last), ri, ti]))); pairs.sort((a, b) => a[0] - b[0]);
      const usedR = new Set(), usedT = new Set(), next = [];
      for (const [d, ri, ti] of pairs) {
        if (usedR.has(ri) || usedT.has(ti)) continue; usedR.add(ri); usedT.add(ti);
        const run = d < 0.5 ? cand[ti].run + 1 : 1; next.push({ last: recs[ri], run }); if (run > held) { held = run; heldBox = recs[ri]; }
      }
      recs.forEach((r, ri) => { if (!usedR.has(ri)) next.push({ last: r, run: 1 }); });
      live = next; prevIdx = i ?? null;
    }
    out.push({ kind: list[0].kind, label: list[0].label, frames: [...byFrame.keys()], box: [heldBox.x0, heldBox.y0, heldBox.x1, heldBox.y1], held, fail: held >= minHeld });
  }
  return out;
};

/**
 * THE FRAMES A CHECK LOOKS AT (framecheck, layerscan, ship): from `from` up to `to` (default: the whole film)
 * every `every` frames. A bad value is refused with the flag named, never quietly bent: --every abc used to
 * check frame 0 alone and print PASS, --every 0 looped until memory ran out, and a --from past the end
 * checked nothing and passed. Zero frames checked is refused too: an empty run proves nothing.
 */
export const checkedFrames = ({ every = 1, from = 0, to } = {}, N) => {
  const int = (v) => typeof v === "number" && Number.isInteger(v);
  if (!int(every) || every < 1) throw new Error(`--every wants a whole number of frames, 1 or more; got '${every}'`);
  if (!int(from) || from < 0 || from >= N) throw new Error(`--from wants a frame from 0 to ${N - 1}; got '${from}'`);
  const end = to === undefined ? N : to;
  if (!int(end) || end <= from) throw new Error(`--to wants a frame after --from (${from}); got '${to}'`);
  const out = []; for (let f = from; f < Math.min(end, N); f += every) out.push(f);
  return out;
};
