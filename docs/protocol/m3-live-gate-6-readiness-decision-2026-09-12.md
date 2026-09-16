# M3 Live Gate 6 Readiness Decision — September 12, 2026

> **Historical record — superseded for current project-state decisions.**
> This preserves the former September 12, 2026 Gate 6A/live-Gate-6 readiness
> decision, including its dated `NO-GO`. For the active General Gate 6
> architecture, use [the current General Gate 6 policy and status
> record](m3-general-gate-6-current-policy-status-2026-09-15.md). This notice
> does not claim vendor authorization or alter this historical decision.

Status: **decision record. It is not an implementation plan and does not
authorize target interaction or live execution.**

## Locked status

```yaml
owned_harness_status: SEALED / PASS
live_gate_6_status: NOT TESTED
authorization_basis: UNRESOLVED
approved_integration_surface: UNRESOLVED
execution_status: NO-GO
```

This decision consolidates the
[Live Gate 6 Policy Record](m3-live-gate-6-policy-record-2026-09-12.md) and
the
[Live Gate 6 Authorization and Integration-Surface Review](m3-live-gate-6-authorization-surface-review-2026-09-12.md).

## What has been demonstrated

- The Opus-owned Gate 6 bootstrap host has demonstrated its bounded native
  lifecycle: artifact identification, declared start, deterministic handshake,
  logical stop, cleanup acknowledgement, and unload observation.
- Owned-lane witness provenance and the owned-harness regression result are
  sealed within their stated evidence boundary.
- Regression integrity for the recorded Gate 6 window is sealed as owned-lane
  evidence; it does not establish a live-target result.
- The claim semantics have been corrected:
  - the nonce is a deterministic iteration token, not an entropy source or
    replay protection;
  - host readiness currently means `iterations >= 25`, while the
    `1 -> 3 -> 10 -> 25` progression is test-harness discipline; and
  - artifact identity is per run and must use
    `run_id + absolute path + SHA-256`.

## What has not been demonstrated

None of the following has been established:

- live Gate 6 execution;
- target-specific authorization;
- an approved live integration surface;
- live target side-effect or cleanup behavior;
- live owner-sanity observations; or
- a repository-backed live witness bundle and run record.

Historical target observations, technical capability records, and owned-harness
results remain evidence in their own lanes only. They do not close any item in
this section.

## Sole condition for reopening the live lane

The live lane may be reopened only when a new authorization artifact with
verifiable provenance is retained and reviewed. That artifact must identify:

```text
authorizing_party
target/product scope
permitted integration surface
permitted operation classes
build/version scope
lifecycle permissions
validity period, if applicable
evidence/provenance
```

Machine ownership, historical success, a general non-prohibition, read-only
process observation, technical feasibility, and an owned-harness pass are not
substitutes for that authorization artifact.

## Reopen rule

1. Only after `authorization_basis` is resolved may
   `approved_integration_surface` be reviewed again.
2. Only after both `authorization_basis` and
   `approved_integration_surface` are resolved may a new
   execution-readiness review be created.
3. No document, capability result, or prior test automatically changes
   `NO-GO` to `GO`.

The future execution-readiness review is a separate decision point. It must
not be pre-created as a run, evidence bundle, artifact identity, or execution
approval.

## PID rule

PID `67644` is historical, read-only observation metadata only. It is neither
a stable target identity nor a value that may be carried into a future live
run. A future approved run must establish its target identity at that run's
own time and preserve only the permitted, non-sensitive metadata.

## Repository state

Live Gate 6 has no execution evidence. This record does not create a live
`run_id`, helper/bootstrap/runtime hash, artifact tuple, or witness-bundle
placeholder. No value may be added merely to make a future run appear to
already exist.

## Decision rationale

| Question | Decision |
| --- | --- |
| Has the owned-harness lifecycle passed? | Yes, within its owned-harness evidence boundary |
| Has live Gate 6 been tested? | No |
| Is there target-specific authorization? | No; `authorization_basis` remains `UNRESOLVED` |
| Is a live integration surface approved? | No; `approved_integration_surface` remains `UNRESOLVED` |
| Can an execution-readiness review be created now? | No |
| Can execution begin now? | No |

## Record provenance and non-actions

This decision is derived only from the two linked policy records. It does not
build artifacts, run tests, create a live run identity, inspect a process,
attach, acquire a task port, load a runtime, or modify implementation code.

```yaml
LIVE GATE 6 EXECUTION: NO-GO
LIVE LANE: CLOSED PENDING AUTHORIZATION
```
