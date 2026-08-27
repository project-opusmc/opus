#!/bin/zsh
set -euo pipefail

tool_root="${0:A:h}"
export PATH="${tool_root}/bin:${PATH}"
source "${tool_root}/file-only-policy.sh"

# Do not start Electron while the console is locked; its native credential
# integrations can still wake a macOS prompt before Chromium switches apply.
if [[ -x "${tool_root}/check-console-unlocked.sh" ]] \
  && ! "${tool_root}/check-console-unlocked.sh"; then
  print -u2 "Refusing to launch ChatGPT: macOS console is locked; no password is requested."
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
app="/Applications/ChatGPT.app"
executable="${app}/Contents/MacOS/ChatGPT"
codex_config="${CODEX_HOME}/config.toml"
auth_file="${CODEX_HOME}/auth.json"

if [[ ! -x "${executable}" ]]; then
  print -u2 "ChatGPT executable not found: ${executable}"
  exit 1
fi
if ! opus_assert_codex_file_only_policy "${codex_config}"; then
  print -u2 "Refusing to launch ChatGPT: Codex config is not fully file-only."
  exit 78
fi
if [[ ! -f "${auth_file}" || "$(stat -f '%Lp' "${auth_file}" 2>/dev/null)" != "600" ]]; then
  print -u2 "Refusing to launch ChatGPT: ${auth_file} is missing or not mode 0600."
  exit 78
fi

# Electron only applies these switches when the main process is created. Do
# not silently hand arguments to an already-running process with old flags.
existing_pid="$(ps -axo pid=,args= | awk '$2 == "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT" && pid == "" {pid=$1} END {print pid}')"
if [[ -n "${existing_pid}" ]]; then
  existing_command="$(ps -ww -p "${existing_pid}" -o command= 2>/dev/null || true)"
  existing_environment="$(ps eww -p "${existing_pid}" -o command= 2>/dev/null || true)"
  if [[ "${existing_command}" != *"--use-mock-keychain"* \
    || "${existing_command}" != *"--password-store=basic"* \
    || "${existing_environment}" != *"OPUS_FILE_ONLY_CREDENTIALS=1"* \
    || "${existing_environment}" != *"PATH=${tool_root}/bin:"* \
    || ( "${existing_environment}" == *"SSH_AUTH_SOCK="* && "${existing_environment}" != *"SSH_AUTH_SOCK=/dev/null"* ) ]]; then
    print -u2 "ChatGPT is already running without the file-only Chromium switches (pid ${existing_pid})."
    print -u2 "Close ChatGPT normally, then run this launcher; it never kills the existing process."
    exit 2
  fi
  opus_write_file_only_launch_state chatgpt "${existing_pid}"
  # Bring the verified process forward. Supplying the same safe switches also
  # keeps the race fail-closed if the process exits between inspection and
  # activation and LaunchServices must start it again.
  /usr/bin/open -a "ChatGPT" --args \
    --use-mock-keychain \
    --password-store=basic
  print "ChatGPT pid ${existing_pid} already satisfies the file-only policy; launch state attested without restart."
  exit 0
fi

opus_write_file_only_launch_state chatgpt

exec "${executable}" \
  --use-mock-keychain \
  --password-store=basic \
  "$@"
