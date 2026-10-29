// THREE TIME EDGE TESTS. src/three-core/time.ts on the inputs a film can hand it by mistake: a spring
// at 0 fps, a story clock with no anchors. Each must fail loudly with a message that says what to fix,
// never return NaN (a NaN position draws nothing and no check notices) or throw a bare TypeError.
//   node tools/test.mjs threeTime
import { spring, storyClock } from "../src/three-core/time";

const err = (f: () => unknown) => { try { const v = f(); return `returned ${v}`; } catch (e) { return String(e); } };

export const name = "threeTime";
export const run = (ok: (cond: boolean, label: string) => void) => {
  ok(spring(10, 0, 24) > -1 && spring(10, 0, 24) < 1 && spring(0, 0, 24) === 1 && spring(-1, 0, 24) === 0, "GREEN a spring at 24 fps starts at 1, rings inside +-1, is 0 before its kick");
  for (const [label, f] of [["fps 0", () => spring(5, 0, 0)], ["fps 0 at the kick", () => spring(0, 0, 0)], ["freq 0", () => spring(5, 0, 24, 0)], ["fps NaN", () => spring(5, 0, NaN)]] as const) {
    const e = err(f);
    ok(e.includes("spring:"), `L14 spring with ${label} is refused by name, not NaN (${e})`);
  }
  const e = err(() => storyClock([]));
  ok(e.includes("storyClock:"), `L14 storyClock([]) is refused when it is built, not a TypeError on first use (${e})`);
  const one = storyClock([[10, 40]]);
  ok(one.real(12) === 42 && one.story(42) === 12, "GREEN one anchor is a plain offset both ways");
};
