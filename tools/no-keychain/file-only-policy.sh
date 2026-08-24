#!/bin/zsh

# Shared, non-secret launch attestation for GUI processes. Codex Desktop may
# atomically rewrite config.toml during startup, so that file's inode mtime is
# not a reliable indication of which policy the app-server loaded.

OPUS_FILE_ONLY_POLICY_VERSION=1
# `ps lstart` is parsed below; keep its weekday/month names stable on localized
# macOS installations so a valid GUI process is never misclassified as stale.
export LC_ALL=C

opus_assert_codex_file_only_policy() {
  local config_file="$1"
  [[ -f "${config_file}" ]] \
    && rg -q '^\s*cli_auth_credentials_store\s*=\s*"file"\s*$' "${config_file}" \
    && rg -q '^\s*mcp_oauth_credentials_store\s*=\s*"file"\s*$' "${config_file}" \
    && rg -q '^\s*analytics\.enabled\s*=\s*false\s*$' "${config_file}" \
    && rg -q '^\[shell_environment_policy\]$' "${config_file}" \
    && rg -q '^\s*inherit\s*=\s*"core"\s*$' "${config_file}" \
    && rg -q '^\s*OPUS_FILE_ONLY_CREDENTIALS\s*=\s*"1"\s*$' "${config_file}" \
    && rg -q '^\s*SSH_AUTH_SOCK\s*=\s*"/dev/null"\s*$' "${config_file}" \
    && rg -q '^\s*GIT_TERMINAL_PROMPT\s*=\s*"0"\s*$' "${config_file}" \
    && rg -q '^\s*GIT_SSH_COMMAND\s*=.*BatchMode=yes.*IdentityAgent=none.*UseKeychain=no' "${config_file}" \
    && rg -q '^\s*PATH\s*=\s*"/Users/zvwgvx/Project/Opus/tools/no-keychain/bin:' "${config_file}"
}

opus_codex_file_only_policy_fingerprint() {
  local config_file="$1"
  opus_assert_codex_file_only_policy "${config_file}" || return 1
  {
    print 'cli_auth_credentials_store=file'
    print 'mcp_oauth_credentials_store=file'
    print 'analytics.enabled=false'
    print 'shell_environment_policy.inherit=core'
    print 'shell_environment_policy.OPUS_FILE_ONLY_CREDENTIALS=1'
    print 'shell_environment_policy.SSH_AUTH_SOCK=/dev/null'
    print 'shell_environment_policy.GIT_TERMINAL_PROMPT=0'
    print 'shell_environment_policy.GIT_SSH_COMMAND=batch-no-agent-no-keychain'
    print 'shell_environment_policy.PATH=opus-security-stub-first'
  } | shasum -a 256 | awk '{print $1}'
}

opus_process_started_epoch() {
  local process_pid="$1"
  local process_started
  # `ps lstart` is parsed with the C locale so a user's localized macOS
  # session cannot turn a valid start time into epoch zero.
  process_started="$(LC_ALL=C ps -o lstart= -p "${process_pid}" 2>/dev/null | sed 's/^ *//' || true)"
  LC_ALL=C date -j -f '%a %b %e %T %Y' "${process_started}" '+%s' 2>/dev/null || print 0
}

opus_process_environment_value() {
  local process_pid="$1"
  local key="$2"
  ps eww -p "${process_pid}" -o command= 2>/dev/null \
    | tr ' ' '\n' \
    | awk -F= -v key="${key}" '$1 == key {sub(/^[^=]*=/, ""); print; exit}'
}

opus_process_security_command() {
  local process_pid="$1"
  local process_path
  process_path="$(opus_process_environment_value "${process_pid}" PATH)"
  [[ -n "${process_path}" ]] || return 1
  PATH="${process_path}" command -v security 2>/dev/null
}

opus_file_only_state_file() {
  local app_name="$1"
  print "${CODEX_HOME:-${HOME}/.codex}/file-only-launch/${app_name}.state"
}

opus_write_file_only_launch_state() {
  local app_name="$1"
  local app_pid="${2:-}"
  local config_file="${CODEX_HOME:-${HOME}/.codex}/config.toml"
  local policy_fingerprint state_file state_dir prepared_epoch app_started_epoch state_tmp

  policy_fingerprint="$(opus_codex_file_only_policy_fingerprint "${config_file}")" || return 1
  state_file="$(opus_file_only_state_file "${app_name}")"
  state_dir="${state_file:h}"
  mkdir -p "${state_dir}"
  chmod 700 "${state_dir}"

  prepared_epoch="$(date '+%s')"
  app_started_epoch=""
  if [[ -n "${app_pid}" ]]; then
    app_started_epoch="$(opus_process_started_epoch "${app_pid}")"
    [[ "${app_started_epoch}" == <-> && "${app_started_epoch}" -gt 0 ]] || return 1
    prepared_epoch="${app_started_epoch}"
  fi

  state_tmp="${state_file}.tmp.$$"
  umask 077
  {
    print "version=${OPUS_FILE_ONLY_POLICY_VERSION}"
    print "app=${app_name}"
    print "prepared_epoch=${prepared_epoch}"
    print "policy_fingerprint=${policy_fingerprint}"
    if [[ -n "${app_pid}" ]]; then
      print "app_pid=${app_pid}"
      print "app_started_epoch=${app_started_epoch}"
    fi
  } > "${state_tmp}"
  chmod 600 "${state_tmp}"
  mv -f "${state_tmp}" "${state_file}"
}

opus_state_value() {
  local state_file="$1"
  local key="$2"
  awk -F= -v key="${key}" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "${state_file}" 2>/dev/null
}

opus_file_only_launch_state_matches() {
  local app_name="$1"
  local app_pid="$2"
  local config_file="${CODEX_HOME:-${HOME}/.codex}/config.toml"
  local state_file expected_fingerprint state_version state_app prepared_epoch
  local recorded_pid recorded_started_epoch actual_started_epoch

  state_file="$(opus_file_only_state_file "${app_name}")"
  [[ -f "${state_file}" && "$(stat -f '%Lp' "${state_file}" 2>/dev/null)" == "600" ]] || return 1
  expected_fingerprint="$(opus_codex_file_only_policy_fingerprint "${config_file}")" || return 1
  state_version="$(opus_state_value "${state_file}" version)"
  state_app="$(opus_state_value "${state_file}" app)"
  prepared_epoch="$(opus_state_value "${state_file}" prepared_epoch)"
  [[ "${state_version}" == "${OPUS_FILE_ONLY_POLICY_VERSION}" \
    && "${state_app}" == "${app_name}" \
    && "${prepared_epoch}" == <-> \
    && "$(opus_state_value "${state_file}" policy_fingerprint)" == "${expected_fingerprint}" ]] || return 1

  actual_started_epoch="$(opus_process_started_epoch "${app_pid}")"
  [[ "${actual_started_epoch}" == <-> \
    && "${actual_started_epoch}" -gt 0 \
    && "${actual_started_epoch}" -ge "${prepared_epoch}" ]] || return 1

  recorded_pid="$(opus_state_value "${state_file}" app_pid)"
  recorded_started_epoch="$(opus_state_value "${state_file}" app_started_epoch)"
  if [[ -n "${recorded_pid}" || -n "${recorded_started_epoch}" ]]; then
    [[ "${recorded_pid}" == "${app_pid}" \
      && "${recorded_started_epoch}" == "${actual_started_epoch}" ]] || return 1
  fi
}
