# OPUS-Owned M3 Preview Target

Status: **developer-only preview lane; not M3 completion and not a client
compatibility certification**

This is the first live target that OPUS controls end-to-end. It uses a minimal
isolated Forge 1.8.9 host while a small preview bootstrap starts first,
exposes a private loopback control endpoint, and self-loads one
SHA-256-authorized `libopus-runtime.dylib` only after an explicit request.

It does not attach to, inject into, alter, or claim support for Lunar,
Badlion, TLauncher, Legacy, or another third-party Minecraft client.

## Boundary

```text
developer-only launcher command
        ->
private per-session control configuration
        ->
OpusOwnedM3ClientBootstrap
        ->
ForgeBootstrapMain host with no legacy OPUS Core Mod, UI, or OptiFine mod
        ->
loopback + capability + one authorized runtime
        ->
target self-loads libopus-runtime.dylib
```

The normal Launcher UI and normal `opus launch` path still select
`LaunchMode::ForgeBootstrap`. The preview command is compiled only in a debug
CLI build with the non-default `opus-owned-m3-preview` feature.

The preview retains the sealed LWJGL macOS compatibility artifact required to
start the Java 8 game JVM on current macOS, but explicitly disables its Cocoa
live-resize guard. That opt-out exists only for this isolated M3 host so an
AppKit/LWJGL regression can be tested without changing the normal Forge
rollback behavior.

The control configuration and descriptor are created inside the owner-only
session directory. Before the descriptor is published, the target validates
the launcher-bound target version, canonical preview-bootstrap JAR, its
SHA-256, and the one authorized native runtime. The configuration contains the
per-session capability and must never be copied into issue reports, logs,
source control, or chat.

A dry run discards both private control files immediately. After a terminal
game lifecycle, the preview launcher removes the configuration and descriptor
only after it verifies that the selected JVM has stopped; it preserves them if
the target may still be alive.

## Build the matching preview artifacts

The current managed Minecraft 1.8.9 runtime on macOS is an `x86_64` Java 8
process under Rosetta, even on Apple Silicon. Build the native runtime for the
game JVM architecture, not the host architecture:

```bash
OPUS_RUNTIME_TARGET_ARCH=x86_64 \
  ./scripts/check-injector-foundation.sh

./runtime/gradlew -p runtime-java ownedM3BootstrapJar
```

The expected local inputs are:

```text
output/injector-foundation/libopus-runtime.dylib
runtime-java/build/libs/opus-owned-m3-bootstrap-0.1.0.jar
```

Run `lipo -archs` on the dylib if there is any doubt about the selected JVM
architecture. An architecture mismatch must fail before a load request is sent.

## Start a live OPUS-owned preview game

From `launcher/`, use a debug Cargo build. The explicit acknowledgement keeps
this mode separate from the normal Forge launch:

```bash
cargo run -p opus-cli --features opus-owned-m3-preview -- \
  owned-m3-preview \
  --acknowledge-preview-boundary \
  --offline \
  --username OpusM3Dev \
  --preview-bootstrap ../runtime-java/build/libs/opus-owned-m3-bootstrap-0.1.0.jar \
  --native-runtime ../output/injector-foundation/libopus-runtime.dylib \
  --macos-game-app desktop/src-tauri/resources/Minecraft.app
```

For a real launch, the CLI validates the selected `Minecraft.app` and the
macOS console-lock state before it prepares the managed game host. If the Mac
is locked, it exits without creating a preview session or starting Java;
unlock the console first. `--dry-run` remains available while locked because
it never starts a game process.

For an authenticated account, omit `--offline` and use the usual CLI
credential setup. The launcher prints a session identifier and the **path**
to the private control descriptor; it never prints the descriptor capability
or raw JVM arguments.

Keep this launch terminal open. From the repository root in a second terminal,
capture the lifecycle evidence while the game remains open:

```bash
./scripts/capture-opus-owned-m3-evidence.sh \
  --descriptor "/absolute/private/session/opus-owned-m3-target.properties" \
  --runtime "./output/injector-foundation/libopus-runtime.dylib" \
  --log-directory "/absolute/opus-launcher/logs/<session-id>" \
  --authorization-record "./docs/opus-owned-m3-preview.md" \
  --authorization-reference "docs/opus-owned-m3-preview.md#boundary" \
  --output "./output/m3-opus-owned-client-evidence.json"
```

The capture performs three or more:

```text
health(waiting) -> load -> health(running) -> unload -> health(stopped)
```

cycles, then asks the target to stop its control endpoint and verifies that
the descriptor is removed. Stopping the control endpoint does not terminate
the game, but that game session cannot accept another preview load after the
stop step. Start a fresh preview game for a new capture.

## Exercise the game-side close path

Use a fresh preview session for this check rather than running the evidence
capture first, because the capture deliberately stops its control endpoint.
The command below performs three or more load/unload cycles and then requests
the game close path:

```bash
./scripts/check-opus-owned-m3-clean-close.sh \
  --descriptor "/absolute/private/session/opus-owned-m3-target.properties" \
  --runtime "./output/injector-foundation/libopus-runtime.dylib" \
  --log-directory "/absolute/opus-launcher/logs/<session-id>"
```

`close-game` is capability-gated and is accepted only by the OPUS-owned
preview after the native runtime has already reached `stopped`. Inside that
same JVM it sets LWJGL's existing `close_requested` latch, so Minecraft takes
its normal `Display.isCloseRequested()` loop path. It does not send a process
signal, attach to another process, or provide a way to close Lunar, Badlion,
or another third-party client.

This is a programmatic exercise of the game-side close path, not proof that a
physical macOS title-bar click behaves identically. Before sending a lifecycle
request, the check waits for the current Forge 1.8.9 preview host to finish
its two normal LWJGL audio-startup completions. It fails instead if its log
shows the known OpenAL startup race, a Forge crash report marker, or a JVM
crash marker. A passing run requires the window-ready marker, descriptor
cleanup, and no such failure marker. The Java 8 host may publish `terminated`
from its shutdown hook before the JVM fully exits; the check accepts that
terminal state only after it finds Minecraft's ordinary `Stopping!` close
marker, never merely because the process disappeared.

The capture refuses to create evidence unless the launcher log proves a ready
game window, a `running` game lifecycle status, matching selected PID, and no
JVM crash marker. It repeats those checks after the control endpoint stops, so
the record proves that stopping the endpoint did not kill the game JVM.

The generated JSON is owner-readable only and is checked against
[`protocol/m3-authorized-client-integration-evidence.md`](protocol/m3-authorized-client-integration-evidence.md).
It derives the target version and client-build SHA-256 from the validated
private launch configuration rather than accepting them as capture arguments.
It records hashes and lifecycle results, not the runtime-control capability.

## What this proves—and what it does not

It can prove, for a selected OPUS-owned preview session:

- same-architecture native selection;
- private capability-gated control;
- native runtime entry plus the current foundation handshake;
- logical unload/restart cycles while the game remains alive; and
- clean control-endpoint stop and descriptor removal.

It does not prove M4+ work: Minecraft classloader resolution, a Lunar/Badlion
adapter, Java payload loading, game-thread callbacks, OneConfig compatibility,
or general “any 1.8.9 client” support. M3 is not complete until a reviewer
can inspect a real OPUS game-session capture and its associated source/build
record.
