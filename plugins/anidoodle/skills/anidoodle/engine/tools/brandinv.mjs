// BRAND INVENTORY. The pure half of `brand.mjs inventory | find | check` (no files, no network).
// A launch film once answered "the sponsors are not in the design file" after searching only its own
// exports, while the file had two frames named "Social Media partners". The fix is a class fix: on first
// access, list EVERY frame of the source (name, id, size, the words on it), keep that list beside the
// film, and answer any "is X in the file?" from a search of the whole list, never from memory.
// The list also carries a read mark per frame, and `check` fails while any frame is unmarked, so
// "I read the brand file" is a claim the tool can hold.

/** Figma REST file JSON (GET /v1/files/:key) -> { frames, motion }. Top-level children of each page are the frames. */
export const framesFromFigma = (file) => {
  const pages = file?.document?.children ?? [], frames = [], motion = new Map();
  const textOf = (n, out = []) => { if (n.type === "TEXT" && n.characters) out.push(n.characters); for (const k of n.children ?? []) textOf(k, out); return out; };
  const motionOf = (n) => {
    const add = (dur, easing, from) => { if (!dur) return; const key = `${Math.round(dur * 1000)}|${JSON.stringify(easing)}`; const m = motion.get(key) ?? { ms: Math.round(dur * 1000), easing, uses: 0, from: [] }; m.uses++; if (m.from.length < 5) m.from.push(from); motion.set(key, m); };
    for (const it of n.interactions ?? []) for (const a of it.actions ?? (it.action ? [it.action] : [])) { const t = a?.transition; if (t) add(t.duration, easingOf(t.easing), `${n.name} (${t.type ?? "transition"})`); }
    if (n.transitionDuration) add(n.transitionDuration / 1000, easingOf(n.transitionEasing), n.name);
    for (const k of n.children ?? []) motionOf(k);
  };
  for (const page of pages) for (const n of page.children ?? []) {
    const box = n.absoluteBoundingBox ?? {};
    frames.push({ page: page.name, name: n.name, id: n.id, type: n.type, w: Math.round(box.width ?? 0), h: Math.round(box.height ?? 0), text: textOf(n).join(" | ").slice(0, 4000) });
    motionOf(n);
  }
  return { frames, motion: [...motion.values()].sort((a, b) => b.uses - a.uses) };
};
const easingOf = (e) => {
  if (!e) return null; if (typeof e === "string") return e;
  const b = e.easingFunctionCubicBezier; if (b) return `cubic-bezier(${b.x1}, ${b.y1}, ${b.x2}, ${b.y2})`;
  const s = e.easingFunctionSpring; if (s) return `spring(mass ${s.mass}, stiffness ${s.stiffness}, damping ${s.damping})`;
  return e.type ?? null;
};
/** A folder of exports -> frames, one per file. */
export const framesFromFiles = (names) => names.filter((f) => !f.startsWith(".")).sort().map((f) => ({ page: "(files)", name: f.replace(/\.[^.]+$/, ""), id: f, type: f.split(".").pop().toUpperCase(), w: 0, h: 0, text: "" }));

const cell = (s) => String(s ?? "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
/** The inventory page: one row per frame, an unticked read box each. Existing marks are kept by id. */
export const renderInventory = (source, frames, prev = new Map()) => [
  `# Brand inventory: ${source}`,
  "",
  `${frames.length} frames. Mark each one when you have looked at it: \`[x]\` read, or \`[-] reason\` skipped on purpose.`,
  "Answer \"is X in the file?\" with `brand.mjs find X`, which searches every name and every word below, never from memory.",
  "",
  "| read | page | frame | id | size | words on it |",
  "|---|---|---|---|---|---|",
  ...frames.map((f) => `| ${prev.get(f.id) ?? "[ ]"} | ${cell(f.page)} | ${cell(f.name)} | ${cell(f.id)} | ${f.w && f.h ? `${f.w}x${f.h}` : "-"} | ${cell(f.text).slice(0, 160)} |`),
  "",
].join("\n");
/** INVENTORY.md -> rows { mark, page, name, id, words }. */
export const parseInventory = (md) => String(md).split("\n").filter((l) => /^\|\s*\[/.test(l)).map((l) => {
  const c = l.split("|").slice(1, -1).map((x) => x.trim());
  return { mark: c[0], page: c[1], name: c[2], id: c[3], size: c[4], words: c[5] ?? "" };
});
/** Every frame read or skipped with a reason. -> { status, total, unread: [rows], bareSkips: [rows] } */
export const checkInventory = (rows) => {
  if (!rows.length) return { status: "FAIL", total: 0, unread: [], bareSkips: [], why: "the inventory lists no frames: run brand.mjs inventory first (an empty list is never a pass)" };
  // Only two marks count: [x] (read) and "[-] reason" (skipped on purpose). Anything else, such as [], [  ]
  // or [?], was never read, so it fails rather than passing unseen.
  const read = (m) => /^\[[xX]\]/.test(m), skip = (m) => /^\[-\]\s+\S/.test(m), bare = (m) => /^\[-\]\s*$/.test(m);
  const unread = rows.filter((r) => !read(r.mark) && !skip(r.mark) && !bare(r.mark)), bareSkips = rows.filter((r) => bare(r.mark));
  return { status: unread.length || bareSkips.length ? "FAIL" : "PASS", total: rows.length, unread, bareSkips };
};
const fold = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Frames whose name or words contain every query word (or a close plural/singular of it). */
export const findInInventory = (rows, query) => {
  const words = fold(query).split(" ").filter(Boolean); if (!words.length) return [];
  const stem = (w) => w.replace(/(ies|es|s)$/, "");
  return rows.filter((r) => { const hay = ` ${fold(`${r.page} ${r.name} ${r.words}`)} `; return words.every((w) => hay.includes(` ${w}`) || hay.includes(` ${stem(w)}`)); });
};
/**
 * Motion tokens for the brand file, in the shape motionKit.ts motionTokens() reads:
 * { <name>: { ease: [x1, y1, x2, y2] | "linear", ms, uses, from } }, named after the first frame that uses each timing.
 * Spring easings have no cubic-bezier form; they are listed under `_springs` for a person to translate, never guessed.
 */
export const motionTokens = (motion) => {
  const out = {}, springs = [], NAMED = { EASE_IN: [0.42, 0, 1, 1], EASE_OUT: [0, 0, 0.58, 1], EASE_IN_AND_OUT: [0.42, 0, 0.58, 1], LINEAR: "linear", EASE_IN_BACK: [0.3, -0.05, 0.7, -0.5], EASE_OUT_BACK: [0.45, 1.45, 0.8, 1], EASE_IN_AND_OUT_BACK: [0.7, -0.4, 0.4, 1.4] };
  for (const m of motion) {
    const e = String(m.easing ?? "LINEAR"), bz = e.match(/^cubic-bezier\(([^)]*)\)$/);
    const ease = bz ? bz[1].split(",").map(Number) : NAMED[e] ?? null;
    if (!ease) { springs.push({ ms: m.ms, easing: e, from: m.from }); continue; }
    let name = String(m.from?.[0] ?? "motion").replace(/\s*\(.*\)$/, "").split(/[^A-Za-z0-9]+/).filter(Boolean).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join("") || "motion";
    if (/^[0-9]/.test(name)) name = `m${name}`;
    let k = name, n = 2; while (out[k]) k = `${name}${n++}`;
    out[k] = { ease, ms: m.ms, uses: m.uses, from: m.from };
  }
  if (springs.length) out._springs = springs;
  return out;
};
