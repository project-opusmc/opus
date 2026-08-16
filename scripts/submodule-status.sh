#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "${opus_root}/.gitmodules" ]]; then
  echo "OPUS submodule configuration is missing." >&2
  exit 1
fi

submodule_output="$(git -C "${opus_root}" submodule status --recursive)"
if [[ -z "${submodule_output}" ]]; then
  echo "OPUS has no initialized submodules." >&2
  exit 1
fi
if printf '%s\n' "${submodule_output}" | grep -Eq '^[-+U]'; then
  printf '%s\n' "${submodule_output}" >&2
  echo "A submodule is missing, conflicted, or not at its pinned commit." >&2
  exit 1
fi

for component_name in launcher runtime; do
  if [[ -n "$(git -C "${opus_root}/${component_name}" status --porcelain)" ]]; then
    echo "Submodule has uncommitted changes: ${component_name}" >&2
    exit 1
  fi
done

node "${opus_root}/scripts/verify-release-lock.mjs" "${opus_root}"
printf '%s\n' "${submodule_output}"
