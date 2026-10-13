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

The default profile is `client-cef`: a development-only React/CEF Client build
on the pinned Forge + OptiFine 1.8.9 reference host. `check.sh` verifies the UI,
Launcher, Runtime contract, W4 input path, and repeated W5 CEF routes; `build.sh`
rebuilds and stages the five Runtime artifacts and CEF helper before building
the Launcher. Packaging remains disabled until signing and physical acceptance
are complete.

The `injector-development` profile is still available for explicit frozen R&D
verification with `OPUS_BUILD_PROFILE=injector-development`. It is not the
product check/build default and still creates no packageable payload.

The active profile is `client-cef`, a development-only React/CEF Client build on
the pinned Forge + OptiFine 1.8.9 reference host. Packaging remains blocked
until release signing and physical in-game acceptance are complete.

The existing Forge rollback profile remains separately selectable as
`legacy-forge-rollback` from a clean checkout at its exact locked component
revisions. The retained `injector-development` profile remains frozen R&D and
is not the default check or build path.
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

## Authors

| Giang Truong Vu | Vu Nguyen Minh Anh | 0x7A766E39 |
| --- | --- | --- |
| [![zvwgvx](https://avatars.githubusercontent.com/u/190599945?v=4&s=64)](https://github.com/zvwgvx) | [![minanhhvu](https://avatars.githubusercontent.com/u/339979715?v=4&s=64)](https://github.com/minanhhvu) | [![svyatopolk](https://avatars.githubusercontent.com/u/254288239?v=4&s=64)](https://github.com/svyatopolk) |
| [@zvwgvx](https://github.com/zvwgvx) | [@minanhhvu](https://github.com/minanhhvu) | [@svyatopolk](https://github.com/svyatopolk) |

See [AUTHORS.md](AUTHORS.md) for commit attribution.
