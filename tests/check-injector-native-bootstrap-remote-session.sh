#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "OPUS retained remote-bootstrap-session proof is macOS-only; skipped."
  exit 0
fi

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$(uname -m)" in
  arm64|x86_64)
    host_arch="$(uname -m)"
    ;;
  *)
    echo "Unsupported macOS host architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

helper="${opus_root}/output/injector-native-transport/${host_arch}/opus-macos-transport"
probe_target="${opus_root}/output/injector-native-transport/${host_arch}/opus-task-port-probe-target"
bootstrap="${opus_root}/output/injector-native-transport/${host_arch}/libopus-bootstrap.dylib"
missing_entrypoint_bootstrap="${opus_root}/output/injector-native-transport/${host_arch}/libopus-remote-loader-probe.dylib"
if [[ ! -x "${helper}" ]] || [[ ! -x "${probe_target}" ]] || \
  [[ ! -f "${bootstrap}" ]] || [[ ! -f "${missing_entrypoint_bootstrap}" ]]; then
  "${opus_root}/scripts/build-injector-native-transport.sh" "${host_arch}"
fi

target_a_pid=""
target_b_pid=""
target_a_log="$(mktemp "${TMPDIR:-/tmp}/opus-bootstrap-remote-session-a.XXXXXX")"
target_b_log="$(mktemp "${TMPDIR:-/tmp}/opus-bootstrap-remote-session-b.XXXXXX")"
drift_bootstrap="$(mktemp "${TMPDIR:-/tmp}/opus-bootstrap-remote-session-drift.XXXXXX")"
session_directory="/tmp/opus-macos-bootstrap-session-$(id -u)"
run_nonce="$(date +%s)-$$"
positive_run_id="remote-session-positive-${run_nonce}"
missing_entrypoint_run_id="remote-session-missing-entrypoint-${run_nonce}"
artifact_drift_run_id="remote-session-artifact-drift-${run_nonce}"
wrong_run_id="remote-session-wrong-${run_nonce}"
remote_probe_marker=""

cleanup() {
  local target_pid
  set +e
  for target_pid in "${target_a_pid}" "${target_b_pid}"; do
    if [[ -n "${target_pid}" ]] && kill -0 "${target_pid}" 2>/dev/null; then
      kill "${target_pid}" 2>/dev/null || true
      wait "${target_pid}" 2>/dev/null || true
    fi
  done
  if [[ -n "${remote_probe_marker}" ]]; then
    rm -f "${remote_probe_marker}"
  fi
  rm -f "${target_a_log}" "${target_b_log}" "${drift_bootstrap}"
}
trap cleanup EXIT

wait_for_target() {
  local target_pid="$1"
  local target_log="$2"
  for _ in {1..100}; do
    if grep -Fq "OPUS_TASK_PORT_PROBE_TARGET pid=${target_pid}" "${target_log}"; then
      return 0
    fi
    sleep 0.02
  done
  echo "Owned external bootstrap fixture did not report readiness." >&2
  sed -n '1,80p' "${target_log}" >&2
  return 1
}

assert_output_contains() {
  local description="$1"
  local output="$2"
  shift 2
  local expected
  for expected in "$@"; do
    if ! printf '%s\n' "${output}" | grep -Fq "${expected}"; then
      echo "${description} did not publish ${expected}." >&2
      printf '%s\n' "${output}" >&2
      return 1
    fi
  done
}

expect_failure() {
  local description="$1"
  local expected="$2"
  shift 2
  local output
  if output="$("$@" 2>&1)"; then
    echo "${description} unexpectedly succeeded." >&2
    printf '%s\n' "${output}" >&2
    return 1
  fi
  assert_output_contains "${description}" "${output}" "code=${expected}"
}

assert_target_alive() {
  local target_pid="$1"
  local description="$2"
  if ! kill -0 "${target_pid}" 2>/dev/null; then
    echo "${description}: owned external bootstrap fixture exited." >&2
    return 1
  fi
}

"${probe_target}" --seconds 120 >"${target_a_log}" 2>&1 &
target_a_pid="$!"
"${probe_target}" --seconds 120 >"${target_b_log}" 2>&1 &
target_b_pid="$!"
wait_for_target "${target_a_pid}" "${target_a_log}"
wait_for_target "${target_b_pid}" "${target_b_log}"

positive_load_output="$("${helper}" bootstrap-load \
  --pid "${target_a_pid}" \
  --bootstrap "${bootstrap}" \
  --run-id "${positive_run_id}")"
assert_output_contains \
  "retained remote bootstrap load" \
  "${positive_load_output}" \
  "code=BootstrapTargetResolved" \
  "code=BootstrapTransportReady" \
  "code=BootstrapArtifactVerified" \
  "code=BootstrapModuleLoaded" \
  "code=BootstrapRemoteSessionRetained" \
  "pid=${target_a_pid}" \
  "run_id=${positive_run_id}" \
  "remote_session=retained"
positive_session_path="${session_directory}/${positive_run_id}.session"
if [[ ! -f "${positive_session_path}" ]]; then
  echo "Retained remote bootstrap load did not create its private session." >&2
  exit 1
fi
if [[ "$(stat -f '%Lp' "${positive_session_path}")" != "600" ]]; then
  echo "Retained remote bootstrap session is not private." >&2
  exit 1
fi
if ! grep -Fqx 'state=loaded' "${positive_session_path}"; then
  echo "Retained remote bootstrap session did not retain the loaded state." >&2
  exit 1
fi
assert_target_alive "${target_a_pid}" "retained remote bootstrap load"

expect_failure \
  "run-context mismatch rejection" \
  "BootstrapRunContextMismatch" \
  "${helper}" bootstrap-resolve-entrypoints \
  --pid "${target_a_pid}" \
  --run-id "${wrong_run_id}"

expect_failure \
  "target identity mismatch rejection" \
  "BootstrapTargetIdentityMismatch" \
  "${helper}" bootstrap-resolve-entrypoints \
  --pid "${target_b_pid}" \
  --run-id "${positive_run_id}"

entrypoint_output="$("${helper}" bootstrap-resolve-entrypoints \
  --pid "${target_a_pid}" \
  --run-id "${positive_run_id}")"
assert_output_contains \
  "remote entrypoint resolution" \
  "${entrypoint_output}" \
  "code=BootstrapEntrypointReady" \
  "pid=${target_a_pid}" \
  "run_id=${positive_run_id}" \
  "abi_version=1" \
  "entrypoints=start,stop" \
  "remote_session=retained"
if ! grep -Fqx 'state=entrypoints-resolved' "${positive_session_path}"; then
  echo "Remote entrypoint resolution did not update the retained session." >&2
  exit 1
fi
assert_target_alive "${target_a_pid}" "remote entrypoint resolution"

cleanup_output="$("${helper}" bootstrap-cleanup \
  --pid "${target_a_pid}" \
  --run-id "${positive_run_id}")"
assert_output_contains \
  "remote bootstrap cleanup" \
  "${cleanup_output}" \
  "code=BootstrapCleanupReady" \
  "pid=${target_a_pid}" \
  "run_id=${positive_run_id}" \
  "state=cleaned" \
  "physical_unmapping=not_claimed"
if ! grep -Fqx 'state=cleaned' "${positive_session_path}"; then
  echo "Remote bootstrap cleanup did not retain a cleaned tombstone." >&2
  exit 1
fi
assert_target_alive "${target_a_pid}" "remote bootstrap cleanup"

expect_failure \
  "entrypoint resolution after cleanup rejection" \
  "BootstrapSessionAlreadyCleaned" \
  "${helper}" bootstrap-resolve-entrypoints \
  --pid "${target_a_pid}" \
  --run-id "${positive_run_id}"

missing_entrypoint_load_output="$("${helper}" bootstrap-load \
  --pid "${target_b_pid}" \
  --bootstrap "${missing_entrypoint_bootstrap}" \
  --run-id "${missing_entrypoint_run_id}")"
assert_output_contains \
  "missing-entrypoint fixture load" \
  "${missing_entrypoint_load_output}" \
  "code=BootstrapModuleLoaded" \
  "code=BootstrapRemoteSessionRetained" \
  "pid=${target_b_pid}" \
  "run_id=${missing_entrypoint_run_id}"
remote_probe_marker="/tmp/opus-remote-loader-probe-${target_b_pid}.ready"
for _ in {1..100}; do
  if [[ -f "${remote_probe_marker}" ]]; then
    break
  fi
  sleep 0.02
done
if [[ ! -f "${remote_probe_marker}" ]]; then
  echo "Missing-entrypoint fixture did not prove a real remote module load." >&2
  exit 1
fi
expect_failure \
  "missing bootstrap entrypoint rejection" \
  "BootstrapEntrypointMissing" \
  "${helper}" bootstrap-resolve-entrypoints \
  --pid "${target_b_pid}" \
  --run-id "${missing_entrypoint_run_id}"
missing_entrypoint_cleanup_output="$("${helper}" bootstrap-cleanup \
  --pid "${target_b_pid}" \
  --run-id "${missing_entrypoint_run_id}")"
assert_output_contains \
  "missing-entrypoint fixture cleanup" \
  "${missing_entrypoint_cleanup_output}" \
  "code=BootstrapCleanupReady" \
  "state=cleaned"
assert_target_alive "${target_b_pid}" "missing-entrypoint fixture cleanup"

cp "${bootstrap}" "${drift_bootstrap}"
if ! cmp -s "${bootstrap}" "${drift_bootstrap}"; then
  echo "Artifact-drift fixture copy did not preserve bootstrap bytes." >&2
  exit 1
fi
artifact_drift_load_output="$("${helper}" bootstrap-load \
  --pid "${target_b_pid}" \
  --bootstrap "${drift_bootstrap}" \
  --run-id "${artifact_drift_run_id}")"
assert_output_contains \
  "artifact-drift fixture load" \
  "${artifact_drift_load_output}" \
  "code=BootstrapModuleLoaded" \
  "code=BootstrapRemoteSessionRetained" \
  "pid=${target_b_pid}" \
  "run_id=${artifact_drift_run_id}"
printf 'artifact-drift\n' >>"${drift_bootstrap}"
expect_failure \
  "artifact drift after session binding rejection" \
  "BootstrapArtifactIdentityMismatch" \
  "${helper}" bootstrap-resolve-entrypoints \
  --pid "${target_b_pid}" \
  --run-id "${artifact_drift_run_id}"
assert_target_alive "${target_b_pid}" "artifact drift rejection"

cp "${bootstrap}" "${drift_bootstrap}"
if ! cmp -s "${bootstrap}" "${drift_bootstrap}"; then
  echo "Artifact-drift fixture could not restore its verified bootstrap bytes." >&2
  exit 1
fi
artifact_drift_cleanup_output="$("${helper}" bootstrap-cleanup \
  --pid "${target_b_pid}" \
  --run-id "${artifact_drift_run_id}")"
assert_output_contains \
  "artifact-drift fixture cleanup after restoration" \
  "${artifact_drift_cleanup_output}" \
  "code=BootstrapCleanupReady" \
  "state=cleaned"
assert_target_alive "${target_b_pid}" "artifact-drift fixture cleanup"

echo "OPUS retained remote bootstrap-session proof passed: owned external load, retained-session remote entrypoint resolution, typed identity/artifact rejections, and cleanup tombstones."
