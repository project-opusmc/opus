#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "OPUS Rosetta native transport rejection check is macOS-only; skipped."
  exit 0
fi

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "OPUS Rosetta native transport rejection check requires an Apple Silicon host; skipped."
  exit 0
fi

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_java_home="$("${opus_root}/scripts/provision-injector-test-jdk.sh" --print-home)"

OPUS_INJECTOR_JAVA_HOME="${test_java_home}" \
OPUS_NATIVE_TRANSPORT_EXPECT_REJECTION=RosettaRemoteThreadUnavailable \
  "${opus_root}/tests/check-injector-native-runtime-load.sh"
