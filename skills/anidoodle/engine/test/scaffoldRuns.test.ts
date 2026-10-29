// THE FIRST COMMAND IN SKILL.md. scaffold.mjs walks the engine's import graph to leave anidoodle's own films
// out of a new project. A film that imports a font or JSON file by path once crashed that walk, so the very
// first command a person runs failed. This runs the real scaffold into a temporary folder.
const cp = "node:child_process", fsm = "node:fs", osm = "node:os", pm = "node:path";
const { spawnSync } = await import(cp), { mkdtempSync, rmSync, existsSync } = await import(fsm), { tmpdir } = await import(osm), { join } = await import(pm);
const proc = (globalThis as any).process;

export const name = "scaffold.mjs makes a project that has its film and leaves our own launch films out";
export function run(ok: (cond: boolean, label: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "anidoodle-scaffold-")), target = join(dir, "art");
  try {
    const r = spawnSync(proc.execPath, ["tools/scaffold.mjs", target, "--film", "intro", "--duration", "4"], { encoding: "utf8" });
    ok(r.status === 0, `RED: the scaffold exits 0 (got ${r.status}: ${(r.stderr || "").split("\n").find((l: string) => /Error/.test(l)) ?? ""})`);
    ok(existsSync(join(target, "src/canvas-core/intro.ts")), "the new film is there");
    ok(!existsSync(join(target, "src/canvas-core/launch3.ts")), "NEGATIVE: anidoodle's own launch film is left out");
    ok(existsSync(join(target, "assets/fonts/Lora-Bold.ttf")) && existsSync(join(target, "assets/brand/lantern/brand.json")), "the fonts and brand files films import by path come along");
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
