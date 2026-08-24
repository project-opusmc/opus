#!/bin/zsh
set -euo pipefail

# Persist only non-secret, fail-closed defaults for GUI apps launched after
# this agent runs. Credential material remains in the file stores configured
# by Codex, GitHub CLI, and the repository wrapper.
if [[ "$(uname -s)" != "Darwin" ]]; then
  exit 0
fi

user_home="${HOME:?HOME must be set}"
launchctl_bin=/bin/launchctl
tool_root="${0:A:h}"

setenv() {
  "${launchctl_bin}" setenv "$1" "$2"
}

setenv OPUS_FILE_ONLY_CREDENTIALS 1
setenv CODEX_HOME "${user_home}/.codex"
setenv GIT_TERMINAL_PROMPT 0
setenv GCM_INTERACTIVE Never
setenv GH_PROMPT_DISABLED 1
setenv GH_CONFIG_DIR "${user_home}/.config/gh"
setenv GIT_CONFIG_NOSYSTEM 1
setenv GIT_ASKPASS /usr/bin/false
setenv SSH_ASKPASS /usr/bin/false
setenv SSH_ASKPASS_REQUIRE force
setenv SSH_AUTH_SOCK /dev/null
setenv GIT_SSH_COMMAND 'ssh -oBatchMode=yes -oIdentitiesOnly=yes -oIdentityAgent=none -oAddKeysToAgent=no -oUseKeychain=no'
setenv GIT_CONFIG_COUNT 2
setenv GIT_CONFIG_KEY_0 credential.helper
setenv GIT_CONFIG_VALUE_0 ''
setenv GIT_CONFIG_KEY_1 credential.helper
setenv GIT_CONFIG_VALUE_1 "store --file=${user_home}/.config/opus/git-credentials"
setenv SSL_CERT_FILE /etc/ssl/cert.pem
setenv SSL_CERT_DIR /etc/ssl/certs
setenv CURL_CA_BUNDLE /etc/ssl/cert.pem
setenv REQUESTS_CA_BUNDLE /etc/ssl/cert.pem
setenv PATH "${tool_root}/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
"${launchctl_bin}" unsetenv SSH_AGENT_PID
