#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"${opus_root}/scripts/submodule-status.sh"
"${opus_root}/launcher/scripts/check.sh"
"${opus_root}/runtime/scripts/check.sh"
node "${opus_root}/scripts/verify-release-lock.mjs" \
  "${opus_root}" \
  --require-manifest
"${opus_root}/scripts/audit-naming.sh"
