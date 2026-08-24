#!/bin/zsh
set -euo pipefail

# A locked console can surface a macOS login/Keychain prompt even when the
# test itself has no credential dependency. Fail closed instead.
if [[ "$(uname -s)" != "Darwin" ]]; then
  exit 0
fi

locked="$(ioreg -n Root -d1 -a 2>/dev/null \
  | plutil -extract IOConsoleLocked raw -o - - 2>/dev/null || true)"
session_locked="$(ioreg -n Root -d1 -a 2>/dev/null \
  | plutil -extract IOConsoleUsers.0.CGSSessionScreenIsLocked raw -o - - 2>/dev/null || true)"

if [[ "${locked:l}" == "true" || "${session_locked:l}" == "true" ]]; then
  print -u2 "FILE_ONLY_BLOCKED: macOS console is locked; refusing to start a test and requesting no password."
  exit 78
fi

exit 0
