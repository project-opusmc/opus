# M3 Gate 3 and Gate 4 Badlion Transcript Backfill — September 11, 2026

Status: **`RECORDED` as historical, transcript-derived evidence for PID
`51238`. A separate, artifact-bound current Badlion live record for PID
`91330` now exists; this file deliberately does not merge their identities.**

## Environment reconciliation metadata — added after audit

| Field | Value | Provenance |
| --- | --- | --- |
| SIP | `disabled` | Post-audit reconciliation metadata added 2026-09-12; not a field retained in the original command transcript. It is current development-host context only and is not retroactively attributed to the PID `51238` transcript. |

## Current live record

On September 11, 2026, Gates 3 and 4 were newly observed against Badlion game
JVM PID `91330` with an exact helper hash and target executable hash. See
[Current Badlion Live Gates 3–5 Record](m3-badlion-live-gates-3-5-record-2026-09-11.md).

The remainder of this document preserves the older PID `51238` evidence
without relabeling it as newly observed.

## Provenance vocabulary

| Label | Meaning in this record |
| --- | --- |
| `transcript-derived` | A claim retained from the development-session transcript; no raw terminal output file was retained in the repository. |
| `repository-observed` | A file or source path inspected during the September 11 reconciliation. |
| `newly observed` | An action run during the September 11 reconciliation. |
| `unknown/pending` | A fact that is not retained or was deliberately not re-created. |

## Historical selected-target claim

| Field | Value | Provenance |
| --- | --- | --- |
| Intended game JVM | Badlion game JVM, not launcher | `transcript-derived` |
| Historical PID | `51238` | `transcript-derived` |
| Target architecture | `arm64` | `transcript-derived` |
| Helper path | `output/injector-native-transport/arm64/opus-macos-transport` | `transcript-derived` |
| Raw command output | Not retained as a repository file | `unknown/pending` |
| Helper SHA-256 used live | Not retained | `unknown/pending` |
| Canonical executable path and SHA-256 for PID `51238` | Not retained | `unknown/pending` |
| Current process state for PID `51238` at `2026-09-11T19:04:24+0700` | PID no longer present; no process discovery fallback was used | `newly observed` |

The locally retained secondary status report says the historical Gate 3/4
result existed only in transcript form; it is not a raw live-run artifact.
That report is itself `repository-observed` context, not a substitute for the
missing terminal output.

## Gate 3 — VM region query and read

Historical claim:

```text
task_port -> VM region query -> small read -> task-port release
```

The session claim was that the direct selected-PID Gate 3 probe succeeded on
the historical Badlion game JVM and published successful Mach return codes.
The exact stdout, selected readable region, byte count, helper digest, and
target-image identity were not retained. Therefore the following status is
intentional:

```text
implementation / cooperative regression: separately verified
historical Badlion live claim:        RECORDED
historical Badlion reproducibility:  UNRESOLVED
```

## Gate 4 — fresh RW allocation, write, readback, deallocation

Historical claim:

```text
task_port -> allocate RW -> write fixed data -> readback exact -> deallocate
```

The session claim was that the direct selected-PID Gate 4 probe succeeded on
the same historical Badlion game JVM and reported successful Mach return
codes. The repository does not retain the raw stdout, helper SHA-256, target
image SHA-256, or a second live run. It must therefore be classified exactly
as Gate 3 above:

```text
implementation / cooperative regression: separately verified
historical Badlion live claim:        RECORDED
historical Badlion reproducibility:  UNRESOLVED
```

## What this reconciliation newly verified

After generated build outputs were removed, the arm64 helper was rebuilt from
the current dirty worktree and the following Opus-owned fixture tests passed:

```text
./tests/check-injector-native-vm-read-probe.sh
./tests/check-injector-native-vm-rw-probe.sh
./tests/check-injector-native-direct-vm-gates.sh
```

These are `newly observed` implementation/cooperative evidence only. They do
not select, discover, read, write, or otherwise act on Badlion.

## Related but separate Badlion artifact

[Badlion Direct Task-Port Capability Record](m3-badlion-direct-task-port-capability-record-2026-09-11.md)
retains an exact target executable SHA-256 and helper SHA-256 for a different
Badlion PID, `4578`, and a task-port-only `sudo` probe. It is
`repository-observed` evidence for that one PID; it is not Gate 3, Gate 4, or
the identity of historical PID `51238`.
