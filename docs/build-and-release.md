# Build And Release

## Prerequisites

- Git with submodule support
- Rust 1.92 with Rustfmt and Clippy
- Node.js 24 and npm
- Java 21 for the Runtime root build
- macOS for the current desktop packaging and legacy Forge client lane

## Commands

```bash
./scripts/bootstrap.sh
./scripts/check.sh
./scripts/build.sh
./scripts/package.sh
```

`bootstrap.sh` initializes the pinned submodules and installs Launcher frontend
dependencies from its lockfile. `check.sh` verifies clean pinned submodules,
runs both component gates, validates the release lock, and rejects superseded
product identifiers. `build.sh` builds Runtime first, verifies its manifest,
stages those artifacts into Launcher, and builds Launcher. `package.sh` requires
clean repositories and emits desktop packages under the Launcher build output.

## Updating A Component

1. Make, verify, commit, and push the change in the owning component repository.
2. Update the component gitlink in this repository.
3. Update the matching commit and Runtime manifest SHA-256 in
   `release/opus.lock.json`.
4. Run `./scripts/check.sh` and `./scripts/build.sh`.
5. Commit the gitlink and release-lock update together.

Never update a submodule pointer without its matching lock entry.
