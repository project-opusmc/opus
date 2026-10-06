#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -n "${OPUS_BUILD_PROFILE:-}" ]]; then
  selected_profile="$(node "${opus_root}/scripts/verify-release-lock.mjs" \
    "${opus_root}" \
    --profile "${OPUS_BUILD_PROFILE}" \
    --print-profile)"
else
  selected_profile="$(node "${opus_root}/scripts/verify-release-lock.mjs" \
    "${opus_root}" \
    --print-profile)"
fi

if [[ "${selected_profile}" == "injector-development" ]]; then
  echo "The ${selected_profile} profile is foundation-only and cannot be packaged." >&2
  echo "Build and checksum-lock the injector, native runtime, and Java payload before enabling packaging." >&2
  exit 1
fi

if [[ -n "$(git -C "${opus_root}" status --porcelain)" ]]; then
  echo "The OPUS superproject must be clean before packaging." >&2
  exit 1
fi

OPUS_BUILD_PROFILE="${selected_profile}" "${opus_root}/scripts/build.sh"
OPUS_RUNTIME_ARTIFACT_DIR="${opus_root}/runtime/build/runtime" \
  npm --prefix "${opus_root}/launcher/desktop" run tauri:build
