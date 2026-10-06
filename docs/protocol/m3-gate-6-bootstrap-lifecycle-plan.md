# M3 Gate 6 General Bootstrap Lifecycle Plan — September 11, 2026

> **Current-status notice — September 15, 2026:** this is the retained
> lifecycle contract and Branch A implementation record. General Gate 6 is now
> `FROZEN / EVIDENCE-PRESERVED`; use the
> [September 15 current policy and status record](m3-general-gate-6-current-policy-status-2026-09-15.md)
> for project-state decisions. No historical client evidence was rewritten, and
> this document does not authorize new target execution or evidence promotion.

Status: **FROZEN / EVIDENCE-PRESERVED. Branch A (Opus-owned Client) is verified
by the staged regression. The Generic Client profiles (Badlion and Lunar) are
`NOT TESTED`. Therefore the single General Gate 6 is not `PASS`. Any
`BootstrapLoadReady` result remains limited to its artifact-bound owned-host
evidence unless a normalized session for every required target and an explicit
owner confirmation are separately available after an explicit R&D resumption.**

## Boundary from Gate 5

Gate 5 is closed as `NativeExecutionReady` for its recorded one-PID
experiment. Its result is limited to a temporary marker routine; it does not
prove module delivery, module lifetime, JNI/JVMTI, Java, mappings, hooks, or
client support.

The General Gate 6 core must not prescribe, select, or implement a
third-party delivery mechanism. Gate 6 begins with an Opus-controlled arm64
host fixture using ordinary in-process module loading. A Generic Client adapter
may use a separately implemented and reviewed external transport for permitted
target-specific lifecycle work, but the core supplies no delivery technique.
Any third-party-client experiment requires a separately reviewed integration
surface, containment, lifecycle evidence, and the applicable authorization
boundary.

## Branch A — Opus-owned Client implementation

- `opus-bootstrap.dylib` exposes only the versioned pure-native
  `opus_bootstrap_start` and `opus_bootstrap_stop` ABI.
- `opus-bootstrap-host` loads that artifact only into itself with ordinary
  local `dlopen`, validates nonce-derived handshake and stop acknowledgements,
  then records the result of its `dlclose` attempt.
- `check-injector-native-bootstrap-lifecycle.sh` executes the staged
  `1 -> 3 -> 10 -> 25` ladder, verifies artifact identity before and after
  each stage, covers typed invalid-artifact and artifact-identity-mismatch
  rejection, and retains raw witnesses under `output/m3-gate-6/<run-id>/`.

This implementation never selects a PID, opens a task port, or interacts with
Badlion, a JVM, JNI/JVMTI, Java, Minecraft APIs, mappings, hooks, or
persistence.

## General Gate 6 contract

Gate 6 is one lifecycle gate with two branches, not separate owned/live
gates:

```text
Branch A — Opus-owned Client
  `opus-owned` profile

Branch B — Generic Client
  `badlion` profile
  `lunar` profile
```

The target-neutral lifecycle contract is:

```text
TARGET_RESOLVED
  -> TRANSPORT_READY
  -> BOOTSTRAP_ARTIFACT_VERIFIED
  -> BOOTSTRAP_LOADED
  -> ENTRYPOINT_READY
  -> BOOTSTRAP_STARTED
  -> HANDSHAKE_OK
  -> BOOTSTRAP_STOPPED
  -> CLEANUP_OK
  -> TARGET_HEALTHY
```

The repository implements this contract in a target-neutral evidence core:

| Component | Responsibility |
| --- | --- |
| `scripts/gate6-lifecycle-core.mjs` | Validates the versioned normalized target-session schema, lifecycle/stability policy, generic composition, aggregate, and seal schemas. It constructs a Gate 7 handoff only from a sealed `PASS` aggregate. It contains no target/client names or transport implementation. |
| `config/gate6/profiles/*.json` | Supplies the production target descriptor/profile data outside the core. The Badlion and Lunar profiles deliberately remain `NOT TESTED`; they do not carry a live claim. |
| `scripts/gate6-general-composition.mjs` | Defines the current General Gate 6 composition and profile slots outside the target-neutral core: Branch A is `opus-owned`; Branch B requires `badlion` and `lunar`. |
| `scripts/normalize-gate6-owned-witness.mjs` | Branch A adapter. It consumes the existing owned-host raw witnesses and emits a normalized session only after validating every required lifecycle witness. |
| `scripts/gate6-generic-client-adapter.mjs` | Defines the target-neutral Generic Client `TargetAdapter` contract, cooperative execution boundary, and normalized-session producer. It does not implement a client-specific transport. |
| `scripts/gate6-target-transport-backend.mjs` | Defines the adapter-side run binding, typed provider-result contract, per-operation target revalidation, and artifact-identity enforcement. It does not select or execute a target transport. |
| `scripts/gate6-badlion-native-transport-provider.mjs` | Defines the Badlion provider injection point outside the core. Without a separately supplied control plane it returns typed `NOT_SUPPORTED` and performs no live operation. |
| `scripts/assess-gate6-target-transport-readiness.mjs` | Emits a machine-readable implementation-readiness assessment from bindings. It is not a Gate 6 result and performs no target operation. |
| `config/gate6/adapter-bindings.json` | Binds a target profile to an adapter outside the core. A binding records adapter responsibility; it is not live evidence or authorization. |
| `scripts/evaluate-gate6.mjs` | Production-oriented evidence-ingestion CLI. It validates supplied normalized evidence in its declared profile slot, supplies canonical `NOT_TESTED` placeholders for omitted target slots, evaluates the configured aggregate, and emits a normalized aggregate status artifact. |
| `tests/fixtures/gate6/` | Holds generic-cooperative and explicit test-only owner-confirmation fixtures. It is test data only, never production or live-client evidence. |
| `tests/verify-gate6-general-lifecycle.mjs` | Exercises generic lifecycle validation, the complete aggregate/seal invariant, the production evidence-slot CLI, test-only owner-confirmation blocking, and the Gate 7 seal boundary. |

The core consumes evidence from an adapter or an externally supplied,
schema-valid session. It does not select a target, attach to a process, or
describe a third-party delivery procedure.

### Composition, aggregate, seal, and Gate 7 handoff

The evidence types have deliberately different authority:

```text
adapter evidence
  -> Gate6TargetSession                 one normalized target lifecycle result
  -> Gate6Aggregate                     all profiles required by a composition
  -> Gate6Seal                          only a PASS aggregate with valid owner confirmation
  -> Gate6SessionReady                  the only Gate 6 input accepted by Gate 7
```

A `PASS` target session is not a Gate 7 handoff. An unsealed aggregate is not
a Gate 7 handoff. `gate7SessionReady` accepts only
`opus.m3.gate6.seal.v1`, validates the sealed aggregate again, and rejects
individual sessions or incomplete aggregates. For the current General Gate 6
composition, a seal therefore requires `opus-owned`, `badlion`, and `lunar`
to be `PASS` plus explicit valid owner confirmation.

The named General composition lives outside the core so the lifecycle core
remains target-neutral. It does not make a Branch A success evidence for
Branch B, and it does not treat target profile metadata as authorization.

### Production evidence ingestion and missing-evidence behavior

`node scripts/evaluate-gate6.mjs` accepts optional absolute paths for
`--owned-session`, `--badlion-session`, `--lunar-session`, and
`--owner-confirmation`, with optional `--output`. It validates every supplied
session through the common core, requires the session profile to match its
declared input slot, and rejects duplicate slot arguments or a profile supplied
in the wrong slot. File existence alone is never a `PASS`.

Omitted target-session inputs become canonical `NOT_TESTED` placeholders.
An absent owner-confirmation record remains explicit `BLOCKED` output from the
evaluator (while the policy record may describe the owner action as pending).
A test-only owner-confirmation fixture cannot promote the production CLI
result. With only the real owned-harness session supplied, the normalized
output must remain:

```yaml
Gate_6: NOT_TESTED
Branch_A_Opus_owned: PASS
Branch_B_Generic_Client: NOT_TESTED
Badlion: NOT_TESTED
Lunar: NOT_TESTED
Owner_confirmation: BLOCKED
Gate_7_ready: false
```

### Target descriptor and adapter boundary

The profile-supplied `TargetDescriptor` contract is intentionally data-only:

```yaml
id: stable profile identifier
kind: opus-owned-client | generic-client
architecture: observed or unresolved value
runtime: observed or unresolved value
metadata: target-specific diagnostics only
```

An adapter is conformant only when it turns its own permitted observations into
the normalized session stages in the common schema. The adapter boundary is
therefore semantic rather than a prescribed transport implementation:

```text
resolve target
  -> validate target
  -> prepare permitted transport
  -> verify artifact identity
  -> load / resolve entrypoint / start
  -> verify handshake
  -> stop / cleanup
  -> check target health
  -> emit normalized session
```

The Generic Client adapter contract is documented in [the Generic Client
Adapter Contract](m3-gate-6-generic-client-adapter-contract.md). A Generic
Client adapter may provide a separately implemented and reviewed external
transport, while the common core remains transport-neutral and specifies no
delivery technique. Target-specific transport is the adapter's responsibility;
an adapter observation or binding cannot itself produce a target `PASS`.

The adapter-side target transport backend is documented in [the Target
Transport Backend Contract](m3-gate-6-target-transport-backend-contract.md).
It binds one revalidated process instance, retains artifact and run identity,
and returns typed observations to the Generic Client adapter. The current
Badlion provider boundary is intentionally non-executing without a separately
implemented control plane; it does not change retained Badlion evidence or
make `TransportReady` pass.

The General Gate 6 core never implements a profile-specific branch for these
steps. Any external-target experiment must remain inside the selected-target,
owner-authorized local research scope and evidence boundaries in [the current
General Gate 6 policy and status
record](m3-general-gate-6-current-policy-status-2026-09-15.md). That scope is
not vendor authorization, does not make a target `PASS`, and does not permit a
profile-specific branch in the core. The September 12 `NO-GO` records remain
historical provenance rather than the current project-state authority.

### General pass invariant

```text
Gate6 == PASS
IFF
OpusOwned == PASS
AND Badlion == PASS
AND Lunar == PASS
AND OwnerConfirmed == true
```

The state set is exactly `PASS`, `FAIL`, `NOT_TESTED`, and `BLOCKED`.
`FAIL` dominates a required branch; otherwise `BLOCKED` dominates
`NOT_TESTED`. If every required target session is `PASS` but owner
confirmation is absent, Gate 6 is `BLOCKED`, never `PASS`.

Current status is intentionally:

```yaml
Gate_6: NOT_TESTED
Branch_A_Opus_owned: PASS
Branch_B_Generic_Client: NOT_TESTED
Badlion: NOT_TESTED
Lunar: NOT_TESTED
Owner_confirmation: PENDING
```

## Exact Branch A objective

Demonstrate, in the owned-harness lane only, that an artifact-identifiable
arm64 `opus-bootstrap.dylib` can participate in a bounded, versioned native
lifecycle:

```text
verify artifact -> host loads module -> bootstrap start
                -> deterministic handshake -> logical stop
                -> cleanup acknowledgement -> host unload attempt
```

The proof is about the module's own lifecycle in an Opus-owned process. It does
not establish that a JVM, Badlion, Lunar, or any other third-party target will
accept the artifact or provide a delivery surface.

`opus-bootstrap.dylib` must remain pure native C/C++. It must not link to or
call JNI/JVMTI, Java, Minecraft/Badlion APIs, hooks, or the Opus runtime. The
existing `opus-runtime` target is not reusable for this gate because it
requires JNI.

## Component boundaries

| Component | Responsibility |
| --- | --- |
| Owned-harness control plane | `opus-bootstrap-host` and its test runner create the session identity, validate state/events, and retain artifact/evidence manifests without exposing a selected-PID command. |
| Rust control plane (future) | May consume the same versioned ABI/event schema only after a separately approved integration review; it is not needed for the current owned-harness proof. |
| `macos_transport` | Existing Gate 3–5 commands only. Gate 6 planning must not widen its selected-PID behavior. |
| `opus-bootstrap.dylib` | Pure-native, versioned start/stop ABI and deterministic handshake only. |
| `opus-bootstrap-host` | Opus-owned arm64 fixture that loads the bootstrap through its normal local process lifecycle and exposes test observations. |
| Gate 6 tests | Verify only artifact and fixture lifecycle; they do not select, modify, or control a third-party process. |

## Pass and fail semantics

`BootstrapLoadObserved` is a one-cycle observation. It requires all of the
following:

1. host, bootstrap, and control-plane architecture identities are `arm64`;
2. the exact bootstrap artifact is identified before loading;
3. the host resolves the declared, versioned entrypoints;
4. the bootstrap returns the exact nonce- and ABI-derived handshake;
5. logical stop returns a matching acknowledgement;
6. the host remains alive through the stop path; and
7. raw machine witnesses for the cycle are retained.

The Branch A host emits `BootstrapLoadReady` when `iterations >= 25`; it does
not retain cross-invocation state and therefore cannot know whether the
`1 -> 3 -> 10` stages ran first. That host behavior is retained for
compatibility with the historical owned witness.

The **General Gate 6 core** now enforces `1 -> 3 -> 10 -> 25` as lifecycle
policy for any normalized `PASS` session: `completed_stages` must exactly
record that ladder and `completed` must be at least 25. Thus the host's
single-invocation readiness behavior and the General Gate 6 readiness policy
are deliberately distinct. A successful host invocation at 25 iterations
alone is not a General Gate 6 `PASS`.

A branch-level readiness claim requires the ladder to complete with every
cycle satisfying the conditions above, all cleanup outcomes known and
successful, no artifact identity drift, no typed error, and no host failure.
The single Gate 6 still also requires the other required target sessions and
explicit owner confirmation. If a target has a UI, final promotion requires an
owner-recorded manual responsiveness observation; no value is inferred from
PID survival.

Any missing witness, identity mismatch, invalid handshake, nonmatching stop
acknowledgement, unknown lifecycle state, failed cleanup, or host exit is a
failure for that cycle. An unknown outcome after start is not a pass-with-note:
it enters `BootstrapCleanupRequired` and blocks promotion until the state is
resolved from retained evidence.

## Lifecycle and cleanup state machine

The start/stop ABI should receive a caller-owned control block containing only
the facts needed to prove this lifecycle:

- ABI magic and ABI version;
- session nonce;
- requested action and observed state;
- typed status/error value;
- deterministic nonce- and ABI-derived handshake; and
- stop and cleanup acknowledgement fields.

The bootstrap must not retain caller pointers after a successful stop
acknowledgement.

```text
NotStarted
  -> TargetResolved
  -> TransportReady
  -> ArtifactVerified
  -> BootstrapLoadPending
  -> BootstrapModuleLoaded
  -> BootstrapEntrypointReady
  -> BootstrapStartPending
  -> BootstrapStarted
  -> BootstrapHandshakeOk
  -> BootstrapLoadObserved
  -> BootstrapLoadReady              (host: iterations >= 25;
                                      General core: full ladder required)
  -> BootstrapStopPending
  -> BootstrapStopped
  -> BootstrapUnloadPending
  -> BootstrapCleanedUp

Any state after module load:
  -> BootstrapCleanupRequired
  -> BootstrapCleanupFailed | BootstrapCleanedUp
```

Logical stop must happen before the host attempts unload. Cleanup verifies the
matching nonce/session, that the bootstrap has acknowledged quiescence, and
that the host no longer uses bootstrap-owned entrypoints or control-block
memory. A loader call returning success may be recorded as an unload
observation, but the evidence must not claim physical unmapping when the
platform loader or another reference makes that unobservable. If stop,
unload, or cleanup is unknown or fails, retain the witness, close only
host-owned resources that are known safe to close, and report
`BootstrapCleanupRequired` or `BootstrapCleanupFailed`; do not promote the
cycle.

## Typed event and failure model

The control-plane contract should emit a typed lifecycle event for each state
transition and distinguish at least:

```text
BootstrapArchitectureMismatch
BootstrapArtifactInvalid
BootstrapArtifactIdentityMismatch
BootstrapEntrypointMissing
BootstrapAbiUnsupported
BootstrapHandshakeInvalid
BootstrapNonceMismatch
BootstrapLoadTimedOut
BootstrapStartFailed
BootstrapStopFailed
BootstrapUnloadFailed
BootstrapCleanupFailed
BootstrapHostExited
BootstrapEvidenceMissing
```

An event must include the session identifier, sequence number, requested
action, observed state, typed outcome, and the relevant artifact identities.
Free-form stderr is supplementary diagnostic material, never the sole success
witness.

## Artifact identity and raw machine witnesses

Before every run, produce a machine-readable artifact manifest for the exact
bootstrap, host, and control-plane binaries used. At minimum it records:

- absolute build-output path and SHA-256;
- file size, Mach-O architecture, signing state, and code-signing identity when
  present;
- bootstrap install name and the declared start/stop symbol names;
- ABI magic/version and expected handshake algorithm identifier;
- source branch, HEAD, dirty/staged state, build command, and build timestamp;
- host and control-plane artifact identities; and
- run/session identifier and explicit owned-harness target identity.

Raw witnesses must be preserved without hand-editing under the ignored,
run-scoped build-output path:

```text
output/m3-gate-6/<run-id>/
  manifest.json
  artifact-identity.json
  lifecycle-events.jsonl
  host-stdout.log
  host-stderr.log
  cleanup.json
  checksums.sha256
```

The manifest may summarize those files, but cannot replace them. Witnesses must
exclude credentials, session tokens, unrelated-process data, and mutable
unverified claims. A changed artifact hash, branch/working-tree provenance, or
ABI version starts a new evidence series; it cannot inherit a previous ladder.

## Evidence and regression strategy

The test harness, rather than the host implementation, progresses through the
following stages only after every prior stage is clean:

```text
1 cycle  -> BootstrapLoadObserved
3 cycles -> regression signal
10 cycles -> stability signal
25 cycles -> BootstrapLoadReady candidate
```

Each successful cycle records the exact ABI version, nonce-derived handshake,
state sequence, stop acknowledgement, cleanup outcome, host survival, and raw
machine witness path. Gate 3–5 regressions remain mandatory and unchanged.
Gate 6 tests must not select Badlion, discover arbitrary processes, or
reinterpret an Opus-controlled-host result as Badlion compatibility.

### Normalized evidence schema

Every adapter or externally produced evidence bundle must normalize to
`opus.m3.gate6.session.v1` before it can enter a branch aggregate:

```yaml
schema_version: opus.m3.gate6.session.v1
run_id: required for PASS
target:
  profile: profile-defined identifier
  identity: target-specific evidence identity
  architecture: observed architecture
  runtime: observed runtime
  metadata: target-specific diagnostics only
  status: PASS | FAIL | NOT_TESTED | BLOCKED
bootstrap:
  artifact: absolute path for PASS
  sha256: exact lowercase digest for PASS
  version: ABI/version identity for PASS
transport/bootstrap_artifact/load/entrypoint/start/handshake/stop/cleanup/target_health:
  status: PASS | FAIL | NOT_TESTED | BLOCKED
iterations:
  requested: integer
  completed: integer
  stability_ladder: [1, 3, 10, 25]
  completed_stages: [1, 3, 10, 25] # required for PASS
result: PASS | FAIL | NOT_TESTED | BLOCKED
```

`start.nonce`, `handshake.expected_nonce`, and
`handshake.observed_nonce` are required and equal for a `PASS` session. The
current nonce remains a deterministic counter (`base + iteration - 1`), with
no entropy or replay protection. Artifact identity is never a generic
“bootstrap hash”; it is a per-session tuple:

```text
run_id + absolute artifact path + SHA-256
```

Generic client evidence is an input to this schema, not permission to produce
it. A fixture or owned-harness result cannot create a Badlion/Lunar result,
vendor authorization, or a General Gate 6 `PASS`. Current project authority
and experiment scope are defined by [the current General Gate 6 policy and
status record](m3-general-gate-6-current-policy-status-2026-09-15.md); the
September 12 `NO-GO` records remain historical provenance.

## Boundary with Gate 7

Gate 7 begins only after a separately approved scope and contract for a
native-to-JVM bridge. Its only Gate 6 input is
`opus.m3.gate6.session-ready.v1`, which may be constructed only from a valid
`opus.m3.gate6.seal.v1`. The seal binds Gate 7 to the full configured General
Gate 6 aggregate: every mandatory target `PASS` and a valid explicit owner
confirmation. No individual target session, including a successful
Opus-owned Branch A session, may unlock Gate 7.

Gate 7 owns any future JNI/JVMTI interaction, Java class lookup, JVM lifecycle
integration, mappings, or client-specific behavior. None of those actions
belong to the General Gate 6 core. The core also excludes Minecraft/Badlion
APIs, hooks, module/runtime hosting, persistence, and remote-process
selection. Any separately implemented external transport remains an
adapter-owned responsibility, is not prescribed by this plan, and still
requires retained live evidence before a target can be `PASS`.

## General Gate 6 implementation status

1. **Complete for Branch A:** ABI, full lifecycle event schema, artifact
   manifest, raw-witness layout, normalization adapter, and artifact identity
   validation are implemented and exercised by the owned regression.
2. **Complete for Branch A:** the standalone pure-native arm64 bootstrap
   target and Opus-controlled host fixture build in both architecture slices;
   only arm64 executes the fixture.
3. **Complete for the General contract:** a target-neutral core validates
   profile-driven sessions, enforces the `1 -> 3 -> 10 -> 25` lifecycle policy
   for `PASS`, implements the four-state model, validates the aggregate/seal
   `PASS` invariant including explicit owner confirmation, and prevents
   individual target-session handoff to Gate 7.
4. **Complete for production ingestion:** the profile-slot CLI can evaluate
   externally produced normalized evidence without modifying the core. Missing
   evidence remains `NOT_TESTED`; test-only confirmation remains blocked.
5. **Complete as architecture/cooperative validation only:** the Generic
   Client adapter contract, Badlion profile binding, retained
   transport-readiness importer, and normalized-session producer keep
   capability distinct from lifecycle `PASS`. They contain no Badlion target
   transport and produce no live client result.
6. **Complete as architecture/cooperative validation only:** the target
   transport backend contract binds a run to a revalidated process instance,
   preserves typed failure classes, and is consumed by the Generic Client
   adapter. The Badlion provider binding returns `NOT_SUPPORTED` without an
   explicitly supplied provider implementation, so the first live gap remains
   `TransportReady`.
7. **Complete as fixtures only:** generic cooperative and test-only
   owner-confirmation fixtures use the same schema. They are not live client
   evidence and cannot resolve production owner confirmation.
8. **Recorded:** the clean owned-harness reproduction and exact per-run
   artifact tuples are summarized in
   [the September 12 reproducibility record](m3-gate-6-owned-harness-reproducibility-record-2026-09-12.md).
9. **Not required for the owned-harness proof:** preserve Gate 3–5 output and
   tests; any later split must remain scoped as follows:

   ```text
   macos_transport  CLI dispatch
   macos_task       PID/task-port diagnostics
   macos_vm         VM probes
   macos_execution  Gate 5
   macos_loader     future separately approved loader boundary
   bootstrap        pure-native artifact and owned fixture
   ```

10. **Future review required:** any third-party-client integration or Gate 7
   work remains out of scope. Branch B remains `NOT TESTED`; use [the current
   General Gate 6 policy and status
   record](m3-general-gate-6-current-policy-status-2026-09-15.md) for current
   project-state decisions. The September 12 `NO-GO` records remain historical
   provenance only.
