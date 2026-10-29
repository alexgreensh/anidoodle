// THE RENDER SIDECAR (<file>.film.json) travels with the film when a person sends both. It must name the
// file by its name only: an absolute path carries the maker's home folder (their user name) to whoever
// receives it. No tool reads the path back; the sha256 is what ties the sidecar to the file.
const fsModule = "node:fs";
const { readFileSync } = await import(fsModule);

export const name = "render's sidecar names the file without its folder";
export function run(ok: (cond: boolean, label: string) => void) {
  const src = readFileSync("tools/render.mjs", "utf8"), write = src.match(/writeFileSync\(`\$\{out\}\.film\.json`, JSON\.stringify\(\{([^\n]*)/)?.[1] ?? "";
  ok(write.length > 0, "render.mjs writes the sidecar in one place (found it)");
  ok(/\bfile: basename\(out\)/.test(write), "the sidecar's file field is basename(out), never the absolute path");
  ok(!/\bfile: out\b/.test(write), "NEGATIVE: the absolute output path is not written into the sidecar");
}
