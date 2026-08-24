# Keep ordinary zsh commands on Opus's file-only credential boundary too.
# GUI processes still require a normal restart; this covers every shell test.
opus_file_only_root="/Users/zvwgvx/Project/Opus/tools/no-keychain"
if [[ -d "${opus_file_only_root}/bin" ]]; then
  export PATH="${opus_file_only_root}/bin:${PATH}"
fi

export OPUS_FILE_ONLY_CREDENTIALS=1
export CODEX_HOME="/Users/zvwgvx/.codex"
export GIT_TERMINAL_PROMPT=0
export GCM_INTERACTIVE=Never
export GH_PROMPT_DISABLED=1
export GH_CONFIG_DIR="/Users/zvwgvx/.config/gh"
export GIT_CONFIG_NOSYSTEM=1
export GIT_ASKPASS=/usr/bin/false
export SSH_ASKPASS=/usr/bin/false
export SSH_ASKPASS_REQUIRE=force
export SSH_AUTH_SOCK=/dev/null
unset SSH_AGENT_PID
export SSL_CERT_FILE=/etc/ssl/cert.pem
export SSL_CERT_DIR=/etc/ssl/certs
export CURL_CA_BUNDLE=/etc/ssl/cert.pem
export REQUESTS_CA_BUNDLE=/etc/ssl/cert.pem
export GIT_SSH_COMMAND='ssh -oBatchMode=yes -oIdentitiesOnly=yes -oIdentityAgent=none -oAddKeysToAgent=no -oUseKeychain=no'

# Override inherited Git helpers so an osxkeychain helper cannot re-enter.
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0=credential.helper
export GIT_CONFIG_VALUE_0=
export GIT_CONFIG_KEY_1=credential.helper
export GIT_CONFIG_VALUE_1="store --file=/Users/zvwgvx/.config/opus/git-credentials"
