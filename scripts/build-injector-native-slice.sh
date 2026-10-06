#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 1 ]]; then
  echo "Usage: $0 <arm64|x86_64>" >&2
  exit 1
fi

requested_arch="$1"
case "${requested_arch}" in
  arm64|x86_64)
    ;;
  *)
    echo "Native slice architecture must be arm64 or x86_64: ${requested_arch}" >&2
    exit 1
    ;;
esac

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Native Mach-O slice builds are currently defined only for macOS." >&2
  exit 1
fi

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target_java_home="${OPUS_INJECTOR_JAVA_HOME:-${JAVA_HOME:-}}"
if [[ -z "${target_java_home}" ]]; then
  target_java_home="$(/usr/libexec/java_home)"
fi
if [[ ! -x "${target_java_home}/bin/java" ]]; then
  echo "Set OPUS_INJECTOR_JAVA_HOME to a usable JDK home." >&2
  exit 1
fi

slice_output_root="${OPUS_NATIVE_SLICE_OUTPUT_ROOT:-${opus_root}/output/injector-native-slices}"
build_dir="${slice_output_root}/${requested_arch}"

JAVA_HOME="${target_java_home}" cmake \
  --fresh \
  -S "${opus_root}/runtime-native" \
  -B "${build_dir}" \
  -DCMAKE_BUILD_TYPE=Debug \
  -DOPUS_RUNTIME_TARGET_ARCH="${requested_arch}"
cmake --build "${build_dir}" --target opus-runtime --parallel

runtime_library="${build_dir}/libopus-runtime.dylib"
if [[ ! -f "${runtime_library}" ]]; then
  echo "Native runtime library is missing: ${runtime_library}" >&2
  exit 1
fi

runtime_architectures="$(lipo -archs "${runtime_library}")"
if [[ " ${runtime_architectures} " != *" ${requested_arch} "* ]]; then
  echo "Native runtime architecture mismatch: expected ${requested_arch}, got ${runtime_architectures}" >&2
  exit 1
fi

printf 'OPUS native slice built: requested_arch=%s runtime_arch=%s\n' \
  "${requested_arch}" \
  "${runtime_architectures}"
