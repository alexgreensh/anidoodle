// LAUNCH LAYOUT TESTS. One timeline, four frame shapes: each shape is a composition of its own (the
// chat, the cards, the word pages, the split beat, the end card), every line a viewer reads is at
// least the phone-safe size, nothing sits over anything else, and 16x9 is the desktop film exactly.
import { CHAT_GEOM, chatGeom, CHAT } from "../src/canvas-core/launchKit";
import { launchLayout, SHAPES, MIN_PX, PHONE_SAFE, estWidth, installRows, monoWidth, parseShapes, type Shape } from "../src/canvas-core/launchLayout";
import { makeLaunchFilm, fitWords } from "../src/canvas-core/launchTemplate";
import { measure } from "../src/canvas-core/kinetic"; // the drawn corner mark, written on: the wider of the two presets' marks
import type { Film } from "../src/canvas-core/film";

type R = { x: number; y: number; w: number; h: number };
const inside = (a: R, b: R, tol = 0.5) => a.x >= b.x - tol && a.y >= b.y - tol && a.x + a.w <= b.x + b.w + tol && a.y + a.h <= b.y + b.h + tol;
const overlap = (a: R, b: R) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const name = "launchLayout";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const g = chatGeom(CHAT, 1, CHAT_GEOM.px, 34, 0);
  ok(JSON.stringify([g.CHAT, g.INPUT, g.GEN, g.REPLY.x, g.REPLY.y, g.TEXT]) === JSON.stringify([CHAT_GEOM.CHAT, CHAT_GEOM.INPUT, CHAT_GEOM.GEN, CHAT_GEOM.REPLY.x, CHAT_GEOM.REPLY.y, CHAT_GEOM.TEXT]), "the chat derivation at k = 1 IS the desktop chat (one component, not two)");
  const content0 = { prompts: ["a lighthouse at sunset, as a print", "now a fox at dusk"], install: ["/plugin marketplace add alexgreensh/anidoodle", "/plugin install anidoodle@alexgreensh-anidoodle"], tagline: "Illustrations, loops and films, drawn in code" };
  for (const shape of Object.keys(SHAPES) as Shape[]) {
    const content = content0;
    const L = launchLayout(shape, content), frame = { x: 0, y: 0, w: L.W, h: L.H }, c = L.chat;
    ok(L.W === SHAPES[shape].W && L.H === SHAPES[shape].H, `${shape}: the frame is ${L.W}x${L.H}`);
    const small = L.roles.filter((r) => r.px < r.min);
    ok(!small.length, `${shape}: every text role is at or over its minimum (${L.roles.map((r) => `${r.role} ${r.px.toFixed(0)}`).join(", ")})`);
    if (L.phone) ok(L.roles.filter((r) => ["prompt", "bubble", "card label", "tagline", "install lines"].includes(r.role)).every((r) => r.px >= MIN_PX.phone.read), `${shape}: the lines a viewer must read are phone-safe (>= ${MIN_PX.phone.read} px)`);
    ok(inside(c.CHAT, frame) && inside(c.INPUT, c.CHAT) && inside(c.GEN, c.INPUT), `${shape}: window in frame, composer in window, button in composer`);
    ok(L.thread.cardX >= c.CHAT.x && L.thread.cardX + L.thread.card <= c.CHAT.x + c.CHAT.w && L.thread.card > 0, `${shape}: the answer card (${L.thread.card} px) sits inside the thread`);
    ok(L.thread.bubbles.every((ls) => ls.length <= 3), `${shape}: prompts wrap to at most 3 bubble lines (${L.thread.bubbles.map((b) => b.length).join(", ")})`);
    ok(L.bug.y > c.CHAT.y + c.CHAT.h, `${shape}: the corner mark sits below the chat window, never on it`);
    // and clear of it, not touching its corner (a fresh critic saw them kiss on 16:9 and 9:16, frame 0): beside
    // the window by 16 px or more, or under it by 24 px plus what the hook's creep about the window's centre adds (2 %, 4 % on 9:16)
    { const bw = measure("Your Product", L.bug.px), side = L.bug.x - bw - (c.CHAT.x + c.CHAT.w), under = L.bug.y - 0.75 * L.bug.px - (c.CHAT.y + c.CHAT.h);
      ok(side >= 16 * L.k || under >= 24 * L.k + (L.zones ? 0.04 : 0.02) * c.CHAT.h / 2, `RED ${shape}: the corner mark clears the window (${Math.round(side)} px beside it, ${Math.round(under)} px under it)`); }
    const pw = Math.max(...L.end.rows.map((r) => monoWidth(r.text, L.end.monoPx) + r.indent * L.end.monoPx * 0.61)) + 2 * L.end.padX;
    ok(pw <= L.W, `${shape}: the install panel (${pw.toFixed(0)} px at ${L.end.monoPx.toFixed(1)} px mono) fits the frame's width`);
    ok(L.end.titleY < L.end.taglineY && L.end.taglineY < L.end.panelY && L.end.footerY < L.stage.h, `${shape}: the end card stacks title, line, panel, footer, all in frame`);
    ok(!overlap(L.split.words, L.split.ui) && inside(L.split.words, L.stage) && inside(L.split.ui, L.stage), `${shape}: a split beat's words and live UI have their own areas (${L.split.vertical ? "stacked" : "side by side"})`);
    if (L.phone) { const B = launchLayout(shape, { ...content, band: true }); ok(!!B.band && !overlap(B.band, B.stage) && B.band.y + B.band.h === (B.zones ? B.safe.y + B.safe.h : B.H), `${shape}: burned-in captions get their own band under the picture (${B.band?.h} px${B.zones ? ", at the safe rectangle's bottom" : ""})`); }
    // the 9:16 platform safe zones: every rectangle that holds text sits inside the safe rectangle; other shapes have none
    if (shape !== "9x16") { ok(!L.zones && JSON.stringify(L.safe) === JSON.stringify(frame), `${shape}: no safe zones (the whole frame is free for text)`); continue; }
    const S = L.safe, E = L.end, pushed = (r: R, z: number) => ({ x: r.x + r.w / 2 - (r.w * z) / 2, y: r.y + r.h / 2 - (r.h * z) / 2, w: r.w * z, h: r.h * z });
    ok(L.zones && Math.abs(S.y - L.H * PHONE_SAFE.top) < 1e-9 && Math.abs(S.x + S.w - L.W * (1 - PHONE_SAFE.right)) < 1e-9 && Math.abs(S.y + S.h - L.H * (1 - PHONE_SAFE.bottom)) < 1e-9, `9x16: the safe rectangle is the frame less the top ${Math.round(PHONE_SAFE.top * 100)} %, bottom ${Math.round(PHONE_SAFE.bottom * 100)} % and right ${Math.round(PHONE_SAFE.right * 100)} %`);
    ok(inside(c.CHAT, S), `9x16: the chat window, and every line in it, sits inside the safe rectangle (${[c.CHAT.x, c.CHAT.y, c.CHAT.x + c.CHAT.w, c.CHAT.y + c.CHAT.h].map((v) => v.toFixed(0)).join(",")})`);
    ok(inside(L.split.words, S) && inside(pushed(L.split.ui, 1.12), S), "9x16: the split beat's words and its live UI, pushed in to its fullest 12 %, sit inside the safe rectangle");
    ok(inside(pushed(L.uiFull, 1.06), S), "9x16: a UI ask on its own leaves its camera room to creep without leaving the safe rectangle");
    const bugW = estWidth("Your Product", L.bug.px) * 1.2;
    ok(inside({ x: L.bug.x - bugW, y: L.bug.y - L.bug.px, w: bugW, h: L.bug.px * 1.3 }, S), "9x16: the corner mark sits inside the safe rectangle");
    const at = L.type.at!; ok(!!at && inside({ x: at[0] - L.type.maxW / 2, y: at[1] - 10, w: L.type.maxW, h: 20 }, S), "9x16: a word page's lines are centred in the safe rectangle and no wider than it");
    ok(Math.abs(E.cx - L.W / 2) < 1e-9, `RED 9x16: the end card centres on the frame (x ${E.cx.toFixed(0)}), not on the safe rectangle, which read 60 px left of the middle`);
    const pw0 = pw;
    ok(inside({ x: E.cx - Math.max(E.titleW, pw0) / 2, y: E.titleY - E.titleMax, w: Math.max(E.titleW, pw0), h: E.footerY + E.footerPx - (E.titleY - E.titleMax) }, S), "9x16: the end card (name, line, install panel, footer) sits inside the safe rectangle");
  }
  let err = ""; try { launchLayout("16x9", { ...content0, band: true }); } catch (e) { err = (e as Error).message; } ok(/sidecar/.test(err), "16x9 refuses a burned-in band: its captions ship as .srt/.vtt");
  // install lines too long for the mono minimum wrap at a natural break, the continuation indented; short ones stay whole
  const T = launchLayout("9x16", content0).end, rowsOf = (r: { text: string; indent: number }[]) => r.map((x) => `${" ".repeat(x.indent)}${x.text}`).join(" | ");
  ok(T.wrapped && rowsOf(T.rows) === "/plugin marketplace add |   alexgreensh/anidoodle | /plugin install |   anidoodle@alexgreensh-anidoodle" && T.monoPx >= MIN_PX.phone.read, `9x16: anidoodle's own install lines wrap after the command word at ${T.monoPx.toFixed(1)} px: ${rowsOf(T.rows)}`);
  const one = installRows(["npm install tally"], 824.8, 32, 41), mixed = installRows(["npm i tally", "/plugin install anidoodle@alexgreensh-anidoodle"], 824.8, 32, 41);
  ok(!one.wrapped && one.rows.length === 1 && one.rows[0].text === "npm install tally" && one.rows[0].indent === 0, "a short install line stays on one row");
  ok(mixed.wrapped && rowsOf(mixed.rows) === "npm i tally | /plugin install |   anidoodle@alexgreensh-anidoodle", `only the line that cannot fit wraps: ${rowsOf(mixed.rows)}`);
  const at = installRows(["npx anidoodle-package@alexgreensh-anidoodle-latest"], 700, 32, 41);
  ok(at.wrapped && rowsOf(at.rows) === "npx anidoodle-package |   @alexgreensh-anidoodle-latest", `two rows when one break gives two: before "@" when no space does (${rowsOf(at.rows)})`);
  const mark = installRows(["alexgreensh-anidoodle@alexgreensh-anidoodle-x"], 600, 32, 41);
  ok(mark.wrapped && rowsOf(mark.rows) === "alexgreensh-anidoodle |   @alexgreensh-anidoodle-x", `with no space it wraps before "@", the next row opening with it: ${rowsOf(mark.rows)}`);
  const slash = installRows(["alexgreensh-anidoodle/alexgreensh-anidoodle-x"], 600, 32, 41);
  ok(slash.wrapped && rowsOf(slash.rows) === "alexgreensh-anidoodle/ |   alexgreensh-anidoodle-x", `or after "/", the row closing with it: ${rowsOf(slash.rows)}`);
  ok(JSON.stringify(installRows(["npm i a", "b init"], 944, 32, 33.6)) === JSON.stringify({ rows: [{ text: "npm i a", indent: 0 }, { text: "b init", indent: 0 }], px: 33.6, wrapped: false }), "lines that fit keep their size and rows exactly");
  err = ""; try { launchLayout("9x16", { ...content0, install: ["npx a-single-package-name-that-is-far-too-long-for-any-phone-frame-at-all"] }); } catch (e) { err = (e as Error).message; } ok(/install lines would be/.test(err), `an install line that cannot be phone-safe is an error: ${err.slice(0, 80)}`);
  ok(parseShapes("16x9, 9x16").join() === "16x9,9x16", "parseShapes reads a --shapes list");
  err = ""; try { parseShapes("16x10"); } catch (e) { err = (e as Error).message; } ok(/not a shape/.test(err), "parseShapes refuses an unknown shape");

  // one timeline, every shape: the same cut and length, a different composition
  const plate: Film = { meta: { title: "plate", W: 1080, H: 1080, fps: 30, bpm: 90, durationFrames: 60 }, assets: { images: {} }, shots: [{ id: "p", start: 0, end: 60, draw: () => {} }] };
  const f = makeLaunchFilm({ title: "Tally", asks: [{ prompt: content0.prompts[0], plate, label: "l" }, { prompt: content0.prompts[1], plate, label: "l" }], words: [[{ text: "EVERY NUMBER, COUNTED.", style: "ink", color: "#000" }]], tagline: content0.tagline, install: ["npm i tally"], bpm: 90, claimBar: 4, score: null });
  const shapes = (Object.keys(SHAPES) as Shape[]).map((s) => f.reshape(s));
  ok(shapes.every((x) => x.meta.durationFrames === f.meta.durationFrames && JSON.stringify(x.cut.STARTS) === JSON.stringify(f.cut.STARTS)), `every shape is the same cut (${f.meta.durationFrames} frames, cuts at ${f.cut.STARTS.join(", ")})`);
  ok(shapes.every((x, i) => x.meta.W === SHAPES[(Object.keys(SHAPES) as Shape[])[i]].W && x.meta.H === SHAPES[(Object.keys(SHAPES) as Shape[])[i]].H), "each shape renders at its own frame size");
  ok(f.reshape("16x9") === f && f.reshape("9x16") === f.reshape("9x16"), "reshape returns the film itself for its own shape, and one film per shape");
  const tall = fitWords([{ text: "EVERY NUMBER, COUNTED.", style: "ink", color: "#000" }], f.reshape("9x16").layout), wide = fitWords([{ text: "EVERY NUMBER, COUNTED.", style: "ink", color: "#000" }], f.layout);
  // a film ask (any film in a card) with its words beside it builds in every shape, its seam into the end card matched
  const fa = makeLaunchFilm({ title: "Tally", asks: [{ prompt: content0.prompts[0], plate, label: "l" }, { kind: "film", film: plate, split: [{ text: "Any film.", style: "ink", color: "#000" }] }], tagline: "t", install: ["npm i tally"], bpm: 90, score: null });
  ok((Object.keys(SHAPES) as Shape[]).every((sh) => fa.reshape(sh).seams.every((q) => Math.hypot(q.out.p[0] - q.into.p[0], q.out.p[1] - q.into.p[1]) < 2)), "a film ask builds in every shape, the motif's seam matched");
  // the hook: the first prompt is the hero, large enough to read muted in the first 2 s, in every shape
  ok((Object.keys(SHAPES) as Shape[]).every((sh) => { const x = f.reshape(sh); return (x.heroPx ?? 0) >= (x.layout.phone ? 64 : 56); }), `the first prompt is the hero: ${(Object.keys(SHAPES) as Shape[]).map((sh) => `${sh} ${f.reshape(sh).heroPx} px`).join(", ")} (>= 64 on a phone frame, 56 on 16x9)`);
  let long = ""; try { makeLaunchFilm({ title: "Tally", shape: "9x16", asks: [{ prompt: "a very long first prompt that goes on and on about everything it could possibly want drawn today", plate, label: "l" }], tagline: "t", install: ["npm i tally"], bpm: 90, score: null }); } catch (e) { long = (e as Error).message; }
  ok(/shorten it/.test(long), "a first prompt too long for a readable hook is an error, never tiny type");
  // a split beat's words are read too: up for their reading time (readS) before they sink, or the spec is an
  // error that says how to make room (the clean scaffold's defaults left "Every receipt, matched for you." up 0.45 s)
  const ui = { title: "T", nav: ["A"], action: "Go", before: { items: [{ id: "a", label: "x", value: 1 }] }, after: { items: [{ id: "a", label: "x", value: 0, done: true }] } };
  const splitSpec = (claimBar: number) => ({ title: "Tally", preset: "clean" as const, fps: 60 as const, asks: [{ kind: "ui" as const, ui, prompt: "match every receipt" }, { kind: "ui" as const, ui, split: [{ text: "Every receipt,", style: "ink" as const, color: "#111111" }, { text: "matched for you.", style: "ink" as const, color: "#2f54eb" }] }], words: [[{ text: "ASK ONCE.", style: "ink" as const, color: "#111111" }]], tagline: "t", install: ["npm i tally"], bpm: 90, askBeats: 6, typeBeats: 6, endBeats: 8, claimBar, score: null });
  let short = ""; try { makeLaunchFilm(splitSpec(4)); } catch (e) { short = (e as Error).message; }
  ok(/split words/.test(short) && /claimBar|askBeats/.test(short), `RED: split words up too short to read are an error that says how to make room ("${short.slice(0, 90)}")`);
  let roomy = ""; try { makeLaunchFilm(splitSpec(6)); } catch (e) { roomy = (e as Error).message; }
  ok(roomy === "", `a split beat with room to be read builds (${roomy.slice(0, 80) || "ok"})`);
  ok(wide.length === 1 && tall.length === 2, `a word page re-sets its lines for a narrow frame (16x9: ${wide.length} line, 9x16: ${tall.map((l) => l.text).join(" / ")})`);
};
