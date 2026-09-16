#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "OPUS JVM Attach capability-probe check is macOS-only; skipped."
  exit 0
fi

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${opus_root}/output/injector-foundation"
target_java_home="${OPUS_INJECTOR_JAVA_HOME:-${JAVA_HOME:-}}"
if [[ -z "${target_java_home}" ]]; then
  target_java_home="$(/usr/libexec/java_home)"
fi
target_java="${target_java_home}/bin/java"
if [[ ! -x "${target_java}" ]]; then
  echo "Set OPUS_INJECTOR_JAVA_HOME to a target JDK home." >&2
  exit 1
fi

runtime_classpath="${build_dir}/java-classes"
if [[ ! -d "${runtime_classpath}" ]]; then
  OPUS_INJECTOR_JAVA_HOME="${target_java_home}" \
    "${opus_root}/scripts/check-injector-foundation.sh"
fi

cargo build --manifest-path "${opus_root}/injector/Cargo.toml" --bin opus-injector --quiet
injector_binary="${opus_root}/injector/target/debug/opus-injector"
temporary_directory="$(mktemp -d -t opus-jvm-attach-probe.XXXXXX)"
target_pid=""
cleanup() {
  if [[ -n "${target_pid}" ]] && kill -0 "${target_pid}" 2>/dev/null; then
    touch "${temporary_directory}/stop"
    wait "${target_pid}" || true
  fi
  rm -rf "${temporary_directory}"
}
trap cleanup EXIT

"${target_java}" \
  "-Dgame.directory=${temporary_directory}/.minecraft" \
  "-Dopus.minecraft-1.8.9=true" \
  -cp "${runtime_classpath}" \
  dev.opus.runtime.harness.AttachTargetHarness \
  --ready-file "${temporary_directory}/ready" \
  --stop-file "${temporary_directory}/stop" \
  >"${temporary_directory}/target.log" 2>&1 &
target_pid="$!"

for _ in {1..100}; do
  [[ -f "${temporary_directory}/ready" ]] && break
  sleep 0.05
done
if [[ ! -f "${temporary_directory}/ready" ]]; then
  echo "JVM Attach capability target did not publish readiness." >&2
  exit 1
fi

probe_output="$("${injector_binary}" probe-jvm-attach --pid "${target_pid}")"
printf '%s\n' "${probe_output}"
for required_token in \
  'code=JvmAttachCapability' \
  'query=VM.version' \
  'agent_load=false' \
  'command_line_inference=false' \
  'diagnostic_only=true'; do
  if ! printf '%s\n' "${probe_output}" | grep -Fq "${required_token}"; then
    echo "JVM Attach capability probe is missing ${required_token}." >&2
    exit 1
  fi
done
if ! printf '%s\n' "${probe_output}" \
  | grep -Eq 'jvm_attach=(available|disabled|unavailable|timed-out)'; then
  echo "JVM Attach capability probe returned an unexpected status." >&2
  exit 1
fi
if ! kill -0 "${target_pid}" 2>/dev/null; then
  echo "JVM Attach capability probe caused the target to exit." >&2
  exit 1
fi

echo "OPUS JVM Attach capability-probe check passed."
