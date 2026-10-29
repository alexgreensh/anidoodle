// FRAME PROBE TESTS (hosts/probe.ts, what framecheck sees). Driven with a stand-in canvas, each case is
// one way the probe went blind and framecheck passed on text it never saw:
//   H1  text in a layer built once and reused (a bake() sprite, a held plate) vanished from the second
//       40-frame batch on, because only the first call rebuilt the layer memo under the hooks
//   H2  text under a hand-built rounded rect (moveTo + four arcTo, launchKit rr()) vanished, because arcTo
//       was not measured and the clip collapsed to a point
import { frameProbe } from "../src/hosts/probe";
import { FakeCanvas, installFakeCanvas } from "./fakeCanvas";

export const name = "probe";
export const run = (ok: (cond: boolean, label: string) => void) => {
  installFakeCanvas();
  const W = 1920, H = 1080;
  const mk = (draw: (ctx: FakeCanvas["ctx"], cache: Map<string, unknown>, f: number) => void) => {
    const canvas = new FakeCanvas(W, H), cache = new Map<string, unknown>();
    const seek = (f: number) => { canvas.ctx.reset(); draw(canvas.ctx, cache, f); };
    return frameProbe({ canvas: () => canvas, ctx: () => canvas.ctx as never, seek, clearCache: () => cache.clear() });
  };
  const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);
  const labels = (rs: { label: string; frame: number }[], f: number) => rs.filter((r) => r.frame === f).map((r) => r.label).sort().join("|");

  // ---- H1: a sprite with a line of text, baked once into the memo and drawn every frame
  const sprite = mk((ctx, cache, f) => {
    let L = cache.get("sprite") as FakeCanvas | undefined;
    if (!L) { L = new FakeCanvas(400, 100); L.ctx.font = "40px Sans"; L.ctx.fillText("Learn more", 10, 60); cache.set("sprite", L); }
    ctx.drawImage(L, 200 + f, 400);
  });
  const a = sprite(range(0, 40), true), b = sprite(range(40, 80), true);
  ok(labels(a, 0) === "Learn more", `H1 the sprite's text is seen in the first batch (${labels(a, 0) || "nothing"})`);
  ok(range(40, 80).every((f) => labels(b, f) === "Learn more"), `NEGATIVE H1: the sprite's text is still seen in the second 40-frame batch (frame 40: ${labels(b, 40) || "nothing"})`);
  ok(b.length === a.length, `H1 both batches return the same number of records (${a.length} and ${b.length})`);
  // the same sprite, its edge cut by the frame: the cut must be reported in batch two as in batch one
  const cutSprite = mk((ctx, cache) => {
    let L = cache.get("s") as FakeCanvas | undefined;
    if (!L) { L = new FakeCanvas(400, 100); L.ctx.font = "40px Sans"; L.ctx.fillText("Sign up now", 10, 60); cache.set("s", L); }
    ctx.drawImage(L, W - 150, 400);
  });
  ok(cutSprite([0]).length === 1 && cutSprite([40]).length === 1, "NEGATIVE H1: a reused sprite cut by the frame's edge is reported on every call, not only the first");

  // ---- H2: a rounded card clip built from moveTo + four arcTo, text inside it
  const card = mk((ctx) => {
    const x = 600, y = 300, w = 700, h = 300, r = 24;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.clip();
    ctx.font = "48px Sans"; ctx.fillText("Your reply", x + 40, y + 120); ctx.restore();
  });
  ok(labels(card([0], true), 0) === "Your reply", `NEGATIVE H2: text inside an arcTo rounded-rect clip is seen (got: ${labels(card([0], true), 0) || "nothing"})`);
  // a clip the probe cannot measure (no path at all) must never hide the text from the checks
  const blindClip = mk((ctx) => { ctx.save(); ctx.beginPath(); ctx.clip(); ctx.font = "48px Sans"; ctx.fillText("Hidden?", 100, 200); ctx.restore(); });
  ok(labels(blindClip([0], true), 0) === "Hidden?", "NEGATIVE H2: a clip with no measured area is unknown, never 'clips everything'");
  // and a real clip still cuts: text wholly outside a measured rect clip is not drawn
  const outside = mk((ctx) => { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 300, 300); ctx.clip(); ctx.font = "48px Sans"; ctx.fillText("Off card", 800, 800); ctx.restore(); });
  ok(outside([0], true).length === 0, "a measured clip still hides text wholly outside it");
};
