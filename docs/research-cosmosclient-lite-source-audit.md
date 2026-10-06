# CosmosClient/lite macOS source audit

Status: **source-only audit complete — architecture reference only; no third-party
source was copied, built, or run**

Audited snapshot:

```text
repository: CosmosClient/lite
branch: main
commit: 65ef61f5e6be78eb415714ee4c23fdc6e06f0d78
commit date: 2026-03-31
```

This record is deliberately limited to static source inspection. It is not
evidence that the upstream loader works on the current shipped Lunar Client, nor
authorization to use a different transport on a third-party target.

## What the source contains

The snapshot contains three distinct pieces:

1. Lunar discovery based on the `moonsworth` command-line marker and the
   `--version` argument.
2. A macOS native loader in `inject/src/mac.rs`.
3. A dylib bootstrap that discovers an existing JVM, attaches its own native
   thread, resolves a Minecraft classloader, then attempts JVM instrumentation.

The JVM/bootstrap split supports the core Opus architecture:

```text
transport
    -> native runtime entry
    -> JavaVM discovery
    -> per-thread JNIEnv
    -> classloader resolution
    -> Java-side runtime
```

The classloader approach is especially useful as a research input: it scans
thread context classloaders and validates a candidate by resolving
`net.minecraft.client.Minecraft`.

## Critical transport finding

The macOS loader's first operational gate is acquisition of the target's Mach
task port. If that request fails, it returns failure before any remote memory
or thread operation.

Therefore it does **not** provide an alternate route around the task-port
denial measured on the shipped Lunar JVM. It assumes a target for which that
capability is already available.

This directly matches the current M3 capability conclusion:

```text
Lunar retail task-port denied
    -> Cosmos transport cannot begin
```

The source should not be described as proof that current Lunar retail injection
works on macOS.

## Non-reuse boundary

The loader writes a raw remote bootstrap and launches a remote thread. OPUS M3
excludes stealth, manual mapping, concealment, and unbounded process control.
[Decision 0007](decisions/0007-owner-authorized-host-experiment-boundary.md)
allows separately declared host-level research on the project owner's Mac, but
that does not make this upstream loader a production transport donor. OPUS
still requires typed diagnostics, a versioned handshake, target-survival
evidence, clean logical unload, and reinjection evidence.

The audited upstream transport does not meet those OPUS lifecycle requirements:

- its public result is only a Boolean load attempt result;
- a successful return means the remote thread was started, not that a dylib
  constructor, JVM handshake, or Java runtime reached `ready`;
- no corresponding typed unload/reinjection contract was found in the audited
  `inject` and `bootstrap` crates; and
- no conventional repository-level software license file was found in this
  snapshot, so source reuse is prohibited pending a separate license review.

Consequently, no upstream transport code, shellcode, or instrumentation
implementation may be copied into OPUS.

## Reusable research conclusions

OPUS may independently implement and test the following high-level design
ideas only in its owned or explicitly authorized harnesses:

- client hints remain separate from explicit PID and JVM-target validation;
- the native runtime starts owned work after its loader entry has completed;
- `JNI_GetCreatedJavaVMs` can discover an in-process Java VM;
- a `JNIEnv` is thread-specific and must not be used as a global cross-thread
  handle; and
- classloader resolution should use multiple strategies and verify a Minecraft
  class before retaining the loader.

## Decision

CosmosClient/lite is a useful **M0 architecture donor** for the JVM bootstrap
and classloader research lane. It is not an OPUS transport donor and does not
change the current capability result for Lunar retail.

The next implementation work remains a controlled, architecture-matched
Opus-owned target proof. A live Lunar test can begin only if the target exposes
an authorized transport capability or Lunar provides the pending concrete
third-party method.
