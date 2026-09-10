# Runtime Artifact Contract

The current Forge 1.8.9 release contract is schema v1 and contains exactly
seven JAR roles. The machine-readable source of truth is
[`runtime-artifact-roles.json`](runtime-artifact-roles.json).

```text
build/runtime/
|- artifacts/
|  |- opus-bootstrap-<version>.jar
|  |- opus-runtime-legacy-1.8.9-<version>.jar
|  |- opus-lwjgl-macos-compat-2.9.2-nightly-20140822.jar
|  |- opus-native-ui-1.8.9-0.1.0.jar
|  |- opus-oneconfig-1.8.9-forge-0.2.2-alpha228-full.jar
|  |- opus-elementa-762.jar
|  `- opus-universalcraft-1.8.9-forge-516.jar
|- runtime-manifest.json
`- runtime-checksums.json
```

| Role | Stage | Responsibility |
| --- | --- | --- |
| `bootstrap` | Launcher classpath | Starts the bounded Forge bootstrap protocol. |
| `runtime-legacy-1.8.9` | Game `mods/` | Legacy OPUS Core Mod integration. |
| `lwjgl-macos-compat` | Game `mods/` | Locked macOS LWJGL compatibility support. |
| `native-ui` | Game `mods/` | Legacy Forge UI bridge. |
| `opusconfig` | Game `mods/` | Frozen OneConfig-based configuration/UI dependency. |
| `elementa` | Game `mods/` | Elementa shell dependency. |
| `universalcraft` | Game `mods/` | UniversalCraft dependency. |

The manifest records Runtime version, protocol version, Minecraft version,
artifact role, filename, byte size, and SHA-256. The checksum file duplicates
the filename-to-SHA-256 mapping so staging can reject an inconsistent or
partially replaced artifact set.

Launcher accepts exactly one artifact for each role and verifies the manifest,
checksum map, size, and SHA-256 before copying the JARs into its bundle
resources. Product builds must use the Runtime commit and manifest SHA-256
pinned in `release/opus.lock.json`.

Schema v1 remains the legacy Forge lane. A future injector payload preview must
use a separately versioned contract; it must not silently add or replace a
schema-v1 role.

The manifest contains no timestamps or machine-specific paths. A clean build of
the same Runtime commit must produce byte-identical JARs and JSON files.
