#!/bin/zsh
set -euo pipefail

# Keep every command in a test run on the file-only credential boundary.
tool_root="${0:A:h}"
user_home="${HOME}"
export PATH="${tool_root}/bin:${PATH}"
export CODEX_HOME="${user_home}/.codex"
export OPUS_FILE_ONLY_CREDENTIALS=1
export GIT_TERMINAL_PROMPT=0
export GCM_INTERACTIVE=Never
export GH_PROMPT_DISABLED=1
export GH_CONFIG_DIR="${user_home}/.config/gh"
export GIT_ASKPASS=/usr/bin/false
export SSH_ASKPASS=/usr/bin/false
export SSH_ASKPASS_REQUIRE=force
# Keep the value explicit: some GUI/editor integrations rediscover the launchd
# agent when SSH_AUTH_SOCK is merely unset.
export SSH_AUTH_SOCK=/dev/null
unset SSH_AGENT_PID
# Keep TLS verification on the filesystem; no native certificate/keychain
# lookup is needed for repository or API commands.
export SSL_CERT_FILE=/etc/ssl/cert.pem
export SSL_CERT_DIR=/etc/ssl/certs
export GIT_CONFIG_NOSYSTEM=1
# Do not let OpenSSH consult an ambient agent or macOS Keychain. A missing
# file-backed key must fail closed rather than opening a passphrase prompt.
export GIT_SSH_COMMAND='ssh -oBatchMode=yes -oIdentitiesOnly=yes -oIdentityAgent=none -oAddKeysToAgent=no -oUseKeychain=no'
# Override repository and system Git helpers so an osxkeychain helper cannot
# re-enter through an inherited config layer.
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0=credential.helper
export GIT_CONFIG_VALUE_0=
export GIT_CONFIG_KEY_1=credential.helper
export GIT_CONFIG_VALUE_1="store --file=${user_home}/.config/opus/git-credentials"

if (( $# == 0 )); then
  print -u2 "Usage: ${0:t} <command> [args...]"
  exit 64
fi

# Do not start a test while an old Electron process can still probe Keychain.
# Set OPUS_SKIP_FILE_ONLY_GATE=1 only for diagnostics that do not launch apps.
if [[ "${OPUS_SKIP_FILE_ONLY_GATE:-0}" != "1" && "${1:t}" != "check-file-only.sh" ]]; then
  if [[ -x "${tool_root}/check-console-unlocked.sh" ]] \
    && ! "${tool_root}/check-console-unlocked.sh"; then
    print -u2 "Refusing file-only run: macOS console is locked; no password is requested and no test is started."
    exit 78
  fi
  if ! "${tool_root}/check-file-only.sh"; then
    print -u2 "Refusing file-only run: close old ChatGPT/Cursor processes and relaunch them through tools/no-keychain first."
    exit 78
  fi
fi

exec "$@"
