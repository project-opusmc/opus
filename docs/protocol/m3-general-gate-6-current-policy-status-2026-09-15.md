# M3 General Gate 6 Current Policy and Status — September 15, 2026

Status: **CURRENT SOURCE OF TRUTH for General Gate 6 project-state decisions.**

This record supersedes the September 14, 2026 current-policy record only for
current Gate 6 project-state decisions. It preserves all earlier M3, Gate, and
authorization records as dated provenance.

The product mainline is now governed by
[Decision 0008: Opus Client + Launcher mainline, UI first](../decisions/0008-opus-client-launcher-ui-first-mainline.md).
That product-priority decision does not erase or reinterpret injector evidence.

## Current authority and R&D freeze

| Boundary | Current state | Meaning |
| --- | --- | --- |
| Machine and account control | `OWNER-CONTROLLED` | The local development Mac and experiment account/session remain controlled by the project owner. |
| Project experiment authorization | `OWNER-AUTHORIZED / FROZEN` | The owner retains authority for bounded local research, but has frozen new injector/injection execution. |
| Vendor authorization | `UNRESOLVED / NOT CLAIMED` | No vendor approval, endorsement, opt-in interface, or compatibility certification is asserted. |
| Target ownership | `THIRD-PARTY / NOT OPUS-OWNED` | Owner control of a machine or account does not relabel a vendor client as Opus-owned. |
| General Gate 6 architecture | `FROZEN / EVIDENCE-PRESERVED` | There remains one General Gate 6 contract; it is not an active product-mainline work lane. |
| Current live lane | `FROZEN / NO NEW EXECUTION` | Do not start a new target interaction, lifecycle run, delivery attempt, or evidence promotion without an explicit owner resumption decision. |

`FROZEN / EVIDENCE-PRESERVED` does not mean failed, passed, deleted,
superseded evidence, vendor-authorized, or release-ready. It means that the
injector R&D source, artifacts, notes, reproducibility bundles, and retained
evidence are preserved for a later explicit return while the Client + Launcher
UI-first mainline takes priority.

The freeze authorizes no evidence erasure, destructive cleanup, unrelated
process targeting, persistence, stealth, system-security reconfiguration, or
unrecorded side effect.

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

No listed result changes because of the R&D freeze. In particular, the retained
`opus-owned` result does not promote General Gate 6, and no future Client +
Launcher UI work can unlock Gate 7.

## Current source-of-truth order

For a current General Gate 6 project-state decision, use sources in this order:

1. this September 15, 2026 policy and status record;
2. Decision 0008 for current product-mainline priority and the injector R&D
   freeze;
3. the General Gate 6 lifecycle contract;
4. retained, normalized evidence and its per-run witness provenance; and
5. September 11–14 records as dated provenance only.

The September 12 `NO-GO` records and the September 14 `ACTIVE /
EVIDENCE-PENDING` record remain accurate descriptions of their former
decision contexts. They do not override this later freeze.

## Preservation and resumption boundary

The following categories are retained intact as experimental/R&D material:

- injector, native transport, bootstrap, and adapter source;
- Gate 3–6 records, normalized evidence, session witnesses, and reproducibility
  bundles;
- artifact identities, checksums, build notes, and authorization records; and
- historical vendor and target-analysis documents.

Resumption requires an explicit owner decision naming the R&D scope. It must
re-read this record, establish a new current target identity if a live target
is in scope, and retain new evidence without altering historical results.

## Non-claims

This policy does not claim:

- vendor authorization or vendor approval;
- a Badlion or Lunar Gate 6 result;
- a General Gate 6 `PASS`;
- a Gate 7 handoff;
- that the frozen injector lane is the Client + Launcher delivery mechanism;
- that UI-first work has changed Runtime or Launcher artifacts; or
- that a historical PID is a current target identity.

This documentation update performs no build, process discovery, target
interaction, attachment, load, execution, staging, or deletion.
