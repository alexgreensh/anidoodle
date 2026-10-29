// LAYER INSTRUMENT TESTS (hosts/instrument.ts), driven with a stand-in canvas. Each case is one way the
// instruments passed without looking:
//   L1  a brand colour declared short ("#c41") or as hsl() never matched a fill, so translucent passed
//   L2  type drawn into an offscreen layer is not kept sharp by the blur mask; the mask now counts those
//       layers (layerType) so the render can say so instead of claiming every line was kept sharp
import { brandHex, instruments } from "../src/hosts/instrument";
import { FakeCanvas, installFakeCanvas } from "./fakeCanvas";

export const name = "instrument";
export const run = (ok: (cond: boolean, label: string) => void) => {
  installFakeCanvas();
  const mk = (draw: (ctx: FakeCanvas["ctx"], cache: Map<string, unknown>, f: number) => void) => {
    const canvas = new FakeCanvas(320, 180), cache = new Map<string, unknown>();
    const inst = instruments({ ctx: () => canvas.ctx as never, images: () => new Set(), draw: (f) => { canvas.ctx.reset(); draw(canvas.ctx, cache, f); }, read: () => canvas.px, clearCache: () => cache.clear() });
    return inst;
  };
  // ---- L1
  ok(brandHex("#c41") === "#cc4411" && brandHex("#CC4411") === "#cc4411" && brandHex("#cc4411ff") === "#cc4411", "L1 #rgb, #RRGGBB and #rrggbbaa read as the canvas's #rrggbb");
  ok(brandHex("rgb(204, 68, 17)") === "#cc4411" && brandHex("hsl(16.36, 84.6%, 43.33%)") === "#cc4411", `L1 rgb() and hsl() read too (hsl gave ${brandHex("hsl(16.36, 84.6%, 43.33%)")})`);
  ok(brandHex("olive-ish") === null && brandHex(7) === null, "L1 a colour that cannot be read is null, never compared as written");
  const fills = mk((ctx) => { ctx.globalAlpha = 0.5; ctx.fillStyle = "#cc4411"; ctx.fillRect(0, 0, 50, 50); });
  const short = fills.layers([0], ["#c41"]), hsl = fills.layers([0], ["hsl(16.36, 84.6%, 43.33%)"]);
  ok(short[0].translucent.length === 1 && hsl[0].translucent.length === 1, `NEGATIVE L1: a half-alpha fill in the brand colour is found when the colour is declared #c41 or hsl() (${short[0].translucent.length}, ${hsl[0].translucent.length})`);
  const bad = fills.layers([0], ["olive mud"]);
  ok(bad[0].unread?.[0] === "olive mud", "NEGATIVE L1: an unreadable brand colour is returned as unread (layerscan fails translucent on it), never silently ignored");
  // ---- L2
  const sheet = mk((ctx, cache) => {
    let L = cache.get("sheet") as FakeCanvas | undefined;
    if (!L) { L = new FakeCanvas(200, 60); L.ctx.font = "30px Sans"; L.ctx.fillText("On a sheet", 5, 40); cache.set("sheet", L); }
    ctx.fillRect(0, 0, 320, 180); ctx.drawImage(L, 20, 20); ctx.font = "20px Sans"; ctx.fillText("Own", 20, 150);
  });
  sheet.layers([0]); // builds the sheet's cache before any blur, as a real render's warm-up does
  const k = sheet.sharpLayers(0);
  ok(!!k && (k as { layerType?: number }).layerType === 1, `NEGATIVE L2: the blur mask counts the layer holding type it cannot keep sharp (layerType ${(k as { layerType?: number } | null)?.layerType})`);
  ok(!!k && k.count > 0, "L2 the frame's own type is still masked sharp");
};
