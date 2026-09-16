#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "OPUS native runtime remote-load proof is macOS-only; skipped."
  exit 0
fi

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target_java_home="${OPUS_INJECTOR_JAVA_HOME:-${JAVA_HOME:-}}"
if [[ -z "${target_java_home}" ]]; then
  target_java_home="$(/usr/libexec/java_home)"
fi
target_java="${target_java_home}/bin/java"
if [[ ! -x "${target_java}" ]]; then
  echo "Set OPUS_INJECTOR_JAVA_HOME to the target JVM home." >&2
  exit 1
fi

target_arch_raw="$(
  "${target_java}" -XshowSettings:properties -version 2>&1 \
    | sed -n 's/^[[:space:]]*os\.arch = //p' \
    | head -n 1
)"
case "${target_arch_raw}" in
  aarch64|arm64)
    target_arch="arm64"
    ;;
  amd64|x86_64)
    target_arch="x86_64"
    ;;
  *)
    echo "Unsupported target JVM architecture: ${target_arch_raw:-unknown}" >&2
    exit 1
    ;;
esac

"${opus_root}/scripts/build-injector-native-slice.sh" "${target_arch}" >/dev/null
"${opus_root}/scripts/build-injector-native-transport.sh" "${target_arch}" >/dev/null

runtime_build_directory="${opus_root}/output/injector-native-slices/${target_arch}"
cmake --build "${runtime_build_directory}" \
  --target opus-jvm-remote-loader-target \
  --parallel >/dev/null

helper="${opus_root}/output/injector-native-transport/${target_arch}/opus-macos-transport"
runtime="${runtime_build_directory}/libopus-runtime.dylib"
target="${runtime_build_directory}/remote-jvm-target/java"
injector_manifest="${opus_root}/injector/Cargo.toml"
injector_binary="${opus_root}/injector/target/debug/opus-injector"
cycles="${OPUS_NATIVE_TRANSPORT_CYCLES:-3}"
if ! [[ "${cycles}" =~ ^[0-9]+$ ]] || (( cycles < 3 || cycles > 20 )); then
  echo "OPUS_NATIVE_TRANSPORT_CYCLES must be an integer from 3 through 20." >&2
  exit 1
fi
expected_rejection="${OPUS_NATIVE_TRANSPORT_EXPECT_REJECTION:-}"
if [[ -n "${expected_rejection}" && "${expected_rejection}" != "RosettaRemoteThreadUnavailable" ]]; then
  echo "OPUS_NATIVE_TRANSPORT_EXPECT_REJECTION must be RosettaRemoteThreadUnavailable when set." >&2
  exit 1
fi
max_rss_delta_kib="${OPUS_NATIVE_TRANSPORT_MAX_RSS_DELTA_KIB:-}"
if [[ -n "${max_rss_delta_kib}" ]] \
  && { ! [[ "${max_rss_delta_kib}" =~ ^[0-9]+$ ]] || (( max_rss_delta_kib == 0 )); }; then
  echo "OPUS_NATIVE_TRANSPORT_MAX_RSS_DELTA_KIB must be a positive integer when set." >&2
  exit 1
fi
runtime_seconds=$((cycles * 4 + 30))
jvm_library="$(find "${target_java_home}" -type f -name libjvm.dylib -print -quit)"
if [[ -z "${jvm_library}" ]]; then
  echo "Could not locate libjvm.dylib below ${target_java_home}." >&2
  exit 1
fi
jvm_library_directory="$(dirname "${jvm_library}")"
codesign --force --sign - \
  --entitlements "${opus_root}/injector-native/entitlements/debug-target.plist" \
  "${target}"
cargo build --manifest-path "${injector_manifest}" --quiet
target_log="$(mktemp "${TMPDIR:-/tmp}/opus-native-runtime-load.XXXXXX")"

DYLD_LIBRARY_PATH="${jvm_library_directory}${DYLD_LIBRARY_PATH:+:${DYLD_LIBRARY_PATH}}" \
"${target}" \
  "-Dgame.directory=/tmp/opus-remote-minecraft/.minecraft" \
  "-Dopus.minecraft-1.8.9=true" \
  --seconds "${runtime_seconds}" \
  >"${target_log}" 2>&1 &
target_pid="$!"

cleanup() {
  if kill -0 "${target_pid}" 2>/dev/null; then
    kill "${target_pid}" 2>/dev/null || true
    wait "${target_pid}" 2>/dev/null || true
  fi
  rm -f "${target_log}"
}
trap cleanup EXIT

read_target_rss_kib() {
  local rss_kib
  rss_kib="$(ps -o rss= -p "${target_pid}" 2>/dev/null | tr -d '[:space:]')"
  if [[ "${rss_kib}" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "${rss_kib}"
  else
    printf '%s\n' 'unavailable'
  fi
}

for _ in {1..100}; do
  if grep -Fq "OPUS_REMOTE_JVM_TARGET pid=${target_pid};state=running" "${target_log}"; then
    break
  fi
  sleep 0.02
done
if ! grep -Fq "OPUS_REMOTE_JVM_TARGET pid=${target_pid};state=running" "${target_log}"; then
    echo "Remote JVM target did not report its running state." >&2
    sed -n '1,120p' "${target_log}" >&2
    exit 1
fi

capability_output="$(
  "${injector_binary}" probe-native \
    --pid "${target_pid}" \
    --target-architecture "${target_arch}" \
    --transport-helper "${helper}"
)"
if ! printf '%s\n' "${capability_output}" | grep -Fq 'code=BackendAvailability'; then
  echo "Native transport capability probe did not return its backend report." >&2
  printf '%s\n' "${capability_output}" >&2
  exit 1
fi
for required_token in \
  'native_transport=available' \
  'recommended_backend=native' \
  'result=CAPABILITY_AVAILABLE'; do
  if ! printf '%s\n' "${capability_output}" | grep -Fq "${required_token}"; then
    echo "Native transport capability probe is missing ${required_token}." >&2
    printf '%s\n' "${capability_output}" >&2
    exit 1
  fi
done
rss_before_kib="$(read_target_rss_kib)"

for ((cycle = 1; cycle <= cycles; cycle++)); do
  if [[ -n "${expected_rejection}" ]]; then
    set +e
  fi
  if (( cycle == 1 )); then
    if [[ -n "${expected_rejection}" ]]; then
      load_output="$(
        "${injector_binary}" request-load \
          --pid "${target_pid}" \
          --target-architecture "${target_arch}" \
          --runtime "${runtime}" \
          --transport-helper "${helper}" \
          2>&1
      )"
    else
      load_output="$(
        "${injector_binary}" request-load \
          --pid "${target_pid}" \
          --target-architecture "${target_arch}" \
          --runtime "${runtime}" \
          --transport-helper "${helper}"
      )"
    fi
  else
    if [[ -n "${expected_rejection}" ]]; then
      load_output="$(
        "${injector_binary}" request-load \
          --pid "${target_pid}" \
          --target-architecture "${target_arch}" \
          --runtime "${runtime}" \
          2>&1
      )"
    else
      load_output="$(
        "${injector_binary}" request-load \
          --pid "${target_pid}" \
          --target-architecture "${target_arch}" \
          --runtime "${runtime}"
      )"
    fi
  fi
  load_status="$?"
  if [[ -n "${expected_rejection}" ]]; then
    set -e
  fi
  if [[ -n "${expected_rejection}" ]]; then
    if (( cycle != 1 )); then
      echo "An expected native transport rejection must occur during the first cycle." >&2
      exit 1
    fi
    if [[ "${load_status}" -eq 0 ]]; then
      echo "Native transport unexpectedly succeeded instead of returning the expected rejection." >&2
      printf '%s\n' "${load_output}" >&2
      exit 1
    fi
    if ! printf '%s\n' "${load_output}" | grep -Fq "code=${expected_rejection}"; then
      echo "Native transport did not return the expected typed rejection." >&2
      printf '%s\n' "${load_output}" >&2
      exit 1
    fi
    session_path="/tmp/opus-injector-m3-native-$(id -u)/${target_pid}.session"
    if [[ -e "${session_path}" ]]; then
      echo "Expected native transport rejection left a private session behind." >&2
      exit 1
    fi
    if ! kill -0 "${target_pid}" 2>/dev/null; then
      echo "JVM target did not survive the expected native transport rejection." >&2
      sed -n '1,160p' "${target_log}" >&2
      exit 1
    fi
    echo "OPUS native transport returned ${expected_rejection} without leaving a session."
    exit 0
  fi
  if ! printf '%s\n' "${load_output}" | grep -Fq 'code=NativeTransportLoadReady'; then
    echo "Native transport did not publish a ready load handshake." >&2
    printf '%s\n' "${load_output}" >&2
    exit 1
  fi
  if ! printf '%s\n' "${load_output}" | grep -Fq 'state=running'; then
    echo "Native transport load did not enter the running state." >&2
    printf '%s\n' "${load_output}" >&2
    exit 1
  fi

  health_output="$("${injector_binary}" request-health --pid "${target_pid}")"
  if ! printf '%s\n' "${health_output}" | grep -Fq 'code=NativeTransportHealth'; then
    echo "Native transport did not publish a running health response." >&2
    printf '%s\n' "${health_output}" >&2
    exit 1
  fi
  if ! printf '%s\n' "${health_output}" | grep -Fq 'state=running'; then
    echo "Native transport health did not confirm the running state." >&2
    printf '%s\n' "${health_output}" >&2
    exit 1
  fi

  unload_output="$("${injector_binary}" request-unload --pid "${target_pid}")"
  if ! printf '%s\n' "${unload_output}" | grep -Fq 'code=NativeTransportUnloadStopped'; then
    echo "Native transport did not publish a clean stopped unload response." >&2
    printf '%s\n' "${unload_output}" >&2
    exit 1
  fi
  if ! printf '%s\n' "${unload_output}" | grep -Fq 'state=stopped'; then
    echo "Native transport unload did not enter the stopped state." >&2
    printf '%s\n' "${unload_output}" >&2
    exit 1
  fi
  if ! kill -0 "${target_pid}" 2>/dev/null; then
    echo "JVM target did not survive native runtime unload." >&2
    sed -n '1,160p' "${target_log}" >&2
    exit 1
  fi

  health_output="$("${injector_binary}" request-health --pid "${target_pid}")"
  if ! printf '%s\n' "${health_output}" | grep -Fq 'state=stopped'; then
    echo "Native transport health did not confirm the stopped state." >&2
    printf '%s\n' "${health_output}" >&2
    exit 1
  fi
done

stop_output="$("${injector_binary}" request-stop --pid "${target_pid}")"
if ! printf '%s\n' "${stop_output}" | grep -Fq 'code=NativeTransportControlStopped'; then
  echo "Native transport did not close its stopped-session control endpoint." >&2
  printf '%s\n' "${stop_output}" >&2
  exit 1
fi
if ! kill -0 "${target_pid}" 2>/dev/null; then
  echo "JVM target did not survive stopped-session control cleanup." >&2
  sed -n '1,160p' "${target_log}" >&2
  exit 1
fi
rss_after_kib="$(read_target_rss_kib)"
rss_delta_kib='unavailable'
if [[ "${rss_before_kib}" =~ ^[0-9]+$ && "${rss_after_kib}" =~ ^[0-9]+$ ]]; then
  rss_delta_kib=$((rss_after_kib - rss_before_kib))
  if [[ -n "${max_rss_delta_kib}" ]] && (( rss_delta_kib > max_rss_delta_kib )); then
    echo "Native transport RSS grew by ${rss_delta_kib} KiB, above the requested ${max_rss_delta_kib} KiB limit." >&2
    exit 1
  fi
fi

printf 'OPUS native transport completed %s load/handshake/unload/reload cycles in a non-cooperative Java target; rss_before_kib=%s rss_after_kib=%s rss_delta_kib=%s.\n' \
  "${cycles}" \
  "${rss_before_kib}" \
  "${rss_after_kib}" \
  "${rss_delta_kib}"
