#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
legacy_pattern='rbw|rbwc|ranked[ _-]?bedwars'
audit_failed=0

for repository_dir in "${opus_root}" "${opus_root}/launcher" "${opus_root}/runtime"; do
  repository_name="$(basename "${repository_dir}")"
  legacy_paths="$(git -C "${repository_dir}" ls-files | grep -Ei "${legacy_pattern}" || true)"
  legacy_content="$(git -C "${repository_dir}" grep -IinE "${legacy_pattern}" -- . || true)"
  if [[ -n "${legacy_paths}" || -n "${legacy_content}" ]]; then
    echo "Superseded product identifiers remain in ${repository_name}:" >&2
    [[ -z "${legacy_paths}" ]] || printf '%s\n' "${legacy_paths}" >&2
    [[ -z "${legacy_content}" ]] || printf '%s\n' "${legacy_content}" >&2
    audit_failed=1
  fi
done

exit "${audit_failed}"
