# OPUS

This repository is the OPUS superproject. It owns the injector/runtime-payload
foundation, product-level build metadata, verification, packaging policy, and
architecture documentation. Launcher and Runtime remain Git submodules for the
isolated legacy Forge rollback lane.

```text
Opus/
|- injector/            Rust M3 preflight and selected-PID native transport
|- runtime-native/      C++17 JNI/JVMTI native runtime
|- runtime-java/        Java 8-compatible payload foundation
|- adapters/            client/runtime-specific compatibility adapters
|- launcher/    project-opusmc/launcher submodule
|- runtime/     project-opusmc/runtime submodule
|- docs/
|- release/
|- scripts/
`- .github/
```

Web code is intentionally excluded from this workspace.

## Bootstrap

```bash
git clone --recurse-submodules https://github.com/project-opusmc/opus.git
cd opus
./scripts/bootstrap.sh
./scripts/check.sh
./scripts/build.sh
```

The active `injector-development` profile is intentionally foundation-only:
`check.sh` validates the Rust M3 preflight boundary, native foundation,
repeatable owned-JVM lifecycle proof, and a separately launched,
loopback-only authorized-target survival proof. It also tests the evidence
gate that prevents that fixture from being presented as a real client
integration. `build.sh` creates
`opus-injector` plus architecture-specific native slices. It does not create
a production transport-capable injector/payload bundle or a package.
`package.sh` remains blocked until the payload artifact contract and adapter
certification gates pass.

The planned production direction is documented as
[M3 General](docs/m3-general-objective.md): process/JVM selection and native
transport are client-independent, while Lunar, Badlion, Forge, Vanilla, and
unknown runtime behavior are classified after entry and certified through
separate adapter gates. The current injector has a generic Minecraft-JVM
target model, non-authoritative process hints, and guarded direct
selected-PID native transport on macOS. Its passing direct-transport evidence
is limited to an arm64 debug-authorized OPUS Java fixture; the current
x86_64 Java 8/Rosetta fixture returns a typed pre-entry rejection instead of
attempting a bypass. Neither result is evidence of successful transport into a
normal game client.

The old Forge artifact lock is retained as an explicit rollback profile. It
may be selected with `OPUS_BUILD_PROFILE=legacy-forge-rollback`, but only from
a clean checkout at the exact locked component revisions.

See [docs/architecture.md](docs/architecture.md) and
[docs/build-and-release.md](docs/build-and-release.md).
