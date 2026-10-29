// BOARD. Checks a brief and its storyboard (board.json) before anything is drawn, and prints the board
// with a CARRY column: what each beat takes in from the one before. A board whose rows carry nothing is a
// slide deck however well it is animated later. The rules and the file format: tools/boardrules.mjs.
//   node tools/board.mjs board.json      check it; exit 1 with each problem and its fix
//   node tools/board.mjs init [board.json]   write a starting board with every field (never overwrites)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isMain } from "./is-main.mjs";
import { BOARD_TEMPLATE, checkBoard } from "./boardrules.mjs";

export const printBoard = (r) => {
  const out = [`  ${"beat".padEnd(12)} ${"s".padStart(5)}  ${"carry (in from the beat before)".padEnd(34)} action`];
  for (const t of r.table) out.push(`  ${String(t.id).slice(0, 12).padEnd(12)} ${t.seconds.toFixed(1).padStart(5)}  ${(t.carry || "-- nothing --").slice(0, 34).padEnd(34)} ${t.action.slice(0, 70)}`);
  out.push(`  ${"total".padEnd(12)} ${r.seconds.toFixed(1).padStart(5)}`);
  return out.join("\n");
};

if (isMain(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "init") { const f = resolve(arg ?? "board.json"); if (existsSync(f)) { console.log(`board: ${f} already exists; left as it is`); process.exit(0); } writeFileSync(f, JSON.stringify(BOARD_TEMPLATE, null, 2) + "\n"); console.log(`board: wrote ${f}`); process.exit(0); }
  if (!cmd) { console.error("usage: node tools/board.mjs <board.json> | init [board.json]"); process.exit(2); }
  let board; try { board = JSON.parse(readFileSync(resolve(cmd), "utf8")); } catch (e) { console.error(`board: cannot read ${cmd}: ${e.message}`); process.exit(1); }
  const r = checkBoard(board);
  console.log(`BOARD   ${cmd}\n${printBoard(r)}\n`);
  for (const p of r.problems) console.log(`  FAIL  ${p.where}: ${p.why}`);
  console.log(r.status === "PASS" ? `BOARD: PASS   ${r.table.length} beats, each carrying the last; brief complete` : `BOARD: FAIL   ${r.problems.length} problem(s)`);
  process.exit(r.status === "PASS" ? 0 : 1);
}
