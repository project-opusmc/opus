#!/usr/bin/env bash
set -euo pipefail

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="${opus_root}/output/injector-foundation"
target_java_home="${OPUS_INJECTOR_JAVA_HOME:-${JAVA_HOME:-}}"

if [[ -z "${target_java_home}" ]] && [[ "$(uname -s)" == "Darwin" ]]; then
  target_java_home="$(/usr/libexec/java_home)"
fi

if [[ -z "${target_java_home}" ]] || [[ ! -x "${target_java_home}/bin/java" ]]; then
  echo "Set OPUS_INJECTOR_JAVA_HOME to a JDK home for the target JVM architecture." >&2
  exit 1
fi

target_java="${target_java_home}/bin/java"
target_arch_raw="$(
  "${target_java}" -XshowSettings:properties -version 2>&1 \
    | sed -n 's/^[[:space:]]*os\.arch = //p' \
    | head -n 1
)"
target_java_version="$(
  "${target_java}" -XshowSettings:properties -version 2>&1 \
    | sed -n 's/^[[:space:]]*java\.version = //p' \
    | head -n 1
)"

case "${target_arch_raw}" in
  amd64|x86_64)
    detected_arch="x86_64"
    ;;
  aarch64|arm64)
    detected_arch="arm64"
    ;;
  *)
    echo "Unsupported target JVM architecture: ${target_arch_raw:-unknown}" >&2
    exit 1
    ;;
esac

requested_arch="${OPUS_RUNTIME_TARGET_ARCH:-${detected_arch}}"
if [[ "${requested_arch}" == "auto" ]]; then
  requested_arch="${detected_arch}"
fi
if [[ "${requested_arch}" == "universal" ]]; then
  echo "A universal dylib requires one same-architecture JVM proof per slice; run this check once for arm64 and once for x86_64." >&2
  exit 1
fi
if [[ "${requested_arch}" != "${detected_arch}" ]]; then
  echo "JDK architecture ${detected_arch} cannot certify requested runtime architecture ${requested_arch}." >&2
  exit 1
fi

cmake -E remove_directory "${build_dir}"

JAVA_HOME="${target_java_home}" cmake \
  -S "${opus_root}/runtime-native" \
  -B "${build_dir}" \
  -DCMAKE_BUILD_TYPE=Debug \
  -DOPUS_RUNTIME_TARGET_ARCH="${requested_arch}"
cmake --build "${build_dir}" --parallel
ctest --test-dir "${build_dir}" --output-on-failure

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

printf 'OPUS injector foundation passed: java=%s java_arch=%s runtime_arch=%s\n' \
  "${target_java_version}" \
  "${detected_arch}" \
  "${runtime_architectures}"
