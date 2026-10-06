# M3 Gate 6 Owned-Harness Reproducibility Record — September 12, 2026

> **Historical Branch A evidence record.** Its `live_execution_authorized: NO`
> field describes the scope of this September 12 owned-harness run; it is not
> the current General Gate 6 experiment authority. For current project-state
> decisions, use [the current General Gate 6 policy and status
> record](m3-general-gate-6-current-policy-status-2026-09-15.md).

Status: **`SEALED / PASS` for General Gate 6 / Branch A
(Opus-owned/cooperative harness) only.** This is not a General Gate 6 `PASS`,
live-target, client, Lunar, or Badlion result.

> Reconciliation metadata added September 14, 2026: the later General Gate 6
> contract consumes this record through a Branch A normalizer. It does not
> rewrite this historical run or promote its owned-harness evidence into
> Branch B evidence.

## Scope lock

This record covers only a clean rebuild and the repository's own fixtures. It
does not select, discover, attach to, or load anything into a third-party
process. Historical PID `67644` was not used.

```yaml
owned_harness_status: SEALED / PASS
live_gate_6_status: NOT TESTED
live_execution_authorized: NO
live_gate_6_interaction: false
historical_pid_used: false
```

## Clean reproduction run

| Field | Value |
| --- | --- |
| Reproduction run ID | `m3-gate6-owned-clean-20260912T024144Z-1209` |
| Gate 6 harness run ID | `bootstrap-lifecycle-20260912T024155Z-2828` |
| Started / finished | `2026-09-12T02:41:44Z` / `2026-09-12T02:43:41Z` |
| Branch / HEAD | `m3-general-transport-foundation` / `6a117fe961d018077dd173709b38b33af96c331c` |
| Source state | Dirty working tree; staged state clean |
| Clean command | `bash scripts/reproduce-m3-gate6-owned-harness.sh` |
| Full suite command | `./scripts/check.sh` |
| Full suite result | Exit `0`; `injector-development` passed |
| Output reuse | `false` |

Before the run, the reproduction wrapper deleted only these validated
generated directories:

```text
/Users/zvwgvx/Project/Opus/output
/Users/zvwgvx/Project/Opus/injector/target
/Users/zvwgvx/Project/Opus/runtime-java/build
/Users/zvwgvx/Project/Opus/launcher/target
```

The wrapper refuses symlinks, non-directories, and paths outside this
allowlist. The first clean attempt ended at a transient pinned-JDK download
connection reset; it is not a pass record. The final run above restarted from
clean state after the provisioning script gained a bounded three-attempt retry
while retaining the existing pinned SHA-256 verification.

## Test-time Gate 6 artifact identity

The following tuples come from the raw Gate 6
`artifact-identity.json`. They identify the exact artifacts used by the Gate 6
host, not a later rebuild.

| Run ID | Artifact | Absolute path | SHA-256 | Architecture |
| --- | --- | --- | --- | --- |
| `bootstrap-lifecycle-20260912T024155Z-2828` | Bootstrap dylib | `/Users/zvwgvx/Project/Opus/output/injector-native-transport/arm64/libopus-bootstrap.dylib` | `2697da6e8eddadf6eb2cb2313c448a01c43d3fa72087101c07ecab51eb20e28b` | `arm64` |
| `bootstrap-lifecycle-20260912T024155Z-2828` | Bootstrap host | `/Users/zvwgvx/Project/Opus/output/injector-native-transport/arm64/opus-bootstrap-host` | `3437d8fbc94ba9c6e8ebb58b931799e57d281f2bb50fafbb2bbf2eb124a49d5f` | `arm64` |

The bootstrap witness additionally records `size_bytes=54112`, ad-hoc
signature, the declared install name, ABI magic `0x4f505336`, ABI version `1`,
and the `rotate-xor-v1` handshake algorithm.

The clean-reproduction wrapper also records final post-suite tuples under its
own run ID:

| Run ID | Artifact | Absolute path | SHA-256 |
| --- | --- | --- | --- |
| `m3-gate6-owned-clean-20260912T024144Z-1209` | Transport helper | `/Users/zvwgvx/Project/Opus/output/injector-native-transport/arm64/opus-macos-transport` | `6d597581172614e07ee37008d90bec31ff43e772597081e421dfe74723593420` |
| `m3-gate6-owned-clean-20260912T024144Z-1209` | Bootstrap dylib, post-suite | `/Users/zvwgvx/Project/Opus/output/injector-native-transport/arm64/libopus-bootstrap.dylib` | `729754130358a6a619b8c3b84006296df3a0bd2f29c18d043e486630da882621` |
| `m3-gate6-owned-clean-20260912T024144Z-1209` | Bootstrap host, post-suite | `/Users/zvwgvx/Project/Opus/output/injector-native-transport/arm64/opus-bootstrap-host` | `16cbf43112cfaa04fb1667d88f9c7e0db69301ef28cc0e405a226549629a7987` |

These two tables must not be merged. The full suite re-signs artifacts
ad-hoc, so a final-output SHA-256 can differ from the one consumed during the
Gate 6 host run even with unchanged source. Every identity claim is therefore
made as `run_id + absolute path + SHA-256`.

## Gate 3–6 clean-run evidence

| Claim | Clean-build evidence | Owned-harness evidence | Repository artifact | Status |
| --- | --- | --- | --- | --- |
| Gate 3 VM read | Fresh arm64/x86_64 transport builds completed before checks | `OPUS native VM map/query/read probe passed.` | This record; raw full-check log | `PASS` |
| Gate 4 VM RW | Same clean build | `OPUS cooperative VM allocation/write/readback/deallocation probe passed.` and direct VM regression passed | This record; raw full-check log | `PASS` |
| Gate 5 native execution | Same clean build | Ladder `1 -> 3 -> 10 -> 25` passed on the cooperative target | This record; raw full-check log | `PASS` |
| General Gate 6 / Branch A bootstrap lifecycle | Fresh arm64 bootstrap and host build | Ladder `1 -> 3 -> 10 -> 25`; final `BootstrapLoadReady`, exact artifact identity, handshake, stop acknowledgement, cleanup, and host survival | This record; Gate 6 raw manifest and checksums | `PASS` |
| Full regression suite | Generated `output/` and build trees deleted before run | `./scripts/check.sh` exit `0` | This record; clean-reproduction manifest and full-check log | `PASS` |
| Artifact hash-drift rejection | Gate 6 host built fresh before fixture runs | Mutated copy rejected with typed `BootstrapArtifactIdentityMismatch`, exit `2` | This record; `artifact-hash-drift.json` and JSONL event | `PASS` |
| Live Gate 6 | Not applicable | No live target was selected or touched | Live-lane policy and readiness records | `NOT TESTED` |

## Gate 6 lifecycle and negative-test result

At stage `25`, the owned bootstrap host emitted:

```text
code=BootstrapLoadReady
architecture=arm64
artifact_identity=verified
handshake_verified=true
stop_acknowledged=true
cleanup=true
dlclose_return=0
host_alive=true
iterations_completed=25
```

The cleanup witness for
`bootstrap-lifecycle-20260912T024155Z-2828` records:

```yaml
cleanup: true
host_processes: none-left-running
exit_code: 0
```

The negative test copied the verified bootstrap to a run-scoped fixture, made
its digest differ, and supplied the original expected digest:

| Field | Value |
| --- | --- |
| Expected tuple digest | `2697da6e8eddadf6eb2cb2313c448a01c43d3fa72087101c07ecab51eb20e28b` |
| Observed fixture digest | `e7f793d29b4bc0c1f7d6dd5c3979b7c30eda2eac432b6f6cac66f6c8179ead1f` |
| Typed outcome | `BootstrapArtifactIdentityMismatch` |
| Host exit code | `2` |
| JSONL witness | `BootstrapCleanupRequired` with the typed mismatch outcome and `cleanup_complete=true` |

This proves the implemented guard observes an actual mismatch before module
loading; it is no longer merely a shell-side hash comparison.

## Semantics preserved by this run

- `session_nonce` is a deterministic counter:
  `base + iteration - 1`. It has no entropy and provides no replay
  protection.
- The host implementation emits `BootstrapLoadReady` when
  `iterations >= 25`. It has no memory of whether stages `1`, `3`, and `10`
  ran previously.
- The `1 -> 3 -> 10 -> 25` progression is a repository test-harness policy.
  The final readiness claim in this record requires that staged ladder, but
  the host does not itself enforce the sequence.
- The later General Gate 6 evidence core makes that same ladder an enforced
  requirement for a normalized `PASS` session. This is a contract
  reconciliation rule applied to new normalization, not a claim that the
  historical host itself remembered prior invocations.
- Artifact identity is per run. No test-time hash is assigned to a different
  run, a post-suite re-sign, or any live-target claim.

## Raw witness retention and integrity

Raw, ignored machine witnesses for this run are retained at:

```text
/Users/zvwgvx/Project/Opus/output/m3-gate-6/owned-clean-reproduction/
  m3-gate6-owned-clean-20260912T024144Z-1209/
```

The directory contains the clean-reproduction manifest, `full-check.log`, and
the Gate 6 subdirectory containing `manifest.json`,
`artifact-identity.json`, `lifecycle-events.jsonl`,
`artifact-hash-drift.json`, stdout/stderr logs, cleanup record, and SHA-256
checksum manifest. Both checksum manifests were re-verified after the run.

This Markdown record is repository-resident and is not ignored. At the time
of writing it is uncommitted and untracked because this reconciliation was
explicitly performed without staging or committing. It is therefore an
evidence summary in the current working tree, not a claim that the current
`HEAD` already contains this record.

## Conclusion

```text
General Gate 6 / Branch A reproducible? YES (current working tree; not yet HEAD-backed)
General Gate 6 / Branch A sealed?       YES
General Gate 6 PASS?                    NO (Branch B and owner confirmation pending)
Live Gate 6 tested?                     NO
Live execution authorized?              NO
```
