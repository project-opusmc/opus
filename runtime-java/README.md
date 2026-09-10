# Opus Java Runtime

This component will contain the Java-side bootstrap, Minecraft API, event bus,
module framework, OneConfig compatibility shim, and modules.

The current source is a Java 8-bytecode-compatible, test-only harness set. It
contains the controlled-JVM and injector-owned lifecycle harnesses plus a
separately launched, loopback-only authorized-target fixture. That fixture can
self-load only its startup-authorized local native-runtime path after a
PID-bound descriptor and capability check; it is not a Minecraft client or a
third-party-client integration.
