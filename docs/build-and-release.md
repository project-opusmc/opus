# Build And Release

The active `release/opus.lock.json` profile is
`injector-development`. It represents the Injector → native runtime → Java
payload architecture, but it is deliberately **foundation-only**. It must not
be described as a distributable OPUS client release.

## Prerequisites

- Git with submodule support
- Rust 1.92 with Rustfmt and Clippy
- Node.js 24 and npm
- A JDK with `java` and `javac`
- CMake 3.24 or later
- macOS for the current native-runtime foundation and legacy Forge client lane

## Active development commands

```bash
./scripts/bootstrap.sh
./scripts/check.sh
./scripts/build.sh
```

`bootstrap.sh` initializes the rollback submodules and installs the Launcher
frontend dependencies. `check.sh` validates the seven-role legacy artifact
baseline, builds both native architecture slices, runs the controlled-JVM
JNI/JVMTI proof, runs a three-cycle injector-owned JVM lifecycle proof,
including logical restart in the same target JVM, runs a separately launched
authorized-target load/unload/survival proof, repeats both lifecycle proofs
against the pinned x86_64 Java 8 JDK, validates the schema-v2 lock, and audits
product naming. It also tests the M3 authorized-client evidence verifier,
which rejects fixture-only captures and validates the required repeated
lifecycle shape for a future explicitly authorized client integration.

`build.sh` builds the Rust `opus-injector` M3 preflight binary and the `arm64`
and `x86_64` native-runtime foundation slices. The binary supports read-only
process inspection, architecture preflight, typed handshake/transport status,
the separate owned-JVM lifecycle proof, and the loopback-only authorized-target
fixture proof. It intentionally does not stage Forge artifacts, perform
OS-level remote process modification, build a desktop application, or create
`opus-runtime.jar`.

`./scripts/package.sh` intentionally exits with an error for the active
foundation-only profile. Packaging becomes available only after the injector,
native runtime, Java payload, version handshake, checksums, architecture
selection, adapter certification, and lifecycle/reinjection gates are all
implemented. In particular, M3 still requires a reviewed non-fixture client
capture that passes
[`m3-authorized-client-integration-evidence.md`](protocol/m3-authorized-client-integration-evidence.md).

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
