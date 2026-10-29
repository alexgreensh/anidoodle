// END CARD. One card, one frame, an asymmetric grid: the layout the director approved on a brand launch film
// after rejecting a centred stack ("who is gonna read this overload of info?"), a shrunken card under a
// stinger and a split into extra frames ("too many slides now"). Built from the approved v12 card:
//   lockup top-left at the margin; the event lines (date, venue) under it; the call to action as a
//   stamp on the right, sitting on the venue's baseline; a hairline; a sponsor band along the foot,
//   its label large enough not to be swallowed (38 px, weight 800 at 1080) and each sponsor switchable.
// Variants for 16x9, 1x1, 4x5 and 9x16 come from the frame's own shape (on 9:16 everything stays out of
// the platforms' bands and the right button column). The card reports itself to the frame probe as
// "end card", so framecheck fails a film whose card lands twice (card, stinger, card).
//   endCardLayout(W, H, spec, measure)   pure: every rectangle and size, for tests and for the draw
//   drawEndCard(ctx, env, spec, p)        draws it; p 0..1 is the arrival (staggered rise, no fade)
import { probeRect, type Ctx, type Env } from "./core";

export type Rect = { x: number; y: number; w: number; h: number };
export type Sponsor = { name: string; aspect: number; on?: boolean; draw: (ctx: Ctx, box: Rect) => void };
export type EndCardSpec = {
  // the exact brand lockup (brand import), drawn into its box; descent: how far its drawing hangs below
  // the box, as a share of the box's height (a name set on the box's foot as its baseline: its descenders)
  lockup: { aspect: number; draw: (ctx: Ctx, box: Rect) => void; descent?: number };
  date: string; venue: string;
  cta: string;
  sponsors?: { label?: string; list: Sponsor[] };
  colors: { ink: string; accent: string; ctaInk: string; hair?: string };
  font?: (weight: number, px: number) => string;
  // where a wide card's stamp sits on the venue's baseline: "edge", at the right margin (the approved card,
  // over its sponsor band), or "inline", one gap after the text block (a card with no band, where a stamp
  // at the edge floats far from everything it belongs to)
  stamp?: "edge" | "inline";
};
const FONT = (w: number, px: number) => `${w} ${px}px "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif`;
export type Measure = (text: string, font: string) => number;
export type EndCardLayout = { margin: number; lockup: Rect; date: Rect & { px: number }; venue: Rect & { px: number }; cta: Rect & { px: number }; hairY: number; label: Rect & { px: number } | null; logos: (Rect & { name: string })[]; shape: "wide" | "square" | "tall" };

/** Every rectangle of the card for a W x H frame. `measure` gives a text's width in a font (ctx.measureText in the draw). */
export const endCardLayout = (W: number, H: number, spec: EndCardSpec, measure: Measure): EndCardLayout => {
  const font = spec.font ?? FONT, u = Math.min(W, H) / 1080, shape = W / H > 1.2 ? "wide" : W / H < 0.7 ? "tall" : "square";
  const air = Math.ceil(0.035 * H); // the smallest gap between two parts: over framecheck's 3 % of the height
  const margin = shape === "wide" ? Math.round(W * 0.078) : Math.round(W * 0.09);
  const fit = (text: string, w: number, maxPx: number, minPx: number, weight: number) => { let px = maxPx; while (px > minPx && measure(text, font(weight, px)) > w) px -= 1; return px; };
  const top = shape === "tall" ? Math.round(H * 0.17) : margin; // 9:16: under the platforms' top band
  const textW = shape === "tall" ? Math.floor(W * 0.86) - margin - 8 : W - 2 * margin; // 9:16: lines end left of the platforms' right button column (14 %)
  const lockW = shape === "wide" ? W * 0.36 : W * (shape === "tall" ? 0.7 : 0.55), lockup = { x: margin, y: top, w: lockW, h: lockW / spec.lockup.aspect };
  const datePx = fit(spec.date, textW, Math.round(64 * u), Math.round(40 * u), 800), venuePx = fit(spec.venue, shape === "wide" ? W * 0.5 : textW, Math.round(44 * u), Math.round(32 * u), 600);
  const date = { x: margin, y: lockup.y + lockup.h * (1 + (spec.lockup.descent ?? 0)) + Math.max(Math.round(56 * u), air), w: measure(spec.date, font(800, datePx)), h: datePx, px: datePx };
  const venue = { x: margin, y: date.y + date.h + Math.round(18 * u), w: measure(spec.venue, font(600, venuePx)), h: venuePx, px: venuePx };
  const ctaPx = fit(spec.cta, shape === "wide" ? W * 0.3 : textW - 80 * u, Math.round(44 * u), Math.round(32 * u), 800), padX = Math.round(36 * u), padY = Math.round(22 * u);
  const ctaW = measure(spec.cta, font(800, ctaPx)) + 2 * padX, ctaH = ctaPx + 2 * padY;
  // the stamp sits on the venue's baseline, on the right (wide); under the event lines, still left-aligned, elsewhere: never centred
  const inlineX = margin + Math.max(date.w, venue.w) + Math.round(72 * u);
  const cta = shape === "wide" ? { x: spec.stamp === "inline" ? Math.min(inlineX, W - margin - ctaW) : W - margin - ctaW, y: venue.y + venue.h - ctaH + padY, w: ctaW, h: ctaH, px: ctaPx } : { x: margin, y: venue.y + venue.h + Math.round(48 * u), w: ctaW, h: ctaH, px: ctaPx };
  const on = (spec.sponsors?.list ?? []).filter((s) => s.on !== false);
  const bottom = shape === "tall" ? Math.round(H * 0.74) : H - margin; // 9:16: above the platforms' bottom band
  let label: EndCardLayout["label"] = null, logos: EndCardLayout["logos"] = [], hairY = bottom;
  if (on.length) {
    const labelPx = Math.round(38 * u), logoH = Math.round((shape === "wide" ? 0.062 : 0.05) * H * 1.3) /* v12: logos 1.3x after the designer's pass */, gap = Math.max(Math.round(56 * u), air), text = spec.sponsors?.label ?? "Sponsors";
    const perRow = shape === "wide" ? on.length : Math.min(on.length, 3), rows = Math.ceil(on.length / perRow), bandH = labelPx + air + rows * logoH + (rows - 1) * air;
    hairY = bottom - bandH - Math.round(36 * u);
    label = { x: margin, y: hairY + Math.round(36 * u), w: measure(text, font(800, labelPx)), h: labelPx, px: labelPx };
    const avail = W - 2 * margin, y0 = label.y + labelPx + air;
    for (let r = 0; r < rows; r++) {
      const row = on.slice(r * perRow, (r + 1) * perRow); let h = logoH, ws = row.map((s) => s.aspect * h), tot = ws.reduce((a, b) => a + b, 0) + gap * (row.length - 1);
      if (tot > avail) { const k = (avail - gap * (row.length - 1)) / (tot - gap * (row.length - 1)); h *= k; ws = ws.map((w) => w * k); }
      let x = margin; row.forEach((s, i) => { logos.push({ name: s.name, x, y: y0 + r * (logoH + air) + (logoH - h) / 2, w: ws[i], h }); x += ws[i] + gap; });
    }
  }
  return { margin, lockup, date, venue, cta, hairY, label, logos, shape };
};

/** Draw the end card; p 0..1 is its arrival (each part rises into place in turn, no fade). */
export const drawEndCard = (ctx: Ctx, env: Env, spec: EndCardSpec, p = 1) => {
  const font = spec.font ?? FONT, L = endCardLayout(env.W, env.H, spec, (t, f) => { ctx.font = f; return ctx.measureText(t).width; });
  const parts = 4 + (L.label ? 1 : 0), part = (i: number) => { const q = Math.max(0, Math.min(1, p * (1 + 0.25 * (parts - 1)) - 0.25 * i)); return 1 - Math.pow(1 - q, 3); };
  const rise = (i: number, r: Rect, draw: () => void) => { const e = part(i); if (e <= 0) return; ctx.save(); ctx.beginPath(); ctx.rect(r.x - 4, r.y - r.h * 0.3, r.w + 8, r.h * 1.6); ctx.clip(); ctx.translate(0, (1 - e) * r.h * 1.2); draw(); ctx.restore(); };
  if (p >= 1) probeRect(ctx, env, L.margin * 0.5, L.margin * 0.5, env.W - L.margin, env.H - L.margin, "end card");
  rise(0, L.lockup, () => spec.lockup.draw(ctx, L.lockup));
  ctx.textBaseline = "top"; ctx.textAlign = "left";
  rise(1, L.date, () => { ctx.fillStyle = spec.colors.ink; ctx.font = font(800, L.date.px); ctx.fillText(spec.date, L.date.x, L.date.y); });
  rise(2, L.venue, () => { ctx.fillStyle = spec.colors.ink; ctx.font = font(600, L.venue.px); ctx.fillText(spec.venue, L.venue.x, L.venue.y); });
  rise(3, L.cta, () => {
    const r = L.cta, rad = r.h * 0.22; ctx.fillStyle = spec.colors.accent; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.fillStyle = spec.colors.ctaInk; ctx.font = font(800, r.px); ctx.textBaseline = "middle"; ctx.fillText(spec.cta, r.x + (r.w - ctx.measureText(spec.cta).width) / 2, r.y + r.h / 2); ctx.textBaseline = "top";
  });
  if (L.label) {
    const e = part(4); if (e > 0) { ctx.save(); ctx.strokeStyle = spec.colors.hair ?? spec.colors.ink; ctx.globalAlpha *= 0.35; ctx.lineWidth = Math.max(1, env.H / 1080); ctx.beginPath(); ctx.moveTo(L.margin, L.hairY); ctx.lineTo(L.margin + (env.W - 2 * L.margin) * e, L.hairY); ctx.stroke(); ctx.restore(); }
    rise(4, L.label, () => { ctx.fillStyle = spec.colors.ink; ctx.font = font(800, L.label!.px); ctx.fillText(spec.sponsors?.label ?? "Sponsors", L.label!.x, L.label!.y); });
    const on = (spec.sponsors?.list ?? []).filter((s) => s.on !== false);
    L.logos.forEach((b, i) => rise(4, b, () => { on[i].draw(ctx, b); probeRect(ctx, env, b.x, b.y, b.w, b.h, `sponsor:${b.name}`); }));
  }
  return L;
};
