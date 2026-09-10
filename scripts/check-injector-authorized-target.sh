#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${opus_root}/output/injector-foundation"
target_java_home="${OPUS_INJECTOR_JAVA_HOME:-${JAVA_HOME:-}}"

if [[ -z "${target_java_home}" ]] && [[ "$(uname -s)" == "Darwin" ]]; then
  target_java_home="$(/usr/libexec/java_home)"
fi

if [[ -z "${target_java_home}" ]] || [[ ! -x "${target_java_home}/bin/java" ]]; then
  echo "Set OPUS_INJECTOR_JAVA_HOME to a JDK home for the authorized target." >&2
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
    echo "Unsupported authorized target JVM architecture: ${target_arch_raw:-unknown}" >&2
    exit 1
    ;;
esac

requested_arch="${OPUS_RUNTIME_TARGET_ARCH:-${detected_arch}}"
if [[ "${requested_arch}" == "auto" ]]; then
  requested_arch="${detected_arch}"
fi
if [[ "${requested_arch}" == "universal" ]]; then
  echo "The authorized-target proof requires a single selected JVM architecture." >&2
  exit 1
fi
if [[ "${requested_arch}" != "${detected_arch}" ]]; then
  echo "JDK architecture ${detected_arch} cannot certify requested runtime architecture ${requested_arch}." >&2
  exit 1
fi

runtime_classpath="${build_dir}/java-classes"
runtime_library="${build_dir}/libopus-runtime.dylib"
if [[ ! -e "${runtime_classpath}" ]] || [[ ! -f "${runtime_library}" ]]; then
  OPUS_INJECTOR_JAVA_HOME="${target_java_home}" \
  OPUS_RUNTIME_TARGET_ARCH="${requested_arch}" \
    "${opus_root}/scripts/check-injector-foundation.sh"
else
  current_runtime_architectures="$(lipo -archs "${runtime_library}")"
  if [[ " ${current_runtime_architectures} " != *" ${requested_arch} "* ]]; then
    OPUS_INJECTOR_JAVA_HOME="${target_java_home}" \
    OPUS_RUNTIME_TARGET_ARCH="${requested_arch}" \
      "${opus_root}/scripts/check-injector-foundation.sh"
  fi
fi

for required_path in "${runtime_classpath}" "${runtime_library}"; do
  if [[ ! -e "${required_path}" ]]; then
    echo "Foundation artifact is still missing after architecture selection: ${required_path}" >&2
    exit 1
  fi
done

case "${requested_arch}" in
  arm64)
    mismatch_arch="x86_64"
    ;;
  x86_64)
    mismatch_arch="arm64"
    ;;
esac
mismatch_runtime="${opus_root}/output/injector-native-slices/${mismatch_arch}/libopus-runtime.dylib"
if [[ ! -f "${mismatch_runtime}" ]]; then
  "${opus_root}/scripts/build-injector-native-slice.sh" "${mismatch_arch}"
fi

injector_manifest="${opus_root}/injector/Cargo.toml"
injector_binary="${opus_root}/injector/target/debug/opus-injector"
cycles="${OPUS_AUTHORIZED_TARGET_CYCLES:-3}"
if ! [[ "${cycles}" =~ ^[1-9][0-9]*$ ]] || (( cycles > 20 )); then
  echo "OPUS_AUTHORIZED_TARGET_CYCLES must be an integer between 1 and 20." >&2
  exit 1
fi

cargo build --manifest-path "${injector_manifest}" --bin opus-injector

java_version_output="$("${target_java}" -version 2>&1)"
java_version="$(
  printf '%s\n' "${java_version_output}" \
    | sed -n '1s/.*"\([^"]*\)".*/\1/p'
)"
java_major="${java_version%%.*}"
if [[ "${java_major}" == "1" ]]; then
  java_major="$(printf '%s\n' "${java_version}" | cut -d. -f2)"
fi
temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/opus-authorized-target.XXXXXX")"
descriptor="${temporary_directory}/authorized-target.properties"
target_log="${temporary_directory}/authorized-target.log"
capability="OpusM3AuthorizedTargetFixtureCapability20260908"
target_pid=""
minecraft_classpath="${temporary_directory}/.minecraft/versions/1.8.9/authorized-target-classes"

mkdir -p "$(dirname "${minecraft_classpath}")"
ln -s "${runtime_classpath}" "${minecraft_classpath}"

cleanup() {
  if [[ -n "${target_pid}" ]] && kill -0 "${target_pid}" 2>/dev/null; then
    if [[ -f "${descriptor}" ]] && [[ -x "${injector_binary}" ]]; then
      "${injector_binary}" authorized-target unload \
        --descriptor "${descriptor}" >/dev/null 2>&1 || true
      "${injector_binary}" authorized-target stop \
        --descriptor "${descriptor}" >/dev/null 2>&1 || true
    fi
    if kill -0 "${target_pid}" 2>/dev/null; then
      kill "${target_pid}" 2>/dev/null || true
    fi
    wait "${target_pid}" 2>/dev/null || true
  fi
  rm -rf "${temporary_directory}"
}
trap cleanup EXIT

if [[ "${java_major}" =~ ^[0-9]+$ ]] && (( java_major >= 17 )); then
  "${target_java}" \
    -Xcheck:jni \
    --enable-native-access=ALL-UNNAMED \
    "-Dopus.injector.version=0.1.0" \
    "-Dgame.directory=${temporary_directory}/.minecraft" \
    -cp "${minecraft_classpath}" \
    dev.opus.runtime.harness.AuthorizedRuntimeTarget \
    --descriptor "${descriptor}" \
    --capability "${capability}" \
    --allowed-runtime "${runtime_library}" \
    >"${target_log}" 2>&1 &
else
  "${target_java}" \
    -Xcheck:jni \
    "-Dopus.injector.version=0.1.0" \
    "-Dgame.directory=${temporary_directory}/.minecraft" \
    -cp "${minecraft_classpath}" \
    dev.opus.runtime.harness.AuthorizedRuntimeTarget \
    --descriptor "${descriptor}" \
    --capability "${capability}" \
    --allowed-runtime "${runtime_library}" \
    >"${target_log}" 2>&1 &
fi
target_pid="$!"

for _ in {1..100}; do
  if [[ -s "${descriptor}" ]]; then
    break
  fi
  if ! kill -0 "${target_pid}" 2>/dev/null; then
    sed -n '1,160p' "${target_log}" >&2
    echo "Authorized target exited before it published its descriptor." >&2
    exit 1
  fi
  sleep 0.1
done

if [[ ! -s "${descriptor}" ]]; then
  sed -n '1,160p' "${target_log}" >&2
  echo "Authorized target did not publish its descriptor." >&2
  exit 1
fi

reported_pid="$(sed -n 's/^pid=//p' "${descriptor}")"
if [[ "${reported_pid}" != "${target_pid}" ]]; then
  echo "Authorized target descriptor pid ${reported_pid:-missing} does not match process ${target_pid}." >&2
  exit 1
fi

general_target_inspect_output="$("${injector_binary}" inspect --pid "${target_pid}")"
printf '%s\n' "${general_target_inspect_output}"
if ! printf '%s\n' "${general_target_inspect_output}" | grep -Fq 'minecraft_jvm_candidate=true'; then
  echo "M3 General inspect did not recognize the selected generic Minecraft JVM candidate." >&2
  exit 1
fi
if ! printf '%s\n' "${general_target_inspect_output}" | grep -Fq 'target_ownership=current-user'; then
  echo "M3 General inspect did not prove that the selected JVM belongs to the current user." >&2
  exit 1
fi
if ! printf '%s\n' "${general_target_inspect_output}" | grep -Fq 'client_hint=unknown'; then
  echo "M3 General inspect did not preserve an unknown client hint." >&2
  exit 1
fi
if ! printf '%s\n' "${general_target_inspect_output}" \
  | grep -Fq 'candidate_evidence=game-directory-marker,minecraft-189-version-marker'; then
  echo "M3 General inspect did not report the required generic Minecraft 1.8.9 evidence." >&2
  exit 1
fi
if printf '%s\n' "${general_target_inspect_output}" | grep -Fq "${capability}"; then
  echo "M3 General inspect leaked the authorized-target capability." >&2
  exit 1
fi

health_output="$(
  "${injector_binary}" authorized-target health \
    --descriptor "${descriptor}" \
    --expect-state waiting
)"
printf '%s\n' "${health_output}"
if ! printf '%s\n' "${health_output}" | grep -Fq 'code=AuthorizedTargetSurvivalProof'; then
  echo "Authorized target did not prove its initial process survival." >&2
  exit 1
fi

if mismatched_architecture_output="$(
  "${injector_binary}" authorized-target load \
    --descriptor "${descriptor}" \
    --runtime "${mismatch_runtime}" 2>&1
)"; then
  echo "Authorized target accepted a mismatched runtime architecture." >&2
  exit 1
fi
printf '%s\n' "${mismatched_architecture_output}"
if ! printf '%s\n' "${mismatched_architecture_output}" | grep -Fq 'code=ArchitectureMismatch'; then
  echo "Authorized target did not report a typed architecture mismatch." >&2
  exit 1
fi

architecture_recovery_health_output="$(
  "${injector_binary}" authorized-target health \
    --descriptor "${descriptor}" \
    --expect-state waiting
)"
printf '%s\n' "${architecture_recovery_health_output}"
if ! printf '%s\n' "${architecture_recovery_health_output}" | grep -Fq 'state=waiting'; then
  echo "Authorized target did not remain alive after architecture rejection." >&2
  exit 1
fi

if rejected_unload_output="$(
  "${injector_binary}" authorized-target unload \
    --descriptor "${descriptor}" 2>&1
)"; then
  echo "Authorized target accepted unload before runtime entry." >&2
  exit 1
fi
printf '%s\n' "${rejected_unload_output}"
if ! printf '%s\n' "${rejected_unload_output}" | grep -Fq 'code=AuthorizedTargetRejected'; then
  echo "Authorized target did not report a typed recoverable unload rejection." >&2
  exit 1
fi

recovery_health_output="$(
  "${injector_binary}" authorized-target health \
    --descriptor "${descriptor}" \
    --expect-state waiting
)"
printf '%s\n' "${recovery_health_output}"
if ! printf '%s\n' "${recovery_health_output}" | grep -Fq 'state=waiting'; then
  echo "Authorized target did not remain alive after a rejected unload." >&2
  exit 1
fi

for ((cycle = 1; cycle <= cycles; cycle += 1)); do
  load_output="$(
    "${injector_binary}" authorized-target load \
      --descriptor "${descriptor}" \
      --runtime "${runtime_library}"
  )"
  printf '%s\n' "${load_output}"
  if ! printf '%s\n' "${load_output}" | grep -Fq 'code=AuthorizedTargetLoadProof'; then
    echo "Authorized target cycle ${cycle} did not prove native runtime entry." >&2
    exit 1
  fi

  running_output="$(
    "${injector_binary}" authorized-target health \
      --descriptor "${descriptor}" \
      --expect-state running
  )"
  printf '%s\n' "${running_output}"
  if ! printf '%s\n' "${running_output}" | grep -Fq 'state=running'; then
    echo "Authorized target cycle ${cycle} did not remain alive while running." >&2
    exit 1
  fi

  unload_output="$(
    "${injector_binary}" authorized-target unload \
      --descriptor "${descriptor}"
  )"
  printf '%s\n' "${unload_output}"
  if ! printf '%s\n' "${unload_output}" | grep -Fq 'code=AuthorizedTargetUnloadProof'; then
    echo "Authorized target cycle ${cycle} did not prove logical shutdown." >&2
    exit 1
  fi

  stopped_output="$(
    "${injector_binary}" authorized-target health \
      --descriptor "${descriptor}" \
      --expect-state stopped
  )"
  printf '%s\n' "${stopped_output}"
  if ! printf '%s\n' "${stopped_output}" | grep -Fq 'state=stopped'; then
    echo "Authorized target cycle ${cycle} did not survive unload." >&2
    exit 1
  fi
done

stop_output="$(
  "${injector_binary}" authorized-target stop \
    --descriptor "${descriptor}"
)"
printf '%s\n' "${stop_output}"
if ! printf '%s\n' "${stop_output}" | grep -Fq 'code=AuthorizedTargetStopProof'; then
  echo "Authorized target did not acknowledge clean stop." >&2
  exit 1
fi

wait "${target_pid}"
target_pid=""
if [[ -e "${descriptor}" ]]; then
  echo "Authorized target left a stale descriptor after clean stop." >&2
  exit 1
fi

echo "OPUS M3 authorized-target transport and survival integration passed."
