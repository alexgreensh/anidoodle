// LAUNCH EXAMPLE, CLEAN. The same template in its second look (preset "clean": a quiet canvas, one
// accent, type as the design) for a UI-first product, at 60 fps. Three asks of the other kinds:
//   1 the product's own UI from data: the ask typed into its command bar, its action pressed, every
//     row springing from the before state to the after state;
//   2 a split feature beat: words in their own column, the live UI beside them (above them on a phone);
//   3 another of the product's own screens, its reports, with its words beside it: every ask shows
//     THIS product (a film ask, kind "film", plays any film in a card the same way).
// Everything here is a PLACEHOLDER for a made-up product; your film's UI data comes from YOUR
// product (its real screens, its real states), and its score is composed for its brief.
//   node tools/launch.mjs ship launchExampleClean --shapes 16x9,9x16
import { makeLaunchFilm } from "./launchTemplate";
import type { ProductUI } from "./productUI";
import { tallyScore } from "./launchExampleCleanScore";

const inbox: ProductUI = {
  title: "Tally", nav: ["Inbox", "Books", "Reports"], action: "Match all", command: "Ask Tally…",
  before: {
    stats: [{ label: "Unmatched", value: 14 }, { label: "Matched", value: 32 }],
    items: [
      { id: "a", label: "Design tool, Sep", value: "$144", tag: "no receipt" },
      { id: "b", label: "Cloud hosting, Sep", value: "$1,208", tag: "no receipt" },
      { id: "c", label: "Team lunch, Sep", value: "$86", tag: "no receipt" },
      { id: "d", label: "Train fare, Sep", value: "$42", tag: "no receipt" },
    ],
  },
  after: {
    stats: [{ label: "Unmatched", value: 0 }, { label: "Matched", value: 46 }],
    items: [
      { id: "b", label: "Cloud hosting, Sep", value: "$1,208", tag: "matched", done: true, accent: true },
      { id: "a", label: "Design tool, Sep", value: "$144", tag: "matched", done: true },
      { id: "c", label: "Team lunch, Sep", value: "$86", tag: "matched", done: true },
      { id: "d", label: "Train fare, Sep", value: "$42", tag: "matched", done: true },
    ],
  },
};
const books: ProductUI = {
  title: "Tally", nav: ["Books", "Reports"], action: "Close month", layout: "cards",
  before: { items: [
    { id: "r", label: "Revenue", value: 61, unit: "%", bar: 0.61 }, { id: "c", label: "Costs", value: 48, unit: "%", bar: 0.48 },
    { id: "p", label: "Payroll", value: 70, unit: "%", bar: 0.7 }, { id: "t", label: "Tax", value: 12, unit: "%", bar: 0.12 },
  ] },
  after: { items: [
    { id: "r", label: "Revenue", value: 100, unit: "%", bar: 1, accent: true }, { id: "c", label: "Costs", value: 100, unit: "%", bar: 1 },
    { id: "p", label: "Payroll", value: 100, unit: "%", bar: 1 }, { id: "t", label: "Tax", value: 100, unit: "%", bar: 1 },
  ] },
};

const reports: ProductUI = {
  title: "Tally", nav: ["Reports", "Books"], action: "Explain",
  before: { items: [
    { id: "p", label: "Payroll", value: "$48,200", bar: 0.62 }, { id: "h", label: "Cloud hosting", value: "$1,208", bar: 0.31 },
    { id: "t", label: "Travel", value: "$640", bar: 0.18 }, { id: "d", label: "Design tools", value: "$144", bar: 0.08 },
  ] },
  after: { items: [
    { id: "h", label: "Cloud hosting", value: "$1,208", bar: 0.31, tag: "up 18 %", accent: true }, { id: "p", label: "Payroll", value: "$48,200", bar: 0.62, tag: "as planned" },
    { id: "t", label: "Travel", value: "$640", bar: 0.18 }, { id: "d", label: "Design tools", value: "$144", bar: 0.08 },
  ] },
};

export const launchExampleClean = makeLaunchFilm({
  title: "Tally", preset: "clean", fps: 60,
  asks: [
    { kind: "ui", ui: inbox, prompt: "match every receipt from September" },
    { kind: "ui", ui: books, split: [{ text: "Month end,", style: "ink", color: "#15161a" }, { text: "one click.", style: "ink", color: "#2f54eb" }] }, // the words say what the picture shows: one press closes the month
    { kind: "ui", ui: reports, split: [{ text: "And it shows", style: "ink", color: "#15161a" }, { text: "you where.", style: "ink", color: "#2f54eb" }] },
  ],
  words: [[{ text: "ASK ONCE.", style: "ink", color: "#15161a" }, { text: "DONE.", style: "ink", color: "#2f54eb" }]],
  tagline: "Bookkeeping that does itself",
  install: ["npm install tally", "tally init"],
  footer: "tally.example",
  // the end card on endCard.ts's asymmetric grid: the name top-left with the drop as its full stop,
  // the line and the install line under it, the footer as a stamp on the right (never a centred stack)
  endCard: "grid",
  // THE DECLARATIONS ship reads (node tools/ship.mjs). A check with nothing declared cannot look, and a
  // check that cannot look fails, so every film fills these from its brief. This example's are filled
  // for its made-up product, as a worked example: replace each with your own.
  motion: {
    // how the brand moves, from the brief: "calm", "lively" or "snappy" (motionKit.ts TEMPERAMENTS).
    // A UI product with quick arrivals; motionscan fails any stretch faster than this allows.
    temperament: "snappy",
    // the brand's own colours, #rrggbb: layerscan fails a fill in them at a see-through alpha (olive mud)
    brandColors: ["#2f54eb", "#15161a"],
  },
  // every claim beyond the words, split words and tagline (which are claims already), each listed in the
  // facts ledger with its source (facts/launchExampleClean.json here; facts.json beside your project).
  // The UI's figures are made-up sample data in a mock screen and claim nothing; a real product's real
  // numbers on screen ARE claims: list each one here with its source.
  claims: [],
  checks: {
    // the length budget in seconds: over max fails ship, over target flags it
    length: { target: 22, max: 25 },
    // each ask IS the product's own screen: its title, nav, command bar, stats and rows are the UI the
    // viewer came to see, so their density is the point, not a layout fault. Only those beats (60 fps
    // frames, the travels into and out of them included); the word page and the end card are still judged.
    layoutExempt: [
      [0, 330, "the first ask shows the product's whole inbox: dense UI is the subject"],
      [440, 680, "the books beat: the product's own cards beside its two words"],
      [680, 960, "the reports beat: the product's own report rows beside its two words"],
    ],
    // the critic's record is reviews/launchExampleClean.json: this example's own, written by a fresh
    // critic for anidoodle, never a person's review of your film. Your film gets its own (review.md).
  },
  bpm: 90, askBeats: 6, typeBeats: 6, endBeats: 8, claimBar: 6,
  // the example's own score, composed for this made-up product's brief (launchExampleCleanScore.ts);
  // a real film composes its own product's score (references/music/compose.md), never this one
  score: tallyScore,
});
