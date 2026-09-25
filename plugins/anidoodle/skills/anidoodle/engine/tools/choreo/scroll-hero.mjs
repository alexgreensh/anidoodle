// ~14 s of a reader: the intro, then down the whole track at a reading pace (pencil, paint, line), a
// little way back up to un-draw, and down to the finished plate.
export default async (r) => {
  const t = await r.eval(() => { const e = document.getElementById("track"); return { top: e.getBoundingClientRect().top + scrollY, h: e.offsetHeight, vh: innerHeight }; });
  const at = (f) => t.top + f * (t.h - t.vh);
  await r.glide({ x: 300, y: 520 }, 14); await r.hold(6);
  await r.scroll(at(0), 28); await r.hold(4);
  await r.scroll(at(0.12), 36); await r.scroll(at(0.4), 62);
  await r.scroll(at(0.66), 58); await r.scroll(at(0.92), 58);
  await r.scroll(at(0.55), 30); await r.hold(4);
  await r.scroll(at(1), 50); await r.hold(36);
};
