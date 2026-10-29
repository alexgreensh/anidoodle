// RENDER'S BLUR REPORT (review L2). The blur mask keeps type sharp only where the frame's own canvas draws
// it: type composited from an offscreen layer blurs with the picture. The page's blur() now says how many
// layers holding type blurred (typeInLayers); render must carry that through the adapter and say it, so
// "type kept sharp on N frames" never overstates what the mask did.
const fsModule = "node:fs";
const { readFileSync } = await import(fsModule);

export const name = "render reports type that blurred inside layers (L2)";
export function run(ok: (cond: boolean, label: string) => void) {
  const adapter = readFileSync("tools/adapters/playwright.mjs", "utf8"), render = readFileSync("tools/render.mjs", "utf8");
  const blurLine = adapter.split("\n").find((l: string) => /^\s*blur: async/.test(l)) ?? "";
  ok(/typeInLayers: r\.typeInLayers/.test(blurLine), "the playwright adapter's blur() passes the page's typeInLayers through");
  ok(/cost\.push\(\{[^}]*typeInLayers: f\.typeInLayers/.test(render), "render records typeInLayers per frame");
  ok(/frame\(s\) composited type from layers that blurred/.test(render), "render prints how many frames composited type from layers that blurred");
}
