# M3 General Gate 6 Target Transport Backend Contract — September 14, 2026

Status: **Production-facing interface and cooperative validation only.** This
contract adds no live Badlion transport, does not select or contact a process,
and does not create a Gate 6 result.

## Purpose

The target-neutral General Gate 6 core remains responsible only for
normalization, evaluation, composition, sealing, and the Gate 7 boundary. A
`TargetTransportBackend` is an external adapter-side boundary:

```text
Target profile
  -> GenericClientAdapter
  -> TargetTransportBackend
  -> target-specific transport provider
  -> lifecycle observations
  -> normalized Gate6TargetSession
```

The Generic Client adapter consumes the backend through these operations:

```text
prepare
verifyArtifact
load
resolveEntrypoint
start
verifyHandshake
stop
cleanup
checkHealth
```

The backend returns structured observations containing status, typed code,
message, and evidence. It cannot set a final Gate 6 session result.

## Run binding and revalidation

Each backend instance is bound to exactly one selected process instance and
retains:

- target profile;
- target identity plus distinct process and instance/start identities;
- architecture and runtime;
- backend and provider identities;
- exact bootstrap artifact identity; and
- run ID.

The backend compares the adapter context to that binding and asks its provider
to revalidate the target before every operation. A PID alone is not accepted
as an immutable target identity. A change in process or instance identity
invalidates the run with `TARGET_CHANGED`; an architecture mismatch,
unresolved runtime on an attempted success, and artifact drift have separate
typed outcomes.

## Passing and blocked outcomes

A backend operation may return `SUCCESS`, `FAILED`, `NOT_SUPPORTED`,
`TARGET_CHANGED`, `ARTIFACT_MISMATCH`, or `TARGET_UNHEALTHY`, with further
typed identity/context diagnostics where needed.

`prepare` separately reports transport capability and preparation. Only
`AVAILABLE` plus `READY` can normalize to `TransportReady=PASS`. A default
provider with no implemented target control plane reports `NOT_SUPPORTED`,
which normalizes to `TransportReady=BLOCKED` and stops the lifecycle without
manufacturing later stages.

For a non-fixture Generic Client `PASS`, the normalized session must retain a
matching backend binding and concrete target identity, architecture, runtime,
and bootstrap artifact fields. `runtime: unresolved` is valid only for
non-passing retained evidence.

## Badlion binding and readiness

Badlion’s provider binding lives in:

```text
config/gate6/adapter-bindings.json
config/gate6/target-transport-backend-bindings.json
```

The provider object is defined outside the core and delegates only to an
explicitly supplied control plane. Without one it performs no live operation
and reports `NOT_SUPPORTED`.

`scripts/assess-gate6-target-transport-readiness.mjs` emits a machine-readable
implementation-readiness artifact. It does not execute a client operation or
declare a Gate 6 status. The current configuration honestly records that a
real Badlion transport preparation implementation is absent; therefore the
first unimplemented live lifecycle transition remains:

```text
TargetResolved -> TransportReady
```

No vendor authorization is claimed. Owner authorization for bounded local
research remains separate from vendor authorization.
