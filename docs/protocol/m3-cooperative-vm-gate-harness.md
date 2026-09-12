# M3 Cooperative VM Gate Harness

Status: **test-only protocol v2 for Gate 3 and data-only Gate 4; not M3
General transport or client-certification evidence**

## Purpose

This harness makes the VM primitives independently measurable against any
same-user process that explicitly participates in its protocol. It is not tied
to a particular OPUS fixture executable, but it is also not an arbitrary-PID
memory tool.

A participating target publishes an owner-only descriptor for its own current
process instance. The probes accept only `--pid`; they do not accept a caller
supplied target address, byte payload, runtime path, executable protection, or
execution request.

## Cooperative descriptor v2

The descriptor filename is derived from the selected PID:

```text
/tmp/opus-cooperative-vm-probe-<pid>.descriptor
```

It is created with mode `0600` and must remain a regular, non-symlink file.
The reader rechecks its device/inode after opening it. Schema v2 binds the
probe to:

- the selected PID;
- the canonical executable path reported for that PID;
- the process start timestamp, so a recycled PID cannot reuse a stale
  descriptor;
- a fresh private session nonce;
- the fixed public Gate 3 marker address/value; and
- explicit capabilities: `vm_read` or `vm_read,vm_rw`.

The target's executable identity and process-instance timestamp are verified
again immediately before a task port is requested.

## Gate 3 — VM map/query/read

`opus-task-port-vm-read-probe --pid <pid>` requires `vm_read`. It:

```text
descriptor + target identity
    -> task port
    -> region query for the target-published marker
    -> read exactly the eight-byte public marker
    -> verify the marker
    -> release task port
```

The test has no address parameter, so it cannot select other target memory.

## Gate 4 — allocation, data protection, write, readback, cleanup

`opus-task-port-vm-rw-probe --pid <pid>` requires the separate `vm_rw`
capability. It:

```text
descriptor + target identity + vm_rw
    -> task port
    -> allocate one target page
    -> apply READ | WRITE protection only
    -> query the resulting data protection
    -> write one fixed-size nonce-derived test pattern
    -> read it back and compare byte-for-byte
    -> deallocate the page
    -> release task port
```

There is no `VM_PROT_EXECUTE`, remote thread, code bootstrap, `dlopen`, JNI, or
JVMTI action in this submodule. A failure after allocation still attempts
deallocation before releasing the task port, and a failed cleanup is emitted as
a typed failure rather than hidden.

## Manual controlled test

For Gate 3:

```bash
./output/injector-native-transport/arm64/opus-task-port-probe-target \
  --seconds 120 \
  --publish-vm-read-marker

./output/injector-native-transport/arm64/opus-task-port-vm-read-probe \
  --pid <cooperative-target-pid>
```

For Gate 4:

```bash
./output/injector-native-transport/arm64/opus-task-port-probe-target \
  --seconds 120 \
  --allow-vm-rw-probe

./output/injector-native-transport/arm64/opus-task-port-vm-rw-probe \
  --pid <cooperative-target-pid>
```

The automated checks are:

```bash
./tests/check-injector-native-vm-read-probe.sh
./tests/check-injector-native-vm-rw-probe.sh
```

## Evidence boundary

A passing Gate 3 or Gate 4 fixture proves only that the named primitive worked
for that participating process instance, helper slice, and host configuration.
It does not prove runtime entry, executable-memory permission, dylib loading,
JNI/JVMTI bridge readiness, unload/reinjection, a Lunar/Badlion adapter, or M3
General completion.
