#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_output="${opus_root}/runtime/build/runtime"

"${opus_root}/scripts/submodule-status.sh"
"${opus_root}/runtime/gradlew" -p "${opus_root}/runtime" verifyRuntimeArtifacts
node "${opus_root}/scripts/verify-release-lock.mjs" \
  "${opus_root}" \
  --require-manifest
OPUS_RUNTIME_ARTIFACT_DIR="${runtime_output}" \
  "${opus_root}/launcher/scripts/prepare-desktop-assets.sh"
cargo build --manifest-path "${opus_root}/launcher/Cargo.toml" --workspace
npm --prefix "${opus_root}/launcher/desktop" run build
