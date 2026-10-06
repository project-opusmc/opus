#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "OPUS native VM-RW probe is macOS-only; skipped."
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

probe="${opus_root}/output/injector-native-transport/${host_arch}/opus-task-port-vm-rw-probe"
probe_target="${opus_root}/output/injector-native-transport/${host_arch}/opus-task-port-probe-target"
if [[ ! -x "${probe}" ]] || [[ ! -x "${probe_target}" ]]; then
  "${opus_root}/scripts/build-injector-native-transport.sh" "${host_arch}"
fi

ungranted_target_log="$(mktemp "${TMPDIR:-/tmp}/opus-cooperative-vm-rw-ungranted.XXXXXX")"
"${probe_target}" --seconds 30 --publish-vm-read-marker >"${ungranted_target_log}" 2>&1 &
ungranted_target_pid="$!"
ungranted_descriptor="/tmp/opus-cooperative-vm-probe-${ungranted_target_pid}.descriptor"
target_log="$(mktemp "${TMPDIR:-/tmp}/opus-cooperative-vm-rw-target.XXXXXX")"
"${probe_target}" --seconds 30 --allow-vm-rw-probe >"${target_log}" 2>&1 &
target_pid="$!"
descriptor="/tmp/opus-cooperative-vm-probe-${target_pid}.descriptor"
cleanup() {
  rm -f \
    "${ungranted_descriptor}" \
    "${ungranted_target_log}" \
    "${descriptor}" \
    "${target_log}"
  if kill -0 "${ungranted_target_pid}" 2>/dev/null; then
    kill "${ungranted_target_pid}" 2>/dev/null || true
    wait "${ungranted_target_pid}" 2>/dev/null || true
  fi
  if kill -0 "${target_pid}" 2>/dev/null; then
    kill "${target_pid}" 2>/dev/null || true
    wait "${target_pid}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

for _ in {1..100}; do
  if grep -Fq "code=VmProbeTargetReady pid=${ungranted_target_pid}" "${ungranted_target_log}"; then
    break
  fi
  sleep 0.02
done
if ! grep -Fq "code=VmProbeTargetReady pid=${ungranted_target_pid}" "${ungranted_target_log}"; then
  echo "Cooperative VM target without vm_rw did not report readiness." >&2
  sed -n '1,80p' "${ungranted_target_log}" >&2
  exit 1
fi
if ungranted_output="$("${probe}" --pid "${ungranted_target_pid}" 2>&1)"; then
  echo "VM-RW probe accepted a target that did not grant vm_rw." >&2
  printf '%s\n' "${ungranted_output}" >&2
  exit 1
fi
if ! printf '%s\n' "${ungranted_output}" | grep -Fq 'code=CapabilityNotGranted'; then
  echo "VM-RW probe did not emit CapabilityNotGranted." >&2
  printf '%s\n' "${ungranted_output}" >&2
  exit 1
fi
if ! kill -0 "${ungranted_target_pid}" 2>/dev/null; then
  echo "Cooperative target without vm_rw did not survive the rejected probe." >&2
  exit 1
fi

for _ in {1..100}; do
  if grep -Fq "code=VmProbeTargetReady pid=${target_pid}" "${target_log}"; then
    break
  fi
  sleep 0.02
done
if ! grep -Fq "code=VmProbeTargetReady pid=${target_pid}" "${target_log}"; then
  echo "Cooperative VM-RW target did not report readiness." >&2
  sed -n '1,80p' "${target_log}" >&2
  exit 1
fi
if ! grep -Fq 'capabilities=vm_read,vm_rw' "${target_log}"; then
  echo "Cooperative VM-RW target did not grant the required capability." >&2
  sed -n '1,80p' "${target_log}" >&2
  exit 1
fi

probe_output="$("${probe}" --pid "${target_pid}")"
for expected in \
  'code=VmRwProbeReady' \
  "pid=${target_pid}" \
  'target=cooperative' \
  'allocation=success' \
  'rw_protection=success' \
  'protection_query=ready' \
  'write=success' \
  'readback=match' \
  'deallocation=success' \
  'bytes_written=32' \
  'bytes_read=32' \
  'task_port=acquired_and_released'; do
  if ! printf '%s\n' "${probe_output}" | grep -Fq "${expected}"; then
    echo "Native VM-RW probe did not publish ${expected}." >&2
    printf '%s\n' "${probe_output}" >&2
    exit 1
  fi
done
if ! kill -0 "${target_pid}" 2>/dev/null; then
  echo "Cooperative VM-RW target did not survive the probe." >&2
  exit 1
fi

echo "OPUS cooperative VM allocation/write/readback/deallocation probe passed."
