// DOCS-CHECK. Prose rots where code does not: a style gets added and the READMEs still say nine.
// This is the part of the build that notices. It holds SKILL.md to its own size limits, holds
// every style-count claim in SKILL.md and the six READMEs to the live registry count, and holds
// every references/ or engine/ path SKILL.md cites to the filesystem. The count is measured,
// never typed here.
//   node tools/docs-check.mjs
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry, ROOT } from "./registry.mjs";

const registry = loadRegistry(), COUNT = registry.length;
let fails = 0;
const say = (ok, label, detail = "") => { if (!ok) fails++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? "   " + detail : ""}`); };
console.log(`DOCS-CHECK   ${ROOT}\n             registry: ${COUNT} styles\n`);

// ---------------------------------------------------- 1. SKILL.md holds its own shape
const skillFile = join(ROOT, "SKILL.md"), skill = readFileSync(skillFile, "utf8");
const lines = skill.endsWith("\n") ? skill.split("\n").length - 1 : skill.split("\n").length;
say(lines <= 150, `SKILL.md is ${lines} lines`, "limit 150");
const desc = skill.match(/^---\n[\s\S]*?\n---/)?.[0].match(/^description:\s*(.+)$/m)?.[1].trim();
if (!desc) say(false, "SKILL.md frontmatter has a description");
else { const w = desc.split(/\s+/).length, t = Math.round(w * 1.3); say(t <= 50, `frontmatter description: ${w} words ≈ ${t} tokens`, "limit 50"); }

// ---------------------------------------------------- 2. every claimed style count is true
// A claim is a number sitting next to the word for style. Numbers are digits, or words in the
// file's own language — picked by the README's locale so Spanish "once" (eleven) can never be
// read in an English sentence. Indefinite articles (un, une, a) are not numbers here.
const STYLE_WORD = /(\bstyles?\b|\bestilos?\b|\bstile\b|スタイル|스타일|风格|樣式|样式)/gi;
const WORDS = {
  en: { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 },
  es: { dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 },
  fr: { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12 },
  ko: { 둘: 2, 셋: 3, 넷: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열하나: 11, 열두: 12 },
  cjk: { 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 两: 2, 十一: 11, 十二: 12 },
};
const langOf = (f) => (f.match(/README\.([a-z]{2})-/i)?.[1] ?? "en").toLowerCase();
const lexicon = (f) => ({ ...WORDS.en, ...(WORDS[langOf(f)] ?? {}), ...(f.includes("-CN") || f.includes("-JP") ? WORDS.cjk : {}) });
const numRe = (lex) => {
  const lat = Object.keys(lex).filter((k) => /^[a-z]+$/i.test(k)), han = Object.keys(lex).filter((k) => /^[가-힣]+$/.test(k)), cjk = Object.keys(lex).filter((k) => !/^[a-z가-힣]+$/i.test(k));
  return new RegExp(`(\\d[\\d.,]*\\d|\\d)|(\\b(?:${lat.join("|")})\\b)${han.length ? `|((?<![가-힣])(?:${han.join("|")})(?![가-힣]))` : ""}${cjk.length ? `|(${cjk.join("|")})` : ""}`, "gi");
};
const numVal = (tok, lex) => /^\d/.test(tok) ? parseInt(tok.replace(/[.,]/g, ""), 10) : lex[tok.toLowerCase()];

const docs = ["SKILL.md", ...readdirSync(ROOT).filter((f) => /^README.*\.md$/.test(f)).sort()];
const WINDOW = 45;
let claims = 0;
for (const doc of docs) {
  const path = join(ROOT, doc), lex = lexicon(doc), NUM = numRe(lex);
  readFileSync(path, "utf8").split("\n").forEach((line, i) => {
    const spots = [...line.matchAll(STYLE_WORD)].map((m) => [m.index, m.index + m[0].length]);
    if (!spots.length) return;
    const seen = new Set();
    for (const m of line.matchAll(NUM)) {
      const v = numVal(m[0], lex);
      if (v == null || v < 2 || v > 99 || seen.has(v)) continue;
      if (/^\d/.test(m[0])) { const a = line[m.index + m[0].length]; if (a === "." || a === ")" || (line[m.index - 1] === "(" && a === ")")) continue; } // an ordinal or step marker (3., (3)), not a count
      const near = spots.some(([s0, s1]) => Math.max(0, s0 - (m.index + m[0].length), m.index - s1) <= WINDOW);
      if (!near) continue;
      seen.add(v); claims++;
      say(v === COUNT, `${doc}:${i + 1} claims ${v} styles`, `registry has ${COUNT}`);
    }
  });
}
if (!claims) say(false, "found any style-count claim at all", "the check would pass vacuously — that itself is a bug");

// ---------------------------------------------------- 3. every path SKILL.md cites exists
const PATH = /(?:references|engine)\/[A-Za-z0-9._~\/-]+/g;
let cited = 0;
skill.split("\n").forEach((line, i) => {
  for (const m of line.matchAll(PATH)) {
    const p = m[0].replace(/[.,/]+$/, "");
    cited++;
    say(existsSync(join(ROOT, p)), `SKILL.md:${i + 1} ${p}`);
  }
});
if (!cited) say(false, "found any references/ or engine/ path in SKILL.md");

console.log(`\n${fails ? `DOCS: FAIL   ${fails} failure${fails === 1 ? "" : "s"}` : "DOCS: PASS"}`);
process.exit(fails ? 1 : 0);
