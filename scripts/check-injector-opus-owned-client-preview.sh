#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${opus_root}/output/injector-foundation"
target_java_home="${OPUS_INJECTOR_JAVA_HOME:-${JAVA_HOME:-}}"

if [[ -z "${target_java_home}" ]] && [[ "$(uname -s)" == "Darwin" ]]; then
  target_java_home="$(/usr/libexec/java_home)"
fi
if [[ -z "${target_java_home}" ]] || [[ ! -x "${target_java_home}/bin/java" ]] \
  || [[ ! -x "${target_java_home}/bin/jar" ]]; then
  echo "Set OPUS_INJECTOR_JAVA_HOME to a JDK home for the OPUS-owned preview target." >&2
  exit 1
fi

target_java="${target_java_home}/bin/java"
target_jar="${target_java_home}/bin/jar"
java_version_output="$("${target_java}" -version 2>&1)"
java_version="$(
  printf '%s\n' "${java_version_output}" \
    | sed -n '1s/.*"\([^"]*\)".*/\1/p'
)"
java_major="${java_version%%.*}"
if [[ "${java_major}" == "1" ]]; then
  java_major="$(printf '%s\n' "${java_version}" | cut -d. -f2)"
fi
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
    echo "Unsupported OPUS-owned preview JVM architecture: ${target_arch_raw:-unknown}" >&2
    exit 1
    ;;
esac

requested_arch="${OPUS_RUNTIME_TARGET_ARCH:-${detected_arch}}"
if [[ "${requested_arch}" == "auto" ]]; then
  requested_arch="${detected_arch}"
fi
if [[ "${requested_arch}" != "${detected_arch}" ]] || [[ "${requested_arch}" == "universal" ]]; then
  echo "The OPUS-owned preview control proof requires one matching arm64 or x86_64 JVM/runtime pair." >&2
  exit 1
fi

runtime_classpath="${build_dir}/java-classes"
runtime_library="${build_dir}/libopus-runtime.dylib"
if [[ ! -d "${runtime_classpath}" ]] || [[ ! -f "${runtime_library}" ]] \
  || [[ " $(lipo -archs "${runtime_library}") " != *" ${requested_arch} "* ]]; then
  OPUS_INJECTOR_JAVA_HOME="${target_java_home}" \
  OPUS_RUNTIME_TARGET_ARCH="${requested_arch}" \
    "${opus_root}/scripts/check-injector-foundation.sh"
fi

injector_manifest="${opus_root}/injector/Cargo.toml"
injector_binary="${opus_root}/injector/target/debug/opus-injector"
cycles="${OPUS_OWNED_CLIENT_PREVIEW_CYCLES:-3}"
if ! [[ "${cycles}" =~ ^[1-9][0-9]*$ ]] || (( cycles > 20 )); then
  echo "OPUS_OWNED_CLIENT_PREVIEW_CYCLES must be an integer between 1 and 20." >&2
  exit 1
fi

cargo build --manifest-path "${injector_manifest}" --bin opus-injector

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/opus-owned-m3-preview.XXXXXX")"
descriptor="${temporary_directory}/opus-owned-client.properties"
configuration="${temporary_directory}/runtime-control.properties"
release_marker="${temporary_directory}/release"
target_log="${temporary_directory}/target.log"
unapproved_runtime="${temporary_directory}/unapproved-runtime.dylib"
client_build="${temporary_directory}/opus-owned-m3-bootstrap-0.1.0.jar"
client_build_source="${temporary_directory}/client-build-source"
capability="OpusOwnedM3PreviewControlCapability000000000000000000000000000001"
target_pid=""

cleanup() {
  if [[ -n "${target_pid}" ]] && kill -0 "${target_pid}" 2>/dev/null; then
    if [[ -f "${descriptor}" ]] && [[ -x "${injector_binary}" ]]; then
      "${injector_binary}" opus-owned-client unload \
        --descriptor "${descriptor}" >/dev/null 2>&1 || true
      "${injector_binary}" opus-owned-client stop \
        --descriptor "${descriptor}" >/dev/null 2>&1 || true
    fi
    : >"${release_marker}"
    wait "${target_pid}" 2>/dev/null || true
  fi
  rm -rf "${temporary_directory}"
}
trap cleanup EXIT

runtime_sha256="$(shasum -a 256 "${runtime_library}" | awk '{print $1}')"
mkdir -p "${client_build_source}/dev/opus/runtime/ownedclient"
printf '\xCA\xFE\xBA\xBE' \
  >"${client_build_source}/dev/opus/runtime/ownedclient/OpusOwnedM3ClientBootstrap.class"
"${target_jar}" cf "${client_build}" -C "${client_build_source}" dev
client_build_sha256="$(shasum -a 256 "${client_build}" | awk '{print $1}')"
if ! [[ "${runtime_sha256}" =~ ^[0-9a-f]{64}$ ]] \
  || ! [[ "${client_build_sha256}" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Unable to calculate an OPUS-owned preview artifact SHA-256." >&2
  exit 1
fi

printf '%s\n' \
  'protocolVersion=1' \
  'targetKind=opus-owned-client' \
  'targetVersion=0.1.0' \
  "clientBuild=${client_build}" \
  "clientBuildSha256=${client_build_sha256}" \
  'injectorVersion=0.1.0' \
  'nativeRuntimeVersion=0.1.0' \
  'javaRuntimeVersion=not-built' \
  "targetArchitecture=${requested_arch}" \
  "descriptor=${descriptor}" \
  "capability=${capability}" \
  "allowedRuntime=${runtime_library}" \
  "allowedRuntimeSha256=${runtime_sha256}" \
  >"${configuration}"
chmod 600 "${configuration}"

if [[ "${java_major}" =~ ^[0-9]+$ ]] && (( java_major >= 17 )); then
  "${target_java}" \
    -Xcheck:jni \
    --enable-native-access=ALL-UNNAMED \
    "-Dopus.m3.runtime-control.config=${configuration}" \
    -cp "${runtime_classpath}" \
    dev.opus.runtime.ownedclient.OpusOwnedM3ClientBootstrap \
    --opus-owned-m3-harness-release "${release_marker}" \
    >"${target_log}" 2>&1 &
else
  "${target_java}" \
    -Xcheck:jni \
    "-Dopus.m3.runtime-control.config=${configuration}" \
    -cp "${runtime_classpath}" \
    dev.opus.runtime.ownedclient.OpusOwnedM3ClientBootstrap \
    --opus-owned-m3-harness-release "${release_marker}" \
    >"${target_log}" 2>&1 &
fi
target_pid="$!"

for _ in {1..100}; do
  if [[ -s "${descriptor}" ]]; then
    break
  fi
  if ! kill -0 "${target_pid}" 2>/dev/null; then
    sed -n '1,160p' "${target_log}" >&2
    echo "OPUS-owned preview target exited before its descriptor was published." >&2
    exit 1
  fi
  sleep 0.1
done
if [[ ! -s "${descriptor}" ]]; then
  sed -n '1,160p' "${target_log}" >&2
  echo "OPUS-owned preview target did not publish its descriptor." >&2
  exit 1
fi
if [[ "$(stat -f '%Lp' "${descriptor}")" != "600" ]]; then
  echo "OPUS-owned preview descriptor is not owner-readable only." >&2
  exit 1
fi

reported_pid="$(sed -n 's/^pid=//p' "${descriptor}")"
if [[ "${reported_pid}" != "${target_pid}" ]]; then
  echo "OPUS-owned preview descriptor PID does not match its selected process." >&2
  exit 1
fi

health_output="$(
  "${injector_binary}" opus-owned-client health \
    --descriptor "${descriptor}" \
    --expect-state waiting
)"
printf '%s\n' "${health_output}"
if ! printf '%s\n' "${health_output}" | grep -Fq 'code=OpusOwnedClientSurvivalProof'; then
  echo "OPUS-owned preview target did not prove initial survival." >&2
  exit 1
fi

cp "${runtime_library}" "${unapproved_runtime}"
if unapproved_output="$(
  "${injector_binary}" opus-owned-client load \
    --descriptor "${descriptor}" \
    --runtime "${unapproved_runtime}" 2>&1
)"; then
  echo "OPUS-owned preview accepted a runtime path outside its launch configuration." >&2
  exit 1
fi
printf '%s\n' "${unapproved_output}"
if ! printf '%s\n' "${unapproved_output}" | grep -Fq 'code=AuthorizedTargetRejected'; then
  echo "OPUS-owned preview did not report a typed unauthorized-runtime rejection." >&2
  exit 1
fi

for ((cycle = 1; cycle <= cycles; cycle += 1)); do
  load_output="$(
    "${injector_binary}" opus-owned-client load \
      --descriptor "${descriptor}" \
      --runtime "${runtime_library}"
  )"
  printf '%s\n' "${load_output}"
  if ! printf '%s\n' "${load_output}" | grep -Fq 'code=OpusOwnedClientLoadProof'; then
    echo "OPUS-owned preview cycle ${cycle} did not prove native runtime entry." >&2
    exit 1
  fi

  running_output="$(
    "${injector_binary}" opus-owned-client health \
      --descriptor "${descriptor}" \
      --expect-state running
  )"
  printf '%s\n' "${running_output}"
  if ! printf '%s\n' "${running_output}" | grep -Fq 'state=running'; then
    echo "OPUS-owned preview cycle ${cycle} did not remain alive while running." >&2
    exit 1
  fi

  unload_output="$(
    "${injector_binary}" opus-owned-client unload \
      --descriptor "${descriptor}"
  )"
  printf '%s\n' "${unload_output}"
  if ! printf '%s\n' "${unload_output}" | grep -Fq 'code=OpusOwnedClientUnloadProof'; then
    echo "OPUS-owned preview cycle ${cycle} did not prove logical shutdown." >&2
    exit 1
  fi

  stopped_output="$(
    "${injector_binary}" opus-owned-client health \
      --descriptor "${descriptor}" \
      --expect-state stopped
  )"
  printf '%s\n' "${stopped_output}"
  if ! printf '%s\n' "${stopped_output}" | grep -Fq 'state=stopped'; then
    echo "OPUS-owned preview cycle ${cycle} did not survive unload." >&2
    exit 1
  fi
done

stop_output="$(
  "${injector_binary}" opus-owned-client stop \
    --descriptor "${descriptor}"
)"
printf '%s\n' "${stop_output}"
if ! printf '%s\n' "${stop_output}" | grep -Fq 'code=OpusOwnedClientStopProof'; then
  echo "OPUS-owned preview did not acknowledge a clean control-endpoint stop." >&2
  exit 1
fi

for _ in {1..100}; do
  if [[ ! -e "${descriptor}" ]]; then
    break
  fi
  sleep 0.05
done
if [[ -e "${descriptor}" ]]; then
  echo "OPUS-owned preview left a descriptor after clean stop." >&2
  exit 1
fi

: >"${release_marker}"
wait "${target_pid}"
target_pid=""

echo "OPUS-owned M3 preview control integration passed; it is a source-controlled transport harness, not Minecraft client evidence."
