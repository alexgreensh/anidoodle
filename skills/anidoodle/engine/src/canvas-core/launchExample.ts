// LAUNCH EXAMPLE. A launch film for a made-up product, built only from the template (preset "drawn", the
// default): two prompts answered by two plates drawing themselves, one word page, the end card on bar 5.
// Copying it: everything here is a PLACEHOLDER. The lighthouse and fox are stock style plates standing in;
// your film's plates are drawn fresh for YOUR product's subject, in the style recipe the brief chose
// (references/styles.md). Its score is composed for this made-up product (launchExampleScore.ts); a real
// film composes its own (references/music/compose.md). bpm comes from the brief.
//   node tools/launch.mjs ship launchExample --shapes 16x9,9x16
import { C } from "./launchKit";
import { makeLaunchFilm } from "./launchTemplate";
import { lighthouseDraw } from "./lighthouseDraw";
import { foxDraw } from "./foxDraw";
import { sketchScore } from "./launchExampleScore";

export const launchExample = makeLaunchFilm({
  title: "Your Product",
  subtitle: "the one line it lives by",
  placeholder: "Ask for anything…",
  asks: [
    { prompt: "a lighthouse at sunset, as a print", plate: lighthouseDraw, label: "print · drawn in code" },
    { prompt: "now a fox at dusk", plate: foxDraw, label: "a second answer, same thread" },
  ],
  words: [[{ text: "IDEA IN.", style: "ink", color: C.ink }, { text: "ART OUT.", style: "ink", color: C.accent }]],
  tagline: "One sentence that says what it is",
  install: ["npm install your-product", "your-product init"],
  footer: "yourproduct.example",
  // THE DECLARATIONS ship reads (node tools/ship.mjs). A check with nothing declared cannot look, and a
  // check that cannot look fails, so every film fills these from its brief. This example's are filled for
  // its made-up product, as a worked example: replace each with your own.
  motion: {
    // how the brand moves, from the brief: "calm", "lively" or "snappy" (motionKit.ts TEMPERAMENTS). A warm
    // drawing tool: alive, never violent. The end card's bloom is paced by it too.
    temperament: "lively",
    // the brand's own colours, #rrggbb: layerscan fails a fill in them at a see-through alpha (olive mud).
    // This made-up product owns its orange; the near-black ink is the drawn look's pen, the neutral every
    // line is written in (a drop's trail of ink ghosts, a byline easing in), so it is not listed here.
    // A brand whose colour IS a dark ink lists it, and the drawn look's ghosts then fail, as they should.
    brandColors: [C.accent],
  },
  // every claim beyond the words and the tagline (which are claims already), each listed in the facts
  // ledger with its source (facts/launchExample.json here; facts.json beside your project). The plates'
  // labels are bylines of placeholder art and claim nothing; a real product's real numbers ARE claims.
  claims: [],
  checks: {
    // the length budget in seconds: over max fails ship, over target flags it
    length: { target: 19, max: 22 },
    // the critic's record is reviews/launchExample.json: this example's own, written by a fresh critic for
    // anidoodle, never a person's review of your film. Your film gets its own (review.md).
  },
  bpm: 90, askBeats: 6, typeBeats: 6, endBeats: 8, claimBar: 5,
  // the example's own score, composed for this made-up product's brief (launchExampleScore.ts); a real
  // film composes its own product's score (references/music/compose.md), never this one
  score: sketchScore,
});
