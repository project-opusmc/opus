# M3 General Gate 6 Current Policy and Status — September 14, 2026

Status: **HISTORICAL PROVENANCE — superseded as the current project-state
source on September 15, 2026.**

> **Later-source notice:** use the
> [September 15, 2026 current policy and status record](m3-general-gate-6-current-policy-status-2026-09-15.md)
> for every current General Gate 6 project-state decision. The record below
> remains an intact account of the September 14 `ACTIVE / EVIDENCE-PENDING`
> context; it must not restart the frozen injector R&D lane or override the
> current Client + Launcher UI-first priority.

This record supersedes the September 12, 2026 live-Gate-6 planning records
only when determining the current project state. It preserves those records as
historical provenance and does not claim vendor endorsement or vendor
authorization.

## Current authority and experiment scope

| Boundary | Current state | Meaning |
| --- | --- | --- |
| Machine and account control | `OWNER-CONTROLLED` | The local development Mac and the Minecraft account/session used for the experiment are controlled by the project owner. |
| Project experiment authorization | `OWNER-AUTHORIZED` | The project owner has authorized bounded local Opus research and testing on that machine/account. |
| Vendor authorization | `UNRESOLVED / NOT CLAIMED` | No vendor approval, endorsement, opt-in interface, or compatibility certification is asserted. |
| Target ownership | `THIRD-PARTY / NOT OPUS-OWNED` | Owner control of the machine or account does not relabel a vendor client as Opus-owned. |
| General Gate 6 architecture | `ACTIVE` | There is one General Bootstrap Lifecycle gate with the configured mandatory profiles. |
| Current live-lane state | `ACTIVE / EVIDENCE-PENDING` | The current owner-authorized experiment scope is active; no live Gate 6 result exists until retained normalized evidence proves it. |

`ACTIVE / EVIDENCE-PENDING` is not a Gate 6 `PASS`, a claim of technical
readiness for any particular target, or a vendor authorization. It removes no
containment requirement and authorizes no action outside the bounded
owner-authorized project experiment scope.

The current scope is limited to local Opus research on the owner-controlled
machine/account, one currently selected General Gate 6 target at a time, and
auditable evidence. It excludes persistence, stealth, evidence erasure,
unrelated-process targeting, system-security reconfiguration, and any
unrecorded side effect. No client-side vendor authorization is inferred.

## Current General Gate 6 state

| Item | Status |
| --- | --- |
| `opus-owned` / Branch A | `PASS` |
| `badlion` | `NOT_TESTED` |
| `lunar` | `NOT_TESTED` |
| Owner confirmation for a full aggregate | `PENDING` |
| General Gate 6 aggregate | `NOT_TESTED` |
| General Gate 6 promotion | `NOT PASSED` |
| Gate 7 | `BLOCKED until a valid General Gate 6 seal` |

The current mandatory composition is `opus-owned`, `badlion`, and `lunar`.
The General Gate 6 lifecycle contract and aggregate/seal rules remain the
technical acceptance source. A Branch A `PASS` does not promote General Gate
6, and a future single-target `PASS` does not unlock Gate 7.

## Current source-of-truth precedence

For a current General Gate 6 project-state decision, use sources in this
order:

1. this current policy and status record;
2. [the General Gate 6 lifecycle contract](m3-gate-6-bootstrap-lifecycle-plan.md);
3. retained, current normalized evidence and its per-run witness provenance;
4. September 11–12 records as historical provenance only.

The September 12 `NO-GO` decisions remain accurate descriptions of their
former planning model and date. They do not override this later current-state
decision merely because they retain `NO-GO` text.

## Relationship to historical records

The following records are historical under the former Gate 6A/live-Gate-6
planning model:

- [Live Gate 6 Policy Record — September 12](m3-live-gate-6-policy-record-2026-09-12.md);
- [Authorization and Integration-Surface Review — September 12](m3-live-gate-6-authorization-surface-review-2026-09-12.md); and
- [Live Gate 6 Readiness Decision — September 12](m3-live-gate-6-readiness-decision-2026-09-12.md).

Their historical findings, including `authorization_basis: UNRESOLVED`,
`approved_integration_surface: UNRESOLVED`, and `execution_status: NO-GO`, are
not rewritten. They describe their former decision context; they are not an
eternal, project-wide blocker under the active General Gate 6 architecture.

## Non-claims and boundaries

This record does not claim:

- vendor authorization or vendor approval;
- a Badlion or Lunar Gate 6 result;
- a General Gate 6 `PASS`;
- a Gate 7 handoff;
- an approved client adapter, Java/JNI/JVMTI bridge, mapping, hook, runtime,
  persistence mechanism, or release readiness; or
- that a historical PID is a current target identity.

Any future target result must be represented by retained normalized evidence
for the selected profile, bound to the current run's identity and artifact
provenance. This documentation update itself performed no build, process
discovery, target interaction, attachment, load, or execution.

## Record provenance

This current-state reconciliation records the project owner's September 14,
2026 direction for local Opus research/testing on the owner-controlled
machine/account. It is interpreted together with
[Decision 0007: Owner-authorized host experiment boundary](../decisions/0007-owner-authorized-host-experiment-boundary.md)
and the current General Gate 6 lifecycle contract. It does not convert owner
authorization into vendor authorization.
