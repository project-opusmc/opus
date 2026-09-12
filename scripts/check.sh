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

case "${selected_profile}" in
  injector-development)
    node "${opus_root}/scripts/check-runtime-artifact-contract.mjs"
    cargo fmt --manifest-path "${opus_root}/injector/Cargo.toml" -- --check
    cargo test --manifest-path "${opus_root}/injector/Cargo.toml"
    cargo clippy --manifest-path "${opus_root}/injector/Cargo.toml" --all-targets -- -D warnings
    "${opus_root}/scripts/build-injector-native-slice.sh" arm64
    "${opus_root}/scripts/build-injector-native-slice.sh" x86_64
    "${opus_root}/scripts/build-injector-native-transport.sh" arm64
    "${opus_root}/scripts/build-injector-native-transport.sh" x86_64
    "${opus_root}/tests/check-injector-native-vm-read-probe.sh"
    "${opus_root}/tests/check-injector-native-vm-rw-probe.sh"
    "${opus_root}/tests/check-injector-native-transport-probe.sh"
    "${opus_root}/tests/check-injector-native-direct-vm-gates.sh"
    "${opus_root}/tests/check-injector-native-execution-probe.sh"
    "${opus_root}/tests/check-injector-native-runtime-load.sh"
    "${opus_root}/tests/check-injector-x86_64-rosetta-transport-rejection.sh"
    "${opus_root}/scripts/check-injector-m3-preflight.sh"
    "${opus_root}/scripts/check-injector-foundation.sh"
    "${opus_root}/scripts/check-injector-native-bridge-contract.sh"
    "${opus_root}/scripts/check-injector-attach-harness.sh"
    "${opus_root}/scripts/check-injector-owned-target-harness.sh"
    "${opus_root}/scripts/check-injector-authorized-target.sh"
    "${opus_root}/scripts/check-injector-opus-owned-client-preview.sh"
    "${opus_root}/scripts/check-injector-x86_64-owned-target.sh"
    bash -n "${opus_root}/scripts/capture-opus-owned-m3-evidence.sh"
    bash -n "${opus_root}/scripts/check-opus-owned-m3-clean-close.sh"
    bash "${opus_root}/tests/check-capture-opus-owned-m3-evidence.sh"
    (
      cd "${opus_root}/launcher"
      cargo test -p opus-engine --features opus-owned-m3-preview
      cargo check -p opus-cli --features opus-owned-m3-preview
    )
    node "${opus_root}/scripts/verify-release-lock.mjs" \
      "${opus_root}" \
      --profile "${selected_profile}"
    node "${opus_root}/tests/verify-release-lock.mjs"
    node "${opus_root}/tests/verify-m3-client-integration-evidence.mjs"
    "${opus_root}/scripts/audit-naming.sh"
    echo "OPUS M3 preflight, selected-PID native transport, test-only Attach harness, owned-target, and authorized-target lifecycle checks passed for ${selected_profile}; no distributable payload exists yet."
    ;;
  legacy-forge-rollback|legacy-forge)
    node "${opus_root}/scripts/check-runtime-artifact-contract.mjs"
    "${opus_root}/scripts/submodule-status.sh" --profile "${selected_profile}"
    # Component check scripts assume their own repository root as the working
    # directory (bare `cargo`, `npm --prefix desktop`, pinned rust-toolchain.toml).
    # Invoke them from inside each component so toolchain and manifest resolution
    # match the component's standalone CI.
    (cd "${opus_root}/launcher" && ./scripts/check.sh)
    (cd "${opus_root}/runtime" && ./scripts/check.sh)
    node "${opus_root}/scripts/verify-release-lock.mjs" \
      "${opus_root}" \
      --profile "${selected_profile}" \
      --require-manifest
    "${opus_root}/scripts/audit-naming.sh"
    ;;
  *)
    echo "No check workflow is defined for release-lock profile: ${selected_profile}" >&2
    exit 1
    ;;
esac
