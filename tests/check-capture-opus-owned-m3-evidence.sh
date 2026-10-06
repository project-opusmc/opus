#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
capture_script="${opus_root}/scripts/capture-opus-owned-m3-evidence.sh"
verifier="${opus_root}/scripts/verify-m3-client-integration-evidence.mjs"
fake_injector="${opus_root}/tests/fixtures/fake-opus-owned-client-injector.sh"
temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/opus-m3-evidence-capture.XXXXXX")"
target_pid=""

cleanup() {
  if [[ -n "${target_pid}" ]] && kill -0 "${target_pid}" 2>/dev/null; then
    kill "${target_pid}" 2>/dev/null || true
    wait "${target_pid}" 2>/dev/null || true
  fi
  rm -rf -- "${temporary_directory}"
}
trap cleanup EXIT

if [[ ! -x "${capture_script}" ]] || [[ ! -x "${fake_injector}" ]]; then
  echo "M3 evidence-capture test inputs must be executable." >&2
  exit 1
fi

sleep 120 &
target_pid="$!"

runtime="${temporary_directory}/libopus-runtime.dylib"
client_build="${temporary_directory}/opus-owned-m3-bootstrap-0.1.0.jar"
authorization_record="${temporary_directory}/authorization.md"
printf 'synthetic native runtime\n' > "${runtime}"
printf 'synthetic preview bootstrap\n' > "${client_build}"
printf 'synthetic source review record\n' > "${authorization_record}"

runtime_sha256="$(shasum -a 256 "${runtime}" | awk '{print $1}')"
client_build_sha256="$(shasum -a 256 "${client_build}" | awk '{print $1}')"

create_fixture() {
  local session_id="$1"
  local create_window_marker="$2"
  session_directory="${temporary_directory}/sessions/${session_id}"
  log_directory="${temporary_directory}/logs/${session_id}"
  descriptor="${session_directory}/opus-owned-m3-target.properties"
  control_config="${session_directory}/opus-owned-m3-runtime-control.properties"

  mkdir -p "${session_directory}" "${log_directory}"
  chmod 700 "${session_directory}" "${log_directory}"
  printf '%s\n' \
    'protocolVersion=1' \
    'targetKind=opus-owned-client' \
    "pid=${target_pid}" \
    'port=32123' \
    'targetArchitecture=arm64' \
    'capability=synthetic-capability-not-a-secret' \
    > "${descriptor}"
  printf '%s\n' \
    'targetKind=opus-owned-client' \
    'targetArchitecture=arm64' \
    'targetVersion=0.1.0' \
    "clientBuild=${client_build}" \
    "clientBuildSha256=${client_build_sha256}" \
    'injectorVersion=0.1.0' \
    'nativeRuntimeVersion=0.1.0' \
    'javaRuntimeVersion=not-built' \
    "allowedRuntimeSha256=${runtime_sha256}" \
    > "${control_config}"
  chmod 600 "${descriptor}" "${control_config}"
  printf 'running\n' > "${log_directory}/game.status"
  printf '%s\n' "${target_pid}" > "${log_directory}/game.pid"
  chmod 600 "${log_directory}/game.status"
  if [[ "${create_window_marker}" == "true" ]]; then
    printf 'ready\n' > "${log_directory}/game.window.ready"
    chmod 600 "${log_directory}/game.window.ready"
  fi
}

create_fixture "missing-window" "false"
if "${capture_script}" \
  --descriptor "${descriptor}" \
  --runtime "${runtime}" \
  --log-directory "${log_directory}" \
  --authorization-record "${authorization_record}" \
  --authorization-reference "tests/check-capture-opus-owned-m3-evidence.sh" \
  --output "${temporary_directory}/missing-window.json" \
  --injector "${fake_injector}" \
  >"${temporary_directory}/missing-window.log" 2>&1; then
  echo "Evidence capture unexpectedly accepted a target without a ready game window." >&2
  exit 1
fi
if ! rg -Fq 'has not proved that its game window is ready' "${temporary_directory}/missing-window.log"; then
  echo "Evidence capture did not report the missing game-window proof." >&2
  exit 1
fi

create_fixture "valid-window" "true"
evidence="${temporary_directory}/m3-evidence-v3.json"
"${capture_script}" \
  --descriptor "${descriptor}" \
  --runtime "${runtime}" \
  --log-directory "${log_directory}" \
  --authorization-record "${authorization_record}" \
  --authorization-reference "tests/check-capture-opus-owned-m3-evidence.sh" \
  --output "${evidence}" \
  --injector "${fake_injector}"

node "${verifier}" "${evidence}"
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const evidence = JSON.parse(readFileSync(process.argv[1], "utf8"));
  if (
    evidence.schemaVersion !== 3 ||
    evidence.capture.gameWindowReady !== true ||
    evidence.capture.gameStatus !== "running" ||
    evidence.stop.targetSurvivedAfterStop !== true ||
    evidence.stop.gameWindowReadyAfterStop !== true ||
    evidence.stop.gameStatusAfterStop !== "running"
  ) {
    throw new Error("capture did not write the required schema-v3 live-game evidence");
  }
' "${evidence}"

echo "OPUS M3 schema-v3 evidence capture integration passed."
