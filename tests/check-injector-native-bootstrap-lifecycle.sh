#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "OPUS Gate 6 bootstrap lifecycle proof is macOS-only; skipped."
  exit 0
fi

opus_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$(uname -m)" in
  arm64)
    host_arch="arm64"
    ;;
  x86_64)
    echo "OPUS Gate 6 bootstrap lifecycle proof requires an arm64 host; skipped."
    exit 0
    ;;
  *)
    echo "Unsupported macOS host architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

bootstrap="${opus_root}/output/injector-native-transport/${host_arch}/libopus-bootstrap.dylib"
bootstrap_host="${opus_root}/output/injector-native-transport/${host_arch}/opus-bootstrap-host"
"${opus_root}/scripts/build-injector-native-transport.sh" "${host_arch}"

for artifact_path in "${bootstrap}" "${bootstrap_host}"; do
  artifact_architectures="$(lipo -archs "${artifact_path}")"
  if [[ " ${artifact_architectures} " != *" arm64 "* ]]; then
    echo "Gate 6 artifact architecture mismatch: ${artifact_path} is ${artifact_architectures}" >&2
    exit 1
  fi
done

evidence_root="${OPUS_GATE6_EVIDENCE_ROOT:-${opus_root}/output/m3-gate-6}"
if [[ "${evidence_root}" != /* ]]; then
  echo "OPUS_GATE6_EVIDENCE_ROOT must be an absolute path when set." >&2
  exit 1
fi
run_timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
run_id="bootstrap-lifecycle-$(date -u +%Y%m%dT%H%M%SZ)-$$"
evidence_dir="${evidence_root}/${run_id}"
mkdir -p -m 700 "${evidence_dir}"

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

branch="$(git -C "${opus_root}" branch --show-current)"
head="$(git -C "${opus_root}" rev-parse HEAD)"
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
bootstrap_sha256="$(shasum -a 256 "${bootstrap}" | awk '{print $1}')"
bootstrap_host_sha256="$(shasum -a 256 "${bootstrap_host}" | awk '{print $1}')"
bootstrap_size="$(stat -f '%z' "${bootstrap}")"
bootstrap_host_size="$(stat -f '%z' "${bootstrap_host}")"
bootstrap_architectures="$(lipo -archs "${bootstrap}")"
bootstrap_host_architectures="$(lipo -archs "${bootstrap_host}")"
events_path="${evidence_dir}/lifecycle-events.jsonl"
: >"${events_path}"

codesign -dv --verbose=4 "${bootstrap}" \
  >"${evidence_dir}/codesign-bootstrap.log" 2>&1
codesign -dv --verbose=4 "${bootstrap_host}" \
  >"${evidence_dir}/codesign-host.log" 2>&1
file -b "${bootstrap}" >"${evidence_dir}/file-bootstrap.log"
file -b "${bootstrap_host}" >"${evidence_dir}/file-host.log"
otool -D "${bootstrap}" >"${evidence_dir}/otool-bootstrap-id.log"
nm -gU "${bootstrap}" >"${evidence_dir}/nm-bootstrap-exports.log"

for expected_symbol in _opus_bootstrap_start _opus_bootstrap_stop; do
  if ! grep -Fq "${expected_symbol}" "${evidence_dir}/nm-bootstrap-exports.log"; then
    echo "Gate 6 bootstrap is missing export ${expected_symbol}." >&2
    exit 1
  fi
done

bootstrap_signature="$(sed -n 's/^Signature=//p' "${evidence_dir}/codesign-bootstrap.log" | head -n 1)"
bootstrap_identifier="$(sed -n 's/^Identifier=//p' "${evidence_dir}/codesign-bootstrap.log" | head -n 1)"
bootstrap_team_identifier="$(sed -n 's/^TeamIdentifier=//p' "${evidence_dir}/codesign-bootstrap.log" | head -n 1)"
bootstrap_install_name="$(sed -n '2p' "${evidence_dir}/otool-bootstrap-id.log")"
if [[ -z "${bootstrap_signature}" || -z "${bootstrap_install_name}" ]]; then
  echo "Gate 6 bootstrap identity witness is incomplete." >&2
  exit 1
fi

{
  printf '{\n'
  printf '  "schema": "opus.m3.gate6.artifact-identity.v1",\n'
  printf '  "created_at": "%s",\n' "${run_timestamp}"
  printf '  "run_id": "%s",\n' "$(json_escape "${run_id}")"
    printf '  "bootstrap": {\n'
    printf '    "path": "%s",\n' "$(json_escape "${bootstrap}")"
  printf '    "sha256": "%s",\n' "${bootstrap_sha256}"
  printf '    "size_bytes": %s,\n' "${bootstrap_size}"
  printf '    "architectures": "%s",\n' "$(json_escape "${bootstrap_architectures}")"
  printf '    "signature": "%s",\n' "$(json_escape "${bootstrap_signature}")"
  printf '    "identifier": "%s",\n' "$(json_escape "${bootstrap_identifier}")"
  printf '    "team_identifier": "%s",\n' "$(json_escape "${bootstrap_team_identifier}")"
  printf '    "install_name": "%s",\n' "$(json_escape "${bootstrap_install_name}")"
  printf '    "start_symbol": "opus_bootstrap_start",\n'
    printf '    "stop_symbol": "opus_bootstrap_stop"\n'
  printf '  },\n'
  printf '  "host": {\n'
  printf '    "path": "%s",\n' "$(json_escape "${bootstrap_host}")"
  printf '    "sha256": "%s",\n' "${bootstrap_host_sha256}"
  printf '    "size_bytes": %s,\n' "${bootstrap_host_size}"
  printf '    "architectures": "%s"\n' "$(json_escape "${bootstrap_host_architectures}")"
  printf '  },\n'
  printf '  "abi": {\n'
  printf '    "magic": "0x4f505336",\n'
  printf '    "version": 1,\n'
  printf '    "handshake_algorithm": "rotate-xor-v1"\n'
  printf '  },\n'
  printf '  "source": {\n'
  printf '    "branch": "%s",\n' "$(json_escape "${branch}")"
  printf '    "head": "%s",\n' "${head}"
  printf '    "worktree_state": "%s",\n' "${worktree_state}"
  printf '    "staged_state": "%s",\n' "${staged_state}"
  printf '    "build_command": "scripts/build-injector-native-transport.sh arm64"\n'
  printf '  }\n'
  printf '}\n'
} >"${evidence_dir}/artifact-identity.json"

{
  printf '{\n'
  printf '  "schema": "opus.m3.gate6.run-manifest.v1",\n'
  printf '  "created_at": "%s",\n' "${run_timestamp}"
  printf '  "run_id": "%s",\n' "$(json_escape "${run_id}")"
  printf '  "scope": "opus-owned-host-only",\n'
  printf '  "architecture": "arm64",\n'
  printf '  "artifact_identity": "artifact-identity.json",\n'
  printf '  "lifecycle_events": "lifecycle-events.jsonl",\n'
  printf '  "normalized_session": "gate6-session.json",\n'
  printf '  "general_evaluation": "general-gate6-evaluation.json",\n'
  printf '  "stages": [1, 3, 10, 25],\n'
  printf '  "raw_witnesses": [\n'
  printf '    "host-stdout-*.log",\n'
  printf '    "host-stderr-*.log",\n'
  printf '    "codesign-bootstrap.log",\n'
  printf '    "codesign-host.log",\n'
  printf '    "otool-bootstrap-id.log",\n'
  printf '    "nm-bootstrap-exports.log",\n'
  printf '    "host-stdout-invalid.log",\n'
    printf '    "host-stderr-invalid.log",\n'
    printf '    "artifact-hash-drift.json",\n'
    printf '    "host-stdout-hash-drift.log",\n'
    printf '    "host-stderr-hash-drift.log",\n'
    printf '    "general-gate6-evaluation.json",\n'
    printf '    "general-gate6-evaluation.stdout.log",\n'
    printf '    "cleanup.json",\n'
  printf '    "checksums.sha256"\n'
  printf '  ]\n'
  printf '}\n'
} >"${evidence_dir}/manifest.json"

write_cleanup_record() {
  local exit_code="$1"
  local cleanup_value=false
  if [[ "${gate6_complete}" == true && "${exit_code}" -eq 0 ]]; then
    cleanup_value=true
  fi
  {
    printf '{\n'
    printf '  "schema": "opus.m3.gate6.cleanup.v1",\n'
    printf '  "run_id": "%s",\n' "$(json_escape "${run_id}")"
    printf '  "cleanup": %s,\n' "${cleanup_value}"
    printf '  "host_processes": "none-left-running",\n'
    printf '  "exit_code": %s\n' "${exit_code}"
    printf '}\n'
  } >"${evidence_dir}/cleanup.json"
  (
    cd "${evidence_dir}"
    for witness_path in \
      artifact-identity.json \
      manifest.json \
      lifecycle-events.jsonl \
      host-stdout-1.log \
      host-stderr-1.log \
      host-stdout-3.log \
      host-stderr-3.log \
      host-stdout-10.log \
      host-stderr-10.log \
      host-stdout-25.log \
      host-stderr-25.log \
      host-stdout-invalid.log \
      host-stderr-invalid.log \
      artifact-hash-drift.json \
      host-stdout-hash-drift.log \
      host-stderr-hash-drift.log \
      codesign-bootstrap.log \
      codesign-host.log \
      file-bootstrap.log \
      file-host.log \
      otool-bootstrap-id.log \
      nm-bootstrap-exports.log \
      gate6-session.json \
      general-gate6-evaluation.json \
      general-gate6-evaluation.stdout.log \
      cleanup.json; do
      if [[ -f "${witness_path}" ]]; then
        shasum -a 256 "${witness_path}"
      fi
    done >checksums.sha256
  )
}

cleanup_record() {
  local exit_code=$?
  set +e
  write_cleanup_record "${exit_code}"
  exit "${exit_code}"
}

gate6_complete=false
trap cleanup_record EXIT

verify_artifact_identity() {
  local current_bootstrap_sha256
  local current_bootstrap_host_sha256
  current_bootstrap_sha256="$(shasum -a 256 "${bootstrap}" | awk '{print $1}')"
  current_bootstrap_host_sha256="$(shasum -a 256 "${bootstrap_host}" | awk '{print $1}')"
  if [[ "${current_bootstrap_sha256}" != "${bootstrap_sha256}" ]]; then
    echo "Gate 6 bootstrap artifact identity changed during the ladder." >&2
    exit 1
  fi
  if [[ "${current_bootstrap_host_sha256}" != "${bootstrap_host_sha256}" ]]; then
    echo "Gate 6 bootstrap host artifact identity changed during the ladder." >&2
    exit 1
  fi
}

run_stage() {
  local iterations="$1"
  local expected_code="$2"
  local expected_state="$3"
  local stdout_path="${evidence_dir}/host-stdout-${iterations}.log"
  local stderr_path="${evidence_dir}/host-stderr-${iterations}.log"
  verify_artifact_identity
  if ! "${bootstrap_host}" \
    --bootstrap "${bootstrap}" \
    --bootstrap-sha256 "${bootstrap_sha256}" \
    --iterations "${iterations}" \
    --session-nonce 0x4f50555347415436 \
    --run-id "${run_id}" \
    --events-file "${events_path}" \
    >"${stdout_path}" 2>"${stderr_path}"; then
    echo "Gate 6 bootstrap lifecycle stage ${iterations} failed." >&2
    sed -n '1,160p' "${stdout_path}" >&2
    sed -n '1,160p' "${stderr_path}" >&2
    exit 1
  fi
  verify_artifact_identity

  for expected in \
    "code=${expected_code}" \
    "state=${expected_state}" \
    'architecture=arm64' \
    'bootstrap_architecture=arm64' \
    'artifact_identity=verified' \
    'handshake_verified=true' \
    'stop_acknowledged=true' \
    'cleanup=true' \
    'dlclose_return=0' \
    'host_alive=true' \
    "iterations_completed=${iterations}" \
    "iterations_requested=${iterations}" \
    "iteration=${iterations}/${iterations}"; do
    if ! grep -Fq "${expected}" "${stdout_path}"; then
      echo "Gate 6 bootstrap lifecycle stage ${iterations} did not publish ${expected}." >&2
      sed -n '1,160p' "${stdout_path}" >&2
      exit 1
    fi
  done
}

run_stage 1 BootstrapLoadObserved BootstrapLoadObserved
run_stage 3 BootstrapLoadObserved BootstrapLoadObserved
run_stage 10 BootstrapLoadObserved BootstrapLoadObserved
run_stage 25 BootstrapLoadReady BootstrapLoadReady

for expected_event in \
  '"event":"TargetResolved"' \
  '"event":"TransportReady"' \
  '"event":"ArtifactVerified"' \
  '"event":"BootstrapModuleLoaded"' \
  '"event":"BootstrapEntrypointReady"' \
  '"event":"BootstrapStartPending"' \
  '"event":"BootstrapStarted"' \
  '"event":"BootstrapHandshakeOk"' \
  '"event":"BootstrapLoadObserved"' \
  '"event":"BootstrapStopPending"' \
  '"event":"BootstrapStopped"' \
  '"event":"BootstrapUnloadPending"' \
  '"event":"BootstrapCleanedUp"' \
  '"event":"BootstrapLoadReady"'; do
  if ! grep -Fq "${expected_event}" "${events_path}"; then
    echo "Gate 6 lifecycle witness is missing ${expected_event}." >&2
    exit 1
  fi
done

set +e
"${bootstrap_host}" \
  --bootstrap "${evidence_dir}/missing-opus-bootstrap.dylib" \
  --bootstrap-sha256 "${bootstrap_sha256}" \
  --iterations 1 \
  --session-nonce 0x4f50555347415436 \
  --run-id "${run_id}-invalid" \
  --events-file "${events_path}" \
  >"${evidence_dir}/host-stdout-invalid.log" \
  2>"${evidence_dir}/host-stderr-invalid.log"
invalid_status=$?
set -e
if [[ "${invalid_status}" -eq 0 ]]; then
  echo "Gate 6 invalid-artifact path unexpectedly succeeded." >&2
  exit 1
fi
if ! grep -Fq 'code=BootstrapArtifactInvalid' "${evidence_dir}/host-stderr-invalid.log"; then
  echo "Gate 6 invalid-artifact path did not publish BootstrapArtifactInvalid." >&2
  sed -n '1,160p' "${evidence_dir}/host-stderr-invalid.log" >&2
  exit 1
fi

hash_drift_bootstrap="${evidence_dir}/artifact-hash-drift-opus-bootstrap.dylib"
cp "${bootstrap}" "${hash_drift_bootstrap}"
printf '\000' >>"${hash_drift_bootstrap}"
hash_drift_sha256="$(shasum -a 256 "${hash_drift_bootstrap}" | awk '{print $1}')"
if [[ "${hash_drift_sha256}" == "${bootstrap_sha256}" ]]; then
  echo "Gate 6 hash-drift fixture did not alter the bootstrap digest." >&2
  exit 1
fi

set +e
"${bootstrap_host}" \
  --bootstrap "${hash_drift_bootstrap}" \
  --bootstrap-sha256 "${bootstrap_sha256}" \
  --iterations 1 \
  --session-nonce 0x4f50555347415436 \
  --run-id "${run_id}-hash-drift" \
  --events-file "${events_path}" \
  >"${evidence_dir}/host-stdout-hash-drift.log" \
  2>"${evidence_dir}/host-stderr-hash-drift.log"
hash_drift_status=$?
set -e
if [[ "${hash_drift_status}" -eq 0 ]]; then
  echo "Gate 6 hash-drift fixture unexpectedly succeeded." >&2
  exit 1
fi
if ! grep -Fq 'code=BootstrapArtifactIdentityMismatch' \
  "${evidence_dir}/host-stderr-hash-drift.log"; then
  echo "Gate 6 hash-drift fixture did not publish BootstrapArtifactIdentityMismatch." >&2
  sed -n '1,160p' "${evidence_dir}/host-stderr-hash-drift.log" >&2
  exit 1
fi
if ! grep -Fq '"outcome":"BootstrapArtifactIdentityMismatch"' \
  "${events_path}"; then
  echo "Gate 6 hash-drift fixture did not retain a typed lifecycle witness." >&2
  sed -n '1,240p' "${events_path}" >&2
  exit 1
fi

{
  printf '{\n'
  printf '  "schema": "opus.m3.gate6.hash-drift.v1",\n'
  printf '  "run_id": "%s",\n' "$(json_escape "${run_id}")"
  printf '  "expected": {\n'
  printf '    "path": "%s",\n' "$(json_escape "${bootstrap}")"
  printf '    "sha256": "%s"\n' "${bootstrap_sha256}"
  printf '  },\n'
  printf '  "observed": {\n'
  printf '    "path": "%s",\n' "$(json_escape "${hash_drift_bootstrap}")"
  printf '    "sha256": "%s"\n' "${hash_drift_sha256}"
  printf '  },\n'
  printf '  "typed_outcome": "BootstrapArtifactIdentityMismatch",\n'
  printf '  "exit_code": %s\n' "${hash_drift_status}"
  printf '}\n'
} >"${evidence_dir}/artifact-hash-drift.json"

gate6_complete=true
write_cleanup_record 0

general_session_path="${evidence_dir}/gate6-session.json"
node "${opus_root}/scripts/normalize-gate6-owned-witness.mjs" \
  --profile "${opus_root}/config/gate6/profiles/opus-owned.json" \
  --evidence-dir "${evidence_dir}" \
  --output "${general_session_path}"
if ! grep -Fq '"result": "PASS"' "${general_session_path}"; then
  echo "Gate 6 normalized Branch A session did not evaluate as PASS." >&2
  sed -n '1,240p' "${general_session_path}" >&2
  exit 1
fi
node "${opus_root}/tests/verify-gate6-general-lifecycle.mjs" \
  --owned-session "${general_session_path}"

general_evaluation_path="${evidence_dir}/general-gate6-evaluation.json"
node "${opus_root}/scripts/evaluate-gate6.mjs" \
  --owned-session "${general_session_path}" \
  --output "${general_evaluation_path}" \
  >"${evidence_dir}/general-gate6-evaluation.stdout.log"
node - "${general_evaluation_path}" <<'NODE'
const { readFileSync } = require("node:fs");

const evaluationPath = process.argv.at(-1);
const evaluation = JSON.parse(readFileSync(evaluationPath, "utf8"));
const expected = [
  ["gate6", "NOT_TESTED"],
  ["branches.branch-a", "PASS"],
  ["branches.branch-b", "NOT_TESTED"],
  ["targets.opus-owned", "PASS"],
  ["targets.badlion", "NOT_TESTED"],
  ["targets.lunar", "NOT_TESTED"],
  ["owner_confirmation", "BLOCKED"],
  ["gate7_ready", false],
];

function valueAtPath(value, dottedPath) {
  return dottedPath.split(".").reduce(
    (current, key) => current === null || current === undefined
      ? undefined
      : current[key],
    value,
  );
}

for (const [path, expectedValue] of expected) {
  const actualValue = valueAtPath(evaluation, path);
  if (actualValue !== expectedValue) {
    throw new Error(
      `General Gate 6 evaluation ${path} expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`,
    );
  }
}
NODE

echo "OPUS Gate 6 bootstrap lifecycle passed through 1, 3, 10, and 25 owned-host iterations; evidence_dir=${evidence_dir}"
