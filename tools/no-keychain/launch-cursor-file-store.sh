#!/bin/zsh
set -euo pipefail

tool_root="${0:A:h}"
export PATH="${tool_root}/bin:${PATH}"
source "${tool_root}/file-only-policy.sh"

# Do not start Electron while the console is locked; its native credential
# integrations can still wake a macOS prompt before Chromium switches apply.
if [[ -x "${tool_root}/check-console-unlocked.sh" ]] \
  && ! "${tool_root}/check-console-unlocked.sh"; then
  print -u2 "Refusing to launch Cursor: macOS console is locked; no password is requested."
  exit 78
fi

export OPUS_FILE_ONLY_CREDENTIALS=1
export CODEX_HOME="${HOME}/.codex"
export GIT_TERMINAL_PROMPT=0
export GCM_INTERACTIVE=Never
export GH_PROMPT_DISABLED=1
export GH_CONFIG_DIR="${HOME}/.config/gh"
export GIT_CONFIG_NOSYSTEM=1
export GIT_ASKPASS=/usr/bin/false
export SSH_ASKPASS=/usr/bin/false
export SSH_ASKPASS_REQUIRE=force
# An empty value can still make GUI helpers rediscover the launchd agent. Use a
# non-socket sentinel so every child fails closed without touching Keychain.
export SSH_AUTH_SOCK=/dev/null
unset SSH_AGENT_PID
export SSL_CERT_FILE=/etc/ssl/cert.pem
export SSL_CERT_DIR=/etc/ssl/certs
export CURL_CA_BUNDLE=/etc/ssl/cert.pem
export REQUESTS_CA_BUNDLE=/etc/ssl/cert.pem
export GIT_SSH_COMMAND='ssh -oBatchMode=yes -oIdentitiesOnly=yes -oIdentityAgent=none -oAddKeysToAgent=no -oUseKeychain=no'
app="/Applications/Cursor.app"
executable="${app}/Contents/MacOS/Cursor"
codex_config="${CODEX_HOME}/config.toml"
auth_file="${CODEX_HOME}/auth.json"

if [[ ! -x "${executable}" ]]; then
  print -u2 "Cursor executable not found: ${executable}"
  exit 1
fi
if ! opus_assert_codex_file_only_policy "${codex_config}"; then
  print -u2 "Refusing to launch Cursor: Codex config is not fully file-only."
  exit 78
fi
if [[ ! -f "${auth_file}" || "$(stat -f '%Lp' "${auth_file}" 2>/dev/null)" != "600" ]]; then
  print -u2 "Refusing to launch Cursor: ${auth_file} is missing or not mode 0600."
  exit 78
fi

existing_pid="$(ps -axo pid=,args= | awk '$2 == "/Applications/Cursor.app/Contents/MacOS/Cursor" && pid == "" {pid=$1} END {print pid}')"
if [[ -n "${existing_pid}" ]]; then
  existing_command="$(ps -ww -p "${existing_pid}" -o command= 2>/dev/null || true)"
  existing_environment="$(ps eww -p "${existing_pid}" -o command= 2>/dev/null || true)"
  if [[ "${existing_command}" != *"--use-mock-keychain"* \
    || "${existing_command}" != *"--password-store=basic"* \
    || "${existing_environment}" != *"OPUS_FILE_ONLY_CREDENTIALS=1"* \
    || "${existing_environment}" != *"PATH=${tool_root}/bin:"* \
    || ( "${existing_environment}" == *"SSH_AUTH_SOCK="* && "${existing_environment}" != *"SSH_AUTH_SOCK=/dev/null"* ) ]]; then
    print -u2 "Cursor is already running without the file-only Chromium switches (pid ${existing_pid})."
    print -u2 "Close Cursor normally, then run this launcher; it never kills the existing process."
    exit 2
  fi
  opus_write_file_only_launch_state cursor "${existing_pid}"
  print "Cursor pid ${existing_pid} already satisfies the file-only policy; launch state attested without restart."
  exit 0
fi

opus_write_file_only_launch_state cursor

exec "${executable}" \
  --use-mock-keychain \
  --password-store=basic \
  --use-inmemory-secretstorage \
  --disable-extension=vscode.github-authentication \
  "$@"
