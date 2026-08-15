# Runtime Artifact Contract

Runtime produces `build/runtime/` with this shape:

```text
build/runtime/
|- artifacts/
|  |- opus-bootstrap-<version>.jar
|  |- opus-runtime-legacy-1.8.9-<version>.jar
|  `- opus-client-legacy-1.8.9-<version>.jar
|- runtime-manifest.json
`- runtime-checksums.json
```

The manifest schema records Runtime version, protocol version, Minecraft
version, artifact role, filename, byte size, and SHA-256. The checksum file
duplicates the filename-to-SHA-256 mapping so staging can reject an inconsistent
or partially replaced artifact set.

Launcher accepts exactly one artifact for each required role and verifies the
manifest, checksum map, size, and SHA-256 before copying any JAR into its bundle
resources. Product builds must use the Runtime commit and manifest SHA-256
pinned in `release/opus.lock.json`.

The manifest contains no timestamps or machine-specific paths. A clean build of
the same Runtime commit must produce byte-identical JARs and JSON files.
