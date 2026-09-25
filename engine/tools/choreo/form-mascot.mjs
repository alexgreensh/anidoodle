// ~14 s of someone signing up: name (he reads along), email, password (he covers his eyes), Show
// (caught peeking), submit with a short password (a worried head-shake), fix it, submit (busy, cheer).
export default async (r) => {
  await r.hold(8);
  await r.glide("#name", 20); await r.click(2); await r.type("Ada", 3); await r.hold(4);
  await r.glide("#email", 14); await r.click(2); await r.type("ada@paper.club", 2); await r.hold(4);
  await r.glide("#password", 14); await r.click(14); await r.type("pencil", 3); await r.hold(6);
  await r.glide(".reveal", 12); await r.click(30); await r.click(6);
  await r.glide(".submit", 16); await r.hold(4); await r.click(46);
  await r.glide("#password", 16); await r.click(2); await r.type("s!", 3); await r.hold(4);
  await r.glide(".submit", 16); await r.hold(2); await r.click(8);   // "busy"
  await r.eval(() => new Promise((res) => setTimeout(res, 1200)));   // the page's own 1.1 s setTimeout runs on real time
  await r.hold(82);
};
