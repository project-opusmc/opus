#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "OPUS native execution probe is macOS-only; skipped."
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

if [[ "${host_arch}" != "arm64" ]]; then
  echo "OPUS native execution probe requires an arm64 host; skipped."
  exit 0
fi

helper="${opus_root}/output/injector-native-transport/${host_arch}/opus-macos-transport"
probe_target="${opus_root}/output/injector-native-transport/${host_arch}/opus-task-port-probe-target"
if [[ ! -x "${helper}" ]] || [[ ! -x "${probe_target}" ]]; then
  "${opus_root}/scripts/build-injector-native-transport.sh" "${host_arch}"
fi

target_log="$(mktemp "${TMPDIR:-/tmp}/opus-native-execution-target.XXXXXX")"
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
  echo "Native execution probe target did not report readiness." >&2
  sed -n '1,80p' "${target_log}" >&2
  exit 1
fi

run_stage() {
  local iterations="$1"
  local expected_code="$2"
  local expected_state="$3"
  local output
  if ! output="$("${helper}" probe-native-execution \
    --pid "${target_pid}" \
    --iterations "${iterations}" 2>&1)"; then
    echo "Native execution stage ${iterations} failed." >&2
    printf '%s\n' "${output}" >&2
    exit 1
  fi

  for expected in \
    "code=${expected_code}" \
    "state=${expected_state}" \
    "target_pid=${target_pid}" \
    'architecture=arm64' \
    'marker_before=0x11223344' \
    'expected_after=0x55667788' \
    'marker_after=0x55667788' \
    'execution_observed=true' \
    'cleanup=true' \
    'target_alive=true' \
    "iterations_completed=${iterations}" \
    "iterations_requested=${iterations}" \
    "iteration=${iterations}/${iterations}" \
    'task_for_pid_return=0' \
    'mach_vm_protect_return=0' \
    'thread_create_running_return=0' \
    'thread_terminate_return=0' \
    'bootstrap_thread_port_released=true' \
    'code_mach_vm_deallocate_return=0' \
    'data_mach_vm_deallocate_return=0' \
    'mach_port_deallocate_return=0'; do
    if ! printf '%s\n' "${output}" | grep -Fq "${expected}"; then
      echo "Native execution stage ${iterations} did not publish ${expected}." >&2
      printf '%s\n' "${output}" >&2
      exit 1
    fi
  done

  if ! kill -0 "${target_pid}" 2>/dev/null; then
    echo "Native execution target exited during stage ${iterations}." >&2
    exit 1
  fi
}

run_stage 1 NativeExecutionObserved ExecutionObserved
run_stage 3 NativeExecutionObserved ExecutionObserved
run_stage 10 NativeExecutionObserved ExecutionObserved
run_stage 25 NativeExecutionReady NativeExecutionReady

echo "OPUS native execution handoff probe passed through 1, 3, 10, and 25 iterations."
