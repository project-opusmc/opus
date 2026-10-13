# Build And Release

The active local build profile is `client-cef`, pinned to the checked-out
Launcher and Runtime gitlinks and the generated five-role Runtime manifest.
Its `development-only` state blocks packaging until release signing and
physical in-game acceptance are complete.

The `injector-development` profile remains frozen foundation R&D; it is not
this checkout's default check or build path.

## Prerequisites

- Git with submodule support
- Rust 1.92 with Rustfmt and Clippy
- Node.js 24 and npm
- A JDK with `java` and `javac`
- CMake 3.24 or later
- macOS for the current native-runtime foundation and legacy Forge client lane

## Active Client commands

```bash
./scripts/bootstrap.sh
./scripts/check.sh
./scripts/build.sh
./scripts/package.sh
```

`bootstrap.sh` initializes the Launcher and Runtime submodules and installs the
Launcher desktop and React UI dependencies. `check.sh` runs the UI typecheck,
build, and contract tests; Launcher checks; Runtime checks; the W4 coordinate
and input gates; and three consecutive W5 React/CEF production-route runs.
`build.sh` rebuilds the five Runtime artifacts, verifies the locked manifest,
stages the desktop assets and CEF helper, then builds the Launcher workspace
and desktop frontend.

The `client-cef` profile remains `development-only`, so `package.sh` refuses
packaging until release signing and physical in-game acceptance are complete.
The separate `injector-development` profile is still available by explicitly
setting `OPUS_BUILD_PROFILE=injector-development`; it remains frozen R&D and is
not the default check/build path.

## Profile selection

The active profile comes from `release/opus.lock.json`. To inspect it:

```bash
node ./scripts/verify-release-lock.mjs . --print-profile
```

The Forge path is retained only for rollback:

```bash
OPUS_BUILD_PROFILE=legacy-forge-rollback ./scripts/check.sh
OPUS_BUILD_PROFILE=legacy-forge-rollback ./scripts/build.sh
```

Those commands require Launcher and Runtime worktrees to be clean and at the
exact historical commits recorded in the rollback profile. They are not a
shortcut for publishing a new payload-based release.

`verify-release-lock.mjs` accepts `--profile <name>` to select a profile,
`--print-profile` for scripting, `--require-manifest` for the Forge-manifest
lane, and `--require-packageable` to reject foundation-only profiles.

## Promoting the payload lane

Before changing the active profile from `foundation-only`, the owning
components must provide a versioned artifact contract containing the injector,
same-architecture native runtime, Java 8 payload, checksums, sizes, mapping
schema, and OneConfig-adapter version. Each named target must then pass its
adapter, payload-load, OneConfig, unload, and reinjection acceptance tests.

Only after that evidence exists may a future schema/profile enable packaging.

## Updating the rollback lane

1. Make, verify, commit, and push the change in the owning component
   repository.
2. Update the component gitlink in this repository.
3. Update the matching `legacy-forge-rollback` commit and Runtime manifest
   SHA-256 in `release/opus.lock.json`.
4. Run the legacy profile checks from exact clean component revisions.
5. Commit the gitlink and rollback-lock update together.

Never attach uncommitted component work or guessed artifact hashes to either
profile.
