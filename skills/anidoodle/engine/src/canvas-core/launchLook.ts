// THE LOOK. A launch film has to look like the product it launches, not like us. The template draws every
// colour, typeface and shape through one resolved look, built here from the spec's `look` block:
//
//   look.base     "drawn" | "clean" | any look registered with registerLook(): the starting point (ink and
//                 blooms with hand lettering, or a quiet canvas with set type), never the only option.
//                 `preset` is the old shorthand for look.base and keeps working.
//   look.from     a brand file from `tools/brand.mjs import` (import brand from "<dir>/brand.json"): its
//                 colours fill the palette and its logo the chat header. Explicit fields always win.
//   look.palette  any of bg, card, ink, soft, mute, line, chip, accent, accentDeep, paper, over the base.
//   look.fonts    { display, text, mono }: each a family name and a local font file, imported by path
//                 (import serif from "../../assets/fonts/MySerif-Bold.ttf"). The file travels inside the
//                 film (no network), is registered as a FontFace before the first frame, and every measure,
//                 wrap and reading time is taken from its own glyph advances, never from another face.
//   look.shape    corner radius, the user bubble (rounded, square, none), the composer (box or bar), the
//                 button's shape and label.
//   look.chat     the chat window as the product draws its own: header on or off, title and subtitle, a
//                 logo (a brand element) in place of the dot, the user bubble's and the answer's colours.
//                 A product with no chat: use `kind: "ui"` asks, its own screen with its command bar.
//
// A custom colour can never make an unreadable film: resolveLook checks every pair the film sets text in
// (WCAG AA: 4.5:1 for body text, 3:1 for large type and the hint text) wherever a pair has a colour the look
// changed, and throws naming the token and the pair.
import { C, SANS, MONO } from "./launchKit";
import { estWidth, monoWidth } from "./launchLayout";
import { parseTTF, type Font } from "../three-core/ttf";
import type { BrandElement } from "./brandKit";

/** A font file as the build carries it: imported by path, its bytes inside the film (tools/overlay.mjs). */
export type FontFile = { path: string; format: "ttf" | "otf" | "woff2"; data: string };
export type LookFont = { family: string; file: FontFile };
export type PaletteKey = "bg" | "card" | "ink" | "soft" | "mute" | "line" | "chip" | "accent" | "accentDeep" | "paper";
export type Palette = Record<PaletteKey, string> & { shadow: string };
export type LookShape = {
  radius?: number;                          // corner radius of the window, the composer and the cards, in layout px (default: the base's)
  bubble?: "rounded" | "square" | "none";   // the user's sent message: a rounded chip, a square one, or plain words
  composer?: "box" | "bar";                 // the input: a box with the button inside, or one rounded bar
  button?: "pill" | "square";               // the send button's shape
  buttonLabel?: string;                     // its word ("Generate", "Ask", "Send")
};
export type LookChat = {
  header?: boolean;                         // the window's header (dot or logo, title, subtitle, rule); false hides it
  title?: string; subtitle?: string;        // the header's words (default: the film's title and subtitle)
  logo?: BrandElement;                      // the product's mark, drawn in place of the dot (a brand.mjs import element)
  bubble?: { fill: string; ink: string };   // the user's sent message
  reply?: { fill: string; ink: string };    // the answer: its card's frame and its byline
};
/** What `tools/brand.mjs import` writes as brand.json (only what a look reads). */
export type BrandFile = { elements: Record<string, { w: number; h: number; parts: readonly unknown[] }>; palette: { hex: string; share: number }[]; fonts?: string[] }; // (as a JSON import types it: parts are brandKit's BrandPart)
export type LaunchLook = {
  base?: string;
  from?: BrandFile;
  palette?: Partial<Record<PaletteKey, string>>;
  fonts?: { display?: LookFont; text?: LookFont; mono?: LookFont };
  shape?: LookShape;
  chat?: LookChat;
};
export type FontFn = (weight: number, px: number) => string;
export type ResolvedLook = {
  base: string;
  clean: boolean;                            // the base's grammar: set type, travels and an iris (clean), or ink (drawn)
  palette: Palette;
  onAccent: string;                          // the label colour on the accent (white unless the accent is pale)
  custom: boolean;                           // anything beyond the base and the legacy accent
  fonts: { display: FontFn; text: FontFn; mono: (px: number) => string };
  /** widths at px, from the chosen face: custom fonts by their own advances, the stock ones by the template's estimates */
  measure: { text: (t: string, px: number) => number; display: (t: string, px: number) => number; mono: (t: string, px: number) => number };
  wrap: (text: string, px: number, maxW: number) => string[];
  wrapDisplay: (text: string, px: number, maxW: number) => string[]; // the same, by the display face (set words)
  customDisplay: boolean;                    // the display face is a font file (measured from it), not the stock set sans
  /** the width of text set in a CSS font string the look made: a custom face by its own advances, else the stock estimate */
  measureFont: (t: string, font: string) => number;
  shape: Required<Omit<LookShape, "radius" | "buttonLabel">> & { radius?: number; buttonLabel?: string };
  chat: LookChat;
  faces: { family: string; file: FontFile }[]; // the font files to register before the first frame
  /** the pointer's colours: the stock black arrow with a white edge, a light arrow with a dark edge on a dark ground */
  pointer: { fill: string; edge: string };
};

// the clean base: a quiet canvas, one accent, type as the design. Our own palette, drawn for it.
export const CLEAN: Palette = { bg: "#f3f2ef", card: "#ffffff", ink: "#15161a", soft: "#5b5f68", mute: "#9da1a9", line: "#e4e4e1", chip: "#efefec", accent: "#2f54eb", accentDeep: "#2442bf", paper: "#fbfbf9", shadow: "rgba(20,24,30,0.08)" };
type LookDef = { clean: boolean; palette: Palette };
const LOOKS = new Map<string, LookDef>([["drawn", { clean: false, palette: C as Palette }], ["clean", { clean: true, palette: CLEAN }]]);
/** A new starting point: a name, the grammar it draws with (clean or drawn), and its palette. */
export const registerLook = (name: string, def: { clean: boolean; palette: Palette }) => { LOOKS.set(name, def); };
export const lookNames = () => [...LOOKS.keys()];

// ---------------------------------------------------------------- colour and contrast (WCAG 2)
const rgb = (hex: string): [number, number, number] => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) throw new Error(`look: colour '${hex}' is not #rrggbb`);
  const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const lum = (hex: string) => { const [r, g, b] = rgb(hex).map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** The contrast ratio of two colours, 1 to 21. */
export const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const sat = (hex: string) => { const [r, g, b] = rgb(hex), mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
/** Every pair the template sets text in: [text token, ground token, the bar, what it is]. */
export const TEXT_PAIRS: [PaletteKey, PaletteKey, number, string][] = [
  ["ink", "card", 4.5, "the chat's words and the product's rows"],
  ["ink", "bg", 4.5, "the word pages and the end card"],
  ["ink", "paper", 4.5, "the typed prompt"],
  ["ink", "chip", 4.5, "the sent message"],
  ["soft", "bg", 4.5, "the tagline and the footer"],
  ["soft", "card", 4.5, "the product's secondary words"],
  ["mute", "paper", 3, "the composer's placeholder (hint text, large-type bar)"],
  ["mute", "card", 3, "the header's subtitle (hint text, large-type bar)"],
  ["accent", "bg", 3, "accent words on the page (large type)"],
];
/** Throws naming the token when a pair the look changed falls under its bar. `changed`: the tokens the look set. */
export const checkContrast = (p: Palette, changed: Set<string>, extra: [string, string, number, string][] = []) => {
  const bad: string[] = [];
  for (const [t, g, bar, what] of TEXT_PAIRS) {
    if (!changed.has(t) && !changed.has(g)) continue;
    const fg = p[t], r = contrast(fg, p[g]);
    if (r < bar) bad.push(`'${t}' ${fg} on '${g}' ${p[g]} is ${r.toFixed(2)}:1, under ${bar}:1 (${what})`);
  }
  for (const [fg, bg, bar, what] of extra) { const r = contrast(fg, bg); if (r < bar) bad.push(`${what}: ${fg} on ${bg} is ${r.toFixed(2)}:1, under ${bar}:1`); }
  if (bad.length) throw new Error(`look: unreadable colours. ${bad.join("; ")}. Change the token named first (a darker ink or a lighter ground) until each pair reaches its bar (WCAG AA)`);
};

/** A brand file's colours as palette tokens: the most saturated as the accent; when the brand has a dark and a
 * light colour, the darkest as ink and the lightest as the ground (or the other way round for a dark brand,
 * whose most-used colour is dark). Only what the brand file says; the rest stays the base's. */
export const paletteFromBrand = (b: BrandFile): Partial<Record<PaletteKey, string>> => {
  const cols = b.palette.map((p) => p.hex.toLowerCase()).filter((h) => /^#[0-9a-f]{6}$/.test(h));
  if (!cols.length) return {};
  const out: Partial<Record<PaletteKey, string>> = {};
  const accent = [...cols].sort((x, y) => sat(y) - sat(x))[0]; if (sat(accent) > 0.35) out.accent = accent;
  const byL = [...cols].sort((x, y) => lum(x) - lum(y)), dark = byL[0], light = byL[byL.length - 1];
  if (contrast(dark, light) >= 7) { if (lum(cols[0]) < 0.2) { out.bg = dark; out.ink = light; } else { out.ink = dark; } }
  return out;
};
/** The brand file's logo: an element named like a logo or a mark, else its first. */
export const logoFromBrand = (b: BrandFile): BrandElement | undefined => { const names = Object.keys(b.elements); const n = names.find((x) => /logo|mark|symbol|icon/i.test(x)) ?? names[0]; return n ? (b.elements[n] as unknown as BrandElement) : undefined; };

// ---------------------------------------------------------------- fonts
const FONT_CACHE = new Map<string, Font>();
const fontOf = (f: LookFont, role: string): Font => {
  if (!f || typeof f.family !== "string" || !f.family) throw new Error(`look.fonts.${role}: give { family, file } (a family name and the imported font file)`);
  if (!f.file || typeof f.file.data !== "string") throw new Error(`look.fonts.${role}: '${f.family}' has no font file. Import it by path: import f from "../../assets/fonts/<file>.ttf", then { family: "${f.family}", file: f }`);
  if (f.file.format !== "ttf") throw new Error(`look.fonts.${role}: ${f.file.path} is a .${f.file.format}; the film measures every line from the font's own glyphs, which needs the TrueType .ttf of the face (convert it, or use the .ttf the family ships)`);
  const key = `${f.file.path}#${f.file.data.length}`;
  if (!FONT_CACHE.has(key)) FONT_CACHE.set(key, parseTTF(f.file.data));
  return FONT_CACHE.get(key)!;
};
/** Width of text at px in a parsed face: the glyphs' own advances and pair kerning, as a canvas sets them. */
export const fontWidth = (font: Font, text: string, px: number) => {
  let w = 0, prev = -1; const s = px / font.unitsPerEm;
  for (const ch of text) { const g = font.glyphIndex(ch.codePointAt(0)!); if (prev >= 0) w += font.kerning(prev, g); w += font.glyph(g).advance; prev = g; }
  return w * s;
};
const css = (family: string, fallback: string) => (w: number, px: number) => `${w} ${px}px "${family}", ${fallback}`;
const SANS_FALLBACK = `"Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif`;

/** Registers the look's font files as FontFaces (in a page; in node it does nothing), once per family. */
const registered = new Set<string>();
export const registerFaces = (faces: ResolvedLook["faces"]) => {
  const g = globalThis as unknown as { FontFace?: new (f: string, s: ArrayBuffer, d?: Record<string, string>) => { load(): Promise<unknown> }; document?: { fonts: { add(f: unknown): void } } };
  if (!g.FontFace || !g.document) return;
  for (const { family, file } of faces) {
    if (registered.has(family)) continue; registered.add(family);
    const bin = atob(file.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    // (one face for every weight: the film is measured from this face's own advances, so the browser must not
    // swap in a synthesized bold that is wider than the measure)
    const face = new g.FontFace(family, u8.buffer, { weight: "1 1000", style: "normal" }); g.document.fonts.add(face); void face.load();
  }
};

// ---------------------------------------------------------------- resolve
export type LookSpec = { preset?: string; accent?: string; look?: LaunchLook };
export const resolveLook = (spec: LookSpec): ResolvedLook => {
  const L = spec.look ?? {}, base = L.base ?? spec.preset ?? "drawn";
  if (spec.preset !== undefined && L.base !== undefined && spec.preset !== L.base) throw new Error(`look: preset '${spec.preset}' and look.base '${L.base}' disagree; keep one (preset is the shorthand for look.base)`);
  const def = LOOKS.get(base); if (!def) throw new Error(`look: base '${base}' is not a registered look (${lookNames().join(", ")}); registerLook() adds one`);
  const fromP = L.from ? paletteFromBrand(L.from) : {}, own = L.palette ?? {};
  for (const [k, v] of Object.entries(own)) { if (!(k in CLEAN)) throw new Error(`look.palette: '${k}' is not a token (${Object.keys(CLEAN).filter((x) => x !== "shadow").join(", ")})`); rgb(String(v)); }
  const legacy = spec.accent ? { accent: spec.accent } : {};
  const palette: Palette = { ...def.palette, ...(def.clean ? legacy : {}), ...fromP, ...own } as Palette;
  const changed = new Set([...Object.keys(fromP), ...Object.keys(own)]);
  const chat: LookChat = { ...(L.from ? { logo: logoFromBrand(L.from) } : {}), ...(L.chat ?? {}) };
  const extra: [string, string, number, string][] = [];
  if (chat.bubble) extra.push([chat.bubble.ink, chat.bubble.fill, 4.5, "look.chat.bubble (ink on fill)"]);
  if (chat.reply) extra.push([chat.reply.ink, palette.card, 4.5, "look.chat.reply.ink on the card"]);
  // the label on the accent (the button, the product's action): white, or on a pale accent the darker of ink
  // and ground; whichever it is, it must reach the large-type bar
  const onAccent = contrast("#ffffff", palette.accent) >= 3 ? "#ffffff" : contrast(palette.ink, palette.accent) >= contrast(palette.bg, palette.accent) ? palette.ink : palette.bg;
  if (changed.has("accent") || changed.has("ink") || changed.has("bg")) extra.push([onAccent, palette.accent, 3, `the button's label on 'accent' ${palette.accent}`]);
  checkContrast(palette, changed, extra);
  const F = L.fonts ?? {}, faces: ResolvedLook["faces"] = [];
  const pick = (role: "display" | "text" | "mono") => { const f = F[role]; if (!f) return null; const font = fontOf(f, role); faces.push({ family: f.family, file: f.file }); return { f, font }; };
  const d = pick("display"), t = pick("text"), mo = pick("mono");
  const textFn: FontFn = t ? css(t.f.family, SANS_FALLBACK) : SANS;
  const displayFn: FontFn = d ? css(d.f.family, SANS_FALLBACK) : t ? textFn : SANS;
  const monoFn = mo ? (px: number) => `${px}px "${mo.f.family}", "SF Mono", Menlo, monospace` : MONO;
  const textW = t ? (s: string, px: number) => fontWidth(t.font, s, px) : estWidth;
  const measure = {
    text: textW,
    // (the stock display face is the heavy set sans, wider than the body estimate: the template's 1.12)
    display: d ? (s: string, px: number) => fontWidth(d.font, s, px) : t ? textW : (s: string, px: number) => estWidth(s, px) * 1.12,
    mono: mo ? (s: string, px: number) => fontWidth(mo.font, s, px) : monoWidth,
  };
  const wrapBy = (m: (s: string, px: number) => number) => (text: string, px: number, maxW: number) => { const out: string[] = []; let line = ""; for (const w of text.split(" ")) { const s = line ? `${line} ${w}` : w; if (!line || m(s, px) <= maxW) line = s; else { out.push(line); line = w; } } out.push(line); return out; };
  const wrap = wrapBy(measure.text), wrapDisplay = d ? wrapBy(measure.display) : wrap;
  const byFamily = [d, t, mo].filter((x): x is { f: LookFont; font: Font } => !!x);
  const measureFont = (s: string, fontStr: string) => { const px = Number(/([\d.]+)px/.exec(fontStr)?.[1] ?? 40), hit = byFamily.find((x) => fontStr.includes(`"${x.f.family}"`)); return hit ? fontWidth(hit.font, s, px) : estWidth(s, px); };
  const S = L.shape ?? {};
  if (S.bubble && !["rounded", "square", "none"].includes(S.bubble)) throw new Error(`look.shape.bubble: '${S.bubble}' is not rounded, square or none`);
  if (S.composer && !["box", "bar"].includes(S.composer)) throw new Error(`look.shape.composer: '${S.composer}' is not box or bar`);
  if (S.button && !["pill", "square"].includes(S.button)) throw new Error(`look.shape.button: '${S.button}' is not pill or square`);
  const custom = changed.size > 0 || faces.length > 0 || Object.keys(S).length > 0 || Object.keys(chat).length > 0;
  return { base, clean: def.clean, palette, onAccent, custom, fonts: { display: displayFn, text: textFn, mono: monoFn }, measure, wrap, wrapDisplay, customDisplay: !!d, measureFont, pointer: contrast("#111111", palette.bg) >= 3 ? { fill: "#111", edge: "#fff" } : { fill: contrast("#ffffff", palette.bg) >= contrast(palette.ink, palette.bg) ? "#fff" : palette.ink, edge: "#111" }, shape: { bubble: S.bubble ?? "rounded", composer: S.composer ?? "box", button: S.button ?? "pill", radius: S.radius, buttonLabel: S.buttonLabel }, chat, faces };
};
