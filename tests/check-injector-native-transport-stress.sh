#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "OPUS native transport stress harness is macOS-only; skipped."
  exit 0
fi

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cycles="${OPUS_NATIVE_TRANSPORT_STRESS_CYCLES:-20}"
rounds="${OPUS_NATIVE_TRANSPORT_STRESS_ROUNDS:-3}"

if ! [[ "${cycles}" =~ ^[0-9]+$ ]] || (( cycles < 3 || cycles > 20 )); then
  echo "OPUS_NATIVE_TRANSPORT_STRESS_CYCLES must be an integer from 3 through 20." >&2
  exit 1
fi
if ! [[ "${rounds}" =~ ^[0-9]+$ ]] || (( rounds < 1 || rounds > 10 )); then
  echo "OPUS_NATIVE_TRANSPORT_STRESS_ROUNDS must be an integer from 1 through 10." >&2
  exit 1
fi

for ((round = 1; round <= rounds; round++)); do
  output="$(
    OPUS_NATIVE_TRANSPORT_CYCLES="${cycles}" \
      "${opus_root}/tests/check-injector-native-runtime-load.sh"
  )"
  printf '%s\n' "${output}"
  if ! printf '%s\n' "${output}" \
    | grep -Fq "OPUS native transport completed ${cycles} load/handshake/unload/reload cycles"; then
    echo "Native transport stress round ${round} did not complete its lifecycle proof." >&2
    exit 1
  fi
  if ! printf '%s\n' "${output}" | grep -Eq 'rss_before_kib=(unavailable|[0-9]+) rss_after_kib=(unavailable|[0-9]+) rss_delta_kib=(unavailable|-?[0-9]+)'; then
    echo "Native transport stress round ${round} did not publish its RSS measurement." >&2
    exit 1
  fi
done

printf 'OPUS native transport stress harness passed: rounds=%s cycles_per_round=%s total_cycles=%s.\n' \
  "${rounds}" \
  "${cycles}" \
  "$((rounds * cycles))"
