# M3 Live Gate 6 Authorization and Integration-Surface Review — September 12, 2026

> **Historical record — superseded for current project-state decisions.**
> This preserves the former September 12, 2026 Gate 6A/live-Gate-6 review and
> its dated unresolved fields. For the active General Gate 6 architecture, use
> [the current General Gate 6 policy and status
> record](m3-general-gate-6-current-policy-status-2026-09-15.md). This notice
> does not claim vendor authorization or alter the historical review.

Status: **policy reconciliation only. This review does not authorize
implementation, target interaction, or live Gate 6 execution.**

## Decision fields

```text
authorization_basis: UNRESOLVED
approved_integration_surface: UNRESOLVED
```

These fields answer independent questions. A technical primitive, target
metadata, prior target survival, host ownership, or a vendor general
non-prohibition cannot resolve either field by inference.

## A. Authorization review

The table below lists each plausible existing authorization artifact or record
and evaluates only what that artifact actually establishes.

| Artifact | Provenance | What it actually authorizes | What it does NOT authorize | Sufficient for live Gate 6? |
| --- | --- | --- | --- | --- |
| External `opus-m3-live-gate-6-planning-policy-seal-2026-09-12.md` | Externally supplied planning seal; not a tracked repository artifact | Policy planning and reconciliation | Live execution, a target, an operator, a runtime-delivery mechanism, or a lifecycle action | No |
| [M3 Live Gate 6 Policy Record](m3-live-gate-6-policy-record-2026-09-12.md) | Tracked reconciliation record created September 12, 2026 | Documentation-only planning and future-proposal requirements | A live run, target authorization, artifact assignment, or integration-surface approval | No |
| [Decision 0007: Owner-authorized host experiment boundary](../decisions/0007-owner-authorized-host-experiment-boundary.md) | Accepted project decision, September 11, 2026 | Owner responsibility for host-level research on the designated Mac, subject to containment and a separate target basis | Ownership of a third-party client, vendor authorization, a selected live target, or a Gate 6 delivery surface | No |
| [Lunar Client M3 Vendor Non-Prohibition Record](m3-lunar-vendor-non-prohibition-record.md) | Project-owner account of a retained but unattached vendor reply; response hash remains pending | At most, a reported general non-prohibition for benign injection | Vendor-approved integration, an eligible client build, a cooperative entry point, automated lifecycle-test permission, or a schema-valid authorization reference | No |
| [Optional Lunar Vendor Collaboration Request](../m3-lunar-vendor-authorization-request.md) | Superseded draft; never sent in that form | Nothing; it preserves questions a future vendor approval would need to answer | A vendor response, ticket, authorization, entry point, or live-test approval | No |
| [M3 Authorized Client Integration Evidence](m3-authorized-client-integration-evidence.md) | Tracked evidence schema | Evidence requirements for a pre-existing OPUS-owned or vendor-approved cooperative integration | Transport authorization, an owner-authorized-host capture, a general-non-prohibition mode, or a Gate 6 surface | No |
| [M3 Gate 6 Bootstrap Lifecycle Plan](m3-gate-6-bootstrap-lifecycle-plan.md) | Tracked owned-harness plan | The bounded, Opus-owned bootstrap lifecycle fixture | Third-party dylib delivery, selected-PID control, or a live-client integration surface | No |
| [Badlion Direct Task-Port Capability Record](m3-badlion-direct-task-port-capability-record-2026-09-11.md) | Owner-authorized, one-PID historical capability record | The recorded task-port probe in its stated window and host conditions | Runtime delivery, bootstrap entry, handshake, unload, reinjection, or any future Gate 6 run | No |
| [Current Badlion Live Gates 3–5 Record](m3-badlion-live-gates-3-5-record-2026-09-11.md) | Artifact-bound, bounded historical Gate 3–5 record | The specifically recorded Gate 3–5 diagnostic sequence | Gate 6, dylib delivery, bootstrap lifecycle, or authorization for another target/run | No |
| [Gate 5 Owner-Authorized Native Execution Record](m3-badlion-native-execution-record-2026-09-11.md) | Reconciled Gate 5 record with historical evidence separated | The limited native execution evidence stated in that record | Module delivery, bootstrap lifecycle, Java/JNI/JVMTI work, or Gate 6 authorization | No |
| [Gate 3–5 Reconciliation Record](m3-gate-3-5-reconciliation-record-2026-09-11.md) | Reconciliation record for implementation, cooperative, and bounded live evidence | Gate 3–5 evidence reconciliation and its stated scope decisions | A Gate 6 start, an approved delivery surface, or an authorization basis for a new live run | No |
| [M3 General Objective](../m3-general-objective.md) | Project objective and scope document | Target-selection and owner-authorized-host policy vocabulary | A retained target-specific authorization or approved integration mechanism | No |

### Authorization result

No retained artifact supplies all of the following for the exact future target:

1. a durable target-specific authorization reference;
2. a reviewed primary authorization artifact and its identity;
3. an applicable target/build scope;
4. explicit permission for the intended bounded lifecycle class; and
5. a non-inferred link between that authorization and the approved integration
   surface.

Therefore:

```text
authorization_basis: UNRESOLVED
```

## B. Integration-surface review

An approved integration surface is a policy and lifecycle contract, not merely
a technical capability or a procedure for reaching a process. The following
defines the minimum candidate contract that would need separate review. It is
not an approval and does not create a live execution path.

### Candidate contract boundary

| Contract topic | Minimum policy definition | Current state |
| --- | --- | --- |
| Opus components | A named Opus control plane, the exact bootstrap artifact, and the evidence collector must be versioned and identified per run | Owned-harness components exist; no live composition is approved |
| Non-Opus components | The named third-party client JVM, vendor artifacts, operating-system loader/security boundary, and game session remain outside Opus ownership | Identified as external; no target-side opt-in or approved build is retained |
| Allowed operation classes | Only the narrowly declared pure-native bootstrap lifecycle class necessary to establish identity, declared start, deterministic handshake, declared logical stop, cleanup acknowledgement, and bounded unload observation | Not approved for a live target |
| Prohibited operation classes | JNI/JVMTI, Java/Minecraft APIs, mappings, hooks, persistence, stealth, anti-detection, arbitrary payloads, broad process control, target-binary modification, and anti-integrity-repair interference | Must remain prohibited in any future proposal |
| Expected lifecycle | Artifact verification -> bounded bootstrap lifecycle -> deterministic observable handshake -> logical stop -> cleanup acknowledgement -> bounded unload observation -> target-health and owner-sanity observation | Proven only in the Opus-owned host |
| Observable side effects | Only predeclared module/lifecycle state and explicit host/target health observations may be recorded; no unlisted persistent target state is acceptable | Not approved or measured live |
| Cleanup and rollback | Logical stop precedes any unload observation; unknown cleanup blocks promotion; no physical-unmapping claim follows from a loader return alone | Defined for owned harness; no target-specific commitment exists |
| Required evidence | Target identity, authorization reference, per-run artifact tuples, typed lifecycle witnesses, stdout/stderr integrity, tracked run record, raw witness bundle, cleanup result, and owner sanity result | Schema is planned; no live bundle exists |
| Stop conditions | Missing authorization, absent surface approval, identity drift, missing witness, typed lifecycle failure, unexpected health change, failed/unknown cleanup, or failed owner sanity | Defined as policy; no execution approval |
| Owner-sanity boundary | The owner records UI/input responsiveness and applicable reconnect behavior; process survival alone is insufficient | Defined but not executed |

### Why the integration surface is not resolved

The current documents establish an owned-harness lifecycle and describe the
requirements for a future reviewed surface, but they do not identify a
target-side opt-in, vendor-approved interface, or separately reviewed
owner-authorized live integration contract. The current Gate 6 plan explicitly
keeps third-party delivery outside its implementation scope.

The presence of a remote-runtime capability primitive does not satisfy this
contract. It is neither a policy-approved surface nor proof of the declared
start/handshake/stop/cleanup lifecycle on a third-party target.

Therefore:

```text
approved_integration_surface: UNRESOLVED
```

## Preconditions matrix

| Precondition | Current status | Evidence | Owner/action required | Execution blocker |
| --- | --- | --- | --- | --- |
| Policy record | `RECORDED` | [Live Gate 6 Policy Record](m3-live-gate-6-policy-record-2026-09-12.md) | Preserve it as the governing policy reference | No |
| Target metadata | `PARTIALLY RECORDED` | Historical, read-only metadata only | Record exact target/build identity for a proposed run | Yes |
| Authorization basis | `UNRESOLVED` | No artifact in Section A is sufficient | Retain and review target-specific authorization that applies to the proposed lifecycle class | Yes |
| Approved integration surface | `UNRESOLVED` | Candidate contract above; no approval record | Produce a separately reviewed policy/contract naming the allowed surface | Yes |
| Run identity | `UNASSIGNED` | Live Gate 6 has not been planned | Assign a unique run identifier only after policy approval | Yes |
| Artifact identities | `UNASSIGNED` | Per-run identity rule is recorded | Bind each exact path and SHA-256 to the assigned run | Yes |
| Expected side effects | `PLANNED ONLY` | Candidate contract above | State the allowed effects and detection of unexpected effects | Yes |
| Cleanup and rollback | `PLANNED ONLY` | Owned-harness semantics only | Approve target-specific obligations and failure handling | Yes |
| Evidence destination | `PLANNED ONLY` | Policy record names raw and tracked destinations | Pre-create and verify a run-specific evidence plan | Yes |
| Owner sanity | `DEFINED, NOT EXECUTED` | Policy record procedure | Owner records the future run's observations | Yes |
| Live Gate 6 evidence | `NOT TESTED` | No retained live run | None until every preceding blocker is closed | Yes |

## Review provenance and non-actions

This review was created from repository and policy documents only. It did not
build artifacts, run a check suite, inspect or interact with a target process,
acquire a task port, attach, load a runtime, or modify implementation code.

```text
LIVE GATE 6 POLICY: NO-GO
```
