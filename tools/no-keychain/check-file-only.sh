#!/bin/zsh
set -euo pipefail

tool_root="${0:A:h}"
repo_root="${0:A:h:h:h}"
export PATH="${tool_root}/bin:${PATH}"
source "${tool_root}/file-only-policy.sh"
codex_config="${HOME}/.codex/config.toml"
auth_file="${HOME}/.codex/auth.json"
model_catalog_file=""
cursor_argv="${HOME}/Library/Application Support/Cursor/argv.json"
gh_config="${HOME}/.config/gh/config.yml"
zshenv_file="${HOME}/.zshenv"
zshenv_policy="${repo_root}/tools/no-keychain/zshenv-file-only.zsh"
launcher_root="${repo_root}/launcher"
bundle_gate="${launcher_root}/scripts/assert-file-only-bundle.sh"
failed=0

pass() { print "PASS: $1"; }
warn() { print "WARN: $1"; }
fail() { print -u2 "FAIL: $1"; failed=1; }

if [[ -x "${tool_root}/check-console-unlocked.sh" ]]; then
  if "${tool_root}/check-console-unlocked.sh"; then
    pass "macOS console is unlocked; credential prompts are not needed for tests"
  else
    fail "macOS console is locked; tests are refused without requesting a password"
  fi
else
  fail "Console-lock safety gate is missing"
fi

if [[ -x "${tool_root}/bin/security" ]]; then
  pass "Keychain CLI refusal stub is installed"
else
  fail "Keychain CLI refusal stub is missing or not executable"
fi

if rg -q '^\s*cli_auth_credentials_store\s*=\s*"file"\s*$' "${codex_config}" 2>/dev/null \
  && rg -q '^\s*mcp_oauth_credentials_store\s*=\s*"file"\s*$' "${codex_config}" 2>/dev/null; then
  pass "Codex and MCP credentials are configured for file storage"
else
  fail "Codex config is not file-only"
fi

if rg -q '^\s*analytics\.enabled\s*=\s*false\s*$' "${codex_config}" 2>/dev/null; then
  pass "Codex background analytics is disabled"
else
  fail "Codex background analytics is enabled or unspecified"
fi

# Custom providers may serve responses correctly while their `/models`
# endpoint stalls. Keep model discovery local so app-server startup and
# `model/list` never depend on that endpoint.
model_catalog_file="$(awk -F'"' '/^model_catalog_json[[:space:]]*=/{print $2; exit}' "${codex_config}" 2>/dev/null || true)"
if [[ -n "${model_catalog_file}" && -f "${model_catalog_file}" ]] \
  && jq -e '
    .models
    | type == "array" and length > 0
    and all(.[]; (.slug | type == "string")
      and (.supports_parallel_tool_calls | type == "boolean"))
  ' "${model_catalog_file}" >/dev/null 2>&1; then
  pass "Codex model catalog is local and non-empty"
else
  fail "Codex model catalog is missing or schema-incomplete; app-server model/list may block on the provider /models endpoint"
fi

if [[ -f "${zshenv_policy}" ]] && rg -q 'zshenv-file-only\.zsh' "${zshenv_file}" 2>/dev/null; then
  pass "Default zsh startup is file-only and non-interactive"
else
  fail "Default zsh startup can still inherit a Keychain or SSH-agent prompt"
fi

# macOS login startup runs path_helper after .zshenv. Verify the effective
# command resolution, not just the presence of a source line in dotfiles.
login_security="$(zsh -lc 'command -v security' 2>/dev/null || true)"
interactive_security="$(zsh -ic 'command -v security' 2>/dev/null || true)"
if [[ "${login_security}" == "${tool_root}/bin/security" \
  && "${interactive_security}" == "${tool_root}/bin/security" ]]; then
  pass "Login and interactive zsh resolve the refusing security stub first"
else
  fail "A zsh startup path can still resolve the real macOS security CLI"
fi

if [[ -f "${launcher_root}/Cargo.toml" ]] \
  && ! rg -q 'keyring::|keyring\.workspace|KEYRING_(SERVICE|ACCOUNT)' \
    "${launcher_root}/Cargo.toml" "${launcher_root}/crates" \
    "${launcher_root}/desktop/src-tauri" 2>/dev/null; then
  pass "Opus launcher source has no macOS keyring dependency or API"
else
  fail "Opus launcher source can still access the macOS keyring"
fi

if [[ -x "${bundle_gate}" ]]; then
  for installed_bundle in \
    "/Applications/Opus Launcher.app" \
    "/Applications/Opus Launcher QA.app" \
    "${launcher_root}/target/release/bundle/macos/Opus Launcher.app" \
    "${launcher_root}/target/debug/bundle/macos/Opus Launcher QA.app"; do
    if [[ -d "${installed_bundle}" ]]; then
      if "${bundle_gate}" "${installed_bundle}" >/dev/null; then
        pass "Launcher bundle is file-only: ${installed_bundle}"
      else
        fail "Launcher bundle still contains a macOS keyring path: ${installed_bundle}"
      fi
    fi
  done
else
  fail "Launcher file-only bundle gate is missing"
fi

# The app-server's shell policy is a second boundary after auth.json: it keeps
# spawned commands from rediscovering launchd's SSH agent or the system
# `security` CLI, even when a caller forgets the repository wrapper.
if rg -q '^\[shell_environment_policy\]$' "${codex_config}" 2>/dev/null \
  && rg -q '^\s*inherit\s*=\s*"core"\s*$' "${codex_config}" 2>/dev/null \
  && rg -q '^\s*OPUS_FILE_ONLY_CREDENTIALS\s*=\s*"1"\s*$' "${codex_config}" 2>/dev/null \
  && rg -q '^\s*SSH_AUTH_SOCK\s*=\s*"/dev/null"\s*$' "${codex_config}" 2>/dev/null \
  && rg -q '^\s*GIT_TERMINAL_PROMPT\s*=\s*"0"\s*$' "${codex_config}" 2>/dev/null \
  && rg -q '^\s*GIT_SSH_COMMAND\s*=.*BatchMode=yes.*IdentityAgent=none.*UseKeychain=no' "${codex_config}" 2>/dev/null \
  && rg -q '^\s*PATH\s*=\s*"/Users/zvwgvx/Project/Opus/tools/no-keychain/bin:' "${codex_config}" 2>/dev/null; then
  pass "Codex subprocess environment is file-only and blocks the Keychain CLI"
else
  fail "Codex subprocess environment can still inherit a Keychain/agent prompt"
fi

if [[ -f "${auth_file}" && "$(stat -f '%Lp' "${auth_file}" 2>/dev/null)" == "600" ]]; then
  pass "Codex auth file exists with mode 0600"
else
  fail "Codex auth file is missing or not mode 0600"
fi

if (( $+commands[gh] )); then
  if [[ -f "${gh_config}" ]] && rg -q '^prompt:\s*disabled\s*$' "${gh_config}"; then
    pass "GitHub CLI interactive prompts are disabled"
  else
    fail "GitHub CLI may fall back to an interactive credential prompt"
  fi
else
  warn "GitHub CLI not installed; skipped prompt-policy check"
fi

# Do not run `codex doctor` here. The diagnostic binary performs TLS and
# Security.framework work even when auth is file-backed, which can wake the
# macOS Keychain prompt while the console is locked. The config and 0600 auth
# file checks above are the non-interactive source of truth for this gate.
pass "Codex auth storage verified from config.toml and auth.json without invoking Codex"

if [[ -f "${cursor_argv}" ]] \
  && jq -e '.["use-inmemory-secretstorage"] == true and .["use-mock-keychain"] == true and .["password-store"] == "basic" and (.["disable-extension"] | index("vscode.github-authentication")) != null' "${cursor_argv}" >/dev/null 2>&1; then
  pass "Cursor is configured for mock-keychain/basic in-memory storage without GitHub keychain extension"
else
  fail "Cursor argv.json is not configured for mock-keychain/basic in-memory storage without GitHub keychain extension"
fi

# A live-process audit is part of the invariant: a stale Electron tree can
# keep using Keychain even when every file and launcher setting is correct.
# Do not treat a sandbox/privacy failure from `ps` as an empty process list.
process_probe_available=1
if [[ "$(uname -s)" == "Darwin" ]] \
  && ! ps -axo pid= >/dev/null 2>&1; then
  process_probe_available=0
  fail "Live process audit is unavailable; rerun this gate from a macOS shell that can inspect GUI processes"
fi

if (( ! process_probe_available )); then
  exit "${failed}"
fi

# Codex Desktop atomically rewrites config.toml during startup, replacing its
# inode and mtime after the app-server has already read the same policy. A raw
# config mtime comparison therefore creates a permanent false-stale loop. GUI
# app-servers are instead tied to a non-secret launch attestation plus the live
# parent flags/environment. Direct shell app-servers retain the mtime fallback.
codex_server_blocked=""
codex_config_mtime="$(stat -f '%m' "${codex_config}" 2>/dev/null || print 0)"
cursor_argv_mtime="$(stat -f '%m' "${cursor_argv}" 2>/dev/null || print 0)"
process_started_before_mtime() {
  local process_pid="$1"
  local cutoff_mtime="$2"
  local process_started process_started_epoch
  process_started="$(LC_ALL=C ps -o lstart= -p "${process_pid}" 2>/dev/null | sed 's/^ *//' || true)"
  process_started_epoch="$(LC_ALL=C date -j -f '%a %b %e %T %Y' "${process_started}" '+%s' 2>/dev/null || print 0)"
  (( cutoff_mtime > 0 && process_started_epoch > 0 && process_started_epoch < cutoff_mtime ))
}

# A valid ChatGPT process can outlive its launch-attestation file (for example
# after a config rewrite or a restored home directory). Re-attest only after
# checking the live command line and environment; an unsafe process is never
# made valid by this recovery path.
chatgpt_live_file_only() {
  local process_pid="$1"
  local process_command process_environment process_security_command
  process_command="$(ps -ww -p "${process_pid}" -o command= 2>/dev/null || true)"
  process_environment="$(ps eww -p "${process_pid}" -o command= 2>/dev/null || true)"
  [[ "${process_command}" == *"/Applications/ChatGPT.app/Contents/MacOS/ChatGPT"* \
    && "${process_command}" == *"--use-mock-keychain"* \
    && "${process_command}" == *"--password-store=basic"* \
    && "${process_environment}" == *"OPUS_FILE_ONLY_CREDENTIALS=1"* \
    && "${process_environment}" == *"SSH_AUTH_SOCK=/dev/null"* \
    && "${process_environment}" == *"PATH=${tool_root}/bin:"* ]] || return 1
  process_security_command="$(opus_process_security_command "${process_pid}" || true)"
  [[ "${process_security_command}" == "${tool_root}/bin/security" ]]
}

# Inspect the executable token separately from its arguments. A wrapper such
# as `run-file-only.sh .../codex app-server` must not be mistaken for the
# server it is about to launch, or every safe respawn would self-block.
for codex_pid in ${(f)"$(ps -axo pid=,command= | awk '
  {
    line=$0
    sub(/^[[:space:]]*[0-9]+[[:space:]]+/, "", line)
    executable=line
    sub(/[[:space:]].*$/, "", executable)
  }
  executable ~ /\/codex$/ && line ~ /(^|[[:space:]])app-server([[:space:]]|$)/ {print $1}' 2>/dev/null || true)"}; do
  [[ -z "${codex_pid}" ]] && continue
  codex_process_blocked=0
  codex_opus_boundary="$(opus_process_environment_value "${codex_pid}" OPUS_FILE_ONLY_CREDENTIALS)"
  codex_ssh_sock="$(opus_process_environment_value "${codex_pid}" SSH_AUTH_SOCK)"
  codex_security_command="$(opus_process_security_command "${codex_pid}" || true)"
  if [[ ( -n "${codex_ssh_sock}" && "${codex_ssh_sock}" != "/dev/null" ) \
    || "${codex_security_command}" != "${tool_root}/bin/security" ]]; then
    codex_process_blocked=1
  fi
  # Tie GUI children to the exact ChatGPT/Cursor process attested by the
  # launcher. Unknown/direct app-servers cannot be affected by the desktop
  # atomic rewrite, so their start time still uses config.toml as a fallback.
  ancestor_pid="${codex_pid}"
  gui_app=""
  gui_app_pid=""
  for _ in {1..16}; do
    parent_pid="$(ps -o ppid= -p "${ancestor_pid}" 2>/dev/null | tr -d ' ' || true)"
    [[ -z "${parent_pid}" || "${parent_pid}" == "1" || "${parent_pid}" == "${ancestor_pid}" ]] && break
    parent_command="$(ps -ww -o command= -p "${parent_pid}" 2>/dev/null || true)"
    if [[ "${parent_command}" == *"/Applications/ChatGPT.app/Contents/MacOS/ChatGPT"* ]]; then
      gui_app="chatgpt"
      gui_app_pid="${parent_pid}"
    elif [[ "${parent_command}" == *"/Applications/Cursor.app/Contents/MacOS/Cursor"* ]]; then
      gui_app="cursor"
      gui_app_pid="${parent_pid}"
    fi
    ancestor_pid="${parent_pid}"
  done
  if [[ -n "${gui_app}" ]]; then
    if ! opus_file_only_launch_state_matches "${gui_app}" "${gui_app_pid}"; then
      # The launcher normally writes this state. Recover it in place when the
      # already-running ChatGPT process proves the same invariant, so a stale
      # bookkeeping file cannot force a needless app restart.
      if [[ "${gui_app}" == "chatgpt" ]] \
        && chatgpt_live_file_only "${gui_app_pid}" \
        && opus_write_file_only_launch_state chatgpt "${gui_app_pid}" \
        && opus_file_only_launch_state_matches chatgpt "${gui_app_pid}"; then
        :
      else
        codex_process_blocked=1
      fi
    fi
  elif process_started_before_mtime "${codex_pid}" "${codex_config_mtime}"; then
    codex_process_blocked=1
  fi
  # Nested code-mode/tool app-servers can intentionally receive a reduced
  # environment. For a child under an already-attested GUI parent, the live
  # refusal-stub PATH and absent SSH socket above are the authoritative checks;
  # unrelated config rewrites (for example, a model catalog refresh) must not
  # make that child stale. Unknown/direct app-servers retain the mtime fallback.
  if [[ "${codex_opus_boundary}" != "1" ]] \
    && [[ -z "${gui_app}" ]] \
    && process_started_before_mtime "${codex_pid}" "${codex_config_mtime}"; then
    codex_process_blocked=1
  fi
  if (( codex_process_blocked )); then
    codex_server_blocked+=" ${codex_pid}"
  fi
done
if [[ -z "${codex_server_blocked}" ]]; then
  pass "Running Codex app-servers match file-only launch attestations and environments"
else
  fail "Codex app-server pid(s):${codex_server_blocked} lack a matching file-only launch attestation/environment; run the matching launcher once (valid live apps are attested without restart)"
fi

ssh_policy="$(ssh -G github.com 2>/dev/null || true)"
if print -r -- "${ssh_policy}" | rg -q '^batchmode yes$' \
  && print -r -- "${ssh_policy}" | rg -q '^addkeystoagent false$' \
  && print -r -- "${ssh_policy}" | rg -q '^identityagent none$' \
  && print -r -- "${ssh_policy}" | rg -q '^forwardagent (no|false)$' \
  && print -r -- "${ssh_policy}" | rg -q '^identitiesonly yes$'; then
  pass "SSH is fail-closed without Keychain or an ambient agent"
else
  fail "SSH may still consult Keychain/agent or open a passphrase prompt"
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  warn "LaunchAgent environment check skipped outside macOS"
else
  launch_ssh_sock="$(launchctl getenv SSH_AUTH_SOCK 2>/dev/null || true)"
  launch_git_prompt="$(launchctl getenv GIT_TERMINAL_PROMPT 2>/dev/null || true)"
  launch_git_ssh="$(launchctl getenv GIT_SSH_COMMAND 2>/dev/null || true)"
  launch_path="$(launchctl getenv PATH 2>/dev/null || true)"
  launch_security="$(launchctl asuser "$(id -u)" /bin/zsh -lc 'command -v security' 2>/dev/null || true)"
  if [[ "${launch_ssh_sock}" == "/dev/null" \
    && "${launch_git_prompt}" == "0" \
    && "${launch_git_ssh}" == *"BatchMode=yes"* \
    && "${launch_git_ssh}" == *"IdentityAgent=none"* \
    && "${launch_git_ssh}" == *"UseKeychain=no"* \
    && "${launch_path}" == "${tool_root}/bin:"* \
    && "${launch_security}" == "${tool_root}/bin/security" ]]; then
    pass "GUI launch environment is file-only and non-interactive"
  else
    fail "GUI launch environment can still inherit an agent or credential prompt"
  fi
fi

security_cli_pids="$(ps -axo pid=,command= | awk 'tolower($0) ~ /(^|[[:space:]])(\/usr\/bin\/)?security[[:space:]]+(find|dump|add|delete|unlock|create|set|list)/ {print $1}')"
if [[ -z "${security_cli_pids}" ]]; then
  pass "No macOS security CLI process is active"
else
  fail "A macOS security CLI process is active (pid(s): ${security_cli_pids//$'\n'/ })"
fi

chatgpt_pid="$(ps -axo pid=,args= | awk '$2 == "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT" && pid == "" {pid=$1} END {print pid}')"
if [[ -z "${chatgpt_pid}" ]]; then
  warn "ChatGPT is not running; launch it with launch-chatgpt-file-store.sh"
else
  chatgpt_command="$(ps -ww -p "${chatgpt_pid}" -o command= 2>/dev/null || true)"
  chatgpt_environment="$(ps eww -p "${chatgpt_pid}" -o command= 2>/dev/null || true)"
  if [[ "${chatgpt_command}" == *"--use-mock-keychain"* \
    && "${chatgpt_command}" == *"--password-store=basic"* \
    && "${chatgpt_environment}" == *"OPUS_FILE_ONLY_CREDENTIALS=1"* \
    && "${chatgpt_environment}" == *"PATH=${tool_root}/bin:"* \
    && ( "${chatgpt_environment}" != *"SSH_AUTH_SOCK="* || "${chatgpt_environment}" == *"SSH_AUTH_SOCK=/dev/null"* ) ]]; then
    pass "Running ChatGPT has file-only Chromium switches"
  else
    fail "Running ChatGPT pid ${chatgpt_pid} predates the file-only launcher; restart it through launch-chatgpt-file-store.sh"
  fi
fi

cursor_pid="$(ps -axo pid=,args= | awk '$2 == "/Applications/Cursor.app/Contents/MacOS/Cursor" && pid == "" {pid=$1} END {print pid}')"
if [[ -z "${cursor_pid}" ]]; then
  warn "Cursor is not running; launch it with launch-cursor-file-store.sh"
else
  cursor_command="$(ps -ww -p "${cursor_pid}" -o command= 2>/dev/null || true)"
  cursor_environment="$(ps eww -p "${cursor_pid}" -o command= 2>/dev/null || true)"
  cursor_stale=0
  if process_started_before_mtime "${cursor_pid}" "${cursor_argv_mtime}"; then
    cursor_stale=1
  fi
  if [[ "${cursor_environment}" == *"SSH_AUTH_SOCK="* && "${cursor_environment}" != *"SSH_AUTH_SOCK=/dev/null"* ]]; then
    cursor_stale=1
  fi
  # The GitHub authentication extension is loaded by extension-host children;
  # all descendants must be newer than argv.json or the old extension can keep
  # its live Keychain session after the setting is changed.
  cursor_descendants="${cursor_pid}"
  for _ in {1..8}; do
    next_descendants="$(ps -axo pid=,ppid= | awk -v roots="${cursor_descendants}" '
      BEGIN {n=split(roots, a, " "); for (i=1; i<=n; i++) seen[a[i]]=1}
      {for (i=1; i<=n; i++) if ($2 == a[i] && !seen[$1]) {print $1; seen[$1]=1}}
    ' 2>/dev/null | tr '\n' ' ' | sed 's/[[:space:]]*$//' || true)"
    [[ -z "${next_descendants}" ]] && break
    cursor_descendants="${cursor_descendants} ${next_descendants}"
  done
  for descendant_pid in ${(z)cursor_descendants}; do
    [[ "${descendant_pid}" == "${cursor_pid}" ]] && continue
    if process_started_before_mtime "${descendant_pid}" "${cursor_argv_mtime}"; then
      cursor_stale=1
    fi
  done
  if [[ "${cursor_command}" == *"--use-mock-keychain"* \
    && "${cursor_command}" == *"--password-store=basic"* \
    && "${cursor_environment}" == *"OPUS_FILE_ONLY_CREDENTIALS=1"* \
    && "${cursor_environment}" == *"PATH=${tool_root}/bin:"* \
    && "${cursor_stale}" == 0 ]]; then
    pass "Running Cursor has file-only Chromium switches"
  else
    fail "Running Cursor pid ${cursor_pid} or one of its extension hosts predates file-only argv.json/environment; restart it through launch-cursor-file-store.sh"
  fi
fi

pass "Retired CEF helper gate is excluded from Core-Mod-first verification"

exit "${failed}"
