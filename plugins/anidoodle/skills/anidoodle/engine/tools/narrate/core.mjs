// NARRATE CORE. The pure half of tools/narrate.mjs: no ffmpeg, no files, no network, so every rule
// here is unit-tested (test/narrate.test.ts) on hand-made words and synthetic samples.
//   normalise    text -> the words a listener hears: lower case, no punctuation, numbers, money,
//                percents, times and ordinals spelled out, so "$13.60" and "thirteen dollars sixty"
//                compare equal and a script is never judged on how an ASR chose to print a number
//   alignWords   Levenshtein on words with a backtrace: which script word was heard, changed, dropped
//   wer          word error rate, (substitutions + deletions + insertions) / script words
//   mapTimings   ASR word times laid back onto the SCRIPT's words (never the ASR's text: lesson 51)
//   placeLines   line takes laid end to end on the film's frame grid -> voice-timing.json
//   checks       alignment sanity and audio sanity, each returning named problems

// ---------------------------------------------------------------- numbers to words
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = [[1e12, "trillion"], [1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
const under1000 = (n) => {
  const out = [];
  if (n >= 100) { out.push(ONES[Math.floor(n / 100)], "hundred"); n %= 100; }
  if (n >= 20) { out.push(TENS[Math.floor(n / 10)]); n %= 10; if (n) out.push(ONES[n]); }
  else if (n > 0 || !out.length) out.push(ONES[n]);
  return out;
};
/** A whole number as spoken words ("1984" stays a cardinal here; yearWords reads it as a year). */
export const cardinalWords = (n) => {
  if (!Number.isSafeInteger(n) || n < 0) return String(n).split("");
  if (n === 0) return ["zero"];
  const out = [];
  for (const [v, w] of SCALES) if (n >= v) { out.push(...under1000(Math.floor(n / v)), w); n %= v; }
  if (n) out.push(...under1000(n));
  return out;
};
// a bare four-digit number in running speech is usually a year: 1984 "nineteen eighty four", 2026
// "twenty twenty six", but 2005 "two thousand five" and 1900 "nineteen hundred"
export const yearWords = (n) => {
  if (n >= 2000 && n <= 2009) return cardinalWords(n);
  const hi = Math.floor(n / 100), lo = n % 100;
  return [...cardinalWords(hi), ...(lo === 0 ? ["hundred"] : lo < 10 ? ["oh", ONES[lo]] : cardinalWords(lo))];
};
const ORD = { one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth" };
const ordinalOf = (w) => ORD[w] ?? (w.endsWith("y") ? w.slice(0, -1) + "ieth" : w + "th");
const ordinalWords = (n) => { const c = cardinalWords(n); c[c.length - 1] = ordinalOf(c[c.length - 1]); return c; };
const digitsWords = (s) => [...s].map((d) => ONES[+d]);
const NUMBER_WORDS = new Set([...ONES, ...TENS.filter(Boolean), "hundred", "thousand", "million", "billion", "trillion", "point", "oh"]);
export const isNumberWord = (w) => NUMBER_WORDS.has(w) || /^\d/.test(w);

// one raw token (no spaces) -> the words it is heard as
const CURRENCY = { $: ["dollar", "dollars"], "£": ["pound", "pounds"], "€": ["euro", "euros"] };
const numberish = (core) => {
  // money: $13.60 -> thirteen dollars sixty; $5 -> five dollars; €1.5m is left to the digits path
  const money = core.match(/^([$£€])(\d[\d,]*)(?:\.(\d{1,2}))?$/);
  if (money) {
    const [, sym, whole, cents] = money, n = +whole.replace(/,/g, ""), [one, many] = CURRENCY[sym];
    const out = [...cardinalWords(n), n === 1 ? one : many];
    if (cents && +cents) out.push(...cardinalWords(+(cents.length === 1 ? cents + "0" : cents)));
    return out;
  }
  const pct = core.match(/^(\d[\d,]*(?:\.\d+)?)%$/);
  if (pct) return [...numberish(pct[1]), "percent"];
  const ord = core.match(/^(\d+)(st|nd|rd|th)$/i);
  if (ord) return ordinalWords(+ord[1]);
  const clock = core.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) return [...cardinalWords(+clock[1]), ...(+clock[2] === 0 ? [] : +clock[2] < 10 ? ["oh", ONES[+clock[2]]] : cardinalWords(+clock[2]))];
  const dec = core.match(/^(\d[\d,]*)\.(\d+)$/);
  if (dec) return [...cardinalWords(+dec[1].replace(/,/g, "")), "point", ...digitsWords(dec[2])];
  if (/^\d{1,3}(,\d{3})+$/.test(core)) return cardinalWords(+core.replace(/,/g, ""));
  if (/^\d{4}$/.test(core) && +core >= 1100 && +core <= 2099) return yearWords(+core);
  if (/^\d+$/.test(core)) return core.length > 15 ? digitsWords(core) : cardinalWords(+core);
  // digits glued to letters: 2AM -> two am, 3D -> three d, 24fps -> twenty four fps
  const glued = core.match(/^(\d+)([a-z]+)$/i);
  if (glued) return [...numberish(glued[1]), glued[2].toLowerCase()];
  return null;
};

/** One raw token (a word as written, with its punctuation) -> the words a listener hears. */
export const tokenWords = (raw) => {
  let t = String(raw).trim();
  if (!t) return [];
  t = t.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, " ");
  if (/\s/.test(t)) return t.split(/\s+/).flatMap(tokenWords);
  // strip the punctuation around the word, keep what lives inside it ($, %, :, ., ')
  const core = t.replace(/^[^\w$£€]+/, "").replace(/[^\w%]+$/, "");
  if (!core) return t === "&" ? ["and"] : t === "+" ? ["plus"] : t === "@" ? ["at"] : [];
  const n = numberish(core);
  if (n) return n;
  if (core === "&") return ["and"];
  // dotted abbreviations collapse: a.m. -> am, U.S. -> us
  if (/^([a-z]\.)+[a-z]?$/i.test(core + (t.endsWith(".") ? "." : ""))) return [core.replace(/\./g, "").toLowerCase()];
  // hyphens and slashes join words that are each spoken
  if (/[-/]/.test(core)) return core.split(/[-/]+/).flatMap(tokenWords);
  return [core.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]/g, "")].filter(Boolean);
};

/** Raw tokens of a line, split on whitespace, each with the words it is heard as. */
export const tokenize = (text) => String(text ?? "").replace(/[–—]/g, " ").split(/\s+/).filter(Boolean).map((raw) => ({ raw, words: tokenWords(raw) }));

// "and" inside a number and "cents" after one are said by some voices and printed by no ASR
// (thirteen dollars AND sixty CENTS): they are dropped from both sides before any comparison
const softNumberGlue = (flat) => flat.filter((x, i) => {
  // only after a scale word or a currency ("two hundred and five", "dollars and sixty"): "2026 and 1984" keeps its and
  if (x.w === "and") return !(i > 0 && i < flat.length - 1 && /^(hundred|thousand|million|billion|trillion|dollars?|pounds?|euros?)$/.test(flat[i - 1].w) && isNumberWord(flat[i + 1].w));
  if (x.w === "cents" || x.w === "cent") return !(i > 0 && isNumberWord(flat[i - 1].w));
  return true;
});
/** Tokens -> the flat list of heard words, each remembering the token it came from. */
export const flatten = (tokens) => softNumberGlue(tokens.flatMap((t, ti) => t.words.map((w) => ({ w, ti }))));
/** Plain text -> normalised words (what WER is computed on). */
export const normalise = (text) => flatten(tokenize(text)).map((x) => x.w);

// ---------------------------------------------------------------- alignment and WER
/**
 * Levenshtein on words with a backtrace. ref and hyp are arrays of words; eq(a, b) decides a match
 * (aliases: a name the ASR always spells its own way). Returns ops in order:
 *   { op: "ok" | "sub" | "del" | "ins", r: refIndex | -1, h: hypIndex | -1 }
 * Ties prefer a match, then a substitution, so a changed word reads as "changed", not drop + insert.
 */
export const alignWords = (ref, hyp, eq = (a, b) => a === b) => {
  const n = ref.length, m = hyp.length, D = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 0; i <= n; i++) D[i][0] = i;
  for (let j = 0; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j - 1] + (eq(ref[i - 1], hyp[j - 1]) ? 0 : 1), D[i - 1][j] + 1, D[i][j - 1] + 1);
  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && eq(ref[i - 1], hyp[j - 1]) && D[i][j] === D[i - 1][j - 1]) { ops.push({ op: "ok", r: i - 1, h: j - 1 }); i--; j--; }
    else if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + 1) { ops.push({ op: "sub", r: i - 1, h: j - 1 }); i--; j--; }
    else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.push({ op: "del", r: i - 1, h: -1 }); i--; }
    else { ops.push({ op: "ins", r: -1, h: j - 1 }); j--; }
  }
  return ops.reverse();
};
/** Word error rate of hyp against ref (both arrays of normalised words). */
export const wer = (ref, hyp, eq) => {
  const ops = alignWords(ref, hyp, eq), c = { sub: 0, del: 0, ins: 0, ok: 0 };
  for (const o of ops) c[o.op]++;
  return { wer: ref.length ? (c.sub + c.del + c.ins) / ref.length : hyp.length ? 1 : 0, ...c, n: ref.length, ops };
};
/** aliases: { "clawd": ["claude", "clod"] } -> an eq() that also accepts those spellings. */
export const aliasEq = (aliases = {}) => {
  const map = new Map();
  for (const [k, vs] of Object.entries(aliases)) for (const kw of normalise(k)) map.set(kw, new Set([kw, ...[].concat(vs).flatMap(normalise)]));
  return (a, b) => a === b || (map.get(a)?.has(b) ?? false);
};

// ---------------------------------------------------------------- ASR words back onto the script
/**
 * whisper.cpp JSON (-ml 1 -sow -ojf): one segment per word. -> [{ text, t0, t1 }] in seconds, the
 * [_BEG_]-style empty segments dropped.
 */
export const whisperWords = (json) => (json?.transcription ?? [])
  .map((s) => ({ text: String(s.text ?? "").trim(), t0: (s.offsets?.from ?? 0) / 1000, t1: (s.offsets?.to ?? 0) / 1000 }))
  .filter((w) => w.text && !/^\[.*\]$/.test(w.text) && tokenWords(w.text).length);

/**
 * Lay ASR word times onto the script's own tokens. asr: [{ text, t0, t1 }]. The ASR text is used ONLY
 * to find where each script word was said; the words the film shows always come from the script.
 * Returns { tokens: [{ raw, words, t0, t1, status, heard }], inserted: [heard words], ops } where status is
 *   "ok"       every heard word of the token matched
 *   "changed"  the token was said, but as something else (heard shows what)
 *   "dropped"  nothing in the take lines up with it: its time is ESTIMATED between its neighbours
 */
export const mapTimings = (scriptText, asr, { aliases } = {}) => {
  const tokens = tokenize(scriptText), ref = flatten(tokens);
  // each ASR word spreads its time over the words it normalises to (by letters: "thirteen" outlasts "a")
  const hyp = asr.flatMap((a) => {
    const ws = tokenWords(a.text), total = ws.reduce((s, w) => s + w.length + 1, 0);
    let at = a.t0;
    return ws.map((w) => { const d = ((a.t1 - a.t0) * (w.length + 1)) / total, o = { w, t0: at, t1: at + d }; at += d; return o; });
  });
  const ops = alignWords(ref.map((x) => x.w), hyp.map((x) => x.w), aliasEq(aliases));
  const per = tokens.map((t) => ({ ...t, t0: NaN, t1: NaN, status: t.words.length ? "ok" : "silent", heard: [] }));
  const inserted = [];
  for (const o of ops) {
    if (o.op === "ins") { inserted.push(hyp[o.h].w); continue; }
    const tk = per[ref[o.r].ti];
    if (o.op === "del") { tk.status = "dropped"; continue; }
    if (o.op === "sub" && tk.status !== "dropped") tk.status = "changed";
    tk.heard.push(hyp[o.h].w);
    tk.t0 = Number.isNaN(tk.t0) ? hyp[o.h].t0 : Math.min(tk.t0, hyp[o.h].t0);
    tk.t1 = Number.isNaN(tk.t1) ? hyp[o.h].t1 : Math.max(tk.t1, hyp[o.h].t1);
  }
  // a token partly dropped (one of its words missing) is "dropped" if nothing was heard, else "changed"
  for (const tk of per) if (tk.status === "dropped" && tk.heard.length) tk.status = "changed";
  estimateGaps(per);
  return { tokens: per, inserted, ops };
};
// dropped tokens (and punctuation-only ones) get a time between their timed neighbours, marked est
const estimateGaps = (per) => {
  for (let i = 0; i < per.length; i++) {
    if (!Number.isNaN(per[i].t0)) continue;
    let j = i; while (j < per.length && Number.isNaN(per[j].t0)) j++;
    const a = i > 0 ? per[i - 1].t1 : (per[j]?.t0 ?? 0), b = j < per.length ? per[j].t0 : a, k = j - i;
    for (let q = 0; q < k; q++) { per[i + q].t0 = a + ((b - a) * q) / k; per[i + q].t1 = a + ((b - a) * (q + 1)) / k; per[i + q].est = true; }
    i = j - 1;
  }
};

/**
 * Display tokens (what captions show: "$13.60") mapped onto the spoken tokens ("thirteen dollars sixty")
 * through their heard words, so each display token takes the time of what was said for it.
 * spoken: [{ raw, words, t0, t1, est? }]. Returns [{ w, say, t0, t1, est }].
 */
export const mapDisplay = (displayText, spoken) => {
  const disp = tokenize(displayText), dflat = flatten(disp), sflat = flatten(spoken);
  const ops = alignWords(dflat.map((x) => x.w), sflat.map((x) => x.w));
  const hit = disp.map(() => new Set());
  for (const o of ops) if (o.r >= 0 && o.h >= 0) hit[dflat[o.r].ti].add(sflat[o.h].ti);
  const out = disp.map((d, i) => {
    const ix = [...hit[i]].sort((a, b) => a - b), sp = ix.map((k) => spoken[k]);
    return sp.length ? { w: d.raw, say: sp.map((s) => s.raw).join(" "), t0: Math.min(...sp.map((s) => s.t0)), t1: Math.max(...sp.map((s) => s.t1)), est: sp.some((s) => s.est) } : { w: d.raw, say: "", t0: NaN, t1: NaN, est: true };
  });
  estimateGaps(out);
  return out;
};

// ---------------------------------------------------------------- placing lines on the film's frames
/**
 * script: { fps, lead?, tail?, pause?, lines: [{ id, at?, pauseAfter? }] }; takes: per line { durationS,
 * words: [{ w, say, t0, t1, est }] } (seconds inside the take). Lines play end to end: each starts on a
 * whole frame (so its first sample sits exactly on that frame), after the previous line's last frame
 * plus its pause, unless it names its own frame `at`. Returns the voice-timing object (frames).
 */
export const placeLines = (script, takes) => {
  const fps = script.fps, lead = script.lead ?? Math.round(fps / 2), tail = script.tail ?? fps, pause = script.pause ?? 0.35;
  if (!Number.isInteger(fps) || fps <= 0) throw new Error(`narration: fps must be a whole number, got ${fps}`);
  let free = lead, prevPause = 0;
  const lines = script.lines.map((ln, i) => {
    const tk = takes[i], natural = i === 0 ? lead : free + Math.round(prevPause * fps);
    if (ln.at !== undefined && (!Number.isInteger(ln.at) || ln.at < free)) throw new Error(`narration: line '${ln.id}' asks to start at frame ${ln.at}, but the line before it is still speaking until frame ${free}`);
    const start = ln.at ?? natural, end = start + Math.ceil(tk.durationS * fps - 1e-9);
    free = end; prevPause = ln.pauseAfter ?? pause;
    const words = tk.words.map((w) => {
      // an ASR end can overshoot the take's trailing pad: no word outlasts its own line
      const from = Math.min(end - 1, start + Math.round(w.t0 * fps)), to = Math.min(end, Math.max(from + 1, start + Math.round(w.t1 * fps)));
      return { w: w.w, say: w.say, from, to, t0: round3(w.t0), t1: round3(w.t1), ...(w.est ? { est: true } : {}) };
    });
    return { id: ln.id, text: ln.text, display: ln.display ?? ln.text, start, end, durationS: round3(tk.durationS), words };
  });
  return { version: 1, fps, totalFrames: free + tail, lines };
};
const round3 = (x) => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------- the checks
/** Sentence-ending punctuation on a raw token: no gap rule applies across it. */
export const endsSentence = (raw) => /[.!?;:]["')\]]*$/.test(raw);
/**
 * Alignment sanity on one take's mapped tokens: every word timed (not estimated), monotonic and
 * non-overlapping, each word 0.05-1.5 s long, no gap over maxGapS inside a sentence.
 */
export const alignmentProblems = (tokens, { maxGapS = 1.0, minWordS = 0.05, maxWordS = 1.5 } = {}) => {
  const p = [], timed = tokens.filter((t) => t.words.length);
  for (const t of timed) if (t.est) p.push(`"${t.raw}" has no timing of its own (estimated)`);
  for (let i = 0; i < timed.length; i++) {
    const t = timed[i], d = t.t1 - t.t0;
    if (!(d >= 0)) p.push(`"${t.raw}" ends before it starts`);
    else if (!t.est && (d < minWordS - 1e-9 || d > maxWordS + 1e-9)) p.push(`"${t.raw}" lasts ${d.toFixed(2)} s (sane: ${minWordS}-${maxWordS} s)`);
    if (i > 0) {
      const a = timed[i - 1];
      if (t.t0 < a.t0 - 1e-9 || t.t0 < a.t1 - 0.02) p.push(`"${t.raw}" starts before "${a.raw}" ends (not monotonic)`);
      else if (!endsSentence(a.raw) && t.t0 - a.t1 > maxGapS) p.push(`a ${(t.t0 - a.t1).toFixed(2)} s gap between "${a.raw}" and "${t.raw}" inside a sentence`);
    }
  }
  return p;
};

/**
 * Audio sanity on a mono take (Float32 samples at sr): not clipped (no sample at full scale), peak at or
 * under peakDb, leading silence and trailing silence inside their bounds, and a speaking rate that a
 * person could have produced (words per second). Silence = under -45 dBFS in 10 ms windows.
 */
export const audioProblems = (x, sr, { words = 0, peakDb = -1, maxLeadS = 0.3, maxTailS = 0.6, wps = [1.2, 4.5], floorDb = -45 } = {}) => {
  const p = [];
  let peak = 0, clipped = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; if (a >= 0.999) clipped++; }
  const pkDb = 20 * Math.log10(Math.max(peak, 1e-12)), hop = Math.max(1, Math.round(0.01 * sr)), thr = Math.pow(10, floorDb / 20);
  let first = -1, last = -1;
  for (let i = 0; i + hop <= x.length; i += hop) { let s = 0; for (let k = i; k < i + hop; k++) s += x[k] * x[k]; if (Math.sqrt(s / hop) > thr) { if (first < 0) first = i; last = i + hop; } }
  const dur = x.length / sr, lead = first < 0 ? dur : first / sr, tail = first < 0 ? dur : dur - last / sr, speech = first < 0 ? 0 : (last - first) / sr;
  if (first < 0) p.push("the take is silent");
  if (clipped) p.push(`clipped: ${clipped} sample(s) at full scale`);
  else if (pkDb > peakDb) p.push(`peak ${pkDb.toFixed(1)} dBFS is over ${peakDb} dBFS`);
  if (first >= 0 && lead > maxLeadS) p.push(`${lead.toFixed(2)} s of silence before the first word (bound ${maxLeadS} s)`);
  if (first >= 0 && tail > maxTailS) p.push(`${tail.toFixed(2)} s of silence after the last word (bound ${maxTailS} s)`);
  if (words && speech > 0) { const r = words / speech; if (r < wps[0] || r > wps[1]) p.push(`${r.toFixed(1)} words per second (a voice says ${wps[0]}-${wps[1]})`); }
  return { problems: p, peakDb: pkDb, leadS: lead, tailS: tail, speechS: speech };
};

/**
 * The round-trip verdict for one line: the script against what a second model heard, with no prompt.
 * Any dropped or changed script word fails and is named (lesson 51: an all-caps CONTEXT vanished from a
 * take and only an ear caught it). Words the ASR heard that the script lacks fail past maxWer.
 */
export const roundTrip = (scriptText, asr, { aliases, maxWer = 0.03 } = {}) => {
  const m = mapTimings(scriptText, asr, { aliases }), ref = normalise(scriptText), hyp = asr.flatMap((a) => tokenWords(a.text));
  const w = wer(ref, hyp, aliasEq(aliases));
  const dropped = m.tokens.filter((t) => t.status === "dropped").map((t) => t.raw), changed = m.tokens.filter((t) => t.status === "changed").map((t) => `${t.raw} -> ${t.heard.join(" ")}`);
  const problems = [...dropped.map((d) => `DROPPED "${d}"`), ...changed.map((c) => `CHANGED "${c}"`)];
  if (w.wer > maxWer && !problems.length) problems.push(`WER ${(w.wer * 100).toFixed(1)} % over ${(maxWer * 100).toFixed(0)} % (heard extra: ${m.inserted.join(" ")})`);
  return { wer: w.wer, dropped, changed, inserted: m.inserted, heard: hyp.join(" "), problems, tokens: m.tokens };
};

/** The sha256 cache key input for one take: everything that changes the sound, nothing that doesn't. */
export const takeKey = ({ provider, voice, text, post }) => JSON.stringify({ provider, voice: sortKeys(voice ?? {}), text, post });
const sortKeys = (o) => (o && typeof o === "object" && !Array.isArray(o) ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])])) : o);

/** Validate a narration.json object. Returns problems (empty = good). */
export const scriptProblems = (s) => {
  const p = [];
  if (!s || typeof s !== "object") return ["the script is not a JSON object"];
  if (!Number.isInteger(s.fps) || s.fps <= 0) p.push("fps must be a whole number of frames per second");
  if (typeof s.provider !== "string") p.push("provider is required: say, gemini, openai, elevenlabs, kokoro or files");
  if (!Array.isArray(s.lines) || !s.lines.length) p.push("lines must be a non-empty list");
  const ids = new Set();
  for (const [i, l] of (s.lines ?? []).entries()) {
    if (!l || typeof l.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(l.id)) p.push(`line ${i}: id must be letters, digits, - or _`);
    else if (ids.has(l.id)) p.push(`line ${i}: duplicate id '${l.id}'`); else ids.add(l.id);
    if (typeof l?.text !== "string" || !normalise(l.text).length) p.push(`line ${i}: text has no words`);
    if (l?.display !== undefined && typeof l.display !== "string") p.push(`line ${i}: display must be text`);
    if (l?.pauseAfter !== undefined && !(l.pauseAfter >= 0)) p.push(`line ${i}: pauseAfter is seconds >= 0`);
    if (l?.at !== undefined && !(Number.isInteger(l.at) && l.at >= 0)) p.push(`line ${i}: at is a frame number >= 0`);
  }
  return p;
};
