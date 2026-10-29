// PRODUCT UI. A product's own interface drawn from DATA, in two states, and the move between them:
// the launch film's answer to "ground it in the real product" when the product is not a chat. The
// before state is the problem (a crowded week, a red dashboard); one press of the product's action
// and every item springs to where the after state puts it: rows move to their new slots, values
// count to their new numbers, bars fill, new items arrive, old ones leave. Items are matched by id.
//
//   const ui: ProductUI = { title: "Tally", action: "Reconcile", before: { items: [...] }, after: { items: [...] } };
//   drawProductUI(ctx, rect, ui, { f, t0 }, theme, { minPx: 32 });   f = the frame, t0 = the press
//   uiSettles(ui, { f: 0, t0 })   the frame each item lands (its spring first reaches its target): sound cues
//
// Everything is a pure function of the frame. Sizes follow the rectangle, with type floored at minPx
// (the phone-safe size the layout asks for), so the same UI reads in a 16x9 column and a 9x16 panel.
import type { Ctx, P } from "./core";
import { SANS, clamp, lerp, rr, spring, out3, type Rect } from "./launchKit";

export type UiItem = {
  id: string; label: string;
  value?: number | string; unit?: string;   // a number counts from state to state; a string swaps at the half
  bar?: number;                             // 0..1, a progress bar under the label
  tag?: string; accent?: boolean; done?: boolean;
};
export type UiState = { items: UiItem[]; stats?: { label: string; value: number | string; unit?: string }[] };
export type ProductUI = {
  title: string; nav?: string[];
  action: string;                           // the button the pointer presses: the product doing its one job
  command?: string;                         // a command bar's placeholder: the ask is typed there, then the action pressed
  layout?: "list" | "cards";
  before: UiState; after: UiState;
};
export type UiTheme = { bg: string; card: string; ink: string; soft: string; mute: string; line: string; chip: string; accent: string; paper: string; font?: (w: number, px: number) => string; onAccent?: string; radius?: number; button?: "pill" | "square" }; // font, onAccent: a custom look's text face and the label colour on its accent; radius: every corner's ceiling at 1x; button: its action's shape
// the move: t0 is the press; items leave one after another, `stagger` frames apart, each on a spring
export type UiMorph = { f: number; t0: number; stagger?: number; omega?: number; zeta?: number };
export type UiOpts = { minPx?: number; typed?: string; caret?: boolean; press?: number; hot?: number; accent?: string };

const DEF = { stagger: 3, omega: 0.42, zeta: 0.74 };
/** The first frame a spring started at t0 reaches its target (it only overshoots after): where a landing sound goes. */
export const springLand = (t0: number, omega = DEF.omega, zeta = DEF.zeta) => {
  if (zeta >= 1) return Math.ceil(t0 + Math.log(50) / omega); // no overshoot: within 2 %
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return Math.ceil(t0 + (Math.PI - Math.atan(wd / (zeta * omega))) / wd - 1e-9);
};

// ---------------------------------------------------------------- geometry
type Geo = { u: number; win: Rect; px: { title: number; nav: number; row: number; small: number; value: number; stat: number }; head: Rect; action: Rect; command: Rect | null; stats: Rect | null; body: Rect; row: number };
// the window is fitted to its content (rows at a comfortable height) and centred in the rectangle it is given
const geo = (r0: Rect, ui: ProductUI, minPx: number): Geo => { // sized to own its panel: a 720 x 600 design at 1x
  const u = clamp(Math.min(r0.w / 720, r0.h / 600), 0.55, 2.4), f = (x: number, lo = minPx) => Math.max(x * u, lo);
  const px = { title: f(30), nav: f(20, minPx * 0.8), row: f(26), small: f(20, minPx * 0.8), value: f(26), stat: f(46) };
  const pad = 28 * u, headH = Math.max(76 * u, px.title * 2.1), cmdH = Math.max(66 * u, px.row * 2.3);
  const nStats = Math.max(ui.before.stats?.length ?? 0, ui.after.stats?.length ?? 0), statH = px.stat * 1.1 + px.small * 1.6 + 30 * u;
  const top = headH + 18 * u + (ui.command !== undefined ? cmdH + 18 * u : 0) + (nStats ? statH + 18 * u : 0);
  const n = Math.max(ui.before.items.length, ui.after.items.length, 1), cards = ui.layout === "cards", rows = cards ? Math.ceil(n / 2) : n;
  const bodyW = r0.w - 2 * pad, room = r0.h - top - pad;
  // (in a tall rectangle, a phone frame's, a list's rows are tall touch rows and the window fills its
  // rectangle; capped at a desktop height there, it left the lower third of a 9:16 frame empty)
  const row = cards ? Math.min(room / rows, (bodyW / 2) * 0.62) : clamp(room / rows, px.row * 2.3, px.row * (r0.h > r0.w * 1.05 ? 4.5 : 3.2));
  const h = Math.min(r0.h, top + rows * row + pad), r = { x: r0.x, y: r0.y + (r0.h - h) / 2, w: r0.w, h };
  const head = { x: r.x, y: r.y, w: r.w, h: headH };
  const aw = Math.min(r.w * 0.42, px.row * 0.62 * ui.action.length + 64 * u), ah = Math.max(52 * u, px.row * 1.9);
  const action = { x: r.x + r.w - pad - aw, y: r.y + (headH - ah) / 2, w: aw, h: ah };
  let y = r.y + headH + 18 * u;
  const command = ui.command !== undefined ? { x: r.x + pad, y, w: r.w - 2 * pad, h: cmdH } : null; if (command) y += cmdH + 18 * u;
  const stats = nStats ? { x: r.x + pad, y, w: r.w - 2 * pad, h: statH } : null; if (stats) y += statH + 18 * u;
  const body = { x: r.x + pad, y, w: bodyW, h: r.y + r.h - pad - y };
  return { u, win: r, px, head, action, command, stats, body, row };
};
const slot = (g: Geo, ui: ProductUI, i: number): Rect => {
  if (ui.layout === "cards") { const gap = 16 * g.u, w = (g.body.w - gap) / 2, h = g.row - gap; return { x: g.body.x + (i % 2) * (w + gap), y: g.body.y + Math.floor(i / 2) * g.row, w, h }; }
  return { x: g.body.x, y: g.body.y + i * g.row, w: g.body.w, h: g.row - 10 * g.u };
};
/** The window as drawn inside the rectangle it was given (fitted to its content, centred). */
export const uiWindow = (r: Rect, ui: ProductUI, minPx = 0): Rect => geo(r, ui, minPx).win;
/** Where the action button is (its centre), for the pointer and the sound's pan. */
export const uiActionAt = (r: Rect, ui: ProductUI, minPx = 0): P => { const a = geo(r, ui, minPx).action; return [a.x + a.w / 2, a.y + a.h / 2]; };
/** The action button's rectangle (where a drop can sit beside it, clear of its word). */
export const uiActionRect = (r: Rect, ui: ProductUI, minPx = 0): Rect => geo(r, ui, minPx).action;
/** Where the command bar's caret starts (its left text edge and centre line), when the UI has one. */
export const uiCommandAt = (r: Rect, ui: ProductUI, minPx = 0): Rect | null => geo(r, ui, minPx).command;

// ---------------------------------------------------------------- the move
type Pose = { item: UiItem; from: UiItem | null; to: UiItem | null; a: Rect; b: Rect; p: number; order: number };
const poses = (g: Geo, ui: ProductUI, m: UiMorph): Pose[] => {
  const st = m.stagger ?? DEF.stagger, om = m.omega ?? DEF.omega, ze = m.zeta ?? DEF.zeta;
  const B = new Map(ui.before.items.map((it, i) => [it.id, i])), A = new Map(ui.after.items.map((it, i) => [it.id, i]));
  const ids = [...new Set([...ui.after.items.map((x) => x.id), ...ui.before.items.map((x) => x.id)])];
  return ids.map((id, order) => {
    const bi = B.get(id), ai = A.get(id), from = bi === undefined ? null : ui.before.items[bi], to = ai === undefined ? null : ui.after.items[ai];
    const p = spring(m.f, m.t0 + order * st, om, ze);
    return { item: (to ?? from)!, from, to, a: slot(g, ui, bi ?? ai!), b: slot(g, ui, ai ?? bi!), p, order };
  });
};
/** The frame each item lands (first reaches its after-state), and how: moved, arrived or left. */
export const uiSettles = (ui: ProductUI, m: Omit<UiMorph, "f">) => {
  const st = m.stagger ?? DEF.stagger, ids = [...new Set([...ui.after.items.map((x) => x.id), ...ui.before.items.map((x) => x.id)])];
  const B = new Map(ui.before.items.map((it) => [it.id, it])), A = new Map(ui.after.items.map((it) => [it.id, it]));
  return ids.map((id, order) => {
    const b = B.get(id), a = A.get(id), kind = !b ? "in" : !a ? "out" : JSON.stringify(b) === JSON.stringify(a) && ui.before.items.indexOf(b) === ui.after.items.indexOf(a) ? "still" : "move";
    return { id, kind, frame: springLand(m.t0 + order * st, m.omega ?? DEF.omega, m.zeta ?? DEF.zeta) };
  }).filter((s) => s.kind !== "still");
};
const num = (a: number | string | undefined, b: number | string | undefined, p: number, unit = "") => {
  if (typeof a === "number" && typeof b === "number") { const v = lerp(a, b, clamp(p)), dec = Number.isInteger(a) && Number.isInteger(b) ? 0 : 1; return v.toFixed(dec) + unit; }
  const v = p < 0.5 ? a ?? b : b ?? a; return v === undefined ? "" : `${v}${unit}`;
};

// ---------------------------------------------------------------- drawing
export const drawProductUI = (ctx: Ctx, r0: Rect, ui: ProductUI, m: UiMorph, T: UiTheme, o: UiOpts = {}) => {
  const g = geo(r0, ui, o.minPx ?? 0), u = g.u, acc = o.accent ?? T.accent, r = g.win;
  // (a look's radius caps every corner, so a square brand's product is square too; a square button is square)
  const RAD = (x: number) => (T.radius !== undefined ? Math.min(x, T.radius * u) : x);
  // the window
  for (let i = 5; i >= 1; i--) { ctx.fillStyle = "rgba(20,24,30,0.022)"; rr(ctx, r.x - i * 2, r.y + i * 3, r.w + i * 4, r.h + i * 3, RAD(24 * u + i * 2)); ctx.fill(); }
  ctx.fillStyle = T.card; rr(ctx, r.x, r.y, r.w, r.h, RAD(24 * u)); ctx.fill();
  ctx.lineWidth = 1.5 * u; ctx.strokeStyle = T.line; ctx.stroke();
  // the head: the product's name, its sections, the action
  ctx.textBaseline = "middle"; ctx.font = (T.font ?? SANS)(700, g.px.title); ctx.fillStyle = T.ink;
  ctx.fillText(ui.title, r.x + 28 * u, g.head.y + g.head.h / 2);
  let nx = r.x + 28 * u + ctx.measureText(ui.title).width + 26 * u;
  ctx.font = (T.font ?? SANS)(500, g.px.nav);
  (ui.nav ?? []).forEach((t, i) => { const w = ctx.measureText(t).width; if (nx + w > g.action.x - 20 * u) return; if (i === 0) { ctx.fillStyle = T.chip; rr(ctx, nx - 12 * u, g.head.y + g.head.h / 2 - g.px.nav * 0.95, w + 24 * u, g.px.nav * 1.9, RAD(g.px.nav)); ctx.fill(); } ctx.fillStyle = i === 0 ? T.ink : T.mute; ctx.fillText(t, nx, g.head.y + g.head.h / 2); nx += w + 36 * u; });
  const pr = o.press ?? 0, q = 1 - 0.06 * pr, a = g.action;
  const hot = Math.max(o.hot ?? 0, pr); ctx.fillStyle = hot > 0 ? shade(acc, 1 - 0.18 * hot) : acc;
  rr(ctx, a.x + (a.w * (1 - q)) / 2, a.y + (a.h * (1 - q)) / 2, a.w * q, a.h * q, RAD(T.button === "square" ? Math.min(8 * u, (a.h * q) / 2) : (a.h * q) / 2)); ctx.fill();
  ctx.fillStyle = T.onAccent ?? "#fff"; ctx.font = (T.font ?? SANS)(600, g.px.row * 0.8 * q); ctx.textAlign = "center"; ctx.fillText(ui.action, a.x + a.w / 2, a.y + a.h / 2 + 1); ctx.textAlign = "left";
  ctx.fillStyle = T.line; ctx.fillRect(r.x, g.head.y + g.head.h, r.w, 1.5 * u);
  // the command bar
  if (g.command) {
    const c = g.command; ctx.fillStyle = T.paper; rr(ctx, c.x, c.y, c.w, c.h, RAD(c.h / 2)); ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = 1.5 * u; ctx.stroke();
    ctx.font = (T.font ?? SANS)(500, g.px.row); ctx.textBaseline = "middle"; const tx = c.x + 26 * u;
    if (o.typed) { ctx.fillStyle = T.ink; ctx.fillText(fitTail(ctx, o.typed, c.w - 60 * u), tx, c.y + c.h / 2); } else { ctx.fillStyle = T.mute; ctx.fillText(ui.command!, tx, c.y + c.h / 2); }
    if (o.caret) { const w = o.typed ? ctx.measureText(fitTail(ctx, o.typed, c.w - 60 * u)).width : 0; ctx.fillStyle = acc; ctx.fillRect(tx + w + 3 * u, c.y + c.h / 2 - g.px.row * 0.6, 3 * u, g.px.row * 1.2); }
  }
  // the numbers at the top
  if (g.stats) {
    const bs = ui.before.stats ?? [], as = ui.after.stats ?? [], n = Math.max(bs.length, as.length), w = g.stats.w / n, p = spring(m.f, m.t0, m.omega ?? DEF.omega, m.zeta ?? DEF.zeta);
    for (let i = 0; i < n; i++) {
      const b = bs[i], x = as[i] ?? b, sx = g.stats.x + i * w;
      ctx.font = (T.font ?? SANS)(500, g.px.small); ctx.fillStyle = T.soft; ctx.fillText((x ?? b).label, sx, g.stats.y + g.px.small * 0.7);
      ctx.font = (T.font ?? SANS)(700, g.px.stat); ctx.fillStyle = T.ink; counted(ctx, num(b?.value, x?.value, p, x?.unit ?? b?.unit ?? ""), sx, g.stats.y + g.px.small * 1.6 + g.px.stat * 0.62, "left", counting(b?.value, x?.value, p));
    }
  }
  // the items, each on its own spring
  ctx.save(); rr(ctx, g.body.x - 8 * u, g.body.y - 8 * u, g.body.w + 16 * u, g.body.h + 16 * u, RAD(12 * u)); ctx.clip();
  // draw order: leaving items first, then the ones at rest, then the movers, the one rising last (it
  // lifts over the others). Two rows that trade places pass through each other; the one passed over
  // RECEDES: its words dim as the rising row comes within two lines of it and return as it clears, so the
  // two rows' words never stand a line apart reading as one ("$1,208 $144"). Rows at rest are never dimmed.
  const all = poses(g, ui, m).map((s) => { const p = s.p, e = clamp(p), moving = !!(s.from && s.to && (s.a.y !== s.b.y || s.a.x !== s.b.x)); return { s, e, moving, box: { x: lerp(s.a.x, s.b.x, p), y: lerp(s.a.y, s.b.y, p) + (!s.from ? (1 - e) * 14 * u : 0), w: s.a.w, h: s.a.h } as Rect }; });
  const z = (q: (typeof all)[number]) => (!q.s.to ? 0 : !q.moving ? 1 : q.s.b.y < q.s.a.y || (q.s.b.y === q.s.a.y && q.s.b.x < q.s.a.x) ? 3 : 2);
  all.sort((x, y) => z(x) - z(y) || x.s.order - y.s.order);
  const near = 2.15 * g.px.row, R = Math.max(g.row, near + 0.3 * g.px.row);
  const crosses = (x: Pose, y: Pose) => x.from && x.to && y.from && y.to && Math.sign(x.a.y - y.a.y || x.a.x - y.a.x) !== Math.sign(x.b.y - y.b.y || x.b.x - y.b.x);
  for (let i = 0; i < all.length; i++) {
    const { s, e, box } = all[i], p = s.p, alpha = !s.from ? e : !s.to ? 1 - e : 1, k = !s.from ? 0.94 + 0.06 * out3(e) : 1;
    if (alpha <= 0.002) continue;
    let words = 1;
    for (let j = i + 1; j < all.length; j++) { const o = all[j]; if (!o.moving || !crosses(s, o.s) || Math.abs(o.box.x - box.x) > box.w / 2) continue; words = Math.min(words, clamp((Math.abs(o.box.y - box.y) - near) / (R - near))); }
    const it = e < 0.5 ? s.from ?? s.item : s.to ?? s.item, lift = all[i].moving ? Math.sin(Math.PI * e) : 0;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(box.x + box.w / 2, box.y + box.h / 2); ctx.scale(k, k); ctx.translate(-box.w / 2, -box.h / 2);
    if (lift > 0) { ctx.fillStyle = `rgba(20,24,30,${0.07 * lift})`; rr(ctx, -4 * u, 6 * u, box.w + 8 * u, box.h + 4 * u, RAD(14 * u)); ctx.fill(); }
    ctx.fillStyle = it.accent ? mixA(acc, T.card, 0.9) : ui.layout === "cards" ? T.paper : T.card; rr(ctx, 0, 0, box.w, box.h, RAD(14 * u)); ctx.fill();
    ctx.strokeStyle = it.accent ? mixA(acc, T.card, 0.6) : T.line; ctx.lineWidth = 1.5 * u; ctx.stroke();
    const cy = ui.layout === "cards" ? g.px.row * 1.1 : box.h / 2 - (it.bar !== undefined ? 7 * u : 0), lx = 22 * u + g.px.row * 0.9;
    // a status mark: a ring, a filled accent dot, or a tick when done
    const done = s.from && s.to ? (e < 0.5 ? !!s.from.done : !!s.to.done) : !!it.done, mr = g.px.row * 0.3, mx = 22 * u + mr;
    ctx.lineWidth = 2.2 * u; ctx.strokeStyle = it.accent || done ? acc : T.mute; ctx.beginPath(); ctx.arc(mx, cy, mr, 0, Math.PI * 2);
    if (done) { ctx.fillStyle = acc; ctx.fill(); ctx.strokeStyle = T.onAccent ?? "#fff"; ctx.beginPath(); ctx.moveTo(mx - mr * 0.45, cy); ctx.lineTo(mx - mr * 0.1, cy + mr * 0.38); ctx.lineTo(mx + mr * 0.5, cy - mr * 0.35); ctx.stroke(); } else ctx.stroke();
    ctx.font = (T.font ?? SANS)(600, g.px.row); ctx.fillStyle = T.ink; ctx.textBaseline = "middle";
    const val = num(s.from?.value, s.to?.value ?? s.from?.value, s.from && s.to ? p : 1, it.unit ?? "");
    ctx.font = (T.font ?? SANS)(700, g.px.value); const vw = val ? ctx.measureText(val).width : 0;
    const said = (draw: () => void) => { if (words <= 0) return; ctx.globalAlpha = alpha * words; draw(); ctx.globalAlpha = alpha; };
    ctx.font = (T.font ?? SANS)(600, g.px.row); said(() => ctx.fillText(fitTail(ctx, it.label, box.w - lx - vw - 60 * u, true), lx, cy));
    if (it.tag) { ctx.font = (T.font ?? SANS)(600, g.px.small); const tw = ctx.measureText(it.tag).width, tx = ui.layout === "cards" ? lx : Math.min(lx + ctx.measureText(it.label).width * (g.px.row / g.px.small) + 18 * u, box.w - vw - tw - 60 * u); if (tx > lx + 40 * u || ui.layout === "cards") { const ty = ui.layout === "cards" ? cy + g.px.row * 1.25 : cy; ctx.fillStyle = it.accent ? acc : T.chip; rr(ctx, tx - 10 * u, ty - g.px.small * 0.75, tw + 20 * u, g.px.small * 1.5, RAD(g.px.small * 0.75)); ctx.fill(); ctx.fillStyle = it.accent ? T.onAccent ?? "#fff" : T.soft; said(() => ctx.fillText(it.tag!, tx, ty)); } }
    if (val) { ctx.font = (T.font ?? SANS)(700, g.px.value); ctx.fillStyle = it.accent ? acc : T.ink; said(() => counted(ctx, val, box.w - 22 * u, ui.layout === "cards" ? box.h - g.px.value : cy, "right", !!(s.from && s.to) && counting(s.from.value, s.to.value, p))); ctx.textAlign = "left"; }
    if (it.bar !== undefined || s.from?.bar !== undefined) {
      const b0 = s.from?.bar ?? 0, b1 = s.to?.bar ?? b0, bv = clamp(s.from && s.to ? lerp(b0, b1, p) : b1, 0, 1.02), by = ui.layout === "cards" ? box.h - 16 * u : cy + g.px.row * 0.75, bw = box.w - lx - (ui.layout === "cards" ? 22 * u : vw + 60 * u);
      ctx.fillStyle = T.chip; rr(ctx, lx, by, bw, 6 * u, RAD(3 * u)); ctx.fill(); ctx.fillStyle = it.accent ? acc : T.ink; rr(ctx, lx, by, Math.max(6 * u, bw * bv), 6 * u, RAD(3 * u)); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1; ctx.textBaseline = "alphabetic";
};

// A number on its way from one value to another is set digit by digit on a tabular grid: the figures
// do not jitter sideways as they count, and no passing value is drawn as one word (a "70%" counting
// through one card is not the "70%" resting in the next). At rest it is one word again.
const counting = (a: number | string | undefined, b: number | string | undefined, p: number) => typeof a === "number" && typeof b === "number" && a !== b && Math.abs(p - 1) > 0.002 && p > 0.002;
const counted = (ctx: Ctx, s: string, x: number, y: number, align: "left" | "right", tabular: boolean) => {
  if (!tabular) { ctx.textAlign = align; ctx.fillText(s, x, y); ctx.textAlign = "left"; return; }
  const fig = ctx.measureText("0").width, adv = (ch: string) => (/[0-9]/.test(ch) ? fig : ctx.measureText(ch).width), w = [...s].reduce((a, ch) => a + adv(ch), 0);
  let cx = align === "right" ? x - w : x; ctx.textAlign = "left";
  for (const ch of s) { ctx.fillText(ch, cx + (adv(ch) - ctx.measureText(ch).width) / 2, y); cx += adv(ch); }
};
// the end of a line when it overflows (a command bar scrolls), or its start with an ellipsis (a label)
const fitTail = (ctx: Ctx, s: string, w: number, head = false) => {
  if (ctx.measureText(s).width <= w) return s;
  if (head) { let t = s; while (t.length > 1 && ctx.measureText(t + "…").width > w) t = t.slice(0, -1); return t + "…"; }
  let t = s; while (t.length > 1 && ctx.measureText(t).width > w) t = t.slice(1); return t;
};
const hx = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const shade = (h: string, k: number) => `rgb(${hx(h).map((v) => Math.round(v * k)).join(",")})`;
const mixA = (a: string, b: string, t: number) => { const x = hx(a), y = hx(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`; };
