# File-only credential runtime

This directory is the single launch boundary for local ChatGPT/Cursor and
repository test runs. It deliberately avoids macOS Keychain and does not
contain or print secrets.

The `bin/security` command is a refusal stub placed first in `PATH` by every
script here. It prevents an accidental `security` CLI call from opening a
Keychain prompt; file-only runs must use `auth.json` or the Opus file vault.

`file-only-policy.sh` is the shared policy/attestation implementation. It
stores only policy fingerprints, app names, PIDs, and start timestamps in
`~/.codex/file-only-launch/*.state` with mode `0600`; it never copies a token
or credential value into the attestation.

- `launch-chatgpt-file-store.sh` starts ChatGPT with Chromium's mock keychain and
  basic password-store switches, and passes `SSH_AUTH_SOCK=/dev/null` so a
  child cannot rediscover the macOS launchd agent. It records a non-secret
  launch attestation before a new process starts. If the existing process
  already has the exact flags and environment, it attests that PID in place
  and activates it without forcing another restart. The installed
  `~/Applications/Codex File-only.app` wrapper and its Dock tile call this same
  launcher, so normal desktop use does not require typing the script path.
- `launch-cursor-file-store.sh` starts Cursor with the same switches and
  in-memory editor secret storage, and disables the GitHub authentication
  extension that otherwise probes the OS keychain. The installed
  `~/Library/Application Support/Cursor/argv.json` repeats those switches so
  a normal Dock launch stays on the same boundary. The preflight also rejects
  a running Cursor whose extension-host children started before `argv.json`.
- `install-file-only-environment.sh` sets the non-secret, fail-closed
  environment inherited by GUI apps launched after login; the matching
  `com.opus.file-only-environment.plist` keeps that boundary active without
  touching or storing a macOS Keychain item.
- `run-file-only.sh` runs a test command with the refusal stub first in `PATH`
  and with Git/SSH/GitHub CLI interactive credential prompts disabled. It
  sets `SSH_AUTH_SOCK=/dev/null` and forces OpenSSH to use neither the macOS
  Keychain nor an ambient agent. A missing file credential fails instead of falling
  back to a system prompt. It also runs the file-only process gate first and
  refuses tests while an unattested or unsafe ChatGPT/Cursor process is alive; use
  `OPUS_SKIP_FILE_ONLY_GATE=1` only for diagnostics that do not launch an app.
- The user's `~/.zshenv`, `~/.zprofile`, and `~/.zshrc` source
  `zshenv-file-only.zsh`, so login and interactive zsh commands inherit the
  same fail-closed environment even after macOS or plugins rewrite `PATH`.
- The LaunchAgent also puts the refusal stub first in the GUI launch `PATH`,
  covering child processes that do not start through zsh.
- The user SSH config is also fail-closed (`UseKeychain no`,
  `AddKeysToAgent no`, `IdentityAgent none`, `ForwardAgent no`, and
  `BatchMode yes`) so ordinary app/editor SSH activity cannot reintroduce a
  passphrase prompt outside this wrapper.
- `check-file-only.sh` checks configuration and reports whether already-running
  app or Codex app-server processes match the file-only launch boundary. It
  exits non-zero for an unattested/unsafe process, never kills a process,
  refuses any active `security` CLI, and refuses tests while the macOS console
  is locked. GUI app-servers are validated against the launch attestation,
  exact parent PID/start time, Chromium flags, and environment. It does not use
  the current `config.toml` inode mtime for GUI processes because Codex Desktop
  atomically replaces that file during startup, which previously caused an
  endless false-stale/restart loop. Direct shell app-servers retain a safe
  mtime fallback. If a live ChatGPT parent still proves the complete file-only
  command/environment contract but its non-secret attestation file is missing,
  the gate recreates that attestation in place and does not request a restart.
  Nested code-mode children under that attested parent are checked by their
  live refusal-stub PATH and SSH boundary, so unrelated config rewrites do not
  invalidate them.
  The process scan matches the executable token, not arbitrary command-line
  arguments, so invoking `run-file-only.sh ... codex app-server` cannot
  self-report the wrapper as a stale server during a safe respawn.
  It also requires `model_catalog_json` to point to a non-empty local catalog
  whose entries include the Codex-required `supports_parallel_tool_calls`
  boolean; this prevents a provider `/models` HTTP/2 stall or a silent catalog
  parse fallback from blocking app-server `model/list` when streaming
  `/responses` is otherwise healthy.
  It deliberately does
  not run `codex doctor`: that diagnostic can perform TLS/Security.framework
  work and wake a Keychain prompt even when credentials are file-backed. This
  prevents a locked screen from turning a test or its preflight into a password
  prompt.
- Direct Opus installer scripts fail closed with exit `78` while the console is
  locked, before they can invoke ad-hoc signing. The retired CEF helper gate is
  disabled under the Core-Mod-first runtime contract and must not be launched by
  file-only verification.

An already-running Electron process cannot be retrofitted with Chromium command
line switches or a new environment. If it is unsafe, close that app normally
once, then use the matching launcher (or open it after the LaunchAgent has
run). For ChatGPT use `launch-chatgpt-file-store.sh` explicitly; unlike Cursor,
ChatGPT has no persistent `argv.json` hook for these switches. A process that
already has the exact file-only flags and environment is attested in place;
no script kills the user's GUI process or asks for a Keychain password.
