#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -gt 1 ]] || [[ "$#" -eq 1 && "$1" != "--print-home" ]]; then
  echo "Usage: $0 [--print-home]" >&2
  exit 1
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "The pinned injector test JDK is a macOS x86_64 toolchain." >&2
  exit 1
fi

for required_command in curl shasum tar awk; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "Missing required command: ${required_command}" >&2
    exit 1
  fi
done

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
toolchain_lock="${opus_root}/runtime/legacy/1.8.9/client/toolchain.lock"
if [[ ! -f "${toolchain_lock}" ]]; then
  echo "Pinned Java 8 toolchain lock is missing: ${toolchain_lock}" >&2
  exit 1
fi

read_lock_value() {
  local key="$1"
  local value
  value="$(
    awk -F '=' -v requested_key="${key}" '
      $1 == requested_key {
        sub(/^[^=]*=/, "", $0)
        print
        exit
      }
    ' "${toolchain_lock}"
  )"
  if [[ -z "${value}" ]]; then
    echo "Missing ${key} in ${toolchain_lock}" >&2
    exit 1
  fi
  printf '%s' "${value}"
}

expected_major="$(read_lock_value orchestrator.java.major)"
jdk_version="$(read_lock_value orchestrator.java.version)"
jdk_url="$(read_lock_value orchestrator.java.url)"
expected_sha256="$(read_lock_value orchestrator.java.sha256)"
if [[ "${expected_major}" != "8" ]] || [[ ! "${expected_sha256}" =~ ^[0-9a-f]{64}$ ]]; then
  echo "The pinned toolchain lock does not describe a valid Java 8 archive." >&2
  exit 1
fi

cache_root="${OPUS_INJECTOR_TEST_TOOLCHAIN_DIR:-${opus_root}/output/injector-test-toolchains}"
archive_name="${jdk_url##*/}"
archive_path="${cache_root}/${archive_name}"
jdk_root="${cache_root}/jdk${jdk_version}"
jdk_home="${jdk_root}/Contents/Home"
java_binary="${jdk_home}/bin/java"
javac_binary="${jdk_home}/bin/javac"
partial_archive=""

cleanup_partial() {
  if [[ -n "${partial_archive}" ]] && [[ -f "${partial_archive}" ]]; then
    rm -f -- "${partial_archive}"
  fi
}
trap cleanup_partial EXIT

umask 077
mkdir -p "${cache_root}"

if [[ ! -f "${archive_path}" ]]; then
  partial_archive="${archive_path}.part.$$"
  printf 'Downloading pinned x86_64 Java 8 test JDK: %s\n' "${jdk_version}" >&2
  curl --fail --location --proto '=https' --tlsv1.2 --silent --show-error \
    --output "${partial_archive}" \
    "${jdk_url}"
  downloaded_sha256="$(shasum -a 256 "${partial_archive}" | awk '{print $1}')"
  if [[ "${downloaded_sha256}" != "${expected_sha256}" ]]; then
    echo "Downloaded Java 8 JDK archive did not match the pinned SHA-256." >&2
    exit 1
  fi
  mv "${partial_archive}" "${archive_path}"
  partial_archive=""
fi

archive_sha256="$(shasum -a 256 "${archive_path}" | awk '{print $1}')"
if [[ "${archive_sha256}" != "${expected_sha256}" ]]; then
  echo "Cached Java 8 JDK archive did not match the pinned SHA-256." >&2
  exit 1
fi

if [[ ! -e "${jdk_home}" ]]; then
  if [[ -e "${jdk_root}" ]]; then
    echo "Pinned Java 8 JDK directory is incomplete: ${jdk_root}" >&2
    exit 1
  fi
  tar -xzf "${archive_path}" -C "${cache_root}"
fi

if [[ ! -x "${java_binary}" ]] || [[ ! -x "${javac_binary}" ]]; then
  echo "Pinned Java 8 JDK is incomplete: ${jdk_home}" >&2
  exit 1
fi
if ! "${java_binary}" -version 2>&1 | grep -E 'version "1\.8\.' >/dev/null; then
  echo "Pinned JDK did not report Java 8: ${java_binary}" >&2
  exit 1
fi

java_arch_raw="$(
  "${java_binary}" -XshowSettings:properties -version 2>&1 \
    | sed -n 's/^[[:space:]]*os\.arch = //p' \
    | head -n 1
)"
case "${java_arch_raw}" in
  amd64|x86_64)
    ;;
  *)
    echo "Pinned JDK did not report x86_64: ${java_arch_raw:-unknown}" >&2
    exit 1
    ;;
esac

if [[ "${1:-}" == "--print-home" ]]; then
  printf '%s\n' "${jdk_home}"
else
  printf 'OPUS pinned x86_64 Java 8 test JDK ready: %s\n' "${jdk_home}"
fi
