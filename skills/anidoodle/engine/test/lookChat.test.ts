// THE CHAT TAKES THE LOOK. A custom look draws the chat the way the product draws its own: its text face in
// every line (header, prompt, button), its logo in the dot's place, no header when it has none, square or
// bar shapes, and a label colour the accent can carry. Without a look the chat draws exactly the stock calls.
//   node tools/test.mjs lookChat
import { CHAT_GEOM, drawChatFrame, type ChatGeom } from "../src/canvas-core/launchKit";
import { resolveLook } from "../src/canvas-core/launchLook";
import { makeLaunchFilm, type LaunchFilm } from "../src/canvas-core/launchTemplate";
import type { Ctx } from "../src/canvas-core/core";
import type { Film } from "../src/canvas-core/film";
import { FakeCanvas } from "./fakeCanvas";
import { drawProductUI, type UiTheme } from "../src/canvas-core/productUI";
import { launchExampleBrand } from "../src/canvas-core/launchExampleBrand";
import lora from "../assets/fonts/Lora-Bold.ttf";
import instrument from "../assets/fonts/InstrumentSans-Regular.ttf";

export const name = "the chat takes the look";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const raw = new FakeCanvas(1920, 1080).ctx, log: { op: string; font: string; fill: string; text?: string; r?: number; x?: number }[] = [];
  const ctx = new Proxy(raw, {
    get(t, k) {
      if (k === "fillText") return (s: string, x: number, y: number) => { log.push({ op: "text", font: t.font, fill: String(t.fillStyle), text: s, x }); t.fillText(s, x, y); };
      if (k === "arc") return (...a: number[]) => { log.push({ op: "arc", font: t.font, fill: String(t.fillStyle), r: a[2] }); };
      if (k === "arcTo") return (...a: number[]) => { log.push({ op: "arcTo", font: "", fill: "", r: a[4] }); };
      const v = Reflect.get(t, k); return typeof v === "function" ? v.bind(t) : v;
    },
    set(t, k, v) { return Reflect.set(t, k, v); },
  }) as unknown as Ctx;
  const state = { typed: "why did it go up?", caret: true, title: "Tally", subtitle: "your books", genLabel: "Ask" };
  log.length = 0; drawChatFrame(ctx, state, CHAT_GEOM);
  const stock = log.filter((l) => l.op === "text");
  ok(stock.every((l) => l.font.includes('"Avenir Next"')) && stock.some((l) => l.text === "Tally"), "no look: the stock face and the stock header");
  const LK = resolveLook({ look: { base: "clean", fonts: { display: { family: "Lora", file: lora }, text: { family: "Instrument Sans", file: instrument } }, palette: { bg: "#121316", card: "#1a1b20", paper: "#202127", chip: "#2a2b31", ink: "#f2efe8", soft: "#b9b4aa", mute: "#8d8a84", line: "#2c2d33", accent: "#e8c547" }, shape: { composer: "bar", button: "square" }, chat: { header: false } } });
  const g: ChatGeom = { ...CHAT_GEOM, theme: LK.palette, look: LK };
  log.length = 0; drawChatFrame(ctx, state, g);
  const texts = log.filter((l) => l.op === "text");
  ok(texts.length > 0 && texts.every((l) => l.font.includes('"Instrument Sans"')), `RED: every line of the chat is set in the look's text face (${texts.map((l) => l.text).join(" | ")})`);
  ok(!texts.some((l) => l.text === "Tally" || l.text === "your books"), "RED: header: false draws no header");
  const label = texts.find((l) => l.text === "Ask");
  ok(!!label && label.fill.toLowerCase() === LK.onAccent.toLowerCase() && LK.onAccent !== "#ffffff", `RED: the button's label takes the colour the pale accent can carry (${label?.fill})`);
  // a logo in the dot's place (node has no Path2D: a stand-in, the fake canvas only records the calls)
  const G = globalThis as unknown as { Path2D?: unknown }; if (!G.Path2D) G.Path2D = class { constructor(_d?: string) {} };
  const logo = { w: 20, h: 20, parts: [{ d: "M0 0L20 0L20 20L0 20Z", fill: { type: "solid", c: "#e8c547" }, rule: "nonzero", op: 1, bb: [0, 0, 20, 20] }] } as never;
  const LK2 = resolveLook({ look: { base: "clean", chat: { logo, title: "Acme" } } });
  log.length = 0; drawChatFrame(ctx, state, { ...CHAT_GEOM, theme: LK2.palette, look: LK2 });
  ok(!log.some((l) => l.op === "arc" && Math.abs((l.r ?? 0) - 9) < 1e-9) && log.some((l) => l.text === "Acme"), "RED: a logo replaces the header's dot, and the look's title is the header's");
  // (framecheck's gap rule: a brand element and text 32 px apart or more; the logo is wider than the dot was)
  const titleX = log.find((l) => l.text === "Acme")?.x ?? 0, logoRight = CHAT_GEOM.CHAT.x + 58 * CHAT_GEOM.k + 13 * CHAT_GEOM.k;
  ok(titleX - logoRight >= 34, `RED: the title stands 34 px or more clear of the logo (${(titleX - logoRight).toFixed(0)} px)`);
  // the template builds with a look, and its chat geometry carries it
  const plate: Film = { meta: { title: "p", W: 1080, H: 1080, fps: 30, bpm: 90, durationFrames: 60 }, assets: { images: {} }, shots: [{ id: "p", start: 0, end: 60, draw: () => {} }] };
  const f = makeLaunchFilm({ title: "Acme", look: { base: "clean", fonts: { display: { family: "Lora", file: lora } }, palette: { accent: "#0b6e4f" } }, asks: [{ prompt: "draw the plan", plate, label: "the plan" }, { kind: "film", film: plate }], tagline: "Plans that draw themselves", install: ["npm i acme"], bpm: 90, score: null }) as LaunchFilm;
  ok(f.layout.chat !== undefined && f.meta.W === 1920, "a film with a look builds");
  let err = ""; try { makeLaunchFilm({ title: "Acme", look: { base: "clean", palette: { bg: "#202020" } }, asks: [{ kind: "film", film: plate }], tagline: "t", install: ["npm i acme"], bpm: 90, score: null }); } catch (e) { err = (e as Error).message; }
  ok(/'ink' #15161a on 'bg' #202020/.test(err), `RED: the template refuses an unreadable look at build (${err.slice(0, 70)})`);
  // THE PRODUCT'S OWN UI TAKES THE SHAPE TOO. A square brand's chat had square corners while its library's
  // action stayed a pill, its window 24 px round and its command bar a capsule: three corner styles in one film
  // (a fresh critic, br1-1: "reads as the template recoloured"). At 1x (a 720 x 600 panel) the look's radius
  // is every corner's ceiling and a square button is square.
  const ui = { title: "Lantern", nav: ["Library", "Notes"], action: "Check all", command: "Ask Lantern", before: { items: [{ id: "a", label: "Field notes", value: "12 p." }] }, after: { items: [{ id: "a", label: "Field notes", value: "12 p.", tag: "cited", done: true }] } };
  const TH: UiTheme = { bg: "#0f1113", card: "#1f2228", ink: "#f3ede0", soft: "#b8b0a2", mute: "#8f897e", line: "#3a3f48", chip: "#30343c", accent: "#f2b544", paper: "#272b32" };
  const radii = (T: UiTheme) => { log.length = 0; drawProductUI(ctx, { x: 0, y: 0, w: 720, h: 600 }, ui, { f: 0, t0: 10 }, T); return log.filter((e) => e.op === "arcTo").map((e) => e.r ?? 0); };
  const stockUi = radii(TH), sq = radii({ ...TH, radius: 6, button: "square" });
  ok(Math.max(...stockUi) > 20, `the stock product UI keeps its round corners (largest ${Math.max(...stockUi).toFixed(1)} px)`);
  ok(sq.length > 0 && Math.max(...sq) <= 6 + 1e-6, `RED: a square look's product UI has no corner rounder than its radius (largest ${Math.max(...sq).toFixed(1)} px, look 6)`);
  // THE LOGO SIGNS THE END CARD. A look with a logo showed it only as a 26 px header glyph and never on the
  // end card (a fresh critic, br1-5): the frame people screenshot had the name and no mark. The clean end
  // card now sets the logo before the name, on its baseline, and the whole group (logo, name, dot) is centred.
  for (const sh of ["16x9", "9x16"]) {
    const r = (launchExampleBrand as LaunchFilm).reshape(sh) as LaunchFilm, e = r.grammar?.endCard;
    if (!e) { ok(false, `${sh}: the end card is exposed`); continue; }
    ok(!!e.logo && e.logo.w > 40 && Math.abs(e.logo.x - e.group[0]) < 1e-6, `RED ${sh}: the logo opens the end card's group (${JSON.stringify(e.logo)})`);
    ok(Math.abs((e.group[0] + e.group[1]) / 2 - e.cx) < 2, `${sh}: logo, name and dot are centred on the card's axis (${((e.group[0] + e.group[1]) / 2).toFixed(1)} vs ${e.cx.toFixed(1)})`);
    ok(e.group[0] >= e.room[0] && e.group[1] <= e.room[1], `${sh}: the group stays inside the room`);
  }
};
