// LINKED PROJECTS. A project made by scaffold.mjs --linked runs the engine's tools from its own folder,
// which has no copy of the engine's src/. Every engine file a tool reads must come through enginePath,
// or the tool looks in the project folder and fails. render.mjs once built the loudness meter from
// resolve("src/canvas-core/music/meter.ts") and could not find it in a linked project.
const fsModule = "node:fs", cpModule = "node:child_process", osModule = "node:os", pathModule = "node:path";
const { readFileSync, mkdtempSync, rmSync, existsSync } = await import(fsModule);
const { spawnSync } = await import(cpModule);
const { tmpdir } = await import(osModule);
const { join, resolve } = await import(pathModule);

export const name = "linked projects find the engine's files (enginePath)";
export function run(ok: (cond: boolean, label: string) => void) {
  // 1. render.mjs builds the meter through enginePath, never from the working directory
  const render = readFileSync("tools/render.mjs", "utf8");
  ok(/enginePath\("src\/canvas-core\/music\/meter\.ts"\)/.test(render), "render.mjs builds the loudness meter from enginePath");
  ok(!/resolve\("src\//.test(render), "render.mjs resolves no engine file against the working directory");

  // 2. run from an empty project folder, enginePath still lands on the engine's meter
  const engine = resolve("."), project = mkdtempSync(join(tmpdir(), "anidoodle-linked-"));
  try {
    const script = `import(${JSON.stringify(join(engine, "tools/overlay.mjs"))}).then((m) => console.log(m.enginePath("src/canvas-core/music/meter.ts")))`;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: project, encoding: "utf8" });
    const got = String(r.stdout).trim();
    ok(r.status === 0, `enginePath runs from a project folder (exit ${r.status}${r.stderr ? `: ${String(r.stderr).trim().split("\n")[0]}` : ""})`);
    ok(got === join(engine, "src/canvas-core/music/meter.ts") && existsSync(got), `from a project folder the meter resolves to the engine's copy (${got})`);
  } finally { rmSync(project, { recursive: true, force: true }); }
}
