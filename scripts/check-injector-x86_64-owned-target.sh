#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "The x86_64 owned-target lifecycle proof is currently defined for macOS." >&2
  exit 1
fi

test_java_home="$("${opus_root}/scripts/provision-injector-test-jdk.sh" --print-home)"

OPUS_INJECTOR_JAVA_HOME="${test_java_home}" \
OPUS_RUNTIME_TARGET_ARCH=x86_64 \
  "${opus_root}/scripts/check-injector-foundation.sh"

OPUS_INJECTOR_JAVA_HOME="${test_java_home}" \
OPUS_RUNTIME_TARGET_ARCH=x86_64 \
  "${opus_root}/scripts/check-injector-attach-harness.sh"

OPUS_INJECTOR_JAVA_HOME="${test_java_home}" \
OPUS_RUNTIME_TARGET_ARCH=x86_64 \
  "${opus_root}/scripts/check-injector-owned-target-harness.sh"

OPUS_INJECTOR_JAVA_HOME="${test_java_home}" \
OPUS_RUNTIME_TARGET_ARCH=x86_64 \
  "${opus_root}/scripts/check-injector-authorized-target.sh"

OPUS_INJECTOR_JAVA_HOME="${test_java_home}" \
OPUS_RUNTIME_TARGET_ARCH=x86_64 \
  "${opus_root}/scripts/check-injector-opus-owned-client-preview.sh"

echo "OPUS x86_64 Java 8 test-only Attach harness, owned-target, authorized-target, and owned-preview lifecycle integration passed."
