#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"${opus_root}/scripts/submodule-status.sh"
# Component check scripts assume their own repository root as the working
# directory (bare `cargo`, `npm --prefix desktop`, pinned rust-toolchain.toml).
# Invoke them from inside each component so toolchain and manifest resolution
# match the component's standalone CI.
(cd "${opus_root}/launcher" && ./scripts/check.sh)
(cd "${opus_root}/runtime" && ./scripts/check.sh)
node "${opus_root}/scripts/verify-release-lock.mjs" \
  "${opus_root}" \
  --require-manifest
"${opus_root}/scripts/audit-naming.sh"
