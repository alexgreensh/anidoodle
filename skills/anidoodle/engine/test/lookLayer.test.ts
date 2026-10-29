// THE LOOK LAYER. A launch film looks like the product it launches: look.base (any registered look; preset is
// its shorthand), look.palette (any token over the base), look.fonts (a family and a local .ttf, measured
// from its own glyphs), look.shape, look.chat, look.from (a brand.mjs import). The stock looks resolve to
// exactly what the template drew before (so the frozen films cannot move); a custom palette is checked for
// readable contrast, naming the token.
//   node tools/test.mjs lookLayer
import { resolveLook, contrast, checkContrast, CLEAN, fontWidth, paletteFromBrand, registerLook, type FontFile } from "../src/canvas-core/launchLook";
import { C, SANS, MONO } from "../src/canvas-core/launchKit";
import { estWidth } from "../src/canvas-core/launchLayout";
import { parseTTF } from "../src/three-core/ttf";
import lora from "../assets/fonts/Lora-Bold.ttf";
import instrument from "../assets/fonts/InstrumentSans-Regular.ttf";

export const name = "the look layer";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const throws = (f: () => unknown, re: RegExp) => { try { f(); return false; } catch (e) { return re.test((e as Error).message); } };
  // the stock looks are what the template drew before
  const d = resolveLook({});
  ok(d.base === "drawn" && !d.clean && d.palette === C || JSON.stringify(d.palette) === JSON.stringify(C), "no look: the drawn base, palette C");
  ok(d.fonts.text === SANS && d.fonts.mono === MONO && d.measure.text === estWidth && !d.custom, "no look: the stock fonts and the stock measure, nothing custom");
  const c = resolveLook({ preset: "clean", accent: "#cc2200" });
  ok(c.clean && c.palette.accent === "#cc2200" && c.palette.bg === CLEAN.bg && !c.custom, "preset clean is look.base clean, the legacy accent kept");
  ok(resolveLook({ look: { base: "clean" } }).clean, "look.base clean");
  ok(throws(() => resolveLook({ preset: "clean", look: { base: "drawn" } }), /disagree/), "RED: preset and look.base that disagree are an error");
  ok(throws(() => resolveLook({ look: { base: "neon" } }), /not a registered look.*registerLook/), "RED: an unknown base names registerLook");
  registerLook("night", { clean: true, palette: { ...CLEAN, bg: "#101114", card: "#17181c", ink: "#f2efe8", paper: "#1d1e22", chip: "#26272c", soft: "#b9b4aa", mute: "#8d8a84", line: "#2c2d33" } });
  ok(resolveLook({ look: { base: "night" } }).palette.bg === "#101114", "a registered look is a base like the stock ones");
  // the palette, merged over the base, every key checked
  const p = resolveLook({ look: { base: "clean", palette: { accent: "#0b6e4f" } } });
  ok(p.palette.accent === "#0b6e4f" && p.palette.ink === CLEAN.ink && p.custom, "look.palette sets a token over the base");
  ok(throws(() => resolveLook({ look: { palette: { glow: "#fff" } as never } }), /'glow' is not a token/), "RED: an unknown token is an error naming it");
  // the readability guard (WCAG AA): every text pair a changed token touches
  ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 0.01 && Math.abs(contrast("#777777", "#ffffff") - 4.48) < 0.02, "contrast is the WCAG ratio");
  ok(throws(() => resolveLook({ look: { base: "clean", palette: { bg: "#1a1a1a" } } }), /'ink' #15161a on 'bg' #1a1a1a/), "RED: a dark ground under the stock dark ink is refused, naming ink on bg");
  ok(resolveLook({ look: { base: "night", palette: { accent: "#ffe14d" } } }).onAccent === "#101114", "a pale accent takes a dark label (here the night ground), not white");
  ok(throws(() => resolveLook({ look: { base: "clean", palette: { accent: "#ffe14d" } } }), /'accent' #ffe14d on 'bg'/), "RED: a pale accent on a pale ground is refused as accent words, naming accent on bg");
  ok(throws(() => resolveLook({ look: { base: "clean", palette: { accent: "#a0a4ab", ink: "#6d7179", bg: "#a9adb5" } } }), /button's label on 'accent'/), "RED: an accent no label can be read on is refused, naming the accent");
  ok(throws(() => resolveLook({ look: { base: "clean", palette: { soft: "#c8c8c8" } } }), /'soft'.*under 4.5:1/), "RED: grey body text under 4.5:1 is refused");
  ok(!throws(() => resolveLook({ look: { base: "night", palette: { accent: "#e2b04a", accentDeep: "#b98a2c" } } }), /./), "a readable custom palette builds (a gold accent with a dark label)");
  ok(throws(() => checkContrast({ ...CLEAN, mute: "#d8d8d8" }, new Set(["mute"])), /'mute'.*under 3:1 \(the composer's placeholder/), "RED: hint text under 3:1 is refused");
  ok(throws(() => resolveLook({ look: { base: "clean", chat: { bubble: { fill: "#2f54eb", ink: "#1b2a7a" } } } }), /look.chat.bubble/), "RED: an unreadable bubble is refused, naming look.chat.bubble");
  // fonts: a family and its file; measured from the face itself
  const font = parseTTF(lora.data), f = resolveLook({ look: { base: "clean", fonts: { display: { family: "Lora", file: lora }, text: { family: "Instrument Sans", file: instrument } } } });
  ok(lora.path === "assets/fonts/Lora-Bold.ttf" && lora.format === "ttf" && lora.data.length > 1000, `a font imported by path arrives as its bytes (${lora.path}, ${lora.format})`);
  ok(Math.abs(f.measure.display("Hamburgefonts", 100) - fontWidth(font, "Hamburgefonts", 100)) < 1e-9 && Math.abs(f.measure.display("Hamburgefonts", 100) - estWidth("Hamburgefonts", 100) * 1.12) > 5, `RED: the display face measures from Lora's own advances (${f.measure.display("Hamburgefonts", 100).toFixed(1)} px, the stock estimate ${(estWidth("Hamburgefonts", 100) * 1.12).toFixed(1)})`);
  ok(f.fonts.display(700, 50).startsWith('700 50px "Lora"') && f.fonts.text(500, 20).startsWith('500 20px "Instrument Sans"'), "the faces are named in every font string");
  ok(f.wrap("one two three four five six", 40, 200).every((l) => f.measure.text(l, 40) <= 200 || !l.includes(" ")), "lines wrap by the text face's own widths");
  ok(f.faces.length === 2 && f.faces[0].family === "Lora", "the font files are listed for registration before the first frame");
  const woff: FontFile = { path: "x.woff2", format: "woff2", data: "AAAA" };
  ok(throws(() => resolveLook({ look: { fonts: { text: { family: "X", file: woff } } } }), /x\.woff2 is a \.woff2.*TrueType \.ttf/), "RED: a woff2 is refused with the fix (its .ttf)");
  ok(throws(() => resolveLook({ look: { fonts: { text: { family: "X" } as never } } }), /has no font file\. Import it by path/), "RED: a family with no file says how to import it");
  // from: a brand.mjs import fills the palette and the logo; explicit fields win
  const brand = { elements: { acmeLogo: { w: 10, h: 10, parts: [] } }, palette: [{ hex: "#0e0f12", share: 0.6 }, { hex: "#f4efe6", share: 0.3 }, { hex: "#e0662d", share: 0.1 }] };
  const fp = paletteFromBrand(brand);
  ok(fp.accent === "#e0662d" && fp.bg === "#0e0f12" && fp.ink === "#f4efe6", `a dark brand file: its saturated colour the accent, its dark the ground, its light the ink (${JSON.stringify(fp)})`);
  const fr = resolveLook({ look: { base: "night", from: brand, palette: { accent: "#e8743b" } } });
  ok(fr.palette.accent === "#e8743b" && fr.palette.bg === "#0e0f12" && fr.chat.logo === brand.elements.acmeLogo, "look.from fills palette and logo; an explicit token wins");
  // shape
  ok(throws(() => resolveLook({ look: { shape: { bubble: "blob" as never } } }), /bubble: 'blob'/), "RED: an unknown bubble style is an error");
  // the pointer: the stock black arrow on a light ground, a light arrow on a dark one (a black arrow on a dark
  // page was a white outline only: it changed so few pixels the gate read its approach as dead air)
  ok(d.pointer.fill === "#111" && d.pointer.edge === "#fff", "stock looks: the black pointer with its white edge");
  const dk = resolveLook({ look: { base: "night" } });
  ok(contrast(dk.pointer.fill === "#fff" ? "#ffffff" : dk.pointer.fill, dk.palette.bg) >= 4.5 && contrast(dk.pointer.edge === "#111" ? "#111111" : dk.pointer.edge, dk.pointer.fill === "#fff" ? "#ffffff" : dk.pointer.fill) >= 4.5, `RED: a dark ground gets a light pointer (${JSON.stringify(dk.pointer)})`);
};
