# OPUS

> **Current product direction — September 15, 2026.**
> [Decision 0008](docs/decisions/0008-opus-client-launcher-ui-first-mainline.md)
> makes **Opus Client + Opus Launcher** the active product mainline, with UI as
> the first priority. The injector/injection work is preserved as frozen,
> experimental R&D; it is not deleted or treated as the product delivery path.

This repository is the OPUS superproject. It owns product-level build metadata,
verification, packaging policy, architecture documentation, and the boundaries
between the active Client + Launcher mainline and retained experimental R&D.
Launcher and Runtime remain Git submodules and are the initial Forge +
OptiFine 1.8.9 reference-host implementation.

```text
Opus/
|- launcher/            Opus Launcher product surface and launch lifecycle
|- runtime/             initial Client host/reference implementation
|- injector/            frozen M3 transport/injection R&D
|- runtime-native/      frozen C++17 JNI/JVMTI R&D foundation
|- runtime-java/        frozen Java payload R&D foundation
|- adapters/            frozen client/runtime compatibility R&D
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

The retained `injector-development` profile is intentionally foundation-only
experimental R&D:
`check.sh` validates the Rust M3 preflight boundary, native foundation,
repeatable owned-JVM lifecycle proof, and a separately launched,
loopback-only authorized-target survival proof. It also tests the evidence
gate that prevents that fixture from being presented as a real client
integration. `build.sh` creates
`opus-injector` plus architecture-specific native slices. It does not create
a production transport-capable injector/payload bundle or a package.
`package.sh` remains blocked until the payload artifact contract and adapter
certification gates pass.

The active product direction is documented in
[Decision 0008](docs/decisions/0008-opus-client-launcher-ui-first-mainline.md):
build a transparent, RBW-first Client + Launcher experience, starting with a
coherent UI foundation. The existing Forge + OptiFine 1.8.9 lane is the initial
reference host; a renderer has not been selected. No existing Runtime or
Launcher artifact contract changes merely because of this roadmap decision.

The injector records remain available as R&D evidence. The current General
Gate 6 project-state source is the
[September 15 policy record](docs/protocol/m3-general-gate-6-current-policy-status-2026-09-15.md):
the lane is frozen/evidence-preserved; `opus-owned` is `PASS`, Badlion and
Lunar are `NOT_TESTED`, General Gate 6 is `NOT PASSED`, and Gate 7 is
`BLOCKED`.

The existing Forge artifact lock is retained as an implementation baseline and
rollback profile. It may be selected with
`OPUS_BUILD_PROFILE=legacy-forge-rollback`, but only from a clean checkout at
the exact locked component revisions. It does not override the UI-first
product roadmap.

See [docs/architecture.md](docs/architecture.md) and
[docs/build-and-release.md](docs/build-and-release.md).
