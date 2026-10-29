// SUBTITLES. A narrated film's words on screen, as short phrases that land on what is said.
// What the ghost film learned (lesson 36): a whole verse line in a lower band is too much to read;
// 2-6 word phrases, one at a time, each appearing as its first word is spoken, read fine. Pure: the
// timing comes in as data (tools/narrate.mjs writes voice-timing.json, `bake` puts it in the film).
//
//   phrases(timing, opts)                 each line split into short phrases, timed in frames
//   phrasePlan(timing, opts)              the same, plus the problems (TOO TIGHT, a forced bad break)
//   eventProblems(events, fps, opts)      the caption rules, checked on any events (red fixtures in the tests)
//   toCaptions(events, fps)               -> meta.captions (tools/captions.mjs writes .srt/.vtt from it); refuses bad events
//   drawSubtitles(ctx, env, frame, events, style)   burned in: one phrase, a high-contrast plate, inside the safe area
//   cue(timing, "line3:context")          the frame a word is spoken on, so a shot can land on it (cueEnd: its last frame)
import { probeRect, type Ctx, type Env } from "./core";

export type TimedWord = { w: string; say?: string; from: number; to: number; t0?: number; t1?: number; est?: boolean }; // frames; t0/t1 seconds inside the take
export type TimedLine = { id: string; text: string; display?: string; start: number; end: number; durationS?: number; hash?: string; words: TimedWord[] };
/** voice-timing.json: every line and word in frames of the film (tools/narrate.mjs time) */
export type VoiceTiming = { version: number; fps: number; totalFrames: number; lines: TimedLine[]; provider?: string; sampleRate?: number };
export type CaptionEvent = { from: number; to: number; text: string; line: string; words: TimedWord[] };
export type Shape = "16x9" | "9x16" | "1x1";
export type PhraseOpts = {
  shape?: Shape;
  maxChars?: number;   // per screen line; default 32 (16x9, 1x1) or 22 (9x16)
  minWords?: number;   // 2
  maxWords?: number;   // 6
  minHold?: number;    // frames; default 20 at 24 fps, scaled by fps
  maxHoldS?: number;   // 7
  gap?: number;        // frames between two phrases, 2
  lead?: number;       // frames a phrase appears before its first word, 2
  slip?: number;       // frames a phrase may start after its first word when the one before needs its reading time, default 0.25 s
  early?: number;      // frames a phrase may start before its first word to leave later phrases their reading time, default 0.5 s
  keep?: string[];     // extra names never split ("Total Recall", "Claude Code")
};

// the reading rule framecheck holds every cue to (tools/textrules.mjs: max(0.7 s, 0.3 s per word));
// kept equal here so a phrase this module makes can never fail it. A unit test pins the two together.
export const MIN_READ_S = 0.7, READ_S_PER_WORD = 0.3;
export const readingFrames = (text: string, fps: number) => Math.ceil(Math.max(MIN_READ_S, READ_S_PER_WORD * text.trim().split(/\s+/).filter(Boolean).length) * fps - 1e-9);

// ---------------------------------------------------------------- where a phrase may break
const ARTICLES = new Set(["a", "an", "the", "this", "these", "those", "my", "your", "his", "her", "its", "our", "their", "every", "each", "some", "no", "any"]);
const WEAK_END = new Set(["to", "of", "in", "on", "at", "for", "with", "from", "by", "and", "or", "but", "as", "into", "onto", "than", "very", "so", "is", "are", "was", "were"]);
const CLAUSE = new Set(["and", "but", "or", "so", "because", "which", "that", "when", "where", "while", "who", "if", "then", "until", "before", "after", "though", "although", "like", "with"]);
const UNITS = new Set(["%", "percent", "dollars", "dollar", "cents", "pounds", "euros", "ms", "s", "sec", "secs", "seconds", "second", "minutes", "minute", "min", "hours", "hour", "h", "days", "day", "weeks", "years", "frames", "frame", "fps", "px", "kb", "mb", "gb", "tb", "k", "m", "km", "kg", "g", "x", "times", "bpm", "hz", "khz", "db", "lufs", "am", "pm", "a.m.", "p.m.", "degrees", "points", "tokens", "words", "users", "people", "steps", "lines", "files"]);
const NUMWORD = /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|half|dozen)$/;
const bare = (w: string) => w.toLowerCase().replace(/^[^\w$£€%]+|[^\w%.]+$/g, "").replace(/\.$/, "");
const isNumber = (w: string) => /^[$£€]?\d/.test(bare(w)) || NUMWORD.test(bare(w));
const strongEnd = (w: string) => /[.!?;:]["'”’)\]]*$/.test(w);
const weakEnd = (w: string) => /[,—–]["'”’)\]]*$/.test(w) || /["”’)]$/.test(w);
const capital = (w: string) => /^["'“‘(]?[A-Z][a-z]/.test(w) || /^["'“‘(]?[A-Z]{2,}/.test(w);

/** Why the break between words a and b (a then b) is forbidden, or null when it is allowed. */
export const forbiddenBreak = (a: string, b: string, keep: string[] = []): string | null => {
  const A = bare(a), B = bare(b);
  if (strongEnd(a) || weakEnd(a)) return null; // punctuation always allows a break
  if (ARTICLES.has(A)) return `an article from its noun ("${a} | ${b}")`;
  if (isNumber(a) && (UNITS.has(B) || isNumber(b) || /^%/.test(b))) return `a number from its unit ("${a} | ${b}")`;
  if (/^[$£€]$/.test(A)) return `a currency sign from its amount ("${a} | ${b}")`;
  if (capital(a) && capital(b) && A !== "i" && B !== "i") return `a name ("${a} | ${b}")`;
  for (const k of keep) { const ws = k.split(/\s+/).map(bare); for (let i = 0; i < ws.length - 1; i++) if (ws[i] === A && ws[i + 1] === B) return `a kept name ("${k}")`; }
  return null;
};
// the cost of ending a phrase after word a (when b follows): punctuation is free, a clause word next is
// cheap, a dangling "and"/"to" is dear
const breakCost = (a: string, b: string) => strongEnd(a) ? 0 : weakEnd(a) ? 1 : (CLAUSE.has(bare(b)) ? 2 : 4) + (WEAK_END.has(bare(a)) ? 4 : 0);

/** Two screen lines at most, as even as the words allow, each within maxChars when it can be. */
export const wrapPhrase = (text: string, maxChars: number): string[] => {
  if (text.length <= maxChars) return [text];
  const ws = text.split(" ");
  let best: string[] = [text], bestCost = Infinity;
  for (let i = 1; i < ws.length; i++) {
    const a = ws.slice(0, i).join(" "), b = ws.slice(i).join(" "), over = Math.max(0, a.length - maxChars) + Math.max(0, b.length - maxChars), c = over * 100 + Math.abs(a.length - b.length);
    if (c < bestCost) { bestCost = c; best = [a, b]; }
  }
  return best;
};

const defaults = (fps: number, o: PhraseOpts) => ({
  maxChars: o.maxChars ?? (o.shape === "9x16" ? 22 : 32), minWords: o.minWords ?? 2, maxWords: o.maxWords ?? 6,
  minHold: o.minHold ?? Math.round((20 * fps) / 24), maxHold: Math.round((o.maxHoldS ?? 7) * fps), gap: o.gap ?? 2, lead: o.lead ?? 2,
  slip: o.slip ?? Math.round(0.25 * fps), early: o.early ?? Math.round(0.5 * fps), keep: o.keep ?? [],
});

// split one line's words into phrases by dynamic programming over the break points: every phrase within
// the word and character limits, no forbidden break, the cheapest set of breaks overall
const splitLine = (words: string[], d: ReturnType<typeof defaults>, problems: string[], lineId: string): number[][] => {
  const n = words.length;
  if (n <= d.minWords) return [words.map((_, i) => i)];
  const solve = (minW: number, allowForbidden: boolean) => {
    const best = new Array<number>(n + 1).fill(Infinity), from = new Array<number>(n + 1).fill(-1);
    best[0] = 0;
    for (let j = 1; j <= n; j++) for (let i = Math.max(0, j - d.maxWords); i <= j - 1; i++) {
      if (best[i] === Infinity) continue;
      const k = j - i, text = words.slice(i, j).join(" ");
      if (k < minW) continue;
      let c = best[i];
      // over one screen line it wraps to two: allowed, but dear (a single long word costs nothing: it cannot split)
      if (text.length > d.maxChars && k > 1) c += 40 + (text.length - d.maxChars) * 4;
      // a phrase that runs across a sentence end reads as two thoughts
      for (let q = i; q < j - 1; q++) if (strongEnd(words[q])) c += 6;
      // inside the phrase: no cost; at its end, the break's own cost (none at the line's end)
      if (j < n) { const why = forbiddenBreak(words[j - 1], words[j], d.keep); if (why) { if (!allowForbidden) continue; c += 100; } c += breakCost(words[j - 1], words[j]); }
      c += Math.pow(text.length - d.maxChars * 0.62, 2) / 120;
      if (c < best[j]) { best[j] = c; from[j] = i; }
    }
    if (best[n] === Infinity) return null;
    const out: number[][] = []; for (let j = n; j > 0; j = from[j]) out.unshift(Array.from({ length: j - from[j] }, (_, q) => from[j] + q));
    return out;
  };
  const sol = solve(d.minWords, false) ?? solve(1, false) ?? solve(1, true);
  if (!sol) return [words.map((_, i) => i)];
  for (let p = 0; p < sol.length - 1; p++) { const a = words[sol[p][sol[p].length - 1]], b = words[sol[p + 1][0]], why = forbiddenBreak(a, b, d.keep); if (why) problems.push(`${lineId}: forced to split ${why}: shorten the line or allow more words per phrase`); }
  return sol;
};

/**
 * Each line of the timing split into short phrases (2-6 words; punctuation first, then clause words, then
 * length; never a name, a number and its unit, or an article and its noun apart), each timed on the words
 * it holds: it appears `lead` frames before its first word and stays for its reading time (min hold, max
 * 7 s, 2-frame gap). A phrase whose reading time would push the next one more than `slip` frames off
 * its first word is TOO TIGHT: reported, never squeezed.
 */
export const phrasePlan = (timing: VoiceTiming, o: PhraseOpts = {}) => {
  const fps = timing.fps, d = defaults(fps, o), problems: string[] = [], events: CaptionEvent[] = [];
  const raw: { line: string; words: TimedWord[] }[] = [];
  for (const ln of timing.lines) {
    // a line with nothing to show (its display text was "") has no phrase to time: say which, then go on
    if (!ln.words?.length) { problems.push(`${ln.id}: no words to caption (is its display text empty?)`); continue; }
    for (const ix of splitLine(ln.words.map((w) => w.w), d, problems, ln.id)) raw.push({ line: ln.id, words: ix.map((i) => ln.words[i]) });
  }
  // Speech runs at about the reading rule's own pace (0.3 s a word), so phrases placed greedily drift
  // late. Two passes keep them on their words: backward, the latest each phrase may appear and still
  // leave every later phrase its reading time; forward, each appears at its ideal frame (lead before its
  // first word), earlier only when a later phrase needs the room, never more than `early` before it.
  const R = raw.map((r) => { const text = r.words.map((w) => w.w).join(" "); return { ...r, text, first: r.words[0].from, last: r.words[r.words.length - 1].to, need: Math.max(d.minHold, readingFrames(text, fps)) }; });
  const latest = new Array<number>(R.length);
  for (let k = R.length - 1; k >= 0; k--) latest[k] = Math.min(R[k].first + d.slip, k + 1 < R.length ? latest[k + 1] - d.gap - R[k].need : Infinity);
  const froms: number[] = [];
  for (let k = 0; k < R.length; k++) {
    const r = R[k], ideal = Math.max(0, r.first - d.lead), floor = k ? froms[k - 1] + R[k - 1].need + d.gap : 0;
    const from = Math.max(floor, Math.min(ideal, latest[k]));
    if (from > r.first + d.slip) problems.push(`TOO TIGHT: "${r.text}" (${r.line}) would appear ${from - r.first} frames after its first word is spoken (limit ${d.slip}): the phrases before it need their reading time. Give the line more time (pauseAfter), fewer words, or slow the voice`);
    else if (r.first - from > d.early) problems.push(`TOO TIGHT: "${r.text}" (${r.line}) would appear ${r.first - from} frames before its first word is spoken (limit ${d.early}) to leave the next phrases their reading time. Give the line more time (pauseAfter), fewer words, or slow the voice`);
    froms.push(from);
  }
  for (let k = 0; k < R.length; k++) {
    const r = R[k], from = froms[k], next = k + 1 < R.length ? froms[k + 1] : Infinity;
    let to = Math.min(Math.max(r.last + Math.round(0.25 * fps), from + r.need), next - d.gap);
    // a short hole before the next phrase is bridged, so the words don't blink off and on
    if (next - d.gap - to <= Math.round(0.5 * fps) && next - d.gap > to) to = next - d.gap;
    if (to - from > d.maxHold) { to = from + d.maxHold; if (to < r.last) problems.push(`"${r.text}" is spoken over more than ${d.maxHold / fps} s: split the line`); }
    events.push({ from, to: Math.max(to, from + 1), text: r.text, line: r.line, words: r.words });
  }
  return { events, problems: [...problems, ...eventProblems(events, fps, o)] };
};
/** The phrases of phrasePlan; throws on any problem, so a film can never ship a squeezed caption. */
export const phrases = (timing: VoiceTiming, o: PhraseOpts = {}): CaptionEvent[] => {
  const p = phrasePlan(timing, o);
  if (p.problems.length) throw new Error(`subtitles: ${p.problems.length} problem(s):\n  ${p.problems.join("\n  ")}`);
  return p.events;
};

/** The caption rules on any list of events (each a red fixture in test/subtitles.test.ts). */
export const eventProblems = (events: { from: number; to: number; text: string; line?: string }[], fps: number, o: PhraseOpts = {}) => {
  const d = defaults(fps, o), p: string[] = [];
  events.forEach((e, i) => {
    const hold = e.to - e.from, need = Math.max(d.minHold, readingFrames(e.text, fps));
    if (!Number.isInteger(e.from) || !Number.isInteger(e.to)) p.push(`"${e.text}": from/to must be whole frames`);
    if (hold < need) p.push(`"${e.text}" is up ${hold} frame(s); it needs ${need} (min hold ${d.minHold}, reading time ${readingFrames(e.text, fps)})`);
    if (hold > d.maxHold) p.push(`"${e.text}" is up ${(hold / fps).toFixed(1)} s, over ${d.maxHold / fps} s`);
    const lines = wrapPhrase(e.text, d.maxChars);
    if (lines.some((l) => l.length > d.maxChars) && e.text.includes(" ")) p.push(`"${e.text}" does not fit two lines of ${d.maxChars} characters`);
    const prev = events[i - 1];
    if (prev) {
      if (e.from < prev.to + d.gap) p.push(`"${e.text}" starts ${e.from - prev.to} frame(s) after "${prev.text}" ends (gap ${d.gap})`);
      if (prev.line === undefined || prev.line === e.line) { const a = prev.text.split(" ").pop()!, b = e.text.split(" ")[0], why = forbiddenBreak(a, b, d.keep); if (why) p.push(`split ${why} across two captions`); }
    }
  });
  return p;
};

/** Events -> meta.captions ({ from, to, text } in frames). Refuses events that break the rules (a 1-frame caption, an overlap). */
export const toCaptions = (events: { from: number; to: number; text: string; line?: string }[], fps: number, o: PhraseOpts = {}) => {
  const p = eventProblems(events, fps, o);
  if (p.length) throw new Error(`toCaptions: refused, ${p.length} problem(s):\n  ${p.join("\n  ")}`);
  return events.map(({ from, to, text }) => ({ from, to, text }));
};

// ---------------------------------------------------------------- cues: land a shot on a spoken word
const lineOf = (t: VoiceTiming, id: string) => { const l = t.lines.find((x) => x.id === id); if (!l) throw new Error(`cue: no line '${id}' (lines: ${t.lines.map((x) => x.id).join(", ")})`); return l; };
const findWord = (t: VoiceTiming, key: string) => {
  const [id, rest] = key.split(":"), l = lineOf(t, id);
  if (rest === undefined) return { l, w: null };
  const m = rest.match(/^(.*?)(?:#(\d+))?$/)!, want = bare(m[1]), nth = Number(m[2] ?? 1);
  const hits = l.words.filter((w) => bare(w.w) === want || bare(w.say ?? "") === want);
  if (hits.length < nth) throw new Error(`cue: '${key}': line ${id} says ${l.words.map((w) => w.w).join(" ")}`);
  return { l, w: hits[nth - 1] };
};
/** The frame a line starts ("line3") or a word starts ("line3:context", "line3:the#2" for the second "the"). */
export const cue = (t: VoiceTiming, key: string) => { const { l, w } = findWord(t, key); return w ? w.from : l.start; };
/** The frame after a line or word ends. */
export const cueEnd = (t: VoiceTiming, key: string) => { const { l, w } = findWord(t, key); return w ? w.to : l.end; };

// ---------------------------------------------------------------- burned in
export type SubtitleStyle = {
  /** where the phrase sits: centre x and centre y as shares of the frame, fixed or per frame (one home per shot, it moves only on a cut) */
  home?: [number, number] | ((frame: number) => [number, number]);
  size?: number;              // logical px of the type; default 5 % of the short side... see below
  font?: (px: number) => string;
  color?: string;             // the words: white, never grey
  accent?: string;            // the word being spoken, when highlight is on
  plate?: string;             // the plate behind the words
  highlight?: boolean;        // light the word being spoken
  maxChars?: number;          // wrap width in characters (default by shape, as phrases)
  margin?: number;            // safe margin, share of the frame (default 0.05)
};
const SANS = (px: number) => `700 ${px}px "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif`;
const isTall = (W: number, H: number) => Math.abs(W / H - 9 / 16) < 0.02;
// the phone app chrome a 9:16 frame keeps clear of (tools/textrules.mjs SAFE_ZONES): top 14 %, bottom 25 %, right 14 %
const ZONES = { top: 0.14, bottom: 0.25, right: 0.14 };
const sm = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** The phrase box for an event (logical px), already clamped into the safe area. Exported for tests and placement checks. */
export const subtitleBox = (ctx: Ctx, env: Env, e: CaptionEvent, frame: number, style: SubtitleStyle = {}) => {
  const { W, H } = env, tall = isTall(W, H), size = style.size ?? Math.round(tall ? W * 0.06 : H * 0.05), font = (style.font ?? SANS)(size);
  ctx.font = font;
  const lines = wrapPhrase(e.text, style.maxChars ?? (tall ? 22 : 32)), lh = size * 1.22, padX = size * 0.55, padY = size * 0.32;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2, h = lines.length * lh + padY * 2;
  const home = typeof style.home === "function" ? style.home(frame) : style.home ?? (tall ? [0.43, 0.68] : [0.5, 0.86]);
  const m = style.margin ?? 0.05, x0min = W * m, x1max = tall ? W * (1 - ZONES.right) - W * 0.01 : W * (1 - m), y0min = tall ? H * ZONES.top + H * 0.01 : H * m, y1max = tall ? H * (1 - ZONES.bottom) - H * 0.01 : H * (1 - m);
  const x = Math.min(Math.max(home[0] * W - w / 2, x0min), x1max - w), y = Math.min(Math.max(home[1] * H - h / 2, y0min), y1max - h);
  return { x, y, w, h, lines, size, lh, padX, padY, font };
};

/** The phrase on screen at this frame, burned in: a soft pop in, a fade out, one phrase at a time. */
export const drawSubtitles = (ctx: Ctx, env: Env, frame: number, events: CaptionEvent[], style: SubtitleStyle = {}) => {
  const e = [...events].reverse().find((x) => frame >= x.from && frame < x.to); // phrases never overlap; the newest wins if they do
  if (!e) return;
  const t = frame - e.from, alpha = sm((t + 1) / 3) * sm((e.to - frame) / 3);
  if (alpha <= 0.01) return;
  ctx.save(); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  const b = subtitleBox(ctx, env, e, frame, style), pop = t < 4 ? 0.94 + 0.06 * sm(t / 4) : 1;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  ctx.translate(cx, cy); ctx.scale(pop, pop); ctx.translate(-cx, -cy);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = style.plate ?? "rgba(10,10,14,0.82)";
  const r = b.size * 0.35; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, r); ctx.fill();
  probeRect(ctx, env, b.x, b.y, b.w, b.h, e.text, "text");
  ctx.font = b.font; ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.lineJoin = "round";
  // the spoken word lights only when the timing says which one it is: each screen word is matched to its timed word in order
  let wi = 0;
  b.lines.forEach((line, li) => {
    const lw = ctx.measureText(line).width, y = b.y + b.padY + b.lh * (li + 0.5);
    let x = b.x + (b.w - lw) / 2;
    for (const word of line.split(" ")) {
      const tw = e.words[wi++], on = style.highlight && tw && frame >= tw.from && frame < tw.to;
      ctx.lineWidth = b.size * 0.12; ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.strokeText(word, x, y);
      ctx.fillStyle = on ? style.accent ?? "#FFD84D" : style.color ?? "#FFFFFF"; ctx.fillText(word, x, y);
      x += ctx.measureText(word + " ").width;
    }
  });
  ctx.restore();
};
