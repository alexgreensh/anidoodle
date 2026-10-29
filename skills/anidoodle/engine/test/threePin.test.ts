// THREE.JS IS PINNED BY HASH. The repository vendors three.js 0.170.0; the installed plugin gets the same
// release from npm. Whichever is found must be byte-identical to the pinned build, or the build stops.
const fsModule = "node:fs", proc = (globalThis as any).process;
const { readFileSync } = await import(fsModule);
const { resolveThree, threeCandidates, THREE_SHA256 } = await import(`file://${proc.cwd()}/tools/overlay.mjs`);

export const name = "three.js resolves to the pinned 0.170.0 build, vendored or from npm, and nothing else";
export function run(ok: (cond: boolean, label: string) => void) {
  const [vendored, npm] = threeCandidates("/e");
  const real = resolveThree();
  ok(typeof real === "string" && real.endsWith("three.module.js"), "this checkout resolves three.js and its hash matches the pin");
  ok(THREE_SHA256.length === 64, "the pin is a full sha256");
  const bytes = readFileSync(real);
  ok(resolveThree("/e", (f: string) => (f === npm ? bytes : null)) === npm, "with no vendored copy (the plugin) the npm copy is used");
  ok(resolveThree("/e", (f: string) => (f === vendored || f === npm ? bytes : null)) === vendored, "the vendored copy wins when both exist");
  let msg = ""; try { resolveThree("/e", (f: string) => (f === npm ? new TextEncoder().encode("tampered") : null)); } catch (e) { msg = (e as Error).message; }
  ok(/not the pinned 0\.170\.0 build/.test(msg), "NEGATIVE: a different three.js stops the build and says to run npm install");
  msg = ""; try { resolveThree("/e", () => null); } catch (e) { msg = (e as Error).message; }
  ok(/not installed: run npm install/.test(msg), "NEGATIVE: no three.js at all stops the build with the fix");
}
