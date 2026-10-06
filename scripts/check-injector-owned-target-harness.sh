#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${opus_root}/output/injector-foundation"
target_java_home="${OPUS_INJECTOR_JAVA_HOME:-${JAVA_HOME:-}}"

if [[ -z "${target_java_home}" ]] && [[ "$(uname -s)" == "Darwin" ]]; then
  target_java_home="$(/usr/libexec/java_home)"
fi

if [[ -z "${target_java_home}" ]] || [[ ! -x "${target_java_home}/bin/java" ]]; then
  echo "Set OPUS_INJECTOR_JAVA_HOME to a JDK home for the target JVM architecture." >&2
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
    detected_arch="x86_64"
    ;;
  aarch64|arm64)
    detected_arch="arm64"
    ;;
  *)
    echo "Unsupported target JVM architecture: ${target_arch_raw:-unknown}" >&2
    exit 1
    ;;
esac

requested_arch="${OPUS_RUNTIME_TARGET_ARCH:-${detected_arch}}"
if [[ "${requested_arch}" == "auto" ]]; then
  requested_arch="${detected_arch}"
fi
if [[ "${requested_arch}" == "universal" ]]; then
  echo "The owned-target harness proves one JVM architecture per run; select arm64 or x86_64." >&2
  exit 1
fi
if [[ "${requested_arch}" != "${detected_arch}" ]]; then
  echo "JDK architecture ${detected_arch} cannot certify requested runtime architecture ${requested_arch}." >&2
  exit 1
fi

runtime_classpath="${build_dir}/java-classes"
runtime_library="${build_dir}/libopus-runtime.dylib"
for required_path in "${runtime_classpath}" "${runtime_library}"; do
  if [[ ! -e "${required_path}" ]]; then
    echo "Missing foundation artifact: ${required_path}" >&2
    echo "Run ./scripts/check-injector-foundation.sh first." >&2
    exit 1
  fi
done

injector_manifest="${opus_root}/injector/Cargo.toml"
injector_binary="${opus_root}/injector/target/debug/opus-injector"
cycles="${OPUS_OWNED_TARGET_CYCLES:-3}"

cargo build --manifest-path "${injector_manifest}" --bin opus-injector

harness_output="$(
  "${injector_binary}" owned-harness \
    --java "${target_java}" \
    --classpath "${runtime_classpath}" \
    --runtime "${runtime_library}" \
    --target-architecture "${requested_arch}" \
    --cycles "${cycles}"
)"
printf '%s\n' "${harness_output}"

if ! printf '%s\n' "${harness_output}" | grep -Fq 'code=OwnedTargetLoadProof'; then
  echo "Owned-target harness did not prove native runtime entry and handshake." >&2
  exit 1
fi
if ! printf '%s\n' "${harness_output}" | grep -Fq 'cooperative_load_request=true'; then
  echo "Owned-target harness did not prove the explicit cooperative load request." >&2
  exit 1
fi
if ! printf '%s\n' "${harness_output}" | grep -Fq 'same_process_cycles=true'; then
  echo "Owned-target harness did not keep all requested cycles in one JVM process." >&2
  exit 1
fi
expected_reentry_count="$((cycles - 1))"
if ! printf '%s\n' "${harness_output}" | grep -Fq "logical_reentry_count=${expected_reentry_count}"; then
  echo "Owned-target harness did not report the expected same-process reentry count." >&2
  exit 1
fi
if ! printf '%s\n' "${harness_output}" | grep -Fq 'code=OwnedTargetUnloadProof'; then
  echo "Owned-target harness did not prove logical shutdown and clean process exit." >&2
  exit 1
fi
if ! printf '%s\n' "${harness_output}" | grep -Fq "cycles=${cycles}"; then
  echo "Owned-target harness did not report the requested repeat count." >&2
  exit 1
fi

echo "OPUS M3 owned-target lifecycle integration passed."
