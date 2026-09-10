#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "opus-owned-client" ]]; then
  echo "Expected opus-owned-client command." >&2
  exit 64
fi
operation="${2:-}"
shift 2

descriptor=""
while (($# > 0)); do
  case "$1" in
    --descriptor)
      descriptor="${2:-}"
      shift 2
      ;;
    --runtime|--expect-state)
      shift 2
      ;;
    *)
      echo "Unexpected fake injector option: $1" >&2
      exit 64
      ;;
  esac
done

if [[ -z "${descriptor}" ]]; then
  echo "Fake injector requires a descriptor." >&2
  exit 64
fi

case "${operation}" in
  health)
    echo "[OPUS/INJECTOR] phase=load-transport code=OpusOwnedClientSurvivalProof message=fake=true"
    ;;
  load)
    echo "[OPUS/INJECTOR] phase=load-transport code=OpusOwnedClientLoadProof message=fake=true"
    ;;
  unload)
    echo "[OPUS/INJECTOR] phase=unload-transport code=OpusOwnedClientUnloadProof message=fake=true"
    ;;
  stop)
    rm -f -- "${descriptor}"
    echo "[OPUS/INJECTOR] phase=unload-transport code=OpusOwnedClientStopProof message=fake=true"
    ;;
  *)
    echo "Unexpected fake injector operation: ${operation}" >&2
    exit 64
    ;;
esac
