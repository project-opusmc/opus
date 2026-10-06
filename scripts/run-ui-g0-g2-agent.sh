#!/bin/zsh
set -eu
cd /Users/zvwgvx/Project/Opus
PROMPT=$(cat <<'EOF'
Execute docs/UI_G0_G2_EXECUTION.md from G0 through the end of G2 as one bounded autonomous pass.

Read these sources before changing implementation:
- docs/UI_G0_G2_EXECUTION.md
- docs/decisions/0008-opus-client-launcher-ui-first-mainline.md
- ui-v2/HOME_SPEC.md
- relevant current source discovered during G0

Hard constraints:
- Preserve every unrelated dirty worktree change. Never reset, checkout, restore, revert, clean, or bulk-delete.
- Injector/injection work is frozen and out of scope.
- Do not revive Elementa/OneConfig or another historical renderer as a production fallback.
- Do not select or modify the production renderer during G0-G2.
- Do not touch Java runtime, launcher, CEF native code, injector code, or production packaging to make G2 pass.
- Do not create dead/fake visible controls.
- Do not introduce a temporary architecture pivot.
- Do not commit; leave a reviewable working tree.
- If a stop condition in the contract is reached, stop safely and document the blocker rather than improvising.

Execution order:
1. Complete G0 audit and write docs/ui-g0-audit.md with concrete paths, ownership, classifications, git state, and verdict.
2. Complete G1 and write docs/ui-g1-interaction-contract.md. Base it on verified current bridge/runtime semantics but keep the contract product-semantic and renderer-independent.
3. Only if G0 and G1 permit it, implement G2 in ui-v2 as the interactive browser prototype. Refactor monolithic presentation only as needed for clear state/actions. Preserve HOME_SPEC requirements.
4. Run the normal ui-v2 build and all bounded checks available. Add small test/check scripts only if they are directly useful and non-invasive.
5. Write docs/ui-g0-g2-verdict.md with exact commands, results, changed files, remaining blockers, and PASS/FAIL for each gate. Never call browser-only evidence in-game evidence.

For G2, the minimum required interactive fixture path is:
Home -> Multiplayer -> select server -> Back -> Client Settings -> Modules -> Module Detail -> toggle -> Back.
Also cover Home -> Singleplayer, Accounts, Minecraft Settings development boundary, Quit development boundary, keyboard focus, ESC/Back, scroll, and selection/toggle state.

Use the current repository as evidence, not old plans as authority. Historical plans may explain legacy paths but cannot override the current direct execution contract.
EOF
)
CODEX_BIN="/Applications/ChatGPT.app/Contents/Resources/codex"
if [ -x "$CODEX_BIN" ]; then
  exec "$CODEX_BIN" exec --dangerously-bypass-approvals-and-sandbox "$PROMPT"
fi
if command -v codex >/dev/null 2>&1; then
  exec codex exec --dangerously-bypass-approvals-and-sandbox "$PROMPT"
fi
printf 'codex executable not found\n' >&2
exit 127
