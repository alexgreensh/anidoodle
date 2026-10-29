// LAUNCH EXAMPLE, CLEAN, WITH A CHAT ASK. The clean look (preset "clean": a quiet canvas, one accent,
// type as the design) on a product people ask in a chat, at 60 fps:
//   1 a chat ask: the question typed as the hook, Generate pressed, and the answer card opening as an
//     iris on a chart drawing itself (the answer is any film of this engine, here a small bar chart);
//   2 a word page;
//   3 the product's own screen from data, with its words beside it.
// Everything here is a PLACEHOLDER for a made-up product; your film's answer is drawn for YOUR product,
// its UI data comes from its real screens, and its score is composed for its brief.
//   node tools/launch.mjs ship launchExampleCleanChat --shapes 16x9,9x16
import type { Film } from "./film";
import { CLEAN, makeLaunchFilm } from "./launchTemplate";
import type { ProductUI } from "./productUI";
import { tallyScore } from "./launchExampleCleanScore";

// the answer: four months of a spend line as bars, rising one after another, the last in the accent.
// No words inside it: the card's byline says what it is, at a size the frame checks can read.
const BARS = [0.42, 0.47, 0.45, 0.78];
const chart: Film = {
  meta: { title: "Tally answer: hosting by month", W: 1080, H: 1080, fps: 30, bpm: 90, durationFrames: 150 },
  assets: { images: {} },
  shots: [{ id: "chart", start: 0, end: 150, draw: (ctx, f, env) => {
    ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
    // (a cool tint, not the card's paper: the answer opens as an iris, and paper on paper hid it, cc1-3)
    ctx.fillStyle = "#e8ecf6"; ctx.fillRect(0, 0, 1080, 1080);
    ctx.fillStyle = CLEAN.line; for (let j = 1; j <= 4; j++) ctx.fillRect(120, 900 - j * 170, 840, 3);
    ctx.fillStyle = CLEAN.ink; ctx.fillRect(120, 900, 840, 5);
    BARS.forEach((v, i) => {
      // each bar rises on an out-cubic, 12 frames after the one before; the accent bar last and tallest
      const q = Math.min(1, Math.max(0, (f - 6 - i * 12) / 30)), e = 1 - (1 - q) ** 3, h = 700 * v * e;
      ctx.fillStyle = i === BARS.length - 1 ? CLEAN.accent : "#b9bfcc";
      ctx.fillRect(170 + i * 205, 900 - h, 150, h);
    });
  } }],
};

const inbox: ProductUI = {
  title: "Tally", nav: ["Inbox", "Books", "Reports"], action: "Match all",
  // (the rows keep their places and gain their tag as they match, the hosting row the chat asked about in
  // the accent: rows that traded places passed through each other, and a fresh critic read the crossing as
  // rows going see-through and vanishing, cc1-2. The words beside them are read through the press, a
  // declared hold, so the in-place change is never dead air)
  before: { items: [
    { id: "a", label: "Cloud hosting, Sep", value: "$1,208" },
    { id: "b", label: "Design tool, Sep", value: "$144" },
    { id: "c", label: "Team lunch, Sep", value: "$86" },
  ] },
  after: { items: [
    { id: "a", label: "Cloud hosting, Sep", value: "$1,208", tag: "matched", done: true, accent: true },
    { id: "b", label: "Design tool, Sep", value: "$144", tag: "matched", done: true },
    { id: "c", label: "Team lunch, Sep", value: "$86", tag: "matched", done: true },
  ] },
};

export const launchExampleCleanChat = makeLaunchFilm({
  title: "Tally", subtitle: "your books, answered", placeholder: "Ask Tally…", genLabel: "Ask", preset: "clean", fps: 60,
  asks: [
    { prompt: "why did hosting go up?", plate: chart, label: "Cloud hosting, by month" },
    { kind: "ui", ui: inbox, split: [{ text: "Then it fixes", style: "ink", color: "#15161a" }, { text: "the books.", style: "ink", color: "#2f54eb" }] },
  ],
  words: [[{ text: "ASK IT.", style: "ink", color: "#15161a" }, { text: "SEE WHY.", style: "ink", color: "#2f54eb" }]],
  tagline: "Bookkeeping that does itself",
  install: ["npm install tally", "tally init"],
  footer: "tally.example",
  // the end card on endCard.ts's asymmetric grid: with two install lines a centred stack is five blocks on one
  // axis, the centred stack framecheck rejects
  endCard: "grid",
  // THE DECLARATIONS ship reads (node tools/ship.mjs). Filled for this made-up product as a worked example:
  // replace each with your own (launchExampleClean.ts explains each one)
  motion: { temperament: "snappy", brandColors: ["#2f54eb", "#15161a"] },
  claims: [],
  checks: {
    length: { target: 22, max: 25 },
    // the split beat IS the product's own inbox beside its words: its rows are what the viewer came to see
    // (60 fps frames, the travel into it included); the chat, the word page and the end card are still judged
    layoutExempt: [[560, 960, "the inbox beat: the product's own rows beside its two words"]],
    // the critic's record is reviews/launchExampleCleanChat.json, this example's own
  },
  // (askBeats 8: the chart answering the chat ask has time to be seen; claimBar 6 lands the end card on bar 6,
  // so the score leaves it a 5.3 s hold, as the other examples have)
  bpm: 90, askBeats: 8, typeBeats: 6, endBeats: 8, claimBar: 6,
  // the clean example's own score (the same made-up product and brief); a real film composes its own
  score: tallyScore,
});
