# Opus Runtime Adapters

Adapters isolate client/version-specific runtime knowledge from the native
runtime and the Java module API.

Future adapters include:

- `lunar-1.8.9/`
- `badlion-1.8.9/`
- `forge-1.8.9/`

An adapter may own runtime detection rules, classloader evidence, and versioned
mappings. It must not contain feature modules, product UI, or raw JNI exposed
to module developers.

The M3 injector may expose a process-side client hint for diagnostics, but that
hint is not adapter selection or a compatibility certification. Adapters begin
only after the runtime has independently proved its JVM/classloader context.
