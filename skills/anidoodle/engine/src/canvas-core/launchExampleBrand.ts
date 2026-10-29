// LAUNCH EXAMPLE, A BRAND'S OWN LOOK. The template dressed as somebody else's product, to prove a launch film
// can look like YOUR product and still pass ship: "Lantern", an INVENTED reading desk (no real company), on
// a dark ground, its own serif display face (Lora Bold) and text face (Instrument Sans Bold), square
// bubbles, a square composer, its own logo (assets/brand/lantern/lanternMark.svg, drawn for it and imported with
// `node tools/brand.mjs import`), a chat ask and a product ask:
//   1 a chat ask: the question typed as the hook, Ask pressed, the answer opening as an iris on a map of
//     sources drawing itself (the two that disagree lit in the accent, a clash mark between them);
//   2 a word page;
//   3 the product's own library from data, its words beside it.
// Everything here is a PLACEHOLDER for a made-up product; your film's look comes from YOUR product (its
// brand.json, its fonts, its colours), its answer plate is drawn for it and its score composed for its brief.
//   node tools/launch.mjs ship launchExampleBrand --shapes 16x9,9x16
import type { Film } from "./film";
import { makeLaunchFilm } from "./launchTemplate";
import type { ProductUI } from "./productUI";
import { tallyScore } from "./launchExampleCleanScore";
import lora from "../../assets/fonts/Lora-Bold.ttf";
import instrument from "../../assets/fonts/InstrumentSans-Bold.ttf";
import lanternBrand from "../../assets/brand/lantern/brand.json";

// the brand's colours, as its own design file would name them (a dark reading desk, one lamp-light accent)
// (the window a clear step lighter than the ground and the answer's ground lighter again: on a dark page a
// window one shade off its ground changed too few pixels as the room crept, and read as a freeze to the gate)
const LANTERN = { bg: "#0f1113", card: "#1f2228", ink: "#f3ede0", soft: "#b8b0a2", mute: "#8f897e", line: "#3a3f48", chip: "#30343c", accent: "#f2b544", accentDeep: "#c98f22", paper: "#272b32" };

// the answer: six sources laid out as pages, each drawing itself (a page, its heading bar, its lines), joined
// where they cite each other; then the two that DISAGREE light up in the lamp's amber, joined by a bold
// amber line with a clash mark on it. No words inside: the card's byline says what it is.
const PAGES: [number, number][] = [[200, 230], [560, 170], [840, 260], [260, 640], [610, 560], [860, 760]];
const LINKS: [number, number][] = [[0, 1], [1, 2], [0, 3], [3, 4], [1, 4], [4, 5], [2, 5]];
const PW = 190, PH = 230, CLASH: [number, number] = [1, 3];
const sources: Film = {
  meta: { title: "Lantern answer: which sources disagree", W: 1080, H: 1080, fps: 30, bpm: 90, durationFrames: 150 },
  assets: { images: {} },
  shots: [{ id: "map", start: 0, end: 150, draw: (ctx, f, env) => {
    ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
    // (a ground a step off the card's, so the iris that opens onto it is seen)
    ctx.fillStyle = "#353a43"; ctx.fillRect(0, 0, 1080, 1080);
    const q = (t0: number, len: number) => { const u = Math.min(1, Math.max(0, (f - t0) / len)); return 1 - (1 - u) ** 3; };
    const ctr = (i: number): [number, number] => [PAGES[i][0] + PW / 2, PAGES[i][1] + PH / 2];
    // the links first, under the pages
    ctx.lineWidth = 7; ctx.strokeStyle = "#5a6070"; ctx.lineCap = "round";
    LINKS.forEach(([a, b], i) => { const e = q(16 + i * 6, 18); if (e <= 0) return; const [x0, y0] = ctr(a), [x1, y1] = ctr(b); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e); ctx.stroke(); });
    const hot = q(78, 18); // the two that disagree light up
    PAGES.forEach(([x, y], i) => {
      const e = q(4 + i * 6, 16); if (e <= 0) return;
      const h = PH * e, lit = CLASH.includes(i) ? hot : 0;
      ctx.fillStyle = "#f3ede0"; ctx.fillRect(x, y + PH - h, PW, h);
      if (lit > 0) { ctx.lineWidth = 12; ctx.strokeStyle = "#f2b544"; ctx.strokeRect(x - 10 * lit, y + PH - h - 10 * lit, PW + 20 * lit, h + 20 * lit); }
      // the page's heading bar and its lines, written as the page rises
      ctx.fillStyle = lit > 0.5 ? "#c98f22" : "#4a505c"; if (e > 0.6) ctx.fillRect(x + 22, y + 26, (PW - 70) * q(10 + i * 6, 14), 22);
      ctx.fillStyle = "#9aa0ab"; for (let r = 0; r < 5; r++) { const w = q(14 + i * 6 + r * 2, 12); if (w > 0) ctx.fillRect(x + 22, y + 72 + r * 30, (PW - 44 - (r % 2) * 40) * w, 12); }
    });
    // the clash: a bold amber line between the two, and a mark where it crosses
    if (hot > 0) {
      const [x0, y0] = ctr(CLASH[0]), [x1, y1] = ctr(CLASH[1]), e = q(88, 16), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      ctx.strokeStyle = "#f2b544"; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e); ctx.stroke();
      const b = q(100, 14); if (b > 0) { ctx.fillStyle = "#f2b544"; ctx.beginPath(); ctx.arc(mx, my, 46 * b, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#0f1113"; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(mx - 20 * b, my - 20 * b); ctx.lineTo(mx + 20 * b, my + 20 * b); ctx.moveTo(mx + 20 * b, my - 20 * b); ctx.lineTo(mx - 20 * b, my + 20 * b); ctx.stroke(); }
    }
  } }],
};

const library: ProductUI = {
  title: "Lantern", nav: ["Library", "Notes", "Map"], action: "Check all",
  // (rows keep their places and gain their tag as they are checked: no crossing rows)
  before: { items: [
    { id: "a", label: "Field notes, 2019", value: "12 p." },
    { id: "b", label: "Survey, spring", value: "40 p." },
    { id: "c", label: "Interview, May", value: "8 p." },
  ] },
  after: { items: [
    { id: "a", label: "Field notes, 2019", value: "12 p.", tag: "cited", done: true, accent: true },
    { id: "b", label: "Survey, spring", value: "40 p.", tag: "cited", done: true },
    { id: "c", label: "Interview, May", value: "8 p.", tag: "cited", done: true },
  ] },
};

export const launchExampleBrand = makeLaunchFilm({
  title: "Lantern", subtitle: "your reading desk", placeholder: "Ask Lantern…", fps: 60,
  // THE LOOK: the brand's own, field by field (launch-video-kit.md, Looks). `from` fills the palette and the
  // logo from the brand file; the explicit palette wins over it; the fonts are the brand's files.
  look: {
    base: "clean",
    from: lanternBrand,
    palette: LANTERN,
    fonts: { display: { family: "Lora", file: lora }, text: { family: "Instrument Sans", file: instrument } },
    shape: { radius: 14, bubble: "square", composer: "box", button: "square", buttonLabel: "Ask" },
    chat: { title: "Lantern", subtitle: "your reading desk", bubble: { fill: "#353a43", ink: "#f3ede0" }, reply: { fill: "#272b32", ink: "#f3ede0" } },
  },
  asks: [
    { prompt: "which sources disagree?", plate: sources, label: "Your sources, mapped" },
    { kind: "ui", ui: library, split: [{ text: "Then it cites", style: "ink", color: LANTERN.ink }, { text: "every page.", style: "ink", color: LANTERN.accent }] },
  ],
  words: [[{ text: "READ LESS.", style: "ink", color: LANTERN.ink }, { text: "KNOW MORE.", style: "ink", color: LANTERN.accent }]],
  tagline: "A reading desk that keeps your sources straight",
  install: ["npm install lantern"],
  footer: "lantern.example",
  // THE DECLARATIONS ship reads (node tools/ship.mjs), filled for this made-up product as a worked example
  motion: { temperament: "lively", brandColors: [LANTERN.accent, LANTERN.ink] },
  claims: [],
  checks: {
    length: { target: 22, max: 25 },
    // the split beat IS the product's own library beside its two words: its rows are what the viewer came to see
    layoutExempt: [[560, 960, "the library beat: the product's own rows beside its two words"]],
    // the critic's record is reviews/launchExampleBrand.json, this example's own
  },
  bpm: 90, askBeats: 8, typeBeats: 6, endBeats: 8, claimBar: 6,
  // the clean example's score (a made-up product and brief); a real film composes its own
  score: tallyScore,
});
