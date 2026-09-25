// ~13 s of a visitor on the landing hero: arrive, glance around, hover the tour, hover "Get started",
// click it (the cheer), poke Bit (the giggle), click the tour (the wave).
export default async (r) => {
  await r.hold(12);
  await r.glide({ x: 420, y: 330 }, 24); await r.hold(6);
  await r.glide({ x: 1180, y: 120 }, 22); await r.hold(6);
  await r.glide('[data-anidoodle="tour"]', 26); await r.hold(26);
  await r.glide('[data-anidoodle="start"]', 16); await r.hold(24);
  await r.click(72);
  const c = await r.box("ani-doodle canvas");
  await r.glide({ x: c.x + c.width * 0.49, y: c.y + c.height * 0.62 }, 24); await r.hold(4); await r.click(40);
  await r.glide('[data-anidoodle="tour"]', 22); await r.hold(4); await r.click(50);
};
