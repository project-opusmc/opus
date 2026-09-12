#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "OPUS native VM-read probe is macOS-only; skipped."
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

probe="${opus_root}/output/injector-native-transport/${host_arch}/opus-task-port-vm-read-probe"
probe_target="${opus_root}/output/injector-native-transport/${host_arch}/opus-task-port-probe-target"
if [[ ! -x "${probe}" ]] || [[ ! -x "${probe_target}" ]]; then
  "${opus_root}/scripts/build-injector-native-transport.sh" "${host_arch}"
fi

target_log="$(mktemp "${TMPDIR:-/tmp}/opus-owned-vm-read-target.XXXXXX")"
"${probe_target}" --seconds 30 --publish-vm-read-marker >"${target_log}" 2>&1 &
target_pid="$!"
descriptor="/tmp/opus-cooperative-vm-probe-${target_pid}.descriptor"
cleanup() {
  rm -f "${descriptor}" "${target_log}"
  if kill -0 "${target_pid}" 2>/dev/null; then
    kill "${target_pid}" 2>/dev/null || true
    wait "${target_pid}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

for _ in {1..100}; do
  if grep -Fq "code=VmProbeTargetReady pid=${target_pid}" "${target_log}"; then
    break
  fi
  sleep 0.02
done
if ! grep -Fq "code=VmProbeTargetReady pid=${target_pid}" "${target_log}"; then
  echo "Cooperative VM-read target did not report readiness." >&2
  sed -n '1,80p' "${target_log}" >&2
  exit 1
fi

probe_output="$("${probe}" --pid "${target_pid}")"
for expected in \
  'code=VmReadProbeReady' \
  "pid=${target_pid}" \
  'target=cooperative' \
  'marker=matched' \
  'region_query=ready' \
  'bytes_read=8' \
  'task_port=acquired_and_released'; do
  if ! printf '%s\n' "${probe_output}" | grep -Fq "${expected}"; then
    echo "Native VM-read probe did not publish ${expected}." >&2
    printf '%s\n' "${probe_output}" >&2
    exit 1
  fi
done
if ! kill -0 "${target_pid}" 2>/dev/null; then
  echo "OPUS-owned VM-read target did not survive the read-only probe." >&2
  exit 1
fi

echo "OPUS native VM map/query/read probe passed."
