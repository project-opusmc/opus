# OPUS

This repository is the buildable OPUS superproject. It pins compatible
Launcher and Runtime revisions as Git submodules and owns product-level build,
verification, packaging, release metadata, and architecture documentation.

```text
Opus/
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

The superproject always pins exact component commits. Component changes are
committed and pushed in their owning repository first, then the corresponding
gitlink and `release/opus.lock.json` are updated together here.

See [docs/architecture.md](docs/architecture.md) and
[docs/build-and-release.md](docs/build-and-release.md).
