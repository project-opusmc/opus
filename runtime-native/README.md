# Opus Native Runtime

This is the M2 controlled-JVM foundation for `libopus-runtime.dylib`.

The current vertical slice intentionally proves only:

1. the library loads into a Java 8-bytecode-compatible process launched by the
   test suite;
2. `JNI_GetCreatedJavaVMs` finds the same `JavaVM` supplied to `JNI_OnLoad`;
3. JNI and JVMTI are available on the Java caller thread;
4. an OPUS-owned worker can attach to, use, and detach from the JVM; and
5. runtime shutdown releases all runtime-owned worker state and prevents
   subsequent probe work until an explicit logical restart; and
6. a clean logical restart revalidates the JVM, JNI, JVMTI, and owned-worker
   lifecycle in the same JVM; and
7. the same native lifecycle is callable by the separately launched,
   OPUS-owned authorized-target fixture after it has self-authorized one exact
   local runtime path; and
8. all Java-side native lifecycle calls go through the client-neutral
   `dev.opus.runtime.bridge.NativeRuntimeBridge`, rather than a JNI export
   named after a harness, launcher, or Minecraft client.

The runtime emits structured lifecycle diagnostics using the team-standard
`[OPUS/RUNTIME]`, `[OPUS/JVM]`, and `[OPUS/JVMTI]` prefixes.

It does not discover processes, load into another process, resolve Minecraft
classes, install hooks, render UI, or expose game features.

Run the foundation test from the repository root:

```bash
./scripts/check-injector-foundation.sh
./scripts/check-injector-native-bridge-contract.sh
./scripts/check-injector-authorized-target.sh
```
