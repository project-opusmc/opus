#!/usr/bin/env bash
set -euo pipefail

# This is a repository-only reproduction path. It deletes only the exact
# generated directories listed below, then runs the complete injector-
# development suite against its own cooperative/owned fixtures. It never
# discovers, selects, or interacts with a third-party process.

if [[ "$#" -ne 0 ]]; then
  echo "Usage: $0" >&2
  exit 2
fi

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
repository_root="$(git -C "${opus_root}" rev-parse --show-toplevel)"
if [[ "${repository_root}" != "${opus_root}" ]]; then
  echo "Refusing clean reproduction outside the repository root." >&2
  exit 2
fi

generated_directories=(
  "${opus_root}/output"
  "${opus_root}/injector/target"
  "${opus_root}/runtime-java/build"
  "${opus_root}/launcher/target"
)

is_allowed_generated_directory() {
  local candidate="$1"
  case "${candidate}" in
    "${opus_root}/output" | \
    "${opus_root}/injector/target" | \
    "${opus_root}/runtime-java/build" | \
    "${opus_root}/launcher/target")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

for generated_directory in "${generated_directories[@]}"; do
  if ! is_allowed_generated_directory "${generated_directory}"; then
    echo "Refusing an unrecognized generated-directory path." >&2
    exit 2
  fi
  if [[ -L "${generated_directory}" ]]; then
    echo "Refusing to delete generated-directory symlink: ${generated_directory}" >&2
    exit 2
  fi
  if [[ -e "${generated_directory}" && ! -d "${generated_directory}" ]]; then
    echo "Expected generated directory is not a directory: ${generated_directory}" >&2
    exit 2
  fi
done

for generated_directory in "${generated_directories[@]}"; do
  if [[ -d "${generated_directory}" ]]; then
    printf 'Removing generated build directory: %s\n' "${generated_directory}"
    cmake -E remove_directory "${generated_directory}"
  else
    printf 'Generated build directory already absent: %s\n' "${generated_directory}"
  fi
done

run_timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
run_id="m3-gate6-owned-clean-$(date -u +%Y%m%dT%H%M%SZ)-$$"
evidence_root="${opus_root}/output/m3-gate-6/owned-clean-reproduction"
evidence_dir="${evidence_root}/${run_id}"
gate6_evidence_root="${evidence_dir}/gate6-witnesses"
full_check_log="${evidence_dir}/full-check.log"
manifest_path="${evidence_dir}/clean-reproduction-manifest.json"
checksums_path="${evidence_dir}/checksums.sha256"
full_check_status="NOT_RUN"

mkdir -p -m 700 "${evidence_dir}"

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

emit_manifest() {
  local exit_status="$1"
  local finished_at
  local worktree_state
  local staged_state
  local helper_sha256="UNAVAILABLE"
  local bootstrap_sha256="UNAVAILABLE"
  local bootstrap_host_sha256="UNAVAILABLE"
  local gate6_harness_run_id="UNAVAILABLE"
  local gate6_harness_manifest="UNAVAILABLE"

  finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [[ -n "$(git -C "${opus_root}" status --porcelain)" ]]; then
    worktree_state="dirty"
  else
    worktree_state="clean"
  fi
  if git -C "${opus_root}" diff --cached --quiet; then
    staged_state="clean"
  else
    staged_state="staged-changes-present"
  fi

  if [[ -f "${opus_root}/output/injector-native-transport/arm64/opus-macos-transport" ]]; then
    helper_sha256="$(
      shasum -a 256 \
        "${opus_root}/output/injector-native-transport/arm64/opus-macos-transport" \
        | awk '{print $1}'
    )"
  fi
  if [[ -f "${opus_root}/output/injector-native-transport/arm64/libopus-bootstrap.dylib" ]]; then
    bootstrap_sha256="$(
      shasum -a 256 \
        "${opus_root}/output/injector-native-transport/arm64/libopus-bootstrap.dylib" \
        | awk '{print $1}'
    )"
  fi
  if [[ -f "${opus_root}/output/injector-native-transport/arm64/opus-bootstrap-host" ]]; then
    bootstrap_host_sha256="$(
      shasum -a 256 \
        "${opus_root}/output/injector-native-transport/arm64/opus-bootstrap-host" \
        | awk '{print $1}'
    )"
  fi

  if [[ -d "${gate6_evidence_root}" ]]; then
    local discovered_manifest
    discovered_manifest="$(
      find "${gate6_evidence_root}" \
        -mindepth 2 \
        -maxdepth 2 \
        -type f \
        -name manifest.json \
        -print \
        | sort \
        | head -n 1
    )"
    if [[ -n "${discovered_manifest}" ]]; then
      gate6_harness_manifest="${discovered_manifest}"
      gate6_harness_run_id="$(
        sed -n 's/^  "run_id": "\(.*\)",$/\1/p' "${discovered_manifest}" \
          | head -n 1
      )"
      if [[ -z "${gate6_harness_run_id}" ]]; then
        gate6_harness_run_id="UNAVAILABLE"
      fi
    fi
  fi

  {
    printf '{\n'
    printf '  "schema": "opus.m3.gate6.owned-clean-reproduction.v1",\n'
    printf '  "created_at": "%s",\n' "${run_timestamp}"
    printf '  "finished_at": "%s",\n' "${finished_at}"
    printf '  "run_id": "%s",\n' "$(json_escape "${run_id}")"
    printf '  "scope": "opus-owned-and-cooperative-fixtures-only",\n'
    printf '  "live_gate_6_interaction": false,\n'
    printf '  "historical_pid_used": false,\n'
    printf '  "source": {\n'
    printf '    "branch": "%s",\n' "$(json_escape "$(git -C "${opus_root}" branch --show-current)")"
    printf '    "head": "%s",\n' "$(git -C "${opus_root}" rev-parse HEAD)"
    printf '    "worktree_state": "%s",\n' "${worktree_state}"
    printf '    "staged_state": "%s"\n' "${staged_state}"
    printf '  },\n'
    printf '  "cleaned_generated_directories": [\n'
    printf '    "%s",\n' "$(json_escape "${opus_root}/output")"
    printf '    "%s",\n' "$(json_escape "${opus_root}/injector/target")"
    printf '    "%s",\n' "$(json_escape "${opus_root}/runtime-java/build")"
    printf '    "%s"\n' "$(json_escape "${opus_root}/launcher/target")"
    printf '  ],\n'
    printf '  "output_reused": false,\n'
    printf '  "command": "./scripts/check.sh",\n'
    printf '  "full_check_status": "%s",\n' "${full_check_status}"
    printf '  "exit_code": %s,\n' "${exit_status}"
    printf '  "gate6_harness": {\n'
    printf '    "run_id": "%s",\n' "$(json_escape "${gate6_harness_run_id}")"
    printf '    "manifest": "%s"\n' "$(json_escape "${gate6_harness_manifest}")"
    printf '  },\n'
    printf '  "artifact_identities": [\n'
    printf '    {\n'
    printf '      "run_id": "%s",\n' "$(json_escape "${run_id}")"
    printf '      "path": "%s",\n' "$(json_escape "${opus_root}/output/injector-native-transport/arm64/opus-macos-transport")"
    printf '      "sha256": "%s"\n' "${helper_sha256}"
    printf '    },\n'
    printf '    {\n'
    printf '      "run_id": "%s",\n' "$(json_escape "${run_id}")"
    printf '      "path": "%s",\n' "$(json_escape "${opus_root}/output/injector-native-transport/arm64/libopus-bootstrap.dylib")"
    printf '      "sha256": "%s"\n' "${bootstrap_sha256}"
    printf '    },\n'
    printf '    {\n'
    printf '      "run_id": "%s",\n' "$(json_escape "${run_id}")"
    printf '      "path": "%s",\n' "$(json_escape "${opus_root}/output/injector-native-transport/arm64/opus-bootstrap-host")"
    printf '      "sha256": "%s"\n' "${bootstrap_host_sha256}"
    printf '    }\n'
    printf '  ]\n'
    printf '}\n'
  } >"${manifest_path}"

  (
    cd "${evidence_dir}"
    for witness_path in \
      full-check.log \
      clean-reproduction-manifest.json; do
      if [[ -f "${witness_path}" ]]; then
        shasum -a 256 "${witness_path}"
      fi
    done >"${checksums_path}"
  )
}

finalize() {
  local exit_status=$?
  trap - EXIT
  set +e
  emit_manifest "${exit_status}"
  exit "${exit_status}"
}
trap finalize EXIT

full_check_status="RUNNING"
set +e
(
  cd "${opus_root}"
  OPUS_GATE6_EVIDENCE_ROOT="${gate6_evidence_root}" ./scripts/check.sh
) 2>&1 | tee "${full_check_log}"
pipeline_status=("${PIPESTATUS[@]}")
full_check_exit="${pipeline_status[0]}"
tee_exit="${pipeline_status[1]}"
set -e

if [[ "${full_check_exit}" -ne 0 || "${tee_exit}" -ne 0 ]]; then
  full_check_status="FAILED"
  echo "OPUS M3 Gate 6 owned-harness clean reproduction failed." >&2
  if [[ "${full_check_exit}" -ne 0 ]]; then
    exit "${full_check_exit}"
  fi
  exit "${tee_exit}"
fi

full_check_status="PASS"
printf 'OPUS M3 Gate 6 owned-harness clean reproduction passed: run_id=%s evidence_dir=%s\n' \
  "${run_id}" \
  "${evidence_dir}"
