#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
injector_manifest="${opus_root}/injector/Cargo.toml"
injector_binary="${opus_root}/injector/target/debug/opus-injector"
arm64_runtime="${opus_root}/output/injector-native-slices/arm64/libopus-runtime.dylib"
x86_64_runtime="${opus_root}/output/injector-native-slices/x86_64/libopus-runtime.dylib"

for required_path in "${arm64_runtime}" "${x86_64_runtime}"; do
  if [[ ! -f "${required_path}" ]]; then
    echo "Missing native runtime slice: ${required_path}" >&2
    echo "Build both slices before running the M3 preflight check." >&2
    exit 1
  fi
done

cargo build --manifest-path "${injector_manifest}" --bin opus-injector

contract_output="$("${injector_binary}" contract)"
if ! printf '%s\n' "${contract_output}" | grep -Fq 'code=M3GeneralTargetModel'; then
  echo "Injector did not report its M3 General target model." >&2
  exit 1
fi
if ! printf '%s\n' "${contract_output}" | grep -Fq 'code=HandshakeContract'; then
  echo "Injector did not report its handshake contract." >&2
  exit 1
fi
if ! printf '%s\n' "${contract_output}" | grep -Fq 'code=TransportBoundary'; then
  echo "Injector did not report its unavailable transport boundary." >&2
  exit 1
fi
if ! printf '%s\n' "${contract_output}" | grep -Fq 'code=AuthorizedTargetFixtureBoundary'; then
  echo "Injector did not report its authorized-target fixture boundary." >&2
  exit 1
fi

arm64_output="$("${injector_binary}" runtime-info --runtime "${arm64_runtime}")"
if ! printf '%s\n' "${arm64_output}" | grep -Fq 'architectures=arm64'; then
  echo "Injector did not identify the arm64 native slice." >&2
  exit 1
fi

x86_64_output="$("${injector_binary}" runtime-info --runtime "${x86_64_runtime}")"
if ! printf '%s\n' "${x86_64_output}" | grep -Fq 'architectures=x86_64'; then
  echo "Injector did not identify the x86_64 native slice." >&2
  exit 1
fi

"${injector_binary}" inspect >/dev/null
echo "OPUS M3 injector preflight integration passed."
