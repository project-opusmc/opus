#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_output="${opus_root}/runtime/build/runtime"

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

case "${selected_profile}" in
  injector-development)
    node "${opus_root}/scripts/verify-release-lock.mjs" \
      "${opus_root}" \
      --profile "${selected_profile}"
    cargo build --manifest-path "${opus_root}/injector/Cargo.toml" --bin opus-injector
    "${opus_root}/scripts/build-injector-native-slice.sh" arm64
    "${opus_root}/scripts/build-injector-native-slice.sh" x86_64
    echo "Built the M3 injector preflight binary and native-runtime slices for ${selected_profile}."
    echo "The arm64 selected-PID transport fixture has a direct lifecycle proof; the current x86_64/Rosetta path is a typed pre-entry rejection. Production client transport and opus-runtime.jar are not built yet. Launcher staging and desktop packaging were intentionally skipped."
    ;;
  legacy-forge-rollback|legacy-forge)
    "${opus_root}/scripts/submodule-status.sh" --profile "${selected_profile}"
    "${opus_root}/runtime/gradlew" -p "${opus_root}/runtime" verifyRuntimeArtifacts
    node "${opus_root}/scripts/verify-release-lock.mjs" \
      "${opus_root}" \
      --profile "${selected_profile}" \
      --require-manifest
    OPUS_RUNTIME_ARTIFACT_DIR="${runtime_output}" \
      "${opus_root}/launcher/scripts/prepare-desktop-assets.sh"
    cargo build --manifest-path "${opus_root}/launcher/Cargo.toml" --workspace
    npm --prefix "${opus_root}/launcher/desktop" run build
    ;;
  *)
    echo "No build workflow is defined for release-lock profile: ${selected_profile}" >&2
    exit 1
    ;;
esac
