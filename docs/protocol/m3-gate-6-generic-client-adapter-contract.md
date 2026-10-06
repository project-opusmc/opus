# M3 General Gate 6 Generic Client Adapter Contract — September 14, 2026

Status: **Architecture and cooperative-validation contract only.** This
document defines how a Generic Client adapter supplies normalized General Gate
6 evidence. It does not provide a target transport, change a client result,
claim vendor authorization, or authorize Gate 7.

## Boundary

The General Gate 6 core is target- and transport-neutral. It validates
normalized lifecycle sessions, computes aggregate status, and permits a Gate 7
handoff only from a sealed General Gate 6 `PASS` aggregate.

Target profiles and adapter bindings live outside that core. A Generic Client
adapter may use a separately implemented and reviewed external transport, but
the core neither selects nor describes a delivery technique. Target-specific
transport is an adapter responsibility, and no adapter binding is evidence of
technical readiness or authorization.

The current authority boundary remains:

| Boundary | State |
| --- | --- |
| Machine and account control | `OWNER-CONTROLLED` |
| Project experiment authorization | `OWNER-AUTHORIZED` |
| Vendor authorization | `UNRESOLVED / NOT CLAIMED` |
| Third-party target ownership | `THIRD-PARTY / NOT OPUS-OWNED` |

Owner authorization does not become vendor authorization.

## TargetAdapter operations

A conforming adapter accepts a validated target descriptor, a bound target
instance identity, bootstrap artifact identity, selected transport metadata,
and an evidence sink or run context. It emits observations for these ordered
operations:

```text
resolve_target
validate_target
prepare_transport
verify_bootstrap_artifact
load_bootstrap
resolve_entrypoint
start_bootstrap
verify_handshake
stop_bootstrap
cleanup
check_target_health
```

They map to the common lifecycle without target-specific names in the core:

```text
TargetResolved
TransportReady
BootstrapArtifactVerified
BootstrapLoaded
EntrypointReady
BootstrapStarted
HandshakeOk
BootstrapStopped
CleanupOk
TargetHealthy
```

An unimplemented target backend must return a structured `BLOCKED` observation
with a typed `NOT_SUPPORTED` code. It must not synthesize a successful later
stage or set a final session result directly.

## Target transport backend

`GenericClientAdapter` may consume a bound `TargetTransportBackend` for every
stage from transport preparation through target health. Once a backend is
bound, the adapter rejects direct lifecycle-operation overrides; the adapter
does not inspect the provider's implementation details.

The backend retains one run-specific binding:

```text
profile
target identity
process identity
instance/start identity
architecture
runtime
backend identity
provider identity
bootstrap artifact path, SHA-256, and version
run ID
```

A PID-only identity is not a valid backend binding. The backend revalidates
the process and instance identity before every provider operation. A changed
process instance invalidates the run and returns typed `TARGET_CHANGED`
evidence at the first affected lifecycle boundary.

For a non-fixture Generic Client `PASS`, the normalized evidence must retain a
valid backend binding that agrees with the normalized target and bootstrap
identity. A `PASS` session also requires concrete target identity,
architecture, and runtime values; `runtime: unresolved` cannot produce a
future live `PASS`.

The backend result vocabulary includes at least:

```text
SUCCESS
FAILED
NOT_SUPPORTED
TARGET_CHANGED
ARTIFACT_MISMATCH
TARGET_UNHEALTHY
```

It additionally distinguishes runtime, architecture, target-identity, and
run-context mismatches. The backend returns typed observations; the common
adapter and evaluator still derive the normalized session result.

## Transport state is not lifecycle success

The transport contract has three separate values:

| Layer | Values | Meaning |
| --- | --- | --- |
| Transport capability | `AVAILABLE`, `UNAVAILABLE`, `UNKNOWN` | Whether the primitive is observed to exist. |
| Transport preparation | `NOT_STARTED`, `READY`, `FAILED`, `BLOCKED` | Whether this target's adapter can prepare an actual lifecycle transport. |
| `TransportReady` stage | `PASS`, `FAIL`, `NOT_TESTED`, `BLOCKED` | The normalized General Gate 6 lifecycle outcome. |

`TransportReady=PASS` requires capability `AVAILABLE` and preparation `READY`.
A capability observation alone does not establish preparation, bootstrap
delivery, entrypoint resolution, or any later lifecycle stage.

## Current Badlion provider boundary

The Badlion profile is bound outside the core to
`badlion-native-control-plane`, whose provider identity is
`badlion-native-control-plane-provider`. That provider is an injection point
for a future separately implemented and reviewed selected-target control
plane. Its default behavior is typed `NOT_SUPPORTED`; it performs no process
discovery, attachment, load, control, or health operation.

The static readiness assessment is produced by:

```text
node scripts/assess-gate6-target-transport-readiness.mjs
```

It reports implementation readiness only, never a Gate 6 result. As of
September 14, 2026, the current Badlion configuration records
`transport_prepare: not_implemented`; load, entrypoint, start, handshake,
stop, cleanup, and health are likewise not implemented for a live Badlion
provider. The contract and cooperative provider fixture do not change that
fact.

## Evidence and normalization

Adapter observations use
`opus.m3.gate6.generic-client-adapter-observations.v1`. The common producer
derives, rather than accepts, the final
`opus.m3.gate6.session.v1` result from the ordered stages. It preserves
`NOT_TESTED` for every unreached later stage.

An importer for retained transport-readiness evidence must bind the evidence
manifest's `intended_profile` exactly to the selected target profile. Imported
evidence records its source manifest and remains bounded by what that source
actually proves.

For the retained September 14 Badlion assessment, the imported observations
are limited to:

```text
TargetResolved: PASS
Transport capability: AVAILABLE
TransportReady: BLOCKED
Later stages: NOT_TESTED
```

That is not a Badlion `PASS`, does not alter Lunar, does not make General Gate
6 `PASS`, and does not unlock Gate 7. A live target `PASS` still requires
retained, normalized evidence for every lifecycle stage and the common
evaluator's successful result.
