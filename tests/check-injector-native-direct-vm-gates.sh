#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "OPUS native direct VM-gate probes are macOS-only; skipped."
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
if [[ ! -x "${helper}" ]] || [[ ! -x "${probe_target}" ]]; then
  "${opus_root}/scripts/build-injector-native-transport.sh" "${host_arch}"
fi

target_log="$(mktemp "${TMPDIR:-/tmp}/opus-direct-vm-gates-target.XXXXXX")"
"${probe_target}" --seconds 30 >"${target_log}" 2>&1 &
target_pid="$!"
cleanup() {
  rm -f "${target_log}"
  if kill -0 "${target_pid}" 2>/dev/null; then
    kill "${target_pid}" 2>/dev/null || true
    wait "${target_pid}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

for _ in {1..100}; do
  if grep -Fq "OPUS_TASK_PORT_PROBE_TARGET pid=${target_pid}" "${target_log}"; then
    break
  fi
  sleep 0.02
done
if ! grep -Fq "OPUS_TASK_PORT_PROBE_TARGET pid=${target_pid}" "${target_log}"; then
  echo "Direct VM-gate target did not report readiness." >&2
  sed -n '1,80p' "${target_log}" >&2
  exit 1
fi

if ! vm_read_output="$("${helper}" probe-vm-read --pid "${target_pid}" 2>&1)"; then
  echo "Direct VM-read gate failed." >&2
  printf '%s\n' "${vm_read_output}" >&2
  exit 1
fi
for expected in \
  'code=VmReadProbeReady' \
  "pid=${target_pid}" \
  'target=selected-pid' \
  'bytes_requested=16' \
  'bytes_read=16' \
  'task_for_pid_return=0' \
  'mach_vm_region_recurse_return=0' \
  'mach_vm_read_overwrite_return=0' \
  'mach_port_deallocate_return=0' \
  'task_port=acquired_and_released'; do
  if ! printf '%s\n' "${vm_read_output}" | grep -Fq "${expected}"; then
    echo "Direct VM-read gate did not publish ${expected}." >&2
    printf '%s\n' "${vm_read_output}" >&2
    exit 1
  fi
done

if ! vm_rw_output="$("${helper}" probe-vm-rw --pid "${target_pid}" 2>&1)"; then
  echo "Direct VM-RW gate failed." >&2
  printf '%s\n' "${vm_rw_output}" >&2
  exit 1
fi
for expected in \
  'code=VmRwProbeReady' \
  "pid=${target_pid}" \
  'target=selected-pid' \
  'bytes_written=32' \
  'bytes_read=32' \
  'readback=exact_match' \
  'task_for_pid_return=0' \
  'mach_vm_allocate_return=0' \
  'mach_vm_protect_return=0' \
  'mach_vm_write_return=0' \
  'mach_vm_read_overwrite_return=0' \
  'mach_vm_deallocate_return=0' \
  'mach_port_deallocate_return=0' \
  'task_port=acquired_and_released'; do
  if ! printf '%s\n' "${vm_rw_output}" | grep -Fq "${expected}"; then
    echo "Direct VM-RW gate did not publish ${expected}." >&2
    printf '%s\n' "${vm_rw_output}" >&2
    exit 1
  fi
done

if ! kill -0 "${target_pid}" 2>/dev/null; then
  echo "Direct VM-gate target did not survive the probes." >&2
  exit 1
fi

echo "OPUS native direct VM map/read and RW round-trip probes passed."
