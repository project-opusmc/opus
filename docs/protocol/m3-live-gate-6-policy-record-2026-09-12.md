# M3 Live Gate 6 Policy Record — September 12, 2026

> **Historical record — superseded for current project-state decisions.**
> This preserves the former September 12, 2026 Gate 6A/live-Gate-6 planning
> decision, including its dated `NO-GO`. For the active General Gate 6
> architecture, use [the current General Gate 6 policy and status
> record](m3-general-gate-6-current-policy-status-2026-09-15.md). This notice
> does not claim vendor authorization or alter this record's historical
> findings.

Status: **planning record only; no implementation or live execution is
authorized by this record.**

## Executive policy state

| Field | Value |
| --- | --- |
| `policy_record_id` | `opus.m3.live-gate-6-policy.2026-09-12` |
| `created_at` | `2026-09-12` |
| `owned_harness_status` | `SEALED / PASS` |
| `live_gate_6_status` | `NOT TESTED` |
| `execution_status` | `NO-GO` |
| `live_run_id` | `UNASSIGNED` |
| `authorization_basis` | `UNRESOLVED` |
| `approved_integration_surface` | `UNRESOLVED` |
| `operator` | `UNRESOLVED` |
| `reviewer` | `UNRESOLVED` |

`owned_harness_status` applies only to the Opus-owned bootstrap host fixture.
It does not establish that a third-party JVM accepts module delivery, native
entry, lifecycle control, or cleanup.

## Target identity

The following is target-identifying metadata only. It is not an authorization
claim, approval, or approved integration surface.

| Field | Value | Provenance |
| --- | --- | --- |
| `target_class` | Local third-party Lunar Client game JVM | Planning-policy seal, Section 8 |
| `observed_pid` | `67644` | Historical read-only `ps` observation recorded by the planning-policy seal |
| `target_runtime_family` | Lunar Client Zulu-17 Java JVM | Historical read-only observation |
| `target_architecture` | `arm64` | Historical read-only observation |
| `target_identity_source` | `transcript-derived / audit-reported read-only metadata` | Planning-policy seal, Section 8 |
| `live_run_target_identity` | `UNRESOLVED` | No live Gate 6 run exists |
| `authorization_reference` | `UNRESOLVED` | No applicable retained authorization record was supplied |

The PID is not durable run identity. Any future execution record must identify
the exact target binary/build and architecture at the time of that run without
retaining credentials, session tokens, or raw game command lines.

## Authorization and integration boundary

```text
authorization_basis: UNRESOLVED
approved_integration_surface: UNRESOLVED
execution_status: NO-GO
```

The Lunar vendor non-prohibition record is a reported general
non-prohibition, not a vendor-approved integration package. It supplies no
approved client build, cooperative entry point, automated lifecycle-testing
authorization, or representable `vendor-approved` authorization record.
It therefore cannot be substituted for `authorization_basis` here.

The repository's remote-runtime-load primitive and the owned-harness bootstrap
lifecycle are separate technical capabilities. Their presence does not approve
combining them on a live target.

## Live run identity and artifact identity

No live Gate 6 run is planned or approved by this record:

```text
run_id: UNASSIGNED
helper_identity: UNASSIGNED
bootstrap_identity: UNASSIGNED
runtime_identity: UNASSIGNED
```

For every future proposed run, each artifact identity must be recorded as a
tuple bound to that exact run:

```text
run_id + absolute artifact path + SHA-256
```

There is no canonical “SHA-256 of the bootstrap.” The bootstrap is ad-hoc
signed per build, so builds from the same source may have different hashes.
No hash from an owned-harness witness is assigned to a future live run by this
record.

## Semantic constraints

1. The Gate 6 `nonce` is a deterministic iteration token:
   `base + iteration - 1`. It has no entropy and provides no replay
   protection. It may be used for harness correlation only.
2. In the current host, `BootstrapLoadReady` is equivalent to
   `iterations >= 25`. The `1 -> 3 -> 10 -> 25` ladder is test-harness
   discipline, not an invariant the host enforces by requiring prior stages in
   sequence.
3. Artifact identity is per run. Claims must use `run_id + path + SHA-256`,
   not a bootstrap-wide hash value.

## Permitted and prohibited actions under this record

| Category | Policy |
| --- | --- |
| Permitted | Documentation-only planning, review of retained evidence, and creation of a future execution proposal |
| Prohibited | Building, attaching, task-port acquisition, target selection, memory access, dylib delivery, remote entrypoint invocation, JNI/JVMTI, Java interaction, hooks, persistence, or any other live action |
| Inference prohibited | Treating target metadata, a historical `ps` observation, a capability primitive, an owned-harness pass, or general vendor non-prohibition as authorization |

## Expected side effects

No live action is approved, so the only expected side effect under this record
is creation and review of policy documentation.

A future execution proposal must enumerate the exact expected target and
host-side effects before `execution_status` can change. It must also state
which effects are prohibited and how unexpected effects are detected. This
record does not pre-approve module delivery, execution, target-memory changes,
or any persistent target state.

## Stop conditions

Execution remains stopped, and must not be started, if any of the following is
true:

- `authorization_basis` is absent, ambiguous, or not applicable to the exact
  target;
- `approved_integration_surface` is absent or not separately reviewed;
- a unique `run_id` and per-run artifact identities are not retained before
  action;
- target identity is stale, mismatched, or incomplete;
- expected side effects, stop conditions, or evidence destination are missing;
- the owner-sanity procedure is not available for the intended run; or
- cleanup and rollback behavior cannot be specified and observed.

Any future run must also stop on typed lifecycle failure, artifact identity
drift, unexpected target-health change, missing evidence, or a failed owner
sanity observation.

## Evidence destination

No evidence bundle has been created by this record. The destination contract
for a separately approved future live run is:

| Evidence | Required destination |
| --- | --- |
| Raw machine witnesses | `output/m3-gate-6/live/<run_id>/` |
| Tracked, human-readable run record | `docs/protocol/m3-live-gate-6-run-<run_id>.md` |
| Policy reference | This record's `policy_record_id` |
| Artifact identities | The future run record and raw witness manifest, each bound to the same `run_id` |
| Output integrity | SHA-256 for retained stdout, stderr, record, and witness bundle manifest |

The ignored `output/m3-gate-6/` directory is insufficient by itself for a
repository milestone claim. A future run must retain a tracked provenance
record in addition to raw witnesses.

## Owner sanity procedure

Before any future execution decision, the owner must define and record a
manual health procedure for the exact target session:

1. observe the target UI and in-game input before the action;
2. observe UI responsiveness and in-game input after the action;
3. record whether disconnect/reconnect behavior is unaffected when applicable;
4. record observer and local timestamp; and
5. mark each observation `true`, `false`, or `not observed`.

Process survival alone is not a substitute for these observations. Missing
owner sanity evidence blocks promotion of a future technical result.

## Rollback and cleanup expectations

No target cleanup is needed for this documentation-only record. A future
execution proposal must define, before any action:

- a bounded logical stop protocol;
- cleanup acknowledgement and retained witness requirements;
- the conditions under which a loader unload observation may be claimed;
- a rollback path for host-side resources; and
- a stop-and-escalate path when cleanup is unknown or fails.

It must not claim physical module unmapping merely because a loader call
returns success. Unknown or failed cleanup blocks result promotion and
requires an explicit `cleanup required` or `cleanup failed` outcome.

## Known evidence limitations

- Reconciliation addendum after this record's original creation: an
  Opus-owned harness negative test now demonstrates
  `BootstrapArtifactIdentityMismatch` with a deliberately drifted artifact.
  Its evidence is bounded to the owned lane; it is not live Gate 6 evidence.
  See [the September 12 owned-harness reproducibility record](m3-gate-6-owned-harness-reproducibility-record-2026-09-12.md).
- Current raw Gate 6 witness bundles remain under ignored
  `output/m3-gate-6/`. The linked repository-resident summary is uncommitted
  in the current worktree and must not be described as HEAD-backed until the
  owner elects to stage and commit it.
- No live Gate 6 evidence exists.
- Historical `ps` observations, including the observation of PID `67644`, are
  read-only reconnaissance. They are neither Gate 6 tests nor authorization.

## Record provenance

This record was created as reconciliation metadata after the Live Gate 6
Planning / Policy Seal dated September 12, 2026. It is based on:

- the externally supplied planning-policy seal;
- [M3 Gate 6 Bootstrap Lifecycle Plan](m3-gate-6-bootstrap-lifecycle-plan.md);
- [Decision 0007: Owner-authorized host experiment boundary](../decisions/0007-owner-authorized-host-experiment-boundary.md);
- [Lunar Client M3 Vendor Non-Prohibition Record](m3-lunar-vendor-non-prohibition-record.md); and
- [M3 Authorized Client Integration Evidence](m3-authorized-client-integration-evidence.md).

No artifact was built, hashed, or selected for a live run while creating this
record. No process was inspected, attached to, or modified. No live Gate 6
execution was attempted.

## Go / no-go decision

| Requirement | State | Blocking |
| --- | --- | --- |
| Policy record exists | `RECORDED` | No |
| Owned-harness Gate 6 result | `SEALED / PASS` | No, but not live evidence |
| Live target metadata | `PARTIALLY RECORDED` | Yes; not a current run identity |
| Authorization basis | `UNRESOLVED` | Yes |
| Approved integration surface | `UNRESOLVED` | Yes |
| Live `run_id` and artifact tuples | `UNASSIGNED` | Yes |
| Expected side effects and stop conditions | `PLANNED ONLY` | Yes |
| Evidence destination | `PLANNED ONLY` | Yes |
| Owner sanity procedure | `DEFINED, NOT EXECUTED` | Yes |
| Live Gate 6 evidence | `NOT TESTED` | Yes |

```text
LIVE GATE 6 EXECUTION: NO-GO
```
