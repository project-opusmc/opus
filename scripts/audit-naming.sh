#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Match superseded product identifiers only as whole tokens. Word boundaries
# keep the audit from flagging unrelated substrings that merely contain these
# letters, such as a base64 integrity hash in a lockfile.
legacy_pattern='\b(rbw|rbwc|ranked[ _-]?bedwars)\b'
# The audit script necessarily contains the pattern it searches for. Exclude it
# from the content scan so the tool does not report itself.
audit_relative_path="scripts/audit-naming.sh"
audit_failed=0

for repository_dir in "${opus_root}" "${opus_root}/launcher" "${opus_root}/runtime"; do
  repository_name="$(basename "${repository_dir}")"
  legacy_paths="$(git -C "${repository_dir}" ls-files | grep -Ei "${legacy_pattern}" || true)"
  legacy_content="$(git -C "${repository_dir}" grep -IinE "${legacy_pattern}" -- . \
    | grep -v "^${audit_relative_path}:" || true)"
  if [[ -n "${legacy_paths}" || -n "${legacy_content}" ]]; then
    echo "Superseded product identifiers remain in ${repository_name}:" >&2
    [[ -z "${legacy_paths}" ]] || printf '%s\n' "${legacy_paths}" >&2
    [[ -z "${legacy_content}" ]] || printf '%s\n' "${legacy_content}" >&2
    audit_failed=1
  fi
done

exit "${audit_failed}"
