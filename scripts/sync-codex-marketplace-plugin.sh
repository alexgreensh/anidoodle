#!/usr/bin/env bash
# sync-codex-marketplace-plugin.sh
#
# Regenerates plugins/anidoodle/ (the self-contained plugin folder) from the canonical skill at
# skills/anidoodle/, the Codex and Claude manifests, LICENSE, NOTICE and scripts/plugin-README.md.
# Codex installs it from .agents/plugins/marketplace.json, Grok from .grok-plugin/marketplace.json,
# and it is the folder submitted to directories that want a plugin without the repo's demo media.
#
# WHY: Codex resolves marketplace plugins only from a subdirectory (./plugins/<name>), and its
# install copy does not follow symlinks, so the nested plugin must hold real files.
# WHY git ls-files: the mirror copies ONLY files tracked by git. Private work (gitignored
# recreations, scratch renders, node_modules) can never leak into the published plugin.
#
# Run before every release; scripts are idempotent (an in-sync tree gives no git diff).
set -euo pipefail
[ -n "${BASH_VERSION:-}" ] || { echo "ERROR: run with bash" >&2; exit 2; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
for marker in ".agents/plugins/marketplace.json" ".codex-plugin/plugin.json" ".claude-plugin/plugin.json" \
              "scripts/plugin-README.md" "LICENSE" "NOTICE" "skills/anidoodle/SKILL.md"; do
  [ -e "${REPO_ROOT}/${marker}" ] || { echo "ERROR: REPO_ROOT looks wrong (missing ${marker}): ${REPO_ROOT}" >&2; exit 3; }
done

NESTED="${REPO_ROOT}/plugins/anidoodle"
mkdir -p "${REPO_ROOT}/plugins"
STAGE="$(mktemp -d "${REPO_ROOT}/plugins/.stage-XXXXXX")"
trap 'rm -rf "${STAGE}"' EXIT

mkdir -p "${STAGE}/.codex-plugin"
cp "${REPO_ROOT}/.codex-plugin/plugin.json" "${STAGE}/.codex-plugin/plugin.json"
mkdir -p "${STAGE}/.claude-plugin"
cp "${REPO_ROOT}/.claude-plugin/plugin.json" "${STAGE}/.claude-plugin/plugin.json"
cp "${REPO_ROOT}/scripts/plugin-README.md" "${STAGE}/README.md"
cp "${REPO_ROOT}/LICENSE" "${REPO_ROOT}/NOTICE" "${STAGE}/"
mkdir -p "${STAGE}/assets"
cp "${REPO_ROOT}/assets/icon.png" "${STAGE}/assets/icon.png"
cd "${REPO_ROOT}"
# The installed plugin leaves out what only the repository needs: anidoodle's own launch films
# (launch, launch2, launch3, launchClip and their helpers and pages) and its showcase films (the
# cheetah films, their scores, pages and rig test), the public-domain reference image they show,
# and the gallery sheet and the tool that rebuilds it (the docs link to it online).
# A test that needs a left-out file is left out with it (craft.test.ts reads the blind pieces).
# The engine's unit tests and the worked example film stay in the repository too: Anthropic's directory
# holds any plugin over 512 files for a manual review, so every release waited days. The tools that
# use them (npm test, gate --self-test, scaffold --example) say where to get them when they are absent.
EXCLUDE='^skills/anidoodle/engine/test/|^skills/anidoodle/example/|/canvas-core/(launch|launch2|launch3|launchClip|launchCode|typeOptions|typeStyles)\.ts$|/hosts/page-(launch|launch2|launch3|launchClip|typeOptions|typeStyles)\.ts$|/engine/assets/refs/|/engine/tools/gallery\.mjs$|^skills/anidoodle/assets/styles\.jpg$|/engine/package-lock\.json$|/music/blind/|/canvas-core/cheetah[A-Za-z]*\.ts$|/music/pieces/cheetah[A-Za-z]*\.ts$|/hosts/page-cheetah[A-Za-z]*\.ts$|/test/cheetahRig\.test\.ts$|/test/craft\.test\.ts$'
count=0
while IFS= read -r f; do
  mkdir -p "${STAGE}/$(dirname "$f")"; cp -p "$f" "${STAGE}/$f"; count=$((count + 1))
done < <(git ls-files skills/ | grep -v -E "${EXCLUDE}")

# a showcase or launch film in the installed plugin is a leak of the repository's own promotion: refuse to publish one
leaked="$(cd "${STAGE}" && find . -type f \( -iname 'cheetah*' -o -iname 'page-cheetah*' -o -name 'launch[0-9]*.ts' -o -name 'launchClip.ts' \) | head -5)"
[ -z "${leaked}" ] || { echo "ERROR: repository-only films reached the plugin folder:" >&2; echo "${leaked}" >&2; exit 5; }
# what is left must stand on its own: every relative import in the staged engine's sources and tests resolves
# to a staged file (the tools are skipped: they hold import lines inside the code they generate)
if command -v node >/dev/null 2>&1; then
  node -e '
    const fs = require("fs"), path = require("path"), root = process.argv[1], bad = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    for (const f of [path.join(root, "src"), path.join(root, "test")].filter((d) => fs.existsSync(d)).flatMap(walk).filter((f) => /\.ts$/.test(f))) for (const m of fs.readFileSync(f, "utf8").matchAll(/^\s*(?:import|export)\b[^"\x27;]*?from\s+["\x27](\.{1,2}\/[^"\x27]+)["\x27]/gm)) {
      const t = path.resolve(path.dirname(f), m[1]);
      if (![t, t + ".ts", t + ".mjs", t + ".json", path.join(t, "index.ts")].some((c) => fs.existsSync(c) && fs.statSync(c).isFile())) bad.push(path.relative(root, f) + " -> " + m[1]);
    }
    if (bad.length) { console.error("ERROR: the plugin folder imports files it leaves out:\n  " + bad.slice(0, 10).join("\n  ")); process.exit(6); }
  ' "${STAGE}/skills/anidoodle/engine" || exit 6
fi
[ -f "${STAGE}/skills/anidoodle/SKILL.md" ] || { echo "ERROR: SKILL.md missing after copy (is it committed?)" >&2; exit 4; }
[ "${count}" -ge 50 ] || { echo "ERROR: only ${count} files copied; expected the whole skill" >&2; exit 4; }

# Anthropic's directory holds a plugin with more than 512 files, or any non-image file of 256 KiB or more,
# for a manual review. Fail well before the line so a release never stalls there; warn as it gets close.
total="$(cd "${STAGE}" && find . -type f | wc -l | tr -d ' ')"
[ "${total}" -le 500 ] || { echo "ERROR: plugin folder has ${total} files; the directory holds anything over 512. Leave more out." >&2; exit 7; }
[ "${total}" -le 490 ] || echo "WARNING: plugin folder has ${total} files, close to the directory's 512-file hold." >&2
big="$(cd "${STAGE}" && find . -type f -size +255k ! -iname '*.png' ! -iname '*.jpg' ! -iname '*.jpeg' ! -iname '*.gif' ! -iname '*.webp' ! -iname '*.svg' | head -5)"
[ -z "${big}" ] || { echo "ERROR: files of 256 KiB or more are held by the directory:" >&2; echo "${big}" >&2; exit 7; }

rm -rf "${NESTED}"; mv "${STAGE}" "${NESTED}"; trap - EXIT
echo "Synced plugin folder -> plugins/anidoodle (${total} files, $(grep -o '"version"[^,]*' "${NESTED}/.codex-plugin/plugin.json" | head -1))"
