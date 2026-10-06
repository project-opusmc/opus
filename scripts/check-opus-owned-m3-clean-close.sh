#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'USAGE'
Usage:
  scripts/check-opus-owned-m3-clean-close.sh \
    --descriptor <private-session/opus-owned-m3-target.properties> \
    --runtime <libopus-runtime.dylib> \
    --log-directory <launcher-session-log-directory> \
    [--injector <opus-injector>] \
    [--cycles <3..20>] \
    [--startup-timeout-seconds <10..120>]

This exercises only an already-running, OPUS-owned M3 preview target. It
waits for the current Forge preview host to finish its known audio startup
sequence, performs capability-gated load/unload cycles, then asks the target
to set its own LWJGL close-request flag. It never sends a process signal,
attaches to a foreign process, or certifies a third-party client.
USAGE
}

descriptor=""
runtime=""
log_directory=""
injector="${opus_root}/injector/target/debug/opus-injector"
cycles="3"
startup_timeout_seconds="90"

while (($# > 0)); do
  case "$1" in
    --descriptor|--runtime|--log-directory|--injector|--cycles|--startup-timeout-seconds)
      if (($# < 2)); then
        echo "$1 requires a value." >&2
        exit 1
      fi
      case "$1" in
        --descriptor) descriptor="$2" ;;
        --runtime) runtime="$2" ;;
        --log-directory) log_directory="$2" ;;
        --injector) injector="$2" ;;
        --cycles) cycles="$2" ;;
        --startup-timeout-seconds) startup_timeout_seconds="$2" ;;
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

for required_name in descriptor runtime log_directory; do
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
if ! [[ "${startup_timeout_seconds}" =~ ^([1-9][0-9]?|1[01][0-9]|120)$ ]] \
  || (( startup_timeout_seconds < 10 )); then
  echo "--startup-timeout-seconds must be an integer from 10 through 120." >&2
  exit 1
fi
if [[ ! -f "${descriptor}" ]] || [[ ! -f "${runtime}" ]]; then
  echo "The OPUS-owned descriptor and native runtime must be regular files." >&2
  exit 1
fi
if [[ ! -d "${log_directory}" ]]; then
  echo "The launcher log directory is unavailable: ${log_directory}" >&2
  exit 1
fi
if [[ "$(stat -f '%Lp' "${descriptor}")" != "600" ]]; then
  echo "The OPUS-owned preview descriptor is not owner-readable only." >&2
  exit 1
fi
if [[ ! -f "${log_directory}/game.window.ready" ]]; then
  echo "The OPUS-owned preview has not proved that its game window is ready." >&2
  exit 1
fi
if [[ ! -x "${injector}" ]]; then
  cargo build --manifest-path "${opus_root}/injector/Cargo.toml" --bin opus-injector
fi
if [[ ! -x "${injector}" ]]; then
  echo "OPUS injector binary is unavailable: ${injector}" >&2
  exit 1
fi

target_pid="$(sed -n 's/^pid=//p' "${descriptor}")"
if ! [[ "${target_pid}" =~ ^[1-9][0-9]*$ ]]; then
  echo "The OPUS-owned preview descriptor has no valid target pid." >&2
  exit 1
fi

live_game_log="${log_directory}/game.stdout.raw.log"
final_game_log="${log_directory}/minecraft.latest.log"

game_log_reports_failure() {
  local candidate
  for candidate in "${live_game_log}" "${final_game_log}"; do
    if [[ -f "${candidate}" ]] && rg -q \
      'Only one OpenAL context|SoundSystem did not load after|UnsatisfiedLinkError: org\.lwjgl\.openal|Unreported exception thrown!|Game crashed!' \
      "${candidate}"; then
      return 0
    fi
  done
  return 1
}

game_log_reports_normal_minecraft_shutdown() {
  local candidate
  for candidate in "${live_game_log}" "${final_game_log}"; do
    if [[ -f "${candidate}" ]] && rg -Fq 'Stopping!' "${candidate}"; then
      return 0
    fi
  done
  return 1
}

game_has_jvm_crash_marker() {
  find "${log_directory}" -maxdepth 1 -type f -name 'jvm_crash_*.log' \
    -print -quit | grep -q .
}

wait_for_preview_game_stability() {
  local deadline=$((SECONDS + startup_timeout_seconds))
  local game_status
  local sound_engine_starts

  while (( SECONDS < deadline )); do
    if ! kill -0 "${target_pid}" 2>/dev/null; then
      echo "The OPUS-owned game JVM exited before the lifecycle check began." >&2
      exit 1
    fi
    game_status="$(tr -d '\r\n' < "${log_directory}/game.status" 2>/dev/null || true)"
    if [[ "${game_status}" != "running" ]]; then
      echo "The OPUS-owned game is not running during startup stabilization: ${game_status:-missing}" >&2
      exit 1
    fi
    if game_has_jvm_crash_marker || game_log_reports_failure; then
      echo "The OPUS-owned game reported a JVM or Forge/LWJGL startup failure before lifecycle testing." >&2
      exit 1
    fi
    if [[ -f "${live_game_log}" ]]; then
      sound_engine_starts="$(rg -F -c 'Sound engine started' "${live_game_log}" || true)"
      if [[ "${sound_engine_starts}" =~ ^[0-9]+$ ]] \
        && (( sound_engine_starts >= 2 )); then
        echo "OPUS-owned preview host completed Forge/LWJGL audio startup."
        return
      fi
    fi
    sleep 0.25
  done

  echo "The OPUS-owned preview did not complete the expected Forge/LWJGL audio startup within ${startup_timeout_seconds}s." >&2
  exit 1
}

runtime_loaded=0
cleanup() {
  if (( runtime_loaded == 1 )) && [[ -f "${descriptor}" ]]; then
    "${injector}" opus-owned-client unload --descriptor "${descriptor}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

wait_for_preview_game_stability

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

run_control "OpusOwnedClientGameCloseProof" close-game \
  --descriptor "${descriptor}"

process_stopped=0
for _ in {1..120}; do
  if ! kill -0 "${target_pid}" 2>/dev/null; then
    process_stopped=1
    break
  fi
  sleep 0.25
done
if (( process_stopped == 0 )); then
  echo "The OPUS-owned game JVM did not exit after its cooperative close request." >&2
  exit 1
fi

for _ in {1..80}; do
  if [[ ! -e "${descriptor}" ]]; then
    break
  fi
  sleep 0.05
done
if [[ -e "${descriptor}" ]]; then
  echo "The OPUS-owned game left its descriptor after the cooperative close." >&2
  exit 1
fi

status="$(tr -d '\r\n' < "${log_directory}/game.status" 2>/dev/null || true)"
case "${status}" in
  exited)
    ;;
  terminated)
    # The Java 8 host's shutdown hook writes "terminated" before the JVM
    # disappears. For this cooperative close proof, accept it only when the
    # Minecraft loop logged its normal Display-driven shutdown marker.
    if ! game_log_reports_normal_minecraft_shutdown; then
      echo "The OPUS-owned game terminated without Minecraft's normal close marker." >&2
      exit 1
    fi
    ;;
  *)
    echo "The OPUS-owned game did not report a clean terminal status: ${status:-missing}" >&2
    exit 1
    ;;
esac
if game_has_jvm_crash_marker || game_log_reports_failure; then
  echo "The OPUS-owned game wrote a JVM or Forge/LWJGL crash marker during the lifecycle check." >&2
  exit 1
fi

trap - EXIT
echo "OPUS-owned M3 cooperative game-close lifecycle passed; the Minecraft close path exited without a process signal, JVM crash marker, or Forge/LWJGL crash report."
