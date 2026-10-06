#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${opus_root}/output/injector-foundation"
target_java_home="${OPUS_INJECTOR_JAVA_HOME:-${JAVA_HOME:-}}"
attach_java="${OPUS_ATTACH_JAVA:-$(command -v java)}"
cycles="${OPUS_JVM_ATTACH_CYCLES:-3}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "The test-only JVM Attach harness proof is currently defined for macOS." >&2
  exit 1
fi

if [[ -z "${target_java_home}" ]]; then
  target_java_home="$(/usr/libexec/java_home)"
fi
if [[ ! -x "${target_java_home}/bin/java" ]]; then
  echo "Set OPUS_INJECTOR_JAVA_HOME to a target JDK home." >&2
  exit 1
fi
if [[ -z "${attach_java}" ]] || [[ ! -x "${attach_java}" ]]; then
  echo "Set OPUS_ATTACH_JAVA to a JDK java executable with the Attach API." >&2
  exit 1
fi
if ! [[ "${cycles}" =~ ^[1-9][0-9]*$ ]] || (( cycles > 20 )); then
  echo "OPUS_JVM_ATTACH_CYCLES must be an integer from 1 through 20." >&2
  exit 1
fi

target_java="${target_java_home}/bin/java"
target_arch_raw="$(
  "${target_java}" -XshowSettings:properties -version 2>&1 \
    | sed -n 's/^[[:space:]]*os\.arch = //p' \
    | head -n 1
)"
case "${target_arch_raw}" in
  amd64|x86_64)
    target_arch="x86_64"
    ;;
  aarch64|arm64)
    target_arch="arm64"
    ;;
  *)
    echo "Unsupported target JVM architecture: ${target_arch_raw:-unknown}" >&2
    exit 1
    ;;
esac

runtime_library="${build_dir}/libopus-runtime.dylib"
runtime_classpath="${build_dir}/java-classes"
if [[ ! -f "${runtime_library}" ]] || [[ ! -d "${runtime_classpath}" ]]; then
  OPUS_INJECTOR_JAVA_HOME="${target_java_home}" \
  OPUS_RUNTIME_TARGET_ARCH="${target_arch}" \
    "${opus_root}/scripts/check-injector-foundation.sh"
fi
if [[ " $(lipo -archs "${runtime_library}") " != *" ${target_arch} "* ]]; then
  OPUS_INJECTOR_JAVA_HOME="${target_java_home}" \
  OPUS_RUNTIME_TARGET_ARCH="${target_arch}" \
    "${opus_root}/scripts/check-injector-foundation.sh"
fi

cargo build --manifest-path "${opus_root}/injector/Cargo.toml" --bin opus-injector
injector_binary="${opus_root}/injector/target/debug/opus-injector"
if [[ ! -x "${injector_binary}" ]]; then
  echo "Injector binary is missing after cargo build." >&2
  exit 1
fi

temporary_directory="$(mktemp -d -t opus-jvm-attach.XXXXXX)"
target_pid=""
cleanup() {
  if [[ -n "${target_pid}" ]] && kill -0 "${target_pid}" 2>/dev/null; then
    touch "${temporary_directory}/stop"
    wait "${target_pid}" || true
  fi
}
trap cleanup EXIT

"${target_java}" \
  -cp "${runtime_classpath}" \
  dev.opus.runtime.harness.AttachTargetHarness \
  --ready-file "${temporary_directory}/ready" \
  --stop-file "${temporary_directory}/stop" \
  >"${temporary_directory}/target.log" 2>&1 &
target_pid="$!"

for attempt in {1..100}; do
  if [[ -f "${temporary_directory}/ready" ]]; then
    break
  fi
  sleep 0.05
done
if [[ ! -f "${temporary_directory}/ready" ]]; then
  echo "JVM Attach target did not publish its ready marker." >&2
  exit 1
fi

inspect_output="$("${injector_binary}" inspect --pid "${target_pid}")"
printf '%s\n' "${inspect_output}"
for required_token in \
  'minecraft_jvm_candidate=false' \
  'target_ownership=current-user' \
  'client_hint=unknown' \
  'candidate_evidence=none'; do
  if ! printf '%s\n' "${inspect_output}" | grep -Fq "${required_token}"; then
    echo "Attach harness inspection is missing ${required_token}." >&2
    exit 1
  fi
done

if premature_unload_output="$(
  "${injector_binary}" attach-harness unload \
    --pid "${target_pid}" \
    --attach-java "${attach_java}" \
    --attach-classpath "${runtime_classpath}" 2>&1
)"; then
  echo "Attach harness logical stop unexpectedly ran before an explicit load." >&2
  exit 1
fi
printf '%s\n' "${premature_unload_output}"
if ! printf '%s\n' "${premature_unload_output}" | grep -Fq 'code=JvmAttachSessionMissing'; then
  echo "Attach harness premature logical stop did not return JvmAttachSessionMissing." >&2
  exit 1
fi

for (( cycle = 1; cycle <= cycles; cycle += 1 )); do
  load_output="$(
    "${injector_binary}" attach-harness load \
      --pid "${target_pid}" \
      --target-architecture "${target_arch}" \
      --runtime "${runtime_library}" \
      --attach-java "${attach_java}" \
      --attach-classpath "${runtime_classpath}"
  )"
  printf '%s\n' "${load_output}"
  if ! printf '%s\n' "${load_output}" | grep -Fq 'code=AttachHarnessLoadProof'; then
    echo "Attach harness load cycle ${cycle} did not prove native runtime entry." >&2
    exit 1
  fi
  if ! printf '%s\n' "${load_output}" | grep -Fq 'native_agent_attach=true'; then
    echo "Attach harness load cycle ${cycle} did not use the JDK Attach API." >&2
    exit 1
  fi

  unload_output="$(
    "${injector_binary}" attach-harness unload \
      --pid "${target_pid}" \
      --attach-java "${attach_java}" \
      --attach-classpath "${runtime_classpath}"
  )"
  printf '%s\n' "${unload_output}"
  if ! printf '%s\n' "${unload_output}" | grep -Fq 'code=AttachHarnessLogicalStopProof'; then
    echo "Attach harness logical stop cycle ${cycle} did not prove logical shutdown." >&2
    exit 1
  fi
  if ! kill -0 "${target_pid}" 2>/dev/null; then
    echo "Attach harness target exited during lifecycle cycle ${cycle}." >&2
    exit 1
  fi
done

printf 'OPUS test-only JVM Attach harness integration passed: target_arch=%s cycles=%s\n' \
  "${target_arch}" \
  "${cycles}"
