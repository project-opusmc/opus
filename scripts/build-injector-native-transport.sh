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
    echo "Native transport architecture must be arm64 or x86_64: ${requested_arch}" >&2
    exit 1
    ;;
esac

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "The native transport helper is currently defined only for macOS." >&2
  exit 1
fi

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
transport_output_root="${OPUS_NATIVE_TRANSPORT_OUTPUT_ROOT:-${opus_root}/output/injector-native-transport}"
build_dir="${transport_output_root}/${requested_arch}"

cmake \
  --fresh \
  -S "${opus_root}/injector-native" \
  -B "${build_dir}" \
  -DCMAKE_BUILD_TYPE=Debug \
  -DOPUS_TRANSPORT_TARGET_ARCH="${requested_arch}"
cmake --build "${build_dir}" \
  --target \
    opus-macos-transport \
    opus-task-port-probe-target \
    opus-task-port-vm-read-probe \
    opus-task-port-vm-rw-probe \
    opus-remote-loader-probe \
    opus-bootstrap \
    opus-bootstrap-host \
  --parallel

transport_binary="${build_dir}/opus-macos-transport"
probe_target_binary="${build_dir}/opus-task-port-probe-target"
vm_read_probe_binary="${build_dir}/opus-task-port-vm-read-probe"
vm_rw_probe_binary="${build_dir}/opus-task-port-vm-rw-probe"
probe_runtime_library="${build_dir}/libopus-remote-loader-probe.dylib"
bootstrap_library="${build_dir}/libopus-bootstrap.dylib"
bootstrap_host_binary="${build_dir}/opus-bootstrap-host"
if [[ ! -x "${transport_binary}" ]]; then
  echo "Native transport helper is missing: ${transport_binary}" >&2
  exit 1
fi
if [[ ! -x "${probe_target_binary}" ]]; then
  echo "Native transport probe target is missing: ${probe_target_binary}" >&2
  exit 1
fi
if [[ ! -x "${vm_read_probe_binary}" ]]; then
  echo "Native transport VM-read probe is missing: ${vm_read_probe_binary}" >&2
  exit 1
fi
if [[ ! -x "${vm_rw_probe_binary}" ]]; then
  echo "Native transport VM-RW probe is missing: ${vm_rw_probe_binary}" >&2
  exit 1
fi
if [[ ! -f "${probe_runtime_library}" ]]; then
  echo "Native transport probe runtime is missing: ${probe_runtime_library}" >&2
  exit 1
fi
if [[ ! -f "${bootstrap_library}" ]]; then
  echo "Gate 6 bootstrap library is missing: ${bootstrap_library}" >&2
  exit 1
fi
if [[ ! -x "${bootstrap_host_binary}" ]]; then
  echo "Gate 6 bootstrap host is missing: ${bootstrap_host_binary}" >&2
  exit 1
fi

transport_architectures="$(lipo -archs "${transport_binary}")"
if [[ " ${transport_architectures} " != *" ${requested_arch} "* ]]; then
  echo "Native transport helper architecture mismatch: expected ${requested_arch}, got ${transport_architectures}" >&2
  exit 1
fi

probe_target_architectures="$(lipo -archs "${probe_target_binary}")"
if [[ " ${probe_target_architectures} " != *" ${requested_arch} "* ]]; then
  echo "Native transport probe target architecture mismatch: expected ${requested_arch}, got ${probe_target_architectures}" >&2
  exit 1
fi

vm_read_probe_architectures="$(lipo -archs "${vm_read_probe_binary}")"
if [[ " ${vm_read_probe_architectures} " != *" ${requested_arch} "* ]]; then
  echo "Native transport VM-read probe architecture mismatch: expected ${requested_arch}, got ${vm_read_probe_architectures}" >&2
  exit 1
fi

vm_rw_probe_architectures="$(lipo -archs "${vm_rw_probe_binary}")"
if [[ " ${vm_rw_probe_architectures} " != *" ${requested_arch} "* ]]; then
  echo "Native transport VM-RW probe architecture mismatch: expected ${requested_arch}, got ${vm_rw_probe_architectures}" >&2
  exit 1
fi

probe_runtime_architectures="$(lipo -archs "${probe_runtime_library}")"
if [[ " ${probe_runtime_architectures} " != *" ${requested_arch} "* ]]; then
  echo "Native transport probe runtime architecture mismatch: expected ${requested_arch}, got ${probe_runtime_architectures}" >&2
  exit 1
fi

bootstrap_library_architectures="$(lipo -archs "${bootstrap_library}")"
if [[ " ${bootstrap_library_architectures} " != *" ${requested_arch} "* ]]; then
  echo "Gate 6 bootstrap library architecture mismatch: expected ${requested_arch}, got ${bootstrap_library_architectures}" >&2
  exit 1
fi

bootstrap_host_architectures="$(lipo -archs "${bootstrap_host_binary}")"
if [[ " ${bootstrap_host_architectures} " != *" ${requested_arch} "* ]]; then
  echo "Gate 6 bootstrap host architecture mismatch: expected ${requested_arch}, got ${bootstrap_host_architectures}" >&2
  exit 1
fi

codesign --force --sign - \
  --entitlements "${opus_root}/injector-native/entitlements/debugger-helper.plist" \
  "${transport_binary}"
codesign --force --sign - \
  --entitlements "${opus_root}/injector-native/entitlements/debug-target.plist" \
  "${probe_target_binary}"
codesign --force --sign - \
  --entitlements "${opus_root}/injector-native/entitlements/debug-target.plist" \
  "${vm_read_probe_binary}"
codesign --force --sign - \
  --entitlements "${opus_root}/injector-native/entitlements/debug-target.plist" \
  "${vm_rw_probe_binary}"
codesign --force --sign - "${probe_runtime_library}"
codesign --force --sign - "${bootstrap_library}"
codesign --force --sign - "${bootstrap_host_binary}"

printf 'OPUS native transport helper built: requested_arch=%s helper_arch=%s probe_target_arch=%s vm_read_probe_arch=%s vm_rw_probe_arch=%s probe_runtime_arch=%s bootstrap_arch=%s bootstrap_host_arch=%s\n' \
  "${requested_arch}" \
  "${transport_architectures}" \
  "${probe_target_architectures}" \
  "${vm_read_probe_architectures}" \
  "${vm_rw_probe_architectures}" \
  "${probe_runtime_architectures}" \
  "${bootstrap_library_architectures}" \
  "${bootstrap_host_architectures}"
