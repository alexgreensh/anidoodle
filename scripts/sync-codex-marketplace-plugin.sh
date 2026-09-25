#!/usr/bin/env bash
# sync-codex-marketplace-plugin.sh
#
# Regenerates plugins/anidoodle/ (the Codex marketplace plugin) from the canonical skill at
# skills/anidoodle/ and .codex-plugin/plugin.json.
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
for marker in ".agents/plugins/marketplace.json" ".codex-plugin/plugin.json" "skills/anidoodle/SKILL.md"; do
  [ -e "${REPO_ROOT}/${marker}" ] || { echo "ERROR: REPO_ROOT looks wrong (missing ${marker}): ${REPO_ROOT}" >&2; exit 3; }
done

NESTED="${REPO_ROOT}/plugins/anidoodle"
mkdir -p "${REPO_ROOT}/plugins"
STAGE="$(mktemp -d "${REPO_ROOT}/plugins/.stage-XXXXXX")"
trap 'rm -rf "${STAGE}"' EXIT

mkdir -p "${STAGE}/.codex-plugin"
cp "${REPO_ROOT}/.codex-plugin/plugin.json" "${STAGE}/.codex-plugin/plugin.json"
cd "${REPO_ROOT}"
count=0
while IFS= read -r f; do
  mkdir -p "${STAGE}/$(dirname "$f")"; cp -p "$f" "${STAGE}/$f"; count=$((count + 1))
done < <(git ls-files skills/)

[ -f "${STAGE}/skills/anidoodle/SKILL.md" ] || { echo "ERROR: SKILL.md missing after copy (is it committed?)" >&2; exit 4; }
[ "${count}" -ge 50 ] || { echo "ERROR: only ${count} files copied; expected the whole skill" >&2; exit 4; }

rm -rf "${NESTED}"; mv "${STAGE}" "${NESTED}"; trap - EXIT
echo "Synced Codex marketplace plugin -> plugins/anidoodle (${count} tracked files, $(grep -o '"version"[^,]*' "${NESTED}/.codex-plugin/plugin.json" | head -1))"
