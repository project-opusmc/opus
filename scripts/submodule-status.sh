#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$#" -eq 2 && "$1" == "--profile" && -n "$2" ]]; then
  selected_profile="$2"
elif [[ "$#" -ne 0 ]]; then
  echo "Usage: $0 [--profile <name>]" >&2
  exit 1
fi

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

if [[ -n "${selected_profile:-}" ]]; then
  node "${opus_root}/scripts/verify-release-lock.mjs" \
    "${opus_root}" \
    --profile "${selected_profile}"
else
  node "${opus_root}/scripts/verify-release-lock.mjs" "${opus_root}"
fi
printf '%s\n' "${submodule_output}"
