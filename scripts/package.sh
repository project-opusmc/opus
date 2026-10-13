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
  echo "The ${selected_profile} profile is frozen R&D and is not a package workflow." >&2
  exit 1
fi
if [[ "${selected_profile}" == "client-cef" ]]; then
  echo "The client-cef profile is development-only: physical in-game acceptance and release signing are still open." >&2
  exit 1
fi

if [[ -n "$(git -C "${opus_root}" status --porcelain)" ]]; then
  echo "The OPUS superproject must be clean before packaging." >&2
  exit 1
fi

OPUS_BUILD_PROFILE="${selected_profile}" "${opus_root}/scripts/build.sh"
OPUS_RUNTIME_ARTIFACT_DIR="${opus_root}/runtime/build/runtime" \
  npm --prefix "${opus_root}/launcher/desktop" run tauri:build
