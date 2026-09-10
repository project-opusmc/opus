#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'USAGE'
Usage:
  scripts/capture-opus-owned-m3-evidence.sh \
    --descriptor <private-session/opus-owned-m3-target.properties> \
    --runtime <libopus-runtime.dylib> \
    --log-directory <launcher-session-log-directory> \
    --authorization-record <reviewed-source-or-approval-record> \
    --authorization-reference <review-reference> \
    --output <new-evidence.json> \
    [--injector <opus-injector>] \
    [--integration-id <safe-id>] \
    [--cycles <3..20>]

This only records a live, OPUS-owned, cooperative preview session. It never
attaches to another process, prints the descriptor capability, or certifies a
third-party client.
USAGE
}

descriptor=""
runtime=""
log_directory=""
authorization_record=""
authorization_reference=""
output=""
injector="${opus_root}/injector/target/debug/opus-injector"
integration_id="opus-owned-m3-preview"
cycles="3"

while (($# > 0)); do
  case "$1" in
    --descriptor|--runtime|--log-directory|--authorization-record|--authorization-reference|--output|--injector|--integration-id|--cycles)
      if (($# < 2)); then
        echo "$1 requires a value." >&2
        exit 1
      fi
      case "$1" in
        --descriptor) descriptor="$2" ;;
        --runtime) runtime="$2" ;;
        --log-directory) log_directory="$2" ;;
        --authorization-record) authorization_record="$2" ;;
        --authorization-reference) authorization_reference="$2" ;;
        --output) output="$2" ;;
        --injector) injector="$2" ;;
        --integration-id) integration_id="$2" ;;
        --cycles) cycles="$2" ;;
      esac
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

for required_name in descriptor runtime log_directory authorization_record authorization_reference output; do
  if [[ -z "${!required_name}" ]]; then
    echo "--${required_name//_/-} is required." >&2
    usage >&2
    exit 1
  fi
done

if ! [[ "${cycles}" =~ ^([3-9]|1[0-9]|20)$ ]]; then
  echo "--cycles must be an integer from 3 through 20." >&2
  exit 1
fi
if ! [[ "${integration_id}" =~ ^[a-z0-9][a-z0-9.-]{2,127}$ ]]; then
  echo "--integration-id must be a lowercase dotted identifier." >&2
  exit 1
fi
if ! [[ "${authorization_reference}" =~ ^[A-Za-z0-9._:/#-]{3,200}$ ]]; then
  echo "--authorization-reference has unsupported characters." >&2
  exit 1
fi

for input_path in "${descriptor}" "${runtime}" "${authorization_record}"; do
  if [[ ! -f "${input_path}" ]]; then
    echo "Required regular file is missing: ${input_path}" >&2
    exit 1
  fi
done
if [[ "$(stat -f '%Lp' "${descriptor}")" != "600" ]]; then
  echo "The OPUS-owned preview descriptor is not owner-readable only." >&2
  exit 1
fi
if [[ -e "${output}" ]]; then
  echo "Evidence output already exists; choose a new path: ${output}" >&2
  exit 1
fi
if [[ ! -d "$(dirname "${output}")" ]]; then
  echo "Evidence output directory does not exist: $(dirname "${output}")" >&2
  exit 1
fi
if [[ ! -d "${log_directory}" ]]; then
  echo "The launcher session log directory is unavailable: ${log_directory}" >&2
  exit 1
fi
if [[ "$(basename "$(dirname "${descriptor}")")" != "$(basename "${log_directory}")" ]]; then
  echo "The descriptor and launcher log directory do not belong to the same session." >&2
  exit 1
fi
if [[ ! -x "${injector}" ]]; then
  cargo build --manifest-path "${opus_root}/injector/Cargo.toml" --bin opus-injector
fi
if [[ ! -x "${injector}" ]]; then
  echo "OPUS injector binary is unavailable: ${injector}" >&2
  exit 1
fi

target_kind="$(sed -n 's/^targetKind=//p' "${descriptor}")"
target_architecture="$(sed -n 's/^targetArchitecture=//p' "${descriptor}")"
target_pid="$(sed -n 's/^pid=//p' "${descriptor}")"
if [[ "${target_kind}" != "opus-owned-client" ]]; then
  echo "The descriptor is not an OPUS-owned M3 client preview descriptor." >&2
  exit 1
fi
if [[ "${target_architecture}" != "arm64" && "${target_architecture}" != "x86_64" ]]; then
  echo "The descriptor reports an unsupported target architecture." >&2
  exit 1
fi
if ! [[ "${target_pid}" =~ ^[1-9][0-9]*$ ]]; then
  echo "The OPUS-owned preview descriptor has no valid target PID." >&2
  exit 1
fi

window_ready_path="${log_directory}/game.window.ready"
window_failure_path="${log_directory}/game.window.failure"
game_status_path="${log_directory}/game.status"
game_pid_path="${log_directory}/game.pid"

assert_live_preview_game() {
  local context="$1"
  local game_status
  local log_target_pid

  if [[ ! -f "${window_ready_path}" ]]; then
    echo "The OPUS-owned preview has not proved that its game window is ready (${context})." >&2
    exit 1
  fi
  if [[ -e "${window_failure_path}" ]]; then
    echo "The OPUS-owned preview recorded a game-window failure (${context})." >&2
    exit 1
  fi
  if find "${log_directory}" -maxdepth 1 -type f -name 'jvm_crash_*.log' \
    -print -quit | grep -q .; then
    echo "The OPUS-owned preview recorded a JVM crash marker (${context})." >&2
    exit 1
  fi
  if [[ ! -f "${game_status_path}" ]] || [[ ! -f "${game_pid_path}" ]]; then
    echo "The OPUS-owned preview is missing a game lifecycle marker (${context})." >&2
    exit 1
  fi
  game_status="$(tr -d '\r\n' < "${game_status_path}")"
  if [[ "${game_status}" != "running" ]]; then
    echo "The OPUS-owned preview is not running (${context}): ${game_status:-missing}" >&2
    exit 1
  fi
  log_target_pid="$(tr -d '\r\n' < "${game_pid_path}")"
  if [[ "${log_target_pid}" != "${target_pid}" ]]; then
    echo "The descriptor PID and launcher game PID do not agree (${context})." >&2
    exit 1
  fi
  if ! kill -0 "${target_pid}" 2>/dev/null; then
    echo "The OPUS-owned game JVM is no longer alive (${context})." >&2
    exit 1
  fi
}

assert_live_preview_game "before evidence capture"

control_config="$(dirname "${descriptor}")/opus-owned-m3-runtime-control.properties"
if [[ ! -f "${control_config}" ]]; then
  echo "The private OPUS-owned runtime-control configuration is unavailable." >&2
  exit 1
fi

read_single_control_field() {
  local field_name="$1"
  local field_value
  field_value="$(sed -n "s/^${field_name}=//p" "${control_config}")"
  if [[ "$(printf '%s\n' "${field_value}" | sed '/^$/d' | wc -l | tr -d ' ')" != "1" ]]; then
    echo "The private OPUS-owned runtime-control configuration is invalid." >&2
    exit 1
  fi
  printf '%s' "${field_value}"
}

control_target_kind="$(read_single_control_field targetKind)"
control_target_architecture="$(read_single_control_field targetArchitecture)"
target_version="$(read_single_control_field targetVersion)"
client_build="$(read_single_control_field clientBuild)"
expected_client_build_sha256="$(read_single_control_field clientBuildSha256)"
injector_version="$(read_single_control_field injectorVersion)"
native_runtime_version="$(read_single_control_field nativeRuntimeVersion)"
java_runtime_version="$(read_single_control_field javaRuntimeVersion)"
allowed_runtime_sha256="$(read_single_control_field allowedRuntimeSha256)"
if [[ "${control_target_kind}" != "opus-owned-client" \
  || "${control_target_architecture}" != "${target_architecture}" ]]; then
  echo "The descriptor and private runtime-control configuration do not agree." >&2
  exit 1
fi
if ! [[ "${target_version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
  echo "The launcher-bound OPUS-owned target version is invalid." >&2
  exit 1
fi
if [[ ! -f "${client_build}" ]]; then
  echo "The launcher-bound OPUS-owned preview client build is unavailable." >&2
  exit 1
fi
if [[ "$(basename "${client_build}")" != "opus-owned-m3-bootstrap-${target_version}.jar" ]]; then
  echo "The launcher-bound OPUS-owned preview client build identity is invalid." >&2
  exit 1
fi
for version in "${injector_version}" "${native_runtime_version}"; do
  if ! [[ "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
    echo "The private runtime-control configuration has an invalid component version." >&2
    exit 1
  fi
done
if [[ "${java_runtime_version}" != "not-built" ]]; then
  echo "The Java payload version must remain not-built until opus-runtime.jar exists." >&2
  exit 1
fi

runtime_sha256="$(shasum -a 256 "${runtime}" | awk '{print $1}')"
client_build_sha256="$(shasum -a 256 "${client_build}" | awk '{print $1}')"
authorization_record_sha256="$(shasum -a 256 "${authorization_record}" | awk '{print $1}')"
for digest in "${runtime_sha256}" "${client_build_sha256}" "${expected_client_build_sha256}" "${authorization_record_sha256}"; do
  if ! [[ "${digest}" =~ ^[0-9a-f]{64}$ ]]; then
    echo "Unable to calculate a required SHA-256 digest." >&2
    exit 1
  fi
done
if [[ "${allowed_runtime_sha256}" != "${runtime_sha256}" ]]; then
  echo "The selected runtime does not match the preview launch configuration." >&2
  exit 1
fi
if [[ "${expected_client_build_sha256}" != "${client_build_sha256}" ]]; then
  echo "The launcher-bound preview client build does not match its launch configuration." >&2
  exit 1
fi

runtime_loaded=0
cleanup() {
  if (( runtime_loaded == 1 )) && [[ -f "${descriptor}" ]]; then
    "${injector}" opus-owned-client unload --descriptor "${descriptor}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

run_control() {
  local expected_code="$1"
  shift
  local control_output
  control_output="$("${injector}" opus-owned-client "$@")"
  printf '%s\n' "${control_output}"
  if ! printf '%s\n' "${control_output}" | grep -Fq "code=${expected_code}"; then
    echo "OPUS-owned preview did not return ${expected_code} for $1." >&2
    exit 1
  fi
}

run_control "OpusOwnedClientSurvivalProof" health \
  --descriptor "${descriptor}" \
  --expect-state waiting

for ((cycle = 1; cycle <= cycles; cycle += 1)); do
  run_control "OpusOwnedClientLoadProof" load \
    --descriptor "${descriptor}" \
    --runtime "${runtime}"
  runtime_loaded=1
  run_control "OpusOwnedClientSurvivalProof" health \
    --descriptor "${descriptor}" \
    --expect-state running
  run_control "OpusOwnedClientUnloadProof" unload \
    --descriptor "${descriptor}"
  runtime_loaded=0
  run_control "OpusOwnedClientSurvivalProof" health \
    --descriptor "${descriptor}" \
    --expect-state stopped
done

run_control "OpusOwnedClientStopProof" stop \
  --descriptor "${descriptor}"
for _ in {1..100}; do
  if [[ ! -e "${descriptor}" ]]; then
    break
  fi
  sleep 0.05
done
if [[ -e "${descriptor}" ]]; then
  echo "The OPUS-owned preview did not remove its descriptor after stop." >&2
  exit 1
fi
assert_live_preview_game "after runtime-control stop"

OPUS_EVIDENCE_OUTPUT="${output}" \
OPUS_EVIDENCE_OBSERVED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
OPUS_EVIDENCE_INTEGRATION_ID="${integration_id}" \
OPUS_EVIDENCE_TARGET_VERSION="${target_version}" \
OPUS_EVIDENCE_TARGET_ARCHITECTURE="${target_architecture}" \
OPUS_EVIDENCE_TARGET_PID="${target_pid}" \
OPUS_EVIDENCE_CLIENT_BUILD_SHA256="${client_build_sha256}" \
OPUS_EVIDENCE_AUTHORIZATION_REFERENCE="${authorization_reference}" \
OPUS_EVIDENCE_AUTHORIZATION_RECORD_SHA256="${authorization_record_sha256}" \
OPUS_EVIDENCE_RUNTIME_SHA256="${runtime_sha256}" \
OPUS_EVIDENCE_INJECTOR_VERSION="${injector_version}" \
OPUS_EVIDENCE_NATIVE_RUNTIME_VERSION="${native_runtime_version}" \
OPUS_EVIDENCE_JAVA_RUNTIME_VERSION="${java_runtime_version}" \
OPUS_EVIDENCE_CYCLES="${cycles}" \
node --input-type=module - <<'NODE'
import { chmodSync, writeFileSync } from "node:fs";

const cycles = Number.parseInt(process.env.OPUS_EVIDENCE_CYCLES, 10);
const lifecycle = (cycle) => ({
  cycle,
  events: [
    { operation: "health", code: "TargetAlive", state: "waiting" },
    { operation: "load", code: "Ready", state: "running" },
    { operation: "health", code: "TargetAlive", state: "running" },
    { operation: "unload", code: "Stopped", state: "stopped" },
    { operation: "health", code: "TargetAlive", state: "stopped" },
  ],
  targetSurvived: true,
});
const evidence = {
  schemaVersion: 3,
  scope: "m3-authorized-client-integration",
  capture: {
    observedAt: process.env.OPUS_EVIDENCE_OBSERVED_AT,
    fixture: false,
    targetPid: Number.parseInt(process.env.OPUS_EVIDENCE_TARGET_PID, 10),
    gameWindowReady: true,
    gameStatus: "running",
  },
  target: {
    integrationId: process.env.OPUS_EVIDENCE_INTEGRATION_ID,
    kind: "opus-owned-client",
    minecraftVersion: "1.8.9",
    targetVersion: process.env.OPUS_EVIDENCE_TARGET_VERSION,
    architecture: process.env.OPUS_EVIDENCE_TARGET_ARCHITECTURE,
    clientBuildSha256: process.env.OPUS_EVIDENCE_CLIENT_BUILD_SHA256,
    authorization: {
      mode: "opus-owned",
      reference: process.env.OPUS_EVIDENCE_AUTHORIZATION_REFERENCE,
      recordSha256: process.env.OPUS_EVIDENCE_AUTHORIZATION_RECORD_SHA256,
      approvedTransport: "cooperative-opt-in",
    },
  },
  transport: {
    mode: "cooperative-opt-in",
    targetSelfLoadsAuthorizedRuntime: true,
    modifiesUnrelatedProcess: false,
  },
  runtime: {
    nativeRuntimeVersion: process.env.OPUS_EVIDENCE_NATIVE_RUNTIME_VERSION,
    javaRuntimeVersion: process.env.OPUS_EVIDENCE_JAVA_RUNTIME_VERSION,
    nativeRuntimeSha256: process.env.OPUS_EVIDENCE_RUNTIME_SHA256,
  },
  handshake: {
    protocolVersion: 1,
    injectorVersion: process.env.OPUS_EVIDENCE_INJECTOR_VERSION,
    nativeRuntimeVersion: process.env.OPUS_EVIDENCE_NATIVE_RUNTIME_VERSION,
    javaRuntimeVersion: process.env.OPUS_EVIDENCE_JAVA_RUNTIME_VERSION,
    targetArchitecture: process.env.OPUS_EVIDENCE_TARGET_ARCHITECTURE,
    mappingSchemaVersion: "not-applicable",
    oneConfigAdapterVersion: "not-loaded",
    artifactChecksums: "not-packaged",
  },
  cycles: Array.from({ length: cycles }, (_, index) => lifecycle(index + 1)),
  stop: {
    operation: "stop",
    code: "TargetStopping",
    state: "stopped",
    descriptorRemoved: true,
    targetSurvivedAfterStop: true,
    gameWindowReadyAfterStop: true,
    gameStatusAfterStop: "running",
  },
};
writeFileSync(
  process.env.OPUS_EVIDENCE_OUTPUT,
  `${JSON.stringify(evidence, null, 2)}\n`,
  { encoding: "utf8", flag: "wx", mode: 0o600 },
);
chmodSync(process.env.OPUS_EVIDENCE_OUTPUT, 0o600);
NODE

node "${opus_root}/scripts/verify-m3-client-integration-evidence.mjs" "${output}"
trap - EXIT
echo "OPUS-owned M3 evidence capture written: ${output}"
