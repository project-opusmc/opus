#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -n "$(git -C "${opus_root}" status --porcelain)" ]]; then
  echo "The OPUS superproject must be clean before packaging." >&2
  exit 1
fi

"${opus_root}/scripts/build.sh"
OPUS_RUNTIME_ARTIFACT_DIR="${opus_root}/runtime/build/runtime" \
  npm --prefix "${opus_root}/launcher/desktop" run tauri:build:premium
