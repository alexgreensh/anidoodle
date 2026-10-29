// BRAND TESTS. The brand import reads SVG exports into exact paths and measures what the marks can do
// in motion; the inventory makes "is X in the design file?" a search; the kit refuses to squash a brand
// mark. Held to known answers, with the failing cases (red fixtures) beside the passing ones.
// @ts-ignore: plain ES modules shared with the tools
import { parsePath, flatten, bboxOf, importSvg, symmetry, repeats, logoMetrics, monochrome, toSvg, parseTransform, apply, brandModule, equaliseLogos, inkArea } from "../tools/brandsvg.mjs";
// @ts-ignore
import { framesFromFigma, framesFromFiles, renderInventory, parseInventory, checkInventory, findInInventory, motionTokens } from "../tools/brandinv.mjs";
import { drawEl, distortion, placeEl, type BrandElement } from "../src/canvas-core/brandKit";

const near = (a: number, b: number, e = 0.01) => Math.abs(a - b) <= e;
// the hourglass: two dots joined by an S-curve neck, the same after a half turn (built from two quarter circles and a bar)
const HOURGLASS = `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="50" cy="50" r="40" fill="#FFD900"/><circle cx="150" cy="150" r="40" fill="#FFD900"/><path d="M60 70 C100 70 100 110 140 110 L140 130 C100 130 100 90 60 90 Z" fill="#FFD900"/></svg>`;
const ELL = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><path d="M0 0H20V80H100V100H0Z" fill="#111"/></svg>`;
const FRIEZE = `<svg width="400" height="50" xmlns="http://www.w3.org/2000/svg">${[0, 1, 2, 3].map((i) => `<rect x="${i * 100}" y="0" width="60" height="50" fill="${i % 2 ? "#ff00aa" : "#ff6a00"}"/>`).join("")}</svg>`;

export const name = "brand";
export const run = (ok: (cond: boolean, label: string) => void) => {
  // ---- path data: relatives, shorthands and compact arc flags resolve to absolute commands
  const cmds = parsePath("m10 10 h20 v20 h-20 z M0 0 l5 5 s 5 5 10 0 a5 5 0 015 5");
  ok(cmds[0].join(",") === "M,10,10" && cmds[1].join(",") === "L,30,10" && cmds[2].join(",") === "L,30,30" && cmds[3].join(",") === "L,10,30", "relative m h v resolve to absolute points");
  ok(cmds.find((c: unknown[]) => c[0] === "A")?.join(",") === "A,5,5,0,0,1,20,10", "a compact arc 'a5 5 0 015 5' reads its flags as single digits");
  let threw = ""; try { parsePath("M0 0 L x"); } catch (e) { threw = String(e); }
  ok(/bad path data/.test(threw), "NEGATIVE: unreadable path data throws with where it broke");
  const circle = bboxOf(flatten("M10 50 A40 40 0 1 0 90 50 A40 40 0 1 0 10 50 Z"));
  ok(near(circle[0], 10, 0.2) && near(circle[2], 80, 0.5) && near(circle[3], 80, 0.5), `an arc circle's box is its diameter (${circle.map((v: number) => v.toFixed(1))})`);
  ok(apply(parseTransform("translate(10 20) scale(2)"), 1, 1).join(",") === "12,22", "transforms compose left to right as SVG does");

  // ---- the import: viewBox, classes, <use>, gradients in object-box units, warnings
  const svg = `<svg width="200" height="100" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg"><style>.a{fill:#FFDE59}</style>
<defs><linearGradient id="g"><stop offset="0" stop-color="red"/><stop offset="100%" stop-color="#00f" stop-opacity=".5"/></linearGradient><path id="dot" d="M0 0h10v10H0z"/></defs>
<g transform="translate(10 0)"><rect class="a" width="100" height="50"/><circle cx="200" cy="100" r="40" fill="url(#g)"/><use href="#dot" x="300" y="20"/></g></svg>`;
  const el = importSvg(svg);
  ok(el.w === 200 && el.h === 100 && el.parts.length === 3, `three parts in a 200x100 element (${el.parts.length})`);
  ok(el.parts[0].fill.c === "#ffde59" && el.parts[0].bb.join(",") === "5,0,50,25", `a <style> class fills the rect, and the viewBox halves its box (${el.parts[0].bb})`);
  ok(el.parts[0].d.startsWith("M0 0H100") && el.parts[0].m.join(",") === "0.5,0,0,0.5,5,0", "the path is kept as exported; the transform is a matrix beside it, never baked into new path data");
  const g = el.parts[1].fill;
  ok(g.type === "lin" && g.stops[0][1] === "#ff0000" && g.stops[1][2] === 0.5 && g.m.join(",") === "80,0,0,80,160,60", "an object-box gradient is mapped onto the shape's own box, stops and alpha kept");
  ok(el.parts[2].bb.join(",") === "155,10,5,5", "<use> places its target at x, y");
  ok(!el.warnings.length, "a clean export raises no warnings");
  const masked = importSvg(`<svg width="10" height="10"><mask id="m"><rect width="5" height="5" fill="#888"/></mask><rect width="10" height="10" mask="url(#m)"/><text font-family="Brand Grotesk">Hi</text><image href="x.png"/></svg>`);
  ok(masked.warnings.some((w: string) => /mask/.test(w)) && masked.warnings.some((w: string) => /live text/.test(w)) && masked.warnings.some((w: string) => /raster image/.test(w)), "RED: a mask, live text and an embedded image are each named, never silently dropped");
  const hard = importSvg(`<svg width="10" height="10"><mask id="m"><rect width="5" height="10" fill="#fff"/></mask><rect width="10" height="10" mask="url(#m)"/></svg>`);
  ok(!hard.warnings.length && hard.parts[0].clip?.paths[0].d.startsWith("M0 0H5"), "a hard white mask is imported as a clip, exactly");
  ok(masked.fonts.includes("Brand Grotesk"), "the live text's font is listed so it can be asked for early");
  const clipped = importSvg(`<svg width="10" height="10"><clipPath id="c"><circle cx="5" cy="5" r="5"/></clipPath><rect width="10" height="10" clip-path="url(#c)" fill="#000"/></svg>`);
  ok(clipped.parts[0].clip?.paths.length === 1, "a clip-path is carried onto the part, not dropped");
  let notSvg = ""; try { importSvg("<html></html>"); } catch (e) { notSvg = String(e); }
  ok(/no <svg>/.test(notSvg), "NEGATIVE: a file with no <svg> is refused");

  // ---- what the marks can do in motion
  const hg = importSvg(HOURGLASS), ell = importSvg(ELL);
  ok(symmetry(hg).rotational === 2, `the hourglass is the same after a half turn, so it can land from a spin without a jump (${JSON.stringify(symmetry(hg))})`);
  ok(symmetry(ell).rotational === 1 && !symmetry(ell).mirrorX, "NEGATIVE: an L shape has no rotational or mirror symmetry");
  const fr = repeats(importSvg(FRIEZE));
  ok(fr.some((r: { what: string; copies: number; step: number[]; seamless: boolean }) => r.what === "shape" && r.copies === 4 && r.step[0] === 100 && r.seamless), `the frieze's marks repeat every 100 units and tile without a seam (${JSON.stringify(fr)})`);
  ok(fr.some((r: { what: string; step: number[] }) => r.what === "pattern" && r.step[0] === 200), "its two-colour pattern repeats every 200 units");
  ok(!repeats(ell).length, "NEGATIVE: a single L shape has no repeat");

  // ---- logos: ink, overlapping outlines (check with the owner), a one-colour version
  const two = importSvg(`<svg width="100" height="20"><rect x="0" width="40" height="20"/><rect x="60" width="40" height="20"/></svg>`);
  const shared = importSvg(`<svg width="100" height="20"><rect x="0" width="60" height="20"/><rect x="40" width="60" height="20"/></svg>`);
  ok(near(logoMetrics(two).ink, 1600) && logoMetrics(two).overlaps === 0, `ink is the filled area (${logoMetrics(two).ink})`);
  ok(logoMetrics(shared).overlaps === 1, "RED: two outlines that cross are flagged 'check with the owner' (a wordmark that shares strokes may be the design)");
  ok(near(inkArea(flatten("M0 0H10V10H0Z M2 2V8H8V2Z")), 64), "a counter-wound hole is subtracted from the ink");
  const white = monochrome(hg, "#ffffff");
  ok(white.parts.every((p: { fill: { c: string } }) => p.fill.c === "#ffffff") && /viewBox="10 10 180 180"/.test(toSvg(white, { tight: true })), "a mono logo for a dark ground, written with a viewBox trimmed to its ink");
  const eq = equaliseLogos([{ name: "a", h: 10, ink: 100 }, { name: "b", h: 10, ink: 25 }, { name: "c", h: 10, ink: 50 }], 80);
  ok(eq[1].height > eq[2].height && eq[2].height === 80 && eq[0].height < 80, `a light logo is drawn taller and a heavy one shorter so they read equally (${eq.map((l: { height: number }) => l.height)})`);

  // ---- the brand module a film imports
  const mod = brandModule({ elements: { mark: hg }, palette: [{ hex: "#ffd900", share: 1 }], fonts: [], motion: {} }, "./brandKit");
  ok(/export const BRAND/.test(mod) && /export const brandMeta = \{"colors":\["#ffd900"\],"elements":\["mark"\]\}/.test(mod), "the module exports BRAND and brandMeta (colours and element names for meta.brand)");
  ok(/export const brandMotion = \{"brandColors":\["#ffd900"\]\}/.test(mod), "and brandMotion, the brand colours in the shape meta.motion reads (layerscan's translucent check)");

  // ---- inventory: every frame listed, find answers from all of it, check holds the read marks
  const file = { document: { children: [
    { name: "Brand", children: [{ id: "1:2", name: "Logo lockup", type: "FRAME", absoluteBoundingBox: { width: 1197, height: 496 }, children: [] }] },
    { name: "Social", children: [{ id: "4:7", name: "Social Media partners", type: "FRAME", absoluteBoundingBox: { width: 1080, height: 1080 }, children: [{ type: "TEXT", characters: "Thank you to our sponsors" }],
      interactions: [{ actions: [{ transition: { type: "SMART_ANIMATE", duration: 0.5, easing: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1: 0, y1: 0, x2: 0.58, y2: 1 } } } }] }] }] },
  ] } };
  const inv = framesFromFigma(file);
  ok(inv.frames.length === 2 && inv.frames[1].text.includes("sponsors"), "every top-level frame on every page is listed, with the words on it");
  const tok = motionTokens(inv.motion);
  ok(tok.socialMediaPartners?.ms === 500 && tok.socialMediaPartners.ease.join(",") === "0,0,0.58,1", `the file's own transition timing becomes a named motion token in motionKit's shape (${JSON.stringify(tok)})`);
  ok(motionTokens([{ ms: 300, easing: "spring(mass 1, stiffness 100, damping 15)", from: ["x"] }])._springs.length === 1, "NEGATIVE: a spring easing is set aside for a person, never turned into a guessed curve");
  const md = renderInventory("test", inv.frames), rows = parseInventory(md);
  ok(rows.length === 2 && rows[0].mark === "[ ]", "the inventory page has one unticked read box per frame");
  ok(findInInventory(rows, "sponsor").length === 1 && findInInventory(rows, "partners").length === 1, "find matches a frame by its words ('sponsor') as well as its name ('partners')");
  ok(findInInventory(rows, "speaker photos").length === 0, "NEGATIVE: a word in no frame finds nothing, and the tool says how many frames it searched");
  const red = checkInventory(rows);
  ok(red.status === "FAIL" && red.unread.length === 2, "RED: check fails while frames are unread");
  const marked = parseInventory(renderInventory("test", inv.frames, new Map([["1:2", "[x]"], ["4:7", "[-]"]])));
  ok(checkInventory(marked).status === "FAIL" && checkInventory(marked).bareSkips.length === 1, "RED: a skip with no reason fails");
  const green = parseInventory(renderInventory("test", inv.frames, new Map([["1:2", "[x]"], ["4:7", "[-] social crops of the lockup, same elements"]])));
  ok(checkInventory(green).status === "PASS", "every frame read or skipped with a reason passes");
  ok(checkInventory([]).status === "FAIL", "NEGATIVE: an empty inventory is never a pass");
  // M8: a mark that is not exactly [x] or "[-] reason" was never read, so it fails
  for (const bad of ["[]", "[  ]", "[?]", "[o]", "[-]reason"]) {
    const rowsBad = [{ mark: "[x]", page: "p", name: "a", id: "1", words: "" }, { mark: bad, page: "p", name: "b", id: "2", words: "" }];
    ok(checkInventory(rowsBad).status === "FAIL", `RED (M8): a row marked ${JSON.stringify(bad)} is not read and fails the check`);
  }
  ok(checkInventory([{ mark: "[X]", page: "p", name: "a", id: "1", words: "" }]).status === "PASS", "GREEN (M8): a capital [X] counts as read");
  ok(framesFromFiles(["b.svg", "a.png", ".DS_Store"]).map((f: { name: string }) => f.name).join(",") === "a,b", "a folder of exports is an inventory too, one row per file");

  // ---- the kit: brand marks are moved, never squashed
  (globalThis as unknown as { Path2D: unknown }).Path2D = class { constructor(public d?: string) {} addPath() {} };
  const calls: string[] = [];
  const ctx = (m: { a: number; b: number; c: number; d: number; e?: number; f?: number }) => ({ globalAlpha: 0.5, getTransform: () => m, save() {}, restore() {}, transform() {}, translate() {}, rotate() {}, scale() {}, fill(this: { globalAlpha: number }) { calls.push(`fill@${this.globalAlpha}`); }, set fillStyle(_v: unknown) {} }) as unknown as CanvasRenderingContext2D;
  const mark: BrandElement = { w: 10, h: 10, parts: [{ d: "M0 0H10V10H0Z", fill: { type: "solid", c: "#ffd900" }, rule: "nonzero", op: 1, bb: [0, 0, 10, 10] }] };
  let squash = ""; try { drawEl(ctx({ a: 1.3, b: 0, c: 0, d: 0.8 }), mark, { name: "dot" }); } catch (e) { squash = String(e); }
  ok(/non-uniform scale/.test(squash) && /'dot'/.test(squash) && /allowSquash/.test(squash), "RED: drawing a brand mark squashed throws, naming the element and the way out");
  let skew = ""; try { drawEl(ctx({ a: 1, b: 0, c: 0.4, d: 1 }), mark); } catch (e) { skew = String(e); }
  ok(/skew/.test(skew), "RED: a skewed brand mark throws");
  let allowed = true; try { drawEl(ctx({ a: 1.3, b: 0, c: 0, d: 0.8 }), mark, { allowSquash: "crushed by the falling chat window" }); } catch { allowed = false; }
  ok(allowed, "a squash that names its gag is drawn");
  const r = Math.PI / 5, rot = { a: 2 * Math.cos(r), b: 2 * Math.sin(r), c: -2 * Math.sin(r), d: 2 * Math.cos(r) };
  ok(distortion(rot).squash < 1e-9 && Math.abs(distortion(rot).skew) < 1e-9, "a rotation with an even scale is not a distortion");
  calls.length = 0; drawEl(ctx(rot), mark, { alpha: 0.5 });
  ok(calls[0] === "fill@0.25", `the caller's alpha is multiplied, never reset (a fade of a brand group keeps working) (${calls[0]})`);
  // the frame probe sees brand marks (layerscan's shape-over-a-face check reads these boxes)
  const recs: { kind: string; label: string; x0: number; y0: number; x1: number; y1: number }[] = [];
  (globalThis as unknown as { __ANIDOODLE_PROBE__?: unknown }).__ANIDOODLE_PROBE__ = (r: (typeof recs)[number]) => recs.push(r);
  drawEl(ctx({ a: 2, b: 0, c: 0, d: 2, e: 100, f: 50 } as never), mark, { name: "dot" });
  ok(recs.length === 1 && recs[0].kind === "box" && recs[0].label === "brand:dot" && recs[0].x0 === 100 && recs[0].y0 === 50 && recs[0].x1 === 120 && recs[0].y1 === 70, `drawEl reports the mark's on-screen box to the frame probe (${JSON.stringify(recs[0])})`);
  recs.length = 0; drawEl(ctx({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } as never), mark, { name: "dot", env: { root: false } as never });
  ok(recs.length === 0, "drawn on a plate (env not the frame's root) it reports nothing, as probeRect does");
  recs.length = 0; drawEl(ctx({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } as never), mark, { probe: false });
  ok(recs.length === 0, "probe: false keeps a mark out of the probe");
  delete (globalThis as unknown as { __ANIDOODLE_PROBE__?: unknown }).__ANIDOODLE_PROBE__;
  recs.length = 0; drawEl(ctx({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } as never), mark);
  ok(recs.length === 0, "with no probe installed nothing is reported (no cost)");
  let placed = true; try { placeEl(ctx({ a: 1, b: 0, c: 0, d: 1 }), mark, { x: 50, y: 50, h: 40, rot: 1 }); } catch { placed = false; }
  ok(placed, "placeEl places by centre and height, uniform by construction");
};
