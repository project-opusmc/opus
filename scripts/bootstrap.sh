#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for required_command in git cargo rustfmt node npm java javac cmake; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "Missing required command: ${required_command}" >&2
    exit 1
  fi
done

if ! cargo clippy --version >/dev/null 2>&1; then
  echo "Missing Cargo Clippy component. Install it with: rustup component add clippy" >&2
  exit 1
fi

git -C "${opus_root}" submodule sync --recursive
git -C "${opus_root}" submodule update --init --recursive

for component_name in launcher runtime; do
  if ! git -C "${opus_root}/${component_name}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Submodule is not initialized: ${component_name}" >&2
    exit 1
  fi
done

npm ci --prefix "${opus_root}/launcher/desktop"
"${opus_root}/scripts/submodule-status.sh"
