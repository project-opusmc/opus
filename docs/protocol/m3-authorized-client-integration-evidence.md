# M3 Authorized Client Integration Evidence

Status: **schema v3 cooperative-evidence gate prepared; no M3 General live
Minecraft-JVM evidence has been captured**

This is a narrow cooperative-evidence schema, not the definition of the
client-independent M3 transport target or a general authorization policy. See
[M3 General](../m3-general-objective.md): transport selects an eligible
Minecraft JVM without treating a Lunar, Badlion, Forge, or Vanilla label as a
precondition. A process-side client hint is non-authoritative; client
classification and adapters remain later work.

This current contract exists so that an OPUS-owned or vendor-approved
cooperative integration can be reviewed against the same lifecycle requirements
as the test fixture, without allowing the fixture to be presented as client
certification. It is deliberately narrower than the M3 General target model:
it must not be used to declare a normal Minecraft JVM managed by the current OS
user out of scope merely because it lacks a vendor opt-in endpoint.

It does not authorize any transport. It only records evidence for the narrow
paths its current schema can represent.

## Current narrow schema boundary (not M3 target eligibility)

The evidence format accepts only a target that is one of:

- an OPUS-owned client with a source-controlled, opt-in runtime-control
  endpoint; or
- a vendor-approved client integration with the same explicit opt-in endpoint.

The target must self-load one startup-authorized runtime path. The M3
integration must not use an unbounded process transport, stealth behavior,
manual mapping, anti-detection, or modification of an unrelated process.

Before this schema is used for direct M3 General evidence on a normal
current-user-managed Minecraft JVM, its review requirements must be revised to
record explicit PID selection and target ownership without turning the injector
into an unbounded process controller. That future schema work is not source
authorization for transport implementation.

## Required proof

An evidence capture records:

```text
explicit authorized target identity
        ->
same-architecture runtime selection
        ->
protocol-v1 handshake
        ->
health(waiting)
        ->
load(Ready)
        ->
health(running)
        ->
unload(Stopped)
        ->
health(stopped)
        ->
repeat at least three times
        ->
clean stop and descriptor removal
```

The capture also records the exact client-build SHA-256 and native-runtime
SHA-256. It must set `capture.fixture` to `false`; the
`opus-authorized-test-harness` is deliberately rejected.

The target authorization record must include:

```text
mode: opus-owned | vendor-approved
reference: retained ticket, approval, or source-control review identifier
recordSha256: SHA-256 of the retained authorization/source-review record
approvedTransport: cooperative-opt-in
```

`recordSha256` records the reviewed authorization material without embedding
its contents in test output. It is traceability evidence, not a substitute for
reviewing the underlying written approval or OPUS-owned source-control record.

This schema does not determine M3 General completion. M3 remains incomplete
until the Definition of Done in [M3 General](../m3-general-objective.md) is
observed on the selected live Minecraft JVM. The structural verifier is not a
substitute for that review.

## Format and verification

The current machine-readable evidence is schema version `3` and has these
top-level fields:

```text
schemaVersion
scope
capture
target
transport
runtime
handshake
cycles
stop
```

Schema v3 additionally records a positive target PID plus `gameWindowReady`
and `gameStatus` evidence at capture time. After the cooperative control
endpoint stops, it requires explicit proof that the same game JVM remains
alive, its window remains ready, and its game lifecycle status remains
`running`. The verifier continues to accept schema v2 only for archived
evidence produced before these live-game checks existed.

Run the verifier against a capture produced by the integration test:

```bash
node ./scripts/verify-m3-client-integration-evidence.mjs \
  /absolute/path/to/m3-authorized-client-evidence.json
```

The verifier enforces the current M3 foundation handshake sentinels:
`javaRuntimeVersion=not-built`, `mappingSchemaVersion=not-applicable`,
`oneConfigAdapterVersion=not-loaded`, and `artifactChecksums=not-packaged`.
Classloader resolution, Java payload loading, OneConfig, adapters, and release
packaging belong to later gates.
