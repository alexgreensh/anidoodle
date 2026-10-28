// THREE TYPE TESTS. src/three-core/ttf.ts reads TrueType with no library; type3d.ts turns glyphs
// into extruded letters. Held here against the bundled Poppins Bold AND a tiny font built byte by
// byte below, whose every point is known: implied on-curve points, a composite, kern format 0.
//   node tools/test.mjs threeType
import * as THREE from "three";
import type { Env } from "../src/canvas-core/core";
import { fontBytes, parseTTF, toQuads, type Contour } from "../src/three-core/ttf";
import { creaseNormals, defaultFont, glyphShapes, layoutText, nestContours, text3d, visibleGlyphs } from "../src/three-core/type3d";
import { POPPINS_BOLD, POPPINS_BOLD_BYTES, POPPINS_BOLD_FNV } from "../assets/fonts/poppinsBold";

// ---- a minimal TrueType font: .notdef, "a" (two contours), "b" (a composite of "a"), kern a-b
const tinyFont = (o: { sig?: number } = {}) => {
  const w = () => { const b: number[] = []; const api = { b, u8: (v: number) => (b.push(v & 255), api), u16: (v: number) => (b.push((v >> 8) & 255, v & 255), api), i16: (v: number) => api.u16(v & 0xffff), u32: (v: number) => (b.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255), api) }; return api; };
  // glyph 1: contour 0 = four OFF-curve points (a diamond: every on-curve point is implied);
  //          contour 1 = on, off, off, on (one implied on-curve point between the two offs)
  const pts: [number, number, boolean][] = [[0, 50, false], [50, 100, false], [100, 50, false], [50, 0, false], [200, 0, true], [300, 0, false], [300, 100, false], [200, 100, true]];
  const g1 = w().i16(2).i16(0).i16(0).i16(300).i16(100).u16(3).u16(7).u16(0);
  pts.forEach((p) => g1.u8(p[2] ? 1 : 0));
  let px = 0; pts.forEach((p) => { g1.i16(p[0] - px); px = p[0]; });
  let py = 0; pts.forEach((p) => { g1.i16(p[1] - py); py = p[1]; });
  // glyph 2: glyph 1 at half size, moved right 1000 (words, xy values, one scale)
  const g2 = w().i16(-1).i16(0).i16(0).i16(1150).i16(50).u16(0x0001 | 0x0002 | 0x0008).u16(1).i16(1000).i16(0).i16(8192);
  const glyphs = [[], g1.b, g2.b].map((g) => (g.length % 2 ? [...g, 0] : g));
  const glyf = glyphs.flat(), loca = w(); let off = 0; for (const g of glyphs) { loca.u32(off); off += g.length; } loca.u32(off);
  const head = w(); for (let i = 0; i < 54; i++) head.u8(0); head.b[18] = 1000 >> 8; head.b[19] = 1000 & 255; head.b[51] = 1; // unitsPerEm 1000, long loca
  const maxp = w().u32(0x00005000).u16(3);
  const hhea = w(); for (let i = 0; i < 36; i++) hhea.u8(0); hhea.b[4] = 800 >> 8; hhea.b[5] = 800 & 255; hhea.b[35] = 3;
  const hmtx = w().u16(500).i16(0).u16(600).i16(0).u16(700).i16(0);
  const cmap = w().u16(0).u16(1).u16(3).u16(1).u32(12)
    .u16(4).u16(32).u16(0).u16(4).u16(4).u16(1).u16(0)
    .u16(98).u16(0xffff).u16(0).u16(97).u16(0xffff).i16(1 - 97).i16(1).u16(0).u16(0);
  const kern = w().u16(0).u16(1).u16(0).u16(20).u16(0x0001).u16(1).u16(6).u16(0).u16(0).u16(1).u16(2).i16(-40);
  const tables: [string, number[]][] = [["cmap", cmap.b], ["glyf", glyf], ["head", head.b], ["hhea", hhea.b], ["hmtx", hmtx.b], ["kern", kern.b], ["loca", loca.b], ["maxp", maxp.b]];
  const dir = w().u32(o.sig ?? 0x00010000).u16(tables.length).u16(0).u16(0).u16(0);
  let at = 12 + 16 * tables.length; const body: number[] = [];
  for (const [t, d] of tables) { dir.u8(t.charCodeAt(0)).u8(t.charCodeAt(1)).u8(t.charCodeAt(2)).u8(t.charCodeAt(3)).u32(0).u32(at).u32(d.length); const pad = (4 - (d.length % 4)) % 4; body.push(...d, ...new Array(pad).fill(0)); at += d.length + pad; }
  return new Uint8Array([...dir.b, ...body]);
};

export const name = "threeType";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const throwsWith = (fn: () => unknown, re: RegExp) => { try { fn(); return false; } catch (e) { return re.test(String((e as Error).message)); } };
  const cp = (s: string) => s.codePointAt(0)!;

  // 1. the bundled font is the pinned file, and it is the OFL Poppins Bold it claims to be
  const bytes = fontBytes(POPPINS_BOLD);
  let h = 0x811c9dc5; for (const x of bytes) { h ^= x; h = Math.imul(h, 0x01000193); }
  ok(bytes.length === POPPINS_BOLD_BYTES && h >>> 0 === POPPINS_BOLD_FNV, `the base64 module decodes to the pinned file (${bytes.length} bytes, fnv ${(h >>> 0).toString(16)})`);
  const f = defaultFont();
  ok(f.family === "Poppins" && f.style === "Bold", `family and style read from the name table (${f.family} ${f.style})`);
  ok(/SIL Open Font License, Version 1\.1/.test(f.license), "the font's own licence string says SIL OFL 1.1");
  ok(f.unitsPerEm === 1000 && f.numGlyphs === 1060, `units per em and glyph count (${f.unitsPerEm}, ${f.numGlyphs})`);
  ok(f.capHeight > 680 && f.capHeight < 720 && f.xHeight > 520 && f.xHeight < 580, `cap and x height from OS/2 (${f.capHeight}, ${f.xHeight})`);
  ok(defaultFont() === f, "defaultFont parses once and hands back the same font");

  // 2. advances and outlines on known letters
  const g = (s: string) => f.glyph(f.glyphIndex(cp(s)));
  ok(g("A").advance === 737 && g("o").advance === 637 && g("H").advance === 731 && g(" ").advance === 212, `advance widths A o H space = 737 637 731 212 (${g("A").advance} ${g("o").advance} ${g("H").advance} ${g(" ").advance})`);
  ok(g("o").contours.length === 2 && g("A").contours.length === 2 && g("B").contours.length === 3 && g("H").contours.length === 1, "contour counts: o 2, A 2, B 3, H 1");
  ok(g(" ").contours.length === 0 && f.glyphIndex(0x10ffff) === 0, "space has no outline; an unmapped character maps to glyph 0");
  ok(g("o").contours.every((c) => c[0][0] === "M" && c.slice(1).every((s) => s[0] === "L" || s[0] === "Q")), "every contour is an M followed by L/Q segments");
  ok(g("o").contours.flat().some((s) => s[0] === "Q"), "curved letters carry quadratic segments");
  const A = g("A"), ring = g("Å");
  ok(ring.contours.length === 4 && ring.advance === A.advance && ring.bbox[0] === A.bbox[0], `the composite Å = A + ring: 4 contours, A's advance and left edge (${ring.contours.length})`);
  ok(f.kerning(f.glyphIndex(cp("A")), f.glyphIndex(cp("V"))) === 0, "Poppins carries no kerning: pairs read 0 (the parser's kern paths are proved on the tiny font)");

  // 3. the tiny font: implied on-curve points, composite transform, kern format 0, cmap format 4
  const t = parseTTF(tinyFont());
  ok(t.numGlyphs === 3 && t.glyphIndex(cp("a")) === 1 && t.glyphIndex(cp("b")) === 2 && t.glyphIndex(cp("c")) === 0, "tiny font: cmap format 4 maps a->1, b->2, c->0");
  const ga = t.glyph(1);
  const diamond = ga.contours[0], bump = ga.contours[1];
  ok(diamond[0][0] === "M" && diamond[0][1] === 25 && diamond[0][2] === 75, "an all-off-curve contour starts at the midpoint of its first two points (25, 75)");
  ok(diamond.length === 5 && diamond.slice(1).every((s) => s[0] === "Q"), "and is four quadratics, one per off-curve point");
  ok(JSON.stringify(diamond[1]) === JSON.stringify(["Q", 50, 100, 75, 75]), "each implied on-curve point sits halfway between two offs (75, 75)");
  ok(JSON.stringify(bump) === JSON.stringify([["M", 200, 0], ["Q", 300, 0, 300, 50], ["Q", 300, 100, 200, 100]]), "on, off, off, on: one implied point at (300, 50); the closing edge is implicit");
  const gb = t.glyph(2);
  ok(gb.contours.length === 2 && gb.contours[0][0][1] === 1012.5 && gb.contours[0][0][2] === 37.5, `a composite applies its scale and offset (first point ${gb.contours[0][0].slice(1)})`);
  ok(ga.advance === 600 && gb.advance === 700, "advances from hmtx");
  ok(t.kerning(1, 2) === -40 && t.kerning(2, 1) === 0, "kern format 0: the a-b pair reads -40, b-a reads 0");
  const lay = layoutText(t, "ab", { align: "left" });
  ok(lay.glyphs[1].x === 600 - 40 && lay.width === 600 - 40 + 700, `layout applies kerning (${lay.glyphs[1].x}, width ${lay.width})`);
  ok(layoutText(t, "ab", { align: "left", kerning: false }).glyphs[1].x === 600, "kerning: false leaves it out");
  ok(toQuads([{ x: 0, y: 0, on: true }, { x: 10, y: 0, on: true }, { x: 10, y: 10, on: true }]).length === 3, "a straight triangle is M L L (the closing edge implied)");

  // 4. RED fixtures: what a film must never get past silently
  ok(throwsWith(() => parseTTF(tinyFont({ sig: 0x4f54544f })), /CFF outlines; use a TrueType \.ttf/), "an OTTO (CFF) font is refused: 'this font has CFF outlines; use a TrueType .ttf'");
  ok(throwsWith(() => parseTTF(bytes.slice(0, 40000)), /truncated/), "a truncated font is refused, naming the table cut short");
  ok(throwsWith(() => parseTTF(bytes.slice(0, 8)), /not a font file/), "8 bytes is not a font");
  ok(throwsWith(() => parseTTF(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0, 0, 0, 0, 0])), /WOFF2/), "a WOFF2 web font is refused with a pointer to the .ttf");

  // 5. holes by containment, whatever the winding
  const sq = (x0: number, y0: number, s: number, cw: boolean): Contour => { const p: [number, number][] = [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s]]; if (cw) p.reverse(); return [["M", ...p[0]], ...p.slice(1).map((q) => ["L", ...q] as ["L", number, number])]; };
  ok(JSON.stringify(nestContours([sq(0, 0, 100, false), sq(25, 25, 50, false)])) === JSON.stringify([{ outer: 0, holes: [1] }]), "a counter drawn with the SAME winding as its outline is still a hole");
  const island = nestContours([sq(0, 0, 100, true), sq(20, 20, 60, true), sq(40, 40, 20, true)]);
  ok(island.length === 2 && island[0].holes[0] === 1 && island[1].outer === 2, "an island inside a hole is ink again (depth 2), with its own shape");
  ok(JSON.stringify(nestContours([sq(25, 25, 50, false), sq(0, 0, 100, false)])) === JSON.stringify([{ outer: 1, holes: [0] }]), "order does not matter: the hole listed first still finds its outline");
  const shapes = (s: string) => glyphShapes(f, f.glyphIndex(cp(s)), 0.001);
  ok(shapes("o").length === 1 && shapes("o")[0].holes.length === 1, "Poppins o: one shape with one hole");
  ok(shapes("B").length === 1 && shapes("B")[0].holes.length === 2, "Poppins B: one shape with two holes");
  ok(shapes("i").length === 2 && shapes("i").every((s) => s.holes.length === 0), "Poppins i: two shapes (stem and dot), no holes");
  ok(shapes("%").length === 3 && shapes("%").reduce((a, s) => a + s.holes.length, 0) === 2, "Poppins %: three shapes, two holes");

  // 6. text3d: one mesh per visible glyph, in reading order, centred, cached
  const env = { W: 1920, H: 1080, scale: 1, cache: new Map(), canvas: () => { throw new Error("no canvas in node"); } } as unknown as Env;
  const word = text3d(env, f, "now in 3D", { size: 1 });
  const L = word.userData.letters;
  ok(L.length === 7 && word.children.length === 7 && L.map((m) => m.userData.char).join("") === "nowin3D", `"now in 3D" gives 7 letter meshes, spaces skipped (${L.map((m) => m.userData.char).join("")})`);
  ok(L.length === visibleGlyphs(f, layoutText(f, "now in 3D")).length, "letter count equals the visible glyphs of the layout");
  ok(L.every((m, i) => i === 0 || m.userData.home.x > L[i - 1].userData.home.x), "letters run left to right, so a stagger by index reads in order");
  ok(L.every((m) => m.position.equals(m.userData.home)), "each letter starts at its home position");
  const box = new THREE.Box3().setFromObject(word), mid = box.getCenter(new THREE.Vector3());
  ok(Math.abs(mid.x) < 0.02 && Math.abs(mid.z) < 1e-6, `centred: the block's middle sits at x 0, z 0 (${mid.x.toFixed(3)}, ${mid.z.toFixed(3)})`);
  const dBox = new THREE.Box3().setFromObject(L[6]);
  ok(Math.abs(dBox.max.y + dBox.min.y) < 0.02, `capitals centre on y 0 (the D spans ${dBox.min.y.toFixed(3)} to ${dBox.max.y.toFixed(3)})`);
  ok(text3d(env, f, "now in 3D", { size: 1 }) === word && text3d(env, f, "now in 3D", { size: 2 }) !== word, "the same call returns the same group; other options build another");
  const left = text3d(env, f, "ab", { align: "left" }), right = text3d(env, f, "ab", { align: "right" });
  ok(new THREE.Box3().setFromObject(left).min.x > -0.05 && new THREE.Box3().setFromObject(right).max.x < 0.05, "align left starts at x 0, align right ends at x 0");
  const anid = text3d(env, f, "anidoodle", { depth: 0.25, bevel: 0.02 });
  ok(anid.userData.letters.length === 9, "anidoodle: 9 letters");
  const an = anid.userData.letters;
  ok(an[4].geometry === an[5].geometry && an[3].geometry === an[6].geometry && an[3].geometry !== an[4].geometry, "repeated letters share one geometry (the o's, the d's): built once per glyph");
  const gz = new THREE.Box3().setFromObject(anid.userData.letters[0]);
  ok(Math.abs(gz.max.z - gz.min.z - 0.25 - 0.04) < 1e-3, `depth plus two bevels: ${(gz.max.z - gz.min.z).toFixed(3)} = 0.25 + 2 x 0.02`);
  const nrm = anid.userData.letters[0].geometry.getAttribute("normal");
  let unit = true; for (let i = 0; i < nrm.count; i++) if (Math.abs(Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i)) - 1) > 1e-4) unit = false;
  ok(unit, "creased normals are unit length");
  // creaseNormals: the 90 degree corner of a box stays sharp, a 10 degree bend is smoothed
  const bx = creaseNormals(new THREE.BoxGeometry(1, 1, 1).toNonIndexed());
  const bn = bx.getAttribute("normal"); let sharp = true; for (let i = 0; i < bn.count; i++) { const v = [Math.abs(bn.getX(i)), Math.abs(bn.getY(i)), Math.abs(bn.getZ(i))].sort(); if (v[2] < 0.9999) sharp = false; }
  ok(sharp, "a box's 90 degree edges keep flat face normals (hard edges stay hard)");
};
