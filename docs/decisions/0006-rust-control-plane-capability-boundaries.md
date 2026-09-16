# Decision 0006: Keep Rust control plane and make target capability and authority explicit

Status: **FROZEN R&D decision — preserved for an explicit future injector
resumption; not active product-mainline authority as of September 15, 2026**

> The active product authority is
> [Decision 0008](0008-opus-client-launcher-ui-first-mainline.md). This
> decision remains a retained injector R&D boundary only. It does not authorize
> new target interaction, transport execution, or Gate promotion while the
> injector lane is frozen.

## Decision

OPUS keeps the existing Rust `opus-injector` as the control plane. The team
injector specification is a behavioral and subsystem contract; it does not
require a C++ rewrite merely to reproduce conceptual class or file names.

The current implementation mapping is:

| Contract concept | Current implementation |
| --- | --- |
| Injector orchestration | Rust CLI and crate modules |
| macOS backend | Rust `native_transport` bridge plus `opus-macos-transport` |
| remote process/execution/dynamic-loader work | narrow C++ macOS helper |
| runtime handshake | Rust protocol-v1 validation plus native runtime descriptor |
| lifecycle state | PID-/process-instance-bound Rust session state machine |

No subsystem is to be rewritten into C++ unless a measured technical problem
cannot be solved by the Rust control plane and thin native transport boundary.

## Capability rule

A client name, command-line argument, code-signing metadata, or absence of
`-XX:+DisableAttachMechanism` is not a capability result.

For one explicit current-user Minecraft JVM, `opus-injector probe-native`
performs the reviewed read-only native task-port probe and reports:

- `CAPABILITY_AVAILABLE` when the target exposes the native probe path; or
- `UNSUPPORTED_TARGET_CONFIGURATION` when macOS denies the path.

The Rust `CodeSignInspector` reports hardened-runtime and `get-task-allow`
metadata only as diagnostic evidence. It deliberately does not infer task-port
permission from those fields. `probe-jvm-attach` separately performs only the
bounded `jcmd <pid> VM.version` query and reports the observed Attach
capability; it never calls an agent-load operation.

If the selected target exposes no supported instrumentation route, that is a
correct terminal compatibility result for the selected-PID transport path. It
does not silently expand the implementation's scope. A separately declared
owner-authorized host experiment is governed by
[Decision 0007](0007-owner-authorized-host-experiment-boundary.md), not by
this CLI's selected-PID path.

## Owner-authorized host experiments

The project owner may authorize host-level research on the designated
development Mac, including the host's security configuration, signing, and
local service/daemon configuration. This authority is a host fact; it does not
make Lunar, Badlion, or another vendor's binary OPUS-owned.

The current Rust CLI does **not** implement this lane. Its current-user,
selected-PID checks remain deliberate and correct for the compiled transport.
Any future host-level mechanism needs a separately reviewed implementation,
explicit scope/rollback record, and M3 lifecycle proof on the selected game
target before it can be called an M3 result.

## Development-only lanes

Native agent attachment and LLDB are explicitly limited to the
source-controlled `AttachTargetHarness`:

- `attach-harness` remains a test-only JDK Attach proof.
- `lldb-harness probe` only performs an attach-and-detach availability check
  against that same harness.
- `probe-jvm-attach` is a separate diagnostic-only capability query for an
  explicit current-user Minecraft JVM, with no agent load.
- `attach-harness` and `lldb-harness` reject a general Minecraft JVM before
  they start. `probe-jvm-attach` may query a selected current-user Minecraft
  JVM, but it is not a production fallback for a retail Lunar, Badlion, Forge,
  Vanilla, or launcher process.

## Lifecycle and stress evidence

The native transport session permits only this transition sequence:

```text
stopped -> load-pending -> running -> unload-pending -> stopped
```

Known pre-entry denials such as `TaskPortDenied` and
`RosettaRemoteThreadUnavailable` remove the newly created private session.
Unknown post-request failures preserve recovery state rather than claiming
safe cleanup.

`tests/check-injector-native-transport-stress.sh` repeats the non-cooperative
Java fixture lifecycle, verifies target survival in each cycle, and records
RSS before/after each round. This is development evidence only; a normal
Minecraft client and each later client adapter still require their own
completion evidence.
