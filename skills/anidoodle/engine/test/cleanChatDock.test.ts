// THE CLEAN LOOK TAKES CHAT ASKS (shipped in 0.9.6: the answer card opens as an iris). A trial film failed
// ship on its chat path, and 0.10's first fix made the clean preset refuse chat asks: a regression. The chat
// path is rebuilt in the clean register instead (references/workflows/launch-video-kit.md, Looks):
//   the hook's composer glides down whole and IS the dock: it never shrinks, on the move (64 % of a sparse
//     frame replaced in 0.1 s, a slide cut) or after it lands (a fresh critic, cc1-1: a shrink once it had
//     nearly landed read as a second move), and Ask is pressed only once it has landed, inside the window;
//   the thread's view ends above the dock;
//   the window stays opaque while the camera leans on the answer card (no see-through brand ink).
// launchExampleCleanChat is the worked example, 16:9 and 9:16; ship passes it on both.
//   node tools/test.mjs cleanChatDock
import { makeLaunchFilm, type LaunchFilm } from "../src/canvas-core/launchTemplate";
import { launchExampleCleanChat } from "../src/canvas-core/launchExampleCleanChat";
import type { Film } from "../src/canvas-core/film";

export const name = "the clean look's chat ask";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const plate: Film = { meta: { title: "plate", W: 1080, H: 1080, fps: 30, bpm: 90, durationFrames: 60 }, assets: { images: {} }, shots: [{ id: "p", start: 0, end: 60, draw: () => {} }] };
  let err = ""; try { makeLaunchFilm({ title: "Tally", preset: "clean", asks: [{ prompt: "draw it", plate, label: "l" }, { kind: "film", film: plate }], tagline: "t", install: ["npm i tally"], bpm: 90, score: null }); } catch (e) { err = (e as Error).message; }
  ok(err === "", `RED: a clean film with a chat ask builds (${err.slice(0, 90) || "ok"})`);
  for (const sh of ["16x9", "9x16"]) {
    const f = (launchExampleCleanChat as LaunchFilm).reshape(sh), d = (f as Partial<LaunchFilm>).grammar?.dock, T = f.timing[0];
    if (!d) { ok(false, `RED ${sh}: the clean hook exposes its dock`); continue; }
    ok(d.shrink[1] === d.shrink[0], `RED ${sh}: the composer glides whole (frames ${d.move.join("-")}) and never scales after it lands (${d.shrink.join("-")})`);
    ok(T.down >= d.move[1], `${sh}: Ask goes down at ${T.down}, once the composer has landed at ${d.move[1]}`);
    // (the hook is also the dock all film long, so it is set at the hook's smallest size, never larger: at 68 px
    // on 16:9 it stood 296 px tall and left the answer card a thumbnail, cc3-1, and three beats in a row
    // settled into one layout, motionscan repeat)
    ok(d.heroPx === (sh === "9x16" ? 64 : 56), `RED ${sh}: the clean hook is set at the hook's smallest size (${d.heroPx} px)`);
    ok(Math.abs(d.dockPx - d.heroPx) < 1e-6, `RED ${sh}: the dock is the hook's composer at the hook's own size (${d.heroPx} px, docked ${d.dockPx.toFixed(1)} px)`);
    const c = d.composer, w = d.window;
    ok(c.x >= w.x && c.x + c.w <= w.x + w.w && c.y >= w.y && c.y + c.h <= w.y + w.h, `${sh}: the docked composer sits inside the chat window`);
    // (on a phone the hook creeps 5 % in the clean look: its composer is narrower, so its typing alone changed
    // too little of the tall frame, and with the 4 % creep frames 13 to 46 of 9:16 were dead air to the gate)
    if (sh === "9x16") ok(d.creep >= 1.05, `RED ${sh}: the clean hook creeps 5 % (${((d.creep - 1) * 100).toFixed(0)} %)`);
    ok(d.viewBottom <= c.y, `${sh}: the thread's view ends (${Math.round(d.viewBottom)}) above the dock (${Math.round(c.y)})`);
  }
};
