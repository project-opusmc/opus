#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "OPUS native transport task-port probe is macOS-only; skipped."
  exit 0
fi

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$(uname -m)" in
  arm64)
    host_arch="arm64"
    ;;
  x86_64)
    host_arch="x86_64"
    ;;
  *)
    echo "Unsupported macOS host architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

helper="${opus_root}/output/injector-native-transport/${host_arch}/opus-macos-transport"
probe_target="${opus_root}/output/injector-native-transport/${host_arch}/opus-task-port-probe-target"
probe_runtime="${opus_root}/output/injector-native-transport/${host_arch}/libopus-remote-loader-probe.dylib"
if [[ ! -x "${helper}" ]] || [[ ! -x "${probe_target}" ]] || [[ ! -f "${probe_runtime}" ]]; then
  "${opus_root}/scripts/build-injector-native-transport.sh" "${host_arch}"
fi

probe_target_log="$(mktemp "${TMPDIR:-/tmp}/opus-task-port-probe.XXXXXX")"
"${probe_target}" --seconds 30 >"${probe_target_log}" 2>&1 &
probe_target_pid="$!"
probe_marker="/tmp/opus-remote-loader-probe-${probe_target_pid}.ready"
cleanup() {
  rm -f "${probe_marker}" "${probe_target_log}"
  if kill -0 "${probe_target_pid}" 2>/dev/null; then
    kill "${probe_target_pid}" 2>/dev/null || true
    wait "${probe_target_pid}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

for _ in {1..100}; do
  if grep -Fq "OPUS_TASK_PORT_PROBE_TARGET pid=${probe_target_pid}" "${probe_target_log}"; then
    break
  fi
  sleep 0.02
done
if ! grep -Fq "OPUS_TASK_PORT_PROBE_TARGET pid=${probe_target_pid}" "${probe_target_log}"; then
  echo "Native transport probe target did not report readiness." >&2
  sed -n '1,80p' "${probe_target_log}" >&2
  exit 1
fi

probe_output="$("${helper}" probe --pid "${probe_target_pid}")"
if ! printf '%s\n' "${probe_output}" | grep -Fq 'code=TaskPortProbeReady'; then
  echo "Native transport helper did not prove current-user task-port access." >&2
  printf '%s\n' "${probe_output}" >&2
  exit 1
fi
if ! printf '%s\n' "${probe_output}" | grep -Fq 'task_port=acquired_and_released'; then
  echo "Native transport helper did not release the task port." >&2
  printf '%s\n' "${probe_output}" >&2
  exit 1
fi

load_output="$("${helper}" load --pid "${probe_target_pid}" --runtime "${probe_runtime}")"
if ! printf '%s\n' "${load_output}" | grep -Fq 'code=RemoteDlopenReady'; then
  echo "Native transport helper did not complete a remote system-dlopen request." >&2
  printf '%s\n' "${load_output}" >&2
  exit 1
fi
for _ in {1..100}; do
  if [[ -f "${probe_marker}" ]]; then
    break
  fi
  sleep 0.02
done
if [[ ! -f "${probe_marker}" ]]; then
  echo "Remote dylib constructor did not publish its marker." >&2
  exit 1
fi
if ! kill -0 "${probe_target_pid}" 2>/dev/null; then
  echo "Transport probe target did not survive remote dylib loading." >&2
  exit 1
fi

echo "OPUS native transport current-user task-port probe passed."
